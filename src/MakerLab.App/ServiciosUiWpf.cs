using System.Diagnostics;
using System.Windows;
using MakerLab.Core.Puente;
using Microsoft.Win32;

namespace MakerLab.App;

/// <summary>Diálogos del sistema operativo que necesita el núcleo de MakerLab.</summary>
public sealed class ServiciosUiWpf(Window ventana) : IServiciosUi
{
    public string? ElegirArchivoGuardar(string nombreSugerido, string descripcion, string extension)
    {
        var dlg = new SaveFileDialog
        {
            FileName = nombreSugerido,
            DefaultExt = extension,
            Filter = $"{descripcion} (*{extension})|*{extension}",
            AddExtension = true,
            OverwritePrompt = true,
            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
        };
        return dlg.ShowDialog(ventana) == true ? dlg.FileName : null;
    }

    public string? ElegirArchivoAbrir(string descripcion, string extension)
    {
        var dlg = new OpenFileDialog
        {
            Filter = $"{descripcion} (*{extension})|*{extension}",
            CheckFileExists = true,
            InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
        };
        return dlg.ShowDialog(ventana) == true ? dlg.FileName : null;
    }

    public void AbrirCarpeta(string ruta) =>
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{ruta}\"") { UseShellExecute = true });
}
