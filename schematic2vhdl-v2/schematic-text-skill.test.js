const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const skill=path.join(__dirname,'../skills/schematic-text-author');
const cases=[
 ['half-adder','signal a,b,sum,carry:std_logic;','a=>a,b=>b,sum=>sum,carry=>carry',`for i in 0 to 3 loop
 if i/2=0 then a<='0';else a<='1';end if;if i mod 2=0 then b<='0';else b<='1';end if;
 wait for 1 ns;assert sum=(a xor b) and carry=(a and b) severity failure;end loop;`],
 ['mux-demo','signal a,b,y:std_logic_vector(7 downto 0);signal sel:std_logic;','a=>a,b=>b,sel=>sel,y=>y',`a<=x"12";b<=x"A5";sel<='0';wait for 1 ns;assert y=x"12" severity failure;sel<='1';wait for 1 ns;assert y=x"A5" severity failure;`],
 ['dff-reset','signal d,clk,rst,q:std_logic;','d=>d,clk=>clk,rst=>rst,q=>q',`clk<='0';d<='1';rst<='1';wait for 1 ns;assert q='0' severity failure;
 rst<='0';wait for 1 ns;assert q='0' severity failure;clk<='1';wait for 1 ns;assert q='1' severity failure;
 d<='0';wait for 1 ns;assert q='1' severity failure;rst<='1';wait for 1 ns;assert q='0' severity failure;`],
 ['counter2','signal clk,rst,en:std_logic;signal q:std_logic_vector(1 downto 0);','clk=>clk,rst=>rst,en=>en,q=>q',`clk<='0';rst<='1';en<='1';wait for 1 ns;assert q="00" severity failure;rst<='0';
 for i in 1 to 5 loop wait for 1 ns;clk<='1';wait for 1 ns;assert unsigned(q)=to_unsigned(i mod 4,2) severity failure;clk<='0';end loop;
 en<='0';wait for 1 ns;clk<='1';wait for 1 ns;assert q="01" severity failure;
 rst<='1';wait for 1 ns;assert q="00" severity failure;`],
 ['split-nibble','signal data:std_logic_vector(7 downto 0);signal upper:std_logic_vector(3 downto 0);','data=>data,upper=>upper',`data<=x"A5";wait for 1 ns;assert upper=x"A" severity failure;`],
 ['merge-nibbles','signal lo,hi:std_logic_vector(3 downto 0);signal result:std_logic_vector(7 downto 0);','lo=>lo,hi=>hi,result=>result',`lo<=x"5";hi<=x"A";wait for 1 ns;assert result=x"A5" severity failure;`],
 ['reuse-mux','signal a,b,c,result:std_logic_vector(7 downto 0);signal sel:std_logic;','a=>a,b=>b,c=>c,sel=>sel,result=>result',`a<=x"12";b<=x"34";c<=x"56";sel<='0';wait for 1 ns;assert result=x"12" severity failure;sel<='1';wait for 1 ns;assert result=x"56" severity failure;`]
];
let ghdl=true;try{execFileSync('ghdl',['--version']);}catch{ghdl=false;}
for(const [file,signals,mapping,stimulus] of cases)test('skill example '+file+' imports and simulates',t=>{
 const a=loadApp();
 if(file==='reuse-mux'){a.ctx.text=fs.readFileSync(path.join(skill,'assets/mux-demo.sch.txt'),'utf8');a.run('importSchematicText(text)');}
 a.ctx.text=fs.readFileSync(path.join(skill,'assets',file+'.sch.txt'),'utf8');
 assert.deepEqual(a.json('compileSchematicText(text).warnings'),[]);
 a.run('importSchematicText(text);state.project.topId=state.activeId');
 const top=a.run('sanId(activeSch().name)'),all=a.json('generateAllVhdl()');
 if(!ghdl){t.skip('GHDL unavailable; structure checked');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-skill-'));
 try{
 fs.writeFileSync(path.join(dir,'design.vhd'),Object.values(all).map(v=>typeof v==='string'?v:v.code).join('\n')+`\nlibrary ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;entity tb is end;architecture test of tb is ${signals} begin dut:entity work.${top} port map(${mapping});process begin ${stimulus} wait;end process;end;`);
 for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=30ns']])execFileSync('ghdl',args,{cwd:dir});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('generated component reference matches current registry',()=>{
 const actual=execFileSync(process.execPath,[path.join(__dirname,'generate-schematic-text-reference.cjs')],{encoding:'utf8'});
 assert.equal(fs.readFileSync(path.join(skill,'references/components.md'),'utf8'),actual);
});
test('part query resolves parameter-dependent pins and rejects bad settings',()=>{
 const cli=path.join(__dirname,'describe-schematic-part.cjs');
 const r=JSON.parse(execFileSync(process.execPath,[cli,'MUX','inputs=4','width=8','selectMode=bus'],{encoding:'utf8'}));
 assert.equal(r.ports.find(p=>p.id==='s').width,2);assert.equal(r.ports.find(p=>p.id==='d3').width,8);
 assert.throws(()=>execFileSync(process.execPath,[cli,'MUX','inputs=3'],{stdio:'pipe'}));
});
