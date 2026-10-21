const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
function setup(){const a=loadApp();a.run(`const sch=activeSch();sch.components=[
{id:'i',type:'IN',x:88,y:110,params:{name:'input_data',width:8}},
{id:'o',type:'OUT',x:484,y:220,params:{name:'output_data',width:8}},
{id:'frame',type:'MODULE_FRAME',x:44,y:44,params:{widthCells:28,heightCells:16}}];
sch.wires=[{id:'wire',from:{cid:'i',pid:'o'},to:{cid:'o',pid:'i'},pts:[{x:220,y:132},{x:220,y:242}],name:''}];snapshot();`);return a;}
test('Module Frame remains documentation-only; bus stays electrically complete',()=>{
 const a=setup();assert.equal(a.run('getPorts(comp("frame")).length'),0);
 assert.equal(a.run('wireCompletionMap(sch).size'),0);assert.equal(a.run('wireWidth(sch.wires[0],sch)'),8);
 const before=a.run('generateSchVhdl(sch).code');a.run('sch.components=sch.components.filter(c=>c.type!=="MODULE_FRAME")');
 assert.equal(a.run('generateSchVhdl(sch).code'),before);
});
test('Placement Cancel restores exact geometry and existing wire topology',()=>{
 const a=setup(),before=a.json('sch');a.run('enterPlacementMode();activeSch().components[0].x+=77;cancelPlacement()');
 assert.deepEqual(a.json('activeSch()'),before);
});
test('Placement Preview routes the bus, Accept has undo/redo, and does not alter VHDL',()=>{
 const a=setup(),code=a.run('generateSchVhdl(sch).code');
 a.run('snapshot();enterPlacementMode();activeSch().components[0].x+=44;previewPlacementWires()');
 const stat=a.json('state.placementMode.routeStats');assert.ok(stat.total>=1);assert.ok(stat.routed>=1);
 assert.equal(a.run('generateSchVhdl(activeSch()).code'),code);
 a.run('acceptPlacement()');assert.equal(a.run('activeSch().components[0].x'),132);
 a.run('undo()');assert.equal(a.run('activeSch().components[0].x'),88);
 a.run('redo()');assert.equal(a.run('activeSch().components[0].x'),132);
});
test('dangling wire is incomplete even if its geometry touches a valid output',()=>{
 const a=setup();a.run(`sch.components.push({id:'j',type:'JUNCTION',x:484,y:220,params:{endpoint:true}});sch.wires[0].to={cid:'j',pid:'j'};`);
 assert.ok(a.run('wireCompletionMap(sch).has("wire")'));
});
test('project switching is blocked while placement edits are uncommitted',()=>{
 const a=setup();const old=a.run('state.activeProjectId');a.run('const p=addProject("other",{activate:false});enterPlacementMode();switchProject(p.id)');
 assert.equal(a.run('state.activeProjectId'),old);assert.ok(a.run('state.placementMode'));
});
test('Fit bounds include manual wire points outside all component bodies',()=>{
 const a=setup();a.run('sch.wires[0].pts.push({x:900,y:800})');
 const b=a.json('sheetBounds(sch)');assert.ok(b.maxX>=900);assert.ok(b.maxY>=800);
});
