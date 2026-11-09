# Análise semanal das rotas da Strada (agente de Transporte)

Pedido do Marcos (09/11/2026): toda segunda-feira, uma análise da rota da SEMANA PASSADA, com dados efetivos do que saiu da rota, do que não foi informado, do tempo ocioso do Anderson entre as obras e dos problemas de rota. Tem que ser **educativa, curta, sem muito detalhamento**.

## Como o grupo "Strada Solida" funciona (visto em 09/11/2026)
- A rota do dia é publicada pela equipe (hoje a Taísa), numa única mensagem: `ROTA SEGUNDA-FEIRA 09/11`, uma linha por parada com horário: `8h00 - Galpão`, `9h30 - Citylar - retirar material para a Mo531`, `10h00 - Mo531 - deixar material`.
- Regras que vêm na própria mensagem: segunda e quarta a Strada só roda na Zona Sul; terça e quinta só na Zona Sudoeste (Barra); sexta é de livre encaixe; a mensagem da rota tem que ser única e com as linhas bem divididas; rota que muda de zona num dia que não é o da zona precisa de aprovação prévia do Marcos/Márcio.
- O Anderson (motorista) responde com fotos e mensagens curtas em cada parada, com o horário do WhatsApp: "Chegando mo 466", "Deixando materiais mo 466", "Retirando lixos mo 466". Problemas aparecem ali também (ex.: "caçamba cheia" → a Simone orienta levar ao depósito).

## Registro diário (toda execução do agente de Transporte)
Para a semana ser analisada com dados efetivos e não depender do histórico do WhatsApp, a cada execução salve/atualize `dados\json\rotas-dia\AAAA-MM-DD.json` do dia:
```json
{ "data": "AAAA-MM-DD", "rotaPublicadaEm": "HH:MM ou null", "mensagemUnica": true,
  "previsto": [ { "hora": "HH:MM", "local": "texto", "acao": "texto" } ],
  "realizado": [ { "hora": "HH:MM", "local": "texto", "evento": "chegou|deixou|retirou|problema", "obs": "texto curto" } ],
  "problemas": [ "texto curto" ] }
```
Somente fatos lidos nas mensagens; nada inventado. Sem telefone.

## Análise de segunda-feira (só na execução das 09:00 de segunda)
Analise a semana anterior (segunda a sábado) usando `rotas-dia/` da semana (complete com o histórico do grupo se faltar algum dia: role para cima e use "carregar mais antigas"). Conte:
1. **Rotas publicadas × dias úteis**: dias sem rota publicada ou publicada tarde (depois das 08:00) ou fora do padrão (mensagem não única/linhas misturadas).
2. **Paradas previstas × confirmadas**: quantas tiveram confirmação do Anderson (mensagem/foto) e quantas **não foram informadas**.
3. **Saiu da rota**: paradas feitas que não estavam na rota, e mudança de zona sem aprovação (regra segunda/quarta Zona Sul, terça/quinta Barra).
4. **Tempo ocioso do Anderson entre as obras**: pelos horários das mensagens, intervalos longos sem registro entre uma parada e a próxima (por exemplo, mais de 1 hora a mais que o previsto). Diga que é estimativa feita pelos horários das mensagens.
5. **Problemas recorrentes**: caçamba cheia, material não retirado/não entregue, atraso, rota sem obra de destino, falta de resposta. Só o que apareceu no grupo.

## Formato do resultado (educativo, curto)
Grave `dados\analises\rotas-AAAA-MM-DD.md` (data = segunda da análise), com no máximo 1 página:
- **Resumo da semana** em 3 linhas (ex.: "5 de 6 rotas publicadas; 14 paradas, 11 confirmadas").
- **Números**: rotas publicadas, paradas previstas, confirmadas, não informadas, fora da rota, tempo ocioso estimado (total e pelo dia mais pesado).
- **O que deu certo** (1 a 2 itens).
- **O que precisa melhorar** (até 4 itens, uma frase cada, com a dica prática: "avisar a chegada com foto", "publicar a rota até 08:00", "pedir aprovação antes de mudar de zona").
- **Combinado para esta semana** (2 a 3 linhas).
Tom: simples, sem culpar pessoa; fale em "a Strada", "a equipe" e só cite o Anderson nos números de tempo.
Depois: acrescente em `leituras-transporte.json` um kpi "Análise da rota da semana passada" (resumo em 1 linha) e, se houver, um alerta por problema recorrente. Não envie à nuvem (o montador faz).
