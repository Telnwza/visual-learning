#!/usr/bin/env node
// Query exact configured pins through the same parser and registry as Studio.
const {loadApp}=require('./test-runtime.cjs');
try{
 const [type,...parameters]=process.argv.slice(2);
 const app=loadApp();
 if(!type) throw new Error('Usage: node describe-schematic-part.cjs TYPE [key=value ...]');
 app.ctx.partType=type;
 if(!app.run('Object.hasOwn(TYPES,partType)')) throw new Error('Unknown built-in type: '+type);
 const hasClock=app.run('getPorts({type:partType,params:TYPES[partType].defaultParams}).some(p=>p.id==="clk")');
 app.ctx.sourceText='format schematic-text 1\ncircuit describe_part\npart probe '+[type,...parameters].join(' ')+(hasClock?'\ninput probe_clock\nconnect probe_clock -> probe.clk':'');
 console.log(JSON.stringify(app.json(`(()=>{const c=compileSchematicText(sourceText).sch.components.find(c=>c.id==='probe');return {type:c.type,params:c.params,parameters:TYPES[c.type].paramSchema,ports:getPorts(c).map(p=>({id:p.id,dir:p.dir,width:p.width||1}))};})()`),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
