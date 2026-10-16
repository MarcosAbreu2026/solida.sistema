# Coletor do computador do escritório: a cada 10 minutos lê o Drive e manda para o Supabase.
#   1. pede ao servidor local o dados.json dos agentes (ele busca no Drive e guarda em dados/painel-cache.json)
#   2. roda scripts/exportar-drive.ps1 (orçamentos, projetos, cronogramas, escopo, estoque, evidências)
#   3. roda scripts/enviar-nuvem.mjs (manda tudo para o Supabase: valores/ e todos/)
# O iniciar.bat abre este coletor junto com o servidor (janela minimizada). Registro em dados/coletor-log.txt.

$raiz = Split-Path $PSScriptRoot -Parent
$log = Join-Path $raiz 'dados\coletor-log.txt'
function Registrar([string]$m) { try { Add-Content -LiteralPath $log -Value ("{0:dd/MM/yyyy HH:mm:ss}  {1}" -f (Get-Date), $m) -Encoding UTF8 } catch { } }
$node = @('C:\Program Files\nodejs\node.exe', (Get-Command node -ErrorAction SilentlyContinue).Source) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

Registrar 'Coletor iniciado'
while ($true) {
  try {
    try { Invoke-WebRequest 'http://localhost:8080/api/painel' -UseBasicParsing -TimeoutSec 60 | Out-Null } catch { Registrar "Painel: $($_.Exception.Message)" }
    # se o servidor já está lendo o Drive, espera terminar (só uma leitura por vez)
    for ($i = 0; $i -lt 120 -and @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'exportar-drive\.ps1' }).Count; $i++) { Start-Sleep -Seconds 5 }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $raiz 'scripts\exportar-drive.ps1') | Out-Null
    if ($node) { $saida = & $node (Join-Path $raiz 'scripts\enviar-nuvem.mjs') 2>&1; Registrar ($saida -join ' ') }
    else { Registrar 'Node.js não encontrado: nada enviado para a nuvem' }
  } catch { Registrar "Erro: $($_.Exception.Message)" }
  Start-Sleep -Seconds 600
}
