// Programação do dia de uma obra (pedido do Marcos, 20/11/2026): quem executa o quê e a meta do dia.
// 1) A obra tem a programação semanal na pasta (linhas com data): vale o que o gestor programou para o dia.
// 2) Não tem, mas tem a meta da semana: o sistema monta sozinho, dividindo a quantidade de cada serviço pelos dias úteis da semana e pondo
//    cada serviço nos funcionários alocados na obra (quadro de alocação de Operações) cuja função a planilha de produtividade pede
//    (média da EQUIPE por dia de 8 h, ex.: 10 m²/dia = 1 pedreiro + 1 ajudante).
// 3) Não tem nenhuma das duas: avisa, sem inventar. Funcionário alocado que não recebeu serviço aparece "livre, sem tarefa".
// Sem IA e sem API paga: só conta. Serviço de terceiro (fase em cor na programação) é listado, mas não consome funcionário da Sólida.
import { somarDias, inicioDaSemana } from './datas.js';
import { ehDiaUtil } from './dia-foco.js';
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
  return (cod, dia, pessoas) => {
    const p = (((proj || {}).obras) || []).find((o) => o.obra === cod) || null;
    const ini = inicioDaSemana(dia);
    const t = tarefasDaObra(ctx.CFG, p, cod, ini, ctx.hoje);
    const semanaUteis = Array.from({ length: 7 }, (_, i) => somarDias(ini, i)).filter((d) => ehDiaUtil(d, cod));
    let linhas = []; let origem = ''; let aviso = '';
    if (t.fonte === 'programação') {
      linhas = t.linhas.filter((l) => l.data === dia); origem = 'programação semanal da pasta da obra';
      if (!linhas.length) aviso = 'A programação semanal da pasta não traz serviço para este dia.';
    } else if (t.fonte === 'meta') {
      const n = Math.max(1, semanaUteis.length);
      linhas = t.linhas.map((l) => ({ ...l, qtd: Math.round((l.qtd / n) * 100) / 100, calculada: true })); origem = `montada pelo sistema: meta da semana ÷ ${n} dia(s) útil(eis)`;
      aviso = 'Sem programação semanal na pasta da obra: o sistema dividiu a meta da semana. O gestor deve lançar a programação.';
    } else {
      return { itens: [], pessoas: pessoas.map((x) => ({ ...x, tarefa: '' })), aviso: 'Sem programação semanal e sem meta da semana na pasta da obra: o gestor precisa lançar.', origem: '' };
    }
    const pes = pessoas.map((x) => ({ ...x, tarefa: [], canon: canonProf(funcaoDe(x.nome)), funcao: funcaoDe(x.nome) }));
    const itens = []; const faltam = new Set();
    for (const l of linhas) {
      if (ehTerceiro(l.cor)) { itens.push(`${itemTxt(l)} (terceiro)`); continue; }
      const m = typeof l.qtd === 'number' && l.qtd > 0 ? casar(l, itensRend) : null;
      if (!m) { itens.push(`${itemTxt(l)}${typeof l.qtd === 'number' ? ' (sem média na planilha)' : ''}`); const livre = [...pes].sort((a, b) => a.tarefa.length - b.tarefa.length)[0]; if (livre && l.tarefa) livre.tarefa.push(itemTxt(l)); continue; }
      const eq = {}; for (const [nome, qt] of Object.entries(m.r.equipe || {})) eq[canonProf(nome)] = (eq[canonProf(nome)] || 0) + qt;
      itens.push(`${itemTxt(l)} · ${Object.entries(eq).map(([r, q]) => `${q} ${rotuloProf(r)}`).join(' + ')}`);
      for (const [papel, qt] of Object.entries(eq)) {
        const candidatos = pes.filter((x) => x.canon === papel).sort((a, b) => a.tarefa.length - b.tarefa.length);
        if (candidatos.length < Math.ceil(qt)) faltam.add(rotuloProf(papel));
        for (const c of candidatos.slice(0, Math.max(1, Math.ceil(qt)))) c.tarefa.push(`${l.tarefa}${papel === 'ajudante' ? ' (apoio)' : ''}`);
      }
    }
    if (faltam.size) aviso = `${aviso ? `${aviso} ` : ''}Falta alocar na obra: ${[...faltam].join(', ')}.`;
    return { itens, origem, aviso, pessoas: pes.map((x) => ({ nome: x.nome, periodo: x.periodo, funcao: x.funcao, tarefa: x.tarefa.length ? [...new Set(x.tarefa)].join('; ') : '', livre: !x.tarefa.length })) };
  };
}
