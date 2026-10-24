const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
const gates=['AND','OR','NAND','NOR','XOR','XNOR'];
function circuit(width=8,inputs=2){
 const a=loadApp();a.ctx.source=`format schematic-text 1
circuit scalar_gate
input data[${width}],control${inputs===3?`,other[${width}]`:''}
output ${gates.map(g=>g.toLowerCase()+'_result['+width+']').join(',')}
${gates.map(g=>`part g_${g} ${g} inputs=${inputs} width=${width} scalarLast=true
connect data -> g_${g}.i0
${inputs===3?`connect other -> g_${g}.i1\n`:''}connect control -> g_${g}.i${inputs-1}
connect g_${g}.o -> ${g.toLowerCase()}_result`).join('\n')}`;
 a.run('importSchematicText(source);const sch=activeSch();');return a;
}
test('all six gates expose a last scalar input while other inputs and output retain WIDTH',()=>{
 const a=loadApp();
 for(const type of gates)for(const width of [1,2,7,8,32,64])for(const inputs of [2,3,8]){
  a.ctx.type=type;a.ctx.params={inputs,width,scalarLast:true};
  assert.deepEqual(a.json('getPorts({type,params}).map(p=>p.width)'),[...Array(inputs-1).fill(width),1,width]);
 }
 for(const type of ['NOT','BUF']){a.ctx.type=type;assert.equal(a.run('TYPES[type].paramSchema.some(f=>f.key==="scalarLast")'),false);}
});
test('legacy gates remain full width and editable when the new parameter is absent',()=>{
 const a=loadApp();
 for(const type of gates){
  a.ctx.type=type;
  assert.deepEqual(a.json('getPorts({type,params:{inputs:2,width:8}}).map(p=>p.width)'),[8,8,8]);
  a.run('validatePlacementParams(type,{inputs:2,width:8})');
 }
 a.run(`const sch=activeSch(),g={id:uid('c'),type:'AND',x:0,y:0,params:{inputs:2,width:8}};sch.components.push(g);
 applyComponentParamChange(sch,g,planComponentParamChange(sch,g,'width',16));`);
 assert.deepEqual(a.json('getPorts(g).map(p=>p.width)'),[16,16,16]);
 assert.throws(()=>a.run(`validatePlacementParams('AND',{inputs:2,width:8,scalarLast:'true'})`));
});
test('the Inspector uses the ordinary checkbox, including shared mixed selections',()=>{
 const a=circuit();a.run(`const g=sch.components.find(c=>c.type==='AND');`);
 assert.match(a.run('componentParamFields(g)'),/ขาสุดท้ายเป็น 1 bit/);
 assert.match(a.run('componentParamFields(g)'),/data-pk="scalarLast" checked/);
 assert.match(a.run('componentParamFields(g,[g,{...g,params:{...g.params,scalarLast:false}}])'),/data-pk="scalarLast" data-mixed="true"/);
});
test('scalar connections work with normal wiring, group wiring and quick constants; buses are rejected',()=>{
 const a=circuit(64);a.run(`const g=sch.components.find(c=>c.type==='AND'),ctrl=sch.components.find(c=>c.params.name==='control'),data=sch.components.find(c=>c.params.name==='data');
 sch.wires=sch.wires.filter(w=>w.to.cid!==g.id||w.to.pid!=='i1');const pin={cid:g.id,pid:'i1'};`);
 assert.equal(a.run(`wireConnectionError(sch,{cid:ctrl.id,pid:'o'},pin)`),'');
 assert.match(a.run(`wireConnectionError(sch,{cid:data.id,pid:'o'},pin)`),/64 → 1/);
 assert.equal(a.run(`planGroupPortConnection(sch,[g.id],'i1',{cid:ctrl.id,pid:'o'}).targets[0].kind`),'accept');
 a.run('applyQuickConstants([pin],1);');
 assert.equal(a.run(`sch.components.find(c=>c.type==='CONST').params.width`),1);
 assert.deepEqual(a.json('generateSchVhdl(sch).fallbacks'),[]);
});
test('changing the mode preserves wires, previews width changes and supports Undo/Redo and Save/Open',()=>{
 const a=circuit(),before=a.run('serialize()');a.run(`const g=sch.components.find(c=>c.type==='AND'),wires=JSON.stringify(sch.wires);
 const change=planComponentParamChange(sch,g,'scalarLast',false);`);
 assert.equal(a.run('serialize()'),before);assert.deepEqual(a.json('change.changedPorts.map(p=>p.id)'),['i1']);
 assert.equal(a.run('change.changedWires.length'),1);assert.equal(a.run('change.removedWires.length'),0);
 a.run('applyComponentParamChange(sch,g,change);');assert.equal(a.run('JSON.stringify(sch.wires)'),a.run('wires'));
 a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');
 assert.equal(a.run(`activeSch().components.find(c=>c.type==='AND').params.scalarLast`),false);
 a.run('undo();const saved=serialize();deserialize(saved);');
 assert.equal(a.run(`activeSch().components.find(c=>c.type==='AND').params.scalarLast`),true);
 assert.deepEqual(a.json(`getPorts(activeSch().components.find(c=>c.type==='AND')).map(p=>p.width)`),[8,1,8]);
});
for(const width of [1,8,64])test(`GHDL: all six ${width}-bit gates broadcast control to every bit across two buses`,t=>{
 try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{t.skip('GHDL unavailable');return;}
 const a=circuit(width,3),r=a.json('generateSchVhdl(sch)');assert.deepEqual(r.fallbacks,[]);
 const vector=width>1,decl=vector?`std_logic_vector(${width-1} downto 0)`:'std_logic';
 const patterns=['0'.repeat(width),'1'.repeat(width),Array.from({length:width},(_,i)=>i%2?'1':'0').join(''),'1'+'0'.repeat(width-1)];
 const literal=bits=>vector?'"'+bits+'"':"'"+bits+"'";
 const steps=[];
 for(const data of patterns)for(const other of patterns)for(const control of [0,1]){
  const expected=gates.map(g=>{
   const bits=Array.from(data,(_,i)=>{
    const a=Number(data[i]),b=Number(other[i]);
    const value=['AND','NAND'].includes(g)?a&b&control:['OR','NOR'].includes(g)?a|b|control:a^b^control;
    return String(['NAND','NOR','XNOR'].includes(g)?1-value:value);
   }).join('');return `${g.toLowerCase()}_out=${literal(bits)}`;
  });
  steps.push(`data<=${literal(data)};other<=${literal(other)};control<='${control}';wait for 1 ns;assert ${expected.join(' and ')} severity failure;`);
 }
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scalar-gate-'));
 try{
  fs.writeFileSync(path.join(dir,'design.vhd'),r.code+`\nlibrary ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture sim of tb is signal data,other,${gates.map(g=>g.toLowerCase()+'_out').join(',')}:${decl};signal control:std_logic;
begin dut:entity work.scalar_gate port map(data=>data,other=>other,control=>control,${gates.map(g=>g.toLowerCase()+'_result=>'+g.toLowerCase()+'_out').join(',')});
process begin ${steps.join('\n')} wait;end process;end;`);
  for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=40ns'],['--synth','--std=08','scalar_gate']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
