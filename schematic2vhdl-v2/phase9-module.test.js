const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const base=path.join(__dirname,'../fpga-exam-kit/modules');
const groups=['compositions'];
const packs=groups.map(g=>JSON.parse(fs.readFileSync(path.join(base,'packs',g+'.sccomp.json'),'utf8')));
const definitions=Object.assign({},...packs.map(p=>p.customs));
const roots=["ss_button_input","ss_alu","ss_fsm_template","ss_mmss_timer"];
let ghdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{ghdl=false;}
const pulse="wait for 1 ns;s_clk<='1';wait for 1 ns;s_clk<='0';wait for 1 ns;";
const lit=(n,w)=>w===1?`'${Number(BigInt.asUintN(w,BigInt(n)))}'`:`"${BigInt.asUintN(w,BigInt(n)).toString(2).padStart(w,'0')}"`;
const set=(p,n,w=1)=>`s_${p}<=${lit(n,w)};`;
const check=(p,n,w=1)=>`assert s_${p}=${lit(n,w)} report "${p} expected ${n}" severity failure;`;
const mask=w=>(1n<<BigInt(w))-1n;
const signed=(n,w)=>BigInt.asIntN(w,n);
function imported(){const a=loadApp();a.ctx.packs=packs;a.run('applyCustomPackages(packs)');return a;}
function fixture(name,params={}){
 const a=imported();a.ctx.name=name;a.ctx.params=params;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const id=addComp('CUSTOM:'+name,200,0,params);
 for(const p of getPorts(comp(id))){const io=addComp(p.dir==='in'?'IN':'OUT',p.dir==='in'?0:600,sch.components.length*80,{name:p.id,width:p.width});
 sch.wires.push({id:uid('w'),from:p.dir==='in'?{cid:io,pid:'o'}:{cid:id,pid:p.id},to:p.dir==='in'?{cid:id,pid:p.id}:{cid:io,pid:'i'}});}`);
 return a;
}
function run(a,exercise,{synth=false,variables=""}={}){
 const ports=a.json('schPortList(activeSch())'),entity=a.run('sanId(activeSch().name)');
 const declarations=ports.map(p=>`signal s_${p.id}:${p.width===1?'std_logic':`std_logic_vector(${p.width-1} downto 0)`}${p.dir==='in'?` := ${p.width===1?"'0'":"(others=>'0')"}`:''};`).join('\n');
 const tb=`library ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${declarations} begin u:entity work.${entity} port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process ${variables} begin wait for 1 ns;${exercise}report "PHASE9_COMPLETE";wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phase9-module-'));
 try{
  fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+(synth?'':tb));
  const exec=args=>{try{return execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000,maxBuffer:32*1024*1024}).toString();}catch(e){e.message+='\n'+e.stdout?.toString().slice(-4000)+'\n'+e.stderr?.toString().slice(-4000);throw e;}};
  exec(['-a','--std=08','bundle.vhd']);if(synth)return exec(['--synth','--std=08',entity]);
  exec(['-e','--std=08','tb']);const output=exec(['-r','--std=08','tb','--assert-level=error','--stop-time=100000ns']);assert.match(output,/PHASE9_COMPLETE/,'Testbench must complete before stop time');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const name of roots)test(`${name}: independent package/source, dependency closure, raw import, Undo and reopen`,()=>{
 const a=loadApp(),before=a.run('serialize()'),pkg=JSON.parse(fs.readFileSync(path.join(base,'compositions',name+'.sccomp.json')));assert.deepEqual(pkg.customs[name],definitions[name]);for(const c of Object.values(pkg.customs)){const file=c.name===name?path.join(base,'compositions',c.fileName):sourcePath(c.name);assert.equal(fs.readFileSync(file,'utf8'),c.vhdl);}
 a.ctx.pkg=pkg;assert.equal(a.run('applyCustomPackages([pkg])'),Object.keys(pkg.customs).length);const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);a.run('deserialize(serialize());validateVhdlModules(state.project)');
 const b=loadApp();b.ctx.files=Object.values(pkg.customs).map(c=>({fileName:c.fileName,vhdl:c.vhdl}));b.run('applyVhdlModuleImport(planVhdlModuleImport(files))');assert.equal(b.run('Object.keys(state.project.customs).length'),Object.keys(pkg.customs).length);
});
function sourcePath(name){for(const category of fs.readdirSync(base)){const file=path.join(base,category,name+'.vhd');if(fs.existsSync(file))return file;}throw new Error('Missing source '+name);}
test('composition controls, debounce-ms reuse, clock requirements and generic bounds',()=>{
 const a=imported();assert.equal(a.run('Object.keys(state.project.customs).length'),14);a.run("const b=addComp('CUSTOM:ss_button_input',0,0,{generic_ACTIVE_LOW:1,generic_MODE:2}),alu=addComp('CUSTOM:ss_alu',0,0,{generic_WIDTH:64,generic_SIGNED_MODE:1});");assert.match(a.run('componentParamFields(comp(b))'),/ตั้งระยะนิ่ง \(ms\)/);assert.match(a.run('componentParamFields(comp(b))'),/Both edges/);assert.match(a.run('componentParamFields(comp(alu))'),/Signed/);assert.equal(a.run('getPort(comp(alu),"result_hi").width'),64);
 for(const name of roots){a.ctx.name=name;assert.equal(a.run('moduleRequiresClock(state.project.customs[name])'),true);a.run("{const d=makePlacementDraft('CUSTOM:'+name,0,0);validatePlacementParams(d.type,d.params);componentParamFields(d);}");}
 const before=a.run('serialize()');for(const [name,params]of [['ss_button_input',{generic_STAGES:1}],['ss_button_input',{generic_MODE:3}],['ss_alu',{generic_WIDTH:65}],['ss_alu',{generic_SIGNED_MODE:2}],['ss_mmss_timer',{generic_MAX_MINUTES:100}],['ss_mmss_timer',{generic_TICKS_PER_SECOND:0}]]){a.ctx.name=name;a.ctx.params=params;assert.throws(()=>a.run("addComp('CUSTOM:'+name,0,0,params)"));}assert.equal(a.run('serialize()'),before);
 assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("ss_button_input",state.project.customs.ss_button_input.vhdl));');assert.match(a.run('componentParamFields(comp(b))'),/ตั้งระยะนิ่ง/);
 assert.equal(loadApp().run('Object.keys(state.project.customs).length'),0);assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),/entity ss_(?:button_input|alu|mmss_timer|fsm_template)/);
});
test('existing-project add-on installs only four roots, preserves prior modules and rejects missing dependencies and duplicate roots atomically',()=>{
 const a=loadApp();a.ctx.leaves=JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(definitions).filter(([name])=>!roots.includes(name)))));a.ctx.leaves.ss_input_sync.vhdl+='-- user note retained\n';a.ctx.pkg={type:'schstudio-custom-pkg',customs:a.ctx.leaves};a.run('applyCustomPackages([pkg]);const previous=JSON.stringify(state.project.customs);');a.ctx.addon=JSON.parse(fs.readFileSync(path.join(base,'compositions/existing-project.sccomp.json')));assert.equal(a.run('applyCustomPackages([addon])'),4);for(const name of Object.keys(a.ctx.leaves)){a.ctx.name=name;assert.deepEqual(a.json('state.project.customs[name]'),a.ctx.leaves[name]);}a.run('undo()');assert.equal(a.run('JSON.stringify(state.project.customs)'),a.run('previous'));
 const b=loadApp(),before=b.run('serialize()');b.ctx.addon=a.ctx.addon;assert.throws(()=>b.run('applyCustomPackages([addon])'));assert.equal(b.run('serialize()'),before);
 a.ctx.pack=packs[0];assert.throws(()=>a.run('applyCustomPackages([pack])'),/ชื่อซ้ำ/);
});
for(const [stages,stable]of [[2,1],[3,3],[64,2]])for(const low of [0,1])test(`GHDL Button ${stages}/${stable} active-low=${low}: exact latency, press/release, filtering and reset`,{skip:!ghdl},()=>{
 const a=fixture('ss_button_input',{generic_STAGES:stages,generic_STABLE_CYCLES:stable,generic_ACTIVE_LOW:low,generic_MODE:2}),latency=stages+stable+1;let ex=set('rst',1)+set('d',low)+pulse+set('rst',0)+set('d',1-low);
 for(let i=1;i<=latency;i++)ex+=pulse+check('q',i>=latency-1?1:0)+check('pressed',i===latency?1:0)+check('released',0)+check('pulse',i===latency?1:0);ex+=pulse+check('pressed',0)+check('pulse',0)+set('d',low);
 for(let i=1;i<=latency;i++)ex+=pulse+check('q',i>=latency-1?0:1)+check('released',i===latency?1:0)+check('pressed',0)+check('pulse',i===latency?1:0);ex+=pulse+check('released',0);
 if(stable>1){ex+=set('d',1-low)+pulse+set('d',low);for(let i=0;i<latency+3;i++)ex+=pulse+check('q',0)+check('pressed',0)+check('pulse',0);}
 ex+=set('d',1-low);for(let i=0;i<latency;i++)ex+=pulse;ex+=set('rst',1)+pulse+check('q',0)+check('pressed',0)+check('released',0)+check('pulse',0);run(a,ex);
});
for(const mode of [0,1])test(`GHDL Button selected edge MODE=${mode}`,{skip:!ghdl},()=>{
 let ex=set('rst',1)+pulse+set('rst',0)+set('d',1);for(let i=0;i<4;i++)ex+=pulse;ex+=check('pressed',1)+check('released',0)+check('pulse',mode===0?1:0)+set('d',0);for(let i=0;i<4;i++)ex+=pulse;ex+=check('pressed',0)+check('released',1)+check('pulse',mode===1?1:0);run(fixture('ss_button_input',{generic_STABLE_CYCLES:1,generic_MODE:mode}),ex);
});
for(const width of [1,8,64])for(const mode of [0,1])test(`GHDL ALU WIDTH=${width} signed=${mode}: fast operations, full multiply, flags and enabled acceptance`,{skip:!ghdl},()=>{
 const m=mask(width),half=1n<<BigInt(width-1),a=fixture('ss_alu',{generic_WIDTH:width,generic_SIGNED_MODE:mode});let ex=set('rst',1)+pulse+set('rst',0)+set('en',0)+set('start',1)+pulse+check('valid',0)+check('done',0)+set('en',1);
 for(const op of [0,1,2,4,5,6,7])for(const [x,y]of [[m,1n],[half, m],[half-1n,1n],[0n,m],[m,m]])for(const cin of [0,1]){
  const aa=mode?signed(x,width):x,bb=mode?signed(y,width):y,math=op===0?aa+bb+BigInt(cin):op===1?aa-bb-BigInt(cin):aa*bb;let result=[x+y+BigInt(cin),x-y-BigInt(cin),math,0n,x&y,x|y,x^y,~x][op],hi=0n,ov=0,z=0,neg=0;
  if(op===2){const bits=BigInt.asUintN(2*width,math);hi=bits>>BigInt(width);result=bits&m;ov=mode?(math< -half||math>=half?1:0):(hi!==0n?1:0);z=math===0n?1:0;neg=mode&&math<0n?1:0;}
  else{result=BigInt.asUintN(width,result);ov=mode&&op<2&&(math< -half||math>=half)?1:0;z=result===0n?1:0;neg=mode&&signed(result,width)<0n?1:0;}
  ex+=set('opcode',op,3)+set('a',x,width)+set('b',y,width)+set('cin',cin)+pulse+check('y',result,width)+check('result_hi',hi,width)+check('busy',0)+check('done',1)+check('valid',1)+check('carry',op===0&&x+y+BigInt(cin)>m?1:0)+check('borrow',op===1&&x-y-BigInt(cin)<0n?1:0)+check('overflow',ov)+check('zero',z)+check('negative',neg)+check('divide_by_zero',0)+check('invalid_op',0);
 }
 ex+=set('start',0)+set('en',0)+pulse+check('done',0)+check('valid',1)+set('rst',1)+pulse+check('valid',0)+check('y',0,width)+check('result_hi',0,width)+check('zero',1);run(a,ex);
});
for(const width of [1,8,64])for(const mode of [0,1])test(`GHDL ALU divide WIDTH=${width} signed=${mode}: capture, latency, busy starts, errors and abort`,{skip:!ghdl},()=>{
 const m=mask(width),half=1n<<BigInt(width-1);let ex=set('rst',1)+pulse+set('rst',0)+set('en',1);
 for(const [x,y]of [[m,1n],[half,m],[m,0n],[0n,1n]]){const aa=mode?signed(x,width):x,bb=mode?signed(y,width):y,error=bb===0n||mode&&aa===-half&&bb===-1n,latency=error?2:width+2;ex+=set('opcode',3,3)+set('a',x,width)+set('b',y,width)+set('start',1)+pulse+check('busy',1)+check('done',0)+check('valid',0)+set('a',0,width)+set('b',0,width)+set('opcode',0,3);
  for(let i=1;i<=latency;i++){if(i===latency)ex+=set('start',0);ex+=pulse+check('busy',i===latency?0:1)+check('done',i===latency?1:0);}
  ex+=check('valid',error?0:1)+check('divide_by_zero',bb===0n?1:0)+check('overflow',error&&bb!==0n?1:0)+check('y',bb===0n?0n:error?x:aa/bb,width)+check('result_hi',bb===0n?x:error?0n:aa%bb,width)+pulse+check('done',0);
 }
 ex+=set('opcode',3,3)+set('a',0,width)+set('b',1,width)+set('start',1)+pulse+set('start',0)+pulse+set('en',0);for(let i=0;i<3;i++)ex+=pulse+check('busy',1)+check('done',0);ex+=set('en',1);for(let i=0;i<width;i++)ex+=pulse+check('busy',1);ex+=set('en',0)+pulse+check('busy',0)+check('done',1)+check('valid',1)+check('y',0,width);
 ex+=set('en',1)+set('start',1)+pulse+set('rst',1)+pulse+check('busy',0)+check('valid',0)+check('done',0)+set('rst',0)+set('start',0);for(let i=0;i<width+4;i++)ex+=pulse+check('done',0);run(fixture('ss_alu',{generic_WIDTH:width,generic_SIGNED_MODE:mode}),ex);
});
test('GHDL ALU unknown opcode is rejected without indexing or overwriting result',{skip:!ghdl},()=>{
 const ex=set('rst',1)+pulse+set('rst',0)+set('en',1)+set('start',1)+'s_opcode<="XXX";'+pulse+check('invalid_op',1)+check('valid',0)+check('done',1)+check('y',0,8)+set('start',0)+pulse+check('done',0);run(fixture('ss_alu'),ex);
});
function fsmExercise(){let ex=set('rst',1)+set('en',0)+pulse+check('state',0,2)+set('rst',0)+set('en',1);for(const [start,finish,cancel,expected]of [[0,1,0,0],[1,1,0,1],[1,0,0,1],[1,1,0,2],[0,1,0,2],[1,1,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1],[0,1,1,0]])ex+=set('start',start)+set('finish',finish)+set('cancel',cancel)+pulse+check('state',expected,2)+check('active',expected===1?1:0)+check('done',expected===2?1:0)+check('invalid',0);ex+=set('start',1)+set('cancel',0)+pulse+check('state',1,2)+set('en',0)+set('cancel',1)+set('finish',1)+pulse+check('state',1,2)+set('rst',1)+pulse+check('state',0,2);return ex;}
function fsmTemplate(){const a=loadApp();a.ctx.text=fs.readFileSync(path.join(base,'compositions/ss_fsm_template.sch.txt'),'utf8');a.run('importSchematicText(text);state.project.topId=state.activeId');assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);return a;}
test('FSM VHDL is the exact editable schematic export with no custom dependency',()=>{
 const a=fsmTemplate(),source=fs.readFileSync(path.join(base,'compositions/ss_fsm_template.vhd'),'utf8');assert.equal(source,'-- Exported from ss_fsm_template.sch.txt; regenerate after editing that template.\n'+a.json('generateSchVhdl(activeSch())').code);assert.deepEqual(definitions.ss_fsm_template.dependencies,[]);
});
for(const variant of ['VHDL box','editable schematic'])test(`GHDL FSM ${variant}: transition priority, hold, synchronous reset and restart`,{skip:!ghdl},()=>{run(variant==='VHDL box'?fixture('ss_fsm_template'):fsmTemplate(),fsmExercise());});
test('GHDL FSM invalid initialized state recovers on next edge even disabled',{skip:!ghdl},()=>{
 const a=fixture('ss_fsm_template');const source=a.run('state.project.customs.ss_fsm_template.vhdl');assert.match(source,/signal state_bit0_q : STD_LOGIC := '0'/);assert.match(source,/signal state_bit1_q : STD_LOGIC := '0'/);a.run("state.project.customs.ss_fsm_template.vhdl=state.project.customs.ss_fsm_template.vhdl.replace(/(signal state_bit[01]_q : STD_LOGIC := )'0'/g,\"$1'1'\");");run(a,check('state',3,2)+check('invalid',1)+set('en',0)+pulse+check('state',0,2)+check('invalid',0));
});
const timeCheck=(m,s)=>check('minutes',m,7)+check('seconds',s,6)+check('digits',BigInt('0x'+m.toString().padStart(2,'0')+s.toString().padStart(2,'0')),16)+check('valid',1);
const timeLoad=(m,s)=>set('load',1)+set('load_minutes',m,7)+set('load_seconds',s,6)+pulse+set('load',0)+timeCheck(m,s)+check('running',0);
for(const [max,divisor]of [[0,1],[1,3],[99,7]])test(`GHDL MM:SS maximum=${max} interval=${divisor}: rollover, borrow, endpoint, packed digits and restart`,{skip:!ghdl},()=>{
 let ex=set('rst',1)+set('down',1)+set('en',1)+pulse+timeCheck(0,0)+check('running',0)+set('rst',0)+set('down',0)+timeLoad(max,58)+set('start',1)+pulse+set('start',0)+check('running',1);for(let i=0;i<divisor;i++)ex+=pulse+timeCheck(max,58)+check('done',0);ex+=pulse+timeCheck(max,59)+check('done',1)+check('running',0)+check('terminal',1)+pulse+check('done',0)+set('start',1)+pulse+check('done',1)+check('running',0)+set('start',0);
 if(max>0){ex+=timeLoad(0,59)+set('start',1)+pulse+set('start',0);for(let i=0;i<divisor+1;i++)ex+=pulse;ex+=timeCheck(1,0)+check('running',1)+check('done',0)+set('pause',1)+pulse+set('pause',0)+set('down',1)+timeLoad(1,0)+set('start',1)+pulse+set('start',0);for(let i=0;i<divisor+1;i++)ex+=pulse;ex+=timeCheck(0,59)+check('running',1)+check('done',0);}
 ex+=set('down',1)+timeLoad(0,1)+set('start',1)+pulse+set('start',0);for(let i=0;i<divisor;i++)ex+=pulse+timeCheck(0,1);ex+=pulse+timeCheck(0,0)+check('done',1)+check('running',0)+check('terminal',1);for(let i=0;i<divisor+3;i++)ex+=pulse+timeCheck(0,0)+check('done',0);run(fixture('ss_mmss_timer',{generic_MAX_MINUTES:max,generic_TICKS_PER_SECOND:divisor}),ex);
});
test('GHDL MM:SS control precedence, invalid load, pause/restart and disabled fractional reset',{skip:!ghdl},()=>{
 const div=3;let ex=set('rst',1)+set('load',1)+set('pause',1)+set('start',1)+set('down',1)+set('load_minutes',1,7)+set('load_seconds',50,6)+pulse+timeCheck(0,0)+check('done',0)+set('rst',0)+pulse+timeCheck(1,50)+check('running',0)+set('load',0)+pulse+check('running',0)+set('pause',0)+set('down',0)+set('en',1)+pulse+check('running',1)+set('start',0)+pulse+pulse+timeCheck(1,50)+set('pause',1)+pulse+set('pause',0);for(let i=0;i<5;i++)ex+=pulse+timeCheck(1,50)+check('done',0);ex+=set('start',1)+pulse+set('start',0);for(let i=0;i<div;i++)ex+=pulse+timeCheck(1,50);ex+=pulse+timeCheck(1,51)+set('en',0);for(let i=0;i<5;i++)ex+=pulse+timeCheck(1,51)+check('running',1);ex+=set('en',1);for(let i=0;i<div;i++)ex+=pulse+timeCheck(1,51);ex+=pulse+timeCheck(1,52);
 for(const [m,s]of [[3,0],[1,60],[127,63]])ex+=set('load',1)+set('load_minutes',m,7)+set('load_seconds',s,6)+pulse+timeCheck(1,52)+check('load_error',1)+check('running',0)+set('load',0)+pulse+check('load_error',0);
 ex+=timeLoad(2,58)+set('start',1)+pulse+set('start',0);for(let i=0;i<div;i++)ex+=pulse;ex+=set('pause',1)+pulse+timeCheck(2,58)+check('done',0)+check('running',0);run(fixture('ss_mmss_timer',{generic_MAX_MINUTES:2,generic_TICKS_PER_SECOND:div}),ex);
});
for(const [name,params]of [['ss_button_input',{generic_STAGES:64,generic_STABLE_CYCLES:2147483647}],['ss_alu',{generic_WIDTH:64,generic_SIGNED_MODE:1}],['ss_fsm_template',{}],['ss_mmss_timer',{generic_TICKS_PER_SECOND:2147483647}]])test(`GHDL synthesis ${name} boundary configuration and dependency bundle`,{skip:!ghdl},()=>{assert.match(run(fixture(name,params),'',{synth:true}),/entity/i);});
function example(file){const a=imported();a.ctx.extra=['ss_bus_zero_extend','ss_sevenseg_digits','ss_sevenseg_scan','ss_number_formatter','ss_text_overlay','ss_lcd16x2'].map(name=>{const file=sourcePath(name).replace(/\.vhd$/,'.sccomp.json');return JSON.parse(fs.readFileSync(file));});a.run('applyCustomPackages(extra)');a.ctx.text=fs.readFileSync(path.join(base,'examples',file),'utf8');a.run('importSchematicText(text);state.project.topId=state.activeId');assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);return a;}
test('GHDL ALU64 example supports signed add and divide with captured inputs',{skip:!ghdl},()=>{
 const a=example('phase9-alu.schtxt');let ex=set('rst',1)+pulse+set('rst',0)+set('en',1)+set('opcode',0,3)+set('a',-7,64)+set('b',3,64)+set('start',1)+pulse+check('y',-4,64)+check('done',1)+set('opcode',3,3)+pulse+set('start',0);for(let i=0;i<66;i++)ex+=pulse;ex+=check('y',-2,64)+check('result_hi',-1,64)+check('valid',1)+check('done',1);run(a,ex);
});
test('GHDL Button→timer→four digits example: debounced start, pause priority and display byte order',{skip:!ghdl},()=>{
 const a=example('phase9-button-timer.schtxt');a.run("for(const c of activeSch().components){if(c.type==='CUSTOM:ss_button_input')c.params.generic_STABLE_CYCLES=1;if(c.type==='CUSTOM:ss_mmss_timer')c.params.generic_TICKS_PER_SECOND=8;if(c.type==='CUSTOM:ss_sevenseg_scan')c.params.generic_SLOT_CYCLES=3;}");
 let ex=set('rst',1)+set('en',1)+pulse+set('rst',0)+set('down',1)+set('load',1)+set('load_minutes',0,7)+set('load_seconds',3,6)+pulse+set('load',0)+set('start_button',1);for(let i=0;i<4;i++)ex+=pulse+check('running',0);ex+=pulse+check('running',1)+set('start_button',0)+set('pause_button',1);for(let i=0;i<5;i++)ex+=pulse;ex+=check('running',0)+check('done',0)+check('valid',1);
 // Stopped at 00:03; scanner continues independently and dots only common 2.
 const patterns=[0x4F,0x3F,0xBF,0x3F];ex+=`for k in 0 to 20 loop ${pulse}case s_common is ${patterns.map((p,i)=>`when ${lit(1<<i,4)}=>${check('segment',p&127,7)}${check('dp',p>>7)}`).join('')}when "0000"=>null;when others=>assert false report "common not one-hot" severity failure;end case;end loop;`;run(a,ex);
});
test('GHDL MM:SS→formatter→overlay→LCD example displays 12:34 with literal colon',{skip:!ghdl},()=>{
 const a=example('phase9-mmss-lcd.schtxt');a.run("for(const c of activeSch().components){if(c.type==='CUSTOM:ss_lcd16x2')Object.assign(c.params,{generic_POWERUP_CYCLES:10,generic_INIT_WAIT_CYCLES:1,generic_CLEAR_WAIT_CYCLES:1,generic_STEP_CYCLES:1});}");const text='12:34'.padEnd(32,' '),sequence=[0x80,...Array.from(text.slice(0,16),c=>c.charCodeAt(0)),0xC0,...Array.from(text.slice(16),c=>c.charCodeAt(0))];let ex=set('rst',1)+set('en',1)+pulse+set('rst',0)+set('load',1)+set('load_minutes',12,7)+set('load_seconds',34,6)+pulse+set('load',0)+check('running',0);
 ex+=`for k in 0 to 150 loop ${pulse}exit when s_ready='1';end loop;${check('ready',1)}for k in 0 to 400 loop ${pulse}if previous='1' and s_e='0' then case received is ${sequence.map((v,i)=>`when ${i}=>${check('data',v,8)}${check('rs',i===0||i===17?0:1)}`).join('')}when others=>assert false severity failure;end case;received:=received+1;end if;previous:=s_e;exit when s_display_done='1';end loop;assert received=34 severity failure;${check('valid',1)}${check('load_error',0)}${check('rw',0)}`;run(a,ex,{variables:"variable previous:std_logic:='0';variable received:natural:=0;"});
});
test('roots-only dependency resolution is confined to component packages and batch failure is atomic',()=>{
 const a=loadApp();a.ctx.leaves={type:'schstudio-custom-pkg',customs:Object.fromEntries(Object.entries(definitions).filter(([name])=>!roots.includes(name)))};a.run('applyCustomPackages([leaves])');const before=a.run('serialize()'),history=a.run('state.history.idx');a.ctx.addon=JSON.parse(fs.readFileSync(path.join(base,'compositions/existing-project.sccomp.json')));
 a.ctx.source={schematics:{host:{id:'host',name:'standalone_import',components:[],wires:[]}},topId:'host',customs:a.ctx.addon.customs};assert.throws(()=>a.run('buildProjectImport(source,state.project)'),/ขาดไฟล์ entity/);assert.equal(a.run('serialize()'),before);
 a.ctx.payloads=[a.ctx.addon,{type:'invalid'}];assert.throws(()=>a.run('applyCustomPackages(payloads)'));assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),history);
});
test('GHDL FSM exhausts every legal state/event combination with enabled and held clocks',{skip:!ghdl},()=>{
 let ex='';for(const state of [0,1,2])for(const en of [0,1])for(const start of [0,1])for(const finish of [0,1])for(const cancel of [0,1]){
  ex+=set('rst',1)+pulse+set('rst',0)+set('en',1)+set('cancel',0)+set('start',0)+set('finish',0);
  if(state>=1)ex+=set('start',1)+pulse+set('start',0);if(state===2)ex+=set('finish',1)+pulse+set('finish',0);
  const next=!en?state:cancel?0:state===1?(finish?2:1):start?1:state;ex+=set('en',en)+set('start',start)+set('finish',finish)+set('cancel',cancel)+pulse+check('state',next,2)+check('active',next===1?1:0)+check('done',next===2?1:0)+check('invalid',0);
 }run(fixture('ss_fsm_template'),ex);
});
test('Phase 9 ZIP contains exact sources, dependencies, editable FSM and all examples',()=>{
 const zip=path.join(base,'downloads/phase9-modules.zip'),entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.equal(entries.length,53);assert.equal(new Set(entries).size,53);
 for(const file of entries){assert.ok(!file.startsWith('/')&&!file.includes('..'));assert.deepEqual(execFileSync('unzip',['-p',zip,file]),fs.readFileSync(path.join(base,file)));}
 assert.equal(entries.filter(f=>f.endsWith('.vhd')).length,21);assert.ok(entries.includes('compositions/ss_fsm_template.sch.txt'));
 const a=loadApp();a.ctx.payloads=['packs/compositions.sccomp.json',...['ss_bus_zero_extend','ss_sevenseg_digits','ss_sevenseg_scan','ss_number_formatter','ss_text_overlay','ss_lcd16x2'].map(n=>path.relative(base,sourcePath(n)).replace(/\.vhd$/,'.sccomp.json'))].map(f=>JSON.parse(execFileSync('unzip',['-p',zip,f])));assert.equal(a.run('applyCustomPackages(payloads)'),21);
 for(const file of entries.filter(f=>f.endsWith('.schtxt'))){a.ctx.text=execFileSync('unzip',['-p',zip,file],{encoding:'utf8'});a.run('importSchematicText(text);state.project.topId=state.activeId');assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);}
 const b=loadApp();b.ctx.prior=fs.readdirSync(path.join(base,'packs')).filter(f=>f.endsWith('.sccomp.json')&&f!=='compositions.sccomp.json').map(f=>JSON.parse(fs.readFileSync(path.join(base,'packs',f))));assert.equal(b.run('applyCustomPackages(prior)'),45);const before=b.json('state.project.customs');b.ctx.addon=JSON.parse(execFileSync('unzip',['-p',zip,'compositions/existing-project.sccomp.json']));assert.equal(b.run('applyCustomPackages([addon])'),4);assert.equal(b.run('Object.keys(state.project.customs).length'),49);
 for(const name of Object.keys(before)){b.ctx.name=name;assert.deepEqual(b.json('state.project.customs[name]'),before[name]);}
});
