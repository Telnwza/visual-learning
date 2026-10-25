const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');

test('truth-table index is the leftmost column and output cells cycle 0 → 1 → X → 0',()=>{
 const a=loadApp();a.run(`const table=makeLogicTable('A,B,C','F');table.rows[3][0]=null;`);
 const html=a.run('logicTableMarkup(table)');
 assert.match(html,/<tr><th scope="col" class="logic-index">Index<\/th><th scope="col">A/);
 assert.deepEqual([...html.matchAll(/scope="row" class="logic-index">(\d+)/g)].map(m=>Number(m[1])),[0,1,2,3,4,5,6,7]);
 assert.match(html,/aria-label="F, index 3, 011, ค่า X">X<\/button>/);
 assert.deepEqual(a.json('[nextLogicValue(0),nextLogicValue(1),nextLogicValue(null)]'),[1,null,0]);
});
test('one through six inputs have complete K-maps with Gray-code neighbors and exact binary indices',()=>{
 const a=loadApp();
 for(let n=1;n<=6;n++){
  a.ctx.names='ABCDEF'.slice(0,n).split('');const map=a.json('logicKmapLayout(names)');
  assert.equal(map.rowInputs.length+map.colInputs.length,n);
  assert.deepEqual(map.indices.flat().sort((a,b)=>a-b),Array.from({length:2**n},(_,i)=>i));
  for(const axis of [map.rows,map.cols])if(axis.length>1)for(let i=0;i<axis.length;i++){
   const diff=axis[i]^axis[(i+1)%axis.length];assert.equal(diff>0&&(diff&(diff-1))===0,true);
  }
 }
 assert.deepEqual(a.json(`logicKmapLayout(['A','B','C','D']).indices`),[[0,1,3,2],[4,5,7,6],[12,13,15,14],[8,9,11,10]]);
 a.run(`const table=makeLogicTable('A,B,C,D','F,G');table.rows[10][1]=null;`);
 assert.match(a.run('logicKmapMarkup(table,1)'),/aria-label="G, index 10, 1010, ค่า X">X<\/button>/);
});
test('don’t care masks are independent per output, optional and reject invalid equations atomically',()=>{
 const a=loadApp();
 assert.deepEqual(a.json(`logicEquationsToTable('F = A; G = B',['A','B'],['F','G'],'G = !A & B').rows`),[[0,0],[0,null],[1,0],[1,1]]);
 const before=a.run('serialize()');
 for(const source of ['G = C','Q = A','G =','G = A; G = B']){
  a.ctx.source=source;assert.throws(()=>a.run(`logicEquationsToTable('F = A; G = B',['A','B'],['F','G'],source)`));
  assert.equal(a.run('serialize()'),before);
 }
});
test('all 6,561 ternary three-input tables round-trip equations and exact don’t care masks',()=>{
 const a=loadApp();a.run(`for(let code=0;code<6561;code++){
  const table=makeLogicTable('A,B,C','F');let k=code;
  table.rows.forEach(row=>{row[0]=[0,1,null][k%3];k=Math.floor(k/3);});
  const restored=logicEquationsToTable(logicTableEquations(table),table.inputs,table.outputs,logicTableDontCares(table));
  if(JSON.stringify(restored)!==JSON.stringify(table))throw new Error('ternary round trip '+code);
 }`);
});
test('SOP uses don’t cares to remove literals while MUX resolves X to ordinary binary constants',()=>{
 const a=loadApp();a.run(`const table=makeLogicTable('A,B,C','F');table.rows=[[0],[1],[0],[1],[0],[null],[0],[null]];
 const sop=compileLogicSop(table).sch,mux=compileLogicMux(table).sch;`);
 assert.equal(a.run('logicTableEquations(table)'),'F = C');
 assert.equal(a.run(`sop.components.some(c=>['AND','OR','NOT'].includes(c.type))`),false);
 assert.equal(a.run(`sop.wires.find(w=>w.to.cid==='F').from.cid`),'C');
 assert.deepEqual(a.json(`mux.components.filter(c=>c.type==='CONST').map(c=>parseInt(c.params.value,16))`),[0,1,0,1,0,0,0,0]);
 a.run(`compileLogicSop(table,{equations:'F = C'});`);
 assert.throws(()=>a.run(`compileLogicSop(table,{equations:'F = 0'})`),/ไม่ตรง/);
});
test('every two-input ternary function generates both circuits; care rows are still strictly verified',()=>{
 const a=loadApp(),before=a.run('serialize()');a.run(`for(let code=0;code<81;code++){
  const table=makeLogicTable('A,B','F');let k=code;
  table.rows.forEach(row=>{row[0]=[0,1,null][k%3];k=Math.floor(k/3);});
  compileLogicMux(table);compileLogicSop(table);
 }
 const table=logicEquationsToTable('F = A',['A'],['F'],'F = !A');
 const result=compileLogicMux(table);result.sch.components.find(c=>c.id==='lookup_d1').params.value='0';`);
 assert.throws(()=>a.run('verifyLogicCircuit(result.sch,table)'),/แถว 1/);assert.equal(a.run('serialize()'),before);
});
test('six-input / eight-output masks and schema round-trip; generated circuits survive Save/Open and Undo',()=>{
 const a=loadApp();a.run(`const table=makeLogicTable('A,B,C,D,E,F','Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7');
 table.rows.forEach((r,row)=>r.forEach((_,col)=>r[col]=[0,1,null][(row*7+col*5)%3]));
 const equations=logicTableEquations(table),masks=logicTableDontCares(table),restored=logicEquationsToTable(equations,table.inputs,table.outputs,masks);`);
 assert.deepEqual(a.json('restored'),a.json('table'));
 assert.deepEqual(a.json(`makeLogicTable('A,B,C,D,E,F','Y0,Y1,Y2,Y3,Y4,Y5,Y6,Y7',table)`),a.json('table'));
 a.run(`const short=makeLogicTable('A','Z');short.rows=[[null],[1]];`);
 assert.deepEqual(a.json(`makeLogicTable('X,B','R',short).rows`),[[null],[null],[1],[1]]);
 const original=a.run('serialize()');a.run('createLogicCircuit(table,{mode:"sop"})');
 assert.deepEqual(a.json('generateSchVhdl(activeSch()).fallbacks'),[]);
 a.run('undo()');assert.equal(a.run('serialize()'),original);a.run('redo();deserialize(serialize());verifyLogicCircuit(activeSch(),table)');
});
for(const mode of ['mux','sop'])test(`GHDL: ${mode} preserves specified outputs and emits binary values for X on all 64 rows`,t=>{
 try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{t.skip('GHDL unavailable');return;}
 const a=loadApp();a.ctx.mode=mode;
 a.run(`const table=makeLogicTable('A,B,C,D,E,F','Y0,Y1,Y2');
 table.rows.forEach((r,row)=>r.forEach((_,col)=>r[col]=row%5===col?null:((row>>(col+1))^(row>>col))&1));
 createLogicCircuit(table,{mode});`);
 const code=a.run('generateSchVhdl(activeSch()).code'),table=a.json('table');
 const stimuli=table.rows.map((values,row)=>{
  const bits=row.toString(2).padStart(6,'0');
  return [...'abcdef'].map((name,i)=>`${name}<='${bits[i]}';`).join('')+'wait for 1 ns;'+values.map((v,i)=>
   `assert ${v===null?(mode==='mux'?`y${i}='0'`:`(y${i}='0' or y${i}='1')`):`y${i}='${v}'`} report "row ${row}, Y${i}" severity failure;`).join('');
 }).join('\n');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'logic-kmap-'));
 try{
  fs.writeFileSync(path.join(dir,'design.vhd'),code+`\nlibrary ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture sim of tb is signal a,b,c,d,e,f,y0,y1,y2:std_logic;begin
dut:entity work.logic_circuit port map(a=>a,b=>b,c=>c,d=>d,e=>e,f=>f,y0=>y0,y1=>y1,y2=>y2);
process begin ${stimuli} wait;end process;end;`);
  for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error','--stop-time=70ns'],['--synth','--std=08','logic_circuit']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
