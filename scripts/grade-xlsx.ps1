# Lê abas de um .xlsx como "grade" para o sistema mostrar a planilha como ela é (só leitura):
# valores já formatados (data, %, R$), cor de fundo e da letra, negrito, alinhamento, largura das colunas,
# altura das linhas e células mescladas. Colunas e linhas ocultas ficam de fora.
# Uso (depois de carregar as funções de exportar-drive.ps1: Cores-Tema, Aplicar-Tint, Indice-Coluna):
#   Grade-Xlsx 'arquivo.xlsx' @('ABA1', 'ABA2') → @{ ABA1 = grade; ... }
# grade = { cols = [ {l, w} ], linhas = [ {n, h, c = [ [coluna, texto, estilo] ] } ], mesclas = ['A1:F1'], estilos = [ {bg, fg, b, i, al, q} ] }

function Letra-Coluna([int]$i) { $s = ''; while ($i -gt 0) { $m = ($i - 1) % 26; $s = [char](65 + $m) + $s; $i = [int](($i - $m) / 26) }; return $s }

function Formatar-Valor($v, [string]$fmt, [int]$fmtId) {
  $n = 0.0
  if (-not [double]::TryParse("$v", [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { return "$v" }
  $br = [Globalization.CultureInfo]::GetCultureInfo('pt-BR')
  $f = ($fmt -replace '"[^"]*"', '' -replace '\[[^\]]*\]', '').ToLower()
  if ($fmtId -in 9, 10 -or $f -match '%') { $d = if ($fmtId -eq 10 -or $f -match '0\.0+%') { 1 } else { 0 }; return ($n * 100).ToString("N$d", $br) + '%' }
  $ehData = ($fmtId -ge 14 -and $fmtId -le 22) -or $fmtId -in 45, 46, 47 -or ($f -match '(d|m|y)' -and $f -notmatch '0')
  if ($ehData -and $n -gt 1 -and $n -lt 80000) {
    $dt = [DateTime]::FromOADate($n)
    if ($f -match 'yy' -or $fmtId -eq 14) { return $dt.ToString('dd/MM/yyyy') }
    if ($f -match 'h') { return $dt.ToString('dd/MM HH:mm') }
    return $dt.ToString('dd/MM')
  }
  if ($fmt -match 'R\$') { return 'R$ ' + $n.ToString('N2', $br) }
  if ($f -match '0\.0+') { $d = ([regex]::Match($f, '0\.(0+)')).Groups[1].Value.Length; return $n.ToString("N$d", $br) }
  if ($f -match '#,##0' -or $fmtId -in 3, 37, 38) { return $n.ToString('N0', $br) }
  if ($fmtId -in 2, 4, 39, 40) { return $n.ToString('N2', $br) }
  # Geral: até 2 casas
  if ([Math]::Abs($n - [Math]::Round($n)) -lt 1e-9) { return ([Math]::Round($n)).ToString('0', $br) }
  return ([Math]::Round($n, 2)).ToString('0.##', $br)
}

function Grade-Xlsx([string]$arquivo, [string[]]$quais, [hashtable]$limites = @{}) {
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
    $cor = { param($no) if (-not $no) { return $null }
      if ($no.rgb) { return $no.rgb.Substring($no.rgb.Length - 6) }
      if ($no.theme -ne $null -and [int]$no.theme -lt $tema.Count) { $c = $tema[[int]$no.theme]; if ($no.tint) { $c = Aplicar-Tint $c ([double]::Parse($no.tint, [Globalization.CultureInfo]::InvariantCulture)) }; return $c }
      if ($no.indexed -eq '9') { return 'FFFFFF' }; if ($no.indexed -eq '8') { return '000000' }
      return $null }
    $st = & $ler 'xl/styles.xml'
    $numFmts = @{}; foreach ($nf in @($st.styleSheet.numFmts.numFmt)) { if ($nf) { $numFmts[[int]$nf.numFmtId] = $nf.formatCode } }
    $fonts = @($st.styleSheet.fonts.font); $fills = @($st.styleSheet.fills.fill); $xfs = @($st.styleSheet.cellXfs.xf)
    # estilo do Excel → estilo da grade (deduplicado)
    $estilos = New-Object Collections.ArrayList; $chaveEst = @{}; $mapa = @{}; $fmtDe = @{}
    for ($i = 0; $i -lt $xfs.Count; $i++) {
      $x = $xfs[$i]; $fo = $fonts[[int]$x.fontId]; $fi = $fills[[int]$x.fillId]
      $bg = if ($fi.patternFill.patternType -and $fi.patternFill.patternType -ne 'none') { & $cor $fi.patternFill.fgColor } else { $null }
      $e = [ordered]@{ bg = $bg; fg = (& $cor $fo.color); b = [bool]$fo.b; i = [bool]$fo.i; al = $x.alignment.horizontal; q = ($x.alignment.wrapText -eq '1') }
      if ($e.fg -eq '000000') { $e.fg = $null }
      $k = ($e.Values | ForEach-Object { "$_" }) -join '|'
      if (-not $chaveEst.ContainsKey($k)) { $chaveEst[$k] = $estilos.Count; [void]$estilos.Add($e) }
      $mapa[$i] = $chaveEst[$k]
      $id = [int]$x.numFmtId; $fmtDe[$i] = @($id, $(if ($numFmts.ContainsKey($id)) { $numFmts[$id] } else { '' }))
    }
    $wb = & $ler 'xl/workbook.xml'; $rels = & $ler 'xl/_rels/workbook.xml.rels'
    $out = [ordered]@{}
    foreach ($s in $wb.workbook.sheets.sheet) {
      if ($quais -notcontains $s.name) { continue }
      $rid = $s.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
      $alvo = 'xl/' + ((($rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }).Target) -replace '^/?xl/', '')
      $sh = & $ler $alvo
      $lim = $limites[$s.name]; $maxCol = if ($lim -and $lim.col) { [int]$lim.col } else { 60 }; $maxLin = if ($lim -and $lim.lin) { [int]$lim.lin } else { 400 }
      # larguras e colunas ocultas
      $larg = @{}; $oculta = @{}
      foreach ($c in @($sh.worksheet.cols.col)) { if (-not $c) { continue }
        for ($k = [int]$c.min; $k -le [Math]::Min([int]$c.max, $maxCol); $k++) { if ($c.width) { $larg[$k] = [double]::Parse($c.width, [Globalization.CultureInfo]::InvariantCulture) }; if ($c.hidden -eq '1') { $oculta[$k] = $true } } }
      $linhas = New-Object Collections.ArrayList; $ultCol = 1
      foreach ($r in $sh.worksheet.sheetData.row) {
        $n = [int]$r.r; if ($n -gt $maxLin) { break }
        if ($r.hidden -eq '1') { continue }
        $cels = New-Object Collections.ArrayList
        foreach ($cel in $r.c) {
          $col = Indice-Coluna ($cel.r -replace '\d', '')
          if ($col -gt $maxCol -or $oculta[$col]) { continue }
          $v = $cel.v; $si = if ($cel.s) { [int]$cel.s } else { 0 }
          if ($cel.t -eq 's' -and $v -ne $null) { $v = $ss[[int]$v] } elseif ($cel.t -eq 'inlineStr') { $v = $cel.is.InnerText }
          elseif ($cel.t -eq 'e') { $v = '' } elseif ($cel.t -eq 'b') { $v = if ($v -eq '1') { 'VERDADEIRO' } else { 'FALSO' } }
          elseif ($v -ne $null -and $cel.t -ne 'str') { $v = Formatar-Valor $v $fmtDe[$si][1] $fmtDe[$si][0] }
          $est = $mapa[$si]
          $temCor = $est -ne $null -and $estilos[$est].bg
          if (("$v").Trim() -eq '' -and -not $temCor) { continue }
          [void]$cels.Add(@($col, "$v", $est))
          if (("$v").Trim() -ne '' -and $col -gt $ultCol) { $ultCol = $col }
        }
        $h = if ($r.ht -and $r.customHeight -eq '1') { [double]::Parse($r.ht, [Globalization.CultureInfo]::InvariantCulture) } else { $null }
        if ($cels.Count -or $h) { [void]$linhas.Add([ordered]@{ n = $n; h = $h; c = $cels }) }
      }
      $ate = if ($lim -and $lim.col) { [int]$lim.col } else { $ultCol }
      $cols = @(1..$ate | Where-Object { -not $oculta[$_] } | ForEach-Object { [ordered]@{ i = $_; l = (Letra-Coluna $_); w = $(if ($larg.ContainsKey($_)) { $larg[$_] } else { 9 }) } })
      $mesclas = @($sh.worksheet.mergeCells.mergeCell | Where-Object { $_ } | ForEach-Object { $_.ref })
      # tira as linhas vazias do fim
      while ($linhas.Count -and -not @($linhas[$linhas.Count - 1].c | Where-Object { "$($_[1])".Trim() }).Count) { $linhas.RemoveAt($linhas.Count - 1) }
      $abaTab = $sh.worksheet.sheetPr.tabColor
      $out[$s.name] = [ordered]@{ cols = $cols; linhas = $linhas; mesclas = $mesclas; estilos = $estilos; corAba = (& $cor $abaTab) }
    }
    return $out
  } finally { $zip.Dispose(); Remove-Item $copia -ErrorAction SilentlyContinue }
}
