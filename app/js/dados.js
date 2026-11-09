// Fonte dos dados da Fase 1: os JSON exportados da planilha (scripts/exportar_planilha.py).
// Para trocar a fonte (ex.: ler a planilha direto do Google Drive), basta reescrever carregarDados()
// devolvendo o mesmo formato: { obras, servicos, equipe, agenda, financeiro, listas }.

import { NA_NUVEM, baixar, listarEfetivoDiario } from './nuvem.js';

const TABELAS = ['obras', 'servicos', 'equipe', 'agenda', 'financeiro', 'listas'];
const PASTA = '../dados/json/';

// dados.json do Painel da Empresa (preenchido pelos agentes). O servidor local busca no Drive
// e devolve { origem: 'link' | 'cache' | 'nenhum', atualizado, erro, dados }.
export async function carregarPainel() {
  // na nuvem: o computador do escritório manda { atualizado, dados } para o Supabase a cada 10 min
  if (NA_NUVEM) { const p = await baixar('painel'); if (!p) throw new Error('Os dados ainda não chegaram do computador do escritório.'); return { origem: 'link', atualizado: p.atualizado, dados: p.dados }; }
  const r = await fetch('/api/painel', { cache: 'no-store' });
  if (!r.ok) throw new Error(`O servidor respondeu ${r.status} ao buscar o painel.`);
  return r.json();
}

// Planilha de ferramentas obrigatórias enviada no grupo de WhatsApp (lida pela verificação, só leitura).
export async function carregarFerramentasChk() {
  try {
    if (NA_NUVEM) return (await baixar('ferramentas-checklist')) || { registros: [] };
    const r = await fetch(`${PASTA}ferramentas-checklist.json`, { cache: 'no-store' });
    return r.ok ? await r.json() : { registros: [] };
  } catch { return { registros: [] }; }
}

// Efetivo do dia de cada obra, lido dos grupos de WhatsApp pelo leitor automático (RH).
export async function carregarEfetivo() {
  try {
    if (NA_NUVEM) {
      const arq = (await baixar('efetivo')) || { dias: {} };
      // o banco guarda o histórico completo: o que vier de lá vale por cima do arquivo
      try {
        const linhas = await listarEfetivoDiario();
        arq.dias = arq.dias || {};
        for (const l of linhas) { (arq.dias[l.dia] = arq.dias[l.dia] || {})[l.obra] = { hora: l.hora || '', solida: { qtd: l.solida_qtd || 0, nomes: l.solida_nomes || [] }, terceiros: l.terceiros || [], total: l.total || 0 }; }
      } catch { /* sem acesso ao histórico: fica o arquivo */ }
      return arq;
    }
    const r = await fetch(`${PASTA}efetivo.json`, { cache: 'no-store' });
    return r.ok ? await r.json() : { dias: {} };
  } catch { return { dias: {} }; }
}

// Empresas terceirizadas nas obras e a conferência de contratos no Mais Controle (agente de Operação, só leitura).
export async function carregarTerceirizados() {
  try {
    if (NA_NUVEM) return (await baixar('terceirizados')) || { empresas: [] };
    const r = await fetch(`${PASTA}terceirizados.json`, { cache: 'no-store' });
    return r.ok ? await r.json() : { empresas: [] };
  } catch { return { empresas: [] }; }
}

// Produtividade lida nos grupos de WhatsApp das obras (programação do dia × relatório diário).
// Preenchida pela verificação diária (Claude, toda manhã, do dia anterior). Ver docs/contrato-agentes.md.
export async function carregarProdutividade() {
  if (NA_NUVEM) return (await baixar('produtividade')) || { registros: [] };
  const r = await fetch(`${PASTA}produtividade.json`, { cache: 'no-store' });
  if (!r.ok) return { registros: [] };
  return r.json();
}

// Medição lida no Mais Controle pelo agente de Operação (por obra e semana, item a item). Ver docs/contrato-agentes.md.
export async function carregarMedicoesMC() {
  if (NA_NUVEM) return (await baixar('medicoes-mc')) || { obras: [] };
  const r = await fetch(`${PASTA}medicoes-mc.json`, { cache: 'no-store' });
  return r.ok ? r.json() : { obras: [] };
}

// Análise semanal das rotas da Strada (agente de Transporte, toda segunda): aba Rotas da área Transporte.
export async function carregarRotas() {
  try {
    if (NA_NUVEM) return (await baixar('rotas-semana')) || { semanas: [] };
    const r = await fetch(`${PASTA}rotas-semana.json`, { cache: 'no-store' });
    return r.ok ? await r.json() : { semanas: [] };
  } catch { return { semanas: [] }; }
}

// Orçamentos (SL_ORÇAMENTOS<ano>) e projetos/as-built/cronograma por obra, lidos no Google Drive por
// scripts/exportar-drive.ps1 (o servidor roda em segundo plano, no máximo a cada 10 minutos).
export async function carregarDrive() {
  const ler = async (nome) => {
    if (NA_NUVEM) return baixar(nome);
    const r = await fetch(`${PASTA}${nome}.json`, { cache: 'no-store' });
    return r.ok ? r.json() : null;
  };
  const [orcamentos, projetos, estoque] = await Promise.all([ler('orcamentos'), ler('projetos'), ler('estoque')]);
  return { orcamentos, projetos, estoque };
}

export async function carregarDados() {
  const partes = await Promise.all(
    TABELAS.map(async (t) => {
      // na nuvem: o financeiro só chega para quem vê valores (regra do banco); para os outros, lista vazia
      if (NA_NUVEM) return [t, (await baixar(t)) || []];
      const r = await fetch(`${PASTA}${t}.json`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`Não foi possível ler ${t}.json (${r.status})`);
      return [t, await r.json()];
    }),
  );
  const dados = Object.fromEntries(partes);
  // de quais arquivos do Drive o pós-obra foi lido (Controle Operacional, Cobrança e Agenda: sempre a revisão mais nova)
  try { dados._fonte = NA_NUVEM ? await baixar('posobra-estado') : await (await fetch(`${PASTA}posobra-estado.json`, { cache: 'no-store' })).json(); } catch { dados._fonte = null; }
  return dados;
}
