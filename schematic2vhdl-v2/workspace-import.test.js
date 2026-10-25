const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/import-v1.schproj.json'),'utf8'));
function setup(){
 const a=loadApp();a.ctx.payload={version:2,workspace:{projects:{first:structuredClone(fixture.project),second:structuredClone(fixture.project)},activeId:'second'}};
 a.run(`state.project.name='old_lab';const first=payload.workspace.projects.first,second=payload.workspace.projects.second;
 first.activeId='leaf';first.openTabs=['leaf','main'];first.view={x:80,y:90,k:1.25};
 first.explorer={folders:[{id:'lab',name:'Lab',collapsed:true}],items:{'SCH:main':'lab','SCH:leaf':'lab'},order:['SCH:leaf','SCH:main']};
 snapshot();`);return a;
}
test('workspace import appends every project, resolves names and IDs, and keeps the current drawing and UI active',()=>{
 const a=setup(),before=a.run('serialize()'),original=a.json('state.project'),source=a.json('payload');
 a.els.get('#vhdlEntitySel').options=[];assert.ok(a.run('generateVHDL()'));
 a.run(`const current=state.project,active=state.activeId,tabs=state.openTabs,view=state.view;state.selection.add('selected');
 const preview=$('#vhdlOutput').dataset.raw;const imported=importWorkspaceData(payload);`);
 assert.equal(a.run('Object.keys(state.projects).length'),3);
 assert.deepEqual(a.json('imported.map(p=>p.name)'),['old_lab_2','old_lab_3']);
 assert.deepEqual(a.json('state.project'),original);assert.equal(a.run('state.project===current&&state.activeId===active&&state.openTabs===tabs&&state.view===view'),true);
 assert.equal(a.run('state.selection.has("selected")'),true);assert.equal(a.run('$("#vhdlOutput").dataset.raw'),a.run('preview'));
 assert.deepEqual(a.json('payload'),source);
 const ids=a.json('Object.values(state.projects).flatMap(p=>[p.id,...Object.values(p.schematics).flatMap(s=>[s.id,...s.components.map(c=>c.id),...s.wires.map(w=>w.id)])])');
 assert.equal(ids.length,new Set(ids).size);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('imported projects preserve top, active sheet, open tabs, folders, view and exact wire paths',()=>{
 const a=setup();a.run('const imported=importWorkspaceData(payload),p=imported[0];');
 assert.equal(a.run('p.schematics[p.topId].name'),'top');assert.equal(a.run('p.schematics[p.activeId].name'),'invert_byte');
 assert.deepEqual(a.json('p.openTabs.map(id=>p.schematics[id].name)'),['invert_byte','top']);
 assert.deepEqual(a.json('p.view'),{x:80,y:90,k:1.25});
 assert.deepEqual(a.json('p.explorer.folders'),[{id:'lab',name:'Lab',collapsed:true}]);
 assert.equal(a.run('p.explorer.items["SCH:"+p.topId]'),'lab');
 const leaf=a.json('p.schematics[p.activeId]');
 assert.deepEqual(leaf.wires[1].pts,fixture.project.schematics.leaf.wires[1].pts);
 assert.deepEqual(leaf.wires[1].autoPts,fixture.project.schematics.leaf.wires[1].autoPts);
 assert.equal(leaf.wires[1].color,'#aa44ff');
 assert.equal(a.run('p.schematics[p.topId].components.find(c=>c.type.startsWith("SCH:")).type'),'SCH:'+leaf.id);
});
test('VHDL entities with the same name remain separate across imported projects and source tabs stay available',()=>{
 const a=setup();a.run(`for(const [index,p] of Object.values(payload.workspace.projects).entries()){
 p.customs.helper=parseVhdlModuleFile({vhdl:'library ieee;use ieee.std_logic_1164.all;entity helper is port(a:in std_logic;y:out std_logic);end;architecture rtl of helper is begin y<='+(index?'not a':'a')+';end;'});
 p.vhdlTabs=['helper'];p.activeVhdl='helper';
 p.schematics.main.components.push({id:'raw1',type:'CUSTOM:helper',x:600,y:300,params:{}});
 }
 const imported=importWorkspaceData(payload);`);
 assert.match(a.run('imported[0].customs.helper.vhdl'),/y<=a/);assert.match(a.run('imported[1].customs.helper.vhdl'),/y<=not a/);
 a.run('switchProject(imported[0].id)');assert.deepEqual(a.json('state.vhdlTabs'),['helper']);assert.equal(a.run('state.activeVhdl'),'helper');
});
test('the whole import is one Undo/Redo step and Save/Open retains all projects',()=>{
 const a=setup(),before=a.run('serialize()'),idx=a.run('state.history.idx');a.run('importWorkspaceData(payload)');
 assert.equal(a.run('state.history.idx'),idx+1);const after=a.run('serialize()');
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.saved=after;a.run('deserialize(saved)');assert.equal(a.run('serialize()'),after);
 a.run('importWorkspaceData(payload)');assert.deepEqual(a.json('Object.values(state.projects).map(p=>p.name)'),['old_lab','old_lab_2','old_lab_3','old_lab_4','old_lab_5']);
});
for(const [label,mutation] of [
 ['missing wire port',`payload.workspace.projects.second.schematics.main.wires[0].to.pid='missing'`],
 ['missing dependency',`delete payload.workspace.projects.second.schematics.leaf`],
 ['broken sheet',`payload.workspace.projects.second.schematics.main=null`],
 ['recursive hierarchy',`payload.workspace.projects.second.schematics.leaf.components[1].type='SCH:main'`],
 ['unsupported version',`payload.version=999`]
])test(`a ${label} rejects the entire workspace without changing projects, source, history or the ID counter`,()=>{
 const a=setup();a.run(mutation);const before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN'),source=a.json('payload');
 assert.throws(()=>a.run('importWorkspaceData(payload)'));assert.equal(a.run('serialize()'),before);
 assert.equal(a.run('state.history.idx'),idx);assert.equal(a.run('_uidN'),uid);assert.deepEqual(a.json('payload'),source);
});
test('legacy project files import as one project and preserve v1 pin order',()=>{
 const a=loadApp();a.ctx.payload=structuredClone(fixture);a.ctx.payload.activeId='leaf';a.ctx.payload.openTabs=['main','leaf'];
 a.run('const imported=importWorkspaceData(payload),p=imported[0];');
 assert.equal(a.run('Object.keys(state.projects).length'),2);assert.equal(a.run('p.schematics[p.activeId].name'),'invert_byte');
 assert.deepEqual(a.json('p.schematics[p.topId].components.find(c=>c.type.startsWith("SCH:")).params.inputOrder'),['data_in']);
});
test('Placement Mode blocks import without any change',()=>{
 const a=setup(),before=a.run('serialize()'),uid=a.run('_uidN');a.run('state.placementMode={}');
 assert.throws(()=>a.run('importWorkspaceData(payload)'),/Placement Mode/);assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
});
function picker(a){
 const input={click(){this.clicked=true;},remove(){this.removed=true;}},create=a.ctx.document.createElement;
 a.ctx.document.createElement=tag=>tag==='input'?input:create(tag);a.ctx.messages=[];
 a.run(`toast=(message,kind)=>messages.push({message,kind});importWorkspaceFromFile();`);return input;
}
test('Import Workspace opens a file picker and imports directly without confirmation pages',async()=>{
 const a=setup(),input=picker(a);assert.equal(input.clicked,true);assert.equal(input.type,'file');
 await input.onchange({target:{files:[{text:async()=>JSON.stringify(a.ctx.payload)}]}});
 assert.equal(a.run('Object.keys(state.projects).length'),3);assert.match(a.run('messages[0].message'),/2 โปรเจกต์/);
 assert.equal(input.removed,true);
});
test('cancellation, unreadable files and stale workspaces cannot import or replace current data',async()=>{
 const a=setup(),input=picker(a),before=a.run('serialize()');
 input.oncancel();assert.equal(input.removed,true);
 await input.onchange({target:{files:[]}});assert.equal(a.run('serialize()'),before);
 await input.onchange({target:{files:[{text:async()=>{throw new Error('read failed');}}]}});assert.equal(a.run('serialize()'),before);
 let resolve;const pending=input.onchange({target:{files:[{text:()=>new Promise(r=>resolve=r)}]}});
 a.run('deserialize(serialize())');const latest=a.run('serialize()');resolve(JSON.stringify(a.ctx.payload));await pending;
 assert.equal(a.run('serialize()'),latest);assert.match(a.run('messages.at(-1).message'),/Workspace เปลี่ยนแล้ว/);
});
