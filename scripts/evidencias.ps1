# Evidências (quem mexeu em quê, e quando) — carregado por exportar-drive.ps1.
# Para pontuar as tarefas sem a pessoa precisar marcar: cada arquivo novo ou alterado nas pastas de controle
# da obra vira um evento { obra, tipo, arquivo, quando, por }. "por" é quem salvou por último, gravado dentro do
# próprio arquivo (Office: lastModifiedBy; PDF: Author) — às vezes é uma conta compartilhada ("Conta Solida
# Pacote Office", "Solida_NTB11"). O histórico cresce a cada leitura (dados/json/evidencias.json, últimos 120 dias).

$PASTAS_EVID = [ordered]@{
  'GERENCIAMENTO\PROGRAMAÇÃO SEMANAL' = 'programacao'; 'GERENCIAMENTO\CRONOGRAMA' = 'cronograma'; 'GERENCIAMENTO\PENDENCIAS' = 'pendencias'
  'GERENCIAMENTO\DOC\ESCOPO' = 'escopo'; 'GERENCIAMENTO\ATA' = 'ata'; 'GERENCIAMENTO\RELATÓRIO SEMANAL' = 'relatorio'; 'GERENCIAMENTO\DIARIO DE OBRA' = 'diario'
}

function Quem-Salvou([IO.FileInfo]$f) {
  try {
    if ($f.Extension -match '^\.(xlsx|xlsm|docx|pptx)$') {
      $copia = Join-Path $temp ([Guid]::NewGuid().ToString() + '.zip'); Copy-Item -LiteralPath $f.FullName $copia
      $z = [IO.Compression.ZipFile]::OpenRead($copia)
      try {
        $e = $z.Entries | Where-Object { $_.FullName -eq 'docProps/core.xml' }; if (-not $e) { return '' }
        $sr = New-Object IO.StreamReader($e.Open()); $x = $sr.ReadToEnd(); $sr.Close()
        $m = [regex]::Match($x, '<cp:lastModifiedBy>([^<]*)'); if ($m.Success) { return [Net.WebUtility]::HtmlDecode($m.Groups[1].Value) }
        return ''
      } finally { $z.Dispose(); [IO.File]::Delete($copia) }
    }
    if ($f.Extension -ieq '.pdf' -and $f.Length -lt 8MB) {
      $s = [Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes($f.FullName))
      $m = [regex]::Match($s, '/Author\s*\(((?:\\.|[^)]){1,200})\)')
      if ($m.Success) {
        $v = $m.Groups[1].Value -replace '\\(.)', '$1'
        # texto UTF-16 (começa com FE FF)
        if ($v.StartsWith([string][char]0xFE + [char]0xFF)) { $b = [Text.Encoding]::GetEncoding(28591).GetBytes($v.Substring(2)); $v = [Text.Encoding]::BigEndianUnicode.GetString($b) }
        return $v.Trim()
      }
    }
  } catch { }
  return ''
}

$evidVistos = @{}; $eventosEvid = New-Object Collections.ArrayList
$jsonEvid = Join-Path $Saida 'evidencias.json'
if (Test-Path $jsonEvid) {
  try { foreach ($e in (Get-Content $jsonEvid -Raw -Encoding UTF8 | ConvertFrom-Json).eventos) { $evidVistos["$($e.caminho)|$($e.quando)"] = $true; [void]$eventosEvid.Add($e) } } catch { }
}

function Ler-Evidencias([string]$pastaObra, [string]$codigo) {
  $limite = (Get-Date).AddDays(-120)
  foreach ($sub in $PASTAS_EVID.Keys) {
    $dir = Join-Path $pastaObra $sub
    if (-not (Test-Path $dir)) { continue }
    foreach ($f in Get-ChildItem $dir -File -ErrorAction SilentlyContinue) {
      if ($f.LastWriteTime -lt $limite -or $f.Name -match '(?i)^(mo)?xxx|^~\$|\.(dwl2?|tmp|json|txt|bak)$|modelo|prompt|instru') { continue }
      $quando = $f.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
      $caminho = "$codigo\$sub\$($f.Name)"
      if ($evidVistos.ContainsKey("$caminho|$quando")) { continue }
      [void]$eventosEvid.Add([pscustomobject][ordered]@{ obra = $codigo; tipo = $PASTAS_EVID[$sub]; arquivo = $f.Name; caminho = $caminho; quando = $quando; por = (Quem-Salvou $f) })
      $evidVistos["$caminho|$quando"] = $true
    }
  }
}

function Gravar-Evidencias {
  $corte = (Get-Date).AddDays(-120).ToString('yyyy-MM-dd')
  $lista = @($eventosEvid | Where-Object { "$($_.quando)" -ge $corte } | Sort-Object quando)
  $j = [ordered]@{ geradoEm = (Get-Date).ToString('o'); eventos = $lista }
  [IO.File]::WriteAllText($jsonEvid, (ConvertTo-Json -InputObject $j -Depth 4 -Compress), $utf8)
}
