# Programação semanal em planilha: GERENCIAMENTO\PROGRAMAÇÃO SEMANAL\<obra>_PROGRAMAÇÃO SEMANAL_S<nn>_R<nn>.xlsx (a mais nova).
# Colunas (achadas pelo título, na ordem que estiverem): DATA · FASE · COD · TAREFA · Q. EST. · UNID · LOCAL · FUNCIONÁRIO. A data vale para as linhas de baixo até a próxima data.
# Devolve { arquivo, modificado, semana ("S33"), linhas: [ { data, fase, cod, tarefa, qtd, un, local, funcionario } ] }; sem planilha: $null.
function Ler-ProgramacaoXlsx([string]$pastaProg, [string]$codigo) {
  $arq = Get-ChildItem $pastaProg -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "(?i)^$codigo" -and $_.Extension -ieq '.xlsx' -and $_.Name -match '(?i)PROGRAMA' -and $_.Name -notmatch '(?i)PEND|METAS|PREVIS|teste|claude|~\$' } |
    Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $arq) { return $null }
  try { $abas = Ler-Xlsx $arq.FullName 0 } catch { return [ordered]@{ arquivo = $arq.Name; erro = $_.Exception.Message } }
  $linhas = @($abas.Values)[0]
  $semana = [regex]::Match($arq.Name, '(?i)_S(\d+)').Groups[1].Value
  # linha do cabeçalho: a que tem DATA e TAREFA
  $cab = $null; $cols = @{}
  foreach ($l in $linhas) {
    $achados = @{}
    foreach ($k in $l.c.Keys) {
      $t = "$($l.c[$k])".Trim().ToUpper()
      if ($t -eq 'DATA') { $achados.data = $k } elseif ($t -eq 'FASE') { $achados.fase = $k } elseif ($t -eq 'COD') { $achados.cod = $k } elseif ($t -eq 'TAREFA') { $achados.tarefa = $k }
      elseif ($t -match '^Q\.?\s*EST') { $achados.qtd = $k } elseif ($t -match '^UNID') { $achados.un = $k } elseif ($t -eq 'LOCAL') { $achados.local = $k } elseif ($t -match '^FUNCION') { $achados.func = $k }
    }
    if ($achados.data -and $achados.tarefa) { $cab = $l.n; $cols = $achados; break }
  }
  if (-not $cab) { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); semana = $semana; erro = 'Cabeçalho DATA/TAREFA não encontrado' } }
  $saida = New-Object Collections.ArrayList
  $dataAtual = $null
  foreach ($l in $linhas) {
    if ($l.n -le $cab) { continue }
    $d = $l.c[$cols.data]
    if ($d) {
      $iso = $null
      $n = DeSerial $d
      if ($n) { $iso = Iso $n }
      elseif ("$d" -match '^(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?') {
        $a = if ($matches[3]) { [int]$matches[3] } else { $arq.LastWriteTime.Year }
        if ($a -lt 100) { $a += 2000 }
        try { $dt = Get-Date -Year $a -Month ([int]$matches[2]) -Day ([int]$matches[1]); if (-not $matches[3] -and $dt -gt $arq.LastWriteTime.AddDays(200)) { $dt = $dt.AddYears(-1) }; $iso = Iso $dt } catch { }
      }
      if ($iso) { $dataAtual = $iso }
    }
    $tarefa = $l.c[$cols.tarefa]
    if (-not $tarefa) { continue }
    [void]$saida.Add([ordered]@{
      data = $dataAtual; fase = $l.c[$cols.fase]; cod = $l.c[$cols.cod]; tarefa = $tarefa
      qtd = $(if ($cols.qtd) { Numero $l.c[$cols.qtd] } else { $null }); un = $l.c[$cols.un]; local = $l.c[$cols.local]; funcionario = $l.c[$cols.func]
    })
  }
  return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); semana = $(if ($semana) { "S$semana" } else { '' }); linhas = $saida }
}
