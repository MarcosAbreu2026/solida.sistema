# Mantem a pasta do sistema igual ao GitHub: de 20 em 20 minutos faz git fetch e, se houver novidade, git pull --ff-only.
# Aberto pelo iniciar.bat (janela minimizada). Nao usa reset, checkout, clean, push nem force; nao mexe em dados\ nem nos config.
# Registro em dados\atualizar-log.txt. Com -UmaVez roda uma vez e sai (para teste).
param([switch]$UmaVez, [int]$Minutos = 20)

$raiz = Split-Path -Parent $PSScriptRoot
$log = Join-Path $raiz 'dados\atualizar-log.txt'
function Anotar($m) { ('{0:dd/MM/yyyy HH:mm:ss}  {1}' -f (Get-Date), $m) | Add-Content -Encoding UTF8 -Path $log }

# arquivos que so valem depois de reiniciar o iniciar.bat (servidor, coletor, leitor, envio a nuvem)
$reiniciar = @('servidor.ps1', 'iniciar.bat', 'scripts/coletor.ps1', 'scripts/leitor-whatsapp.ps1', 'scripts/enviar-nuvem.mjs',
  'scripts/efetivo-parser.mjs', 'scripts/evidencias.ps1', 'scripts/exportar-drive.ps1', 'scripts/atualizar-pasta.ps1')

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
  $pedem = @($arquivos | Where-Object { $reiniciar -contains $_ })
  if ($pedem.Count) { Anotar ('REINICIAR o iniciar.bat: mudou ' + ($pedem -join ', ')) }
  $sql = @($arquivos | Where-Object { $_ -like 'supabase/*.sql' })
  if ($sql.Count) { Anotar ('SQL NOVO para o Supabase (rodar no painel): ' + ($sql -join ', ')) }
}

Anotar ('Atualizador iniciado (a cada {0} min)' -f $Minutos)
do {
  try { Atualizar } catch { Anotar ('ALERTA: ' + $_.Exception.Message) }
  if ($UmaVez) { break }
  Start-Sleep -Seconds ($Minutos * 60)
} while ($true)
