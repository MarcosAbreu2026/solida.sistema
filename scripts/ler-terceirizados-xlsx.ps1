# Planilha de acompanhamento dos terceirizados de cada obra: <obra>\TERCERIZADOS\<obra>_TERCERIZADOS_R<nn>.xlsx (a revisão mais nova).
# Duas abas com as mesmas colunas: "TERC CINZA" (terceiros que a Sólida contrata para executar) e "TERC LARANJA" (itens do cliente: a Sólida só acompanha).
# Colunas (achadas pelo título): Cód. · Aquisições · Andamento/Observações · Data limite para fechar · Prazo de entrega · Início da obra · Loja/Vendedor ·
# Contato · Valor ESTIMADO (orçado) · Valor ESTIMADO com ADITIVO · Valor FECHADO · diferença · Forma de Pagamento. A LEGENDA (linha acima do cabeçalho) dá a cor de cada situação.
# Devolve { v, arquivo, modificado, rev, legenda: [ { texto, cor } ], cinza: [ item ], laranja: [ item ] }; sem planilha: $null.
function Texto-Sem-Acento([string]$s) { return ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLower() }
function Numero-BR($v) {
  if ($v -eq $null) { return $null }
  $n = Numero $v; if ($n -ne $null) { return $n }
  $t = "$v" -replace '[^\d,.\-]', ''
  if ($t -match '^-?\d{1,3}(\.\d{3})*(,\d+)?$') { $t = $t -replace '\.', '' -replace ',', '.'; return Numero $t }
  return $null
}
function Data-Ou-Texto($v) {
  if ($v -eq $null -or "$v" -eq '') { return $null }
  $d = DeSerial $v; if ($d) { return Iso $d }
  return "$v"
}
function Ler-Aba-Terceirizados($linhas) {
  $cab = $null; $cols = @{}
  foreach ($l in $linhas) {
    $a = @{}
    foreach ($k in $l.c.Keys) {
      $t = Texto-Sem-Acento "$($l.c[$k])"
      if ($t -match '^aquisi') { $a.item = $k }
      elseif ($t -match '^cod') { $a.cod = $k }
      elseif ($t -match '^andamento') { $a.obs = $k }
      elseif ($t -match '^data limite') { $a.limite = $k }
      elseif ($t -match '^prazo de entrega') { $a.prazo = $k }
      elseif ($t -match '^inicio da obra') { $a.inicio = $k }
      elseif ($t -match '^loja') { $a.loja = $k }
      elseif ($t -match '^contato') { $a.contato = $k }
      elseif ($t -match 'estimado.*aditivo') { $a.aditivo = $k }
      elseif ($t -match '^valor\s*/?\s*estimado') { $a.estimado = $k }
      elseif ($t -match '^valor fechado') { $a.fechado = $k }
      elseif ($t -match 'diferenca estimado') { $a.dif = $k }
      elseif ($t -match '^diferenca' -and -not $a.dif) { $a.difAlt = $k }
      elseif ($t -match '^forma de pag') { $a.pagto = $k }
    }
    if ($a.item -and ($a.estimado -or $a.fechado)) { $cab = $l.n; $cols = $a; break }
  }
  if (-not $cab) { return $null }
  $topo = New-Object Collections.ArrayList
  foreach ($l in $linhas) { if ($l.n -ge $cab) { break }; if ($l.c.Values | Where-Object { "$_" -match '(?i)^LEGENDA' }) { continue }; $t = ($l.c.Keys | Sort-Object { Indice-Coluna $_ } | ForEach-Object { "$($l.c[$_])" } | Where-Object { $_ -notmatch '^-?[0-9.]+$' }) -join '  ·  '; if ($t) { [void]$topo.Add($t) } }
  if (-not $cols.dif -and $cols.difAlt) { $cols.dif = $cols.difAlt }
  # legenda: texto → cor (a linha que tem "LEGENDA")
  $legenda = New-Object Collections.ArrayList
  foreach ($l in $linhas) {
    if ($l.n -ge $cab) { break }
    if (-not ($l.c.Values | Where-Object { "$_" -match '(?i)^LEGENDA' })) { continue }
    foreach ($k in ($l.c.Keys | Sort-Object { Indice-Coluna $_ })) {
      $t = "$($l.c[$k])"; if ($t -match '(?i)^LEGENDA') { continue }
      [void]$legenda.Add([ordered]@{ texto = $t; cor = $l.cor[$k] })
    }
  }
  $itens = New-Object Collections.ArrayList
  foreach ($l in $linhas) {
    if ($l.n -le $cab) { continue }
    $nome = $l.c[$cols.item]; if (-not $nome) { continue }
    $cel = { param($k) if ($k) { $l.c[$k] } else { $null } }
    $cor = $null
    foreach ($k in @($cols.item, $cols.cod, $cols.obs)) { if ($k -and $l.cor[$k]) { $cor = $l.cor[$k]; break } }
    $estim = Numero-BR (& $cel $cols.estimado)
    $adit = Numero-BR (& $cel $cols.aditivo)
    $fech = Numero-BR (& $cel $cols.fechado)
    $dif = Numero-BR (& $cel $cols.dif)
    [void]$itens.Add([ordered]@{
      cod = (& $cel $cols.cod); item = $nome; obs = (& $cel $cols.obs)
      limite = (Data-Ou-Texto (& $cel $cols.limite)); prazo = (Data-Ou-Texto (& $cel $cols.prazo)); inicio = (Data-Ou-Texto (& $cel $cols.inicio))
      loja = (& $cel $cols.loja); contato = (& $cel $cols.contato)
      estimado = $estim; estimadoAditivo = $adit; fechado = $fech; diferenca = $dif; pagamento = (& $cel $cols.pagto)
      cor = $cor; linha = $l.n
    })
  }
  return [ordered]@{ legenda = $legenda; itens = $itens; topo = $topo }
}
function Ler-Terceirizados([string]$pastaObra, [string]$codigo) {
  $p = Get-ChildItem $pastaObra -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)^TERC' } | Select-Object -First 1
  if (-not $p) { return $null }
  $arq = Get-ChildItem $p.FullName -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -ieq '.xlsx' -and $_.Name -match '(?i)^[^_]*_TERC[EI]?RIZADOS_R(\d+)' -and $_.Name -notmatch '~\$|claude|teste|^Moxxx' } |
    Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) }, LastWriteTime | Select-Object -Last 1
  if (-not $arq) { return $null }
  if (Igual-Anterior $anterior[$codigo].terceirizados $arq) { return $anterior[$codigo].terceirizados }
  try { $abas = Ler-Xlsx $arq.FullName 0 } catch { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); erro = $_.Exception.Message } }
  $cinza = $null; $laranja = $null
  foreach ($nome in $abas.Keys) {
    if ($nome -match '(?i)CINZA') { $cinza = Ler-Aba-Terceirizados $abas[$nome] }
    elseif ($nome -match '(?i)LARANJA') { $laranja = Ler-Aba-Terceirizados $abas[$nome] }
  }
  $leg = if ($laranja -and $laranja.legenda.Count) { $laranja.legenda } elseif ($cinza) { $cinza.legenda } else { @() }
  $rev = [regex]::Match($arq.Name, '_R(\d+)').Groups[1].Value
  return [ordered]@{ v = $VERSAO_LEITURA; arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); rev = $(if ($rev) { "R$rev" } else { '' })
    topo = $(if ($laranja) { $laranja.topo } elseif ($cinza) { $cinza.topo } else { @() }); legenda = $leg; cinza = $(if ($cinza) { $cinza.itens } else { @() }); laranja = $(if ($laranja) { $laranja.itens } else { @() }) }
}
