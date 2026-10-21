// Nome padrão e dados cadastrais das obras do pós-obra.
// Padrão do nome: "CÓDIGO · Nome" (ex.: PO531 · Aumento de carga); abaixo, "Cliente · Endereço". Quando falta cliente ou endereço, o sistema
// avisa e dá um botão para completar (o que for preenchido aqui vale por cima da planilha). Na nuvem: tabela obras_pos; no computador do escritório: neste navegador.
import { NA_NUVEM, listarObrasPos, gravarObraPos } from './nuvem.js';

const CHAVE = 'solida.obrasPos';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export let linhas = [];
export let erro = '';
export async function carregar() {
  try { linhas = NA_NUVEM ? await listarObrasPos() : lerLocal(); erro = ''; } catch (e) { erro = String(e.message || e); }
  return linhas;
}
// obras da planilha + o que foi completado no sistema
export function mesclar(obras) {
  const por = new Map(linhas.map((l) => [l.obra, l]));
  return (obras || []).map((o) => { const l = por.get(o.obra); return l ? { ...o, cliente: l.cliente || o.cliente, endereco: l.endereco || o.endereco, responsavel: l.responsavel || o.responsavel, apelido: l.apelido || '' } : o; });
}
export async function salvar(l) {
  if (NA_NUVEM) await gravarObraPos(l);
  else { const t = lerLocal().filter((x) => x.obra !== l.obra); t.push(l); gravarLocal(t); }
  await carregar();
}

// "PO531 - Aumento de carga" → código PO531, nome "Aumento de carga";  "PO - Junior (drenos)" → sem código, nome "Junior (drenos)"
export function partesObra(o) {
  const bruto = String(o.obra || '').trim();
  let codigo = ''; let resto = bruto; let tipoNome = '';
  const m = bruto.match(/^((?:MO|PO)\s?\d{3})\s*(?:[-–]\s*(.*))?$/i);
  if (m) { codigo = m[1].replace(/\s/g, '').toUpperCase(); resto = (m[2] || '').trim(); }
  else { const m2 = bruto.match(/^(PO|MO|Chamado|Interno)\s*[-–]\s*(.*)$/i); if (m2) { resto = m2[2].trim(); if (!/^(po|mo)$/i.test(m2[1])) tipoNome = m2[1]; } }
  const nome = (o.apelido || resto || '').trim();
  const cliente = String(o.cliente || '').trim(); const endereco = String(o.endereco || '').trim();
  const tituloNome = nome || cliente || '';
  return {
    codigo, nome, cliente, endereco,
    titulo: [codigo || tipoNome, tituloNome].filter(Boolean).join(' · ') || bruto,
    curto: [codigo || tipoNome, tituloNome].filter(Boolean).join(' ') || bruto,
    sub: [cliente && cliente.toLowerCase() !== tituloNome.toLowerCase() ? cliente : '', endereco].filter(Boolean).join(' · '),
    incompleta: !cliente || !endereco,
  };
}
