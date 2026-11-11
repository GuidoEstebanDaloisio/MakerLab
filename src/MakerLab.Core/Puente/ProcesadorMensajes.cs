using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using MakerLab.Core.Arduino;
using MakerLab.Core.Lecciones;
using MakerLab.Core.Proyectos;

namespace MakerLab.Core.Puente;

/// <summary>
/// Operaciones que dependen de la ventana (diálogos del sistema operativo).
/// La aplicación WPF las implementa; las pruebas usan una versión simulada.
/// </summary>
public interface IServiciosUi
{
    /// <summary>Muestra "Guardar como" y devuelve la ruta elegida, o null si se canceló.</summary>
    string? ElegirArchivoGuardar(string nombreSugerido, string descripcion, string extension);
    /// <summary>Muestra "Abrir" y devuelve la ruta elegida, o null si se canceló.</summary>
    string? ElegirArchivoAbrir(string descripcion, string extension);
    void AbrirCarpeta(string ruta);
}

/// <summary>
/// Recibe los mensajes que envía la interfaz (JavaScript), ejecuta la acción
/// pedida y devuelve la respuesta. Formato del mensaje:
/// <c>{ "id": "1", "comando": "lecciones.listar", "datos": { ... } }</c>.
/// Respuesta: <c>{ "id": "1", "ok": true, "resultado": ... }</c> o
/// <c>{ "id": "1", "ok": false, "error": "mensaje para el usuario" }</c>.
/// </summary>
public sealed class ProcesadorMensajes
{
    private readonly RepositorioLecciones _lecciones;
    private readonly CargadorArduino _arduino;
    private readonly IServiciosUi _ui;
    private readonly Action<string, object?> _emitirEvento;
    private int _cargando;

    public ProcesadorMensajes(RepositorioLecciones lecciones, CargadorArduino arduino, IServiciosUi ui, Action<string, object?> emitirEvento)
    {
        _lecciones = lecciones;
        _arduino = arduino;
        _ui = ui;
        _emitirEvento = emitirEvento;
    }

    public static string Version =>
        typeof(ProcesadorMensajes).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "0.0.0";

    public async Task<string> ProcesarAsync(string mensajeJson)
    {
        string? id = null;
        try
        {
            var msg = JsonNode.Parse(mensajeJson) as JsonObject ?? throw new InvalidOperationException("Mensaje inválido.");
            id = (string?)msg["id"];
            var comando = (string?)msg["comando"] ?? "";
            var datos = msg["datos"] as JsonObject ?? new JsonObject();
            var resultado = await EjecutarAsync(comando, datos);
            return Respuesta(id, true, resultado, null);
        }
        catch (Exception ex) when (ex is LeccionInvalidaException or ProyectoInvalidoException or ErrorArduinoException or ComandoException)
        {
            return Respuesta(id, false, null, ex.Message);
        }
        catch (Exception ex)
        {
            return Respuesta(id, false, null, "Ocurrió un error inesperado: " + ex.Message);
        }
    }

    private async Task<JsonNode?> EjecutarAsync(string comando, JsonObject datos)
    {
        switch (comando)
        {
            case "app.info":
                return new JsonObject { ["version"] = Version, ["arduinoDisponible"] = _arduino.Disponible };

            case "lecciones.listar":
                return new JsonArray(_lecciones.Listar().Select(l => (JsonNode)l).ToArray());

            case "lecciones.importar":
            {
                var ruta = _ui.ElegirArchivoAbrir("Lección de MakerLab", ".zip");
                if (ruta is null) return null;
                var id = _lecciones.ImportarZip(ruta, reemplazar: true);
                return new JsonObject { ["id"] = id };
            }

            case "lecciones.abrirCarpeta":
                Directory.CreateDirectory(_lecciones.CarpetaUsuario);
                _ui.AbrirCarpeta(_lecciones.CarpetaUsuario);
                return null;

            case "proyecto.guardar":
            {
                var contenido = Texto(datos, "contenido");
                AlmacenProyectos.Validar(contenido);
                var nombre = Path.GetFileName((string?)datos["nombre"] ?? "proyecto" + AlmacenProyectos.Extension);
                var ruta = _ui.ElegirArchivoGuardar(nombre, "Proyecto de MakerLab", AlmacenProyectos.Extension);
                if (ruta is null) return null;
                AlmacenProyectos.Guardar(ruta, contenido);
                return new JsonObject { ["ruta"] = ruta };
            }

            case "proyecto.abrir":
            {
                var ruta = _ui.ElegirArchivoAbrir("Proyecto de MakerLab", AlmacenProyectos.Extension);
                if (ruta is null) return null;
                return new JsonObject { ["ruta"] = ruta, ["contenido"] = AlmacenProyectos.Abrir(ruta) };
            }

            case "robot.puertos":
            {
                var puertos = await _arduino.ListarPuertosAsync();
                return JsonSerializer.SerializeToNode(puertos.Select(p => new { puerto = p.Puerto, placa = p.Placa }));
            }

            case "robot.subir":
            {
                // Solo una carga a la vez: dos cargas simultáneas en el mismo puerto fallarían.
                if (Interlocked.Exchange(ref _cargando, 1) == 1) throw new ComandoException("Ya se está enviando un programa al robot.");
                try
                {
                    var progreso = new Progress<string>(linea => _emitirEvento("robot.progreso", linea));
                    await _arduino.SubirAsync(Texto(datos, "codigo"), Texto(datos, "puerto"), progreso);
                    return new JsonObject { ["ok"] = true };
                }
                finally { Interlocked.Exchange(ref _cargando, 0); }
            }

            default:
                throw new ComandoException($"Comando desconocido: {comando}");
        }
    }

    private static string Texto(JsonObject datos, string campo) =>
        datos[campo]?.GetValueKind() == JsonValueKind.String ? (string)datos[campo]! : throw new ComandoException($"Falta el dato \"{campo}\".");

    private static string Respuesta(string? id, bool ok, JsonNode? resultado, string? error)
    {
        var r = new JsonObject { ["id"] = id, ["ok"] = ok };
        if (ok) r["resultado"] = resultado; else r["error"] = error;
        return r.ToJsonString();
    }
}

public sealed class ComandoException(string mensaje) : Exception(mensaje);
