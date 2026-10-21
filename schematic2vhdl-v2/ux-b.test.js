const test=require('node:test'),assert=require('node:assert/strict');
const {loadApp}=require('./test-runtime.cjs');

function fixture(){
 const a=loadApp();a.run(`const sch=activeSch();sch.components=[];sch.wires=[];
 function c(type,params={}){return comp(addComp(type,sch.components.length*180,0,params));}
 function w(a,p,b,q){sch.wires.push({id:uid('w'),from:{cid:a.id,pid:p},to:{cid:b.id,pid:q}});}`);
 return a;
}
test('fallback markers identify the actual missing operand without changing the circuit or generated code',()=>{
 const a=fixture();a.run(`const input=c('IN',{name:'data'}),gate=c('OR',{inputs:2}),out=c('OUT',{name:'result'});
 w(input,'o',gate,'i0');w(gate,'o',out,'i');const before=serialize(),code=generateSchVhdl(cloneData(sch)).code;
 const diagnostics=fallbackDisplay(sch);`);
 assert.deepEqual(a.json('[...diagnostics.ports.keys()]'),[a.run("gate.id+'.i1'")]);
 assert.equal(a.run('serialize()'),a.run('before'));
 assert.equal(a.run('generateSchVhdl(cloneData(sch)).code'),a.run('code'));
 a.run("const zero=c('GND');w(zero,'o',gate,'i1');");
 assert.equal(a.run('fallbackDisplay(sch).ports.size'),0);
});
test('port descriptions follow live VHDL generic widths and retain the full port name',()=>{
 const a=fixture();a.ctx.source={vhdl:`library ieee;use ieee.std_logic_1164.all;
 entity box is generic(WIDTH:positive:=8);port(long_input_name:in std_logic_vector(WIDTH-1 downto 0);y:out std_logic);end;
 architecture rtl of box is begin y<=long_input_name(0);end;`};
 a.run(`applyVhdlModuleImport(planVhdlModuleImport([source]));const box=c('CUSTOM:box',{generic_WIDTH:64});`);
 assert.equal(a.run("portDescription(box,getPort(box,'long_input_name'))"),'box.long_input_name · in · 64 bit');
 assert.equal(a.run("portDescription(box,getPort(box,'y'))"),'box.y · out · 1 bit');
 a.run('box.params.generic_WIDTH=8;');
 assert.match(a.run("portDescription(box,getPort(box,'long_input_name'))"),/8 bit$/);
});
test('a Bus Tap description uses its connected bus width, and never invents a loose bus width',()=>{
 const a=fixture();a.run(`const input=c('IN',{name:'data',width:64}),tap=c('BUSTAP',{bit:32,nbit:8,mode:'split',dir:'right'});
 w(input,'o',tap,'d');`);
 assert.match(a.run("portDescription(tap,getPort(tap,'d'))"),/in · 64 bit$/);
 assert.match(a.run("portDescription(tap,getPort(tap,'y'))"),/out · 8 bit$/);
 a.run('sch.wires=[];');assert.match(a.run("portDescription(tap,getPort(tap,'d'))"),/in · bus$/);
});
