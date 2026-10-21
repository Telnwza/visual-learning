const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp:loadEmptyApp}=require('./test-runtime.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../fpga-exam-kit/modules/packs/registers.sccomp.json'),'utf8'));
function loadApp(){const a=loadEmptyApp();a.ctx.pack=pack;a.run('applyCustomPackages([pack])');return a;}
const kinds=['PIPO','SIPO','PISO','SISO','UNIVERSAL'];
let ghdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{ghdl=false;}
function fixture(kind,width=8,params={}){
 const a=loadApp();a.ctx.kind=kind;a.ctx.width=width;a.ctx.params={generic_WIDTH:width,...params};
 const reset=width===1?1n:width===8?0xA5n:0xFEDCBA9876543210n;a.ctx.resetHex=reset.toString(16);
 a.run(`const sch=activeSch(),id=addComp('CUSTOM:ss_reg_'+kind.toLowerCase(),200,0,params),reg=comp(id);for(const p of getPorts(reg)){
  const type=p.dir==='in'?(p.id==='reset_value'?'CONST':'IN'):'OUT';const io=addComp(type,p.dir==='in'?0:500,sch.components.length*100,type==='CONST'?{value:resetHex,width:p.width}:{name:p.id,width:p.width});
  sch.wires.push({id:uid('w'),from:p.dir==='in'?{cid:io,pid:'o'}:{cid:id,pid:p.id},to:p.dir==='in'?{cid:id,pid:p.id}:{cid:io,pid:'i'}});
 }`);
 return {a,reset,width,kind};
}
function literal(n,width){return width===1?`'${Number(n&1n)}'`:`"${n.toString(2).padStart(width,'0')}"`;}
function runVhdl(f,exercise,{synth=false}={}){
 const {a}=f,ports=a.json('schPortList(activeSch())'),decls=ports.map(p=>`signal s_${p.id}:${p.width===1?'std_logic':`std_logic_vector(${p.width-1} downto 0)`}${p.dir==='in'?` := ${p.width===1?"'0'":"(others=>'0')"}`:''};`).join('\n');
 const tb=`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${decls}begin u:entity work.top port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process begin ${exercise} wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'register-module-'));
 try{const bundle=a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n');fs.writeFileSync(path.join(dir,'bundle.vhd'),bundle+(synth?'':tb));
 execFileSync('ghdl',['-a','--std=08','bundle.vhd'],{cwd:dir,stdio:'pipe'});
 if(synth)return execFileSync('ghdl',['--synth','--std=08','top'],{cwd:dir,stdio:'pipe'}).toString();
 execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=1000ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('imported register pack previews leave project/history/ids unchanged',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN'),idx=a.run('state.history.idx');
 assert.deepEqual(a.json('paletteEntries().filter(e=>e.type.startsWith("CUSTOM:ss_reg_")).map(e=>e.type)'),kinds.map(k=>'CUSTOM:ss_reg_'+k.toLowerCase()));
 for(const kind of kinds){a.ctx.kind=kind;a.run("{const draft=makePlacementDraft('CUSTOM:ss_reg_'+kind.toLowerCase(),0,0);validatePlacementParams(draft.type,draft.params);getPorts(draft);componentParamFields(draft);}");}
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);assert.equal(a.run('state.history.idx'),idx);
 assert.match(a.run('paletteEntries("SIPO").map(e=>e.td.label).join(",")'),/SIPO/);
});
test('imported source is shared, widths are independent and placement is one Undo/Redo transaction',()=>{
 const a=loadApp(),before=a.run('serialize()');a.run("const small=addComp('CUSTOM:ss_reg_pipo',0,0,{generic_WIDTH:8}),large=addComp('CUSTOM:ss_reg_pipo',200,0,{generic_WIDTH:64});");
 assert.equal(a.run('Object.keys(state.project.customs).length'),5);assert.equal(a.run('getPort(comp(small),"q").width'),8);assert.equal(a.run('getPort(comp(large),"q").width'),64);
 const after=a.run('serialize()');a.run('undo();undo()');assert.equal(a.run('serialize()'),before);a.run('redo();redo()');assert.equal(a.run('serialize()'),after);
 assert.deepEqual(a.json('Object.keys(generateAllVhdl())'),['top','ss_reg_pipo']);
 assert.equal(a.run('paletteEntries().filter(e=>e.type==="CUSTOM:ss_reg_pipo").length'),1);
});
test('invalid widths preserve IDs and duplicate file imports preserve existing source',()=>{
 const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN');for(const width of [0,65,1.5]){a.ctx.width=width;assert.throws(()=>a.run("addComp('CUSTOM:ss_reg_pipo',0,0,{generic_WIDTH:width})"));}
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 a.run('state.project.customs.ss_reg_pipo={name:"ss_reg_pipo",ports:[],vhdl:"different"};');const collision=a.run('serialize()');assert.throws(()=>a.run("applyCustomPackages([pack])"),/ชื่อซ้ำ/);assert.equal(a.run('serialize()'),collision);
});
test('optional enable/reset/shift inputs emit documented defaults without fallback warnings',()=>{
 const a=loadApp();a.run(`const sch=activeSch(),clk=addComp('IN',0,0,{name:'clk'}),si=addComp('IN',0,50,{name:'serial'}),reg=addComp('CUSTOM:ss_reg_sipo',200,0),out=addComp('OUT',400,0,{name:'result',width:8});for(const [f,p,t,q]of[[clk,'o',reg,'clk'],[si,'o',reg,'si'],[reg,'q',out,'i']])sch.wires.push({id:uid('w'),from:{cid:f,pid:p},to:{cid:t,pid:q}});`);
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).warns'),[]);
 assert.match(a.run('generateSchVhdl(activeSch()).code'),/en => '1'/);assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err"||i.lvl==="warn")'),[]);
 a.run(`const j=addComp('JUNCTION',300,200);sch.wires.push({id:uid('w'),from:{cid:j,pid:'j'},to:{cid:reg,pid:'en'}});`);
 assert.ok(a.json('generateSchVhdl(activeSch()).fallbacks').some(f=>f.pid==='en'));assert.ok(a.json('runSynthesis()').some(i=>/ปลายลอย/.test(i.msg)));
});
test('missing clock and dynamic asynchronous reset values produce specific diagnostics',()=>{
 const a=loadApp();a.run("addComp('CUSTOM:ss_reg_siso',0,0)");assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 const f=fixture('PIPO',8,{generic_RESET_ASYNC:1});f.a.run(`const input=addComp('IN',0,300,{name:'dynamic_reset',width:8});const w=activeSch().wires.find(w=>w.to.cid===id&&w.to.pid==='reset_value');w.from={cid:input,pid:'o'};`);
 assert.match(f.a.run('registerAsyncResetIssue(reg,activeSch())'),/CONST/);assert.ok(f.a.json('runSynthesis()').some(i=>i.lvl==='err'&&/Asynchronous reset_value/.test(i.msg)));
 f.a.run('reg.params.generic_RESET_ASYNC=0');assert.equal(f.a.run('registerAsyncResetIssue(reg,activeSch())'),'');
});
test('Schematic Text previews imported modules purely and imports with a single Undo',()=>{
 const a=loadApp();a.ctx.text=`format schematic-text 1\ncircuit reg_demo\ninput clk, serial\noutput result[64]\nuse "CUSTOM:ss_reg_sipo" as shiftreg\npart reg @shiftreg generic_WIDTH=64 generic_DIR_RIGHT=1\nconnect clk -> reg.clk\nconnect serial -> reg.si\nconnect reg.q -> result`;
 const before=a.run('serialize()'),uid=a.run('_uidN');a.run('compileSchematicText(text)');assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 assert.match(a.run('schematicTextCatalog(["CUSTOM:ss_reg_sipo"])'),/unconnected-input-defaults/);assert.match(a.run('schematicTextCatalog(["CUSTOM:ss_reg_sipo"])'),/generic_WIDTH/);
 a.run('importSchematicText(text)');assert.equal(a.run('activeSch().components.find(c=>c.label==="reg").type'),'CUSTOM:ss_reg_sipo');assert.equal(a.run('activeSch().components.find(c=>c.label==="reg").params.generic_WIDTH'),64);
 const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.text=a.ctx.text.replace('generic_DIR_RIGHT=1','generic_RESET_ASYNC=1').replace('input clk, serial','input clk, serial, dynamic[64]').replace('connect clk -> reg.clk','connect clk -> reg.clk\nconnect dynamic -> reg.reset_value');const current=a.run('serialize()');assert.throws(()=>a.run('importSchematicText(text)'),/CONST/);assert.equal(a.run('serialize()'),current);
});
test('portable register packages and saved projects retain source, settings and default inputs',()=>{
 const a=loadApp();a.run("const id=addComp('CUSTOM:ss_reg_universal',0,0,{generic_WIDTH:64,generic_EDGE_FALLING:1});const saved=serialize();deserialize(saved);const cc=state.project.customs.ss_reg_universal;const pkg={type:'schstudio-custom-pkg',customs:{ss_reg_universal:cc}};const staged=planCustomPackageImport(pkg,{schematics:{},customs:{}});");
 assert.equal(a.run('getPort(comp(id),"q").width'),64);assert.equal(a.run('staged.ss_reg_universal.vhdl'),a.run('cc.vhdl'));assert.equal(a.run('staged.ss_reg_universal.defaultInputs.en'),1);
 a.run('cc.defaultInputs.clk=2');assert.throws(()=>a.run('validateVhdlModules(state.project)'),/ค่า input/);
});
for(const kind of kinds)for(const width of [1,8,64])for(const right of ['SIPO','PISO','SISO'].includes(kind)?[0,1]:[0])test(`GHDL ${kind} ${width}-bit ${right?'right/LSB':'left/MSB'} loads, holds, shifts and resets`,{skip:!ghdl},()=>{
 const f=fixture(kind,width,['SIPO','PISO','SISO'].includes(kind)?{generic_DIR_RIGHT:right}:{}),mask=(1n<<BigInt(width))-1n,pattern=width===1?0n:width===8?0x69n:0x8123456789ABCDEFn;
 const pulse="s_clk<='1';wait for 1 ns;s_clk<='0';wait for 1 ns;";
 const read=n=>kind==='SISO'?`assert s_so=${literal(right?n&1n:(n>>BigInt(width-1))&1n,1)} severity failure;`:`assert s_q=${literal(n,width)} severity failure;`;
 let ex=`wait for 1 ns;${read(0n)}s_en<='0';s_rst<='1';wait for 1 ns;${read(0n)}${pulse}${read(f.reset)}s_rst<='0';`;
 if(['PIPO','PISO','UNIVERSAL'].includes(kind))ex+=`s_d<=${literal(pattern,width)};`;
 if(kind==='PISO')ex+="s_load<='1';";if(kind==='UNIVERSAL')ex+='s_mode<="11";';
 ex+=`${pulse}${read(f.reset)}s_en<='1';`;
 if(kind==='PIPO')ex+=`${pulse}${read(pattern)}s_en<='0';s_d<=${literal(mask,width)};${pulse}${read(pattern)}`;
 else if(kind==='PISO'){
  ex+=`${pulse}${read(pattern)}s_load<='0';s_si<='0';`;
  for(let i=0;i<width;i++){const bit=right?(pattern>>BigInt(i))&1n:(pattern>>BigInt(width-1-i))&1n;ex+=`assert s_so=${literal(bit,1)} severity failure;${pulse}`;}
  ex+=read(0n);
 }else if(kind==='SIPO'||kind==='SISO'){
  for(let i=0;i<width;i++){const bit=right?(pattern>>BigInt(i))&1n:(pattern>>BigInt(width-1-i))&1n;ex+=`s_si<=${literal(bit,1)};${pulse}`;}
  ex+=read(pattern);
  if(kind==='SISO'){ex+="s_si<='0';";for(let i=0;i<width;i++){const bit=right?(pattern>>BigInt(i))&1n:(pattern>>BigInt(width-1-i))&1n;ex+=`assert s_so=${literal(bit,1)} severity failure;${pulse}`;}}
 }else{
  ex+=`${pulse}${read(pattern)}s_mode<="00";s_d<=${literal(mask,width)};${pulse}${read(pattern)}s_mode<="01";s_si_left<='1';${pulse}${read(((pattern<<1n)|1n)&mask)}s_mode<="10";s_si_right<='0';${pulse}${read((((pattern<<1n)|1n)&mask)>>1n)}`;
 }
 assert.deepEqual(f.a.json('generateSchVhdl(activeSch()).fallbacks'),[]);runVhdl(f,ex);
});
for(const kind of kinds)test(`GHDL ${kind} asynchronous reset dominates enable and falling clock, with a 64-bit reset value`,{skip:!ghdl},()=>{
 const f=fixture(kind,64,{generic_RESET_ASYNC:1,generic_EDGE_FALLING:1});
 const read=kind==='SISO'?"assert s_so='1' severity failure;":`assert s_q=${literal(f.reset,64)} severity failure;`;
 runVhdl(f,`s_en<='0';s_rst<='1';wait for 1 ns;${read}s_rst<='0';s_clk<='1';wait for 1 ns;${read}s_clk<='0';wait for 1 ns;${read}`);
 assert.match(runVhdl(f,'',{synth:true}),/architecture/i);
});
test('GHDL PIPO ignores rising edge when configured for falling edge',{skip:!ghdl},()=>{
 const f=fixture('PIPO',8,{generic_EDGE_FALLING:1});runVhdl(f,`s_en<='1';s_d<="01011010";wait for 1 ns;s_clk<='1';wait for 1 ns;assert s_q="00000000" severity failure;s_clk<='0';wait for 1 ns;assert s_q="01011010" severity failure;`);
});
