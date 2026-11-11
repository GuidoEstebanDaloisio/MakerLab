# Genera la versión portable de MakerLab (carpeta + .zip) lista para copiar en
# un pendrive. Incluye el entorno de .NET, por lo que no hay que instalar nada más.
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$salida = Join-Path $raiz "publicar\MakerLab"
if (Test-Path $salida) { Remove-Item $salida -Recurse -Force }

dotnet publish (Join-Path $raiz "src\MakerLab.App\MakerLab.App.csproj") -c Release -r win-x64 --self-contained true -o $salida
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación" }

if (-not (Test-Path (Join-Path $salida "tools\arduino-cli\arduino-cli.exe"))) {
    Write-Warning "No se encontró arduino-cli: la versión publicada solo tendrá el simulador. Ejecutá antes scripts\preparar-arduino-cli.ps1"
}

$zip = Join-Path $raiz "publicar\MakerLab-portable.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path $salida -DestinationPath $zip
$tamano = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Listo: $zip ($tamano MB)"
