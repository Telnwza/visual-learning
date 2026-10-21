const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
const dataPins={DFF:['d'],JKFF:['j','k'],TFF:['t'],SRFF:['s','r']};
function design(type,edge='rising',enable='dynamic'){
 const a=loadApp();a.ctx.kind=type;a.ctx.clockEdge=edge;a.ctx.enableSource=enable;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params={}){const n={id:uid('c'),type,params,x:0,y:0};sch.components.push(n);return n;}
 function w(n,p,m,q){sch.wires.push({id:uid('w'),from:{cid:n.id,pid:p},to:{cid:m.id,pid:q}});}
 const f=c(kind,{edge:clockEdge,reset:true,preset:true,enable:enableSource!=='legacy'});
 for(const pin of getPorts(f).filter(p=>p.dir==='in')){
   if(pin.id==='en'&&enableSource==='missing')continue;
   const n=pin.id==='en'&&['VCC','GND'].includes(enableSource)?c(enableSource):c('IN',{name:pin.id,width:1});
   w(n,'o',f,pin.id);
 }
 w(f,'q',c('OUT',{name:'result',width:1}),'i');
 w(f,'qn',c('OUT',{name:'inverse',width:1}),'i');`);
 return a;
}
function simulate(t,code,tb=''){
 if(!hasGhdl){t.skip('GHDL unavailable');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ff-enable-'));
 try{
  fs.writeFileSync(path.join(dir,'design.vhd'),code+'\n'+tb);
  execFileSync('ghdl',['-a','--std=08','design.vhd'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-e','--std=08',tb?'tb':'top'],{cwd:dir,stdio:'pipe'});
  if(tb)execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=200ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const type of Object.keys(dataPins)){
 test(type+' optional enable preserves legacy ports, geometry and VHDL',()=>{
  const a=design(type,'rising','legacy');
  const old=a.run('generateSchVhdl(sch).code'),ports=a.json('getPorts(f)'),size=a.json('getSize(f)');
  a.run('delete f.params.enable');assert.equal(a.run('generateSchVhdl(sch).code'),old);
  assert.deepEqual(a.json('getPorts(f)'),ports);assert.deepEqual(a.json('getSize(f)'),size);
  a.run('f.params.enable=true');const enabled=a.json('getPorts(f)');
  assert.deepEqual(enabled.filter(p=>p.id!=='en'),ports);
  assert.equal(enabled.find(p=>p.id==='en').width||1,1);
  assert.deepEqual(a.json('getSize(f)'),size);assert.match(a.run('typeDef(f).shape(f.params)'),/>EN</);
 });
 for(const edge of ['rising','falling'])test(`${type} ${edge}: hold, transitions and async priority`,t=>{
  const a=design(type,edge),r=a.json('generateSchVhdl(sch)');
  assert.deepEqual(r.fallbacks,[]);assert.match(r.code,/if en = '1' then/);
  assert.doesNotMatch(r.code,/process\([^)]*\ben\b/i);
  const pins=dataPins[type],active=edge==='rising'?'1':'0',inactive=active==='1'?'0':'1';
  const transition={DFF:'expected:=a_bit;',TFF:"if a_bit='1' then expected:=not expected;end if;",
   JKFF:"if a_bit='1' and b_bit='1' then expected:=not expected;elsif a_bit='1' then expected:='1';elsif b_bit='1' then expected:='0';end if;",
   SRFF:"if a_bit='1' and b_bit='0' then expected:='1';elsif a_bit='0' and b_bit='1' then expected:='0';end if;"}[type];
  simulate(t,r.code,`library ieee;use ieee.std_logic_1164.all;
 entity tb is end;architecture sim of tb is
 signal clk:std_logic:='${inactive}';signal rst,pre,en:std_logic:='0';
 signal ${pins.join(',')}:std_logic:='0';signal result,inverse:std_logic;
 begin u:entity work.top port map(clk=>clk,rst=>rst,pre=>pre,en=>en,${pins.map(p=>p+'=>'+p).join(',')},result=>result,inverse=>inverse);
 process variable expected:std_logic:='0';variable a_bit,b_bit:std_logic;
 begin
 rst<='1';wait for 1 ns;assert result='0' and inverse='1' report "async reset" severity failure;
 rst<='0';pre<='1';wait for 1 ns;assert result='1' and inverse='0' report "async preset while disabled" severity failure;
 rst<='1';wait for 1 ns;assert result='0' and inverse='1' report "reset priority" severity failure;
 rst<='0';wait for 1 ns;assert result='1' and inverse='0' severity failure;
 pre<='0';rst<='1';wait for 1 ns;rst<='0';wait for 1 ns;
 for enabled in 0 to 1 loop
   if enabled=0 then en<='0';else en<='1';end if;
   for case_a in 0 to 1 loop for case_b in 0 to 1 loop
     if case_a=0 then a_bit:='0';else a_bit:='1';end if;
     if case_b=0 then b_bit:='0';else b_bit:='1';end if;
     ${pins[0]}<=a_bit;${pins.length>1?pins[1]+'<=b_bit;':''}wait for 1 ns;
     assert result=expected and inverse=not expected report "changed without clock" severity failure;
     clk<='${active}';if enabled=1 then ${transition} end if;wait for 1 ns;
     assert result=expected and inverse=not expected report "enabled transition or hold" severity failure;
     clk<='${inactive}';wait for 1 ns;
     assert result=expected and inverse=not expected report "wrong clock edge" severity failure;
   end loop;end loop;
 end loop;
 en<='X';${pins[0]}<='1';wait for 1 ns;clk<='${active}';wait for 1 ns;
 assert result=expected and inverse=not expected report "unknown enable must hold" severity failure;
 wait;end process;end;`);
 });
 for(const source of ['VCC','GND','missing'])test(`${type} ${source} enable produces legal VHDL`,t=>{
  const a=design(type,'rising',source),r=a.json('generateSchVhdl(sch)');
  assert.match(r.code,new RegExp('if '+(source==='VCC'?'true':'false')+' then'));
  if(source==='missing'){
   assert.ok(r.fallbacks.some(f=>f.pid==='en'));
   assert.ok(a.json('runSynthesis()').some(i=>i.msg.includes("'en'")));
  }else assert.deepEqual(r.fallbacks,[]);
  simulate(t,r.code);
 });
}
test('Schematic Text enable ports and save/load preserve the option',()=>{
 const a=loadApp();a.ctx.text=`format schematic-text 1
 circuit enabled_register
 input clk, reset, gate_en, data_in
 output q
 part f DFF enable=true reset=true
 connect clk -> f.clk
 connect reset -> f.rst
 connect gate_en -> f.en
 connect data_in -> f.d
 connect f.q -> q`;
 a.run('importSchematicText(text)');const saved=a.run('serialize()');a.ctx.saved=saved;
 a.run('deserialize(saved)');assert.equal(a.run('activeSch().components.find(c=>c.type==="DFF").params.enable'),true);
 assert.ok(a.run('activeSch().wires.some(w=>w.to.pid==="en")'));
 assert.match(a.run('schematicTextCatalog(["DFF"])'),/enable/);
});
test('EN routes into a side pin without crossing another flip-flop pin',()=>{
 for(const type of Object.keys(dataPins)){
  const a=loadApp();a.ctx.kind=type;
  a.run(`importSchematicText('format schematic-text 1\\ncircuit routing_demo\\ninput clk,reset,gate_en\\noutput q\\npart f '+kind+' enable=true reset=true\\nconnect clk -> f.clk\\nconnect reset -> f.rst\\nconnect gate_en -> f.en\\nconnect f.q -> q');
   const sch=activeSch(),f=sch.components.find(c=>c.type===kind),w=sch.wires.find(w=>w.to.pid==='en');
   const route=wireRoute(w,portPos(comp(w.from.cid,sch),w.from.pid),portPos(f,'en'),wireOpts(w,sch));
   const parts=routeParts(route);
   const crossed=getPorts(f).filter(p=>p.id!=='en').some(p=>{const pos=portPos(f,p.id);return parts.some(s=>
    s.t==='h'?Math.abs(s.y-pos.y)<0.5&&pos.x>=Math.min(s.x1,s.x2)&&pos.x<=Math.max(s.x1,s.x2)
             :Math.abs(s.x-pos.x)<0.5&&pos.y>=Math.min(s.y1,s.y2)&&pos.y<=Math.max(s.y1,s.y2));});`);
  assert.equal(a.run('portSideH(f,"en")'),true);assert.equal(a.run('crossed'),false,type);
 }
});
