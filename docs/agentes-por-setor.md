# Agentes por setor (rotinas agendadas do computador principal)

Desde 05/11/2026 cada rotina agendada é **um setor da empresa**: o agente do setor faz todas as conferências
do setor (WhatsApp, Mais Controle, Drive, Sólides…) e grava só o arquivo dele. O **montador** (agente da
diretoria) junta os arquivos de todos os setores no `dados.json` do painel a cada 15 minutos. O **vigia**
confere se tudo está rodando e só avisa o dono quando precisa dele (login caído, ação do dono).

Os procedimentos detalhados de cada fonte (o que ler, formato, validação) ficam em `docs/procedimentos/`.
Os agentes antigos por fonte (leitura-diaria, leitura-mais-controle-areas, leitura-drive-areas,
medicoes-mais-controle-semanal, ferramentas-whatsapp-leitura, produtividade-whatsapp-dia-anterior) estão
**desligados**; os arquivos viraram manuais em `docs/procedimentos/`.

## Quem faz o quê

| Agente (taskId) | Setor / área | Fontes | Horários (seg a sáb) | Grava |
|---|---|---|---|---|
| `agente-operacao` | operacao | WhatsApp dos grupos das obras (produtividade, metas da semana), Mais Controle (diário de obra, medições) | 07:30, 13:30, 17:30 | `leituras-operacao.json`, `produtividade.json`, `medicoes-mc.json` (segunda) |
| `agente-rh` | rh | WhatsApp (grupo ATESTADO/FALTAS/HORA EXTRA, efetivo dos grupos das obras), Sólides | 08:40, 14:40 | `leituras-rh.json`, `efetivo.json` |
| `agente-planejamento` | planejamento | Drive (cronogramas, programação semanal, pendências, PDFs de metas) | a cada 2 h, 08:20 a 16:20 | `leituras-planejamento.json` |
| `agente-comercial` | comercial | Drive (orçamentos), WhatsApp SETOR ORÇAMENTOS | 08:50, 13:50 | `leituras-comercial.json` |
| `agente-transporte` | transporte | WhatsApp (ferramentas, rotas da Strada) | 09:00, 12:00, 15:00, 17:00 | `leituras-transporte.json`, `ferramentas-checklist.json` |
| `agente-suprimentos` | suprimentos | Mais Controle (solicitações e cotações), WhatsApp COMPRAS | 09:20, 13:20, 16:20 | `leituras-suprimentos.json` |
| `agente-pos-obra` | posobra | Drive (controle operacional, cobrança, agenda), WhatsApp Pós Obra - Gestão | a cada 2 h, 07:40 a 17:40 | `leituras-posobra.json`, `obras/servicos/agenda/financeiro.json` |
| `agente-financeiro` | financeiro (restrito) | Mais Controle (painel de custos) | 09:50, 15:50 | `leituras-financeiro.json` |
| `montador-dados-json` | diretoria (geral) | os `leituras-*.json` de todos os setores | a cada 15 min, 07:00 a 18:45 | `painel-montado.json` e nuvem |
| `vigia-sistema-solida` | — | processos, rotinas, frescor dos dados, logins do Chrome | de hora em hora, 07:10 a 18:10 | só avisa |

Os horários do WhatsApp são escalonados (nunca dois agentes ao mesmo tempo). Mesmo assim vale a trava abaixo.

## Regras comuns a TODOS os agentes

1. **Somente leitura** em WhatsApp, Mais Controle, Drive, Gmail, Sólides: não enviar, reagir, responder, apagar,
   baixar, criar, editar, aprovar nem excluir nada. Tela de login ou QR code: PARE essa fonte, diga qual e siga
   com as outras; nunca digite senha nem escaneie QR code.
2. **Nunca inventar** número, obra, data, nome ou quantidade. O que não der para ler: "não foi possível ler X".
   Sem telefone, CPF nem dados pessoais. Sem valores em R$ de contratos (só em kpis/alertas com `restrito: true`).
   Sem API paga de IA. Português do Brasil.
3. **Navegador**: use SÓ o Chrome deste computador (`list_connected_browsers`, o que traz `onThisComputer: true`;
   `select_browser` com o deviceId dele antes de qualquer ação; nunca abra aba nos outros). Se não houver, escreva
   "Chrome deste computador não conectado" e encerre só a parte que dependia dele. Feche as abas que abriu.
4. **Trava do WhatsApp Web** (só um agente por vez): antes de abrir web.whatsapp.com olhe `dados\whatsapp-web.lock`.
   Se existir com menos de 10 minutos, espere (confira a cada 30 s, até 5 min); se continuar em uso, NÃO abra o
   WhatsApp e escreva "WhatsApp em uso por outra rotina". Se não existir ou tiver mais de 10 minutos, crie-o com a
   hora e o nome do agente e APAGUE-O ao terminar a parte do WhatsApp (mesmo se falhar ou aparecer QR code).
   "Aberto em outra janela": espere 60 s e clique em "Usar nesta janela" UMA vez; se não resolver, pare. Nunca em loop.
   Para ler o grupo da obra certo, confira o nome do cabeçalho do chat antes de ler (a lista de conversas muda de
   ordem). O histórico volta mais se você rolar para cima e esperar carregar; use "Ler mais" nas mensagens longas.
5. **Obras em andamento**: só elas geram meta, produtividade e alerta. Obra parada, finalizada ou sem execução
   não gera alerta. A situação de cada obra (andamento · pausada · finalizada) é o cadastro de obras do sistema, que
   sócios (Marcos, Márcio, Felipe) e a coordenação (Simone) mudam no topo da página da obra; ele chega a você em
   `dados\json\obras-situacao.json` (atualizado a cada envio à nuvem). Pausada aparece no painel só como "Pausada",
   sem metas nem pendências; finalizada some. Sem esse arquivo, valem `metasSemanais.encerradas` em
   `dados\json\produtividade.json` e as obras de `planejamento.porObra` (hoje: Mo465 pausada, Mo565D finalizada;
   Mo557, Mo415 e Mo491 não estão em execução).
   Obras sempre em ordem numérica (menor para maior; 565C antes de 581), primeiro Mo e depois Po.
6. **Alertas**: um fato por alerta, com obra, data e o responsável ESPECÍFICO daquela obra (nunca um responsável
   geral para todas). Sem alertas sobre solicitações BeeVale/Bivale do Mais Controle (são documentadas lá e
   resolvidas pelo financeiro). Não repetir o mesmo fato em outra área.
7. **Gravação**: cada agente grava SÓ o arquivo dele. Faça cópia do anterior em `dados\backup-painel\` e grave em
   arquivo temporário renomeando ao final; valide como JSON (UTF-8 sem BOM). Formato do arquivo de área:

```json
{ "atualizadoEm": "ISO UTC com Z",
  "areas": { "<id>": { "lidoEm": "ISO com -03:00",
    "fontes": [ { "nome": "Drive|Mais Controle|WhatsApp|Sólides", "via": "o que foi lido", "ultima": "dd/MM, HH:mm" } ],
    "status": "ok|atencao|critico", "resumo": "2 a 3 frases factuais",
    "kpis": [ { "label": "…", "valor": "…", "restrito": false } ],
    "alertas": [ { "nivel": "critico|atencao|info", "texto": "cód. do processo · RESPONSÁVEL — fato com obra e data", "restrito": false } ] } } }
```
   Use o `cod` e o `resp` reais dos processos da área em `dados\painel-cache.json` (só como referência; não o altere).
8. **Envio à nuvem** só dos arquivos de dados do próprio agente (`node scripts\enviar-nuvem.mjs <nomes>`), conferindo
   "N de N arquivos enviados". O `leituras-*.json` não vai à nuvem (o montador usa).
9. **Resposta final** em até 6 linhas: o que foi lido em cada fonte, o que mudou, alertas novos, o que não deu para
   ler e por quê.
