const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const base=path.join(__dirname,'../fpga-exam-kit/modules');
const groups=['arithmetic','comparison','encoding','conversion','formatting'];
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
function run(a,exercise,{synth=false}={}){
 const ports=a.json('schPortList(activeSch())'),entity=a.run('sanId(activeSch().name)');
 const declarations=ports.map(p=>`signal s_${p.id}:${p.width===1?'std_logic':`std_logic_vector(${p.width-1} downto 0)`}${p.dir==='in'?` := ${p.width===1?"'0'":"(others=>'0')"}`:''};`).join('\n');
 const tb=`library ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is ${declarations} begin u:entity work.${entity} port map(${ports.map(p=>p.id+'=>s_'+p.id).join(',')});process begin wait for 1 ns;${exercise}wait;end process;end;`;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'phase7-module-'));
 try{
  fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+(synth?'':tb));
  const exec=args=>{try{return execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000,maxBuffer:32*1024*1024}).toString();}catch(e){e.message+='\n'+e.stdout?.toString().slice(-4000)+'\n'+e.stderr?.toString().slice(-4000);throw e;}};
  exec(['-a','--std=08','bundle.vhd']);if(synth)return exec(['--synth','--std=08',entity]);
  exec(['-e','--std=08','tb']);exec(['-r','--std=08','tb','--assert-level=error','--stop-time=100000ns']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const group of groups)for(const cc of Object.values(packs[groups.indexOf(group)].customs))test(`${cc.name}: independent package imports with exact matching source and Undo`,()=>{
 const a=loadApp(),before=a.run('serialize()'),individual=JSON.parse(fs.readFileSync(path.join(base,group,cc.name+'.sccomp.json'),'utf8'));
 assert.equal(fs.readFileSync(path.join(base,group,cc.fileName),'utf8'),cc.vhdl);assert.deepEqual(individual.customs[cc.name],cc);
 a.ctx.individual=individual;assert.equal(a.run('applyCustomPackages([individual])'),1);const after=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.file={fileName:cc.fileName,vhdl:cc.vhdl};assert.deepEqual(a.json('parseVhdlModuleFile(file).ports'),cc.ports);
});
test('Phase 7 imports atomically and validates widths/choices without preinstalled sources',()=>{
 const a=imported(),before=a.run('serialize()');assert.equal(a.run('Object.keys(state.project.customs).length'),16);
 assert.throws(()=>a.run('applyCustomPackages(packs)'),/ชื่อซ้ำ/);const uid=a.run('_uidN');
 for(const name of Object.keys(definitions)){a.ctx.name=name;a.run("{const d=makePlacementDraft('CUSTOM:'+name,0,0);validatePlacementParams(d.type,d.params);getPorts(d);componentParamFields(d);}");}
 for(const [name,params]of [['ss_add_sub',{generic_WIDTH:65}],['ss_bitwise',{generic_OPERATION:7}],['ss_priority_encoder',{generic_INPUTS:65}],['ss_bin_to_bcd',{generic_DIGITS:21}],['ss_number_formatter',{generic_DIGITS:3,generic_FRACTION_DIGITS:4}]]){a.ctx.name=name;a.ctx.params=params;assert.throws(()=>a.run("addComp('CUSTOM:'+name,0,0,params)"));}
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);
 const empty=loadApp();assert.equal(empty.run('Object.keys(state.project.customs).length'),0);
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),/entity ss_(?:add_sub|divide|bin_to_bcd|number_formatter)/);
});
test('settings, split ports, notes and clock requirements survive save/reload and source replacement',()=>{
 const a=imported();a.run("const narrow=addComp('CUSTOM:ss_multiply',0,0,{generic_WIDTH:1}),wide=addComp('CUSTOM:ss_multiply',200,0,{generic_WIDTH:64}),div=addComp('CUSTOM:ss_divide',0,200);deserialize(serialize());");
 assert.equal(a.run('getPort(comp(narrow),"result_hi").width'),1);assert.equal(a.run('getPort(comp(wide),"result_hi").width'),64);assert.equal(a.run('getPort(comp(wide),"result_lo").width'),64);
 assert.ok(a.json('runSynthesis()').some(i=>i.lvl==='err'&&/clock/.test(i.msg)));
 a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("ss_divide",state.project.customs.ss_divide.vhdl));');
 assert.equal(a.run('moduleRequiresClock(state.project.customs.ss_divide)'),true);assert.match(a.run('moduleUsageNotes(state.project.customs.ss_divide)'),/busy/);
 assert.match(a.run('componentParamFields(comp(div))'),/two&#39;s complement|two's complement/);
});
test('formatter numeric controls resolve dependent ranges independently for each instance',()=>{
 const a=imported();a.run("const small=addComp('CUSTOM:ss_number_formatter',0,0,{generic_DIGITS:1}),large=addComp('CUSTOM:ss_number_formatter',200,0,{generic_DIGITS:20,generic_FRACTION_DIGITS:20});");
 assert.match(a.run('componentParamFields(comp(small))'),/data-pk="generic_FRACTION_DIGITS" min="0" max="1" value="0"/);
 assert.match(a.run('componentParamFields(comp(large))'),/data-pk="generic_FRACTION_DIGITS" min="0" max="20" value="20"/);
 a.run("const change=planComponentParamChange(activeSch(),comp(small),'generic_DIGITS',5);applyComponentParamChange(activeSch(),comp(small),change);");
 assert.match(a.run('componentParamFields(comp(small))'),/data-pk="generic_FRACTION_DIGITS" min="0" max="5"/);
 assert.throws(()=>a.run("planComponentParamChange(activeSch(),comp(large),'generic_DIGITS',1)"),/FRACTION_DIGITS/);
 a.run('undo()');assert.match(a.run('componentParamFields(comp(small))'),/data-pk="generic_FRACTION_DIGITS" min="0" max="1"/);
});
for(const width of [1,7,32,64])for(const mode of [0,1])for(const sub of [0,1])test(`GHDL add/sub WIDTH=${width} signed=${mode} subtract=${sub}: flags including carry input`,{skip:!ghdl},()=>{
 const a=fixture('ss_add_sub',{generic_WIDTH:width,generic_SIGNED_MODE:mode,generic_SUBTRACT:sub}),m=mask(width),half=1n<<BigInt(width-1);let ex='';
 for(const [x,y]of [[0n,0n],[m,1n],[half-1n,1n],[half,m],[m,m],[0n,m],[half,half]])for(const cin of [0n,1n]){
  const u=sub?x-y-cin:x+y+cin,math=sub?signed(x,width)-signed(y,width)-cin:signed(x,width)+signed(y,width)+cin,result=BigInt.asUintN(width,u);
  ex+=set('a',x,width)+set('b',y,width)+set('cin',cin)+'wait for 1 ns;'+check('y',result,width)+check('carry',!sub&&u>m?1:0)+check('borrow',sub&&u<0n?1:0)+check('overflow',mode&&(math< -half||math>=half)?1:0)+check('zero',result===0n?1:0)+check('negative',mode&&signed(result,width)<0n?1:0);
 }run(a,ex);
});
for(const width of [1,7,32,64])for(const mode of [0,1])test(`GHDL full multiply WIDTH=${width} signed=${mode} preserves both halves`,{skip:!ghdl},()=>{
 const a=fixture('ss_multiply',{generic_WIDTH:width,generic_SIGNED_MODE:mode}),m=mask(width),half=1n<<BigInt(width-1);let ex='';
 for(const [x,y]of [[0n,m],[m,m],[half,half],[half,m],[half-1n,3n&m],[1n,1n]]){
  const product=(mode?signed(x,width):x)*(mode?signed(y,width):y),bits=BigInt.asUintN(2*width,product);
  ex+=set('a',x,width)+set('b',y,width)+'wait for 1 ns;'+check('result_lo',bits&m,width)+check('result_hi',bits>>BigInt(width),width)+check('overflow',mode?(product< -half||product>=half?1:0):(product>m?1:0))+check('zero',product===0n?1:0)+check('negative',mode&&product<0n?1:0);
 }run(a,ex);
});
for(const width of [1,7,32,64])for(const mode of [0,1])test(`GHDL divide WIDTH=${width} signed=${mode}: latency, pause, capture, ignored busy-start and errors`,{skip:!ghdl},()=>{
 const a=fixture('ss_divide',{generic_WIDTH:width,generic_SIGNED_MODE:mode}),m=mask(width),half=1n<<BigInt(width-1);let ex=set('rst',1)+pulse+set('rst',0);
 for(const [x,y]of [[m,3n&m],[half,m],[m,half],[half-1n,2n&m],[m,0n],[0n,1n],[half,1n]]){
  const aa=mode?signed(x,width):x,bb=mode?signed(y,width):y,byzero=bb===0n,ov=mode&&aa===-half&&bb===-1n;
  ex+=set('a',x,width)+set('b',y,width)+set('start',1)+set('en',0)+pulse+check('valid',0)+check('divide_by_zero',byzero?1:0)+check('overflow',ov?1:0);
  if(byzero||ov)ex+=check('busy',0)+check('done',1)+check('quotient',ov?x:0n,width)+check('remainder',byzero?x:0n,width)+set('start',0);
  else{
   ex+=check('busy',1)+check('done',0)+set('start',0)+set('a',0,width)+set('b',1,width)+pulse+check('busy',1)+check('done',0)+set('en',1)+set('start',1);
   for(let i=0;i<width;i++){ex+=pulse+check('busy',i===width-1?0:1)+check('done',i===width-1?1:0);if(i===0)ex+=set('start',0);}
   ex+=check('quotient',aa/bb,width)+check('remainder',aa%bb,width)+check('valid',1)+check('zero',aa/bb===0n?1:0)+check('negative',mode&&aa/bb<0n?1:0);
  }
  ex+=set('en',0)+pulse+check('done',0);
 }
 ex+=set('a',0,width)+set('b',1,width)+set('start',1)+pulse+check('busy',1)+set('rst',1)+pulse+check('busy',0)+check('valid',0)+check('quotient',0,width)+check('remainder',0,width);
 run(a,ex);
});
for(const width of [1,7,64])for(const mode of [0,1])for(const op of [0,1])test(`GHDL unary WIDTH=${width} signed=${mode} operation=${op}: minimum and zero`,{skip:!ghdl},()=>{
 const a=fixture('ss_unary',{generic_WIDTH:width,generic_SIGNED_MODE:mode,generic_OPERATION:op}),m=mask(width),half=1n<<BigInt(width-1);let ex='';
 for(const n of [0n,1n,m,half,half-1n]){const v=mode?signed(n,width):n,math=op===0?-v:v<0n?-v:v,result=BigInt.asUintN(width,math);
 ex+=set('d',n,width)+'wait for 1 ns;'+check('y',result,width)+check('overflow',mode?(math< -half||math>=half?1:0):(math<0n||math>m?1:0))+check('zero',result===0n?1:0)+check('negative',mode&&signed(result,width)<0n?1:0);}
 run(a,ex);
});
for(const op of [0,1,2,3,4,5,6])test(`GHDL bitwise operation=${op}, WIDTH=64`,{skip:!ghdl},()=>{
 const a=fixture('ss_bitwise',{generic_WIDTH:64,generic_OPERATION:op});let ex='';
 for(const [x,y]of [[0n,0n],[0xFEDCBA9876543210n,0x123456789ABCDEFn],[mask(64),mask(64)]]){const expected=[x&y,x|y,x^y,~(x&y),~(x|y),~(x^y),~x][op],r=BigInt.asUintN(64,expected);ex+=set('a',x,64)+set('b',y,64)+'wait for 1 ns;'+check('y',r,64)+check('zero',r===0n?1:0);}run(a,ex);
});
for(const width of [1,7,64])for(const op of [0,1,2,3,4])test(`GHDL shift/rotate WIDTH=${width} operation=${op}: zero, boundary, oversized amount`,{skip:!ghdl},()=>{
 const a=fixture('ss_shift_rotate',{generic_WIDTH:width,generic_OPERATION:op}),n=mask(width)^ (width>1?1n:0n),m=mask(width);let ex='';
 for(const count of [0,1,width,width+1,127]){const c=BigInt(count),r=BigInt(count%width),w=BigInt(width);const expected=[n<<c,n>>c,signed(n,width)>>c,(n<<r)|(n>>(w-r)),(n>>r)|(n<<(w-r))][op]&m;ex+=set('d',n,width)+set('amount',count,7)+'wait for 1 ns;'+check('y',expected,width)+check('zero',expected===0n?1:0);}
 ex+="s_amount<=\"000X000\";wait for 1 ns;assert s_y="+(width===1?"'X'":"(s_y'range=>'X')")+" severity failure;";run(a,ex);
});
for(const width of [1,7,64])test(`GHDL reduction/parity WIDTH=${width} includes unknown-bit behavior`,{skip:!ghdl},()=>{
 const a=fixture('ss_reduce',{generic_WIDTH:width});let ex='';
 for(const n of [0n,1n,mask(width),0x123456789ABCDEFn&mask(width)]){const parity=n.toString(2).split('1').length%2===0?1:0;ex+=set('d',n,width)+'wait for 1 ns;'+check('all_one',n===mask(width)?1:0)+check('any_one',n!==0n?1:0)+check('xor_reduce',parity)+check('even_parity',parity)+check('odd_parity',1-parity);}
 ex+=set('d',0,width)+(width===1?"s_d<='X';":"s_d(0)<='X';")+"wait for 1 ns;assert s_xor_reduce='X' severity failure;";run(a,ex);
});
for(const mode of [0,1])test(`GHDL comparisons signed=${mode}: 64-bit bounds, equality, clamp, ordering`,{skip:!ghdl},()=>{
 const w=64,m=mask(w),half=1n<<63n;
 const c=fixture('ss_compare',{generic_WIDTH:w,generic_SIGNED_MODE:mode}),mm=fixture('ss_min_max',{generic_WIDTH:w,generic_SIGNED_MODE:mode});let ex='',order='';
 for(const [x,y]of [[0n,0n],[m,0n],[half,half-1n],[1n,m],[m,m]]){const aa=mode?signed(x,w):x,bb=mode?signed(y,w):y;ex+=set('a',x,w)+set('b',y,w)+'wait for 1 ns;'+check('eq',aa===bb?1:0)+check('lt',aa<bb?1:0)+check('gt',aa>bb?1:0)+check('le',aa<=bb?1:0)+check('ge',aa>=bb?1:0);order+=set('a',x,w)+set('b',y,w)+'wait for 1 ns;'+check('minimum',aa<bb?x:y,w)+check('maximum',aa<bb?y:x,w);}
 run(c,ex);run(mm,order);
 const clamp=fixture('ss_clamp',{generic_WIDTH:w,generic_SIGNED_MODE:mode}),lo=mode?BigInt.asUintN(w,-5n):3n,hi=5n;ex='';
 for(const n of [0n,lo,hi,m,half]){const nn=mode?signed(n,w):n,l=mode?signed(lo,w):lo,h=hi,r=nn<l?lo:nn>h?hi:n;ex+=set('d',n,w)+set('minimum',lo,w)+set('maximum',hi,w)+'wait for 1 ns;'+check('y',r,w)+check('valid',1)+check('clipped',r!==n?1:0);}
 ex+=set('minimum',hi,w)+set('maximum',lo,w)+'wait for 1 ns;'+check('y',half,w)+check('valid',0)+check('clipped',0);run(clamp,ex);
});
for(const mode of [0,1])for(const includeMin of [0,1])for(const includeMax of [0,1])test(`GHDL range signed=${mode}, endpoints=${includeMin}/${includeMax}`,{skip:!ghdl},()=>{
 const a=fixture('ss_range_check',{generic_WIDTH:8,generic_SIGNED_MODE:mode,generic_INCLUDE_MIN:includeMin,generic_INCLUDE_MAX:includeMax}),lo=mode?251:3,hi=5;let ex='';
 for(const n of [lo,hi,0,4,255]){const val=mode?signed(BigInt(n),8):BigInt(n),l=mode?-5n:3n;ex+=set('d',n,8)+set('minimum',lo,8)+set('maximum',hi,8)+'wait for 1 ns;'+check('bounds_valid',1)+check('within',(includeMin?val>=l:val>l)&&(includeMax?val<=5n:val<5n)?1:0);}
 ex+=set('minimum',hi,8)+set('maximum',lo,8)+'wait for 1 ns;'+check('bounds_valid',0)+check('within',0)+set('minimum',hi,8)+set('maximum',hi,8)+set('d',hi,8)+'wait for 1 ns;'+check('bounds_valid',1)+check('within',includeMin&&includeMax?1:0);run(a,ex);
});
for(const width of [1,7,64])for(const high of [0,1])for(const strict of [0,1])test(`GHDL encoder inputs=${width}, priority=${high}, strict=${strict}`,{skip:!ghdl},()=>{
 const a=fixture('ss_priority_encoder',{generic_INPUTS:width,generic_PRIORITY_HIGH:high,generic_ONE_HOT_ONLY:strict});let ex=set('en',1);
 for(const n of [0n,1n,1n<<BigInt(width-1),mask(width)]){const indexes=Array.from({length:width},(_,i)=>i).filter(i=>n&(1n<<BigInt(i))),valid=indexes.length>0&&(!strict||indexes.length===1),index=valid?(high?indexes.at(-1):indexes[0]):0;ex+=set('d',n,width)+'wait for 1 ns;'+check('code',index,6)+check('valid',valid?1:0)+check('multiple',indexes.length>1?1:0);}
 ex+=set('en',0)+'wait for 1 ns;'+check('code',0,6)+check('valid',0)+check('multiple',0);run(a,ex);
});
for(const width of [1,7,32,64])for(const mode of [0,1])for(const digits of [1,20])test(`GHDL BIN to BCD WIDTH=${width}, signed=${mode}, digits=${digits}`,{skip:!ghdl},()=>{
 const a=fixture('ss_bin_to_bcd',{generic_WIDTH:width,generic_SIGNED_MODE:mode,generic_DIGITS:digits});let ex='';
 for(const n of [0n,1n,mask(width),1n<<BigInt(width-1),mask(width)>>1n,0xFEDCBA9876543210n&mask(width)]){const v=mode?signed(n,width):n,abs=v<0n?-v:v,packed=bcd(abs),ov=abs>=10n**BigInt(digits);ex+=set('d',n,width)+'wait for 1 ns;'+check('bcd_lo',packed,64)+check('bcd_hi',packed>>64n,16)+check('negative',v<0n?1:0)+check('overflow',ov?1:0)+check('valid',ov?0:1);}
 ex+=(width===1?"s_d<='X';":"s_d(0)<='X';")+'wait for 1 ns;'+check('valid',0);run(a,ex);
});
for(const width of [1,7,32,64])for(const mode of [0,1])test(`GHDL BCD to BIN WIDTH=${width}, signed=${mode}: exact range and invalid digits`,{skip:!ghdl},()=>{
 const a=fixture('ss_bcd_to_bin',{generic_WIDTH:width,generic_SIGNED_MODE:mode,generic_DIGITS:20}),half=1n<<BigInt(width-1);let ex='';
 for(const n of [0n,1n,mask(width),half,half-1n,99999999999999999999n])for(const negative of [0,1]){const limit=mode?(negative?half:half-1n):mask(width),ov=n>limit||(!mode&&negative&&n!==0n);ex+=bcdInput(bcd(n))+set('negative',negative)+'wait for 1 ns;'+check('valid',ov?0:1)+check('overflow',ov?1:0)+check('invalid_digit',0)+check('y',ov?0n:negative&&mode?-n:n,width);}
 ex+=bcdInput(0xAn)+'wait for 1 ns;'+check('valid',0)+check('invalid_digit',1)+check('overflow',0)+check('y',0,width)+"s_bcd_hi(15)<='X';wait for 1 ns;"+check('invalid_digit',1);run(a,ex);
});
test('GHDL BCD to BIN enforces configured digit count even when binary result would fit',{skip:!ghdl},()=>{
 run(fixture('ss_bcd_to_bin',{generic_WIDTH:64,generic_DIGITS:1}),bcdInput(0x10n)+'wait for 1 ns;'+check('valid',0)+check('overflow',1)+check('y',0,64));
});
for(const hex of [0,1])for(const upper of [0,1])test(`GHDL nibble ASCII decimal/hex=${hex}, uppercase=${upper}`,{skip:!ghdl},()=>{
 const a=fixture('ss_digit_ascii',{generic_HEX_MODE:hex,generic_UPPERCASE:upper});let ex='';for(let n=0;n<16;n++){const valid=hex||n<10,code=!valid?63:n<10?48+n:(upper?65:97)+n-10;ex+=set('digit',n,4)+'wait for 1 ns;'+check('character',code,8)+check('valid',valid?1:0);}run(a,ex);
});
const textBits=(text,block)=>Array.from({length:8},(_,i)=>BigInt(text.padEnd(32,' ').charCodeAt(block*8+i))<<BigInt(i*8)).reduce((a,b)=>a|b,0n);
function textCheck(text){return Array.from({length:4},(_,i)=>check('text_'+i,textBits(text,i),64)).join('')+check('length',text.length,5);}
for(const [label,params,cases]of [
 ['integer spaces',{generic_DIGITS:3},[[0n,0,1,'  0',1,0],[0x123n,0,1,'123',1,0],[0x1000n,0,1,'###',0,1],[0xABCn,0,1,'???',0,0],[0x12n,0,0,'???',0,0],[0n,1,1,'###',0,1]]],
 ['integer zeros',{generic_DIGITS:3,generic_LEADING_ZERO:1},[[0n,0,1,'000',1,0],[0x12n,0,1,'012',1,0]]],
 ['signed fraction',{generic_DIGITS:5,generic_SIGNED_DISPLAY:1,generic_FRACTION_DIGITS:2},[[0x123n,1,1,'-  1.23',1,0],[0x123n,0,1,'   1.23',1,0],[0n,0,1,'   0.00',1,0]]],
 ['all fractional',{generic_DIGITS:3,generic_FRACTION_DIGITS:3},[[0x123n,0,1,'0.123',1,0],[0n,0,1,'0.000',1,0]]],
 ['twenty digits',{generic_DIGITS:20,generic_SIGNED_DISPLAY:1},[[bcd(mask(64)),0,1,' 18446744073709551615',1,0],[bcd(1n<<63n),1,1,'- 9223372036854775808',1,0]]],
 ['hex uppercase',{generic_DIGITS:16,generic_HEX_MODE:1},[[0xFEDCBA9876543210n,0,1,'FEDCBA9876543210',1,0]]],
 ['hex lowercase',{generic_DIGITS:16,generic_HEX_MODE:1,generic_UPPERCASE:0},[[0xFEDCBA9876543210n,0,1,'fedcba9876543210',1,0]]]
])test(`GHDL number formatter ${label}: ASCII order, padding, sign, decimal point and errors`,{skip:!ghdl},()=>{
 const a=fixture('ss_number_formatter',params);let ex='';for(const [packed,neg,valid,text,outValid,overflow]of cases)ex+=set('digits_lo',packed,64)+set('digits_hi',packed>>64n,16)+set('negative',neg)+set('input_valid',valid)+'wait for 1 ns;'+textCheck(text)+check('valid',outValid)+check('overflow',overflow);run(a,ex);
});
for(const name of Object.keys(definitions))test(`GHDL synthesis of imported ${name}`,{skip:!ghdl},()=>{
 const params=name==='ss_priority_encoder'?{generic_INPUTS:64}:name==='ss_number_formatter'?{generic_DIGITS:20}:name==='ss_digit_ascii'?{generic_HEX_MODE:1}:name==='ss_bin_to_bcd'||name==='ss_bcd_to_bin'?{generic_WIDTH:64,generic_DIGITS:20}:{generic_WIDTH:64};
 if(['ss_add_sub','ss_multiply','ss_divide','ss_unary','ss_compare','ss_range_check','ss_clamp','ss_min_max','ss_bin_to_bcd','ss_bcd_to_bin'].includes(name))params.generic_SIGNED_MODE=1;
 assert.match(run(fixture(name,params),'',{synth:true}),/architecture/i);
});
function example(file){
 const a=imported();a.ctx.text=fs.readFileSync(path.join(base,'examples',file),'utf8');
 a.run('importSchematicText(text);state.project.topId=state.activeId');
 assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 return a;
}
test('GHDL downloadable signed-number example composes BIN/BCD/ASCII with all inputs wired',{skip:!ghdl},()=>{
 const a=example('phase7-signed-number.schtxt');let ex='';
 for(const [value,text]of [[-1234,'- 12.34'],[0,'   0.00'],[-32768,'-327.68'],[32767,' 327.67']]){
  ex+=set('value',value,16)+'wait for 2 ns;'+Array.from({length:4},(_,i)=>check('ascii_'+i,textBits(text,i),64)).join('')+check('length',7,5)+check('valid',1)+check('overflow',0);
 }run(a,ex);
});
test('GHDL downloadable signed-divider64 example completes and exposes divide-by-zero',{skip:!ghdl},()=>{
 const a=example('phase7-divider.schtxt');let ex=set('rst',1)+pulse+set('rst',0)+set('en',1)+set('dividend',-7,64)+set('divisor',3,64)+set('start',1)+pulse+set('start',0)+check('busy',1);
 for(let i=0;i<64;i++)ex+=pulse+check('busy',i===63?0:1)+check('done',i===63?1:0);
 ex+=check('quotient',-2,64)+check('remainder',-1,64)+check('valid',1)+check('divide_by_zero',0)+check('overflow',0)+check('negative',1)+set('divisor',0,64)+set('start',1)+pulse+check('busy',0)+check('done',1)+check('valid',0)+check('divide_by_zero',1)+check('quotient',0,64)+check('remainder',-7,64);
 run(a,ex);
});
