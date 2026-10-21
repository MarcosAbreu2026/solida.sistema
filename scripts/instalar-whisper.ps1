# Instala, neste computador, o que a transcrição das reuniões precisa (Whisper local + ffmpeg).
# Rode UMA vez no computador do escritório (e de novo se o computador do escritório mudar):
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-whisper.ps1            (modelo "small": bom e rápido, ~470 MB)
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-whisper.ps1 -Modelo medium   (mais preciso, mais lento, ~1,5 GB)
# Tudo vai para a pasta ferramentas\ do projeto (que não vai para o GitHub). Depois disso o coletor já transcreve sozinho.
param([ValidateSet('base', 'small', 'medium')][string]$Modelo = 'small')
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
$whisper = Join-Path $raiz 'ferramentas\whisper'; $ffmpeg = Join-Path $raiz 'ferramentas\ffmpeg'
New-Item -ItemType Directory -Force $whisper, (Join-Path $whisper 'modelos'), $ffmpeg | Out-Null

function Baixar($url, $destino) { & curl.exe -L -C - --retry 5 --retry-delay 5 -sS -o $destino $url; if ($LASTEXITCODE -ne 0) { throw "Não consegui baixar $url" } }

if (-not (Get-ChildItem $whisper -Recurse -Filter 'whisper-cli.exe' -ErrorAction SilentlyContinue)) {
  Write-Host 'Baixando o programa do Whisper (cerca de 20 MB)…'
  $zip = Join-Path $whisper 'whisper.zip'
  Baixar 'https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-blas-bin-x64.zip' $zip
  Expand-Archive $zip -DestinationPath $whisper -Force; Remove-Item $zip
}
$arqModelo = Join-Path $whisper "modelos\ggml-$Modelo.bin"
if (-not (Test-Path $arqModelo) -or (Get-Item $arqModelo).Length -lt 50MB) {
  Write-Host "Baixando o modelo de voz '$Modelo' (pode demorar alguns minutos)…"
  Baixar "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$Modelo.bin" $arqModelo
}
if (-not (Get-ChildItem $ffmpeg -Recurse -Filter 'ffmpeg.exe' -ErrorAction SilentlyContinue)) {
  Write-Host 'Baixando o ffmpeg (conversor de áudio, cerca de 90 MB)…'
  $zip = Join-Path $ffmpeg 'ffmpeg.zip'
  Baixar 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $zip
  Expand-Archive $zip -DestinationPath $ffmpeg -Force; Remove-Item $zip
}
Write-Host ''
Write-Host "Pronto. Modelo instalado: $Modelo. Para testar: node scripts\transcrever-reunioes.mjs --arquivo caminho\do\audio.wav"
