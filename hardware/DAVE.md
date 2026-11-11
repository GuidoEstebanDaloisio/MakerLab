# Robot DAVE — conexiones y materiales

DAVE es el robot educativo de MakerLab. Se arma una sola vez y se usa en todas
las lecciones sin desarmarlo: cada lección agrega un componente que ya está
conectado.

## Lista de materiales

| Componente | Cant. | Notas |
|---|---|---|
| Arduino Uno R3 (o compatible con CH340) | 1 | Los compatibles necesitan el driver CH340 en Windows. |
| Puente H L9110S (2 canales) | 1 | Controla los dos motores. El Arduino no puede alimentar motores directamente desde sus pines. |
| Motor TT con caja reductora (3–6 V) | 2 | |
| Rueda para motor TT | 2 | |
| Rueda loca | 1 | |
| Sensor ultrasónico HC-SR04 | 1 | |
| Módulo sensor infrarrojo TCRT5000 de 4 pines (VCC, GND, D0, A0) | 2 | El sensor va del lado de la placa que mira al piso, a 1 o 2 cm. Se calibra con el potenciómetro: el LED de señal se enciende sobre blanco y se apaga sobre la cinta negra. |
| Buzzer **pasivo** | 1 | Debe ser pasivo para poder hacer tonos distintos. |
| LED 5 mm (verde, amarillo, rojo, azul) | 4 | Cada uno con su resistencia. |
| LED 5 mm blanco | 2 | Luces delanteras, conectadas en paralelo, cada una con su resistencia. |
| Resistencia 220 Ω | 6 | Para los LEDs. |
| Pulsador táctil de 4 pines | 3 | Usan la resistencia de pull-up interna del Arduino: no llevan resistencia. |
| Portapilas para 6 pilas AA (9 V) con interruptor | 1 | Alimenta el Arduino (por VIN) y el puente H. |
| Pilas AA | 6 | Pueden ser recargables. |
| Protoboard mini (170 puntos) y cables dupont | 1 | |
| Chasis impreso en 3D o de material reciclado (cartón, MDF, plástico) | 1 | |

## Conexiones

| Componente | Pin del componente | Pin del Arduino |
|---|---|---|
| Puente H L9110S | A-IA (motor izquierdo) | D5 (PWM) |
| | A-IB (motor izquierdo) | D7 |
| | B-IA (motor derecho) | D6 (PWM) |
| | B-IB (motor derecho) | D8 |
| | VCC / GND | + y – del portapilas |
| HC-SR04 | TRIG / ECHO | D9 / D10 |
| | VCC / GND | 5V / GND |
| TCRT5000 izquierdo | D0 | D2 |
| TCRT5000 derecho | D0 | D3 |
| | VCC / GND (ambos) | 5V / GND |
| | A0 (ambos) | Sin conectar: MakerLab usa solo la salida digital |
| Buzzer pasivo | + | D4 |
| LED verde / amarillo / rojo | ánodo (con 220 Ω) | D11 / D12 / D13 |
| LED azul | ánodo (con 220 Ω) | A0 |
| LEDs blancos | ánodos (cada uno con 220 Ω) | A1 |
| Botones 1 / 2 / 3 | una pata (la otra a GND) | A2 / A3 / A4 |
| Portapilas | + / – | VIN / GND del Arduino |

Queda libre el pin A5 para agregar un componente en el futuro.

## Alimentación

El Arduino Uno necesita al menos 7 V en VIN; por eso se usan 6 pilas AA (9 V)
en lugar de 3 (4,5 V). Los motores TT trabajan entre 3 y 6 V: el programa
generado por MakerLab limita la potencia que les llega (constante `VELOCIDAD`)
para no superar ese rango.

Mientras el robot está conectado por USB a la computadora puede funcionar sin
pilas para probar luces, sonido y sensores, pero los motores necesitan las pilas.

## Ajustes después de armarlo

- Si un motor gira al revés, se invierten sus dos cables o se cambia
  `INVERTIR_IZQ` / `INVERTIR_DER` a `true` en el programa.
- En el simulador, un giro de 1 segundo equivale a 90°. En el robot real
  depende de las pilas y del piso; se puede ajustar `VELOCIDAD`.
