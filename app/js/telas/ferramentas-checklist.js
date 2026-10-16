// Transporte e logística › Planilha de ferramentas obrigatórias: um cartão por obra (e por estoque / carro)
// dizendo se a planilha da semana foi enviada no grupo de WhatsApp até quarta-feira.
// Quem envia: Anderson, toda quarta, em foto/imagem da planilha preenchida no grupo "Sólida FERRAMENTAS".
// Quem lê o grupo (só leitura) preenche dados/json/ferramentas-checklist.json — ver docs/contrato-agentes.md.

import { html, data as fmtData } from '../formato.js';
import { hojeISO, inicioDaSemana, somarDias } from '../datas.js';

export const LOCAIS_FIXOS = ['Estoque', 'Carro do Anderson', 'Carro do Nascimento', 'Carro do Enio'];
const SEMANAS = 4; // a atual + as 3 anteriores (bolinhas do histórico)
const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^carro\s+(do|da|de)?\s*/, 'carro ').replace(/\s+/g, ' ').trim();
const diaCurto = (iso) => `${DIA[new Date(`${iso}T12:00:00`).getDay()]} ${fmtData(iso).slice(0, 5)}`;

// Estado de um local numa semana (ini = segunda-feira): ok | atraso | espera | nao | nv
function estadoDaSemana(regs, ini, hoje, verificadoEm, inicio) {
  if (inicio && ini < inicioDaSemana(inicio)) return { cod: 'sem', reg: null }; // antes de o controle começar
  const quarta = somarDias(ini, 2);
  const dela = regs.filter((r) => r.enviadoEm >= ini && r.enviadoEm <= somarDias(ini, 6)).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
  if (dela) return { cod: dela.enviadoEm <= quarta ? 'ok' : 'atraso', reg: dela };
  if (hoje <= quarta) return { cod: 'espera', reg: null };
  const lido = String(verificadoEm || '').slice(0, 10);
  return { cod: lido >= quarta ? 'nao' : 'nv', reg: null };
}
const ROTULO = {
  ok: '✓ Enviada no prazo', atraso: '⚠ Enviada com atraso', espera: 'Aguardando (até quarta)',
  nao: '✕ Não enviada', nv: 'Ainda não verificado', sem: 'Controle ainda não existia',
};

export function locaisDoChecklist(CFG, visiveis) {
  const obras = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o) && (!visiveis || visiveis.includes(o)));
  return [...obras, ...(visiveis ? [] : LOCAIS_FIXOS)];
}

export function cartoes(CFG, dados, visiveis = null) {
  const hoje = hojeISO();
  const regsTodos = (dados && Array.isArray(dados.registros) ? dados.registros : []).filter((r) => r && r.local && /^\d{4}-\d{2}-\d{2}$/.test(String(r.enviadoEm || '')));
  const verificadoEm = dados && dados.verificadoEm;
  const inicio = dados && dados.inicio;
  const ini = inicioDaSemana(hoje);
  const semanas = Array.from({ length: SEMANAS }, (_, i) => somarDias(ini, -7 * (SEMANAS - 1 - i))); // da mais antiga para a atual
  const locais = locaisDoChecklist(CFG, visiveis);
  const card = (local) => {
    const regs = regsTodos.filter((r) => chave(r.local) === chave(local));
    const hist = semanas.map((s) => ({ s, ...estadoDaSemana(regs, s, hoje, verificadoEm, inicio) }));
    const atual = hist[hist.length - 1];
    const ultimo = [...regs].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))[0];
    const sub = atual.reg ? `${atual.reg.por ? `${atual.reg.por}, ` : ''}${diaCurto(atual.reg.enviadoEm)}${atual.reg.hora ? `, ${atual.reg.hora}` : ''}`
      : atual.cod === 'espera' ? `prazo: ${diaCurto(somarDias(ini, 2))}`
        : ultimo ? `última enviada: ${diaCurto(ultimo.enviadoEm)}` : 'nenhuma enviada até agora';
    return html`<div class="ob-card fc-card fc-${atual.cod}">
      <span class="ob-topo"><b class="ob-cod">${local}</b></span>
      <span class="fc-situacao">${ROTULO[atual.cod]}</span>
      <span class="ob-sub">${sub}</span>
      <span class="fc-hist" title="Últimas semanas, da mais antiga para a atual">${hist.map((h) => html`<i class="fc-b fc-${h.cod}" title="Semana de ${fmtData(h.s).slice(0, 5)}: ${ROTULO[h.cod]}"></i>`)}</span>
    </div>`;
  };
  const nOk = locais.filter((l) => { const r = regsTodos.filter((x) => chave(x.local) === chave(l)); return ['ok', 'atraso'].includes(estadoDaSemana(r, ini, hoje, verificadoEm, inicio).cod); }).length;
  const lido = verificadoEm ? `Grupos lidos em ${fmtData(String(verificadoEm).slice(0, 10))}${String(verificadoEm).length > 10 ? `, ${String(verificadoEm).slice(11, 16)}` : ''}` : 'Os grupos ainda não foram lidos para este controle';
  return html`<section class="ob-sec">
    <div class="painel-h"><h2>Planilha de ferramentas obrigatórias</h2><p>Enviada toda quarta-feira no grupo do WhatsApp (Anderson) · ${nOk} de ${locais.length} desta semana · ${lido}</p></div>
    <div class="ob-cards">${locais.map(card)}</div>
    <p class="legenda-semana"><span class="fc-b fc-ok"></span> no prazo <span class="fc-b fc-atraso"></span> com atraso <span class="fc-b fc-nao"></span> não enviada <span class="fc-b fc-nv"></span> não verificado <span class="fc-b fc-espera"></span> ainda no prazo · bolinhas: últimas 4 semanas</p>
  </section>`;
}
