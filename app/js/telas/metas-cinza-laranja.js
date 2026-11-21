// Planejamento › Metas: blocos do pedido do Marcos (20/11/2026) — histórico das 4 semanas ANTERIORES obra a obra separando cinza (Sólida) de laranja
// (terceiros), apanhado geral cinza × laranja e o quadro das obras com encarregado (houve registro? lançou e não bateu a meta? teve justificativa?).
// Recebe a análise de metas-hist.js (analiseMetas): semanas[].obras[].itens[] = { it, tipo, causa }.
import { html } from '../formato.js';
import * as pd from './painel-dep.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { listaConfig } from '../config.js';

const SEM_CAUSA = 'Sem justificativa';
const TIPOS = [['cinza', 'Cinza · Sólida'], ['laranja', 'Laranja · terceiros']];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const fmtQtd = (it) => (it.meta == null ? (it.estado === 'ok' ? 'feito' : '—') : `${it.feito ?? 0} de ${it.meta}${it.un ? ` ${it.un}` : ''}`);
const ROT_ESTADO = { parcial: ['atencao', 'Avançou'], nao: ['critico', 'Sem avanço'] };

const contaTipo = (o, tipo) => {
  const l = o.itens.filter((x) => x.tipo === tipo);
  const c = (e) => l.filter((x) => x.it.estado === e).length;
  return { total: l.length, ok: c('ok'), parcial: c('parcial'), nao: c('nao'), semJust: l.filter((x) => x.it.estado !== 'ok' && x.causa && x.causa.cat === SEM_CAUSA).length };
};
const somaTipo = (lista) => lista.reduce((t, c) => ({ total: t.total + c.total, ok: t.ok + c.ok, parcial: t.parcial + c.parcial, nao: t.nao + c.nao, semJust: t.semJust + c.semJust }), { total: 0, ok: 0, parcial: 0, nao: 0, semJust: 0 });
const nivelDe = (p) => (p >= 0.8 ? 'ok' : p >= 0.6 ? 'atencao' : 'critico');
const celTipo = (c) => {
  if (!c.total) return html`<span class="pd-traco">—</span>`;
  const p = (c.ok + c.parcial) / c.total;
  return html`${pd.selo(nivelDe(p), `${c.ok} de ${c.total} atingida(s)`)}<span class="pd-obra-sub">${c.parcial} avançou · ${c.nao} sem avanço${c.semJust ? ` · ${c.semJust} sem justificativa` : ''}</span>`;
};

// cada obra: as semanas, cinza × laranja, o que foi atingido e o que não foi (com a causa)
export function historicoPorObra(a) {
  const obras = [...new Set(a.semanas.flatMap((s) => s.obras.map((o) => o.obra)))].sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true }));
  if (!obras.length) return html`<p class="pd-vazio">Nenhuma obra com meta lida nas últimas 4 semanas.</p>`;
  return html`${obras.map((cod) => {
    const linhas = a.semanas.map((s) => ({ s, o: s.obras.find((x) => x.obra === cod) }));
    const tot = somaTipo(linhas.filter((l) => l.o && !l.o.semLeitura).flatMap((l) => TIPOS.map(([t]) => contaTipo(l.o, t))));
    const semLeit = html`<span class="pd-def">sem leitura</span>`;
    return html`<details class="caixa" ${tot.nao || tot.semJust ? html.seguro('open') : ''}><summary><span class="caixa-tit">${cod}</span><span class="pequeno">${tot.total ? `${tot.ok} de ${tot.total} metas atingidas${tot.nao ? ` · ${tot.nao} sem avanço` : ''}` : 'sem meta com quantidade lida'}</span></summary>
      <div style="padding:6px 18px 14px">${pd.tabela(['Semana', ...TIPOS.map((t) => t[1])], linhas.map(({ s, o }) => [html`<b>${dm(s.ini)} a ${dm(s.fim)}</b>`, ...TIPOS.map(([t]) => (!o || o.semLeitura ? semLeit : celTipo(contaTipo(o, t))))]), { vazio: '' })}
      ${linhas.filter((l) => l.o && l.o.itens.length).map(({ s, o }) => html`<details class="caixa"><summary><span class="caixa-tit">${dm(s.ini)} a ${dm(s.fim)}: meta por meta</span><span class="pequeno">${o.itens.length} meta(s)</span></summary>
        <div style="padding:6px 18px 12px">${pd.tabela(['Tipo', 'Meta', 'Feito', 'Situação', 'Causa se não atingiu'], [...o.itens].sort((x, y) => x.tipo.localeCompare(y.tipo)).map((x) => [x.tipo === 'laranja' ? pd.selo('atencao', 'Laranja') : pd.selo('', 'Cinza'), x.it.item, fmtQtd(x.it), x.it.estado === 'ok' ? pd.selo('ok', 'Atingida') : pd.selo(...(ROT_ESTADO[x.it.estado] || ['', 'Não atingida'])), x.causa ? (x.causa.cat === SEM_CAUSA ? html`<b class="pd-cr">${SEM_CAUSA}</b>` : html`<b>${x.causa.cat}</b>`) : '']), { vazio: '' })}</div></details>`)}</div></details>`;
  })}`;
}

// apanhado geral: cinza × laranja, todas as obras
export function apanhadoGeral(a) {
  const lidas = (s) => s.obras.filter((o) => !o.semLeitura);
  const linhaTipo = (nome, comps) => { const c = somaTipo(comps); const p = c.total ? (c.ok + c.parcial) / c.total : null; return [html`<b>${nome}</b>`, c.total, c.ok, c.parcial, c.nao, c.semJust || '—', p == null ? '—' : pd.barraCel(p)]; };
  const geral = TIPOS.map(([t, nome]) => linhaTipo(nome, a.semanas.flatMap((s) => lidas(s).map((o) => contaTipo(o, t)))));
  geral.push(linhaTipo('Total', a.semanas.flatMap((s) => lidas(s).flatMap((o) => TIPOS.map(([t]) => contaTipo(o, t))))));
  const porSem = a.semanas.map((s) => [html`<b>${dm(s.ini)} a ${dm(s.fim)}</b>`, ...TIPOS.map(([t]) => { const c = somaTipo(lidas(s).map((o) => contaTipo(o, t))); const p = c.total ? (c.ok + c.parcial) / c.total : null; return p == null ? '—' : html`${pd.selo(nivelDe(p), `${Math.round(p * 100)}%`)}<span class="pd-obra-sub">${c.ok} de ${c.total} atingida(s)</span>`; })]);
  return html`${pd.tabela(['', 'Metas', 'Atingidas', 'Avançaram', 'Sem avanço', 'Sem justificativa', 'Com execução'], geral, { vazio: '' })}
    <div style="margin-top:14px">${pd.tabela(['Semana', ...TIPOS.map((t) => t[1])], porSem, { vazio: '' })}</div>
    <p class="pequeno" style="margin-top:6px">Cinza = serviço que a Sólida executa; laranja = terceiro/fornecedor. A classificação usa o escopo e o orçamento da obra e a planilha de terceirizados (não só a cor da fase). "Com execução" = atingidas + avançaram.</p>`;
}

// obras com encarregado: nas 4 semanas anteriores, houve registro? lançou e não bateu a meta? teve justificativa?
export const ENCARREGADO_PADRAO = ['Mo358', 'Mo531', 'Mo602', 'Mo581'];
export function encarregados(CFG, a, hoje = hojeISO()) {
  const rh = (CFG && (CFG.funcionariosRH || CFG.funcionarios)) || [];
  const cod0 = (x) => String(x || '').replace(/\s.*$/, '');
  const daRH = rh.filter((f) => /encarreg/i.test(f.funcao || '')).map((f) => cod0(f.obra)).filter((o) => /^mo\d+/i.test(o));
  const cfgLista = listaConfig('obras.com-encarregado') || [];
  const obras = [...new Set([...(cfgLista.length ? cfgLista : ENCARREGADO_PADRAO), ...daRH])].sort((x, y) => x.localeCompare(y, 'pt-BR', { numeric: true }));
  const seg0 = inicioDaSemana(hoje);
  const semanas = [1, 2, 3, 4].map((i) => { const ini = somarDias(seg0, -7 * i); return { ini, fim: somarDias(ini, 4) }; });
  const celula = (cod, s) => {
    const sa = a.semanas.find((x) => x.ini === s.ini); const o = sa && sa.obras.find((x) => x.obra === cod);
    const regs = ((CFG && CFG.whats) || []).filter((r) => r.obra === cod && r.data >= s.ini && r.data <= s.fim && (r.relatorio || (r.itens || []).length));
    const dias = new Set(regs.map((r) => r.data)).size;
    if (!o && !dias) return { nivel: 'critico', rot: 'Sem registro', sub: 'nenhum relatório do grupo nem meta lida na semana' };
    if (!o) return { nivel: 'atencao', rot: 'Registro sem meta lida', sub: `${dias} dia(s) com relatório; sem meta com quantidade para comparar` };
    if (o.semLeitura) return { nivel: 'atencao', rot: 'Sem leitura', sub: 'o agente ainda não leu o grupo desta semana' };
    const lancada = o.itens.some((x) => x.it.feito != null && x.it.feito !== 0 && x.it.feito !== false) || dias > 0;
    const naoAt = o.itens.filter((x) => x.it.estado !== 'ok');
    if (!lancada) return { nivel: 'critico', rot: 'Sem registro', sub: `nada lançado${o.total ? ` · ${o.total} meta(s) da semana` : ''}` };
    if (!o.total) return { nivel: 'atencao', rot: 'Registro sem meta', sub: `${dias} dia(s) com relatório` };
    if (!naoAt.length) return { nivel: 'ok', rot: 'Meta atingida', sub: `${o.ok} de ${o.total} · ${dias} dia(s) com relatório` };
    const com = naoAt.filter((x) => x.causa && x.causa.cat !== SEM_CAUSA);
    const causas = [...new Set(com.map((x) => x.causa.cat))].slice(0, 3).join(', ');
    return { nivel: com.length === naoAt.length ? 'atencao' : 'critico', rot: 'Lançou, meta não atingida', sub: `${naoAt.length} meta(s) não atingida(s) · ${com.length ? `com justificativa em ${com.length}${causas ? ` (${causas})` : ''}` : 'SEM justificativa'}${com.length && com.length < naoAt.length ? ` · ${naoAt.length - com.length} sem` : ''}` };
  };
  const nomes = (cod) => rh.filter((f) => /encarreg/i.test(f.funcao || '') && cod0(f.obra).toLowerCase() === cod.toLowerCase()).map((f) => String(f.nome).split(' (')[0]).join(', ');
  const linhas = obras.map((cod) => [pd.obraCel(cod), nomes(cod) || html`<span class="pd-def">[encarregado]</span>`, ...semanas.map((s) => { const c = celula(cod, s); return html`${pd.selo(c.nivel, c.rot)}<span class="pd-obra-sub">${c.sub}</span>`; })]);
  return pd.tabela(['Obra', 'Encarregado', ...semanas.map((s) => `${dm(s.ini)} a ${dm(s.fim)}`)], linhas, { vazio: 'Nenhuma obra com encarregado.' });
}
