// Fonte dos dados da Fase 1: os JSON exportados da planilha (scripts/exportar_planilha.py).
// Para trocar a fonte (ex.: ler a planilha direto do Google Drive), basta reescrever carregarDados()
// devolvendo o mesmo formato: { obras, servicos, equipe, agenda, financeiro, listas }.

import { NA_NUVEM, baixar } from './nuvem.js';

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

// Produtividade lida nos grupos de WhatsApp das obras (programação do dia × relatório diário).
// Preenchida pela verificação diária (Claude, toda manhã, do dia anterior). Ver docs/contrato-agentes.md.
export async function carregarProdutividade() {
  if (NA_NUVEM) return (await baixar('produtividade')) || { registros: [] };
  const r = await fetch(`${PASTA}produtividade.json`, { cache: 'no-store' });
  if (!r.ok) return { registros: [] };
  return r.json();
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
  return Object.fromEntries(partes);
}
