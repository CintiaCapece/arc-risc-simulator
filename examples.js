(function(root){const examples=[
{id:'4.13',title:'4.13 · Direccionamiento indexado',note:'Supuesto r1=0: r7=5. El programa cae luego sobre array: se detiene con diagnóstico, no ejecuta datos.',source:`.begin
main: nop
 addcc %r1, 4, %r1
 ld %r1, [array+8], %r7
array: 25
 32
 3
 5
 9
.end`},
{id:'4.14',title:'4.14 · Par o impar',note:'25 es impar: r2=0, r3=1. andcc destruye el valor original en r1.',source:`.begin
main: ld [valor], %r1
 andcc %r1, 1, %r1
 be espar
 ba esimpar
espar: or %r0, 1, %r2
 or %r0, 0, %r3
 ba fin
esimpar: or %r0, 0, %r2
 or %r0, 1, %r3
 ba fin
valor: 25
fin: ba fin
.end`},
{id:'4.15',title:'4.15 · Subrutinas y paridad',note:'resultado=25, paridad=1. call usa r15; no apila el retorno.',source:`.begin
sumando1: 10
sumando2: 15
resultado: 0
paridad: 0
main: call sumar
 or %r3, %r0, %r1
 call esimpar
 st %r3, [resultado]
 st %r4, [paridad]
 ba fin
sumar: ld [sumando1], %r1
 ld [sumando2], %r2
 addcc %r1, %r2, %r3
 jmpl %r15+4, %r0
esimpar: andcc %r1, 1, %r4
 jmpl %r15+4, %r0
fin: ba fin
.end`},
{id:'4.16',title:'4.16 · Suma mediante la pila',note:'Supuesto r14=4096: z=24 y r14 vuelve a 4096. Las celdas desapiladas conservan su contenido.',source:`.begin
.org 2048
 ld [x], %r1
 ld [y], %r2
 addcc %r14, -4, %r14
 st %r1, %r14
 addcc %r14, -4, %r14
 st %r2, %r14
 call sbr_add
 ld %r14, %r3
 addcc %r14, 4, %r14
 st %r3, [z]
 ba final
sbr_add: ld %r14, %r8
 addcc %r14, 4, %r14
 ld %r14, %r9
 addcc %r8, %r9, %r10
 st %r10, %r14
 jmpl %r15+4, %r0
x: 15
y: 9
z: 0
final: ba final
.end`},
{id:'4.17',title:'4.17 · Macro: suma de array',note:'length=20 son bytes: suma 5 palabras, resultado=12. .dwb 5 reserva otras 5 palabras, no las inicializa. Etiquetas locales de macro renombradas por expansión.',source:`.begin
.org 2048
length: 20
array: 25
 -32
 3
 -5
 21
 .dwb 5
resultado: 0
.macro mcr_suma_array pos_array, pos_length, varResult
 ld [pos_length], %r1
 and %r0, %r0, %r3
sumar: add %r1, -4, %r1
 ld %r1, [pos_array], %r2
 add %r2, %r3, %r3
 andcc %r1, %r1, %r0
 be fin
 ba sumar
fin: st %r3, [varResult]
.endmacro
main: mcr_suma_array array, length, resultado
.end`},
{id:'4.18a',title:'4.18 a · Diagnóstico del inmediato',note:'Debe fallar al ensamblar: var=8192 excede simm13. No se trunca silenciosamente.',source:`.begin
.org 8192
valor .equ 5
var: valor
 ld[var], %r1
.end`},
{id:'4.18b',title:'4.18 b · Construir una dirección',note:'var=8192; %hi(var)=8, %lo(var)=0. r7=5. Entrada en la primera instrucción, después del dato.',source:`.begin
.org 8192
valor .equ 5
var: valor
 and %r1, %r0, %r1
 sethi %hi(var), %r1
 or %r1, %lo(var), %r1
 ld %r1, %r7
.end`},
{id:'4.23',title:'4.23 · Seis instrucciones',note:'Banco de prueba agregado: r1=12, r2=5; r3 queda como dirección array. Cada instrucción puede inspeccionarse en la traza. No es una simulación de microciclos del diagrama.',source:`.begin
.org 256
main: or %r0, 12, %r1
 or %r0, 5, %r2
 addcc %r1, %r2, %r3
 orcc %r1, %r2, %r3
 ! Preparación para las cargas de la guía
 or %r0, array, %r3
 ld %r3, %r7
 ld [variable], %r7
 st %r3, [array+4]
 or %r0, 0, %r3
 ld %r3, [array+20], %r7
 ba fin
variable: 42
array: 10
 20
 30
 40
 50
 60
fin: ba fin
.end`}
];if(typeof module!=='undefined')module.exports=examples;else root.EXAMPLES=examples;})(globalThis);
