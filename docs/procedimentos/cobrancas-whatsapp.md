# Cobranças no WhatsApp (produtividade e efetivo)

Autorizado pelo Marcos (06/11 e 09/11/2026). São as ÚNICAS mensagens que um agente envia no WhatsApp. Textos copiados das cobranças que o próprio Marcos mandou nos grupos.

## Quando cada cobrança acontece

| Rotina | Horário (seg a sáb) | O que cobra | Só se… |
|---|---|---|---|
| `cobranca-produtividade-manha` | 09:00 | produtividade do DIA ÚTIL ANTERIOR | a obra não postou o relatório daquele dia |
| `cobranca-efetivo` | 10:00 | efetivo de HOJE | a obra não postou o efetivo de hoje (ou postou o modelo em branco) |
| `cobranca-produtividade-tarde` | 16:30 | produtividade de HOJE | a obra ainda não postou o relatório de hoje |

Segunda-feira: "dia útil anterior" da cobrança das 09:00 é a sexta. Feriado e domingo: não cobra.

## Regras comuns
- Só obras em andamento (situação em `dados/json/obras-situacao.json`; Mo465 pausada e Mo565D finalizada ficam de fora).
- Encarregado de cada obra: Mo358 Carlos; Mo581 Taisa; Mo531 Wanderson; Mo533 Thaissa; Mo602 (Remax) Maurílio. Mo344 e qualquer obra sem encarregado claro: NÃO cobrar, só avisar no resumo.
- No máximo UMA cobrança de cada tipo por obra por dia. Controle em `dados/json/cobrancas.json`: `{ "dias": { "AAAA-MM-DD": { "Mo358": { "produtividade": "HH:MM", "efetivo": "HH:MM" } } } }`. Leia antes; se já tem registro daquele tipo hoje, não envie; grave o registro logo depois de enviar. A cobrança da manhã (dia anterior) grava a chave `produtividade-ontem`; a da tarde grava `produtividade`.
- Se o próprio Marcos/Felipe já cobrou a mesma coisa naquele grupo hoje, não envie; só registre.
- Antes de cobrar, CONFIRA NO GRUPO se a obra realmente não postou (leia as mensagens do dia; use "carregar mais antigas" se preciso). Postou, mesmo atrasado: não cobra.
- Trava `dados\whatsapp-web.lock` (veja `docs/agentes-por-setor.md`). Se estiver em uso, espere até 5 min; se continuar, não envie nada e diga no resumo. APAGUE a trava ao terminar.
- Confira o nome no cabeçalho do chat ANTES de digitar (a ordem da lista muda). Mande UMA mensagem por grupo; no WhatsApp Web use Shift+Enter para quebrar linha e Enter só no final. Nunca responda a ninguém nem mande outro texto.
- Chrome deste computador desconectado ou WhatsApp deslogado: não envie nada e diga no resumo.
- Resposta final (até 6 linhas): por obra, o que foi cobrado e o que NÃO foi (e por quê).

## Texto da cobrança da PRODUTIVIDADE
Troque só {Nome} e a data. (Padrão que o Marcos escreve.)

```
{Nome}, por favor não esquecer de enviar as fotos dos serviços de hoje aqui, e uma mensagem com o relatório diário das atividades no nosso padrão:

Produtividade ({dd/mm})

Etapa/Quantidade/Equipe/Nome
Demolição Contrapiso/20m2/Sólida/José e Francisco
```

Na cobrança das 09:00 (dia anterior), use a data do dia anterior em "Produtividade (dd/mm)" e acrescente no fim, depois de uma linha em branco: `Não encontrei a produtividade de ontem, poderia me enviar?`

## Texto da cobrança do EFETIVO
Troque só {Nome}. Texto lido nas cobranças que o Marcos enviou (07/10 a 04/11/2026):

```
{Nome}, por favor não esquecer de enviar o registro do efetivo de hoje aqui, no nosso padrão! Formato: Equipe Sólida: Quantidade: Nomes: Equipe(s) Terceirizada(s): Nome da terceirizada: Quantidade de pessoas: (repetir esse bloco para cada terceirizada presente na obra)
```

As quebras de linha do "Formato" não aparecem na busca do WhatsApp: antes de enviar a primeira vez, abra no grupo a última cobrança de efetivo do Marcos ("Você") e copie a mesma disposição de linhas:
Equipe Sólida / Quantidade / Nomes / (linha em branco) / Equipe(s) Terceirizada(s) / Nome da terceirizada / Quantidade de pessoas / (repetir esse bloco...).

---

## 4ª mensagem: ROTA DO DIA SEGUINTE (grupo "Strada Solida"), às 15:00
Autorizado pelo Marcos em 11/11/2026. É o texto inicial da rota que ele mandava à mão todo dia, "geralmente às 15" (visto no grupo em 27/10, 29/10, 30/10, 03/11 e 04/11, sempre às 15:08). Feita pelo **agente de Transporte**, só na execução das 15:00 (as de 09:00, 12:00 e 17:00 só leem).

Regras:
- Manda UMA mensagem, no grupo "Strada Solida" (confira o nome no cabeçalho antes de digitar), para o PRÓXIMO DIA DE SEMANA: de segunda a quinta, o dia seguinte; na sexta, a segunda. Sábado e domingo: não manda.
- Se já existe no grupo, hoje, uma mensagem "ROTA {DIA-DA-SEMANA} {dd/mm}" para esse dia (de qualquer pessoa, inclusive o Marcos/Felipe), NÃO manda; só registra.
- Controle em `dados/json/cobrancas.json`: `{ "dias": { "AAAA-MM-DD": { "Strada": { "rota-amanha": "HH:MM" } } } }` (data = hoje). Leia antes, grave depois de enviar. Uma vez por dia.
- O cabeçalho vem do dia da semana da data-alvo, nunca copie o cabeçalho de outra mensagem (em 03/11 saiu "SEGUNDA-FEIRA 02/11 - (ZONA SUDOESTE)" para uma quarta, e a rota de quarta ficou com a zona errada):
  - segunda e quarta: `(ZONA SUL)`
  - terça e quinta: `(ZONA SUDOESTE)`
  - sexta: `(LIVRE ENCAIXE)`
- No WhatsApp Web: texto entre asteriscos fica em negrito (a primeira e a última linha); use Shift+Enter para quebrar linha e Enter só no final. Mesmo sistema de trava e conferência do nome do grupo das outras cobranças.

Texto exato (troque só {DIA-DA-SEMANA}, {dd/mm} e {ZONA}); entre `---` está a mensagem, linha a linha, com as linhas em branco:

```
*ROTA {DIA-DA-SEMANA} {dd/mm} - ({ZONA})*

8h00 - Galpão
.
.
.
.
.
.
.
OBS: As rotas serão setadas em dias específicos para zonas específicas do Rio.
Segunda e Quarta-feira a Strada só irá rodar na Zona Sul,
Terça e Quinta-feira a Strada só irá rodar na Zona Sudoeste (Barra)
A sexta-feira será de livre encaixe
A mensagem deve ser única, garanta que as linhas estão divididas corretamente antes de enviar a mensagem

*Uma rota que terá de mudar de zona em dias que a zona for outra deverá ser previamente aprovada com o Marcos/Marcio*
```

Exemplo: enviada na quarta 04/11 para a quinta: `*ROTA QUINTA-FEIRA 05/11 - (ZONA SUDOESTE)*`.
Nomes de dia: SEGUNDA-FEIRA, TERÇA-FEIRA, QUARTA-FEIRA, QUINTA-FEIRA, SEXTA-FEIRA.
