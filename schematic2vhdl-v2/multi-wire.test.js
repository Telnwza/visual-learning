const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {loadApp}=require('./test-runtime.cjs');
function setup(width=1){
 const a=loadApp();a.ctx.width=width;
 a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params={},x=0,y=0){const n={id:uid('c'),type,params,x,y};sch.components.push(n);return n;}
 function w(a,p,b,q,extra={}){const n={id:uid('w'),from:{cid:a.id,pid:p},to:{cid:b.id,pid:q},...extra};sch.wires.push(n);return n;}
 const src=c('IN',{name:'source',width},44,44),other=c('IN',{name:'other',width},44,400);
 const dest=[0,1,2,3].map(i=>c('OUT',{name:'result'+i,width},400,44+i*88));
 const ep=n=>({cid:n.id,pid:'i'}),source={cid:src.id,pid:'o'};
 snapshot();setTool('repeatwire',true);chooseMultiWireSource(source);`);return a;
}
const sheet=a=>a.json('({components:activeSch().components,wires:activeSch().wires})');
function assertDrivers(a,count){
 assert.equal(a.run(`sch.wires.filter(w=>dest.slice(0,${count}).some(c=>c.id===w.to.cid)).length`),count);
 assert.ok(a.run(`sch.wires.filter(w=>dest.slice(0,${count}).some(c=>c.id===w.to.cid)).every(w=>netDriverPort(sch,w).cid===src.id)`));
}
for(const width of [1,32,64])test(`continuous ${width}-bit wiring keeps source and branches through junctions`,()=>{
 const a=setup(width),idx=a.run('state.history.idx');
 a.run("multiWirePortPress(src,getPort(src,'o'),portPos(src,'o'))");
 assert.equal(a.run('state.multiWire.message'),'');
 a.run(`dest.slice(0,3).forEach(n=>multiWirePortPress(n,getPort(n,'i'),portPos(n,'i')))`);
 assertDrivers(a,3);assert.equal(a.run('state.multiWire.source.cid'),a.run('src.id'));
 assert.equal(a.run('state.history.idx'),idx+3);
 assert.equal(a.run('sch.wires.filter(w=>w.from.cid===src.id).length'),1);
 assert.equal(a.run('multiWireTargetStatus(sch,source,ep(dest[0])).kind'),'same');
 a.run("multiWirePortPress(dest[0],getPort(dest[0],'i'),portPos(dest[0],'i'))");assert.equal(a.run('state.history.idx'),idx+3);
 const done=sheet(a);a.run('undo()');assert.equal(a.run('activeSch().wires.filter(w=>w.to.cid===dest[2].id).length'),0);
 assert.equal(a.run('state.multiWire'),null);a.run('redo()');assert.deepEqual(sheet(a),done);
});
test('occupied, undriven and incompatible inputs are preserved without a history entry',()=>{
 const a=setup();a.run(`w(other,'o',dest[0],'i',{name:'keep',pts:[{x:330,y:422}]});
 const j=c('JUNCTION',{endpoint:true},300,300);w(j,'j',dest[1],'i');dest[2].params.width=64;
 const gate=c('AND',{width:32,inputs:2},600,100);snapshot();`);
 const before=sheet(a),idx=a.run('state.history.idx');
 a.run(`applyMultiWireTargets([...dest.slice(0,3).map(ep),{cid:gate.id,pid:'i0'},{cid:other.id,pid:'o'}])`);
 assert.deepEqual(sheet(a),before);assert.equal(a.run('state.history.idx'),idx);
 assert.equal(a.run('multiWireTargetStatus(sch,source,ep(dest[2])).reason'),'ขนาด 64 bit ไม่ตรงกับ 1 bit');
 assert.equal(a.run('multiWireTargetStatus(sch,source,{cid:gate.id,pid:"i0"}).reason'),'ขนาด 32 bit ไม่ตรงกับ 1 bit');
});
test('sweep catches fast movement, deduplicates hits and does not mutate preview or cancellation',()=>{
 const a=setup();a.run(`setTool('sweepwire',true);chooseMultiWireSource(source);const first=portPos(dest[0],'i'),last=portPos(dest[3],'i');`);
 const before=sheet(a),idx=a.run('state.history.idx'),uid=a.run('_uidN');
 a.run('beginMultiWireSweep(first);updateMultiWireSweep(last);updateMultiWireSweep(first)');
 assert.equal(a.run('state.multiWire.sweep.targets.size'),4);assert.deepEqual(sheet(a),before);
 assert.equal(a.run('_uidN'),uid);assert.equal(a.run('state.history.idx'),idx);
 a.run('cancelMultiWireSweep()');assert.equal(a.run('state.multiWire.sweep'),null);
 assert.deepEqual(sheet(a),before);assert.equal(a.run('state.history.idx'),idx);
 assert.equal(a.run('state.multiWire.source.cid'),a.run('src.id'));
});
test('sweep commits all accepted targets in one Undo/Redo and leaves skipped targets intact',()=>{
 const a=setup();a.run(`dest[3].params.width=32;w(other,'o',dest[2],'i');snapshot();
 setTool('sweepwire',true);chooseMultiWireSource(source);`);
 const before=sheet(a),idx=a.run('state.history.idx');
 a.run(`beginMultiWireSweep(portPos(dest[0],'i'));updateMultiWireSweep(portPos(dest[3],'i'));`);
 assert.equal(a.run('[...state.multiWire.sweep.targets.values()].filter(t=>t.kind==="accept").length'),2);
 assert.equal(a.run('[...state.multiWire.sweep.targets.values()].filter(t=>t.kind==="skip").length'),2);
 assert.equal(a.run('endMultiWireSweep()'),2);assertDrivers(a,2);
 const after=sheet(a);assert.equal(a.run('state.history.idx'),idx+1);
 a.run('undo()');assert.deepEqual(sheet(a),before);a.run('redo()');assert.deepEqual(sheet(a),after);
});
test('release revalidates targets changed after preview and duplicate destinations are no-ops',()=>{
 const a=setup();a.run(`setTool('sweepwire',true);chooseMultiWireSource(source);
 beginMultiWireSweep(portPos(dest[0],'i'));updateMultiWireSweep(portPos(dest[2],'i'));
 w(other,'o',dest[1],'i');dest[2].params.width=64;`);
 assert.equal(a.run('endMultiWireSweep()'),1);assertDrivers(a,1);
 assert.match(a.run('state.multiWire.message'),/ข้าม 2 ขา/);
 const idx=a.run('state.history.idx');assert.equal(a.run('applyMultiWireTargets([ep(dest[0]),ep(dest[0])])'),0);
 assert.equal(a.run('state.history.idx'),idx);
});
test('rotation/mirroring use actual pin positions and screen tolerance respects zoom',()=>{
 const a=setup();a.run(`const f=c('DFF',{enable:true},600,500);f.rot=90;f.mirror=true;
 const p=portPos(f,'en');const near={x:p.x+5,y:p.y};`);
 assert.ok(a.json('sweepPortHits(sch,near,near,7)').some(p=>p.cid===a.run('f.id')&&p.pid==='en'));
 assert.ok(!a.json('sweepPortHits(sch,near,near,7/2)').some(p=>p.cid===a.run('f.id')&&p.pid==='en'));
 a.run(`setTool('sweepwire',true);chooseMultiWireSource(source);state.view.k=2;beginMultiWireSweep(near)`);
 assert.equal(a.run('state.multiWire.sweep.targets.has(f.id+".en")'),false);
 a.run('updateMultiWireSweep(p)');assert.equal(a.run('state.multiWire.sweep.targets.has(f.id+".en")'),true);
});
test('passing through symbol bodies or unrelated wires does not invent destination pins',()=>{
 const a=setup();a.run(`const f=c('DFF',{enable:true},600,500);
 const body={x:620,y:530};const a0={x:280,y:390},b0={x:280,y:420};
 w(other,'o',dest[0],'i',{pts:[{x:280,y:422},{x:280,y:66}]});`);
 assert.deepEqual(a.json('sweepPortHits(sch,body,body,7)'),[]);
 assert.deepEqual(a.json('sweepPortHits(sch,a0,b0,7)'),[]);
});
test('source can be chosen at a driven wire or junction while retaining its chosen branch anchor',()=>{
 const a=setup();a.run(`const wire=w(src,'o',dest[0],'i');const at=nearestOnWire(wire,{x:260,y:66},0,sch);
 chooseMultiWireSource(null,wire,at);applyMultiWireTargets([ep(dest[1]),ep(dest[2])]);`);
 assertDrivers(a,3);
 assert.ok(a.run('sch.components.some(c=>c.type==="JUNCTION" && c.params.fixed)'));
 assert.ok(a.run(`sch.components.filter(c=>c.type==='JUNCTION'&&c.params.fixed).some(c=>{
 const p=portPos(c,'j');return Math.hypot(p.x-state.multiWire.anchor.x,p.y-state.multiWire.anchor.y)<1;})`));
 a.run(`const jw=sch.wires.find(w=>comp(w.from.cid,sch).type==='JUNCTION');chooseMultiWireSource(null,jw,portPos(comp(jw.from.cid,sch),'j'))`);
 assert.equal(a.run('state.multiWire.source.cid'),a.run('src.id'));
});
test('undriven nets, reversed input sources and bus marker d are rejected',()=>{
 const a=setup();a.run(`const j=c('JUNCTION',{endpoint:true},100,100),u=w(j,'j',dest[0],'i');`);
 assert.equal(a.run('chooseMultiWireSource(null,u)'),false);
 assert.equal(a.run('chooseMultiWireSource(ep(dest[0]))'),false);
 a.run(`const tap=c('BUSTAP',{bit:0,nbit:1,mode:'merge'});`);
 assert.equal(a.run('multiWireTargetStatus(sch,source,{cid:tap.id,pid:"d"}).kind'),'skip');
});
test('scoped route healing preserves unrelated manual routes and pass-through/orphan junctions',()=>{
 const a=setup();a.run(`const j=c('JUNCTION',{},300,430),orphan=c('JUNCTION',{},800,600);
 const x=c('OUT',{name:'untouched'},600,400);
 const untouched=[w(other,'o',j,'j',{name:'named',pts:[{x:200,y:422},{x:200,y:436}]}),
 w(j,'j',x,'i',{pts:[{x:500,y:436},{x:500,y:422}],autoPts:[{x:500,y:436}]})];
 const beforeUntouched=JSON.stringify(untouched),beforeJ=JSON.stringify([j,orphan]);
 applyMultiWireTargets([ep(dest[0]),ep(dest[1]),ep(dest[2])]);`);
 assert.equal(a.run('JSON.stringify(untouched.map(w=>sch.wires.find(x=>x.id===w.id)))'),a.run('beforeUntouched'));
 assert.equal(a.run('JSON.stringify([comp(j.id,sch),comp(orphan.id,sch)])'),a.run('beforeJ'));
 // Ordinary global cleanup still merges a pass-through and removes the orphan.
 a.run('healJunctions(sch)');assert.equal(a.run('!!comp(j.id,sch)||!!comp(orphan.id,sch)'),false);
});
test('locked sheets allow wiring while keeping existing routes and component positions',()=>{
 const a=setup();a.run(`sch.locked=true;const old=w(src,'o',dest[0],'i',{pts:[{x:200,y:66},{x:200,y:110},{x:300,y:110},{x:300,y:66}],name:'clk'});
 const positions=JSON.stringify(sch.components);const picture=polyKey(drawnPoints(sch,old));applyMultiWireTargets([ep(dest[1])]);
 let endpoint={cid:dest[0].id,pid:'i'},pieces=[];
 for(let i=0;i<sch.wires.length;i++){
 const wire=sch.wires.find(w=>w.to.cid===endpoint.cid && w.to.pid===endpoint.pid);if(!wire)break;
 pieces.unshift(drawnPoints(sch,wire));endpoint=wire.from;
 }const afterPicture=polyKey(pieces.flat());`);
 assert.equal(a.run('JSON.stringify(sch.components.filter(c=>c.type!=="JUNCTION"))'),a.run('positions'));
 assertDrivers(a,2);assert.ok(a.run('sch.wires.some(w=>w.name==="clk")'));
 assert.equal(a.run('afterPicture'),a.run('picture'));
});
test('tool, sheet, project, undo and placement transitions discard transient previews',()=>{
 const a=setup();a.run(`setTool('sweepwire',true);chooseMultiWireSource(source);beginMultiWireSweep(portPos(dest[0],'i'));setTool('wire',true)`);
 assert.equal(a.run('state.multiWire'),null);
 a.run(`setTool('repeatwire',true);chooseMultiWireSource(source);const second=blankSchematic(uid('sch'),'second');state.project.schematics[second.id]=second;state.activeId=second.id;multiWireForActive()`);
 assert.equal(a.run('state.multiWire'),null);
 a.run(`state.activeId=sch.id;chooseMultiWireSource(source);enterPlacementMode();setTool('sweepwire',true)`);
 assert.equal(a.run('state.multiWire'),null);assert.equal(a.run('state.tool'),'select');
 a.run(`cancelPlacement();setTool('repeatwire',true);chooseMultiWireSource(source);const p=addProject('other_project',{activate:false});switchProject(p.id);multiWireForActive()`);
 assert.equal(a.run('state.multiWire'),null);
});
test('serialized project excludes the active source and in-progress sweep',()=>{
 const a=setup();a.run(`setTool('sweepwire',true);chooseMultiWireSource(source);beginMultiWireSweep(portPos(dest[0],'i'))`);
 const saved=a.run('serialize()');assert.doesNotMatch(saved,/multiWire|"sweep"|"anchor"/);
});
let hasGhdl=true;try{execFileSync('ghdl',['--version'],{stdio:'pipe'});}catch{hasGhdl=false;}
test('generated VHDL distributes swept clock/reset/enable to four working flip-flops',{skip:!hasGhdl},()=>{
 const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 const make=(type,params,x,y)=>{const c={id:uid('c'),type,params,x,y};sch.components.push(c);return c;};
 const ff=[0,1,2,3].map(i=>make('DFF',{enable:true,reset:true},400,i*120));
 for(const [name,pin] of [['clk','clk'],['rst','rst'],['en','en'],['data_in','d']]){
 const input=make('IN',{name},44,0);setTool('sweepwire',true);chooseMultiWireSource({cid:input.id,pid:'o'});
 const first=portPos(ff[0],pin);beginMultiWireSweep(first);
 for(let i=1;i<ff.length;i++){
 const previous=portPos(ff[i-1],pin),next=portPos(ff[i],pin);
 updateMultiWireSweep({x:previous.x-30,y:previous.y});updateMultiWireSweep({x:next.x-30,y:next.y});updateMultiWireSweep(next);
 }endMultiWireSweep();}
 ff.forEach((f,i)=>{const o=make('OUT',{name:'q'+i},700,i*120);sch.wires.push({id:uid('w'),from:{cid:f.id,pid:'q'},to:{cid:o.id,pid:'i'}});});`);
 const r=a.json('generateSchVhdl(sch)');assert.deepEqual(r.fallbacks,[]);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'multiwire-ghdl-'));
 try{
  fs.writeFileSync(path.join(dir,'design.vhd'),r.code+`\nlibrary ieee;use ieee.std_logic_1164.all;
 entity tb is end;architecture sim of tb is signal clk,rst,en,d:std_logic:='0';signal q:std_logic_vector(3 downto 0);
 begin u:entity work.top port map(clk=>clk,rst=>rst,en=>en,data_in=>d,q0=>q(0),q1=>q(1),q2=>q(2),q3=>q(3));
 process begin rst<='1';wait for 1 ns;assert q="0000" severity failure;rst<='0';d<='1';
 clk<='1';wait for 1 ns;assert q="0000" severity failure;clk<='0';en<='1';wait for 1 ns;
 clk<='1';wait for 1 ns;assert q="1111" severity failure;clk<='0';en<='0';d<='0';wait for 1 ns;
 clk<='1';wait for 1 ns;assert q="1111" severity failure;rst<='1';wait for 1 ns;assert q="0000" severity failure;
 wait;end process;end;`);
  execFileSync('ghdl',['-a','--std=08','design.vhd'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-e','--std=08','tb'],{cwd:dir,stdio:'pipe'});
  execFileSync('ghdl',['-r','--std=08','tb','--assert-level=error','--stop-time=20ns'],{cwd:dir,stdio:'pipe'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
