const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const base=path.join(__dirname,'../fpga-exam-kit/modules');
const groups=['seven-segment','lcd','adc'];
const packs=groups.map(g=>JSON.parse(fs.readFileSync(path.join(base,'packs',g+'.sccomp.json'),'utf8')));
const definitions=Object.assign({},...packs.map(p=>p.customs));
let ghdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{ghdl=false;}
const pulse="wait for 1 ns;s_clk<='1';wait for 1 ns;s_clk<='0';wait for 1 ns;";
const lit=(n,w)=>w===1?`'${Number(BigInt.asUintN(w,BigInt(n)))}'`:`"${BigInt.asUintN(w,BigInt(n)).toString(2).padStart(w,'0')}"`;
const set=(p,n,w=1)=>`s_${p}<=${lit(n,w)};`;
const check=(p,n,w=1)=>`assert s_${p}=${lit(n,w)} report "${p} expected ${n}" severity failure;`;
const mask=w=>(1n<<BigInt(w))-1n;
const signed=(n,w)=>BigInt.asIntN(w,n);
const bcd=n=>BigInt('0x'+(n<0n?-n:n).toString());
const bcdInput=n=>set('bcd_lo',n,64)+set('bcd_hi',n>>64n,16);
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
 const tb=`library ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${declarations} begin u:entity work.${entity} port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process ${variables} begin wait for 1 ns;${exercise}report "PHASE8_COMPLETE";wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phase8-module-'));
 try{
  fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+(synth?'':tb));
  const exec=args=>{try{return execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000,maxBuffer:32*1024*1024}).toString();}catch(e){e.message+='\n'+e.stdout?.toString().slice(-4000)+'\n'+e.stderr?.toString().slice(-4000);throw e;}};
  exec(['-a','--std=08','bundle.vhd']);if(synth)return exec(['--synth','--std=08',entity]);
  exec(['-e','--std=08','tb']);const output=exec(['-r','--std=08','tb','--assert-level=error','--stop-time=100000ns']);assert.match(output,/PHASE8_COMPLETE/,'Testbench must complete before stop time');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const group of groups)for(const cc of Object.values(packs[groups.indexOf(group)].customs))test(`${cc.name}: independent package, raw source, dependency closure, Undo and persistence`,()=>{
 const a=loadApp(),before=a.run('serialize()'),individual=JSON.parse(fs.readFileSync(path.join(base,group,cc.name+'.sccomp.json')));
 assert.equal(fs.readFileSync(path.join(base,group,cc.fileName),'utf8'),cc.vhdl);assert.deepEqual(individual.customs[cc.name],cc);
 a.ctx.individual=individual;assert.equal(a.run('applyCustomPackages([individual])'),cc.name==='ss_lcd16x2'?2:1);const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);a.run('deserialize(serialize());validateVhdlModules(state.project)');
 const b=loadApp();b.ctx.files=Object.values(individual.customs).map(c=>({fileName:c.fileName,vhdl:c.vhdl}));b.run('applyVhdlModuleImport(planVhdlModuleImport(files))');assert.equal(b.run('Object.keys(state.project.customs).length'),Object.keys(individual.customs).length);
});
test('Phase 8 metadata exposes bounded choices and required clocks without embedded sources',()=>{
 const a=imported();assert.equal(a.run('Object.keys(state.project.customs).length'),8);const before=a.run('serialize()');assert.throws(()=>a.run('applyCustomPackages(packs)'),/ชื่อซ้ำ/);assert.equal(a.run('serialize()'),before);
 for(const name of Object.keys(definitions)){a.ctx.name=name;a.run("{const d=makePlacementDraft('CUSTOM:'+name,0,0);validatePlacementParams(d.type,d.params);getPorts(d);componentParamFields(d);}");}
 for(const [name,params]of [['ss_sevenseg_scan',{generic_DIGITS:17}],['ss_sevenseg_scan',{generic_SLOT_CYCLES:2}],['ss_sevenseg_decode',{generic_MODE:3}],['ss_adc_sample_valid',{generic_WIDTH:65}],['ss_lcd16x2',{generic_AUTO_REFRESH:2}],['ss_lcd_write',{generic_HIGH_CYCLES:0}]]){a.ctx.name=name;a.ctx.params=params;assert.throws(()=>a.run("addComp('CUSTOM:'+name,0,0,params)"));}
 a.run("const scan=addComp('CUSTOM:ss_sevenseg_scan',0,0,{generic_DIGITS:16});");assert.equal(a.run('getPort(comp(scan),"digit").width'),16);assert.match(a.run('componentParamFields(comp(scan))'),/Active low commons/);assert.match(a.run('componentParamFields(comp(scan))'),/min="3"/);assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("ss_sevenseg_scan",state.project.customs.ss_sevenseg_scan.vhdl));');assert.equal(a.run('moduleRequiresClock(state.project.customs.ss_sevenseg_scan)'),true);
 assert.equal(loadApp().run('Object.keys(state.project.customs).length'),0);assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),/entity ss_(?:lcd|sevenseg|adc|spi_adc)_/);
});
const patterns=[0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F,0x77,0x7C,0x39,0x5E,0x79,0x71];
for(const mode of [0,1,2])for(const low of [0,1])test(`GHDL digit decode MODE=${mode} polarity=${low}: table, dot, blank and unknown`,{skip:!ghdl},()=>{
 let ex='';for(let n=0;n<16;n++)for(const blank of [0,1])for(const dot of [0,1]){const valid=!blank&&(mode||n<10),pattern=valid?(mode===2?0x55:patterns[n]):0;ex+=set('digit',n,4)+set('raw',0x55,7)+set('blank',blank)+set('dot',dot)+'wait for 1 ns;'+check('segment',pattern^(low?127:0),7)+check('dp',(valid?dot:0)^low)+check('valid',valid?1:0);}
 if(mode!==2)ex+='s_digit<="XXXX";s_blank<=\'0\';wait for 1 ns;'+check('valid',0)+check('segment',low?127:0,7);run(fixture('ss_sevenseg_decode',{generic_MODE:mode,generic_ACTIVE_LOW:low}),ex);
});
for(const digits of [1,4,16])for(const hex of [0,1])test(`GHDL pattern packer digits=${digits} hex=${hex}: byte order, masks and unused cells`,{skip:!ghdl},()=>{
 const input=0xFEDCBA9876543210n;let ex='';for(const blank of [0n,mask(digits)]){let result=0n,valid=0n;for(let i=0;i<digits;i++){const n=i,v=!(blank&(1n<<BigInt(i)))&&(hex||n<10);if(v){result|=BigInt(patterns[n]|128)<<BigInt(i*8);valid|=1n<<BigInt(i);}}
 ex+=set('digits_in',input,64)+set('blank',blank,digits)+set('dot',mask(digits),digits)+'wait for 1 ns;'+check('patterns_lo',result,64)+check('patterns_hi',result>>64n,64)+check('valid',valid,digits);}
 run(fixture('ss_sevenseg_digits',{generic_DIGITS:digits,generic_HEX_MODE:hex}),ex);
});
for(const [digits,cycles,segLow,digitLow]of [[1,3,0,0],[4,5,0,1],[16,3,1,0],[4,3,1,1]])test(`GHDL scan ${digits} digits/${cycles} clocks: break-before-make, pulses, snapshot and restart`,{skip:!ghdl},()=>{
 let frame=0n;for(let i=0;i<16;i++)frame|=BigInt(patterns[i]|(i%2?128:0))<<BigInt(i*8);let ex=set('rst',1)+set('en',1)+pulse+set('rst',0)+set('patterns_lo',frame,64)+set('patterns_hi',frame>>64n,64);let held=0;
 for(let tick=0;tick<digits*cycles*2;tick++){const cell=Math.floor(tick/cycles)%digits,phase=tick%cycles;if(phase===1)held=tick>=digits*cycles?0:Number((frame>>BigInt(cell*8))&255n);
 ex+=pulse+check('index',cell,4)+check('digit',(phase>=2?1n<<BigInt(cell):0n)^(digitLow?mask(digits):0n),digits)+check('segment',(held&127)^(segLow?127:0),7)+check('dp',(held>>7)^segLow)+check('slot_tick',phase===0?1:0)+check('frame_tick',tick%(digits*cycles)===0?1:0);if(tick===0)ex+=set('patterns_lo',0,64)+set('patterns_hi',0,64);}
 ex+=set('en',0)+'wait for 1 ns;'+check('digit',digitLow?mask(digits):0n,digits)+check('segment',segLow?127:0,7)+pulse+set('en',1)+pulse+check('index',0,4)+check('frame_tick',1)+check('slot_tick',1);run(fixture('ss_sevenseg_scan',{generic_DIGITS:digits,generic_SLOT_CYCLES:cycles,generic_SEG_ACTIVE_LOW:segLow,generic_DIGIT_ACTIVE_LOW:digitLow}),ex);
});
for(const [setup,high,hold]of [[1,1,1],[2,3,2]])test(`GHDL LCD byte engine ${setup}/${high}/${hold}: captured byte, RS stability, done and reset`,{skip:!ghdl},()=>{
 let ex=set('rst',1)+pulse+set('rst',0)+set('start',1)+set('byte_in',0xA5,8)+set('rs_in',1)+pulse+check('e',0)+check('busy',1)+check('data',0xA5,8)+set('byte_in',0,8)+set('rs_in',0);
 for(let i=1;i<=setup+high+hold;i++)ex+=pulse+check('e',i>=setup&&i<setup+high?1:0)+check('busy',i===setup+high+hold?0:1)+check('done',i===setup+high+hold?1:0)+check('data',0xA5,8)+check('rs',1)+check('rw',0);
 ex+=set('start',0)+pulse+check('done',0)+check('busy',0)+set('start',1)+pulse+set('rst',1)+pulse+check('e',0)+check('busy',0)+check('data',0,8);run(fixture('ss_lcd_write',{generic_SETUP_CYCLES:setup,generic_HIGH_CYCLES:high,generic_HOLD_CYCLES:hold}),ex);
});
const textBits=(text,block)=>Array.from({length:8},(_,i)=>BigInt(text.padEnd(32,' ').charCodeAt(block*8+i))<<BigInt(i*8)).reduce((a,b)=>a|b,0n);
const textSet=(prefix,text)=>Array.from({length:4},(_,i)=>set(prefix+'_'+i,textBits(text,i),64)).join('');
const textCheck=text=>Array.from({length:4},(_,i)=>check('text_'+i,textBits(text,i),64)).join('');
test('GHDL text overlay: row boundary, clipping, zero length, invalid passthrough and disable',{skip:!ghdl},()=>{
 const baseText='0123456789ABCDEFabcdefghijklmnop',field='WXYZ';let ex=textSet('base',baseText)+textSet('field',field)+set('en',1)+set('field_valid',1);
 for(const [offset,length]of [[0,4],[14,4],[16,4],[30,4],[31,0],[1,31]]){const inserted=field.padEnd(32,' ').slice(0,Math.min(length,32-offset)),expected=baseText.slice(0,offset)+inserted+baseText.slice(offset+inserted.length);ex+=set('offset',offset,5)+set('length',length,5)+'wait for 1 ns;'+textCheck(expected)+check('clipped',offset+length>32?1:0)+check('valid',1);}
 ex+=set('field_valid',0)+'wait for 1 ns;'+textCheck(baseText)+check('valid',0)+check('clipped',0)+set('en',0)+'wait for 1 ns;'+textCheck(baseText)+check('valid',1);run(fixture('ss_text_overlay'),ex);
});
for(const auto of [0,1])test(`GHDL LCD 16x2 auto=${auto}: init, two row addresses, 32 cells, coherent frame and enable handshake`,{skip:!ghdl},()=>{
 const text='0123456789ABCDEFabcdefghijklmnop',init=[0x30,0x30,0x30,0x38,0x0C,0x06,0x01];
 const capture=`variable previous:std_logic:='0';variable received:natural:=0;variable frames:natural:=0;`;
 let a=fixture('ss_lcd16x2',{generic_POWERUP_CYCLES:3,generic_INIT_WAIT_CYCLES:2,generic_CLEAR_WAIT_CYCLES:4,generic_STEP_CYCLES:1,generic_AUTO_REFRESH:auto});
 let ex=set('rst',1)+set('en',0)+textSet('text',text)+pulse+set('rst',0);
 ex+=`for k in 0 to 150 loop ${pulse} if previous='1' and s_e='0' then case received is ${init.map((v,i)=>`when ${i}=>${check('data',v,8)}`).join('')} when others=>assert false report "unexpected startup byte" severity failure;end case;${check('rs',0)}received:=received+1;end if;previous:=s_e;exit when s_ready='1';end loop;assert received=7 severity failure;${check('ready',1)}${check('busy',0)}`;
 ex+=set('en',1)+set('update',1)+pulse+set('update',0)+textSet('text','XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')+(auto===0?set('en',0):'');
 const sequence=[{v:0x80,rs:0},...Array.from(text.slice(0,16),c=>({v:c.charCodeAt(0),rs:1})),{v:0xC0,rs:0},...Array.from(text.slice(16),c=>({v:c.charCodeAt(0),rs:1}))];
 ex+=`received:=0;for k in 0 to 400 loop ${pulse}if previous='1' and s_e='0' then case received is ${sequence.map((v,i)=>`when ${i}=>${check('data',v.v,8)}${check('rs',v.rs)}`).join('')}when others=>assert false report "extra frame byte" severity failure;end case;received:=received+1;end if;previous:=s_e;${check('rw',0)}exit when s_done='1';end loop;assert received=34 severity failure;${check('ready',1)}${check('done',1)}${check('busy',0)}`;
 if(auto===0)ex+=`for k in 0 to 10 loop ${pulse}${check('e',0)}${check('done',0)}${check('busy',0)}end loop;`;
 else ex+=`received:=0;for k in 0 to 400 loop ${pulse}if previous='1' and s_e='0' then if received=0 then ${check('data',0x80,8)}${check('rs',0)}elsif received=17 then ${check('data',0xC0,8)}${check('rs',0)}else ${check('data',88,8)}${check('rs',1)}end if;received:=received+1;end if;previous:=s_e;exit when s_done='1';end loop;assert received=34 severity failure;`;
 run(a,ex,{variables:capture});
});
for(const width of [1,12,64])test(`GHDL ADC event adapter WIDTH=${width}: startup suppression, one event, capture and flag clear`,{skip:!ghdl},()=>{
 const value=mask(width);let ex=set('clear_valid',1)+pulse+set('clear_valid',0)+set('sample_in',value,width)+pulse+check('sample_valid',0)+check('valid',0)+set('cs',1)+pulse+check('sample_valid',0)+set('cs',0)+pulse+check('sample_valid',1)+check('valid',1)+check('sample',value,width)+set('sample_in',0,width)+pulse+check('sample_valid',0)+check('sample',value,width)+set('clear_valid',1)+set('cs',1)+pulse+check('valid',0)+check('sample',0,width)+set('clear_valid',0)+set('cs',0)+pulse+check('sample_valid',0);run(fixture('ss_adc_sample_valid',{generic_WIDTH:width}),ex);
});
for(const [name,params]of [['ss_sevenseg_decode',{}],['ss_sevenseg_digits',{generic_DIGITS:16}],['ss_sevenseg_scan',{generic_DIGITS:16,generic_SLOT_CYCLES:3}],['ss_lcd_write',{}],['ss_lcd16x2',{}],['ss_text_overlay',{}],['ss_adc_sample_valid',{generic_WIDTH:64}],['ss_spi_adc_lab',{}]])test(`GHDL synth imported ${name} including dependencies`,{skip:!ghdl},()=>{assert.match(run(fixture(name,params),'',{synth:true}),/entity/i);});
function example(file){
 const a=imported();a.ctx.extra=['conversion','formatting'].map(g=>JSON.parse(fs.readFileSync(path.join(base,'packs',g+'.sccomp.json'))));a.run('applyCustomPackages(extra)');a.ctx.text=fs.readFileSync(path.join(base,'examples',file),'utf8');a.run('importSchematicText(text);state.project.topId=state.activeId');
 assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);return a;
}
test('GHDL BIN→BCD→patterns→scan example: decimal 1234 with independent blank/dot',{skip:!ghdl},()=>{
 const a=example('phase8-sevenseg.schtxt');a.run("const c=activeSch().components.find(c=>c.type==='CUSTOM:ss_sevenseg_scan');c.params.generic_SLOT_CYCLES=3;");let ex=set('rst',1)+set('en',1)+set('value',1234,16)+set('blank',2,4)+set('dot',4,4)+pulse+set('rst',0);
 for(let i=0;i<12;i++){const cell=Math.floor(i/3),pattern=[0x66,0,0xDB,0x06][cell];ex+=pulse+check('common',i%3===2?1<<cell:0,4)+check('overflow',0);if(i%3===2)ex+=check('segment',pattern&127,7)+check('dp',pattern>>7);}
 ex+=set('value',10000,16)+'wait for 1 ns;'+check('overflow',1);run(a,ex);
});
test('GHDL BIN→BCD→formatter→overlay→LCD example renders label and decimal on second row',{skip:!ghdl},()=>{
 const a=example('phase8-number-lcd.schtxt');a.run("const c=activeSch().components.find(c=>c.type==='CUSTOM:ss_lcd16x2');Object.assign(c.params,{generic_POWERUP_CYCLES:1,generic_INIT_WAIT_CYCLES:1,generic_CLEAR_WAIT_CYCLES:1,generic_STEP_CYCLES:1,generic_AUTO_REFRESH:0});");
 // Use a one-shot update from a constant so the first ready frame starts automatically.
 a.run("{const c=activeSch().components.find(c=>c.type==='CUSTOM:ss_lcd16x2'),one=addComp('VCC',0,0);activeSch().wires.push({id:uid('w'),from:{cid:one,pid:'o'},to:{cid:c.id,pid:'update'}});}");
 const text='VALUE:          '+'12345           ',sequence=[0x80,...Array.from(text.slice(0,16),c=>c.charCodeAt(0)),0xC0,...Array.from(text.slice(16),c=>c.charCodeAt(0))];let ex=set('rst',1)+set('en',1)+set('value',12345,16)+pulse+set('rst',0);
 ex+=`for k in 0 to 100 loop ${pulse}exit when s_ready='1';end loop;${check('ready',1)}for k in 0 to 400 loop ${pulse}if previous='1' and s_e='0' then case received is ${sequence.map((v,i)=>`when ${i}=>${check('data',v,8)}${check('rs',i===0||i===17?0:1)}`).join('')}when others=>assert false severity failure;end case;received:=received+1;end if;previous:=s_e;exit when s_done='1';end loop;assert received=34 severity failure;${check('overflow',0)}`;run(a,ex,{variables:"variable previous:std_logic:='0';variable received:natural:=0;"});
});
test('GHDL accepted ADC composition exports/synthesizes without simulating lab internals',{skip:!ghdl},()=>{assert.match(run(example('phase8-adc-sevenseg.schtxt'),'',{synth:true}),/entity/i);});
test('Phase 8 ZIP preserves exact sources/packages and includes every example dependency',()=>{
 const zip=path.join(base,'downloads/phase8-modules.zip'),entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');assert.equal(entries.length,30);assert.equal(new Set(entries).size,entries.length);
 for(const file of entries){assert.ok(!file.startsWith('/')&&!file.includes('..'));if(file==='README.md')assert.match(execFileSync('unzip',['-p',zip,file],{encoding:'utf8'}),/All 45 supplied/);else assert.deepEqual(execFileSync('unzip',['-p',zip,file]),fs.readFileSync(path.join(base,file)));}
 const a=loadApp();a.ctx.payloads=[...groups.map(g=>`packs/${g}.sccomp.json`),'conversion/ss_bin_to_bcd.sccomp.json','formatting/ss_number_formatter.sccomp.json'].map(f=>JSON.parse(execFileSync('unzip',['-p',zip,f])));assert.equal(a.run('applyCustomPackages(payloads)'),10);
 for(const file of entries.filter(f=>f.endsWith('.schtxt'))){a.ctx.text=execFileSync('unzip',['-p',zip,file],{encoding:'utf8'});a.run('importSchematicText(text);state.project.topId=state.activeId');assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);}
 const allPacks=fs.readdirSync(path.join(base,'packs')).filter(f=>f.endsWith('.sccomp.json')&&f!=='compositions.sccomp.json').map(f=>JSON.parse(fs.readFileSync(path.join(base,'packs',f))));const b=loadApp();b.ctx.payloads=allPacks;assert.equal(b.run('applyCustomPackages(payloads)'),45);
});
for(const [name,params]of [['ss_sevenseg_scan',{generic_SLOT_CYCLES:2147483647}],['ss_lcd16x2',{generic_POWERUP_CYCLES:2147483647,generic_INIT_WAIT_CYCLES:2147483647,generic_CLEAR_WAIT_CYCLES:2147483647,generic_STEP_CYCLES:2147483647}]])test(`GHDL ${name} maximum timing counts synthesize without counter-range overflow`,{skip:!ghdl},()=>{assert.match(run(fixture(name,params),'',{synth:true}),/entity/i);});
