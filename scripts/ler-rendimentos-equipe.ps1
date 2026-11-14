# Médias de produtividade da EQUIPE por serviço (planilha de referência do Marcos): OPERACOES\GERENCIAMENTO OBRAS\*Produtividade_Equipes*.xlsx (a mais nova).
# Aba "Produtividade ...": serviço, unidade, MÉDIA PROPOSTA (produção por dia, de 8 h, da EQUIPE indicada) e quantos de cada profissional formam a equipe.
# Devolve { arquivo, modificado, profissionais: [nomes], itens: [ { cod, codR04, servico, unid, media, equipe: { "Pedreiro": 1, ... }, total, status, obs } ] }; sem planilha: $null.
# Item sem média (terceirizado) fica de fora; item com média e sem profissional (total 0) vem marcado e não entra no dimensionamento.
function Ler-RendimentosEquipe([string]$raiz) {
  $pasta = Join-Path $raiz 'OPERACOES\GERENCIAMENTO OBRAS'
  if (-not (Test-Path $pasta)) { return $null }
  $arq = Get-ChildItem $pasta -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(?i)Produtividade.*Equipe' -and $_.Extension -ieq '.xlsx' -and $_.Name -notmatch '~\$' } | Sort-Object LastWriteTime | Select-Object -Last 1
  if (-not $arq) { return $null }
  try { $abas = Ler-Xlsx $arq.FullName 0 } catch { return [ordered]@{ arquivo = $arq.Name; erro = $_.Exception.Message } }
  $nomeAba = @($abas.Keys) | Where-Object { $_ -match '(?i)^Produtividade' } | Select-Object -First 1
  if (-not $nomeAba) { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); erro = 'Aba "Produtividade" não encontrada' } }
  $linhas = $abas[$nomeAba]
  $cab = $null; $cols = @{}; $prof = [ordered]@{}
  foreach ($l in $linhas) {
    $t = @{}; foreach ($k in $l.c.Keys) { $t[$k] = "$($l.c[$k])".Trim() }
    $iServ = $t.Keys | Where-Object { $t[$_] -match '(?i)^Servi[cç]o$' } | Select-Object -First 1
    $iMed = $t.Keys | Where-Object { $t[$_] -match '(?i)^M[ée]dia proposta' } | Select-Object -First 1
    if ($iServ -and $iMed) {
      $cab = $l.n; $cols.serv = $iServ; $cols.media = $iMed
      foreach ($k in $t.Keys) {
        if ($t[$k] -match '(?i)^C[óo]d\.?\s*MO\d+') { $cols.cod = $k }
        elseif ($t[$k] -match '(?i)^C[óo]d\.?\s*R\d+') { $cols.cod2 = $k }
        elseif ($t[$k] -match '(?i)^Unid') { $cols.unid = $k }
        elseif ($t[$k] -match '(?i)^Status') { $cols.status = $k }
        elseif ($t[$k] -match '(?i)^Observa') { $cols.obs = $k }
        elseif ($t[$k] -match '(?i)^(Pedreiro|Ajudante|Eletricista|Bombeiro|Pintor|Montador|Carpinteiro|Gesseiro|Marmorista|Impermeabilizador|Servente)') { $prof[$k] = $t[$k] }
      }
      break
    }
  }
  if (-not $cab) { return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); erro = 'Cabeçalho (Serviço / Média proposta) não encontrado' } }
  $itens = New-Object Collections.ArrayList
  foreach ($l in $linhas) {
    if ($l.n -le $cab) { continue }
    $media = Numero $l.c[$cols.media]
    if ($media -eq $null -or $media -le 0 -or -not $l.c[$cols.serv]) { continue }
    $eq = [ordered]@{}; $total = 0
    foreach ($k in $prof.Keys) { $n = Numero $l.c[$k]; if ($n -ne $null -and $n -gt 0) { $eq[$prof[$k]] = $n; $total += $n } }
    [void]$itens.Add([ordered]@{
      cod = $l.c[$cols.cod]; codR04 = $l.c[$cols.cod2]; servico = $l.c[$cols.serv]; unid = $l.c[$cols.unid]; media = $media; equipe = $eq; total = $total
      status = $l.c[$cols.status]; obs = $l.c[$cols.obs]
    })
  }
  return [ordered]@{ arquivo = $arq.Name; modificado = $arq.LastWriteTime.ToString('o'); profissionais = @($prof.Values); itens = $itens }
}
