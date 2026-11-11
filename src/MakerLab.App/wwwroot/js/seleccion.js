/* Selección de varios bloques para MakerLab.
 *
 * Blockly solo permite seleccionar un bloque por vez. Este módulo agrega:
 *  - Mayús + clic sobre un bloque: lo suma a la selección (o lo quita).
 *  - Mayús + arrastrar sobre el fondo: selecciona los bloques del rectángulo.
 *  - Ctrl+C / Ctrl+X / Ctrl+V: copia, corta y pega todos los bloques
 *    seleccionados, respetando cuáles estaban encadenados entre sí.
 *  - Supr / Retroceso: borra los bloques seleccionados.
 *  - Arrastrar un bloque seleccionado extrae exactamente los bloques
 *    seleccionados y los deja unidos, en el orden del programa; los que no
 *    estaban seleccionados quedan en su lugar. Si todos los seleccionados
 *    están sueltos, se mueven juntos sin unirse.
 *  - Arrastrar un único bloque mantiene el comportamiento de Blockly: se lleva
 *    también los bloques que tiene debajo.
 *  - Menú contextual: "Duplicar" y "Borrar" la selección.
 * Con un solo bloque seleccionado se usa el comportamiento normal de Blockly.
 */
(function () {
  'use strict';

  function activar(espacio, contenedor) {
    const ids = new Set();          // bloques seleccionados
    let portapapeles = null;        // cadenas copiadas con esta selección
    let pegados = 0;                // desplaza cada pegado para que no se superpongan
    let gesto = null;               // clic en curso dentro del editor
    let arrastre = null;            // datos del arrastre del grupo
    let previo = null;              // estado tomado al apretar sobre un bloque seleccionado

    const bloque = (id) => espacio.getBlockById(id);
    const activa = () => ids.size >= 2;

    // ---------- Marcas visuales ----------
    function pintar() {
      espacio.getAllBlocks(false).forEach((b) => {
        const raiz = b.getSvgRoot && b.getSvgRoot();
        if (raiz) raiz.classList.toggle('mlSeleccion', activa() && ids.has(b.id));
      });
    }
    function limpiar(dejar) {
      ids.clear();
      if (dejar) ids.add(dejar);
      pintar();
    }
    function agregar(id) {
      const b = bloque(id);
      if (!b || b.isInFlyout || b.isShadow() || !b.isDeletable()) return;
      ids.add(id);
    }

    // ---------- Clics ----------
    // Blockly 12 emite varios eventos de selección por cada clic, así que la
    // selección múltiple se decide una sola vez por clic.
    contenedor.addEventListener('pointerdown', (e) => {
      gesto = { mayus: e.shiftKey, resuelto: false, x: e.clientX, y: e.clientY, activo: true };
      previo = (!e.shiftKey && activa()) ? fotografiar(e.target) : null;
    }, true);

    // Antes de que Blockly empiece a arrastrar se registra cómo estaba el
    // programa: qué bloques se llevaría el arrastre y dónde estaban.
    function fotografiar(objetivo) {
      const g = objetivo && objetivo.closest && objetivo.closest('.blocklyDraggable');
      if (!g) return null;
      const b = espacio.getAllBlocks(false).find((x) => x.getSvgRoot() === g);
      if (!b || !ids.has(b.id)) return null;
      const orden = raices().filter((x) => x.previousConnection && x.isDeletable());
      // Orden del programa (de arriba hacia abajo).
      const lugarEn = new Map(espacio.getAllBlocks(true).map((x, i) => [x.id, i]));
      orden.sort((p, q) => lugarEn.get(p.id) - lugarEn.get(q.id));
      if (!orden.includes(b)) return null;
      const llevados = [];
      for (let x = b; x; x = x.getNextBlock()) llevados.push(x.id);
      // Hay que extraer si algún seleccionado está encastrado entre bloques no seleccionados.
      const extraer = orden.some((x) => (x.getParent() && !ids.has(x.getParent().id)) || (x.getNextBlock() && !ids.has(x.getNextBlock().id)));
      // Punto donde quedarán los bloques no seleccionados que el arrastre se lleve:
      // el último bloque no seleccionado antes de "b" en su programa.
      let conexion = b.previousConnection.targetConnection, arriba = b;
      while (conexion && conexion.type === Blockly.ConnectionType.NEXT_STATEMENT && ids.has(conexion.getSourceBlock().id)) {
        arriba = conexion.getSourceBlock();
        conexion = arriba.previousConnection && arriba.previousConnection.targetConnection;
      }
      return { id: b.id, orden: orden.map((x) => x.id), llevados, extraer, conexion, lugar: arriba.getRelativeToSurfaceXY() };
    }
    // Después de soltar: los no seleccionados vuelven a su lugar y los
    // seleccionados quedan unidos donde se soltó el bloque.
    function extraer(datos) {
      const b = bloque(datos.id);
      if (!b) return;
      const llevados = datos.llevados.map(bloque).filter(Boolean);
      const destino = b.previousConnection.targetConnection;
      const lugarSoltado = b.getRelativeToSurfaceXY();
      const ultimo = llevados[llevados.length - 1];
      const siguiente = ultimo && ultimo.getNextBlock();      // si se soltó en medio de otro programa
      if (siguiente) siguiente.previousConnection.disconnect();
      if (destino) b.previousConnection.disconnect();
      llevados.forEach((x) => { if (x.nextConnection && x.nextConnection.isConnected()) x.nextConnection.disconnect(); });
      // Seleccionados que no viajaron con el arrastre: se sacan de su programa, que se vuelve a unir.
      datos.orden.map(bloque).filter((x) => x && !datos.llevados.includes(x.id)).forEach((x) => x.unplug(true));
      // No seleccionados que el arrastre se llevó: vuelven a donde estaban.
      const quedan = llevados.filter((x) => !ids.has(x.id));
      for (let i = 1; i < quedan.length; i++) quedan[i - 1].nextConnection.connect(quedan[i].previousConnection);
      if (quedan.length) {
        const c = datos.conexion;
        if (c && !c.getSourceBlock().isDeadOrDying() && !c.isConnected()) c.connect(quedan[0].previousConnection);
        else quedan[0].moveTo(new Blockly.utils.Coordinate(datos.lugar.x, datos.lugar.y));
      }
      // Seleccionados, unidos en el orden del programa, donde se soltó el arrastre.
      const orden = datos.orden.map(bloque).filter(Boolean);
      for (let i = 1; i < orden.length; i++) orden[i - 1].nextConnection.connect(orden[i].previousConnection);
      if (destino && !destino.isConnected()) destino.connect(orden[0].previousConnection);
      else orden[0].moveTo(new Blockly.utils.Coordinate(lugarSoltado.x, lugarSoltado.y));
      const cola = orden[orden.length - 1];
      if (siguiente && cola.nextConnection && !cola.nextConnection.isConnected()) cola.nextConnection.connect(siguiente.previousConnection);
    }
    // Los eventos de Blockly llegan después del clic: el gesto se conserva
    // hasta el clic siguiente, pero solo se procesa una vez.
    document.addEventListener('pointerup', (e) => {
      if (!gesto || !gesto.activo) return;
      const g = gesto; g.activo = false;
      const arrastro = Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4;
      if (g.mayus || arrastro) return;
      // Clic común: queda seleccionado solo el bloque que Blockly seleccionó.
      setTimeout(() => {
        const sel = Blockly.getSelected && Blockly.getSelected();
        limpiar(sel && sel.id && bloque(sel.id) ? sel.id : null);
      }, 0);
    });

    espacio.addChangeListener((e) => {
      if (e.type === Blockly.Events.SELECTED) {
        if (!gesto || !gesto.mayus || gesto.resuelto) return;
        const nuevo = e.newElementId && bloque(e.newElementId) ? e.newElementId : null;
        if (!nuevo) return;
        gesto.resuelto = true;
        if (e.oldElementId && bloque(e.oldElementId)) agregar(e.oldElementId);
        if (ids.has(nuevo) && ids.size > 1) ids.delete(nuevo); else agregar(nuevo);
        pintar();
      } else if (e.type === Blockly.Events.BLOCK_DRAG) {
        if (e.isStart && activa() && ids.has(e.blockId)) {
          const b = bloque(e.blockId);
          arrastre = { id: e.blockId, desde: b.getRelativeToSurfaceXY(), foto: previo && previo.id === e.blockId ? previo : null };
          // Durante el arrastre, los bloques que no se van a extraer se ven atenuados.
          if (arrastre.foto && arrastre.foto.extraer) {
            arrastre.foto.llevados.forEach((id) => {
              const x = bloque(id);
              if (x && !ids.has(id) && x.pathObject) x.pathObject.svgPath.classList.add('mlQueda');
            });
          }
        } else if (!e.isStart && arrastre && arrastre.id === e.blockId) {
          const datos = arrastre;
          arrastre = null;
          // Se espera a que Blockly termine de acomodar el bloque en la cuadrícula.
          setTimeout(() => {
          document.querySelectorAll('.mlQueda').forEach((p) => p.classList.remove('mlQueda'));
          const b = bloque(datos.id);
          if (b && datos.foto && datos.foto.extraer) {
            Blockly.Events.setGroup(e.group || true);
            try { extraer(datos.foto); } finally { Blockly.Events.setGroup(false); }
          } else if (b) {
            const hasta = b.getRelativeToSurfaceXY();
            const dx = hasta.x - datos.desde.x, dy = hasta.y - datos.desde.y;
            Blockly.Events.setGroup(e.group || true);
            // Se mueven los demás bloques sueltos de la selección (los que están
            // encastrados en otro programa quedan en su lugar).
            ids.forEach((id) => {
              const otro = bloque(id);
              if (otro && id !== datos.id && !otro.getParent()) { otro.moveBy(dx, dy); if (otro.snapToGrid) otro.snapToGrid(); }
            });
            Blockly.Events.setGroup(false);
          }
          pintar();
          }, 60);
        }
      } else if (e.type === Blockly.Events.BLOCK_DELETE) {
        (e.ids || [e.blockId]).forEach((id) => ids.delete(id));
      } else if (e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_MOVE) {
        if (activa()) setTimeout(pintar, 0);   // los bloques nuevos o movidos se vuelven a dibujar
      } else if (e.type === Blockly.Events.FINISHED_LOADING) {
        limpiar(null);
      }
    });

    // ---------- Rectángulo de selección (Mayús + arrastrar sobre el fondo) ----------
    const marco = document.createElement('div');
    marco.className = 'mlRectangulo';
    marco.hidden = true;
    contenedor.appendChild(marco);

    contenedor.addEventListener('pointerdown', (e) => {
      if (!e.shiftKey || e.button !== 0) return;
      const fondo = e.target.closest && e.target.closest('.blocklyMainBackground, .blocklySvg');
      if (!fondo || e.target.closest('.blocklyDraggable, .blocklyFlyout, .blocklyToolbox, .blocklyToolboxDiv')) return;
      e.preventDefault(); e.stopPropagation();
      const caja = contenedor.getBoundingClientRect();
      const x0 = e.clientX, y0 = e.clientY;
      const dibujar = (x, y) => {
        Object.assign(marco.style, {
          left: Math.min(x, x0) - caja.left + 'px', top: Math.min(y, y0) - caja.top + 'px',
          width: Math.abs(x - x0) + 'px', height: Math.abs(y - y0) + 'px',
        });
      };
      dibujar(x0, y0); marco.hidden = false;
      const mover = (ev) => dibujar(ev.clientX, ev.clientY);
      const soltar = (ev) => {
        window.removeEventListener('pointermove', mover, true);
        window.removeEventListener('pointerup', soltar, true);
        marco.hidden = true;
        const r = { izq: Math.min(ev.clientX, x0), der: Math.max(ev.clientX, x0), arr: Math.min(ev.clientY, y0), abj: Math.max(ev.clientY, y0) };
        if (r.der - r.izq < 4 && r.abj - r.arr < 4) return;
        espacio.getAllBlocks(false).forEach((b) => {
          if (b.isShadow() || !b.pathObject) return;
          const c = b.pathObject.svgPath.getBoundingClientRect();
          if (c.left >= r.izq && c.right <= r.der && c.top >= r.arr && c.bottom <= r.abj) agregar(b.id);
        });
        pintar();
      };
      window.addEventListener('pointermove', mover, true);
      window.addEventListener('pointerup', soltar, true);
    }, true);

    // ---------- Copiar, pegar y borrar ----------
    // Bloques seleccionados que no están dentro de otro bloque seleccionado
    // (un "repetir" seleccionado ya lleva adentro sus bloques).
    function raices() {
      return [...ids].map(bloque).filter((b) => {
        if (!b) return false;
        for (let p = b.getSurroundParent(); p; p = p.getSurroundParent()) if (ids.has(p.id)) return false;
        return true;
      });
    }

    function copiar() {
      const sel = raices().filter((b) => b.isDeletable());
      const cadenas = [];
      sel.forEach((b) => {
        const previo = b.getPreviousBlock();
        if (previo && previo.getNextBlock() === b && ids.has(previo.id) && sel.includes(previo)) return; // no es cabeza de cadena
        const pos = b.getRelativeToSurfaceXY();
        const json = Blockly.serialization.blocks.save(b, { addNextBlocks: false, addCoordinates: false, saveIds: false });
        let ultimo = json;
        for (let sig = b.getNextBlock(); sig && ids.has(sig.id) && sig.isDeletable(); sig = sig.getNextBlock()) {
          const j = Blockly.serialization.blocks.save(sig, { addNextBlocks: false, addCoordinates: false, saveIds: false });
          ultimo.next = { block: j };
          ultimo = j;
        }
        cadenas.push({ x: pos.x, y: pos.y, json });
      });
      portapapeles = cadenas.length ? cadenas : null;
      pegados = 0;
      return cadenas.length;
    }

    function pegar() {
      if (!portapapeles) return;
      pegados++;
      const d = 30 * pegados;
      Blockly.Events.setGroup(true);
      const nuevos = [];
      try {
        portapapeles.forEach((c) => {
          const json = JSON.parse(JSON.stringify(c.json));
          json.x = c.x + d; json.y = c.y + d;
          const b = Blockly.serialization.blocks.append(json, espacio, { recordUndo: true });
          for (let x = b; x; x = x.getNextBlock()) nuevos.push(x.id);
        });
      } finally {
        Blockly.Events.setGroup(false);
      }
      limpiar(null);
      nuevos.forEach(agregar);
      pintar();
    }

    function borrar() {
      const sel = raices().filter((b) => b.isDeletable());
      Blockly.Events.setGroup(true);
      try {
        sel.reverse().forEach((b) => { if (!b.isDeadOrDying()) b.dispose(true, true); });
      } finally {
        Blockly.Events.setGroup(false);
      }
      limpiar(null);
    }

    function duplicar() {
      copiar(); pegados = 0; pegar();
    }

    // Se envuelven los atajos de teclado de Blockly: con una selección de dos o
    // más bloques actúan sobre todos; si no, hacen lo de siempre.
    const registro = Blockly.ShortcutRegistry.registry;
    function envolver(nombre, propio) {
      const original = registro.getRegistry()[nombre];
      if (!original) return;
      registro.register(Object.assign({}, original, {
        keyCodes: undefined,
        preconditionFn: (ws, alcance) => (ws === espacio && activa()) || (original.preconditionFn ? original.preconditionFn(ws, alcance) : true),
        callback: (ws, e, atajo, alcance) => {
          if (ws === espacio && activa()) { e.preventDefault && e.preventDefault(); propio(); return true; }
          if (nombre === 'copy' || nombre === 'cut') portapapeles = null;
          return original.callback(ws, e, atajo, alcance);
        },
      }), true);
    }
    envolver('copy', copiar);
    envolver('cut', () => { copiar(); borrar(); });
    envolver('delete', borrar);
    envolver('paste', pegar);
    // Si lo último copiado fue una selección múltiple, Ctrl+V la pega aunque
    // ahora no haya nada seleccionado.
    const pegadoOriginal = registro.getRegistry().paste;
    registro.register(Object.assign({}, pegadoOriginal, {
      preconditionFn: (ws, alcance) => (ws === espacio && !!portapapeles) || pegadoOriginal.preconditionFn(ws, alcance),
      callback: (ws, e, atajo, alcance) => {
        if (ws === espacio && portapapeles) { pegar(); return true; }
        return pegadoOriginal.callback(ws, e, atajo, alcance);
      },
    }), true);

    // ---------- Menú contextual ----------
    const menu = Blockly.ContextMenuRegistry.registry;
    const enSeleccion = (alcance) => activa() && alcance.block && ids.has(alcance.block.id);
    [['mlDuplicarSeleccion', () => `Duplicar los ${ids.size} bloques seleccionados`, duplicar, 0],
     ['mlBorrarSeleccion', () => `Borrar los ${ids.size} bloques seleccionados`, borrar, 1]].forEach(([id, texto, accion, peso]) => {
      if (menu.getItem(id)) menu.unregister(id);
      menu.register({
        id, weight: peso, scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        displayText: texto,
        preconditionFn: (alcance) => (enSeleccion(alcance) ? 'enabled' : 'hidden'),
        callback: () => accion(),
      });
    });

    return {
      seleccionados: () => [...ids],
      seleccionar: (lista) => { limpiar(null); lista.forEach(agregar); pintar(); },
      limpiar: () => limpiar(null),
      copiar, pegar, borrar, duplicar,
    };
  }

  window.SeleccionMultiple = { activar };
})();
