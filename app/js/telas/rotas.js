// Transporte › Rotas: análise semanal "rotas planejadas × executadas" da Strada (grupo Strada Solida).
// Os dados vêm de dados/json/rotas-semana.json, gravado toda segunda pelo agente de Transporte
// (procedimento em docs/procedimentos/analise-semanal-rotas.md). Aqui só se mostra, nada é calculado do WhatsApp.
import { html } from '../formato.js';
import * as pd from './painel-dep.js';

export const ABA_ROTAS = { id: 'rotas', nome: 'Rotas da semana' };

const SIT = { ok: ['ok', 'Dentro da regra'], violacao: ['critico', 'Fora da zona'], 'sem-rota': ['atencao', 'Sem rota publicada'], 'nao-lido': ['info', 'Não lido'] };
const LOCAL_COR = { 'Zona Sul': 'ok', Barra: 'ok', 'Zona Norte': 'critico', vendor: 'info', 'a confirmar': 'atencao' };

const num = (v) => (v == null || v === '' ? '—' : String(v).replace('.', ','));
const horas = (h) => (h == null ? '—' : `${String(Math.round(h * 10) / 10).replace('.', ',')} h`);

export function render(dados, params) {
  const semanas = dados && Array.isArray(dados.semanas) ? dados.semanas.filter((s) => s && s.ini) : [];
  if (!semanas.length) {
    return html`<div>
      ${pd.aviso('A primeira análise das rotas ainda não foi gerada. Ela é feita toda segunda-feira às 09:00 pelo agente de Transporte, a partir do grupo Strada Solida.', 'info')}
      ${pd.secao('Rotas da semana', 'Fonte: grupo Strada Solida (WhatsApp)', pd.tabela(['Dia', 'Zona do dia'], [['Segunda', 'Zona Sul'], ['Terça', 'Barra'], ['Quarta', 'Zona Sul'], ['Quinta', 'Barra'], ['Sexta', 'Livre']]))}
    </div>`;
  }
  const pedida = params && params.get ? params.get('semana') : '';
  const s = semanas.find((x) => x.ini === pedida) || semanas[0];
  const k = s.kpis || {};
  const dias = Array.isArray(s.dias) ? s.dias : [];
  const comZona = dias.filter((d) => d.zona && d.zona !== 'Livre');
  const viol = k.diasComViolacao != null ? k.diasComViolacao : comZona.filter((d) => d.situacao === 'violacao').length;
  const total = k.diasComZonaDefinida != null ? k.diasComZonaDefinida : comZona.length;
  const prev = k.paradasPrevistas, conf = k.paradasConfirmadas;

  const seletor = semanas.length > 1
    ? html`<div class="subnav pd-abas">${semanas.map((x) => html`<a href="#/transporte/rotas?semana=${x.ini}" class="${x.ini === s.ini ? 'on' : ''}">${pd.dm(x.ini)} a ${pd.dm(x.fim)}</a>`)}</div>`
    : '';

  const cards = pd.cartoes([
    { rotulo: 'Dias fora da zona', valor: total ? `${viol} de ${total}` : '—', nivel: !total ? '' : viol ? 'critico' : 'ok', sub: 'segunda a quinta (sexta é livre)' },
    { rotulo: 'Paradas confirmadas', valor: prev != null && conf != null ? `${conf} de ${prev}` : num(conf), nivel: prev && conf != null && conf < prev ? 'atencao' : 'ok', sub: 'o Anderson avisou no grupo' },
    { rotulo: 'Paradas não informadas', valor: num(k.paradasNaoInformadas), nivel: k.paradasNaoInformadas ? 'atencao' : 'ok', sub: 'previstas e sem aviso' },
    { rotulo: 'Ociosidade estimada', valor: horas(k.ociosoHorasEstimado), sub: 'já descontado 1 h de almoço por dia' },
  ], { colunas: 4 });

  const faixa = html`<div class="pd-cards" style="--pd-n:${Math.max(dias.length, 1)}">${dias.map((d) => {
    const [nivel, rotulo] = SIT[d.situacao] || ['info', '—'];
    return html`<div class="pd-card"><span class="pd-c-rot">${d.dia}${d.data ? ` ${pd.dm(d.data)}` : ''}</span>
      <span class="pd-c-sub">${d.zona === 'Livre' ? 'Sexta: livre encaixe' : d.zona || ''}</span>
      <span>${pd.selo(nivel, rotulo)}</span></div>`;
  })}</div>`;

  const comOcorrencia = dias.filter((d) => d.ocorrencia || (d.situacao && d.situacao !== 'ok'));
  const semOcorrencia = dias.filter((d) => !comOcorrencia.includes(d)).map((d) => d.dia);
  const tabDias = pd.tabela(['Dia', 'Zona do dia', 'Paradas fora da zona', 'Ponto de atenção'],
    comOcorrencia.map((d) => {
      const fora = (d.paradas || []).filter((p) => d.zona && d.zona !== 'Livre' && ((d.zona === 'Zona Sul' && p.zonaLocal === 'Barra') || (d.zona === 'Barra' && p.zonaLocal === 'Zona Sul') || p.zonaLocal === 'Zona Norte'));
      return [html`<b class="pd-obra">${d.dia}</b><span class="pd-obra-sub">${pd.dm(d.data)}</span>`, d.zona || '—',
        fora.length ? html`${fora.map((p) => html`<div>${p.hora ? `${p.hora} · ` : ''}${p.local} ${pd.selo(p.aprovado === true ? 'atencao' : 'critico', p.zonaLocal)} ${p.aprovado === true ? html`<span class="pd-fonte">aprovado</span>` : p.aprovado === false ? html`<span class="pd-fonte">sem aprovação no grupo</span>` : ''}</div>`)}` : '',
        d.ocorrencia || ''];
    }), { vazio: 'Nenhum dia com ponto de atenção nesta semana.' });

  const ocio = Array.isArray(s.ociosidade) && s.ociosidade.length
    ? pd.tabela(['Dia', 'Caso', 'Tempo estimado'], s.ociosidade.map((o) => [pd.dm(o.data), o.texto, horas(o.horas)]))
    : '';

  return html`<div>
    ${seletor}
    <div class="pd-pergunta"><span>Semana de ${pd.dm(s.ini)} a ${pd.dm(s.fim)}</span><p>${s.resumo || 'Sem resumo.'}</p></div>
    ${pd.secao('Em números', 'Fonte: grupo Strada Solida (WhatsApp)', cards)}
    ${pd.secao('Dia a dia', 'Regra: segunda e quarta Zona Sul · terça e quinta Barra · sexta livre. Fora da zona só com aprovação do Marcos ou do Márcio.', faixa)}
    ${pd.secao('Onde precisa de atenção', semOcorrencia.length ? `Sem ocorrência: ${semOcorrencia.join(', ')}` : '', tabDias)}
    ${ocio ? pd.secao('Tempo ocioso do Anderson entre as obras', 'Estimado pelos horários das mensagens, já descontado 1 h de almoço por dia', ocio) : ''}
    ${Array.isArray(s.pontos) && s.pontos.length ? pd.secao('O que melhorar', '', pd.itens(s.pontos)) : ''}
    ${Array.isArray(s.lacunas) && s.lacunas.length ? pd.aviso(`Não deu para ler: ${s.lacunas.join(' · ')}`, 'info') : ''}
    <p class="pequeno" style="margin-top:14px">${s.metodologia || ''}${s.geradoEm ? ` Gerado em ${s.geradoEm.slice(8, 10)}/${s.geradoEm.slice(5, 7)} às ${s.geradoEm.slice(11, 16)}.` : ''}</p>
  </div>`;
}
