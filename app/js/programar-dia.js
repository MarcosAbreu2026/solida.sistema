// Programação do dia de uma obra (pedido do Marcos, 20/11/2026): quem executa o quê e a meta do dia, com a equipe que temos (quadro de alocação).
// Cadeia de fontes, na ordem; vale a primeira que der serviço para a semana:
//  1) Programação semanal da pasta da obra: só COPIA o que está lá (serviço, quantidade e a coluna FUNCIONÁRIO). Não inventa equipe.
//  2) Pendências de obra (PDF da fase final): as pendências abertas, com o responsável da lista.
//  3) Cronograma: as atividades da semana (barra pintada naquela semana), com a quantidade da semana quando houver.
//  4) Metas semanais lidas pelo agente (dividida pelos dias úteis).
//  5) Nenhuma deu: o sistema CONSTRÓI o dia: serviços do escopo CINZA com média na planilha de rendimentos, postos nos profissionais alocados
//     da função certa; serviço sem profissional daquela função fica em vermelho "sem profissional para este serviço".
// Cada obra mostra no rodapé as 4 fontes lidas: ✓ verde (tem) ou ● vermelho (não tem). Cinza × laranja: escopo-cor.js (escopo/orçamento e planilha de terceirizados).
// Sem IA e sem API paga: só conta.
import { somarDias, inicioDaSemana } from './datas.js';
import { ehDiaUtil } from './dia-foco.js';
import { emFerias } from './ferias.js';
import { casar, canonProf, rotuloProf } from './telas/dimensionamento.js';
import { classificadorDaObra } from './escopo-cor.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const qtdTxt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '');
const unidade = (l) => String(l.un || l.unid || '').trim();
const itemTxt = (l) => `${l.tarefa}${typeof l.qtd === 'number' && l.qtd > 0 ? `: ${qtdTxt(l.qtd)} ${unidade(l)}` : ''}`.trim();
const NAO_MEDIVEL = /^(COP|DOC|MAQ|FER|CON)/i;
const nomesDe = (txt) => String(txt || '').split(/[\/,+;\n]| e /i).map((x) => x.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 1 && !/^-+$/.test(x));
const ABERTA = (st) => !/conclu|feito|ok|finaliz/i.test(String(st || ''));

// fontes da semana de uma obra: o que cada uma tem para dar
export function fontesDaSemana({ CFG, p, cod, ini }) {
  const fim = somarDias(ini, 6);
  const arq = (x) => String(x || '').replace(/^.*[\/]/, '');
  // 1) programação semanal (planilha da pasta, com datas na semana)
  const plan = (p && p.programacao && p.programacao.planilha) || null;
  const linhasProg = ((plan && plan.linhas) || []).filter((l) => l.data && l.data >= ini && l.data <= fim);
  const prog = { id: 'programacao', nome: 'Programação semanal', ok: linhasProg.length > 0, linhas: linhasProg,
    detalhe: linhasProg.length ? `${arq(plan.arquivo)} · ${linhasProg.length} linha(s)` : (plan ? `a mais nova (${arq(plan.arquivo)}) não cobre esta semana` : 'sem planilha na pasta da obra') };
  // 2) pendências de obra (PDF tipo "pendencias")
  const pg = (p && p.programacao) || null;
  const abertas = pg && pg.tipo === 'pendencias' ? (pg.secoes || []).flatMap((s) => s.linhas || []).filter((l) => l && l.item && ABERTA(l.status)) : [];
  const pend = { id: 'pendencias', nome: 'Pendências de obra', ok: abertas.length > 0, abertas,
    detalhe: abertas.length ? `${arq(pg.arquivo)} · ${abertas.length} aberta(s)` : (pg && pg.tipo === 'pendencias' ? 'lista sem pendência aberta' : 'a obra não está em fase de pendências') };
  // 3) cronograma: atividades com barra na semana
  const cr = (p && p.cronograma && !p.cronograma.erro) ? p.cronograma : null;
  const idx = cr ? (cr.semanas || []).findIndex((s) => s.inicio === ini) : -1;
  const ativ = cr && idx >= 0 ? (cr.atividades || []).filter((a) => (a.barras || []).includes(idx) && !(typeof a.exe === 'number' && a.exe >= 0.999)) : [];
  const cron = { id: 'cronograma', nome: 'Cronograma', ok: ativ.length > 0, ativ, idx,
    detalhe: ativ.length ? `${arq(cr.arquivo)} · ${ativ.length} atividade(s) na semana` : (cr ? `${arq(cr.arquivo)} não tem atividade nesta semana` : 'sem cronograma lido') };
  // 4) metas semanais
  const sem = (((CFG && CFG.metasSemanais) || {}).semanas || []).find((s) => s.ini === ini);
  const o = sem && (sem.obras || []).find((x) => x.obra === cod);
  const itensMeta = ((o && o.itens) || []).filter((i) => i.item && typeof i.meta === 'number' && i.meta > 0);
  const meta = { id: 'metas', nome: 'Metas', ok: itensMeta.length > 0, itens: itensMeta,
    detalhe: itensMeta.length ? `${itensMeta.length} meta(s) com quantidade${sem && sem.fonte ? ` · ${arq(sem.fonte)}` : ''}` : 'sem meta com quantidade para a semana' };
  return [prog, pend, cron, meta];
}

// ctx → (cod, dia, pessoas[{nome, periodo}]) → { servicos, pessoasLivres, aviso, origemInfo, fontes }
export function programadorDoCtx(ctx) {
  const proj = ctx.drive && ctx.drive.projetos; const rend = proj && proj.rendimentos;
  const itensRend = ((rend && rend.itens) || []).filter((r) => r.total > 0 && r.media > 0);
  const funcaoDe = (nome) => { const k = norm(nome); const e = ((ctx.equipeProg && ctx.equipeProg.pessoas) || []).find((q) => norm(q.nome) === k || norm(q.nome).split(' ')[0] === k.split(' ')[0]); return e ? e.funcao || '' : ''; };
  return (cod, dia, todasPessoas) => {
    const pessoas = (todasPessoas || []).filter((x) => !emFerias(x.nome, dia));   // quem está de férias não recebe serviço
    const p = (((proj || {}).obras) || []).find((o) => o.obra === cod) || null;
    const ini = inicioDaSemana(dia);
    const classif = classificadorDaObra(p);
    const semanaUteis = Array.from({ length: 7 }, (_, i) => somarDias(ini, i)).filter((d) => ehDiaUtil(d, cod));
    const n = Math.max(1, semanaUteis.length);
    const fontes = fontesDaSemana({ CFG: ctx.CFG, p, cod, ini });
    const [prog, pend, cron, meta] = fontes;
    const pes = pessoas.map((x) => ({ ...x, n: 0, canon: canonProf(funcaoDe(x.nome)) }));
    const pessoaPorNome = (d) => pes.find((x) => norm(d) === norm(x.nome) || norm(d) === norm(x.nome).split(' ')[0]);

    let usada = null; let linhas = []; let soCopiar = false; let aviso = '';
    if (prog.ok) {
      usada = 'programacao'; soCopiar = true; linhas = prog.linhas.filter((l) => l.data === dia);
      if (!linhas.length) aviso = 'A programação semanal da pasta não traz serviço para este dia.';
    } else if (pend.ok) {
      usada = 'pendencias';
      linhas = pend.abertas.slice(0, Math.max(3, pes.length * 2)).map((l) => ({ tarefa: `${l.etapa ? `${l.etapa} · ` : ''}${l.item}`, funcionario: l.resp && l.resp !== '-' ? l.resp : '', qtd: null, un: '' }));
    } else if (cron.ok) {
      usada = 'cronograma';
      linhas = cron.ativ.map((a) => { const q = (a.qtdSemana || {})[String(cron.idx)]; return { cod: a.cod, tarefa: a.nome, qtd: typeof q === 'number' && q > 0 ? Math.round((q / n) * 100) / 100 : null, un: a.unid || '', funcionario: '', fase: a.grupoNome || a.grupo || '', calculada: true }; });
    } else if (meta.ok) {
      usada = 'metas';
      linhas = meta.itens.map((i) => ({ data: null, tarefa: i.item, cod: '', qtd: Math.round((i.meta / n) * 100) / 100, un: i.un || i.unidade || '', calculada: true }));
    }

    const faltam = new Set(); const servicos = [];
    // loja/empresa do item laranja, pela planilha de terceirizados da obra
    const lojaDe = (l) => { const alvo = norm(l.tarefa); const m = ((p && p.terceirizados && p.terceirizados.laranja) || []).find((i) => i.loja && norm(i.item).split(' ').filter((w) => w.length > 3).some((w) => alvo.includes(w.replace(/s$/, '')))); return m ? String(m.loja).split('\n')[0] : ''; };
    for (const l of linhas) {
      const k = norm(`${l.cod || ''}${l.tarefa}`).replace(/[^a-z0-9]+/g, '').slice(0, 40) || 'item';
      const base = { k, texto: itemTxt(l), qtd: typeof l.qtd === 'number' && l.qtd > 0 ? l.qtd : null };
      if (classif(l, l.cor) === 'laranja') { servicos.push({ ...base, tipo: 'laranja', empresa: String(l.funcionario || lojaDe(l) || l.local || '').trim() }); continue; }
      const dados = nomesDe(l.funcionario);
      if (dados.length) { servicos.push({ ...base, tipo: 'cinza', quem: dados, sugerido: false }); for (const d of dados) { const x = pessoaPorNome(d); if (x) x.n++; } continue; }
      if (soCopiar) { servicos.push({ ...base, tipo: 'cinza', quem: [], sugerido: false, semQuem: 'sem funcionário na planilha' }); continue; }
      const m = base.qtd ? casar(l, itensRend) : null;
      if (!m) { const livre = [...pes].sort((a, b) => a.n - b.n)[0]; if (livre) livre.n++; servicos.push({ ...base, tipo: 'cinza', quem: livre ? [livre.nome] : [], sugerido: !!livre, semQuem: 'a definir', texto: `${base.texto}${base.qtd ? ' · sem média na planilha' : ''}` }); continue; }
      const eq = {}; for (const [nome, qt] of Object.entries(m.r.equipe || {})) eq[canonProf(nome)] = (eq[canonProf(nome)] || 0) + qt;
      const quem = [];
      for (const [papel, qt] of Object.entries(eq)) {
        const cand = pes.filter((x) => x.canon === papel).sort((a, b) => a.n - b.n);
        if (cand.length < Math.ceil(qt)) faltam.add(rotuloProf(papel));
        for (const c of cand.slice(0, Math.max(1, Math.ceil(qt)))) { c.n++; quem.push(c.nome); }
      }
      servicos.push({ ...base, tipo: 'cinza', quem, sugerido: true, semQuem: `falta alocar: ${Object.keys(eq).map(rotuloProf).join(', ')}` });
    }

    // 5) nenhuma fonte deu o dia: o sistema constrói com a planilha de rendimentos e a equipe alocada
    let construido = false;
    if (!usada) {
      construido = true; usada = 'construido';
      const escopo = (((p && p.escopo && p.escopo.grupos) || []).flatMap((g) => g.itens || []))
        .filter((i) => typeof i.quant === 'number' && i.quant > 0 && !NAO_MEDIVEL.test(String(i.cod || '')) && classif({ tarefa: i.desc, cod: i.cod }) === 'cinza');
      let feitos = 0; const limite = Math.max(pes.length, 1) + 3;
      for (const i of escopo) {
        if (feitos >= limite) break;
        const m = casar({ tarefa: i.desc, cod: i.cod, un: i.unid, qtd: i.quant }, itensRend);
        if (!m) continue;
        const eq = {}; for (const [nome, qt] of Object.entries(m.r.equipe || {})) eq[canonProf(nome)] = (eq[canonProf(nome)] || 0) + qt;
        const papeis = Object.keys(eq);
        const temTodos = papeis.every((pp) => pes.some((x) => x.canon === pp));
        const meta1 = Math.min(i.quant, m.r.media);
        const base = { k: norm(`${i.cod || ''}${i.desc}`).replace(/[^a-z0-9]+/g, '').slice(0, 40) || 'item', texto: `${i.desc}: ${qtdTxt(meta1)} ${i.unid || ''}`.trim(), qtd: meta1 };
        if (!temTodos) { servicos.push({ ...base, tipo: 'cinza', quem: [], semProfissional: true, semQuem: 'sem profissional para este serviço' }); feitos++; continue; }
        const livres = papeis.every((pp) => pes.some((x) => x.canon === pp && x.n === 0));
        if (!livres && pes.every((x) => x.n > 0)) continue;   // todos já têm serviço: o resto não cabe no dia
        const quem = [];
        for (const [papel, qt] of Object.entries(eq)) { const cand = pes.filter((x) => x.canon === papel).sort((a, b) => a.n - b.n); for (const c of cand.slice(0, Math.max(1, Math.ceil(qt)))) { c.n++; quem.push(c.nome); } }
        servicos.push({ ...base, tipo: 'cinza', quem, sugerido: true }); feitos++;
      }
      if (!servicos.length) aviso = pes.length ? 'Nenhuma fonte tem serviço e nenhum item do escopo cinza tem média na planilha de rendimentos: o gestor precisa lançar a programação.' : 'Nenhuma fonte tem serviço e não há funcionário alocado nesta obra neste dia.';
    }
    if (faltam.size) aviso = `${aviso ? `${aviso} ` : ''}Falta alocar na obra: ${[...faltam].join(', ')}.`;

    const nomeFonte = Object.fromEntries(fontes.map((f) => [f.id, f.nome]));
    const textoUsada = { programacao: 'copiei a programação semanal da pasta, sem inventar equipe.', pendencias: 'usei as pendências de obra (fase final).', cronograma: 'usei as atividades do cronograma desta semana e sugeri quem faz pela produtividade da equipe.', metas: 'usei a meta da semana dividida pelos dias úteis e sugeri quem faz pela produtividade da equipe.',
      construido: 'nenhuma fonte deu o dia: montei com as médias da planilha de rendimentos, só com o escopo cinza e os profissionais alocados.' }[usada];
    return { servicos, aviso, pessoasLivres: pes.filter((x) => !x.n).map((x) => ({ nome: x.nome, periodo: x.periodo })),
      fontes: fontes.map((f) => ({ id: f.id, nome: f.nome, ok: f.ok, detalhe: f.detalhe, usada: usada === f.id })), construido,
      origemInfo: { tipo: usada === 'programacao' ? 'drive' : usada === 'construido' ? 'nada' : 'meta', texto: `Fonte usada: ${usada === 'construido' ? 'construído pelo sistema' : nomeFonte[usada]} — ${textoUsada}` } };
  };
}
