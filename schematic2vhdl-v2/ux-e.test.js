const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
test('Fit becomes the remembered sheet view after visiting or closing another tab',()=>{
 const a=loadApp();a.run(html.slice(html.indexOf('function autoFitSheet(force,tries)'),html.indexOf('\n/* =========================================================================\n   SYNTHESIS CHECK',html.indexOf('function autoFitSheet(force,tries)'))));
 a.run(`applyFit=()=>{state.view={x:0,y:0,k:1};return true;};const parent=activeSch(),child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;
 autoFitSheet();state.view={x:73,y:-112,k:1.7};openSchTab(child.id);openSchTab(parent.id);zoomFit();
 const fitted={...state.view};openSchTab(child.id);openSchTab(parent.id);`);
 assert.deepEqual(a.json('state.view'),a.json('fitted'));
 a.run('openSchTab(child.id);closeSchTab(child.id);');assert.deepEqual(a.json('state.view'),a.json('fitted'));
});
test('raw import → configured placement → I/O wiring → resize → save/reopen → latest export retains 64-bit behavior',async()=>{
 const a=loadApp(),folder=path.join(__dirname,'../fpga-exam-kit/modules/downloads/all-vhdl-modules');
 const files=fs.readdirSync(folder).filter(name=>name.endsWith('.vhd')).map(fileName=>({fileName,vhdl:fs.readFileSync(path.join(folder,fileName),'utf8')}));
 a.ctx.files=files;a.run(`applyVhdlModuleImport(planVhdlModuleImport(files));requestPalettePlacement('CUSTOM:ss_bus_reverse');
 state.componentPlacement.draft.params.generic_WIDTH=64;const id=commitComponentPlacement(),sch=activeSch(),box=comp(id);
 addIOMarkerAt(box,getPort(box,'d'));addIOMarkerAt(box,getPort(box,'y'));`);
 assert.equal(a.run('Object.keys(state.project.customs).length'),49);
 assert.deepEqual(a.json('sch.components.filter(c=>c.type==="IN"||c.type==="OUT").map(c=>c.params.width)'),[64,64]);
 assert.deepEqual(a.json('runSynthesis().filter(i=>i.lvl==="err")'),[]);
 a.els.get('#vhdlEntitySel').options=[];a.run(`generateVHDL();const size=getSize(box);applyDrawingResize(planDrawingResize(sch,box,{width:size.w+44,height:size.h+22}));
 sch.name='ux_e_current';sch.locked=true;snapshot();const saved=serialize();deserialize(saved);`);
 assert.equal(a.run('serialize()'),a.run('saved'));assert.equal(a.run('activeSch().locked'),true);
 assert.equal(a.run('getPort(comp(id),"d").width'),64);
 assert.equal(a.run('state.project.customs.ss_bus_reverse.vhdl'),files.find(f=>f.fileName==='ss_bus_reverse.vhd').vhdl);
 const blobs=[];a.ctx.document.createElement=()=>({click(){}});a.ctx.URL={createObjectURL(blob){blobs.push(blob);return 'blob:ux-e';},revokeObjectURL(){}};
 a.run('state.selection=new Set(activeSch().components.map(c=>c.id));duplicateSelection();');assert.equal(a.run('activeSch().components.length'),6);
 a.run('undo()');assert.equal(a.run('serialize()'),a.run('saved'));assert.equal(a.run('exportVhdlFile()'),true);
 const code=await blobs.at(-1).text();assert.match(code,/entity ux_e_current is/i);assert.doesNotMatch(code,/entity top is/i);assert.match(code,/WIDTH => 64/);
 assert.match(code,/entity ss_bus_reverse is/);assert.doesNotMatch(code,/entity ss_reg_pipo is/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-ux-e-'));
 try{
  const value='0123456789ABCDEF',expected=BigInt('0b'+BigInt('0x'+value).toString(2).padStart(64,'0').split('').reverse().join('')).toString(16).toUpperCase().padStart(16,'0');
  fs.writeFileSync(path.join(dir,'design.vhd'),code);
  fs.writeFileSync(path.join(dir,'tb.vhd'),`library ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture sim of tb is signal y:std_logic_vector(63 downto 0);begin
u:entity work.ux_e_current port map(in0=>x"${value}",out0=>y);
process begin wait for 1 ns;assert y=x"${expected}" severity failure;wait;end process;end;`);
  for(const args of [['-a','--std=08','design.vhd','tb.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=2ns']])
   execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
