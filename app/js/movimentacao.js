// Guia de movimentação do galpão (SL_MOVIMENTAÇÃO_R01, página 1), dentro da aba Estoque.
// O estagiário do galpão preenche as linhas (item, qtd, origem, destino, obs) ou envia a foto da folha preenchida.
// O estoque mostrado na tela continua vindo da planilha do Drive: aqui só se REGISTRA o que foi movimentado
// (quem consolida na Planilha Mestre é o gestor de ferramentas, POP 12.1).
// Na nuvem: tabelas movimentacoes_galpao e movimentacoes_fotos (supabase/05-movimentacao-galpao.sql) e a foto vai
// para o armazenamento "fotos"; no computador do escritório (modo teste) fica só neste navegador.

import { html, data as fmtData } from './formato.js';
import { hojeISO, somarDias } from './datas.js';
import { NA_NUVEM, sb, perfilAtual } from './nuvem.js';
import { sessao } from './sessao.js';

// quem registra: diretoria, administrativo, ferramentas/EPI/transporte e o estagiário do galpão
export const PODE_MOVIMENTAR = ['socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'];
const FIXOS = ['GALPÃO', 'MANUTENÇÃO', 'DESCARTE'];
const CHAVE = 'solida.movGalpao';
const DIAS = 30;

let linhas = []; let fotos = []; let ultima = 0; let ctx = { itens: [], obras: [] };

// ---------------------------------------------------------------- armazenamento
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { seq: 1, linhas: [], fotos: [] }; } catch { return { seq: 1, linhas: [], fotos: [] }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); return true; } catch { return false; } };

async function ler() {
  const de = somarDias(hojeISO(), -DIAS);
  if (!NA_NUVEM) { const l = lerLocal(); return { linhas: l.linhas.filter((x) => x.data >= de), fotos: l.fotos.filter((x) => x.data >= de) }; }
  const [a, b] = await Promise.all([
    sb.from('movimentacoes_galpao').select('*').gte('data', de).order('data', { ascending: false }).order('id', { ascending: false }).limit(300),
    sb.from('movimentacoes_fotos').select('*').gte('data', de).order('data', { ascending: false }).order('id', { ascending: false }).limit(100),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);
  return { linhas: a.data || [], fotos: b.data || [] };
}

// (re)lê da nuvem quando entra na aba; depois de ler, redesenha a tela (se não estiver no meio de um preenchimento)
export function garantir(redesenhar) {
  if (Date.now() - ultima < 30000) return;
  ultima = Date.now();
  ler().then((r) => { linhas = r.linhas; fotos = r.fotos; if (!emEdicao()) redesenhar(); }).catch(() => { ultima = 0; });
}

// o formulário tem coisa digitada (ou foto escolhida): a tela não pode se redesenhar sozinha, senão perde o que foi escrito
export function emEdicao() {
  const f = document.getElementById('mov-form'); const g = document.getElementById('mov-foto-form');
  if (f && [...f.querySelectorAll('[name=item],[name=qtd],[name=obs]')].some((i) => i.value.trim())) return true;
  return !!(g && g.elements.foto && g.elements.foto.files && g.elements.foto.files.length);
}

// ---------------------------------------------------------------- tela
const hoje = () => hojeISO();
function linhaForm(v = {}) {
  return html`<div class="mov-linha">
    <label class="mov-item">Item / ferramenta<input name="item" list="mov-itens" value="${v.item || ''}" placeholder="ex.: Furadeira" autocomplete="off"></label>
    <label class="mov-qtd">Qtd<input name="qtd" type="number" min="0.01" step="any" inputmode="decimal" value="${v.qtd || ''}" placeholder="1"></label>
    <label>Origem<input name="origem" list="mov-locais" value="${v.origem || 'GALPÃO'}" placeholder="GALPÃO ou obra" autocomplete="off"></label>
    <label>Destino<input name="destino" list="mov-locais" value="${v.destino || ''}" placeholder="obra, MANUTENÇÃO…" autocomplete="off"></label>
    <label class="mov-obs">Obs<input name="obs" value="${v.obs || ''}" autocomplete="off"></label>
    <button type="button" class="ac-mini mov-tirar" data-mov-tirar title="Tirar esta linha">×</button>
  </div>`;
}

const quando = (x) => fmtData(x.data).slice(0, 5);
const podeApagar = (x) => (NA_NUVEM ? (perfilAtual() && (x.criado_por === perfilAtual().id || sessao().funcao === 'socio')) : true);

// ctx = { itens: [{cod,item}], obras: ['Mo465', …] } vindo da planilha de estoque
export function caixa(c) {
  ctx = c || ctx;
  const locais = [...FIXOS, ...(ctx.obras || [])];
  const nome = sessao().nome || '';
  return html`<details class="caixa mov-caixa" id="mov-caixa" open>
    <summary><span class="caixa-tit">Guia de movimentação do galpão</span><span class="pequeno">registre o que saiu, entrou, foi para manutenção ou descarte — ou envie a foto da folha preenchida</span></summary>
    <div class="caixa-corpo">
      <h4>Preencher aqui</h4>
      <p class="pequeno">Igual à folha SL_MOVIMENTAÇÃO R01: cada linha é uma movimentação. Em origem e destino escreva GALPÃO, o nome da obra, MANUTENÇÃO ou DESCARTE. Preencha na hora em que movimentar. Ao registrar, fica gravado seu nome e a hora (no lugar da assinatura).</p>
      <form id="mov-form" autocomplete="off">
        <div class="mov-cab">
          <label>Data<input type="date" name="data" value="${hoje()}" required></label>
          <label>Responsável<input name="responsavel" value="${nome}" required></label>
        </div>
        <div class="mov-linhas">${linhaForm()}</div>
        <p class="mov-acoes"><button type="button" class="botao" data-mov-mais>+ outra linha</button>
          <button type="submit" class="botao on">Registrar movimentações</button> <span class="pequeno mov-msg" data-mov-msg></span></p>
        <datalist id="mov-itens">${(ctx.itens || []).map((i) => html`<option value="${i.item}" label="${i.cod}"></option>`)}</datalist>
        <datalist id="mov-locais">${locais.map((l) => html`<option value="${l}"></option>`)}</datalist>
      </form>

      <h4>Ou enviar a foto da folha preenchida</h4>
      <p class="pequeno">Tire a foto da folha com todas as linhas preenchidas e assinadas, deixe legível e envie. Vale no mesmo dia, no lugar de mandar pelo WhatsApp.</p>
      <form id="mov-foto-form" class="mov-foto">
        <label>Data da folha<input type="date" name="data" value="${hoje()}" required></label>
        <label>Responsável<input name="responsavel" value="${nome}" required></label>
        <label class="mov-arq">Foto<input type="file" name="foto" accept="image/*" capture="environment" required></label>
        <label class="mov-obs">Observação<input name="obs" autocomplete="off" placeholder="opcional"></label>
        <button type="submit" class="botao on">Enviar foto</button> <span class="pequeno" data-mov-msg-foto></span>
      </form>

      <h4>Registradas nos últimos ${DIAS} dias</h4>
      ${lista()}
    </div>
  </details>`;
}

function lista() {
  const fl = fotos.length ? html`<table class="tab mov-tab"><thead><tr><th>Data</th><th>Foto da folha</th><th>Enviada por</th><th>Obs</th><th></th></tr></thead><tbody>
    ${fotos.map((x) => html`<tr><td>${quando(x)}</td><td><button type="button" class="ac-mini" data-mov-ver="${x.id}">ver foto</button></td><td>${x.responsavel}</td><td>${x.obs || ''}</td>
      <td>${podeApagar(x) ? html`<button type="button" class="ac-mini" data-mov-apagar-foto="${x.id}">apagar</button>` : ''}</td></tr>`)}</tbody></table>` : '';
  const tl = linhas.length ? html`<table class="tab mov-tab"><thead><tr><th>Data</th><th>Item</th><th>Qtd</th><th>Origem → destino</th><th>Obs</th><th>Responsável</th><th></th></tr></thead><tbody>
    ${linhas.map((x) => html`<tr><td>${quando(x)}</td><td>${x.item}</td><td>${x.qtd}</td><td>${x.origem} → <b>${x.destino}</b></td><td>${x.obs || ''}</td><td>${x.responsavel}</td>
      <td>${podeApagar(x) ? html`<button type="button" class="ac-mini" data-mov-apagar="${x.id}">apagar</button>` : ''}</td></tr>`)}</tbody></table>` : '';
  if (!fl.toString() && !tl.toString()) return html`<p class="pequeno">Nada registrado ainda.</p>`;
  return html`${tl}${fl}`;
}

// ---------------------------------------------------------------- ações
const msg = (sel, t) => { const el = document.querySelector(sel); if (el) el.textContent = t; };

// reduz a foto (celular tira foto de vários MB) antes de enviar
async function reduzir(arquivo) {
  try {
    const bmp = await createImageBitmap(arquivo);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b || arquivo), 'image/jpeg', 0.8));
  } catch { return arquivo; }
}
const comoDataUrl = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });

async function registrar(form, redesenhar) {
  const fd = new FormData(form);
  const data = String(fd.get('data') || ''); const responsavel = String(fd.get('responsavel') || '').trim();
  if (!data || !responsavel) { msg('[data-mov-msg]', 'Preencha a data e o responsável.'); return; }
  const itens = form.querySelectorAll('.mov-linha'); const novas = [];
  for (const el of itens) {
    const v = (n) => String((el.querySelector(`[name=${n}]`) || {}).value || '').trim();
    if (!v('item') && !v('qtd') && !v('destino') && !v('obs')) continue;   // linha em branco: ignora
    const qtd = Number(String(v('qtd')).replace(',', '.'));
    if (!v('item') || !(qtd > 0) || !v('origem') || !v('destino')) { msg('[data-mov-msg]', 'Em cada linha preencha item, quantidade, origem e destino.'); return; }
    if (v('origem').toLowerCase() === v('destino').toLowerCase()) { msg('[data-mov-msg]', `"${v('item')}": origem e destino são iguais.`); return; }
    novas.push({ data, responsavel, item: v('item'), qtd, origem: v('origem'), destino: v('destino'), obs: v('obs') || null });
  }
  if (!novas.length) { msg('[data-mov-msg]', 'Preencha pelo menos uma linha.'); return; }
  msg('[data-mov-msg]', 'Registrando…');
  try {
    if (NA_NUVEM) { const { error } = await sb.from('movimentacoes_galpao').insert(novas); if (error) throw new Error(error.message); }
    else { const l = lerLocal(); for (const n of novas) l.linhas.unshift({ id: l.seq++, ...n, criado_em: new Date().toISOString() }); gravarLocal(l); }
    const r = await ler(); linhas = r.linhas; fotos = r.fotos; ultima = Date.now();
    form.reset(); redesenhar();
    msg('[data-mov-msg]', `${novas.length} ${novas.length === 1 ? 'movimentação registrada' : 'movimentações registradas'}.`);
  } catch (err) { msg('[data-mov-msg]', `Não consegui registrar (${err.message || err}).`); }
}

async function enviarFoto(form, redesenhar) {
  const fd = new FormData(form); const arq = fd.get('foto');
  const data = String(fd.get('data') || ''); const responsavel = String(fd.get('responsavel') || '').trim();
  if (!arq || !arq.size || !data || !responsavel) { msg('[data-mov-msg-foto]', 'Escolha a foto e preencha a data e o responsável.'); return; }
  msg('[data-mov-msg-foto]', 'Enviando a foto…');
  try {
    const blob = await reduzir(arq);
    if (NA_NUVEM) {
      const caminho = `${perfilAtual().id}/mov-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      const { error: e1 } = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
      if (e1) throw new Error(e1.message);
      const { error } = await sb.from('movimentacoes_fotos').insert({ data, responsavel, obs: String(fd.get('obs') || '').trim() || null, caminho });
      if (error) { await sb.storage.from('fotos').remove([caminho]).catch(() => {}); throw new Error(error.message); }
    } else {
      const l = lerLocal();
      l.fotos.unshift({ id: l.seq++, data, responsavel, obs: String(fd.get('obs') || '').trim() || null, dataUrl: await comoDataUrl(blob), criado_em: new Date().toISOString() });
      if (!gravarLocal(l)) throw new Error('sem espaço neste navegador para guardar a foto');
    }
    const r = await ler(); linhas = r.linhas; fotos = r.fotos; ultima = Date.now();
    form.reset(); redesenhar();
    msg('[data-mov-msg-foto]', 'Foto enviada.');
  } catch (err) { msg('[data-mov-msg-foto]', `Não consegui enviar (${err.message || err}).`); }
}

async function verFoto(id) {
  const x = fotos.find((f) => String(f.id) === String(id)); if (!x) return;
  let url = x.dataUrl;
  if (NA_NUVEM) { const { data, error } = await sb.storage.from('fotos').createSignedUrl(x.caminho, 60 * 10); if (error) { alert(`Não consegui abrir a foto (${error.message}).`); return; } url = data.signedUrl; }
  if (url) window.open(url, '_blank', 'noopener');
}

async function apagar(tipo, id, redesenhar) {
  if (!confirm(tipo === 'foto' ? 'Apagar esta foto da folha?' : 'Apagar esta movimentação?')) return;
  try {
    if (NA_NUVEM) {
      if (tipo === 'foto') { const x = fotos.find((f) => String(f.id) === String(id)); const { error } = await sb.from('movimentacoes_fotos').delete().eq('id', id); if (error) throw new Error(error.message); if (x) await sb.storage.from('fotos').remove([x.caminho]).catch(() => {}); }
      else { const { error } = await sb.from('movimentacoes_galpao').delete().eq('id', id); if (error) throw new Error(error.message); }
    } else { const l = lerLocal(); if (tipo === 'foto') l.fotos = l.fotos.filter((x) => String(x.id) !== String(id)); else l.linhas = l.linhas.filter((x) => String(x.id) !== String(id)); gravarLocal(l); }
    const r = await ler(); linhas = r.linhas; fotos = r.fotos; ultima = Date.now(); redesenhar();
  } catch (err) { alert(`Não foi possível apagar (${err.message || err}).`); }
}

// liga os cliques e envios (uma vez só); redesenhar = função que redesenha a tela
let ligado = false;
export function ligar(redesenhar) {
  if (ligado) return; ligado = true;
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'mov-form') { e.preventDefault(); registrar(e.target, redesenhar); }
    else if (e.target.id === 'mov-foto-form') { e.preventDefault(); enviarFoto(e.target, redesenhar); }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-mov-mais],[data-mov-tirar],[data-mov-ver],[data-mov-apagar],[data-mov-apagar-foto]'); if (!t) return;
    if (t.matches('[data-mov-mais]')) { const box = document.querySelector('#mov-form .mov-linhas'); if (box) { const d = document.createElement('div'); d.innerHTML = String(linhaForm({ origem: 'GALPÃO' })); box.appendChild(d.firstElementChild); const n = box.lastElementChild.querySelector('[name=item]'); if (n) n.focus(); } return; }
    if (t.matches('[data-mov-tirar]')) { const box = t.closest('.mov-linhas'); if (box && box.children.length > 1) t.closest('.mov-linha').remove(); else if (box) box.querySelectorAll('input').forEach((i) => { if (i.name !== 'origem') i.value = ''; }); return; }
    if (t.matches('[data-mov-ver]')) { verFoto(t.dataset.movVer); return; }
    if (t.matches('[data-mov-apagar]')) { apagar('linha', t.dataset.movApagar, redesenhar); return; }
    if (t.matches('[data-mov-apagar-foto]')) apagar('foto', t.dataset.movApagarFoto, redesenhar);
  });
}
