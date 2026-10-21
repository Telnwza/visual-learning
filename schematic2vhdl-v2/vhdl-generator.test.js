const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
let hasGhdl=true;try{execFileSync('ghdl',['--version']);}catch{hasGhdl=false;}
function circuit(build){
 const a=loadApp();
 a.run(`let sch=activeSch();
 function c(type,params={},label=''){let n={id:uid('c'),type,x:100*sch.components.length,y:100,params,label};sch.components.push(n);return n;}
 function w(a,p,b,q){sch.wires.push({id:uid('w'),from:{cid:a.id,pid:p},to:{cid:b.id,pid:q},name:''});}
 ${build}`);return a;
}
function compile(code,top='top',tb=''){
 if(!hasGhdl)return;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'schematic-vhdl-'));
 try{fs.writeFileSync(path.join(dir,'design.vhd'),code+'\n'+tb);
  execFileSync('ghdl',['-a','--std=08','design.vhd'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-e','--std=08',top],{cwd:dir,stdio:'pipe'});
  if(tb)execFileSync('ghdl',['-r','--std=08',top,'--assert-level=error','--stop-time=30ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('CONST exact widths, masked low bits, and hex literals compile',()=>{
 for(const [width,value,expected] of [[1,'F',"'1'"],[6,'FF','"111111"'],[8,'0xf4','x"F4"'],[32,'FFFFFFFF','x"FFFFFFFF"']]){
  const a=circuit(`const k=c('CONST',{width:${width},value:'${value}'}),out=c('OUT',{name:'result',width:${width}});w(k,'o',out,'i');`);
  const code=a.run('generateSchVhdl(sch).code');assert.ok(code.includes('<= '+expected+';'));compile(code);
 }
});
test('wide gate replicates a scalar enable, compiles and simulates byte masking',()=>{
 const a=circuit(`const x=c('IN',{name:'data_in',width:8}),en=c('IN',{name:'en',width:1}),g=c('AND',{inputs:2,width:8}),o=c('OUT',{name:'result',width:8});w(x,'o',g,'i0');w(en,'o',g,'i1');w(g,'o',o,'i');`);
 const code=a.run('generateSchVhdl(sch).code');assert.match(code,/std_logic_vector'\(7 downto 0 => en\)/);
 compile(code,'tb',`library ieee; use ieee.std_logic_1164.all;
 entity tb is end; architecture sim of tb is signal en:std_logic:='0'; signal y:std_logic_vector(7 downto 0); begin
 u:entity work.top port map(data_in=>x"A5",en=>en,result=>y);
 process begin wait for 1 ns; assert y=x"00" severity failure; en<='1';wait for 1 ns; assert y=x"A5" severity failure;wait;end process; end;`);
});
test('unconnected wide gate has typed zero operands',()=>{
 const a=circuit(`const g=c('OR',{inputs:2,width:8}),o=c('OUT',{name:'result',width:8});w(g,'o',o,'i');`);compile(a.run('generateSchVhdl(sch).code'));
});
test('Bus Tap splits a range with correct vector type and one bit as a scalar',()=>{
 const a=circuit(`const x=c('IN',{name:'data_in',width:8}),t=c('BUSTAP',{bit:4,nbit:4,mode:'split',dir:'right'}),o=c('OUT',{name:'result',width:4});w(x,'o',t,'d');w(t,'y',o,'i');`);
 let code=a.run('generateSchVhdl(sch).code');assert.match(code,/data_in\(7 downto 4\)/);compile(code);
 a.run(`t.params.nbit=1;o.params.width=1`);code=a.run('generateSchVhdl(sch).code');assert.match(code,/data_in\(4\)/);compile(code);
});
test('merge taps assemble a bus feeding a gate without an OUTPUT marker on the bus',()=>{
 const a=circuit(`const lo=c('IN',{name:'lo',width:4}),hi=c('IN',{name:'hi',width:4}),j=c('JUNCTION',{}),l=c('BUSTAP',{bit:0,nbit:4,mode:'merge',dir:'right'}),h=c('BUSTAP',{bit:4,nbit:4,mode:'merge',dir:'right'}),g=c('NOT',{inputs:1,width:8}),o=c('OUT',{name:'result',width:8});w(lo,'o',l,'y');w(hi,'o',h,'y');w(j,'j',l,'d');w(j,'j',h,'d');w(j,'j',g,'i0');w(g,'o',o,'i');`);
 const code=a.run('generateSchVhdl(sch).code');assert.match(code,/signal bus_s : STD_LOGIC_VECTOR\(7 downto 0\)/i);compile(code);
 const repeat=a.run('generateSchVhdl(sch).code');assert.equal(repeat,code);
 a.run(`sch.components=sch.components.filter(c=>c!==l&&c!==h);sch.wires=sch.wires.filter(w=>w.from.cid!==l.id&&w.to.cid!==l.id&&w.from.cid!==h.id&&w.to.cid!==h.id);`);
 assert.doesNotMatch(a.run('generateSchVhdl(sch).code'),/signal bus_s/);
});
test('a bus slice from CONST produces valid VHDL',()=>{
 const a=circuit(`const x=c('CONST',{value:'F4',width:8}),t=c('BUSTAP',{bit:4,nbit:4,mode:'split',dir:'right'}),o=c('OUT',{name:'result',width:4});w(x,'o',t,'d');w(t,'y',o,'i');`);compile(a.run('generateSchVhdl(sch).code'));
});
for(const kind of ['DFF','JKFF','TFF','SRFF'])test(kind+' handles GND and asserted async controls; no literal in process list',()=>{
 const a=circuit(`const clk=c('IN',{name:'clk',width:1}),v=c('VCC'),gnd=c('GND'),f=c('${kind}',{edge:'rising',reset:true,preset:false},'reg'),q=c('OUT',{name:'result',width:1});w(clk,'o',f,'clk');w(gnd,'o',f,'rst');w(f,'q',q,'i');for(const p of getPorts(f).filter(p=>p.dir==='in'&&!['clk','rst','pre'].includes(p.id)))w(v,'o',f,p.id);`);
 let code=a.run('generateSchVhdl(sch).code');assert.doesNotMatch(code,/process\([^)]*'[01]'/i);compile(code);
 a.run(`sch.wires.find(w=>w.to.pid==='rst').from.cid=v.id;`);
 code=a.run('generateSchVhdl(sch).code');assert.doesNotMatch(code,/process\(/i);assert.match(code,/reg_q <= '0'/);compile(code);
});
test('VCC preset preserves a dynamic reset with higher priority',()=>{
 const a=circuit(`const reset=c('IN',{name:'reset',width:1}),v=c('VCC'),f=c('DFF',{edge:'rising',reset:true,preset:true},'reg'),o=c('OUT',{name:'result',width:1});w(reset,'o',f,'rst');w(v,'o',f,'pre');w(f,'q',o,'i');`);
 const code=a.run('generateSchVhdl(sch).code');assert.match(code,/'0' when reset = '1' else '1'/);compile(code);
});
test('JK tie-offs survive copying only the flip-flop',()=>{
 const a=circuit(`const v=c('VCC'),f=c('JKFF',{edge:'rising',reset:false,preset:false});w(v,'o',f,'j');w(v,'o',f,'k');state.selection=new Set([f.id]);copySelection();pasteClipboard();`);
 assert.equal(a.run('activeSch().components.filter(c=>c.type==="VCC").length'),3);
 const copy=a.json('activeSch().components.filter(c=>c.type==="JKFF")[1]');
 assert.equal(a.run(`activeSch().wires.filter(w=>w.to.cid==='${copy.id}').length`),2);
});
test('imported nested design compiles all referenced entities',()=>{
 const a=loadApp(); a.ctx.fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/import-v1.schproj.json')));
 a.run('importProjectData(fixture.project,{mode:"new"})');
 const all=a.json('generateAllVhdl()');compile(Object.values(all).map(r=>typeof r==='string'?r:r.code).join('\n'));
});

test('8/16-bit comparators accept CONST on either side, including both constants',()=>{
 for(const type of ['COMP','COMPM']) for(const width of [8,16]) for(const side of ['a','b','both']){
  const a=circuit(`const x=c('IN',{name:'data_in',width:${width}}),k=c('CONST',{value:'07',width:${width}}),g=c('${type}',{width:${width}},'compare'),o=c('OUT',{name:'result',width:1});w(${side==='a'||side==='both'?'k':'x'},'o',g,'a');w(${side==='b'||side==='both'?'k':'x'},'o',g,'b');w(g,'${type==='COMP'?'eq':'gt'}',o,'i');`);
  const r=a.json('generateSchVhdl(sch)');assert.deepEqual(r.warns,[]);assert.deepEqual(r.fallbacks,[]);compile(r.code);
 }
});
test('user ADC comparator pattern simulates correctly for every state 0..19',()=>{
 const a=circuit(`const x=c('IN',{name:'state_in',width:8});
 function compare(label,type,value,pid,out){const k=c('CONST',{value,width:8}),g=c(type,{width:8},label),o=c('OUT',{name:out,width:1});w(x,'o',g,'a');w(k,'o',g,'b');w(g,pid,o,'i');return g;}
 compare('miso','COMPM','07','gt','is_reading');compare('cs','COMP','00','eq','cs_adc');
 const lo=compare('lo','COMPM','00','gt','positive'),hi=compare('hi','COMPM','05','lt','below_five'),g=c('AND',{inputs:2,width:1}),o=c('OUT',{name:'din_mosi',width:1});w(lo,'gt',g,'i0');w(hi,'lt',g,'i1');w(g,'o',o,'i');`);
 const result=a.json('generateSchVhdl(sch)');assert.deepEqual(result.fallbacks,[]);
 compile(result.code,'tb',`library ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
 entity tb is end;architecture sim of tb is signal s:std_logic_vector(7 downto 0);signal r,cs,m,p,b:std_logic;
 begin u:entity work.top port map(state_in=>s,is_reading=>r,cs_adc=>cs,din_mosi=>m,positive=>p,below_five=>b);
 process begin for i in 0 to 19 loop s<=std_logic_vector(to_unsigned(i,8));wait for 1 ns;
 assert (r='1')=(i>7) report "reading" severity failure;assert (cs='1')=(i=0) report "CS" severity failure;
 assert (m='1')=(i>0 and i<5) report "MOSI" severity failure;end loop;wait;end process;end;`);
});
test('fallback display follows output branches, preserves data, and clears after reconnect',()=>{
 const a=circuit(`const x=c('IN',{name:'value_in',width:8}),g=c('COMPM',{width:8},'compare'),j=c('JUNCTION'),o=c('OUT',{name:'result',width:1}),o2=c('OUT',{name:'copy_out',width:1});w(x,'o',g,'a');w(g,'gt',j,'j');w(j,'j',o,'i');w(j,'j',o2,'i');`);
 const before=a.json('sch');assert.equal(a.run('fallbackDisplay(sch).wires.size'),3);assert.deepEqual(a.json('sch'),before);
 assert.match(a.run('fallbackDisplay(sch).components.get(g.id)'),/ตรึง/);
 a.run(`const k=c('CONST',{width:8,value:'00'});w(k,'o',g,'b')`);
 assert.equal(a.run('fallbackDisplay(sch).wires.size'),0);assert.equal(a.run('fallbackDisplay(sch).components.size'),0);
});
test('missing gate operand warns about substitution, not a constant output; intended zeros stay normal',()=>{
 const a=circuit(`const x=c('IN',{name:'value_in',width:1}),g=c('OR',{inputs:2,width:1},'or_gate'),o=c('OUT',{name:'result',width:1});w(x,'o',g,'i0');w(g,'o',o,'i');`);
 assert.equal(a.run('fallbackDisplay(sch).wires.size'),1);assert.match(a.run('[...fallbackDisplay(sch).wires.values()][0]'),/อาจได้รับผลกระทบ/);
 a.run(`const zero=c('GND');w(zero,'o',g,'i1')`);assert.equal(a.run('fallbackDisplay(sch).wires.size'),0);
});
test('invalid Bus Tap, missing clock and isolated OUT expose fallback diagnostics',()=>{
 const a=circuit(`const x=c('IN',{name:'value_in',width:8}),t=c('BUSTAP',{bit:9,nbit:1,mode:'split',dir:'right'}),o=c('OUT',{name:'result',width:1});w(x,'o',t,'d');w(t,'y',o,'i');const f=c('DFF',{edge:'rising',reset:false,preset:false}),q=c('OUT',{name:'qout',width:1});w(f,'q',q,'i');const loose=c('OUT',{name:'loose',width:1});`);
 assert.ok(a.run('fallbackDisplay(sch).components.has(t.id)'));assert.ok(a.run('fallbackDisplay(sch).components.has(f.id)'));assert.ok(a.run('fallbackDisplay(sch).components.has(loose.id)'));
 assert.equal(a.run('fallbackDisplay(sch).wires.size'),2);
});

test('bus MUX selects every 8-bit input with s0 as the least significant select',()=>{
 const a=circuit(`const m=c('MUX',{inputs:4,width:8}),o=c('OUT',{name:'result',width:8});
 for(let i=0;i<4;i++){const x=c('IN',{name:'data'+i,width:8});w(x,'o',m,'d'+i);}
 for(let i=0;i<2;i++){const x=c('IN',{name:'sel'+i,width:1});w(x,'o',m,'s'+i);}w(m,'y',o,'i');`);
 const code=a.run('generateSchVhdl(sch).code');
 assert.match(code,/STD_LOGIC_VECTOR\(7 downto 0\)/i);
 compile(code,'tb',`library ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
 entity tb is end;architecture sim of tb is signal s:std_logic_vector(1 downto 0):="00";signal y:std_logic_vector(7 downto 0);
 begin u:entity work.top port map(data0=>x"A5",data1=>x"3C",data2=>x"81",data3=>x"7E",sel0=>s(0),sel1=>s(1),result=>y);
 process begin wait for 1 ns;assert y=x"A5" severity failure;
 s<="01";wait for 1 ns;assert y=x"3C" severity failure;
 s<="10";wait for 1 ns;assert y=x"81" severity failure;
 s<="11";wait for 1 ns;assert y=x"7E" severity failure;
 s<="XX";wait for 1 ns;assert y=x"00" severity failure;wait;end process;end;`);
});
test('MUX legacy scalar and unconnected bus inputs generate correctly typed fallbacks',()=>{
 for(const inputs of [2,4,8,16])for(const width of [1,8,32]){
  const params=width===1?`{inputs:${inputs}}`:`{inputs:${inputs},width:${width}}`;
  const a=circuit(`const m=c('MUX',${params}),o=c('OUT',{name:'result',width:${width}});w(m,'y',o,'i');`);
  const code=a.run('generateSchVhdl(sch).code');compile(code);
  assert.equal(a.run(`wireWidth(sch.wires[0],sch)`),width);
 }
});

test('MUX bus select simulates every channel for 2, 4, 8 and 16 inputs',()=>{
 for(const inputs of [2,4,8,16]){
  const sw=Math.log2(inputs),st=sw===1?'std_logic':`std_logic_vector(${sw-1} downto 0)`;
  const a=circuit(`const m=c('MUX',{inputs:${inputs},width:8,selectMode:'bus'}),s=c('IN',{name:'sel',width:${sw}}),o=c('OUT',{name:'result',width:8});
   for(let i=0;i<${inputs};i++){const d=c('CONST',{width:8,value:(128+i).toString(16)});w(d,'o',m,'d'+i);}w(s,'o',m,'s');w(m,'y',o,'i');`);
  assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);
  compile(a.run('generateSchVhdl(sch).code'),'tb',`library ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
   entity tb is end;architecture sim of tb is signal s:${st};signal y:std_logic_vector(7 downto 0);
   begin u:entity work.top port map(sel=>s,result=>y);process begin
   for i in 0 to ${inputs-1} loop ${sw===1?"if i=0 then s<='0';else s<='1';end if;":`s<=std_logic_vector(to_unsigned(i,${sw}));`}
   wait for 1 ns;assert y=std_logic_vector(to_unsigned(128+i,8)) severity failure;end loop;
   s<=${sw===1?"'X'":"(others=>'X')"};wait for 1 ns;assert y=x"00" severity failure;wait;end process;end;`);
 }
});
test('MUX bus select accepts constants and reports missing select while compiling its fallback',()=>{
 for(const inputs of [2,4,8,16])for(const connected of [false,true]){
  const a=circuit(`const m=c('MUX',{inputs:${inputs},width:8,selectMode:'bus'}),o=c('OUT',{name:'result',width:8});
  if(${connected}){const s=c('CONST',{width:Math.log2(${inputs}),value:'1'});w(s,'o',m,'s');}w(m,'y',o,'i');`);
  compile(a.run('generateSchVhdl(sch).code'));
 }
});

for(const type of ['ENC','DEC','DEMUX'])for(const inputMode of ['pins','bus'])for(const outputMode of ['pins','bus'])test(`${type} ${inputMode}/${outputMode} bus groups compile and simulate`,()=>{
 const a=circuit(`const p={inputs:8,outputs:8,width:4,inputMode:'${inputMode}',outputMode:'${outputMode}',selectMode:'bus'};
 const g=c('${type}',p);const groups=busGroups(g.type,p);
 for(const group of groups){if(group.dir!=='in')continue;
 if(group.mode==='bus'){const x=c('IN',{name:group.id+'_in',width:group.bits});w(x,'o',g,group.id);}
 else for(let i=0;i<group.bits;i++){const pid=groupPin(group,i),x=c('IN',{name:pid+'_in',width:1});w(x,'o',g,pid);}}
 if(g.type==='DEC'){const en=c('IN',{name:'enable',width:1});w(en,'o',g,'en');}
 for(const group of groups){if(group.dir!=='out')continue;
 if(group.mode==='bus'){const o=c('OUT',{name:group.id+'_out',width:group.bits});w(g,group.id,o,'i');}
 else for(let i=0;i<group.bits;i++){const pid=groupPin(group,i),o=c('OUT',{name:pid+'_out',width:1});w(g,pid,o,'i');}}`);
 assert.deepEqual(a.json('runSynthesis().filter(x=>x.lvl==="err")'),[]);
 const groups=a.json('groups'), maps=[],signals=[];
 for(const group of groups){
  signals.push(`signal v_${group.id}:std_logic_vector(${group.bits-1} downto 0):=(others=>'0');`);
  const suffix=group.dir==='in'?'_in':'_out';
  if(group.mode==='bus')maps.push(`${group.id+suffix}=>v_${group.id}`);
  else for(let i=0;i<group.bits;i++)maps.push(`${a.run(`groupPin(groups.find(g=>g.id==='${group.id}'),${i})`)+suffix}=>v_${group.id}(${i})`);
 }
 if(type==='DEC'){signals.push("signal en:std_logic:='1';");maps.push('enable=>en');}
 const exercise=type==='ENC'?`for i in 0 to 255 loop v_i<=std_logic_vector(to_unsigned(i,8));wait for 0.05 ns;expected:=0;for j in 0 to 7 loop if (i/(2**j)) mod 2=1 then expected:=j;end if;end loop;assert unsigned(v_y)=expected severity failure;end loop;`
 :type==='DEC'?`for i in 0 to 7 loop v_a<=std_logic_vector(to_unsigned(i,3));wait for 1 ns;assert unsigned(v_y)=2**i severity failure;end loop;en<='0';wait for 1 ns;assert unsigned(v_y)=0 severity failure;`
 :`v_d<="1010";for i in 0 to 7 loop v_s<=std_logic_vector(to_unsigned(i,3));wait for 1 ns;${Array.from({length:8},(_,j)=>`if i=${j} then assert v_y${j}="1010" severity failure;else assert v_y${j}="0000" severity failure;end if;`).join('')}end loop;`;
 compile(a.run('generateSchVhdl(sch).code'),'tb',`library ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;entity tb is end;architecture sim of tb is ${signals.join('\n')}begin u:entity work.top port map(${maps.join(',')});process variable expected:integer;begin ${exercise}wait;end process;end;`);
 const saved=a.run('serialize()');a.ctx.saved=saved;a.run('deserialize(saved)');assert.deepEqual(a.json('runSynthesis().filter(x=>x.lvl==="err")'),[]);
});
test('Comparator newly placed defaults are pins while legacy widths retain bus form',()=>{
 const a=loadApp();
 assert.equal(a.run(`cmpIsBus({...TYPES.COMP.defaultParams,width:8})`),false);
 assert.equal(a.run(`cmpIsBus({width:8})`),true);
 assert.equal(a.run(`cmpIsBus({width:2,pinMode:'bus'})`),true);
 for(const pinMode of ['pins','bus']){
  const b=circuit(`const g=c('COMPM',{width:4,pinMode:'${pinMode}'}),o=c('OUT',{name:'result',width:1});w(g,'gt',o,'i');
  if('${pinMode}'==='bus'){for(const [pid,value] of [['a','A'],['b','5']]){const k=c('CONST',{width:4,value});w(k,'o',g,pid);}}
  else for(let i=0;i<4;i++){for(const [pid,value] of [['a',10],['b',5]]){const k=c('CONST',{width:1,value:((value>>i)&1).toString()});w(k,'o',g,pid+i);}}`);
  compile(b.run('generateSchVhdl(sch).code'),'tb',`library ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is signal y:std_logic;begin u:entity work.top port map(result=>y);process begin wait for 1 ns;assert y='1' severity failure;wait;end process;end;`);
 }
});
