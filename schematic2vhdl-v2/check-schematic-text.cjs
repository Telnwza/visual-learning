#!/usr/bin/env node
// Uses the real Studio parser in the same headless runtime as its regression tests.
const fs=require('node:fs');
const {loadApp}=require('./test-runtime.cjs');
try{
 const [file,projectFile,projectId]=process.argv.slice(2);
 if(!file) throw new Error('Usage: node check-schematic-text.cjs circuit.sch.txt [project.schproj.json] [workspace-project-id]');
 const app=loadApp();
 if(projectFile){
  const payload=JSON.parse(fs.readFileSync(projectFile,'utf8'));
  let project=payload.project;
  if(payload.workspace){const id=projectId||payload.workspace.activeId;project=payload.workspace.projects?.[id];}
  if(!project?.schematics) throw new Error('Project not found; supply a valid project file and optional workspace project ID');
  app.ctx.libraryProject=project;app.run('state.project=libraryProject');
 }
 app.ctx.sourceText=fs.readFileSync(file,'utf8');
 const r=app.json('compileSchematicText(sourceText)');
 console.log(JSON.stringify({name:r.sch.name,components:r.sch.components.length,wires:r.sch.wires.length,dependencies:r.dependencies,warnings:r.warnings},null,2));
}catch(e){console.error(e.message);process.exitCode=1;}
