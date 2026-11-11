using System.Windows;
using System.Windows.Threading;

namespace MakerLab.App;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        // Ante un error inesperado se informa al usuario en lugar de cerrar sin aviso.
        DispatcherUnhandledException += (_, ev) =>
        {
            MessageBox.Show("Ocurrió un error inesperado:\n\n" + ev.Exception.Message, "MakerLab",
                MessageBoxButton.OK, MessageBoxImage.Error);
            ev.Handled = true;
        };
        base.OnStartup(e);
    }
}
