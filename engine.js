/* ARC educativo: sin delay slots. No ejecuta binarios ni genera opcodes. */
(function(root){
'use strict';
const OPS={nop:0,add:3,addcc:3,and:3,andcc:3,or:3,orcc:3,orncc:3,srl:3,sethi:2,ld:2,st:2,call:1,jmpl:2,ba:1,be:1,bne:1,bneg:1,bcs:1,bvs:1};
const reg=s=>{let m=/^%?r(\d+)$/.exec(s.trim());if(!m||+m[1]>31)throw Error('Registro inválido: '+s);return +m[1]};
const isreg=s=>/^%?r\d+$/.test(s.trim());
const hex=n=>'0x'+(n>>>0).toString(16).padStart(8,'0');
function expr(s,symbols){
 s=s.trim();let h=/^%(hi|lo)\((.*)\)$/.exec(s);if(h){let v=expr(h[2],symbols)>>>0;return h[1]==='hi'?v>>>10:v&1023;}
 let tokens=s.match(/[+-]|0x[\da-f]+|\d+|[A-Za-z_]\w*/gi);if(!tokens||tokens.join('')!==s.replace(/\s/g,''))throw Error('Expresión inválida: '+s);
 let total=0,sign=1,need=true;for(const t of tokens){if(t==='+'||t==='-'){if(!need){need=true;sign=t==='-'?-1:1}else if(t==='-')sign=-sign;continue;}if(!need)throw Error('Falta operador: '+s);let v=/^(0x[\da-f]+|\d+)$/i.test(t)?Number(t):symbols[t];if(v===undefined)throw Error('Símbolo no definido: '+t);total+=sign*v;sign=1;need=false;}if(need)throw Error('Expresión incompleta: '+s);return total;
}
function assemble(source){
 const warnings=['Modelo sin delay slots; call guarda PC y jmpl r15+4 retorna. Registros iniciales 0; r14 inicial = 4096 (configurable). .dwb reserva palabras sin inicializar. No se generan palabras máquina: el mapa contiene instrucciones interpretadas.'];
 let raw=source.split(/\r?\n/).map((s,i)=>({text:s.split('!')[0].trim(),line:i+1})).filter(x=>x.text), macros=Object.create(null),lines=[],serial=0;
 for(let i=0;i<raw.length;i++){let x=raw[i],m=/^\.macro\s+(\w+)\s*(.*)$/.exec(x.text);if(m){if(macros[m[1]])throw Error('Macro duplicada');let body=[];while(++i<raw.length&&raw[i].text!=='.endmacro')body.push(raw[i]);if(i===raw.length)throw Error('Falta .endmacro');macros[m[1]]={params:m[2].split(',').map(x=>x.trim()).filter(Boolean),body};}else lines.push(x);}
 function expand(xs,depth=0){if(depth>16)throw Error('Expansión de macros demasiado profunda');let out=[];for(let x of xs){let m=/^(?:(\w+):\s*)?(\w+)\s*(.*)$/.exec(x.text),macro=m&&macros[m[2]];if(!macro){out.push(x);continue;}let args=m[3].split(',').map(x=>x.trim()).filter(Boolean);if(args.length!==macro.params.length)throw Error('Cantidad de argumentos de macro incorrecta, línea '+x.line);let id='__m'+(++serial)+'_', locals=macro.body.flatMap(z=>{let a=/^(\w+):/.exec(z.text);return a?[a[1]]:[]});let body=macro.body.map(z=>{let t=z.text;macro.params.forEach((p,i)=>t=t.replace(new RegExp('\\b'+p+'\\b','g'),args[i]));locals.forEach(p=>t=t.replace(new RegExp('\\b'+p+'\\b','g'),id+p));return {text:t,line:x.line,macroLine:z.line};});if(m[1])out.push({text:m[1]+':',line:x.line});out.push(...expand(body,depth+1));}return out;}
 lines=expand(lines);let symbols=Object.create(null),entries=[],pc=0,equations=[],begun=false,ended=false;
 function define(k,v){if(Object.hasOwn(symbols,k))throw Error('Símbolo duplicado: '+k);symbols[k]=v;}
 function aligned(n){if(!Number.isInteger(n)||n<0||n>0xfffffffc||n%4)throw Error('Dirección inválida o no alineada: '+n);}
 for(let x of lines){try{let t=x.text;if(t==='.begin'){if(begun)throw Error('.begin duplicado');begun=true;continue;}if(t==='.end'){ended=true;continue;}if(ended)throw Error('Contenido después de .end');let eq=/^(\w+)\s+\.equ\s+(.+)$/.exec(t);if(eq){equations.push({name:eq[1],text:eq[2]});try{define(eq[1],expr(eq[2],symbols));equations.pop();}catch(e){if(!e.message.startsWith('Símbolo no definido'))throw e;}continue;}
 let label=/^(\w+):\s*(.*)$/.exec(t);if(label){define(label[1],pc);t=label[2];if(!t)continue;}
 let org=/^\.org\s+(.+)$/.exec(t);if(org){pc=expr(org[1],symbols);aligned(pc);continue;}
 let dwb=/^\.dwb\s+(.+)$/.exec(t);if(dwb){let n=expr(dwb[1],symbols);if(!Number.isInteger(n)||n<0||n>16384)throw Error('.dwb requiere 0..16384 palabras');for(let j=0;j<n;j++){aligned(pc);entries.push({...x,address:pc,kind:'reserva'});pc+=4;}continue;}
 aligned(pc);entries.push({...x,text:t,address:pc,kind:/^[+-]?(?:\d|0x)/.test(t)||!/^\w+\s*[\s\[]/.test(t)&&!Object.hasOwn(OPS,t)?'dato':'instrucción'});pc+=4;
 }catch(e){throw Error('Línea '+x.line+': '+e.message);}}
 if(!begun||!ended)warnings.push('Falta .begin o .end: se acepta el fragmento.');
 for(let j=0;equations.length&&j<100;j++){let pending=[];for(let e of equations){try{define(e.name,expr(e.text,symbols));}catch(err){if(!err.message.startsWith('Símbolo no definido'))throw err;pending.push(e);}}equations=pending;}if(equations.length)throw Error('.equ sin resolver o cíclico: '+equations.map(x=>x.name));
 let addresses=new Set(),memory=new Map(),code=new Map();
 function immediate(s){let v=expr(s,symbols);if(!Number.isInteger(v)||v< -4096||v>4095)throw Error('Inmediato fuera de simm13 (-4096..4095): '+s+' = '+v+'. Construí la dirección con sethi %hi / or %lo (4.18).');return v;}
 function operand(s){if(isreg(s))return {r:reg(s)};return {v:immediate(s)};}
 function address(s){if(s.includes('[')||s.includes(']')){if(!/^\[[^\[\]]+\]$/.test(s))throw Error('Corchetes de dirección inválidos: '+s);s=s.slice(1,-1);}s=s.trim();let m=/^(%?r\d+)\s*(?:\+\s*(.+))?$/.exec(s);if(m)return {base:reg(m[1]),off:m[2]?operand(m[2]):{v:0}};return {base:0,off:{v:immediate(s)}};}
 for(let e of entries){try{if(addresses.has(e.address))throw Error('Solapamiento de .org');addresses.add(e.address);if(e.kind==='reserva')continue;if(e.kind==='dato'){let v=expr(e.text,symbols);if(v< -2147483648||v>4294967295)throw Error('Dato fuera de 32 bits');memory.set(e.address,v|0);continue;}
 let m=/^(\w+)\s*(.*)$/.exec(e.text),op=m[1],a=m[2].split(',').map(x=>x.trim()).filter(Boolean);if(!Object.hasOwn(OPS,op))throw Error('Instrucción no implementada: '+op);let ins={...e,op,args:a};
 if(op==='ld'&&a.length===3){warnings.push('Línea '+e.line+': ld de tres operandos se interpreta como memoria[rBase + desplazamiento].');ins.addr=address(a[1]);if(ins.addr.base!==0)throw Error('ld de 3 operandos requiere desplazamiento sin registro');ins.addr.base=reg(a[0]);ins.rd=reg(a[2]);}
 else{if(a.length!==OPS[op])throw Error(op+': cantidad de operandos incorrecta');if(op==='ld'||op==='st'){ins.addr=address(a[op==='ld'?0:1]);ins.rd=reg(a[op==='ld'?1:0]);if(!a[op==='ld'?0:1].startsWith('['))warnings.push('Línea '+e.line+': dirección indirecta sin corchetes aceptada según la guía.');}
 else if(op==='sethi'){ins.value=expr(a[0],symbols);if(ins.value<0||ins.value>4194303)throw Error('sethi requiere imm22');ins.rd=reg(a[1]);}
 else if(op==='jmpl'){ins.addr=address(a[0]);ins.rd=reg(a[1]);}
 else if(op==='call'||op.startsWith('b')){ins.target=expr(a[0],symbols);aligned(ins.target);let bits=op==='call'?30:22,disp=(ins.target-e.address)/4;if(disp<-(2**(bits-1))||disp>=2**(bits-1))throw Error('Salto fuera de rango');}
 else if(op!=='nop'){ins.rs=reg(a[0]);ins.operand=operand(a[1]);ins.rd=reg(a[2]);}}
 code.set(e.address,ins);
 }catch(err){throw Error('Línea '+e.line+': '+err.message);}}
 let entry=symbols.main??code.keys().next().value;if(entry===undefined||!code.has(entry))throw Error('No hay instrucción en el punto de entrada');
 return {symbols,entries,memory,code,entry,warnings};
}
class Machine{
 constructor(program,initial={}){this.p=program;this.r=Array(32).fill(0);this.r[14]=4096;for(let [k,v]of Object.entries(initial)){if(!Number.isInteger(Number(v))||Number(v)<-2147483648||Number(v)>4294967295)throw Error('Valor inicial inválido');this.r[reg(k)]=Number(v)|0;}this.r[0]=0;this.pc=program.entry;this.memory=new Map(program.memory);this.flags={N:0,Z:0,V:0,C:0};this.trace=[];this.stopped=false;this.reason='Listo';}
 step(){if(this.stopped)return;let i=this.p.code.get(this.pc);if(!i){this.stopped=true;this.reason=this.p.entries.some(e=>e.address===this.pc)?'PC apunta a datos o reserva: no se ejecutan.':'Fin del código: no hay instrucción en PC.';return;}let before=this.r.slice(),oldpc=this.pc,oldflags={...this.flags},writes=[],note='',result,a,b,next=this.pc+4;const value=o=>o.r!==undefined?this.r[o.r]:o.v;const addr=()=>{let v=(this.r[i.addr.base]+value(i.addr.off))>>>0;if(v%4)throw Error('Acceso no alineado '+hex(v));return v;};const write=(r,v)=>{if(r)this.r[r]=v|0;};
 try{switch(i.op){case'nop':note='No modifica registros ni flags.';break;case'ld':{let ea=addr();if(!this.memory.has(ea))throw Error('Lectura de memoria sin inicializar '+hex(ea));result=this.memory.get(ea);write(i.rd,result);note='EA = '+hex(ea)+'; memoria[EA] = '+result+' → r'+i.rd;break;}case'st':{let ea=addr();if(this.p.code.has(ea))throw Error('Escritura sobre instrucciones no soportada');result=this.r[i.rd];writes.push({address:ea,before:this.memory.get(ea)??null,after:result});this.memory.set(ea,result);note='r'+i.rd+' = '+result+' → memoria['+hex(ea)+']';break;}case'sethi':result=i.value*1024;write(i.rd,result);note='imm22 << 10 → r'+i.rd+' = '+hex(result);break;case'call':write(15,oldpc);next=i.target;note='r15 ← PC; PC ← '+hex(next)+'. No modifica la pila automáticamente.';break;case'jmpl':next=addr();write(i.rd,oldpc);note='Destino calculado antes de escribir enlace; PC ← '+hex(next);break;
 case'ba':case'be':case'bne':case'bneg':case'bcs':case'bvs':{let f=this.flags,take=i.op==='ba'||i.op==='be'&&f.Z||i.op==='bne'&&!f.Z||i.op==='bneg'&&f.N||i.op==='bcs'&&f.C||i.op==='bvs'&&f.V;if(take)next=i.target;note='NZVC='+Object.values(f).join('')+'; salto '+(take?'tomado':'no tomado')+' → '+hex(next);break;}
 default:a=this.r[i.rs];b=value(i.operand);if(i.op.startsWith('add'))result=(a+b)|0;else if(i.op.startsWith('and'))result=a&b;else if(i.op==='orncc')result=a|~b;else if(i.op.startsWith('or'))result=a|b;else if(i.op==='srl')result=a>>>(b&31);else throw Error('Instrucción no implementada');write(i.rd,result);if(i.op.endsWith('cc'))this.flags={N:+((result|0)<0),Z:+((result|0)===0),V:i.op==='addcc'?+((~(a^b)&(a^result))<0):0,C:i.op==='addcc'?+((a>>>0)+(b>>>0)>4294967295):0};note=a+' '+i.op+' '+b+' = '+(result|0)+' → r'+i.rd+(i.rd===0?' (escritura descartada)':'')+(i.op.endsWith('cc')?'; actualiza NZVC':' ; conserva NZVC');}
 this.pc=next>>>0;this.r[0]=0;let changes=this.r.flatMap((v,r)=>v!==before[r]?[{r,before:before[r],after:v}]:[]);this.trace.push({step:this.trace.length+1,pc:oldpc,line:i.line,instruction:i.text,nextPC:this.pc,registers:this.r.slice(),flags:{...this.flags},oldflags,changes,writes,explanation:note,phases:['Búsqueda: PC identifica la instrucción de 4 bytes.','Decodificación: '+i.op+'; símbolos y directivas ya resueltos.','Ejecución: '+note,'PC siguiente: '+hex(this.pc)]});this.reason=note;if(this.pc===oldpc&&i.op==='ba'){this.stopped=true;this.reason='Bucle terminal ba a sí mismo; detenido después de registrar el salto.';}
 }catch(e){this.stopped=true;this.reason='Error de ejecución: '+e.message;throw Error(this.reason);}}
 run(limit=10000){let n=0;while(!this.stopped&&n++<limit)this.step();if(!this.stopped)this.reason='Límite de '+limit+' instrucciones alcanzado; podés continuar.';return this;}
}
const API={assemble,Machine,OPS,hex,expr};if(typeof module!=='undefined')module.exports=API;else root.ARC=API;
})(globalThis);
