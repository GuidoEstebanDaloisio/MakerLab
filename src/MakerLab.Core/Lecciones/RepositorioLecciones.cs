using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MakerLab.Core.Lecciones;

/// <summary>
/// Lee las lecciones disponibles y permite importar lecciones nuevas.
///
/// Una lección es una carpeta que contiene un archivo <c>leccion.json</c>
/// (y, opcionalmente, imágenes). Cualquier docente puede crear una copiando
/// una carpeta existente y editando ese archivo, o importarla desde un .zip.
/// </summary>
public sealed partial class RepositorioLecciones
{
    public const string Formato = "makerlab-leccion";
    public const string NombreArchivo = "leccion.json";

    private readonly string _carpetaIncluidas;
    private readonly string _carpetaUsuario;
    private readonly string _urlIncluidas;
    private readonly string _urlUsuario;

    /// <param name="carpetaIncluidas">Lecciones que vienen con MakerLab.</param>
    /// <param name="carpetaUsuario">Lecciones importadas o creadas por docentes.</param>
    /// <param name="urlIncluidas">Dirección desde la que la interfaz accede a las lecciones incluidas.</param>
    /// <param name="urlUsuario">Dirección desde la que la interfaz accede a las lecciones del usuario.</param>
    public RepositorioLecciones(string carpetaIncluidas, string carpetaUsuario, string urlIncluidas, string urlUsuario)
    {
        _carpetaIncluidas = carpetaIncluidas;
        _carpetaUsuario = carpetaUsuario;
        _urlIncluidas = urlIncluidas.TrimEnd('/') + "/";
        _urlUsuario = urlUsuario.TrimEnd('/') + "/";
    }

    public string CarpetaUsuario => _carpetaUsuario;

    /// <summary>Problemas encontrados en la última lectura (lecciones que no se pudieron cargar).</summary>
    public List<string> Advertencias { get; } = new();

    /// <summary>
    /// Devuelve todas las lecciones válidas, primero las incluidas y luego las del usuario,
    /// ordenadas por el campo "orden". Las lecciones inválidas se omiten y se informan en <see cref="Advertencias"/>.
    /// </summary>
    public List<JsonObject> Listar()
    {
        Advertencias.Clear();
        var lecciones = new List<JsonObject>();
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        LeerCarpeta(_carpetaIncluidas, _urlIncluidas, "incluida", lecciones, ids);
        LeerCarpeta(_carpetaUsuario, _urlUsuario, "importada", lecciones, ids);
        return lecciones
            .OrderBy(l => l["orden"]?.GetValue<double>() ?? 999)
            .ThenBy(l => (string?)l["titulo"])
            .ToList();
    }

    private void LeerCarpeta(string carpeta, string urlBase, string origen, List<JsonObject> destino, HashSet<string> ids)
    {
        if (!Directory.Exists(carpeta)) return;
        foreach (var dir in Directory.GetDirectories(carpeta).OrderBy(d => d, StringComparer.Ordinal))
        {
            var archivo = Path.Combine(dir, NombreArchivo);
            if (!File.Exists(archivo)) continue;
            try
            {
                var leccion = Validar(File.ReadAllText(archivo));
                var id = (string)leccion["id"]!;
                if (!ids.Add(id))
                {
                    Advertencias.Add($"La lección \"{id}\" está repetida y se omitió ({dir}).");
                    continue;
                }
                leccion["origen"] = origen;
                leccion["urlBase"] = urlBase + Uri.EscapeDataString(Path.GetFileName(dir)) + "/";
                destino.Add(leccion);
            }
            catch (Exception ex) when (ex is LeccionInvalidaException or JsonException or IOException)
            {
                Advertencias.Add($"No se pudo cargar {archivo}: {ex.Message}");
            }
        }
    }

    /// <summary>Comprueba que el texto sea una lección de MakerLab bien formada.</summary>
    public static JsonObject Validar(string json)
    {
        JsonNode? nodo;
        try { nodo = JsonNode.Parse(json); }
        catch (JsonException ex) { throw new LeccionInvalidaException("El archivo no es un JSON válido: " + ex.Message); }

        if (nodo is not JsonObject obj) throw new LeccionInvalidaException("El archivo no contiene un objeto JSON.");
        if ((string?)obj["formato"] != Formato) throw new LeccionInvalidaException($"El campo \"formato\" debe ser \"{Formato}\".");

        var id = obj["id"]?.GetValueKind() == JsonValueKind.String ? (string?)obj["id"] : null;
        if (string.IsNullOrWhiteSpace(id) || !IdValido().IsMatch(id))
            throw new LeccionInvalidaException("El campo \"id\" es obligatorio y solo puede tener letras minúsculas, números, guiones y guiones bajos.");
        if (obj["titulo"]?.GetValueKind() != JsonValueKind.String || string.IsNullOrWhiteSpace((string?)obj["titulo"]))
            throw new LeccionInvalidaException("El campo \"titulo\" es obligatorio.");
        if (obj["bloques"] is not JsonArray bloques || bloques.Count == 0 || bloques.Any(b => b?.GetValueKind() != JsonValueKind.String))
            throw new LeccionInvalidaException("El campo \"bloques\" debe ser una lista con al menos un tipo de bloque.");
        if (obj["escenario"] is not null and not JsonObject)
            throw new LeccionInvalidaException("El campo \"escenario\" debe ser un objeto.");
        if (obj["orden"] is not null && obj["orden"]!.GetValueKind() != JsonValueKind.Number)
            throw new LeccionInvalidaException("El campo \"orden\" debe ser un número.");
        return obj;
    }

    /// <summary>
    /// Importa una lección desde un archivo .zip. El .zip debe contener un
    /// <c>leccion.json</c> en la raíz o dentro de una única carpeta.
    /// Devuelve el id de la lección importada.
    /// </summary>
    public string ImportarZip(string rutaZip, bool reemplazar = false)
    {
        using var zip = ZipFile.OpenRead(rutaZip);
        var entradaLeccion = zip.Entries
            .Where(e => e.Name.Equals(NombreArchivo, StringComparison.OrdinalIgnoreCase))
            .OrderBy(e => e.FullName.Count(c => c == '/'))
            .FirstOrDefault()
            ?? throw new LeccionInvalidaException($"El .zip no contiene un archivo {NombreArchivo}.");

        string json;
        using (var lector = new StreamReader(entradaLeccion.Open())) json = lector.ReadToEnd();
        var leccion = Validar(json);
        var id = (string)leccion["id"]!;

        if (Listar().Any(l => string.Equals((string?)l["id"], id, StringComparison.OrdinalIgnoreCase) && (string?)l["origen"] == "incluida"))
            throw new LeccionInvalidaException($"Ya existe una lección incluida con el id \"{id}\". Cambiá el id de la lección que querés importar.");

        var destino = Path.GetFullPath(Path.Combine(_carpetaUsuario, id));
        if (Directory.Exists(destino))
        {
            if (!reemplazar) throw new LeccionInvalidaException($"Ya hay una lección importada con el id \"{id}\".");
            Directory.Delete(destino, recursive: true);
        }
        Directory.CreateDirectory(destino);

        // Solo se extrae la carpeta donde está leccion.json, y se controla que
        // ningún archivo quede fuera del destino (protección contra "zip slip").
        var prefijo = entradaLeccion.FullName[..^entradaLeccion.Name.Length];
        foreach (var entrada in zip.Entries)
        {
            if (!entrada.FullName.StartsWith(prefijo, StringComparison.Ordinal) || string.IsNullOrEmpty(entrada.Name)) continue;
            var relativa = entrada.FullName[prefijo.Length..];
            var ruta = Path.GetFullPath(Path.Combine(destino, relativa));
            if (!ruta.StartsWith(destino + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                Directory.Delete(destino, recursive: true);
                throw new LeccionInvalidaException("El .zip contiene rutas no permitidas.");
            }
            Directory.CreateDirectory(Path.GetDirectoryName(ruta)!);
            entrada.ExtractToFile(ruta, overwrite: true);
        }
        return id;
    }

    [GeneratedRegex("^[a-z0-9_-]{1,64}$")]
    private static partial Regex IdValido();
}

public sealed class LeccionInvalidaException(string mensaje) : Exception(mensaje);
