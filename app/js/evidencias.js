// Tarefa feita "automaticamente": quando a pessoa esquece de marcar em Minha semana, o sistema procura uma prova
// de que a tarefa foi feita (pedido do Felipe, 15/10):
//   - arquivo novo ou alterado na pasta de controle da obra (dados/json/evidencias.json, lido do Drive por
//     scripts/evidencias.ps1): programação semanal, cronograma, pendências, escopo, ata, relatório, diário;
//   - produtividade do dia enviada no grupo do WhatsApp (verificação diária).
// O crédito vai para quem tem a tarefa na função e acompanha a obra (o "quem salvou" gravado no arquivo é a conta
// do Office do computador, muitas vezes compartilhada; aparece só como informação).
// A marcação manual sempre vale mais: se a pessoa marcou ✕, fica ✕.

import { programacoes, registroDoDia } from './programacao.js';
import { somarDias, inicioDaSemana } from './datas.js';
import { NA_NUVEM, baixar } from './nuvem.js';

let eventos = [];
export async function carregar() {
  if (NA_NUVEM) { const j = await baixar('evidencias'); eventos = j && Array.isArray(j.eventos) ? j.eventos : []; return eventos; }
  try { const r = await fetch('/dados/json/evidencias.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); eventos = Array.isArray(j.eventos) ? j.eventos : (j.eventos ? [j.eventos] : []); } } catch { /* sem arquivo */ }
  return eventos;
}

// que prova vale para cada tarefa (pelo texto). Aprovar/verificar/afixar não se prova por arquivo.
const REGRAS = [
  { re: /produtividade: registrar/i, tipo: 'whats' },
  { re: /programa[çc][ãa]o semanal|meta di[áa]ria/i, tipo: 'programacao' },
  { re: /cronograma/i, tipo: 'cronograma' },
  { re: /pend[êe]ncias de obra/i, tipo: 'pendencias' },
  { re: /escopo: atualizar|aditivos?: (solicitar|fazer)/i, tipo: 'escopo' },
  { re: /\bata\b/i, tipo: 'ata' },
  { re: /relat[óo]rio (de obra|fotogr)/i, tipo: 'relatorio' },
  { re: /di[áa]rio de obra: fazer/i, tipo: 'diario' },
];
const NAO_PROVA = /aprovar|verificar|validar|afixar|analisar/i;
export function tipoDaTarefa(t) {
  if (NAO_PROVA.test(t.texto)) return null;
  const r = REGRAS.find((x) => x.re.test(t.texto));
  return r ? r.tipo : null;
}

// tarefa de uma vez por semana: a prova pode ser de qualquer dia da semana; as outras, do próprio dia
const umaVezNaSemana = (t) => !Array.isArray(t.dias) || t.dias.length <= 1;

// pessoa = { funcao, obras: [] (vazio = todas) }. Devolve { tipo, texto, quando, por } ou null.
export function provaDe(t, data, pessoa, CFG) {
  const tipo = tipoDaTarefa(t);
  if (!tipo) return null;
  const obras = (pessoa && pessoa.obras) || [];
  const daObra = (o) => !obras.length || obras.includes(o);
  if (tipo === 'whats') {
    if (!CFG) return null;
    for (const p of programacoes(CFG).filter((x) => daObra(x.obra))) {
      const r = registroDoDia(p, data);
      if (r && r.relatorio) return { tipo, texto: `produtividade da ${p.obra} enviada no grupo`, quando: `${data}T${r.relatorio.hora || '00:00'}`, por: r.relatorio.por || '' };
    }
    return null;
  }
  const ini = umaVezNaSemana(t) ? inicioDaSemana(data) : data;
  const fim = umaVezNaSemana(t) ? somarDias(inicioDaSemana(data), 6) : data;
  const ev = eventos.filter((e) => e.tipo === tipo && daObra(e.obra) && String(e.quando).slice(0, 10) >= ini && String(e.quando).slice(0, 10) <= fim)
    .sort((a, b) => String(b.quando).localeCompare(String(a.quando)))[0];
  if (!ev) return null;
  return { tipo, texto: `${ev.arquivo} (${ev.obra})`, quando: ev.quando, por: ev.por || '' };
}

export const descreverProva = (p) => `Feito automaticamente: ${p.texto}, em ${String(p.quando).slice(8, 10)}/${String(p.quando).slice(5, 7)} às ${String(p.quando).slice(11, 16)}${p.por ? ` (salvo pela conta "${p.por}")` : ''}`;
