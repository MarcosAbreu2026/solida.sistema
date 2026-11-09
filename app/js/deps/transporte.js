// Transporte e Logística (Paiva · Anderson), desenho do Marcos pág. 15: rotas do dia e do dia seguinte e a análise das rotas do Anderson.
// As rotas vêm do grupo "Strada Sólida" (WhatsApp), que ainda não é lido para esta tela: ficam com traço.
// O que já dá para mostrar: as viagens de reposição de ferramentas calculadas da planilha SL_FERRAMENTAS (telas/reposicao.js).
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { calcular } from '../telas/reposicao.js';
import { cartaoDoAgente } from './comum.js';
import * as materiais from './materiais.js';

// zonas combinadas por dia (desenho do Marcos, 04/11/2026)
const ZONAS = [['Segunda', 'Zona Sul'], ['Terça', 'Barra'], ['Quarta', 'Zona Sul'], ['Quinta', 'Barra'], ['Sexta', 'Livre']];

export function painel(ctx) {
  const area = ctx.area;
  let rep = null;
  try { rep = ctx.drive && ctx.drive.estoque ? calcular(ctx.drive.estoque) : null; } catch { rep = null; }
  const viagens = rep ? new Set(rep.movs.map((m) => `${m.de}>${m.para}`)).size : null;
  const ult = ((ctx.rotas && ctx.rotas.semanas) || [])[0] || null;
  const kr = (ult && ult.kpis) || {};
  const semRota = !ult;
  const alertas = pd.alertasDoAgente(area, { veValores: ctx.veValores }).filter((a) => /rota|reposi|entreg|carro|ve[íi]cul|strada|loca/i.test(a.texto));
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${pd.secao('Rotas da última semana', 'Análise feita toda segunda, a partir do grupo Strada Sólida · clique para ver o relatório completo', pd.cartoes([
      { rotulo: 'Dias fora da zona', valor: kr.diasComZonaDefinida != null ? `${kr.diasComViolacao || 0} de ${kr.diasComZonaDefinida}` : '—', nivel: kr.diasComViolacao ? 'critico' : (semRota ? '' : 'ok'), href: '#/transporte/rotas' },
      { rotulo: 'Paradas não informadas', valor: kr.paradasNaoInformadas != null ? String(kr.paradasNaoInformadas) : '—', nivel: kr.paradasNaoInformadas ? 'atencao' : '', href: '#/transporte/rotas' },
      { rotulo: 'Ociosidade estimada', valor: kr.ociosoHorasEstimado != null ? `${String(kr.ociosoHorasEstimado).replace('.', ',')} h` : '—', sub: semRota ? 'a primeira análise sai na segunda, 09:00' : `semana de ${pd.dm(ult.ini)} a ${pd.dm(ult.fim)}`, href: '#/transporte/rotas' },
    ], { colunas: 3 }))}
    ${materiais.painel({ ...ctx, parte: 'vendas' })}
    ${pd.secao('Reposição de ferramentas', rep ? 'Calculada da planilha SL_FERRAMENTAS: cada origem → destino é uma viagem' : '', pd.cartoes([
      cartaoDoAgente(area, /reposi/i, { rotulo: 'Reposições entregues até terça', meta: 'Meta ≥ 95%' }),
      { rotulo: 'Viagens de reposição a fazer', valor: viagens == null ? '—' : String(viagens), sub: rep ? `${rep.movs.length} movimentações de itens` : 'planilha ainda não lida', href: '#/estoque/reposicao' },
      { rotulo: 'Itens para comprar', valor: rep ? String(rep.compras.length) : '—', sub: 'tudo chega no galpão e o Anderson leva', href: '#/estoque/reposicao' },
    ], { colunas: 3 }))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(alertas, { setor: ctx.dep.setor }, { vazio: 'Nenhum alerta de rota ou reposição agora.' }))}`;
}
