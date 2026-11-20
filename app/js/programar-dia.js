// Programação do dia de uma obra (pedido do Marcos, 20/11/2026): quem executa o quê e a meta do dia.
// 1) A obra tem a programação semanal na pasta (linhas com data): vale o que o gestor programou para o dia.
// 2) Não tem, mas tem a meta da semana: o sistema monta sozinho, dividindo a quantidade de cada serviço pelos dias úteis da semana e pondo
//    cada serviço nos funcionários alocados na obra (quadro de alocação de Operações) cuja função a planilha de produtividade pede
//    (média da EQUIPE por dia de 8 h, ex.: 10 m²/dia = 1 pedreiro + 1 ajudante).
// 3) Não tem nenhuma das duas: avisa, sem inventar. Funcionário alocado que não recebeu serviço aparece "livre, sem tarefa".
// Sem IA e sem API paga: só conta. Serviço de terceiro (fase em cor na programação) é listado, mas não consome funcionário da Sólida.
import { somarDias, inicioDaSemana } from './datas.js';
import { ehDiaUtil } from './dia-foco.js';
import { emFerias } from './ferias.js';
import { casar, canonProf, rotuloProf, ehTerceiro, tarefasDaObra } from './telas/dimensionamento.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const qtdTxt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '');
const unidade = (l) => String(l.un || l.unid || '').trim();
const itemTxt = (l) => `${l.tarefa}${typeof l.qtd === 'number' && l.qtd > 0 ? `: ${qtdTxt(l.qtd)} ${unidade(l)}` : ''}`.trim();

// ctx → (cod, dia, pessoas[{nome, periodo}]) → { itens, pessoas[{nome, periodo, tarefa}], aviso, origem }
export function programadorDoCtx(ctx) {
  const proj = ctx.drive && ctx.drive.projetos; const rend = proj && proj.rendimentos;
  const itensRend = ((rend && rend.itens) || []).filter((r) => r.total > 0 && r.media > 0);
  const funcaoDe = (nome) => { const k = norm(nome); const e = ((ctx.equipeProg && ctx.equipeProg.pessoas) || []).find((p) => norm(p.nome) === k || norm(p.nome).split(' ')[0] === k.split(' ')[0]); return e ? e.funcao || '' : ''; };
  return (cod, dia, todasPessoas) => {
    const pessoas = (todasPessoas || []).filter((x) => !emFerias(x.nome, dia));   // quem está de férias não recebe serviço
    const p = (((proj || {}).obras) || []).find((o) => o.obra === cod) || null;
    const ini = inicioDaSemana(dia);
    const t = tarefasDaObra(ctx.CFG, p, cod, ini, ctx.hoje);
    const semanaUteis = Array.from({ length: 7 }, (_, i) => somarDias(ini, i)).filter((d) => ehDiaUtil(d, cod));
    const arq = String(t.arquivo || '').replace(/^.*[\/]/, '');
    let linhas = []; let origemInfo; let aviso = '';
    if (t.fonte === 'programação') {
      linhas = t.linhas.filter((l) => l.data === dia);
      origemInfo = { tipo: 'drive', texto: `Fonte: programação semanal da pasta da obra no Drive${arq ? ` (${arq})` : ''}. A equipe de cada serviço vem da coluna FUNCIONÁRIO da planilha; onde está vazia, o sistema sugere.` };
      if (!linhas.length) aviso = 'A programação semanal da pasta não traz serviço para este dia.';
    } else if (t.fonte === 'meta') {
      const n = Math.max(1, semanaUteis.length);
      linhas = t.linhas.map((l) => ({ ...l, qtd: Math.round((l.qtd / n) * 100) / 100, calculada: true }));
      origemInfo = { tipo: 'meta', texto: `Fonte: SEM programação semanal na pasta da obra. Peguei a meta da semana${arq ? ` (${arq})` : ''}, dividi por ${n} dia(s) útil(eis) e sugeri quem faz pela produtividade da equipe. O gestor deve lançar a programação.` };
    } else {
      return { servicos: [], pessoasLivres: pessoas, aviso: '', origemInfo: { tipo: 'nada', texto: 'Fonte: SEM meta da semana e SEM programação semanal na pasta da obra. Nada a mostrar: o gestor e o planejamento precisam lançar.' } };
    }
    const pes = pessoas.map((x) => ({ ...x, n: 0, canon: canonProf(funcaoDe(x.nome)) }));
    const faltam = new Set(); const servicos = [];
    const nomesDe = (txt) => String(txt || '').split(/[\/,+;]| e /i).map((x) => x.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 1 && !/^-+$/.test(x));
    for (const l of linhas) {
      const k = norm(`${l.cod || ''}${l.tarefa}`).replace(/[^a-z0-9]+/g, '').slice(0, 40) || 'item';
      const base = { k, texto: itemTxt(l), qtd: typeof l.qtd === 'number' && l.qtd > 0 ? l.qtd : null };
      if (ehTerceiro(l.cor)) { servicos.push({ ...base, tipo: 'laranja', empresa: String(l.funcionario || l.local || '').trim() }); continue; }
      const dados = nomesDe(l.funcionario);
      if (dados.length) { servicos.push({ ...base, tipo: 'cinza', quem: dados, sugerido: false }); for (const x of pes) if (dados.some((d) => norm(d) === norm(x.nome) || norm(d) === norm(x.nome).split(' ')[0])) x.n++; continue; }
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
    if (faltam.size) aviso = `${aviso ? `${aviso} ` : ''}Falta alocar na obra: ${[...faltam].join(', ')}.`;
    return { servicos, aviso, origemInfo, pessoasLivres: pes.filter((x) => !x.n).map((x) => ({ nome: x.nome, periodo: x.periodo })) };
  };
}
