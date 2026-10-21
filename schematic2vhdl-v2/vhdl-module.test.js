const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const file=(name,ports,body='y <= a;',extra='')=>({fileName:name+'.vhd',vhdl:`library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all; ${extra}
entity ${name} is port (${ports}); end entity ${name};
architecture rtl of ${name} is begin ${body} end architecture rtl;`});
function importFiles(a,files){a.ctx.files=files;a.run('applyVhdlModuleImport(planVhdlModuleImport(files))');}
function parse(f){const a=loadApp();a.ctx.file=f;return a.json('parseVhdlModuleFile(file)');}
test('fixed interface retains exact names, vector bounds/direction, signedness and original source',()=>{
 const f=file('typed','clk, en:in std_logic; a:in signed(15 downto 8); y:out unsigned(2 to 9)'),r=parse(f);
 assert.equal(r.vhdl,f.vhdl);assert.deepEqual(r.ports.map(p=>[p.name,p.dir,p.width,p.dataType]),[['clk','in',1,'std_logic'],['en','in',1,'std_logic'],['a','in',8,'signed'],['y','out',8,'unsigned']]);
 assert.equal(r.ports[3].rangeDir,'to');assert.equal(r.ports[2].left,15);
});
test('comments and string/character literals never invent ports/entities/dependencies',()=>{
 const f=file('literal_box','a:in std_logic; y:out std_logic',`y <= a; assert false report "entity ghost is use work.missing.all; u: entity work.nope" severity note;`);
 f.vhdl='-- entity fake is generic(WIDTH:integer);\n'+f.vhdl+'\n/* entity fake2 is */';
 assert.equal(parse(f).name,'literal_box');assert.deepEqual(parse(f).dependencies,[]);assert.deepEqual(parse(f).uses,[]);
});
test('unsupported or invalid interfaces fail explicitly before model/history/id changes',()=>{
 for(const ports of ['a:inout std_logic; y:out std_logic','a:in integer; y:out std_logic','a:in std_logic_vector; y:out std_logic','a:in std_logic(0 downto 0); y:out std_logic','a:in std_logic_vector(0 downto 7); y:out std_logic','a:in unsigned(64 downto 0); y:out std_logic','a:in signed(WIDTH-1 downto 0); y:out std_logic','A:in std_logic; a:out std_logic','a_:in std_logic; y:out std_logic']){
  const a=loadApp(),before=a.run('serialize()'),idx=a.run('state.history.idx'),uid=a.run('_uidN');a.ctx.files=[file('bad',ports)];
  assert.throws(()=>a.run('planVhdlModuleImport(files)'));assert.equal(a.run('serialize()'),before);assert.equal(a.run('state.history.idx'),idx);assert.equal(a.run('_uidN'),uid);
 }
 const f=file('param','a:in std_logic;y:out std_logic');f.vhdl=f.vhdl.replace('is port','is generic(WIDTH:positive:=8); port');assert.equal(parse(f).generics[0].defaultValue,8);
 assert.throws(()=>parse({vhdl:'entity a is end;'}),/architecture/);
});
test('import preview is pure, Apply is one Undo/Redo and source survives workspace round trip',()=>{
 const a=loadApp(),before=a.run('serialize()'),idx=a.run('state.history.idx');a.ctx.files=[file('pass_through','a:in std_logic;y:out std_logic')];
 a.run('const plan=planVhdlModuleImport(files)');assert.equal(a.run('serialize()'),before);
 a.run('applyVhdlModuleImport(plan)');assert.equal(a.run('state.history.idx'),idx+1);const after=a.run('serialize()');
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 a.ctx.saved=after;a.run('deserialize(saved)');assert.equal(a.run('state.project.customs.pass_through.vhdl'),a.ctx.files[0].vhdl);
});
test('Apply rechecks names, stale project and Placement Mode without partial imports',()=>{
 const a=loadApp();a.ctx.files=[file('leaf','a:in std_logic;y:out std_logic')];a.run('const plan=planVhdlModuleImport(files);state.project.customs.LEAF={name:"LEAF",vhdl:"legacy",ports:[]}');
 const before=a.run('serialize()');assert.throws(()=>a.run('applyVhdlModuleImport(plan)'),/ซ้ำ/);assert.equal(a.run('serialize()'),before);
 a.run('delete state.project.customs.LEAF;state.placementMode={phase:"placing"}');assert.throws(()=>a.run('applyVhdlModuleImport(plan)'),/โหมด/);
 a.run('state.placementMode=null;state.project={...state.project}');assert.throws(()=>a.run('applyVhdlModuleImport(plan)'),/โปรเจกต์/);
});
test('entity/package dependencies travel with the module and export once in dependency order',()=>{
 const a=loadApp(),pkg={fileName:'math_pkg.vhd',vhdl:`library ieee;use ieee.std_logic_1164.all; package math_pkg is constant PASS_BIT:std_logic:='1';end package;`};
 const child=file('leaf','a:in std_logic;y:out std_logic','y <= a and PASS_BIT;','use work.math_pkg.all;');
 const root=file('parent','a:in std_logic;y:out std_logic','u:entity work.leaf port map(a=>a,y=>y);');
 importFiles(a,[root,child,pkg]);a.run(`const id=addComp('CUSTOM:parent',100,100);const all=generateAllVhdl();`);
 assert.deepEqual(a.json('Object.keys(all)'),['top','package:math_pkg','leaf','parent']);
 assert.equal(a.run('all.leaf'),child.vhdl);assert.equal(a.run('all.parent'),root.vhdl);assert.equal(a.run('all["package:math_pkg"]'),pkg.vhdl);
 assert.deepEqual(a.json('[...collectCustomDeps(state.project.customs.parent)]'),['leaf']);
});
test('missing dependencies, conflicting entities/packages and cycles fail atomically',()=>{
 const a=loadApp(),before=a.run('serialize()');const root=file('root_box','a:in std_logic;y:out std_logic','u:entity work.missing port map(a=>a,y=>y);');
 a.ctx.files=[root];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/ขาดไฟล์ entity/);
 a.ctx.files=[file('uses_pkg','a:in std_logic;y:out std_logic','y <= a;','use work.missing.all;')];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/ขาดไฟล์ package/);
 a.ctx.files=[file('top','a:in std_logic;y:out std_logic')];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/ซ้ำ/);
 a.ctx.files=[file('Abox','a:in std_logic;y:out std_logic'),file('abox','a:in std_logic;y:out std_logic','y<=not a;')];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/ซ้ำ/);
 a.ctx.files=[file('recursive','a:in std_logic;y:out std_logic','u:entity work.recursive port map(a=>a,y=>y);')];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/วนซ้ำ/);
 a.ctx.files=[file('uses_pkg','a:in std_logic;y:out std_logic','y <= a;','use work.p.all;'),{vhdl:'package p is end;'}, {vhdl:'package p is constant X:integer:=1;end;'}];assert.throws(()=>a.run('planVhdlModuleImport(files)'),/package ชื่อซ้ำ/);
 assert.equal(a.run('serialize()'),before);
});
test('component-style dependencies and external libraries are identified explicitly',()=>{
 const f=file('wrapper','a:in std_logic;y:out std_logic');f.vhdl=f.vhdl.replace('is begin','is component leaf port(a:in std_logic;y:out std_logic);end component;begin').replace('y <= a;','u:leaf port map(a,y);');
 assert.deepEqual(parse(f).dependencies,['leaf']);assert.throws(()=>parse(file('external','a:in std_logic;y:out std_logic','u:entity foreign.leaf port map(a,y);')),/library foreign/);
});
test('module metadata disagreement is rejected during project import and export',()=>{
 const a=loadApp();importFiles(a,[file('box','a:in std_logic;y:out std_logic')]);a.run('state.project.customs.box.ports[0].width=32');
 assert.throws(()=>a.run('validateVhdlModules(state.project)'),/ไม่ตรง/);
 assert.throws(()=>a.run('buildProjectImport(state.project,{schematics:{},customs:{}})'),/ไม่ตรง/);
});
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
function simulate(a,signals,maps,exercise){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vhdl-module-'));
 try{
  const all=a.json('generateAllVhdl()');fs.writeFileSync(path.join(dir,'bundle.vhd'),Object.values(all).map(v=>typeof v==='string'?v:v.code).join('\n')+`\nlibrary ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;entity tb is end;architecture sim of tb is ${signals} begin u:entity work.top port map(${maps});process begin ${exercise} wait;end process;end;`);
  execFileSync('ghdl',['-a','--std=08','bundle.vhd'],{cwd:dir,stdio:'pipe'});execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=20ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
for(const [type,range,width] of [['std_logic','',1],['std_logic_vector','(7 downto 0)',8],['std_logic_vector','(8 to 15)',8],['std_logic_vector','(5 downto 5)',1],['unsigned','(7 downto 0)',8],['signed','(4 to 11)',8],['unsigned','(63 downto 0)',64]])test(`GHDL mixed schematic module keeps ${type}${range} semantics`,{skip:!hasGhdl},()=>{
 const a=loadApp();importFiles(a,[file('typed_box',`a:in ${type}${range}; y:out ${type}${range}`)]);
 a.ctx.width=width;a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const input=addComp('IN',0,0,{name:'data_in',width});const gate=addComp('NOT',100,0,{width});const box=addComp('CUSTOM:typed_box',200,0);const output=addComp('OUT',400,0,{name:'result',width});
 for(const [f,p,t,q] of [[input,'o',gate,'a0'],[gate,'y',box,'a'],[box,'y',output,'i']])sch.wires.push({id:uid('w'),from:{cid:f,pid:p},to:{cid:t,pid:q}});`);
 // Find actual gate pin ids instead of relying on label assumptions.
 a.run(`sch.wires[0].to.pid=getPorts(comp(gate)).find(p=>p.dir==='in').id;sch.wires[1].from.pid=getPorts(comp(gate)).find(p=>p.dir==='out').id;`);
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 const sig=width===1?'std_logic':`std_logic_vector(${width-1} downto 0)`,zero=width===1?"'0'":"(others=>'0')",ones=width===1?"'1'":"(result'range=>'1')";
 simulate(a,`signal result:${sig};`,'data_in=>'+zero+',result=>result',`wait for 2 ns;assert result=${ones} severity failure;`);
});
test('GHDL scalar constant and missing input adapt to unsigned/vector ports',{skip:!hasGhdl},()=>{
 const a=loadApp();importFiles(a,[file('u_box','a:in unsigned(7 downto 0);y:out unsigned(7 downto 0)')]);
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const box=addComp('CUSTOM:u_box',200,0);const output=addComp('OUT',400,0,{name:'result',width:8});sch.wires.push({id:uid('w'),from:{cid:box,pid:'y'},to:{cid:output,pid:'i'}});`);
 simulate(a,'signal result:std_logic_vector(7 downto 0);','result=>result',`wait for 1 ns;assert result=x"00" severity failure;`);
 a.run(`const k=addComp('CONST',0,0,{value:'F4',width:8});sch.wires.push({id:uid('w'),from:{cid:k,pid:'o'},to:{cid:box,pid:'a'}});`);
 simulate(a,'signal result:std_logic_vector(7 downto 0);','result=>result',`wait for 1 ns;assert result=x"F4" severity failure;`);
});
test('GHDL dependency bundle and module package round trip preserve behavior',{skip:!hasGhdl},()=>{
 const a=loadApp(),pkg={vhdl:`library ieee;use ieee.std_logic_1164.all;package pass_pkg is constant C:std_logic:='1';end package;`};
 importFiles(a,[pkg,file('child','a:in std_logic;y:out std_logic','y<=a and C;','use work.pass_pkg.all;'),file('parent_box','a:in std_logic;y:out std_logic','u:entity work.child port map(a=>a,y=>y);')]);
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const input=addComp('IN',0,0,{name:'data_in'}),box=addComp('CUSTOM:parent_box',100,0),output=addComp('OUT',300,0,{name:'result'});sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:box,pid:'a'}},{id:uid('w'),from:{cid:box,pid:'y'},to:{cid:output,pid:'i'}});`);
 simulate(a,'signal result:std_logic;','data_in=>\'1\',result=>result',`wait for 1 ns;assert result='1' severity failure;`);
});
test('portable mixed schematic/VHDL package imports without renaming raw source or losing dependencies',()=>{
 const a=loadApp();importFiles(a,[file('dep_box','a:in std_logic;y:out std_logic'),file('root_vhdl','a:in std_logic;y:out std_logic','u:entity work.dep_box port map(a=>a,y=>y);')]);
 a.run(`const wrap={name:'wrapper_box',schematic:{components:[{id:'inner',type:'CUSTOM:root_vhdl',x:0,y:0,params:{}}],wires:[]}};
 const pkg={type:'schstudio-custom-pkg',customs:{wrapper_box:wrap,root_vhdl:state.project.customs.root_vhdl,dep_box:state.project.customs.dep_box}};
 const destination={schematics:{},customs:{}};const staged=planCustomPackageImport(pkg,destination);`);
 assert.deepEqual(a.json('Object.keys(staged)'),['wrapper_box','root_vhdl','dep_box']);
 assert.equal(a.run('staged.root_vhdl.vhdl'),a.run('state.project.customs.root_vhdl.vhdl'));
 assert.equal(a.run('staged.wrapper_box.schematic.components[0].type'),'CUSTOM:root_vhdl');
 a.run('destination.customs=staged');assert.throws(()=>a.run('planCustomPackageImport(pkg,destination)'),/ชื่อซ้ำ/);
});
test('GHDL sequential VHDL box retains clock, enable, asynchronous reset and two instances',{skip:!hasGhdl},()=>{
 const a=loadApp(),reg=file('register_box','clk,en,rst:in std_logic;d:in std_logic_vector(7 downto 0);q:out std_logic_vector(7 downto 0)',
 `process(clk,rst)begin if rst='1' then q<=(others=>'0');elsif rising_edge(clk)then if en='1' then q<=d;end if;end if;end process;`);
 importFiles(a,[reg]);a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 const inputs={};for(const [name,width]of[['clk',1],['en',1],['rst',1],['d',8]])inputs[name]=addComp('IN',0,0,{name,width});
 for(let i=0;i<2;i++){const box=addComp('CUSTOM:register_box',100,i*100),out=addComp('OUT',400,i*100,{name:'result'+i,width:8});
 for(const pid of ['clk','en','rst','d'])sch.wires.push({id:uid('w'),from:{cid:inputs[pid],pid:'o'},to:{cid:box,pid}});
 sch.wires.push({id:uid('w'),from:{cid:box,pid:'q'},to:{cid:out,pid:'i'}});}`);
 assert.equal(a.run('Object.keys(generateAllVhdl()).filter(n=>n==="register_box").length'),1);
 simulate(a,"signal clk,en,rst:std_logic:='0';signal d,r0,r1:std_logic_vector(7 downto 0):=x\"A5\";",
 'clk=>clk,en=>en,rst=>rst,d=>d,result0=>r0,result1=>r1',`rst<='1';wait for 1 ns;assert r0=x"00" and r1=x"00" severity failure;rst<='0';clk<='1';wait for 1 ns;assert r0=x"00" severity failure;clk<='0';en<='1';wait for 1 ns;clk<='1';wait for 1 ns;assert r0=x"A5" and r1=x"A5" severity failure;en<='0';rst<='1';wait for 1 ns;assert r0=x"00" and r1=x"00" severity failure;`);
});
test('package/entity name collisions and grouped use clauses are checked without guessing',()=>{
 const a=loadApp();a.ctx.files=[file('same_name','a:in std_logic;y:out std_logic'),{vhdl:'package same_name is end package;'}];
 assert.throws(()=>a.run('planVhdlModuleImport(files)'),/package\/entity ชื่อซ้ำ/);
 const r=parse(file('uses_two','a:in std_logic;y:out std_logic','y<=a;','use work.p1.all, work.p2.all;'));
 assert.deepEqual(r.uses,['p1','p2']);
});
