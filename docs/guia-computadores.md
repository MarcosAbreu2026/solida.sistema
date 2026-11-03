# Guia dos computadores da Sólida

Decisão do Felipe (03/11/2026): o **computador do escritório** (ligado 24 h) é o principal.

## Computador do escritório (principal)
- Pasta do sistema: `C:\sistema-solida`, sempre atualizada com `git pull`.
- `iniciar.bat` aberto: servidor, coletor do Drive (a cada 10 min, manda para a nuvem) e leitor de WhatsApp.
  Reiniciar o `iniciar.bat` depois de cada `git pull`. Conferir em `dados\coletor-log.txt` a linha "Nuvem: N de N arquivos enviados".
- Chrome logado em WhatsApp Web, Mais Controle, Google Drive e Gmail (as rotinas nunca digitam senha: se cair o login, param e avisam).
- Claude (aplicativo desktop ou Claude Code) aberto com a pasta do sistema e a extensão Claude in Chrome ligada.
- As rotinas agendadas dos agentes rodam aqui (ver `docs/rotinas-agendadas.md`). O computador precisa estar ligado e o Claude aberto nos horários.

## Notebooks
- Só pedem mudanças no código (ficam em dia com `git pull` antes de mexer e enviam com commit + push; o Vercel publica sozinho).
- Não rodam rotinas de agentes nem o coletor.
- `dados/`, `config.json` e `config.local.json` ficam fora do Git: cada computador tem os seus.

## Atualizar uma pasta com o GitHub
1. `git pull`. Se reclamar de "local changes would be overwritten" por causa de fim de linha: `git config core.autocrlf true`, `git stash`, `git pull`.
2. Conferir `git log --oneline -1` e `git status`.
3. Reiniciar o `iniciar.bat`.
