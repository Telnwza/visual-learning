const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const widths=[1,5,12,16,31,32,33,53,54,63,64];
test('Decimal/Hex/Binary conversion preserves all bits including unsigned 64-bit maximum',()=>{
 const a=loadApp();for(const width of widths){
  const max=(1n<<BigInt(width))-1n;
  for(const [base,value] of [['hex',max.toString(16)],['decimal',max.toString(10)],['binary',max.toString(2)]]){
   a.ctx.input=value;a.ctx.base=base;a.ctx.width=width;const actual=a.json('parseConstEntry(input,base,width)');
   assert.equal(actual.decimal,max.toString());assert.equal(BigInt('0x'+actual.hex),max);assert.equal(actual.binary,'1'.repeat(width));assert.equal(actual.overflow,false);
  }
 }
});
test('constant overflow is explicit and invalid formats never silently strip characters',()=>{
 const a=loadApp();for(const [base,raw] of [['decimal','18446744073709551616'],['hex','10000000000000000'],['binary','1'+'0'.repeat(64)]]){
  a.ctx.base=base;a.ctx.raw=raw;assert.equal(a.run('parseConstEntry(raw,base,64).overflow'),true);
 }
 for(const [base,raw] of [['hex','ZZ'],['binary','102'],['binary','0xFF'],['decimal','-1'],['decimal','1.5'],['decimal','1e3'],['decimal',''],['decimal','1_000']]){
  a.ctx.base=base;a.ctx.raw=raw;assert.throws(()=>a.run('parseConstEntry(raw,base,64)'));
 }
 assert.equal(a.run('parseConstEntry("0xf4","hex",8).decimal'),'244');
 assert.equal(a.run('parseConstEntry("0b11110100","binary",8).hex'),'F4');
});
test('changing presentation base preserves the value; stored JSON remains hex with legacy defaults',()=>{
 const a=loadApp();a.run(`const p={value:parseConstEntry('18446744073709551615','decimal',64).hex,width:64};
 const id=addComp('CONST',0,0,p);const k=comp(id);`);
 assert.equal(a.run('k.params.value'),'FFFFFFFFFFFFFFFF');
 assert.equal(a.run('constBits(k.params)'),'1'.repeat(64));
 assert.equal(a.run('parseConstEntry(constEntryText(parseConstEntry(k.params.value,"hex",64),"binary"),"binary",64).hex'),'FFFFFFFFFFFFFFFF');
 assert.doesNotMatch(a.run('serialize()'),/"base"|"decimal"|"binary"/);
 a.run(`const before=JSON.stringify(TYPES.CONST.defaultParams);const draft=makePlacementDraft('CONST',13,21);draft.params.width=64;`);
 assert.equal(a.run('JSON.stringify(TYPES.CONST.defaultParams)'),a.run('before'));assert.equal(a.run('TYPES.CONST.defaultParams.width'),8);
});
test('range parser defines descending high:low, full bus and single-bit mapping',()=>{
 const a=loadApp();assert.deepEqual(a.json('parseBusTapRange("[63:32]")'),{bit:32,nbit:32});
 assert.deepEqual(a.json('parseBusTapRange("63:0")'),{bit:0,nbit:64});
 assert.deepEqual(a.json('parseBusTapRange("7")'),{bit:7,nbit:1});
 assert.equal(a.run('busTapMapping({bit:32,nbit:32,mode:"split"})'),'bus[63:32] → y[31:0] · bus[32] → y[0]');
 assert.equal(a.run('busTapMapping({bit:32,nbit:32,mode:"merge"})'),'y[31:0] → bus[63:32] · y[0] → bus[32]');
 for(const input of ['32:63','64:0','-1','5:','3.5','[7','7]','[[]]','NaN']){
  a.ctx.input=input;assert.throws(()=>a.run('parseBusTapRange(input)'));
 }
 assert.throws(()=>a.run('parseBusTapRange("15:8",8)'));
});
function tapCircuit(){const a=loadApp();a.ctx.sourceText='format schematic-text 1\ncircuit tap_edit\ninput data[64]\noutput result[32]\npart t BUSTAP bit=0 nbit=32 mode=split\nconnect data -> t.d\nconnect t.y -> result';a.run(`importSchematicText(sourceText);
 const sch=activeSch(),tap=sch.components.find(c=>c.type==='BUSTAP');`);return a;}
test('range changes both parameters atomically, previews mapping and retains wires through Undo/Redo',()=>{
 const a=tapCircuit(),before=a.run('serialize()'),wires=a.json('sch.wires'),idx=a.run('state.history.idx');
 a.run('const plan=planComponentParamChange(sch,tap,"range",parseBusTapRange("63:32"))');
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
 assert.equal(a.run('plan.params.bit'),32);assert.equal(a.run('plan.params.nbit'),32);assert.equal(a.run('plan.removedWires.length'),0);
 a.run('applyComponentParamChange(sch,tap,plan)');assert.deepEqual(a.json('sch.wires'),wires);assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('activeSch().components.find(c=>c.type==="BUSTAP").params.bit'),32);
});
test('ranges respect attached source width even for scalar or upper-bound slices',()=>{
 const a=tapCircuit();a.run(`const input=sch.components.find(c=>c.type==='IN');input.params.width=8;tap.params.nbit=1;`);
 assert.equal(a.run('busTapRangeWidth(tap)'),8);assert.throws(()=>a.run('planComponentParamChange(sch,tap,"range",{bit:8,nbit:1})'));
 a.run('input.params.width=1');assert.equal(a.run('busTapRangeWidth(tap)'),1);assert.throws(()=>a.run('planComponentParamChange(sch,tap,"range",{bit:1,nbit:1})'));
});
function groupCircuit(count=4,width=1){
 const a=loadApp();a.ctx.count=count;a.ctx.width=width;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params={},x=0,y=0){const c={id:uid('c'),type,params,x,y};sch.components.push(c);return c;}
 const src=c('IN',{name:'source',width},0,0),other=c('IN',{name:'other',width},0,300);
 const dest=Array.from({length:count},(_,i)=>c('OUT',{name:'result'+i,width},400,i*70));
 const ids=dest.map(c=>c.id),source={cid:src.id,pid:'o'};snapshot();`);return a;
}
for(const width of [1,32,64])test(`group connection to 64 ${width}-bit ports previews without mutation and has one Undo`,()=>{
 const a=groupCircuit(64,width),before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN');
 a.run('const plan=planGroupPortConnection(sch,ids,"i",source)');
 assert.equal(a.run('plan.targets.filter(t=>t.kind==="accept").length'),64);
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 assert.equal(a.run('applyGroupPortConnection(plan)'),64);assert.equal(a.run('state.history.idx'),idx+1);
 assert.equal(a.run('sch.wires.filter(w=>w.from.cid===src.id).length'),1);
 assert.ok(a.run('dest.every(c=>{const w=sch.wires.find(w=>w.to.cid===c.id);return netDriverPort(sch,w).cid===src.id;})'));
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('group mapping uses exact chosen port ids and does not guess similar labels',()=>{
 const a=groupCircuit();a.run(`const ff=c('DFF',{enable:true});const fake=c('OUT',{name:'clk'});
 const choices=groupPortChoices(sch,[ff.id,fake.id]);const plan=planGroupPortConnection(sch,[ff.id,fake.id],'clk',source);`);
 assert.deepEqual(a.json('choices.map(p=>p.id)'),['d','clk','en','i']);
 assert.equal(a.run('plan.targets[0].kind'),'accept');assert.equal(a.run('plan.targets[1].kind'),'skip');
 assert.equal(a.run('plan.targets[1].reason'),'ไม่มีขา clk');
});
test('group skips same-net, occupied, wrong-width and missing targets without altering their wires',()=>{
 const a=groupCircuit();a.run(`sch.wires.push({id:uid('w'),from:source,to:{cid:dest[0].id,pid:'i'},pts:[{x:220,y:22}],name:'keep'},
 {id:uid('w'),from:{cid:other.id,pid:'o'},to:{cid:dest[1].id,pid:'i'},name:'other_keep'});
 dest[2].params.width=32;dest[3].type='IN';snapshot();const plan=planGroupPortConnection(sch,ids,'i',source);`);
 const before=a.run('serialize()'),idx=a.run('state.history.idx');
 assert.deepEqual(a.json('plan.targets.map(t=>t.kind)'),['same','skip','skip','skip']);
 assert.equal(a.run('applyGroupPortConnection(plan)'),0);assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);
});
test('group release revalidates deleted/newly occupied targets and stale sheet contexts',()=>{
 const a=groupCircuit();a.run(`const plan=planGroupPortConnection(sch,ids,'i',source);sch.components=sch.components.filter(c=>c!==dest[0]);
 sch.wires.push({id:uid('w'),from:{cid:other.id,pid:'o'},to:{cid:dest[1].id,pid:'i'}});`);
 assert.equal(a.run('applyGroupPortConnection(plan)'),2);
 assert.equal(a.run('planGroupPortConnection(sch,[dest[0].id],"i",source).targets[0].kind'),'skip');
 a.run(`const second=blankSchematic(uid('sch'),'second');state.project.schematics[second.id]=second;state.activeId=second.id;`);
 assert.equal(a.run('applyGroupPortConnection(plan)'),0);
});
test('group connections preserve unrelated routes, locked positions and a chosen wire anchor',()=>{
 for(const locked of [false,true]){
  const a=groupCircuit();a.ctx.locked=locked;
  a.run(`sch.locked=locked;
   const old={id:uid('w'),from:source,to:{cid:dest[0].id,pid:'i'},name:'source_keep',pts:[{x:200,y:11},{x:200,y:44},{x:300,y:44},{x:300,y:11}]};
   const untouched={id:uid('w'),from:{cid:other.id,pid:'o'},to:{cid:dest[1].id,pid:'i'},name:'other_keep',pts:[{x:180,y:311},{x:180,y:81}]};
   sch.wires.push(old,untouched);const saved=JSON.stringify(untouched),positions=JSON.stringify(sch.components);
   const anchor=nearestOnWire(old,{x:240,y:44},0,sch);const plan=planGroupPortConnection(sch,ids.slice(2),'i',source);plan.anchor=anchor;
   applyGroupPortConnection(plan);`);
  assert.equal(a.run('JSON.stringify(sch.wires.find(w=>w.id===untouched.id))'),a.run('saved'));
  assert.equal(a.run('JSON.stringify(sch.components.filter(c=>c.type!=="JUNCTION"))'),a.run('positions'));
  assert.ok(a.run(`sch.components.some(c=>c.type==='JUNCTION'&&c.params.fixed&&Math.hypot(portPos(c,'j').x-anchor.x,portPos(c,'j').y-anchor.y)<1)`));
  assert.ok(a.run('sch.wires.some(w=>w.name==="source_keep")'));
  assert.ok(a.run(`dest.slice(2).every(c=>netDriverPort(sch,sch.wires.find(w=>w.to.cid===c.id)).cid===src.id)`));
 }
});
test('placement drafts cover existing primitives and never alter defaults, model or ids',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN');
 for(const type of a.json('Object.keys(TYPES)')){
  a.ctx.type=type;a.run('const d'+type+'=makePlacementDraft(type,13,21)');
  assert.doesNotThrow(()=>a.run('validatePlacementParams(type,d'+type+'.params)'),type);
  assert.equal(a.run('d'+type+'.x'),11);assert.equal(a.run('d'+type+'.y'),22);
 }
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
});
test('configured placement keeps chosen widths and unique I/O names, with one-step Undo',()=>{
 const a=loadApp();a.run(`const sch=activeSch();addComp('IN',0,0,{name:'a',width:1});const before=serialize();const idx=state.history.idx;
 const id=addComp('IN',50,80,{name:'a',width:64});const pin=comp(id);`);
 assert.equal(a.run('pin.params.width'),64);assert.equal(a.run('pin.params.name'),'a_1');assert.equal(a.run('state.history.idx'),a.run('idx')+1);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('before'));
 assert.throws(()=>a.run('addComp("CONST",0,0,{value:"100",width:8})'));
 assert.equal(a.run('serialize()'),a.run('before'));
});
test('palette searches primitives and reusable circuits while excluding recursive/top blocks',()=>{
 const a=loadApp();a.run(`const sch=activeSch(),child=blankSchematic(uid('sch'),'my_buffer');
 child.components=[{id:uid('c'),type:'IN',x:0,y:0,params:{name:'data',width:64}},{id:uid('c'),type:'OUT',x:200,y:0,params:{name:'result',width:64}}];
 state.project.schematics[child.id]=child;`);
 assert.deepEqual(a.json('paletteEntries("mux").map(e=>e.type)'),['MUX','DEMUX']);
 assert.deepEqual(a.json('paletteEntries("my_buffer").map(e=>e.type)'),['SCH:'+a.run('child.id')]);
 assert.ok(!a.json('paletteEntries().map(e=>e.type)').includes('SCH:'+a.run('state.project.topId')));
 a.run(`child.components.push({id:uid('c'),type:'SCH:'+sch.id,x:100,y:100,params:{}})`);
 assert.deepEqual(a.json('paletteEntries("my_buffer")'),[]);
});
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
function simulate(a,signals,maps,exercise){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'editor-usability-'));
 try{
  const r=a.json('generateSchVhdl(activeSch())');assert.deepEqual(r.fallbacks,[]);
  fs.writeFileSync(path.join(dir,'design.vhd'),r.code+`\nlibrary ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
 entity tb is end;architecture sim of tb is ${signals} begin u:entity work.${a.run('sanId(activeSch().name)')} port map(${maps});
 process begin ${exercise} wait;end process;end;`);
  execFileSync('ghdl',['-a','--std=08','design.vhd'],{cwd:dir,stdio:'pipe'});execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=20ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('GHDL simulates the edited high-bus range and exact decimal constant',{skip:!hasGhdl},()=>{
 const a=tapCircuit();a.run(`applyComponentParamChange(sch,tap,planComponentParamChange(sch,tap,'range',{bit:32,nbit:32}));
 const k=addComp('CONST',0,300,{width:64,value:parseConstEntry('18446744073709551615','decimal',64).hex});
 const out=addComp('OUT',400,300,{name:'maximum',width:64});sch.wires.push({id:uid('w'),from:{cid:k,pid:'o'},to:{cid:out,pid:'i'}});`);
 simulate(a,'signal result:std_logic_vector(31 downto 0);signal maximum:std_logic_vector(63 downto 0);',
 'data=>x"8000000100000002",result=>result,maximum=>maximum',`wait for 1 ns;assert result=x"80000001" and maximum=x"FFFFFFFFFFFFFFFF" severity failure;`);
});
test('GHDL simulates 32 enabled flip-flops connected by exact group clock/data/enable ports',{skip:!hasGhdl},()=>{
 const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 const ff=Array.from({length:32},(_,i)=>comp(addComp('DFF',200,i*100,{edge:'rising',enable:true,reset:true,preset:false})));
 const ids=ff.map(c=>c.id);
 for(const [name,pid] of [['clk','clk'],['data_in','d'],['enable','en'],['rst','rst']]){
 const id=addComp('IN',0,0,{name,width:1});applyGroupPortConnection(planGroupPortConnection(sch,ids,pid,{cid:id,pid:'o'}));}
 ff.forEach((f,i)=>{const o=addComp('OUT',600,i*100,{name:'q'+i,width:1});sch.wires.push({id:uid('w'),from:{cid:f.id,pid:'q'},to:{cid:o,pid:'i'}});});`);
 simulate(a,"signal clk,rst,en,d:std_logic:='0';signal q:std_logic_vector(31 downto 0);",
 'clk=>clk,data_in=>d,enable=>en,rst=>rst,'+Array.from({length:32},(_,i)=>`q${i}=>q(${i})`).join(','),
 `rst<='1';wait for 1 ns;assert q=x"00000000" severity failure;rst<='0';d<='1';clk<='1';wait for 1 ns;assert q=x"00000000" severity failure;
 clk<='0';en<='1';wait for 1 ns;clk<='1';wait for 1 ns;assert q=x"FFFFFFFF" severity failure;en<='0';rst<='1';wait for 1 ns;assert q=x"00000000" severity failure;`);
});
