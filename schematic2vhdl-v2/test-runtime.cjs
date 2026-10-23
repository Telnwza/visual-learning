// Run the actual single-file application's logic; UI behavior is checked separately
// in a browser. No extracted/reimplemented copy of the generator or importer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function loadApp({storage,autosaveStore}={}){
  const stub=()=>({style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},removeEventListener(){},setAttribute(){},removeAttribute(){},remove(){},append(){},appendChild(){},
    querySelectorAll(){return [];},querySelector(){return stub();},getBoundingClientRect(){return {width:900,height:650};},
    children:[],value:'',innerHTML:'',textContent:''});
  const els=new Map(), get=s=>{if(!els.has(s))els.set(s,stub());return els.get(s);};
  const document={querySelector:get,querySelectorAll:()=>[],createElement:stub,createElementNS:stub,
    documentElement:stub(),body:stub(),addEventListener(){}};
  const ctx=vm.createContext({document,window:{innerWidth:1440,innerHeight:900,addEventListener(){}},
    localStorage:storage||{getItem:()=>null,setItem(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    requestAnimationFrame:()=>0,confirm:()=>true,console,Blob,URL,TextEncoder,TextDecoder,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const script=/<script>([\s\S]*?)<\/script>/.exec(html)[1].replace(/\ninit\(\);\s*$/,'');
  vm.runInContext(script,ctx,{filename:path.join(__dirname,'index.html')});
  if(autosaveStore)ctx.autosaveRecord=async(mode,data)=>{
    if(mode==='readwrite'){autosaveStore.set('workspace',data);return;}
    return autosaveStore.get('workspace');
  };
  vm.runInContext(`renderAll=()=>{}; render=()=>{}; renderInspector=()=>{}; renderProjectTree=()=>{};
    autoFitSheet=()=>{}; toast=()=>{}; seedWorkspace();
    state.activeId=state.project.topId; state.openTabs=[state.activeId]; snapshot();`,ctx);
  return {run:code=>vm.runInContext(code,ctx),json:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),ctx,els};
}
module.exports={loadApp};
