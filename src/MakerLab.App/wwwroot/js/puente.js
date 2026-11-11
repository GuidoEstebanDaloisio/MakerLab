/* Puente entre la interfaz (JavaScript) y el núcleo de la aplicación (C#).
 *
 * Dentro de la aplicación de escritorio, la página corre en WebView2 y se
 * comunica con C# mediante mensajes JSON (window.chrome.webview).
 * Si la página se abre en un navegador común (por ejemplo, para desarrollo),
 * se usan alternativas locales: las lecciones se leen de lecciones/indice.json,
 * guardar descarga un archivo y "Enviar a DAVE" no está disponible.
 */
(function () {
  'use strict';

  const webview = window.chrome && window.chrome.webview;
  const pendientes = new Map();
  const oyentes = new Map();
  let siguienteId = 1;

  if (webview) {
    webview.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg && msg.id && pendientes.has(msg.id)) {
        const { resolver, rechazar } = pendientes.get(msg.id);
        pendientes.delete(msg.id);
        if (msg.ok) resolver(msg.resultado); else rechazar(new Error(msg.error || 'Error desconocido'));
      } else if (msg && msg.evento) {
        (oyentes.get(msg.evento) || []).forEach((fn) => fn(msg.datos));
      }
    });
  }

  function enviar(comando, datos) {
    return new Promise((resolver, rechazar) => {
      const id = String(siguienteId++);
      pendientes.set(id, { resolver, rechazar });
      webview.postMessage({ id, comando, datos: datos || {} });
    });
  }

  // ---- Alternativas para el navegador ----
  async function listarLeccionesNavegador() {
    const indice = await (await fetch('lecciones/indice.json')).json();
    const lista = [];
    for (const carpeta of indice.lecciones) {
      const base = 'lecciones/' + carpeta + '/';
      const leccion = await (await fetch(base + 'leccion.json')).json();
      leccion.urlBase = base;
      leccion.origen = 'incluida';
      lista.push(leccion);
    }
    return lista;
  }

  function descargar(nombre, contenido) {
    const blob = new Blob([contenido], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return { ruta: nombre };
  }

  function elegirArchivo() {
    return new Promise((resolver) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.makerlab,.json';
      input.onchange = async () => {
        const f = input.files[0];
        resolver(f ? { contenido: await f.text(), ruta: f.name } : null);
      };
      input.click();
    });
  }

  const noDisponible = () => Promise.reject(new Error('Esta función solo está disponible en la aplicación de escritorio de MakerLab.'));

  window.Puente = {
    esEscritorio: !!webview,
    listarLecciones: () => webview ? enviar('lecciones.listar') : listarLeccionesNavegador(),
    importarLeccion: () => webview ? enviar('lecciones.importar') : noDisponible(),
    abrirCarpetaLecciones: () => webview ? enviar('lecciones.abrirCarpeta') : noDisponible(),
    guardarProyecto: (nombre, contenido) => webview ? enviar('proyecto.guardar', { nombre, contenido }) : Promise.resolve(descargar(nombre, contenido)),
    abrirProyecto: () => webview ? enviar('proyecto.abrir') : elegirArchivo(),
    listarPuertos: () => webview ? enviar('robot.puertos') : noDisponible(),
    enviarAlRobot: (codigo, puerto) => webview ? enviar('robot.subir', { codigo, puerto }) : noDisponible(),
    info: () => webview ? enviar('app.info') : Promise.resolve({ version: 'navegador', arduinoDisponible: false }),
    alRecibir(evento, fn) {
      if (!oyentes.has(evento)) oyentes.set(evento, []);
      oyentes.get(evento).push(fn);
    },
  };
})();
