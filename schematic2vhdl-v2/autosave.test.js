const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');
function database(){
 const records=new Map(), control={records,failOpen:null,failWrite:null,failRead:null,opens:0,writes:0};
 const db={createObjectStore(){},close(){},transaction(name,mode){
  assert.equal(name,'snapshots');
  const transaction={objectStore(){return {get:key=>request(key),put:(value,key)=>request(key,value)};}};
  function request(key,value){
   const result={};
   queueMicrotask(()=>{
    const failure=mode==='readwrite'?control.failWrite:control.failRead;
    if(failure){transaction.error=failure;transaction.onabort();return;}
    if(mode==='readwrite'){records.set(key,value);control.writes++;}
    else result.result=records.get(key);
    transaction.oncomplete();
   });
   return result;
  }
  return transaction;
 }};
 control.api={open(name,version){
  assert.equal(name,'schstudio.v2.autosave');assert.equal(version,1);control.opens++;
  const request={result:db};
  queueMicrotask(()=>{
   if(control.failOpen){request.error=control.failOpen;request.onerror();return;}
   if(control.opens===1)request.onupgradeneeded();request.onsuccess();
  });return request;
 }};
 return control;
}
function setup(db=database(),entries=new Map()){
 const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
 const a=loadApp({storage});a.ctx.indexedDB=db.api;return Object.assign(a,{db,entries});
}
test('autosave commits compact workspace data and restores every project, active sheet and exact routes',async()=>{
 const a=setup();a.run(`addComp('IN',32,64,{name:'data',width:8});addComp('OUT',400,64,{name:'result',width:8});snapshot();
 const first=state.project,other=cloneData(first);other.id='other';other.name='second';state.projects.other=other;
 first.schematics[first.topId].wires.push({id:'route',from:{cid:activeSch().components[0].id,pid:'o'},to:{cid:activeSch().components[1].id,pid:'i'},width:8,pts:[{x:100,y:96},{x:300,y:96}]});`);
 const before=a.json('JSON.parse(serialize())');assert.equal(await a.run('autosave()'),true);
 const saved=a.db.records.get('workspace');assert.ok(saved.length<a.run('serialize()').length/2);
 assert.equal(JSON.parse(saved).project,undefined);assert.match(a.els.get('#statAutosave').innerHTML,/autosave: ✓/);
 const b=setup(a.db,a.entries);assert.equal(await b.run('loadAutosave()'),true);
 assert.deepEqual(b.json('JSON.parse(serialize())'),before);assert.equal(a.db.opens,2);
});
test('migration keeps the legacy v2 snapshot until commit and preserves all original-version keys',async()=>{
 const a=setup();const legacy=a.run(`state.project.name='legacy v2';serialize()`);
 a.entries.set('schstudio.v2.autosave.v2',legacy);a.entries.set('schstudio.autosave.v2','original workspace');
 assert.equal(await a.run('loadAutosave()'),true);assert.equal(a.run('state.project.name'),'legacy v2');
 a.db.failWrite=Object.assign(new Error('disk full'),{name:'QuotaExceededError'});
 assert.equal(await a.run('autosave()'),false);assert.equal(a.entries.get('schstudio.v2.autosave.v2'),legacy);
 assert.match(a.els.get('#statAutosave').textContent,/พื้นที่เต็ม.*Save Workspace/);
 a.db.failWrite=null;assert.equal(await a.run('autosave()'),true);
 assert.equal(a.entries.has('schstudio.v2.autosave.v2'),false);assert.equal(a.entries.get('schstudio.autosave.v2'),'original workspace');
});
test('IndexedDB is authoritative over a stale localStorage snapshot after migration',async()=>{
 const a=setup();const old=a.run(`state.project.name='old';serialize()`);
 await a.run(`state.project.name='latest';autosave()`);a.entries.set('schstudio.v2.autosave.v2',old);
 const b=setup(a.db,a.entries);assert.equal(await b.run('loadAutosave()'),true);assert.equal(b.run('state.project.name'),'latest');
});
test('full localStorage does not prevent workspace autosave or change original-version data',async()=>{
 const a=setup();a.entries.set('schstudio.autosave.v2','original workspace');
 a.ctx.localStorage.setItem=()=>{throw Object.assign(new Error('localStorage full'),{name:'QuotaExceededError'});};
 assert.equal(await a.run(`state.project.name='imported workspace';autosave()`),true);
 const b=setup(a.db,a.entries);assert.equal(await b.run('loadAutosave()'),true);
 assert.equal(b.run('state.project.name'),'imported workspace');assert.equal(a.entries.get('schstudio.autosave.v2'),'original workspace');
});
test('queued writes preserve the most recent snapshot and report success only after commit',async()=>{
 const a=setup(),first=a.run(`state.project.name='first';autosave()`),second=a.run(`state.project.name='second';autosave()`);
 assert.doesNotMatch(a.els.get('#statAutosave')?.innerHTML||'',/✓/);
 assert.equal(await first,true);assert.equal(await second,true);assert.equal(a.db.writes,2);assert.equal(a.db.opens,1);
 const b=setup(a.db);await b.run('loadAutosave()');assert.equal(b.run('state.project.name'),'second');
});
test('failed writes preserve the last committed snapshot, allow retry and keep serialization errors visible',async()=>{
 const a=setup();await a.run(`state.project.name='saved';autosave()`);
 a.db.failWrite=new Error('transaction aborted');assert.equal(await a.run(`state.project.name='unsaved';autosave()`),false);
 const b=setup(a.db);await b.run('loadAutosave()');assert.equal(b.run('state.project.name'),'saved');
 a.db.failWrite=null;assert.equal(await a.run('autosave()'),true);assert.equal(a.els.get('#statAutosave').title,'');
 a.run(`state.project.cycle=state.project`);assert.equal(await a.run('autosave()'),false);assert.match(a.els.get('#statAutosave').textContent,/autosave failed.*Save Workspace/);
});
test('an unreadable or corrupt snapshot blocks overwriting stored work with the starter circuit',async()=>{
 const a=setup();a.db.records.set('workspace','not JSON');
 assert.equal(await a.run('loadAutosave()'),false);assert.match(a.els.get('#statAutosave').textContent,/restore failed/);
 assert.equal(await a.run('autosave()'),false);assert.equal(a.db.records.get('workspace'),'not JSON');
 const b=setup();b.db.failRead=new Error('storage unavailable');assert.equal(await b.run('loadAutosave()'),false);
 assert.equal(await b.run('autosave()'),false);assert.equal(b.db.writes,0);
});
test('storage-open errors retain the legacy snapshot and can be retried',async()=>{
 const a=setup();const legacy=a.run(`state.project.name='legacy';serialize()`);a.entries.set('schstudio.v2.autosave.v2',legacy);
 a.db.failOpen=new Error('storage disabled');assert.equal(await a.run('loadAutosave()'),true);
 assert.equal(a.run('state.project.name'),'legacy');assert.equal(await a.run('autosave()'),false);assert.equal(a.entries.get('schstudio.v2.autosave.v2'),legacy);
 a.db.failOpen=null;assert.equal(await a.run('loadAutosave()'),true);assert.equal(await a.run('autosave()'),true);
});
test('placement mode leaves the committed autosave untouched',async()=>{
 const a=setup();await a.run(`state.project.name='committed';autosave()`);
 assert.equal(await a.run(`state.project.name='draft';state.placementMode={};autosave()`),false);
 assert.equal(JSON.parse(a.db.records.get('workspace')).workspace.projects[a.run('state.activeProjectId')].name,'committed');
});
