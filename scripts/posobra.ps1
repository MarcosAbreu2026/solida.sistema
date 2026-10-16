# Pós-obra: lê direto dos arquivos que a equipe atualiza no Drive e gera as tabelas do sistema
# (obras, servicos, agenda, financeiro em dados/json). Carregado por exportar-drive.ps1 (usa Ler-Xlsx, DeSerial,
# Numero, Iso, $Raiz, $Saida, $utf8) — sempre a revisão de MAIOR número de cada arquivo:
#   PÓS OBRA\CONTROLE\Controle Operacional Pós-Obra_R08.xlsx   → obras e serviços (uma linha = uma OS)
#   PÓS OBRA\PO_CONTROLE_COBRANÇA_R42.xlsx                     → financeiro (abas ANDAMENTO e FINALIZADO)
#   PÓS OBRA\CONTROLE\Agenda\PAS_Programação da Agenda Semanal_M11.xlsx → agenda (uma aba por semana)
# Equipe (nomes, apelidos, diárias) e listas continuam como estão em dados/json: a planilha de origem não tem isso.
# Os nomes de obra variam entre os arquivos ("Po288 Quinzenal", "PO_88_2026...", "Po casa shopping"): o número da
# obra (PO/MO + dígitos) manda; sem número, vale a tabela de apelidos abaixo e a comparação com as obras conhecidas.

$DESDE_FINANCEIRO = '2026-08-17'   # aba FINALIZADO: só entra o que é desta data em diante

# apelido (como aparece escrito, sem acento e em minúsculas) → obra. A primeira que casar vale.
$APELIDOS_OBRA = @(
  @('liessin.*audit|lienssin.*audit', 'PO591 - Liessin (aditivo auditório)'),
  @('liessin|lienssin', 'PO - Liessin Leblon'),
  @('^escritorio$', 'PO - Escritório Posto 6'),
  @('^deposito$', 'Interno - Depósito'),
  @('apt solida|apartamento solida', 'PO - Apartamento Sólida'),
  @('arpo', 'PO - ArpoBrasil'),
  @('bulhoes', 'PO - Bulhões'),
  @('junior', 'PO - Junior (drenos)'),
  @('horizon', 'PO - Horizon Rio'),
  @('sinduscon|sinduscom', 'Chamado - Sinduscon'),
  @('^ale$|alexandre', 'PO - Alexandre')
)

function Sem-Acento([string]$s) {
  $n = $s.Normalize([Text.NormalizationForm]::FormD)
  return -join ($n.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne 'NonSpacingMark' })
}
function Chave-Nome([string]$s) { return ((Sem-Acento $s).ToLower() -replace '[^a-z0-9]+', ' ').Trim() }
function Data-Iso($v) {
  if (-not $v) { return $null }
  $d = DeSerial $v; if ($d) { return Iso $d }
  $m = [regex]::Match("$v", '^(\d{2})/(\d{2})/(\d{4})$'); if ($m.Success) { return "$($m.Groups[3].Value)-$($m.Groups[2].Value)-$($m.Groups[1].Value)" }
  return $null
}
function Ultimo-Arquivo([string]$pasta, [string]$filtro, [string]$letra) {
  Get-ChildItem $pasta -File -Filter $filtro -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch '(?i)c[óo]pia|^~\$|old|backup' -and $_.Name -match "_$letra(\d+)" } |
    Sort-Object { [int]([regex]::Match($_.Name, "_$letra(\d+)").Groups[1].Value) }, LastWriteTime | Select-Object -Last 1
}

# ---------------------------------------------------------------- nomes de obra
$script:conhecidas = New-Object Collections.ArrayList     # nomes já usados no sistema (obras.json)
$script:porNumero = @{}                                   # 88 → "PO088"
function Preparar-Conhecidas([string]$arqObras) {
  $script:conhecidas.Clear(); $script:porNumero.Clear()
  if (Test-Path $arqObras) {
    foreach ($o in (Get-Content $arqObras -Raw -Encoding UTF8 | ConvertFrom-Json)) {
      if ($o.value -and $o.Count) { foreach ($q in $o.value) { [void]$script:conhecidas.Add("$($q.obra)") } } else { [void]$script:conhecidas.Add("$($o.obra)") }
    }
  }
  foreach ($n in $script:conhecidas) {
    $m = [regex]::Match($n, '^(?i)(PO|MO)\s*0*(\d{2,3})\b')
    if ($m.Success -and -not $script:porNumero.ContainsKey([int]$m.Groups[2].Value)) { $script:porNumero[[int]$m.Groups[2].Value] = $n }
  }
}
$script:cacheNome = @{}
function Nome-Obra([string]$texto) {
  $texto = "$texto".Trim(); if (-not $texto) { return $null }
  if ($script:cacheNome.ContainsKey($texto)) { return $script:cacheNome[$texto] }
  $nome = $null
  # 1) número da obra (PO/MO + dígitos)
  $m = [regex]::Match($texto, '(?i)(?<![A-Za-z])(po|mo)[\s_-]*0*(\d{2,3})(?!\d)')
  if ($m.Success) {
    $num = [int]$m.Groups[2].Value
    if ($script:porNumero.ContainsKey($num)) { $nome = $script:porNumero[$num] }
    else {
      $resto = ($texto.Substring($m.Index + $m.Length) -replace '^[\s_\-–]+', '').Trim()
      $desc = if ($resto -match '^[A-Za-zÀ-ú][\wÀ-ú ()\.\-]{2,40}$' -and $resto -notmatch '_20|_R\d') { " - $resto" } else { '' }
      $nome = ('{0}{1:000}' -f $m.Groups[1].Value.ToUpper(), $num) + $desc
    }
  }
  # 2) apelidos conhecidos
  $k = Chave-Nome ($texto -replace '^(?i)po[\s_]+', '')
  if (-not $nome) { foreach ($a in $APELIDOS_OBRA) { if ($k -match $a[0]) { $nome = $a[1]; break } } }
  # 3) igual a uma obra conhecida (sem o prefixo PO -/Chamado -/Interno -), ou contida em uma só
  if (-not $nome) {
    $cand = @($script:conhecidas | Where-Object { (Chave-Nome (($_ -replace '^(PO|Chamado|Interno)\s*-\s*', ''))) -eq $k })
    if (-not $cand.Count -and $k.Length -ge 5) { $cand = @($script:conhecidas | Where-Object { (Chave-Nome $_) -like "*$k*" }) }
    if ($cand.Count -eq 1) { $nome = $cand[0] }
  }
  # 4) obra nova
  if (-not $nome) { $limpo = ($texto -replace '^(?i)po[\s_]+', '' -replace '_', ' ').Trim(); $nome = 'PO - ' + $limpo.Substring(0, 1).ToUpper() + $limpo.Substring(1) }
  $script:cacheNome[$texto] = $nome
  if (-not $script:conhecidas.Contains($nome)) { [void]$script:conhecidas.Add($nome) }
  return $nome
}

# ---------------------------------------------------------------- leituras
function Ler-Operacional($arq) {
  $abas = Ler-Xlsx $arq.FullName 0
  $linhas = $abas[@($abas.Keys)[0]]
  $obras = New-Object Collections.ArrayList; $servicos = New-Object Collections.ArrayList; $cont = 0
  foreach ($l in $linhas) {
    if ($l.n -lt 5 -or -not $l.c['A']) { continue }
    $c = $l.c; $cont++
    $obra = Nome-Obra $c['A']
    $prazo = Data-Iso $c['I']; if (-not $prazo -and $c['I']) { $prazo = $c['I'] }
    $sit = $c['D']
    [void]$servicos.Add([ordered]@{ os = ('OS-{0:000}' -f $cont); obra = $obra; situacao = $(if ($sit) { $sit } else { $null }); data_inicio = (Data-Iso $c['E']); prazo = $prazo
      concluido_em = $null; profissionais = $c['H']; relato = $c['F']; obs = $c['J']; dias_atraso = $null; status_prazo = $null
      custo_mo = (Numero $c['G']); gastos = $c['K']; materiais = $c['L']; agenda_fixa = $c['M']; origem = "$($arq.Name) linha $($l.n)"; _linha = $l.n })
    [void]$obras.Add([ordered]@{ obra = $obra; cliente = $c['B']; endereco = $c['C']; situacao = $sit; responsavel = $c['H'] })
  }
  return @{ obras = $obras; servicos = $servicos }
}

function Ler-Agenda($arq) {
  $abas = Ler-Xlsx $arq.FullName 0
  $porDia = @{}   # "data|obra" → texto (a aba mais nova vale; linhas da mesma obra no mesmo dia se juntam)
  foreach ($nome in $abas.Keys) {
    $linhas = $abas[$nome]
    $naAba = @{}
    $cab = $linhas | Where-Object { $_.c['A'] -eq 'Status' -and $_.c['B'] -eq 'Obra' } | Select-Object -First 1
    if (-not $cab) { continue }
    $datas = @{}
    foreach ($k in $cab.c.Keys) { if ($k -notin 'A', 'B') { $d = Data-Iso $cab.c[$k]; if ($d) { $datas[$k] = $d } } }
    foreach ($l in ($linhas | Where-Object { $_.n -gt $cab.n -and $_.c['B'] })) {
      $obra = Nome-Obra $l.c['B']
      foreach ($k in $datas.Keys) {
        $t = $l.c[$k]; if (-not $t) { continue }
        $chave = "$($datas[$k])|$obra"
        if (-not $naAba.ContainsKey($chave)) { $naAba[$chave] = [ordered]@{ obra = $obra; data = $datas[$k]; textos = New-Object Collections.ArrayList } }
        [void]$naAba[$chave].textos.Add(($t -replace '\s+', ' ').Trim())
      }
    }
    foreach ($chave in $naAba.Keys) { $e = $naAba[$chave]; $porDia[$chave] = [ordered]@{ obra = $e.obra; data = $e.data; texto = (@($e.textos | Select-Object -Unique) -join ' / ') } }
  }
  return @($porDia.Values | Sort-Object { $_.data }, { $_.obra })
}

function Ler-Cobranca($arq) {
  $abas = Ler-Xlsx $arq.FullName 0 @('ANDAMENTO', 'FINALIZADO')
  $fin = New-Object Collections.ArrayList
  $linhaFin = {
    param($c, $nOS, $statusFin, $data, $comData)
    $obra = Nome-Obra $nOS
    $nome = ($nOS -replace '\s+', ' ').Trim()
    $total = Numero $c['I']; $rec = Numero $c['J']; $areceber = Numero $c['K']; $apagar = Numero $c['M']
    $pg = Data-Iso $c['G']
    if ($rec -ne $null -and $rec -gt 0) { [void]$fin.Add([ordered]@{ data = $(if ($comData) { $pg } else { $null }); obra = $obra; tipo = 'Receita (cobrança)'; descricao = "$nome — recebido"; contraparte = $null; valor = $rec; pago_recebido = 'Sim' }) }
    if ($areceber -ne $null -and $areceber -gt 0.009) {
      [void]$fin.Add([ordered]@{ data = $pg; obra = $obra; tipo = 'Receita (cobrança)'; descricao = "$nome — saldo a receber$(if ($statusFin) { " ($statusFin)" })"; contraparte = $null; valor = [Math]::Round($areceber, 2); pago_recebido = 'Não' })
    } elseif (($rec -eq $null -or $rec -le 0) -and $total -ne $null -and $total -gt 0) {
      [void]$fin.Add([ordered]@{ data = $pg; obra = $obra; tipo = 'Receita (cobrança)'; descricao = "$nome — a receber$(if ($statusFin) { " ($statusFin)" })"; contraparte = $null; valor = $total; pago_recebido = 'Não' })
    }
    if ($apagar -ne $null -and $apagar -gt 0) { [void]$fin.Add([ordered]@{ data = $null; obra = $obra; tipo = 'Serviço terceirizado'; descricao = "$nome — a pagar (pago direto ao fornecedor)"; contraparte = $null; valor = $apagar; pago_recebido = 'Não' }) }
  }
  # ANDAMENTO: linhas 7 em diante, até "Total"
  foreach ($l in $abas['ANDAMENTO']) {
    if ($l.n -lt 7 -or -not $l.c['A'] -or "$($l.c['A'])" -match '(?i)^total') { continue }
    & $linhaFin $l.c $l.c['A'] $l.c['H'] $null $false
  }
  # FINALIZADO: a 2ª tabela (depois do cabeçalho "Nº O.S"); entra o que é de 17/08/2026 em diante
  $cabF = $abas['FINALIZADO'] | Where-Object { "$($_.c['A'])" -match '^N[º°o]\s*O\.?S' } | Select-Object -Last 1
  if ($cabF) {
    $entrou = $false
    foreach ($l in ($abas['FINALIZADO'] | Where-Object { $_.n -gt $cabF.n -and $_.c['A'] })) {
      $pg = Data-Iso $l.c['G']
      if (-not $entrou -and $pg -and $pg -ge $DESDE_FINANCEIRO) { $entrou = $true }   # a partir da 1ª linha paga desde a data
      if ($entrou) { & $linhaFin $l.c $l.c['A'] $l.c['H'] $null $true }
    }
  }
  return $fin
}

# ---------------------------------------------------------------- principal
function Exportar-PosObra([string]$pastaJson) {
  $po = Join-Path $Raiz 'PÓS OBRA'
  if (-not (Test-Path $po)) { Write-Host 'Pós-obra: pasta PÓS OBRA não encontrada.'; return }
  $arqOp = Ultimo-Arquivo (Join-Path $po 'CONTROLE') 'Controle Operacional*.xlsx' 'R'
  $arqCob = Ultimo-Arquivo $po 'PO_CONTROLE_COBRAN*.xlsx' 'R'
  $arqAg = Ultimo-Arquivo (Join-Path $po 'CONTROLE\Agenda') 'PAS_*.xlsx' 'M'
  if (-not $arqOp) { Write-Host 'Pós-obra: Controle Operacional não encontrado.'; return }
  # nada mudou desde a última leitura: não lê de novo
  $assinatura = (@($arqOp, $arqCob, $arqAg) | Where-Object { $_ } | ForEach-Object { "$($_.Name)|$($_.LastWriteTime.ToString('o'))" }) -join ';'
  $arqEstado = Join-Path $pastaJson 'posobra-estado.json'
  if ((Test-Path $arqEstado) -and (Test-Path (Join-Path $pastaJson 'servicos.json'))) {
    try { if ((Get-Content $arqEstado -Raw -Encoding UTF8 | ConvertFrom-Json).assinatura -eq $assinatura) { Write-Host "Pós-obra: sem mudanças ($($arqOp.Name))"; return } } catch { }
  }
  # guarda a cópia da planilha integrada antiga (R01), uma vez
  $bk = Join-Path (Split-Path $pastaJson -Parent) 'posobra-r01-backup'
  if (-not (Test-Path $bk)) { New-Item -ItemType Directory -Force $bk | Out-Null; foreach ($n in 'obras', 'servicos', 'agenda', 'financeiro') { if (Test-Path "$pastaJson\$n.json") { Copy-Item "$pastaJson\$n.json" $bk } } }

  Preparar-Conhecidas (Join-Path $pastaJson 'obras.json')
  $op = Ler-Operacional $arqOp
  $agenda = if ($arqAg) { Ler-Agenda $arqAg } else { @() }
  $fin = if ($arqCob) { Ler-Cobranca $arqCob } else { New-Object Collections.ArrayList }

  # obras: as que já existiam (com cliente, endereço, tipo) + as novas dos arquivos
  $velhas = @{}
  $arqObras = Join-Path $pastaJson 'obras.json'
  if (Test-Path $arqObras) { foreach ($o in (Get-Content $arqObras -Raw -Encoding UTF8 | ConvertFrom-Json)) { $q = if ($o.value -and $o.Count) { $o.value } else { @($o) }; foreach ($x in $q) { $velhas["$($x.obra)"] = $x } } }
  $obras = New-Object Collections.ArrayList; $vistos = @{}; $n = 4
  $novas = New-Object Collections.ArrayList
  foreach ($o in $op.obras) { if ($o.obra -and -not $vistos.ContainsKey($o.obra)) { $vistos[$o.obra] = $o; [void]$novas.Add($o.obra) } }
  foreach ($nome in (@($velhas.Keys) + @($agenda | ForEach-Object { $_.obra }) + @($fin | ForEach-Object { $_.obra }) | Where-Object { $_ } | Select-Object -Unique)) {
    if (-not $vistos.ContainsKey($nome)) { $vistos[$nome] = $null }
  }
  foreach ($nome in ($vistos.Keys | Sort-Object { if ($_ -match '^(PO|MO)\s*\d') { 0 } else { 1 } }, { $_ })) {
    $n++
    $v = $velhas[$nome]; $s = $vistos[$nome]
    $tipo = if ($v -and $v.tipo) { $v.tipo } elseif ($s -and $s.situacao -eq 'Fixo') { 'Manutenção fixa' } elseif ($nome -match '^Interno') { 'Interno' } else { 'Pós-obra' }
    $resp = if ($s -and $s.responsavel -and $s.responsavel -notmatch ',| e ') { $s.responsavel } elseif ($v) { $v.responsavel } else { $null }
    [void]$obras.Add([ordered]@{ obra = $nome; cliente = $(if ($s -and $s.cliente) { $s.cliente } elseif ($v) { $v.cliente } else { $null })
      endereco = $(if ($s -and $s.endereco) { $s.endereco } elseif ($v) { $v.endereco } else { $null }); tipo = $tipo; situacao_calculada = $null; responsavel = $resp; _linha = $n })
  }

  $grava = { param($nome, $lista) [IO.File]::WriteAllText((Join-Path $pastaJson "$nome.json"), (ConvertTo-Json -InputObject @($lista) -Depth 6), $utf8) }
  & $grava 'obras' $obras; & $grava 'servicos' $op.servicos; & $grava 'agenda' $agenda; & $grava 'financeiro' $fin
  [IO.File]::WriteAllText($arqEstado, (ConvertTo-Json -InputObject ([ordered]@{ assinatura = $assinatura; operacional = $arqOp.Name; cobranca = $(if ($arqCob) { $arqCob.Name }); agenda = $(if ($arqAg) { $arqAg.Name }); lidoEm = (Get-Date).ToString('o') }) -Depth 3), $utf8)
  Write-Host "Pós-obra: $($arqOp.Name) · $(if ($arqCob) { $arqCob.Name }) · $(if ($arqAg) { $arqAg.Name }) → $($obras.Count) obras, $($op.servicos.Count) OS, $(@($agenda).Count) dias na agenda, $($fin.Count) lançamentos"
}
