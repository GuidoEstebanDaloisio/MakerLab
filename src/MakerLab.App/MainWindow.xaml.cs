using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using MakerLab.Core;
using MakerLab.Core.Arduino;
using MakerLab.Core.Lecciones;
using MakerLab.Core.Puente;
using Microsoft.Web.WebView2.Core;

namespace MakerLab.App;

/// <summary>
/// Ventana principal. Aloja la interfaz web en WebView2 y conecta los
/// mensajes de la interfaz con el núcleo de la aplicación (MakerLab.Core).
/// </summary>
public partial class MainWindow : Window
{
    // Direcciones virtuales: WebView2 sirve las carpetas locales como si fueran
    // sitios web, sin servidor y sin conexión a internet.
    private const string HostApp = "app.makerlab";
    private const string HostLecciones = "lecciones.makerlab";

    private readonly RutasApp _rutas = RutasApp.PorDefecto();
    private ProcesadorMensajes? _procesador;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += async (_, _) => await IniciarAsync();
    }

    private async Task IniciarAsync()
    {
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                "Falta el componente Microsoft Edge WebView2, necesario para mostrar MakerLab.\n\n" +
                "Viene incluido en Windows 11 y en Windows 10 actualizado. Si la computadora no lo tiene, " +
                "instalalo con el archivo \"MicrosoftEdgeWebView2RuntimeInstaller\" que se encuentra en la carpeta de MakerLab.",
                "MakerLab", MessageBoxButton.OK, MessageBoxImage.Warning);
            Close();
            return;
        }

        // Los datos del navegador se guardan en la carpeta del usuario: el programa
        // puede estar instalado en una carpeta sin permisos de escritura.
        var datos = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MakerLab", "WebView2");
        var entorno = await CoreWebView2Environment.CreateAsync(null, datos);
        await Navegador.EnsureCoreWebView2Async(entorno);

        var web = Navegador.CoreWebView2;
        web.Settings.AreDevToolsEnabled = Debugger.IsAttached;
        web.Settings.AreDefaultContextMenusEnabled = Debugger.IsAttached;
        web.Settings.IsStatusBarEnabled = false;
        web.Settings.IsZoomControlEnabled = false;
        web.Settings.AreBrowserAcceleratorKeysEnabled = Debugger.IsAttached;  // evita recargar la página con F5 o Ctrl+R

        Directory.CreateDirectory(_rutas.CarpetaLeccionesUsuario);
        web.SetVirtualHostNameToFolderMapping(HostApp, _rutas.CarpetaWeb, CoreWebView2HostResourceAccessKind.DenyCors);
        web.SetVirtualHostNameToFolderMapping(HostLecciones, _rutas.CarpetaLeccionesUsuario, CoreWebView2HostResourceAccessKind.Allow);

        var repositorio = new RepositorioLecciones(
            _rutas.CarpetaLeccionesIncluidas, _rutas.CarpetaLeccionesUsuario,
            $"https://{HostApp}/lecciones", $"https://{HostLecciones}");
        var arduino = new CargadorArduino(_rutas.CarpetaArduinoCli, _rutas.CarpetaTemporal);
        _procesador = new ProcesadorMensajes(repositorio, arduino, new ServiciosUiWpf(this), EmitirEvento);

        web.WebMessageReceived += async (_, e) =>
        {
            var respuesta = await _procesador.ProcesarAsync(e.WebMessageAsJson);
            web.PostWebMessageAsJson(respuesta);
        };

        // Solo se permite navegar dentro de MakerLab; los enlaces externos se abren en el navegador del sistema.
        web.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith($"https://{HostApp}/", StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                if (e.Uri.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true });
            }
        };
        web.NewWindowRequested += (_, e) => e.Handled = true;

        web.NavigationCompleted += (_, _) =>
        {
            Cargando.Visibility = Visibility.Collapsed;
            Navegador.Visibility = Visibility.Visible;
        };
        web.Navigate($"https://{HostApp}/index.html");
    }

    private void EmitirEvento(string evento, object? datos)
    {
        var json = JsonSerializer.Serialize(new { evento, datos });
        Dispatcher.Invoke(() => Navegador.CoreWebView2?.PostWebMessageAsJson(json));
    }
}
