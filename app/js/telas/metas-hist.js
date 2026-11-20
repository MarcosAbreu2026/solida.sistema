// Planejamento › Metas das últimas 4 semanas: o que foi meta, o que foi atingido, o que não foi e POR QUÊ.
// Fonte: CFG.metasSemanais (produtividade.json, escrito pelo agente que lê as metas semanais do Drive e os relatórios dos grupos de WhatsApp).
// Item: estado "ok" (concluído) · "parcial" (avançou) · "nao" (sem avanço). Causa: campo "causa" do item (uma das MOTIVOS), senão o motivo
// registrado nos relatórios diários da semana, senão deduzida do comentário (marcada como "deduzida"); sem nada disso: "Sem justificativa".
import { html } from '../formato.js';
import * as pd from './painel-dep.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { programacoes } from '../programacao.js';
import { MOTIVOS, obrasIgnoradas } from './produtividade.js';

const N_SEMANAS = 4;
const SEM_CAUSA = 'Sem justificativa';
const norm = (s) => String(s || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// causa escrita por extenso → uma das categorias da lista
const categoria = (txt) => { const t = norm(txt); return MOTIVOS.find((m) => norm(m) === t) || MOTIVOS.find((m) => t.startsWith(norm(m))) || 'Outro'; };

// dedução pelo comentário (só quando ninguém registrou a causa); regras simples e conservadoras
const DEDUCOES = [
  [/n[ãa]o chegou|n[ãa]o chegaram|n[ãa]o entregue|aguardando (material|entrega|compra)|falta de material|sem material|atras(o|ou) (na )?entrega/i, 'Falta de material'],
  [/falta de (equipe|efetivo|gente|m[ãa]o de obra)|sem (equipe|efetivo)|repor efetivo|equipe reduzida|n[ãa]o veio|faltou/i, 'Falta de mão de obra'],
  [/chuva|clima|temporal/i, 'Chuva / clima'],
  [/adiad[oa]s?|mudan[çc]a de prioridade|reprogramad/i, 'Mudança de prioridade'],
  [/depende de|aguarda (o|a)? ?(terceiro|fornecedor|cliente|outra equipe)|liberad[oa] pel/i, 'Serviço dependia de outra equipe'],
];

function causaDo(CFG, obra, semana, it) {
  const direta = it.causa || it.motivo;
  if (direta) return { cat: categoria(direta), txt: String(direta), origem: 'meta' };
  const regs = ((CFG && CFG.whats) || []).filter((r) => r.obra === obra && r.data >= semana.ini && r.data <= semana.fim);
  const alvo = norm(it.item);
  for (const r of regs) {
    const x = (r.itens || []).find((y) => y.motivo && (norm(y.item) === alvo || norm(y.item).includes(alvo) || alvo.includes(norm(y.item))));
    if (x) return { cat: categoria(x.motivo), txt: x.motivo, origem: 'relatório diário' };
  }
  const d = DEDUCOES.find(([re]) => re.test(it.obs || ''));
  if (d) return { cat: d[1], txt: d[1], origem: 'deduzida do comentário' };
  return { cat: SEM_CAUSA, txt: SEM_CAUSA, origem: '' };
}

const fmtQtd = (it) => (it.meta == null ? (it.estado === 'ok' ? 'feito' : '—') : `${it.feito ?? 0} de ${it.meta}${it.un ? ` ${it.un}` : ''}`);
const ROT_ESTADO = { ok: ['ok', 'Concluído'], parcial: ['atencao', 'Avançou'], nao: ['critico', 'Sem avanço'] };

// o que o quadro mostra: últimas 4 semanas (já começadas), por obra, com contagem e causa de cada meta não atingida
export function analiseMetas(CFG, hoje = hojeISO()) {
  const todas = ((CFG && CFG.metasSemanais && CFG.metasSemanais.semanas) || []).filter((s) => s.ini <= hoje).sort((a, b) => b.ini.localeCompare(a.ini)).slice(0, N_SEMANAS);
  const ignoradas = obrasIgnoradas(CFG);
  const semanas = todas.map((s) => {
    const obras = (s.obras || []).filter((o) => !ignoradas.includes(o.obra)).map((o) => {
      const itens = (o.itens || []).map((it) => ({ it, causa: it.estado === 'ok' ? null : causaDo(CFG, o.obra, s, it) }));
      const cont = (e) => itens.filter((x) => x.it.estado === e).length;
      const total = Math.max(o.tipo === 'pendencias' ? (o.total || 0) : 0, itens.length);
      return { obra: o.obra, tipo: o.tipo, semLeitura: !!o.semLeitura, lacunas: o.lacunas || [], itens, total, ok: cont('ok'), parcial: cont('parcial'), nao: cont('nao'), semRegistro: Math.max(0, total - itens.length) };
    });
    return { ini: s.ini, fim: s.fim, obras };
  });
  const contadas = semanas.flatMap((s) => s.obras.filter((o) => !o.semLeitura).map((o) => ({ s, o })));
  const naoAtingidas = contadas.flatMap(({ s, o }) => o.itens.filter((x) => x.it.estado !== 'ok').map((x) => ({ semana: s, obra: o.obra, ...x })));
  const causas = new Map();
  for (const x of naoAtingidas) causas.set(x.causa.cat, (causas.get(x.causa.cat) || 0) + 1);
  const total = contadas.reduce((t, { o }) => t + o.total, 0);
  const ok = contadas.reduce((t, { o }) => t + o.ok, 0);
  const parcial = contadas.reduce((t, { o }) => t + o.parcial, 0);
  return { semanas, naoAtingidas, causas, totais: { total, ok, parcial, nao: contadas.reduce((t, { o }) => t + o.nao, 0), semRegistro: contadas.reduce((t, { o }) => t + o.semRegistro, 0), semJustificativa: causas.get(SEM_CAUSA) || 0 } };
}

export function render({ CFG, params, hoje = hojeISO() }) {
  const a = analiseMetas(CFG, hoje);
  if (!a.semanas.length) return html`${pd.pergunta('As metas das obras foram atingidas nas últimas 4 semanas? Se não, por quê?', 'Pergunta da aba')}${metasAdiante(CFG, hoje).html}${pd.aviso('Ainda não há metas semanais lidas pelo agente (metasSemanais). Quando o agente gravar as metas e os relatórios, o histórico aparece aqui.', 'atencao')}`;
  const t = a.totais;
  const pctExec = t.total ? Math.round(((t.ok + t.parcial) / t.total) * 100) : null;
  const filtroObra = params && params.get('obra');
  const obras = [...new Set(a.semanas.flatMap((s) => s.obras.map((o) => o.obra)))].sort();

  const cartoes = pd.cartoes([
    { rotulo: 'Metas nas 4 semanas', valor: String(t.total), sub: `${a.semanas.length} ${a.semanas.length === 1 ? 'semana lida' : 'semanas lidas'} · ${obras.length} obras` },
    { rotulo: 'Com execução', valor: pctExec == null ? '—' : `${pctExec}%`, nivel: pctExec == null ? '' : pctExec >= 80 ? 'ok' : pctExec >= 60 ? 'atencao' : 'critico', sub: `${t.ok} concluídas + ${t.parcial} avançaram` },
    { rotulo: 'Sem avanço', valor: String(t.nao), nivel: t.nao ? 'critico' : 'ok', sub: 'meta que não andou' },
    { rotulo: 'Sem justificativa', valor: String(t.semJustificativa), nivel: t.semJustificativa ? 'atencao' : 'ok', sub: 'não atingidas sem causa registrada' },
  ]);

  // semana a semana
  const porSemana = pd.tabela(['Semana', 'Metas', 'Concluídas', 'Avançaram', 'Sem avanço', 'Sem registro', 'Com execução', 'Sem leitura'],
    a.semanas.map((s) => {
      const lidas = s.obras.filter((o) => !o.semLeitura);
      const soma = (k) => lidas.reduce((n, o) => n + o[k], 0); const tot = soma('total'); const ok = soma('ok'); const pa = soma('parcial');
      const sem = s.obras.filter((o) => o.semLeitura).map((o) => o.obra);
      return [html`<b>${dm(s.ini)} a ${dm(s.fim)}</b>`, tot, ok, pa, soma('nao'), soma('semRegistro') || '—', tot ? pd.barraCel((ok + pa) / tot) : '—', sem.join(', ') || '—'];
    }));

  // obra × semana
  const celula = (s, cod) => {
    const o = s.obras.find((x) => x.obra === cod);
    if (!o) return html`<span class="pd-traco">—</span>`;
    if (o.semLeitura) return html`<span class="pd-def">sem leitura</span>`;
    if (!o.total) return html`<span class="pd-obra-sub">${o.tipo === 'pendencias' ? 'só pendências' : 'sem meta'}</span>`;
    const p = (o.ok + o.parcial) / o.total;
    return html`${pd.selo(p >= 0.8 ? 'ok' : p >= 0.6 ? 'atencao' : 'critico', `${Math.round(p * 100)}%`)}<span class="pd-obra-sub">${[plural(o.ok, 'concluída', 'concluídas'), plural(o.parcial, 'avançou', 'avançaram'), `${o.nao} sem avanço`, o.semRegistro ? `${o.semRegistro} sem registro` : ''].filter(Boolean).join(' · ')}</span>`;
  };
  const porObra = pd.tabela(['Obra', ...a.semanas.map((s) => `${dm(s.ini)} a ${dm(s.fim)}`)], obras.map((cod) => [pd.obraCel(cod, '', `#/planejamento/metas?obra=${encodeURIComponent(cod)}`), ...a.semanas.map((s) => celula(s, cod))]), { vazio: 'Nenhuma obra com meta lida.' });

  // causas
  const lista = [...a.causas].sort((x, y) => y[1] - x[1]);
  const max = Math.max(1, ...lista.map((c) => c[1]));
  const naoAt = a.naoAtingidas.length;
  const causasTab = pd.tabela(['Causa', 'Metas não atingidas', ''], lista.map(([cat, n]) => [
    cat === SEM_CAUSA ? html`<b class="pd-cr">${cat}</b>` : html`<b>${cat}</b>`, n, pd.barraCel(n / max, `${Math.round((n / naoAt) * 100)}%`),
  ]), { vazio: 'Nenhuma meta deixou de ser atingida.' });

  // metas não atingidas, uma a uma
  const filtradas = a.naoAtingidas.filter((x) => !filtroObra || x.obra === filtroObra).sort((x, y) => y.semana.ini.localeCompare(x.semana.ini) || x.obra.localeCompare(y.obra) || (x.it.estado === 'nao' ? 0 : 1) - (y.it.estado === 'nao' ? 0 : 1));
  const detalhe = pd.tabela(['Semana', 'Obra', 'Meta', 'Feito', 'Situação', 'Causa', 'Comentário'], filtradas.slice(0, 120).map((x) => [
    dm(x.semana.ini), pd.obraCel(x.obra), x.it.item, fmtQtd(x.it), pd.selo(...ROT_ESTADO[x.it.estado] || ['', x.it.estado]),
    x.causa.cat === SEM_CAUSA ? html`<b class="pd-cr">${SEM_CAUSA}</b>` : html`<b>${x.causa.cat}</b>${x.causa.origem && x.causa.origem !== 'meta' ? html`<span class="pd-obra-sub">${x.causa.origem}</span>` : ''}`,
    x.it.obs || '',
  ]), { vazio: 'Nenhuma meta deixou de ser atingida neste filtro.' });
  const filtros = html`<div class="fo-nav"><b>Detalhe:</b> <a class="botao${filtroObra ? '' : ' on'}" href="#/planejamento/metas">Todas as obras</a>${obras.map((o) => html`<a class="botao${filtroObra === o ? ' on' : ''}" href="#/planejamento/metas?obra=${encodeURIComponent(o)}">${o}</a>`)}</div>`;

  const lacunas = a.semanas.flatMap((s) => s.obras.flatMap((o) => (o.lacunas || []).map((l) => `${o.obra} (${dm(s.ini)}): ${l}`)));
  const avisos = [
    t.semJustificativa ? `${plural(t.semJustificativa, 'meta não atingida está', 'metas não atingidas estão')} sem causa registrada. O responsável da obra ou o agente precisa informar o motivo (lista abaixo).` : '',
    a.semanas.length < N_SEMANAS ? `O sistema só tem ${plural(a.semanas.length, 'semana lida', 'semanas lidas')} das ${N_SEMANAS} pedidas; o histórico completo aparece conforme as semanas forem sendo lidas.` : '',
    'Causa = a registrada na meta; se não houver, a dos relatórios diários; se não houver, deduzida do comentário (marcada como "deduzida do comentário"). Comentário que não indica causa fica "Sem justificativa".',
    ...lacunas.slice(0, 6),
  ].filter(Boolean);

  return html`${pd.pergunta('As metas das obras foram atingidas nas últimas 4 semanas? Se não, por quê?', 'Pergunta da aba')}
    ${metasAdiante(CFG, hoje).html}
    ${cartoes}
    ${avisos.length ? pd.caixa('Atenção', pd.itens(avisos)) : ''}
    ${pd.secao('Semana a semana', 'Concluída = meta batida · Avançou = andou mas não fechou · Sem avanço = não andou', porSemana)}
    ${pd.secao('Por obra', 'Percentual com execução (concluídas + avançaram) sobre o total de metas da obra na semana', porObra)}
    ${pd.secao('Por que não foi atingido', 'Causa das metas que não fecharam, nas últimas 4 semanas: problema de execução (material, mão de obra) ou de planejamento', causasTab)}
    ${pd.secao('Metas não atingidas, uma a uma', filtroObra ? `Só ${filtroObra}` : `As ${Math.min(120, filtradas.length)} mais recentes${filtradas.length > 120 ? ` de ${filtradas.length}` : ''}`, html`${filtros}${detalhe}`)}`;
}

// Metas das PRÓXIMAS 4 semanas (esta e as 3 seguintes): o que já está lançado e o que FALTA lançar (pedido do Marcos, 20/11/2026)
export function metasAdiante(CFG, hoje) {
  const seg0 = inicioDaSemana(hoje);
  const semanas = [0, 1, 2, 3].map((i) => somarDias(seg0, i * 7));
  const plan = ((CFG && CFG.areas) || []).find((x) => x.id === 'planejamento') || {};
  const obras = [...new Set([...(plan.porObra || []).map((o) => o.obra), ...((CFG && CFG.metasSemanais && CFG.metasSemanais.semanas) || []).filter((s) => semanas.includes(s.ini)).flatMap((s) => (s.obras || []).map((o) => o.obra))])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const lidas = ((CFG && CFG.metasSemanais && CFG.metasSemanais.semanas) || []);
  const progs = programacoes(CFG);
  const info = (obra, ini) => {
    const s = lidas.find((x) => x.ini === ini); const o = s && (s.obras || []).find((x) => x.obra === obra);
    const n = o ? (o.itens || []).filter((i) => i.item).length : 0;
    if (n) return { ok: true, txt: `${n} meta${n > 1 ? 's' : ''}`, fonte: 'metas da semana' };
    if (o && o.tipo === 'pendencias') return { ok: true, txt: 'só pendências', fonte: 'fase final' };
    const p = progs.find((x) => x.obra === obra); const sp = p && (p.semanas || []).find((x) => x.inicio === ini);
    const m = sp ? (sp.naSemana || []).length : 0;
    if (m) return { ok: true, txt: `${m} item(ns) da programação`, fonte: 'programação' };
    return { ok: false };
  };
  const tabela = obras.map((obra) => [pd.obraCel(obra), ...semanas.map((ini) => { const x = info(obra, ini); return x.ok ? pd.selo('ok', x.txt) : pd.selo(ini === semanas[1] || ini === semanas[0] ? 'critico' : 'atencao', 'falta lançar'); })]);
  const faltaProx = obras.filter((o) => !info(o, semanas[1]).ok);
  return { semanas, obras, tabela, faltaProx, html: html`${faltaProx.length ? pd.aviso(`Faltam as metas da PRÓXIMA semana (${dm(semanas[1])} a ${dm(somarDias(semanas[1], 4))}) em ${faltaProx.length} obra(s): ${faltaProx.join(', ')}. O prazo do planejamento é quinta ou sexta de manhã.`, 'atencao') : pd.aviso(`Metas da próxima semana (${dm(semanas[1])}) lançadas em todas as obras.`, 'info')}
    ${pd.secao('Metas das próximas 4 semanas', 'Esta semana e as 3 seguintes · "falta lançar" = a obra ainda não tem meta nem programação lida do Drive para a semana', pd.tabela(['Obra', ...semanas.map((s, i) => `${i === 0 ? 'Esta semana · ' : ''}${dm(s)} a ${dm(somarDias(s, 4))}`)], tabela, { vazio: 'Nenhuma obra no planejamento.' }))}` };
}
