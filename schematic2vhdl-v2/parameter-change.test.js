const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
function setup(text){const a=loadApp();a.ctx.text=text;a.run('importSchematicText(text);const sch=activeSch();');return a;}
const mux=`format schematic-text 1
circuit change_demo
input a,b,c,d,s0,s1
output y
part m MUX inputs=4 width=1
connect a -> m.d0
connect b -> m.d1
connect c -> m.d2
connect d -> m.d3
connect s0 -> m.s0
connect s1 -> m.s1
connect m.y -> y`;
test('MUX shrink previews exact losses without mutation; apply/undo/redo is atomic',()=>{
 const a=setup(mux),before=a.json('sch');
 a.run('const m=sch.components.find(c=>c.type==="MUX");const change=planComponentParamChange(sch,m,"inputs",2);');
 assert.deepEqual(a.json('sch'),before);
 assert.deepEqual(a.json('change.removedPorts.map(p=>p.id)'),['d2','d3','s1']);
 assert.equal(a.run('change.removedWires.length'),3);
 const keep=a.json('sch.wires.filter(w=>!change.removedWires.includes(w))');
 a.run('applyComponentParamChange(sch,m,change)');assert.deepEqual(a.json('sch.wires'),keep);
 assert.equal(a.run('m.params.inputs'),2);
 a.run('undo()');assert.deepEqual(a.json('activeSch()'),before);
 a.run('redo()');assert.equal(a.run('activeSch().wires.length'),4);
});
test('disabling connected FF controls previews their wires and preserves data/clock',()=>{
 for(const key of ['enable','reset','preset']){
  const a=setup(`format schematic-text 1
 circuit ff_controls
 input clk,d,rst,pre,en
 output q
 part f DFF enable=true reset=true preset=true
 connect clk -> f.clk
 connect d -> f.d
 connect rst -> f.rst
 connect pre -> f.pre
 connect en -> f.en
 connect f.q -> q`);
  a.ctx.key=key;a.run('const f=sch.components.find(c=>c.type==="DFF");const change=planComponentParamChange(sch,f,key,false);');
  assert.equal(a.run('change.removedWires.length'),1);
  assert.equal(a.run('sch.wires.length'),6);
  a.run('applyComponentParamChange(sch,f,change)');assert.equal(a.run('sch.wires.length'),5);
  assert.ok(a.run('sch.wires.some(w=>w.to.pid==="clk")&&sch.wires.some(w=>w.to.pid==="d")'));
 }
});
test('2:1 MUX select pin/bus remap keeps its connection',()=>{
 const a=setup(mux.replace('inputs=4','inputs=2').replace('connect c -> m.d2\n','').replace('connect d -> m.d3\n','').replace('connect s1 -> m.s1\n',''));
 a.run('const m=sch.components.find(c=>c.type==="MUX");const change=planComponentParamChange(sch,m,"selectMode","bus");');
 assert.equal(a.run('change.removedPorts.length'),0);assert.equal(a.run('change.removedWires.length'),0);
 a.run('applyComponentParamChange(sch,m,change)');assert.ok(a.run('sch.wires.some(w=>w.to.cid===m.id&&w.to.pid==="s")'));
 a.run('applyComponentParamChange(sch,m,planComponentParamChange(sch,m,"selectMode","pins"))');
 assert.ok(a.run('sch.wires.some(w=>w.to.cid===m.id&&w.to.pid==="s0")'));
});
test('width changes retain wires and CONST truncation is previewed before mutation',()=>{
 const a=setup(`format schematic-text 1
 circuit wide_value
 output y[8]
 part k CONST width=8 value="FF"
 connect k.o -> y`);
 const before=a.json('sch');a.run('const k=sch.components.find(c=>c.type==="CONST");const change=planComponentParamChange(sch,k,"width",4);');
 assert.deepEqual(a.json('sch'),before);assert.equal(a.run('change.truncated'),true);
 assert.equal(a.run('change.changedWires.length'),1);assert.equal(a.run('change.removedWires.length'),0);
 a.run('applyComponentParamChange(sch,k,change)');assert.equal(a.run('k.params.value'),'F');assert.equal(a.run('sch.wires.length'),1);
 a.run('undo()');assert.deepEqual(a.json('activeSch()'),before);
});
test('subcircuit width preview includes every parent instance without changing wires; Undo restores all widths',()=>{
 const a=setup(`format schematic-text 1
 circuit child
 input data[32]
 output result[32]
 connect data -> result`);
 a.run(`const child=sch,parent=blankSchematic(uid('sch'),'parent');state.project.schematics[parent.id]=parent;
 const pin=child.components.find(c=>c.type==='IN');
 for(let i=0;i<2;i++){
 const x={id:uid('c'),type:'IN',x:0,y:100*i,params:{name:'src'+i,width:32}},b={id:uid('c'),type:'SCH:'+child.id,x:200,y:100*i,params:{}};
 parent.components.push(x,b);parent.wires.push({id:uid('w'),from:{cid:x.id,pid:'o'},to:{cid:b.id,pid:'data'},name:''});}
 snapshot();const change=planComponentParamChange(child,pin,'width',64);`);
 const before=a.run('serialize()');assert.equal(a.run('change.parentChanges.length'),2);
 assert.deepEqual(a.json('change.parentChanges.map(x=>[x.sch.name,x.pid,x.before,x.after])'),[['parent','data',32,64],['parent','data',32,64]]);
 assert.equal(a.run('serialize()'),before);
 const wires=a.json('parent.wires');a.run('applyComponentParamChange(child,pin,change)');assert.deepEqual(a.json('parent.wires'),wires);
 assert.equal(a.run('getPort(parent.components.find(c=>c.type.startsWith("SCH:")),"data").width'),64);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
 a.run('redo()');assert.equal(a.run('state.project.schematics[sch.id].components.find(c=>c.type==="IN").params.width'),64);
});
test('reducing a 64-bit CONST previews exact truncation of bit 63',()=>{
 const a=setup(`format schematic-text 1
 circuit high_constant
 output y[64]
 part k CONST width=64 value=8000000000000001
 connect k.o -> y`);
 a.run('const k=sch.components.find(c=>c.type==="CONST");const change=planComponentParamChange(sch,k,"width",63);');
 assert.equal(a.run('change.truncated'),true);assert.equal(a.run('change.params.value'),'0000000000000001');
 assert.equal(a.run('k.params.value'),'8000000000000001');
});
