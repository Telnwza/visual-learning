const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');

function circuit(width=8,pinMode='bus',constantSide='none'){
 const a=loadApp();Object.assign(a.ctx,{width,pinMode,constantSide});
 a.run(`const sch=activeSch();sch.name='compare_three';sch.components=[];sch.wires=[];
 function c(type,params){const node={id:uid('c'),type,params,x:sch.components.length*100,y:100};sch.components.push(node);return node;}
 function w(from,pid,to,qid){sch.wires.push({id:uid('w'),from:{cid:from.id,pid},to:{cid:to.id,pid:qid},name:''});}
 const cmp=c('COMP3',{width,pinMode}),fixed=1n<<BigInt(width-1);
 for(const side of ['a','b']){
  const input=c('IN',{name:side+'_in',width}),constant=constantSide===side||constantSide==='both';
  if(pinMode==='bus'){
   const source=constant?c('CONST',{width,value:fixed.toString(16)}):input;w(source,'o',cmp,side);
  }else for(let bit=0;bit<width;bit++){
   if(constant){const k=c('CONST',{width:1,value:String((fixed>>BigInt(bit))&1n)});w(k,'o',cmp,side+bit);}
   else if(width===1)w(input,'o',cmp,side+'0');
   else {const tap=c('BUSTAP',{bit,nbit:1,mode:'split',dir:'right'});w(input,'o',tap,'d');w(tap,'y',cmp,side+bit);}
  }
 }
 for(const pid of ['gt','eq','lt'])w(cmp,pid,c('OUT',{name:pid+'_out',width:1}),'i');snapshot();`);
 return a;
}

test('COMP3 has two configurable operands and three separate scalar result pins',()=>{
 const a=loadApp();assert.deepEqual(a.json('TYPES.COMP3.defaultParams'),{width:8,pinMode:'bus'});
 for(const width of [1,2,4,7,8,16,32,64])for(const pinMode of ['bus','pins']){
  a.ctx.params={width,pinMode};
  const ports=a.json('getPorts({type:"COMP3",params})'),size=a.json('getSize({type:"COMP3",params})');
  assert.deepEqual(ports.filter(p=>p.dir==='out').map(p=>[p.id,p.label,p.width||1]),[['gt','A>B',1],['eq','A=B',1],['lt','A<B',1]]);
  assert.equal(ports.filter(p=>p.dir==='in').length,pinMode==='bus'?2:width*2);
  assert.ok(ports.filter(p=>p.dir==='in').every(p=>(p.width||1)===(pinMode==='bus'?width:1)));
  const outputs=ports.filter(p=>p.dir==='out');assert.ok(outputs[0].dy<outputs[1].dy&&outputs[1].dy<outputs[2].dy);
  assert.ok(ports.every(p=>p.dy>0&&p.dy<size.h));
  assert.match(a.run('componentParamFields({type:"COMP3",params})'),/value="bus"/);
  a.run('validatePlacementParams("COMP3",params)');
 }
 for(const width of [0,65]){a.ctx.params={width,pinMode:'bus'};assert.throws(()=>a.run('validatePlacementParams("COMP3",params)'));}
 assert.match(a.run('TYPES.COMP3.shape(TYPES.COMP3.defaultParams)'),/COMP3 · 8/);
});

test('COMP and COMPM keep their original defaults, labels, pins and dimensions',()=>{
 const a=loadApp();
 for(const type of ['COMP','COMPM']){
  a.ctx.type=type;assert.deepEqual(a.json('TYPES[type].defaultParams'),{width:2,pinMode:'pins'});
  assert.deepEqual(a.json('getSize({type,params:{width:2,pinMode:"pins"}})'),{w:110,h:110});
  assert.deepEqual(a.json('getPorts({type,params:{width:2,pinMode:"pins"}}).filter(p=>p.dir==="out").map(p=>p.label)'),type==='COMP'?['EQ']:['GT','LT']);
  assert.equal(a.run('cmpIsBus({width:8})'),true);
 }
});

test('normal placement, Inspector, resize, parameter edits, Undo and Save/Open support COMP3',()=>{
 const a=circuit();a.run('const draft=makePlacementDraft("COMP3",0,0);');
 assert.deepEqual(a.json('draft.params'),{width:8,pinMode:'bus'});
 a.run('applyComponentParamChange(sch,cmp,planComponentParamChange(sch,cmp,"width",64));');
 assert.deepEqual(a.json('getPorts(cmp).slice(0,2).map(p=>p.width)'),[64,64]);
 a.run('undo();');assert.equal(a.run('activeSch().components.find(c=>c.type==="COMP3").params.width'),8);
 a.run('redo();const saved=serialize();deserialize(saved);const restored=activeSch().components.find(c=>c.type==="COMP3");');
 assert.equal(a.run('restored.params.width'),64);
 a.run('const enlarged=resizedDrawingComponent(restored,{width:220,height:264});');
 assert.deepEqual(a.json('getPorts(enlarged).map(({dx,dy,...p})=>p)'),a.json('getPorts(restored).map(({dx,dy,...p})=>p)'));
});

test('missing or mismatched bus operands flag and tie all three outputs to zero',()=>{
 for(const mismatch of [false,true]){
  const a=circuit();a.ctx.mismatch=mismatch;
  a.run(`if(mismatch)sch.components.find(c=>c.type==='IN').params.width=4;else sch.wires=sch.wires.filter(w=>w.to.pid!=='a');
  const result=generateSchVhdl(sch);`);
  assert.deepEqual(a.json('result.fallbacks.filter(f=>f.cid===cmp.id).map(f=>f.pid).sort()'),['eq','gt','lt']);
  for(const pid of ['gt','eq','lt'])assert.equal(a.run(`result.code.includes(cmp._nets.${pid}+" <= '0';")`),true);
 }
});

for(const pinMode of ['bus','pins'])for(const width of [1,4,64])test(`GHDL: ${width}-bit ${pinMode} COMP3 compares signals and constants on either side`,t=>{
 try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{t.skip('GHDL unavailable');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'comp-three-'));
 try{
  const bits=BigInt(width),max=(1n<<bits)-1n,fixed=1n<<(bits-1n);
  const values=width<=4?Array.from({length:Number(max)+1},(_,i)=>BigInt(i)):[0n,1n,(1n<<53n)+1n,(1n<<53n)+2n,fixed-1n,fixed,fixed+1n,max-1n,max];
  const literal=n=>width===1?`'${n}'`:'"'+n.toString(2).padStart(width,'0')+'"';
  for(const side of ['none','a','b','both']){
   const a=circuit(width,pinMode,side),result=a.json('generateSchVhdl(sch)');assert.deepEqual(result.fallbacks,[]);
   const steps=[];
   for(const x of side==='a'||side==='both'?[fixed]:values)for(const y of side==='b'||side==='both'?[fixed]:values){
    steps.push(`a<=${literal(x)};b<=${literal(y)};wait for 1 ns;assert gt='${Number(x>y)}' and eq='${Number(x===y)}' and lt='${Number(x<y)}' severity failure;`);
   }
   fs.writeFileSync(path.join(dir,'design.vhd'),result.code+`\nlibrary ieee;use ieee.std_logic_1164.all;
entity tb is end;architecture sim of tb is signal a,b:${width===1?'std_logic':`std_logic_vector(${width-1} downto 0)`};signal gt,eq,lt:std_logic;
begin dut:entity work.compare_three port map(a_in=>a,b_in=>b,gt_out=>gt,eq_out=>eq,lt_out=>lt);
process begin ${steps.join('\n')} wait;end process;end;`);
   for(const args of [['-a','--std=08','design.vhd'],['-e','--std=08','tb'],['-r','--std=08','tb','--assert-level=error'],['--synth','--std=08','compare_three']])execFileSync('ghdl',args,{cwd:dir,stdio:'pipe',timeout:30000});
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
