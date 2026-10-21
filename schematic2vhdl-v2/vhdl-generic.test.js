const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const moduleFile=(generics='WIDTH:positive range 1 to 64:=8',ports='a:in unsigned(WIDTH-1 downto 0);y:out unsigned(WIDTH-1 downto 0)',body='y<=a;')=>({fileName:'param_box.vhd',vhdl:`library ieee;use ieee.std_logic_1164.all;use ieee.numeric_std.all;
entity param_box is generic(${generics});port(${ports});end;
architecture rtl of param_box is begin ${body} end;`});
function setup(f=moduleFile()){const a=loadApp();a.ctx.files=[f];a.run('applyVhdlModuleImport(planVhdlModuleImport(files));');return a;}
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
function compile(a,tb=''){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vhdl-generic-'));
 try{fs.writeFileSync(path.join(dir,'bundle.vhd'),a.json('Object.values(generateAllVhdl()).map(v=>typeof v==="string"?v:v.code)').join('\n')+tb);
 execFileSync('ghdl',['-a','--std=08','bundle.vhd'],{cwd:dir,stdio:'pipe'});
 if(tb){execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=20ns'],{cwd:dir,stdio:'pipe'});}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('bounded integer parser follows VHDL integer arithmetic without executing code',()=>{
 const a=loadApp();for(const [expr,value] of [['2+3*4',14],['(2+3)*4',20],['2**6',64],['-7/3',-2],['(-7) mod 3',2],['(-7) rem 3',-1],['16#ff# + 1',256],['1_000 / 10',100],['Width-1',7]]){
 a.ctx.expr=expr;assert.equal(a.run('vhdlIntegerExpression(expr,{width:8})'),value);}
 for(const expr of ['window.alert(1)','WIDTH.value','Math.pow(2,3)','WIDTH;1','1/0','1 mod 0','2**32','9007199254740992','1+', '1 2', '('.repeat(40)+'1'+')'.repeat(40)]){
 a.ctx.expr=expr;assert.throws(()=>a.run('vhdlIntegerExpression(expr,{width:8})'));}
});
test('generic defaults, dependent defaults, bounds and ascending/nonzero port ranges resolve per instance',()=>{
 const a=setup(moduleFile('WIDTH:positive range 1 to 64:=8; OFFSET:natural:=4; LIMIT:integer range -4 to WIDTH:=WIDTH-1','a:in signed(OFFSET to OFFSET+WIDTH-1);y:out signed(OFFSET to OFFSET+WIDTH-1)'));
 a.run('const cc=state.project.customs.param_box;');
 assert.deepEqual(a.json('vhdlGenericValues(cc,{generic_WIDTH:16})'),{width:16,offset:4,limit:15});
 assert.deepEqual(a.json('customPorts(cc,{generic_WIDTH:16})').map(p=>[p.width,p.left,p.right]),[[16,4,19],[16,4,19]]);
 a.run("const small=addComp('CUSTOM:param_box',0,0,{generic_WIDTH:8}),large=addComp('CUSTOM:param_box',100,0,{generic_WIDTH:64});");
 assert.equal(a.run('getPort(comp(small),"a").width'),8);assert.equal(a.run('getPort(comp(large),"a").width'),64);
 assert.equal(a.run('Object.keys(comp(small).params).length'),1);
});
test('invalid generic declarations and unsupported expressions fail before import mutation',()=>{
 const a=loadApp(),before=a.run('serialize()');
 for(const generics of ['WIDTH:positive','WIDTH:real:=8.0','WIDTH:positive:=0','WIDTH:integer range 8 to 1:=4','WIDTH:integer range 1 downto 0:=0','WIDTH:positive:=OTHER','WIDTH:positive:=WIDTH','WIDTH:integer:=2147483648','WIDTH:positive:=8; width:positive:=8']){
 a.ctx.files=[moduleFile(generics)];assert.throws(()=>a.run('planVhdlModuleImport(files)'));assert.equal(a.run('serialize()'),before);}
 for(const expr of ['clog2(WIDTH)','WIDTH\'length','WIDTH*100','WIDTH/0']){
 a.ctx.files=[moduleFile(undefined,`a:in unsigned(${expr} downto 0);y:out std_logic`)];assert.throws(()=>a.run('planVhdlModuleImport(files)'));}
});
test('parameter preview is pure, rejects invalid values and Apply/Undo affects only one instance',()=>{
 const a=setup();a.run(`const sch=activeSch();const small=addComp('CUSTOM:param_box',100,0),other=addComp('CUSTOM:param_box',200,0,{generic_WIDTH:64}),out=addComp('OUT',400,0,{width:8});sch.wires.push({id:uid('w'),from:{cid:small,pid:'y'},to:{cid:out,pid:'i'}});snapshot();`);
 const before=a.run('serialize()'),idx=a.run('state.history.idx');a.run('const change=planComponentParamChange(sch,comp(small),"generic_WIDTH",16);');
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('change.changedWires.length'),1);
 for(const value of [0,65,8.5,NaN,'16']){a.ctx.value=value;assert.throws(()=>a.run('planComponentParamChange(sch,comp(small),"generic_WIDTH",value)'));assert.equal(a.run('serialize()'),before);}
 a.run('applyComponentParamChange(sch,comp(small),change)');const after=a.run('serialize()');
 assert.equal(a.run('getPort(comp(small),"y").width'),16);assert.equal(a.run('getPort(comp(other),"y").width'),64);assert.equal(a.run('sch.wires.length'),1);assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('stale parameter plans and unknown overrides are rejected without mutation',()=>{
 const a=setup();a.run("const sch=activeSch(),id=addComp('CUSTOM:param_box',0,0);const change=planComponentParamChange(sch,comp(id),'generic_WIDTH',16);comp(id).params.generic_WIDTH=32;");
 const before=a.run('serialize()');assert.throws(()=>a.run('applyComponentParamChange(sch,comp(id),change)'),/วงจรเปลี่ยนไป/);assert.equal(a.run('serialize()'),before);
 assert.throws(()=>a.run('planComponentParamChange(sch,comp(id),"generic_WIDHT",16)'),/ไม่รู้จัก/);
 assert.throws(()=>a.run('addComp("CUSTOM:param_box",0,0,{generic_WIDHT:16})'),/ไม่รู้จัก/);
});
test('saved project and mixed module package retain overrides and reject invalid saved instances',()=>{
 const a=setup();a.run("const id=addComp('CUSTOM:param_box',0,0,{generic_WIDTH:64});const saved=serialize();deserialize(saved);");
 assert.equal(a.run('getPort(comp(id),"a").width'),64);
 a.run("const wrapper={name:'wrapper',schematic:{name:'wrapper',components:[{id:'inner',type:'CUSTOM:param_box',params:{generic_WIDTH:32},x:0,y:0}],wires:[]}};const pkg={type:'schstudio-custom-pkg',customs:{wrapper,param_box:state.project.customs.param_box}};const staged=planCustomPackageImport(pkg,{schematics:{},customs:{}});");
 assert.equal(a.run('staged.wrapper.schematic.components[0].params.generic_WIDTH'),32);
 a.run('state.project.schematics[state.project.topId].components[0].params.generic_WIDTH=128');
 assert.throws(()=>a.run('validateVhdlModules(state.project)'),/WIDTH/);
 assert.throws(()=>a.run('buildProjectImport(state.project,{schematics:{},customs:{}})'),/WIDTH/);
});
test('Schematic Text and AI catalog expose generic settings and configured port widths',()=>{
 const a=setup();a.ctx.text=`format schematic-text 1\ncircuit param_top\ninput data[64]\noutput result[64]\nuse "CUSTOM:param_box" as block\npart box @block generic_WIDTH=64\nconnect data -> box.a\nconnect box.y -> result`;
 a.run('const result=compileSchematicText(text);');assert.equal(a.run('result.sch.components.find(c=>c.id==="box").params.generic_WIDTH'),64);
 assert.match(a.run('schematicTextCatalog(["CUSTOM:param_box"])'),/generic_WIDTH/);
 a.ctx.text=a.ctx.text.replace('generic_WIDTH=64','generic_WIDTH=65');assert.throws(()=>a.run('compileSchematicText(text)'),/WIDTH/);
});
test('GHDL one entity serves 8/64-bit instances with independent generic maps and native adapters',{skip:!hasGhdl},()=>{
 const a=setup();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 for(const width of [8,64]){const input=addComp('IN',0,width,{name:'d'+width,width}),box=addComp('CUSTOM:param_box',200,width,{generic_WIDTH:width}),output=addComp('OUT',400,width,{name:'q'+width,width});sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:box,pid:'a'}},{id:uid('w'),from:{cid:box,pid:'y'},to:{cid:output,pid:'i'}});}`);
 const code=a.run('generateSchVhdl(activeSch()).code');assert.match(code,/WIDTH => 8/);assert.match(code,/WIDTH => 64/);assert.equal((code.match(/component param_box/g)||[]).length,1);assert.match(code,/unsigned\(WIDTH-1 downto 0\)/);
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 compile(a,`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is signal q8:std_logic_vector(7 downto 0);signal q64:std_logic_vector(63 downto 0);begin u:entity work.top port map(d8=>x"A5",d64=>x"123456789ABCDEF0",q8=>q8,q64=>q64);process begin wait for 2 ns;assert q8=x"A5" and q64=x"123456789ABCDEF0" severity failure;wait;end process;end;`);
});
test('GHDL dependent defaults and ascending single-element vector adapt correctly',{skip:!hasGhdl},()=>{
 const a=setup(moduleFile('WIDTH:positive:=8; OFFSET:natural:=4; SPAN:positive:=WIDTH*2; BIAS:integer range -8 to 8:=-1','a:in signed(OFFSET to OFFSET+WIDTH-1);y:out signed(OFFSET to OFFSET+WIDTH-1)'));
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];const input=addComp('IN',0,0),box=addComp('CUSTOM:param_box',200,0,{generic_WIDTH:1}),output=addComp('OUT',400,0);sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:box,pid:'a'}},{id:uid('w'),from:{cid:box,pid:'y'},to:{cid:output,pid:'i'}});`);
 compile(a,`\nlibrary ieee;use ieee.std_logic_1164.all;entity tb is end;architecture sim of tb is signal q:std_logic;begin u:entity work.top port map(in0=>'1',out0=>q);process begin wait for 2 ns;assert q='1' severity failure;wait;end process;end;`);
});
test('source replacement previews all instances, preserves settings, removes missing pins and has full Undo/Redo',()=>{
 const a=setup(),replacement=moduleFile(undefined,'d:in unsigned(WIDTH-1 downto 0);y:out signed(WIDTH-1 downto 0)','y<=signed(d);').vhdl;
 a.run(`const sch=activeSch();const id=addComp('CUSTOM:param_box',100,0,{generic_WIDTH:16}),input=addComp('IN',0,0,{width:16}),output=addComp('OUT',400,0,{width:16});sch.wires.push({id:uid('w'),from:{cid:input,pid:'o'},to:{cid:id,pid:'a'}},{id:uid('w'),from:{cid:id,pid:'y'},to:{cid:output,pid:'i'}});state.project.customs.wrapper={name:'wrapper',schematic:{name:'wrapper',components:[{id:'wrapped',type:'CUSTOM:param_box',params:{generic_WIDTH:64},x:0,y:0}],wires:[]}};snapshot();`);
 a.ctx.replacement=replacement;const before=a.run('serialize()');a.run('const plan=planVhdlModuleReplacement("param_box",replacement);');
 assert.equal(a.run('serialize()'),before);assert.equal(a.run('plan.changes.length'),2);assert.equal(a.run('plan.changes[0].removedWires.length'),1);assert.equal(a.run('plan.changes[0].changedWires.length'),1);
 a.run('applyVhdlModuleReplacement(plan)');const after=a.run('serialize()');assert.equal(a.run('activeSch().wires.length'),1);assert.equal(a.run('comp(id).params.generic_WIDTH'),16);assert.equal(a.run('getPort(comp(id),"d").width'),16);assert.equal(a.run('state.project.customs.param_box.vhdl'),replacement);
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
});
test('invalid or stale source replacements fail atomically and removed generic settings are explicit',()=>{
 const a=setup();a.run("const id=addComp('CUSTOM:param_box',0,0,{generic_WIDTH:64});");const before=a.run('serialize()');
 for(const replacement of [moduleFile('WIDTH:positive range 1 to 8:=8').vhdl,moduleFile().vhdl.replace('param_box','renamed'),moduleFile().vhdl.replace('y<=a;','u:entity work.missing port map(a,y);')]){
 a.ctx.replacement=replacement;assert.throws(()=>a.run('planVhdlModuleReplacement("param_box",replacement)'));assert.equal(a.run('serialize()'),before);}
 a.ctx.replacement=moduleFile().vhdl;a.run('const plan=planVhdlModuleReplacement("param_box",replacement);comp(id).label="changed";');const changed=a.run('serialize()');assert.throws(()=>a.run('applyVhdlModuleReplacement(plan)'),/preview/);assert.equal(a.run('serialize()'),changed);
 a.ctx.replacement=moduleFile().vhdl.replace('generic(WIDTH:positive range 1 to 64:=8);','').replaceAll('WIDTH-1','7');a.run('const fixed=planVhdlModuleReplacement("param_box",replacement);');assert.deepEqual(a.json('fixed.changes[0].dropped'),['generic_WIDTH']);
 a.run('applyVhdlModuleReplacement(fixed)');assert.deepEqual(a.json('comp(id).params'),{});
});
test('placement fields show dependent defaults while partial overrides remain valid',()=>{
 const a=setup(moduleFile('WIDTH:positive:=8; OTHER:positive:=WIDTH*2'));
 a.run("const draft=makePlacementDraft('CUSTOM:param_box',0,0);draft.params.generic_WIDTH=16;validatePlacementParams(draft.type,draft.params);");
 assert.match(a.run('componentParamFields(draft)'),/data-pk="generic_OTHER"[^>]*value="32"/);
 assert.equal(a.run('getPorts(draft)[0].width'),16);
 a.run('draft.params.generic_WIDTH=65');assert.throws(()=>a.run('validatePlacementParams(draft.type,draft.params)'),/1–64/);
});
test('same-width range changes report connected wires and AI signatures detect generic interface drift',()=>{
 const a=setup(moduleFile('WIDTH:positive:=8; OFFSET:natural:=4','a:in unsigned(OFFSET+WIDTH-1 downto OFFSET);y:out unsigned(OFFSET+WIDTH-1 downto OFFSET)'));
 a.run(`const sch=activeSch(),id=addComp('CUSTOM:param_box',0,0),out=addComp('OUT',400,0,{width:8});sch.wires.push({id:uid('w'),from:{cid:id,pid:'y'},to:{cid:out,pid:'i'}});const change=planComponentParamChange(sch,comp(id),'generic_OFFSET',8);const sig=schematicTextSignature('CUSTOM:param_box');`);
 assert.equal(a.run('change.changedWires.length'),1);assert.equal(a.run('change.changedPorts.length'),2);
 a.ctx.replacement=moduleFile('WIDTH:positive:=8; OFFSET:natural:=4','a:in unsigned(OFFSET+WIDTH-1 downto OFFSET);y:out unsigned(OFFSET+WIDTH-1 downto OFFSET)').vhdl.replace('OFFSET:natural:=4','OFFSET:natural range 0 to 16:=4');
 a.run('applyVhdlModuleReplacement(planVhdlModuleReplacement("param_box",replacement));');assert.notEqual(a.run('schematicTextSignature("CUSTOM:param_box")'),a.run('sig'));
});
test('GHDL generic-only entity exports valid generic map without a port clause',{skip:!hasGhdl},()=>{
 const f=moduleFile('LIMIT:natural:=2**4','',"assert LIMIT=32 severity failure;");f.vhdl=f.vhdl.replace('port();','');
 const a=setup(f);
 a.run("addComp('CUSTOM:param_box',0,0,{generic_LIMIT:32});");assert.match(a.run('generateSchVhdl(activeSch()).code'),/generic map \(LIMIT => 32\);/);
 compile(a,`\nentity tb is end;architecture sim of tb is begin u:entity work.top;end;`);
});
