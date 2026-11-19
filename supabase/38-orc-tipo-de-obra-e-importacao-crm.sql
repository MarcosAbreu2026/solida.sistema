-- Tipo de obra no card do CRM de orçamentos (casa, apartamento, escritório, corporativo, demolição…) e carga da planilha
-- "Orçamentos MO594 a MO614" (posição de 19/11/2026, enviada pelo Marcos). Coluna "Valor" da planilha = obra cinza (critério do CRM).
alter table public.orc_quadro add column if not exists tipo_obra text;

create temp table _imp (obra text, cliente text, arq text, status text, valor numeric, tipo_obra text, nota text) on commit drop;
insert into _imp values
  ('Mo614','Capsugel Escritório','Mizan Arq','arquitetura',36613.38,'Escritório','Pré-dimensionamento da obra laranja (±15%). Valor = honorários da Sólida; itens orçados: R$ 207.667,37. Confirmar qual valor vale no CRM.'),
  ('Mo613','Sernambetiba','Virna Carvalho Arq','em_orcamento',null,null,'Orçamento a fazer na próxima semana. O arquivo R00 da pasta é cópia da Liessin (Mo612): sem valor.'),
  ('Mo612','Liessin Leblon','Sophia','em_orcamento',704371.31,'Corporativo',null),
  ('Mo611','Estúdio Patrícia','Sebastian Arq','arquitetura',26534.01,'Demolição',null),
  ('Mo610','Estúdio Luiz Henrique','Sebastian Arq','arquitetura',28001.74,'Demolição',null),
  ('Mo609','Vania Zaeyen','João Vitor Lemos','em_orcamento',null,null,'A pasta só tem foto e projetos: nenhum orçamento encontrado.'),
  ('Mo608','Remax SJ - Construção','Otta Albernaz','em_orcamento',1551560.75,'Corporativo','O arquivo do orçamento está com código Mo607 por dentro: confirmar e renomear.'),
  ('Mo607','Remax SJ - Projetos',null,'fechado',null,'Corporativo','Sem orçamento oficial na pasta; valor do contrato de projetos não encontrado.'),
  ('Mo606','Renata e Rogério','Hana Lerner','arquitetura',421114.03,null,null),
  ('Mo605','Ana Paula e Flávio','PKB','em_orcamento',1078233.33,null,null),
  ('Mo604','Monica Tavares','Estúdio Pindó','nao_fechou',null,null,'Construção. Orçamento não está na pasta (só a planta executiva).'),
  ('Mo603','Casa Mangaratiba','Bak Arq','cliente',4124400.12,'Casa – construção','3 opções de estrutura; lançada a Opção 01 (menor). Opção 02: obra cinza R$ 4.206.689,57. Opção 03: R$ 4.635.394,86. Confirmar qual vale.'),
  ('Mo602','Remax Casa Shopping','Otta Albernaz','fechado',1210540.27,'Corporativo','A planilha R10 é o saldo "o que falta executar", não o contrato original. Confirmar qual valor vale.'),
  ('Mo601','Luisa de Castro','Sebastian Arq.','em_orcamento',1710342.33,null,'Pendência: ajustar ao padrão novo de orçamento (o arquivo está no modelo antigo).'),
  ('Mo600','Barra Light','Felipe Portella','em_orcamento',null,null,'R00 em branco: o orçamento ainda não começou no arquivo.'),
  ('Mo599','Monica Tavares','Estúdio Pindó','nao_fechou',63664.87,'Demolição','CRM antigo tinha R$ 67.357,09 (revisão anterior).'),
  ('Mo598','Ana e Greg','Estúdio Pindó','nao_fechou',594642.90,null,null),
  ('Mo597','José Junior','Jairo de Sender','nao_fechou',null,null,'Pasta só tem o modelo genérico: sem valor.'),
  ('Mo596','Simone e Bruno','Fernanda Borschiver','cliente',411778.13,null,null),
  ('Mo595','Guilherme e Evandro','Estudio Sal','fechado',77283.25,null,null),
  ('Mo594','Saint Tropez',null,'fechado',36268.19,null,'R03 = troca de marcenaria (cinza R$ 36.268,19 + marcenaria laranja R$ 425.791,08). O CRM antigo tinha R$ 305.026,50. Confirmar o valor fechado.');

-- cadastro (fonte única das listas): o que ainda é orçamento entra/atualiza como "obra em orçamento"; o que fechou não é criado aqui (vira obra pelo Cadastros)
insert into public.obras_cadastro (codigo, nome, situacao, tipo, cliente, arquitetura)
select i.obra, i.cliente,
  case i.status when 'arquitetura' then 'com_arquitetura' when 'nao_fechou' then 'nao_fechado' else 'orcamento' end, 'orcamento', i.cliente, i.arq
from _imp i where i.status <> 'fechado' and not exists (select 1 from public.obras_cadastro c where upper(c.codigo) = upper(i.obra));
update public.obras_cadastro c set situacao = case i.status when 'arquitetura' then 'com_arquitetura' when 'nao_fechou' then 'nao_fechado' else 'orcamento' end, atualizado_em = now()
from _imp i where upper(c.codigo) = upper(i.obra) and c.tipo = 'orcamento' and i.status <> 'fechado';

-- cards: atualiza os que já existem e cria os que faltam
update public.orc_quadro q set status = i.status, tipo_obra = coalesce(i.tipo_obra, q.tipo_obra), cliente = coalesce(q.cliente, i.cliente),
  arquitetura = coalesce(i.arq, q.arquitetura), descricao = coalesce(i.nota, q.descricao)
from _imp i where upper(q.obra) = upper(i.obra);
insert into public.orc_quadro (obra, cliente, arquitetura, titulo, status, tipo_obra, descricao)
select i.obra, i.cliente, i.arq, '', i.status, i.tipo_obra, i.nota from _imp i where not exists (select 1 from public.orc_quadro q where upper(q.obra) = upper(i.obra));
insert into public.orc_quadro_valor (orc_id, valor)
select q.id, i.valor from _imp i join public.orc_quadro q on upper(q.obra) = upper(i.obra) where i.valor is not null
on conflict (orc_id) do update set valor = excluded.valor;
