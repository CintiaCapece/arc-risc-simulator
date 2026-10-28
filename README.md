# ARC-RISC Simulator

Aplicación web educativa basada en los programas de la Guía 4 de la materia "Organización del Computador" (FIUBA) . Funciona en el navegador, sin servidor de cálculo ni dependencias de paquetes. El código del usuario no se evalúa como JavaScript.

## Abrir

Abrí `index.html` con un navegador moderno. Funciona también sin conexión (las fuentes visuales tienen alternativa local).

Para servirla localmente, con Node.js 20 o posterior:

```sh
node server.cjs
```

Abrí http://127.0.0.1:4173. Para verificar el motor:

```sh
node test.cjs
```

No hace falta instalar paquetes. `npm start` y `npm test` son equivalentes.

## Uso

1. Elegí un ejercicio o importá un `.asm`. Podés editar el programa directamente.
2. En **Estado inicial y punto de entrada**, especificá registros como JSON, por ejemplo `{"r14":4096,"r1":0}`. Valores enteros de 32 bits; nombres r0–r31. r0 se mantiene en cero. La entrada automática es `main`, si existe, o la primera instrucción; también podés elegir una etiqueta o dirección.
3. Presioná **Ensamblar**. El ensamblador expande macros, calcula símbolos, asigna direcciones y valida operandos. Un error bloquea la ejecución.
4. **Paso** ejecuta una instrucción. **Ejecutar** avanza hasta detenerse o alcanzar 10.000 pasos por pulsación; permite continuar un ciclo que no termina. **Reiniciar** vuelve a ensamblar con los valores iniciales.
5. Revisá registros (decimal; hexadecimal al posar el cursor), PC, NZVC y la instrucción siguiente. Los cambios del último paso se resaltan. La explicación muestra la última instrucción ejecutada.
6. **Memoria** muestra código, datos, reservas, símbolos y escrituras. No confunde instrucciones interpretadas con opcodes. Exporta un mapa JSON.
7. **Pila** muestra 12 palabras alrededor de r14; no inventa marcos ni borra posiciones al desapilar.
8. **Traza** contiene todos los pasos ejecutados. Seleccioná una fila para volver a su explicación. CSV incluye los 32 registros y flags de cada paso; JSON agrega cambios de memoria, fases conceptuales y estado final. Guardá también tu `.asm`: no hay guardado automático.
9. **Diagnósticos** y **Ayuda y soporte** explican las convenciones y límites. Editar código, entrada o registros invalida la ejecución anterior.

## Ejemplos y resultados verificados

| Ejercicio | Resultado / condición |
| --- | --- |
| 4.13 | Con r1 inicial=0, r1 final=4 y r7=5. Con r1 inicial=4, r7=9. Luego PC cae sobre datos y se detiene con aviso. Sin r1 inicial no hay respuesta única. array empieza en dirección 12 con origen 0. |
| 4.14 | valor=25: r2=0, r3=1. Con 24: r2=1, r3=0. andcc reemplaza r1 por el bit de paridad. |
| 4.15 | resultado=25, paridad=1. Retorno en r15 y saltos sin delay slot. |
| 4.16 | r14 inicial=4096: z=24, r14 final=4096. r14 no está inicializado por el programa original: se explicita el supuesto. |
| 4.17 | length=20 bytes: recorre cinco palabras, resultado=12. main=2096. .dwb 5 reserva otras cinco palabras sin inicializar, que no se leen. |
| 4.18 a | Error esperado: var=8192 no cabe en simm13. No se trunca ni se expande automáticamente ld. |
| 4.18 b | %hi(8192)=8, %lo(8192)=0; r1=8192, r7=5. La entrada es la primera instrucción, no el dato var. |
| 4.23 | Banco de prueba agregado alrededor de las seis instrucciones del enunciado. addcc da 17, orcc da 13; cargas y store verificadas; última carga da r7=60. Los registros de preparación permiten ejecutar cada forma con direcciones válidas. |

4.23 no proporciona valores iniciales para ejecutar un único programa completo. El banco de prueba identifica explícitamente su preparación agregada. Las fases de explicación son conceptuales de ISA: no simulan el trayecto de buses, MAR/MDR ni ciclos de reloj del diagrama.

## Dialecto y sintaxis admitidos

Direcciones en bytes; instrucciones y datos ocupan palabras de 4 bytes, alineadas. Origen predeterminado 0. Datos como una expresión por línea, con etiqueta opcional, por ejemplo `valor: 25`.

Directivas implementadas:

- `.begin` / `.end`: delimitadores sin memoria propia; se aceptan fragmentos sin ellos con advertencia.
- `.org expresión`: siguiente dirección. No permite solapar posiciones emitidas.
- `nombre .equ expresión`: constante, sin reservar memoria. Referencias adelantadas en constantes se resuelven si no son cíclicas. `.org` y `.dwb` requieren valores ya conocidos en la pasada de asignación.
- `.dwb cantidad`: reserva hasta 16384 palabras, sin inicializarlas; leer una reserva no escrita produce error.
- `.macro nombre p1, p2` hasta `.endmacro`: sustitución de parámetros por tokens, con argumentos separados por comas. Las etiquetas internas son locales a cada expansión. Máximo 16 niveles de expansión. Las definiciones no emiten instrucciones; las invocaciones emiten el cuerpo expandido. El mapa conserva la línea de invocación, y el motor conserva además la línea del cuerpo.

Comentarios comienzan con `!`. Símbolos y mnemónicos distinguen mayúsculas. Registros `%r0`–`%r31` o `r0`–`r31`. Expresiones: decimal, hexadecimal `0x`, símbolos, suma/resta y signo unario. No hay multiplicación, paréntesis aritméticos ni expresiones arbitrarias. `%hi(expr)` = bits 31..10; `%lo(expr)` = bits 9..0.

Instrucciones implementadas (lista exhaustiva):

```text
nop
add addcc and andcc or orcc orncc srl  rs1, rs2_o_simm13, rd
sethi imm22, rd
ld [dirección], rd
ld registroDirección, rd
ld registroBase, [desplazamiento], rd
st rs, [dirección]
st rs, registroDirección
call etiqueta
jmpl registro+desplazamiento, rd
ba be bne bneg bcs bvs  etiqueta
```

Las direcciones pueden ser `[símbolo+constante]`, `[rBase+inmediato]`, `[rBase+rOffset]` o sus formas aceptadas sin corchetes. La carga de tres operandos de la guía usa EA=rBase+desplazamiento y genera advertencia de compatibilidad. `ld[var]` se reconoce aunque no haya espacio. Inmediatos y desplazamientos: -4096..4095 (simm13); sethi: 0..4194303 (imm22). Los destinos de salto se validan por alineación y rango relativo de 22 bits para branch y 30 para call.

## Semántica del motor

- Aritmética módulo 2^32. Registros se muestran como enteros con signo; PC y direcciones son sin signo. r0 descarta escrituras, pero una instrucción cc igualmente actualiza flags.
- Solo sufijos `cc` modifican NZVC. N=bit 31, Z=resultado cero. addcc calcula overflow con signo V y carry sin signo C. Operaciones lógicas cc ponen V=C=0. srl desplaza lógicamente usando los cinco bits inferiores del contador.
- be usa Z; bne usa no Z; bneg usa N; bcs usa C; bvs usa V; ba es incondicional.
- Sin delay slots. call guarda la dirección de la propia instrucción en r15; `jmpl r15+4,r0` retorna a la siguiente. jmpl calcula el destino antes de escribir su enlace.
- Puntero de pila: r14=4096 por defecto, configurable. No se inicializa desde la guía ni se supone una pila creada por hardware. Llamadas anidadas requieren preservar r15 explícitamente.
- Memoria dispersa de palabras. Se rechazan lecturas no inicializadas, accesos no alineados y stores sobre instrucciones. El modelo no observa orden de bytes: no emula cargas/almacenamientos de bytes ni demuestra endianness.
- El motor detiene `ba` a sí mismo y registra ese paso. Si PC alcanza datos/reservas, informa la caída. Si no hay instrucción ni dato, informa fin del código; `.end` no es una instrucción halt.

## Límites explícitos

Es un ensamblador de representación intermedia e intérprete de Assembly, **no genera ni decodifica palabras máquina**. No ejecuta binarios. No implementa otros mnemónicos, pseudoinstrucciones generales, sub/subcc, mul, div, push/pop, halt, ventanas de registros, traps, interrupciones, periféricos, pipeline, microciclos ni código automodificable. Una instrucción fuera de la lista falla, nunca se simula con una operación vacía.

Los valores iniciales por defecto son supuestos de laboratorio visibles. El programa puede requerir otros valores y las soluciones no sustituyen la revisión del enunciado. 4.18 a es intencionalmente un ejemplo que no ensambla.

## Archivos y verificación

- `engine.js`: ensamblador e intérprete; utilizable desde navegador o CommonJS.
- `examples.js`: transcripción de los programas y banco de prueba 4.23.
- `app.js`, `index.html`, `style.css`: interfaz y exportaciones.
- `test.cjs`: pruebas deterministas de ejercicios, overflow/carry, macros, errores y límite de pasos.
- `server.cjs`: servidor local opcional, solo escucha en 127.0.0.1.

Referencia de ISA consultada: Murdocca y Heuring, *Principles of Computer Architecture*, capítulo 4: https://academicos.azc.uam.mx/oan/lac/Murdocca_en.pdf. El dialecto concreto del curso (por ejemplo add/and/or sin cc y ld de tres operandos) se admite como se documenta aquí, sin afirmar compatibilidad completa con ARCTools.
