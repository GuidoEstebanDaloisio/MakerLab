using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MakerLab.Core.Proyectos;

/// <summary>
/// Guarda y abre los programas de los estudiantes (archivos .makerlab).
/// El archivo es un JSON con la lección y la disposición de los bloques,
/// de modo que puede llevarse en un pendrive y abrirse en otra computadora.
/// </summary>
public static class AlmacenProyectos
{
    public const string Formato = "makerlab-proyecto";
    public const string Extension = ".makerlab";
    public const long TamanoMaximo = 5 * 1024 * 1024;

    public static void Guardar(string ruta, string contenido)
    {
        Validar(contenido);
        var temporal = ruta + ".tmp";
        File.WriteAllText(temporal, contenido, new UTF8Encoding(false));
        File.Move(temporal, ruta, overwrite: true);   // evita dejar un archivo a medio escribir
    }

    public static string Abrir(string ruta)
    {
        var info = new FileInfo(ruta);
        if (!info.Exists) throw new ProyectoInvalidoException("El archivo no existe.");
        if (info.Length > TamanoMaximo) throw new ProyectoInvalidoException("El archivo es demasiado grande para ser un proyecto de MakerLab.");
        var contenido = File.ReadAllText(ruta);
        Validar(contenido);
        return contenido;
    }

    public static JsonObject Validar(string contenido)
    {
        JsonNode? nodo;
        try { nodo = JsonNode.Parse(contenido); }
        catch (JsonException) { throw new ProyectoInvalidoException("El archivo está dañado o no es un proyecto de MakerLab."); }
        if (nodo is not JsonObject obj || (string?)obj["formato"] != Formato)
            throw new ProyectoInvalidoException("El archivo no es un proyecto de MakerLab.");
        if (obj["bloques"] is not JsonObject)
            throw new ProyectoInvalidoException("El proyecto no contiene bloques.");
        return obj;
    }
}

public sealed class ProyectoInvalidoException(string mensaje) : Exception(mensaje);
