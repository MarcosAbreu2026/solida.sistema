# Mantem a pasta do sistema igual ao GitHub: de 20 em 20 minutos faz git fetch e, se houver novidade, git pull --ff-only.
# Se o pull mudou algum script que ja esta rodando (servidor, coletor, leitor, o proprio atualizador), reinicia sozinho so esses
# componentes. Aberto pelo iniciar.bat (janela minimizada). Nao usa reset, checkout, clean, push nem force; nao mexe em dados\ nem nos config.
# Registro em dados\atualizar-log.txt.
#   -UmaVez            roda uma vez e sai (para teste)
#   -TesteReinicio     reinicia agora todos os componentes (para teste)
#   -Simular           com -TesteReinicio, so mostra o que reiniciaria
param([switch]$UmaVez, [switch]$TesteReinicio, [switch]$Simular, [int]$Minutos = 20)

$raiz = Split-Path -Parent $PSScriptRoot
$log = Join-Path $raiz 'dados\atualizar-log.txt'
function Anotar($m) { ('{0:dd/MM/yyyy HH:mm:ss}  {1}' -f (Get-Date), $m) | Add-Content -Encoding UTF8 -Path $log }

# arquivos cuja mudanca exige reiniciar os componentes (servidor, coletor, leitor, envio a nuvem e o que eles chamam)
$reiniciar = @('servidor.ps1', 'scripts/coletor.ps1', 'scripts/leitor-whatsapp.ps1', 'scripts/enviar-nuvem.mjs',
  'scripts/efetivo-parser.mjs', 'scripts/evidencias.ps1', 'scripts/exportar-drive.ps1')
$proprio = 'scripts/atualizar-pasta.ps1'

function Achar($script) {
  # processos powershell que rodam esse script (menos este)
  @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*' + $script + '*') })
}
function Subir($script, $argsExtra) {
  $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $raiz $script)) + $argsExtra
  Start-Process -FilePath 'powershell.exe' -ArgumentList $a -WindowStyle Minimized -WorkingDirectory $raiz | Out-Null
}

function ReiniciarComponentes {
  # coletor e leitor: encerra e sobe de novo (como o iniciar.bat)
  foreach ($c in @(@('coletor', 'scripts\coletor.ps1'), @('leitor', 'scripts\leitor-whatsapp.ps1'))) {
    $ps = @(Achar $c[1])
    if ($Simular) { Anotar ("SIMULACAO: reiniciaria {0} (processos: {1})" -f $c[0], (($ps | % ProcessId) -join ',')); continue }
    $ps | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    Subir $c[1] @()
    $voltou = $false
    for ($i = 0; $i -lt 10 -and -not $voltou; $i++) { Start-Sleep -Seconds 2; $voltou = (@(Achar $c[1]).Count -gt 0) }
    if ($voltou) { Anotar ("Reiniciado: {0}" -f $c[0]) } else { Anotar ("ALERTA: {0} nao voltou depois do reinicio" -f $c[0]) }
  }
  # servidor: o iniciar.bat sobe de novo sozinho depois de 5 segundos quando o servidor para com erro
  $srv = @(Achar 'servidor.ps1')
  if ($Simular) { Anotar ("SIMULACAO: reiniciaria servidor (processos: {0})" -f (($srv | % ProcessId) -join ',')); return }
  if ($srv.Count -eq 0) { Anotar 'ALERTA: servidor nao esta rodando (nada a reiniciar; abra o iniciar.bat)'; return }
  $srv | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $ok = $false
  for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    Start-Sleep -Seconds 3
    try { $ok = ((Invoke-WebRequest -Uri 'http://localhost:8080/app/index.html' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) } catch { }
  }
  if ($ok) { Anotar 'Reiniciado: servidor (respondendo em localhost:8080)' } else { Anotar 'ALERTA: servidor nao voltou em 60 s; abra o iniciar.bat' }
}

function ReiniciarSozinho {
  # sobe uma copia nova deste atualizador e encerra esta
  Anotar 'Reiniciando o proprio atualizador (o script dele mudou)'
  Subir $proprio @('-Minutos', $Minutos)
  exit
}

function Atualizar {
  Set-Location $raiz
  & git config core.autocrlf true
  $null = & git fetch origin 2>&1
  if ($LASTEXITCODE -ne 0) { Anotar 'ALERTA: git fetch falhou (sem internet?)'; return }
  $antes = (& git rev-parse HEAD).Trim()
  $depois = (& git rev-parse origin/main).Trim()
  if ($antes -eq $depois) { return }
  $saida = (& git pull --ff-only --autostash origin main 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { Anotar ('ALERTA: git pull falhou: ' + ($saida -replace '\s+', ' ')); return }
  $agora = (& git rev-parse HEAD).Trim()
  $arquivos = @(& git diff --name-only $antes $agora)
  Anotar ('Atualizado {0} -> {1} ({2} arquivos)' -f $antes.Substring(0, 7), $agora.Substring(0, 7), $arquivos.Count)
  $sql = @($arquivos | Where-Object { $_ -like 'supabase/*.sql' })
  if ($sql.Count) { Anotar ('SQL NOVO para o Supabase (rodar no painel): ' + ($sql -join ', ')) }
  if ($arquivos -contains 'iniciar.bat') { Anotar 'REINICIAR o iniciar.bat: o proprio iniciar.bat mudou (fechar a janela e abrir de novo)' }
  $pedem = @($arquivos | Where-Object { $reiniciar -contains $_ })
  if ($pedem.Count) { Anotar ('Mudou ' + ($pedem -join ', ') + ': reiniciando servidor, coletor e leitor'); ReiniciarComponentes }
  if ($arquivos -contains $proprio) { ReiniciarSozinho }
}

if ($TesteReinicio) { Anotar 'Teste de reinicio dos componentes'; ReiniciarComponentes; return }

Anotar ('Atualizador iniciado (a cada {0} min)' -f $Minutos)
do {
  try { Atualizar } catch { Anotar ('ALERTA: ' + $_.Exception.Message) }
  if ($UmaVez) { break }
  Start-Sleep -Seconds ($Minutos * 60)
} while ($true)
