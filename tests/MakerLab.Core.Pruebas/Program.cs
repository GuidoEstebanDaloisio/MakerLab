using System.IO.Compression;
using System.Text.Json.Nodes;
using MakerLab.Core.Arduino;
using MakerLab.Core.Lecciones;
using MakerLab.Core.Proyectos;
using MakerLab.Core.Puente;

// Pruebas del núcleo de MakerLab. Cada prueba corresponde a un caso de prueba
// documentado en el informe (capítulo 5). Se ejecutan con:
//   dotnet run --project tests/MakerLab.Core.Pruebas

var pruebas = new List<(string id, string nombre, Action prueba)>();
void Prueba(string id, string nombre, Action a) => pruebas.Add((id, nombre, a));
void Afirmar(bool condicion, string mensaje) { if (!condicion) throw new Exception(mensaje); }
void Falla<T>(Action a, string contiene) where T : Exception
{
    try { a(); }
    catch (T ex) { Afirmar(ex.Message.Contains(contiene, StringComparison.OrdinalIgnoreCase), $"Mensaje inesperado: {ex.Message}"); return; }
    throw new Exception($"Se esperaba {typeof(T).Name}");
}
string Temporal() { var d = Path.Combine(Path.GetTempPath(), "makerlab-pruebas", Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }
string LeccionJson(string id, int orden = 1) =>
    new JsonObject { ["formato"] = "makerlab-leccion", ["version"] = 1, ["id"] = id, ["orden"] = orden, ["titulo"] = "Prueba " + id,
                     ["bloques"] = new JsonArray("dave_paso"), ["escenario"] = new JsonObject() }.ToJsonString();

var incluidas = Path.Combine(AppContext.BaseDirectory, "lecciones");

Prueba("CP-01", "Las 10 lecciones incluidas son válidas y se listan en orden", () =>
{
    var repo = new RepositorioLecciones(incluidas, Temporal(), "https://app.makerlab/lecciones", "https://lecciones.makerlab");
    var lista = repo.Listar();
    Afirmar(repo.Advertencias.Count == 0, string.Join("; ", repo.Advertencias));
    Afirmar(lista.Count == 10, $"Se esperaban 10 lecciones y hay {lista.Count}");
    Afirmar((string?)lista[0]["id"] == "01-movimiento" && (string?)lista[9]["id"] == "10-libre", "Orden incorrecto");
    Afirmar((string?)lista[0]["urlBase"] == "https://app.makerlab/lecciones/01-movimiento/", "urlBase incorrecta");
});

Prueba("CP-02", "Una lección copiada en la carpeta del docente aparece en la lista", () =>
{
    var usuario = Temporal();
    Directory.CreateDirectory(Path.Combine(usuario, "mi-leccion"));
    File.WriteAllText(Path.Combine(usuario, "mi-leccion", "leccion.json"), LeccionJson("mi-leccion", 50));
    var lista = new RepositorioLecciones(incluidas, usuario, "a", "b").Listar();
    var mia = lista.Single(l => (string?)l["id"] == "mi-leccion");
    Afirmar((string?)mia["origen"] == "importada", "Origen incorrecto");
});

Prueba("CP-03", "Una lección mal escrita se omite sin detener el programa", () =>
{
    var usuario = Temporal();
    Directory.CreateDirectory(Path.Combine(usuario, "rota"));
    File.WriteAllText(Path.Combine(usuario, "rota", "leccion.json"), "{ esto no es json");
    var repo = new RepositorioLecciones(incluidas, usuario, "a", "b");
    Afirmar(repo.Listar().Count == 10, "No debería agregarse la lección rota");
    Afirmar(repo.Advertencias.Count == 1, "Debería informarse una advertencia");
});

Prueba("CP-04", "La validación rechaza lecciones sin id, sin título o sin bloques", () =>
{
    Falla<LeccionInvalidaException>(() => RepositorioLecciones.Validar("""{"formato":"makerlab-leccion","titulo":"x","bloques":["a"]}"""), "id");
    Falla<LeccionInvalidaException>(() => RepositorioLecciones.Validar("""{"formato":"makerlab-leccion","id":"x","bloques":["a"]}"""), "titulo");
    Falla<LeccionInvalidaException>(() => RepositorioLecciones.Validar("""{"formato":"makerlab-leccion","id":"x","titulo":"x","bloques":[]}"""), "bloques");
    Falla<LeccionInvalidaException>(() => RepositorioLecciones.Validar("""{"formato":"otro","id":"x","titulo":"x","bloques":["a"]}"""), "formato");
    Falla<LeccionInvalidaException>(() => RepositorioLecciones.Validar("""{"formato":"makerlab-leccion","id":"../x","titulo":"x","bloques":["a"]}"""), "id");
});

Prueba("CP-05", "Importar una lección desde un .zip (con carpeta interna e imágenes)", () =>
{
    var usuario = Temporal();
    var zip = Path.Combine(Temporal(), "leccion.zip");
    using (var z = ZipFile.Open(zip, ZipArchiveMode.Create))
    {
        using (var w = new StreamWriter(z.CreateEntry("carpeta/leccion.json").Open())) w.Write(LeccionJson("laberinto", 20));
        using (var w = new StreamWriter(z.CreateEntry("carpeta/img/mapa.txt").Open())) w.Write("imagen");
    }
    var repo = new RepositorioLecciones(incluidas, usuario, "a", "b");
    var id = repo.ImportarZip(zip);
    Afirmar(id == "laberinto", "Id incorrecto");
    Afirmar(File.Exists(Path.Combine(usuario, "laberinto", "leccion.json")), "No se extrajo leccion.json");
    Afirmar(File.Exists(Path.Combine(usuario, "laberinto", "img", "mapa.txt")), "No se extrajeron los recursos");
    Afirmar(repo.Listar().Any(l => (string?)l["id"] == "laberinto"), "La lección importada no aparece");
});

Prueba("CP-06", "Un .zip malicioso no puede escribir fuera de la carpeta de lecciones", () =>
{
    var usuario = Temporal();
    var zip = Path.Combine(Temporal(), "malo.zip");
    using (var z = ZipFile.Open(zip, ZipArchiveMode.Create))
    {
        using (var w = new StreamWriter(z.CreateEntry("leccion.json").Open())) w.Write(LeccionJson("mala"));
        using (var w = new StreamWriter(z.CreateEntry("../../afuera.txt").Open())) w.Write("x");
    }
    Falla<LeccionInvalidaException>(() => new RepositorioLecciones(incluidas, usuario, "a", "b").ImportarZip(zip), "rutas no permitidas");
    Afirmar(!File.Exists(Path.Combine(usuario, "..", "afuera.txt")), "Se escribió fuera del destino");
});

Prueba("CP-07", "No se puede importar una lección con el id de una incluida", () =>
{
    var zip = Path.Combine(Temporal(), "dup.zip");
    using (var z = ZipFile.Open(zip, ZipArchiveMode.Create))
    using (var w = new StreamWriter(z.CreateEntry("leccion.json").Open())) w.Write(LeccionJson("01-movimiento"));
    Falla<LeccionInvalidaException>(() => new RepositorioLecciones(incluidas, Temporal(), "a", "b").ImportarZip(zip), "ya existe");
});

Prueba("CP-08", "Guardar y abrir un proyecto conserva el contenido", () =>
{
    var ruta = Path.Combine(Temporal(), "mi-programa.makerlab");
    var contenido = """{"formato":"makerlab-proyecto","version":1,"leccion":"01-movimiento","bloques":{"blocks":{"blocks":[]}}}""";
    AlmacenProyectos.Guardar(ruta, contenido);
    Afirmar(AlmacenProyectos.Abrir(ruta) == contenido, "El contenido cambió");
    File.WriteAllText(ruta, "basura");
    Falla<ProyectoInvalidoException>(() => AlmacenProyectos.Abrir(ruta), "dañado");
});

Prueba("CP-09", "Se interpretan los puertos de arduino-cli 1.x y 0.x", () =>
{
    var v1 = """{"detected_ports":[{"port":{"address":"COM4","protocol":"serial"}},{"port":{"address":"COM3","protocol":"serial"},"matching_boards":[{"name":"Arduino Uno","fqbn":"arduino:avr:uno"}]},{"port":{"address":"192.168.0.2","protocol":"network"}}]}""";
    var p = CargadorArduino.ParsearPuertos(v1);
    Afirmar(p.Count == 2, "Debería ignorar los puertos de red");
    Afirmar(p[0].Puerto == "COM3" && p[0].Placa == "Arduino Uno", "La placa reconocida debe ir primero");
    var v0 = """[{"port":{"address":"COM7","protocol":"serial"}}]""";
    Afirmar(CargadorArduino.ParsearPuertos(v0).Single().Puerto == "COM7", "Formato 0.x");
    Afirmar(CargadorArduino.ParsearPuertos("").Count == 0, "Salida vacía");
});

Prueba("CP-10", "Los errores de carga se explican en lenguaje claro", () =>
{
    Afirmar(CargadorArduino.TraducirError("avrdude: stk500_recv(): programmer is not responding").Contains("no responde"), "No responde");
    Afirmar(CargadorArduino.TraducirError("avrdude: ser_open(): can't open device \"\\\\.\\COM3\": Access is denied.").Contains("ocupado"), "Puerto ocupado");
    Afirmar(CargadorArduino.TraducirError("Error during build: Platform 'arduino:avr' not found").Contains("paquete"), "Falta core");
});

Prueba("CP-11", "Sin arduino-cli, MakerLab informa el problema y el simulador sigue disponible", () =>
{
    var c = new CargadorArduino(Temporal(), Temporal());
    Afirmar(!c.Disponible, "No debería estar disponible");
    var ex = Falla2(() => c.ListarPuertosAsync().GetAwaiter().GetResult());
    Afirmar(ex.Message.Contains("simulador"), ex.Message);
});

Prueba("CP-12", "El puente responde a la interfaz y rechaza comandos desconocidos", () =>
{
    var ui = new UiSimulada();
    var proc = new ProcesadorMensajes(new RepositorioLecciones(incluidas, Temporal(), "a", "b"), new CargadorArduino(Temporal(), Temporal()), ui, (_, _) => { });
    var r = JsonNode.Parse(proc.ProcesarAsync("""{"id":"7","comando":"lecciones.listar"}""").Result)!;
    Afirmar((bool)r["ok"]! && (string?)r["id"] == "7" && r["resultado"]!.AsArray().Count == 10, r.ToJsonString());
    var d = JsonNode.Parse(proc.ProcesarAsync("""{"id":"8","comando":"borrar.todo"}""").Result)!;
    Afirmar(!(bool)d["ok"]! && ((string?)d["error"])!.Contains("desconocido"), d.ToJsonString());
    var s = JsonNode.Parse(proc.ProcesarAsync("""{"id":"9","comando":"robot.subir","datos":{"codigo":"x","puerto":"COM3"}}""").Result)!;
    Afirmar(!(bool)s["ok"]!, "Sin arduino-cli no debería poder subir");
});

Prueba("CP-13", "Guardar desde la interfaz usa el diálogo y valida el contenido", () =>
{
    var ui = new UiSimulada { RutaGuardar = Path.Combine(Temporal(), "p.makerlab") };
    var proc = new ProcesadorMensajes(new RepositorioLecciones(incluidas, Temporal(), "a", "b"), new CargadorArduino(Temporal(), Temporal()), ui, (_, _) => { });
    var contenido = JsonValue.Create("""{"formato":"makerlab-proyecto","bloques":{}}""")!.ToJsonString();
    var r = JsonNode.Parse(proc.ProcesarAsync("""{"id":"1","comando":"proyecto.guardar","datos":{"nombre":"p.makerlab","contenido":""" + contenido + "}}").Result)!;
    Afirmar((bool)r["ok"]! && File.Exists(ui.RutaGuardar), r.ToJsonString());
    var mal = JsonNode.Parse(proc.ProcesarAsync("""{"id":"2","comando":"proyecto.guardar","datos":{"contenido":"hola"}}""").Result)!;
    Afirmar(!(bool)mal["ok"]!, "Debería rechazar contenido inválido");
});

int ok = 0;
foreach (var (id, nombre, prueba) in pruebas)
{
    try { prueba(); ok++; Console.WriteLine($"  OK     {id}  {nombre}"); }
    catch (Exception ex) { Console.WriteLine($"  FALLA  {id}  {nombre}\n         {ex.Message}"); }
}
Console.WriteLine($"\n{ok} de {pruebas.Count} pruebas superadas.");
return ok == pruebas.Count ? 0 : 1;

static Exception Falla2(Action a) { try { a(); } catch (Exception ex) { return ex; } throw new Exception("Se esperaba una excepción"); }

sealed class UiSimulada : IServiciosUi
{
    public string? RutaGuardar { get; set; }
    public string? RutaAbrir { get; set; }
    public string? ElegirArchivoGuardar(string nombreSugerido, string descripcion, string extension) => RutaGuardar;
    public string? ElegirArchivoAbrir(string descripcion, string extension) => RutaAbrir;
    public void AbrirCarpeta(string ruta) { }
}
