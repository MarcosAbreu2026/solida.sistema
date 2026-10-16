// Comercial e orçamentos: Resumo (agente) · Orçamentos · Arquiteturas. Só consulta.
// Fonte: SL_ORÇAMENTOS<ano> no Drive (ORÇAMENTOS\), lida por scripts/exportar-drive.ps1.
// A situação de cada orçamento é a cor da linha na planilha (legenda no topo dela).

import { html, numero } from '../formato.js';
import { hojeISO } from '../datas.js';

export const ABAS_COMERCIAL = [
  { id: '', nome: 'Resumo' },
  { id: 'orcamentos', nome: 'Orçamentos' },
  { id: 'arquiteturas', nome: 'Arquiteturas' },
];

const SITUACOES = {
  em_orcamento: 'Em orçamento', aguardando: 'Aguardando arq/forn', enviado: 'Enviado',
  nao_fechado: 'Não fechado', fechado: 'Fechado',
};

// ---------------------------------------------------------------- contas

const comValor = (xs, k) => xs.map((x) => x[k]).filter((v) => typeof v === 'number' && v > 0);
const media = (vs) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
function mediana(vs) {
  if (!vs.length) return null;
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const rm2 = (xs) => xs.filter((x) => x.valor > 0 && x.area > 0).map((x) => x.valor / x.area);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

const REAIS_INTEIRO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtReais = (v) => (v == null ? '—' : v >= 1e6 ? `R$ ${numero(Math.round(v / 1e5) / 10)} mi` : REAIS_INTEIRO.format(Math.round(v)));
const fmtNum = (v, un) => (v == null ? '—' : `${numero(Math.round(v))}${un ? ` ${un}` : ''}`);

// Tipo de obra: junta grafias diferentes da mesma coisa
function tipoNormal(t) {
  const s = String(t || '').trim().toLowerCase();
  if (!s || s === '-') return 'Não informado';
  if (/^(ap|apto|apartamento|apto\.?)s?$|duplex|cobertura/.test(s)) return 'Apartamento';
  if (/^casas?\b/.test(s)) return 'Casa';
  if (/escrit|sala|come?rc|comecial|loja|consult|quiosque|ag[êe]ncia/.test(s)) return 'Comercial / escritório';
  if (/col[ée]gio|escola|refeit|quadra|audit|telhado/.test(s)) return 'Escola / colégio';
  if (/c[ôo]modo|su[íi]te|lavabo|banheiro|coz|est[úu]dio/.test(s)) return 'Cômodos / reforma pontual';
  if (/edif|resid|garage|anexo|almox/.test(s)) return 'Edifício / áreas comuns';
  if (/dem/.test(s)) return 'Demolição';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FAIXAS_AREA = [[0, 50, 'até 50 m²'], [50, 100, '50 a 100 m²'], [100, 200, '100 a 200 m²'], [200, 500, '200 a 500 m²'], [500, Infinity, 'acima de 500 m²']];
const FAIXAS_TEMPO = [[0, 4, 'até 4 semanas'], [4, 12, '5 a 12 semanas'], [12, 26, '13 a 26 semanas'], [26, Infinity, 'acima de 26 semanas']];

function resumo(xs) {
  const fech = xs.filter((x) => x.situacao === 'fechado');
  const nao = xs.filter((x) => x.situacao === 'nao_fechado');
  return {
    n: xs.length, fech: fech.length, nao: nao.length,
    conv: pct(fech.length, fech.length + nao.length),
    valor: media(comValor(xs, 'valor')), valorFech: media(comValor(fech, 'valor')),
    area: media(comValor(xs, 'area')), areaFech: media(comValor(fech, 'area')),
    sem: media(comValor(xs, 'semanas')), semFech: media(comValor(fech, 'semanas')),
  };
}

// ---------------------------------------------------------------- Orçamentos

export function abaOrcamentos(dados, anoSel) {
  if (!dados) return semDados();
  const todos = dados.orcamentos || [];
  const anos = [...new Set(todos.map((o) => o.ano))].sort();
  const ano = anos.includes(Number(anoSel)) ? Number(anoSel) : anos[anos.length - 1];
  const xs = todos.filter((o) => o.ano === ano);
  const fonte = (dados.fontes || []).find((f) => f.ano === ano) || {};
  const porSit = Object.fromEntries(Object.keys(SITUACOES).map((k) => [k, xs.filter((x) => x.situacao === k)]));
  const fech = porSit.fechado;
  const nao = porSit.nao_fechado;
  const comNF = fech.filter((x) => x.nf).length;
  const orcados = comValor(xs, 'valor');
  const aprovados = comValor(fech, 'valor');
  const r = resumo(xs);

  const seletor = html`<div class="periodo">
    ${anos.map((a) => html`<button type="button" class="botao ${a === ano ? 'on' : ''}" data-ano="${a}" ${a === ano ? html.seguro('aria-pressed="true"') : ''}>${a}</button>`)}
    <div class="atual"><span>Planilha</span><b style="font-size:15px">${fonte.arquivo || '—'}</b></div>
  </div>`;

  const cards = html`<div class="cards" style="margin-top:22px">
    <div class="card"><div class="card-valor">${xs.length}</div><div class="card-rotulo">Orçamentos em ${ano}${ano === Number(hojeISO().slice(0, 4)) ? ' (até hoje)' : ''}</div>
      <div class="card-sub">${porSit.em_orcamento.length} em orçamento · ${porSit.aguardando.length} aguardando · ${porSit.enviado.length} enviados</div></div>
    <div class="card"><div class="card-valor">${fech.length}</div><div class="card-rotulo">Fechados</div>
      <div class="card-sub">${comNF < fech.length ? `${comNF} com número NF na planilha · ` : ''}${nao.length} não fechados</div></div>
    <div class="card"><div class="card-valor">${r.conv == null ? '—' : `${r.conv}%`}</div><div class="card-rotulo">Conversão</div>
      <div class="card-sub">fechados ÷ (fechados + não fechados) · meta ≥ 25%${comNF < fech.length ? ` · ${pct(comNF, comNF + nao.length)}% contando só os ${comNF} com NF` : ''}</div></div>
    <div class="card"><div class="card-valor">${fmtReais(media(orcados))}</div><div class="card-rotulo">Valor médio orçado</div>
      <div class="card-sub">${orcados.length} orçamentos com valor · mediana ${fmtReais(mediana(orcados))}</div></div>
    <div class="card"><div class="card-valor">${fmtReais(media(aprovados))}</div><div class="card-rotulo">Valor médio aprovado</div>
      <div class="card-sub">${aprovados.length} fechados com valor · mediana ${fmtReais(mediana(aprovados))}</div></div>
  </div>`;

  const linhaComp = (rotulo, f) => html`<tr><td>${rotulo}</td>${[xs, fech, nao].map((g) => html`<td>${f(g)}</td>`)}</tr>`;
  const comparativo = html`<section class="secao">
    <div class="painel-h" style="margin-bottom:14px"><h2>Orçados × aprovados</h2><p>Médias de ${ano}. Orçamentos sem o dado não entram na média.</p></div>
    <div class="tabela-rolagem"><table class="tab">
      <thead><tr><th></th><th>Todos os orçados</th><th>Aprovados (fechados)</th><th>Não fechados</th></tr></thead>
      <tbody>
        ${linhaComp('Valor médio', (g) => fmtReais(media(comValor(g, 'valor'))))}
        ${linhaComp('Área média', (g) => fmtNum(media(comValor(g, 'area')), 'm²'))}
        ${linhaComp('Tempo médio de obra', (g) => fmtNum(media(comValor(g, 'semanas')), 'semanas'))}
        ${linhaComp('R$ por m² (médio)', (g) => fmtReais(media(rm2(g))))}
        ${linhaComp('Quantidade', (g) => g.length)}
      </tbody></table></div>
  </section>`;

  const tabelaGrupo = (titulo, sub, grupos, comRm2 = false) => html`<section class="secao">
    <div class="painel-h" style="margin-bottom:14px"><h2>${titulo}</h2><p>${sub} Orçados = fechados + não fechados + em aberto. Conversão = fechados ÷ (fechados + não fechados): o que ainda está em aberto não entra.</p></div>
    <div class="tabela-rolagem"><table class="tab ordenavel">
      <thead><tr><th></th><th>Orçados</th><th>Fechados</th><th title="Orçamentos que o cliente recusou ou não respondeu">Não fechados</th><th title="Ainda sem resposta: em orçamento, aguardando arquitetura/fornecedor ou enviados">Em aberto</th><th title="Fechados ÷ (fechados + não fechados). Os em aberto ainda não entram na conta.">Conversão</th><th>Valor médio orçado</th><th>Valor médio aprovado</th><th>Área média</th><th>Tempo médio</th>${comRm2 ? html`<th title="Média do valor ÷ área de cada orçamento fechado que tem os dois dados">R$/m² médio fechado</th>` : ''}</tr></thead>
      <tbody>${grupos.filter((g) => g.xs.length).map((g) => { const s = resumo(g.xs); return html`<tr>
        <td><b>${g.nome}</b></td><td>${s.n}</td><td>${s.fech}</td><td>${s.nao}</td><td>${s.n - s.fech - s.nao}</td>
        <td>${s.conv == null ? html`<span class="muted">sem resposta</span>` : `${s.conv}%`}</td>
        <td>${fmtReais(s.valor)}</td><td>${fmtReais(s.valorFech)}</td>
        <td>${fmtNum(s.area, 'm²')}</td><td>${fmtNum(s.sem, 'sem.')}</td>${comRm2 ? html`<td>${fmtReais(media(rm2(g.xs.filter((x) => x.situacao === 'fechado'))))}</td>` : ''}</tr>`; })}</tbody>
    </table></div></section>`;

  const tipos = [...new Set(xs.map((x) => tipoNormal(x.tipo)))]
    .map((t) => ({ nome: t, xs: xs.filter((x) => tipoNormal(x.tipo) === t) }))
    .sort((a, b) => b.xs.length - a.xs.length);
  const porFaixa = (faixas, k) => [
    ...faixas.map(([de, ate, nome]) => ({ nome, xs: xs.filter((x) => x[k] > de && x[k] <= ate) })),
    { nome: 'Não informado', xs: xs.filter((x) => !(x[k] > 0)) },
  ];

  const lista = html`<details class="caixa"><summary><span class="caixa-tit">Todos os orçamentos de ${ano} (${xs.length})</span><span class="pequeno">clique para ver</span></summary>
    <div class="tabela-rolagem" style="margin:0 22px 18px"><table class="tab ordenavel">
      <thead><tr><th>Ref.</th><th>Arquitetura</th><th>Cliente</th><th>Tipo</th><th>Área</th><th>Valor</th><th>Tempo</th><th>Situação</th><th>Observações</th></tr></thead>
      <tbody>${[...xs].reverse().map((x) => html`<tr>
        <td class="cod">${x.ref}</td><td>${x.arq || html`<span class="muted">—</span>`}</td><td>${x.cliente || ''}</td><td>${x.tipo || ''}</td>
        <td>${x.area ? `${numero(x.area)} m²` : ''}</td><td>${x.valor ? fmtReais(x.valor) : ''}</td><td>${x.semanas ? `${numero(x.semanas)} sem.` : ''}</td>
        <td>${x.situacao ? html`<span class="sit-orc ${x.situacao}">${SITUACOES[x.situacao]}</span>` : html`<span class="muted">sem cor</span>`}${x.situacao === 'fechado' && !x.nf ? html`<div class="pequeno">sem número NF</div>` : ''}</td>
        <td class="pequeno">${x.obs || ''}</td></tr>`)}</tbody>
    </table></div></details>`;

  return html`<div>
    ${seletor}${cards}${comparativo}
    ${tabelaGrupo('Por tipo de obra', 'O que mais orçamos e o que mais fecha.', tipos, true)}
    ${tabelaGrupo('Por área', 'Tamanho da obra orçada (m²).', porFaixa(FAIXAS_AREA, 'area'), true)}
    ${tabelaGrupo('Por tempo de obra', 'Prazo previsto no orçamento (semanas).', porFaixa(FAIXAS_TEMPO, 'semanas'), true)}
    ${lista}
    <p class="pequeno" style="margin-top:18px">Situação = cor da linha na planilha (legenda no topo dela). Valor = valor total; quando vazio, valor da obra cinza.</p>
  </div>`;
}

// ---------------------------------------------------------------- Arquiteturas

// Junta grafias diferentes do mesmo escritório ("Kava Arq." = "Kava Arq"; "Estúdio Pindó" = "Pindó")
function chaveArq(nome) {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(arq(uitetura|uitetos|uiteta)?|escritorio|atelie[r]?)\b\.?/g, ' ')
    .replace(/\b(estudio|studio)/g, ' ')
    .replace(/[^a-z0-9&]+/g, ' ').trim();
}

export function abaArquiteturas(dados) {
  if (!dados) return semDados();
  const todos = (dados.orcamentos || []).filter((o) => o.arq && o.arq.trim() && o.arq.trim() !== '-');
  const anos = [...new Set((dados.orcamentos || []).map((o) => o.ano))].sort();
  const atual = anos[anos.length - 1];
  const anteriores = anos.filter((a) => a < atual);
  const grupos = new Map();
  for (const o of todos) {
    const k = chaveArq(o.arq);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, { nomes: {}, itens: [] });
    const g = grupos.get(k);
    g.nomes[o.arq.trim()] = (g.nomes[o.arq.trim()] || 0) + 1;
    g.itens.push(o);
  }
  const arqs = [...grupos.values()].map((g) => {
    const nome = Object.entries(g.nomes).sort((a, b) => b[1] - a[1])[0][0];
    const porAno = Object.fromEntries(anos.map((a) => [a, g.itens.filter((o) => o.ano === a).length]));
    const fech = g.itens.filter((o) => o.situacao === 'fechado');
    const nao = g.itens.filter((o) => o.situacao === 'nao_fechado');
    const antes = anteriores.reduce((s, a) => s + porAno[a], 0);
    const mediaAntes = anteriores.length ? antes / anteriores.length : 0;
    const ultimo = g.itens.reduce((m, o) => (o.ano > m.ano || (o.ano === m.ano && String(o.ref) > String(m.ref)) ? o : m), g.itens[0]);
    return {
      nome, porAno, total: g.itens.length, fech: fech.length, conv: pct(fech.length, fech.length + nao.length),
      valorFech: fech.reduce((s, o) => s + (o.valor || 0), 0), atual: porAno[atual], antes, mediaAntes, ultimo,
      obrasFechadas: fech.map((o) => `${o.ref}${o.cliente ? ` (${o.cliente.trim()})` : ''}`),
    };
  });

  // Reatar: mandavam antes e caíram este ano (zero, ou menos da metade da média dos anos anteriores)
  const reatar = arqs
    .filter((a) => a.antes >= 2 && a.atual < Math.max(1, a.mediaAntes / 2 + 0.01))
    .sort((a, b) => b.fech - a.fech || b.antes - a.antes);
  const topAtual = arqs.filter((a) => a.atual > 0).sort((a, b) => b.atual - a.atual || b.fech - a.fech).slice(0, 10);
  const menosAtual = arqs.filter((a) => a.atual > 0 && a.atual <= 1 && !reatar.includes(a)).sort((a, b) => b.antes - a.antes);

  const linhaAnos = (a) => anos.map((ano) => html`<td class="${ano === atual ? 'num-destaque' : ''}">${a.porAno[ano] || html`<span class="muted">0</span>`}</td>`);

  return html`<div>
    <section class="secao" style="margin-top:0">
      <div class="alerta-semana alerta-topo">
        <b>Reatar contato: ${reatar.length} arquiteturas que mandavam orçamentos e pararam ou caíram em ${atual}</b>
        <span class="pequeno" style="color:inherit">Primeiro as que já fecharam obra com a Sólida.</span>
      </div>
      <div class="tabela-rolagem"><table class="tab ordenavel">
        <thead><tr><th>Arquitetura</th>${anos.map((a) => html`<th>${a}</th>`)}<th>Fechou com a Sólida</th><th>Último orçamento</th></tr></thead>
        <tbody>${reatar.map((a) => html`<tr>
          <td><b>${a.nome}</b></td>${linhaAnos(a)}
          <td>${a.fech ? html`<b>${a.fech} obra${a.fech > 1 ? 's' : ''}</b><div class="pequeno">${a.obrasFechadas.join(' · ')}</div>` : html`<span class="muted">nenhuma</span>`}</td>
          <td>${a.ultimo.ref} <span class="pequeno">(${a.ultimo.ano}${a.ultimo.cliente ? ` · ${a.ultimo.cliente.trim()}` : ''})</span></td></tr>`)}</tbody>
      </table></div>
    </section>

    <section class="secao">
      <div class="painel-h" style="margin-bottom:14px"><h2>Quem mais envia em ${atual}</h2><p>As 10 arquiteturas com mais orçamentos no ano.</p></div>
      <div class="tabela-rolagem"><table class="tab ordenavel">
        <thead><tr><th>Arquitetura</th>${anos.map((a) => html`<th>${a}</th>`)}<th>Fechados (todos os anos)</th><th>Conversão</th></tr></thead>
        <tbody>${topAtual.map((a) => html`<tr><td><b>${a.nome}</b></td>${linhaAnos(a)}<td>${a.fech}</td><td>${a.conv == null ? html`<span class="muted">—</span>` : `${a.conv}%`}</td></tr>`)}</tbody>
      </table></div>
    </section>

    ${menosAtual.length ? html`<section class="secao">
      <div class="painel-h" style="margin-bottom:14px"><h2>Quem menos enviou em ${atual}</h2><p>Mandaram só 1 orçamento no ano e já tinham mandado antes. As que caíram muito estão em "Reatar contato".</p></div>
      <div class="tabela-rolagem"><table class="tab ordenavel">
        <thead><tr><th>Arquitetura</th>${anos.map((a) => html`<th>${a}</th>`)}<th>Fechados (todos os anos)</th></tr></thead>
        <tbody>${menosAtual.filter((a) => a.antes).map((a) => html`<tr><td><b>${a.nome}</b></td>${linhaAnos(a)}<td>${a.fech}</td></tr>`)}</tbody>
      </table></div>
      ${menosAtual.some((a) => !a.antes) ? html`<details class="caixa" style="margin-top:18px"><summary><span class="caixa-tit">Primeiro orçamento em ${atual} (${menosAtual.filter((a) => !a.antes).length})</span><span class="pequeno">arquiteturas novas: clique para ver</span></summary>
        <p style="margin:0 22px 18px;line-height:1.8">${menosAtual.filter((a) => !a.antes).map((a) => a.nome).join(' · ')}</p></details>` : ''}
    </section>` : ''}

    <details class="caixa"><summary><span class="caixa-tit">Todas as arquiteturas (${arqs.length})</span><span class="pequeno">clique para ver</span></summary>
      <div class="tabela-rolagem" style="margin:0 22px 18px"><table class="tab ordenavel">
        <thead><tr><th>Arquitetura</th>${anos.map((a) => html`<th>${a}</th>`)}<th>Total</th><th>Fechados</th><th>Conversão</th></tr></thead>
        <tbody>${[...arqs].sort((a, b) => b.total - a.total).map((a) => html`<tr><td>${a.nome}</td>${linhaAnos(a)}<td>${a.total}</td><td>${a.fech}</td><td>${a.conv == null ? '—' : `${a.conv}%`}</td></tr>`)}</tbody>
      </table></div></details>
    <p class="pequeno" style="margin-top:18px">Coluna ARQ das planilhas de orçamento de ${anos[0]} a ${atual} (${atual} até hoje). Grafias parecidas do mesmo escritório foram juntadas. Orçamentos sem arquitetura (cliente direto) não entram.</p>
  </div>`;
}

function semDados() {
  return html`<div class="erro">Ainda não li as planilhas de orçamento no Drive. Confira se o Google Drive para computador está aberto (pasta G:) e recarregue em 1 minuto.</div>`;
}
