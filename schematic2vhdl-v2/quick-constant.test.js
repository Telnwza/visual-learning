const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
function setup(widths=[1,7,64,1]){
 const a=loadApp();a.ctx.widths=widths;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params,x,y){const n={id:uid('c'),type,params:{...TYPES[type].defaultParams,...params},x,y,label:''};sch.components.push(n);return n;}
 const dest=widths.map((width,i)=>c('OUT',{name:'result'+i,width},440,66+i*110));
 const ep=n=>({cid:n.id,pid:'i'});snapshot();setTool('const1',true);`);return a;
}
function driver(a,index){return a.json(`(()=>{const w=activeSch().wires.find(w=>w.to.cid===dest[${index}].id);return comp(w.from.cid);})()`);}
for(const value of [0,1])test(`clicking multiple inputs with CONST ${value} keeps the tool armed and infers each width`,()=>{
 const a=setup([1,2,4,7,32,64]);a.ctx.value=value;
 const history=a.run('state.history.idx'),positions=a.json('dest.map(c=>[c.x,c.y])');
 a.run(`setTool('const'+value,true);for(const n of dest){beginQuickConstantSweep(portPos(n,'i'));endQuickConstantSweep();}`);
 assert.equal(a.run('state.tool'),'const'+value);assert.equal(a.run('state.history.idx'),history+6);
 for(let i=0;i<6;i++){
  const k=driver(a,i);assert.equal(k.type,'CONST');assert.equal(k.params.width,[1,2,4,7,32,64][i]);assert.equal(k.params.value,String(value));
 }
 assert.deepEqual(a.json('dest.map(c=>[c.x,c.y])'),positions);
 assert.deepEqual(a.json('generateSchVhdl(sch).fallbacks'),[]);
});
test('sweep preview and cancellation allocate no IDs, edit no project data and are never serialized',()=>{
 const a=setup(),before=a.run('serialize()'),history=a.run('state.history.idx'),uid=a.run('_uidN');
 a.run(`beginQuickConstantSweep(portPos(dest[0],'i'));updateQuickConstantSweep(portPos(dest[3],'i'));updateQuickConstantSweep(portPos(dest[0],'i'));`);
 assert.equal(a.run('state.constantSweep.targets.size'),4);assert.equal(a.run('serialize()'),before);
 assert.equal(a.run('_uidN'),uid);assert.equal(a.run('state.history.idx'),history);
 assert.doesNotMatch(a.run('serialize()'),/constantSweep|"targets"|"points"/);
 a.run('cancelQuickConstantSweep()');assert.equal(a.run('state.constantSweep'),null);assert.equal(a.run('serialize()'),before);
});
test('one sweep creates all free inputs with one Undo/Redo while preserving occupied pins and their wires',()=>{
 const a=setup();a.run(`const source=c('IN',{name:'existing'},44,440),old={id:uid('w'),from:{cid:source.id,pid:'o'},to:ep(dest[3]),name:'keep',pts:[{x:300,y:462}]};sch.wires.push(old);snapshot();`);
 const before=a.run('serialize()'),history=a.run('state.history.idx'),old=a.json('old');
 a.run(`beginQuickConstantSweep(portPos(dest[0],'i'));updateQuickConstantSweep(portPos(dest[3],'i'));`);
 assert.equal(a.run('endQuickConstantSweep()'),3);assert.equal(a.run('state.history.idx'),history+1);
 assert.deepEqual(a.json('sch.wires.find(w=>w.id===old.id)'),old);
 assert.deepEqual([0,1,2].map(i=>driver(a,i).params.width),[1,7,64]);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('outputs, junctions, bus-side tap pins and occupied input pins are no-ops',()=>{
 const a=setup();a.run(`const source=c('IN',{name:'source'},44,44),j=c('JUNCTION',{},300,300),tap=c('BUSTAP',{},600,600);
 sch.wires.push({id:uid('w'),from:{cid:j.id,pid:'j'},to:ep(dest[0]),name:''});snapshot();`);
 const before=a.run('serialize()'),history=a.run('state.history.idx'),uid=a.run('_uidN');
 assert.equal(a.run(`applyQuickConstants([ep(dest[0]),{cid:source.id,pid:'o'},{cid:j.id,pid:'j'},{cid:tap.id,pid:'d'},{cid:'missing',pid:'i'}],1)`),0);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),history);assert.equal(a.run('_uidN'),uid);
 assert.equal(a.run('applyQuickConstants([ep(dest[1]),ep(dest[1])],0)'),1);
});
test('release rechecks widths, deletions and newly connected pins before making any constants',()=>{
 const a=setup();a.run(`beginQuickConstantSweep(portPos(dest[0],'i'));updateQuickConstantSweep(portPos(dest[3],'i'));
 sch.components=sch.components.filter(c=>c!==dest[0]);dest[1].params.width=32;
 const source=c('IN',{name:'late_source',width:64},44,400);sch.wires.push({id:uid('w'),from:{cid:source.id,pid:'o'},to:ep(dest[2]),name:'late'});`);
 assert.equal(a.run('endQuickConstantSweep()'),2);assert.equal(driver(a,1).params.width,32);assert.equal(driver(a,3).params.width,1);
 assert.equal(a.run(`sch.wires.find(w=>w.to.cid===dest[2].id).from.cid`),a.run('source.id'));
});
test('rotation and mirroring place constants outside the symbol without moving existing components',()=>{
 const a=setup([]);
 for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
  a.ctx.rotation=rotation;a.ctx.mirror=mirror;
  a.run(`var f=c('DFF',{enable:true},1000,1000+sch.components.length*150);f.rot=rotation;f.mirror=mirror;var old=JSON.stringify(f);`);
  assert.equal(a.run(`applyQuickConstants([{cid:f.id,pid:'en'}],1)`),1);
  assert.equal(a.run('JSON.stringify(f)'),a.run('old'));
  assert.equal(a.run(`(()=>{const w=sch.wires.find(w=>w.to.cid===f.id),k=comp(w.from.cid),a=orientedComponentBounds(k),b=orientedComponentBounds(f);return a.maxX<=b.minX||a.minX>=b.maxX||a.maxY<=b.minY||a.minY>=b.maxY;})()`),true);
 }
});
test('locked sheets retain all existing symbols, orphan junctions and manual routes',()=>{
 const a=setup();a.run(`const source=c('IN',{name:'existing'},44,500),j=c('JUNCTION',{},800,600);
 const old={id:uid('w'),from:{cid:source.id,pid:'o'},to:ep(dest[3]),name:'manual',pts:[{x:250,y:522},{x:250,y:418}]};sch.wires.push(old);sch.locked=true;snapshot();
 const original=JSON.stringify(sch.components),route=JSON.stringify(old);`);
 assert.equal(a.run('applyQuickConstants([ep(dest[0]),ep(dest[1])],1)'),2);
 assert.equal(a.run('JSON.stringify(sch.components.filter(c=>c.type!=="CONST"))'),a.run('original'));
 assert.equal(a.run('JSON.stringify(sch.wires.find(w=>w.id===old.id))'),a.run('route'));
});
test('new constants avoid existing wire paths without rerouting those wires',()=>{
 const a=setup([1]);a.run(`const input=c('IN',{name:'untouched'},220,66),j=c('JUNCTION',{},410,82);
 const old={id:uid('w'),from:{cid:input.id,pid:'o'},to:{cid:j.id,pid:'j'},name:'keep'};sch.wires.push(old);
 const picture=JSON.stringify(old);`);
 assert.equal(a.run('applyQuickConstants([ep(dest[0])],1)'),1);
 assert.equal(a.run('JSON.stringify(sch.wires.find(w=>w.id===old.id))'),a.run('picture'));
 assert.equal(a.run(`(()=>{const k=sch.components.find(c=>c.type==='CONST'),b=orientedComponentBounds(k);return routeCutsBody(sch,old,[{id:k.id,x1:b.minX,y1:b.minY,x2:b.maxX,y2:b.maxY}]);})()`),false);
});
test('switching tool, sheet, placement mode and Undo discards pending gestures',()=>{
 const a=setup();a.run(`beginQuickConstantSweep(portPos(dest[0],'i'));setTool('wire',true);`);
 assert.equal(a.run('state.constantSweep'),null);
 a.run(`setTool('const0',true);beginQuickConstantSweep(portPos(dest[0],'i'));const second=blankSchematic(uid('sch'),'second');state.project.schematics[second.id]=second;openSchTab(second.id);`);
 assert.equal(a.run('state.constantSweep'),null);assert.equal(a.run('endQuickConstantSweep()'),0);
 a.run(`openSchTab(sch.id);beginQuickConstantSweep(portPos(dest[0],'i'));enterPlacementMode();setTool('const1',true);`);
 assert.equal(a.run('state.tool'),'select');assert.equal(a.run('applyQuickConstants([ep(dest[0])],1)'),0);
 a.run(`cancelPlacement();setTool('const1',true);applyQuickConstants([ep(dest[0])],1);beginQuickConstantSweep(portPos(dest[1],'i'));undo();`);
 assert.equal(a.run('state.constantSweep'),null);
});
test('quick constants survive Save/Open and remain ordinary editable CONST components',()=>{
 const a=setup([64]);a.run('applyQuickConstants([ep(dest[0])],1)');const saved=a.run('serialize()');a.ctx.saved=saved;
 a.run('deserialize(saved)');assert.equal(driver(a,0).params.width,64);assert.equal(driver(a,0).params.value,'1');
 assert.doesNotMatch(saved,/_quick_constant_|constantSweep/);
 a.run(`const k=activeSch().components.find(c=>c.type==='CONST');requestComponentParamChange(activeSch(),k,'value','F');`);
 assert.equal(a.run('BigInt("0x"+k.params.value).toString()'),'15');
});
test('Alt+0/1 and numpad alternatives do not take over plain numbers or modified editor shortcuts',()=>{
 const a=loadApp();
 for(const [code,tool] of [['Digit0','const0'],['Numpad0','const0'],['Digit1','const1'],['Numpad1','const1']]){
  a.ctx.code=code;assert.equal(a.run('quickConstantShortcut({code,altKey:true})'),tool);
  for(const extra of [{},{altKey:true,ctrlKey:true},{altKey:true,metaKey:true},{altKey:true,shiftKey:true}]){a.ctx.extra=extra;assert.equal(a.run('quickConstantShortcut({code,...extra})'),null);}
 }
 assert.equal(a.run('NUMBER_TOOL_SHORTCUTS.Digit1'),'select');
});
test('generated VHDL drives numeric 0 and 1 for scalar, 7-bit and 64-bit inputs',t=>{
 try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
 const a=setup([1,7,64,1,7,64]);a.run('applyQuickConstants(dest.slice(0,3).map(ep),0);applyQuickConstants(dest.slice(3).map(ep),1)');
 assert.deepEqual(a.json('generateSchVhdl(sch).fallbacks'),[]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quick-constant-'));
 try{
  fs.writeFileSync(path.join(dir,'design.vhd'),a.run('generateSchVhdl(sch).code')+`\nlibrary ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
 entity tb is end;architecture test of tb is signal a,d:std_logic;signal b,e:std_logic_vector(6 downto 0);signal c,f:std_logic_vector(63 downto 0);begin
 dut:entity work.top port map(result0=>a,result1=>b,result2=>c,result3=>d,result4=>e,result5=>f);
 process begin wait for 1 ns;assert a='0' and unsigned(b)=0 and unsigned(c)=0 severity failure;
 assert d='1' and unsigned(e)=1 and unsigned(f)=1 severity failure;wait;end process;end;`);
  for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=5ns']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
