#!/usr/bin/env node
// Writes Markdown to stdout; redirect to the skill reference when registry changes.
const {loadApp}=require('./test-runtime.cjs');
const a=loadApp();
const entries=a.json(`Object.entries(TYPES).filter(([t])=>!['IN','OUT','JUNCTION','MODULE_FRAME'].includes(t)).map(([type,td])=>{
 const ports=p=>getPorts({type,params:p}).map(p=>p.id+':'+p.dir+'['+(p.width||1)+']').join(' ');
 const params=td.defaultParams, base=ports(params),variants=[];
 for(const field of td.paramSchema||[]){
  const values=field.type==='bool'?[true]:field.type==='select'?field.options:[];
  for(const value of values){if(value===params[field.key])continue;const signature=ports({...params,[field.key]:value});if(signature!==base)variants.push({setting:field.key+'='+value,ports:signature});}
 }
 return {type,defaults:params,fields:td.paramSchema||[],ports:base,variants};
})`);
console.log('# Built-in component reference\n\nGenerated from Studio TYPES, paramSchema and getPorts. Regenerate with `node schematic2vhdl-v2/generate-schematic-text-reference.cjs`. Do not hand-edit the generated tables.\n\nPin notation: `id:in[width]` or `id:out[width]`. Listed variants change ONE setting from defaults; combined settings must be queried using `describe-schematic-part.cjs`. BUSTAP d width 2 is a drawing marker: see syntax.md for actual bus width and merge direction.\n\nContents: '+entries.map(e=>e.type).join(', ')+'\n');
for(const e of entries){
 console.log('## '+e.type+'\n\nDefaults: `'+JSON.stringify(e.defaults)+'`\n\nPins: `'+e.ports+'`\n');
 if(e.fields.length){console.log('| Parameter | Accepted values |\n|---|---|');for(const f of e.fields)console.log('| '+f.key+' | '+(f.type==='select'?f.options.map(String).join(', '):f.type==='int'?`integer ${f.min??'-∞'}…${f.max??'∞'}`:f.type==='bool'?'true, false':f.type)+' |');console.log('');}
 for(const v of e.variants)console.log('- `'+v.setting+'` → `'+v.ports+'`');
 if(e!==entries.at(-1)) console.log('');
}
