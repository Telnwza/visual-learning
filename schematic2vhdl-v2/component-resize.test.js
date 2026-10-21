const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadApp}=require('./test-runtime.cjs');
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../fpga-exam-kit/modules/packs/registers.sccomp.json'),'utf8'));
function fixture(){
 const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function make(type,params={},x=0,y=0){const c={id:uid('c'),type,params:{...typeDef({type}).defaultParams,...params},x,y,rot:0,mirror:false};sch.components.push(c);return c;}
 function electrical(c){return getPorts(c).map(({dx,dy,...p})=>p);}`);return a;
}
const types=['IN','OUT','VCC','GND','CONST','JUNCTION','AND','OR','NAND','NOR','XOR','XNOR','NOT','BUF','MUX','DEMUX','COMP','COMPM','BUSTAP','ENC','DEC','DFF','JKFF','TFF','SRFF','MODULE_FRAME'];
test('every stock component can still be configured and placed at its original default size',()=>{
 const a=fixture();for(const type of types){
  a.ctx.type=type;a.run(`var draft=makePlacementDraft(type,0,0),s=getSize(draft);`);
  const size=a.json('s');const fields={'[data-drawing-width]':{value:String(size.w)},'[data-drawing-height]':{value:String(size.h)},'[data-drawing-lock]':{checked:false},'[data-drawing-feedback]':{}};
  for(const f of Object.values(fields))f.addEventListener=()=>{};
  a.ctx.root={querySelector:k=>fields[k],querySelectorAll:()=>[]};
  assert.doesNotThrow(()=>a.run('bindDrawingSize(root,draft,()=>{},true).read()'),type);
 }
});
for(const type of types)test(`${type}: visual resize preserves every electrical port and legacy defaults`,()=>{
 const a=fixture();a.ctx.type=type;
 a.run(`const c=make(type),base=getSize(c),ports=electrical(c),defaults=JSON.stringify(TYPES[type]);
 const next=resizedDrawingComponent(c,{width:base.w*2,height:base.h*2,locked:false});`);
 assert.deepEqual(a.json('electrical(next)'),a.json('ports'));
 assert.equal(a.run('JSON.stringify(TYPES[type])'),a.run('defaults'));
 assert.deepEqual(a.json('getSize(c)'),a.json('base'));
 assert.deepEqual(a.json('resizedDrawingComponent(next,{reset:true}).params'),a.json('c.params'));
 if(type==='JUNCTION')assert.deepEqual(a.json('portPos(next,"j")'),a.json('portPos(c,"j")'));
 else {assert.ok(a.run('getSize(next).w>base.w'));assert.match(a.run('typeDef(next).shape(next.params)'),/data-drawing-scaled/);}
});
test('64-bit and many-channel parts retain semantics while minimum sizes preserve pin spacing',()=>{
 const a=fixture();a.run(`const cases=[make('AND',{inputs:8}),make('MUX',{inputs:16,width:64}),make('DEMUX',{outputs:16,width:64}),make('DEC',{outputs:16}),make('DFF',{width:64,enable:true})];`);
 for(let i=0;i<a.run('cases.length');i++){
  a.ctx.i=i;a.run(`var part=cases[i],small=resizedDrawingComponent(part,{width:1,height:1}),oldPins=getPorts(part),newPins=getPorts(small);`);
  assert.deepEqual(a.json('electrical(small)'),a.json('electrical(part)'));
  assert.ok(a.run('getSize(small).h>=drawingLimits(part).minH'));
  assert.ok(a.run(`newPins.every((p,i,ps)=>ps.every((q,j)=>i===j||p.dx!==q.dx||Math.abs(p.dy-q.dy)>=Math.min(11,Math.abs(oldPins[i].dy-oldPins[j].dy))-.001))`));
 }
});
test('imported VHDL boxes resize independently and retain generics/source on project reload',()=>{
 const a=fixture();a.ctx.pack=pack;
 a.run(`applyCustomPackages([pack]);const one=make('CUSTOM:ss_reg_pipo',{generic_WIDTH:64}),two=make('CUSTOM:ss_reg_pipo',{generic_WIDTH:8},300,0);
 const originalSource=state.project.customs.ss_reg_pipo.vhdl,twoBefore=JSON.stringify(two),onePorts=electrical(one);snapshot();
 applyDrawingResize(planDrawingResize(sch,one,{width:242,height:220,locked:true}));const saved=serialize();deserialize(saved);`);
 assert.equal(a.run('state.project.customs.ss_reg_pipo.vhdl'),a.run('originalSource'));
 assert.equal(a.run('JSON.stringify(comp(two.id))'),a.run('twoBefore'));
 assert.deepEqual(a.json('electrical(comp(one.id))'),a.json('onePorts'));
 assert.equal(a.run('comp(one.id).params.generic_WIDTH'),64);
 assert.deepEqual(a.json('getSize(comp(one.id))'),{w:242,h:220});
 assert.equal(a.run('comp(one.id).params.drawingLock'),true);
});
test('subschematic reset replaces legacy dimensions, preserves pin order and leaves internal components alone',()=>{
 const a=fixture();a.run(`const child=blankSchematic(uid('sch'),'child');state.project.schematics[child.id]=child;
 child.components=[{id:'in_a',type:'IN',params:{name:'a',width:64},x:0,y:0},{id:'in_b',type:'IN',params:{name:'b',width:1},x:0,y:100},{id:'out_q',type:'OUT',params:{name:'q',width:64},x:300,y:0}];
 const c=make('SCH:'+child.id,{moduleWidth:330,moduleHeight:220,inputOrder:['b','a']}),original=JSON.stringify(child);
 const next=resizedDrawingComponent(c,{width:440,height:330}),reset=resizedDrawingComponent(next,{reset:true});`);
 assert.deepEqual(a.json('electrical(next)'),a.json('electrical(c)'));
 assert.equal(a.run('JSON.stringify(child)'),a.run('original'));
 assert.equal(a.run('reset.params.moduleWidth'),undefined);assert.equal(a.run('reset.params.moduleHeight'),undefined);
 assert.deepEqual(a.json('reset.params.inputOrder'),['b','a']);
});
function wired(){
 const a=fixture();a.run(`const input=make('IN',{name:'data',width:64},0,100),gate=make('BUF',{width:64,inputs:1},220,100),output=make('OUT',{name:'result',width:64},600,100),j=make('JUNCTION',{fixed:true},450,110);
 const other=make('IN',{name:'other'},0,400),otherOut=make('OUT',{name:'other_result'},600,400);
 sch.wires=[{id:'a',from:{cid:input.id,pid:'o'},to:{cid:gate.id,pid:'i0'}},{id:'b',from:{cid:gate.id,pid:'o'},to:{cid:j.id,pid:'j'},pts:[{x:350,y:portPos(gate,'o').y},{x:350,y:220},{x:420,y:220},{x:420,y:116}],name:'manual'},
 {id:'c',from:{cid:j.id,pid:'j'},to:{cid:output.id,pid:'i'}},{id:'other',from:{cid:other.id,pid:'o'},to:{cid:otherOut.id,pid:'i'},pts:[{x:180,y:411},{x:180,y:490},{x:500,y:490}],name:'untouched'}];snapshot();`);return a;
}
test('connected resizing previews without editing, preserves topology/manual middle routes and has one Undo',()=>{
 const a=wired();a.run(`const before=serialize(),idx=state.history.idx,source=generateSchVhdl(cloneData(sch)),pins=sch.wires.map(w=>({from:w.from,to:w.to,name:w.name})),junction=JSON.stringify(j),unrelated=JSON.stringify(sch.wires.slice(2));
 const plan=planDrawingResize(sch,gate,{width:154,height:110,locked:false});`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 assert.equal(a.run('plan.changedWires.length'),2);
 a.run('applyDrawingResize(plan)');
 assert.equal(a.run('state.history.idx'),a.run('idx+1'));
 assert.deepEqual(a.json('sch.wires.map(w=>({from:w.from,to:w.to,name:w.name}))'),a.json('pins'));
 assert.equal(a.run('JSON.stringify(j)'),a.run('junction'));
 assert.equal(a.run('JSON.stringify(sch.wires.slice(2))'),a.run('unrelated'));
 assert.deepEqual(a.json('sch.wires[1].pts.slice(1)'),[{x:350,y:220},{x:420,y:220},{x:420,y:116}]);
 assert.deepEqual(a.json('generateSchVhdl(cloneData(sch))'),a.json('source'));
 assert.ok(a.run('sch.wires.every(w=>{const ps=drawnPoints(sch,w);return ps.every((p,i)=>!i||Math.abs(p.x-ps[i-1].x)<.5||Math.abs(p.y-ps[i-1].y)<.5);})'));
 a.run('const after=serialize();undo()');assert.equal(a.run('serialize()'),a.run('before'));
 a.run('redo()');assert.equal(a.run('serialize()'),a.run('after'));
});
test('junction sizing keeps its connection anchor and every wire byte-for-byte unchanged',()=>{
 const a=wired(),before=a.json('sch.wires');a.run(`const pin=portPos(j,'j');applyDrawingResize(planDrawingResize(sch,j,{width:20,height:20}));`);
 assert.deepEqual(a.json('sch.wires'),before);assert.deepEqual(a.json('portPos(j,"j")'),a.json('pin'));
});
test('resizing beside legacy junctions preserves other branches even when their derived exit axis changes',()=>{
 for(const manual of [false,true]){
  const a=fixture();a.ctx.manual=manual;
  a.run(`const gate=make('BUF',{inputs:1},100,100),j=make('JUNCTION',{fixed:true},160,250),output=make('OUT',{name:'result'},400,380);
   sch.wires=[{id:'host',from:{cid:gate.id,pid:'o'},to:{cid:j.id,pid:'j'}},{id:'branch',from:{cid:j.id,pid:'j'},to:{cid:output.id,pid:'i'}}];
   if(manual)sch.wires[1].pts=[{x:297,y:300}];
   const before=drawnPoints(sch,sch.wires[1]),junction=JSON.stringify(j);snapshot();
   applyDrawingResize(planDrawingResize(sch,gate,{width:132,height:110}));`);
  assert.deepEqual(a.json('drawnPoints(sch,sch.wires[1])'),a.json('before'));
  assert.equal(a.run('JSON.stringify(j)'),a.run('junction'));
 }
});
test('canvas resize preview retains oriented geometry and incident routes without changing the project',()=>{
 const a=wired();a.run(`gate.rot=90;gate.mirror=true;const before=serialize(),plan=planDrawingResize(sch,gate,{width:154,height:110});`);
 assert.equal(a.run('plan.next.rot'),90);assert.equal(a.run('plan.next.mirror'),true);
 assert.ok(a.run('plan.changedWires.length>0'));
 assert.ok(a.run('plan.preview.wires.every(w=>drawnPoints(plan.preview,w).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))'));
 assert.equal(a.run('serialize()'),a.run('before'));
});

for(const rot of [0,90,180,270])for(const mirror of [false,true])test(`drag anchor stays fixed under rotation ${rot}, mirror ${mirror}`,()=>{
 const a=fixture();a.ctx.rot=rot;a.ctx.mirror=mirror;
 a.run(`const c=make('MUX',{width:64,inputs:8},200,300);c.rot=rot;c.mirror=mirror;
 const size=getSize(c),start={x:0,y:0};
 const results=[[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]].map(handle=>{
 const delta=orientLocal(c,25*(handle[0]===0?-1:1)+size.w/2,25*(handle[1]===0?-1:1)+size.h/2),centre=orientLocal(c,size.w/2,size.h/2);
 const plan=drawingDragPlan({c,sch,size,handle,start},{x:delta.x-centre.x,y:delta.y-centre.y});
 const old=orientLocal(c,size.w*(1-handle[0]),size.h*(1-handle[1])),s=getSize(plan.next),next=orientLocal(plan.next,s.w*(1-handle[0]),s.h*(1-handle[1]));
 return {dx:c.x+old.x-plan.next.x-next.x,dy:c.y+old.y-plan.next.y-next.y};});`);
 for(const r of a.json('results'))assert.ok(Math.hypot(r.dx,r.dy)<.00001);
});
test('drag preview, no movement, Escape cancellation and release keep model/history transaction boundaries',()=>{
 const a=wired();a.run(`const before=serialize(),idx=state.history.idx;state.view.k=2;
 function start(){state.resizeDrag={c:gate,sch,size:getSize(gate),handle:[1,1],start:{x:0,y:0},revision:drawingLayoutRevision(sch),plan:null};}
 start();updateDrawingResize({x:1,y:0});finishDrawingResize();`);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 a.run('start();updateDrawingResize({x:100,y:100});');assert.equal(a.run('serialize()'),a.run('before'));
 a.run('cancelDrawingResize()');assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
 a.run('start();updateDrawingResize({x:100,y:100});finishDrawingResize();');assert.equal(a.run('state.history.idx'),a.run('idx+1'));
});
test('aspect lock and Shift use original proportions within grid precision',()=>{
 const a=fixture();a.run(`const c=make('BUF'),size=getSize(c),plan=drawingDragPlan({c,sch,size,handle:[1,1],start:{x:0,y:0}},{x:100,y:20},true);`);
 assert.ok(a.run('Math.abs(getSize(plan.next).w/size.w-getSize(plan.next).h/size.h)<GRID/Math.min(size.w,size.h)'));
});
test('locked layout, placement mode and stale previews reject without partial editing',()=>{
 const a=wired();a.run(`sch.locked=true;`);assert.throws(()=>a.run('planDrawingResize(sch,gate,{width:200,height:100})'),/ล็อก/);
 a.run('sch.locked=false;state.placementMode={};');assert.throws(()=>a.run('planDrawingResize(sch,gate,{width:200,height:100})'),/Placement/);
 a.run(`state.placementMode=null;const plan=planDrawingResize(sch,gate,{width:200,height:100});input.x+=11;const before=serialize(),idx=state.history.idx;`);
 assert.throws(()=>a.run('applyDrawingResize(plan)'),/preview/);assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
});
test('invalid imported drawing dimensions reject; old files keep exact default geometry',()=>{
 const a=fixture();for(const params of [{drawingWidth:0},{drawingHeight:NaN},{drawingWidth:1.2},{drawingWidth:1000001},{drawingLock:'true'}]){
  a.ctx.params=params;assert.throws(()=>a.run('validateComponentDataParams({type:"CUSTOM:missing",params})'));
 }
 a.run(`const c=make('CONST',{width:64,value:'FFFFFFFFFFFFFFFF'}),size=getSize(c),saved=serialize();deserialize(saved);`);
 assert.deepEqual(a.json('getSize(comp(c.id))'),a.json('size'));assert.equal(a.run('comp(c.id).params.drawingWidth'),undefined);
});
test('preplacement controls refresh limits after channel changes without creating project edits',()=>{
 const a=fixture();a.run(`const draft=makePlacementDraft('MUX',0,0),before=serialize(),idx=state.history.idx;`);
 const fields=new Map();function field(){return {value:'',checked:false,dataset:{},textContent:'',addEventListener(event,fn){this[event]=fn;}};}
 for(const name of ['width','height','lock','feedback'])fields.set(`[data-drawing-${name}]`,field());
 fields.get('[data-drawing-width]').value='84';fields.get('[data-drawing-height]').value='88';
 a.ctx.root={querySelector:s=>fields.get(s)||null,querySelectorAll:()=>[]};
 a.run(`let invalid=0;const controls=bindDrawingSize(root,draft,settings=>draft.params=resizedDrawingComponent(draft,settings).params,true,()=>invalid++);
 draft.params.inputs=16;controls.sync();`);
 assert.equal(Number(fields.get('[data-drawing-height]').value),a.run('getSize(draft).h'));
 assert.equal(Number(fields.get('[data-drawing-height]').min),a.run('drawingLimits(draft).minH'));
 fields.get('[data-drawing-width]').value='242';fields.get('[data-drawing-height]').value='600';fields.get('[data-drawing-width]').input();
 assert.equal(a.run('draft.params.drawingWidth'),undefined);
 fields.get('[data-drawing-width]').change();assert.equal(a.run('draft.params.drawingWidth'),242);
 fields.get('[data-drawing-width]').value='';fields.get('[data-drawing-width]').input();
 assert.equal(a.run('invalid'),1);assert.throws(()=>a.run('controls.read()'),/ขนาดภาพ/);
 assert.equal(a.run('serialize()'),a.run('before'));assert.equal(a.run('state.history.idx'),a.run('idx'));
});
