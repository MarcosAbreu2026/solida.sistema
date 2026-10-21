// Transporte e logística › Planilha de ferramentas obrigatórias: um cartão por obra (e por estoque / carro)
// dizendo se a planilha do ciclo foi enviada no grupo de WhatsApp até a quarta-feira.
// A aferição é de 15 em 15 dias (decisão do Felipe, 16/10): a compra demora para chegar, então contar toda
// semana só mostraria de novo o que já foi comprado e ainda não chegou. O ciclo começa na segunda-feira de
// `inicio` (12/10/2026) e dura 14 dias; a planilha vence na quarta-feira da primeira semana do ciclo.
// Quem envia: Anderson, em foto da planilha preenchida no grupo "GESTAO ferramentas".
// Quem lê o grupo (só leitura) preenche dados/json/ferramentas-checklist.json — ver docs/contrato-agentes.md.

import { html, data as fmtData } from '../formato.js';
import { hojeISO, inicioDaSemana, somarDias, diasEntre } from '../datas.js';

export const LOCAIS_FIXOS = ['Estoque', 'Carro do Anderson', 'Carro do Nascimento', 'Carro do Enio'];
export const CICLO_DIAS = 14;
const SEMANAS = 4; // bolinhas: esta semana + as 3 anteriores
const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^carro\s+(do|da|de)?\s*/, 'carro ').replace(/\s+/g, ' ').trim();
const diaCurto = (iso) => `${DIA[new Date(`${iso}T12:00:00`).getDay()]} ${fmtData(iso).slice(0, 5)}`;

// Início (segunda-feira) do ciclo que contém `hoje`
export function inicioDoCiclo(hoje, inicio = '2026-10-12') {
  const base = inicioDaSemana(inicio);
  const n = Math.floor(diasEntre(base, hoje) / CICLO_DIAS);
  return somarDias(base, n * CICLO_DIAS);
}

// Estado de um local num ciclo (ini = segunda-feira de abertura): ok | atraso | espera | nao | nv | sem
function estadoDoCiclo(regs, ini, hoje, verificadoEm, inicio = '2026-10-12') {
  if (ini < inicioDaSemana(inicio)) return { cod: 'sem', reg: null }; // antes de o controle começar
  const quarta = somarDias(ini, 2);
  const dela = regs.filter((r) => r.enviadoEm >= ini && r.enviadoEm <= somarDias(ini, CICLO_DIAS - 1)).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
  if (dela) return { cod: dela.enviadoEm <= quarta ? 'ok' : 'atraso', reg: dela };
  if (hoje <= quarta) return { cod: 'espera', reg: null };
  const lido = String(verificadoEm || '').slice(0, 10);
  return { cod: lido >= quarta ? 'nao' : 'nv', reg: null };
}
// Bolinha de uma semana (segunda a domingo): o que chegou naquela semana, lido retroativamente nos grupos
function estadoDaSemanaDe(regs, s, hoje, verificadoEm) {
  const quarta = somarDias(s, 2);
  const dela = regs.filter((r) => r.enviadoEm >= s && r.enviadoEm <= somarDias(s, 6)).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
  if (dela) return { cod: dela.enviadoEm <= quarta ? 'ok' : 'atraso', reg: dela };
  if (hoje < quarta) return { cod: 'espera', reg: null };   // na própria quarta, se o grupo já foi lido hoje e nada chegou, já conta como não enviada
  const fim = somarDias(s, 6);
  return { cod: String(verificadoEm || '').slice(0, 10) >= (fim < hoje ? fim : hoje) ? 'nao' : 'nv', reg: null };
}
const ROTULO = {
  ok: '✓ Enviada no prazo', atraso: '⚠ Enviada com atraso', espera: 'Aguardando (até quarta)',
  nao: '✕ Não enviada', nv: 'Ainda não verificado', sem: 'Controle ainda não existia',
};

// obras encerradas no cadastro da planilha de ferramentas (aba OBRAS) saem dos cartões
export function locaisDoChecklist(CFG, visiveis, estoque) {
  const encerradas = new Set(((estoque && estoque.cadastroObras) || []).filter((c) => /encerr|finaliz|conclu/i.test(c.status || '')).map((c) => c.obra));
  const obras = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o) && !encerradas.has(o) && (!visiveis || visiveis.includes(o)));
  return [...obras, ...(visiveis ? [] : LOCAIS_FIXOS)];
}

export function cartoes(CFG, dados, visiveis = null, estoque = null) {
  const hoje = hojeISO();
  const regsTodos = (dados && Array.isArray(dados.registros) ? dados.registros : []).filter((r) => r && r.local && /^\d{4}-\d{2}-\d{2}$/.test(String(r.enviadoEm || '')));
  const verificadoEm = dados && dados.verificadoEm;
  const inicio = (dados && dados.inicio) || '2026-10-12';
  const ini = inicioDoCiclo(hoje, inicio);
  const semanaAtual = inicioDaSemana(hoje);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => somarDias(semanaAtual, -7 * (SEMANAS - 1 - i))); // do mais antigo para esta
  const locais = locaisDoChecklist(CFG, visiveis, estoque);
  const estado = (regs, c) => estadoDoCiclo(regs, c, hoje, verificadoEm, inicio);
  const estadoDaSemana = (regs, s) => estadoDaSemanaDe(regs, s, hoje, verificadoEm);
  const card = (local) => {
    const regs = regsTodos.filter((r) => chave(r.local) === chave(local));
    const hist = semanas.map((s) => ({ s, ...estadoDaSemana(regs, s) }));
    const atual = estado(regs, ini);
    const ultimo = [...regs].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
    const sub = atual.reg ? `${atual.reg.por ? `${atual.reg.por}, ` : ''}${diaCurto(atual.reg.enviadoEm)}${atual.reg.hora ? `, ${atual.reg.hora}` : ''}`
      : atual.cod === 'espera' ? `prazo: ${diaCurto(somarDias(ini, 2))}`
        : ultimo ? `última enviada: ${diaCurto(ultimo.enviadoEm)}` : 'nenhuma enviada até agora';
    return html`<div class="ob-card fc-card fc-${atual.cod}">
      <span class="ob-topo"><b class="ob-cod">${local}</b></span>
      <span class="fc-situacao">${ROTULO[atual.cod]}</span>
      <span class="ob-sub">${sub}</span>
      <span class="fc-hist" title="Últimas 4 semanas, da mais antiga para esta">${hist.map((h) => html`<i class="fc-b fc-${h.cod}" title="Semana de ${fmtData(h.s).slice(0, 5)} a ${fmtData(somarDias(h.s, 6)).slice(0, 5)}: ${ROTULO[h.cod]}"></i>`)}</span>
    </div>`;
  };
  const nOk = locais.filter((l) => ['ok', 'atraso'].includes(estado(regsTodos.filter((x) => chave(x.local) === chave(l)), ini).cod)).length;
  const lido = verificadoEm ? `Grupos lidos em ${fmtData(String(verificadoEm).slice(0, 10))}${String(verificadoEm).length > 10 ? `, ${String(verificadoEm).slice(11, 16)}` : ''}` : 'Os grupos ainda não foram lidos para este controle';
  const proximo = somarDias(ini, CICLO_DIAS + 2);
  return html`<section class="ob-sec">
    <div class="painel-h"><h2>Planilha de ferramentas obrigatórias</h2><p>De 15 em 15 dias, enviada pelo Anderson no grupo do WhatsApp · ciclo de ${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, CICLO_DIAS - 1)).slice(0, 5)} (próxima: ${diaCurto(proximo)}) · ${nOk} de ${locais.length} neste ciclo · ${lido}</p></div>
    <div class="ob-cards">${locais.map(card)}</div>
    <p class="legenda-semana"><span class="fc-b fc-ok"></span> no prazo <span class="fc-b fc-atraso"></span> com atraso <span class="fc-b fc-nao"></span> não enviada <span class="fc-b fc-nv"></span> não verificado <span class="fc-b fc-espera"></span> ainda no prazo · bolinhas: últimas 4 semanas, da mais antiga para esta</p>
  </section>`;
}
