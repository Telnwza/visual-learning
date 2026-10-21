const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp:loadEmptyApp}=require('./test-runtime.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../fpga-exam-kit/modules/packs/input-conditioning.sccomp.json'),'utf8'));
function loadApp(){const a=loadEmptyApp();a.ctx.pack=pack;a.run('applyCustomPackages([pack])');return a;}
const kinds=['SYNC','DEBOUNCE','EDGE'];
let ghdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{ghdl=false;}
function fixture(kind,params={}){
 const a=loadApp();a.ctx.kind=kind;a.ctx.params=params;
 a.run(`const sch=activeSch(),id=addComp('CUSTOM:ss_input_'+kind.toLowerCase(),200,0,params),block=comp(id);for(const p of getPorts(block)){
  const io=addComp(p.dir==='in'?'IN':'OUT',p.dir==='in'?0:500,sch.components.length*80,{name:p.id,width:p.width});
  sch.wires.push({id:uid('w'),from:p.dir==='in'?{cid:io,pid:'o'}:{cid:id,pid:p.id},to:p.dir==='in'?{cid:id,pid:p.id}:{cid:io,pid:'i'}});
 }`);
 return a;
}
function runVhdl(a,exercise,{synth=false}={}){
 const ports=a.json('schPortList(activeSch())'),decls=ports.map(p=>`signal s_${p.id}:std_logic${p.dir==='in'?":='0'":''};`).join('\n');
 const tb=`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${decls}begin u:entity work.top port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process begin ${exercise} wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'input-conditioning-'));
 try{fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+(synth?'':tb));
  execFileSync('ghdl',['-a','--std=08','bundle.vhd'],{cwd:dir,stdio:'pipe',timeout:30000});
  if(synth)return execFileSync('ghdl',['--synth','--std=08','top'],{cwd:dir,stdio:'pipe',timeout:30000}).toString();
  execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe',timeout:30000});execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=10000ns'],{cwd:dir,stdio:'pipe',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const edge="s_clk<='1';wait for 1 ns;s_clk<='0';wait for 1 ns;";
const check=(q,p=0,r=0)=>`assert s_q='${q}' and s_pressed='${p}' and s_released='${r}' severity failure;`;
test('input catalog previews are pure and expose friendly, bounded independent parameters',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN');
 assert.deepEqual(a.json('paletteEntries().filter(e=>e.type.startsWith("CUSTOM:ss_input_")).map(e=>e.type)'),kinds.map(k=>'CUSTOM:ss_input_'+k.toLowerCase()));
 for(const kind of kinds){a.ctx.kind=kind;a.run("{const c=makePlacementDraft('CUSTOM:ss_input_'+kind.toLowerCase(),0,0);validatePlacementParams(c.type,c.params);getPorts(c);componentParamFields(c);}");}
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 assert.equal(a.run('state.project.customs.ss_input_sync.generics[0].defaultValue'),2);
 assert.equal(a.run('vhdlGenericSchema(state.project.customs.ss_input_sync)[0].max'),64);
 assert.match(a.run('state.project.customs.ss_input_sync.vhdl'),/attribute ASYNC_REG of pipe:signal is "TRUE"/);
 assert.match(a.run('state.project.customs.ss_input_sync.inputNotes'),/metastability/);
 assert.match(a.run('componentParamFields(makePlacementDraft("CUSTOM:ss_input_debounce",0,0))'),/ตั้งระยะนิ่ง \(ms\)/);
 assert.deepEqual(a.json('vhdlGenericSchema(state.project.customs.ss_input_edge)[0].options'),[0,1,2]);
});
test('placement embeds one shared source, settings are independent, and placement/parameter edits undo completely',()=>{
 const a=loadApp(),before=a.run('serialize()');a.run("const first=addComp('CUSTOM:ss_input_debounce',0,0,{generic_STABLE_CYCLES:1}),second=addComp('CUSTOM:ss_input_debounce',200,0,{generic_STABLE_CYCLES:50});");
 assert.equal(a.run('Object.keys(state.project.customs).length'),3);assert.equal(a.run('vhdlGenericValues(typeDef(comp(first))._custom,comp(first).params).stable_cycles'),1);
 assert.equal(a.run('vhdlGenericValues(typeDef(comp(second))._custom,comp(second).params).stable_cycles'),50);
 const placed=a.run('serialize()');a.run('undo();undo()');assert.equal(a.run('serialize()'),before);a.run('redo();redo()');assert.equal(a.run('serialize()'),placed);
 a.run('const change=planComponentParamChange(activeSch(),comp(first),"generic_STABLE_CYCLES",100);applyComponentParamChange(activeSch(),comp(first),change);');
 assert.equal(a.run('comp(first).params.generic_STABLE_CYCLES'),100);assert.equal(a.run('comp(second).params.generic_STABLE_CYCLES'),50);a.run('undo()');assert.equal(a.run('serialize()'),placed);
 assert.deepEqual(a.json('Object.keys(generateAllVhdl())'),['top','ss_input_debounce']);
 assert.equal(a.run('paletteEntries().filter(e=>e.type==="CUSTOM:ss_input_debounce").length'),1);
});
test('invalid boundaries preserve IDs and duplicate file imports preserve existing source',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN');
 for(const [kind,params]of[['SYNC',{generic_STAGES:1}],['SYNC',{generic_STAGES:65}],['SYNC',{generic_RESET_LEVEL:2}],['DEBOUNCE',{generic_STABLE_CYCLES:0}],['DEBOUNCE',{generic_STABLE_CYCLES:2147483648}],['DEBOUNCE',{generic_CLOCK_HZ:0}],['DEBOUNCE',{generic_ACTIVE_LOW:2}],['EDGE',{generic_MODE:3}]]){a.ctx.kind=kind;a.ctx.params=params;assert.throws(()=>a.run("addComp('CUSTOM:ss_input_'+kind.toLowerCase(),0,0,params)"));}
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 a.run('state.project.customs.ss_input_sync={name:"ss_input_sync",ports:[],vhdl:"different"};');const collision=a.run('serialize()');assert.throws(()=>a.run("applyCustomPackages([pack])"),/ชื่อซ้ำ/);assert.equal(a.run('serialize()'),collision);
});
test('unconnected reset emits an explicit default; missing clock and dangling wires remain visible',()=>{
 for(const kind of kinds){const a=fixture(kind);a.run("activeSch().wires=activeSch().wires.filter(w=>w.to.pid!=='rst');activeSch().components=activeSch().components.filter(c=>c.type!=='IN'||c.params.name!=='rst');");
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err"||i.lvl==="warn")'),[]);assert.match(a.run('generateSchVhdl(activeSch()).code'),/rst => '0'/);
 a.run("activeSch().wires=activeSch().wires.filter(w=>w.to.pid!=='clk');");assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 a.run("const j=addComp('JUNCTION',300,300);activeSch().wires.push({id:uid('w'),from:{cid:j,pid:'j'},to:{cid:id,pid:'rst'}});");assert.ok(a.json('generateSchVhdl(activeSch()).fallbacks').some(f=>f.pid==='rst'));assert.ok(a.json('runSynthesis()').some(i=>/ปลายลอย/.test(i.msg)));
 }
});
test('milliseconds conversion rounds up exactly, handles sub-clock requests and rejects invalid/overflow values',()=>{
 const a=loadApp();for(const [ms,hz,expected]of[['10',50000000,500000],['0.001',50000000,50],['0.000000001',50000000,1],['1',32768,33],['2147483647',1000,2147483647],['1.000000001',2147483647,2147484]]){
 a.ctx.ms=ms;a.ctx.hz=hz;assert.equal(a.run('debounceCyclesFromMs(ms,hz)'),expected);
 }
 for(const ms of ['0','-1','1e3','1.0000000001','abc','2147483648']){a.ctx.ms=ms;assert.throws(()=>a.run('debounceCyclesFromMs(ms,1000)'));}
 a.ctx.hz=0;assert.throws(()=>a.run('debounceCyclesFromMs("10",hz)'));
});
const composition=`format schematic-text 1
circuit input_demo
input clk, rst, raw
output stable, pressed, released, pulse
use "CUSTOM:ss_input_sync" as synchronize
use "CUSTOM:ss_input_debounce" as debounce
use "CUSTOM:ss_input_edge" as detect
part sync @synchronize generic_STAGES=3
part button @debounce generic_STABLE_CYCLES=3
part event @detect generic_MODE=2
connect clk -> sync.clk, button.clk, event.clk
connect rst -> sync.rst, button.rst, event.rst
connect raw -> sync.d
connect sync.q -> button.d
connect button.q -> stable, event.d
connect button.pressed -> pressed
connect button.released -> released
connect event.pulse -> pulse`;
test('Schematic Text composition, pure preview, atomic import and portable source/settings round trip',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN');a.ctx.text=composition;a.run('compileSchematicText(text)');assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 assert.match(a.run('schematicTextCatalog(["CUSTOM:ss_input_sync","CUSTOM:ss_input_debounce","CUSTOM:ss_input_edge"])'),/unconnected-input-defaults/);
 a.run('importSchematicText(text)');const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.run('deserialize(serialize());const staged=planCustomPackageImport({type:"schstudio-custom-pkg",customs:state.project.customs},{schematics:{},customs:{}});');
 assert.equal(a.run('Object.keys(staged).length'),3);assert.equal(a.run('staged.ss_input_debounce.defaultInputs.rst'),0);assert.equal(a.run('staged.ss_input_sync.vhdl'),a.run('state.project.customs.ss_input_sync.vhdl'));
 assert.equal(a.run('vhdlGenericValues(typeDef(activeSch().components.find(c=>c.label==="button"))._custom,activeSch().components.find(c=>c.label==="button").params).stable_cycles'),3);
 a.run('state.project.topId=state.activeId');assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err"||i.lvl==="warn")'),[]);
 const saved=a.run('serialize()');a.ctx.text=composition.replace('generic_STAGES=3','generic_STAGES=1');assert.throws(()=>a.run('importSchematicText(text)'));assert.equal(a.run('serialize()'),saved);
});
for(const stages of [2,3,64])for(const reset of [0,1])test(`GHDL synchronizer ${stages} stages, reset ${reset}: exact pipeline latency and synchronous reset`,{skip:!ghdl},()=>{
 const a=fixture('SYNC',{generic_STAGES:stages,generic_RESET_LEVEL:reset});let ex=`wait for 1 ns;assert s_q='${reset}' severity failure;s_d<='${1-reset}';wait for 1 ns;assert s_q='${reset}' severity failure;`;
 for(let i=1;i<=stages;i++)ex+=edge+`assert s_q='${i===stages?1-reset:reset}' severity failure;`;
 ex+=`s_rst<='1';wait for 1 ns;assert s_q='${1-reset}' severity failure;${edge}assert s_q='${reset}' severity failure;s_rst<='0';`;
 for(let i=1;i<=stages;i++)ex+=edge+`assert s_q='${i===stages?1-reset:reset}' severity failure;`;
 runVhdl(a,ex);
});
for(const low of [0,1])for(const cycles of [1,2,3,5])test(`GHDL debounce polarity ${low}, ${cycles} stable clocks: bounce, exact threshold, events and held startup`,{skip:!ghdl},()=>{
 const a=fixture('DEBOUNCE',{generic_STABLE_CYCLES:cycles,generic_ACTIVE_LOW:low}),set=active=>`s_d<='${active^low}';wait for 1 ns;`;
 let ex=`${set(0)}s_rst<='1';${edge}${check(0)}s_rst<='0';${set(1)}`;
 for(let i=1;i<cycles;i++)ex+=edge+check(0);
 ex+=set(0)+edge+check(0)+set(1);
 for(let i=1;i<=cycles;i++)ex+=edge+check(i===cycles?1:0,i===cycles?1:0);
 ex+=edge+check(1)+set(0);
 for(let i=1;i<cycles;i++)ex+=edge+check(1);
 ex+=set(1)+edge+check(1)+set(0);
 for(let i=1;i<=cycles;i++)ex+=edge+check(i===cycles?0:1,0,i===cycles?1:0);
 ex+=edge+check(0)+set(1)+"s_rst<='1';"+edge+check(0)+"s_rst<='0';";
 for(let i=1;i<=cycles;i++)ex+=edge+check(i===cycles?1:0,i===cycles?1:0);
 ex+=edge+check(1);runVhdl(a,ex);
});
test('GHDL debounce maximum cycle bound does not overflow or change state prematurely',{skip:!ghdl},()=>{
 const a=fixture('DEBOUNCE',{generic_STABLE_CYCLES:2147483647});runVhdl(a,`s_d<='1';wait for 1 ns;${(edge+check(0)).repeat(10)}s_rst<='1';${edge}${check(0)}`);assert.match(runVhdl(a,'',{synth:true}),/architecture/i);
});
for(const mode of [0,1,2])for(const initial of [0,1])test(`GHDL edge detector mode ${mode}, initial ${initial}: startup suppression, selected edges and one-clock events`,{skip:!ghdl},()=>{
 const a=fixture('EDGE',{generic_MODE:mode}),expect=(rise,fall)=>`assert s_rise='${rise}' and s_fall='${fall}' and s_pulse='${(mode===0?rise:mode===1?fall:rise||fall)?1:0}' severity failure;`;
 let ex=`s_d<='${initial}';wait for 1 ns;${edge}${expect(0,0)}${edge}${expect(0,0)}`;
 ex+=`s_d<='${1-initial}';wait for 1 ns;${edge}${expect(initial?0:1,initial?1:0)}${edge}${expect(0,0)}`;
 ex+=`s_d<='${initial}';wait for 1 ns;${edge}${expect(initial?1:0,initial?0:1)}s_rst<='1';wait for 1 ns;${edge}${expect(0,0)}s_rst<='0';s_d<='${1-initial}';wait for 1 ns;${edge}${expect(0,0)}${edge}${expect(0,0)}`;
 runVhdl(a,ex);
});
test('GHDL both-edge events on consecutive transitions need no artificial idle cycle',{skip:!ghdl},()=>{
 const a=fixture('EDGE',{generic_MODE:2});runVhdl(a,`wait for 1 ns;${edge}s_d<='1';wait for 1 ns;${edge}assert s_pulse='1' and s_rise='1' severity failure;s_d<='0';wait for 1 ns;${edge}assert s_pulse='1' and s_fall='1' severity failure;${edge}assert s_pulse='0' severity failure;`);
});
for(const kind of kinds)test(`GHDL ${kind} source synthesizes with boundary configuration`,{skip:!ghdl},()=>{
 const a=fixture(kind,kind==='SYNC'?{generic_STAGES:64,generic_RESET_LEVEL:1}:kind==='DEBOUNCE'?{generic_STABLE_CYCLES:1,generic_ACTIVE_LOW:1}:{generic_MODE:2});assert.match(runVhdl(a,'',{synth:true}),/architecture/i);
});
test('GHDL complete synchronized/debounced input composition retains documented latency and reset behavior',{skip:!ghdl},()=>{
 const a=loadApp();a.ctx.text=composition;a.run('importSchematicText(text);activeSch().name="top";state.project.topId=state.activeId;');
 const expected=(q,p=0,r=0,e=0)=>`assert s_stable='${q}' and s_pressed='${p}' and s_released='${r}' and s_pulse='${e}' severity failure;`;
 let ex=`wait for 1 ns;s_rst<='1';${edge}${expected(0)}s_rst<='0';s_raw<='1';wait for 1 ns;`;
 for(let i=1;i<=7;i++)ex+=edge+expected(i>=6?1:0,i===6?1:0,0,i===7?1:0);
 ex+=edge+expected(1)+"s_raw<='0';wait for 1 ns;";
 for(let i=1;i<=7;i++)ex+=edge+expected(i<6?1:0,0,i===6?1:0,i===7?1:0);
 ex+=edge+expected(0);runVhdl(a,ex);
});

test('GHDL active-low idle startup with a matching synchronizer reset level produces no phantom press',{skip:!ghdl},()=>{
 const a=loadApp();a.ctx.text=composition.replace('generic_STAGES=3','generic_STAGES=3 generic_RESET_LEVEL=1').replace('generic_STABLE_CYCLES=3','generic_STABLE_CYCLES=1 generic_ACTIVE_LOW=1');a.run('importSchematicText(text);activeSch().name="top";state.project.topId=state.activeId;');
 let ex=`s_raw<='1';s_rst<='1';wait for 1 ns;${edge}assert s_stable='0' and s_pressed='0' severity failure;s_rst<='0';`;
 for(let i=0;i<6;i++)ex+=edge+"assert s_stable='0' and s_pressed='0' and s_released='0' and s_pulse='0' severity failure;";
 ex+="s_raw<='0';wait for 1 ns;";
 for(let i=1;i<=4;i++)ex+=edge+`assert s_stable='${i===4?1:0}' and s_pressed='${i===4?1:0}' severity failure;`;
 runVhdl(a,ex);
});
