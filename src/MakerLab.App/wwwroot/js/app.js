/* Lógica principal de la interfaz de MakerLab. */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const estado = {
    lecciones: [],
    actual: null,
    programas: {},         // programa de cada lección mientras la app está abierta
  };

  // ---------- Editor de bloques ----------
  const espacio = Blockly.inject('blockly', {
    toolbox: Bloques.construirCajaHerramientas([]),
    theme: Bloques.tema,
    media: 'lib/blockly/media/',
    renderer: 'zelos',
    trashcan: true,
    zoom: { controls: true, wheel: true, startScale: 1, maxScale: 2, minScale: 0.4 },
    grid: { spacing: 24, length: 2, colour: '#e3dfd3', snap: true },
    move: { scrollbars: true, drag: true, wheel: false },
  });
  espacio.addChangeListener(Blockly.Events.disableOrphans);

  // Selección de varios bloques (Mayús + clic o Mayús + arrastrar): ver seleccion.js
  const seleccion = SeleccionMultiple.activar(espacio, document.querySelector('.editor'));

  let temporizador = null;
  espacio.addChangeListener((e) => {
    if (e.isUiEvent) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      actualizarCodigo();
      guardarBorrador();
    }, 250);
  });

  function bloqueInicio() {
    return espacio.getTopBlocks(true).find((b) => b.type === 'dave_inicio') || null;
  }

  function asegurarInicio() {
    let inicio = bloqueInicio();
    if (!inicio) {
      inicio = espacio.newBlock('dave_inicio');
      inicio.initSvg(); inicio.render();
      inicio.moveBy(40, 40);
    }
    inicio.setDeletable(false);
    return inicio;
  }

  function codigoArduino() {
    return GeneradorArduino.generar(espacio, bloqueInicio(), estado.actual && estado.actual.titulo);
  }

  function actualizarCodigo() {
    $('#codigo').textContent = codigoArduino();
  }

  // ---------- Simulador ----------
  let avisoTimer = null;
  const sim = new Simulador($('#lienzo'), {
    alResaltar: (id) => espacio.highlightBlock(id),
    alCambiarLeds: (leds) => {
      document.querySelectorAll('.led').forEach((el) => {
        el.classList.toggle('on', !!leds[el.dataset.led.toUpperCase()]);
      });
    },
    alSonar: (on) => $('#buzzer').classList.toggle('on', on),
    alLecturas: (l) => {
      $('#lecDist').textContent = l.distancia >= 400 ? 'sin obstáculo' : l.distancia + ' cm';
      $('#lecLinea').textContent = 'Izq. ' + (l.lineaIzq ? '●' : '○') + '   Der. ' + (l.lineaDer ? '●' : '○');
      $('#lecTiempo').textContent = l.tiempo.toFixed(1).replace('.', ',') + ' s';
    },
    alAviso: (texto, tipo) => mostrarAviso(texto, tipo),
    alTerminar: (r) => {
      botonesEjecucion(false);
      if (r && r.error) return;
      const meta = estado.actual && estado.actual.escenario && estado.actual.escenario.meta;
      if (meta && !sim.logrado && !sim.chocado) mostrarAviso('El programa terminó, pero DAVE no llegó a la meta. ¡Probá de nuevo!', 'info');
      else if (!meta && !sim.chocado && r && r.motoresEncendidos) mostrarAviso('El programa terminó y los motores siguen encendidos', 'info');
      else if (!meta && !sim.chocado) mostrarAviso('Programa terminado', 'info');
    },
  });

  function mostrarAviso(texto, tipo) {
    const el = $('#aviso');
    clearTimeout(avisoTimer);
    if (!texto) { el.hidden = true; return; }
    el.textContent = texto;
    el.className = 'aviso ' + (tipo || '');
    el.hidden = false;
    if (tipo !== 'exito') avisoTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function botonesEjecucion(corriendo) {
    $('#btnEjecutar').disabled = corriendo;
    $('#btnDetener').disabled = !corriendo;
  }

  function ejecutar() {
    if (!bloqueInicio()) return;
    const codigo = GeneradorSimulador.generar(espacio, bloqueInicio());
    botonesEjecucion(true);
    sim.ejecutar(codigo);
  }

  // ---------- Lecciones ----------
  async function cargarLecciones() {
    try {
      estado.lecciones = (await Puente.listarLecciones()).sort((a, b) => (a.orden || 999) - (b.orden || 999));
    } catch (e) {
      mensaje('No se pudieron cargar las lecciones', e.message);
      estado.lecciones = [];
    }
    const sel = $('#selLeccion');
    sel.innerHTML = '';
    estado.lecciones.forEach((l, i) => {
      const op = document.createElement('option');
      op.value = l.id;
      op.textContent = `${i + 1}. ${l.titulo}${l.origen === 'importada' ? ' (importada)' : ''}`;
      sel.appendChild(op);
    });
    let inicial = null;
    try { inicial = localStorage.getItem('makerlab.leccion'); } catch (e) { /* sin almacenamiento */ }
    const leccion = estado.lecciones.find((l) => l.id === inicial) || estado.lecciones[0];
    if (leccion) seleccionarLeccion(leccion.id);
  }

  function seleccionarLeccion(id, programa) {
    const leccion = estado.lecciones.find((l) => l.id === id);
    if (!leccion) return;
    if (estado.actual) estado.programas[estado.actual.id] = Blockly.serialization.workspaces.save(espacio);
    estado.actual = leccion;
    $('#selLeccion').value = id;
    try { localStorage.setItem('makerlab.leccion', id); } catch (e) { /* sin almacenamiento */ }

    const i = estado.lecciones.indexOf(leccion);
    $('#lecNivel').textContent = `Lección ${i + 1} de ${estado.lecciones.length}`;
    $('#lecTitulo').textContent = leccion.titulo;
    $('#lecConsigna').textContent = leccion.consigna || '';
    const pistas = $('#lecPistas');
    pistas.hidden = !(leccion.pistas && leccion.pistas.length);
    pistas.open = false;
    pistas.querySelector('ol').innerHTML = '';
    (leccion.pistas || []).forEach((p) => {
      const li = document.createElement('li'); li.textContent = p; pistas.querySelector('ol').appendChild(li);
    });

    espacio.updateToolbox(Bloques.construirCajaHerramientas(leccion.bloques || []));
    mostrarComponentes(leccion.bloques || []);
    espacio.clear();
    const guardado = programa || estado.programas[id] || leerBorrador(id) || leccion.programaInicial;
    try {
      if (guardado) Blockly.serialization.workspaces.load(guardado, espacio);
    } catch (e) {
      console.warn('No se pudo cargar el programa guardado', e);
      espacio.clear();
    }
    asegurarInicio();
    espacio.clearUndo();   // Ctrl+Z no debe traer bloques de la lección anterior
    espacio.scrollCenter();
    sim.cargarEscenario(leccion.escenario || {});
    botonesEjecucion(false);
    actualizarCodigo();
  }

  // En el tablero solo se muestran los componentes que la lección usa:
  // en las primeras lecciones, únicamente el reloj y la velocidad.
  const COMPONENTES = {
    led: ['dave_led'],
    sonido: ['dave_sonido'],
    boton: ['dave_boton', 'dave_esperar_boton'],
    distancia: ['dave_distancia', 'dave_obstaculo'],
    linea: ['dave_linea'],
  };
  function mostrarComponentes(bloques) {
    document.querySelectorAll('.grupo[data-comp]').forEach((g) => {
      g.hidden = !COMPONENTES[g.dataset.comp].some((b) => bloques.includes(b));
    });
  }

  // ---------- Tamaño de la interfaz ----------
  // A−/A+ cambian el tamaño base del texto (toda la interfaz está en rem)
  // y, en la misma proporción, la escala del área de bloques.
  const TAMANOS = [14, 16, 18, 20, 22, 24];
  let tamano = 16;
  try { tamano = Number(localStorage.getItem('makerlab.tamano')) || 16; } catch (e) { /* sin almacenamiento */ }
  function aplicarTamano(nuevo) {
    const anterior = tamano;
    tamano = Math.min(TAMANOS[TAMANOS.length - 1], Math.max(TAMANOS[0], nuevo));
    document.documentElement.style.fontSize = tamano + 'px';
    if (anterior !== tamano) espacio.setScale(Math.min(2, Math.max(0.4, espacio.scale * tamano / anterior)));
    $('#btnAchicar').disabled = tamano === TAMANOS[0];
    $('#btnAgrandar').disabled = tamano === TAMANOS[TAMANOS.length - 1];
    requestAnimationFrame(() => {
      const caja = espacio.getToolbox && espacio.getToolbox();
      if (caja && caja.position) caja.position();
      Blockly.svgResize(espacio);
      espacio.resize();
      if (anterior !== tamano) espacio.scrollCenter();
    });
    try { localStorage.setItem('makerlab.tamano', String(tamano)); } catch (e) { /* sin almacenamiento */ }
  }
  function cambiarTamano(paso) {
    const i = TAMANOS.indexOf(tamano);
    aplicarTamano(TAMANOS[Math.min(TAMANOS.length - 1, Math.max(0, (i < 0 ? 1 : i) + paso))]);
  }

  // Borrador automático por lección (se conserva al cerrar la app).
  function guardarBorrador() {
    if (!estado.actual) return;
    try {
      localStorage.setItem('makerlab.borrador.' + estado.actual.id, JSON.stringify(Blockly.serialization.workspaces.save(espacio)));
    } catch (e) { /* sin almacenamiento: no es grave */ }
  }
  function leerBorrador(id) {
    try { const t = localStorage.getItem('makerlab.borrador.' + id); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }

  // ---------- Proyectos ----------
  async function guardarProyecto() {
    const proyecto = {
      formato: 'makerlab-proyecto', version: 1,
      leccion: estado.actual && estado.actual.id,
      fecha: new Date().toISOString(),
      bloques: Blockly.serialization.workspaces.save(espacio),
    };
    try {
      const r = await Puente.guardarProyecto(`${(estado.actual && estado.actual.id) || 'proyecto'}.makerlab`, JSON.stringify(proyecto, null, 2));
      if (r && r.ruta) mostrarAviso('Proyecto guardado', 'exito');
    } catch (e) { mensaje('No se pudo guardar', e.message); }
  }

  async function abrirProyecto() {
    try {
      const r = await Puente.abrirProyecto();
      if (!r) return;
      const p = JSON.parse(r.contenido);
      if (p.formato !== 'makerlab-proyecto') throw new Error('El archivo no es un proyecto de MakerLab.');
      const id = estado.lecciones.some((l) => l.id === p.leccion) ? p.leccion : estado.actual.id;
      seleccionarLeccion(id, p.bloques);
    } catch (e) { mensaje('No se pudo abrir el proyecto', e.message); }
  }

  // ---------- Envío al robot ----------
  async function buscarPuertos() {
    const sel = $('#selPuerto');
    sel.innerHTML = '<option>Buscando…</option>';
    try {
      const puertos = await Puente.listarPuertos();
      sel.innerHTML = '';
      if (!puertos.length) sel.innerHTML = '<option value="">No se encontró ninguna placa. ¿Está conectado el cable?</option>';
      puertos.forEach((p) => {
        const op = document.createElement('option');
        op.value = p.puerto; op.textContent = p.puerto + (p.placa ? ' — ' + p.placa : '');
        sel.appendChild(op);
      });
    } catch (e) {
      sel.innerHTML = '<option value="">—</option>';
      $('#logEnvio').textContent = e.message;
    }
  }

  async function abrirEnvio() {
    $('#logEnvio').textContent = '';
    $('#dlgEnviar').showModal();
    if (!Puente.esEscritorio) {
      $('#logEnvio').textContent = 'Para enviar el programa al robot hay que usar la aplicación de escritorio de MakerLab.';
      return;
    }
    await buscarPuertos();
  }

  async function confirmarEnvio() {
    const puerto = $('#selPuerto').value;
    if (!puerto) return;
    const log = $('#logEnvio');
    log.textContent = 'Preparando el programa…\n';
    $('#btnConfirmarEnvio').disabled = true;
    try {
      await Puente.enviarAlRobot(codigoArduino(), puerto);
      log.textContent += '\n✔ ¡Listo! El programa ya está en DAVE. Desconectá el cable y encendé el robot.';
    } catch (e) {
      log.textContent += '\n✖ ' + e.message;
    } finally {
      $('#btnConfirmarEnvio').disabled = false;
    }
  }
  Puente.alRecibir('robot.progreso', (linea) => {
    const log = $('#logEnvio');
    log.textContent += linea + '\n';
    log.scrollTop = log.scrollHeight;
  });

  // ---------- Mensajes ----------
  function mensaje(titulo, texto) {
    $('#msgTitulo').textContent = titulo;
    $('#msgTexto').textContent = texto;
    $('#dlgMensaje').showModal();
  }

  // ---------- Eventos de la interfaz ----------
  $('#btnEjecutar').addEventListener('click', ejecutar);
  $('#btnDetener').addEventListener('click', () => { sim.detener(); botonesEjecucion(false); });
  $('#btnReiniciar').addEventListener('click', () => { sim.reiniciar(); botonesEjecucion(false); espacio.highlightBlock(null); });
  $('#btnEnviar').addEventListener('click', abrirEnvio);
  $('#btnBuscarPuertos').addEventListener('click', buscarPuertos);
  $('#btnConfirmarEnvio').addEventListener('click', confirmarEnvio);
  $('#btnGuardar').addEventListener('click', guardarProyecto);
  $('#btnAbrir').addEventListener('click', abrirProyecto);
  $('#selLeccion').addEventListener('change', (e) => seleccionarLeccion(e.target.value));
  $('#btnAchicar').addEventListener('click', () => cambiarTamano(-1));
  $('#btnAgrandar').addEventListener('click', () => cambiarTamano(1));
  $('#selVelocidad').addEventListener('change', (e) => { sim.factor = Number(e.target.value); });

  document.querySelectorAll('.pestana').forEach((p) => p.addEventListener('click', () => {
    document.querySelectorAll('.pestana').forEach((q) => {
      q.classList.toggle('activa', q === p); q.setAttribute('aria-selected', q === p);
    });
    $('#vistaSim').hidden = p.dataset.pestana !== 'sim';
    $('#vistaCodigo').hidden = p.dataset.pestana !== 'codigo';
  }));

  document.querySelectorAll('.boton-robot').forEach((b) => {
    const poner = (v) => { sim.botones[b.dataset.boton] = v; b.classList.toggle('presionado', v); };
    b.addEventListener('pointerdown', () => poner(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => poner(false)));
  });

  const menu = $('#menu');
  $('#btnMenu').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.addEventListener('click', async (e) => {
    const accion = e.target.dataset.accion;
    try {
      if (accion === 'importar') {
        const r = await Puente.importarLeccion();
        if (r) { await cargarLecciones(); seleccionarLeccion(r.id); mostrarAviso('Lección importada', 'exito'); }
      } else if (accion === 'carpeta') {
        await Puente.abrirCarpetaLecciones();
      } else if (accion === 'acerca') {
        const info = await Puente.info();
        mensaje('MakerLab', `Versión ${info.version}. Entorno de programación por bloques y simulación para el robot educativo DAVE. Funciona sin conexión a internet.`);
      }
    } catch (err) { mensaje('No se pudo completar la acción', err.message); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F5') { e.preventDefault(); if (!$('#btnEjecutar').disabled) ejecutar(); }
  });

  // Tamaño guardado: se aplica al abrir; los bloques se escalan en la misma proporción.
  (function () { const t = tamano; tamano = 16; document.documentElement.style.fontSize = t + 'px'; aplicarTamano(t); })();

  window.MakerLab = { espacio, sim, estado, seleccionarLeccion, ejecutar, codigoArduino };
  cargarLecciones();
})();
