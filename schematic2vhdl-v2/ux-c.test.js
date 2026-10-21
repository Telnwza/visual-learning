const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const folder=path.join(__dirname,'../fpga-exam-kit/modules/downloads/all-vhdl-modules');
const disk=name=>({fileName:name,vhdl:fs.readFileSync(path.join(folder,name),'utf8')});
const box=(name='box',body='y<=a;',extra='')=>({fileName:name+'.vhd',vhdl:`library ieee;use ieee.std_logic_1164.all;${extra}
entity ${name} is port(a:in std_logic;y:out std_logic);end;
architecture rtl of ${name} is begin ${body} end;`});
const selected=files=>files.map(file=>({name:file.fileName,text:async()=>file.vhdl}));
function picker(){
 const a=loadApp(),inputs=[];a.ctx.document.createElement=tag=>{
  assert.equal(tag,'input');const input={clicks:0,removed:false,click(){this.clicks++;},remove(){this.removed=true;}};inputs.push(input);return input;
 };
 a.ctx.document.body.appendChild=input=>{input.attached=true;};
 return {...a,inputs,open(){a.run('showVhdlModuleImport()');return inputs.at(-1);}};
}
test('all 49 raw files import in one transaction, create no canvas instances and round trip through Undo/Redo',()=>{
 const a=loadApp();a.ctx.files=fs.readdirSync(folder).filter(n=>n.endsWith('.vhd')).map(disk);assert.equal(a.ctx.files.length,49);
 const before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN');
 a.run('const plan=planVhdlModuleImport(files);');assert.equal(a.run('serialize()'),before);assert.equal(a.run('plan.modules.length'),49);
 assert.equal(a.run('applyVhdlModuleImport(plan).length'),49);assert.equal(a.run('state.history.idx'),idx+1);assert.equal(a.run('_uidN'),uid);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.run('const repeat=planVhdlModuleImport(files);');assert.equal(a.run('repeat.skipped.length'),49);
 assert.equal(a.run('applyVhdlModuleImport(repeat).length'),0);assert.equal(a.run('serialize()'),after);
});
test('an identical raw module preserves installed package metadata, instance settings and history',()=>{
 const a=loadApp();a.ctx.pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../fpga-exam-kit/modules/packs/registers.sccomp.json'),'utf8'));
 a.ctx.raw=disk('ss_reg_pipo.vhd');a.run(`applyCustomPackages([pack]);const id=addComp('CUSTOM:ss_reg_pipo',200,100,{generic_WIDTH:64});
 const old=state.project.customs.ss_reg_pipo,before=serialize(),idx=state.history.idx;const plan=planVhdlModuleImport([raw]);`);
 assert.equal(a.run('plan.modules.length'),0);assert.equal(a.run('plan.skipped.length'),1);
 assert.equal(a.run('applyVhdlModuleImport(plan).length'),0);assert.equal(a.run('state.project.customs.ss_reg_pipo===old'),true);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 assert.equal(a.run('getPort(comp(id),"q").width'),64);
});
test('an identical source with renamed/reordered support files skips without replacing stored metadata',()=>{
 const a=loadApp(),q={fileName:'q.vhd',vhdl:'package q is constant C:integer:=1;end package;'},p={fileName:'p.vhd',vhdl:'use work.q.all;package p is constant N:integer:=C;end package;'};
 a.ctx.files=[box('uses_package','y<=a;','use work.p.all;'),p,q];
 a.run('applyVhdlModuleImport(planVhdlModuleImport(files));const before=serialize();');
 a.ctx.files=[q,p,box('uses_package')].map(f=>({...f,fileName:'renamed_'+f.fileName}));
 a.ctx.files[2].vhdl=box('uses_package','y<=a;','use work.p.all;').vhdl;
 assert.equal(a.run('planVhdlModuleImport(files).skipped.length'),1);
 a.run('applyVhdlModuleImport(planVhdlModuleImport(files))');assert.equal(a.run('serialize()'),a.run('before'));
});
test('same-name entity or package conflicts block the entire batch and never overwrite installed sources',()=>{
 for(const conflict of ['entity','package']){
  const a=loadApp(),pkg={fileName:'p.vhd',vhdl:'package p is constant C:integer:=1;end;'};
  a.ctx.initial=[box('installed','y<=a;','use work.p.all;'),pkg];a.run('applyVhdlModuleImport(planVhdlModuleImport(initial));const before=serialize(),idx=state.history.idx;');
  a.ctx.files=conflict==='entity'?[box('new_box'),box('installed','y<=not a;','use work.p.all;')]:[box('new_box'),{...pkg,vhdl:pkg.vhdl.replace(':=1',':=2')}];
  assert.throws(()=>a.run('planVhdlModuleImport(files)'),/ซ้ำ.*source ไม่ตรง/);
  assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 }
});
test('identical files within a batch deduplicate, while different same-name sources remain a conflict',()=>{
 const a=loadApp();a.ctx.files=[box(),{...box(),fileName:'copy.vhd'}];
 assert.equal(a.run('planVhdlModuleImport(files).modules.length'),1);
 a.ctx.files.push(box('box','y<=not a;'));assert.throws(()=>a.run('planVhdlModuleImport(files)'),/source ไม่ตรง/);
});
test('installed packages can support a new entity and remain attached for standalone export',()=>{
 const a=loadApp();a.ctx.initial=[box('first','y<=a;','use work.p.all;'),{vhdl:'package p is constant C:integer:=1;end;'}];
 a.run('applyVhdlModuleImport(planVhdlModuleImport(initial));');a.ctx.next=box('second','y<=a;','use work.p.all;');
 a.run('applyVhdlModuleImport(planVhdlModuleImport([next]));const packages=validateVhdlModules({...state.project,customs:{second:state.project.customs.second}});');
 assert.equal(a.run('packages.has("p")'),true);
});
test('Apply revalidates an identical skip if its source changed after planning',()=>{
 const a=loadApp();a.ctx.files=[box()];a.run('applyVhdlModuleImport(planVhdlModuleImport(files));const plan=planVhdlModuleImport(files);state.project.customs.box.vhdl=state.project.customs.box.vhdl.replace("y<=a;","y<=not a;");const before=serialize();');
 assert.throws(()=>a.run('applyVhdlModuleImport(plan)'),/source ไม่ตรง/);assert.equal(a.run('serialize()'),a.run('before'));
});
test('primary Import opens only an attached multi-file picker, and Cancel changes no project/history',()=>{
 const a=picker(),before=a.run('serialize()'),idx=a.run('state.history.idx'),input=a.open();
 assert.equal(input.type,'file');assert.equal(input.multiple,true);assert.equal(input.hidden,true);assert.equal(input.attached,true);assert.equal(input.clicks,1);
 input.oncancel();assert.equal(input.removed,true);assert.equal(a.run('state.moduleImport'),null);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
});
test('the primary picker commits a valid file immediately and reveals it despite an old search',async()=>{
 const a=picker();a.run("state.paletteSearch='unrelated';");const before=a.run('serialize()'),idx=a.run('state.history.idx');
 const input=a.open();input.files=selected([box()]);await input.onchange();
 assert.equal(input.removed,true);assert.equal(a.run('state.moduleImport'),null);assert.equal(a.run('state.history.idx'),idx+1);
 assert.equal(a.run('state.paletteSearch'),'');assert.deepEqual(a.json('state.paletteRecent.names'),['box']);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('missing LCD writer retains the controller; adding it offers a root and imports its dependency with one Undo',async()=>{
 const a=picker(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 let input=a.open();input.files=selected([disk('ss_lcd16x2.vhd')]);await input.onchange();
 assert.equal(a.run('state.moduleImport.files.length'),1);assert.match(a.run('state.moduleImport.error'),/ss_lcd_write/);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 const session=a.run('state.moduleImport');input=a.open();input.oncancel();assert.equal(a.run('state.moduleImport'),session);
 input=a.open();input.files=selected([disk('ss_lcd_write.vhd')]);await input.onchange();
 assert.equal(a.run('state.moduleImport.choose'),true);assert.equal(a.run('serialize()'),before);
 a.run('finishVhdlModuleImport(state.moduleImport,true)');
 assert.equal(a.run('state.moduleImport'),null);assert.equal(a.run('state.history.idx'),idx+1);
 assert.deepEqual(a.json('state.paletteRecent.names'),['ss_lcd16x2']);
 assert.equal(a.run('state.project.customs.ss_lcd_write.importDependency'),true);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('a bad later file retains the complete queue without installing its valid peer; Cancel discards only the queue',async()=>{
 const a=picker(),before=a.run('serialize()'),idx=a.run('state.history.idx'),input=a.open();
 input.files=selected([box(),{fileName:'bad.vhd',vhdl:'invalid'}]);await input.onchange();
 assert.equal(a.run('state.moduleImport.files.length'),2);assert.match(a.run('state.moduleImport.error'),/bad.vhd/);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 a.run('cancelVhdlModuleImport()');assert.equal(a.run('state.moduleImport'),null);assert.equal(a.run('serialize()'),before);
});
test('removing the conflicting queued file allows the remaining valid file to commit atomically',async()=>{
 const a=picker();a.ctx.initial=[box('installed')];a.run('applyVhdlModuleImport(planVhdlModuleImport(initial));const idx=state.history.idx;');
 const input=a.open();input.files=selected([box('new_box'),box('installed','y<=not a;')]);await input.onchange();
 assert.equal(a.run('Object.keys(state.project.customs).length'),1);
 a.run('state.moduleImport.files.splice(1,1);finishVhdlModuleImport(state.moduleImport,true);');
 assert.equal(a.run('state.history.idx'),a.run('idx+1'));assert.equal(a.run('Object.keys(state.project.customs).length'),2);
});
test('Cancel during file reading ignores the late result and permits a fresh import',async()=>{
 const a=picker(),before=a.run('serialize()');let release;
 const input=a.open();input.files=[{name:'box.vhd',text:()=>new Promise(resolve=>{release=resolve;})}];
 const reading=input.onchange();assert.equal(a.run('state.moduleImport.reading'),true);a.run('cancelVhdlModuleImport()');
 release(box().vhdl);await reading;assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.moduleImport'),null);
 const next=a.open();next.files=selected([box()]);await next.onchange();assert.equal(a.run('Object.keys(state.project.customs).length'),1);
});
test('changing the project while reading never imports into either project',async()=>{
 const a=picker();a.run('const old=state.project;');let release;const input=a.open();
 input.files=[{name:'box.vhd',text:()=>new Promise(resolve=>{release=resolve;})}];const reading=input.onchange();
 a.run('const next=blankProject();state.project=next;');release(box().vhdl);await reading;
 assert.equal(a.run('Object.keys(old.customs).length'),0);assert.equal(a.run('Object.keys(next.customs).length'),0);
});
test('a read failure reports the filename without losing files that were already pending',async()=>{
 const a=picker(),before=a.run('serialize()');let input=a.open();input.files=selected([disk('ss_lcd16x2.vhd')]);await input.onchange();
 input=a.open();input.files=[{name:'unreadable.vhd',text:async()=>{throw new Error('read failed');}}];await input.onchange();
 assert.equal(a.run('state.moduleImport.files.length'),1);assert.match(a.run('state.moduleImport.error'),/unreadable.vhd.*read failed/);
 assert.equal(a.run('serialize()'),before);
});
