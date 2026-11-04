// Gera os prints didáticos dos treinamentos (telas reais do sistema, com caixas e setas vermelhas), usando o Edge sem janela.
// Pré-requisito: o sistema rodando em http://localhost:8080 (iniciar.bat). Uso:
//   node scripts/gerar-prints-treinamento.mjs            gera todos os prints de app/img/treinamentos/
//   node scripts/gerar-prints-treinamento.mjs ata-03     gera só os que começam com esse nome
// Os dados que aparecem nos prints são de exemplo (nada da empresa): o script usa o modo de teste do sistema, com dados locais descartáveis.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = join(raiz, 'app', 'img', 'treinamentos'); mkdirSync(saida, { recursive: true });
const filtro = process.argv[2] || '';
const BASE = `http://localhost:${process.env.PORTA || 8080}/app/`;
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
      { id: 4, ata_id: 1, item: 4, descricao: 'ACM, Retirar da área gourmet', responsavel: 'socio:maria', responsavel_nome: 'Maria Souza', responsavel_tipo: 'solida', prazo: hojeIso, status: 'aberta', obra, setor: 'Operação', ...base, concluida_em: null },
      { id: 5, ata_id: null, item: null, descricao: 'PROJETO, Cobrar a hidráulica da arquiteta', responsavel: 'socio:maria', responsavel_nome: 'Maria Souza', responsavel_tipo: 'solida', prazo: somar(1), status: 'aberta', obra, setor: 'Projetos', ...base, concluida_em: null },
      { id: 6, ata_id: null, item: null, descricao: 'ESQUADRIAS, Medir os vãos do segundo pavimento', responsavel: 'socio:maria', responsavel_nome: 'Maria Souza', responsavel_tipo: 'solida', prazo: somar(-2), status: 'aberta', obra, setor: 'Operação', ...base, concluida_em: null },
      { id: 3, ata_id: null, item: null, descricao: 'ELÉTRICA, Pedir orçamento do eletricista', responsavel: null, responsavel_nome: 'Ana', responsavel_tipo: 'arquitetura', prazo: somar(-1), status: 'aberta', obra, setor: 'Operação', ...base },
    ] });
}

// ---------------------------------------------------------------- roteiro dos prints
await avaliar('1');
await cdp('Page.navigate', { url: BASE });
await esperar('#login:not([hidden]) form, #nav a');
if (await avaliar(`!!document.querySelector('#login:not([hidden]) form')`)) {
  await preencher('#login input[name="usuario"]', 'maria'); await preencher('#login input[name="senha"]', 'exemplo'); await preencher('#login input[name="nome"]', 'Maria Souza');
  await avaliar(`document.querySelector('#login form').requestSubmit()`); await esperar('#nav a');
}
await avaliar(`(() => { const s = document.createElement('style'); s.textContent = '#ver-como, #pedido, .pedido, #dica { display: none !important; }'; document.head.appendChild(s); })()`);
const obra = (await avaliar(`(async () => { location.hash = '#/atas?aba=nova'; await new Promise(r => setTimeout(r, 1500)); const o = [...document.querySelectorAll('#ata-form [name="obra"] option')].map((x) => x.value).find((v) => /^Mo\\d/.test(v)); return o || ''; })()`)) || 'Mo358';
await avaliar(`localStorage.setItem('solida.atas', ${JSON.stringify(dadosExemplo(obra))}); localStorage.removeItem('solida.treinamentos');`);

async function recarregar() {
  await cdp('Page.reload'); await espera(1200); await esperar('#nav a');
  await avaliar(`(() => { const s = document.createElement('style'); s.textContent = '#ver-como, #pedido, .pedido, #dica { display: none !important; }'; document.head.appendChild(s); window.scrollTo(0, 0); })()`);
}

const SLIDES = [
  { nome: 'agenda-01-menu', async montar() {
    await ir('#/agenda'); await esperar('.fq-quadro'); await esperar('.ag-cab-tarefas');
    await marcar([{ sel: '#nav a[href="#/agenda"]', rotulo: 'Agenda: o seu dia e as suas tarefas', lado: 'direita', dist: 90, larg: 250 }, { sel: '#nav a[href="#/atas"]', rotulo: 'Tarefas: o quadro de todas', lado: 'direita', dist: 90, larg: 230 }, { sel: '#nav a[href="#/atas?aba=atas"]' }]);
  } },
  { nome: 'agenda-02-semana', async montar() {
    await ir('#/agenda'); await esperar('.ag-cab-tarefas'); await rolar('.ag-resumo'); await espera(300);
    await marcar([{ sel: '.ag-resumo' }, { sel: '.fq-cab .ag-mini', rotulo: 'Cada cartãozinho é uma tarefa com prazo neste dia', lado: 'baixo', dist: 70, larg: 260 }]);
  } },
  { nome: 'agenda-03-cores', async montar() {
    await ir('#/agenda'); await esperar('.ag-cab-tarefas'); await rolar('.ag-resumo'); await espera(300);
    await marcar([{ sel: '.ag-lg-venc' }, { sel: '.ag-lg-hoje' }, { sel: '.ag-lg-futura' }, { sel: '.ag-venc', rotulo: 'Vencida: fica no dia em que venceu, em vermelho', lado: 'baixo', dist: 70, larg: 250 }, { sel: '.ag-repro', rotulo: 'Reprogramar o prazo', lado: 'direita', dist: 50, larg: 200 }]);
  } },
  { nome: 'agenda-04-arrastar', async montar() {
    await ir('#/agenda'); await esperar('.ag-cab-tarefas'); await rolar('.ag-resumo'); await espera(300);
    await marcar([{ sel: '.ag-hoje', rotulo: 'Arraste o cartão para outro dia e o prazo muda', lado: 'baixo', dist: 80, larg: 260 }, { sel: '[data-ag-dia]:not(.hoje)', pad: 2 }]);
  } },
  { nome: 'tarefas-01-quadro', async montar() {
    await ir('#/atas'); await esperar('.at-quadro'); await espera(500);
    await marcar([{ sel: '.at-c-vencido > header', rotulo: 'Vencido: passou do prazo', lado: 'baixo', dist: 70, larg: 220 }, { sel: '.at-c-hoje > header' }, { sel: '.at-col-mais', rotulo: '+ cria uma tarefa nova', lado: 'cima', dist: 55, larg: 200 }]);
  } },
  { nome: 'tarefas-02-filtros', async montar() {
    await ir('#/atas'); await esperar('.at-filtros'); await espera(300);
    await marcar([{ sel: '.at-filtros label:nth-child(1)', rotulo: 'Todas, só as minhas, equipe, terceirizados, clientes…', lado: 'baixo', dist: 60, larg: 280 }, { sel: '.at-filtros label:nth-child(2)' }, { sel: '.at-filtros label:nth-child(3)' }, { sel: '.at-filtros label:nth-child(4)' }]);
  } },
  { nome: 'tarefas-03-arrastar', async montar() {
    await ir('#/atas'); await esperar('.at-quadro'); await espera(500);
    await marcar([{ sel: '.at-c-semana .at-card', rotulo: 'Arraste o cartão para outra coluna: o prazo muda sozinho', lado: 'esquerda', dist: 60, larg: 270 }, { sel: '.at-c-hoje' }, { sel: '.at-c-concluido > header', rotulo: 'Soltar em Concluído dá a tarefa como feita', lado: 'cima', dist: 55, larg: 230 }]);
  } },
  { nome: 'tarefas-04-detalhes', async montar() {
    await ir('#/atas'); await esperar('.at-card[data-tarefa]'); await avaliar(`document.querySelector('.at-card[data-tarefa] .at-tit').click()`); await esperar('#tf-form'); await espera(500);
    await marcar([{ sel: '#tf-form [name="t_desc"]', rotulo: 'Mude o título', lado: 'esquerda', dist: 60, larg: 160 }, { sel: '#tf-form [name="t_resp"]' }, { sel: '#tf-form [name="t_gestor"]' }, { sel: '#tf-form [name="t_prazo"]' }, { sel: '.tf-botoes .at-ok' }, { sel: '[data-tf-del]' }]);
  } },
  { nome: 'tarefas-05-chat', async montar() {
    await ir('#/atas'); await esperar('.at-card[data-tarefa]'); await avaliar(`document.querySelector('.at-card[data-tarefa] .at-tit').click()`); await esperar('#tf-nota');
    await avaliar(`(() => { const f = document.getElementById('tf-nota'); f.querySelector('textarea').value = 'Cobrei o fornecedor por WhatsApp. Responde amanhã.'; f.requestSubmit(); })()`); await espera(900);
    await avaliar(`document.querySelector('.tf-chat').scrollIntoView({ block: 'center' })`); await espera(300);
    await marcar([{ sel: '.tf-nota', rotulo: 'Anotações: o que foi combinado ou cobrado', lado: 'esquerda', dist: 60, larg: 240 }, { sel: '#tf-nota textarea', rotulo: 'Escreva aqui e clique em Enviar', lado: 'esquerda', dist: 60, larg: 230 }]);
  } },
  { nome: 'ata-11-nova', async montar() {
    await ir('#/atas?aba=nova'); await esperar('#ata-form'); await espera(300);
    await marcar([{ sel: '.at-importar', rotulo: 'Importar uma ata pronta: clique para abrir', lado: 'baixo', dist: 70, larg: 260 }, { sel: '#ata-form [name="obra"]' }]);
  } },
  { nome: 'estoque-01-abas', async montar() {
    await ir('#/estoque'); await esperar('.pd-abas'); await espera(600);
    await marcar([{ sel: '.pd-abas a:nth-child(1)' }, { sel: '.pd-abas a:nth-child(2)', rotulo: 'Contagem do estoque', lado: 'baixo', dist: 70, larg: 200 }, { sel: '.pd-abas a:nth-child(3)', rotulo: 'Guia de movimentação', lado: 'baixo', dist: 130, larg: 200 }, { sel: '.pd-abas a:nth-child(4)' }]);
  } },
  { nome: 'painel-01-departamento', async montar() {
    await ir('#/operacao'); await esperar('.pd-pergunta'); await espera(700);
    await marcar([{ sel: '.pd-pergunta', rotulo: 'A pergunta que o painel responde', lado: 'baixo', dist: 70, larg: 260 }, { sel: '.pd-abas a:nth-child(2)', rotulo: 'Detalhes: a tela completa de antes', lado: 'baixo', dist: 100, larg: 240 }]);
  } },
  { nome: 'painel-02-agir', async montar() {
    await ir('#/operacao'); await esperar('.pd-agir'); await rolar('.pd-agir'); await espera(400);
    await marcar([{ sel: '.pd-agir th:nth-child(1)', rotulo: 'Crítico ou atenção', lado: 'cima', dist: 60, larg: 200 }, { sel: '.pd-agir .pd-bt', rotulo: 'Criar tarefa: o alerta vira tarefa com responsável e prazo', lado: 'esquerda', dist: 60, larg: 280 }]);
  } },
  { nome: 'feed-01', async montar() {
    await ir('#/feed'); await espera(600);
    await marcar([{ sel: '#nav a[href="#/feed"]', rotulo: 'Feed: recados e novidades da equipe', lado: 'direita', dist: 90, larg: 250 }]);
  } },
  { nome: 'trein-01', async montar() {
    await ir('#/treinamentos'); await espera(600);
    await marcar([{ sel: '#nav a[href="#/treinamentos"]', rotulo: 'Treinamentos: passo a passo de cada tela', lado: 'direita', dist: 90, larg: 260 }, { sel: '.tr-topico:first-child', pad: 2 }]);
  } },
  { nome: 'ata-01-menu', async montar() {
    await ir('#/atas?aba=atas'); await esperar('#nav a[href="#/atas?aba=atas"]');
    await marcar([{ sel: '#nav a[href="#/atas?aba=atas"]', rotulo: 'Clique aqui: Atas', lado: 'direita', dist: 90 }]);
  } },
  { nome: 'ata-02-nova-ata', async montar() {
    await ir('#/atas?aba=atas'); await esperar('.at-topo-bt a');
    await marcar([{ sel: '.at-topo-bt a', rotulo: 'Para criar, clique em "+ Nova ata"', lado: 'baixo', dist: 60, larg: 230 }, { sel: '#nav a[href="#/atas"]', rotulo: 'As tarefas ficam em Tarefas', lado: 'direita', dist: 80, larg: 220 }]);
  } },
  { nome: 'ata-03-dados', async montar() {
    await ir('#/atas?aba=nova'); await esperar('#ata-form');
    await avaliar(`document.querySelector('.at-importar').open = false`);
    await preencher('#ata-form [name="obra"]', obra); await preencher('#ata-form [name="setor"]', 'Operação'); await preencher('#ata-form [name="tipo_reuniao"]', 'REUNIÃO');
    await preencher('#ata-form [name="local"]', 'Escritório da Sólida'); await preencher('#ata-form [name="participantes"]', 'Maria (Sólida), João (Cliente), Ana (Arquitetura)');
    await rolar('.at-form-grade'); await espera(300);
    await marcar([{ sel: '#ata-form [name="data"]' }, { sel: '#ata-form [name="obra"]' }, { sel: '#ata-form [name="setor"]' }, { sel: '#ata-nome' }, { sel: '#ata-form [name="local"]' }, { sel: '#ata-form [name="participantes"]' }]);
  } },
  { nome: 'ata-04-itens', async montar() {
    await ir('#/atas?aba=nova'); await esperar('#ata-form');
    await avaliar(`document.querySelector('.at-importar').open = false`);
    await preencher('#ata-form [name="obra"]', obra); await preencher('#ata-form [name="setor"]', 'Operação');
    await preencher('#ata-form [name="local"]', 'Escritório da Sólida'); await preencher('#ata-form [name="participantes"]', 'Maria (Sólida), João (Cliente)');
    await clicar('[data-pf-add]'); await espera(300);
    const L = (n, s) => `#pend-linhas .pf-linha:nth-child(${n}) ${s}`;
    await preencher(L(1, '[name="p_assunto"]'), 'marcenaria'); await preencher(L(1, '[name="p_desc"]'), 'Enviar as duas propostas para o cliente'); await preencher(L(1, '[name="p_tipo"]'), 'cliente'); await preencher(L(1, '[name="p_nome"]'), 'João'); await preencher(L(1, '[name="p_prazo"]'), somar(3));
    await preencher(L(2, '[name="p_kind"]'), 'informativo'); await preencher(L(2, '[name="p_assunto"]'), 'mármore'); await preencher(L(2, '[name="p_desc"]'), 'As pedras chegam na sexta-feira'); await preencher(L(2, '[name="p_tipo"]'), 'solida'); await avaliar(`document.querySelector('#pend-linhas .pf-linha:nth-child(2) [name="p_resp"]').selectedIndex = 1`);
    await rolar('#pend-linhas', 'center'); await espera(300);
    await marcar([{ sel: L(1, '[name="p_kind"]') }, { sel: L(1, '[name="p_assunto"]') }, { sel: L(1, '[name="p_desc"]') }, { sel: L(1, '[name="p_tipo"]') }, { sel: L(1, '[name="p_prazo"]') }, { sel: L(2, '[name="p_kind"]') }]);
  } },
  { nome: 'ata-05-faltando', async montar() {
    await ir('#/atas?aba=nova'); await esperar('#ata-form');
    await avaliar(`document.querySelector('.at-importar').open = false`);
    await clicar('[data-pf-add]'); await espera(200);
    await preencher('#pend-linhas .pf-linha:nth-child(1) [name="p_assunto"]', 'ELÉTRICA');
    await rolar('.at-form-grade'); await espera(300);
    await marcar([{ sel: '#ata-form [name="obra"]', rotulo: 'Círculo vermelho = ainda falta preencher', lado: 'cima', dist: 60, larg: 260 }, { sel: '#ata-form [name="setor"]' }, { sel: '#ata-form [name="local"]' }, { sel: '#pend-linhas .pf-linha:nth-child(1) [name="p_desc"]' }]);
  } },
  { nome: 'ata-06-salvar', async montar() {
    await ir('#/atas?aba=atas&ata=1'); await esperar('.sd-folha');
    await marcar([{ sel: '.at-ata-det h2' }, { sel: '.sd-folha' }, { texto: 'Criar revisão', em: '.at-ata-det a.botao' }, { texto: 'Pauta da próxima', em: '.at-ata-det button' }]);
  } },
  { nome: 'ata-08-importar', async montar() {
    await ir('#/atas?aba=nova'); await esperar('#ata-arquivo'); await avaliar(`document.querySelector('.at-importar').open = true`); await rolar('.at-imp-linha', 'center'); await espera(300);
    await marcar([{ sel: '.at-imp-linha .botao', rotulo: 'Escolha o PDF da ata', lado: 'direita', dist: 70, larg: 230 }, { sel: '#ata-colada' }, { sel: '[data-ata-ler]', rotulo: 'Depois: ler o texto colado', lado: 'direita', dist: 70, larg: 230 }]);
  } },
  { nome: 'ata-09-depois', async montar() {
    await ir('#/atas?aba=atas&ata=1'); await esperar('.sd-folha'); await rolar('.sd-folha'); await espera(200);
    await clicar('.sd-tab [data-cal-prazo]'); await espera(500);
    await marcar([{ sel: '.sd-tab [data-cal-prazo]' }, { sel: '.cal-pop', rotulo: 'Escolha o novo dia (feriados em vermelho)', lado: 'esquerda', dist: 50, larg: 230 }]);
  } },
  { nome: 'ata-10-pendencias', async montar() {
    await ir('#/atas'); await esperar('.at-quadro'); await espera(500);
    await marcar([{ sel: '.at-col-mais', rotulo: '+ cria uma pendência que não veio de ata', lado: 'cima', dist: 60, larg: 230 }, { sel: '.at-card [data-pend]' }, { sel: '.at-card .at-prazo' }]);
  } },
];
let n = 0;
for (const s of SLIDES) {
  if (filtro && !s.nome.startsWith(filtro)) continue;
  console.log(s.nome);
  try { await recarregar(); await s.montar(); await espera(400); await foto(s.nome); n++; } catch (e) { console.log(`  erro: ${e.message}`); }
}
console.log(`${n} print(s) em ${saida}`);
await avaliar(`localStorage.removeItem('solida.atas')`);
ws.close(); edge.kill(); await espera(600);
try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Edge ainda segura a pasta */ }
process.exit(0);
