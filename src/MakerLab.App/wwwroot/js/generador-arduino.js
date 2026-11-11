/* Generador de código Arduino (C++) a partir de los bloques.
 *
 * El programa del estudiante se ubica dentro de setup(), de modo que se
 * ejecuta una vez cada vez que DAVE se enciende (igual que en el simulador).
 * Si termina con "repetir para siempre", el contenido de ese bloque pasa a
 * loop(), como en un programa de Arduino escrito a mano.
 */
(function () {
  'use strict';

  const G = new Blockly.CodeGenerator('Arduino');
  const O = {
    ATOMICO: 0, UNARIO: 2, MULT: 3, SUMA: 4, RELACIONAL: 6, IGUALDAD: 7,
    Y_LOGICO: 11, O_LOGICO: 12, NINGUNO: 99,
  };
  G.INDENT = '  ';
  G.addReservedWords('setup,loop,mover,detener,esperarSegundos,leds,sonar,botonPresionado,botonPresionadoNumero,esperarBoton,switch,case,default,break,distanciaCm,hayObstaculo,veLinea,int,long,float,double,void,if,else,while,for,return,true,false,delay,tone');

  // Encadena los bloques que están uno debajo del otro.
  G.scrub_ = function (block, code, soloEste) {
    const siguiente = block.nextConnection && block.nextConnection.targetBlock();
    return (siguiente && !soloEste) ? code + G.blockToCode(siguiente) : code;
  };

  const seg = (v) => Math.round(Number(v) * 1000);

  G.forBlock['dave_inicio'] = () => '';
  G.forBlock['dave_paso'] = (b) => `mover(${b.getFieldValue('DIR')});\ndelay(1000);\ndetener();\n`;
  G.forBlock['dave_mover'] = (b) => `mover(${b.getFieldValue('DIR')});\n`;
  G.forBlock['dave_detener'] = () => 'detener();\n';
  G.forBlock['dave_esperar'] = (b) => `delay(${seg(b.getFieldValue('SEG'))});\n`;
  G.forBlock['dave_siempre'] = (b) => `while (true) {\n${G.statementToCode(b, 'HACER')}}\n`;
  G.forBlock['dave_led'] = (b) => `digitalWrite(LED_${b.getFieldValue('LED')}, ${b.getFieldValue('ACCION') === 'ON' ? 'HIGH' : 'LOW'});\n`;
  G.forBlock['dave_sonido'] = (b) => `sonar(TONO_${b.getFieldValue('TONO')}, ${seg(b.getFieldValue('SEG'))});\n`;
  G.forBlock['dave_esperar_boton'] = (b) => `esperarBoton(${b.getFieldValue('BOTON')});\n`;
  G.forBlock['dave_boton'] = (b) => [`botonPresionado(${b.getFieldValue('BOTON')})`, O.ATOMICO];
  G.forBlock['dave_distancia'] = () => ['distanciaCm()', O.ATOMICO];
  G.forBlock['dave_obstaculo'] = (b) => [`hayObstaculo(${Number(b.getFieldValue('CM'))})`, O.ATOMICO];
  G.forBlock['dave_linea'] = (b) => [`veLinea(${b.getFieldValue('LADO') === 'IZQ' ? 'SENSOR_LINEA_IZQ' : 'SENSOR_LINEA_DER'})`, O.ATOMICO];

  G.forBlock['dave_boton_numero'] = () => ['botonPresionadoNumero()', O.ATOMICO];
  G.forBlock['dave_si'] = (b) => `if (${G.valueToCode(b, 'COND', O.NINGUNO) || 'false'}) {\n${G.statementToCode(b, 'HACER')}}\n`;
  G.forBlock['dave_si_sino'] = (b) => `if (${G.valueToCode(b, 'COND', O.NINGUNO) || 'false'}) {\n${G.statementToCode(b, 'HACER')}} else {\n${G.statementToCode(b, 'SINO')}}\n`;
  G.forBlock['dave_segun'] = function (b) {
    const valor = G.valueToCode(b, 'VALOR', O.NINGUNO) || '0';
    let code = `switch ((long)(${valor})) {\n`;
    Bloques.casosSegun(b).forEach(([v, nombre]) => {
      code += `  case ${v}: {\n${G.prefixLines(G.statementToCode(b, nombre), G.INDENT)}    break;\n  }\n`;
    });
    return code + `  default: {\n${G.prefixLines(G.statementToCode(b, 'OTRO'), G.INDENT)}  }\n}\n`;
  };

  // ---- Bloques estándar ----
  G.forBlock['controls_repeat_ext'] = function (b) {
    const veces = G.valueToCode(b, 'TIMES', O.NINGUNO) || '0';
    const i = G.nameDB_.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
    return `for (long ${i} = 0; ${i} < ${veces}; ${i}++) {\n${G.statementToCode(b, 'DO')}}\n`;
  };
  G.forBlock['controls_whileUntil'] = function (b) {
    const hasta = b.getFieldValue('MODE') === 'UNTIL';
    let cond = G.valueToCode(b, 'BOOL', hasta ? O.UNARIO : O.NINGUNO) || 'false';
    if (hasta) cond = '!' + cond;
    return `while (${cond}) {\n${G.statementToCode(b, 'DO')}}\n`;
  };
  G.forBlock['controls_if'] = function (b) {
    let n = 0, code = '';
    do {
      const cond = G.valueToCode(b, 'IF' + n, O.NINGUNO) || 'false';
      code += (n > 0 ? ' else ' : '') + `if (${cond}) {\n${G.statementToCode(b, 'DO' + n)}}`;
      n++;
    } while (b.getInput('IF' + n));
    if (b.getInput('ELSE')) code += ` else {\n${G.statementToCode(b, 'ELSE')}}`;
    return code + '\n';
  };
  G.forBlock['logic_compare'] = function (b) {
    const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    const op = ops[b.getFieldValue('OP')];
    const ord = (op === '==' || op === '!=') ? O.IGUALDAD : O.RELACIONAL;
    return [`${G.valueToCode(b, 'A', ord) || '0'} ${op} ${G.valueToCode(b, 'B', ord) || '0'}`, ord];
  };
  G.forBlock['logic_operation'] = function (b) {
    const y = b.getFieldValue('OP') === 'AND';
    const ord = y ? O.Y_LOGICO : O.O_LOGICO;
    return [`${G.valueToCode(b, 'A', ord) || 'false'} ${y ? '&&' : '||'} ${G.valueToCode(b, 'B', ord) || 'false'}`, ord];
  };
  G.forBlock['logic_negate'] = (b) => ['!' + (G.valueToCode(b, 'BOOL', O.UNARIO) || 'true'), O.UNARIO];
  G.forBlock['logic_boolean'] = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMICO];
  G.forBlock['math_number'] = (b) => [String(Number(b.getFieldValue('NUM'))), O.ATOMICO];
  G.forBlock['math_arithmetic'] = function (b) {
    const t = { ADD: ['+', O.SUMA], MINUS: ['-', O.SUMA], MULTIPLY: ['*', O.MULT], DIVIDE: ['/', O.MULT], POWER: [null, O.ATOMICO] };
    const [op, ord] = t[b.getFieldValue('OP')];
    const a = G.valueToCode(b, 'A', ord) || '0';
    const c = G.valueToCode(b, 'B', ord) || '0';
    return op ? [`${a} ${op} ${c}`, ord] : [`pow(${a}, ${c})`, O.ATOMICO];
  };
  G.forBlock['variables_get'] = (b) => [G.getVariableName(b.getFieldValue('VAR')), O.ATOMICO];
  G.forBlock['variables_set'] = (b) => `${G.getVariableName(b.getFieldValue('VAR'))} = ${G.valueToCode(b, 'VALUE', O.NINGUNO) || '0'};\n`;
  G.forBlock['math_change'] = (b) => `${G.getVariableName(b.getFieldValue('VAR'))} += ${G.valueToCode(b, 'DELTA', O.SUMA) || '0'};\n`;

  G.init = function (workspace) {
    Object.getPrototypeOf(G).init.call(G, workspace);
    if (!G.nameDB_) G.nameDB_ = new Blockly.Names(G.RESERVED_WORDS_);
    else G.nameDB_.reset();
    G.nameDB_.setVariableMap(workspace.getVariableMap());
    G.nameDB_.populateVariables(workspace);
  };

  const BIBLIOTECA = `// ---------- Conexiones de DAVE (ver documentación del robot) ----------
// Puente H L9110S
const int MOTOR_IZQ_A = 5;   // PWM
const int MOTOR_IZQ_B = 7;
const int MOTOR_DER_A = 6;   // PWM
const int MOTOR_DER_B = 8;
// Sensor ultrasónico HC-SR04
const int ULTRASONIDO_TRIG = 9;
const int ULTRASONIDO_ECHO = 10;
// Sensores infrarrojos TCRT5000 (salida digital D0)
const int SENSOR_LINEA_IZQ = 2;
const int SENSOR_LINEA_DER = 3;
// Buzzer pasivo
const int BUZZER = 4;
// LEDs
const int LED_VERDE = 11;
const int LED_AMARILLO = 12;
const int LED_ROJO = 13;
const int LED_AZUL = A0;
const int LED_BLANCAS = A1;
// Botones (a GND, con resistencia de pull-up interna)
const int BOTON_1 = A2;
const int BOTON_2 = A3;
const int BOTON_3 = A4;

// ---------- Ajustes ----------
const int VELOCIDAD = 170;          // 0 a 255. Limita la tensión media que reciben los motores TT.
const bool INVERTIR_IZQ = false;    // Cambiar a true si el motor izquierdo gira al revés.
const bool INVERTIR_DER = false;    // Cambiar a true si el motor derecho gira al revés.
const int TONO_GRAVE = 262, TONO_MEDIO = 523, TONO_AGUDO = 1047;

enum Direccion { ADELANTE, ATRAS, IZQUIERDA, DERECHA };

void motor(int pinA, int pinB, int sentido, bool invertir) {
  if (invertir) sentido = -sentido;
  if (sentido > 0) { digitalWrite(pinB, LOW); analogWrite(pinA, VELOCIDAD); }
  else if (sentido < 0) { digitalWrite(pinB, HIGH); analogWrite(pinA, 255 - VELOCIDAD); }
  else { digitalWrite(pinB, LOW); digitalWrite(pinA, LOW); }
}

void mover(Direccion d) {
  int izq = 0, der = 0;
  if (d == ADELANTE) { izq = 1; der = 1; }
  if (d == ATRAS) { izq = -1; der = -1; }
  if (d == IZQUIERDA) { izq = -1; der = 1; }
  if (d == DERECHA) { izq = 1; der = -1; }
  motor(MOTOR_IZQ_A, MOTOR_IZQ_B, izq, INVERTIR_IZQ);
  motor(MOTOR_DER_A, MOTOR_DER_B, der, INVERTIR_DER);
}

void detener() {
  motor(MOTOR_IZQ_A, MOTOR_IZQ_B, 0, false);
  motor(MOTOR_DER_A, MOTOR_DER_B, 0, false);
}

void sonar(int frecuencia, long ms) {
  tone(BUZZER, frecuencia, ms);
  delay(ms);
}

int pinBoton(int n) { return n == 1 ? BOTON_1 : (n == 2 ? BOTON_2 : BOTON_3); }

bool botonPresionado(int n) { return digitalRead(pinBoton(n)) == LOW; }

// Número del botón apretado (1, 2 o 3), o 0 si no hay ninguno.
int botonPresionadoNumero() {
  for (int n = 1; n <= 3; n++) if (botonPresionado(n)) return n;
  return 0;
}

void esperarBoton(int n) {
  while (!botonPresionado(n)) { delay(10); }
  delay(50);                                   // evita rebotes
  while (botonPresionado(n)) { delay(10); }    // espera a que se suelte
}

long distanciaCm() {
  digitalWrite(ULTRASONIDO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIDO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIDO_TRIG, LOW);
  long duracion = pulseIn(ULTRASONIDO_ECHO, HIGH, 25000);
  if (duracion == 0) return 400;               // sin eco: nada al alcance
  return duracion / 58;
}

bool hayObstaculo(long cm) { return distanciaCm() < cm; }

// El módulo TCRT5000 entrega HIGH cuando no recibe reflejo (superficie negra).
bool veLinea(int pin) { return digitalRead(pin) == HIGH; }

void prepararDave() {
  int salidas[] = { MOTOR_IZQ_A, MOTOR_IZQ_B, MOTOR_DER_A, MOTOR_DER_B, ULTRASONIDO_TRIG, BUZZER,
                    LED_VERDE, LED_AMARILLO, LED_ROJO, LED_AZUL, LED_BLANCAS };
  for (int p : salidas) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }
  pinMode(ULTRASONIDO_ECHO, INPUT);
  pinMode(SENSOR_LINEA_IZQ, INPUT);
  pinMode(SENSOR_LINEA_DER, INPUT);
  pinMode(BOTON_1, INPUT_PULLUP);
  pinMode(BOTON_2, INPUT_PULLUP);
  pinMode(BOTON_3, INPUT_PULLUP);
}
`;

  /** Genera el sketch completo para el bloque de inicio indicado. */
  function generar(workspace, inicio, titulo) {
    G.init(workspace);
    // Bloques del programa principal, uno debajo del otro.
    const cadena = [];
    for (let b = inicio && inicio.getNextBlock(); b; b = b.getNextBlock()) cadena.push(b);
    // Si el programa termina con "repetir para siempre", su contenido va a
    // loop(), que Arduino repite solo; lo anterior va a setup(). Es la misma
    // estructura que el estudiante encontrará después en el IDE de Arduino.
    const ultimo = cadena[cadena.length - 1];
    const conLoop = !!(ultimo && ultimo.type === 'dave_siempre' && ultimo.isEnabled());
    const alInicio = (conLoop ? cadena.slice(0, -1) : cadena).map((b) => G.blockToCode(b, true)).join('');
    const repetido = conLoop ? G.statementToCode(ultimo, 'HACER') : '';
    const vars = workspace.getVariableMap().getAllVariables().map((v) => `float ${G.getVariableName(v.getId())} = 0;`);
    const sangria = (txt) => txt.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
    const sinFinal = (txt) => txt.replace(/\s+$/, '');
    return [
      '// Programa generado por MakerLab para el robot DAVE',
      titulo ? '// Lección: ' + titulo : null,
      '',
      BIBLIOTECA,
      vars.length ? '// ---------- Variables del programa ----------\n' + vars.join('\n') + '\n' : null,
      '// setup(): se ejecuta una vez, al encender el robot.',
      'void setup() {',
      '  prepararDave();',
      alInicio ? '  // ===== Tu programa =====' : null,
      alInicio ? sinFinal(sangria(alInicio)) : null,
      '}',
      '',
      '// loop(): se repite para siempre, después de setup().',
      'void loop() {',
      conLoop
        ? '  // ===== Lo que está dentro de "repetir para siempre" =====' + (repetido.trim() ? '\n' + sinFinal(repetido) : '')
        : '  // Vacío: el programa no usa "repetir para siempre" al final.',
      '}',
      '',
    ].filter((l) => l !== null).join('\n');
  }

  window.GeneradorArduino = { generar };
})();
