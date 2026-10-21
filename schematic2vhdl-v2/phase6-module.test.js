const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const base=path.join(__dirname,'../fpga-exam-kit/modules');
const groups=['timing','bus','lookup'];
const packs=groups.map(g=>JSON.parse(fs.readFileSync(path.join(base,'packs',g+'.sccomp.json'),'utf8')));
const definitions=Object.assign({},...packs.map(p=>p.customs));
let ghdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{ghdl=false;}
const pulse="wait for 1 ns;s_clk<='1';wait for 1 ns;s_clk<='0';wait for 1 ns;";
const lit=(n,w)=>w===1?`'${Number(BigInt(n)&1n)}'`:`"${BigInt(n).toString(2).padStart(w,'0')}"`;
const set=(p,n,w=1)=>`s_${p}<=${lit(n,w)};`;
const check=(p,n,w=1)=>`assert s_${p}=${lit(n,w)} report "${p} expected ${n}" severity failure;`;
function imported(){const a=loadApp();a.ctx.packs=packs;a.run('applyCustomPackages(packs)');return a;}
function fixture(name,params={}){
 const a=imported();a.ctx.name=name;a.ctx.params=params;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const id=addComp('CUSTOM:'+name,200,0,params);
 for(const p of getPorts(comp(id))){const io=addComp(p.dir==='in'?'IN':'OUT',p.dir==='in'?0:600,sch.components.length*80,{name:p.id,width:p.width});
 sch.wires.push({id:uid('w'),from:p.dir==='in'?{cid:io,pid:'o'}:{cid:id,pid:p.id},to:p.dir==='in'?{cid:id,pid:p.id}:{cid:io,pid:'i'}});}`);
 return a;
}
function run(a,exercise,{synth=false,fail=false}={}){
 const ports=a.json('schPortList(activeSch())');
 const declarations=ports.map(p=>`signal s_${p.id}:${p.width===1?'std_logic':`std_logic_vector(${p.width-1} downto 0)`}${p.dir==='in'?` := ${p.width===1?"'0'":"(others=>'0')"}`:''};`).join('\n');
 const entity=a.run('sanId(activeSch().name)');
 const tb=`library ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${declarations} begin u:entity work.${entity} port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process begin wait for 1 ns;${exercise}wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phase6-module-'));
 try{
  fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+(synth?'':tb));
  const exec=args=>{try{return execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000}).toString();}catch(e){e.message+='\n'+e.stdout?.toString()+'\n'+e.stderr?.toString();throw e;}};
  exec(['-a','--std=08','bundle.vhd']);
  if(synth)return exec(['--synth','--std=08',entity]);
  exec(['-e','--std=08','tb']);
  if(fail){assert.throws(()=>exec(['-r','--std=08','tb','--assert-level=error','--stop-time=2000ns']),e=>/ROM entry does not fit/.test(e.stdout?.toString()));}
  else exec(['-r','--std=08','tb','--assert-level=error','--stop-time=2000ns']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const group of groups)for(const cc of Object.values(packs[groups.indexOf(group)].customs))test(`${cc.name}: independently importable package equals editable VHDL`,()=>{
 const a=loadApp(),before=a.run('serialize()'),individual=JSON.parse(fs.readFileSync(path.join(base,group,cc.name+'.sccomp.json'),'utf8'));
 assert.equal(fs.readFileSync(path.join(base,group,cc.fileName),'utf8'),cc.vhdl);assert.deepEqual(individual.customs[cc.name],cc);
 a.ctx.individual=individual;assert.equal(a.run('applyCustomPackages([individual])'),1);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.file={fileName:cc.fileName,vhdl:cc.vhdl};assert.deepEqual(a.json('parseVhdlModuleFile(file).ports'),cc.ports);
});
test('all Phase 6 packages import atomically with no preinstalled catalog; previews and invalid generics are pure',()=>{
 const a=loadApp(),before=a.run('serialize()');assert.equal(a.run('Object.keys(state.project.customs).length'),0);a.ctx.packs=packs;
 assert.equal(a.run('applyCustomPackages(packs)'),13);const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 const idx=a.run('state.history.idx');assert.throws(()=>a.run('applyCustomPackages(packs)'),/ชื่อซ้ำ/);const uid=a.run('_uidN');
 for(const name of Object.keys(definitions)){a.ctx.name=name;a.run("{const d=makePlacementDraft('CUSTOM:'+name,0,0);validatePlacementParams(d.type,d.params);getPorts(d);componentParamFields(d);}");}
 for(const [name,params]of [
 ['ss_counter',{generic_WIDTH:65}],['ss_counter_skip',{generic_SKIP_COUNT:5}],['ss_tick',{generic_DIVISOR:0}],['ss_clock_divider',{generic_DIVISOR:1}],
 ['ss_bus_slice',{generic_IN_WIDTH:8,generic_OUT_WIDTH:4,generic_LSB:5}],['ss_bus_concat',{generic_A_WIDTH:32,generic_B_WIDTH:33}],
 ['ss_bus_zero_extend',{generic_IN_WIDTH:32,generic_OUT_WIDTH:16}],['ss_bus_truncate',{generic_IN_WIDTH:8,generic_OUT_WIDTH:16}],
 ['ss_rom',{generic_ADDR_WIDTH:2,generic_ENTRY_COUNT:5}]]){a.ctx.name=name;a.ctx.params=params;assert.throws(()=>a.run("addComp('CUSTOM:'+name,0,0,params)"));}
 assert.equal(a.run('serialize()'),after);assert.equal(a.run('_uidN'),uid);assert.equal(a.run('state.history.idx'),idx);
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');assert.doesNotMatch(html,/entity ss_(?:counter|tick|timer|pwm|rom|bus)_?/);
});
test('instance generics, module notes and clock requirements survive save/load and ROM source replacement',()=>{
 const a=imported();a.run("const small=addComp('CUSTOM:ss_counter',0,0,{generic_WIDTH:1}),wide=addComp('CUSTOM:ss_counter',200,0,{generic_WIDTH:64});const rom=addComp('CUSTOM:ss_rom',0,200,{generic_CLOCKED:1});deserialize(serialize());");
 assert.equal(a.run('getPort(comp(small),"q").width'),1);assert.equal(a.run('getPort(comp(wide),"q").width'),64);
 assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("ss_rom",state.project.customs.ss_rom.vhdl.replace(\'0000000000000007\',\'000000000000000A\')));');
 assert.equal(a.run('state.project.customs.ss_rom.libraryId'),'ROM');assert.match(a.run('moduleUsageNotes(state.project.customs.ss_rom)'),/TABLE_DATA/);
 assert.equal(a.run('moduleRequiresClock(state.project.customs.ss_rom,comp(rom).params)'),true);
 assert.equal(a.run('moduleRequiresClock(state.project.customs.ss_rom,{generic_CLOCKED:0})'),false);
 assert.match(a.run('componentParamFields(comp(small))'),/Wrap to start/);
});
test('timing inputs use explicit defaults and require a clock; combinational ROM does not require a clock',()=>{
 const a=imported();a.run("const sch=activeSch(),clk=addComp('IN',0,0,{name:'clk'}),tick=addComp('CUSTOM:ss_tick',200,0,{generic_DIVISOR:3}),out=addComp('OUT',500,0,{name:'event'});sch.wires.push({id:uid('w'),from:{cid:clk,pid:'o'},to:{cid:tick,pid:'clk'}},{id:uid('w'),from:{cid:tick,pid:'tick'},to:{cid:out,pid:'i'}});");
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err"||i.lvl==="warn")'),[]);
 const b=fixture('ss_rom');b.run("const c=comp(id);activeSch().wires=activeSch().wires.filter(w=>w.to.cid!==id||w.to.pid!=='clk');");
 assert.ok(!b.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 b.run('c.params.generic_CLOCKED=1');assert.ok(b.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
});
for(const width of [1,8,64])for(const wrap of [0,1])test(`GHDL counter WIDTH=${width}, WRAP=${wrap}: unsigned bounds, direction, priority and invalid range`,{skip:!ghdl},()=>{
 const a=fixture('ss_counter',{generic_WIDTH:width,generic_WRAP:wrap}),max=(1n<<BigInt(width))-1n,lo=width===1?0n:max-2n;
 let ex=set('minimum',lo,width)+set('maximum',max,width)+set('en',0)+set('load',1)+set('load_value',0,width)+set('rst',1)+pulse+check('q',lo,width)+check('valid',1);
 ex+=set('rst',0)+set('load_value',max,width)+pulse+check('q',max,width)+check('terminal',1)+set('load',0)+pulse+check('q',max,width);
 ex+=set('en',1)+pulse+check('q',wrap?lo:max,width)+check('wrapped',wrap)+set('en',0)+pulse+check('wrapped',0);
 ex+=set('down',1)+set('rst',1)+pulse+check('q',max,width)+set('rst',0)+set('load',1)+set('load_value',0,width)+pulse+check('q',lo,width)+check('terminal',1)+set('load',0)+set('en',1)+pulse+check('q',wrap?max:lo,width)+check('wrapped',wrap);
 ex+=set('minimum',max,width)+set('maximum',0,width)+'wait for 1 ns;'+check('valid',0)+set('load',1)+pulse+check('q',wrap?max:lo,width);
 ex+=set('load',0)+set('down',0)+set('minimum',1,width)+set('maximum',1,width)+pulse+check('q',1,width)+pulse+check('q',1,width)+check('wrapped',wrap);
 run(a,ex);
});
for(const down of [0,1])test(`GHDL skip counter excludes 3 and 7 when counting ${down?'down':'up'}`,{skip:!ghdl},()=>{
 const a=fixture('ss_counter_skip',{generic_SKIP_COUNT:2});let ex=set('maximum',9,8)+set('skip_0',3,8)+set('skip_1',7,8)+set('down',down)+set('en',1)+set('rst',1)+pulse+check('q',down?9:0,8)+set('rst',0);
 const expected=down?[8,6,5,4,2,1,0,9]:[1,2,4,5,6,8,9,0];for(const [i,n]of expected.entries())ex+=pulse+check('q',n,8)+check('valid',1)+check('blocked',0)+check('wrapped',i===7?1:0);
 ex+=set('en',0)+pulse+check('wrapped',0)+set('load',1)+set('load_value',7,8)+pulse+check('q',down?6:8,8);
 run(a,ex);
});
test('GHDL skip counter handles excluded endpoints, all-excluded range, invalid bounds and dynamic exclusions',{skip:!ghdl},()=>{
 const a=fixture('ss_counter_skip',{generic_SKIP_COUNT:4});let ex=set('maximum',3,8)+set('skip_0',0,8)+set('skip_1',1,8)+set('skip_2',2,8)+set('skip_3',3,8)+set('rst',1)+pulse+check('blocked',1)+check('valid',0)+set('rst',0)+set('en',1)+pulse+check('blocked',1)+check('wrapped',0);
 ex+=set('skip_3',8,8)+pulse+check('q',3,8)+check('blocked',0)+pulse+check('q',3,8)+check('wrapped',1);
 ex+=set('skip_0',9,8)+set('load',1)+set('load_value',0,8)+pulse+check('q',0,8)+set('load',0)+set('skip_0',0,8)+'wait for 1 ns;'+check('valid',0)+pulse+check('q',3,8);
 ex+=set('minimum',8,8)+pulse+check('q',3,8)+check('valid',0)+check('blocked',1)+set('rst',1)+pulse+check('q',8,8)+check('blocked',1);
 run(a,ex);
});
for(const down of [0,1])test(`GHDL skip stop mode never enters excluded terminal (${down})`,{skip:!ghdl},()=>{
 const a=fixture('ss_counter_skip',{generic_SKIP_COUNT:2,generic_WRAP:0});let ex=set('minimum',2,8)+set('maximum',5,8)+set('skip_0',2,8)+set('skip_1',5,8)+set('down',down)+set('en',1)+set('rst',1)+pulse+check('q',down?4:3,8)+set('rst',0)+pulse+check('q',down?3:4,8)+pulse+check('q',down?3:4,8)+check('blocked',1)+check('wrapped',0);
 run(a,ex);
});
test('GHDL skip counter retains exact 64-bit exclusions, duplicate/outside values and zero-exclusion mode',{skip:!ghdl},()=>{
 const max=(1n<<64n)-1n,a=fixture('ss_counter_skip',{generic_WIDTH:64,generic_SKIP_COUNT:4});
 run(a,set('minimum',max-3n,64)+set('maximum',max,64)+set('skip_0',max-2n,64)+set('skip_1',max-2n,64)+set('skip_2',0,64)+set('skip_3',1,64)+set('en',1)+set('rst',1)+pulse+check('q',max-3n,64)+set('rst',0)+pulse+check('q',max-1n,64)+pulse+check('q',max,64)+pulse+check('q',max-3n,64)+check('wrapped',1));
 const b=fixture('ss_counter_skip',{generic_WIDTH:1,generic_SKIP_COUNT:0});run(b,set('maximum',1)+set('en',1)+set('rst',1)+pulse+check('q',0)+set('rst',0)+pulse+check('q',1)+pulse+check('q',0)+check('wrapped',1));
});
for(const divisor of [1,2,5])test(`GHDL tick DIVISOR=${divisor}: exact interval, pause and reset`,{skip:!ghdl},()=>{
 const a=fixture('ss_tick',{generic_DIVISOR:divisor});let ex=set('en',1)+set('rst',1)+pulse+check('tick',0)+set('rst',0);
 for(let i=1;i<=divisor*2;i++){ex+=pulse+check('tick',i%divisor===0?1:0);if(i===1)ex+=set('en',0)+pulse+check('tick',0)+set('en',1);}
 ex+=set('rst',1)+pulse+check('tick',0);run(a,ex);
});
for(const divisor of [2,3,5])test(`GHDL divider DIVISOR=${divisor}: low/high lengths, tick, paused phase`,{skip:!ghdl},()=>{
 const a=fixture('ss_clock_divider',{generic_DIVISOR:divisor});let ex=set('en',1)+set('rst',1)+pulse+check('clk_out',0)+set('rst',0);
 for(let i=1;i<=divisor*2;i++){const phase=i%divisor,level=phase>=Math.ceil(divisor/2)?1:0;ex+=pulse+check('clk_out',level)+check('tick',phase===0?1:0);if(i===Math.ceil(divisor/2))ex+=set('en',0)+pulse+check('clk_out',1)+check('tick',0)+set('en',1);}
 ex+=set('en',0)+set('rst',1)+pulse+check('clk_out',0)+check('tick',0);run(a,ex);
});
for(const retrigger of [0,1])test(`GHDL timer RETRIGGER=${retrigger}: duration edges, pauses, cancel, zero, pulse/one-clock done`,{skip:!ghdl},()=>{
 const a=fixture('ss_timer',{generic_WIDTH:8,generic_RETRIGGER:retrigger});let ex=set('en',1)+set('duration',3,8)+set('start',1)+pulse+check('remaining',3,8)+check('busy',1)+check('pulse',1)+check('done',0)+set('start',0)+pulse+check('remaining',2,8);
 ex+=set('en',0)+pulse+check('remaining',2,8)+check('pulse',1)+set('start',1)+set('duration',4,8)+pulse+check('remaining',retrigger?4:2,8)+set('start',0)+set('en',1);
 const remaining=retrigger?4:2;for(let i=remaining-1;i>=0;i--)ex+=pulse+check('remaining',i,8)+check('done',i===0?1:0)+check('busy',i===0?0:1);
 ex+=set('en',0)+pulse+check('done',0)+set('duration',0,8)+set('start',1)+pulse+check('done',1)+check('pulse',0)+set('cancel',1)+set('duration',4,8)+pulse+check('remaining',0,8)+check('done',0)+set('cancel',0)+set('rst',1)+pulse+check('busy',0)+check('done',0);
 run(a,ex);
});
for(const width of [1,64])test(`GHDL timer duration bus WIDTH=${width} captures unsigned maximum without integer overflow`,{skip:!ghdl},()=>{
 const a=fixture('ss_timer',{generic_WIDTH:width}),max=(1n<<BigInt(width))-1n;run(a,set('duration',max,width)+set('start',1)+pulse+check('remaining',max,width)+set('start',0)+set('en',1)+pulse+check('remaining',max-1n,width)+check('done',width===1?1:0));
});
for(const low of [0,1])test(`GHDL PWM polarity=${low}: period, 0/100 percent, pause, update boundary and force load`,{skip:!ghdl},()=>{
 const a=fixture('ss_pwm',{generic_WIDTH:8,generic_ACTIVE_LOW:low}),out=active=>check('pwm',low?1-active:active);
 let ex=set('en',1)+set('period',5,8)+set('duty',2,8)+pulse+out(1)+check('valid',1)+pulse+out(1)+pulse+out(0)+set('duty',5,8)+pulse+out(0)+set('en',0)+'wait for 1 ns;'+out(0)+pulse+out(0)+set('en',1)+pulse+out(0)+pulse+out(1);
 for(let i=0;i<5;i++)ex+=pulse+out(1);
 ex+=set('load',1)+set('duty',0,8)+pulse+out(0)+set('duty',9,8)+pulse+out(1)+set('period',0,8)+pulse+out(0)+check('valid',0)+set('load',0)+set('period',1,8)+set('duty',1,8)+pulse+out(1)+pulse+out(1)+set('rst',1)+pulse+out(0)+check('valid',0);
 run(a,ex);
});
test('GHDL PWM WIDTH=64 captures maximum period/duty; WIDTH=1 handles period=1',{skip:!ghdl},()=>{
 for(const width of [1,64]){const a=fixture('ss_pwm',{generic_WIDTH:width}),max=(1n<<BigInt(width))-1n;run(a,set('period',max,width)+set('duty',max,width)+set('en',1)+pulse+check('pwm',1)+pulse+check('pwm',1)+check('valid',1));}
});
for(const width of [1,7,32,64])test(`GHDL bus reverse WIDTH=${width} maps every bit`,{skip:!ghdl},()=>{
 const a=fixture('ss_bus_reverse',{generic_WIDTH:width}),n=(0x123456789ABCDEFn&((1n<<BigInt(width))-1n)),reversed=BigInt('0b'+n.toString(2).padStart(width,'0').split('').reverse().join(''));
 run(a,set('d',n,width)+'wait for 1 ns;'+check('y',reversed,width));
});
test('GHDL bus slice, concat, zero/sign extension and truncation have exact 64-bit mappings',{skip:!ghdl},()=>{
 const n=0xFEDCBA9876543210n;
 run(fixture('ss_bus_slice',{generic_IN_WIDTH:64,generic_OUT_WIDTH:32,generic_LSB:16}),set('d',n,64)+'wait for 1 ns;'+check('y',0xBA987654n,32));
 run(fixture('ss_bus_concat',{generic_A_WIDTH:32,generic_B_WIDTH:32}),set('a',0xFEDCBA98n,32)+set('b',0x76543210n,32)+'wait for 1 ns;'+check('y',n,64));
 run(fixture('ss_bus_zero_extend',{generic_IN_WIDTH:8,generic_OUT_WIDTH:64}),set('d',0x80,8)+'wait for 1 ns;'+check('y',0x80,64));
 run(fixture('ss_bus_sign_extend',{generic_IN_WIDTH:8,generic_OUT_WIDTH:64}),set('d',0x80,8)+'wait for 1 ns;'+check('y',0xFFFFFFFFFFFFFF80n,64)+set('d',0x7F,8)+'wait for 1 ns;'+check('y',0x7F,64));
 run(fixture('ss_bus_truncate',{generic_IN_WIDTH:64,generic_OUT_WIDTH:8}),set('d',n,64)+'wait for 1 ns;'+check('y',0x10,8)+check('lost',1)+set('d',0xFF,64)+'wait for 1 ns;'+check('lost',0)+"s_d(63)<='X';wait for 1 ns;assert s_lost='X' severity failure;");
});
test('GHDL bus mappings accept equal widths and one-bit typed adapters',{skip:!ghdl},()=>{
 for(const name of ['ss_bus_slice','ss_bus_zero_extend','ss_bus_sign_extend','ss_bus_truncate'])run(fixture(name,{generic_IN_WIDTH:1,generic_OUT_WIDTH:1}),set('d',1)+'wait for 1 ns;'+check('y',1)+(name==='ss_bus_truncate'?check('lost',0):''));
 run(fixture('ss_bus_concat',{generic_A_WIDTH:1,generic_B_WIDTH:1}),set('a',1)+set('b',0)+'wait for 1 ns;'+check('y',2,2));
});
for(const clocked of [0,1])test(`GHDL ROM CLOCKED=${clocked}: addressing, invalid/unknown input, latency and reset`,{skip:!ghdl},()=>{
 const a=fixture('ss_rom',{generic_ENTRY_COUNT:5,generic_CLOCKED:clocked});let ex=set('addr',4,3)+(clocked?pulse:'wait for 1 ns;')+check('data',4,8)+check('valid',1)+set('addr',2,3)+'wait for 1 ns;';
 if(clocked)ex+=check('data',4,8)+pulse;ex+=check('data',2,8)+set('addr',5,3)+(clocked?pulse:'wait for 1 ns;')+check('data',0,8)+check('valid',0)+"s_addr<=\"0X0\";"+(clocked?pulse:'wait for 1 ns;')+check('data',0,8)+check('valid',0);
 if(clocked)ex+=set('addr',4,3)+set('rst',1)+pulse+check('data',0,8)+check('valid',0);run(a,ex);
});
test('GHDL editable ROM preserves a full 64-bit entry and rejects values too wide for DATA_WIDTH',{skip:!ghdl},()=>{
 const a=fixture('ss_rom',{generic_DATA_WIDTH:64});a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("ss_rom",state.project.customs.ss_rom.vhdl.replace(\'0000000000000007\',\'FEDCBA9876543210\')));');
 run(a,set('addr',7,3)+'wait for 1 ns;'+check('data',0xFEDCBA9876543210n,64));
 run(fixture('ss_rom',{generic_DATA_WIDTH:1}),'wait for 1 ns;',{fail:true});
});
test('Schematic Text composes tick and counter using one clock; generated bundle is synthesizable',{skip:!ghdl},()=>{
 const a=imported();a.ctx.text=`format schematic-text 1\ncircuit timed_count\ninput clk, rst\noutput result[8]\nuse "CUSTOM:ss_tick" as tick_module\nuse "CUSTOM:ss_counter" as count_module\npart tick @tick_module generic_DIVISOR=3\npart count @count_module generic_WIDTH=8\npart limit CONST value=9 width=8\nconnect clk -> tick.clk, count.clk\nconnect rst -> tick.rst, count.rst\nconnect tick.tick -> count.en\nconnect limit.o -> count.maximum\nconnect count.q -> result`;
 const before=a.run('serialize()');a.run('compileSchematicText(text)');assert.equal(a.run('serialize()'),before);a.run('importSchematicText(text)');const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.run('state.project.topId=state.activeId');
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 let ex=set('rst',1)+pulse+check('result',0,8)+set('rst',0);for(let i=1;i<=10;i++)ex+=pulse+check('result',Math.floor((i-1)/3),8);run(a,ex);assert.match(run(a,'',{synth:true}),/architecture/i);
});
for(const name of Object.keys(definitions))test(`GHDL synth exported ${name} with representative wide settings`,{skip:!ghdl},()=>{
 const params=name.startsWith('ss_counter')||name==='ss_timer'||name==='ss_pwm'||name==='ss_bus_reverse'?{generic_WIDTH:64}:
 name==='ss_tick'||name==='ss_clock_divider'?{generic_DIVISOR:5}:name==='ss_rom'?{generic_DATA_WIDTH:64,generic_CLOCKED:1}:
 name==='ss_bus_concat'?{generic_A_WIDTH:32,generic_B_WIDTH:32}:
 name==='ss_bus_zero_extend'||name==='ss_bus_sign_extend'?{generic_IN_WIDTH:32,generic_OUT_WIDTH:64}:{generic_IN_WIDTH:64,generic_OUT_WIDTH:32};
 if(name==='ss_counter_skip')params.generic_SKIP_COUNT=4;
 assert.match(run(fixture(name,params),'',{synth:true}),/architecture/i);
});
test('downloaded timed-counter example counts decimal 10 through 88 and wraps using one clock',{skip:!ghdl},()=>{
 const a=imported();a.ctx.text=fs.readFileSync(path.join(base,'examples/phase6-timed-counter.schtxt'),'utf8').replace('generic_DIVISOR=50000000','generic_DIVISOR=3');
 a.run('importSchematicText(text);state.project.topId=state.activeId');
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 let ex=set('rst',1)+pulse+check('result',10,8)+set('rst',0);
 for(let edge=1;edge<=241;edge++)ex+=pulse+check('result',10+Math.floor((edge-1)/3)%79,8);
 run(a,ex);
});
test('downloaded 64-bit skip example works after raw VHDL import with every input explicitly wired',{skip:!ghdl},()=>{
 const a=loadApp();a.ctx.files=[{fileName:'ss_counter_skip.vhd',vhdl:fs.readFileSync(path.join(base,'timing/ss_counter_skip.vhd'),'utf8')}];
 a.ctx.text=fs.readFileSync(path.join(base,'examples/phase6-skip-counter64.schtxt'),'utf8');
 a.run('applyVhdlModuleImport(planVhdlModuleImport(files));importSchematicText(text);state.project.topId=state.activeId');
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 let ex=set('en',1)+set('rst',1)+pulse+check('result',0,64)+set('rst',0);
 for(const n of [1,2,4,5,6,8,9,0])ex+=pulse+check('result',n,64)+check('valid',1)+check('blocked',0);
 run(a,ex);
});
