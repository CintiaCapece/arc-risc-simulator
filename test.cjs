const assert=require('node:assert/strict');const {assemble,Machine}=require('./engine.js');const examples=require('./examples.js');let checks=0;
function test(name,fn){fn();checks++;console.log('OK '+name);}
function run(id,init){let p=assemble(examples.find(x=>x.id===id).source),m=new Machine(p,init);m.run();return m;}
test('4.13 r1=0: r7=5 y PC sobre datos',()=>{let m=run('4.13');assert.equal(m.r[7],5);assert.match(m.reason,/datos/);assert.equal(m.p.symbols.array,12);});
test('4.13 r1 inicial=4: r7=9',()=>assert.equal(run('4.13',{r1:4}).r[7],9));
test('4.14 impar',()=>{let m=run('4.14');assert.equal(m.r[2],0);assert.equal(m.r[3],1);});
test('4.14 par',()=>{let p=assemble(examples[1].source.replace('valor: 25','valor: 24')),m=new Machine(p);m.run();assert.equal(m.r[2],1);assert.equal(m.r[3],0);});
test('4.15 resultado y paridad',()=>{let m=run('4.15');assert.equal(m.memory.get(m.p.symbols.resultado),25);assert.equal(m.memory.get(m.p.symbols.paridad),1);});
test('4.16 pila balanceada y suma 24',()=>{let m=run('4.16');assert.equal(m.memory.get(m.p.symbols.z),24);assert.equal(m.r[14],4096);assert.equal(m.memory.get(4088),9);assert.equal(m.memory.get(4092),24);});
test('4.17 macro suma 12; reserva no inicializada',()=>{let m=run('4.17');assert.equal(m.memory.get(m.p.symbols.resultado),12);assert.equal(m.memory.has(m.p.symbols.array+20),false);assert.equal(m.r[0],0);assert.equal(m.p.symbols.main,2096);});
test('4.18 a rechaza simm13',()=>assert.throws(()=>run('4.18a'),/simm13/));
test('4.18 b carga 5 desde 8192',()=>{let m=run('4.18b');assert.equal(m.r[7],5);assert.equal(m.r[1],8192);});
test('4.23 instrucciones y memoria',()=>{let m=run('4.23');assert.equal(m.r[7],60);assert.equal(m.memory.get(m.p.symbols.array+4),m.p.symbols.array);assert.equal(m.trace.find(t=>t.instruction.startsWith('addcc')).registers[3],17);assert.equal(m.trace.find(t=>t.instruction.startsWith('orcc')).registers[3],13);});
const frag=s=>assemble('.begin\nmain: '+s+'\n.end');
test('addcc overflow firmado',()=>{let m=new Machine(frag('addcc %r1, 1, %r2'),{r1:2147483647});m.step();assert.deepEqual(m.flags,{N:1,Z:0,V:1,C:0});});
test('addcc carry y cero',()=>{let m=new Machine(frag('addcc %r1, 1, %r0'),{r1:-1});m.step();assert.deepEqual(m.flags,{N:0,Z:1,V:0,C:1});assert.equal(m.r[0],0);});
test('orcc limpia V C; or conserva flags',()=>{let m=new Machine(frag('orcc %r0, 0, %r1\n or %r0, 1, %r2'));m.flags={N:1,Z:0,V:1,C:1};m.run();assert.deepEqual(m.flags,{N:0,Z:1,V:0,C:0});});
test('rechaza instrucciones desconocidas',()=>assert.throws(()=>frag('mul %r1, %r2, %r3'),/no implementada/));
test('rechaza registro inválido',()=>assert.throws(()=>frag('add %r32, 1, %r1'),/Registro inválido/));
test('rechaza inmediatos, solapamiento y símbolos',()=>{assert.throws(()=>frag('add %r0, 4096, %r1'),/simm13/);assert.throws(()=>frag('nop\n.org 0\nnop'),/Solapamiento/);assert.throws(()=>frag('ld [falta], %r1'),/Símbolo/);});
test('lecturas sin inicializar y no alineadas fallan',()=>{assert.throws(()=>new Machine(frag('ld %r1, %r2'),{r1:400}).step(),/sin inicializar/);assert.throws(()=>new Machine(frag('ld %r1, %r2'),{r1:3}).step(),/no alineado/);});
test('corchetes incompletos se rechazan',()=>assert.throws(()=>frag('ld [4, %r1'),/Corchetes/));
test('srl lógico de 32 bits',()=>{let m=new Machine(frag('srl %r1, 1, %r2'),{r1:-1});m.step();assert.equal(m.r[2],2147483647);});
test('límite de ejecución deja continuar',()=>{let m=new Machine(frag('add %r1, 1, %r1\nba main'));m.run(10);assert.equal(m.trace.length,10);assert.equal(m.stopped,false);m.run(4);assert.equal(m.trace.length,14);});
test('macro invocada dos veces sin etiquetas duplicadas',()=>{let p=assemble('.begin\n.macro inc dst\nlocal: add dst, 1, dst\n.endmacro\nmain: inc %r1\ninc %r2\n.end');let m=new Machine(p);m.run();assert.equal(m.r[1],1);assert.equal(m.r[2],1);});
for(let [op,flags]of Object.entries({be:{Z:1},bne:{Z:0},bneg:{N:1},bcs:{C:1},bvs:{V:1}}))test('salto '+op,()=>{let m=new Machine(frag(op+' fin\nadd %r0, 1, %r1\nfin: nop'));Object.assign(m.flags,flags);m.run();assert.equal(m.r[1],0);});
test('orncc y sethi hi/lo',()=>{let m=new Machine(frag('orncc %r0, %r0, %r1\nsethi %hi(0x12345678), %r2\nor %r2, %lo(0x12345678), %r2'));m.run();assert.equal(m.r[1],-1);assert.equal(m.r[2],0x12345678);});
test('símbolos sin propiedades heredadas',()=>{assert.throws(()=>frag('ld [constructor], %r1'),/Símbolo no definido/);let p=assemble('.begin\n__proto__ .equ 4\nmain: or %r0, __proto__, %r1\n.end');let m=new Machine(p);m.step();assert.equal(m.r[1],4);});
console.log(checks+' pruebas aprobadas.');
