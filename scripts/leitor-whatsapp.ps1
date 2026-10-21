# Leitor do WhatsApp do computador do escritório: de ~15 em 15 minutos, de segunda a sexta, das 7h às 18h, lê as conversas
# configuradas (dados/whatsapp-grupos.json) e manda o resultado para a nuvem. O iniciar.bat abre este leitor junto com o servidor
# (janela minimizada). Se o WhatsApp Web não estiver conectado, ele só registra o aviso. Registro em dados/whatsapp-log.txt.

$raiz = Split-Path $PSScriptRoot -Parent
$log = Join-Path $raiz 'dados\whatsapp-log.txt'
function Registrar([string]$m) { try { Add-Content -LiteralPath $log -Value ("{0:dd/MM/yyyy HH:mm:ss}  {1}" -f (Get-Date), $m) -Encoding UTF8 } catch { } }
$node = @('C:\Program Files\nodejs\node.exe', (Get-Command node -ErrorAction SilentlyContinue).Source) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $node) { Registrar 'Node.js não encontrado: leitor do WhatsApp parado'; exit 1 }

Registrar 'Leitor do WhatsApp iniciado'
Start-Sleep -Seconds 90   # deixa o servidor e o coletor subirem primeiro
while ($true) {
  $agora = Get-Date
  $util = $agora.DayOfWeek -ne 'Saturday' -and $agora.DayOfWeek -ne 'Sunday' -and $agora.Hour -ge 7 -and $agora.Hour -lt 18
  if ($util -and -not (Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'whatsapp-perfil' })) {
    try {
      $saida = & $node (Join-Path $raiz 'scripts\leitor-whatsapp.mjs') 2>&1
      Registrar ($saida -join ' ')
      & $node (Join-Path $raiz 'scripts\enviar-nuvem.mjs') 2>&1 | Out-Null
    } catch { Registrar "Erro: $($_.Exception.Message)" }
  }
  Start-Sleep -Seconds (Get-Random -Minimum 840 -Maximum 1020)   # 14 a 17 minutos, nunca em intervalo fixo
}