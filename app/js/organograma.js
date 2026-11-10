// Departamentos do sistema, espelhando o organograma (R07, 09/2026) e o desenho do Marcos
// ("SL Sistema App — Layout dos dashboards por departamento", 04/11/2026).
// Menu: Meu trabalho (Início, Agenda, Tarefas, Atas) · os 15 departamentos (as obras dentro de Operações) · Resultados (Ranking).
// Cada departamento tem um PAINEL no mesmo desenho (pergunta → indicadores com meta → quem precisa agir → detalhe por obra)
// e, quando já existia tela no sistema, a aba "Detalhes" com a tela antiga (nada foi jogado fora).
//
// id     = rota (#/<id>). As que já existiam continuam com o mesmo id, para os links antigos seguirem funcionando.
// cfg    = área do dados.json (agentes) de onde vêm indicadores e alertas; a tela antiga também vem dela.
// setor  = nome do setor (SETORES_ORGANOGRAMA) usado nas tarefas criadas a partir deste painel.
// funcoes = quem vê o departamento no menu (além da diretoria e do administrativo, que veem tudo).
// Pedido do Felipe (04/11): Materiais e Ferramentas e EPI não são departamentos à parte. Ficam Compras, Materiais / Vendas (venda de materiais, Mercado Livre), Transporte e Logística
// (rotas) e Estoque (tela própria com abas: estoque, contagem, guia de movimentação, pedir itens, checklists, reposição).

export const DEPARTAMENTOS = [
  { id: 'operacao', nome: 'Operações', cfg: 'operacao', setor: 'Operação', comObras: true,
    resp: 'Coordenadora: Simone · obras em curso aparecem como submenus',
    pergunta: 'O que está acontecendo hoje em cada obra, está de acordo com o planejado e quem precisa agir?',
    funcoes: ['coord_operacoes', 'tecnico', 'planejamento', 'projetos', 'compras', 'ferramentas', 'estagiario_compras', 'gestor_obra', 'estagiario', 'encarregado', 'ajudante', 'rh'] },
  { id: 'posobra', nome: 'Pós-Obra', cfg: 'posobra', setor: 'Pós-obra',
    resp: 'Diretor: Márcio · Gestor: Ênio · Executores: Pedro, Nascimento e Cleviano',
    pergunta: 'Quais solicitações estão abertas, em que fase estão e o que precisa ser cobrado ou agendado?',
    funcoes: ['posobra', 'tecnico', 'coord_operacoes', 'ferramentas', 'financeiro'] },
  { id: 'tecnico', nome: 'Técnico e Qualidade', setor: 'Técnico / qualidade',
    resp: 'Supervisor: Márcio',
    pergunta: 'Cada serviço foi verificado nas duas conferências antes de seguir para a próxima etapa?',
    funcoes: ['tecnico', 'coord_operacoes', 'gestor_obra'] },
  { id: 'projetos', nome: 'Projeto', cfg: 'projetos', setor: 'Projetos',
    resp: 'Gestora: Isabel',
    pergunta: 'Para cada obra, que projeto está faltando para as etapas seguintes?',
    funcoes: ['projetos', 'planejamento', 'coord_operacoes', 'tecnico', 'gestor_obra', 'estagiario'] },
  { id: 'planejamento', nome: 'Planejamento', cfg: 'planejamento', setor: 'Planejamento',
    resp: 'Supervisora: Mariana · Estagiária: Júlia (orçamento terceirizado)',
    pergunta: 'Cada obra tem meta da semana, cronograma atualizado e o caminho crítico sob controle?',
    funcoes: ['planejamento', 'orc_terceirizado', 'coord_operacoes', 'tecnico', 'projetos', 'gestor_obra', 'estagiario'] },
  { id: 'orc-terceirizado', nome: 'Orçamento Terceirizado', setor: 'ORC terceirizado laranja',
    resp: 'Estagiária: Júlia · Supervisora: Mariana',
    titulo: 'Orçamento Terceirizado (laranja)',
    pergunta: 'Quais contratações e orçamentos de terceiros faltam em cada obra e qual é a prioridade?',
    funcoes: ['orc_terceirizado', 'planejamento', 'coord_operacoes'] },
  { id: 'orcamentos', nome: 'Orçamento', cfg: 'orcamentos', setor: 'ORC obras novas',
    resp: 'Gestora: Isabel · Estagiário: Leandro · independente do Comercial',
    pergunta: 'Em que status está cada orçamento e quantos estamos fechando?',
    funcoes: ['projetos', 'orc_terceirizado', 'planejamento', 'marketing'] },
  { id: 'comercial', nome: 'Comercial', cfg: 'comercial', setor: 'Comercial',
    resp: 'Diretor: Marcos · Marketing e Novos negócios',
    pergunta: 'Quais arquitetos preciso contatar agora e o que está andando?',
    funcoes: ['marketing', 'projetos'] },
  { id: 'compras', nome: 'Compras', cfg: 'suprimentos', setor: 'Suprimentos e compras',
    resp: 'Gestor: Marcos H. · Estagiário: Pedro M.',
    pergunta: 'Existe solicitação ou cotação parada que vai atrasar uma obra?',
    funcoes: ['compras', 'estagiario_compras', 'coord_operacoes', 'gestor_obra', 'administrativo', 'financeiro'] },
  { id: 'materiais', nome: 'Materiais / Vendas', cfg: 'suprimentos', setor: 'Suprimentos e compras',
    resp: 'Gestor: Marcos H. · Executor: Flávio', titulo: 'Materiais e vendas (Mercado Livre)',
    pergunta: 'O que saiu do galpão, o que foi vendido (Mercado Livre e outros) e o que está acabando?',
    funcoes: ['compras', 'estagiario_compras', 'ferramentas', 'executor_ferramentas'] },
  { id: 'transporte', nome: 'Transporte e Logística', cfg: 'transporte', setor: 'Transporte e logística',
    resp: 'Gestor: Paiva · Executor: Anderson',
    pergunta: 'As rotas do dia e do dia seguinte foram feitas conforme o combinado e o que precisa de correção?',
    funcoes: ['ferramentas', 'executor_ferramentas', 'estagiario_compras', 'compras', 'posobra'] },
  { id: 'financeiro', nome: 'Financeiro', cfg: 'financeiro', setor: 'Financeiro',
    resp: 'Gestora: Letícia · valores visíveis só para sócios',
    pergunta: 'Existe pagamento ou recebimento travando alguma obra?',
    funcoes: ['financeiro'] },
  { id: 'rh', nome: 'RH e DP', cfg: 'rh', setor: 'RH',
    resp: 'Gestor: Leandro',
    pergunta: 'Quem faltou, atrasou ou fez hora extra, e quem precisa entrar de férias?',
    funcoes: ['rh', 'coord_operacoes', 'administrativo', 'financeiro', 'gestor_obra', 'estagiario', 'encarregado', 'ajudante'] },
  { id: 'administrativo', nome: 'Administrativo', setor: 'Administrativo',
    resp: 'Gestora: Isabelle',
    pergunta: 'O que o responsável quer acompanhar? A definir.',
    funcoes: ['administrativo'] },
];

export const depPorId = (id) => DEPARTAMENTOS.find((d) => d.id === id) || null;

// diretoria e administrativo veem todos os departamentos; os outros, os do seu trabalho
export function podeVerDep(dep, f) {
  if (!dep || !f) return false;
  if (['socio', 'administrativo'].includes(f.id)) return true;
  if (dep.id === 'financeiro') return !!f.veValores;
  return (dep.funcoes || []).includes(f.id);
}
