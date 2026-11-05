# Servidor local do Sistema Sólida. Não precisa instalar nada: usa o próprio Windows.
# Uso:  powershell -ExecutionPolicy Bypass -File servidor.ps1 [-Porta 8080] [-AbrirNavegador]
#
# Além de servir as páginas (app/) e os dados do pós-obra (dados/json/), ele busca no Google Drive
# o mesmo dados.json que o Painel da Empresa lê (rota /api/painel) — o navegador não consegue baixar
# direto do Drive. Guarda uma cópia: sem internet, mostra os últimos dados baixados.
param(
  [int]$Porta = 8080,
  [switch]$AbrirNavegador
)

$raiz = [IO.Path]::GetFullPath($PSScriptRoot)
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'
}
$cache = Join-Path $raiz 'dados\painel-cache.json'
$utf8 = New-Object Text.UTF8Encoding $false

# ---------------------------------------------------------------- link do dados.json
# Ordem: config.json (raiz do sistema) → link configurado no Painel da Empresa (AppData\Sólida).
function Ler-Link {
  $cfg = Join-Path $raiz 'config.json'
  if (Test-Path $cfg) {
    try { $l = (Get-Content $cfg -Raw -Encoding UTF8 | ConvertFrom-Json).linkPainel; if ($l) { return $l } } catch { }
  }
  foreach ($pasta in @('Sólida', 'Painel da Empresa')) {
    $p = Join-Path $env:APPDATA "$pasta\preferencias.json"
    if (Test-Path $p) {
      try { $l = (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).link; if ($l) { return $l } } catch { }
    }
  }
  return $null
}

# Mesmo tratamento do Painel da Empresa: link de compartilhamento → download direto
function Link-Direto([string]$link) {
  $m = [regex]::Match($link, 'drive\.google\.com/file/d/([\w-]+)')
  if (-not $m.Success) { $m = [regex]::Match($link, 'drive\.google\.com/(?:open|uc)\?(?:.*&)?id=([\w-]+)') }
  if ($m.Success) { return "https://drive.google.com/uc?export=download&id=$($m.Groups[1].Value)" }
  return $link
}

$script:ultimaBusca = [datetime]::MinValue
$script:estadoPainel = @{ origem = 'nenhum'; atualizado = $null; erro = $null }

# dados\painel-montado.json: dados.json remontado pela rotina "montador" a partir dos dados locais (coletor, leitor, planilhas).
# Vale no lugar do arquivo do Drive só enquanto o atualizadoEm dele for mais novo; se o Drive passar a ter um mais novo, o do Drive volta a valer.
function Aplicar-Montado([string]$montado, [string]$cacheArq) {
  if (-not (Test-Path $montado)) { return }
  try {
    $rx = '"atualizadoEm"\s*:\s*"([^"]+)"'
    $tm = [IO.File]::ReadAllText($montado, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $mm = [regex]::Match($tm, $rx)
    if (-not $mm.Success -or $tm -notmatch '"areas"' -or $tm -notmatch '"geral"') { return }
    $dm = [datetimeoffset]::Parse($mm.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture)
    $dc = [datetimeoffset]::MinValue
    if (Test-Path $cacheArq) {
      $mc = [regex]::Match([IO.File]::ReadAllText($cacheArq, [Text.Encoding]::UTF8), $rx)
      if ($mc.Success) { $dc = [datetimeoffset]::Parse($mc.Groups[1].Value, [Globalization.CultureInfo]::InvariantCulture) }
    }
    if ($dm -gt $dc) { [IO.File]::WriteAllText($cacheArq, $tm, $utf8) }
  } catch { }
}

function Buscar-Painel {
  # no máximo uma ida ao Drive por minuto; entre uma e outra, usa a cópia
  if (((Get-Date) - $script:ultimaBusca).TotalSeconds -lt 60 -and (Test-Path $cache)) { return }
  $script:ultimaBusca = Get-Date
  $link = Ler-Link
  if (-not $link) {
    $script:estadoPainel = @{ origem = 'nenhum'; atualizado = $null; erro = 'Link do dados.json não configurado (config.json).' }
    return
  }
  try {
    $r = Invoke-WebRequest (Link-Direto $link) -UseBasicParsing -TimeoutSec 30
    $texto = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()).TrimStart([char]0xFEFF)
    $json = $texto | ConvertFrom-Json
    if (-not $json.areas -or -not $json.geral) { throw 'O link não devolveu o dados.json do painel (faltam "geral" e "areas").' }
    [IO.File]::WriteAllText($cache, $texto, $utf8)
    Aplicar-Montado (Join-Path $raiz 'dados\painel-montado.json') $cache
    $script:estadoPainel = @{ origem = 'link'; atualizado = (Get-Date).ToString('o'); erro = $null }
  } catch {
    Aplicar-Montado (Join-Path $raiz 'dados\painel-montado.json') $cache
    $script:estadoPainel = @{ origem = 'cache'; atualizado = $script:estadoPainel.atualizado; erro = "Sem conexão com o Drive. Mostrando os últimos dados baixados. ($($_.Exception.Message))" }
  }
}

function Resposta-Painel {
  Buscar-Painel
  $arq = $cache
  if (-not (Test-Path $arq)) { $arq = Join-Path $env:APPDATA 'Sólida\dados-cache.json' }  # cópia do Painel da Empresa
  $dados = if (Test-Path $arq) { [IO.File]::ReadAllText($arq, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF) } else { 'null' }
  $e = $script:estadoPainel
  $meta = @{ origem = $e.origem; atualizado = $e.atualizado; erro = $e.erro } | ConvertTo-Json -Compress
  return $meta.Substring(0, $meta.Length - 1) + ',"dados":' + $dados + '}'
}

# ---------------------------------------------------------------- planilhas e pastas do Drive (G:)
# orcamentos.json e projetos.json saem de scripts\exportar-drive.ps1, que lê o Google Drive para
# computador. Roda em segundo plano (leva ~20 s), no máximo a cada 10 minutos; enquanto isso a tela
# usa os arquivos da última leitura.
$script:exportacao = $null
$script:ultimaExportacao = [datetime]::MinValue
function Atualizar-Drive {
  if ($script:exportacao -and -not $script:exportacao.HasExited) { return }
  # o coletor (scripts/coletor.ps1) também lê o Drive: só uma leitura por vez, para não escreverem nos mesmos arquivos
  if (@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'exportar-drive.ps1' }).Count) { return }
  if (((Get-Date) - $script:ultimaExportacao).TotalMinutes -lt 10) { return }
  $script:ultimaExportacao = Get-Date
  $exp = Join-Path $raiz 'scripts\exportar-drive.ps1'
  try {
    $script:exportacao = Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$exp`"" -WindowStyle Hidden -PassThru
    Registrar 'Lendo orçamentos e projetos no Drive'
  } catch { Registrar "Erro ao ler o Drive: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------- pedidos de alteração
# Botão "Pedir alteração" das telas: grava em dados/pedidos.json. O Claude lê esse arquivo,
# faz as alterações no sistema e marca cada pedido como feito (status + resposta).
$pedidosArq = Join-Path $raiz 'dados\pedidos.json'
function Texto-Pedidos {
  if (-not (Test-Path $pedidosArq)) { return '[]' }
  return [IO.File]::ReadAllText($pedidosArq, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
}
function Ler-Pedidos {
  # (no PowerShell 5.1, @(... | ConvertFrom-Json) embrulha a lista: percorre item a item)
  $lista = New-Object Collections.ArrayList
  try { $o = ConvertFrom-Json (Texto-Pedidos); foreach ($p in $o) { if ($p.value -and $p.Count) { foreach ($q in $p.value) { [void]$lista.Add($q) } } else { [void]$lista.Add($p) } } } catch { }
  return ,$lista
}
function Gravar-Pedido($req) {
  $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $corpo = $sr.ReadToEnd() | ConvertFrom-Json
  $sr.Close()
  $texto = "$($corpo.texto)".Trim()
  if (-not $texto) { throw 'Pedido vazio.' }
  if ($texto.Length -gt 4000) { $texto = $texto.Substring(0, 4000) }
  $lista = Ler-Pedidos
  $novo =[pscustomobject][ordered]@{
    id = (Get-Date).ToString('yyyyMMddHHmmss') + '-' + (Get-Random -Maximum 999)
    data = (Get-Date).ToString('o'); tela = "$($corpo.tela)"; titulo = "$($corpo.titulo)"
    pessoa = "$($corpo.pessoa)"; funcao = "$($corpo.funcao)"; texto = $texto
    # diretoria: já entra aprovado ("aberto"); os outros esperam a aprovação da diretoria
    status = $(if ($corpo.diretoria -eq $true) { 'aberto' } else { 'aprovacao' }); resposta = ''
    aprovadoPor = $(if ($corpo.diretoria -eq $true) { "$($corpo.pessoa)" } else { '' })
  }
  [void]$lista.Add($novo)
  [IO.File]::WriteAllText($pedidosArq, (ConvertTo-Json -InputObject $lista.ToArray() -Depth 4), $utf8)
  Registrar "Pedido de alteração: $($novo.tela) · $($texto.Substring(0, [Math]::Min(80, $texto.Length)))"
  return $novo
}

# Diretoria aprova ("aberto") ou recusa ("recusado") um pedido que está aguardando aprovação
function Decidir-Pedido($req) {
  $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $corpo = $sr.ReadToEnd() | ConvertFrom-Json
  $sr.Close()
  if ($corpo.status -notin 'aberto', 'recusado') { throw 'Decisão inválida.' }
  $lista = Ler-Pedidos
  $p = $lista | Where-Object { $_.id -eq $corpo.id } | Select-Object -First 1
  if (-not $p) { throw 'Pedido não encontrado.' }
  if ($p.status -ne 'aprovacao') { throw 'Este pedido não está aguardando aprovação.' }
  $p.status = $corpo.status
  $p | Add-Member -NotePropertyName aprovadoPor -NotePropertyValue "$($corpo.pessoa)" -Force
  if ($corpo.status -eq 'recusado') { $p.resposta = 'Recusado pela diretoria.' }
  [IO.File]::WriteAllText($pedidosArq, (ConvertTo-Json -InputObject $lista.ToArray() -Depth 4), $utf8)
  Registrar "Pedido $($p.id) $(if ($corpo.status -eq 'aberto') { 'aprovado' } else { 'recusado' }) por $($corpo.pessoa)"
  return $p
}

# ---------------------------------------------------------------- tarefas da semana (feito / não feito)
# Cada marcação do quadro de funções (Minha semana) vira uma linha em dados/tarefas-feitas.jsonl
# (a última marcação de cada pessoa + dia + tarefa é a que vale). É daqui que sai a pontuação do Perfil.
$tarefasArq = Join-Path $raiz 'dados\tarefas-feitas.jsonl'
function Texto-Tarefas {
  if (-not (Test-Path $tarefasArq)) { return '[]' }
  $linhas = [IO.File]::ReadAllLines($tarefasArq, [Text.Encoding]::UTF8) | Where-Object { $_.Trim() }
  return '[' + ($linhas -join ',') + ']'
}
function Gravar-Tarefa($req) {
  $c = Ler-Corpo $req
  $pessoa = "$($c.pessoa)"; $data = "$($c.data)"; $tarefa = "$($c.tarefa)"; $valor = "$($c.valor)"
  if ($pessoa -notmatch '^[\w.:@ -]{2,80}$') { throw 'Pessoa inválida.' }
  $registro = $c.registro -eq $true   # só atualiza nome/função/obras da pessoa
  if (-not $registro -and $data -notmatch '^\d{4}-\d{2}-\d{2}$') { throw 'Data inválida.' }
  if (-not $registro -and $tarefa -notmatch '^[a-z_]+-\d{1,4}$') { throw 'Tarefa inválida.' }
  if ($valor -notin 'feito', 'nao', '') { throw 'Marcação inválida.' }
  $linha = [ordered]@{ pessoa = $pessoa; nome = ("$($c.nome)" -replace '[\r\n]', ' ').Substring(0, [Math]::Min(60, "$($c.nome)".Length)); funcao = "$($c.funcao)"
    data = $data; tarefa = $tarefa; valor = $valor; teste = [bool]$c.teste; registro = $registro
    obras = @($c.obras | Where-Object { "$_" -match '^Mo\d+[A-Z]?$' } | ForEach-Object { "$_" }); em = (Get-Date).ToString('o') }
  $json = ConvertTo-Json -InputObject $linha -Compress
  [IO.File]::AppendAllText($tarefasArq, $json + "`n", $utf8)
  return $json
}
# ---------------------------------------------------------------- fotos do perfil
# A própria pessoa coloca a foto no Perfil (o navegador já manda reduzida, 256 px em JPEG).
# Fica em dados/fotos/<nome>.jpg; /api/fotos lista quem tem foto (com a data, para o navegador não usar cópia velha).
$fotosDir = Join-Path $raiz 'dados\fotos'
function Chave-Foto([string]$s) { $k = ($s.ToLower().Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace '[^a-z0-9]+', '_').Trim('_'); if ($k -notmatch '^[a-z0-9_]{2,40}$') { throw 'Pessoa inválida.' }; return $k }
function Lista-Fotos {
  if (-not (Test-Path $fotosDir)) { return '{}' }
  $m = [ordered]@{}; foreach ($f in Get-ChildItem $fotosDir -Filter '*.jpg') { $m[$f.BaseName] = $f.LastWriteTime.ToString('yyyyMMddHHmmss') }
  return (ConvertTo-Json -InputObject $m -Compress)
}
function Gravar-Foto($req) {
  $c = Ler-Corpo $req
  $k = Chave-Foto "$($c.pessoa)"
  New-Item -ItemType Directory -Force $fotosDir | Out-Null
  $arq = Join-Path $fotosDir "$k.jpg"
  if ($c.remover -eq $true) { if (Test-Path -LiteralPath $arq) { [IO.File]::Delete($arq) }; return Lista-Fotos }
  $m = [regex]::Match("$($c.imagem)", '^data:image/jpeg;base64,([A-Za-z0-9+/=]+)$')
  if (-not $m.Success) { throw 'Imagem inválida.' }
  $bytes = [Convert]::FromBase64String($m.Groups[1].Value)
  if ($bytes.Length -gt 400KB -or $bytes[0] -ne 0xFF -or $bytes[1] -ne 0xD8) { throw 'Imagem inválida ou grande demais.' }
  [IO.File]::WriteAllBytes($arq, $bytes)
  Registrar "Foto do perfil atualizada: $k"
  return Lista-Fotos
}
# ---------------------------------------------------------------- feed (notícias e recados para todos)
# Cada ação vira uma linha em dados/feed.jsonl (publicar, comentar, curtir, fixar, apagar); o navegador monta o feed.
$feedArq = Join-Path $raiz 'dados\feed.jsonl'
function Texto-Feed {
  if (-not (Test-Path $feedArq)) { return '[]' }
  $linhas = [IO.File]::ReadAllLines($feedArq, [Text.Encoding]::UTF8) | Where-Object { $_.Trim() }
  return '[' + ($linhas -join ',') + ']'
}
function Gravar-Feed($req) {
  $c = Ler-Corpo $req
  $acao = "$($c.acao)"
  if ($acao -notin 'publicar', 'comentar', 'curtir', 'fixar', 'apagar') { throw 'Ação inválida.' }
  $autor = ("$($c.autor)" -replace '[\r\n]', ' ').Trim()
  if (-not $autor -or $autor.Length -gt 60) { throw 'Autor inválido.' }
  $texto = "$($c.texto)".Trim()
  if ($acao -in 'publicar', 'comentar') { if (-not $texto) { throw 'Mensagem vazia.' }; if ($texto.Length -gt 3000) { $texto = $texto.Substring(0, 3000) } }
  $alvo = "$($c.post)"
  if ($acao -ne 'publicar' -and $alvo -notmatch '^\d{14}-\d{1,3}$') { throw 'Publicação inválida.' }
  $ev = [ordered]@{ id = (Get-Date).ToString('yyyyMMddHHmmss') + '-' + (Get-Random -Maximum 999); acao = $acao; post = $alvo
    autor = $autor; funcao = "$($c.funcao)"; texto = $texto; valor = [bool]$c.valor; em = (Get-Date).ToString('o') }
  $json = ConvertTo-Json -InputObject $ev -Compress
  [IO.File]::AppendAllText($feedArq, $json + "`n", $utf8)
  if ($acao -eq 'publicar') { Registrar "Feed: nova publicação de $autor" }
  return $json
}
# ---------------------------------------------------------------- escritório virtual (presença)
# Cada tela do escritório manda a própria posição a cada segundo e recebe a de todos.
# Fica só na memória do servidor: quem não manda nada há 15 s some do escritório.
$script:presenca = @{}
function Ler-Corpo($req) {
  $sr = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $t = $sr.ReadToEnd(); $sr.Close()
  return ($t | ConvertFrom-Json)
}
function Presenca($req, [switch]$Sair) {
  $c = Ler-Corpo $req
  $id = "$($c.id)"
  if ($id -notmatch '^[a-z_]{2,20}$') { throw 'Pessoa inválida.' }
  if ($Sair) { $script:presenca.Remove($id); return '[]' }
  $script:presenca[$id] = @{ dados = $c; visto = Get-Date }
  $limite = (Get-Date).AddSeconds(-15)
  foreach ($k in @($script:presenca.Keys)) { if ($script:presenca[$k].visto -lt $limite) { $script:presenca.Remove($k) } }
  $lista = @($script:presenca.Values | ForEach-Object { $_.dados })
  return (ConvertTo-Json -InputObject $lista -Depth 3 -Compress)
}

# ---------------------------------------------------------------- abrir

# Se o sistema já estiver rodando (outra janela), só abre o navegador.
try {
  $r = Invoke-WebRequest "http://localhost:$Porta/api/ping" -UseBasicParsing -TimeoutSec 2
  if ($r.Content -eq 'solida') {
    Write-Host "O sistema já está aberto em outra janela. Abrindo o navegador..." -ForegroundColor Green
    if ($AbrirNavegador) { Start-Process "http://localhost:$Porta/app/" }
    Start-Sleep 3
    exit 0
  }
} catch { }

# Porta ocupada por outro programa: tenta as próximas.
$ouvinte = $null
foreach ($p in $Porta..($Porta + 10)) {
  $tentativa = New-Object System.Net.HttpListener
  $tentativa.Prefixes.Add("http://localhost:$p/")
  try { $tentativa.Start(); $ouvinte = $tentativa; $Porta = $p; break } catch { $tentativa.Close() }
}
if (-not $ouvinte) {
  Write-Host "Não foi possível abrir o servidor: as portas $Porta a $($Porta + 10) estão ocupadas." -ForegroundColor Red
  exit 3   # o iniciar.bat não tenta de novo neste caso
}

$endereco = "http://localhost:$Porta/app/"
Write-Host "Sistema Sólida rodando em $endereco" -ForegroundColor Green
Write-Host "Deixe esta janela aberta. Para encerrar, feche a janela ou aperte Ctrl+C."
if ($AbrirNavegador) { Start-Process $endereco }

$log = Join-Path $raiz 'dados\servidor-log.txt'
function Registrar([string]$msg) {
  try { Add-Content -LiteralPath $log -Value ("{0:dd/MM/yyyy HH:mm:ss}  {1}" -f (Get-Date), $msg) -Encoding UTF8 } catch { }
}
Registrar "Servidor iniciado em $endereco"

try {
  while ($ouvinte.IsListening) {
    # um erro numa requisição (ex.: navegador fechou no meio) nunca derruba o servidor
    try { $ctx = $ouvinte.GetContext() } catch { Registrar "Erro ao receber requisição: $($_.Exception.Message)"; continue }
    $resp = $ctx.Response
    try {
      $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      # registra as páginas carregadas (ajuda a saber se o navegador pegou a versão atual)
      if ($caminho -match '(/app/|index\.html|main\.js|meudia\.js)$') { Registrar "Carregou $caminho ($($ctx.Request.UserAgent -replace '^.*(Edg|Chrome|Firefox)/([\d.]+).*$', '$1 $2'))" }
      # nunca guardar cópia: toda atualização do sistema aparece no próximo carregamento
      $resp.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
      $resp.Headers.Add('Pragma', 'no-cache')
      $resp.Headers.Add('Expires', '0')
      if ($caminho -eq '/' -or $caminho -eq '/app') {
        $resp.Redirect('/app/'); continue
      }
      if ($caminho -eq '/api/ping') {
        $bytes = $utf8.GetBytes('solida'); $resp.ContentType = 'text/plain'
      } elseif ($caminho -eq '/api/escritorio' -and $ctx.Request.HttpMethod -eq 'POST') {
        $bytes = $utf8.GetBytes((Presenca $ctx.Request)); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/escritorio/sair' -and $ctx.Request.HttpMethod -eq 'POST') {
        $bytes = $utf8.GetBytes((Presenca $ctx.Request -Sair)); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/pedidos/decidir' -and $ctx.Request.HttpMethod -eq 'POST') {
        $bytes = $utf8.GetBytes((Decidir-Pedido $ctx.Request | ConvertTo-Json -Depth 4)); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/pedidos') {
        if ($ctx.Request.HttpMethod -eq 'POST') { $saida = Gravar-Pedido $ctx.Request | ConvertTo-Json -Depth 4 }
        else { $saida = Texto-Pedidos }
        $bytes = $utf8.GetBytes($saida); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/fotos') {
        if ($ctx.Request.HttpMethod -eq 'POST') { $saida = Gravar-Foto $ctx.Request } else { $saida = Lista-Fotos }
        $bytes = $utf8.GetBytes($saida); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -match '^/api/foto/([a-z0-9_]{2,40})\.jpg$') {
        $arq = Join-Path $fotosDir "$($matches[1]).jpg"
        if (Test-Path -LiteralPath $arq) { $bytes = [IO.File]::ReadAllBytes($arq); $resp.ContentType = 'image/jpeg' } else { $resp.StatusCode = 404; $bytes = $utf8.GetBytes('Sem foto') }
      } elseif ($caminho -eq '/api/feed') {
        if ($ctx.Request.HttpMethod -eq 'POST') { $saida = Gravar-Feed $ctx.Request } else { $saida = Texto-Feed }
        $bytes = $utf8.GetBytes($saida); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/tarefas') {
        if ($ctx.Request.HttpMethod -eq 'POST') { $saida = Gravar-Tarefa $ctx.Request } else { $saida = Texto-Tarefas }
        $bytes = $utf8.GetBytes($saida); $resp.ContentType = $tipos['.json']
      } elseif ($caminho -eq '/api/painel') {
        $bytes = $utf8.GetBytes((Resposta-Painel)); $resp.ContentType = $tipos['.json']
      } else {
        if ($caminho -match '/dados/json/(orcamentos|projetos|estoque)\.json$') { Atualizar-Drive }
        if ($caminho.EndsWith('/')) { $caminho += 'index.html' }
        $arquivo = [IO.Path]::GetFullPath((Join-Path $raiz $caminho.TrimStart('/')))
        # só serve o que está dentro de app/ e dados/json/
        $permitido = $arquivo.StartsWith((Join-Path $raiz 'app\'), 'OrdinalIgnoreCase') -or
                     $arquivo.StartsWith((Join-Path $raiz 'dados\json\'), 'OrdinalIgnoreCase')
        if (-not $permitido -or -not (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
          $resp.StatusCode = 404
          $bytes = $utf8.GetBytes('Não encontrado')
        } else {
          $ext = [IO.Path]::GetExtension($arquivo).ToLower()
          $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' }
          $bytes = [IO.File]::ReadAllBytes($arquivo)
        }
      }
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      Registrar "Erro em $($ctx.Request.Url.AbsolutePath): $($_.Exception.Message)"
      try { $resp.StatusCode = 500 } catch { }
    } finally {
      try { $resp.Close() } catch { }
    }
  }
} catch {
  Registrar "Servidor parou: $($_.Exception.Message)"
  throw
} finally {
  Registrar 'Servidor encerrado'
  $ouvinte.Stop()
}
