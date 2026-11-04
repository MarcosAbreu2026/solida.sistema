// Página de uma obra (Operações › Mo531): Resumo no desenho do Marcos + abas. Contrato e ctx: ver comum.js.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';

export const ABAS = [
  { id: '', nome: 'Resumo' }, { id: 'cronograma', nome: 'Cronograma' }, { id: 'programacao', nome: 'Programação semanal' },
  { id: 'medicoes', nome: 'Medições' }, { id: 'efetivo', nome: 'Efetivo e produtividade' }, { id: 'diario', nome: 'Diário de obra' },
  { id: 'compras', nome: 'Compras' }, { id: 'escopo', nome: 'Escopo e aditivos' }, { id: 'pendencias', nome: 'Pendências' },
];

export function resumo(ctx, cod) {
  return html`${pd.pergunta('O que está acontecendo hoje nesta obra, está de acordo com o planejado e quem precisa agir?')}
    ${pd.secao('Quem precisa agir nesta obra', '', pd.quemAgir(pd.alertasDoAgente(ctx.CFG.areas.find((a) => a.id === 'operacao'), { veValores: ctx.veValores, obras: [cod] }), { obra: cod, setor: 'Operação' }))}`;
}

// abas novas (as antigas — cronograma, programação, medições, escopo — vêm de telas/operacao.js)
export function aba(ctx, cod, abaId) {
  return html`<p class="pd-vazio">Em montagem.</p>`;
}

// topo da página da obra: "Operações · obras em andamento", código, endereço e equipe; à direita início e previsão
export function cabecalho(ctx, cod) {
  return pd.cabecalho({ rotulo: 'Operações · obras em andamento', resp: '' });
}
