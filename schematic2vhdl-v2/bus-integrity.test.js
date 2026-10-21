const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');

test('merge bus with unwritten high bits is an error in Check, code and canvas',()=>{
  const a=loadApp();
  a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
    const lo={id:'lo',type:'IN',x:0,y:0,params:{name:'lo',width:4}};
    const j={id:'j',type:'JUNCTION',x:100,y:0,params:{}};
    const m={id:'m',type:'BUSTAP',x:100,y:50,params:{bit:0,nbit:4,mode:'merge',dir:'right'}};
    const out={id:'out',type:'OUT',x:200,y:0,params:{name:'result',width:8}};
    sch.components.push(lo,j,m,out);
    sch.wires.push(
      {id:'bit',from:{cid:'lo',pid:'o'},to:{cid:'m',pid:'y'}},
      {id:'tap',from:{cid:'j',pid:'j'},to:{cid:'m',pid:'d'}},
      {id:'bus',from:{cid:'j',pid:'j'},to:{cid:'out',pid:'i'}});`);
  assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&i.msg.includes('4, 5, 6, 7')));
  assert.ok(a.json('generateSchVhdl(activeSch()).warns').some(w=>w.includes('4, 5, 6, 7')));
  assert.match(a.run('wireCompletionMap(activeSch()).get("bus")'),/4, 5, 6, 7/);
});

test('changing tap from merge to split reverses its attached wire without changing geometry',()=>{
  const a=loadApp();
  a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
    const input={id:'input',type:'IN',x:0,y:0,params:{name:'data',width:8}};
    const source={id:'source',type:'BUSTAP',x:100,y:0,params:{bit:0,nbit:4,mode:'merge',dir:'right'}};
    const dest={id:'dest',type:'BUSTAP',x:200,y:0,params:{bit:4,nbit:4,mode:'merge',dir:'left'}};
    sch.components.push(input,source,dest);
    sch.wires.push(
      {id:'bus',from:{cid:'input',pid:'o'},to:{cid:'source',pid:'d'}},
      {id:'pair',from:{cid:'dest',pid:'y'},to:{cid:'source',pid:'y'},pts:[{x:120,y:10},{x:180,y:10}]});`);
  assert.equal(a.run('setBusTapMode(sch,source,"split")'),true);
  assert.deepEqual(a.json('sch.wires.find(w=>w.id==="pair").from'),{cid:'source',pid:'y'});
  assert.deepEqual(a.json('sch.wires.find(w=>w.id==="pair").pts'),[{x:180,y:10},{x:120,y:10}]);
  assert.equal(a.run('source.params.mode'),'split');
  assert.equal(a.run('wireCompletionMap(sch).has("pair")'),false);
});

test('mode change refuses a same-direction endpoint and leaves saved topology intact',()=>{
  const a=loadApp();
  a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
    const input={id:'input',type:'IN',x:0,y:0,params:{name:'data',width:4}};
    const tap={id:'tap',type:'BUSTAP',x:100,y:0,params:{bit:0,nbit:4,mode:'merge',dir:'right'}};
    sch.components.push(input,tap);
    sch.wires.push({id:'bit',from:{cid:'input',pid:'o'},to:{cid:'tap',pid:'y'}});`);
  assert.equal(a.run('setBusTapMode(sch,tap,"split")'),false);
  assert.equal(a.run('tap.params.mode'),'merge');
  assert.deepEqual(a.json('sch.wires[0].to'),{cid:'tap',pid:'y'});
});

test('Check and canvas flag a stale merge-to-merge wire even when it looks connected',()=>{
  const a=loadApp();
  a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
    const l={id:'l',type:'BUSTAP',x:0,y:0,params:{bit:0,nbit:4,mode:'merge',dir:'right'}};
    const r={id:'r',type:'BUSTAP',x:100,y:0,params:{bit:4,nbit:4,mode:'merge',dir:'left'}};
    sch.components.push(l,r);
    sch.wires.push({id:'bad',from:{cid:'l',pid:'y'},to:{cid:'r',pid:'y'}});`);
  assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&i.msg.includes('ทิศทางขาไม่ถูกต้อง')));
  assert.match(a.run('wireCompletionMap(sch).get("bad")'),/ทิศทางสาย/);
});
