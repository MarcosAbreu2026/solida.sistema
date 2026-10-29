// Gera os prints do treinamento "Como usar Minhas funções" (telas reais, com caixas e setas vermelhas) usando o Edge sem janela.
// Pré-requisito: o sistema rodando em http://localhost:8080 (iniciar.bat). Uso:
//   node scripts/gerar-prints-funcoes.mjs            gera todos os prints func-* em app/img/treinamentos/
//   node scripts/gerar-prints-funcoes.mjs func-03     gera só os que começam com esse nome
// Os dados são de exemplo (nada da empresa): modo de teste do sistema, com perfil descartável do Edge, logado como Gestor de obra.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, 'app', 'img', 'treinamentos'); mkdirSync(saida, { recursive: true });
const filtro = process.argv[2] || '';
const BASE = 'http://localhost:8080/app/';
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => existsSync(p));
if (!EDGE) { console.log('Edge não encontrado.'); process.exit(1); }
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Edge + CDP
const perfil = mkdtempSync(join(tmpdir(), 'prints-'));
const porta = 9333;
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
async function pronto() { for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${porta}/json`); const l = await r.json(); const p = l.find((x) => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* ainda subindo */ } await espera(300); } throw new Error('o Edge não abriu'); }
const ws = new WebSocket(await pronto());
await new Promise((r) => { ws.onopen = r; });
let seq = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (metodo, params = {}) => new Promise((res, rej) => { const id = ++seq; pend.set(id, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id, method: metodo, params })); });
const avaliar = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const esperar = async (sel, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await avaliar(`!!document.querySelector(${JSON.stringify(sel)})`)) return true; await espera(250); } throw new Error(`não apareceu: ${sel}`); };
const ir = async (hash) => { await avaliar(`location.hash = ${JSON.stringify(hash)}`); await espera(900); };
const clicar = (sel) => avaliar(`document.querySelector(${JSON.stringify(sel)}).click()`);
const preencher = (sel, v) => avaliar(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);

// ---------------------------------------------------------------- caixas e setas vermelhas
function marcarNaPagina(marcas) {
  document.querySelectorAll('.__marca').forEach((e) => e.remove());
  const NS = 'http://www.w3.org/2000/svg'; const VERM = '#D32F2F';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', '__marca');
  svg.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99998;pointer-events:none';
  svg.innerHTML = `<defs><marker id="ponta" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M1,1 L11,6 L1,11 z" fill="${VERM}"/></marker></defs>`;
  document.body.appendChild(svg);
  marcas.forEach((m, i) => {
    let el = null;
    if (m.sel) el = document.querySelector(m.sel);
    else if (m.texto) el = [...document.querySelectorAll(m.em || 'a,button,label,h2,h3,span,div')].filter((x) => x.children.length < 4 && x.textContent.trim().toLowerCase().startsWith(m.texto.toLowerCase())).sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!el) { console.warn('sem elemento para', JSON.stringify(m)); return; }
    const r = el.getBoundingClientRect(); const pad = m.pad ?? 5;
    const B = { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
    const caixa = document.createElement('div'); caixa.className = '__marca';
    caixa.style.cssText = `position:fixed;left:${B.l}px;top:${B.t}px;width:${B.r - B.l}px;height:${B.b - B.t}px;border:3px solid ${VERM};border-radius:8px;box-shadow:0 0 0 2px rgba(255,255,255,.75);z-index:99999;pointer-events:none;box-sizing:border-box`;
    document.body.appendChild(caixa);
    const num = document.createElement('div'); num.className = '__marca'; num.textContent = String(i + 1);
    num.style.cssText = `position:fixed;left:${Math.max(3, B.l - 13)}px;top:${Math.max(3, B.t - 13)}px;width:26px;height:26px;border-radius:50%;background:${VERM};color:#fff;font:700 15px/26px Arial,sans-serif;text-align:center;z-index:100000;box-shadow:0 1px 4px rgba(0,0,0,.4);pointer-events:none`;
    document.body.appendChild(num);
    if (m.rotulo) {
      const bolha = document.createElement('div'); bolha.className = '__marca'; bolha.textContent = m.rotulo;
      bolha.style.cssText = `position:fixed;left:0;top:0;max-width:${m.larg || 250}px;background:${VERM};color:#fff;font:700 15px/1.3 Arial,sans-serif;padding:7px 11px;border-radius:8px;z-index:100000;box-shadow:0 2px 6px rgba(0,0,0,.35);pointer-events:none`;
      document.body.appendChild(bolha);
      const w = bolha.offsetWidth; const h = bolha.offsetHeight; const lado = m.lado || 'cima'; const dist = m.dist || 70;
      let x; let y; let x1; let y1; let x2; let y2;
      const cx = (B.l + B.r) / 2; const cy = (B.t + B.b) / 2;
      if (lado === 'direita') { x = B.r + dist; y = cy - h / 2; x1 = x; y1 = y + h / 2; x2 = B.r + 2; y2 = cy; }
      else if (lado === 'esquerda') { x = B.l - dist - w; y = cy - h / 2; x1 = x + w; y1 = y + h / 2; x2 = B.l - 2; y2 = cy; }
      else if (lado === 'baixo') { x = cx - w / 2; y = B.b + dist; x1 = x + w / 2; y1 = y; x2 = cx; y2 = B.b + 2; }
      else { x = cx - w / 2; y = B.t - dist - h; x1 = x + w / 2; y1 = y + h; x2 = cx; y2 = B.t - 2; }
      const nx = Math.min(Math.max(8, x), window.innerWidth - w - 8); const ny = Math.min(Math.max(8, y), window.innerHeight - h - 8);
      x1 += nx - x; y1 += ny - y; bolha.style.left = `${nx}px`; bolha.style.top = `${ny}px`;
      const linha = document.createElementNS(NS, 'line'); linha.setAttribute('x1', x1); linha.setAttribute('y1', y1); linha.setAttribute('x2', x2); linha.setAttribute('y2', y2);
      linha.setAttribute('stroke', VERM); linha.setAttribute('stroke-width', '4'); linha.setAttribute('stroke-linecap', 'round'); linha.setAttribute('marker-end', 'url(#ponta)');
      svg.appendChild(linha);
    }
  });
}
const marcar = (marcas) => avaliar(`(${marcarNaPagina.toString()})(${JSON.stringify(marcas)})`);
const rolar = (sel, bloco = 'start') => avaliar(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: ${JSON.stringify(bloco)} }); window.scrollBy(0, -20); })()`);
async function foto(nome) {
  const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
  writeFileSync(join(saida, `${nome}.jpg`), Buffer.from(r.data, 'base64')); console.log(`  ${nome}.jpg`);
  await avaliar(`document.querySelectorAll('.__marca').forEach((e) => e.remove())`);
}

// ---------------------------------------------------------------- dados de exemplo (nada da empresa)
const hojeIso = new Date().toISOString().slice(0, 10);
const somar = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function dadosExemplo(obra) {
  const base = { criado_por: 'exemplo', criado_por_nome: 'Maria Souza', criado_em: new Date().toISOString() };
  return JSON.stringify({ seq: 20, atas: [{ id: 1, titulo: `${obra}_${hojeIso.replace(/-/g, '.')}_ATA_REUNIÃO_R00`, data: hojeIso, tipo: 'obra', obra, setor: 'Operação', participantes: ['Maria (Sólida)', 'João (Cliente)', 'Ana (Arquitetura)'], resumo: '', tipo_reuniao: 'REUNIÃO', revisao: 0, local: 'Escritório da Sólida', informativos: [{ n: 2, texto: 'MÁRMORE, As pedras chegam na sexta-feira', quem: 'Maria', tipo: 'solida' }], ...base }],
    pendencias: [
      { id: 1, ata_id: 1, item: 1, descricao: 'MARCENARIA, Enviar as duas propostas para o cliente', responsavel: null, responsavel_nome: 'Maria', responsavel_tipo: 'solida', prazo: somar(2), status: 'aberta', obra, setor: 'Operação', ...base },
      { id: 2, ata_id: 1, item: 3, descricao: 'ILUMINAÇÃO, Aprovar as luminárias extras', responsavel: null, responsavel_nome: 'João', responsavel_tipo: 'cliente', prazo: somar(9), status: 'aberta', obra, setor: 'Operação', ...base },
      { id: 3, ata_id: null, item: null, descricao: 'ELÉTRICA, Pedir orçamento do eletricista', responsavel: null, responsavel_nome: 'Ana', responsavel_tipo: 'arquitetura', prazo: somar(-1), status: 'aberta', obra, setor: 'Operação', ...base },
    ] });
}

// ---------------------------------------------------------------- roteiro dos prints
await avaliar('1');
// os prints são de teste: não deixar nenhuma marcação de exemplo chegar ao servidor (dados/tarefas-feitas.jsonl) nem vir de lá
await cdp('Page.enable');
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const f = window.fetch.bind(window); window.fetch = (u, o) => (String(u).includes('/api/tarefas') ? Promise.resolve(new Response((o && o.method === 'POST') ? '{}' : '[]', { status: 200 })) : f(u, o)); })();` });
await cdp('Page.navigate', { url: BASE });
await esperar('#login:not([hidden]) form, #nav a');
if (await avaliar(`!!document.querySelector('#login:not([hidden]) form')`)) {
  await preencher('#login select[name="funcao"]', 'gestor_obra'); await espera(700);   // trocar a função redesenha o formulário: escolher primeiro
  await esperar('#login input[name="obras"]', 25000);   // a lista de obras vem dos dados: espera chegar
  await preencher('#login input[name="usuario"]', 'maria'); await preencher('#login input[name="senha"]', 'exemplo'); await preencher('#login input[name="nome"]', 'Maria Souza');
  await avaliar(`(() => { const c = document.querySelector('#login input[name="obras"]'); if (c) c.checked = true; })()`);
  await avaliar(`document.querySelector('#login form').requestSubmit()`); await esperar('#nav a');
}
const CSS_OCULTAR = '#ver-como, #pedido, .pedido, #dica { display: none !important; }';
const ocultar = () => avaliar(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(CSS_OCULTAR)}; document.head.appendChild(s); window.scrollTo(0, 0); })()`);
await ocultar();
const hoje = hojeIso;
async function recarregar() { await avaliar(`['solida.funcoesVista', 'solida.checks', 'solida.horarios', 'solida.horariosFixos'].forEach((k) => localStorage.removeItem(k))`); await cdp('Page.reload'); await espera(1200); await esperar('#nav a'); await ocultar(); }
// Agenda: cada dia é uma coluna, as horas ficam na lateral (de meia em meia hora) e cada tarefa é UM cartão com a altura do tempo que ocupa.
// `etiquetar` marca os cartões do dia escolhido (hoje, ou o último dia com tarefa) com data-tr=0,1,2… (os mais largos primeiro) para o script apontar para eles.
async function etiquetar() {
  return avaliar(`(() => { const hoje = ${JSON.stringify(hoje)}; const [a, m, d] = hoje.split('-'); const rot = d + '/' + m;
    const cabs = [...document.querySelectorAll('.fq-cab')]; const comTarefa = (h) => !/previstas|sem tarefas|feriado/.test(h.querySelector('small').innerText);
    let i = cabs.findIndex((h) => h.querySelector('b').innerText.includes(rot) && comTarefa(h)); if (i < 0) { for (let k = cabs.length - 1; k >= 0; k--) if (comTarefa(cabs[k])) { i = k; break; } } if (i < 0) return false;
    cabs.forEach((h) => delete h.dataset.tr); cabs[i].dataset.tr = 'col';
    const cards = [...document.querySelectorAll('.fq-trilho')[i].querySelectorAll('.fq-card')];
    cards.sort((x, y) => (x.classList.contains('fq-estreito') ? 1 : 0) - (y.classList.contains('fq-estreito') ? 1 : 0) || Number(x.dataset.faixa) - Number(y.dataset.faixa));
    cards.forEach((c, k) => { c.dataset.tr = k; }); return cards.length > 0; })()`);
}
const aoCentro = (sel) => avaliar(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (e) e.scrollIntoView({ block: 'center' }); })()`);
// simula o toque no cartão (abre a janelinha de detalhes)
const clicarCartao = (sel) => avaliar(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); const r = c.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true, clientX: r.left + 8, clientY: r.top + 8 }; c.dispatchEvent(new PointerEvent('pointerdown', o)); document.dispatchEvent(new PointerEvent('pointerup', o)); })()`);
const SLIDES = [
  { nome: 'func-01-menu', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro');
    await marcar([{ sel: '#nav a[href="#/funcoes"]', rotulo: 'Aqui você faz o seu dia a dia', lado: 'direita', dist: 90, larg: 240 }, { sel: '#nav a[href="#/treinamentos"]' }]);
  } },
  { nome: 'func-02-quadro', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); await etiquetar(); await rolar('.fn-painel'); await espera(300);
    await marcar([{ sel: '.fn-cab h3', rotulo: 'Suas tarefas da semana', lado: 'direita', dist: 70, larg: 230 }, { sel: '.fn-painel .pct' }, { sel: '[data-tr="col"]' }, { sel: '.fq-horas', pad: 2 }]);
  } },
  { nome: 'func-03-marcar', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); if (!(await etiquetar())) throw new Error('sem tarefa até hoje'); await aoCentro('[data-tr="0"]'); await espera(300);
    await marcar([{ sel: '[data-tr="0"] .fq-nome' }, { sel: '[data-tr="0"] .fn-b.fn-feito' }, { sel: '[data-tr="0"] .fn-b.fn-nao' }]);
  } },
  { nome: 'func-04-cores', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); if (!(await etiquetar())) throw new Error('sem tarefa até hoje');
    await aoCentro('[data-tr="0"]'); await clicar('[data-tr="0"] .fn-b.fn-feito'); await espera(500); await etiquetar();
    await clicar('[data-tr="1"] .fn-b.fn-nao'); await espera(500); await etiquetar(); await aoCentro('[data-tr="1"]'); await espera(300);
    await marcar([{ sel: '[data-tr="0"]' }, { sel: '[data-tr="1"]' }, { sel: '[data-tr="2"]' }]);
  } },
  { nome: 'func-11-mover', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); if (!(await etiquetar())) throw new Error('sem tarefa até hoje'); await aoCentro('[data-tr="0"]'); await espera(300);
    // arrasta de verdade o primeiro cartão do dia para as 14h do dia seguinte (como a pessoa faz, segurando e soltando)
    await avaliar(`(async () => { const card = document.querySelector('[data-tr="0"]'); const trilhos = [...document.querySelectorAll('.fq-trilho')]; const col = [...document.querySelectorAll('.fq-cab')].findIndex((h) => h.dataset.tr === 'col');
      const alvo = trilhos[col + 1] || trilhos[col - 1]; const rA = alvo.getBoundingClientRect(); const rc = card.getBoundingClientRect(); const alt = 44;
      const yAlvo = rA.top + (14 - 7) * 2 * alt + 10 + 10; const mk = (tipo, x, y) => new PointerEvent(tipo, { bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true, clientX: x, clientY: y });
      card.dispatchEvent(mk('pointerdown', rc.left + 10, rc.top + 10)); document.dispatchEvent(mk('pointermove', rc.left + 50, rc.top + 50)); document.dispatchEvent(mk('pointermove', rA.left + 30, yAlvo)); document.dispatchEvent(mk('pointerup', rA.left + 30, yAlvo)); })()`);
    await espera(900); await aoCentro('.fq-card.mudou'); await espera(400);
    await marcar([{ sel: '.fq-card.mudou' }, { sel: '.fq-card.mudou .fn-meta' }]);
  } },
  { nome: 'func-12-duracao', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); if (!(await etiquetar())) throw new Error('sem tarefa até hoje'); await aoCentro('[data-tr="0"]'); await espera(300);
    await clicarCartao('[data-tr="0"]'); await esperar('.fq-pop'); await espera(300);
    await avaliar(`document.querySelector('.fq-pop [data-fn="dur|30"]').click()`); await espera(400);
    await marcar([{ sel: '.fq-pop-nome' }, { sel: '.fq-pop [data-fn="dur|-30"]', rotulo: 'Menos tempo', lado: 'esquerda', dist: 50, larg: 150 }, { sel: '.fq-pop [data-fn="dur|30"]', rotulo: 'Mais tempo', lado: 'baixo', dist: 45, larg: 150 }, { sel: '.fq-pop .fn-acoes' }]);
  } },
  { nome: 'func-07-semanas', async montar() {
    await ir('#/funcoes'); await esperar('.periodo');
    await marcar([{ texto: 'Semana anterior', em: '.periodo button', rotulo: 'Veja ou marque semanas passadas', lado: 'baixo', dist: 60, larg: 240 }, { sel: '.periodo .atual' }, { texto: 'Próxima semana', em: '.periodo button' }]);
  } },
  { nome: 'func-08-fora', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); await rolar('.fora-quadro', 'center'); await espera(300);
    await marcar([{ sel: '.fora-quadro', rotulo: 'Tarefas mensais e ocasionais ficam fora do quadro', lado: 'cima', dist: 60, larg: 300 }]);
  } },
  { nome: 'func-10-menu', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); await clicar('#nav a[href="#/funcoes"]'); await espera(300);
    await avaliar(`document.body.classList.add('nav-recolhido'); document.querySelector('#navToggle') && (document.querySelector('#navToggle').dataset.estado = 'fechado')`); await espera(700);
    await marcar([{ sel: '#navToggle', rotulo: 'Clique na setinha para recolher ou abrir o menu', lado: 'direita', dist: 70, larg: 270 }]);
  } },
  { nome: 'func-09-treinamento', async montar() {
    await ir('#/funcoes'); await esperar('.fq-quadro'); await rolar('[data-trein-slides="funcoes-usar"]', 'center'); await espera(300);
    await marcar([{ sel: '[data-trein-slides="funcoes-usar"]', rotulo: 'Para rever este passo a passo, clique aqui', lado: 'esquerda', dist: 70, larg: 260 }]);
  } },
];
let n = 0;
for (const s of SLIDES) {
  if (filtro && !s.nome.startsWith(filtro)) continue;
  console.log(s.nome);
  try { await recarregar(); await s.montar(); await espera(400); await foto(s.nome); n++; } catch (e) { console.log(`  erro: ${e.message}`); }
}
console.log(`${n} print(s) em ${saida}`);
ws.close(); edge.kill(); await espera(600);
try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Edge ainda segura a pasta */ }
process.exit(0);
