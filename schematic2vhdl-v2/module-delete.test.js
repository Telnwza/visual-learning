const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
const source=(name='box',body='q<=d;')=>`library ieee;use ieee.std_logic_1164.all;
entity ${name} is port(d:in std_logic;q:out std_logic);end;
architecture rtl of ${name} is begin ${body} end;`;
function setup(files=[{vhdl:source()}]){
 const a=loadApp();a.ctx.files=files;a.run('applyVhdlModuleImport(planVhdlModuleImport(files))');return a;
}
function connected(){
 const a=setup();a.run(`const input=addComp('IN',0,0),box=addComp('CUSTOM:box',200,0),output=addComp('OUT',400,0);
 activeSch().wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:box,pid:'d'}},{id:uid('w'),from:{cid:box,pid:'q'},to:{cid:output,pid:'i'}});snapshot();`);return a;
}
test('an unused imported module deletes immediately with one Undo/Redo and no circuit edits',()=>{
 const a=setup(),before=a.run('serialize()'),idx=a.run('state.history.idx'),sheet=a.json('activeSch()');
 a.ctx.confirm=()=>{throw new Error('unused modules need no confirmation');};
 assert.equal(a.run('deleteCustomComponent("box")'),true);assert.equal(a.run('state.project.customs.box'),undefined);
 assert.deepEqual(a.json('activeSch()'),sheet);assert.equal(a.run('state.history.idx'),idx+1);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('placed modules show exact box/wire counts; Cancel preserves everything and confirm removes only their instances',()=>{
 const a=connected(),before=a.run('serialize()'),idx=a.run('state.history.idx');let prompt='';
 a.ctx.confirm=message=>{prompt=message;return false;};
 assert.equal(a.run('deleteCustomComponent("box")'),false);assert.match(prompt,/1 ตัว.*2 เส้น/);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 a.ctx.confirm=()=>true;assert.equal(a.run('deleteCustomComponent("box")'),true);
 assert.deepEqual(a.json('activeSch().components.map(c=>c.type)'),['IN','OUT']);assert.equal(a.run('activeSch().wires.length'),0);
 assert.deepEqual(a.json('[...state.selection]'),a.json('[output]'));assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('instances and wires inside stored schematic customs are included in the same undoable deletion',()=>{
 const a=connected();a.run(`state.project.customs.wrapper={name:'wrapper',schematic:cloneData(activeSch())};snapshot();`);
 const before=a.run('serialize()');let prompt='';a.ctx.confirm=message=>{prompt=message;return true;};
 assert.equal(a.run('deleteCustomComponent("box")'),true);assert.match(prompt,/2 ตัว.*4 เส้น/);
 assert.deepEqual(a.json('state.project.customs.wrapper.schematic.components.map(c=>c.type)'),['IN','OUT']);
 assert.equal(a.run('state.project.customs.wrapper.schematic.wires.length'),0);a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('VHDL dependencies block deletion and identify their consumers without changing history',()=>{
 const a=setup([{vhdl:source('child')},{vhdl:source('parent','u:entity work.CHILD port map(d,q);')}]);
 const before=a.run('serialize()'),idx=a.run('state.history.idx');let message='';a.ctx.toast=text=>{message=text;};
 a.ctx.confirm=()=>{throw new Error('blocked modules need no confirmation');};
 assert.equal(a.run('deleteCustomComponent("child")'),false);assert.match(message,/parent/);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 assert.equal(a.run('deleteCustomComponent("parent")'),true);assert.ok(a.run('state.project.customs.child'));
 assert.equal(a.run('deleteCustomComponent("child")'),true);
});
test('deleting a bundle root preserves hidden dependencies needed by another module',()=>{
 const a=setup([{vhdl:source('child')},{vhdl:source('first','u:entity work.child port map(d,q);')},{vhdl:source('second','u:entity work.child port map(d,q);')}]);
 a.run('state.project.customs.child.importDependency=true');const child=a.json('state.project.customs.child');
 assert.equal(a.run('deleteCustomComponent("first")'),true);assert.deepEqual(a.json('state.project.customs.child'),child);
 assert.equal(a.run('deleteCustomComponent("child")'),false);assert.ok(a.run('state.project.customs.second'));
});
test('deleting an armed module cancels its placement and source editor without touching unrelated definitions',()=>{
 const a=setup([{vhdl:source()},{vhdl:source('other')}]);a.run(`requestPalettePlacement('CUSTOM:box');state.vhdlSourceEdit={project:state.project,name:'box',root:'box'};`);
 assert.equal(a.run('deleteCustomComponent("box")'),true);assert.equal(a.run('state.componentPlacement'),null);assert.equal(a.run('state.vhdlSourceEdit'),null);
 assert.ok(a.run('state.project.customs.other'));assert.equal(a.run('activeSch().components.length'),0);
});
test('missing modules and Placement Mode leave definitions and history unchanged',()=>{
 const a=setup(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 assert.equal(a.run('deleteCustomComponent("missing")'),false);a.run('enterPlacementMode()');
 assert.equal(a.run('deleteCustomComponent("box")'),false);assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
});
test('the delete button uses the shared deletion action and stops the placement click',()=>{
 const a=setup(),events={},button={dataset:{delCustom:'box'},addEventListener:(type,fn)=>events[type]=fn};
 a.ctx.root={querySelectorAll:selector=>{assert.equal(selector,'[data-del-custom]');return [button];}};
 a.run('bindCustomDeletion(root)');let stopped=false;events.click({stopPropagation(){stopped=true;}});
 assert.equal(stopped,true);assert.equal(a.run('state.project.customs.box'),undefined);assert.equal(a.run('state.componentPlacement'),null);
});
test('pointer and keyboard actions on delete never arm palette placement or prevent the button default',()=>{
 const a=setup(),events={},tile={dataset:{pal:'CUSTOM:box'},addEventListener:(type,fn)=>events[type]=fn,setPointerCapture(){throw new Error('delete must not capture pointer');}};
 a.els.get('#canvas').focus=()=>{};a.ctx.root={querySelectorAll:()=>[tile]};a.run('bindPalettePlacement(root)');
 const button={closest:selector=>selector==='button'?button:null};
 for(const [type,extra] of [['pointerdown',{button:0}],['click',{}],['keydown',{key:'Enter'}],['keydown',{key:' '}]]){
  events[type]({target:button,...extra,preventDefault(){throw new Error('delete must retain native button behavior');}});
  assert.equal(a.run('state.componentPlacement'),null);
 }
 events.click({target:{closest:()=>null}});assert.ok(a.run('state.componentPlacement'));
});
