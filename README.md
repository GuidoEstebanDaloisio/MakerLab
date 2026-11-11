# MakerLab

Entorno de programación por bloques y simulador 2D para aprender robótica con
el robot educativo **DAVE**. Funciona sin conexión a internet en Windows 10 y 11.

## Estructura

```
MakerLab.sln
src/
  MakerLab.Core/          Núcleo en C#: lecciones, proyectos, carga al Arduino, mensajes
  MakerLab.App/           Aplicación de escritorio (WPF + WebView2)
    wwwroot/              Interfaz: editor de bloques (Blockly), simulador y lecciones
      js/                 bloques, generadores de código, simulador y lógica de la interfaz
      lecciones/          una carpeta por lección (leccion.json)
      lib/blockly/        Blockly 12.5.1 (copia local, licencia Apache 2.0)
    tools/arduino-cli/    (se genera con scripts/preparar-arduino-cli.ps1)
tests/MakerLab.Core.Pruebas/   Pruebas automáticas del núcleo
scripts/                  Preparación de arduino-cli y publicación
hardware/DAVE.md          Materiales y conexiones del robot
docs/formato-lecciones.md Cómo crear lecciones nuevas
```

## Requisitos para desarrollar

- Windows 10 u 11.
- [SDK de .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0).
- Visual Studio Code con la extensión **C# Dev Kit**.
- Opcional: copiar la carpeta `scripts/vscode` como `.vscode` en la raíz del proyecto para tener las tareas de VS Code (ejecutar, probar, publicar).

## Ejecutar

Desde una terminal en esta carpeta:

```
dotnet run --project src/MakerLab.App
```

O en VS Code: **Terminal → Ejecutar tarea → Ejecutar MakerLab**.

La primera compilación descarga el paquete WebView2 de NuGet (requiere internet
solo esa vez).

## Pruebas

```
dotnet run --project tests/MakerLab.Core.Pruebas
```

Las pruebas de la interfaz y del simulador (resolución de las 10 lecciones) se
documentan en el informe.

## Cargar programas en el robot

MakerLab usa arduino-cli para compilar y cargar el programa en el Arduino. Para
que funcione sin internet, arduino-cli y el paquete de placas se guardan dentro
de la aplicación. Se preparan una sola vez, con internet:

```
powershell -ExecutionPolicy Bypass -File scripts/preparar-arduino-cli.ps1
```

Sin este paso, MakerLab funciona igual pero solo con el simulador.

## Publicar (versión para el pendrive)

```
powershell -ExecutionPolicy Bypass -File scripts/publicar.ps1
```

Genera `publicar/MakerLab-portable.zip`. Se descomprime en cualquier carpeta y
se abre `MakerLab.exe`; no necesita instalación ni .NET.

Si una computadora no tiene el componente WebView2 (Windows 10 sin
actualizar), se puede agregar a la carpeta el instalador sin conexión
"Evergreen Standalone Installer" de Microsoft Edge WebView2.

## Probar la interfaz en el navegador

La carpeta `src/MakerLab.App/wwwroot` también funciona en un navegador, servida
por cualquier servidor local (por ejemplo, la extensión *Live Server* de VS
Code). En ese modo se puede usar todo menos "Enviar a DAVE".

## Licencia

MakerLab se distribuye con la licencia GNU GPL 3.0 (ver `LICENSE`): se puede usar, copiar, modificar y redistribuir, siempre que las versiones modificadas también se publiquen con su código fuente bajo la misma licencia.

Las lecciones (`src/MakerLab.App/wwwroot/lecciones`) y la documentación del robot DAVE (`hardware/`) se publican con la licencia Creative Commons Atribución-CompartirIgual 4.0 (CC BY-SA 4.0).

Los componentes de terceros conservan sus licencias: Blockly (Apache 2.0), .NET y WebView2 (MIT / términos de Microsoft), arduino-cli (GPL 3.0) y el núcleo Arduino AVR (LGPL).
