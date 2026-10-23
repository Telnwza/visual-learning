const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
function fixture(a,source='F = (A & B) | (!A & C)'){
  a.ctx.source=source;a.run(`const table=logicEquationsToTable(source,['A','B','C'],['F']);`);
}
test('strict Boolean expressions support precedence, parentheses, aliases, postfix NOT and case-insensitive names',()=>{
  const a=loadApp();
  for(const expression of ['a and B OR not a AND c','(A * B) + (A\' * C)','(A & B) | (~A & C)']){
    a.ctx.expression=expression;
    assert.deepEqual(a.json(`logicEquationsToTable(expression,['A','B','C'],['F']).rows`),[[0],[1],[0],[1],[0],[0],[1],[1]]);
  }
  assert.deepEqual(a.json(`logicEquationsToTable('F = A | B & C; G = !(A xor C)',['A','B','C'],['F','G']).rows`),
    [[0,1],[0,0],[0,1],[1,0],[1,0],[1,1],[1,0],[1,1]]);
});
test('invalid expressions never silently produce a partial or stale truth table',()=>{
  const a=loadApp();
  for(const source of ['F =','F = A && B','F = A B','F = A +','F = (A & B','F = A / B','F = D','Q = A','F = A; F = B','F = A = B','F = 2','F = A ? B : C','F = '+ '!'.repeat(65)+'A']){
    a.ctx.source=source;const before=a.run('serialize()');
    assert.throws(()=>a.run(`logicEquationsToTable(source,['A','B','C'],['F'])`),undefined,source);
    assert.equal(a.run('serialize()'),before);
  }
  assert.throws(()=>a.run(`logicEquationsToTable('F = A',['A'],['F','G'])`),/G/);
});
test('port names, table dimensions and circuit modes are checked before mutation',()=>{
  const a=loadApp();fixture(a);const before=a.run('serialize()');
  for(const code of [
    `makeLogicTable('A,a','F')`,`makeLogicTable('A','a')`,`makeLogicTable('A__B','F')`,`makeLogicTable('and','F')`,
    `makeLogicTable('A,B,C,D,E,F,G','Y')`,`makeLogicTable('A','Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7,Y8')`,
    `compileLogicMux({...table,rows:[[0]]})`,`compileLogicMux({...table,rows:table.rows.map(()=>[2])})`,
    `createLogicCircuit(table,{mode:'invalid'})`,`compileLogicMux(table,{name:'bad name'})`,
    `compileLogicSop(table,{equations:'F = A'})`,`compileLogicSop({...table,rows:table.rows.map(()=>[1])},{equations:'F = A'})`
  ]){assert.throws(()=>a.run(code),undefined,code);assert.equal(a.run('serialize()'),before);}
});
test('renaming preserves values; adding/removing/reordering inputs and outputs preserves matched columns',()=>{
  const a=loadApp();
  a.run(`const original=logicEquationsToTable('F = A xor B; G = A',['A','B'],['F','G']);`);
  assert.deepEqual(a.json(`makeLogicTable('X,B','F,G',original).rows`),a.json('original.rows'));
  assert.deepEqual(a.json(`makeLogicTable('B,A,C','G,F,H',original).rows`),
    [[0,0,0],[0,0,0],[1,1,0],[1,1,0],[0,1,0],[0,1,0],[1,0,0],[1,0,0]]);
  assert.deepEqual(a.json(`makeLogicTable('B','G,F',original).rows`),[[0,0],[0,1]]);
});
test('truth-table equations round-trip all 256 three-input functions',()=>{
  const a=loadApp();
  a.run(`for(let bits=0;bits<256;bits++){
    const t=makeLogicTable('A,B,C','F');t.rows.forEach((r,i)=>r[0]=(bits>>i)&1);
    const restored=logicEquationsToTable(logicTableEquations(t),t.inputs,t.outputs);
    if(JSON.stringify(restored)!==JSON.stringify(t))throw new Error('round trip '+bits);
  }`);
});
test('both circuit modes exhaustively verify all 256 three-input functions without changing project or history',()=>{
  const a=loadApp(),before=a.run('serialize()'),uid=a.run('_uidN'),history=a.run('state.history.idx');
  a.run(`for(let bits=0;bits<256;bits++)for(const mode of ['mux','sop']){
      const t=makeLogicTable('A,B,C','F');t.rows.forEach((r,i)=>r[0]=(bits>>i)&1);
      const result=mode==='mux'?compileLogicMux(t):compileLogicSop(t);
      if(result.warnings.length)throw new Error(result.warnings.join('; '));
      const allowed=mode==='mux'?['IN','OUT','MUX','CONST']:['IN','OUT','AND','OR','NOT','CONST'];
      if(result.sch.components.some(c=>!allowed.includes(c.type)))throw new Error('unexpected component');
      if(mode==='mux'&&result.sch.components.filter(c=>c.type==='MUX').length!==1)throw new Error('expected one lookup MUX');
    }`);
  assert.equal(a.run('serialize()'),before);assert.equal(a.run('_uidN'),uid);assert.equal(a.run('state.history.idx'),history);
});
test('lookup MUX data pins contain independent constants; every input goes only to its Select pin, MSB first',()=>{
  const a=loadApp();a.run(`const table=logicEquationsToTable('F = A xor B',['A','B'],['F']);const result=compileLogicMux(table).sch;`);
  const result=a.json('result'),mux=result.components.find(c=>c.type==='MUX');
  assert.equal(mux.params.inputs,4);assert.equal(mux.params.width,1);
  assert.equal(result.wires.find(w=>w.to.cid===mux.id&&w.to.pid==='s1').from.cid,'A');
  assert.equal(result.wires.find(w=>w.to.cid===mux.id&&w.to.pid==='s0').from.cid,'B');
  const constants=[0,1,2,3].map(i=>{
    const wire=result.wires.find(w=>w.to.cid===mux.id&&w.to.pid==='d'+i);
    return result.components.find(c=>c.id===wire.from.cid);
  });
  assert.deepEqual(constants.map(c=>c.type),['CONST','CONST','CONST','CONST']);
  assert.deepEqual(constants.map(c=>parseInt(c.params.value,16)),[0,1,1,0]);
  assert.equal(new Set(constants.map(c=>c.id)).size,4);
  for(const source of ['F = 0','F = 1','F = A']){
    a.ctx.source=source;
    assert.equal(a.run(`(()=>{const t=logicEquationsToTable(source,['A'],['F']);const s=compileLogicMux(t).sch;verifyLogicCircuit(s,t);return s.components.find(c=>c.type==='MUX').params.inputs;})()`),2);
  }
});
test('SOP equations keep the written products, share NOT gates and handle direct literals, contradictions and constants',()=>{
  const a=loadApp();fixture(a);
  a.run(`const s=compileLogicSop(table,{equations:source}).sch;`);
  assert.deepEqual(a.json(`['AND','OR','NOT'].map(type=>s.components.filter(c=>c.type===type).length)`),[2,1,1]);
  for(const source of ['F = A; G = !A','F = 0; G = 1','F = A & !A; G = A | !A','F = A & A; G = !A | !A','F = (A | B) & C; G = A xor C']){
    a.ctx.source=source;
    assert.deepEqual(a.json(`(()=>{const t=logicEquationsToTable(source,['A','B','C'],['F','G']);const result=compileLogicSop(t,{equations:source});verifyLogicCircuit(result.sch,t);return result.warnings;})()`),[]);
  }
  a.run(`const parity=logicEquationsToTable('F = A xor B xor C xor D xor E',['A','B','C','D','E'],['F']);const result=compileLogicSop(parity);`);
  assert.equal(a.run(`result.sch.components.every(c=>!['AND','OR'].includes(c.type)||c.params.inputs<=8)`),true);
});
test('six-input / eight-output tables round-trip, internal IDs cannot collide with user names, and a wiring error is detected',()=>{
  const a=loadApp();a.run(`const table=makeLogicTable('A,B,C,D,E,F','Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7');
    table.rows.forEach((values,row)=>values.forEach((_,col)=>values[col]=((row*29+col*11)^(row>>col))&1));
    const restored=logicEquationsToTable(logicTableEquations(table),table.inputs,table.outputs);
    const result=compileLogicMux(restored);`);
  assert.deepEqual(a.json('restored'),a.json('table'));assert.deepEqual(a.json('result.warnings'),[]);
  assert.equal(a.run(`result.sch.components.filter(c=>c.type==='MUX').length`),1);
  assert.equal(a.run(`result.sch.components.find(c=>c.type==='MUX').params.inputs`),64);
  assert.equal(a.run(`result.sch.components.find(c=>c.type==='MUX').params.width`),8);
  assert.equal(a.run(`result.sch.components.filter(c=>c.type==='CONST').length`),64);
  a.run(`const collision=logicEquationsToTable('F = !lookup_mux & lookup_d0',['lookup_mux','lookup_d0'],['F']);compileLogicMux(collision);compileLogicSop(collision);`);
  const b=loadApp();fixture(b);b.run('const result=compileLogicMux(table);result.sch.wires[0].from.cid="missing";');
  assert.throws(()=>b.run('verifyLogicCircuit(result.sch,table)'),/สายขาด/);
});
for(const mode of ['mux','sop'])test(`${mode} creation adds one editable schematic, preserves the drawing and supports Undo/Redo and save/reload`,()=>{
  const a=loadApp();fixture(a);const before=a.run('serialize()'),history=a.run('state.history.idx'),original=a.json('activeSch()');
  a.ctx.mode=mode;a.run(`const result=createLogicCircuit(table,{mode,equations:source});`);
  assert.equal(a.run('state.history.idx'),history+1);assert.deepEqual(a.json(`state.project.schematics[${JSON.stringify(original.id)}]`),original);
  assert.equal(a.run('activeSch().name'),'logic_circuit');assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
  a.run('verifyLogicCircuit(activeSch(),table)');const after=a.run('serialize()');
  a.run('undo()');assert.equal(a.run('serialize()'),before);a.run('redo()');assert.equal(a.run('serialize()'),after);
  a.run('createLogicCircuit(table,{mode,equations:source})');assert.equal(a.run('activeSch().name'),'logic_circuit_2');
  const saved=a.run('serialize()');a.ctx.saved=saved;a.run('deserialize(saved);verifyLogicCircuit(activeSch(),table)');
  assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
  a.run('state.placementMode={};');const locked=a.run('serialize()');assert.throws(()=>a.run('createLogicCircuit(table,{mode})'),/Placement Mode/);assert.equal(a.run('serialize()'),locked);
});
for(const mode of ['mux','sop'])test(`generated ${mode} VHDL simulates all 32 rows and multiple outputs`,t=>{
  try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
  const a=loadApp();a.ctx.mode=mode;
  a.run(`const table=makeLogicTable('A,B,C,D,E','F,G,H');
    table.rows.forEach((r,row)=>{
      const [a,b,c,d,e]=[16,8,4,2,1].map(mask=>Number(!!(row&mask)));
      r[0]=a^b^c^d^e;r[1]=(a&b)|(c&d)|e;r[2]=a?c:e;
    });
    createLogicCircuit(table,{mode});verifyLogicCircuit(activeSch(),table);`);
  assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
  const table=a.json('table'),code=a.run('generateSchVhdl(activeSch()).code');
  const stimuli=table.rows.map((values,row)=>{
    const bits=row.toString(2).padStart(5,'0');
    return [...'abcde'].map((n,i)=>`${n}<='${bits[i]}';`).join('')+'wait for 1 ns;'+[...'fgh'].map((n,i)=>`assert ${n}='${values[i]}' report "row ${row}, ${n}" severity failure;`).join('');
  }).join('\n');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'logic-mux-'));
  try{
    fs.writeFileSync(path.join(dir,'design.vhd'),code+`\nlibrary ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture test of tb is signal a,b,c,d,e,f,g,h:std_logic;begin
dut:entity work.logic_circuit port map(a=>a,b=>b,c=>c,d=>d,e=>e,f=>f,g=>g,h=>h);
process begin ${stimuli} wait;end process;end;`);
    for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=40ns']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe'});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('64:1 lookup with eight outputs preserves Select and output bit order in generated VHDL',t=>{
  try{execFileSync('ghdl',['--version']);}catch{t.skip('GHDL unavailable');return;}
  const a=loadApp();a.run(`const table=makeLogicTable('A,B,C,D,E,F','Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7');
    table.rows.forEach((values,row)=>values.forEach((_,col)=>values[col]=(((row*73+19)&255)>>(7-col))&1));
    createLogicCircuit(table);verifyLogicCircuit(activeSch(),table);`);
  assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
  const stimuli=Array.from({length:64},(_,row)=>{
    const input=row.toString(2).padStart(6,'0'),expected=((row*73+19)&255).toString(2).padStart(8,'0');
    return [...'abcdef'].map((n,i)=>`${n}<='${input[i]}';`).join('')+'wait for 1 ns;'+[...expected].map((v,i)=>`assert y${i}='${v}' report "row ${row}, y${i}" severity failure;`).join('');
  }).join('\n');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'logic-lookup-wide-'));
  try{
    fs.writeFileSync(path.join(dir,'design.vhd'),a.run('generateSchVhdl(activeSch()).code')+`\nlibrary ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture test of tb is signal a,b,c,d,e,f,y0,y1,y2,y3,y4,y5,y6,y7:std_logic;begin
dut:entity work.logic_circuit port map(a=>a,b=>b,c=>c,d=>d,e=>e,f=>f,y0=>y0,y1=>y1,y2=>y2,y3=>y3,y4=>y4,y5=>y5,y6=>y6,y7=>y7);
process begin ${stimuli} wait;end process;end;`);
    for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=70ns']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe'});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
