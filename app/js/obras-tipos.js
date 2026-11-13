// Tipos de cadastro de obra e as situações de cada um (pedido do Felipe, 13/11/2026).
//   Obra ........... em andamento · pausada · finalizada
//   Obra em orçamento: solicitação · em orçamento · com a arquitetura · com fornecedor · não fechado   (só o setor ORC Obras Novas e a diretoria veem)
//   Pós-obra ....... em andamento · pausada · finalizada (igual à obra: o que anda dentro do pós-obra — análise, orçamento, falta agendar… — é a OS, no Quadro de OS)
// Campos: código, cliente (obrigatório), endereço (obrigatório) e arquitetura (opcional).
export const TIPOS = [['obra', 'Obra'], ['orcamento', 'Obra em orçamento'], ['pos', 'Pós-obra']];
const SIT_NORMAL = [['andamento', 'Em andamento'], ['pausada', 'Pausada'], ['finalizada', 'Finalizada']];
export const SITUACOES_POR_TIPO = {
  obra: SIT_NORMAL,
  pos: SIT_NORMAL,
  orcamento: [['solicitacao', 'Solicitação'], ['orcamento', 'Em orçamento'], ['com_arquitetura', 'Com a arquitetura'], ['com_fornecedor', 'Com fornecedor'], ['nao_fechado', 'Não fechado']],
};
export const ROTULO_SITUACAO = Object.fromEntries([...SIT_NORMAL, ...SITUACOES_POR_TIPO.orcamento]);
export const ROTULO_TIPO = Object.fromEntries(TIPOS);

// tipo do cadastro; cadastros antigos (sem a coluna tipo) são deduzidos do código e da situação
export const tipoDe = (c) => c.tipo || (/^mo/i.test(String(c.codigo || '').trim()) ? (['orcamento', 'nao_fechado'].includes(c.situacao) ? 'orcamento' : 'obra') : 'pos');
// situação válida para o tipo (pós-obra não tem situação de orçamento: orçamento é da OS)
export function situacaoDe(c) {
  const t = tipoDe(c); const validas = SITUACOES_POR_TIPO[t].map((x) => x[0]);
  if (validas.includes(c.situacao)) return c.situacao;
  return t === 'pos' ? (c.situacao === 'nao_fechado' ? 'finalizada' : 'andamento') : validas[0];
}
export const naoFechado = (c) => situacaoDe(c) === 'nao_fechado';
export const orcamentoAberto = (c) => tipoDe(c) === 'orcamento' && !naoFechado(c);
// aparece nas listas da operação (caixinhas de obra, menu, filtros): obra ou pós-obra em andamento ou pausada
export const ativaNasListas = (c) => tipoDe(c) !== 'orcamento' && situacaoDe(c) !== 'finalizada';
// rótulo da obra para mostrar: o cliente; sem cliente, o nome antigo
export const clienteDe = (c) => c.cliente || c.nome || '';
