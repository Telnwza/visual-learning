const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
function setup(type='DFF',params=[{},{}]){
 const a=loadApp();a.ctx.type=type;a.ctx.params=params;
 a.run(`const sch=activeSch(),items=params.map((p,i)=>comp(addComp(type,100+i*160,100,p)));
 items.forEach((c,i)=>c.label='device_'+i);state.selection=new Set(items.map(c=>c.id));snapshot();`);return a;
}
test('same-type selection includes marquee wires and junctions, while mixed devices keep the selection summary',()=>{
 const a=setup();a.run(`const dot=addComp('JUNCTION',400,300),wire={id:uid('w'),from:{cid:items[0].id,pid:'q'},to:{cid:items[1].id,pid:'d'},name:''};
 sch.wires.push(wire);state.selection=new Set([...items.map(c=>c.id),dot,wire.id]);renderInspectorContents();`);
 assert.equal(a.run('selectedParamComponents().length'),2);
 assert.match(a.els.get('#inspectorPane').innerHTML,/D-FF × 2/);assert.match(a.els.get('#inspectorPane').innerHTML,/data-pk="enable"/);
 a.run(`state.selection.add(addComp('NOT',600,100));renderInspectorContents()`);
 assert.deepEqual(a.json('selectedParamComponents()'),[]);assert.doesNotMatch(a.els.get('#inspectorPane').innerHTML,/data-pk="enable"/);
});
test('mixed parameters render empty fields and indeterminate checkboxes without identity or position fields',()=>{
 const a=setup('DFF',[{enable:false,edge:'rising'},{enable:true,edge:'falling'}]);
 const html=a.run('componentParamFields(items[0],items)');assert.match(html,/data-pk="enable" data-mixed="true"/);
 assert.match(html,/<option value="" selected disabled>หลายค่า/);
 a.run('renderInspectorContents()');assert.doesNotMatch(a.els.get('#inspectorPane').innerHTML,/id="iLabel"|id="iX"|id="iY"/);
 const handlers={},input={dataset:{pk:'enable',mixed:'true'},checked:false,addEventListener:(k,fn)=>handlers[k]=fn,
  closest:()=>({after(){}}),removeAttribute(){},setAttribute(){}};
 a.ctx.root={querySelectorAll:s=>s==='[data-pk]'?[input]:[]};a.ctx.changes=[];
 a.run('bindComponentParamFields(root,items[0],(key,value)=>changes.push({key,value}))');assert.equal(input.indeterminate,true);
 input.checked=true;handlers.change();assert.deepEqual(a.json('changes'),[{key:'enable',value:true}]);
});
test('changing one shared property preserves other settings, names and positions with one Undo/Redo',()=>{
 const a=setup('DFF',[{enable:false,edge:'rising'},{enable:true,edge:'falling'}]);
 const before=a.run('serialize()'),idx=a.run('state.history.idx'),identity=a.json('items.map(c=>({id:c.id,label:c.label,x:c.x,y:c.y,edge:c.params.edge}))');
 a.run(`requestComponentBatchParamChange(sch,items,'enable',true)`);
 assert.deepEqual(a.json('items.map(c=>c.params.enable)'),[true,true]);assert.equal(a.run('state.history.idx'),idx+1);
 assert.deepEqual(a.json('items.map(c=>({id:c.id,label:c.label,x:c.x,y:c.y,edge:c.params.edge}))'),identity);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('connected controls stage one group confirmation and remove only affected wires',()=>{
 const a=setup('DFF',[{enable:true},{enable:true}]);a.run(`const input=addComp('IN',0,0,{name:'en'});
 for(const c of items)sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:c.id,pid:'en'},name:'enable'});
 sch.wires.push({id:uid('w'),from:{cid:items[0].id,pid:'q'},to:{cid:items[1].id,pid:'d'},name:'data'});state.selection=new Set(items.map(c=>c.id));snapshot();`);
 const before=a.run('serialize()'),idx=a.run('state.history.idx');a.run(`requestComponentBatchParamChange(sch,items,'enable',false);renderInspectorContents();`);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 assert.equal((a.els.get('#inspectorPane').innerHTML.match(/data-param-apply/g)||[]).length,1);
 a.run('applyComponentBatchParamChange(state.pendingParamChange)');assert.equal(a.run('state.history.idx'),idx+1);
 assert.deepEqual(a.json('sch.wires.map(w=>w.name)'),['data']);assert.deepEqual(a.json('items.map(c=>c.params.enable)'),[false,false]);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
});
test('invalid values, stale projects and changed selections cannot partially change a batch',()=>{
 const a=setup('MUX',[{inputs:2,width:8},{inputs:4,width:16}]),before=a.run('serialize()');
 assert.throws(()=>a.run(`requestComponentBatchParamChange(sch,items,'width',65)`),/device_0/);assert.equal(a.run('serialize()'),before);
 a.run(`const batch=planComponentBatchParamChange(sch,items,'width',32);state.selection.delete(items[1].id);`);
 assert.throws(()=>a.run('applyComponentBatchParamChange(batch)'),/เลือก/);assert.equal(a.run('serialize()'),before);
 a.run('state.selection.add(items[1].id);items[0].label="changed";const changed=serialize();');
 assert.throws(()=>a.run('applyComponentBatchParamChange(batch)'),/เปลี่ยน/);assert.equal(a.run('serialize()'),a.run('changed'));
});
test('bulk I/O widths retain unique names and parent connections',()=>{
 const a=setup('IN',[{name:'a',width:8},{name:'b',width:16}]);a.run(`const parent=blankSchematic(uid('sch'),'parent');state.project.schematics[parent.id]=parent;
 const block={id:uid('c'),type:'SCH:'+sch.id,x:0,y:0,params:{}};parent.components.push(block);
 const source={id:uid('c'),type:'IN',x:0,y:100,params:{name:'src',width:8}};parent.components.push(source);
 parent.wires.push({id:uid('w'),from:{cid:source.id,pid:'o'},to:{cid:block.id,pid:'a'},name:'parent_bus'});snapshot();`);
 const wires=a.json('parent.wires');a.run(`requestComponentBatchParamChange(sch,items,'width',64)`);
 assert.ok(a.run('state.pendingParamChange'));a.run('applyComponentBatchParamChange(state.pendingParamChange)');
 assert.deepEqual(a.json('items.map(c=>c.params.name)'),['a','b']);assert.deepEqual(a.json('parent.wires'),wires);
 assert.equal(a.run('getPort(block,"a").width'),64);assert.equal(a.run('getPort(block,"b").width'),64);
 assert.doesNotMatch(a.run('componentParamFields(items[0],items)'),/data-pk="name"/);
 assert.throws(()=>a.run(`planComponentBatchParamChange(sch,items,'name','same')`),/พร้อมกันไม่ได้/);
});
test('VHDL generics validate against every instance before applying and retain the module source',()=>{
 const a=loadApp();a.ctx.source=`library ieee;use ieee.std_logic_1164.all;
 entity grouped is generic(WIDTH:positive:=8;LIMIT:natural range 0 to WIDTH:=4);port(d:in std_logic;q:out std_logic);end;
 architecture rtl of grouped is begin q<=d;end;`;
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([{vhdl:source}]));const sch=activeSch(),items=[8,4].map(w=>comp(addComp('CUSTOM:grouped',0,0,{generic_WIDTH:w,generic_LIMIT:4})));
 state.selection=new Set(items.map(c=>c.id));snapshot();`);const before=a.run('serialize()');
 assert.throws(()=>a.run(`requestComponentBatchParamChange(sch,items,'generic_LIMIT',6)`),/LIMIT/);assert.equal(a.run('serialize()'),before);
 a.run(`requestComponentBatchParamChange(sch,items,'generic_LIMIT',3)`);assert.deepEqual(a.json('items.map(c=>c.params.generic_LIMIT)'),[3,3]);
 assert.deepEqual(a.json('items.map(c=>c.params.generic_WIDTH)'),[8,4]);assert.equal(a.run('state.project.customs.grouped.vhdl'),a.ctx.source);
});
test('mixed CONST values remain empty without an error, and truncation uses the existing confirmation',()=>{
 const a=setup('CONST',[{width:8,value:'FF'},{width:8,value:'0F'}]);assert.match(a.run('componentParamFields(items[0],items)'),/data-const-value[^>]*data-mixed="true"/);
 const idx=a.run('state.history.idx');a.run(`requestComponentBatchParamChange(sch,items,'width',4)`);assert.ok(a.run('state.pendingParamChange'));
 a.run('applyComponentBatchParamChange(state.pendingParamChange)');assert.deepEqual(a.json('items.map(c=>c.params.value)'),['F','F']);assert.equal(a.run('state.history.idx'),idx+1);
 const fields=new Map();a.ctx.root={querySelector:s=>{
  if(!fields.has(s))fields.set(s,{value:s==='[data-const-base]'?'hex':'',dataset:{mixed:'true'},textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return fields.get(s);
 }};a.run('bindConstEntry(root,items[0],()=>{})');assert.equal(fields.get('[data-const-feedback]').textContent,'');
});
test('Bus Tap mode failures and ranges are validated for the entire batch',()=>{
 const a=setup('BUSTAP',[{mode:'merge'},{mode:'merge'}]);a.run(`const input=addComp('IN',600,100,{name:'src'});
 sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:items[1].id,pid:'y'},name:''});state.selection=new Set(items.map(c=>c.id));snapshot();`);
 const before=a.run('serialize()');assert.throws(()=>a.run(`requestComponentBatchParamChange(sch,items,'mode','split')`),/ทิศเดียวกัน/);assert.equal(a.run('serialize()'),before);
 assert.throws(()=>a.run(`requestComponentBatchParamChange(sch,items,'range',{bit:63,nbit:2})`),/ช่วง/);assert.equal(a.run('serialize()'),before);
});
test('a no-op adds no history and changing the selected device types cancels a pending group edit',()=>{
 const a=setup('DFF',[{enable:true},{enable:true}]),idx=a.run('state.history.idx');
 assert.equal(a.run(`requestComponentBatchParamChange(sch,items,'enable',true)`),false);assert.equal(a.run('state.history.idx'),idx);
 a.run(`const source=addComp('IN',0,0,{name:'enable'});sch.wires.push({id:uid('w'),from:{cid:source,pid:'o'},to:{cid:items[0].id,pid:'en'},name:''});
 state.selection=new Set(items.map(c=>c.id));requestComponentBatchParamChange(sch,items,'enable',false);state.selection.add(source);renderInspectorContents();`);
 assert.equal(a.run('state.pendingParamChange'),null);assert.deepEqual(a.json('items.map(c=>c.params.enable)'),[true,true]);
});
