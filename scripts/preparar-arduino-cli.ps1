# Descarga arduino-cli y el paquete de placas Arduino AVR (Arduino Uno) dentro
# de src/MakerLab.App/tools/arduino-cli. Se ejecuta UNA sola vez, en la
# computadora de desarrollo y con internet. Después, MakerLab carga programas
# en el robot sin conexión, porque todo queda dentro de su carpeta.
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz "src\MakerLab.App\tools\arduino-cli"
New-Item -ItemType Directory -Force -Path $destino | Out-Null

$zip = Join-Path $env:TEMP "arduino-cli.zip"
Write-Host "Descargando arduino-cli..."
Invoke-WebRequest "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip" -OutFile $zip
Expand-Archive $zip -DestinationPath $destino -Force
Remove-Item $zip

# Las mismas carpetas que usa MakerLab al ejecutar arduino-cli (ver CargadorArduino.cs).
$env:ARDUINO_DIRECTORIES_DATA = Join-Path $destino "datos"
$env:ARDUINO_DIRECTORIES_DOWNLOADS = Join-Path $destino "descargas"
$env:ARDUINO_DIRECTORIES_USER = Join-Path $destino "usuario"

$cli = Join-Path $destino "arduino-cli.exe"
Write-Host "Instalando el paquete de placas arduino:avr..."
& $cli core update-index
& $cli core install arduino:avr

# Prueba: compilar un programa vacío confirma que todo quedó instalado.
$prueba = Join-Path $env:TEMP "prueba_makerlab"
New-Item -ItemType Directory -Force -Path $prueba | Out-Null
Set-Content (Join-Path $prueba "prueba_makerlab.ino") "void setup() {}`nvoid loop() {}"
& $cli compile --fqbn arduino:avr:uno $prueba
Remove-Item $prueba -Recurse -Force
Remove-Item (Join-Path $destino "descargas") -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Listo. arduino-cli quedó en $destino"
