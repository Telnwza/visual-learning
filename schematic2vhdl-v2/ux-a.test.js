const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');

const pass='format schematic-text 1\ncircuit export_top\ninput data[8]\noutput result[8]\nconnect data -> result';
function setup(text=pass){
 const a=loadApp();a.ctx.text=text;
 a.run('importSchematicText(text);state.project.topId=state.activeId;snapshot();const sch=activeSch();');
 const blobs=[],anchors=[],create=a.ctx.document.createElement;
 a.ctx.document.createElement=tag=>tag==='a'?{click(){anchors.push({name:this.download,url:this.href});}}:create(tag);
 a.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:test-'+blobs.length;},revokeObjectURL(){}};
 a.els.get('#vhdlEntitySel').options=[];
 a.ctx.console={...console,error(){}};
 return {...a,blobs,anchors};
}
function wiring(){
 const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params={}){return comp(addComp(type,sch.components.length*200,0,params));}
 function join(a,p,b,q){onPortClick(a,getPort(a,p));return onPortClick(b,getPort(b,q));}
 const good=c('IN',{name:'data',width:8}),bad=c('IN',{name:'clk',width:1}),out=c('OUT',{name:'result',width:8});
 join(good,'o',out,'i');`);return a;
}

test('download timestamps use readable local date/time separators and keep same-second names unique',()=>{
 const a=setup();a.run('const OriginalDate=Date;Date=class extends OriginalDate{constructor(){super(2026,0,2,3,4,5);}};');
 assert.equal(a.run(`dlName('lcdlab8all','.vhd','topall')`),'2026-01-02_03-04-05_lcdlab8all.vhd');
 assert.equal(a.run(`dlName('lcdlab8all','.vhd','topall')`),'2026-01-02_03-04-05_lcdlab8all2.vhd');
 assert.equal(a.run(`dlName('my_project','.schproj.json','project')`),'2026-01-02_03-04-05_myproject.schproj.json');
 assert.equal(a.run(`dlName('counter','.sccomp.json','component')`),'2026-01-02_03-04-05_counter.sccomp.json');
});
test('all download routes regenerate current top instead of the displayed preview',async()=>{
 for(const route of ['exportVhdlFile()','exportAllVhdl()']){
  const a=setup();assert.ok(a.run('generateVHDL()'));
  a.run("sch.name='ux_latest_top';snapshot();");
  assert.equal(a.els.get('#vhdlFreshness').hidden,false);
  assert.match(a.els.get('#vhdlOutput').dataset.raw,/entity export_top is/i);
  assert.equal(a.run(route),true);
  const bytes=await a.blobs[0].text();assert.match(bytes,/entity ux_latest_top is/i);assert.doesNotMatch(bytes,/entity export_top is/i);
  assert.match(a.anchors[0].name,/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_uxlatesttopall\.vhd$/);
  assert.match(bytes,/SCHSTUDIO|layout/i);assert.equal(a.els.get('#vhdlFreshness').hidden,true);
 }
});
test('bundle filename follows the selected top while a different schematic is open',()=>{
 const a=setup();a.run(`state.project.name='project_name';const chosen=Object.values(state.project.schematics).find(s=>s!==sch);
 chosen.name='chosen_top';state.project.topId=chosen.id;`);
 assert.equal(a.run('exportAllVhdl()'),true);
 assert.match(a.anchors[0].name,/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_chosentopall\.vhd$/);
 assert.equal(a.run('activeSch().name'),'export_top');
 a.run(`sch.name='second_top';state.project.topId=sch.id;`);
 assert.equal(a.run('exportVhdlFile()'),true);
 assert.match(a.anchors[1].name,/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_secondtopall\.vhd$/);
});
test('export follows source, generics, wires, top selection and Undo/Redo',async()=>{
 const a=setup();a.ctx.box={fileName:'box.vhd',vhdl:`library ieee;use ieee.std_logic_1164.all;
 entity box is generic(WIDTH:positive:=8);port(a:in std_logic_vector(WIDTH-1 downto 0);y:out std_logic_vector(WIDTH-1 downto 0));end;
 architecture rtl of box is begin y<=a;end;`};
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([box]));const b=comp(addComp('CUSTOM:box',200,0));
 const d=sch.components.find(c=>c.type==='IN'),o=sch.components.find(c=>c.type==='OUT');sch.wires=[];
 onPortClick(d,getPort(d,'o'));onPortClick(b,getPort(b,'a'));onPortClick(b,getPort(b,'y'));onPortClick(o,getPort(o,'i'));`);
 assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/WIDTH => 8/);
 a.run(`applyComponentParamChange(sch,b,planComponentParamChange(sch,b,'generic_WIDTH',16));`);
 assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/WIDTH => 16/);
 a.run('undo()');assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/WIDTH => 8/);
 a.run('redo()');assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/WIDTH => 16/);
 a.run(`applyVhdlModuleReplacement(planVhdlModuleReplacement('box',state.project.customs.box.vhdl.replace('y<=a','y<=not a')));`);
 assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/y<=not a/);
 a.run(`activeSch().wires=activeSch().wires.filter(w=>w.to.cid!==${JSON.stringify(a.run('o.id'))});snapshot();`);
 assert.equal(a.run('exportVhdlFile()'),true);assert.match(await a.blobs.at(-1).text(),/result <= .*'0'/);
 a.run("state.project.topId=Object.keys(state.project.schematics).find(id=>id!==state.activeId);snapshot();");
 assert.equal(a.run('exportVhdlFile()'),true);assert.doesNotMatch(await a.blobs.at(-1).text(),/entity box is/i);
});
test('generation failure never downloads the previous successful code',()=>{
 const a=setup();assert.equal(a.run('exportVhdlFile()'),true);
 a.run("state.project.customs.broken={name:'broken',moduleKind:'vhdl',vhdl:'invalid',ports:[]};addComp('CUSTOM:broken',100,100);");
 assert.equal(a.run('exportVhdlFile()'),false);assert.equal(a.blobs.length,1);assert.equal(a.anchors.length,1);
 assert.equal(a.els.get('#vhdlFreshness').hidden,false);
});
test('explicit single entity export is fresh and a removed entity cannot reuse old output',async()=>{
 const a=setup();assert.equal(a.run("exportVhdlFile('export_top')"),true);
 assert.match(a.anchors[0].name,/exporttop.*\.vhd$/);
 a.run("sch.name='renamed';snapshot();");
 assert.equal(a.run("exportVhdlFile('export_top')"),false);assert.equal(a.blobs.length,1);
 assert.equal(a.run("exportVhdlFile('renamed')"),true);assert.match(await a.blobs[1].text(),/entity renamed is/i);
});
test('Check Top excludes unused broken sheets/modules; Check Project includes them',()=>{
 const a=setup();a.run(`const unused=Object.values(state.project.schematics).find(s=>s!==sch);
 unused.components.push({id:'badff',type:'DFF',x:0,y:0,params:{}});
 state.project.customs.bad={name:'bad',moduleKind:'vhdl',vhdl:'broken',ports:[]};`);
 assert.deepEqual(a.json("runSynthesis().filter(i=>i.lvl==='err')"),[]);
 const all=a.json('runSynthesis({wholeProject:true})');assert.ok(all.some(i=>/clk/.test(i.msg)));assert.ok(all.some(i=>i.lvl==='err'));
 assert.ok(a.run('generateVHDL()'));assert.deepEqual(a.json('Object.keys(_lastAllVhdl)'),['export_top']);
});
test('Check and generation still include used children, missing references and hierarchy cycles',()=>{
 const a=setup();a.run(`const child=Object.values(state.project.schematics).find(s=>s!==sch);
 child.components.push({id:'badff',type:'DFF',x:0,y:0,params:{}});
 sch.components.push({id:'u',type:'SCH:'+child.id,x:200,y:100,params:{}});`);
 assert.ok(a.json('runSynthesis()').some(i=>/clk/.test(i.msg)));
 a.run("sch.components.push({id:'missing',type:'SCH:missing',x:0,y:0,params:{}});");
 assert.ok(a.json('runSynthesis()').some(i=>/ไม่พบ schematic/.test(i.msg)));
 a.run("sch.components.pop();child.components.push({id:'back',type:'SCH:'+sch.id,x:0,y:0,params:{}});");
 assert.ok(a.json('runSynthesis()').some(i=>/วน/.test(i.msg)));
});
test('Check uses concise error/warning counts and snapshot invalidates prior results',()=>{
 const a=setup();a.run('runSynthesis()');const html=a.els.get('#errorsPane').innerHTML;
 assert.match(html,/Check: 0 errors · 0 warnings/);assert.doesNotMatch(html,/พร้อมสำหรับ Vivado|Synthesis check ผ่าน/);
 a.run("sch.name='changed';snapshot();");assert.match(a.els.get('#checkStatus').textContent,/เปลี่ยนแล้ว/);
});

for(const reverse of [false,true])test('mismatched replacement is atomic, reverse='+reverse,()=>{
 const a=wiring(),before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN');
 a.run(reverse?"join(out,'i',bad,'o')":"join(bad,'o',out,'i')");
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);assert.equal(a.run('_uidN'),uid);
 assert.match(a.run('state.wireError.message'),/1 → 8/);assert.ok(a.run('state.pendingWire'));
 assert.equal(a.run("netDriverPort(sch,sch.wires.find(w=>w.to.cid===out.id)).cid"),a.run('good.id'));
});
test('valid replacement and fan-out preserve one driver and one Undo per connection',()=>{
 const a=wiring();a.run("const other=c('IN',{name:'other',width:8});const before=serialize();join(other,'o',out,'i');");
 assert.equal(a.run('sch.wires.length'),1);assert.equal(a.run('netDriverPort(sch,sch.wires[0]).cid'),a.run('other.id'));
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('branching from a wire or junction cannot replace an incompatible existing input',()=>{
 for(const kind of ['wire','junction']){
  const a=wiring();a.run(`const narrow=c('OUT',{name:'narrow',width:1});join(bad,'o',narrow,'i');
  const j=c('JUNCTION');sch.wires.push({id:uid('w'),from:{cid:good.id,pid:'o'},to:{cid:j.id,pid:'j'}});snapshot();
  const before=serialize(),idx=state.history.idx;`);
  a.run(kind==='wire'?"state.pendingWire={onWire:sch.wires.find(w=>w.to.cid===out.id).id,anchor:{x:100,y:0}};onPortClick(narrow,getPort(narrow,'i'));":"join(j,'j',narrow,'i')");
  assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 }
});
test('connecting a source to a junction checks all consuming widths and existing drivers',()=>{
 const a=wiring();a.run(`const j=c('JUNCTION');sch.wires=sch.wires.filter(w=>w.to.cid!==out.id);
 sch.wires.push({id:uid('w'),from:{cid:j.id,pid:'j'},to:{cid:out.id,pid:'i'}});snapshot();const before=serialize();join(bad,'o',j,'j');`);
 assert.equal(a.run('serialize()'),a.run('before'));
 a.run("join(good,'o',j,'j');const connected=serialize();join(bad,'o',j,'j');");assert.equal(a.run('serialize()'),a.run('connected'));
});
test('undriven input ties reject incompatible widths before minting a junction',()=>{
 const a=wiring();a.run(`const narrow=c('OUT',{name:'small',width:4});sch.wires=[];snapshot();const before=serialize(),idBefore=_uidN;join(out,'i',narrow,'i');`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('_uidN'),a.run('idBefore'));
});
test('scalar gate masking and Bus Tap width inference remain legal',()=>{
 const a=wiring();a.run(`const gate=c('AND',{inputs:2,width:8});join(bad,'o',gate,'i0');
 const tap=c('BUSTAP',{bit:2,nbit:4,mode:'split',dir:'right'}),slice=c('OUT',{name:'slice',width:4});
 join(good,'o',tap,'d');join(tap,'y',slice,'i');`);
 assert.equal(a.run('sch.wires.some(w=>w.to.cid===gate.id)'),true);
 assert.equal(a.run('sch.wires.some(w=>w.to.cid===tap.id)'),true);
 assert.equal(a.run('sch.wires.some(w=>w.to.cid===slice.id)'),true);assert.equal(a.run('state.wireError'),null);
});
test('replacing a split tap input detaches only that tap from its previous bus',()=>{
 const a=wiring();a.run(`const tap=c('BUSTAP',{bit:2,nbit:4,mode:'split',dir:'right'}),slice=c('OUT',{name:'slice',width:4});
 join(good,'o',tap,'d');join(tap,'y',slice,'i');const other=c('IN',{name:'other',width:8});
 const before=serialize();join(other,'o',tap,'d');`);
 assert.equal(a.run('state.wireError'),null);
 assert.equal(a.run('netDriverPort(sch,busTapIncomingWire(tap)).cid'),a.run('other.id'));
 assert.equal(a.run("netDriverPort(sch,sch.wires.find(w=>w.to.cid===out.id)).cid"),a.run('good.id'));
 assert.equal(a.run("sch.wires.some(w=>w.from.cid===tap.id&&w.to.cid===slice.id)"),true);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('invalid free Bus Tap flips leave its mode and all data unchanged',()=>{
 const a=wiring();a.run(`const tap=c('BUSTAP',{bit:0,nbit:4,mode:'split',dir:'right'});const before=serialize();join(bad,'o',tap,'y');`);
 assert.equal(a.run('tap.params.mode'),'split');assert.equal(a.run('serialize()'),a.run('before'));
 a.run("const bus4=c('IN',{name:'bus4',width:4});join(bus4,'o',tap,'y');");assert.equal(a.run('tap.params.mode'),'merge');
});
test('a split tap on an already driven bus cannot flip into a conflicting merge writer',()=>{
 const a=wiring();a.run(`const tap=c('BUSTAP',{bit:0,nbit:1,mode:'split',dir:'right'});join(good,'o',tap,'d');
 const before=serialize();join(bad,'o',tap,'y');`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('tap.params.mode'),'split');
});

function childDeletion(){
 const a=setup();a.run(`const child=sch;const parents=[];
 for(let n=0;n<2;n++){
  const parent=blankSchematic(uid('sch'),'parent'+n);state.project.schematics[parent.id]=parent;parents.push(parent);
  for(let i=0;i<2;i++){
   const u={id:uid('c'),type:'SCH:'+child.id,x:0,y:i*100,params:{}},o={id:uid('c'),type:'OUT',x:400,y:i*100,params:{name:'out'+i,width:8}};
   parent.components.push(u,o);parent.wires.push({id:uid('w'),from:{cid:u.id,pid:'result'},to:{cid:o.id,pid:'i'}});
  }
 }
 const pin=child.components.find(c=>c.type==='OUT');state.selection=new Set([pin.id]);snapshot();`);return a;
}
test('deleting a used child port is pending; Cancel changes no project data or history',()=>{
 const a=childDeletion(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 assert.equal(a.run('deleteSelection()'),false);assert.equal(a.run('state.pendingDelete.parents.length'),4);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 a.run('cancelSelectionDeletion()');assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.pendingDelete'),null);
});
test('Apply removes child ports across all instances, with complete single-step Undo/Redo',()=>{
 const a=childDeletion(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 a.run('deleteSelection();applySelectionDeletion(state.pendingDelete);');
 assert.equal(a.run('state.history.idx'),idx+1);assert.deepEqual(a.json('parents.map(p=>p.wires.length)'),[0,0]);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);
 a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('a stale deletion plan cannot act on changed values, a different sheet or selection',()=>{
 for(const edit of ["pin.params.width=16","state.activeId=parents[0].id","state.selection.clear()"]){
  const a=childDeletion();a.run('const plan=planSelectionDeletion(child,state.selection);'+edit+';const before=serialize();');
  assert.throws(()=>a.run('applySelectionDeletion(plan)'),/เปลี่ยนแล้ว/);assert.equal(a.run('serialize()'),a.run('before'));
 }
});
test('ordinary part deletion remains immediate and Undo restores it',()=>{
 const a=wiring();a.run('state.selection=new Set([bad.id]);const before=serialize();');
 assert.equal(a.run('deleteSelection()'),true);assert.equal(a.run('state.pendingDelete'),null);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('deleting a duplicate-name child port never remaps its wire onto the surviving port',()=>{
 const a=childDeletion();a.run(`pin.params.name='data';parents.forEach(p=>p.wires.forEach(w=>w.from.pid='data_1'));
 const input=child.components.find(c=>c.type==='IN');state.selection=new Set([input.id]);snapshot();
 deleteSelection();const plan=state.pendingDelete;`);
 assert.equal(a.run('plan.parents.length'),4);assert.equal(a.run('plan.parents.every(x=>!x.removed)'),true);
 a.run('applySelectionDeletion(plan)');assert.equal(a.run("parents.every(p=>p.wires.every(w=>w.from.pid==='data'))"),true);
});
