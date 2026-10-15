# Modelo de dados (proposta a partir da planilha)

Os JSON em `dados/json/` seguem estes campos (mais `_linha`, a linha de origem na planilha).

## obras
| campo | tipo | obs |
|---|---|---|
| obra | texto, único | código + nome curto. Ex.: `PO088`, `MO556 - Estúdio Pindó` |
| cliente | texto | |
| endereco | texto | |
| tipo | lista `Tipo de obra` | Pós-obra, Manutenção fixa, Chamado, Aditivo, Interno |
| situacao_calculada | derivado | ver regra em modulo-pos-obra.md §4 — no sistema, calcular, não gravar |
| responsavel | texto (→ pessoa) | |

## servicos (OS)
| campo | tipo |
|---|---|
| os | texto, único (OS-001…) |
| obra | → obras.obra |
| situacao | lista `Situação` |
| data_inicio, prazo, concluido_em | data (prazo pode ser "contínuo") |
| profissionais | texto livre |
| relato, obs | texto longo |
| dias_atraso, status_prazo | derivados |

## equipe (profissionais)
| campo | tipo | obs |
|---|---|---|
| profissional | texto, único | |
| funcao | texto | Ajudante, Pedreiro, Pintor, Eletricista… |
| vinculo | lista `Vínculo` | **Próprio** ou **PJ** (PJ = pago por diária) |
| valor_diaria | R$ | |
| apelido_1, apelido_2 | texto | outras grafias usadas na agenda (ex.: Valdir = "Barba") |

## agenda
Uma entrada por célula preenchida: `{obra, data, texto}`. No sistema, sugestão: guardar também a lista de profissionais reconhecidos em cada entrada (com marcação de falta), em vez de depender só do texto livre.

## financeiro
| campo | tipo |
|---|---|
| data | data (pode faltar — não entra em período) |
| obra | → obras.obra |
| tipo | lista `Tipo de lançamento` |
| descricao | texto |
| contraparte | fornecedor / cliente |
| valor | R$ |
| pago_recebido | Sim / Não |

## listas (valores fixos)
Situação, Tipo de obra, Vínculo, Tipo de lançamento, Sim/Não, Ver por — ver `dados/json/listas.json`.
