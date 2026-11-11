namespace MakerLab.Core;

/// <summary>
/// Ubicaciones de las carpetas que usa MakerLab.
/// Las lecciones incluidas viajan con el programa; las importadas por los
/// docentes se guardan en Documentos\MakerLab\Lecciones para que sobrevivan
/// a una reinstalación y se puedan copiar fácilmente a un pendrive.
/// </summary>
public sealed class RutasApp
{
    public required string CarpetaPrograma { get; init; }
    public required string CarpetaWeb { get; init; }
    public required string CarpetaLeccionesIncluidas { get; init; }
    public required string CarpetaLeccionesUsuario { get; init; }
    public required string CarpetaArduinoCli { get; init; }
    public required string CarpetaTemporal { get; init; }

    public string EjecutableArduinoCli =>
        Path.Combine(CarpetaArduinoCli, OperatingSystem.IsWindows() ? "arduino-cli.exe" : "arduino-cli");

    public static RutasApp PorDefecto(string? carpetaPrograma = null)
    {
        var programa = carpetaPrograma ?? AppContext.BaseDirectory;
        var web = Path.Combine(programa, "wwwroot");
        var documentos = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        return new RutasApp
        {
            CarpetaPrograma = programa,
            CarpetaWeb = web,
            CarpetaLeccionesIncluidas = Path.Combine(web, "lecciones"),
            CarpetaLeccionesUsuario = Path.Combine(documentos, "MakerLab", "Lecciones"),
            CarpetaArduinoCli = Path.Combine(programa, "tools", "arduino-cli"),
            CarpetaTemporal = Path.Combine(Path.GetTempPath(), "MakerLab"),
        };
    }
}
