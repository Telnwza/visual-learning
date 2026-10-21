const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const source=`library ieee;use ieee.std_logic_1164.all;
entity param_box is generic(WIDTH:positive:=8;EDGE_FALLING:natural range 0 to 1:=0);
port(a:in std_logic_vector(WIDTH-1 downto 0);q:out std_logic_vector(WIDTH-1 downto 0));end;
architecture rtl of param_box is begin q<=a;end;`;
function moduleApp(){const a=loadApp();a.ctx.source=source;a.run('applyVhdlModuleImport(planVhdlModuleImport([{vhdl:source}]));const sch=activeSch();');a.ctx.document.querySelector('#vmReplacement').focus=()=>{};return a;}
function connected(){const a=moduleApp();a.run(`const input=addComp('IN',0,0,{name:'data',width:8}),id=addComp('CUSTOM:param_box',200,0),c=comp(id);
 sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:id,pid:'a'},name:'data_bus'});snapshot();`);return a;}
test('VHDL highlighting escapes source and keeps comments and strings separate from keywords',()=>{
 const a=loadApp();a.ctx.sample=`constant message : string := "<script> & -- if ""then"""; -- <b> end\nq <= '1';`;
 const highlighted=a.run('vhdlHighlight(sample)');
 assert.equal(highlighted.replace(/<\/?span(?: class="\w+")?>/g,''),a.run('esc(sample)'));
 assert.match(highlighted,/<span class="st">&quot;&lt;script&gt; &amp; -- if &quot;&quot;then&quot;&quot;&quot;<\/span>/);
 assert.match(highlighted,/<span class="cm">-- &lt;b&gt; end<\/span>/);
 assert.match(highlighted,/<span class="st">'1'<\/span>/);assert.doesNotMatch(highlighted,/<script>|<b>|<span[^>]*>[^<]*<span/);
});
test('VHDL highlighting recognizes mixed-case types, generics, generate blocks and numeric literals',()=>{
 const a=loadApp();a.ctx.sample='GENERIC (WIDTH : positive := 64); signal q : Std_Logic_Vector(WIDTH-1 downto 0); for i in 0 to 3 generate q(i) <= X"AF"; end generate; -- 16#FF#\nconstant n : real := 1.5e-2 + 16#FF#;';
 const highlighted=a.run('vhdlHighlight(sample)');
 for(const [kind,tokens] of [['kw',['GENERIC','generate','downto']],['ty',['positive','Std_Logic_Vector','real']],['nu',['64','1.5e-2','16#FF#']],['st',['X&quot;AF&quot;']]]){
  for(const token of tokens)assert.ok(highlighted.includes(`<span class="${kind}">${token}</span>`),token);
 }
 assert.equal(highlighted.replace(/<\/?span(?: class="\w+")?>/g,''),a.run('esc(sample)'));
});
test('VHDL highlighting preserves incomplete edits, tabs, blank lines and Unicode',()=>{
 const a=loadApp();
 for(const sample of ['', '\tif\r\n\r\n', 'report "ยังเขียนไม่เสร็จ <&', '\\if\\ <= 2;\n\n']){
  a.ctx.sample=sample;assert.equal(a.run('vhdlHighlight(sample)').replace(/<\/?span(?: class="\w+")?>/g,''),a.run('esc(sample)'));
 }
 a.ctx.sample='report "if';assert.match(a.run('vhdlHighlight(sample)'),/<span class="st">&quot;if<\/span>/);
});
test('picking primitives starts only a draft; cancellation leaves project, ids and history unchanged',()=>{
 const a=loadApp(),before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN');
 for(const type of a.json('Object.keys(TYPES)')){
  a.ctx.type=type;assert.ok(a.run('requestPalettePlacement(type)'));
  assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
  a.run('cancelComponentPlacement()');assert.equal(a.run('state.componentPlacement'),null);
 }
 assert.equal(a.run('state.history.idx'),idx);
});
test('configured click placement commits one component at the chosen grid location with Undo/Redo',()=>{
 const a=loadApp();a.run(`const before=serialize(),idx=state.history.idx;requestPalettePlacement('MUX');
 const draft=state.componentPlacement.draft;draft.params.width=64;draft.rot=90;draft.mirror=true;
 moveComponentPlacement({x:450,y:320});const expected={x:draft.x,y:draft.y};const id=commitComponentPlacement();`);
 assert.equal(a.run('state.componentPlacement'),null);assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 assert.deepEqual(a.json('({x:comp(id).x,y:comp(id).y})'),a.json('expected'));
 assert.equal(a.run('comp(id).params.width'),64);assert.equal(a.run('comp(id).rot'),90);assert.equal(a.run('comp(id).mirror'),true);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('placement commits the active Inspector field before adding the component',()=>{
 const a=moduleApp();a.run(`requestPalettePlacement('CUSTOM:param_box');const idx=state.history.idx;`);
 a.ctx.Event=class{constructor(type){this.type=type;}};
 const input={tagName:'INPUT',dispatchEvent(event){assert.equal(event.type,'change');a.run('state.componentPlacement.draft.params.generic_WIDTH=32');}};
 a.ctx.document.activeElement=input;a.els.get('#inspectorPane').contains=element=>element===input;
 a.run('const id=commitComponentPlacement({x:400,y:300})');
 assert.equal(a.run('getPort(comp(id),"q").width'),32);assert.equal(a.run('state.history.idx'),a.run('idx+1'));
});
test('ordinary I/O placement preserves automatic unique pin names',()=>{
 const a=loadApp();a.run(`for(const type of ['IN','IN','OUT','OUT']){requestPalettePlacement(type);commitComponentPlacement();}`);
 assert.deepEqual(a.json('activeSch().components.map(c=>c.params.name)'),['in0','in1','out0','out1']);
});
test('schematic and imported VHDL boxes use the same draft/drop transaction as primitives',()=>{
 const a=moduleApp();a.run(`const child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;`);
 for(const type of ['CUSTOM:param_box',a.run('"SCH:"+child.id')]){
  a.ctx.type=type;const before=a.run('activeSch().components.length'),idx=a.run('state.history.idx');
  assert.ok(a.run('requestPalettePlacement(type)'));assert.equal(a.run('activeSch().components.length'),before);
  a.run('moveComponentPlacement({x:600,y:400});commitComponentPlacement();');
  assert.equal(a.run('activeSch().components.length'),before+1);assert.equal(a.run('state.history.idx'),idx+1);
 }
 assert.equal(a.run('state.project.customs.param_box.vhdl'),source);
});
function pointerPalette(){
 const a=loadApp(),events={},tile={dataset:{pal:'AND'},addEventListener:(name,fn)=>events[name]=fn,setPointerCapture(){},releasePointerCapture(){}};
 a.els.get('#canvas').getBoundingClientRect=()=>({left:0,top:0,right:900,bottom:650,width:900,height:650});a.els.get('#canvas').focus=()=>{};
 a.ctx.root={querySelectorAll:()=>[tile]};a.run('bindPalettePlacement(root)');
 const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {...a,events,event,tile};
}
test('pointer drag previews without edits and commits exactly once on canvas release',()=>{
 const a=pointerPalette(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 assert.equal(a.tile.draggable,false);a.events.pointerdown(a.event(20,20));a.events.pointermove(a.event(300,200));
 assert.equal(a.run('serialize()'),before);assert.ok(a.run('state.componentPlacement'));
 a.events.pointerup(a.event(300,200));a.events.click(a.event(300,200));
 assert.equal(a.run('activeSch().components.length'),1);assert.equal(a.run('state.componentPlacement'),null);assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('outside release, pointer cancellation and Escape during a drag create no component',()=>{
 for(const cancel of ['outside','pointercancel','escape']){
  const a=pointerPalette(),before=a.run('serialize()'),idx=a.run('state.history.idx');
  a.events.pointerdown(a.event(20,20));a.events.pointermove(a.event(300,200));
  if(cancel==='pointercancel')a.events.pointercancel();
  else{if(cancel==='escape')a.run('cancelComponentPlacement()');a.events.pointerup(a.event(cancel==='outside'?-20:300,200));}
  assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);assert.equal(a.run('state.componentPlacement'),null);
 }
});
test('stale placement cannot put a component into a different sheet or project',()=>{
 for(const change of ['state.activeId=child.id','state.project=blankProject();state.activeId=state.project.topId']){
  const a=loadApp();a.ctx.change=change;a.run(`const old=activeSch(),child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;requestPalettePlacement('AND');`);
  a.run(change);assert.equal(a.run('commitComponentPlacement()'),null);
  assert.equal(a.run('old.components.length'),0);assert.equal(a.run('activeSch().components.length'),0);
 }
});
test('top/recursive sub-blocks and Placement Mode cannot arm a component draft',()=>{
 const a=loadApp();assert.equal(a.run('requestPalettePlacement("SCH:"+state.project.topId)'),null);
 a.run('enterPlacementMode()');assert.equal(a.run('requestPalettePlacement("AND")'),null);assert.equal(a.run('state.componentPlacement'),null);
});
test('safe generics and unconnected port changes apply directly with no pending confirmation',()=>{
 const a=moduleApp();a.run(`const id=addComp('CUSTOM:param_box',0,0),c=comp(id),idx=state.history.idx;
 requestComponentParamChange(sch,c,'generic_EDGE_FALLING',1);requestComponentParamChange(sch,c,'generic_WIDTH',64);`);
 assert.equal(a.run('state.pendingParamChange'),null);assert.equal(a.run('getPort(c,"q").width'),64);assert.equal(a.run('state.history.idx'),a.run('idx+2'));
 a.run(`const mux=comp(addComp('MUX',0,200,{inputs:4}));requestComponentParamChange(sch,mux,'inputs',2);`);
 assert.equal(a.run('mux.params.inputs'),2);assert.equal(a.run('state.pendingParamChange'),null);
});
test('a behavior-only generic remains direct when the unchanged interface has wires',()=>{
 const a=connected();a.run(`const wires=JSON.stringify(sch.wires);requestComponentParamChange(sch,c,'generic_EDGE_FALLING',1);`);
 assert.equal(a.run('state.pendingParamChange'),null);assert.equal(a.run('c.params.generic_EDGE_FALLING'),1);
 assert.equal(a.run('JSON.stringify(sch.wires)'),a.run('wires'));
});
test('connected width edits remain drafts, show real endpoints inline, and apply in one Undo',()=>{
 const a=connected(),before=a.run('serialize()'),idx=a.run('state.history.idx');
 a.run(`requestComponentParamChange(sch,c,'generic_WIDTH',64);const pending=state.pendingParamChange;`);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 const content=a.run('componentParamImpactHtml(sch,c,pending.change)');
 assert.match(content,/data-param-apply/);assert.match(content,/data\.o/);assert.match(content,/\.a/);assert.match(content,/data_bus/);assert.doesNotMatch(content,/modal|role="dialog"/);
 a.run('applyComponentParamChange(sch,c,pending.change)');assert.equal(a.run('getPort(c,"a").width'),64);assert.equal(a.run('state.pendingParamChange'),null);
 assert.equal(a.run('state.history.idx'),idx+1);const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('Cancel and returning a pending parameter to its current value leave the circuit untouched',()=>{
 const a=connected(),before=a.run('serialize()');a.run(`requestComponentParamChange(sch,c,'generic_WIDTH',64);`);
 const buttons=new Map(),root={querySelector:s=>{if(!buttons.has(s))buttons.set(s,{});return buttons.get(s);}};a.ctx.root=root;
 a.run('bindPendingParamChange(root,state.pendingParamChange)');buttons.get('[data-param-cancel]').onclick();
 assert.equal(a.run('state.pendingParamChange'),null);assert.equal(a.run('serialize()'),before);
 a.run(`requestComponentParamChange(sch,c,'generic_WIDTH',64);requestComponentParamChange(sch,c,'generic_WIDTH',8);`);
 assert.equal(a.run('state.pendingParamChange'),null);assert.equal(a.run('serialize()'),before);
});
test('all pending parameter plans reject intervening edits, including parent-sheet wires',()=>{
 const a=connected();a.run(`requestComponentParamChange(sch,c,'generic_WIDTH',64);const pending=state.pendingParamChange;
 sch.wires[0].name='changed_later';const before=serialize();`);
 assert.throws(()=>a.run('applyComponentParamChange(sch,c,pending.change)'),/วงจรเปลี่ยนไป/);assert.equal(a.run('serialize()'),a.run('before'));
});
test('invalid ordinary and generic numbers never clamp or create history',()=>{
 const a=moduleApp();a.run(`const mux=comp(addComp('MUX',0,0)),id=addComp('CUSTOM:param_box',200,0),c=comp(id);const before=serialize(),idx=state.history.idx;`);
 for(const [component,key,value] of [['mux','width',0],['mux','width',65],['mux','width',1.5],['c','generic_WIDTH',0],['c','generic_WIDTH',NaN]]){
  a.ctx.key=key;a.ctx.value=value;assert.throws(()=>a.run(`requestComponentParamChange(sch,${component},key,value)`));
 }
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
});
test('CONST truncation requires confirmation but a same-width Bus Tap range edit commits directly',()=>{
 const a=loadApp();a.run(`const sch=activeSch(),c=comp(addComp('CONST',0,0,{width:8,value:'FF'}));const before=serialize();requestComponentParamChange(sch,c,'width',4);`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.pendingParamChange.change.truncated'),true);
 a.run(`state.pendingParamChange=null;const t=comp(addComp('BUSTAP',200,0,{bit:0,nbit:4}));requestComponentParamChange(sch,t,'range',{bit:4,nbit:4});`);
 assert.equal(a.run('state.pendingParamChange'),null);assert.equal(a.run('t.params.bit'),4);
});
test('returning to a sheet restores its own pan/zoom without adding saved preferences',()=>{
 const a=loadApp();a.run(html.slice(html.indexOf('function autoFitSheet(force,tries)'),html.indexOf('\n/* =========================================================================\n   SYNTHESIS CHECK',html.indexOf('function autoFitSheet(force,tries)'))));
 a.run(`applyFit=()=>{state.view={x:0,y:0,k:1};return true;};const parent=activeSch(),child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;
 autoFitSheet();state.view={x:73,y:-112,k:1.7};openSchTab(child.id);state.view={x:-20,y:40,k:.65};openSchTab(parent.id);`);
 assert.deepEqual(a.json('state.view'),{x:73,y:-112,k:1.7});a.run('openSchTab(child.id)');assert.deepEqual(a.json('state.view'),{x:-20,y:40,k:.65});
 assert.doesNotMatch(a.run('serialize()'),/sheetViews|"view"/);
});
test('source editor validates as typed, keeps invalid text, and updates shared instances once',()=>{
 const a=moduleApp();a.run(`addComp('CUSTOM:param_box',0,0);addComp('CUSTOM:param_box',200,0,{generic_WIDTH:64});const before=serialize(),idx=state.history.idx;`);
 const fields=new Map(),field=()=>({value:'',textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},scrollTop:0,scrollLeft:0,focus(){}}),root=a.ctx.document.querySelector('#inspectorPane');
 root.querySelector=s=>{if(!fields.has(s))fields.set(s,field());return fields.get(s);};
 fields.set('#vmReplacement',{...field(),value:source});
 a.ctx.document.createElement=()=>{throw new Error('source editor must use the Inspector');};
 a.run('showVhdlModuleReplacement("param_box");renderInspectorContents();');
 assert.match(root.innerHTML,/inspector-source/);assert.doesNotMatch(root.innerHTML,/modal|vmReplacePreview/);assert.match(fields.get('#vmReplaceScope').textContent,/2 กล่อง/);
 const input=fields.get('#vmReplacement');input.value='invalid source';input.oninput();assert.equal(input.value,'invalid source');assert.equal(fields.get('#vmReplaceApply').disabled,true);assert.equal(a.run('serialize()'),a.run('before'));
 input.scrollTop=144;input.scrollLeft=215;input.onscroll();assert.equal(fields.get('#vmReplacementHighlight').style.transform,'translate(-215px, -144px)');
 assert.equal(input.value,'invalid source');assert.equal(a.run('serialize()'),a.run('before'));
 input.value=source.replace('q<=a','q<=not a');input.oninput();assert.equal(fields.get('#vmReplaceApply').disabled,false);assert.equal(fields.get('#vmReplaceImpact').innerHTML,'');
 assert.match(fields.get('#vmReplacementHighlight').innerHTML,/<span class="kw">not<\/span>/);assert.equal(input.scrollTop,144);assert.equal(input.scrollLeft,215);
 fields.get('#vmReplaceApply').onclick();assert.ok(a.run('state.vhdlSourceEdit'));assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 assert.equal(a.run('state.project.customs.param_box.vhdl'),input.value);assert.equal(a.run('getPort(sch.components[1],"q").width'),64);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
});
test('Inspector source drafts survive selection changes and rerenders until explicitly cancelled',()=>{
 const a=moduleApp();a.run(`const c=comp(addComp('CUSTOM:param_box',0,0));const before=serialize();showVhdlModuleReplacement('param_box');`);
 const root=a.els.get('#inspectorPane'),fields=new Map();root.querySelector=s=>{
  if(!fields.has(s))fields.set(s,{value:source,textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},scrollTop:0,scrollLeft:0});return fields.get(s);
 };
 a.run('renderInspectorContents()');const input=fields.get('#vmReplacement');input.value='unfinished source';input.oninput();
 a.run('state.selection.clear();renderInspectorContents()');assert.match(root.innerHTML,/Schematic Properties/);
 a.run('state.selection=new Set([c.id]);renderInspectorContents()');assert.match(root.innerHTML,/unfinished source/);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(fields.get('#vmReplaceApply').disabled,true);
 fields.get('#vmReplaceCancel').onclick();assert.equal(a.run('state.vhdlSourceEdit'),null);
 a.run('showVhdlModuleReplacement("param_box");renderInspectorContents()');assert.doesNotMatch(root.innerHTML,/unfinished source/);
 assert.equal(a.run('serialize()'),a.run('before'));
});
test('an Inspector source plan cannot overwrite a project changed since validation',()=>{
 const a=moduleApp();a.run(`addComp('CUSTOM:param_box',0,0);showVhdlModuleReplacement('param_box');`);
 const root=a.els.get('#inspectorPane'),fields=new Map();root.querySelector=s=>{
  if(!fields.has(s))fields.set(s,{value:source,textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},scrollTop:0,scrollLeft:0});return fields.get(s);
 };
 a.run('renderInspectorContents()');const input=fields.get('#vmReplacement');input.value=source.replace('q<=a','q<=not a');input.oninput();
 a.run('activeSch().name="changed_after_validation";snapshot();const before=serialize();');
 fields.get('#vmReplaceApply').onclick();assert.match(fields.get('#vmReplaceImpact').textContent,/โปรเจกต์เปลี่ยนไป/);
 assert.equal(input.value,source.replace('q<=a','q<=not a'));assert.equal(a.run('serialize()'),a.run('before'));
});
test('double-click opens VHDL source with instance settings while preserving schematic and primitive navigation',()=>{
 const a=moduleApp();a.run(`const c=comp(addComp('CUSTOM:param_box',0,0,{generic_WIDTH:64}));
 const before=serialize(),opened=[];showVhdlModuleInfo=(name,params)=>opened.push({name,params});
 openInspectorFor=c=>opened.push({inspector:c.id});openSchTab=id=>opened.push({sheet:id});
 const ev={preventDefault(){},stopPropagation(){}};openComponentOnDoubleClick(ev,c);const afterSourceOpen=serialize();
 const child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;
 openComponentOnDoubleClick(ev,{type:'SCH:'+child.id});openComponentOnDoubleClick(ev,{id:'gate',type:'AND'});`);
 assert.deepEqual(a.json('opened'),[{name:'param_box',params:{generic_WIDTH:64}},{sheet:a.run('child.id')},{inspector:'gate'}]);
 assert.equal(a.run('afterSourceOpen'),a.run('before'));
 assert.equal(a.run('state.project.customs.param_box.vhdl'),source);
});
function newModuleEditor(a=loadApp()){
 const fields=new Map(),m={removed:false,innerHTML:'',querySelector:s=>{
  if(!fields.has(s))fields.set(s,{value:'',textContent:'',disabled:false,style:{setProperty(){}},focus(){}});return fields.get(s);
 },remove(){this.removed=true;}};
 a.ctx.document.createElement=()=>m;a.ctx.document.body.appendChild=()=>{};
 a.run('showVhdlModulePaste()');return {...a,fields,m};
}
test('New VHDL starts with a valid entity and driven output without adding a module yet',()=>{
 const a=newModuleEditor(),input=a.fields.get('#vmSource');a.ctx.starter=input.value;
 assert.match(input.value,/library ieee;\nuse ieee\.std_logic_1164\.all;/);
 assert.match(input.value,/entity new_module is/);assert.match(input.value,/architecture rtl of new_module is/);assert.match(input.value,/q <= d;/);
 assert.equal(a.fields.get('#vmApply').disabled,false);assert.equal(a.run('Object.keys(state.project.customs).length'),0);
 assert.deepEqual(a.json('parseVhdlModuleFile({vhdl:starter}).ports.map(p=>[p.name,p.dir,p.width])'),[['d','in',1],['q','out',1]]);
 a.fields.get('#vmApply').onclick();assert.equal(a.run('state.project.customs.new_module.vhdl'),input.value);
});
test('new module names avoid existing entities, schematic names and supporting packages',()=>{
 const a=loadApp();a.run(`activeSch().name='NEW_MODULE';const first=newVhdlModuleSource(state.project);applyVhdlModuleImport(planVhdlModuleImport([{vhdl:first}]));`);
 assert.match(a.run('first'),/entity new_module_2 is/);
 assert.match(newModuleEditor(a).fields.get('#vmSource').value,/entity new_module_3 is/);
 const b=loadApp();b.ctx.pkg='package new_module is constant n:integer:=1;end package;';
 b.ctx.box=source.replace('library ieee;','library ieee;use work.new_module.all;');
 b.run('applyVhdlModuleImport(planVhdlModuleImport([{vhdl:pkg},{vhdl:box}]))');
 assert.match(newModuleEditor(b).fields.get('#vmSource').value,/entity new_module_2 is/);
});
test('New VHDL preserves recovered drafts instead of replacing them with the starter',()=>{
 const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
 const a=loadApp({storage});a.run(`saveVhdlSourceDraft(state.project,VHDL_NEW_DRAFT,'unfinished user source');autosave();`);
 const b=loadApp({storage});b.run('loadAutosave()');const editor=newModuleEditor(b);
 assert.equal(editor.fields.get('#vmSource').value,'unfinished user source');assert.equal(editor.fields.get('#vmApply').disabled,true);
 editor.fields.get('#vmCancel').onclick();assert.equal(b.run('readVhdlDraftEntries().length'),0);
 assert.match(newModuleEditor(b).fields.get('#vmSource').value,/entity new_module is/);
});
test('writing a new VHDL module adds its exact source to the library in one undoable action',()=>{
 const a=newModuleEditor(),before=a.run('serialize()'),idx=a.run('state.history.idx'),input=a.fields.get('#vmSource');
 input.value=source;input.oninput();
 assert.equal(a.fields.get('#vmApply').disabled,false);assert.equal(a.run('serialize()'),before);
 a.fields.get('#vmApply').onclick();assert.equal(a.m.removed,true);
 assert.equal(a.run('state.project.customs.param_box.vhdl'),source);assert.equal(a.run('activeSch().components.length'),0);
 assert.deepEqual(a.json('state.paletteRecent.names'),['param_box']);assert.equal(a.run('state.history.idx'),idx+1);
 const saved=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),saved);
 a.run('deserialize(serialize())');assert.equal(a.run('serialize()'),saved);
});
test('invalid new VHDL stays editable and cancelling does not add a module or history',()=>{
 const a=newModuleEditor(),before=a.run('serialize()'),idx=a.run('state.history.idx'),input=a.fields.get('#vmSource');
 input.value='unfinished entity';input.oninput();assert.equal(input.value,'unfinished entity');assert.equal(a.fields.get('#vmApply').disabled,true);
 assert.ok(a.fields.get('#vmStatus').textContent);a.fields.get('#vmCancel').onclick();
 assert.equal(a.m.removed,true);assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
});
