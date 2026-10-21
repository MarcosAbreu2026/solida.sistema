// Salva no Drive as atas feitas no sistema (pedido de 21/10): PDF com o nome padrão
//   <obra>_<aaaa.mm.dd>_ATA_<tipo>_R<nn>.pdf   ex.: Mo344_2026.07.10_ATA_ARQUITETURA-CLIENTE_R00.pdf
// na pasta da obra: OPERACOES\OBRAS\<MoXXX_...>\GERENCIAMENTO\ATA  (pós-obra: PÓS OBRA\PO_OBRAS\<ano>\<Po_XXX...>\GERENCIAMENTO\ATA).
// Roda dentro do coletor (a cada 10 minutos): entra com a conta do coletor, pega as atas de obra ainda não salvas,
// monta o PDF (Edge sem janela) e grava no Drive; depois marca a ata como arquivada no banco.
//   node scripts/arquivar-atas.mjs                 normal
//   node scripts/arquivar-atas.mjs --saida <pasta> teste: grava o PDF nessa pasta, sem mexer no Drive nem no banco
//   node scripts/arquivar-atas.mjs --simular       só mostra em que pasta do Drive cada ata iria
//   --id <n>                                       só essa ata (com --saida/--simular vale mesmo se já arquivada)

import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

// sem internet (ou nuvem fora do ar) não é erro do sistema: avisa curto no registro e tenta de novo no próximo ciclo
process.on('uncaughtException', (e) => { console.log(`Atas: não consegui falar com a nuvem agora (${(e.cause && e.cause.code) || e.message}). Tento de novo no próximo ciclo.`); process.exit(1); });
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const saidaTeste = opc('--saida'); const simular = !!opc('--simular'); const soId = opc('--id');

const cfgArq = join(raiz, 'config.local.json');
if (!existsSync(cfgArq)) { console.log('Atas: sem config.local.json, nada feito.'); process.exit(0); }
const cfg = JSON.parse(readFileSync(cfgArq, 'utf8').replace(/^﻿/, ''));
if (!cfg.supabaseUrl || !cfg.chavePublica || !cfg.coletorEmail || !cfg.coletorSenha) { console.log('Atas: config.local.json sem o acesso do coletor.'); process.exit(0); }
const r0 = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: cfg.chavePublica, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cfg.coletorEmail, password: cfg.coletorSenha }) });
if (!r0.ok) { console.log(`Atas: não consegui entrar com a conta do coletor (${r0.status}).`); process.exit(1); }
const token = (await r0.json()).access_token;
const H = { apikey: cfg.chavePublica, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const rest = async (caminho, opts = {}) => {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${caminho}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${caminho.split('?')[0]}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

// ---------------------------------------------------------------- pastas do Drive
function raizDoDrive() {
  const base = 'G:\\.shortcut-targets-by-id';
  if (existsSync(base)) for (const d of readdirSync(base, { withFileTypes: true })) { const p = join(base, d.name, 'SOLIDA GERAL'); if (existsSync(p)) return p; }
  const alt = 'G:\\Meu Drive\\SOLIDA GERAL'; return existsSync(alt) ? alt : null;
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sub = (dir, teste) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).find(teste) : undefined);

// pasta ATA da obra (cria GERENCIAMENTO e ATA se faltarem); devolve { pasta, existe }
function pastaDaAta(drive, obra) {
  const cod = norm(obra).replace(/_/g, '');
  let pastaObra;
  if (/^mo/i.test(obra)) {
    const base = join(drive, 'OPERACOES', 'OBRAS');
    const n = sub(base, (x) => norm(x).replace(/_/g, '').startsWith(cod) && /^mo\d/i.test(x) && (norm(x).startsWith(`${cod}_`) || norm(x).replace(/_/g, '').startsWith(cod)));
    if (n) pastaObra = join(base, n);
  } else {
    const po = sub(drive, (x) => /^p.s obra$/i.test(norm(x)));
    const obras = po ? join(drive, po, sub(join(drive, po), (x) => /^po_obras$/i.test(x)) || 'PO_OBRAS') : null;
    if (obras && existsSync(obras)) for (const ano of readdirSync(obras, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name)).map((e) => e.name).sort().reverse()) {
      const n = sub(join(obras, ano), (x) => norm(x).replace(/_/g, '').startsWith(cod));
      if (n) { pastaObra = join(obras, ano, n); break; }
    }
  }
  if (!pastaObra) return null;
  const ger = join(pastaObra, sub(pastaObra, (x) => /^gerenciamento$/i.test(x)) || 'GERENCIAMENTO');
  const ata = join(ger, sub(ger, (x) => /^atas?$/i.test(x)) || 'ATA');
  return { pasta: ata, existe: existsSync(ata) };
}

// ---------------------------------------------------------------- PDF
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const neg = (t) => { const s = String(t ?? ''); const i = s.indexOf(','); return i > 0 && i < 60 ? `<b>${esc(s.slice(0, i).toLocaleUpperCase('pt-BR'))}</b>${esc(s.slice(i))}` : esc(s); };
const dbr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const ROT = { terceirizado: 'Terceirizado', cliente: 'Cliente', arquitetura: 'Arquitetura', outro: 'Externo' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dMes = (iso) => (iso ? `${iso.slice(8, 10)}/${MESES[Number(iso.slice(5, 7)) - 1]}` : '');
// mesmo padrão da ata da Sólida (cabeçalho com logo, ITEM | TIPO | descrição | RESPONSÁVEL | DATA LIMITE), com visual novo
function htmlDaAta(a, pends) {
  const logo = existsSync(join(raiz, 'app', 'img', 'logo.png')) ? `data:image/png;base64,${readFileSync(join(raiz, 'app', 'img', 'logo.png')).toString('base64')}` : '';
  const sub = (tipo, cat) => (tipo && tipo !== 'solida' ? `<small>${esc(ROT[tipo] || 'Externo')}${cat ? ` · ${esc(cat)}` : ''}</small>` : '');
  const itens = [...pends.map((p, i) => ({ k: 'p', p, n: Number(p.item) || 0, i })), ...((a.informativos || []).map((x, i) => ({ k: 'i', x, n: (x && x.n) || 0, i: 1000 + i })))].sort((x, y) => ((x.n || 1e6) - (y.n || 1e6)) || (x.i - y.i));
  const linhas = itens.map((r, k) => {
    if (r.k === 'i') { const t = typeof r.x === 'string' ? { texto: r.x } : r.x; return `<tr><td class="c">${k + 1}</td><td class="c info">INFORMATIVO</td><td>${neg(t.texto)}</td><td class="c">${t.quem ? `${esc(String(t.quem).toLocaleUpperCase('pt-BR'))}${sub(t.tipo, t.categoria)}` : '—'}</td><td class="c"></td></tr>`; }
    const p = r.p; const rep = p.prazo_original && p.prazo_original !== p.prazo;
    return `<tr><td class="c">${k + 1}</td><td class="c pend">PENDÊNCIA</td><td>${neg(p.descricao)}</td><td class="c">${esc(String(p.responsavel_nome || '—').toLocaleUpperCase('pt-BR'))}${sub(p.responsavel_tipo || 'solida', p.responsavel_categoria)}</td><td class="c${rep ? ' repro' : ''}">${dMes(p.prazo)}${rep ? `<small>↻ era ${dMes(p.prazo_original)}</small>` : ''}</td></tr>`;
  }).join('');
  const partes = (a.participantes || []).map((t) => { const m = String(t).match(/^(.*?)\s*(\(.*\))\s*$/); return m ? `${esc(m[1])} <span class="papel">${esc(m[2])}</span>` : esc(t); }).join(', ');
  const rev = `R${String(Number(a.revisao) || 0).padStart(2, '0')}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(a.titulo)}</title><style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { font: 11px/1.35 "Segoe UI", Arial, Helvetica, sans-serif; color: #1c2430; margin: 0; }
.folha { border: 1px solid #C9D3DD; border-radius: 10px; overflow: hidden; }
.cab { display: grid; grid-template-columns: 150px 1fr 105px 62px; background: #F4F7FB; border-bottom: 1px solid #C9D3DD; }
.cab > div { padding: 6px 10px; }
.logo { grid-row: 1 / 4; height: 62px; margin: 6px 6px; padding: 0 !important; background: #1B4F72; -webkit-mask: url(${logo}) no-repeat center / 128px auto; mask: url(${logo}) no-repeat center / 128px auto; }
.tit { font-size: 17px; font-weight: 800; color: #1B4F72; }
.cod { font-weight: 700; text-align: center; align-self: center; color: #1B4F72; }
.linha { grid-column: 2 / -1; border-top: 1px solid #E1E8F0; font-size: 11px; }
.linha b { color: #1B4F72; } .papel { color: #8A939D; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #1B4F72; color: #fff; font-size: 10px; letter-spacing: .05em; padding: 5px 4px; }
th:nth-child(1) { width: 38px; } th:nth-child(2) { width: 88px; } th:nth-child(4) { width: 118px; } th:nth-child(5) { width: 74px; }
td { padding: 5px 7px; border-top: 1px solid #E1E8F0; vertical-align: middle; }
td.c { text-align: center; } tr { break-inside: avoid; }
td.pend { background: #FDE8E7; color: #A12622; font-weight: 700; } td.info { background: #E3F3E7; color: #1F6B3A; font-weight: 700; }
td.repro { background: #FFF4D6; } small { display: block; color: #8A939D; font-size: 8.5px; } td.repro small { color: #9A6A00; }
.rodape { margin-top: 10px; font-size: 8.5px; color: #8A939D; }
</style></head><body>
<div class="folha">
<div class="cab">
<div class="logo"></div><div class="tit">ATA DE REUNIÃO ${esc(dbr(a.data).replace(/\//g, '.'))}</div><div class="cod">${esc(a.obra || a.setor || '')}</div><div class="cod">${rev}</div>
<div class="linha"><b>LOCAL:</b> ${esc(a.local || '—')}${a.setor ? ` · <b>DEPARTAMENTO:</b> ${esc(a.setor)}` : ''}</div>
<div class="linha"><b>PARTICIPANTES:</b> ${partes || '—'}</div>
</div>
<table><thead><tr><th>ITEM</th><th>TIPO</th><th></th><th>RESPONSÁVEL</th><th>DATA LIMITE</th></tr></thead><tbody>${linhas}</tbody></table>
</div>
<p class="rodape">${esc(a.titulo)} · registrada no Sistema Sólida${a.criado_por_nome ? ` por ${esc(a.criado_por_nome)}` : ''} em ${dbr(String(a.criado_em || '').slice(0, 10))}.</p>
</body></html>`;
}function acharNavegador() {
  return ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find((p) => existsSync(p));
}
function gerarPdf(html, destino) {
  const nav = acharNavegador(); if (!nav) throw new Error('Edge ou Chrome não encontrado neste computador');
  const tmp = mkdtempSync(join(tmpdir(), 'ata-'));
  try {
    writeFileSync(join(tmp, 'ata.html'), html, 'utf8');
    const r = spawnSync(nav, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(tmp, 'perfil')}`, `--print-to-pdf=${join(tmp, 'ata.pdf')}`, pathToFileURL(join(tmp, 'ata.html')).href], { timeout: 90000 });
    if (!existsSync(join(tmp, 'ata.pdf'))) throw new Error(`não consegui gerar o PDF (${r.error ? r.error.message : `código ${r.status}`})`);
    copyFileSync(join(tmp, 'ata.pdf'), destino);
  } finally { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* temporário */ } }
}

// ---------------------------------------------------------------- rodada
const filtro = soId ? `id=eq.${soId}` : 'arquivada_em=is.null&obra=not.is.null';
const atas = await rest(`atas?select=*&${filtro}&order=id`);
if (!atas.length) { console.log('Atas: nada novo para salvar.'); process.exit(0); }
const pends = await rest(`pendencias?select=*&ata_id=in.(${atas.map((a) => a.id).join(',')})&status=neq.cancelada&order=id`);
const drive = saidaTeste ? null : raizDoDrive();
if (!saidaTeste && !drive) { console.log('Atas: Drive (G:) não encontrado neste computador.'); process.exit(1); }
let ok = 0; const falhas = [];
for (const a of atas) {
  if (!a.obra) continue;
  const nome = `${a.titulo}.pdf`;
  try {
    let pasta;
    if (saidaTeste) { pasta = String(saidaTeste); }
    else { const f = pastaDaAta(drive, a.obra); if (!f) throw new Error(`não achei a pasta da obra ${a.obra} no Drive`); pasta = f.pasta; if (simular) { console.log(`Atas: ${nome} iria para ${pasta}${f.existe ? '' : ' (a pasta ATA seria criada)'}`); continue; } }
    mkdirSync(pasta, { recursive: true });
    const destino = join(pasta, nome);
    if (!existsSync(destino)) gerarPdf(htmlDaAta(a, pends.filter((p) => p.ata_id === a.id)), destino);
    if (!saidaTeste) await rest(`atas?id=eq.${a.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ arquivo: nome, arquivada_em: new Date().toISOString(), arquivo_erro: null }) });
    ok++; console.log(`Atas: ${nome} salva em ${pasta}`);
  } catch (e) {
    falhas.push(`${a.titulo}: ${e.message}`);
    if (!saidaTeste && !simular) { try { await rest(`atas?id=eq.${a.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ arquivo_erro: String(e.message).slice(0, 300) }) }); } catch { /* sem banco */ } }
  }
}
console.log(`Atas: ${ok} salva${ok === 1 ? '' : 's'} no Drive${falhas.length ? ` · falhas: ${falhas.join(' | ')}` : ''}`);
process.exit(falhas.length ? 1 : 0);

