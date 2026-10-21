const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const mux=`format schematic-text 1
circuit mux_demo
input a[8], b[8], sel
output y[8]
part m MUX inputs=2 width=8
connect a -> m.d0
connect b -> m.d1
connect sel -> m.s0
connect m.y -> y`;
function setup(text=mux){const a=loadApp();a.ctx.sourceText=text;return a;}
test('MUX bus compiles without mutating project, IDs or history',()=>{
 const a=setup(),before=a.run('serialize()');
 const r=a.json('compileSchematicText(sourceText)');
 assert.equal(r.sch.components.length,5);assert.equal(r.sch.wires.length,4);assert.equal(r.warnings.length,0);
 assert.equal(a.run('serialize()'),before);
 assert.equal(r.sch.components.find(c=>c.id==='m').params.width,8);
});
for(const [label,text,pattern] of [
 ['version',mux.replace('text 1','text 2'),/format/],
 ['unknown command',mux+'\nmagic foo',/บรรทัด 10/],
 ['unknown part',mux.replace('MUX','MISSING'),/ชนิดอุปกรณ์/],
 ['unknown parameter',mux.replace('inputs=2','inputz=2'),/พารามิเตอร์/],
 ['invalid select',mux.replace('inputs=2','inputs=3'),/ตัวเลือก/],
 ['invalid width',mux.replace('width=8','width=99'),/ช่วง/],
 ['duplicate name',mux+'\ninput A',/ชื่อซ้ำ/],
 ['missing pin',mux.replace('m.d0','m.nope'),/ไม่พบขา/],
 ['direction',mux.replace('connect a -> m.d0','connect y -> m.d0'),/ทิศทาง/],
 ['width mismatch',mux.replace('input a[8]','input a[4]'),/ความกว้าง/],
 ['multiple drivers',mux+'\nconnect b -> m.d0',/สายขับ/],
 ['missing subcircuit',mux+'\nuse missing as child',/ไม่พบวงจรย่อย/],
 ['missing clock','format schematic-text 1\ncircuit foo\npart ff DFF',/clock/],
 ['bad constant','format schematic-text 1\ncircuit foo\npart k CONST value="ZZ"',/ฐานสิบหก/]
]) test(label+' fails atomically',()=>{const a=setup(text),before=a.run('serialize()');assert.throws(()=>a.run('importSchematicText(sourceText)'),pattern);assert.equal(a.run('serialize()'),before);});
test('import, fanout, undo, redo and save reload preserve circuit',()=>{
 const a=setup('format schematic-text 1\ncircuit fanout\ninput a\noutput x, y\nconnect a -> x, y');
 const before=a.run('Object.keys(state.project.schematics).length');
 a.run('importSchematicText(sourceText)');
 assert.equal(a.run('Object.keys(state.project.schematics).length'),before+1);
 assert.ok(a.run('activeSch().components.some(c=>c.type==="JUNCTION")'));
 const saved=a.run('serialize()');a.run('undo()');assert.equal(a.run('Object.keys(state.project.schematics).length'),before);
 a.run('redo()');assert.equal(a.run('activeSch().name'),'fanout');
 a.ctx.saved=saved;a.run('deserialize(saved)');assert.equal(a.run('activeSch().name'),'fanout');
});
function child(a){a.run(`const leaf=blankSchematic('leaf','existing buffer');leaf.components=[{id:'i',type:'IN',x:0,y:0,params:{name:'a',width:8}},{id:'o',type:'OUT',x:220,y:0,params:{name:'y',width:8}}];leaf.wires=[{id:'w',from:{cid:'i',pid:'o'},to:{cid:'o',pid:'i'},name:''}];state.project.schematics.leaf=leaf;snapshot();`);}
const reuse='format schematic-text 1\ncircuit reuse\nuse "existing buffer" as buf\ninput a[8]\noutput y[8]\npart u1 @buf\npart u2 @buf\nconnect a -> u1.a\nconnect u1.y -> u2.a\nconnect u2.y -> y';
test('two instances share existing definition, signatures reject drift, ambiguity is explicit',()=>{
 const a=setup(reuse);child(a);a.run('importSchematicText(sourceText)');
 assert.equal(a.run('activeSch().components.filter(c=>c.type==="SCH:leaf").length'),2);
 assert.equal(a.run('Object.values(state.project.schematics).filter(s=>s.name==="existing buffer").length'),1);
 const signature=a.run('schematicTextSignature("SCH:leaf")');a.ctx.sourceText=reuse.replace('as buf',`as buf signature ${JSON.stringify(signature)}`);
 a.run('state.project.schematics.leaf.components[0].params.width=4');assert.throws(()=>a.run('compileSchematicText(sourceText)'),/ขาของวงจรย่อยเปลี่ยน/);
 a.ctx.sourceText=reuse;a.run('state.project.schematics.other=cloneData(state.project.schematics.leaf)');assert.throws(()=>a.run('compileSchematicText(sourceText)'),/กำกวม/);
});
test('nested dependencies and recursive / missing dependency checks',()=>{
 const a=setup(reuse);child(a);
 a.run(`state.project.schematics.inner=cloneData(state.project.schematics.leaf);state.project.schematics.inner.name='inner';state.project.schematics.leaf.components.push({id:'nested',type:'SCH:inner',params:{},x:0,y:200});`);
 assert.deepEqual(a.json('compileSchematicText(sourceText).dependencies').sort(),['SCH:inner','SCH:leaf']);
 a.run(`state.project.schematics.inner.components.push({id:'cycle',type:'SCH:leaf',params:{},x:0,y:200});`);
 assert.throws(()=>a.run('compileSchematicText(sourceText)'),/วน/);
 a.run('delete state.project.schematics.inner');assert.throws(()=>a.run('compileSchematicText(sourceText)'),/dependency/);
});
test('sequential feedback terminates and parses boolean reset',()=>{
 const a=setup('format schematic-text 1\ncircuit toggle\ninput clk, rst\noutput q\npart ff DFF reset=true\npart inv NOT\nconnect clk -> ff.clk\nconnect rst -> ff.rst\nconnect ff.q -> inv.i0, q\nconnect inv.o -> ff.d');
 const r=a.json('compileSchematicText(sourceText)');assert.equal(r.warnings.length,0);assert.ok(r.sch.components.every(c=>Number.isFinite(c.x)));
});
test('catalog uses actual ports and exact subcircuit binding',()=>{
 const a=setup();child(a);const catalog=a.run('schematicTextCatalog(["MUX","SCH:leaf"])');
 assert.match(catalog,/d0:in\[1\]/);assert.match(catalog,/use "SCH:leaf"/);assert.match(catalog,/a:in\[8\]/);assert.match(catalog,/signature/);
});
test('generated MUX VHDL simulates both select cases in GHDL',t=>{
 try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
 const a=setup();a.run('importSchematicText(sourceText)');const code=a.run('generateSchVhdl(activeSch()).code');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-ghdl-'));
 try{fs.writeFileSync(path.join(dir,'design.vhd'),code+`\nlibrary ieee; use ieee.std_logic_1164.all;
entity tb is end; architecture test of tb is
signal a,b,y:std_logic_vector(7 downto 0);signal sel:std_logic;
begin dut:entity work.mux_demo port map(a=>a,b=>b,sel=>sel,y=>y);
process begin a<=x"12";b<=x"A5";sel<='0';wait for 1 ns;assert y=x"12" severity failure;
sel<='1';wait for 1 ns;assert y=x"A5" severity failure;wait;end process;end;`);
 for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=5ns']])execFileSync('ghdl',args,{cwd:dir});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const split='format schematic-text 1\ncircuit split_demo\ninput a[8]\noutput y[4]\npart t BUSTAP bit=4 nbit=4\nconnect a -> t.d\nconnect t.y -> y';
const merge='format schematic-text 1\ncircuit merge_demo\ninput lo[4], hi[4]\noutput y[8]\npart l BUSTAP bit=0 nbit=4 mode=merge\npart h BUSTAP bit=4 nbit=4 mode=merge\nconnect lo -> l.y\nconnect hi -> h.y\nconnect l.d -> y\nconnect h.d -> y';
test('bus split and merge use real bus widths and reject overlap / range errors',()=>{
 for(const text of [split,merge]){const a=setup(text);assert.equal(a.json('compileSchematicText(sourceText).warnings').length,0);a.run('importSchematicText(sourceText)');assert.equal(a.json('generateSchVhdl(activeSch()).fallbacks').length,0);}
 for(const [text,pattern] of [[split.replace('bit=4','bit=6'),/เกินความกว้าง/],[merge.replace('part h BUSTAP bit=4','part h BUSTAP bit=2'),/ซ้อน/],[merge+'\ninput full[8]\nconnect full -> y',/ตัวขับเต็มบัส/]]){const a=setup(text);assert.throws(()=>a.run('compileSchematicText(sourceText)'),pattern);}
});
test('merge and split VHDL simulate exact bit ordering',t=>{
 try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
 for(const [text,top,signals,mapping,stimulus] of [[split,'split_demo','signal a:std_logic_vector(7 downto 0);signal y:std_logic_vector(3 downto 0);','a=>a,y=>y',`a<=x"A5";wait for 1 ns;assert y=x"A" severity failure;`],[merge,'merge_demo','signal lo,hi:std_logic_vector(3 downto 0);signal y:std_logic_vector(7 downto 0);','lo=>lo,hi=>hi,y=>y',`lo<=x"5";hi<=x"A";wait for 1 ns;assert y=x"A5" severity failure;`]]){
 const a=setup(text);a.run('importSchematicText(sourceText)');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-bus-'));
 try{fs.writeFileSync(path.join(dir,'design.vhd'),a.run('generateSchVhdl(activeSch()).code')+`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;architecture test of tb is ${signals} begin dut:entity work.${top} port map(${mapping});process begin ${stimulus} wait;end process;end;`);
 for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=5ns']])execFileSync('ghdl',args,{cwd:dir});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}}
});
test('rejects inherited type keys and VHDL-normalized name collisions',()=>{
 for(const text of ['format schematic-text 1\ncircuit foo\npart x constructor','format schematic-text 1\ncircuit foo\nuse "SCH:constructor" as x\npart i @x','format schematic-text 1\ncircuit foo\ninput a__b, a_b']){
 const a=setup(text);assert.throws(()=>a.run('compileSchematicText(sourceText)'),/บรรทัด/);}
});
test('bundled reuse example simulates hierarchy with two shared MUX instances',t=>{
 try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
 const a=setup();a.run('importSchematicText(sourceText)');
 a.ctx.sourceText=fs.readFileSync(path.join(__dirname,'examples/reuse-mux.sch.txt'),'utf8');
 a.run('importSchematicText(sourceText);state.project.topId=state.activeId');
 const all=a.json('generateAllVhdl()');const code=Object.values(all).map(e=>typeof e==='string'?e:e.code).join('\n');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'st-hierarchy-'));
 try{fs.writeFileSync(path.join(dir,'design.vhd'),code+`\nlibrary ieee; use ieee.std_logic_1164.all;entity tb is end;architecture test of tb is
 signal a,b,c,result:std_logic_vector(7 downto 0);signal sel:std_logic;
 begin dut:entity work.mux_pair port map(a=>a,b=>b,c=>c,sel=>sel,result=>result);
 process begin a<=x"12";b<=x"34";c<=x"56";sel<='0';wait for 1 ns;assert result=x"12" severity failure;
 sel<='1';wait for 1 ns;assert result=x"56" severity failure;wait;end process;end;`);
 for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=5ns']])execFileSync('ghdl',args,{cwd:dir});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('malformed quoted parameter reports its source line',()=>{
 const a=setup('format schematic-text 1\ncircuit foo\npart k CONST value="\\q"');assert.throws(()=>a.run('compileSchematicText(sourceText)'),/บรรทัด 3/);
});
