const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
const source=`library ieee;use ieee.std_logic_1164.all;
entity buffer_box is port(a:in std_logic;y:out std_logic);end;
architecture rtl of buffer_box is begin y<=a;end;`;
function fixture(){
 const a=loadApp();a.ctx.source=source;
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([{vhdl:source}]));
 const parent=activeSch(),child=blankSchematic(uid('sch'),'child'),other=blankSchematic(uid('sch'),'other');
 state.project.schematics[child.id]=child;state.project.schematics[other.id]=other;snapshot();`);return a;
}
test('legacy projects get one discoverable entry per source without changing saved data on read',()=>{
 const a=fixture(),before=a.run('serialize()');
 assert.deepEqual(a.json('projectExplorer().folders.map(f=>f.name)'),['Schematics','VHDL']);
 assert.equal(a.run('explorerItems().length'),4);
 assert.equal(a.run('projectExplorer().items["CUSTOM:buffer_box"]'),'vhdl');
 assert.equal(a.run('projectExplorer().items["SCH:"+parent.id]'),'schematics');
 assert.equal(a.run('serialize()'),before);
});
test('mixed folders organize sources without changing circuit hierarchy or generated VHDL',()=>{
 const a=fixture();a.run(`const beforeCode=bundleAll(generateAllVhdl()),beforeSheets=JSON.stringify(state.project.schematics);`);
 const freshness=a.els.get('#vhdlFreshness').hidden;
 a.run(`const folder=addExplorerFolder('Display');
 moveExplorerItem('SCH:'+child.id,folder);moveExplorerItem('CUSTOM:buffer_box',folder);`);
 assert.equal(a.els.get('#vhdlFreshness').hidden,freshness);
 assert.equal(a.run('projectExplorer().items["SCH:"+child.id]'),a.run('folder'));
 assert.equal(a.run('projectExplorer().items["CUSTOM:buffer_box"]'),a.run('folder'));
 assert.equal(a.run('JSON.stringify(state.project.schematics)'),a.run('beforeSheets'));
 assert.equal(a.run('bundleAll(generateAllVhdl())'),a.run('beforeCode'));
 const saved=a.run('serialize()');a.run('deserialize(serialize())');assert.equal(a.run('serialize()'),saved);
});
test('moving a file has one Undo/Redo and rejects stale files and unknown folders',()=>{
 const a=fixture();a.run(`const folder=addExplorerFolder('Logic'),before=serialize(),idx=state.history.idx;`);
 assert.equal(a.run(`moveExplorerItem('CUSTOM:buffer_box',folder)`),true);
 assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
 a.run('redo()');assert.equal(a.run(`projectExplorer().items['CUSTOM:buffer_box']`),a.run('folder'));
 const current=a.run('serialize()');
 for(const code of [`moveExplorerItem('SCH:missing',null)`,`moveExplorerItem('CUSTOM:buffer_box','missing')`,`moveExplorerItem('CUSTOM:buffer_box',folder)`])assert.equal(a.run(code),false);
 assert.equal(a.run('serialize()'),current);
});
test('mixed folder ordering, imported fresh IDs and future folder IDs retain unique sources',()=>{
 const a=fixture();a.run(`const folder=addExplorerFolder('Logic');moveExplorerItem('SCH:'+child.id,folder);moveExplorerItem('CUSTOM:buffer_box',folder);
 reorderExplorerItem('CUSTOM:buffer_box','SCH:'+child.id,false);const original=cloneData(state.project);`);
 const keys=a.json('explorerItems().filter(i=>projectExplorer().items[i.key]===folder).map(i=>i.key)');
 assert.deepEqual(keys,['CUSTOM:buffer_box','SCH:'+a.run('child.id')]);
 a.run(`importProjectData(original,{mode:'new'});`);
 assert.deepEqual(a.json(`explorerItems().filter(i=>projectExplorer().items[i.key]===folder).map(i=>i.name)`),['buffer_box','child']);
 assert.ok(a.run(`Object.keys(projectExplorer().items).every(key=>key.startsWith('CUSTOM:')||state.project.schematics[key.slice(4)])`));
 a.run(`_uidN=Number(folder.replace('folder',''));const next=addExplorerFolder('Other');`);
 assert.notEqual(a.run('next'),a.run('folder'));
});
test('removing a folder returns its contents to the project and keeps definitions, wires and drafts',()=>{
 const a=fixture();a.run(`const id=addComp('CUSTOM:buffer_box',0,0),folder=addExplorerFolder('Logic');moveExplorerItem('CUSTOM:buffer_box',folder);
 saveVhdlSourceDraft(state.project,'buffer_box','unfinished');const sheets=JSON.stringify(state.project.schematics),before=serialize();deleteExplorerFolder(folder);`);
 assert.equal(a.run(`projectExplorer().items['CUSTOM:buffer_box']`),null);
 assert.ok(a.run('state.project.customs.buffer_box'));
 assert.equal(a.run('JSON.stringify(state.project.schematics)'),a.run('sheets'));
 assert.equal(a.run(`getVhdlSourceDraft(state.project,'buffer_box').source`),'unfinished');
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('collapse preferences persist without adding circuit history',()=>{
 const a=fixture();a.run(`const idx=state.history.idx;updateProjectExplorer(state.project,e=>{e.collapsed=true;e.folders[0].collapsed=true;},false);`);
 assert.equal(a.run('state.history.idx'),a.run('idx'));a.run('deserialize(serialize())');
 assert.equal(a.run('projectExplorer().collapsed'),true);assert.equal(a.run('projectExplorer().folders[0].collapsed'),true);
});
test('VHDL tabs open source without changing the active schematic or committing draft text',()=>{
 const a=fixture();a.run(`const sheets=JSON.stringify(state.project.schematics),idx=state.history.idx;
 saveVhdlSourceDraft(state.project,'buffer_box','unfinished');openVhdlTab('buffer_box');openVhdlTab('buffer_box');`);
 assert.equal(a.run('state.activeVhdl'),'buffer_box');assert.equal(a.run('state.activeId'),a.run('parent.id'));
 assert.deepEqual(a.json('state.vhdlTabs'),['buffer_box']);assert.equal(a.run('state.history.idx'),a.run('idx'));
 assert.equal(a.run('state.project.customs.buffer_box.vhdl'),source);
 assert.equal(a.run('JSON.stringify(state.project.schematics)'),a.run('sheets'));
 a.run('closeVhdlTab("buffer_box")');assert.equal(a.run('state.activeVhdl'),null);
 assert.equal(a.run(`getVhdlSourceDraft(state.project,'buffer_box').source`),'unfinished');
});
test('source tabs restore per project and after save/open, and drop targets retain their own schematic',()=>{
 const a=fixture();a.run(`openVhdlTab('buffer_box');const pid=state.activeProjectId,second=addProject('second');switchProject(pid);`);
 assert.equal(a.run('state.activeVhdl'),'buffer_box');a.run('deserialize(serialize())');assert.equal(a.run('state.activeVhdl'),'buffer_box');
 a.run(`openSchTab(child.id)`);assert.equal(a.run('state.activeVhdl'),null);assert.deepEqual(a.json('state.vhdlTabs'),['buffer_box']);
 a.run(`openVhdlTab('buffer_box');placeExplorerItem('CUSTOM:buffer_box');`);
 assert.equal(a.run('state.activeVhdl'),null);assert.equal(a.run('state.componentPlacement.sch.id'),a.run('child.id'));
});
test('opening missing source or source during Placement Mode cannot switch documents',()=>{
 const a=fixture();assert.equal(a.run(`openVhdlTab('missing')`),false);
 a.run('state.placementMode={project:state.project,sch:activeSch(),phase:"placing"}');
 assert.equal(a.run(`openVhdlTab('buffer_box')`),false);assert.equal(a.run('state.activeVhdl'),null);
});
test('source deletion closes its tab, and Undo restores the module and its tab',()=>{
 const a=fixture();a.run(`openVhdlTab('buffer_box');snapshot();deleteCustomComponent('buffer_box');`);
 assert.equal(a.run('state.activeVhdl'),null);assert.deepEqual(a.json('state.vhdlTabs'),[]);
 a.run('undo()');assert.equal(a.run('state.activeVhdl'),'buffer_box');assert.deepEqual(a.json('state.vhdlTabs'),['buffer_box']);
});
function editorRoot(a){
 const fields=new Map(),root=a.ctx.document.querySelector('#vhdlDocument');
 root.querySelector=s=>{if(!fields.has(s))fields.set(s,{value:'',innerHTML:'',textContent:'',style:{setProperty(){}},scrollTop:0,scrollLeft:0,focus(){}});return fields.get(s);};
 a.ctx.editorRoot=root;a.run(`renderVhdlModuleSource(editorRoot,{project:state.project,name:'buffer_box',root:'buffer_box'},{},'document')`);
 return {root,fields};
}
test('central editor keeps invalid drafts and applies valid edits to all shared instances in one Undo',()=>{
 const a=fixture();a.run(`addComp('CUSTOM:buffer_box',0,0);addComp('CUSTOM:buffer_box',200,0);openVhdlTab('buffer_box');snapshot();const before=serialize(),idx=state.history.idx;`);
 const {fields}=editorRoot(a),input=fields.get('#vmReplacement');
 input.value='unfinished entity';input.oninput();assert.equal(fields.get('#vmReplaceApply').disabled,true);
 assert.equal(a.run('state.project.customs.buffer_box.vhdl'),source);assert.equal(a.run('state.history.idx'),a.run('idx'));
 input.value=source.replace('y<=a','y<=not a');input.oninput();assert.equal(fields.get('#vmReplaceApply').disabled,false);
 fields.get('#vmReplaceApply').onclick();assert.equal(a.run('state.project.customs.buffer_box.vhdl'),input.value);
 assert.equal(a.run('state.history.idx'),a.run('idx+1'));assert.equal(a.run(`activeSch().components.filter(c=>c.type==='CUSTOM:buffer_box').length`),2);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('autosave tab bookkeeping and folder changes do not invalidate a source update',()=>{
 const a=fixture();a.run(`openVhdlTab('buffer_box');const plan=planVhdlModuleReplacement('buffer_box',source.replace('y<=a','y<=not a'));
 stashProjectUi();addExplorerFolder('Display');state.project.activeId=child.id;state.project.openTabs.push(child.id);`);
 assert.doesNotThrow(()=>a.run('applyVhdlModuleReplacement(plan)'));
 a.run(`const stale=planVhdlModuleReplacement('buffer_box',source);parent.components.push({id:uid('c'),type:'VCC',x:0,y:0,params:{}});`);
 assert.throws(()=>a.run('applyVhdlModuleReplacement(stale)'),/โปรเจกต์เปลี่ยนไป/);
});
function dragFixture(){
 const a=fixture(),handlers={};
 const row={dataset:{explorerItem:'CUSTOM:buffer_box'},classList:{add(){},remove(){}},
  addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture(){},releasePointerCapture(){},querySelector:()=>({focus(){}})};
 const root={querySelectorAll:selector=>selector==='[data-explorer-item]'?[row]:[],querySelector:()=>null,contains:el=>el===row||el===a.ctx.hit};
 a.ctx.root=root;a.ctx.document.elementFromPoint=()=>a.ctx.hit;
 a.ctx.document.querySelector('#canvas').getBoundingClientRect=()=>({left:300,right:1000,top:50,bottom:700,width:700,height:650});
 a.run(`svgPoint=ev=>({x:ev.clientX,y:ev.clientY});bindProjectExplorer(root)`);
 const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){},stopPropagation(){}});
 return {...a,row,handlers,event};
}
test('row click opens code, while dragging its child button places exactly one box without opening code',()=>{
 const a=dragFixture();a.handlers.click(a.event(100,100));assert.equal(a.run('state.activeVhdl'),'buffer_box');
 a.run('openSchTab(parent.id)');const before=a.run('state.history.idx');
 a.handlers.pointerdown(a.event(100,100));a.handlers.pointermove(a.event(500,300));
 assert.equal(a.run('activeSch().components.length'),0);assert.equal(a.run('state.activeVhdl'),null);
 a.handlers.pointerup(a.event(500,300));a.handlers.click(a.event(500,300));
 assert.equal(a.run('activeSch().components.length'),1);assert.equal(a.run('state.history.idx'),before+1);assert.equal(a.run('state.activeVhdl'),null);
});
test('sidebar drops move only grouping, while cancellation and outside release add no box',()=>{
 const a=dragFixture();a.run(`const folder=addExplorerFolder('Display');`);
 const target={dataset:{folder:a.run('folder')},classList:{add(){},remove(){}},getBoundingClientRect:()=>({top:200,height:30})};
 target.closest=()=>target;a.ctx.hit=target;
 a.handlers.pointerdown(a.event(100,100));a.handlers.pointermove(a.event(120,210));a.handlers.pointerup(a.event(120,210));
 assert.equal(a.run(`projectExplorer().items['CUSTOM:buffer_box']`),a.run('folder'));assert.equal(a.run('activeSch().components.length'),0);
 const before=a.run('serialize()');
 a.handlers.pointerdown(a.event(100,100));a.handlers.pointermove(a.event(500,300));a.handlers.pointerup(a.event(1200,800));
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.componentPlacement'),null);
 a.handlers.pointerdown(a.event(100,100));a.handlers.pointermove(a.event(500,300));a.handlers.pointercancel();
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.componentPlacement'),null);
});
