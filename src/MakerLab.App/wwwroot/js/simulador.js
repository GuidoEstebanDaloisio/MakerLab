/* Simulador 2D de DAVE.
 *
 * Modela el robot visto desde arriba sobre una pista medida en centímetros.
 * - Tracción diferencial: dos motores (izquierdo y derecho) que pueden ir
 *   hacia adelante, hacia atrás o estar detenidos.
 * - Sensor ultrasónico: mide la distancia al obstáculo más cercano en un
 *   cono de unos 15° hacia el frente (como el HC-SR04).
 * - Dos sensores infrarrojos de línea en la parte delantera.
 * - LEDs, buzzer y tres botones (estos últimos se presionan con el mouse).
 *
 * El reloj del simulador avanza solo cuando se dibuja un cuadro, por lo que
 * los tiempos del programa (esperar 1 segundo) son exactos aunque la
 * computadora sea lenta: en una máquina lenta la animación se ve más
 * entrecortada, pero el robot recorre la misma distancia.
 */
(function () {
  'use strict';

  const VEL_LINEAL = 20;                 // cm/s con los dos motores hacia adelante
  const VEL_GIRO = Math.PI / 2;          // rad/s girando en el lugar (90° por segundo)
  const RADIO_ROBOT = 9;                 // cm (para choques)
  const LARGO = 16, ANCHO = 14;          // cm (para el dibujo)
  const ALCANCE_ULTRASONIDO = 400;       // cm
  const PASO_MAX = 1 / 120;              // s de simulación por subpaso
  const FRECUENCIAS = { GRAVE: 262, MEDIO: 523, AGUDO: 1047 };

  class Detenido extends Error { constructor() { super('Programa detenido'); this.name = 'Detenido'; } }

  class Simulador {
    constructor(lienzo, eventos) {
      this.lienzo = lienzo;
      this.ctx = lienzo.getContext('2d');
      this.ev = eventos || {};
      this.factor = 1;
      this.botones = { 1: false, 2: false, 3: false };
      this.audio = null;
      this.cargarEscenario({});
      this._ultimo = performance.now();
      const bucle = (ahora) => {
        const dt = Math.min(0.1, (ahora - this._ultimo) / 1000);
        this._ultimo = ahora;
        this._actualizar(dt);
        this._dibujar();
        requestAnimationFrame(bucle);
      };
      requestAnimationFrame(bucle);
    }

    // ---------- Escenario ----------
    cargarEscenario(esc) {
      this.esc = Object.assign({
        ancho: 320, alto: 210,
        robot: { x: 40, y: 105, angulo: 0 },
        obstaculos: [], lineas: [], marcas: [], meta: null, anchoLinea: 3,
      }, esc || {});
      this.escala = this.lienzo.width / this.esc.ancho;
      this.lienzo.height = Math.round(this.esc.alto * this.escala);
      this.reiniciar();
    }

    reiniciar() {
      this.detener();
      const r = this.esc.robot;
      this.x = r.x; this.y = r.y; this.ang = (r.angulo || 0) * Math.PI / 180;
      this.motores = { izq: 0, der: 0 };
      this.leds = { VERDE: false, AMARILLO: false, ROJO: false, AZUL: false, BLANCAS: false };
      this.rastro = [[this.x, this.y]];
      this.t = 0;
      this.tPrograma = 0;      // tiempo que mostró el reloj al terminar el programa
      this.chocado = false;
      this.logrado = false;
      this._emitirLeds();
      this._emitir('alAviso', null);
      this._emitirLecturas();
    }

    // ---------- Ejecución del programa ----------
    async ejecutar(codigo) {
      this.reiniciar();
      this.ejecutando = true;
      this.abortado = false;
      this.esperas = [];
      this.ticks = [];
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const programa = new AsyncFunction('robot', codigo);
      try {
        const api = this._api();
        await programa(api);
        // En DAVE, cuando terminan las instrucciones la placa sigue funcionando
        // (loop() queda vacío) y los motores que quedaron encendidos siguen
        // girando. El simulador hace lo mismo: el programa sigue "en marcha"
        // hasta que DAVE choca, llega a una meta de paso o se presiona Detener.
        while ((this.motores.izq || this.motores.der) && !this.chocado && !this.logrado) await api.tick();
        if (this.motores.izq === 0 && this.motores.der === 0) this._verificarMeta();
        this._emitir('alTerminar', { motoresEncendidos: this.motores.izq !== 0 || this.motores.der !== 0 });
      } catch (e) {
        if (!(e instanceof Detenido)) {
          this._emitir('alAviso', 'Error en el programa: ' + e.message, 'error');
          this._emitir('alTerminar', { error: e });
        }
      } finally {
        this.tPrograma = this.t;
        this.ejecutando = false;
        this._emitir('alResaltar', null);
        this._emitirLecturas();
      }
    }

    detener() {
      if (this.ejecutando) {
        this.tPrograma = this.t;
        this.abortado = true;
        const pendientes = (this.esperas || []).concat(this.ticks || []);
        this.esperas = []; this.ticks = [];
        pendientes.forEach((w) => w.rechazar(new Detenido()));
      }
      if (this.motores) this.motores = { izq: 0, der: 0 };
      this._sonido(false);
    }

    _api() {
      const sim = this;
      const vivo = () => { if (sim.abortado) throw new Detenido(); };
      const esperar = (seg) => new Promise((resolver, rechazar) => {
        sim.esperas.push({ hasta: sim.t + Math.max(0, seg), resolver, rechazar });
      });
      const tick = () => new Promise((resolver, rechazar) => sim.ticks.push({ resolver, rechazar }));
      const MOTORES = { ADELANTE: [1, 1], ATRAS: [-1, -1], IZQUIERDA: [-1, 1], DERECHA: [1, -1] };
      return {
        resaltar(id) { vivo(); sim._emitir('alResaltar', id); },
        tick() { vivo(); return tick(); },
        mover(dir) { vivo(); const [i, d] = MOTORES[dir]; sim.motores = { izq: i, der: d }; },
        detener() { vivo(); sim.motores = { izq: 0, der: 0 }; sim._verificarMeta(); },
        async paso(dir) { this.mover(dir); await esperar(1); vivo(); sim.motores = { izq: 0, der: 0 }; sim._verificarMeta(); },
        async esperar(seg) { vivo(); await esperar(seg); vivo(); },
        led(cual, encendido) { vivo(); sim.leds[cual] = encendido; sim._emitirLeds(); },
        async sonar(tono, seg) {
          vivo(); sim._sonido(true, FRECUENCIAS[tono], seg / sim.factor);
          try { await esperar(seg); } finally { sim._sonido(false); }
          vivo();
        },
        boton(n) { vivo(); return !!sim.botones[n]; },
        botonNumero() { vivo(); return [1, 2, 3].find((n) => sim.botones[n]) || 0; },
        async esperarBoton(n) {
          while (!sim.botones[n]) { vivo(); await tick(); }
          while (sim.botones[n]) { vivo(); await tick(); }
        },
        distancia() { vivo(); return sim.medirDistancia(); },
        hayObstaculo(cm) { vivo(); return sim.medirDistancia() < cm; },
        veLinea(lado) { vivo(); return sim.sensorLinea(lado); },
      };
    }

    // ---------- Física ----------
    _actualizar(dtReal) {
      let restante = dtReal * this.factor;
      let corte = false;
      while (restante > 1e-9 && !corte) {
        let paso = Math.min(restante, PASO_MAX);
        const proxima = this._proximaEspera();
        if (proxima !== null) paso = Math.min(paso, Math.max(0, proxima - this.t));
        const yaChocado = this.chocado;
        this._mover(paso);
        this.t += paso;
        restante -= paso;
        // Un choque corta el cuadro, para que el programa (y el reloj) se
        // enteren en el mismo instante aunque la simulación vaya acelerada.
        if (this.chocado && !yaChocado) corte = true;
        if (proxima !== null && this.t >= proxima - 1e-9) {
          // Una espera terminó: se corta el cuadro para que el programa
          // reaccione (por ejemplo, apague los motores) antes de seguir.
          this._resolverEsperas();
          corte = true;
        }
      }
      if (this.ticks && this.ticks.length) {
        const t = this.ticks; this.ticks = [];
        t.forEach((w) => w.resolver());
      }
      this._emitirLecturas();
    }

    _proximaEspera() {
      if (!this.esperas || !this.esperas.length) return null;
      return Math.min(...this.esperas.map((w) => w.hasta));
    }

    _resolverEsperas() {
      const listas = this.esperas.filter((w) => w.hasta <= this.t + 1e-9);
      this.esperas = this.esperas.filter((w) => w.hasta > this.t + 1e-9);
      listas.forEach((w) => w.resolver());
    }

    _mover(dt) {
      const { izq, der } = this.motores;
      if (!izq && !der) return;
      const v = (izq + der) / 2 * VEL_LINEAL;
      const w = (der - izq) / 2 * VEL_GIRO;    // positivo: gira a la izquierda
      const ang = this.ang - w * dt;           // en pantalla el eje Y apunta hacia abajo
      const nx = this.x + Math.cos(ang) * v * dt;
      const ny = this.y + Math.sin(ang) * v * dt;
      if (this._colisiona(nx, ny)) {
        if (!this.chocado) {
          this.chocado = true;
          const r = RADIO_ROBOT, borde = nx < r || ny < r || nx > this.esc.ancho - r || ny > this.esc.alto - r;
          this._emitir('alAviso', borde ? '¡Choque! DAVE llegó al borde de la pista' : '¡Choque! DAVE tocó un obstáculo', 'error');
          this._emitir('alChocar');
        }
        this.ang = ang; // puede seguir girando, pero no atravesar
        return;
      }
      this.x = nx; this.y = ny; this.ang = ang;
      const ult = this.rastro[this.rastro.length - 1];
      if (Math.hypot(nx - ult[0], ny - ult[1]) > 0.8) this.rastro.push([nx, ny]);
      if (this.esc.meta && !this.esc.meta.detenerse) this._verificarMeta();
    }

    /** Comprueba si DAVE está en la meta. Si la meta pide detenerse, se
     *  llama cuando los motores se apagan o cuando termina el programa. */
    _verificarMeta() {
      const m = this.esc.meta;
      if (!m || this.logrado || this.chocado) return;
      if (Math.hypot(this.x - m.x, this.y - m.y) <= (m.radio || 12)) {
        this.logrado = true;
        this._emitir('alAviso', m.detenerse ? '¡Lo lograste! DAVE se detuvo en la meta' : '¡Lo lograste! DAVE llegó a la meta', 'exito');
        this._emitir('alLograr');
      }
    }

    _colisiona(x, y) {
      const r = RADIO_ROBOT;
      if (x < r || y < r || x > this.esc.ancho - r || y > this.esc.alto - r) return true;
      return this.esc.obstaculos.some((o) => {
        const cx = Math.max(o.x, Math.min(x, o.x + o.ancho));
        const cy = Math.max(o.y, Math.min(y, o.y + o.alto));
        return Math.hypot(x - cx, y - cy) < r;
      });
    }

    _ocupado(x, y) {
      if (x < 0 || y < 0 || x > this.esc.ancho || y > this.esc.alto) return true;
      return this.esc.obstaculos.some((o) => x >= o.x && x <= o.x + o.ancho && y >= o.y && y <= o.y + o.alto);
    }

    medirDistancia() {
      const sx = this.x + Math.cos(this.ang) * (LARGO / 2);
      const sy = this.y + Math.sin(this.ang) * (LARGO / 2);
      let minimo = ALCANCE_ULTRASONIDO;
      for (const desvio of [-7.5, 0, 7.5]) {
        const a = this.ang + desvio * Math.PI / 180;
        const cos = Math.cos(a), sin = Math.sin(a);
        for (let d = 0; d < minimo; d += 0.5) {
          if (this._ocupado(sx + cos * d, sy + sin * d)) { minimo = d; break; }
        }
      }
      return Math.round(Math.max(2, minimo));
    }

    _posSensorLinea(lado) {
      const adelante = 7, costado = lado === 'IZQ' ? -3 : 3;
      const c = Math.cos(this.ang), s = Math.sin(this.ang);
      // "izquierda" del robot = rotar -90° respecto de su frente
      return [this.x + c * adelante - s * costado, this.y + s * adelante + c * costado];
    }

    sensorLinea(lado) {
      const [px, py] = this._posSensorLinea(lado);
      const mitad = this.esc.anchoLinea / 2;
      return this.esc.lineas.some((linea) => {
        for (let i = 0; i < linea.length - 1; i++) {
          if (distSegmento(px, py, linea[i], linea[i + 1]) <= mitad) return true;
        }
        return false;
      });
    }

    // ---------- Sonido, LEDs y lecturas ----------
    _sonido(encendido, frecuencia, duracionReal) {
      this._emitir('alSonar', encendido);
      if (!encendido) {
        if (this._osc) { try { this._osc.stop(); } catch (e) { /* ya detenido */ } this._osc = null; }
        return;
      }
      try {
        this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
        const osc = this.audio.createOscillator();
        const vol = this.audio.createGain();
        osc.type = 'square'; osc.frequency.value = frecuencia; vol.gain.value = 0.05;
        osc.connect(vol).connect(this.audio.destination);
        osc.start(); osc.stop(this.audio.currentTime + duracionReal);
        this._osc = osc;
      } catch (e) { /* sin audio disponible: solo se muestra el indicador */ }
    }

    _emitirLeds() { this._emitir('alCambiarLeds', Object.assign({}, this.leds)); }

    _emitirLecturas() {
      this._emitir('alLecturas', {
        distancia: this.medirDistancia(),
        lineaIzq: this.sensorLinea('IZQ'),
        lineaDer: this.sensorLinea('DER'),
        // El reloj cuenta tiempo simulado: coincide con el del robot real aunque
        // la simulación vaya a otra velocidad o la computadora sea lenta.
        tiempo: this.ejecutando ? this.t : this.tPrograma,
        ejecutando: !!this.ejecutando,
      });
    }

    _emitir(nombre, ...args) { if (typeof this.ev[nombre] === 'function') this.ev[nombre](...args); }

    // ---------- Dibujo ----------
    _dibujar() {
      const ctx = this.ctx, k = this.escala, e = this.esc;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(0, 0, this.lienzo.width, this.lienzo.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);

      // Cuadrícula de 10 cm
      ctx.strokeStyle = '#ebe7dc'; ctx.lineWidth = 1 / k;
      ctx.beginPath();
      for (let x = 10; x < e.ancho; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, e.alto); }
      for (let y = 10; y < e.alto; y += 10) { ctx.moveTo(0, y); ctx.lineTo(e.ancho, y); }
      ctx.stroke();

      // Líneas para seguir
      ctx.strokeStyle = '#22252b'; ctx.lineWidth = e.anchoLinea; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      e.lineas.forEach((l) => { ctx.beginPath(); l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); });

      // Meta
      if (e.meta) {
        const m = e.meta, r = m.radio || 12;
        ctx.fillStyle = this.logrado ? 'rgba(47,158,87,.35)' : 'rgba(47,158,87,.16)';
        ctx.strokeStyle = '#2f9e57'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 1.5]);
        ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        etiqueta(ctx, m.texto || 'META', m.x, m.y, '#237a43');
      }

      // Marcas (puntos A, B, etc.)
      (e.marcas || []).forEach((p) => {
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        etiqueta(ctx, p.texto, p.x, p.y, '#1d2433');
      });

      // Obstáculos
      e.obstaculos.forEach((o) => {
        ctx.fillStyle = o.color || '#b5654a';
        ctx.fillRect(o.x, o.y, o.ancho, o.alto);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.5; ctx.strokeRect(o.x, o.y, o.ancho, o.alto);
      });

      // Rastro
      if (this.rastro.length > 1) {
        ctx.strokeStyle = 'rgba(58,123,213,.55)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); this.rastro.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }

      this._dibujarRobot(ctx);
    }

    _dibujarRobot(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.ang);
      // Ruedas
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(-4.5, -ANCHO / 2 - 2.2, 9, 2.6);
      ctx.fillRect(-4.5, ANCHO / 2 - 0.4, 9, 2.6);
      // Chasis
      ctx.fillStyle = this.chocado ? '#d9534f' : '#e8772e';
      redondeado(ctx, -LARGO / 2, -ANCHO / 2, LARGO, ANCHO, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.5; ctx.stroke();
      // Placa
      ctx.fillStyle = '#2f6f9f'; ctx.fillRect(-5.5, -3.8, 8, 7.6);
      // Sensor ultrasónico (dos "ojos")
      ctx.fillStyle = '#c9ccd2';
      ctx.beginPath(); ctx.arc(LARGO / 2 - 1.2, -2.6, 1.5, 0, Math.PI * 2); ctx.arc(LARGO / 2 - 1.2, 2.6, 1.5, 0, Math.PI * 2); ctx.fill();
      // LEDs
      const colores = { VERDE: '#31c96b', AMARILLO: '#ffd23f', ROJO: '#ff4b3e', AZUL: '#3d8bff' };
      Object.keys(colores).forEach((c, i) => {
        ctx.fillStyle = this.leds[c] ? colores[c] : '#7d4a2a';
        ctx.beginPath(); ctx.arc(-6.4, -4.5 + i * 3, 0.9, 0, Math.PI * 2); ctx.fill();
      });
      if (this.leds.BLANCAS) {
        const g = ctx.createRadialGradient(LARGO / 2, 0, 1, LARGO / 2 + 10, 0, 18);
        g.addColorStop(0, 'rgba(255,248,200,.7)'); g.addColorStop(1, 'rgba(255,248,200,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(LARGO / 2, -4); ctx.lineTo(LARGO / 2 + 26, -12); ctx.lineTo(LARGO / 2 + 26, 12); ctx.lineTo(LARGO / 2, 4); ctx.fill();
      }
      ctx.restore();
      // Sensores de línea
      ['IZQ', 'DER'].forEach((lado) => {
        const [px, py] = this._posSensorLinea(lado);
        ctx.fillStyle = this.sensorLinea(lado) ? '#ff4b3e' : '#ffffff';
        ctx.strokeStyle = '#1d2433'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.arc(px, py, 1.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }
  }

  function distSegmento(px, py, [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function redondeado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function etiqueta(ctx, texto, x, y, color) {
    if (!texto) return;
    ctx.save();
    ctx.fillStyle = color; ctx.font = '700 6px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, x, y);
    ctx.restore();
  }

  window.Simulador = Simulador;
  window.Simulador.Detenido = Detenido;
})();
