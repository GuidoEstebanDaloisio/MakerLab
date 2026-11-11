/* Generador de código para el simulador.
 *
 * Usa el generador de JavaScript de Blockly. Cada acción del robot se
 * traduce a una llamada asíncrona (await robot.xxx()) para que el
 * simulador pueda animar el movimiento y respetar las esperas.
 * Antes de cada bloque se llama a robot.resaltar(id) para iluminar el
 * bloque que se está ejecutando.
 */
(function () {
  'use strict';

  const J = javascript.javascriptGenerator;
  const Ord = javascript.Order;

  J.STATEMENT_PREFIX = 'await robot.resaltar(%1);\n';
  J.INFINITE_LOOP_TRAP = 'await robot.tick();\n';
  J.addReservedWords('robot');

  J.forBlock['dave_inicio'] = () => '';
  J.forBlock['dave_paso'] = (b) => `await robot.paso('${b.getFieldValue('DIR')}');\n`;
  J.forBlock['dave_mover'] = (b) => `robot.mover('${b.getFieldValue('DIR')}');\n`;
  J.forBlock['dave_detener'] = () => 'robot.detener();\n';
  J.forBlock['dave_esperar'] = (b) => `await robot.esperar(${Number(b.getFieldValue('SEG'))});\n`;
  J.forBlock['dave_siempre'] = function (b, g) {
    const rama = g.addLoopTrap(g.statementToCode(b, 'HACER'), b);
    return `while (true) {\n${rama}}\n`;
  };
  J.forBlock['dave_si'] = (b, g) => `if (${g.valueToCode(b, 'COND', Ord.NONE) || 'false'}) {\n${g.statementToCode(b, 'HACER')}}\n`;
  J.forBlock['dave_si_sino'] = (b, g) => `if (${g.valueToCode(b, 'COND', Ord.NONE) || 'false'}) {\n${g.statementToCode(b, 'HACER')}} else {\n${g.statementToCode(b, 'SINO')}}\n`;
  J.forBlock['dave_segun'] = function (b, g) {
    const valor = g.valueToCode(b, 'VALOR', Ord.NONE) || '0';
    let code = `switch (Math.trunc(Number(${valor}))) {\n`;
    Bloques.casosSegun(b).forEach(([v, nombre]) => { code += `  case ${v}: {\n${g.prefixLines(g.statementToCode(b, nombre), '  ')}    break;\n  }\n`; });
    return code + `  default: {\n${g.prefixLines(g.statementToCode(b, 'OTRO'), '  ')}  }\n}\n`;
  };
  J.forBlock['dave_boton_numero'] = () => ['robot.botonNumero()', Ord.FUNCTION_CALL];
  J.forBlock['dave_led'] = (b) => `robot.led('${b.getFieldValue('LED')}', ${b.getFieldValue('ACCION') === 'ON'});\n`;
  J.forBlock['dave_sonido'] = (b) => `await robot.sonar('${b.getFieldValue('TONO')}', ${Number(b.getFieldValue('SEG'))});\n`;
  J.forBlock['dave_esperar_boton'] = (b) => `await robot.esperarBoton(${b.getFieldValue('BOTON')});\n`;
  J.forBlock['dave_boton'] = (b) => [`robot.boton(${b.getFieldValue('BOTON')})`, Ord.FUNCTION_CALL];
  J.forBlock['dave_distancia'] = () => ['robot.distancia()', Ord.FUNCTION_CALL];
  J.forBlock['dave_obstaculo'] = (b) => [`robot.hayObstaculo(${Number(b.getFieldValue('CM'))})`, Ord.FUNCTION_CALL];
  J.forBlock['dave_linea'] = (b) => [`robot.veLinea('${b.getFieldValue('LADO')}')`, Ord.FUNCTION_CALL];


  function generar(workspace, inicio) {
    J.init(workspace);
    const cuerpo = inicio ? J.blockToCode(inicio) : '';
    return J.finish(cuerpo);
  }

  window.GeneradorSimulador = { generar };
})();
