const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const base=path.join(__dirname,'../fpga-exam-kit/modules');
const read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
const packs=['registers','input-conditioning'];

test('fresh projects expose no module catalog or module source factories',()=>{
 const a=loadApp();assert.deepEqual(a.json('Object.keys(state.project.customs)'),[]);
 assert.equal(a.json('paletteEntries().filter(e=>e.type.startsWith("LIB:")||e.type.startsWith("CUSTOM:"))').length,0);
 assert.equal(a.run('typeof builtinModule'),'undefined');assert.equal(a.run('typeof planBuiltinModule'),'undefined');
 assert.equal(a.run('schematicTextType("LIB:PIPO")'),null);
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 assert.match(html,/data-act="import-custom">↓ Import Component Package/);
 assert.doesNotMatch(html,/entity ss_(?:reg|input)_/);
});
for(const category of packs)for(const cc of Object.values(read('packs/'+category+'.sccomp.json').customs))test(`${cc.name}: individual file imports independently with exact matching editable source`,()=>{
 const a=loadApp(),before=a.run('serialize()');a.ctx.payload=read(`${category}/${cc.name}.sccomp.json`);
 assert.equal(fs.readFileSync(path.join(base,category,cc.fileName),'utf8'),cc.vhdl);
 assert.deepEqual(a.ctx.payload.customs[cc.name],cc);
 a.ctx.vhdl=cc.vhdl;a.ctx.fileName=cc.fileName;
 assert.deepEqual(a.json('parseVhdlModuleFile({fileName,vhdl}).ports'),cc.ports);
 assert.equal(a.run('applyCustomPackages([payload])'),1);
 assert.deepEqual(a.json('Object.keys(state.project.customs)'),[cc.name]);
 assert.equal(a.json('explorerItems().filter(e=>e.kind==="custom")').length,1);
 a.run('renderPalette()');assert.doesNotMatch(a.els.get('#palettePane').innerHTML,/นำเข้าล่าสุด|REUSABLE CIRCUITS|data-pal="(?:CUSTOM:|SCH:)/);
 const imported=a.run('serialize()');a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),imported);
});
test('category packs import together atomically; duplicates and invalid later files preserve prior project/history',()=>{
 const a=loadApp(),before=a.run('serialize()');a.ctx.payloads=packs.map(p=>read('packs/'+p+'.sccomp.json'));
 assert.equal(a.run('applyCustomPackages(payloads)'),8);const after=a.run('serialize()');
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
 const idx=a.run('state.history.idx');assert.throws(()=>a.run('applyCustomPackages(payloads)'),/ชื่อซ้ำ/);
 assert.equal(a.run('serialize()'),after);assert.equal(a.run('state.history.idx'),idx);
 const empty=loadApp(),initial=empty.run('serialize()'),history=empty.run('state.history.idx');
 empty.ctx.payloads=[read('packs/registers.sccomp.json'),{type:'bad',customs:{}}];
 assert.throws(()=>empty.run('applyCustomPackages(payloads)'),/component file/);
 assert.equal(empty.run('serialize()'),initial);assert.equal(empty.run('state.history.idx'),history);
 empty.run('state.placementMode={};');assert.throws(()=>empty.run('applyCustomPackages([])'),/โหมด/);
});
test('embedded boxes reopen with their source and settings, and custom exports retain pack metadata',async()=>{
 const a=loadApp();a.ctx.payloads=packs.map(p=>read('packs/'+p+'.sccomp.json'));a.run(`applyCustomPackages(payloads);
 const id=addComp('CUSTOM:ss_reg_pipo',0,0,{generic_WIDTH:64}),button=addComp('CUSTOM:ss_input_debounce',200,0,{generic_STABLE_CYCLES:750000,generic_ACTIVE_LOW:1});
 const saved=serialize();deserialize(saved);validateVhdlModules(state.project);`);
 assert.equal(a.run('getPort(comp(id),"q").width'),64);
 assert.equal(a.run('comp(button).params.generic_STABLE_CYCLES'),750000);
 assert.match(a.run('componentParamFields(comp(button))'),/ตั้งระยะนิ่ง \(ms\)/);
 assert.equal(a.run('explorerItems().filter(e=>e.kind==="custom").length'),8);
 a.ctx.document.createElement=()=>({click(){}});
 let blob;a.ctx.URL={createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL(){}};
 a.run('exportCustomComponent("ss_input_debounce")');
 const exported=JSON.parse(await blob.text());assert.deepEqual(exported.customs.ss_input_debounce,read('input-conditioning/ss_input_debounce.sccomp.json').customs.ss_input_debounce);
 const b=loadApp();b.ctx.pkg=exported;assert.equal(b.run('applyCustomPackages([pkg])'),1);
});
test('raw VHDL remains importable without package-only defaults and friendly metadata',()=>{
 const a=loadApp();a.ctx.files=[{fileName:'ss_reg_pipo.vhd',vhdl:fs.readFileSync(path.join(base,'registers/ss_reg_pipo.vhd'),'utf8')}];
 a.run('applyVhdlModuleImport(planVhdlModuleImport(files));const id=addComp("CUSTOM:ss_reg_pipo",0,0,{generic_WIDTH:32});');
 assert.equal(a.run('getPort(comp(id),"q").width'),32);
 assert.equal(a.run('state.project.customs.ss_reg_pipo.defaultInputs'),undefined);
 assert.equal(a.run('state.project.customs.ss_reg_pipo.libraryId'),undefined);
});
test('file picker stays attached until change/cancel and imports selected disk files through its real handler',async()=>{
 const a=loadApp();let input,attached=false,removed=false,clicked=false;
 a.ctx.document.createElement=()=>input={click(){clicked=true;},remove(){removed=true;}};
 a.ctx.document.body.appendChild=()=>{attached=true;};
 const before=a.run('serialize()');a.run('importCustomComponent()');
 assert.ok(attached&&clicked);assert.equal(input.multiple,true);assert.equal(input.hidden,true);
 input.files=[{text:async()=>fs.readFileSync(path.join(base,'packs/registers.sccomp.json'),'utf8')},{text:async()=>fs.readFileSync(path.join(base,'packs/input-conditioning.sccomp.json'),'utf8')}];
 await input.onchange();assert.ok(removed);assert.equal(a.run('Object.keys(state.project.customs).length'),8);
 a.run('undo()');assert.equal(a.run('serialize()'),before);
 removed=false;a.run('importCustomComponent()');input.oncancel();assert.ok(removed);assert.equal(a.run('serialize()'),before);
});
