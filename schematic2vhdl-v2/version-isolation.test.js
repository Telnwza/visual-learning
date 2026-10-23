const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {loadApp}=require('./test-runtime.cjs');
const {loadApp:loadOriginal}=require('../schematic2vhdl/test-runtime.cjs');
const original=fs.readFileSync(path.join(__dirname,'../schematic2vhdl/index.html'),'utf8');
const current=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');

test('original application matches verified GitHub main commit a101f19 byte-for-byte',()=>{
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'0452df7eb95cf168caf5feba26d3debf4012e96432bf3e0151e9cc2eda12ab32');
 assert.match(current,/<title>Schematic Studio v2/);assert.match(current,/vhdl-code-editor/);
});
test('all browser storage keys belong to the separate v2 namespace',()=>{
 const keys=source=>new Set([...source.matchAll(/["'](schstudio\.[^"']+)["']/g)].map(m=>m[1]));
 const old=keys(original),next=keys(current);assert.ok(old.size>=3);assert.ok(next.size>=5);
 for(const key of next){assert.ok(key.startsWith('schstudio.v2.'),key);assert.equal(old.has(key),false,key);}
 assert.ok(current.includes('schstudio-custom-pkg')); // Portable file formats keep their original identity.
});
test('v2 ignores original preferences and autosave; edits and drafts cannot overwrite original data',async()=>{
 const entries=new Map(),autosaveStore=new Map(),storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const old=loadOriginal();old.ctx.localStorage=storage;
 old.run(`state.project.name='Original workspace';autosave();`);
 entries.set('schstudio.theme','studio');entries.set('schstudio.hopStyle','arc');
 const savedOriginal=new Map(entries),a=loadApp({storage,autosaveStore});
 assert.equal(await a.run('loadAutosave()'),false);assert.equal(a.run('THEME'),'ise');
 await a.run(`state.project.name='Version 2 workspace';saveVhdlSourceDraft(state.project,VHDL_NEW_DRAFT,'unfinished source');autosave();`);
 for(const [key,value] of savedOriginal)assert.equal(entries.get(key),value,key);
 const b=loadApp({storage,autosaveStore});assert.equal(await b.run('loadAutosave()'),true);
 assert.equal(b.run('state.project.name'),'Version 2 workspace');
 assert.equal(b.run(`getVhdlSourceDraft(state.project,VHDL_NEW_DRAFT).source`),'unfinished source');
 assert.equal(old.run('loadAutosave()'),true);assert.equal(old.run('state.project.name'),'Original workspace');
});
test('dashboard links to both versions and Alt+6 opens v2 without changing existing shortcuts',()=>{
 const elements=new Map(),events={};
 const element=()=>({value:'',innerHTML:'',textContent:'',querySelectorAll:()=>[],addEventListener(){}});
 const document={activeElement:null,querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);},addEventListener:(type,fn)=>events[type]=fn};
 const context=vm.createContext({document,window:{location:{href:''}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/main.js'),'utf8'),context);
 assert.match(elements.get('#tools-grid').innerHTML,/href="\.\/schematic2vhdl\/"/);
 assert.match(elements.get('#tools-grid').innerHTML,/href="\.\/schematic2vhdl-v2\/"/);
 for(const [key,href] of [['4','./schematic2vhdl/'],['5','./block-schematic-studio/'],['6','./schematic2vhdl-v2/']]){
  events.keydown({altKey:true,key});assert.equal(context.window.location.href,href);
 }
});
