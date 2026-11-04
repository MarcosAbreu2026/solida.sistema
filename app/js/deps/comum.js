// Coisas comuns aos painéis dos departamentos (app/js/deps/*.js).
//
// Contrato: cada arquivo exporta painel(ctx) e devolve o HTML do painel (sem o título da página, que o main já mostra).
// ctx = {
//   dep,        // o departamento (organograma.js)
//   CFG,        // dados.json dos agentes (geral, areas, obras, funcionarios, whats = produtividade do WhatsApp)
//   area,       // CFG.areas[dep.cfg] (pode ser null)
//   f,          // função de quem está vendo (funcoes.js) · veValores: só sócios e financeiro veem R$
//   veValores,
//   drive,      // { orcamentos, projetos, estoque } lidos do Drive (exportar-drive.ps1)
//   base,       // pós-obra (regras.js montarBase): obras, servicos, agenda, equipe, financeiro…
//   efetivo,    // { dias: { 'AAAA-MM-DD': { Mo531: { hora, solida: { qtd, nomes }, terceiros, total } } } }
//   terceiros,  // { empresas: [{ obra, empresa, contrato, medicao, obs }], verificadoEm }
//   ferrChk,    // { registros: [{ local, enviadoEm, hora, por }], verificadoEm }
//   mc,         // medições lidas no Mais Controle { semana, obras: [{ obra, itens }] }
//   celular,    // registros do celular da obra (tabela registros_obra) [{ obra, data, tipo, item, valor, dados, texto }]
//   pendencias, // pendências de atas e avulsas (atas.todasPendencias())
//   hoje,       // AAAA-MM-DD
//   visiveis,   // obras da pessoa (quem é de obra) ou null = todas
//   sync,       // { origem, atualizado } do dados.json
// }

import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';

// "Última leitura dos dados: 05/10 · 14:00 (27 dias atrás)" quando o dados.json dos agentes está velho
export function avisoLeitura(ctx, prefixo = 'Última leitura dos dados') {
  const at = (ctx.CFG && ctx.CFG.atualizadoEm) || (ctx.sync && ctx.sync.atualizado);
  if (!at) return '';
  const d = new Date(at); const dias = Math.floor((new Date(ctx.hoje) - new Date(String(at).slice(0, 10))) / 86400000);
  if (dias < 1) return '';
  return pd.aviso(`${prefixo}: ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${dias} ${dias === 1 ? 'dia' : 'dias'} atrás). Os números abaixo não são de hoje.`);
}

// painel genérico (enquanto o departamento não tem o seu): pergunta + indicadores e alertas do agente
export function painelGenerico(ctx) {
  const { dep, area } = ctx;
  const kpis = ((area && area.kpis) || []).filter((k) => !k.restrito || ctx.veValores).slice(0, 8).map((k) => {
    const p = String(k.valor).split(' · ');
    return { rotulo: k.label, valor: p[0], sub: p.slice(1).join(' · ') };
  });
  return html`${pd.pergunta(dep.pergunta)}
    ${avisoLeitura(ctx)}
    ${kpis.length ? pd.secao('Indicadores', fontesDe(area), pd.cartoes(kpis)) : ''}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(area, { veValores: ctx.veValores, obras: ctx.visiveis }), { setor: dep.setor }))}
    ${!kpis.length && !(area && (area.alertas || []).length) ? pd.emDefinicao(['Ainda sem indicadores definidos.', `Reunião com o responsável (${dep.resp.replace(/^.*?:\s*/, '').split(' ·')[0]}) para listar as rotinas e o que precisa de alerta.`]) : ''}`;
}

// lista de obras em curso (planejamento do agente + cadastro), na ordem do Marcos
export function obrasEmCurso(ctx) {
  const plan = ((ctx.CFG && ctx.CFG.areas.find((a) => a.id === 'planejamento')) || {}).porObra || [];
  const cods = plan.map((o) => o.obra);
  return (ctx.visiveis ? cods.filter((c) => ctx.visiveis.includes(c)) : cods);
}

// "Fonte: Mais Controle, Drive" a partir das fontes da área do agente (objetos { nome, via, ultima } ou textos)
export function fontesDe(area) {
  const l = [].concat((area && area.fontes) || []).map((x) => (typeof x === 'string' ? x : x && x.nome)).filter(Boolean);
  return l.length ? `Fonte: ${[...new Set(l)].join(', ')}` : '';
}

export const num = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v);
