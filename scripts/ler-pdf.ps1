# Extrai o texto de um PDF (linha por linha, de cima para baixo), sem programas externos.
# Funciona com os PDFs que a Sólida gera (LibreOffice/Excel: fontes com ToUnicode, streams FlateDecode).
# Uso: . scripts\ler-pdf.ps1 ; Ler-PdfTexto 'arquivo.pdf'  → páginas { linhas, pedacos (x, y, t), retangulos (x, y, w, h, cor) }

Add-Type -AssemblyName System.IO.Compression

function Pdf-Inflar([byte[]]$dados) {
  try {
    $ms = New-Object IO.MemoryStream(, $dados); $ms.Position = 2   # pula o cabeçalho zlib
    $ds = New-Object IO.Compression.DeflateStream($ms, [IO.Compression.CompressionMode]::Decompress)
    $out = New-Object IO.MemoryStream
    $ds.CopyTo($out); $ds.Close()
    return $out.ToArray()
  } catch { return $null }
}

# CMap ToUnicode → hashtable código (int) → texto
function Pdf-LerCMap([string]$t) {
  $m = @{}
  $hex = { param($h) $sb = New-Object Text.StringBuilder; for ($i = 0; $i + 3 -lt $h.Length + 0; $i += 4) { [void]$sb.Append([char][Convert]::ToInt32($h.Substring($i, 4), 16)) }; if ($h.Length -eq 2) { [void]$sb.Append([char][Convert]::ToInt32($h, 16)) }; $sb.ToString() }
  foreach ($bl in [regex]::Matches($t, '(?s)beginbfchar(.*?)endbfchar')) {
    foreach ($p in [regex]::Matches($bl.Groups[1].Value, '<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>')) { $m[[Convert]::ToInt32($p.Groups[1].Value, 16)] = & $hex $p.Groups[2].Value }
  }
  foreach ($bl in [regex]::Matches($t, '(?s)beginbfrange(.*?)endbfrange')) {
    foreach ($p in [regex]::Matches($bl.Groups[1].Value, '<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])')) {
      $a = [Convert]::ToInt32($p.Groups[1].Value, 16); $b = [Convert]::ToInt32($p.Groups[2].Value, 16)
      if ($p.Groups[4].Success) {
        $base = [Convert]::ToInt32($p.Groups[4].Value, 16)
        for ($c = $a; $c -le $b; $c++) { $m[$c] = [string][char]($base + $c - $a) }
      } else {
        $lista = [regex]::Matches($p.Groups[5].Value, '<([0-9A-Fa-f]+)>'); $i = 0
        for ($c = $a; $c -le $b -and $i -lt $lista.Count; $c++) { $m[$c] = & $hex $lista[$i].Groups[1].Value; $i++ }
      }
    }
  }
  return $m
}

function Ler-PdfTexto([string]$arquivo) {
  $bytes = [IO.File]::ReadAllBytes($arquivo)
  $lat = [Text.Encoding]::GetEncoding(28591)
  $s = $lat.GetString($bytes)
  # objetos: número → { dic, stream (bytes já descomprimidos) }
  $objs = @{}
  foreach ($o in [regex]::Matches($s, '(?s)(\d+)\s+0\s+obj(.*?)endobj')) {
    $corpo = $o.Groups[2].Value; $num = [int]$o.Groups[1].Value
    $st = $null; $dic = $corpo
    $k = $corpo.IndexOf('stream')
    if ($k -ge 0) {
      $dic = $corpo.Substring(0, $k)
      $ini = $o.Groups[2].Index + $k + 6
      if ($s[$ini] -eq "`r") { $ini++ }; if ($s[$ini] -eq "`n") { $ini++ }
      $fim = $s.IndexOf('endstream', $ini)
      $raw = New-Object byte[] ($fim - $ini); [Array]::Copy($bytes, $ini, $raw, 0, $raw.Length)
      $st = if ($dic -match '/FlateDecode') { Pdf-Inflar $raw } elseif ($dic -match '/DCTDecode') { $null } else { $raw }
    }
    $objs[$num] = @{ dic = $dic; st = $st }
  }
  $ref = { param($txt, $chave) $m = [regex]::Match($txt, "/$chave\s+(\d+)\s+0\s+R"); if ($m.Success) { [int]$m.Groups[1].Value } else { $null } }
  $cmaps = @{}
  $paginas = New-Object Collections.ArrayList
  foreach ($n in ($objs.Keys | Sort-Object)) {
    $d = $objs[$n].dic
    if ($d -notmatch '/Type\s*/Page[^s]') { continue }
    # fontes da página: /Font << /F1 5 0 R ... >> (direto ou num objeto de recursos)
    $res = $d; $rn = & $ref $d 'Resources'; if ($rn -ne $null -and $objs[$rn]) { $res = $objs[$rn].dic }
    $fontTxt = ([regex]::Match($res, '(?s)/Font\s*<<(.*?)>>')).Groups[1].Value
    if (-not $fontTxt) { $fn = & $ref $res 'Font'; if ($fn -ne $null) { $fontTxt = $objs[$fn].dic } }
    $fontes = @{}
    foreach ($f in [regex]::Matches($fontTxt, '/([\w.+-]+)\s+(\d+)\s+0\s+R')) {
      $fo = [int]$f.Groups[2].Value
      if (-not $cmaps.ContainsKey($fo)) {
        $tu = if ($objs[$fo]) { & $ref $objs[$fo].dic 'ToUnicode' } else { $null }
        $cmaps[$fo] = if ($tu -ne $null -and $objs[$tu].st) { Pdf-LerCMap ($lat.GetString($objs[$tu].st)) } else { $null }
      }
      $fontes[$f.Groups[1].Value] = $cmaps[$fo]
    }
    # conteúdo da página (um ou vários streams)
    $cont = ''
    $cm = [regex]::Match($d, '/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)')
    foreach ($r in [regex]::Matches($cm.Groups[1].Value, '(\d+)\s+0\s+R')) { $o = $objs[[int]$r.Groups[1].Value]; if ($o -and $o.st) { $cont += $lat.GetString($o.st) + "`n" } }
    $pedacos = New-Object Collections.ArrayList
    $cmap = $null; $x = 0.0; $y = 0.0; $lx = 0.0; $ly = 0.0; $tl = 0.0
    $dec = {
      param($tok)
      if ($tok.StartsWith('<')) {
        $h = $tok.Trim('<', '>') -replace '\s', ''
        $sb = New-Object Text.StringBuilder
        $passo = if ($cmap -and ($cmap.Keys | Where-Object { $_ -gt 255 } | Select-Object -First 1)) { 4 } else { 2 }
        if ($h.Length % 4 -ne 0) { $passo = 2 }
        for ($i = 0; $i + $passo -le $h.Length; $i += $passo) {
          $c = [Convert]::ToInt32($h.Substring($i, $passo), 16)
          if ($cmap -and $cmap.ContainsKey($c)) { [void]$sb.Append($cmap[$c]) } elseif ($c -ge 32 -and $c -lt 256) { [void]$sb.Append([char]$c) }
        }
        return $sb.ToString()
      }
      $t = $tok.Substring(1, $tok.Length - 2) -replace '\\\(', '(' -replace '\\\)', ')' -replace '\\\\', '\'
      $t = [regex]::Replace($t, '\\(\d{3})', { param($mm) [string][char][Convert]::ToInt32($mm.Groups[1].Value, 8) })
      if ($cmap) { $sb = New-Object Text.StringBuilder; foreach ($ch in $t.ToCharArray()) { $c = [int]$ch; if ($cmap.ContainsKey($c)) { [void]$sb.Append($cmap[$c]) } else { [void]$sb.Append($ch) } }; return $sb.ToString() }
      return $t
    }
    $pilha = New-Object Collections.ArrayList
    $retangulos = New-Object Collections.ArrayList; $corAtual = $null
    foreach ($tk in [regex]::Matches($cont, '<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\)])*\)|\[|\]|/[^\s/\[\]()<>]+|[-+]?\d*\.?\d+|[A-Za-z*''"]+')) {
      $v = $tk.Value
      switch -regex ($v) {
        '^(BT)$' { $x = 0; $y = 0; $lx = 0; $ly = 0; $pilha.Clear(); break }
        '^Tf$' { $nome = ($pilha | Where-Object { $_ -like '/*' } | Select-Object -Last 1); if ($nome) { $cmap = $fontes[$nome.Substring(1)] }; $pilha.Clear(); break }
        '^TL$' { $tl = [double]$pilha[-1]; $pilha.Clear(); break }
        '^(Td|TD)$' { $lx += [double]$pilha[-2]; $ly += [double]$pilha[-1]; $x = $lx; $y = $ly; if ($v -eq 'TD') { $tl = - [double]$pilha[-1] }; $pilha.Clear(); break }
        '^Tm$' { $lx = [double]$pilha[-2]; $ly = [double]$pilha[-1]; $x = $lx; $y = $ly; $pilha.Clear(); break }
        '^T\*$' { $ly -= $tl; $x = $lx; $y = $ly; $pilha.Clear(); break }
        '^(Tj|TJ|''|")$' {
          $txt = (($pilha | Where-Object { $_ -match '^[<(]' }) | ForEach-Object { & $dec $_ }) -join ''
          # espaço quando o TJ tem um ajuste grande (separação de palavras)
          if ($v -eq 'TJ') {
            $sb = New-Object Text.StringBuilder
            foreach ($p in $pilha) { if ($p -match '^[<(]') { [void]$sb.Append((& $dec $p)) } elseif ($p -match '^[-+]?\d*\.?\d+$' -and [double]$p -lt -180) { [void]$sb.Append(' ') } }
            $txt = $sb.ToString()
          }
          if ($txt.Trim()) { [void]$pedacos.Add([pscustomobject]@{ x = $x; y = $y; t = $txt }) }
          $pilha.Clear(); break
        }
        '^rg$' { if ($pilha.Count -ge 3) { $corAtual = @([double]$pilha[-3], [double]$pilha[-2], [double]$pilha[-1]) }; $pilha.Clear(); break }
        '^re$' { if ($pilha.Count -ge 4 -and $corAtual) { [void]$retangulos.Add([pscustomobject]@{ x = [double]$pilha[-4]; y = [double]$pilha[-3]; w = [double]$pilha[-2]; h = [double]$pilha[-1]; cor = $corAtual }) }; $pilha.Clear(); break }
        '^(ET|f|S|cm|q|Q|w|g|G|rg|RG|m|l|h|n|W|Do|gs|cs|CS|sc|scn|SC|SCN|Tc|Tw|Tz|Ts|Tr|d|j|J|M|i|ri|c|v|y|b|B)$' { $pilha.Clear(); break }
        default { [void]$pilha.Add($v) }
      }
    }
    # agrupa por linha (mesmo y, com tolerância) e ordena por x
    $linhas = New-Object Collections.ArrayList
    foreach ($grp in ($pedacos | Group-Object { [Math]::Round($_.y / 3) } | Sort-Object { - [double]$_.Name })) {
      $ps = $grp.Group | Sort-Object x
      $txt = ''; $antX = $null
      foreach ($p in $ps) { if ($antX -ne $null -and $p.x - $antX -gt 30 -and $txt -notmatch '\s$') { $txt += '  ' }; $txt += $p.t; $antX = $p.x }
      [void]$linhas.Add(($txt -replace '\s{3,}', '  ').Trim())
    }
    [void]$paginas.Add([pscustomobject]@{ linhas = @($linhas | Where-Object { $_ }); pedacos = $pedacos; retangulos = $retangulos })
  }
  return $paginas
}

# ---------------------------------------------------------------- tabelas (programação semanal / pendências)
# Lê as tabelas dos PDFs de programação semanal, metas semanais e pendências: cabeçalho com ETAPA/LOCAL,
# ITEM/PENDÊNCIA, QUANTIDADE, RESPONSÁVEL, STATUS e OBS. As colunas saem da posição do cabeçalho; uma
# linha nova começa quando há texto em RESPONSÁVEL ou STATUS (o resto é continuação de texto quebrado).
# A cor da faixa da 1ª coluna diz se é CINZA (Sólida) ou LARANJA (terceiros).
function Tipo-DaCor($c) {
  if (-not $c) { return '' }
  $r, $g, $b = $c
  if ($r -gt 0.85 -and $g -gt 0.45 -and $g -lt 0.75 -and $b -lt 0.5) { return 'laranja' }
  if ([Math]::Abs($r - $g) -lt 0.05 -and [Math]::Abs($g - $b) -lt 0.05 -and $r -lt 0.9) { return 'cinza' }
  return ''
}

function Ler-TabelaPdf($paginas) {
  $chaves = [ordered]@{ real = '(?i)STATUS REAL'; etapa = '(?i)^(ETAPA|LOCAL)'; item = '(?i)^(ITEM|PEND)'; qtd = '(?i)^QUANT'; resp = '(?i)^RESPONS'; status = '(?i)^STATUS'; obs = '(?i)^OBS' }
  $res = [ordered]@{ titulo = ''; nota = ''; secoes = New-Object Collections.ArrayList }
  $secao = $null; $cols = $null; $linhaAtual = $null; $pendente = ''
  $novaSecao = { param($t) $s = [ordered]@{ titulo = $t; avisos = New-Object Collections.ArrayList; linhas = New-Object Collections.ArrayList }; [void]$res.secoes.Add($s); return $s }
  foreach ($pg in $paginas) {
    $visuais = @($pg.pedacos | Group-Object { [Math]::Round($_.y / 2.5) } | Sort-Object { - [double]$_.Name } | ForEach-Object { , @($_.Group | Sort-Object x) })
    for ($i = 0; $i -lt $visuais.Count; $i++) {
      $ps = $visuais[$i]
      $texto = (($ps | ForEach-Object { $_.t.Trim() }) -join '  ').Trim()
      if (-not $texto) { continue }
      # cabeçalho da tabela (repete em cada página)
      if ($texto -match '(?i)RESPONS' -and $texto -match '(?i)STATUS') {
        $cols = New-Object Collections.ArrayList
        foreach ($p in $ps) { foreach ($k in $chaves.Keys) { if ($p.t.Trim() -match $chaves[$k]) { [void]$cols.Add([pscustomobject]@{ k = $k; x = $p.x }); break } } }
        $cols = @($cols | Sort-Object x); $linhaAtual = $null; $pendente = ''
        if (-not $secao) { $secao = & $novaSecao '' }
        continue
      }
      if ($texto -match '^(Legenda|CINZA\s|LARANJA\s|ALERTA\s)') { $cols = $null; continue }
      if (-not $cols) {
        if (-not $res.titulo -and $texto -match '(?i)PROGRAMA|PEND[ÊE]NCIAS|METAS') { $res.titulo = $texto -replace '\s{2,}', ' · '; continue }
        if (-not $res.nota -and $texto.Length -gt 60) { $res.nota = $texto; continue }
      }
      if ($texto -match '^SEMANA\s+S?\d+') { $secao = & $novaSecao ($texto -replace '\s{2,}', ' '); $cols = $null; continue }
      if ($texto -match '^⚠' -or ($ps.Count -le 2 -and $texto -match '^⚠|FERIADO:')) { if ($secao) { [void]$secao.avisos.Add(($texto -replace '^⚠\s*', '')) }; continue }
      if (-not $cols) { continue }
      # distribui os pedaços pelas colunas
      $cel = @{}
      foreach ($p in $ps) {
        $c = $cols | Where-Object { $_.x -le $p.x + 3 } | Select-Object -Last 1
        if (-not $c) { $c = $cols[0] }
        $cel[$c.k] = (("$($cel[$c.k]) " + $p.t.Trim())).Trim()
      }
      $inicia = $cel['resp'] -or $cel['status']
      if ($inicia) {
        $tipo = ''
        $ret = $pg.retangulos | Where-Object { $_.x -lt ($cols[0].x + 2) -and ($_.x + $_.w) -gt ($cols[0].x + 2) -and $_.w -lt 300 -and $ps[0].y -ge $_.y - 1 -and $ps[0].y -le ($_.y + $_.h + 1) } | Select-Object -Last 1
        if ($ret) { $tipo = Tipo-DaCor $ret.cor }
        $linhaAtual = [ordered]@{ etapa = (("$pendente " + $cel['etapa'])).Trim(); item = $cel['item']; qtd = $cel['qtd']; resp = $cel['resp']; status = $cel['status']; obs = $cel['obs']; tipo = $tipo }
        $pendente = ''
        if (-not $secao) { $secao = & $novaSecao '' }
        [void]$secao.linhas.Add($linhaAtual)
        continue
      }
      # só a 1ª coluna e a próxima linha começa sem etapa: é a etapa da próxima
      $soEtapa = $cel.Count -eq 1 -and $cel['etapa']
      if ($soEtapa -and $i + 1 -lt $visuais.Count) {
        $prox = $visuais[$i + 1]
        $proxTemEtapa = @($prox | Where-Object { $_.x -lt $cols[1].x - 3 }).Count -gt 0
        $proxInicia = @($prox | Where-Object { $c = $cols | Where-Object { $_.x -le $p.x + 3 }; $true } | Where-Object { $x0 = $_.x; $cc = $cols | Where-Object { $_.x -le $x0 + 3 } | Select-Object -Last 1; $cc -and $cc.k -in 'resp', 'status' }).Count -gt 0
        if ($proxInicia -and -not $proxTemEtapa) { $pendente = "$pendente $($cel['etapa'])".Trim(); continue }
      }
      if ($linhaAtual) { foreach ($k in $cel.Keys) { if ($k -ne 'real') { $linhaAtual[$k] = ("$($linhaAtual[$k]) " + $cel[$k]).Trim() } } }
    }
  }
  return $res
}