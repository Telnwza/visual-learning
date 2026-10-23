const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const moduleSource=(name,body='q<=d;',extra='')=>`library ieee;use ieee.std_logic_1164.all;${extra}
entity ${name} is port(d:in std_logic;q:out std_logic);end entity;
architecture rtl of ${name} is begin ${body} end architecture;`;
const pkg=`library ieee;use ieee.std_logic_1164.all;package logic_pkg is
 function flip(d:std_logic)return std_logic;end package;
library ieee;use ieee.std_logic_1164.all;package body logic_pkg is
 function flip(d:std_logic)return std_logic is begin return not d;end;
end package body;`;
const root=moduleSource('bundle_root','u:entity work.child port map(d=>d,q=>q);');
const child=moduleSource('child','q<=flip(d);','use work.logic_pkg.all;');
const bundle={fileName:'external.vhd',vhdl:root+'\n'+pkg+'\n'+child+'\n'+moduleSource('spare')};
function setup(files=[bundle]){const a=loadApp();a.ctx.files=files;a.run('const catalog=inspectVhdlImport(files);');return a;}
function selectedPlan(a,names){a.ctx.names=names;a.run('const plan=planVhdlModuleImport(files,state.project,{selected:catalog.modules.filter(m=>names.includes(m.name)).map(m=>m.id)});');}
test('multi-unit source keeps context clauses, package bodies and literal/comment boundaries',()=>{
 const a=setup([{...bundle,vhdl:'-- entity ghost is\n'+bundle.vhdl.replace('q<=d;',`q<=d;assert false report "architecture ghost of fake is" severity note;`)}]);
 assert.deepEqual(a.json('catalog.modules.map(m=>m.name)'),['bundle_root','child','spare']);
 assert.deepEqual(a.json('catalog.roots'),['0:bundle_root','0:spare']);
 assert.match(a.run('catalog.packages[0].vhdl'),/function flip/);assert.match(a.run('catalog.packages[0].vhdl'),/end package body;/);
 assert.match(a.run('catalog.modules.find(m=>m.name==="child").vhdl'),/use work.logic_pkg.all;/);
 assert.doesNotMatch(a.run('catalog.modules[0].vhdl'),/package body/);
});
test('selected root imports only its closure and shows one tile, with one Undo/Redo and persistence',()=>{
 const a=setup(),before=a.run('serialize()'),idx=a.run('state.history.idx');selectedPlan(a,['bundle_root']);
 assert.equal(a.run('serialize()'),before);assert.deepEqual(a.json('plan.modules.map(m=>m.name)'),['bundle_root','child']);
 a.run('applyVhdlModuleImport(plan)');assert.equal(a.run('state.history.idx'),idx+1);
 assert.deepEqual(a.json('paletteEntries().filter(e=>e.type.startsWith("CUSTOM:")).map(e=>e.type)'),['CUSTOM:bundle_root']);
 assert.equal(a.run('state.project.customs.child.importDependency'),true);assert.equal(a.run('state.project.customs.spare'),undefined);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.saved=after;a.run('deserialize(saved)');assert.equal(a.run('state.project.customs.child.importDependency'),true);
 assert.match(a.run('state.project.customs.child.supportSources[0].vhdl'),/package body logic_pkg/);
});
test('multiple selected modules share dependencies; Select all exposes each chosen module',()=>{
 for(const names of [['bundle_root','spare'],['bundle_root','child','spare']]){
  const a=setup();selectedPlan(a,names);a.run('applyVhdlModuleImport(plan)');
  assert.deepEqual(a.json('paletteEntries().filter(e=>e.type.startsWith("CUSTOM:")).map(e=>e.td.label)').sort(),names.sort());
  assert.equal(a.run('Object.keys(state.project.customs).length'),3);
 }
});
test('a dependency can later become a visible module without replacing its source or settings',()=>{
 const a=setup();selectedPlan(a,['bundle_root']);a.run('applyVhdlModuleImport(plan);const before=serialize();const old=state.project.customs.child;const p=planVhdlModuleImport(files,state.project,{selected:["0:child"]});applyVhdlModuleImport(p);');
 assert.equal(a.run('state.project.customs.child.importDependency'),undefined);assert.equal(a.run('state.project.customs.child.vhdl===old.vhdl'),true);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('export wrapper comments and formatting do not create conflicts, while literals remain significant',()=>{
 const original=moduleSource('existing'),a=loadApp();a.ctx.files=[{vhdl:original}];
 a.run('applyVhdlModuleImport(planVhdlModuleImport(files));const old=state.project.customs.existing;');
 a.ctx.files=[{vhdl:'-- exported entity\n'+original.toUpperCase().replace('Q<=D;','Q <= D;')}];
 assert.equal(a.run('planVhdlModuleImport(files).skipped.length'),1);a.run('applyVhdlModuleImport(planVhdlModuleImport(files))');
 assert.equal(a.run('state.project.customs.existing===old'),true);
 a.ctx.first=`q<='0';report "Hello";`;a.ctx.second=`q<='1';report "Hello";`;
 assert.equal(a.run('sameVhdlSource(first,second)'),false);a.ctx.second=`q<='0';report "HELLO";`;
 assert.equal(a.run('sameVhdlSource(first,second)'),false);
 const b=setup();selectedPlan(b,['bundle_root']);b.run('applyVhdlModuleImport(plan);');
 b.ctx.more=[{fileName:'another.vhd',vhdl:moduleSource('another','q<=flip(d);','use work.logic_pkg.all;')},{fileName:'pkg-copy.vhd',vhdl:'-- copy\n'+pkg.toUpperCase()}];
 b.run('applyVhdlModuleImport(planVhdlModuleImport(more));');assert.equal(b.run('validateVhdlModules(state.project).size'),1);
});
test('the Inspector can edit a hidden dependency and return to its root without adding tiles',()=>{
 const a=setup();a.ctx.document.querySelector('#vmReplacement').focus=()=>{};
 selectedPlan(a,['bundle_root']);a.run('applyVhdlModuleImport(plan);addComp("CUSTOM:bundle_root",0,0);showVhdlModuleReplacement("bundle_root");');
 const pane=a.els.get('#inspectorPane'),fields=new Map();
 pane.querySelector=s=>{if(!fields.has(s))fields.set(s,{value:'',textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},scrollTop:0,scrollLeft:0});return fields.get(s);};
 a.run('renderInspectorContents()');assert.match(pane.innerHTML,/Source module/);
 fields.get('#vmSourceModule').onchange({target:{value:'child'}});a.run('renderInspectorContents()');
 assert.match(pane.innerHTML,/Source · child/);assert.equal(a.run('state.vhdlSourceEdit.root'),'bundle_root');
 a.ctx.changed=a.run('state.project.customs.child.vhdl').replace('q<=flip(d);','q<=d;');
 const input=fields.get('#vmReplacement');input.value=a.ctx.changed;input.oninput();fields.get('#vmReplaceApply').onclick();
 assert.equal(a.run('state.project.customs.child.vhdl'),a.ctx.changed);assert.equal(a.run('state.project.customs.child.importDependency'),true);
 fields.get('#vmSourceModule').onchange({target:{value:'bundle_root'}});a.run('renderInspectorContents()');assert.match(pane.innerHTML,/Source · bundle_root/);
 assert.equal(a.run('paletteEntries().filter(e=>e.type.startsWith("CUSTOM:")).length'),1);
});
test('dependencies resolve across files and separately stored entity/architecture/package body units',()=>{
 const entity='library ieee;use ieee.std_logic_1164.all;entity child is port(d:in std_logic;q:out std_logic);end;';
 const arch='library ieee;use ieee.std_logic_1164.all;use work.logic_pkg.all;architecture rtl of child is begin q<=flip(d);end;';
 const boundary=pkg.indexOf('library ieee;',1),a=setup([{fileName:'root.vhd',vhdl:root},{fileName:'entity.vhd',vhdl:entity},{fileName:'arch.vhd',vhdl:arch},{fileName:'pkg.vhd',vhdl:pkg.slice(0,boundary)},{fileName:'body.vhd',vhdl:pkg.slice(boundary)}]);
 selectedPlan(a,['bundle_root']);a.run('applyVhdlModuleImport(plan);addComp("CUSTOM:bundle_root",0,0);const all=generateAllVhdl();');
 assert.deepEqual(a.json('Object.keys(all)'),['top','package:logic_pkg','child','bundle_root']);assert.match(a.run('all["package:logic_pkg"]'),/package body/);
});
test('unselected unsupported interfaces do not block a usable module',()=>{
 const bad=moduleSource('unsupported').replace('d:in std_logic','d:in integer'),a=setup([{...bundle,vhdl:bundle.vhdl+'\n'+bad}]);
 assert.match(a.run('catalog.modules.find(m=>m.name==="unsupported").error'),/พอร์ต/);
 selectedPlan(a,['bundle_root']);assert.equal(a.run('plan.modules.length'),2);
});
test('missing dependencies, selected source conflicts, cycles and stale plans never partially import',()=>{
 const a=setup(),before=a.run('serialize()');
 a.ctx.missing=[{vhdl:moduleSource('missing_root','u:entity work.absent port map(d,q);')}];
 assert.throws(()=>a.run('planVhdlModuleImport(missing)'),/ขาดไฟล์ entity: absent/);
 a.ctx.conflict=[bundle,{fileName:'other.vhd',vhdl:moduleSource('bundle_root','q<=not d;')}];
 assert.throws(()=>a.run('planVhdlModuleImport(conflict,state.project,{selected:["0:bundle_root","1:bundle_root"]})'),/ชื่อ.*ซ้ำ/);
 a.ctx.cycle=[{vhdl:moduleSource('recursive','u:entity work.recursive port map(d,q);')}];
 assert.throws(()=>a.run('planVhdlModuleImport(cycle)'),/วนซ้ำ/);assert.equal(a.run('serialize()'),before);
 selectedPlan(a,['bundle_root']);a.run('state.project={...state.project}');assert.throws(()=>a.run('applyVhdlModuleImport(plan)'),/โปรเจกต์/);
});
test('choice state supports root defaults, no selection, added dependencies, and cancellation without history',()=>{
 const a=setup(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 a.run('state.moduleImport={project:state.project,files,reading:false};finishVhdlModuleImport(state.moduleImport);');
 assert.equal(a.run('state.moduleImport.choose'),true);assert.deepEqual(a.json('[...state.moduleImport.selected]'),['0:bundle_root','0:spare']);
 a.run('state.moduleImport.mode="single";state.moduleImport.root="0:bundle_root";finishVhdlModuleImport(state.moduleImport,true);');
 assert.deepEqual(a.json('explorerItems().filter(e=>e.kind==="custom").map(e=>e.name)'),['bundle_root']);assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo();state.moduleImport={project:state.project,files,selected:new Set(),reading:false};finishVhdlModuleImport(state.moduleImport,true);');
 assert.match(a.run('state.moduleImport.error'),/เลือกโมดูล/);assert.equal(a.run('serialize()'),before);
 a.run('cancelVhdlModuleImport()');assert.equal(a.run('serialize()'),before);
});
function stamped(){
 const a=loadApp();a.ctx.raw=moduleSource('custom_leaf');
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([{vhdl:raw}]));
 const sub=blankSchematic(uid('sch'),'sub_sheet');sub.components=[{id:'i',type:'IN',x:44,y:88,params:{name:'d',width:1}},{id:'o',type:'OUT',x:300,y:88,params:{name:'q',width:1}}];
 sub.wires=[{id:'w',from:{cid:'i',pid:'o'},to:{cid:'o',pid:'i'}}];state.project.schematics[sub.id]=sub;
 activeSch().name='restored_main';addComp('SCH:'+sub.id,120,180);addComp('CUSTOM:custom_leaf',420,180);`);
 return {fileName:'old-all.vhd',vhdl:moduleSource('restored_main')+a.run('layoutStamp()')};
}
test('stamped restore retains hierarchy, wires, positions and custom source in one undoable operation',()=>{
 const file=stamped(),a=setup([file]),before=a.run('serialize()'),idx=a.run('state.history.idx');
 a.run('applyVhdlSchematicImport(planVhdlSchematicImport(files))');assert.equal(a.run('state.history.idx'),idx+1);
 assert.equal(a.run('activeSch().name'),'restored_main');assert.equal(a.run('Object.keys(state.project.schematics).length'),3);
 assert.match(a.run('state.project.customs.custom_leaf.vhdl'),/entity custom_leaf/);
 assert.deepEqual(a.json('Object.values(state.project.schematics).find(s=>s.name==="sub_sheet").components.map(c=>[c.x,c.y])'),[[44,88],[300,88]]);
 assert.equal(a.run('Object.values(state.project.schematics).find(s=>s.name==="sub_sheet").wires.length'),1);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.saved=after;a.run('deserialize(saved)');assert.equal(a.run('activeSch().name'),'restored_main');
});
test('stamped batch validates all inputs and conflicts before changing the current project',()=>{
 const file=stamped(),a=setup([file,{vhdl:moduleSource('plain')}]),before=a.run('serialize()');
 assert.throws(()=>a.run('planVhdlSchematicImport(files)'),/ไม่มีข้อมูล schematic/);assert.equal(a.run('serialize()'),before);
 a.ctx.files=[file,file];assert.throws(()=>a.run('planVhdlSchematicImport(files)'),/ชื่อซ้ำ/);assert.equal(a.run('serialize()'),before);
});
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
test('GHDL exported selected-root bundle includes each required design unit once and preserves behavior',{skip:!hasGhdl},()=>{
 const a=setup();selectedPlan(a,['bundle_root']);a.run('applyVhdlModuleImport(plan);addComp("CUSTOM:bundle_root",0,0);');
 const all=a.json('generateAllVhdl()');assert.deepEqual(Object.keys(all),['top','package:logic_pkg','child','bundle_root']);
 const source=Object.values(all).map(v=>typeof v==='string'?v:v.code).join('\n');
 assert.equal((source.match(/entity child is/g)||[]).length,1);assert.doesNotMatch(source,/entity spare is/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vhdl-bundle-'));
 try{
  fs.writeFileSync(path.join(dir,'bundle.vhd'),source+`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;
architecture sim of tb is signal d,q:std_logic:='0';begin u:entity work.bundle_root port map(d,q);
process begin wait for 1 ns;assert q='1' severity failure;d<='1';wait for 1 ns;assert q='0' severity failure;wait;end process;end;`);
  for(const args of [['-a','--std=08','bundle.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=3ns']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
