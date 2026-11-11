/* Definición de los bloques de MakerLab y armado de la caja de herramientas.
 *
 * Los bloques están en castellano y pensados para estudiantes que recién
 * empiezan. Cada lección indica qué bloques se habilitan, de modo que el
 * estudiante solo ve lo que ya aprendió más lo nuevo de esa clase.
 */
(function () {
  'use strict';

  const COLORES = {
    inicio: '#c9a227',
    movimiento: '#3a7bd5',
    tiempo: '#8e5bd1',
    control: '#e8772e',
    lucesSonido: '#c94f9b',
    sensores: '#1f9e99',
    logica: '#5b8c3a',
    numeros: '#5a6578',
    variables: '#d65a5a',
  };

  const DIRECCIONES = [
    ['⬆ avanzar', 'ADELANTE'],
    ['⬇ retroceder', 'ATRAS'],
    ['↺ girar a la izquierda', 'IZQUIERDA'],
    ['↻ girar a la derecha', 'DERECHA'],
  ];

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'dave_inicio',
      message0: '▶ Al iniciar el robot',
      nextStatement: null,
      colour: COLORES.inicio,
      tooltip: 'Todo lo que pongas debajo de este bloque es el programa de DAVE.',
      hat: 'cap',
    },
    {
      type: 'dave_paso',
      message0: '%1 un paso',
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECCIONES }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.movimiento,
      tooltip: 'DAVE se mueve durante 1 segundo y se detiene.',
    },
    {
      type: 'dave_mover',
      message0: '%1',
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECCIONES }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.movimiento,
      tooltip: 'Enciende los motores. DAVE sigue moviéndose hasta que lo detengas.',
    },
    {
      type: 'dave_detener',
      message0: '✋ detenerse',
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.movimiento,
      tooltip: 'Apaga los dos motores.',
    },
    {
      type: 'dave_esperar',
      message0: '⏱ esperar %1 segundos',
      args0: [{ type: 'field_number', name: 'SEG', value: 1, min: 0, max: 60, precision: 0.1 }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.tiempo,
      tooltip: 'El programa espera. Si los motores estaban encendidos, DAVE sigue moviéndose mientras espera.',
    },
    {
      type: 'dave_siempre',
      message0: '🔁 repetir para siempre %1 %2',
      args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'HACER' }],
      previousStatement: null,
      colour: COLORES.control,
      tooltip: 'Repite los bloques de adentro sin parar.',
    },
    // Decisiones: bloques fijos, sin el engranaje (mutador) de Blockly, para
    // que se usen arrastrando como cualquier otro bloque.
    {
      type: 'dave_si',
      message0: '❓ si %1 entonces',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: 'hacer %1',
      args1: [{ type: 'input_statement', name: 'HACER' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.control,
      tooltip: 'Si la condición se cumple, DAVE hace los bloques de adentro. Si no, los saltea.',
    },
    {
      type: 'dave_si_sino',
      message0: '❓ si %1 entonces',
      args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
      message1: 'hacer %1',
      args1: [{ type: 'input_statement', name: 'HACER' }],
      message2: 'si no %1',
      args2: [{ type: 'input_statement', name: 'SINO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.control,
      tooltip: 'Si la condición se cumple, DAVE hace los bloques de arriba; si no, los de abajo.',
    },
    {
      type: 'dave_segun',
      message0: '🔀 según el valor de %1',
      args0: [{ type: 'input_value', name: 'VALOR', check: 'Number' }],
      message1: 'cuando vale %1 %2',
      args1: [{ type: 'field_number', name: 'C1', value: 1, precision: 1 }, { type: 'input_statement', name: 'HACER1' }],
      message2: 'cuando vale %1 %2',
      args2: [{ type: 'field_number', name: 'C2', value: 2, precision: 1 }, { type: 'input_statement', name: 'HACER2' }],
      message3: 'cuando vale %1 %2',
      args3: [{ type: 'field_number', name: 'C3', value: 3, precision: 1 }, { type: 'input_statement', name: 'HACER3' }],
      message4: 'en cualquier otro caso %1',
      args4: [{ type: 'input_statement', name: 'OTRO' }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.control,
      tooltip: 'Elige qué hacer según un número: hace solo los bloques del caso que coincide. Si ninguno coincide, hace los de "en cualquier otro caso".',
    },
    {
      type: 'dave_led',
      message0: '💡 %1 %2',
      args0: [
        { type: 'field_dropdown', name: 'ACCION', options: [['encender', 'ON'], ['apagar', 'OFF']] },
        {
          type: 'field_dropdown', name: 'LED', options: [
            ['LED verde', 'VERDE'], ['LED amarillo', 'AMARILLO'], ['LED rojo', 'ROJO'],
            ['LED azul', 'AZUL'], ['luces blancas', 'BLANCAS'],
          ],
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.lucesSonido,
      tooltip: 'Prende o apaga una luz del robot.',
    },
    {
      type: 'dave_sonido',
      message0: '🔊 hacer sonar un tono %1 durante %2 segundos',
      args0: [
        { type: 'field_dropdown', name: 'TONO', options: [['grave', 'GRAVE'], ['medio', 'MEDIO'], ['agudo', 'AGUDO']] },
        { type: 'field_number', name: 'SEG', value: 0.5, min: 0.1, max: 10, precision: 0.1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.lucesSonido,
      tooltip: 'Hace sonar el buzzer.',
    },
    {
      type: 'dave_boton',
      message0: '🔘 botón %1 presionado',
      args0: [{ type: 'field_dropdown', name: 'BOTON', options: [['1', '1'], ['2', '2'], ['3', '3']] }],
      output: 'Boolean',
      colour: COLORES.sensores,
      tooltip: 'Es verdadero mientras el botón está apretado.',
    },
    {
      type: 'dave_boton_numero',
      message0: '🔘 número del botón presionado',
      output: 'Number',
      colour: COLORES.sensores,
      tooltip: 'Vale 1, 2 o 3 según el botón que esté apretado, y 0 si no hay ninguno.',
    },
    {
      type: 'dave_esperar_boton',
      message0: '⏳ esperar a que presionen el botón %1',
      args0: [{ type: 'field_dropdown', name: 'BOTON', options: [['1', '1'], ['2', '2'], ['3', '3']] }],
      previousStatement: null,
      nextStatement: null,
      colour: COLORES.sensores,
      tooltip: 'El programa se queda esperando hasta que alguien apriete el botón.',
    },
    {
      type: 'dave_distancia',
      message0: '📏 distancia al obstáculo (cm)',
      output: 'Number',
      colour: COLORES.sensores,
      tooltip: 'Lo que mide el sensor ultrasónico, en centímetros.',
    },
    {
      type: 'dave_obstaculo',
      message0: '🧱 hay un obstáculo a menos de %1 cm',
      args0: [{ type: 'field_number', name: 'CM', value: 20, min: 2, max: 300, precision: 1 }],
      output: 'Boolean',
      colour: COLORES.sensores,
      tooltip: 'Es verdadero si el sensor ultrasónico detecta algo más cerca que esa distancia.',
    },
    {
      type: 'dave_linea',
      message0: '〰 el sensor %1 ve la línea',
      args0: [{ type: 'field_dropdown', name: 'LADO', options: [['izquierdo', 'IZQ'], ['derecho', 'DER']] }],
      output: 'Boolean',
      colour: COLORES.sensores,
      tooltip: 'Es verdadero si el sensor infrarrojo está sobre la línea negra.',
    },
  ]);

  // Tema: los bloques estándar de Blockly toman los colores de MakerLab.
  const tema = Blockly.Theme.defineTheme('makerlab', {
    base: Blockly.Themes.Classic,
    blockStyles: {
      loop_blocks: { colourPrimary: COLORES.control },
      logic_blocks: { colourPrimary: COLORES.logica },
      math_blocks: { colourPrimary: COLORES.numeros },
      variable_blocks: { colourPrimary: COLORES.variables },
    },
    componentStyles: {
      workspaceBackgroundColour: '#fbfaf7',
      toolboxBackgroundColour: '#ffffff',
      toolboxForegroundColour: '#1d2433',
      flyoutBackgroundColour: '#eeebe3',
      flyoutOpacity: 1,
      scrollbarColour: '#c9c3b5',
    },
    fontStyle: { family: '"Segoe UI", system-ui, Arial, sans-serif', weight: '600', size: 12 },
    startHats: true,
  });

  // Catálogo de bloques por categoría, en el orden en que aparecen.
  const num = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
  const CATALOGO = [
    { nombre: 'Movimiento', color: COLORES.movimiento, bloques: [
      { type: 'dave_paso' }, { type: 'dave_mover' }, { type: 'dave_detener' },
    ] },
    { nombre: 'Tiempo', color: COLORES.tiempo, bloques: [{ type: 'dave_esperar' }] },
    { nombre: 'Repetir y decidir', color: COLORES.control, bloques: [
      { type: 'controls_repeat_ext', inputs: { TIMES: num(4) } },
      { type: 'dave_siempre' },
      { type: 'controls_whileUntil' },
      { type: 'dave_si' },
      { type: 'dave_si_sino' },
      { type: 'dave_segun' },
    ] },
    { nombre: 'Luces y sonido', color: COLORES.lucesSonido, bloques: [
      { type: 'dave_led' }, { type: 'dave_sonido' },
    ] },
    { nombre: 'Sensores', color: COLORES.sensores, bloques: [
      { type: 'dave_esperar_boton' }, { type: 'dave_boton' }, { type: 'dave_boton_numero' }, { type: 'dave_obstaculo' },
      { type: 'dave_distancia' }, { type: 'dave_linea' },
    ] },
    { nombre: 'Lógica', color: COLORES.logica, bloques: [
      { type: 'logic_compare' }, { type: 'logic_operation' }, { type: 'logic_negate' }, { type: 'logic_boolean' },
    ] },
    { nombre: 'Números', color: COLORES.numeros, bloques: [
      { type: 'math_number' }, { type: 'math_arithmetic', inputs: { A: num(1), B: num(1) } },
    ] },
  ];

  /**
   * Arma la caja de herramientas con los bloques que habilita la lección.
   * Un bloque se habilita si su tipo figura en `permitidos`. La palabra
   * "variables" habilita la categoría de variables.
   */
  function construirCajaHerramientas(permitidos) {
    // Lecciones escritas antes de los bloques de decisión fijos: "controls_if"
    // habilita "si" y "controls_if_else" habilita "si / si no".
    const EQUIVALENTES = { controls_if: 'dave_si', controls_if_else: 'dave_si_sino' };
    const ok = new Set(permitidos.map((b) => EQUIVALENTES[b] || b));
    const contenidos = [];
    for (const cat of CATALOGO) {
      const bloques = cat.bloques
        .filter((b) => ok.has(b.type))
        .map((b) => Object.assign({ kind: 'block' }, b));
      if (bloques.length) contenidos.push({ kind: 'category', name: cat.nombre, colour: cat.color, contents: bloques });
    }
    if (ok.has('variables')) {
      contenidos.push({ kind: 'category', name: 'Variables', colour: COLORES.variables, custom: 'VARIABLE' });
    }
    return { kind: 'categoryToolbox', contents: contenidos };
  }

  // Casos del bloque "según": un valor repetido solo cuenta la primera vez
  // (en C++ dos "case" iguales no compilan).
  function casosSegun(bloque) {
    const vistos = new Set(), casos = [];
    [1, 2, 3].forEach((i) => {
      const v = Math.trunc(Number(bloque.getFieldValue('C' + i)));
      if (!vistos.has(v)) { vistos.add(v); casos.push([v, 'HACER' + i]); }
    });
    return casos;
  }

  window.Bloques = { tema, construirCajaHerramientas, COLORES, casosSegun };
})();
