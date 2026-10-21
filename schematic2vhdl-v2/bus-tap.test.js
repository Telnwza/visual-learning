const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
function fixture(){const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
const x={id:uid('c'),type:'IN',x:110,y:110,params:{name:'data',width:16}},o={id:uid('c'),type:'OUT',x:660,y:110,params:{name:'result',width:16}};
sch.components.push(x,o);const w={id:uid('w'),from:{cid:x.id,pid:'o'},to:{cid:o.id,pid:'i'},name:''};sch.wires.push(w);snapshot();`);return a;}
test('range allocation respects full slices, direction and exhaustion',()=>{
 const a=loadApp();assert.equal(a.run('nextTapRange(16,4,4,"up",new Set([5,6,7]))'),8);
 assert.equal(a.run('nextTapRange(16,8,4,"down",new Set([9]))'),5);
 assert.equal(a.run('nextTapRange(8,8,1)'),null);assert.equal(a.run('nextTapRange(8,-1,1,"down")'),null);
});
test('split bus connects all ranges with one undo; next duplicate advances and ordinary duplicate keeps bits',()=>{
 const a=fixture();assert.equal(a.run('splitBusTaps(w,{nbit:4})'),4);
 assert.deepEqual(a.json('activeSch().components.filter(c=>c.type==="BUSTAP").map(c=>c.params.bit)'),[0,4,8,12]);
 assert.equal(a.run('activeSch().components.filter(c=>c.type==="BUSTAP").every(c=>wireWidth(busTapIncomingWire(c))===16)'),true);
 a.run('undo()');assert.equal(a.run('activeSch().components.length'),2);a.run('redo()');assert.equal(a.run('activeSch().components.filter(c=>c.type==="BUSTAP").length'),4);
 a.run(`const tap=activeSch().components.find(c=>c.type==='BUSTAP');state.selection=new Set([tap.id]);`);
 assert.equal(a.run('duplicateNextTap()'),false);
 a.run('duplicateSelection()');assert.equal(a.run('selectedTap().params.bit'),0);
});
test('next tap on attached net skips used slices, remains connected, and round trips',()=>{
 const a=fixture();a.run(`const tap={id:uid('c'),type:'BUSTAP',x:300,y:110,params:{bit:0,nbit:4,dir:'right',mode:'split'}};sch.components.push(tap);sch.wires.push({id:uid('w'),from:{...w.from},to:{cid:tap.id,pid:'d'},name:''});state.selection=new Set([tap.id]);snapshot();`);
 assert.equal(a.run('duplicateNextTap()'),true);assert.equal(a.run('selectedTap().params.bit'),4);assert.equal(a.run('wireWidth(busTapIncomingWire(selectedTap()))'),16);
 assert.equal(a.run('duplicateNextTap()'),true);assert.equal(a.run('selectedTap().params.bit'),8);
 a.ctx.saved=a.run('serialize()');a.run('deserialize(saved)');assert.deepEqual(a.json('activeSch().components.filter(c=>c.type==="BUSTAP").map(c=>c.params.bit)'),[0,4,8]);
});
test('used bits include parallel branches from the same real source port',()=>{
 const a=fixture();a.run(`const tap={id:uid('c'),type:'BUSTAP',x:300,y:110,params:{bit:0,nbit:4,dir:'right',mode:'split'}};sch.components.push(tap);sch.wires.push({id:uid('w'),from:{...w.from},to:{cid:tap.id,pid:'d'},name:''});`);
 assert.deepEqual(a.json('[...tappedBitsOnNet(w,sch)]'),[0,1,2,3]);
 assert.equal(a.run('nextTapRange(16,0,4,"up",tappedBitsOnNet(w,sch))'),4);
});
test('Check rejects overlapping merge slices but permits repeated split reads',()=>{
 const a=fixture();a.run(`for(let i=0;i<2;i++){const t={id:uid('c'),type:'BUSTAP',x:330,y:220+i*44,params:{bit:0,nbit:4,dir:'right',mode:'split'}};sch.components.push(t);sch.wires.push({id:uid('w'),from:{...w.from},to:{cid:t.id,pid:'d'},name:''});}`);
 assert.equal(a.run('runSynthesis().some(i=>i.msg.includes("multi-driver"))'),false);
 a.run('sch.components.filter(c=>c.type==="BUSTAP").forEach(c=>c.params.mode="merge")');
 assert.equal(a.run('runSynthesis().some(i=>i.msg.includes("เขียนบิต 0 ซ้อน"))'),true);
 assert.equal(a.run('runSynthesis().some(i=>i.msg.includes("ตัวขับทั้งบัส"))'),true);
});
