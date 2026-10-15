# Lê do Google Drive (G:) as planilhas e pastas que o sistema mostra em Comercial e Planejamento
# e grava em dados/json:
#   orcamentos.json  SL_ORÇAMENTOS<ano> de 2023 em diante (a situação de cada orçamento é a COR da linha,
#                    conforme a legenda no topo da planilha)
#   projetos.json    por obra: arquivos da pasta PROJETO (disciplina, revisão, data), a listagem de
#                    projetos (quando existe), os .dwg do as-built e as atividades do cronograma
# Só leitura no Drive. Não precisa de Excel nem de Python.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\exportar-drive.ps1 [-Raiz "G:\..."] [-Saida dados\json]
param(
  [string]$Raiz = '',
  [string]$Saida = ''
)

$ErrorActionPreference = 'Stop'
$sistema = Split-Path $PSScriptRoot -Parent
if (-not $Saida) { $Saida = Join-Path $sistema 'dados\json' }
if (-not $Raiz) {
  $Raiz = Get-ChildItem 'G:\.shortcut-targets-by-id' -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'SOLIDA GERAL' } | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $Raiz -and (Test-Path 'G:\Meu Drive\SOLIDA GERAL')) { $Raiz = 'G:\Meu Drive\SOLIDA GERAL' }
}
if (-not $Raiz -or -not (Test-Path $Raiz)) { throw 'Pasta SOLIDA GERAL do Google Drive não encontrada (o Drive para computador está aberto?).' }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8 = New-Object Text.UTF8Encoding $false
$temp = Join-Path $env:TEMP 'solida-exportar'
New-Item -ItemType Directory -Force $temp | Out-Null

function Iso($d) { if ($d) { return $d.ToString('yyyy-MM-dd') } return $null }
function DeSerial($v) {
  $n = 0.0
  if ([double]::TryParse("$v", [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n) -and $n -gt 30000 -and $n -lt 80000) {
    return [DateTime]::FromOADate($n)
  }
  return $null
}
function Numero($v) {
  $n = 0.0
  if ([double]::TryParse("$v", [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { return $n }
  return $null
}

# ---------------------------------------------------------------- leitura de .xlsx

# Cores do tema (para as linhas pintadas com cor de tema + clareamento)
function Cores-Tema($zip) {
  $e = $zip.Entries | Where-Object { $_.FullName -eq 'xl/theme/theme1.xml' }
  if (-not $e) { return @() }
  $sr = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8); $x = [xml]$sr.ReadToEnd(); $sr.Close()
  $ns = New-Object Xml.XmlNamespaceManager($x.NameTable); $ns.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
  $cs = $x.SelectSingleNode('//a:clrScheme', $ns)
  $cor = { param($n) $no = $cs.SelectSingleNode("a:$n", $ns); $s = $no.SelectSingleNode('a:srgbClr', $ns); if ($s) { $s.val } else { $no.SelectSingleNode('a:sysClr', $ns).lastClr } }
  # ordem usada pelo Excel nos índices de tema
  return @('lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6') | ForEach-Object { & $cor $_ }
}

function Aplicar-Tint([string]$hex, [double]$tint) {
  $r = [Convert]::ToInt32($hex.Substring(0, 2), 16) / 255; $g = [Convert]::ToInt32($hex.Substring(2, 2), 16) / 255; $b = [Convert]::ToInt32($hex.Substring(4, 2), 16) / 255
  $max = [Math]::Max($r, [Math]::Max($g, $b)); $min = [Math]::Min($r, [Math]::Min($g, $b)); $l = ($max + $min) / 2
  if ($max -eq $min) { $h = 0; $s = 0 } else {
    $d = $max - $min; $s = if ($l -gt 0.5) { $d / (2 - $max - $min) } else { $d / ($max + $min) }
    if ($max -eq $r) { $h = (($g - $b) / $d) % 6 } elseif ($max -eq $g) { $h = ($b - $r) / $d + 2 } else { $h = ($r - $g) / $d + 4 }
    $h = $h / 6; if ($h -lt 0) { $h += 1 }
  }
  if ($tint -lt 0) { $l = $l * (1 + $tint) } else { $l = $l * (1 - $tint) + $tint }
  $f = { param($p, $q, $t) if ($t -lt 0) { $t += 1 }; if ($t -gt 1) { $t -= 1 }
    if ($t -lt 1 / 6) { return $p + ($q - $p) * 6 * $t }; if ($t -lt 1 / 2) { return $q }; if ($t -lt 2 / 3) { return $p + ($q - $p) * (2 / 3 - $t) * 6 }; return $p }
  if ($s -eq 0) { $r = $g = $b = $l } else {
    $q = if ($l -lt 0.5) { $l * (1 + $s) } else { $l + $s - $l * $s }; $p = 2 * $l - $q
    $r = & $f $p $q ($h + 1 / 3); $g = & $f $p $q $h; $b = & $f $p $q ($h - 1 / 3)
  }
  return ('{0:X2}{1:X2}{2:X2}' -f [int][Math]::Round($r * 255), [int][Math]::Round($g * 255), [int][Math]::Round($b * 255))
}

# Abre um .xlsx (copiando antes: o Drive pode estar com o arquivo aberto) e devolve as abas com
# linhas { n, c = @{ coluna = valor }, cor = @{ coluna = 'RRGGBB' } }
function Ler-Xlsx([string]$arquivo, [int]$maxLinhas = 0, [string[]]$soAbas = @()) {
  $copia = Join-Path $temp ([Guid]::NewGuid().ToString() + '.xlsx')
  Copy-Item -LiteralPath $arquivo $copia
  $zip = [IO.Compression.ZipFile]::OpenRead($copia)
  try {
    $ler = { param($nome) $e = $zip.Entries | Where-Object { $_.FullName -eq $nome }; if (-not $e) { return $null }
      $sr = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8); $x = [xml]$sr.ReadToEnd(); $sr.Close(); return $x }
    $ss = New-Object Collections.Generic.List[string]
    $sx = & $ler 'xl/sharedStrings.xml'
    if ($sx) { foreach ($si in $sx.sst.si) { $ss.Add($si.InnerText) } }
    $tema = Cores-Tema $zip
    $st = & $ler 'xl/styles.xml'
    $fills = @($st.styleSheet.fills.fill); $xfs = @($st.styleSheet.cellXfs.xf)
    $corDoEstilo = @{}
    for ($i = 0; $i -lt $xfs.Count; $i++) {
      $fg = $fills[[int]$xfs[$i].fillId].patternFill.fgColor
      $c = $null
      if ($fg) {
        if ($fg.rgb) { $c = $fg.rgb.Substring($fg.rgb.Length - 6) }
        elseif ($fg.theme -ne $null -and [int]$fg.theme -lt $tema.Count) {
          $c = $tema[[int]$fg.theme]; if ($fg.tint) { $c = Aplicar-Tint $c ([double]::Parse($fg.tint, [Globalization.CultureInfo]::InvariantCulture)) }
        }
      }
      $corDoEstilo[$i] = $c
    }
    $wb = & $ler 'xl/workbook.xml'; $rels = & $ler 'xl/_rels/workbook.xml.rels'
    $abas = [ordered]@{}
    foreach ($s in $wb.workbook.sheets.sheet) {
      if ($soAbas.Count -and -not ($soAbas | Where-Object { $s.name -like $_ })) { continue }
      $rid = $s.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
      $alvo = 'xl/' + ((($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target) -replace '^/?xl/', '')
      $sh = & $ler $alvo
      $linhas = New-Object Collections.ArrayList
      foreach ($r in $sh.worksheet.sheetData.row) {
        if ($maxLinhas -gt 0 -and [int]$r.r -gt $maxLinhas) { break }
        $c = @{}; $cor = @{}
        foreach ($cel in $r.c) {
          $col = $cel.r -replace '\d', ''
          $v = $cel.v
          if ($cel.t -eq 's' -and $v -ne $null) { $v = $ss[[int]$v] } elseif ($cel.t -eq 'inlineStr') { $v = $cel.is.InnerText }
          if ($v -ne $null -and "$v".Trim() -ne '') { $c[$col] = "$v".Trim() }
          if ($cel.s -ne $null -and $corDoEstilo[[int]$cel.s]) { $cor[$col] = $corDoEstilo[[int]$cel.s] }
        }
        if ($c.Count -or $cor.Count) { [void]$linhas.Add([pscustomobject]@{ n = [int]$r.r; c = $c; cor = $cor }) }
      }
      $abas[$s.name] = $linhas
    }
    return $abas
  } finally { $zip.Dispose(); Remove-Item $copia -ErrorAction SilentlyContinue }
}

function Distancia([string]$a, [string]$b) {
  $s = 0
  foreach ($i in 0, 2, 4) { $d = [Convert]::ToInt32($a.Substring($i, 2), 16) - [Convert]::ToInt32($b.Substring($i, 2), 16); $s += $d * $d }
  return $s
}

# ---------------------------------------------------------------- orçamentos

function Situacao-Normal([string]$t) {
  if ($t -match '(?i)n[ãa]o fechad') { return 'nao_fechado' }
  if ($t -match '(?i)fechad') { return 'fechado' }
  if ($t -match '(?i)enviad') { return 'enviado' }
  if ($t -match '(?i)aguard') { return 'aguardando' }
  if ($t -match '(?i)or[çc]ament') { return 'em_orcamento' }
  return $null
}

function Ler-Orcamentos([string]$arquivo, [int]$ano) {
  $abas = Ler-Xlsx $arquivo
  $linhas = $abas[0]
  $cab = $linhas | Where-Object { $_.c['A'] -eq 'NR' -and $_.c['B'] -eq 'REF' } | Select-Object -First 1
  if (-not $cab) { throw "Cabeçalho NR/REF não encontrado em $arquivo" }
  $col = @{}
  foreach ($k in $cab.c.Keys) {
    $t = ($cab.c[$k] -replace '\s+', ' ').ToUpper()
    if ($t -eq 'ARQ') { $col.arq = $k } elseif ($t -eq 'CLI') { $col.cli = $k } elseif ($t -eq 'TIPO') { $col.tipo = $k }
    elseif ($t -eq 'AREA') { $col.area = $k } elseif ($t -like 'VALOR OBRA CINZA*') { $col.cinza = $k } elseif ($t -like 'VALOR TOTAL*') { $col.total = $k }
    elseif ($t -like 'TEMPO*') { $col.semanas = $k } elseif ($t -like 'OBSERVA*') { $col.obs = $k } elseif ($t -eq 'NF') { $col.nf = $k }
  }
  # legenda: linhas acima do cabeçalho com o nome da situação (coluna C) e a cor (coluna B)
  $legenda = @()
  foreach ($l in $linhas | Where-Object { $_.n -lt $cab.n }) {
    $sit = Situacao-Normal $l.c['C']
    $cor = $l.cor['B']; if (-not $cor) { $cor = $l.cor['A'] }
    if ($sit -and $cor) { $legenda += [pscustomobject]@{ sit = $sit; cor = $cor } }
  }
  $itens = New-Object Collections.ArrayList
  foreach ($l in $linhas | Where-Object { $_.n -gt $cab.n -and $_.c['B'] }) {
    $cor = $l.cor['B']; if (-not $cor) { $cor = $l.cor['C'] }
    $sit = $null
    if ($cor -and $cor -ne 'FFFFFF' -and $legenda.Count) {
      $sit = ($legenda | Sort-Object { Distancia $cor $_.cor } | Select-Object -First 1).sit
    }
    $v = { param($k) if ($col[$k]) { $l.c[$col[$k]] } else { $null } }
    $area = Numero (& $v 'area'); $cinza = Numero (& $v 'cinza'); $total = Numero (& $v 'total'); $sem = Numero (& $v 'semanas')
    [void]$itens.Add([ordered]@{
      ano = $ano; ref = $l.c['B']; arq = (& $v 'arq'); cliente = (& $v 'cli'); tipo = (& $v 'tipo')
      area = if ($area -gt 0) { $area } else { $null }
      valor = if ($total -gt 0) { [Math]::Round($total, 2) } elseif ($cinza -gt 0) { [Math]::Round($cinza, 2) } else { $null }
      valorCinza = if ($cinza -gt 0) { [Math]::Round($cinza, 2) } else { $null }
      semanas = if ($sem -gt 0) { $sem } else { $null }
      situacao = $sit; nf = (& $v 'nf'); obs = (& $v 'obs')
    })
  }
  return $itens
}

$pastaOrc = Join-Path $Raiz 'ORÇAMENTOS'
$orcamentos = New-Object Collections.ArrayList
$fontesOrc = @()
foreach ($ano in 2023..((Get-Date).Year)) {
  # a revisão mais nova do ano (na raiz de ORÇAMENTOS fica o ano corrente; anos anteriores na pasta do ano)
  $cand = @(Get-ChildItem $pastaOrc -File -Filter "SL_ORÇAMENTOS$($ano)_R*.xlsx" -ErrorAction SilentlyContinue) +
          @(Get-ChildItem (Join-Path $pastaOrc "$ano") -File -Filter "SL_ORÇAMENTOS$($ano)_R*.xlsx" -ErrorAction SilentlyContinue)
  $arq = $cand | Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) } | Select-Object -Last 1
  if (-not $arq) { continue }
  try {
    $itens = Ler-Orcamentos $arq.FullName $ano
    foreach ($i in $itens) { [void]$orcamentos.Add($i) }
    $fontesOrc += [ordered]@{ ano = $ano; arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); itens = $itens.Count }
  } catch { $fontesOrc += [ordered]@{ ano = $ano; arquivo = $arq.Name; erro = $_.Exception.Message } }
}
$jsonOrc = [ordered]@{ geradoEm = (Get-Date).ToString('o'); fontes = $fontesOrc; orcamentos = $orcamentos }
[IO.File]::WriteAllText((Join-Path $Saida 'orcamentos.json'), ($jsonOrc | ConvertTo-Json -Depth 6), $utf8)

# ---------------------------------------------------------------- projetos por obra

$pastaObras = Join-Path $Raiz 'OPERACOES\OBRAS'
$modelo = Get-ChildItem $pastaObras -Directory | Where-Object { $_.Name -like 'Moxxx*' } | Select-Object -First 1
$nomesModelo = @{}
if ($modelo) {
  Get-ChildItem (Join-Path $modelo.FullName 'PROJETO') -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $nomesModelo[$_.Name.ToLower()] = $true }
}
function Eh-Modelo($f) {
  return $nomesModelo.ContainsKey($f.Name.ToLower()) -or $f.Name -match '(?i)exemplo|modelo|moxxx|\.bak$|^~\$|desktop\.ini'
}
function Revisao([string]$nome) {
  $m = [regex]::Match($nome, '(?i)(?:^|[^A-Z0-9])R(?:EV)?[ _.-]?(\d{1,3})(?![0-9])')
  if ($m.Success) { return [int]$m.Groups[1].Value }
  return $null
}

function Indice-Coluna([string]$c) { $n = 0; foreach ($ch in $c.ToCharArray()) { $n = $n * 26 + ([int]$ch - 64) }; return $n }

function Ler-Cronograma([string]$pastaObra, [string]$codigo) {
  $p = Join-Path $pastaObra 'GERENCIAMENTO\CRONOGRAMA'
  # só o cronograma da própria obra (já houve cópia do cronograma de outra obra na pasta)
  $arq = Get-ChildItem $p -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "(?i)^$codigo[_ ]CRONOGRAMA_R\d+.*\.xlsx$" -and $_.Name -notmatch '(?i)cliente|claude|~\$' } |
    Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) } | Select-Object -Last 1
  if (-not $arq) { return $null }
  try { $abas = Ler-Xlsx $arq.FullName 0 } catch { return [ordered]@{ arquivo = $arq.Name; erro = $_.Exception.Message } }
  $linhas = $abas[0]
  # data da última atualização ("Status atualizado: 09/09/2026") — ano de referência para semanas escritas "dd/mm"
  $status = $null
  foreach ($l in $linhas | Select-Object -First 4) {
    $m = [regex]::Match("$($l.c['A'])", '(\d{2})/(\d{2})/(\d{4})')
    if ($m.Success) { $status = Get-Date -Year ([int]$m.Groups[3].Value) -Month ([int]$m.Groups[2].Value) -Day ([int]$m.Groups[1].Value) }
  }
  # linha das datas das semanas: a primeira com 3 ou mais datas (número de data do Excel ou "dd/mm") depois da coluna F
  $semanas = $null
  foreach ($l in $linhas) {
    $cols = @($l.c.Keys | Where-Object { $_ -notin 'A', 'B', 'C', 'D', 'E', 'F' } | Sort-Object { Indice-Coluna $_ })
    $ok = @($cols | Where-Object { (DeSerial $l.c[$_]) -or $l.c[$_] -match '^\d{1,2}[/.]\d{1,2}$' })
    if ($ok.Count -lt 3) { continue }
    $ancora = $ok | Where-Object { DeSerial $l.c[$_] } | Select-Object -First 1
    $ref = if ($ancora) { DeSerial $l.c[$ancora] } elseif ($status) { $status } else { Get-Date }
    $semanas = @{}
    $ano = $ref.Year; $mesAnterior = 0
    # semanas "dd/mm": o ano começa no da referência e vira quando o mês volta (dez → jan)
    $primeiroTexto = $ok | Where-Object { -not (DeSerial $l.c[$_]) } | Select-Object -First 1
    if ($primeiroTexto) {
      $mm = [int]($l.c[$primeiroTexto] -split '[/.]')[1]
      if ($ancora -and (Indice-Coluna $primeiroTexto) -lt (Indice-Coluna $ancora) -and $mm -gt $ref.Month) { $ano = $ref.Year - 1 }
      if (-not $ancora -and $mm -gt $ref.Month) { $ano = $ref.Year - 1 }
    }
    foreach ($k in $ok) {
      $d = DeSerial $l.c[$k]
      if (-not $d) {
        $dm = $l.c[$k] -split '[/.]'
        if ([int]$dm[1] -lt $mesAnterior) { $ano++ }
        try { $d = Get-Date -Year $ano -Month ([int]$dm[1]) -Day ([int]$dm[0]) } catch { continue }
      }
      $mesAnterior = $d.Month; $ano = $d.Year
      $semanas[$k] = $d.Date
    }
    break
  }
  if (-not $semanas) { return [ordered]@{ arquivo = $arq.Name; erro = 'Datas das semanas não encontradas' } }
  $colsSemana = New-Object Collections.ArrayList; foreach ($k in ($semanas.Keys | Sort-Object { Indice-Coluna $_ })) { [void]$colsSemana.Add($k) }
  $statusTxt = ($linhas | Select-Object -First 3 | ForEach-Object { $_.c['A'] } | Where-Object { $_ -match '(?i)status' } | Select-Object -First 1)
  $grupo = ''; $grupoNome = ''; $atividades = New-Object Collections.ArrayList
  foreach ($l in $linhas) {
    $a = $l.c['A']
    if (-not $a) { continue }
    # cabeçalho de grupo: "ELE - Infra de Elétrica" ou um nome solto com S1, S2... nas semanas
    if (-not $l.c['B'] -and ($a -match '^([A-Z]{2,5})\s*-\s*(.+)$' -or $l.c['G'] -match '^S\d+$')) {
      $grupo = if ($a -match '^([A-Z]{2,5})\s*-\s*(.+)$') { $matches[1] } else { $a.Trim() }
      $grupoNome = if ($a -match '^([A-Z]{2,5})\s*-\s*(.+)$') { $matches[2].Trim() } else { $a.Trim() }
      continue
    }
    if (-not $l.c['B']) { continue }
    $ds = @($semanas.Keys | Where-Object { $l.c[$_] -and $l.c[$_] -notmatch '^S\d+$' } | ForEach-Object { $semanas[$_] } | Sort-Object)
    # barras do cronograma: semanas com a célula pintada (ou com quantidade lançada)
    $barras = @($colsSemana | Where-Object { ($l.cor[$_] -and $l.cor[$_] -notmatch '^(FFFFFF|1F3864)$') -or ($l.c[$_] -and $l.c[$_] -notmatch '^S\d+$') } | ForEach-Object { $colsSemana.IndexOf($_) })
    $corBarra = ($colsSemana | Where-Object { $l.cor[$_] -and $l.cor[$_] -notmatch '^(FFFFFF|1F3864)$' } | ForEach-Object { $l.cor[$_] } | Select-Object -First 1)
    $qtdSemana = [ordered]@{}; foreach ($k in $colsSemana) { $n = Numero $l.c[$k]; if ($n -ne $null) { $qtdSemana["$($colsSemana.IndexOf($k))"] = $n } }
    if (-not $ds.Count -and $barras.Count) { $ds = @($barras | ForEach-Object { $semanas[$colsSemana[$_]] } | Sort-Object) }
    [void]$atividades.Add([ordered]@{
      cod = $a; grupo = $grupo; grupoNome = $grupoNome; nome = $l.c['B']; empresa = $l.c['C']; quant = (Numero $l.c['D']); unid = $l.c['E']
      inicio = if ($ds.Count) { Iso $ds[0] } else { $null }; fim = if ($ds.Count) { Iso $ds[-1] } else { $null }
      exe = Numero $l.c['F']; barras = $barras; cor = $corBarra; qtdSemana = $qtdSemana
    })
  }
  $todas = @($semanas.Values | Sort-Object)
  # a planilha como ela é (só leitura), até a última semana
  $grade = $null
  try { $aba1 = @($abas.Keys)[0]; $g = Grade-Xlsx $arq.FullName @($aba1) @{ $aba1 = @{ col = (Indice-Coluna $colsSemana[$colsSemana.Count - 1]); lin = 400 } }; $grade = $g[$aba1] } catch { }
  $listaSemanas = @($colsSemana | ForEach-Object { [ordered]@{ rotulo = "S$($colsSemana.IndexOf($_) + 1)"; inicio = (Iso $semanas[$_]) } })
  return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); status = $statusTxt; inicioObra = (Iso $todas[0]); fimObra = (Iso $todas[-1]); semanas = $listaSemanas; atividades = $atividades; grade = $grade }
}

function Ler-Listagem([string]$pastaProjeto) {
  $arq = Get-ChildItem $pastaProjeto -File -Filter '*LISTAGEM PROJETOS_R*.xlsx' -ErrorAction SilentlyContinue | Where-Object { -not (Eh-Modelo $_) } |
    Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) } | Select-Object -Last 1
  if (-not $arq) { return $null }
  try { $abas = Ler-Xlsx $arq.FullName 0 @('LISTAGEM') } catch { return [ordered]@{ arquivo = $arq.Name; erro = $_.Exception.Message } }
  $itens = New-Object Collections.ArrayList
  foreach ($l in $abas[0]) {
    if ($l.n -le 5 -or -not $l.c['A'] -or -not $l.c['B']) { continue }
    [void]$itens.Add([ordered]@{
      especialidade = ($l.c['A'] -replace '[\s-]+$', ''); prancha = $l.c['B']; rev = (Revisao "R$($l.c['C'] -replace '^R', '')")
      data = Iso (DeSerial $l.c['D']); arquivo = $l.c['E']; recebido = Iso (DeSerial $l.c['F']); projetista = $l.c['G']
    })
  }
  return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); itens = $itens }
}

# ---------------------------------------------------------------- escopo e programação semanal (por obra)
. (Join-Path $PSScriptRoot 'ler-pdf.ps1')
. (Join-Path $PSScriptRoot 'grade-xlsx.ps1')

# leitura anterior (para não reler PDF/planilha que não mudou)
$anterior = @{}
$jsonAnt = Join-Path $Saida 'projetos.json'
if (Test-Path $jsonAnt) {
  try { foreach ($o in (Get-Content $jsonAnt -Raw -Encoding UTF8 | ConvertFrom-Json).obras) { $anterior[$o.obra] = $o } } catch { }
}
$VERSAO_LEITURA = 5   # aumente quando mudar a leitura, para reler tudo
function Igual-Anterior($velho, $arq) { return $velho -and $velho.v -eq $VERSAO_LEITURA -and $velho.arquivo -eq $arq.Name -and $velho.modificado -eq $arq.LastWriteTime.ToString('o') -and -not $velho.erro }

# Escopo: GERENCIAMENTO\DOC\ESCOPO\<obra>_ESCOPO_Rnn.xlsx — aba "ESCOPO SEM VALOR" (ou ESCOPO / orçamento base)
# e as abas de aditivo (AD01, AD02...). Só descrição, unidade e quantidade: valores ficam de fora.
function Itens-Escopo($linhas) {
  # três modelos de planilha (antigo, 2025, 2026): as colunas saem do cabeçalho "Unid" — descrição antes,
  # quantidade depois, situação logo depois de "S.total". Linha com descrição e sem unidade = etapa.
  $cab = $linhas | Where-Object { @($_.c.Values | Where-Object { $_ -match '(?i)^unid\.?$' }).Count } | Select-Object -First 1
  if (-not $cab) { return [ordered]@{ obs = @(); grupos = @() } }
  $cU = ($cab.c.GetEnumerator() | Where-Object { $_.Value -match '(?i)^unid\.?$' } | Select-Object -First 1).Key
  $iU = Indice-Coluna $cU
  $letra = { param($i) [string][char](64 + $i) }
  $cDesc = & $letra ($iU - 1); $cQt = & $letra ($iU + 1)
  $cTot = ($cab.c.GetEnumerator() | Where-Object { $_.Value -match '(?i)^S\.?\s*total' } | Select-Object -First 1).Key
  $cSit = if ($cTot) { & $letra ((Indice-Coluna $cTot) + 1) } else { $null }
  $grupos = New-Object Collections.ArrayList; $g = $null; $obs = New-Object Collections.ArrayList
  $fora = '(?i)taxa|imposto|valor total|subtotal|total custo'
  foreach ($l in $linhas) {
    $a = "$($l.c['A'])".Trim(); $desc = "$($l.c[$cDesc])".Trim(); if (-not $desc -and $cDesc -ne 'B') { $desc = "$($l.c['B'])".Trim() }
    if ($l.n -lt $cab.n) { if ($a -match '^\d+\.?$') { $tx = (@($l.c['B'], $l.c['C']) | Where-Object { $_ }) -join ' '; if ($tx) { [void]$obs.Add($tx) } }; continue }
    if ($l.n -eq $cab.n -or -not $desc -or $desc -match $fora -or (@($l.c.Values) -match '(?i)^subtotal').Count) { continue }
    $un = "$($l.c[$cU])".Trim()
    if (-not $un -or ($un -match '(?i)^unid\.?$' -and (Numero $l.c[$cQt]) -eq $null)) {
      $g = [ordered]@{ cod = ($a -replace '^\d+\.', '' -replace '^Item$', ''); nome = $desc; itens = New-Object Collections.ArrayList }; [void]$grupos.Add($g); continue
    }
    if (-not $g) { $g = [ordered]@{ cod = ''; nome = 'Geral'; itens = New-Object Collections.ArrayList }; [void]$grupos.Add($g) }
    $sit = if ($cSit) { "$($l.c[$cSit])".Trim() } else { '' }
    if ((Numero $sit) -ne $null -or $sit -match '^R\$') { $sit = '' }
    $cod = if ($l.c['B'] -match '^[A-Z]{2,4}\d{2,4}$' -and $cDesc -ne 'B') { $l.c['B'] } else { $a -replace '\.0$', '' }
    [void]$g.itens.Add([ordered]@{ cod = $cod; desc = ($desc -replace '\s+', ' '); unid = $un; quant = (Numero $l.c[$cQt]); situacao = $sit })
  }
  return [ordered]@{ obs = $obs; grupos = @($grupos | Where-Object { $_.itens.Count }) }
}

function Ler-Escopo([string]$pastaObra, [string]$codigo) {
  $p = Join-Path $pastaObra 'GERENCIAMENTO\DOC\ESCOPO'
  $arq = Get-ChildItem $p -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "(?i)^$codigo[_ ]ESCOPO.*_R\d+.*\.xlsx$" -and $_.Name -notmatch '~\$' } |
    Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) }, LastWriteTime | Select-Object -Last 1
  if (-not $arq) {
    $pdf = Get-ChildItem $p -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "(?i)^$codigo.*(ESCOPO|OR[ÇC]AMENTO).*\.pdf$" } | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($pdf) { return [ordered]@{ arquivo = $pdf.Name; modificado = $pdf.LastWriteTime.ToString('o'); erro = 'Escopo só em PDF (sem planilha)' } }
    return $null
  }
  if (Igual-Anterior $anterior[$codigo].escopo $arq) { return $anterior[$codigo].escopo }
  try { $abas = Ler-Xlsx $arq.FullName 0 } catch { return [ordered]@{ arquivo = $arq.Name; erro = $_.Exception.Message } }
  $nomes = @($abas.Keys)
  $base = ($nomes | Where-Object { $_ -match '(?i)^ESCOPO SEM VALOR' } | Select-Object -First 1)
  if (-not $base) { $base = ($nomes | Where-Object { $_ -match '(?i)^ESCOPO\s*$' } | Select-Object -First 1) }
  if (-not $base) { $base = ($nomes | Where-Object { $_ -match '(?i)OR[ÇC].*BASE|^OR[ÇC]AMENTO' } | Select-Object -First 1) }
  $principal = if ($base) { Itens-Escopo $abas[$base] } else { $null }
  $cab = if ($base) { $abas[$base] } else { @() }
  $rev = ($cab | Where-Object { $_.n -eq 5 } | ForEach-Object { $_.c['C'] }) ; $data = ($cab | Where-Object { $_.n -eq 5 } | ForEach-Object { $_.c['B'] })
  $cliente = ($cab | Where-Object { $_.n -eq 6 } | ForEach-Object { if ($_.c['C'] -and -not $_.c['B']) { $_.c['C'] } else { $_.c['B'] } })
  $l5 = $cab | Where-Object { $_.n -eq 5 } | Select-Object -First 1
  if ($l5) { $vals = @($l5.c.GetEnumerator() | Sort-Object { Indice-Coluna $_.Key } | ForEach-Object { $_.Value }); $rev = ($vals | Where-Object { $_ -match '^R\d+' } | Select-Object -First 1); $dd = ($vals | Where-Object { DeSerial $_ } | Select-Object -First 1); $data = if ($dd) { (DeSerial $dd).ToString('dd/MM/yyyy') } else { ($vals | Where-Object { $_ -notmatch '^R\d+' } | Select-Object -First 1) } }
  # a planilha como ela é: aba ESCOPO (ou orçamento base) até a coluna S.total (+ situação, quando houver)
  $abaGrade = ($nomes | Where-Object { $_ -match '(?i)^ESCOPO\s*$' } | Select-Object -First 1); if (-not $abaGrade) { $abaGrade = $base }
  $limites = @{}
  foreach ($n in @($abaGrade) + @($nomes | Where-Object { $_ -match '(?i)^AD\s?\d' })) { if ($n) { $limites[$n] = Limite-Escopo $abas[$n] } }
  $grades = @{}
  try { $grades = Grade-Xlsx $arq.FullName @($limites.Keys) $limites } catch { }
  # "RESUMO ADS" (quando existe): situação de cada aditivo pelo número
  $resumo = @{}
  $abaRes = $nomes | Where-Object { $_ -match '(?i)RESUMO\s*AD' } | Select-Object -First 1
  if ($abaRes) { foreach ($l in $abas[$abaRes]) { if ("$($l.c['A'])" -match '^\d+$' -and $l.c['C']) { $resumo[[int]$l.c['A']] = $l.c['C'] } } }
  $aditivos = New-Object Collections.ArrayList
  foreach ($n in ($nomes | Where-Object { $_ -match '(?i)^AD\s?\d' } | Sort-Object { [double]([regex]::Match($_, '\d+(\.\d+)?').Value) })) {
    $titulo = ($abas[$n] | Where-Object { $_.n -eq 2 } | ForEach-Object { $_.c['B'] }) ; $dt = ($abas[$n] | Where-Object { $_.n -eq 5 } | ForEach-Object { $_.c['B'] })
    if (DeSerial $dt) { $dt = (DeSerial $dt).ToString('dd/MM/yyyy') } elseif ($dt) { $dt = "$dt" -replace '\.', '/' }
    # aprovação: escrita em alguma célula da aba ("APROVADO PELO CLIENTE 26/08", "CANCELADO"...)
    $textos = @($abas[$n] | ForEach-Object { $_.c.Values } | Where-Object { "$_" -match '(?i)aprova|cancelad|reprova|recusad' -and "$_" -notmatch '(?i)total(es)? .*aprovad' })
    $situacao = 'sem'; $nota = ''
    $num = [int]([regex]::Match($n, '\d+').Value)
    if ($resumo.ContainsKey($num)) { $nota = $resumo[$num] }
    foreach ($tx in @($textos) + @($nota)) {
      if (-not $tx) { continue }
      if ($tx -match '(?i)cancelad|reprova|recusad|n[ãa]o aprovad') { $situacao = 'nao'; $nota = $tx; break }
      if ($tx -match '(?i)aguard|para aprova|n[ãa]o finalizad|n[ãa]o apresentad|enviad') { $situacao = 'aguardando'; $nota = $tx; continue }
      if ($tx -match '(?i)aprovad') { $situacao = 'aprovado'; $nota = $tx }
    }
    $total = ($abas[$n] | Where-Object { "$($_.c['B'])" -match '(?i)^(TOTAL FINAL|VALOR TOTAL)' } | ForEach-Object { Numero $_.c['H'] } | Where-Object { $_ -ne $null } | Select-Object -Last 1)
    $grd = $grades[$n]
    [void]$aditivos.Add([ordered]@{ aba = $n; titulo = ("$titulo" -replace "^$n\s*[-–]\s*", '' -replace '^AD\s*\d+\s*[-–]\s*', ''); data = $dt; situacao = $situacao; nota = "$nota"; total = $total
      corAba = if ($grd) { $grd.corAba } else { $null }; grade = $grd; colunasValor = (Colunas-Valor $abas[$n]) })
  }
  return [ordered]@{ v = $VERSAO_LEITURA; arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); aba = $base; rev = $rev; data = $data; cliente = $cliente
    obs = if ($principal) { @($principal.obs) } else { @() }; grupos = if ($principal) { @($principal.grupos) } else { @() }; aditivos = $aditivos
    abaGrade = $abaGrade; grade = $grades[$abaGrade]; colunasValor = (Colunas-Valor $abas[$abaGrade]) }
}

# coluna final da planilha de escopo/aditivo: S.total, ou a seguinte quando ela tem texto (situação/observação)
function Limite-Escopo($linhas) {
  $cab = $linhas | Where-Object { @($_.c.Values | Where-Object { $_ -match '(?i)^unid\.?$' }).Count } | Select-Object -First 1
  if (-not $cab) { return @{ col = 10; lin = 400 } }
  $cTot = ($cab.c.GetEnumerator() | Where-Object { $_.Value -match '(?i)^S\.?\s*total' } | Select-Object -First 1).Key
  if (-not $cTot) { return @{ col = 10; lin = 400 } }
  $i = Indice-Coluna $cTot; $prox = [string][char](64 + $i + 1)
  $temTexto = @($linhas | Where-Object { $_.n -gt $cab.n -and $_.c[$prox] -and (Numero $_.c[$prox]) -eq $null }).Count
  return @{ col = $(if ($temTexto) { $i + 1 } else { $i }); lin = 400 }
}
# colunas de valor (material, mão de obra, locação, subtotal): só sócios veem
function Colunas-Valor($linhas) {
  $cab = $linhas | Where-Object { @($_.c.Values | Where-Object { $_ -match '(?i)^unid\.?$' }).Count } | Select-Object -First 1
  if (-not $cab) { return @() }
  return @($cab.c.GetEnumerator() | Where-Object { $_.Value -match '(?i)^(material|m[ãa]o de obra|m\. ?obra|loca[çc][ãa]o|s\.?\s*total)' } | ForEach-Object { Indice-Coluna $_.Key } | Sort-Object)
}
# Programação semanal (ou pendências, na fase final): o PDF mais novo de GERENCIAMENTO\PROGRAMAÇÃO SEMANAL
function Ler-Programacao([string]$pastaObra, [string]$codigo) {
  $p = Get-ChildItem (Join-Path $pastaObra 'GERENCIAMENTO') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)^PROGRAMA' } | Select-Object -First 1
  if (-not $p) { return $null }
  $arq = Get-ChildItem $p.FullName -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "(?i)^$codigo" -and $_.Extension -ieq '.pdf' -and $_.Name -match '(?i)PROGRAMA|METAS|PEND' -and $_.Name -notmatch '(?i)PREVIS|teste|claude' } |
    Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $arq) { return $null }
  if (Igual-Anterior $anterior[$codigo].programacao $arq) { return $anterior[$codigo].programacao }
  # obra parada: PDF com mais de 90 dias não é relido
  if ($arq.LastWriteTime -lt (Get-Date).AddDays(-90)) { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); antigo = $true } }
  try { $tb = Ler-TabelaPdf (Ler-PdfTexto $arq.FullName) } catch { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); erro = $_.Exception.Message } }
  $tipo = if ($arq.Name -match '(?i)PEND') { 'pendencias' } elseif ($arq.Name -match '(?i)METAS') { 'metas' } else { 'programacao' }
  return [ordered]@{ v = $VERSAO_LEITURA; arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); tipo = $tipo; titulo = $tb.titulo; nota = $tb.nota; secoes = $tb.secoes }
}
. (Join-Path $PSScriptRoot 'evidencias.ps1')
$obras = New-Object Collections.ArrayList
foreach ($pasta in Get-ChildItem $pastaObras -Directory | Where-Object { $_.Name -match '^(Mo\d+[A-Z]?)[_ ]' -and $_.Name -notlike 'Moxxx*' }) {
  $codigo = [regex]::Match($pasta.Name, '^(Mo\d+[A-Z]?)').Groups[1].Value
  $pastaProjeto = Join-Path $pasta.FullName 'PROJETO'
  $arquivos = New-Object Collections.ArrayList
  $asbuilt = New-Object Collections.ArrayList
  if (Test-Path $pastaProjeto) {
    foreach ($f in Get-ChildItem $pastaProjeto -Recurse -File -ErrorAction SilentlyContinue) {
      if (Eh-Modelo $f) { continue }
      $rel = $f.FullName.Substring($pastaProjeto.Length + 1)
      $partes = @($rel -split '\\')
      # PROJETO\OLD\ELETRICA\... é revisão antiga da ELETRICA
      if ($partes[0] -ieq 'OLD' -and $partes.Count -gt 2) { $partes = $partes[1..($partes.Count - 1)] }
      $disc = if ($partes.Count -gt 1 -and $partes[0] -ine 'OLD') { $partes[0] } else { '' }
      $antigo = $rel -match '(?i)(^|\\)old\\'
      $item = [ordered]@{ disciplina = $disc; nome = $f.Name; caminho = $rel; data = Iso $f.LastWriteTime; rev = (Revisao $f.Name); antigo = [bool]$antigo }
      if ($disc -match '(?i)^as[\s_-]?built$') {
        if ($f.Extension -ieq '.dwg') { [void]$asbuilt.Add($item) }
      } else { [void]$arquivos.Add($item) }
    }
  }
  Ler-Evidencias $pasta.FullName $codigo
  [void]$obras.Add([ordered]@{
    obra = $codigo; pasta = $pasta.Name
    endereco = ($pasta.Name -replace '^Mo\d+[A-Z]?[_ ]+', '')
    temPastaProjeto = (Test-Path $pastaProjeto)
    arquivos = $arquivos; asbuilt = $asbuilt
    listagem = if (Test-Path $pastaProjeto) { Ler-Listagem $pastaProjeto } else { $null }
    cronograma = Ler-Cronograma $pasta.FullName $codigo
    escopo = Ler-Escopo $pasta.FullName $codigo
    programacao = Ler-Programacao $pasta.FullName $codigo
  })
}
$jsonProj = [ordered]@{ geradoEm = (Get-Date).ToString('o'); pasta = 'SOLIDA GERAL\OPERACOES\OBRAS\<obra>\PROJETO'; obras = $obras }
[IO.File]::WriteAllText((Join-Path $Saida 'projetos.json'), ($jsonProj | ConvertTo-Json -Depth 20 -Compress), $utf8)
Gravar-Evidencias

# ---------------------------------------------------------------- estoque de ferramentas

# PÓS OBRA\FERRAMENTAS\LISTAS\SL_FERRAMENTAS_SOLIDA_Rnn.xlsx, aba CONTROLE: um item por linha com
# mínimo e atual do galpão (estoque), dos carros e de cada obra. Coluna O = mínimo obrigatório de obra.
function Valor-Celula($v) { $n = Numero $v; if ($n -ne $null) { return $n }; if ($v) { return "$v" }; return $null }

$estoque = $null
$pastaFerr = Join-Path $Raiz 'PÓS OBRA\FERRAMENTAS\LISTAS'
$arqFerr = Get-ChildItem $pastaFerr -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '(?i)^SL_FERRAMENTAS[ _]S[ÓO]LIDA_R(\d+)\.xlsx$' } |
  Sort-Object { [int]([regex]::Match($_.Name, '_R(\d+)').Groups[1].Value) } | Select-Object -Last 1
if ($arqFerr) {
  try {
    $abas = Ler-Xlsx $arqFerr.FullName 0 @('CONTROLE', 'OBRAS')
    $linhas = $abas['CONTROLE']
    $cab = $linhas | Where-Object { $_.c['B'] -match '^C[ÓO]D' -and $_.c['C'] -match 'ITEM' } | Select-Object -First 1
    $datas = $linhas | Where-Object { $_.n -eq $cab.n - 1 } | Select-Object -First 1
    $nomeCol = @{}
    foreach ($k in $cab.c.Keys) { $nomeCol[$k] = ($cab.c[$k] -replace '\s+', ' ').Trim().ToUpper() }
    $acha = { param($re) ($nomeCol.Keys | Where-Object { $nomeCol[$_] -match $re } | Sort-Object { Indice-Coluna $_ } | Select-Object -First 1) }
    $col = @{
      totalMin = & $acha '^TOTAL M[ÍI]N'; totalAtual = & $acha '^TOTAL GERAL'; filtro = & $acha '^FILTRO'
      quebrada = & $acha '^QUEBRAD'; consertando = & $acha '^CONSERTAND'; obs = & $acha '^OBS'
    }
    # locais: pares MÍN./ATUAL (galpão e carros) e as colunas de cada obra depois de MÍN. OBRA
    $locais = @(
      @{ id = 'galpao'; nome = 'Galpão (estoque)'; min = (& $acha '^M[ÍI]N\.? ESTOQUE'); atual = (& $acha '^ESTOQUE ATUAL') },
      @{ id = 'anderson'; nome = 'Carro Anderson'; min = (& $acha '^M[ÍI]N\.? ANDERSON'); atual = (& $acha '^ANDERSON ATUAL') },
      @{ id = 'nascimento'; nome = 'Carro Nascimento'; min = (& $acha '^M[ÍI]N\.? NASCIM'); atual = (& $acha '^NASCIM\.? ATUAL') },
      @{ id = 'enio'; nome = 'Carro Enio'; min = (& $acha '^M[ÍI]N\.? ENIO'); atual = (& $acha '^ENIO ATUAL') }
    )
    $colMinObra = & $acha '^M[ÍI]N\.? OBRA'
    $obrasCols = @()
    if ($colMinObra -and $col.quebrada) {
      $de = Indice-Coluna $colMinObra; $ate = Indice-Coluna $col.quebrada
      $obrasCols = @($nomeCol.Keys | Where-Object { (Indice-Coluna $_) -gt $de -and (Indice-Coluna $_) -lt $ate -and $nomeCol[$_] -match '^(MO|PO)\d' } | Sort-Object { Indice-Coluna $_ })
    }
    # colunas de cálculo da planilha (status final e quantidades); ficam depois de BA
    $colStatus = $linhas | Where-Object { $_.n -lt $cab.n } | ForEach-Object { $l = $_; $l.c.Keys | Where-Object { $l.c[$_] -eq 'status_final' } } | Select-Object -First 1
    $colComprar = $linhas | Where-Object { $_.n -lt $cab.n } | ForEach-Object { $l = $_; $l.c.Keys | Where-Object { $l.c[$_] -eq 'qtd_real_comprar' } } | Select-Object -First 1
    $colConsertar = $linhas | Where-Object { $_.n -lt $cab.n } | ForEach-Object { $l = $_; $l.c.Keys | Where-Object { $l.c[$_] -eq 'qtd_consertar' } } | Select-Object -First 1
    $conferido = @{}
    if ($datas) {
      foreach ($l in $locais) { if ($l.atual -and $datas.c[$l.atual]) { $conferido[$l.id] = Iso (DeSerial $datas.c[$l.atual]) } }
      foreach ($k in $obrasCols) { if ($datas.c[$k]) { $conferido[$cab.c[$k].Trim()] = Iso (DeSerial $datas.c[$k]) } }
    }
    $itens = New-Object Collections.ArrayList
    foreach ($l in $linhas | Where-Object { $_.n -gt $cab.n -and $_.c['B'] -and $_.c['C'] }) {
      $porLocal = [ordered]@{}
      foreach ($lc in $locais) { $porLocal[$lc.id] = [ordered]@{ min = (Valor-Celula $l.c[$lc.min]); atual = (Valor-Celula $l.c[$lc.atual]) } }
      $porObra = [ordered]@{}
      foreach ($k in $obrasCols) { $porObra[$cab.c[$k].Trim()] = Valor-Celula $l.c[$k] }
      [void]$itens.Add([ordered]@{
        cod = $l.c['B']; item = $l.c['C']; categoria = ([regex]::Match($l.c['B'], '^[A-Za-z]+').Value.ToUpper())
        totalMin = Valor-Celula $l.c[$col.totalMin]; totalAtual = Valor-Celula $l.c[$col.totalAtual]
        filtro = $l.c[$col.filtro]; minObra = Valor-Celula $l.c[$colMinObra]
        locais = $porLocal; obras = $porObra
        quebrada = Valor-Celula $l.c[$col.quebrada]; consertando = Valor-Celula $l.c[$col.consertando]; obs = $l.c[$col.obs]
        status = if ($colStatus) { $l.c[$colStatus] } else { $null }
        comprar = if ($colComprar) { Valor-Celula $l.c[$colComprar] } else { $null }
        consertar = if ($colConsertar) { Valor-Celula $l.c[$colConsertar] } else { $null }
      })
    }
    $obrasCad = @($abas['OBRAS'] | Where-Object { $_.c['A'] -match '^(Mo|Po)\d' } | ForEach-Object { [ordered]@{ obra = $_.c['A']; responsavel = $_.c['B']; status = $_.c['C'] } })
    $estoque = [ordered]@{
      geradoEm = (Get-Date).ToString('o'); arquivo = $arqFerr.Name; modificado = $arqFerr.LastWriteTime.ToString('o')
      locais = @($locais | ForEach-Object { [ordered]@{ id = $_.id; nome = $_.nome } }); obras = @($obrasCols | ForEach-Object { $cab.c[$_].Trim() })
      cadastroObras = $obrasCad; conferido = $conferido; itens = $itens
    }
  } catch { $estoque = [ordered]@{ geradoEm = (Get-Date).ToString('o'); arquivo = $arqFerr.Name; erro = $_.Exception.Message } }
} else { $estoque = [ordered]@{ geradoEm = (Get-Date).ToString('o'); erro = "SL_FERRAMENTAS_SOLIDA não encontrada em $pastaFerr" } }
[IO.File]::WriteAllText((Join-Path $Saida 'estoque.json'), ($estoque | ConvertTo-Json -Depth 6 -Compress), $utf8)
"Estoque: $(if ($estoque.itens) { $estoque.itens.Count } else { $estoque.erro }) itens ($($estoque.arquivo))"

"Orçamentos: $($orcamentos.Count) ($(($fontesOrc | ForEach-Object { "$($_.ano): $($_.arquivo)" }) -join ', '))"
"Obras com pasta: $($obras.Count)"
