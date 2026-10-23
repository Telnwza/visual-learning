const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
const tx=`library ieee;use ieee.std_logic_1164.all;
entity transmitter is generic(WIDTH:positive:=8);port(clk,rst:out std_logic;data:out std_logic_vector(WIDTH-1 downto 0));end;
architecture rtl of transmitter is begin clk<='0';rst<='0';data<=(others=>'1');end;`;
const rx=`library ieee;use ieee.std_logic_1164.all;
entity receiver is generic(WIDTH:positive:=8);port(clk,rst:in std_logic;data:in std_logic_vector(WIDTH-1 downto 0);q:out std_logic_vector(WIDTH-1 downto 0));end;
architecture rtl of receiver is begin q<=data;end;`;
function storedApp(storage=new Map()){
 const a=loadApp({autosaveStore:storage});a.ctx.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};a.storage=storage;return a;
}
function modules(a=storedApp(),width=8){
 a.ctx.tx=tx;a.ctx.rx=rx;a.ctx.width=width;
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([{vhdl:tx},{vhdl:rx}]));
 const sch=activeSch(),from=comp(addComp('CUSTOM:transmitter',0,0,{generic_WIDTH:width})),to=comp(addComp('CUSTOM:receiver',400,0,{generic_WIDTH:width}));snapshot();`);return a;
}
function editResult(a,value,start,end,key,shift=false){
 Object.assign(a.ctx,{value,start,end,key,shift});return a.json('vhdlIndentEdit(value,start,end,key,shift)');
}
function applyEdit(value,e){return value.slice(0,e.from)+e.text+value.slice(e.to);}
test('indentation handles cursor insertion, multiline selection, trailing newline and outdent bounds',()=>{
 const a=loadApp();assert.equal(applyEdit('abc',editResult(a,'abc',1,1,'Tab')),'a  bc');
 const value='a\n b\nc',indent=editResult(a,value,0,5,'Tab');
 assert.equal(applyEdit(value,indent),'  a\n   b\nc');assert.equal(indent.start,2);assert.equal(indent.end,9);
 const outdent=editResult(a,'  a\n\tb\n c',0,9,'Tab',true);assert.equal(applyEdit('  a\n\tb\n c',outdent),'a\nb\nc');
 const cursor=editResult(a,' a',1,1,'Tab',true);assert.equal(applyEdit(' a',cursor),'a');assert.equal(cursor.start,0);assert.equal(cursor.end,0);
 assert.equal(applyEdit('\na',editResult(a,'\na',0,2,'Tab')),'  \n  a');
 assert.equal(applyEdit('\na',editResult(a,'\na',0,0,'Tab',true)),'\na');
});
test('Enter keeps indentation and adds one level after VHDL block openings',()=>{
 const a=loadApp();
 for(const [value,expected] of [['  if en = \'1\' then','\n    '],['\tq <= d;','\n\t'],['begin','\n  '],['  -- begin','\n  ']]){
  const e=editResult(a,value,value.length,value.length,'Enter');assert.equal(e.text,expected);assert.equal(e.start,value.length+expected.length);
 }
});
function editor(){
 const a=storedApp(),fields=new Map(),root={querySelector:s=>{
  if(!fields.has(s))fields.set(s,{value:'',textContent:'',innerHTML:'',hidden:true,style:{setProperty(){}},scrollTop:0,scrollLeft:0,selectionStart:0,selectionEnd:0,clientHeight:160,clientWidth:280,
   focus(){},setSelectionRange(s,e){this.selectionStart=s;this.selectionEnd=e;},setRangeText(text,s,e){this.value=this.value.slice(0,s)+text+this.value.slice(e);}});return fields.get(s);
 }};
 a.ctx.root=root;a.ctx.edits=[];a.ctx.getComputedStyle=()=>({lineHeight:'18px',fontSize:'12px',paddingLeft:'40px'});
 a.run(`bindVhdlEditor(root,'code',value=>edits.push(value))`);root.querySelector('#codeReplace');return {...a,fields,input:fields.get('#code')};
}
test('Find wraps both ways, treats punctuation literally, and Replace inserts literal text',()=>{
 const a=editor();a.input.value='a.b A.B aXb';a.input.oninput();a.fields.get('#codeFind').value='a.b';
 a.fields.get('#codeNext').onclick();assert.equal(a.input.selectionStart,0);assert.equal(a.input.selectionEnd,3);
 a.fields.get('#codeNext').onclick();assert.equal(a.input.selectionStart,4);
 a.fields.get('#codeNext').onclick();assert.equal(a.input.selectionStart,0);
 a.fields.get('#codePrev').onclick();assert.equal(a.input.selectionStart,4);
 a.fields.get('#codeReplace').value='$&';a.fields.get('#codeReplaceOne').onclick();assert.equal(a.input.value,'a.b $& aXb');
 a.fields.get('#codeReplaceAll').onclick();assert.equal(a.input.value,'$& $& aXb');
 assert.equal(a.fields.get('#codeHighlight').innerHTML,a.run('vhdlHighlight(root.querySelector("#code").value)'));
 a.fields.get('#codeFind').value='';a.fields.get('#codeReplaceAll').onclick();assert.equal(a.input.value,'$& $& aXb');
});
test('keyboard editing ignores IME composition and supports indent, find shortcuts and Escape recovery',()=>{
 const a=editor();a.input.value='begin';a.input.setSelectionRange(5,5);
 const key=(key,extra={})=>({key,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra});
 let ev=key('Enter',{isComposing:true});a.input.onkeydown(ev);assert.equal(a.input.value,'begin');assert.equal(ev.prevented,undefined);
 ev=key('Enter');a.input.onkeydown(ev);assert.equal(a.input.value,'begin\n  ');assert.equal(ev.prevented,true);
 a.input.onkeydown(key('Tab',{shiftKey:true}));assert.equal(a.input.value,'begin\n');
 ev=key('f',{ctrlKey:true});a.input.onkeydown(ev);assert.equal(a.fields.get('#codeFindPanel').hidden,false);assert.equal(ev.stopped,true);
 ev=key('Escape');a.input.onkeydown(ev);assert.equal(a.fields.get('#codeFindPanel').hidden,true);assert.equal(ev.stopped,true);
 a.input.onkeydown(key('f',{ctrlKey:true}));
 ev=key('Escape');a.fields.get('#codeFindPanel').onkeydown(ev);assert.equal(a.fields.get('#codeFindPanel').hidden,true);assert.equal(ev.stopped,true);
 assert.equal(a.fields.get('#codeLines').textContent,'1\n2');
});
test('existing-module drafts recover after reload without changing committed source or project history',async()=>{
 const a=modules();await a.run(`const before=serialize(),idx=state.history.idx;saveVhdlSourceDraft(state.project,'transmitter','unfinished entity');autosave();`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));assert.equal(a.run('state.project.customs.transmitter.vhdl'),tx);
 const b=storedApp(a.storage);await b.run('loadAutosave()');
 assert.equal(b.run(`getVhdlSourceDraft(state.project,'transmitter').source`),'unfinished entity');assert.equal(b.run('state.project.customs.transmitter.vhdl'),tx);
 assert.doesNotMatch(b.run('serialize()'),/unfinished entity/);
});
test('drafts are isolated by project and original source, including a new-module draft',async()=>{
 const a=modules();await a.run(`saveVhdlSourceDraft(state.project,'transmitter','first draft');saveVhdlSourceDraft(state.project,VHDL_NEW_DRAFT,'new draft');autosave();`);
 const b=storedApp(a.storage);await b.run('loadAutosave()');b.run(`const original=state.project,other=cloneData(original);other.id='other';`);
 assert.equal(b.run(`getVhdlSourceDraft(other,'transmitter').source`),tx);
 assert.equal(b.run(`getVhdlSourceDraft(original,VHDL_NEW_DRAFT).source`),'new draft');
 b.run(`other.id=original.id;other.customs.transmitter.vhdl+='\\n-- changed base';`);
 assert.match(b.run(`getVhdlSourceDraft(other,'transmitter').source`),/changed base/);
 assert.equal(b.run(`getVhdlSourceDraft(original,'transmitter').source`),'first draft');
});
test('Cancel and successful Update clear stored drafts, while storage errors retain editable text',async()=>{
 const a=modules();a.run(`saveVhdlSourceDraft(state.project,VHDL_NEW_DRAFT,'new draft');clearVhdlSourceDraft(state.project,VHDL_NEW_DRAFT);`);
 assert.equal(a.run('readVhdlDraftEntries().length'),0);
 await a.run(`saveVhdlSourceDraft(state.project,'transmitter',tx+'\\n-- updated');applyVhdlModuleReplacement(planVhdlModuleReplacement('transmitter',tx+'\\n-- updated'));clearVhdlSourceDraft(state.project,'transmitter');autosave();`);
 const b=storedApp(a.storage);await b.run('loadAutosave()');
 assert.equal(b.run('readVhdlDraftEntries().length'),0);assert.equal(b.run(`getVhdlSourceDraft(state.project,'transmitter').source`),tx+'\n-- updated');
 b.ctx.localStorage.setItem=()=>{throw new Error('quota');};
 assert.match(b.run(`saveVhdlSourceDraft(state.project,'transmitter','still editable')`),/ไม่สำเร็จ/);
 assert.equal(b.run(`getVhdlSourceDraft(state.project,'transmitter').source`),'still editable');
 assert.match(b.run(`clearVhdlSourceDraft(state.project,'transmitter')`),/ไม่สำเร็จ/);
 assert.equal(b.run(`getVhdlSourceDraft(state.project,'transmitter').source`),'still editable');
});
test('Generate caches do not invalidate a source draft, while real circuit edits still do',()=>{
 const a=modules();a.run(`const plan=planVhdlModuleReplacement('receiver',rx+'\\n-- draft');runSynthesis({reveal:false});generateAllVhdl();`);
 assert.doesNotThrow(()=>a.run('applyVhdlModuleReplacement(plan)'));
 assert.equal(a.run('state.project.customs.receiver.vhdl'),rx+'\n-- draft');
 a.run(`const stale=planVhdlModuleReplacement('receiver',rx);activeSch().name='renamed';`);
 assert.throws(()=>a.run('applyVhdlModuleReplacement(stale)'),/โปรเจกต์เปลี่ยนไป/);
});
for(const width of [1,32,64])test(`pairwise ${width}-bit connections use exact ports and commit one Undo/Redo`,()=>{
 const a=modules(storedApp(),width);a.run(`const before=serialize(),idx=state.history.idx,uidBefore=_uidN,mapping=suggestPairPortConnections(sch,from.id,to.id),plan=planPairPortConnections(sch,from.id,to.id,mapping);`);
 assert.deepEqual(a.json('mapping'),{clk:'clk',rst:'rst',data:'data'});assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('_uidN'),a.run('uidBefore'));
 assert.equal(a.run('applyPairPortConnections(plan)'),3);assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 assert.ok(a.run(`['clk','rst','data'].every(pid=>{const w=sch.wires.find(w=>w.to.cid===to.id&&w.to.pid===pid);return netDriverPort(sch,w).cid===from.id&&netDriverPort(sch,w).pid===pid;})`));
 const after=a.run('serialize()');assert.equal(a.run('applyPairPortConnections(plan)'),0);assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('pairwise mapping keeps occupied/manual wires, rejects wrong widths and revalidates stale targets',()=>{
 const a=modules();a.run(`const other=comp(addComp('IN',0,400,{width:1}));const keep={id:uid('w'),from:{cid:other.id,pid:'o'},to:{cid:to.id,pid:'rst'},pts:[{x:99,y:400},{x:99,y:40}],name:'keep'};sch.wires.push(keep);snapshot();
 const plan=planPairPortConnections(sch,from.id,to.id,{clk:'clk',rst:'rst',data:'clk'});`);
 assert.deepEqual(a.json('plan.targets.map(t=>t.kind)'),['accept','skip','skip']);
 a.run(`sch.wires.push({id:uid('w'),from:{cid:other.id,pid:'o'},to:{cid:to.id,pid:'clk'}});snapshot();const before=serialize();`);
 assert.equal(a.run('applyPairPortConnections(plan)'),0);assert.equal(a.run('serialize()'),a.run('before'));
 a.run(`const dataPlan=planPairPortConnections(sch,from.id,to.id,{data:'data'});`);assert.equal(a.run('applyPairPortConnections(dataPlan)'),1);
 assert.deepEqual(a.json('sch.wires.find(w=>w.id===keep.id)'),a.json('keep'));
});
test('manual mapping supports output fan-out, ignores unknown ports, and survives save/load',()=>{
 const a=modules(storedApp(),1);a.run(`const plan=planPairPortConnections(sch,from.id,to.id,{clk:'rst',rst:'rst',data:'missing',q:'data'});`);
 assert.equal(a.run('applyPairPortConnections(plan)'),2);
 assert.ok(a.run(`sch.wires.filter(w=>w.to.cid===to.id).every(w=>netDriverPort(sch,w).pid==='rst')`));
 const saved=a.run('serialize()');a.run('deserialize(serialize())');assert.equal(a.run('serialize()'),saved);
});
test('pairwise transactions reject an inactive owner and roll back routing failure completely',()=>{
 const a=modules();a.run(`const plan=planPairPortConnections(sch,from.id,to.id,suggestPairPortConnections(sch,from.id,to.id));const before=serialize(),uidBefore=_uidN;const heal=healLayout;healLayout=()=>{throw new Error('route failure');};`);
 assert.throws(()=>a.run('applyPairPortConnections(plan)'),/route failure/);assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('_uidN'),a.run('uidBefore'));
 a.run(`healLayout=heal;state.activeId='missing';`);assert.throws(()=>a.run('applyPairPortConnections(plan)'),/แผ่นวงจรเปลี่ยนไป/);
});
test('pairwise Inspector preview and Cancel leave the circuit untouched',()=>{
 const a=modules(),root=a.ctx.document.querySelector('#inspectorPane'),fields=new Map();root.querySelector=s=>{if(!fields.has(s))fields.set(s,{style:{},textContent:'',disabled:false});return fields.get(s);};
 a.run(`state.selection=new Set([from.id,to.id]);const before=serialize();showPairPortConnections();renderInspectorContents();`);
 assert.match(root.innerHTML,/pair-wiring/);assert.doesNotMatch(root.innerHTML,/modal-bg/);
 assert.equal(a.run('serialize()'),a.run('before'));root.querySelector('#pairCancel').onclick();assert.equal(a.run('state.pairWire'),null);assert.equal(a.run('serialize()'),a.run('before'));
});
