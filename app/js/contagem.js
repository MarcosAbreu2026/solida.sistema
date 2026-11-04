// Contagem do estoque feita no site (aba Estoque), no lugar da folha "ESTOQUE CHECKLIST VERIFICAÇÃO" escrita à mão.
// Quem conta (estagiário do galpão, ferramentas, diretoria) escolhe o local (galpão, carro ou obra), digita a quantidade ATUAL de cada item
// e salva. Fica gravado com data e responsável (tabela contagens_estoque, supabase/06-contagem-estoque.sql; no computador do escritório,
// em modo teste, só neste navegador). O site mostra a contagem por cima da planilha SL_FERRAMENTAS_SOLIDA_Rnn enquanto ela for mais nova
// que a "conferência" daquele local na planilha. A situação (comprar/consertar) continua vindo das contas da planilha.

import { html, numero, data as fmtData } from './formato.js';
import { hojeISO, somarDias } from './datas.js';
import { NA_NUVEM, sb, perfilAtual } from './nuvem.js';
import { sessao } from './sessao.js';
import { PODE_MOVIMENTAR } from './movimentacao.js';
import { CATEGORIAS, ORDEM } from './telas/estoque.js';

export const PODE_CONTAR = PODE_MOVIMENTAR;
const CHAVE = 'solida.contagemEstoque';
const DIAS = 120;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Lista de itens do GALPÃO (folha "ESTOQUE CHECKLIST VERIFICAÇÃO", 3 páginas), na ordem da folha. Os códigos da folha são de uma versão antiga da
// planilha (a planilha foi renumerada), por isso a lista casa por NOME. Nome diferente na planilha: ver APELIDOS_GALPAO.
const FOLHA_GALPAO = [
  "Cadeiras", "Kit Primeiros Socorros", "Mesa do escritório", "Bebedouro", "Cafeteira", "Estufa", "Mesa do refeitório", "Micro-ondas", "Pá Quadrada", "Régua",
  "Tapete de Obra", "Tecido Branco Lycra", "Alicate", "Arco de Serra", "Balde de Ferro", "Balde de Plástico", "Bandeja Rolo Grande", "Bandeja Rolo Pequeno",
  "Broxa", "Chave Allen", "Chave de Fenda", "Chave Philips", "Colher de Pedreiro", "Desempenadeira Dentada Metálica", "Desempenadeira Lisa Madeira/PVC", "Escova de Aço",
  "Espátula Metálica 12cm", "Espátula Metálica 6cm", "Espátula PVC 12cm", "Espátula PVC 6cm", "Esquadro de mão", "Esquadro Grande", "Estilete", "Formão", "Garfo para Rolo Grande",
  "Garfo para Rolo Pequeno 13cm", "Garfo para Rolo Pequeno 9cm", "Grampeador Pistola", "Marreta", "Martelo", "Martelo de Borracha", "Nível de Mão", "Painel de Ferramentas",
  "Pistola de Silicone", "Ponteira Manual", "Riscador de Rejunte", "Serrote Drywall", "Talhadeira Manual", "Trena", "Adesivo Plástico PVC", "Aguarrás", "Anel de Vedação",
  "Balão Teste Tubulação", "Bocal", "Caixa de Bucha", "Caixa de Parafuso", "Caixa de Prego", "Disco Esmerilhadeira - Ferro", "Disco Makita - Ferro", "Disco Makita - Madeira",
  "Disco Makita - Parede", "Disco Makita - Porcelanato", "Estopa Saco 400g", "F12 Branca", "F12 Madeira", "Fio 2.5mm", "Fita Crepe", "Fita Isolante", "Fita Teflon Grande",
  "Fita Telada para Trincas", "Fita Zebrada - Rolo", "Furadeira - Broca 10mm Concreto", "Furadeira - Broca 6mm Concreto", "Furadeira - Broca 8mm Concreto",
  "Furadeira - Kit de Brocas", "Gesso 5kg", "Gesso Cola", "Kit SOS Hidráulica", "Lâmina Starret", "Lápis de Carpinteiro", "Lixa Ferro 120", "Lixa Ferro 80",
  "Lixa Madeira 150", "Maçarico - Botija + Cilindro", "Mangueira Teste de Tubulação", "Martelete 3 kg - Broca 8mm", "Martelete 3 kg - Ponteira", "Martelete 3 kg - Talhadeira",
  "Martelete 5 kg - Ponteira", "Martelete 5 kg - Talhadeira", "Massa Acrílica", "Massa Zarcão", "Módulo de Interruptor", "Módulo de Tomada", "Niple Metal 1/2",
  "Niple PVC", "Parafusadeira - Kit de Bit", "Parafusadeira - Kit de Brocas", "Pedaço de Drywall", "Pedaço de Madeira", "Pedaço de Montante", "Pilhas AA",
  "Prego de Aço 15x15 - Saco", "Prego Sem Cabeça 60mm - Saco", "PU", "Rabicho Flexivel Inox 15", "Rebolo Diamantado 125mm", "Rejunte Branco - Saco", "Rolo Brasileirinho",
  "Rolo de Fio de Arame", "Rolo de Linha de Pedreiro", "Rolo de Papelão", "Rolo Pintura Espuma 10cm", "Rolo Pintura Espuma 15cm", "Rolo Pintura Lã Grande",
  "Rolo Plástico Preto", "Saco de Ráfia", "Serra Copo de Concreto", "Serra Copo de Madeira", "Silicone", "Trincha 2\"", "Trincha 4\"", "Veda Trinca", "Esmerilhadeira",
  "Extensão", "Extensor de Cabo 15m", "Furadeira", "Laser", "Maçarico", "Makita / Serra Mármore", "Martelete 3 kg", "Misturador Elétrico - Haste", "Parafusadeira",
  "Soprador Térmico", "Lixeira de Plástico 60l", "Pá de Lixo Pequena", "Pano de Chão", "Rodo", "Vassoura de Pelo", "Vassoura Piaçava", "Bota 40", "Bota 42",
  "Bota 44", "Bota 46", "Calça GG", "Calça M", "Calça P", "Camisa Azul G", "Camisa Azul GG", "Camisa Azul M", "Camisa Azul P", "Capa de Chuva", "Luva", "Luva de Vaqueta",
  "Máscara", "Óculos Escuros", "Óculos Transparente", "Protetor Auricular", "Refil Purificador", "Capacete Branco", "Capacete Verde", "Capacete Amarelo", "Capacete Azul",
  "Capacete Vermelho", "Capacete Laranja",
];
// nome na folha → nome na planilha (quando a planilha escreve diferente) ou { nome, cat } para escolher entre itens de mesmo nome
const APELIDOS_GALPAO = {
  'Tecido Branco Lycra': 'Tecido Branco Lycra 4m²', 'Alicate': 'Alicate Comum', 'Adesivo Plástico PVC': 'Adesivo Plástico PVC Pequeno', 'Aguarrás': 'Aguarrás Pequeno',
  'Balão Teste Tubulação': 'Balão Teste Tubulação, 50, 75 e 100ml', 'Disco Makita - Parede': 'Disco Makita - Parede (Concreto)', 'Gesso Cola': 'Gesso Cola - Saco 1kg',
  'Massa Acrílica': 'Massa Acrílica - Saco 25kg', 'Luva': 'Luva Pigmentada', 'Pano de Chão': { nome: 'Pano de Chão', cat: 'LIM' },
};

let linhas = [];            // contagens dos últimos DIAS dias (mais novas primeiro)
let ultimas = new Map();    // `${local}|${cod}` → contagem mais nova
let ultima = 0;
let aberta = false;         // a caixa lembra se estava aberta (a tela se redesenha ao salvar)
let dadosForm = null;       // dados do estoque (com as contagens aplicadas) usados na tabela do formulário

// ---------------------------------------------------------------- armazenamento
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { seq: 1, linhas: [] }; } catch { return { seq: 1, linhas: [] }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); return true; } catch { return false; } };

async function ler() {
  const de = somarDias(hojeISO(), -DIAS);
  if (!NA_NUVEM) return lerLocal().linhas.filter((x) => x.data >= de).sort((a, b) => `${b.data}${String(b.id).padStart(9, '0')}`.localeCompare(`${a.data}${String(a.id).padStart(9, '0')}`));
  const { data, error } = await sb.from('contagens_estoque').select('*').gte('data', de).order('data', { ascending: false }).order('id', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return data || [];
}
function guardar(rs) {
  linhas = rs; ultimas = new Map();
  for (const r of rs) { const k = `${r.local}|${r.cod}`; if (!ultimas.has(k)) ultimas.set(k, r); }   // vale a mais nova de cada local e item
}
export function garantir(redesenhar) {
  if (Date.now() - ultima < 30000) return;
  ultima = Date.now();
  ler().then((r) => { guardar(r); if (!emEdicao()) redesenhar(); }).catch(() => { ultima = 0; });
}
export function emEdicao() {
  const f = document.getElementById('cont-form');
  return !!f && [...f.querySelectorAll('input[data-c]')].some((i) => i.value.trim() !== '');
}

// ---------------------------------------------------------------- contagem por cima da planilha
// Devolve uma cópia dos dados do estoque com as quantidades contadas no site (só as mais novas que a conferência do local na planilha).
export function aplicar(dados) {
  if (!dados || !dados.itens || !ultimas.size) return dados;
  const d = JSON.parse(JSON.stringify(dados));
  const conf = d.conferido = d.conferido || {}; const via = d.viaSite = {};
  const locais = (d.locais || []).map((l) => l.id);
  const vale = (c, local) => c.data > (conf[local] || '');
  const marca = (local, c) => { if (!via[local] || c.data > via[local].data) via[local] = { data: c.data, por: c.responsavel }; };
  for (const i of d.itens) {
    for (const local of locais) {
      const c = ultimas.get(`${local}|${i.cod}`); if (!c || !vale(c, local)) continue;
      i.locais = i.locais || {}; const antes = num((i.locais[local] || {}).atual) || 0;
      i.locais[local] = { ...(i.locais[local] || { min: null }), atual: c.atual, contadoEm: c.data };
      if (num(i.totalAtual) != null) i.totalAtual += c.atual - antes;
      marca(local, c);
    }
    for (const obra of Object.keys(i.obras || {})) {
      const c = ultimas.get(`${obra}|${i.cod}`); if (!c || !vale(c, obra)) continue;
      const antes = num(i.obras[obra]) || 0; i.obras[obra] = c.atual;
      if (num(i.totalAtual) != null) i.totalAtual += c.atual - antes;
      marca(obra, c);
    }
  }
  for (const [local, v] of Object.entries(via)) conf[local] = v.data;
  return d;
}

// ---------------------------------------------------------------- tela
const ehObra = (dados, local) => !(dados.locais || []).some((l) => l.id === local);
function dadosDoItem(dados, i, local) {
  if (ehObra(dados, local)) return { min: num(i.minObra), atual: num((i.obras || {})[local]) };
  const x = (i.locais || {})[local] || {}; return { min: num(x.min), atual: num(x.atual) };
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// itens do galpão na ordem da folha, achados na planilha pelo nome; faltam = nomes da folha que a planilha não tem (ou tem com outro nome)
function listaGalpao(dados) {
  const itens = []; const faltam = []; const usados = new Set(); const porNome = new Map();
  for (const i of dados.itens || []) { const k = norm(i.item); if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(i); }
  for (const nome of FOLHA_GALPAO) {
    const ap = APELIDOS_GALPAO[nome]; const alvo = typeof ap === 'string' ? ap : (ap && ap.nome) || nome; const cat = ap && ap.cat;
    let cand = porNome.get(norm(alvo)) || [];
    if (cat) cand = cand.filter((i) => i.categoria === cat || String(i.cod).startsWith(cat));
    const i = cand.find((x) => !usados.has(x.cod));
    if (i) { usados.add(i.cod); itens.push(i); } else faltam.push(nome);
  }
  return { itens, faltam };
}
const agrupar = (itens) => { const gs = []; for (const i of itens) { const g = gs[gs.length - 1]; if (g && g.c === i.categoria) g.itens.push(i); else gs.push({ c: i.categoria, itens: [i] }); } return gs; };

function itensDoLocal(dados, local, todos) {
  if (local === 'galpao' && !todos) return listaGalpao(dados).itens;   // a folha do galpão
  return (dados.itens || []).filter((i) => {
    if (todos) return true;
    const x = dadosDoItem(dados, i, local);
    return num(x.min) > 0 || x.atual != null || (local === 'galpao' && num(i.minObra) > 0);
  });
}
const nomeLocal = (dados, local) => ((dados.locais || []).find((l) => l.id === local) || {}).nome || local;

function tabela(dados, local, todos) {
  const itens = itensDoLocal(dados, local, todos);
  const porFolha = local === 'galpao' && !todos;
  const faltam = porFolha ? listaGalpao(dados).faltam : [];
  const cats = porFolha ? agrupar(itens) : [...ORDEM, ...new Set(itens.map((i) => i.categoria).filter((c) => !ORDEM.includes(c)))].map((c) => ({ c, itens: itens.filter((i) => i.categoria === c) })).filter((g) => g.itens.length);
  if (!cats.length) return html`<p class="pequeno">Nenhum item cadastrado para este local. Marque "mostrar todos os itens".</p>`;
  return html`<div class="tabela-rolagem"><table class="tab cont-tab"><thead><tr><th>Cód.</th><th>Item</th><th class="n">Mín.</th><th class="n">Hoje no sistema</th><th>Contei agora</th><th>Obs.</th></tr></thead>
    ${cats.map((g) => html`<tbody class="cont-grupo"><tr class="est-cat"><th colspan="6">${CATEGORIAS[g.c] || g.c} <span class="pequeno">${g.itens.length} itens</span></th></tr>
      ${g.itens.map((i) => { const x = dadosDoItem(dados, i, local); return html`<tr data-texto="${`${i.cod} ${i.item}`.toLowerCase()}"><td class="est-cod">${i.cod}</td><td>${i.item}</td>
        <td class="n">${x.min == null ? '' : numero(x.min)}</td><td class="n">${x.atual == null ? '—' : numero(x.atual)}</td>
        <td><input class="cont-n" type="number" min="0" step="any" inputmode="decimal" data-c="${i.cod}" data-item="${i.item}" aria-label="Contagem de ${i.item}"></td>
        <td><input class="cont-o" data-o="${i.cod}" aria-label="Observação sobre ${i.item}" autocomplete="off"></td></tr>`; })}</tbody>`)}</table></div>
    ${faltam.length ? html`<p class="pequeno">Da folha do galpão, <b>${faltam.length}</b> ${faltam.length === 1 ? 'item não está' : 'itens não estão'} na planilha com esse nome: ${faltam.join(', ')}. Para contar, marque "mostrar todos os itens" e procure pelo nome na planilha.</p>` : ''}`;
}

const podeApagar = (s) => (NA_NUVEM ? (perfilAtual() && (s.criado_por === perfilAtual().id || sessao().funcao === 'socio')) : true);
function sessoes() {
  const m = new Map();
  for (const r of linhas) { const k = `${r.data}|${r.local}|${r.criado_por}`; const s = m.get(k) || { data: r.data, local: r.local, responsavel: r.responsavel, criado_por: r.criado_por, n: 0 }; s.n++; m.set(k, s); }
  return [...m.values()].slice(0, 12);
}

export function caixa({ dados, abrir = false }) {
  dadosForm = dados;
  const nome = sessao().nome || '';
  const locais = [...(dados.locais || []).map((l) => [l.id, l.nome]), ...(dados.obras || []).map((o) => [o, `Obra ${o}`])];
  const ss = sessoes();
  return html`<details class="caixa mov-caixa cont-caixa" id="cont-caixa" ${aberta || abrir ? html.seguro('open') : ''}>
    <summary><span class="caixa-tit">Contagem do estoque</span><span class="pequeno">conte e digite a quantidade atual de cada item (no lugar da folha escrita à mão)</span></summary>
    <div class="caixa-corpo">
      <p class="pequeno">Escolha o local, digite só os itens que você contou e salve. Item deixado em branco não muda. Contar de novo no mesmo dia e local substitui a contagem anterior. O número fica gravado com data e seu nome e aparece no estoque do site; "comprar" e "consertar" continuam vindo da planilha.</p>
      <form id="cont-form" autocomplete="off">
        <div class="cont-cab">
          <label>Local<select name="local" id="cont-local">${locais.map(([id, n]) => html`<option value="${id}">${n}</option>`)}</select></label>
          <label>Data da contagem<input type="date" name="data" value="${hojeISO()}" required></label>
          <label>Responsável<input name="responsavel" value="${nome}" required></label>
          <label>Procurar item<input type="search" id="cont-busca" placeholder="ex.: furadeira, FER12" autocomplete="off"></label>
          <label class="cont-todos"><span><input type="checkbox" id="cont-todos"> mostrar todos os itens</span></label>
        </div>
        <div id="cont-linhas">${tabela(dados, 'galpao', false)}</div>
        <p class="mov-acoes"><button type="submit" class="botao on">Salvar contagem</button> <span class="pequeno" data-cont-msg></span></p>
      </form>
      ${ss.length ? html`<h4>Contagens recentes</h4><table class="tab mov-tab"><thead><tr><th>Data</th><th>Local</th><th class="n">Itens</th><th>Responsável</th><th></th></tr></thead><tbody>
        ${ss.map((s) => html`<tr><td>${fmtData(s.data).slice(0, 5)}</td><td>${nomeLocal(dados, s.local)}</td><td class="n">${s.n}</td><td>${s.responsavel}</td>
          <td>${podeApagar(s) ? html`<button type="button" class="ac-mini" data-cont-apagar="${s.data}|${s.local}|${s.criado_por}">apagar</button>` : ''}</td></tr>`)}</tbody></table>` : ''}
    </div></details>`;
}

// ---------------------------------------------------------------- ações
const msg = (t) => { const e = document.querySelector('[data-cont-msg]'); if (e) e.textContent = t; };

async function salvar(form, redesenhar) {
  const fd = new FormData(form);
  const local = String(fd.get('local') || ''); const data = String(fd.get('data') || ''); const responsavel = String(fd.get('responsavel') || '').trim();
  if (!local || !data || !responsavel) { msg('Preencha o local, a data e o responsável.'); return; }
  const rows = [];
  for (const inp of form.querySelectorAll('input[data-c]')) {
    const bruto = inp.value.trim(); if (bruto === '') continue;
    const v = Number(bruto.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) { msg(`Quantidade inválida em ${inp.dataset.item}.`); inp.focus(); return; }
    const obs = (form.querySelector(`input[data-o="${inp.dataset.c}"]`) || {}).value || '';
    rows.push({ data, local, cod: inp.dataset.c, item: inp.dataset.item, atual: v, obs: obs.trim() || null, responsavel });
  }
  if (!rows.length) { msg('Digite a quantidade de pelo menos um item.'); return; }
  msg('Salvando…');
  try {
    if (NA_NUVEM) {
      const { error } = await sb.from('contagens_estoque').upsert(rows.map((r) => ({ ...r, criado_por: perfilAtual().id })), { onConflict: 'data,local,cod' });
      if (error) throw new Error(error.message);
    } else {
      const l = lerLocal();
      for (const r of rows) { const i = l.linhas.findIndex((x) => x.data === r.data && x.local === r.local && x.cod === r.cod); if (i >= 0) l.linhas[i] = { ...l.linhas[i], ...r }; else l.linhas.unshift({ id: l.seq++, ...r, criado_por: 'local', criado_em: new Date().toISOString() }); }
      if (!gravarLocal(l)) throw new Error('sem espaço neste navegador');
    }
    guardar(await ler()); ultima = Date.now();
    form.reset(); redesenhar();
    msg(`${rows.length} ${rows.length === 1 ? 'item contado' : 'itens contados'}. O estoque do site já mostra os números novos.`);
  } catch (err) { msg(`Não consegui salvar (${err.message || err}).`); }
}

async function apagar(chave, redesenhar) {
  const [data, local, por] = chave.split('|');
  if (!confirm('Apagar esta contagem inteira (todos os itens daquele dia e local)?')) return;
  try {
    if (NA_NUVEM) { const { error } = await sb.from('contagens_estoque').delete().eq('data', data).eq('local', local).eq('criado_por', por); if (error) throw new Error(error.message); }
    else { const l = lerLocal(); l.linhas = l.linhas.filter((x) => !(x.data === data && x.local === local)); gravarLocal(l); }
    guardar(await ler()); ultima = Date.now(); redesenhar();
  } catch (err) { alert(`Não foi possível apagar (${err.message || err}).`); }
}

let ligado = false;
export function ligar(redesenhar) {
  if (ligado) return; ligado = true;
  document.addEventListener('toggle', (e) => { if (e.target.id === 'cont-caixa') aberta = e.target.open; }, true);
  document.addEventListener('submit', (e) => { if (e.target.id === 'cont-form') { e.preventDefault(); salvar(e.target, redesenhar); } });
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'cont-local' && e.target.id !== 'cont-todos') return;
    const local = (document.getElementById('cont-local') || {}).value; const todos = !!(document.getElementById('cont-todos') || {}).checked;
    const box = document.getElementById('cont-linhas'); if (!box || !dadosForm) return;
    if (emEdicao() && !confirm('Você já digitou números. Trocar o local apaga o que está na tela. Continuar?')) { if (e.target.id === 'cont-local') e.target.value = e.target.dataset.antes || e.target.value; return; }
    box.innerHTML = String(tabela(dadosForm, local, todos)); if (e.target.id === 'cont-local') e.target.dataset.antes = local;
  });
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'cont-busca') return;
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#cont-linhas tr[data-texto]').forEach((tr) => { tr.hidden = !!q && !tr.dataset.texto.includes(q); });
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-cont-apagar]'); if (b) apagar(b.dataset.contApagar, redesenhar);
  });
}
