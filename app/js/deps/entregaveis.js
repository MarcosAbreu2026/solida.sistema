// Quadro de entregáveis (pedido do Marcos, 20/11/2026): uma linha por obra em andamento, uma coluna por documento
// que o gestor de obra deve entregar. Célula: ✓ em dia (com a data do último item) · ✕ faltando/atrasado · "não lido" quando
// o sistema ainda não lê aquela fonte. Nada é inventado: sem fonte, a célula diz "não lido".
//   Diário de obra ....... relato do dia no grupo (programação do WhatsApp) ou arquivo em GERENCIAMENTO\DIARIO DE OBRA
//   Programação semanal .. planilha da pasta da obra (projetos.json › programacao.planilha) — semana atual e próxima
//   Pendências de obra ... arquivo em GERENCIAMENTO\PENDENCIAS (evidencias.json, data de modificação)
//   As-built ............. .dwg em PROJETO\AS BUILT (projetos.json › asbuilt)
//   Ata de reunião ....... ata arquivada no Drive (tabela atas) ou arquivo em GERENCIAMENTO\ATA (evidências), últimos 7 dias
//   Medição .............. só o texto do agente de Operação (ainda não há leitura da pasta de medições do Drive)
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import * as oc from './obras-comum.js';
import { somarDias } from '../datas.js';
import { proximoUtil } from '../dia-foco.js';
import { programacaoDaObra } from '../telas/prog-obra.js';

const DIAS_ATA = 7;          // ata de reunião: uma por semana
const DIAS_PENDENCIAS = 7;   // pendências de obra: atualizadas na semana
const dia = (q) => String(q || '').slice(0, 10);

// célula = { nivel: 'ok' | 'critico' | 'nl' | 'na', data, nota }
const ok = (data, nota = '') => ({ nivel: 'ok', data, nota });
const falta = (nota, data = '') => ({ nivel: 'critico', data, nota });
const naoLido = (nota) => ({ nivel: 'nl', nota });
const naoSeAplica = (nota) => ({ nivel: 'na', nota });

const maisRecente = (datas) => datas.filter(Boolean).sort().slice(-1)[0] || '';

function diario(ctx, cod, ev) {
  const p = oc.progDa(ctx, cod);
  const regs = ((p && p.registros) || []).filter((r) => r.relatorio).map((r) => r.data);
  const arq = (ev || []).filter((e) => e.tipo === 'diario' && oc.mesmaObra(e.obra, cod)).map((e) => dia(e.quando));
  if (!p && !ev) return naoLido('grupo da obra e pasta do diário ainda não lidos');
  const ultimo = maisRecente([...regs, ...arq]);
  const exigido = proximoUtil(ctx.hoje, -1, cod);   // último dia útil antes de hoje
  if (!ultimo) return falta('nenhum relato lido');
  return ultimo >= exigido ? ok(ultimo) : falta(`faltou desde ${pd.dm(exigido)}`, ultimo);
}

function programacao(ctx, cod, p, qual) {
  if (!ctx.drive || !ctx.drive.projetos) return naoLido('projetos do Drive não lidos');
  if (!p) return naoLido('pasta da obra sem leitura');
  const pr = programacaoDaObra(p, ctx.hoje);
  if (pr.emFase) return naoSeAplica('obra em fase de pendências');
  if (!pr.planilha) return falta('sem planilha na pasta');
  if (pr.planilha.erro) return naoLido('planilha não pôde ser lida');
  const linhas = qual === 'atual' ? pr.atual : pr.proxima;
  const datas = linhas.map((l) => l.data);
  if (datas.length) return ok(maisRecente(datas), `${pr.semana || ''}`.trim());
  if (qual === 'proxima' && ctx.hoje < somarDias(pr.ini, 3)) return naoSeAplica('prazo: quinta ou sexta');
  return falta(qual === 'atual' ? 'sem tarefas nesta semana' : 'ainda não está na pasta', pr.ultima);
}

function pendencias(ctx, cod, ev) {
  if (!ev || !ev.length) return naoLido('pasta de pendências ainda não lida');
  const d = maisRecente(ev.filter((e) => e.tipo === 'pendencias' && oc.mesmaObra(e.obra, cod)).map((e) => dia(e.quando)));
  if (!d) return falta('sem arquivo na pasta (últimos 120 dias)');
  return d >= somarDias(ctx.hoje, -DIAS_PENDENCIAS) ? ok(d) : falta(`desatualizada há ${Math.round((new Date(ctx.hoje) - new Date(d)) / 86400000)} dias`, d);
}

function asbuilt(ctx, cod, p) {
  if (!ctx.drive || !ctx.drive.projetos) return naoLido('projetos do Drive não lidos');
  if (!p) return naoLido('pasta da obra sem leitura');
  const l = (p.asbuilt || []).filter((x) => !x.antigo);
  return l.length ? ok(maisRecente(l.map((x) => dia(x.data))), `${l.length} arquivo${l.length > 1 ? 's' : ''} .dwg`) : falta('sem .dwg na pasta As Built');
}

function ata(ctx, cod, ev, atasLista) {
  if (!atasLista && !(ev && ev.length)) return naoLido('atas e pasta de atas ainda não lidas');
  const doSistema = (atasLista || []).filter((a) => a.obra && oc.mesmaObra(a.obra, cod) && a.arquivada_em).map((a) => dia(a.data));
  const daPasta = (ev || []).filter((e) => e.tipo === 'ata' && oc.mesmaObra(e.obra, cod)).map((e) => dia(e.quando));
  const d = maisRecente([...doSistema, ...daPasta]);
  if (!d) return falta('nenhuma ata salva no Drive');
  return d >= somarDias(ctx.hoje, -DIAS_ATA) ? ok(d) : falta(`última há ${Math.round((new Date(ctx.hoje) - new Date(d)) / 86400000)} dias`, d);
}

function medicao(ctx, cod) {
  const m = oc.medicao(ctx, cod);
  if (m.status === 'ok') return ok('', 'segundo o agente');
  if (m.status === 'nao') return falta(m.texto);
  return naoLido('pasta de medições do Drive ainda não lida');
}

export const COLUNAS = [['diario', 'Diário de obra'], ['progAtual', 'Programação · semana atual'], ['progProx', 'Programação · próxima semana'],
  ['pendencias', 'Pendências de obra'], ['asbuilt', 'As-built'], ['ata', 'Ata de reunião (7 dias)'], ['medicao', 'Medição']];

// calcula as células de uma obra
export function entregaveisDaObra(ctx, cod, { eventos = null, atas = null } = {}) {
  const p = oc.projetoDa(ctx, cod);
  return {
    diario: diario(ctx, cod, eventos), progAtual: programacao(ctx, cod, p, 'atual'), progProx: programacao(ctx, cod, p, 'proxima'),
    pendencias: pendencias(ctx, cod, eventos), asbuilt: asbuilt(ctx, cod, p), ata: ata(ctx, cod, eventos, atas), medicao: medicao(ctx, cod),
  };
}

const celula = (c) => {
  const sub = [c.data ? pd.dma(c.data) : '', c.nota].filter(Boolean).join(' · ');
  const corpo = c.nivel === 'ok' ? pd.selo('ok', c.data ? pd.dm(c.data) : 'em dia')
    : c.nivel === 'critico' ? pd.selo('critico', c.data ? pd.dm(c.data) : 'falta')
      : c.nivel === 'nl' ? html`<span class="pd-def">não lido</span>` : pd.traco();
  const detalhe = c.nivel === 'ok' ? (c.nota || '') : c.nota ? `${c.nota}${c.data ? ` · último ${pd.dma(c.data)}` : ''}` : '';
  return html`${corpo}${detalhe ? html`<span class="pd-obra-sub">${detalhe}</span>` : ''}`;
};

export function quadro(ctx, obras, { eventos = null, atas = null } = {}) {
  const linhas = obras.map((cod) => {
    const e = entregaveisDaObra(ctx, cod, { eventos, atas });
    const v = Object.values(e);
    const emDia = v.filter((c) => c.nivel === 'ok').length; const avaliados = v.filter((c) => c.nivel === 'ok' || c.nivel === 'critico').length;
    const nl = v.filter((c) => c.nivel === 'nl').length;
    const nivel = !avaliados ? '' : emDia === avaliados ? 'ok' : emDia / avaliados >= 0.6 ? 'atencao' : 'critico';
    return [pd.obraCel(cod, '', `#/obra/${encodeURIComponent(cod)}`), ...COLUNAS.map(([k]) => celula(e[k])),
      html`${pd.selo(nivel, avaliados ? `${emDia} de ${avaliados} em dia` : '—')}${nl ? html`<span class="pd-obra-sub">${nl} não lido${nl > 1 ? 's' : ''}</span>` : ''}`];
  });
  return pd.tabela(['Obra', ...COLUNAS.map((c) => c[1]), 'Resumo'], linhas, { vazio: 'Nenhuma obra em andamento no Cadastros.' });
}

export const LEGENDA = '✓ em dia (data do último item) · ✕ faltando ou atrasado · "não lido" = o sistema ainda não lê essa fonte · — não se aplica agora';

// resumo dos entregáveis de uma obra (para o quadro Planejado × executado): quantos em dia, de quantos avaliados
export function resumoDaObra(ctx, cod, opcoes = {}) {
  const v = Object.values(entregaveisDaObra(ctx, cod, opcoes));
  const emDia = v.filter((c) => c.nivel === 'ok').length; const avaliados = v.filter((c) => c.nivel === 'ok' || c.nivel === 'critico').length;
  const faltam = COLUNAS.filter(([k]) => entregaveisDaObra(ctx, cod, opcoes)[k].nivel === 'critico').map((c) => c[1]);
  return { emDia, avaliados, naoLidos: v.filter((c) => c.nivel === 'nl').length, faltam, nivel: !avaliados ? '' : emDia === avaliados ? 'ok' : emDia / avaliados >= 0.6 ? 'atencao' : 'critico' };
}
