const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/import-v1.schproj.json')));
function setup(){const a=loadApp();a.ctx.source=structuredClone(fixture.project);return a;}
test('imports all dependencies with fresh IDs; preserves current top and exact wire geometry',()=>{
 const a=setup(), before=a.json('state.project');
 const r=a.json('importProjectData(source,{mode:"sub"})'), after=a.json('state.project');
 assert.equal(after.topId,before.topId); assert.equal(Object.keys(after.schematics).length,3);
 const instance=after.schematics[after.topId].components[0]; assert.equal(instance.type,'SCH:'+r.topId);
 const imported=Object.values(r.schematics); assert.ok(imported.every(s=>!['main','leaf'].includes(s.id)));
 assert.equal(r.schematics[r.topId].name,'top_2');
 const leaf=imported.find(s=>s.name==='invert_byte');
 assert.deepEqual(leaf.wires[1].pts,fixture.project.schematics.leaf.wires[1].pts);
 assert.deepEqual(leaf.wires[1].autoPts,fixture.project.schematics.leaf.wires[1].autoPts);
 assert.equal(leaf.wires[1].color,'#aa44ff');
 assert.ok(r.schematics[r.topId].components.some(c=>c.type==='SCH:'+leaf.id));
 assert.deepEqual(a.json('source'),fixture.project);
});
test('repeated imports never reuse IDs or same-name definitions',()=>{
 const a=setup(); a.run('importProjectData(source); importProjectData(source)');
 const sheets=a.json('Object.values(state.project.schematics)');
 const ids=sheets.flatMap(s=>[s.id,...s.components.map(c=>c.id),...s.wires.map(w=>w.id)]);
 assert.equal(ids.length,new Set(ids).size);
 assert.equal(sheets.length,5); assert.equal(new Set(sheets.map(s=>s.name)).size,5);
});
test('import and workspace copy can be undone and redone together',()=>{
 const a=setup(), before=a.json('JSON.parse(serialize())');
 a.run('importProjectData(source,{mode:"new"})');
 assert.equal(a.run('Object.keys(state.projects).length'),2);
 a.run('undo()'); assert.deepEqual(a.json('JSON.parse(serialize())'),before);
 a.run('redo()'); assert.equal(a.run('Object.keys(state.projects).length'),2);
});
test('v1 and v2 round trips keep all projects, active sheet, top and routes',()=>{
 const a=setup(); a.ctx.payload=fixture; a.run('deserialize(JSON.stringify(payload)); importProjectData(source,{mode:"new"})');
 const before=a.json('JSON.parse(serialize())');
 a.ctx.saved=before; a.run('deserialize(JSON.stringify(saved))');
 assert.deepEqual(a.json('JSON.parse(serialize())'),before);
 assert.equal(before.version,2); assert.ok(before.project);
});
test('invalid workspace is rejected before any project replaces the current workspace',()=>{
 const a=setup(), before=a.json('JSON.parse(serialize())');
 a.ctx.broken={version:2,workspace:{projects:{valid:fixture.project,bad:{schematics:{x:null}}},activeId:'valid'}};
 assert.throws(()=>a.run('deserialize(JSON.stringify(broken))'));
 assert.deepEqual(a.json('JSON.parse(serialize())'),before);
});
for(const [name,mutation] of [
 ['missing dependency',s=>delete s.schematics.leaf],
 ['missing wire endpoint',s=>s.schematics.main.wires[0].from.cid='missing'],
 ['missing port',s=>s.schematics.main.wires[0].from.pid='missing'],
 ['recursive hierarchy',s=>s.schematics.leaf.components[1].type='SCH:main'],
 ['unknown legacy gate',s=>s.schematics.leaf.components[1].type='SHIFT'],
 ['duplicate component ID',s=>s.schematics.main.components[1].id='c1']]){
 test('rejects '+name+' without partial changes',()=>{
   const a=setup(); mutation(a.ctx.source); const before=a.json('JSON.parse(serialize())');
   assert.throws(()=>a.run('importProjectData(source)'));
   assert.deepEqual(a.json('JSON.parse(serialize())'),before);
 });
}
test('renames conflicting schematic customs and remaps nested custom references',()=>{
 const a=setup(); a.run(`source.customs={inverter:{name:'inverter',schematic:source.schematics.leaf},wrapper:{name:'wrapper',schematic:structuredCustom()}};
 function structuredCustom(){return {id:'inner',name:'wrapper',components:[{id:'x',type:'CUSTOM:inverter',x:0,y:0,params:{}}],wires:[]};}
 state.project.customs.inverter={name:'inverter',schematic:{id:'other',components:[],wires:[]}};
 source.schematics.main.components.push({id:'cx',type:'CUSTOM:wrapper',x:0,y:0,params:{}});`);
 const r=a.json('importProjectData(source,{mode:"sheets"})');
 assert.ok(r.customs.inverter_2); assert.equal(r.customs.wrapper.schematic.components[0].type,'CUSTOM:inverter_2');
 assert.equal(a.run('state.project.customs.inverter.schematic.components.length'),0);
});
test('raw VHDL name collisions fail explicitly instead of silently reusing unrelated code',()=>{
 const a=setup(); a.run(`source.customs.raw={name:'top',vhdl:'entity top is end top;'};`);
 assert.throws(()=>a.run('importProjectData(source)'),/Custom VHDL/);
});
test('split copies dependencies, blocks moves still in use, and undo restores both projects',()=>{
 const a=setup(); a.ctx.payload=fixture; a.run('deserialize(JSON.stringify(payload))');
 assert.equal(a.run('splitProject(["leaf"],{move:true,dest:"new"})'),null);
 const before=a.json('JSON.parse(serialize())');
 a.run('splitProject(["main"],{dest:"new",name:"copy"})');
 assert.equal(a.run('Object.keys(state.projects).length'),2);
 assert.equal(a.run('Object.keys(Object.values(state.projects)[1].schematics).length'),2);
 a.run('undo()');assert.deepEqual(a.json('JSON.parse(serialize())'),before);
});
test('manual pin order and parent wires follow renamed or removed ports by identity',()=>{
 const a=setup();a.ctx.payload=fixture;a.run('deserialize(JSON.stringify(payload)); const child=state.project.schematics.leaf; const before=schPortList(child); child.components[0].params.name="new_input"; remapSubBlockPins("leaf",before,schPortList(child));');
 assert.equal(a.run('state.project.schematics.main.wires[0].to.pid'),'new_input');
 assert.deepEqual(a.json('state.project.schematics.main.components[1].params.inputOrder'),['new_input']);
 a.run('const prior=schPortList(child); child.components=child.components.filter(c=>c.type!=="IN"); remapSubBlockPins("leaf",prior,schPortList(child))');
 assert.equal(a.run('state.project.schematics.main.wires.length'),1);
});
test('position-based pin order keeps canonical IDs and existing manual override',()=>{
 const a=setup(); a.run(`const sch={components:[{id:'a',type:'IN',y:200,x:0,params:{name:'same'}},{id:'b',type:'IN',y:0,x:0,params:{name:'same'}}]};`);
 assert.deepEqual(a.json('schTypeDef(sch).ports({}).map(p=>p.id)'),['same_1','same']);
 assert.deepEqual(a.json('schTypeDef(sch).ports({inputOrder:["same","same_1"]}).map(p=>p.id)'),['same','same_1']);
});
test('v1 migration retains the old visible pin order even when port positions differ',()=>{
 const a=setup();a.run(`source.schematics.leaf.components.unshift({id:'extra',type:'IN',x:88,y:400,params:{name:'extra',width:1}});source.schematics.main.components[1].params.inputOrder=[];`);
 const r=a.json('importProjectData(source,{mode:"sheets",legacyPortOrder:true})');
 assert.deepEqual(r.schematics[r.topId].components[1].params.inputOrder,['extra','data_in']);
});
test('new project IDs cannot collide with loaded workspace project IDs',()=>{
 const a=setup();a.run('source.id="prj9999";deserialize(JSON.stringify({version:1,project:source}));addProject("next")');
 assert.equal(a.run('Object.keys(state.projects).length'),2);
 assert.notEqual(a.run('state.activeProjectId'),'prj9999');
});
test('moving sheets cannot leave even an unused custom definition with a missing SCH reference',()=>{
 const a=setup();a.ctx.payload=fixture;a.run(`deserialize(JSON.stringify(payload));state.project.customs.saved={name:'saved',schematic:{components:[{id:'x',type:'SCH:leaf',x:0,y:0,params:{}}],wires:[]}};`);
 assert.equal(a.run('splitProject(["main"],{move:true,dest:"new"})'),null);
 assert.equal(a.run('Object.keys(state.project.schematics).length'),2);
});
