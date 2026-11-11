using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MakerLab.Core.Arduino;

/// <summary>Un puerto serie donde hay (o puede haber) una placa conectada.</summary>
public sealed record PuertoSerie(string Puerto, string? Placa);

/// <summary>
/// Compila el programa generado por MakerLab y lo carga en la placa Arduino
/// de DAVE usando arduino-cli. arduino-cli y el paquete de placas AVR se
/// distribuyen junto con MakerLab, por lo que no hace falta internet.
/// </summary>
public sealed partial class CargadorArduino
{
    public const string Fqbn = "arduino:avr:uno";
    public const int TamanoMaximoCodigo = 200_000;

    private readonly string _carpetaCli;
    private readonly string _carpetaTemporal;

    public CargadorArduino(string carpetaCli, string carpetaTemporal)
    {
        _carpetaCli = carpetaCli;
        _carpetaTemporal = carpetaTemporal;
    }

    public string Ejecutable => Path.Combine(_carpetaCli, OperatingSystem.IsWindows() ? "arduino-cli.exe" : "arduino-cli");

    public bool Disponible => File.Exists(Ejecutable);

    public async Task<List<PuertoSerie>> ListarPuertosAsync(CancellationToken ct = default)
    {
        AsegurarDisponible();
        var (codigo, salida, _) = await EjecutarAsync(new[] { "board", "list", "--format", "json" }, null, TimeSpan.FromSeconds(20), ct);
        if (codigo != 0) throw new ErrorArduinoException("No se pudieron buscar los puertos USB.");
        return ParsearPuertos(salida);
    }

    public async Task SubirAsync(string codigo, string puerto, IProgress<string>? progreso, CancellationToken ct = default)
    {
        AsegurarDisponible();
        if (string.IsNullOrWhiteSpace(codigo) || codigo.Length > TamanoMaximoCodigo)
            throw new ErrorArduinoException("El programa está vacío o es demasiado grande.");
        if (!PuertoValido().IsMatch(puerto ?? ""))
            throw new ErrorArduinoException("El puerto elegido no es válido.");

        // arduino-cli exige que el archivo .ino esté en una carpeta con su mismo nombre.
        var carpetaSketch = Path.Combine(_carpetaTemporal, "programa_dave");
        Directory.CreateDirectory(carpetaSketch);
        await File.WriteAllTextAsync(Path.Combine(carpetaSketch, "programa_dave.ino"), codigo, new UTF8Encoding(false), ct);

        progreso?.Report("Compilando el programa…");
        var argumentos = new[] { "compile", "--fqbn", Fqbn, "--upload", "--port", puerto!, carpetaSketch };
        var (salidaCodigo, salida, errores) = await EjecutarAsync(argumentos, progreso, TimeSpan.FromMinutes(3), ct);
        if (salidaCodigo != 0) throw new ErrorArduinoException(TraducirError(salida + "\n" + errores));
    }

    private void AsegurarDisponible()
    {
        if (!Disponible)
            throw new ErrorArduinoException("Esta copia de MakerLab no incluye la herramienta para cargar programas en Arduino (arduino-cli). Podés seguir usando el simulador.");
    }

    private async Task<(int codigo, string salida, string errores)> EjecutarAsync(
        IEnumerable<string> argumentos, IProgress<string>? progreso, TimeSpan limite, CancellationToken ct)
    {
        var inicio = new ProcessStartInfo(Ejecutable)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in argumentos) inicio.ArgumentList.Add(a);
        // Todas las carpetas de arduino-cli quedan dentro de la instalación de MakerLab (modo portátil).
        inicio.Environment["ARDUINO_DIRECTORIES_DATA"] = Path.Combine(_carpetaCli, "datos");
        inicio.Environment["ARDUINO_DIRECTORIES_DOWNLOADS"] = Path.Combine(_carpetaCli, "descargas");
        inicio.Environment["ARDUINO_DIRECTORIES_USER"] = Path.Combine(_carpetaCli, "usuario");
        inicio.Environment["ARDUINO_UPDATER_ENABLE_NOTIFICATION"] = "false";

        using var proceso = new Process { StartInfo = inicio };
        var salida = new StringBuilder();
        var errores = new StringBuilder();
        proceso.OutputDataReceived += (_, e) => { if (e.Data is null) return; salida.AppendLine(e.Data); progreso?.Report(e.Data); };
        proceso.ErrorDataReceived += (_, e) => { if (e.Data is null) return; errores.AppendLine(e.Data); progreso?.Report(e.Data); };

        try { proceso.Start(); }
        catch (Exception ex) { throw new ErrorArduinoException("No se pudo ejecutar arduino-cli: " + ex.Message); }
        proceso.BeginOutputReadLine();
        proceso.BeginErrorReadLine();

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(limite);
        try { await proceso.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException)
        {
            try { proceso.Kill(entireProcessTree: true); } catch { /* ya terminó */ }
            throw new ErrorArduinoException("La carga tardó demasiado y se canceló. Desconectá y volvé a conectar el robot.");
        }
        proceso.WaitForExit(); // asegura que se hayan leído todas las líneas
        return (proceso.ExitCode, salida.ToString(), errores.ToString());
    }

    /// <summary>
    /// Interpreta la salida JSON de "arduino-cli board list". Acepta el formato
    /// de las versiones 1.x ({"detected_ports": [...]}) y el de las 0.x (una lista).
    /// </summary>
    public static List<PuertoSerie> ParsearPuertos(string json)
    {
        var puertos = new List<PuertoSerie>();
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "[]" : json);
        var raiz = doc.RootElement;
        var lista = raiz.ValueKind == JsonValueKind.Object && raiz.TryGetProperty("detected_ports", out var dp) ? dp : raiz;
        if (lista.ValueKind != JsonValueKind.Array) return puertos;

        foreach (var item in lista.EnumerateArray())
        {
            if (!item.TryGetProperty("port", out var p)) continue;
            var protocolo = p.TryGetProperty("protocol", out var pr) ? pr.GetString() : "serial";
            if (protocolo != "serial") continue;
            var direccion = p.TryGetProperty("address", out var ad) ? ad.GetString() : null;
            if (string.IsNullOrEmpty(direccion)) continue;
            string? placa = null;
            if (item.TryGetProperty("matching_boards", out var mb) && mb.ValueKind == JsonValueKind.Array && mb.GetArrayLength() > 0)
                placa = mb[0].TryGetProperty("name", out var n) ? n.GetString() : null;
            puertos.Add(new PuertoSerie(direccion, placa));
        }
        // Primero los puertos donde se reconoció una placa.
        return puertos.OrderBy(x => x.Placa is null).ThenBy(x => x.Puerto, StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>Convierte los mensajes técnicos de arduino-cli en explicaciones para el aula.</summary>
    public static string TraducirError(string salida)
    {
        var s = salida.ToLowerInvariant();
        if (s.Contains("can't open device") || s.Contains("access is denied") || s.Contains("acceso denegado") || s.Contains("permission denied"))
            return "El puerto está ocupado o no existe. Cerrá otros programas que usen la placa (por ejemplo, el IDE de Arduino) y probá de nuevo.";
        if (s.Contains("not in sync") || s.Contains("not responding") || s.Contains("no response"))
            return "La placa no responde. Revisá el cable USB, que el robot esté conectado y que el puerto elegido sea el correcto.";
        if (s.Contains("platform not installed") || s.Contains("platform 'arduino:avr' not found") || s.Contains("unknown fqbn"))
            return "Falta el paquete de placas Arduino en esta instalación de MakerLab. Volvé a instalar MakerLab desde el instalador completo.";
        if (s.Contains("error:") && s.Contains("programa_dave.ino"))
            return "El programa no se pudo compilar. Revisá que todos los bloques estén completos.";
        return "No se pudo cargar el programa en el robot. Revisá la conexión y probá de nuevo.";
    }

    [GeneratedRegex(@"^(COM\d{1,3}|/dev/tty[A-Za-z0-9._-]+)$")]
    private static partial Regex PuertoValido();
}

public sealed class ErrorArduinoException(string mensaje) : Exception(mensaje);
