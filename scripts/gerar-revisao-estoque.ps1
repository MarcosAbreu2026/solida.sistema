# Gera a próxima revisão da planilha de ferramentas (SL_FERRAMENTAS_SOLIDA_R<n+1>.xlsx) com as contagens feitas no site (aba Estoque › Contagem do estoque).
# NÃO mexe na revisão atual: copia, preenche a cópia e grava como a próxima revisão na mesma pasta (PÓS OBRA\FERRAMENTAS\LISTAS).
# Usa o Excel deste computador (as fórmulas de total, situação, comprar e consertar recalculam sozinhas). Precisa do config.local.json (conta do coletor).
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\gerar-revisao-estoque.ps1            (gera a revisão)
#       ... -Simular                                                                         (só mostra o que mudaria; não grava nada)
#       ... -Saida "C:\pasta\teste" -Contagens contagens.json                                (teste: grava em outra pasta, com contagens de um arquivo)
# Regras: só entra contagem mais nova que a "conferência" do local na planilha; item cujo nome na planilha não bate com o da contagem é pulado
# (a planilha foi renumerada); célula com fórmula nunca é sobrescrita. Depois de gerar, o coletor passa a ler a revisão nova sozinho.
param(
  [switch]$Simular,
  [string]$Saida = '',
  [string]$Contagens = '',
  [string]$Raiz = ''
)
$ErrorActionPreference = 'Stop'
$sistema = Split-Path $PSScriptRoot -Parent
$norm = { param($s) ((("$s").Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '') -replace '[^A-Za-z0-9]+', ' ').Trim().ToLower() }

# ---------------------------------------------------------------- planilha atual
if (-not $Raiz) {
  $Raiz = Get-ChildItem 'G:\.shortcut-targets-by-id' -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName 'SOLIDA GERAL' } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Raiz -and (Test-Path 'G:\Meu Drive\SOLIDA GERAL')) { $Raiz = 'G:\Meu Drive\SOLIDA GERAL' }
}
if (-not $Raiz -or -not (Test-Path $Raiz)) { throw 'Pasta SOLIDA GERAL do Google Drive não encontrada (o Drive para computador está aberto?).' }
$pasta = Join-Path $Raiz 'PÓS OBRA\FERRAMENTAS\LISTAS'
$atual = Get-ChildItem $pasta -File | Where-Object { $_.Name -match '(?i)^SL_FERRAMENTAS[ _]S[ÓO]LIDA_R(\d+)\.xlsx$' } |
  Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) } | Select-Object -Last 1
if (-not $atual) { throw "SL_FERRAMENTAS_SOLIDA_Rnn.xlsx não encontrada em $pasta" }
$n = [int]([regex]::Match($atual.Name, '_R(\d+)').Groups[1].Value)
$novoNome = "SL_FERRAMENTAS_SOLIDA_R$($n + 1).xlsx"
$destDir = if ($Saida) { $Saida } else { $pasta }
$dest = Join-Path $destDir $novoNome
if (-not $Simular -and (Test-Path $dest)) { throw "$novoNome já existe em $destDir. Não vou sobrescrever." }

# ---------------------------------------------------------------- contagens (Supabase, ou arquivo de teste)
# (no Windows PowerShell 5.1 um array JSON volta como um objeto só: o foreach solta os itens)
if ($Contagens) { $rows = @((Get-Content $Contagens -Raw -Encoding UTF8 | ConvertFrom-Json) | ForEach-Object { $_ }) }
else {
  $cfg = Get-Content (Join-Path $sistema 'config.local.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $cfg.supabaseUrl -or -not $cfg.coletorEmail) { throw 'config.local.json sem o acesso do coletor.' }
  $tk = Invoke-RestMethod -Method Post -Uri "$($cfg.supabaseUrl)/auth/v1/token?grant_type=password" -Headers @{ apikey = $cfg.chavePublica } -ContentType 'application/json' -Body (@{ email = $cfg.coletorEmail; password = $cfg.coletorSenha } | ConvertTo-Json)
  $h = @{ apikey = $cfg.chavePublica; Authorization = "Bearer $($tk.access_token)" }
  $rows = @(Invoke-RestMethod -Uri "$($cfg.supabaseUrl)/rest/v1/contagens_estoque?select=*&order=data.desc,id.desc&limit=5000" -Headers $h | ForEach-Object { $_ })
}
if (-not $rows.Count) { Write-Host 'Nenhuma contagem feita no site ainda: nada a aplicar.'; exit 0 }
$ultimas = @{}   # a contagem mais nova de cada local + item
foreach ($r in $rows) { $k = "$($r.local)|$($r.cod)"; if (-not $ultimas.ContainsKey($k)) { $ultimas[$k] = $r } }

# ---------------------------------------------------------------- Excel: preenche uma cópia
$xl = $null; $wb = $null
$aplicadas = New-Object Collections.ArrayList; $puladas = New-Object Collections.ArrayList; $datasLocal = @{}
try {
  New-Item -ItemType Directory -Force $destDir | Out-Null
  $trab = if ($Simular) { Join-Path ([IO.Path]::GetTempPath()) "simulacao-$novoNome" } else { $dest }
  Copy-Item -LiteralPath $atual.FullName -Destination $trab -Force
  $xl = New-Object -ComObject Excel.Application; $xl.Visible = $false; $xl.DisplayAlerts = $false
  $wb = $xl.Workbooks.Open($trab, 0, $false)
  $ws = $wb.Worksheets.Item('CONTROLE')
  $ult = $ws.UsedRange.Row + $ws.UsedRange.Rows.Count - 1; $ucol = $ws.UsedRange.Column + $ws.UsedRange.Columns.Count - 1
  # linha de cabeçalho: B = CÓD, C = ITEM
  $cab = 0
  for ($r = 1; $r -le 30 -and -not $cab; $r++) { if (("$($ws.Cells.Item($r, 2).Text)" -match '^C[ÓO]D') -and ("$($ws.Cells.Item($r, 3).Text)" -match 'ITEM')) { $cab = $r } }
  if (-not $cab) { throw 'Não achei o cabeçalho (CÓD / ITEM) na aba CONTROLE.' }
  $nomes = @{}; for ($c = 1; $c -le $ucol; $c++) { $nomes[$c] = (("$($ws.Cells.Item($cab, $c).Text)") -replace '\s+', ' ').Trim().ToUpper() }
  $achaCol = { param($re) ($nomes.Keys | Where-Object { $nomes[$_] -match $re } | Sort-Object | Select-Object -First 1) }
  $colDe = @{ galpao = (& $achaCol '^ESTOQUE ATUAL'); anderson = (& $achaCol '^ANDERSON ATUAL'); nascimento = (& $achaCol '^NASCIM\.? ATUAL'); enio = (& $achaCol '^ENIO ATUAL') }
  $minObra = & $achaCol '^M[ÍI]N\.? OBRA'; $quebr = & $achaCol '^QUEBRAD'
  if ($minObra -and $quebr) { foreach ($c in $nomes.Keys) { if ($c -gt $minObra -and $c -lt $quebr -and $nomes[$c] -match '^(MO|PO)\d') { $colDe[$nomes[$c]] = $c } } }
  # (a busca no hashtable não diferencia maiúscula: Mo465 = MO465)
  # data de conferência atual de cada coluna (linha acima do cabeçalho)
  $confer = @{}
  foreach ($loc in @($colDe.Keys)) { $c = $colDe[$loc]; $v = $ws.Cells.Item($cab - 1, $c).Value2; if ($v -is [double]) { $confer[$loc] = [DateTime]::FromOADate($v).ToString('yyyy-MM-dd') } }
  # linhas: cód → linha
  $linhaDe = @{}; $nomeDe = @{}
  for ($r = $cab + 1; $r -le $ult; $r++) { $cod = "$($ws.Cells.Item($r, 2).Text)".Trim(); if ($cod) { $linhaDe[$cod] = $r; $nomeDe[$cod] = "$($ws.Cells.Item($r, 3).Text)" } }

  foreach ($k in $ultimas.Keys) {
    $c = $ultimas[$k]; $loc = $c.local
    $col = $colDe[$loc]; if (-not $col) { $col = $colDe[$loc.ToUpper()] }
    $desc = "$($c.local) $($c.cod) $($c.item)"
    if (-not $col) { [void]$puladas.Add("${desc}: local sem coluna na planilha"); continue }
    if ($confer[$loc] -and "$($c.data)".Substring(0, 10) -le $confer[$loc]) { [void]$puladas.Add("${desc}: a planilha já foi conferida em $($confer[$loc])"); continue }
    $lin = $linhaDe["$($c.cod)"]
    if (-not $lin) { [void]$puladas.Add("${desc}: código não existe mais na planilha"); continue }
    if ((& $norm $nomeDe["$($c.cod)"]) -ne (& $norm $c.item)) { [void]$puladas.Add("${desc}: na planilha este código agora é '$($nomeDe["$($c.cod)"])'"); continue }
    $cel = $ws.Cells.Item($lin, $col)
    if ($cel.HasFormula) { [void]$puladas.Add("${desc}: a célula tem fórmula"); continue }
    $cel.Value2 = [double]$c.atual
    [void]$aplicadas.Add("$desc = $($c.atual)")
    $d = "$($c.data)".Substring(0, 10); if (-not $datasLocal[$loc] -or $d -gt $datasLocal[$loc]) { $datasLocal[$loc] = $d }
  }
  foreach ($loc in $datasLocal.Keys) { $ws.Cells.Item($cab - 1, $colDe[$loc]).Value2 = ([DateTime]::ParseExact($datasLocal[$loc], 'yyyy-MM-dd', $null)).ToOADate() }
  if ($aplicadas.Count) { $xl.CalculateFull(); $wb.Save() }
  $wb.Close($false); $wb = $null
}
finally {
  if ($wb) { try { $wb.Close($false) } catch { } }
  if ($xl) { try { $xl.Quit() } catch { }; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
}

Write-Host "Planilha base: $($atual.Name) → $(if ($Simular) { '(simulação, nada gravado)' } else { $dest })"
Write-Host "Aplicadas: $($aplicadas.Count)"; $aplicadas | Select-Object -First 15 | ForEach-Object { Write-Host "  + $_" }
if ($puladas.Count) { Write-Host "Puladas: $($puladas.Count)"; $puladas | Select-Object -First 15 | ForEach-Object { Write-Host "  - $_" } }
if ($Simular -or -not $aplicadas.Count) {
  if (-not $Simular -and (Test-Path $dest)) { Remove-Item -LiteralPath $dest -Force; Write-Host 'Nada a aplicar: a cópia foi removida.' }
  if ($Simular -and (Test-Path $trab)) { Remove-Item -LiteralPath $trab -Force }
}
