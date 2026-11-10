// Funções (perfis de acesso) e o quadro de tarefas de cada função.
// Tarefas: Quadro de Tarefas Semanal (Quadro_Tarefas_Semanal_Solida.pdf, base SL_TAREFAS_FUNC_R37 + POP R14),
// recebido do Felipe em 15/10/2026. Quando o sistema tiver banco de dados, isto vira cadastro.
//
// dias: 'uteis' (seg a sex) · 'todos' (seg a sáb) · [1..6] dias da semana (1 = segunda) · { mes: 20 } dia do mês
//       { primeira: 2 } 1ª terça do mês · 'semanal' (uma vez na semana, sem dia certo: vale até sexta)
//       'mensal' · 'quinzenal' · 'ocasional' → ficam fora da grade, na lista "Fora do quadro"
// pop: true = em vermelho no quadro (acrescentada a partir do POP R14, aguardando confirmação)
// fixo: true = em negrito no quadro (compromisso fixo: reunião / visita / prazo)

// geral: blocos da Visão geral que a função vê (pelo título do bloco no dados.json). Ausente = todos.
// Critério: cada um vê o que ajuda no seu trabalho. Comercial (conversão, orçamentos) e o comparativo
// com 2025 são de gestão; quem é de obra vê só as obras em curso e os indicadores de obra.
const OBRA = ['Obras', 'Indicadores'];
const GESTAO = ['Comercial', 'Obras', 'Indicadores'];

// areas: setores que aparecem no menu para a função (pedido do Felipe, 15/10: cada um vê só o que usa no
// trabalho — ex.: o financeiro não vê Projetos nem Transporte). Ausente = todos (diretoria).
// Todo mundo vê: Visão geral, Minha semana, Estoque, Escritório virtual e o Perfil. Financeiro continua só
// para quem vê valores (sócio e financeiro). Agentes: só a diretoria.
// Setores: operacao · posobra · transporte · suprimentos · planejamento · projetos · comercial · financeiro · rh
const DE_OBRA = ['operacao', 'rh'];   // quem é de obra: Operação (só as suas obras) e RH (funcionários por obra)

export const FUNCOES = [
  // diretoria: sem "Minha semana" e sem "Quadro de funções" por enquanto (pedido do Felipe, 15/10)
  { id: 'socio', nome: 'Sócio / Diretoria', veValores: true, porObra: false, veAgentes: true, veQuadro: false, semMinhaSemana: true },
  { id: 'coord_operacoes', nome: 'Coordenação de operações', pop: 'SIMONE', veValores: false, porObra: false, veQuadro: true, geral: GESTAO,
    areas: ['operacao', 'posobra', 'transporte', 'suprimentos', 'planejamento', 'projetos', 'rh'] },
  { id: 'tecnico', nome: 'Técnico / qualidade', pop: 'MÁRCIO', veValores: false, porObra: false, geral: GESTAO,
    areas: ['operacao', 'posobra', 'planejamento', 'projetos'] },
  { id: 'planejamento', nome: 'Planejamento + orçamento terceirizado', pop: 'MARIANA', veValores: false, porObra: false, geral: GESTAO,
    areas: ['operacao', 'planejamento', 'projetos', 'suprimentos', 'comercial'] },
  { id: 'orc_terceirizado', nome: 'Orçamento terceirizado (estagiária)', pop: 'JULIA', veValores: false, porObra: false, geral: OBRA,
    areas: ['planejamento', 'projetos', 'suprimentos', 'comercial'] },
  { id: 'projetos', nome: 'Projeto + orçamento', pop: 'ISABEL', veValores: false, porObra: false, geral: [...GESTAO, 'Comparativo'],
    areas: ['operacao', 'planejamento', 'projetos', 'comercial'] },
  { id: 'compras', nome: 'Compras + materiais', pop: 'MARCOS H.', veValores: false, porObra: false, geral: OBRA,
    areas: ['operacao', 'suprimentos', 'transporte', 'planejamento'] },
  { id: 'ferramentas', nome: 'Ferramentas / EPI + transporte', pop: 'PAIVA', veValores: false, porObra: false, geral: OBRA,
    areas: ['operacao', 'transporte', 'suprimentos', 'posobra'] },
  // Pedro (galpão): estagiário de compras e ferramentas, ajudando também nas obras (pedido do Felipe, 15/10)
  { id: 'estagiario_compras', nome: 'Estagiário de compras e ferramentas', pop: 'PEDRO', veValores: false, porObra: false, geral: OBRA,
    areas: ['suprimentos', 'transporte', 'operacao'] },
  { id: 'executor_ferramentas', nome: 'Executor de ferramentas / EPI + transporte', pop: 'ANDERSON', veValores: false, porObra: false, geral: OBRA,
    areas: ['transporte', 'suprimentos'] },
  { id: 'posobra', nome: 'Gestor do pós-obra', pop: 'ENIO', veValores: false, porObra: false, geral: GESTAO,
    areas: ['posobra', 'transporte', 'suprimentos'] },
  { id: 'financeiro', nome: 'Gestor do financeiro', pop: 'LETICIA', veValores: true, porObra: false,
    areas: ['financeiro', 'comercial', 'suprimentos', 'rh'] },
  { id: 'administrativo', nome: 'Administrativo', pop: 'ISABELLE', veValores: false, porObra: false, geral: OBRA,
    areas: ['rh', 'suprimentos', 'transporte'] },
  { id: 'rh', nome: 'Gestor do RH', pop: 'LEANDRO', veValores: false, porObra: false, geral: OBRA,
    areas: ['rh', 'operacao'] },
  { id: 'marketing', nome: 'Marketing', pop: 'MARCOS', veValores: false, porObra: false, geral: GESTAO,
    areas: ['comercial', 'projetos'] },
  // a documentação e medição de obra (POP 1.3 e 1.8) faz parte do gestor de obra
  { id: 'gestor_obra', nome: 'Gestor de obra', pop: 'LARISSA · ROSE', veValores: false, porObra: true, editaProdutividade: true, geral: OBRA, areas: DE_OBRA },
  { id: 'estagiario', nome: 'Estagiário de obra', pop: 'AUGUSTO · TAISA · THAISSA', veValores: false, porObra: true, editaProdutividade: true, geral: OBRA, areas: DE_OBRA },
  { id: 'encarregado', nome: 'Encarregado', pop: 'CARLOS · WANDERSON · MAURÍLIO', veValores: false, porObra: true, editaProdutividade: true, geral: OBRA, areas: DE_OBRA },
  { id: 'ajudante', nome: 'Ajudante de obra', veValores: false, porObra: true, geral: OBRA, areas: DE_OBRA },
];
// Por enquanto (pedido do Felipe, 21/10): todo mundo entra no sistema só para preencher "Minhas funções" e ver os Treinamentos.
// As demais abas são só da diretoria (sócio) e do perfil Administrativo.
export const ACESSO_COMPLETO = ['socio', 'administrativo'];
export const soMinhasFuncoes = (f) => !ACESSO_COMPLETO.includes(f.id);
// ...e quem cuida das ferramentas e do galpão também entra no Estoque (guia de movimentação do galpão)
export const ACESSO_ESTOQUE = ['ferramentas', 'executor_ferramentas', 'estagiario_compras'];
export const temEstoqueRestrito = (f) => ACESSO_ESTOQUE.includes(f.id);
// Indicadores da Visão geral que quem é de obra não precisa ver (são de gestão da empresa)
export const INDICADORES_SO_GESTAO = [/setores em dia/i, /convers/i, /fechad/i, /or[çc]ament/i];

// A função vê este bloco da Visão geral?
export function veBlocoGeral(funcao, titulo) {
  if (!funcao.geral) return true;
  const t = String(titulo || '').toLocaleLowerCase('pt-BR');
  return funcao.geral.some((g) => t.startsWith(g.toLocaleLowerCase('pt-BR')));
}
// funções que deixaram de existir → para onde foram (sessões antigas guardadas no navegador)
const ANTIGAS = { documentacao: 'gestor_obra' };
export const funcaoPorId = (id) => FUNCOES.find((f) => f.id === (ANTIGAS[id] || id)) || FUNCOES[0];

// Abas que cada função vê: setores + páginas gerais. O padrão está nas listas acima (areas); a diretoria pode
// escolher outras na tela Acessos (guardado no banco, tabela funcao_abas) e isso passa a valer no lugar do padrão.
export const SETORES = [['operacao', 'Operação'], ['posobra', 'Pós-obra'], ['transporte', 'Transporte e logística'], ['suprimentos', 'Suprimentos e compras'],
  ['planejamento', 'Planejamento'], ['projetos', 'Projetos'], ['comercial', 'Comercial'], ['orcamentos', 'Orçamentos'], ['financeiro', 'Financeiro'], ['rh', 'RH']];
// Setores como no organograma (R07, 09/2026): as pessoas (Acessos) e as atas/pendências usam esta lista. Os que não têm aba própria no menu (Técnico, Ferramentas, Marketing, Novos negócios, Administrativo) existem só para ligar pessoas e pendências ao setor.
export const SETORES_ORGANOGRAMA = ['Operação', 'Pós-obra', 'Técnico / qualidade', 'Suprimentos e compras', 'Transporte e logística', 'Ferramentas / EPI', 'Projetos', 'Planejamento', 'Comercial', 'Orçamentos', 'Marketing', 'Novos negócios', 'Financeiro', 'RH', 'Administrativo'];

// Peso de cada tarefa na pontuação (21/10): o TEMPO PADRÃO previsto no quadro (faixa de horário da tarefa; sem faixa = 1 hora).
// É o mesmo para todas as pessoas que têm a tarefa, e NÃO muda quando a pessoa ajusta a duração do cartão (senão daria para "inflar" o peso).
export function tempoPadrao(t) {
  const f = String((t && t.hora) || '').match(/(\d{1,2})h(\d{2})?\s*[–-]\s*(\d{1,2})h(\d{2})?/);
  if (!f) return 60;
  return Math.max(30, (Number(f[3]) * 60 + Number(f[4] || 0)) - (Number(f[1]) * 60 + Number(f[2] || 0)));
}
// Recompensas por desempenho no mês (padrão provisório; valores e prêmios a definir com o Marcos)
export const RECOMPENSAS = [
  { id: 'meta', nome: 'Meta do mês', min: 0.90, premio: 'A definir com o Marcos' },
  { id: 'excelencia', nome: 'Excelência', min: 0.95, premio: 'A definir com o Marcos' },
];
export const MIN_TAREFAS_FUNCIONARIO_DO_MES = 10;   // para concorrer, a pessoa precisa ter pelo menos isto de tarefas previstas no mês
export const PAGINAS = [['meudia', 'Minha semana e funções'], ['feed', 'Feed'], ['estoque', 'Estoque'], ['escritorio', 'Escritório virtual'], ['treinamentos', 'Treinamentos'], ['atas', 'Atas e pendências'], ['marketing', 'Marketing']];
// páginas que, por padrão, só algumas funções veem (a diretoria pode mudar em Acessos): Marketing é de quem cuida da marca e da verba
const PAGINAS_RESTRITAS = { marketing: ['socio', 'administrativo', 'financeiro'] };
const IDS_SETORES = SETORES.map((s) => s[0]);
for (const f of FUNCOES) f.areasPadrao = f.areas;   // para poder voltar ao padrão
export function abasPadrao(f) {
  return [...(f.areasPadrao || IDS_SETORES), ...PAGINAS.map((p) => p[0]).filter((id) => !(id === 'meudia' && f.semMinhaSemana) && (!PAGINAS_RESTRITAS[id] || PAGINAS_RESTRITAS[id].includes(f.id)))];
}
export const abasDa = (f) => f.abas || abasPadrao(f);
export const paginaVisivel = (f, id) => abasDa(f).includes(id);
// mapa = { funcaoId: [ids de abas] } vindo do banco; função sem linha no mapa fica no padrão. Diretoria vê tudo sempre.
export function aplicarAbas(mapa) {
  for (const f of FUNCOES) {
    if (f.id === 'socio') continue;
    const l = mapa && mapa[f.id];
    if (Array.isArray(l)) { f.abas = l; f.areas = l.filter((id) => IDS_SETORES.includes(id)); f.personalizada = true; }
    else { delete f.abas; delete f.personalizada; f.areas = f.areasPadrao; }
  }
}

// Quem é de obra só vê estes setores (e neles, só as suas obras; no RH, todos os funcionários).
// Na Visão geral vê só os números, sem o detalhe de cada obra.
export const AREAS_DE_OBRA = ['operacao', 'rh'];   // cronograma/programação das obras agora ficam na Operação

// Observações do quadro de cada função (rodapé "Fora do quadro" que não é tarefa)
export const OBSERVACOES = {
  projetos: ['Manhãs: projeto · tardes: orçamento de obra nova.'],
  planejamento: ['Manhãs: planejamento · tardes: orçamento terceirizado (supervisão da Julia).'],
  orc_terceirizado: ['Nesta aba também: o gestor de obra faz QCC, planilha terc. cinza e contrato cinza (quadro do Gestor de Obra); Simone aprova o QCC (quadro da Simone).'],
  tecnico: ['Nas reuniões em obra: verificar qualidade e problemas de execução e dar o ok nos serviços dos terceirizados.'],
  coord_operacoes: ['Representação da obra: reuniões com cliente e arquiteta conforme marcadas.'],
  gestor_obra: ['Todo dia: equipe no plano, segurança garantida, manual de boas práticas seguido, problemas de equipe resolvidos.'],
  ajudante: ['Checklist de ferramentas: entregar até quarta 18h.'],
  ferramentas: ['No Excel o almoço desta função estava às 10h; no quadro foi posto às 12h, como nas outras funções.'],
  posobra: ['Atenção: a reunião de planejamento está na quinta e o POP pede reunião de pós-obra na sexta às 11h. Confirmar qual vale.'],
  marketing: ['Processo de marketing ainda não mapeado no POP (7.1 pendente); demais horários em aberto.'],
  compras: ['Tarefas de menos de 5 min: dispara na hora; as demais registra no Bitrix.'],
};

const t = (funcao, area, texto, dias, hora = '', o = {}) => ({ funcao, area, processo: o.processo || '', texto, dias, hora, pop: !!o.pop, fixo: !!o.fixo });
const POP = { pop: true };
const FIXO = { fixo: true };

export const TAREFAS = [
  // ---------------------------------------------------------------- Sócio / Diretoria (sem quadro no PDF)
  t('socio', 'geral', 'Ler a Visão geral e os alertas críticos de cada setor', 'uteis', '9h'),
  t('socio', 'comercial', 'Aprovar as contratações cinza pendentes no Bitrix', 'uteis', '', { processo: '5.1' }),
  t('socio', 'financeiro', 'Reunião de resultado financeiro (obras, pós-obra e empresa)', { mes: 5 }, '', { processo: '9.5–9.7' }),

  // ---------------------------------------------------------------- Projeto + orçamento (ISABEL)
  t('projetos', 'planejamento', 'Recebimento de projetos: conferir nomenclatura, revisão, se chegaram todos e cadastrar na listagem', [1], '8h', POP),
  t('projetos', 'planejamento', 'Compatibilizações: sobrepor projetos e verificar interferências', [1, 4], 'seg 9h–11h · qui 8h–10h'),
  t('projetos', 'planejamento', 'Compatibilizações: cobrar revisões e passar status ao gestor de obra', [1, 5], '11h'),
  t('projetos', 'planejamento', 'Revisão de projeto: analisar impacto (custo, prazo, acabamento) e abrir aditivo 6.2 se houver', [2], '8h', { pop: true, processo: '6.2' }),
  t('projetos', 'planejamento', 'Revisão de projeto: atualizar planilha das revisões e arquivar no Drive', [2, 5], '9h'),
  t('projetos', 'planejamento', 'Compatibilizações: reunião com projetistas para explicar as alterações', [2], '10h'),
  t('projetos', 'planejamento', 'Revisão de projeto: documento do que mudou', [2], '11h'),
  t('projetos', 'planejamento', 'Distribuir revisão + parecer de impacto para a obra', [2], '11h', POP),
  t('projetos', 'planejamento', 'As-built: planilha de controle semanal do andamento', [3], '8h'),
  t('projetos', 'planejamento', 'Detalhes para destravar a obra', [3, 4], 'qua 9h · qui 10h'),
  t('projetos', 'planejamento', 'Detalhes: aprovar com a arquiteta', [3], '10h'),
  t('projetos', 'planejamento', 'Desenhos: croquis quando não há no projeto de arquitetura', [3], '11h'),
  t('projetos', 'comercial', 'Aditivos detectados: passar para o setor de orçamentos', [4], '11h'),
  t('projetos', 'planejamento', 'Desenhos: croquis de esquadrias, paginação, mármores', [5], '8h'),
  t('projetos', 'planejamento', 'Listagem de projetos: atualizar e publicar para as obras (mensal)', [5], '10h', POP),
  t('projetos', 'comercial', 'Orçamento obra nova: ícones, proposta e orçamento', 'uteis', '13h–15h · seg a qua até 16h'),
  t('projetos', 'comercial', 'Atualizar status no CRM (Bitrix)', 'uteis', '13h', POP),
  t('projetos', 'comercial', 'Orçamento obra nova: solicitar cotações de terceirizados laranja', [1], '16h', POP),
  t('projetos', 'comercial', 'Reunião de estratégia e aprovação (orçamentos novos)', [2], '16h', FIXO),
  t('projetos', 'comercial', 'Orçamento obra nova: cobrar resposta do cliente / arquiteta', [3, 5], '16h'),
  t('projetos', 'comercial', 'Orçamento obra nova: visitas aos locais / apresentar ao cliente e arquiteta (quando houver)', [4], '15h–17h'),
  t('projetos', 'comercial', 'Aditivos de obra: fazer e enviar', [5], '15h'),
  t('projetos', 'comercial', 'Formalizar aprovados no Mais Controle', [5], '15h', POP),
  t('projetos', 'planejamento', 'Revisão de projeto (planilha, arquivo e documento): sempre que chegar revisão nova, no primeiro horário livre da manhã', 'ocasional'),
  t('projetos', 'planejamento', 'Recebimento de projeto e análise de impacto da revisão: no dia em que o projeto/revisão chegar', 'ocasional', '', POP),

  // ---------------------------------------------------------------- Planejamento + orçamento terceirizado (MARIANA)
  // Ajustes da Mariana (papéis de 16/10): metas movidas para quarta/quinta, conferir orçamentos só seg e qua, etc.
  // (as tarefas novas dessa revisão ficam no fim da lista: o id de cada tarefa é a posição e as marcações já feitas dependem dele)
  t('planejamento', 'planejamento', 'Metas semanais: disparar para cada obra com métricas', [4], '8h'),
  t('planejamento', 'planejamento', 'Metas semanais: verificar o que foi feito e plano de ação corretivo', [3], '9h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: conferir orçamentos recebidos', [1], '8h'),
  t('planejamento', 'planejamento', 'Cronograma: lançar real executado (produtividade) na revisão', [2], '9h–11h'),
  t('planejamento', 'operacao', 'Terceirizados laranja e cinza: prazos de contratação dominados, passar para orçamento', [2], '8h'),
  t('planejamento', 'planejamento', 'Reunião com gestores (metas semanais)', [3], '9h–11h', FIXO),
  t('planejamento', 'planejamento', 'Cronograma de obra: analisar e revisar', [4], '9h–11h'),
  t('planejamento', 'planejamento', 'Metas semanais: check das métricas × planejado', [4], '9h'),
  t('planejamento', 'planejamento', 'Cronograma inicial de obra nova (quando houver)', [5], '9h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: cobrar definição de arquiteta e cliente', 'uteis', '11h'),
  t('planejamento', 'comercial', 'Reunião de alinhamento: orçamentos novos × obras em andamento (quando houver)', [1], '13h', POP),
  t('planejamento', 'operacao', 'Orç. terceirizado: apresentar orçamentos para cliente e arquiteta', [1, 3, 4], '14h'),
  t('planejamento', 'operacao', 'QCL: aprovar', [3], '13h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: encaminhar para pagamento e financeiro', [4], '13h'),
  t('planejamento', 'operacao', 'Reunião fornecedor / cliente / arquiteta', [2], '14h', FIXO),
  t('planejamento', 'operacao', 'Orç. terceirizado: negociar desconto (com Julia)', [1, 2, 3, 4], '15h'),
  t('planejamento', 'planejamento', 'Reunião planejamento / coordenação / técnico', [5], '11h', FIXO),

  // ---------------------------------------------------------------- Orçamento terceirizado (JULIA, estagiária)
  t('orc_terceirizado', 'operacao', 'Terc. laranja: atualizar planilha', 'uteis', '8h'),
  t('orc_terceirizado', 'operacao', 'Terceirizados: solicitar orçamentos', 'uteis', '9h–11h e 15h · ter a qui também 14h'),
  t('orc_terceirizado', 'operacao', 'Terceirizados: negociar desconto (com Mariana)', 'uteis', '11h'),
  t('orc_terceirizado', 'operacao', 'QCL: fazer', [1, 5], 'seg 13h–15h · sex 14h'),
  t('orc_terceirizado', 'operacao', 'Terc. laranja: medição de sinal no Mais Controle', [2], '13h'),
  t('orc_terceirizado', 'operacao', 'Terc. laranja: contratos (gerar e lançar)', [3], '13h'),
  t('orc_terceirizado', 'operacao', 'Terc. laranja: solicitar NF-e dos fornecedores e arquivar', [4], '13h', POP),
  t('orc_terceirizado', 'operacao', 'Terceirizados: formalizar fornecedor escolhido e encaminhar para a obra', [5], '13h', POP),
  t('orc_terceirizado', 'operacao', 'Terc. laranja: extrair especificações do projeto executivo × orçamento base (quando houver)', [2, 4], '16h', POP),

  // ---------------------------------------------------------------- Técnico / qualidade (MÁRCIO)
  t('tecnico', 'posobra', 'Pós-obra', [1, 3, 5], '8h–11h · seg até 12h'),
  t('tecnico', 'posobra', 'Aprovar orçamentos de pós-obra (margem 40% + BDI 38%)', [1], '8h', POP),
  t('tecnico', 'suprimentos', 'Materiais', [2, 4], 'ter 8h–11h · qui 8h–12h'),
  t('tecnico', 'operacao', 'Reunião em obra', 'uteis', 'tardes · ter também 11h', FIXO),
  t('tecnico', 'posobra', 'Reunião semanal pós-obra (com gestor PO)', [5], '11h', { pop: true, fixo: true }),
  t('tecnico', 'planejamento', 'Cronograma: validar se os tempos das etapas do planejamento são possíveis', [1], '13h'),
  t('tecnico', 'operacao', 'Fases de obra: resolver problemas e tempos médios das fases', [1], '14h'),
  t('tecnico', 'operacao', 'Terceirizados: reuniões obrigatórias nas medições (mármores, esquadrias, calculista, ar-condicionado)', [2], '14h'),
  t('tecnico', 'planejamento', 'Reunião planejamento / coordenação / técnico', [5], '15h', FIXO),
  t('tecnico', 'posobra', 'Emergências de pós-obra e conflitos de agenda PO × Operações: atender quando escalonado', 'ocasional', '', POP),

  // ---------------------------------------------------------------- Operação (SIMONE, coordenadora)
  t('coord_operacoes', 'operacao', 'Físico-financeiro: acompanhar e verificar', [1], '8h–10h'),
  t('coord_operacoes', 'suprimentos', 'Compras da semana: verificar preço e coerência na reunião', [1], '10h', POP),
  t('coord_operacoes', 'operacao', 'Relatório gerencial de obra: validar medição e aprovar', [1], '11h'),
  t('coord_operacoes', 'operacao', 'Relatório gerencial de obra: aprovar', [1], '13h'),
  t('coord_operacoes', 'operacao', 'Checklist verificação de serviço: supervisão nas obras', [1, 2, 4], 'seg e ter 14h · qui 8h–11h e 13h'),
  t('coord_operacoes', 'operacao', 'Reunião em obra com cliente e arquiteta', [1], '15h', FIXO),
  t('coord_operacoes', 'operacao', 'Reunião em obra', [2, 3, 4], 'ter 8h e 10h · qua 9h · qui 11h', FIXO),
  t('coord_operacoes', 'operacao', 'Terc. cinza medições: verificar e aprovar', [2], '9h'),
  t('coord_operacoes', 'operacao', 'Terc. laranja medições: verificar e aprovar', [2], '11h'),
  t('coord_operacoes', 'operacao', 'Terceirizados: resolver problemas maiores', [2, 5], 'ter 13h · sex 11h'),
  t('coord_operacoes', 'operacao', 'Terceirizados (cinza e laranja): supervisionar e resolver problemas maiores', [3], '8h e 14h'),
  t('coord_operacoes', 'planejamento', 'Cronograma geral de obras: revisar e ajustar', [3], '10h'),
  t('coord_operacoes', 'planejamento', 'Planejamento mensal: avisar material e mão de obra das próximas 4 semanas', [3], '11h'),
  t('coord_operacoes', 'operacao', 'Pendências de obra: verificar se está dominado', [3], '13h'),
  t('coord_operacoes', 'operacao', 'Reunião em obra com arquiteta', [4], '14h', FIXO),
  t('coord_operacoes', 'operacao', 'Reunião em obra com cliente', [4], '15h', FIXO),
  t('coord_operacoes', 'operacao', 'QCC: aprovar', [4], '16h'),
  t('coord_operacoes', 'planejamento', 'Programação semanal: aprovar', [5], '8h'),
  t('coord_operacoes', 'rh', 'Funcionários / obra: fazer e comunicar', [5], '9h–11h'),
  t('coord_operacoes', 'planejamento', 'Reunião planejamento / coordenação / técnico', [5], '15h', FIXO),
  t('coord_operacoes', 'financeiro', 'Resultado financeiro da obra: analisar desvios orçado × realizado e apresentar na reunião mensal', 'mensal', '', POP),
  t('coord_operacoes', 'rh', 'Férias: validar operacionalmente (sobreposição e substituição), junto ao RH', 'mensal', '', POP),

  // ---------------------------------------------------------------- Gestor de obra (LARISSA · ROSE)
  t('gestor_obra', 'operacao', 'ZAP e e-mails da obra', 'uteis', '8h'),
  t('gestor_obra', 'suprimentos', 'Material: aprovar compras', 'uteis', '8h'),
  t('gestor_obra', 'suprimentos', 'Material: confirmar recebimento e dar baixa no Mais Controle', 'uteis', '8h', POP),
  t('gestor_obra', 'operacao', 'Medição cinza – material: verificar o que foi comprado', [1], '9h'),
  t('gestor_obra', 'suprimentos', 'Reunião de compras (validar material)', [1], '10h', FIXO),
  t('gestor_obra', 'operacao', 'Medição cinza – obra (MO e material)', [1], '11h', FIXO),
  t('gestor_obra', 'operacao', 'Medições com relatório fotográfico: fazer e enviar ao financeiro', [1], '13h–15h'),
  t('gestor_obra', 'operacao', 'Diário de obra: aprovar', [1], '15h'),
  t('gestor_obra', 'operacao', 'Obras: supervisionar equipe, terceirizados e segurança (no plano)', [2, 3, 4, 5], 'ter 9h–12h · qua a sex 13h–15h'),
  t('gestor_obra', 'operacao', 'Reunião de obra: alinhamento com a equipe', [2], '13h', FIXO),
  t('gestor_obra', 'operacao', 'Atas de reunião: fazer e enviar', [2], '14h'),
  t('gestor_obra', 'operacao', 'Ícones: ajustar alterações e programações', [2], '15h'),
  t('gestor_obra', 'operacao', 'Escopo: atualizar no Drive', [2], '15h', POP),
  t('gestor_obra', 'operacao', 'Pendências de obra: monitorar e resolver', [1, 2, 3, 5], '16h'),
  t('gestor_obra', 'operacao', 'Terc. cinza: atualizar planilha', 'uteis', '16h'),
  t('gestor_obra', 'operacao', 'Medição cinza – contratos MO: fazer', [3], '9h–11h'),
  t('gestor_obra', 'operacao', 'QCC: fazer', [3], '11h'),
  t('gestor_obra', 'operacao', 'Terc. cinza: mapear etapas e enviar demanda de contratação', [3], '11h', POP),
  t('gestor_obra', 'operacao', 'Checklist verificação de serviço: execução', [3], '15h'),
  t('gestor_obra', 'operacao', 'Medição laranja: medir contratos', [4], '9h–11h'),
  t('gestor_obra', 'operacao', 'Terc. laranja: cobrar NF e arquivar NF/orçamento/boleto', [4], '11h', POP),
  t('gestor_obra', 'operacao', 'Databook: verificar, finalizar e aprovar', [4], '15h'),
  t('gestor_obra', 'comercial', 'Aditivos: solicitar se houver desvio de escopo', [4], '16h'),
  t('gestor_obra', 'planejamento', 'Programação semanal: meta diária e passar para a obra', [5], '9h–11h'),
  t('gestor_obra', 'operacao', 'Terc. cinza: contratos', [5], '11h'),
  t('gestor_obra', 'operacao', 'Estagiário e encarregado: conferir se executaram as tarefas', [5], '15h'),
  t('gestor_obra', 'financeiro', 'Taxa adm laranja: apurar taxa de gerenciamento e enviar ao financeiro', { mes: 20 }, '', POP),
  t('gestor_obra', 'suprimentos', 'Locação de equipamentos: solicitar no Mais Controle e avisar quando puder devolver', 'ocasional', '', POP),
  t('gestor_obra', 'operacao', 'Checklist final de obra: na entrega da obra', 'ocasional', '', POP),

  // ---------------------------------------------------------------- Estagiário de obra (AUGUSTO · TAISA · THAISSA)
  t('estagiario', 'rh', 'Equipe: conferir presença e atualizar planilha da equipe', 'uteis', '8h', POP),
  t('estagiario', 'operacao', 'Segurança: cobrar uso de EPI', 'uteis', '9h'),
  t('estagiario', 'operacao', 'Funções do encarregado: cobrar', 'uteis', '9h'),
  t('estagiario', 'suprimentos', 'Materiais e EPIs: solicitar e acompanhar até a entrega', 'uteis', '10h'),
  t('estagiario', 'transporte', 'Ferramentas: solicitar e acompanhar até a entrega', 'uteis', '11h'),
  t('estagiario', 'operacao', 'Projetos atualizados: afixar em madeirite + RRT na porta (pasta plastificada)', [1], '13h'),
  t('estagiario', 'operacao', 'Arquivos e pastas: organizar no Drive', [1], '14h'),
  t('estagiario', 'operacao', 'Ícones, escopo sem valores, cronograma, programação e complementares: afixar', [2], '13h'),
  t('estagiario', 'planejamento', 'As-built: fazer', [2, 3], 'ter 14h · qua 13h–15h'),
  t('estagiario', 'operacao', 'Databook: cinza e laranja', [4], '13h–15h'),
  t('estagiario', 'operacao', 'Medição: quantidades da semana, passar para o gestor', [5], '13h'),
  t('estagiario', 'operacao', 'Fotos de obra: salvar no Drive', [5], '14h'),
  t('estagiario', 'operacao', 'Segurança: cobrar uso de EPI na obra toda', 'uteis', '15h'),
  t('estagiario', 'operacao', 'Diário de obra: fazer', 'uteis', '16h'),

  // ---------------------------------------------------------------- Encarregado (CARLOS · WANDERSON · MAURÍLIO)
  t('encarregado', 'operacao', 'DDS com a equipe + foto no grupo', 'uteis', '8h', FIXO),
  t('encarregado', 'rh', 'Faltas, atrasos e hora extra: registrar no zap', 'uteis', '8h'),
  t('encarregado', 'operacao', 'Equipe: liderar com frente e proatividade', 'uteis', '9h'),
  t('encarregado', 'operacao', 'Execução: checar e garantir a qualidade', 'uteis', '10h · 14h (menos ter)'),
  t('encarregado', 'operacao', 'Segurança: EPIs de funcionários e terceiros', 'uteis', '11h'),
  t('encarregado', 'suprimentos', 'Materiais: receber, assinar nota, guardar nota e foto no grupo', 'uteis', '13h'),
  t('encarregado', 'suprimentos', 'Materiais: levantar necessidades (semana atual e próxima)', [1], '13h'),
  t('encarregado', 'transporte', 'Ferramentas: garantir o necessário (semana atual e próxima)', [3], '13h'),
  t('encarregado', 'operacao', 'Reuniões e treinamentos: apoiar (conforme demanda)', [2], '14h'),
  t('encarregado', 'operacao', 'Canteiro: organização no padrão', 'uteis', '15h'),
  t('encarregado', 'operacao', 'Limpeza da obra e áreas comuns', 'uteis', '15h'),
  t('encarregado', 'operacao', 'Produtividade: registrar medições diárias de funcionários e empreiteiros', 'uteis', '16h'),
  t('encarregado', 'operacao', 'Fotos do dia no grupo', 'uteis', '16h'),
  t('encarregado', 'suprimentos', 'EPI: sempre que entregar EPI na obra, preencher a ficha e colher a rubrica do colaborador', 'ocasional', '', POP),

  // ---------------------------------------------------------------- Ajudante de obra
  t('ajudante', 'operacao', 'Limpeza das áreas comuns', 'uteis', '8h'),
  t('ajudante', 'operacao', 'Canteiro: organização', 'uteis', '13h'),
  t('ajudante', 'transporte', 'Ferramentas: checklist obrigatório, preencher planilha e enviar foto ao Anderson', [3], '14h (até 18h)', FIXO),
  t('ajudante', 'transporte', 'Ferramentas: garantir o necessário (semana atual e próxima)', [3], '15h'),
  t('ajudante', 'operacao', 'Limpeza da obra', 'uteis', '16h'),
  t('ajudante', 'transporte', 'Ferramentas: arrumar nos locais no fim do dia', 'uteis', '16h'),

  // ---------------------------------------------------------------- Ferramentas / EPI + transporte (PAIVA)
  t('ferramentas', 'suprimentos', 'Estoque galpão: inventário físico × Planilha Mestre; estoque mínimo e máquinas reserva', [1], '8h', POP),
  t('ferramentas', 'transporte', 'Ferramentas obra: atualizar planilha', [1], '9h'),
  t('ferramentas', 'transporte', 'Perda/roubo: comparar Planilha Mestre semana anterior × atual e relatar à diretoria', [1], '10h', POP),
  t('ferramentas', 'transporte', 'Carros: verificação e reposição (planilha estoque carros)', [1], '11h'),
  t('ferramentas', 'suprimentos', 'EPI: preencher entregas e controle de quantidades', [1], '13h'),
  t('ferramentas', 'transporte', 'Ferramentas obra: compra', [1], '14h'),
  t('ferramentas', 'transporte', 'Ferramentas obra: planilha de consertos', [1], '15h'),
  t('ferramentas', 'suprimentos', 'Consumíveis estoque: atualizar planilha e completar compras', [2], '8h'),
  t('ferramentas', 'suprimentos', 'EPI: comprar EPI faltante', [2], '9h'),
  t('ferramentas', 'suprimentos', 'EPI: cobrar e organizar as planilhas de entrega dos funcionários', [2], '10h'),
  t('ferramentas', 'transporte', 'Ferramentas alugadas: verificar e aprovar orçamento', [3], '8h'),
  t('ferramentas', 'transporte', 'Ferramentas alugadas: atualizar planilha de aluguel', [3], '9h'),
  t('ferramentas', 'transporte', 'Averiguar problemas das ferramentas para conserto', [4], '8h'),
  t('ferramentas', 'transporte', 'Consertos: cobrar orçamento em até 7 dias e decidir consertar ou substituir', [4], '9h', POP),
  t('ferramentas', 'transporte', 'Reunião sobre problemas e ajuste de processo', [4], '15h', FIXO),
  t('ferramentas', 'transporte', 'Apropriar custo das ferramentas entregues no Mais Controle', [5], '8h', POP),
  t('ferramentas', 'transporte', 'Máquina nova: patrimonializar e cadastrar na Planilha Mestre (quando houver)', [5], '13h', POP),
  t('ferramentas', 'suprimentos', 'EPI: fechamento mensal (recolher fichas, consolidar planilha EPI_AAAA_MM e arquivar originais)', { mes: 20 }, '', POP),

  // ---------------------------------------------------------------- Executor de ferramentas / EPI + transporte (ANDERSON)
  t('executor_ferramentas', 'transporte', 'Entrega de materiais e ferramentas nos locais designados', 'uteis'),
  t('executor_ferramentas', 'transporte', 'Preencher formulário de entrega de ferramentas', 'uteis'),
  t('executor_ferramentas', 'transporte', 'Preencher planilha impressa com as ferramentas / obras', [1]),
  t('executor_ferramentas', 'transporte', 'Carro: verificar itens do veículo, registrar presentes e faltantes', [1], 'manhã', POP),
  t('executor_ferramentas', 'transporte', 'Carro: enviar checklist do veículo preenchido ao gestor', [2], 'até 17h', POP),
  t('executor_ferramentas', 'transporte', 'Recolher checklists de ferramentas de todas as obras', [3], 'até 12h', POP),
  t('executor_ferramentas', 'transporte', 'Cobrar obras pendentes e enviar as fotos ao gestor', [3], 'até 17h', POP),
  t('executor_ferramentas', 'transporte', 'Ferramentas alugadas: confirmar com coordenadores quais estão alugadas', 'semanal'),
  t('executor_ferramentas', 'transporte', 'Ferramentas alugadas: atualizar planilha e enviar no grupo', 'semanal'),
  t('executor_ferramentas', 'transporte', 'Reunião sobre problemas e ajuste de processo', [4], '', FIXO),
  t('executor_ferramentas', 'transporte', 'Carro: repor ferramentas e consumíveis', [5]),
  t('executor_ferramentas', 'transporte', 'Carro: limpeza geral', [5]),
  t('executor_ferramentas', 'suprimentos', 'Preencher planilha impressa com as entregas de EPI (segunda)', 'quinzenal'),
  t('executor_ferramentas', 'suprimentos', 'EPI: reunir as fichas do período e entregar ao Gestor de Ferramentas', { mes: 20 }, '', POP),
  t('executor_ferramentas', 'transporte', 'Entregar reposições nas obras, registrar na folha de movimentação com assinatura do gestor e enviar ao Gestor de Ferramentas', 'ocasional', '', POP),
  t('executor_ferramentas', 'suprimentos', 'EPI: entregar só com ficha preenchida e rubricada pelo colaborador; arquivar a ficha (no ato)', 'ocasional', '', POP),
  t('executor_ferramentas', 'transporte', 'Ferramenta com defeito: recolher na obra, registrar na guia de movimentação e enviar ao estagiário do galpão', 'ocasional', '', POP),
  t('executor_ferramentas', 'transporte', 'Conserto: levar a ferramenta; ao voltar, testar (ok volta ao estoque, senão devolve à assistência)', 'ocasional', '', POP),

  // ---------------------------------------------------------------- Pós-obra (ENIO)
  t('posobra', 'posobra', 'Responder clientes e arquitetos', 'uteis', '8h · qua 13h'),
  t('posobra', 'posobra', 'Registrar solicitações no Bitrix e criar pasta no Drive', 'uteis', '8h · qua 13h', POP),
  t('posobra', 'posobra', 'Drive: organizar arquivos', [3], '8h–10h', FIXO),
  t('posobra', 'posobra', 'Funcionários: passar faltas/atrasos', 'uteis', '9h · qua 10h'),
  t('posobra', 'posobra', 'Controle da rota', 'uteis', '9h · qua 10h'),
  t('posobra', 'posobra', 'Reunião de organização', [1], '10h', FIXO),
  t('posobra', 'posobra', 'Reunião de cobranças', [1], '11h', FIXO),
  t('posobra', 'posobra', 'Triagem: classificar (garantia / orçamento / recusa) e decidir até 48h após visita', [1, 4], 'seg 13h · qui 15h', POP),
  t('posobra', 'posobra', 'Visitas para levantamentos / orçamentos', [1], '14h–16h'),
  t('posobra', 'posobra', 'Medição e cobrança: levantar serviços da semana anterior e registrar na PO_CONTROLE', [2], '10h', POP),
  t('posobra', 'posobra', 'Medição e cobrança: cobrar cliente (nunca garantia) e enviar resumo ao financeiro', [2], '11h', POP),
  t('posobra', 'posobra', 'Enviar O.S. para serem cobradas', [2], '13h'),
  t('posobra', 'posobra', 'Controlar se as O.S. foram cobradas', [2], '13h'),
  t('posobra', 'posobra', 'Acompanhamento dos serviços + registro fotográfico', [2, 3, 4, 5], '14h · sex 13h–15h'),
  t('posobra', 'posobra', 'Lista de profissionais', [2], '15h', FIXO),
  t('posobra', 'posobra', 'Agendar serviços', [3, 5], '10h'),
  t('posobra', 'posobra', 'Orçamentos novos', [3], '11h'),
  t('posobra', 'posobra', 'Aprovar com Márcio antes de enviar; aprovado, lançar no Mais Controle e PO_CONTROLE', [3], '11h', POP),
  t('posobra', 'posobra', 'Execução de laudos / relatórios (quando houver)', [3], '15h'),
  t('posobra', 'posobra', 'Reunião de planejamento', [4], '10h', FIXO),
  t('posobra', 'suprimentos', 'Materiais: levantamento e compra', [4], '11h'),
  t('posobra', 'posobra', 'Terceirizados: solicitar orçamentos e acompanhar', [4], '13h'),
  t('posobra', 'posobra', 'Reunião semanal pós-obra com Márcio', [5], '11h', { pop: true, fixo: true }),
  t('posobra', 'posobra', 'Agenda semanal', [5], '15h', FIXO),
  t('posobra', 'posobra', 'Véspera: confirmar material com executor e confirmar cliente', 'uteis', '16h', POP),
  t('posobra', 'posobra', 'Retorno ao cliente com fotos e registro no Bitrix', 'uteis', '16h', POP),
  t('posobra', 'posobra', 'Card Problemas PO × Operações', 'uteis', '16h', POP),
  t('posobra', 'posobra', 'Emergências: escalonar (Márcio, Simone, Marcos) e acionar Nascimento em até 30 min', 'ocasional', '', POP),
  t('posobra', 'posobra', 'Resultado pós-obra: analisar lucro por serviço e apresentar na reunião mensal', 'mensal', '', POP),

  // ---------------------------------------------------------------- Marketing (MARCOS)
  t('marketing', 'comercial', 'Estratégia e pendências', [4], '11h', FIXO),
  t('marketing', 'comercial', 'Arquitetos: atualizar planilha', 'mensal'),

  // ---------------------------------------------------------------- Compras + materiais (MARCOS H.)
  t('compras', 'suprimentos', 'Verificar zap, e-mail, Bitrix e Mais Controle', 'uteis', '8h'),
  t('compras', 'suprimentos', 'Atualizar Bitrix: tarefas novas e foco do dia', 'uteis', '8h20'),
  t('compras', 'suprimentos', 'Baixar notas e fazer lançamentos', 'uteis', '8h30'),
  t('compras', 'suprimentos', 'Finalizar preparação da reunião', [1], '9h'),
  t('compras', 'suprimentos', 'Reunião de compras', [1], '10h', FIXO),
  t('compras', 'suprimentos', 'Fazer cotações', 'uteis', '14h · seg 11h · ter a sex 9h'),
  t('compras', 'suprimentos', 'Compra mercado (1ª terça): P6, Casa Shopping e Galpão', { primeira: 2 }, '10h'),
  t('compras', 'suprimentos', 'Compra Kalunga / Mercado Livre (1ª quarta)', { primeira: 3 }, '10h'),
  t('compras', 'suprimentos', 'Compra EPI e limpeza das obras (1ª quinta)', { primeira: 4 }, '10h'),
  t('compras', 'suprimentos', 'Fornecedores: pesquisa de novos e melhores preços', [5], '10h'),
  t('compras', 'suprimentos', 'Cotações: negociar e fechar', [2, 3, 4, 5], '11h'),
  t('compras', 'suprimentos', 'Registro da rotina', 'uteis', '11h45 e 16h45'),
  t('compras', 'transporte', 'Ferramentas', [1], '13h'),
  t('compras', 'suprimentos', 'Almoxarifado', [2], '13h'),
  t('compras', 'suprimentos', 'Fornecedores', [3], '13h'),
  t('compras', 'suprimentos', 'Fornecedores: cadastrar no Mais Controle (docs e categoria)', [3], '13h', POP),
  t('compras', 'suprimentos', 'Compras cinza / laranja', [4], '13h'),
  t('compras', 'suprimentos', 'Locações: contratar, registrar no Mais Controle e confirmar devoluções', [5], '13h', POP),
  t('compras', 'suprimentos', 'Faturados: pedir relatório de títulos em aberto e boletos', [1], '15h'),
  t('compras', 'suprimentos', 'Faturadas', [2], '15h'),
  t('compras', 'suprimentos', 'NFs / boletos: guardar no Drive', [3], '15h'),
  t('compras', 'suprimentos', 'Lançamentos: fechar ciclo semanal (até quinta)', [4], '15h'),
  t('compras', 'suprimentos', 'Relatório de compras da semana + NFs em PDF para a reunião', [5], '15h'),
  t('compras', 'suprimentos', 'Fechar compras', 'uteis', '15h30'),
  t('compras', 'suprimentos', 'Print compras em andamento', 'uteis', '16h'),
  t('compras', 'suprimentos', 'Cashbacks: atualizar planilha de cashbacks Sólida na Trenamar (após dia 15)', 'mensal'),
  t('compras', 'suprimentos', 'Fornecedores: avaliar (prazo / preço / qualidade) e atualizar ranking por categoria', 'mensal', '', POP),

  // ---------------------------------------------------------------- Financeiro (LETICIA)
  t('financeiro', 'financeiro', 'Pendências', 'uteis', '8h'),
  t('financeiro', 'financeiro', 'Contas a receber + contas a pagar + vencimentos + pagar', 'uteis', '9h'),
  t('financeiro', 'financeiro', 'Validar recebimentos: conferir o que entrou (Mais Controle)', [1], '10h'),
  t('financeiro', 'financeiro', 'Faturamento obras: contas a receber + e-mails de pagamento', [2], '10h', FIXO),
  t('financeiro', 'financeiro', 'Cobrança de NFs em atraso: clientes com notas pendentes', [1, 3], 'seg 11h · qua 10h e 15h'),
  t('financeiro', 'financeiro', 'Cobrança obra laranja: conferir medição (escopo × NF × valor) e enviar ao cliente', [4], '10h', POP),
  t('financeiro', 'financeiro', 'Análise de documentos para pagamentos (Mais Controle)', [1, 5], 'seg 16h · sex 10h'),
  t('financeiro', 'posobra', 'Pós-obra: cobrar ENIO os recebimentos pendentes', [1], '11h'),
  t('financeiro', 'financeiro', 'Conciliação bancária Conta Azul', [2, 3, 4, 5], '11h · sex também 16h'),
  t('financeiro', 'financeiro', 'Fluxo de caixa: atualizar planilha / Conta Azul', 'uteis', 'seg e qua 13h · ter e qui 16h · sex 15h'),
  t('financeiro', 'financeiro', 'Reunião pagamento cliente com diretor', [2], '13h', FIXO),
  t('financeiro', 'financeiro', 'SL Despesa: conferir pagamentos lançados', [4], '13h'),
  t('financeiro', 'financeiro', 'Fechamento semanal: reembolsos + caixinha Marcos e Márcio', [5], '13h'),
  t('financeiro', 'financeiro', 'Controle de comprovantes recebidos dos clientes', [1], '15h'),
  t('financeiro', 'financeiro', 'Aluguéis de equipamentos: conferir apropriação no Mais Controle', [2], '15h', POP),
  t('financeiro', 'financeiro', 'Reembolsos clientes: conferir reembolsos para a Sólida', [4], '15h'),
  t('financeiro', 'financeiro', 'Reunião pagamento cliente', [3], '16h', FIXO),
  t('financeiro', 'financeiro', 'Taxa adm laranja: cobrar', { mes: 20 }),
  t('financeiro', 'financeiro', 'Extrato para contabilidade (ADM e Construção); impostos PIS/COFINS e ISS; despesas folha CLT e PJ; resultado da empresa', 'mensal'),
  t('financeiro', 'financeiro', 'Relatórios Uber, BeeVale, faturamento, custo fixo, centro de custo, combustível, cartão de crédito e impostos', 'mensal'),
  t('financeiro', 'financeiro', 'Resultado financeiro obras e pós-obra: orçado × realizado, margem e projeção final', 'mensal', '', POP),

  // ---------------------------------------------------------------- Administrativo (ISABELLE)
  t('administrativo', 'financeiro', 'Conciliação BeeVale × Mais Controle + pendências no Bitrix (projeto BeeVale)', [1], '8h', POP),
  t('administrativo', 'geral', 'Conferência de e-mails e WhatsApp', [2, 4], '8h'),
  t('administrativo', 'financeiro', 'Conferência Bee Vale / Caixinha', 'uteis', 'seg 10h · ter e qui 9h · qua e sex 8h'),
  t('administrativo', 'geral', 'Controle de pendências', [1, 3, 5], 'seg 9h · qua e sex 11h'),
  t('administrativo', 'financeiro', 'Lançamento Bee Vale no Conta Azul', 'uteis', 'seg 11h · ter e qui 10h · qua e sex 9h'),
  t('administrativo', 'financeiro', 'Uber: prestação de contas (extrato no grupo do escritório)', [3], '10h'),
  t('administrativo', 'financeiro', 'Emissão de relatórios (Uber, Bee Vale)', [5], '10h e 13h30'),
  t('administrativo', 'geral', 'Reunião ADM', [1, 3], '13h30', FIXO),
  t('administrativo', 'geral', 'Relatórios', [1], '14h30–16h'),
  t('administrativo', 'operacao', 'Análise de contratos – terceirizados', [2], '13h30'),
  t('administrativo', 'financeiro', 'Cobrança de NFs e comprovantes', [2], '14h30'),
  t('administrativo', 'geral', 'Controle da planilha de celulares (mensal)', [2], '15h30'),
  t('administrativo', 'geral', 'Recarga Ticket Combustível (quinzenal)', [2], '16h'),
  t('administrativo', 'transporte', 'Verificação de multas – carros', [3], '15h30'),
  t('administrativo', 'rh', 'Atualização da listagem de funcionários (mensal)', [3], '16h'),
  t('administrativo', 'operacao', 'Atualizar planilha de informações de obras', [4], '13h30'),
  t('administrativo', 'geral', 'Ajustes e liberações Mais Controle', [4], '14h30'),
  t('administrativo', 'financeiro', 'Análise de despesas Uber por colaborador (mensal)', [4], '15h30'),
  t('administrativo', 'geral', 'Controle da planilha de computadores (mensal)', [4], '16h'),
  t('administrativo', 'geral', 'Fechamento dos relatórios (mensal, final do mês)', [5], '16h'),
  t('administrativo', 'financeiro', 'Relatório de custo fixo (mensal)', [5], '17h'),
  t('administrativo', 'financeiro', 'Cobrança de NF e cálculo de diárias PJ', { mes: 1 }),
  t('administrativo', 'geral', 'Listagem de compras de escritório; fechamento Bee Vale (virada do mês)', 'mensal'),
  t('administrativo', 'geral', 'Sob demanda: contratos, minutas e distratos; onboarding; e-mails e acessos; Uber para entregas; internet, luz e limpeza; licenciamento de carros; Drive; POPs', 'ocasional'),
  t('administrativo', 'geral', 'Imobiliário: controle dos imóveis da empresa (contratos e vencimentos)', 'ocasional', '', POP),

  // ---------------------------------------------------------------- RH (LEANDRO)
  t('rh', 'rh', 'WPP / e-mail', 'uteis', '8h e 13h'),
  t('rh', 'rh', 'Verificar faltas e folgas e informar diretores no grupo', 'uteis', '8h'),
  t('rh', 'rh', 'Apuração de ponto', 'uteis', '9h · menos qua também 10h'),
  t('rh', 'rh', 'Reunião diretoria', [3], '10h', FIXO),
  t('rh', 'rh', 'Enviar planilha para gestores', 'uteis', '11h'),
  t('rh', 'rh', 'Bitrix', 'uteis', '14h e 16h'),
  t('rh', 'rh', 'Reunião RH', [1], '14h', FIXO),
  t('rh', 'rh', 'Reunião contratações, ponto, problemas e ajuste de processo', [4], '14h', FIXO),
  t('rh', 'rh', 'Recrutamento e seleção', 'uteis', '15h'),
  t('rh', 'rh', 'Folha de ponto: colher assinatura dos funcionários de obra', [2], '16h'),
  t('rh', 'rh', 'Faltas, atrasos e hora extra: preencher planilha', [5], '16h'),
  t('rh', 'rh', 'Benefícios; clínica do trabalho (eSocial, valores e normas); folha de ponto para contabilidade; contracheque e folha; faltas/hora extra no grupo RH; férias; seguro de vida; INSS e FGTS; planilha de salários', 'mensal'),
  t('rh', 'rh', 'Férias: atualizar calendário anual (com validação da Operação) e checar vencidas', 'mensal', '', POP),
  t('rh', 'rh', 'Sazonal: admissões; experiência 45 dias; contratos de estagiários e terceirizados; recrutamento', 'ocasional'),
  t('rh', 'rh', 'Sazonal / mensal: demissões; aniversariantes do mês; confraternizações e meses temáticos', 'ocasional', '', POP),

  // ---------------------------------------------------------------- acréscimos de 16/10 (no fim, para não mudar o id das tarefas já marcadas)
  // Mariana (papéis com as setas "1A → 1D" etc.): tarefas que passaram a ter mais de um horário na semana
  t('planejamento', 'operacao', 'Orç. terceirizado: conferir orçamentos recebidos', [1], '10h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: conferir orçamentos recebidos', [3], '16h'),
  t('planejamento', 'planejamento', 'Cronograma: lançar real executado (produtividade) na revisão', [3], '13h'),
  t('planejamento', 'planejamento', 'Cronograma de obra: analisar e revisar', [3], '14h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: apresentar orçamentos para cliente e arquiteta', [3], '8h'),
  t('planejamento', 'operacao', 'Orç. terceirizado: apresentar orçamentos para cliente e arquiteta', [5], '13h'),
  // Julia: acrescentado à mão na lista dela
  t('orc_terceirizado', 'planejamento', 'Imprimir o cronograma das obras e enviar nos grupos', [4]),
].map((x, i) => ({ ...x, id: `${x.funcao}-${i}` }));

// 1 = segunda … 7 = domingo
export function diaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

// Tarefa entra na grade da semana? (mensal sem dia, quinzenal e ocasional ficam em "Fora do quadro")
export const naGrade = (tarefa) => !['mensal', 'quinzenal', 'ocasional'].includes(tarefa.dias);

export function valeNoDia(tarefa, iso) {
  const ds = diaSemana(iso);
  const dias = tarefa.dias;
  if (dias === 'uteis') return ds <= 5;
  if (dias === 'todos') return ds <= 6;
  if (dias === 'semanal') return ds === 5;            // sem dia certo: vale até sexta
  if (Array.isArray(dias)) return dias.includes(ds);
  if (dias && dias.mes) return Number(iso.slice(8, 10)) === dias.mes;
  if (dias && dias.primeira) return ds === dias.primeira && Number(iso.slice(8, 10)) <= 7;
  return false;
}

export function tarefasDoDia(funcaoId, iso) {
  return TAREFAS.filter((x) => x.funcao === funcaoId && valeNoDia(x, iso));
}

const NOMES_DIA = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export function descreverDias(d) {
  if (d === 'uteis') return 'Seg a sex';
  if (d === 'todos') return 'Seg a sáb';
  if (d === 'semanal') return 'Na semana (até sex)';
  if (d === 'mensal') return 'Mensal';
  if (d === 'quinzenal') return 'Quinzenal';
  if (d === 'ocasional') return 'Quando houver';
  if (Array.isArray(d)) return d.map((n) => NOMES_DIA[n]).join(', ');
  if (d && d.mes) return `Todo dia ${d.mes}`;
  if (d && d.primeira) return `1ª ${NOMES_DIA[d.primeira].toLowerCase()} do mês`;
  return '';
}

// Setores cadastrados (tabela setores): troca a lista no mesmo array, para todas as telas que a importaram enxergarem a mudança na hora
export function aplicarSetores(nomes) {
  const lista = [...new Set((nomes || []).map((n) => String(n).trim()).filter(Boolean))];
  if (lista.length) SETORES_ORGANOGRAMA.splice(0, SETORES_ORGANOGRAMA.length, ...lista);
}
