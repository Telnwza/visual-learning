const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
let hasGhdl=true;try{execFileSync('ghdl',['--version']);}catch{hasGhdl=false;}
function circuit(build){
 const a=loadApp();a.run(`const sch=activeSch();
 function c(type,params={},label=''){const n={id:uid('c'),type,x:100*sch.components.length,y:100,params,label};sch.components.push(n);return n;}
 function w(a,p,b,q){sch.wires.push({id:uid('w'),from:{cid:a.id,pid:p},to:{cid:b.id,pid:q},name:''});}
 ${build}`);return a;
}
function simulate(a,signals,maps,exercise,allCode=null){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schematic-wide-'));
 try{
  const code=allCode||a.run('generateSchVhdl(sch).code');
  fs.writeFileSync(path.join(dir,'design.vhd'),code+`\nlibrary ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
 entity tb is end;architecture sim of tb is ${signals} begin
 u:entity work.${a.run('sanId(sch.name)')} port map(${maps});process begin ${exercise} wait;end process;end;`);
  execFileSync('ghdl',['-a','--std=08','design.vhd'],{cwd:dir,stdio:'pipe',timeout:30000});
  execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=200ns'],{cwd:dir,stdio:'pipe',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const widths=[1,5,12,16,31,32,33,53,54,63,64];
test('wide constants retain every bit in literals, JSON, importer and generated behavior',{skip:!hasGhdl},()=>{
 for(const width of widths){
  const value=((1n<<BigInt(width))-1n).toString(16);
  const a=loadApp();a.ctx.text=`format schematic-text 1\ncircuit top\noutput result[${width}]\npart k CONST width=${width} value=${value}\nconnect k.o -> result`;
  a.run('importSchematicText(text);const sch=activeSch();const k=sch.components.find(c=>c.type==="CONST");');
  assert.equal(a.run('constBits(k.params)'),'1'.repeat(width));
  assert.equal(a.run('constHex(k.params)'),value.toUpperCase());
  const saved=a.run('serialize()');assert.ok(saved.includes(`"value": "${value}"`));
  a.ctx.saved=saved;a.run('deserialize(saved)');assert.equal(a.run('constBits(activeSch().components.find(c=>c.type==="CONST").params)'),'1'.repeat(width));
  simulate(a,`signal y:${width===1?'std_logic':`std_logic_vector(${width-1} downto 0)`};`,'result=>y',`wait for 1 ns;assert y=${width===1?"'1'":`"${'1'.repeat(width)}"`} severity failure;`);
 }
 // Low bits must remain exact when a non-nibble width masks the high nibble.
 const a=loadApp();assert.equal(a.run('constBits({width:63,value:"FFFFFFFFFFFFFFFD"})'),'1'.repeat(61)+'01');
 assert.equal(a.run('constHex({width:64,value:"20000000000001"})'),'0020000000000001');
});
test('64-bit gate replication and inversion preserve bit 63 and low bits',{skip:!hasGhdl},()=>{
 const a=circuit(`const x=c('IN',{name:'data_in',width:64}),en=c('IN',{name:'enable',width:1}),g=c('AND',{width:64,inputs:2}),inv=c('NOT',{width:64}),o=c('OUT',{name:'masked',width:64}),n=c('OUT',{name:'inverted',width:64});
 w(x,'o',g,'i0');w(en,'o',g,'i1');w(g,'o',o,'i');w(x,'o',inv,'i0');w(inv,'o',n,'i');`);
 assert.equal(a.run('wireWidth(sch.wires[0],sch)'),64);
 simulate(a,"signal en:std_logic:='0';signal y,z:std_logic_vector(63 downto 0);",'data_in=>x"8000000000000001",enable=>en,masked=>y,inverted=>z',
 'wait for 1 ns;assert y=x"0000000000000000" and z=x"7FFFFFFFFFFFFFFE" severity failure;en<=\'1\';wait for 1 ns;assert y=x"8000000000000001" severity failure;');
});
for(const channels of [32,64])test(`${channels}-channel MUX selects full 64-bit data, including last channel`,{skip:!hasGhdl},()=>{
 const sw=Math.log2(channels),a=circuit(`const m=c('MUX',{inputs:${channels},width:64,selectMode:'bus'}),s=c('IN',{name:'sel',width:${sw}}),o=c('OUT',{name:'result',width:64});
 for(let i=0;i<${channels};i++){const k=c('CONST',{width:64,value:(0x8000000000000000n+BigInt(i)).toString(16)});w(k,'o',m,'d'+i);}w(s,'o',m,'s');w(m,'y',o,'i');`);
 assert.deepEqual(a.json('runSynthesis().filter(x=>x.lvl==="err")'),[]);
 simulate(a,`signal s:std_logic_vector(${sw-1} downto 0);signal y:std_logic_vector(63 downto 0);`,'sel=>s,result=>y',
 `for i in 0 to ${channels-1} loop s<=std_logic_vector(to_unsigned(i,${sw}));wait for 1 ns;assert y=std_logic_vector(unsigned'(x"8000000000000000")+to_unsigned(i,64)) severity failure;end loop;s<=(others=>'X');wait for 1 ns;assert y=x"0000000000000000" severity failure;`);
});
for(const channels of [32,64])test(`${channels}-channel DEMUX distributes 64-bit words`,{skip:!hasGhdl},()=>{
 const sw=Math.log2(channels),a=circuit(`const m=c('DEMUX',{outputs:${channels},width:64,inputMode:'bus',outputMode:'bus',selectMode:'bus'}),s=c('IN',{name:'sel',width:${sw}}),d=c('IN',{name:'data_in',width:64});w(s,'o',m,'s');w(d,'o',m,'d');
 for(let i=0;i<${channels};i++){const o=c('OUT',{name:'out'+i,width:64});w(m,'y'+i,o,'i');}`);
 simulate(a,`signal s:std_logic_vector(${sw-1} downto 0);${Array.from({length:channels},(_,i)=>`signal y${i}:std_logic_vector(63 downto 0);`).join('')}`,
 `sel=>s,data_in=>x"8000000000000001",${Array.from({length:channels},(_,i)=>`out${i}=>y${i}`).join(',')}`,
 `for i in 0 to ${channels-1} loop s<=std_logic_vector(to_unsigned(i,${sw}));wait for 1 ns;${Array.from({length:channels},(_,j)=>`if i=${j} then assert y${j}=x"8000000000000001" severity failure;else assert y${j}=x"0000000000000000" severity failure;end if;`).join('')}end loop;`);
});
for(const channels of [32,64])for(const mode of ['bus','pins'])test(`${channels}-channel ${mode} encoder/decoder retains highest-index priority and enable`,{skip:!hasGhdl},()=>{
 const sw=Math.log2(channels),a=circuit(`const e=c('ENC',{inputs:${channels},inputMode:'${mode}',outputMode:'bus'}),d=c('DEC',{outputs:${channels},inputMode:'bus',outputMode:'${mode}'}),x=c('IN',{name:'data_in',width:${channels}}),en=c('IN',{name:'enable',width:1}),encoded=c('OUT',{name:'code_out',width:${sw}}),o=c('OUT',{name:'decoded',width:${channels}});
 if('${mode}'==='bus'){w(x,'o',e,'i');w(d,'y',o,'i');}
 else{const bus=c('JUNCTION');w(bus,'j',o,'i');for(let i=0;i<${channels};i++){
 const split=c('BUSTAP',{bit:i,nbit:1,dir:'right',mode:'split'}),merge=c('BUSTAP',{bit:i,nbit:1,dir:'right',mode:'merge'});w(x,'o',split,'d');w(split,'y',e,'i'+i);w(d,'y'+i,merge,'y');w(bus,'j',merge,'d');}}
 w(e,'y',encoded,'i');w(e,'y',d,'a');w(en,'o',d,'en');`);
 simulate(a,`signal x,y:std_logic_vector(${channels-1} downto 0);signal code:std_logic_vector(${sw-1} downto 0);signal en:std_logic:='1';`,
 'data_in=>x,enable=>en,code_out=>code,decoded=>y',
 `for i in 0 to ${channels-1} loop x<=std_logic_vector(shift_left(to_unsigned(1,${channels}),i));wait for 1 ns;assert unsigned(code)=i and y=x severity failure;end loop;
 x<=(others=>'1');wait for 1 ns;assert unsigned(code)=${channels-1} and y=std_logic_vector(shift_left(to_unsigned(1,${channels}),${channels-1})) severity failure;
 en<='0';wait for 1 ns;assert y=(${channels-1} downto 0=>'0') severity failure;`);
});
test('unsigned bus comparisons support 1–64 bits and retain upper-bit ordering',{skip:!hasGhdl},()=>{
 for(const width of widths){
  const a=circuit(`const x=c('IN',{name:'a_in',width:${width}}),y=c('IN',{name:'b_in',width:${width}}),e=c('COMP',{width:${width},pinMode:'bus'}),m=c('COMPM',{width:${width},pinMode:'bus'});
 for(const g of [e,m]){w(x,'o',g,'a');w(y,'o',g,'b');}for(const [g,pid] of [[e,'eq'],[m,'gt'],[m,'lt']]){const o=c('OUT',{name:pid+'_out',width:1});w(g,pid,o,'i');}`);
  const st=width===1?'std_logic':`std_logic_vector(${width-1} downto 0)`,hi=width===1?"'1'":`"1${'0'.repeat(width-1)}"`,lo=width===1?"'0'":`"0${'1'.repeat(width-1)}"`;
  simulate(a,`signal a,b:${st};signal eq,gt,lt:std_logic;`,'a_in=>a,b_in=>b,eq_out=>eq,gt_out=>gt,lt_out=>lt',
  `a<=${hi};b<=${lo};wait for 1 ns;assert gt='1' and lt='0' and eq='0' severity failure;b<=${hi};wait for 1 ns;assert eq='1' and gt='0' and lt='0' severity failure;a<=${lo};wait for 1 ns;assert lt='1' severity failure;`);
 }
});
test('64-bit per-bit comparator and Bus Tap literal slices retain the high bit',{skip:!hasGhdl},()=>{
 const a=circuit(`const m=c('COMPM',{width:64,pinMode:'pins'}),o=c('OUT',{name:'greater',width:1}),k=c('CONST',{width:64,value:'8000000000000001'});
 for(let i=0;i<64;i++){const t=c('BUSTAP',{bit:i,nbit:1,mode:'split',dir:'right'}),b=c('CONST',{width:1,value:i===63?'0':'1'});w(k,'o',t,'d');w(t,'y',m,'a'+i);w(b,'o',m,'b'+i);}w(m,'gt',o,'i');
 const t=c('BUSTAP',{bit:32,nbit:32,mode:'split',dir:'right'}),h=c('OUT',{name:'upper',width:32});w(k,'o',t,'d');w(t,'y',h,'i');`);
 simulate(a,'signal gt:std_logic;signal hi:std_logic_vector(31 downto 0);','greater=>gt,upper=>hi',`wait for 1 ns;assert gt='1' and hi=x"80000000" severity failure;`);
});
test('Bus Tap builds a 64-bit bus and allocates the final range without wrapping',{skip:!hasGhdl},()=>{
 const a=circuit(`const bus=c('JUNCTION'),o=c('OUT',{name:'result',width:64});w(bus,'j',o,'i');
 for(const [bit,value] of [[0,'00000001'],[32,'80000000']]){const k=c('CONST',{width:32,value}),t=c('BUSTAP',{bit,nbit:32,mode:'merge',dir:'right'});w(k,'o',t,'y');w(bus,'j',t,'d');}`);
 assert.deepEqual(a.json('runSynthesis().filter(x=>x.lvl==="err")'),[]);
 simulate(a,'signal y:std_logic_vector(63 downto 0);','result=>y',`wait for 1 ns;assert y=x"8000000000000001" severity failure;`);
 assert.equal(a.run('nextTapRange(64,63,1,"up",new Set())'),63);
 assert.equal(a.run('nextTapRange(64,64,1,"up",new Set())'),null);
 assert.equal(a.run('nextTapRange(64,32,32,"up",new Set())'),32);
 assert.equal(a.run('nextTapRange(64,33,32,"up",new Set())'),null);
});
test('wide JSON import/open preserves strings and rejects unsupported data dimensions atomically',()=>{
 const a=circuit(`const k=c('CONST',{width:64,value:'FFFFFFFFFFFFFFFF'}),o=c('OUT',{name:'result',width:64});w(k,'o',o,'i');`);
 const saved=a.run('serialize()');a.ctx.saved=saved;a.run('deserialize(saved)');
 const before=a.run('serialize()');
 for(const width of [0,65,1.5]){
  const data=JSON.parse(saved);data.project.schematics[data.project.topId].components[0].params.width=width;a.ctx.bad=data.project;
  assert.throws(()=>a.run('importProjectData(bad,{mode:"new"})'),/อยู่นอกช่วง/);assert.equal(a.run('serialize()'),before);
  a.ctx.badFile=JSON.stringify({version:1,project:data.project});assert.throws(()=>a.run('deserialize(badFile)'),/อยู่นอกช่วง/);assert.equal(a.run('serialize()'),before);
 }
 a.ctx.text='format schematic-text 1\ncircuit bad\ninput x[65]';assert.throws(()=>a.run('compileSchematicText(text)'),/1–64/);
 a.ctx.text='format schematic-text 1\ncircuit bad\npart k CONST width=63 value=FFFFFFFFFFFFFFFF';assert.throws(()=>a.run('compileSchematicText(text)'),/เกินความกว้าง/);
});
test('large channel bus symbols are compact; data width and channels remain separate',()=>{
 const a=loadApp();
 for(const type of ['ENC','DEC']){
  a.ctx.type=type;assert.ok(a.run('getSize({type,params:{inputs:64,outputs:64,inputMode:"bus",outputMode:"bus"}}).h')<200);
  const ports=a.json('getPorts({type,params:{inputs:64,outputs:64,inputMode:"bus",outputMode:"bus"}})');
  assert.equal(new Set(ports.map(p=>p.dx+','+p.dy)).size,ports.length);
 }
 assert.equal(a.run('getPort({type:"MUX",params:{inputs:64,width:12,selectMode:"bus"}},"s").width'),6);
 assert.equal(a.run('getPort({type:"MUX",params:{inputs:64,width:12,selectMode:"bus"}},"d63").width'),12);
});
test('nested 64-bit interfaces compile, simulate and round-trip through workspace JSON',{skip:!hasGhdl},()=>{
 const a=circuit(`const child=blankSchematic(uid('sch'),'wide_child');state.project.schematics[child.id]=child;
 const x={id:uid('c'),type:'IN',x:0,y:0,params:{name:'child_in',width:64}},g={id:uid('c'),type:'BUF',x:200,y:0,params:{width:64}},o={id:uid('c'),type:'OUT',x:400,y:0,params:{name:'child_out',width:64}};
 child.components.push(x,g,o);child.wires.push({id:uid('w'),from:{cid:x.id,pid:'o'},to:{cid:g.id,pid:'i0'},name:''},{id:uid('w'),from:{cid:g.id,pid:'o'},to:{cid:o.id,pid:'i'},name:''});
 const input=c('IN',{name:'data_in',width:64}),block=c('SCH:'+child.id,{}),output=c('OUT',{name:'result',width:64});w(input,'o',block,'child_in');w(block,'child_out',output,'i');`);
 const code=Object.values(a.json('generateAllVhdl()')).map(r=>typeof r==='string'?r:r.code).join('\n');
 simulate(a,'signal y:std_logic_vector(63 downto 0);','data_in=>x"FEDCBA9876543211",result=>y',`wait for 1 ns;assert y=x"FEDCBA9876543211" severity failure;`,code);
 const saved=a.run('serialize()');a.ctx.saved=saved;a.run('deserialize(saved)');
 assert.equal(a.run('getPort(activeSch().components.find(c=>c.type.startsWith("SCH:")),"child_in").width'),64);
 assert.deepEqual(a.json('runSynthesis().filter(x=>x.lvl==="err")'),[]);
});
