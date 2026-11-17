// Leitor do WhatsApp Web do computador do escritório (SOMENTE LEITURA, sem IA e sem API paga).
//   node scripts/leitor-whatsapp.mjs --login   abre o Chrome com o perfil do leitor para escanear o QR do WhatsApp (só na primeira vez)
//   node scripts/leitor-whatsapp.mjs           lê as conversas de dados/whatsapp-grupos.json e atualiza os dados do sistema
// O coletor (iniciar.bat) chama este script de ~15 em 15 minutos, de segunda a sexta, em horário comercial.
// Ele só abre a conversa e lê o que está na tela: não envia, não reage, não baixa e não apaga nada.
// Atenção: abrir uma conversa no WhatsApp Web marca as mensagens dela como lidas (também no celular de quem usa o número).
// Saídas: dados/whatsapp/<conversa>.json (texto bruto, fica só neste computador), dados/whatsapp/status.json e,
// para as conversas do tipo "ferramentas", novos registros em dados/json/ferramentas-checklist.json.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrair } from './whatsapp-extrator.mjs';
import { lerEfetivo } from './efetivo-parser.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pastaWpp = join(raiz, 'dados', 'whatsapp');
const perfilEdge = join(raiz, 'dados', 'whatsapp-perfil');
const cfgArq = join(raiz, 'dados', 'whatsapp-grupos.json');
const checklistArq = join(raiz, 'dados', 'json', 'ferramentas-checklist.json');
const statusArq = join(pastaWpp, 'status.json');
const MODO_LOGIN = process.argv.includes('--login');
// Navegador do leitor: o Google Chrome (troca de 17/11/2026); se não houver Chrome neste computador, cai no Edge.
const CHROMES = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')];
const EDGES = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'];
const CHROME = CHROMES.find((p) => existsSync(p));
const NAVEGADOR = CHROME || EDGES.find((p) => existsSync(p));
const NOME_NAV = CHROME ? 'Google Chrome' : 'Microsoft Edge';
// perfil próprio de cada navegador (o do Edge não serve para o Chrome): o do Chrome pede o QR do WhatsApp uma vez (ligar-leitor-whatsapp.bat)
const perfil = CHROME ? join(raiz, 'dados', 'whatsapp-perfil-chrome') : perfilEdge;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a));
const pad = (n) => String(n).padStart(2, '0');
const agora = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const slug = (s) => semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lerJSON = (arq, padrao) => { try { return JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return padrao; } };
const gravarJSON = (arq, obj) => { mkdirSync(dirname(arq), { recursive: true }); writeFileSync(arq, `${JSON.stringify(obj, null, 2)}\n`, 'utf8'); };
const gravarStatus = (obj) => gravarJSON(statusArq, { lidoEm: agora(), ...obj });

if (!NAVEGADOR) { gravarStatus({ ok: false, motivo: 'Chrome (ou Edge) não encontrado' }); console.log('Chrome (ou Edge) não encontrado.'); process.exit(1); }

// configuração padrão das conversas lidas (editável): "tipo: ferramentas" também alimenta o controle de ferramentas
if (!existsSync(cfgArq)) {
  gravarJSON(cfgArq, {
    comentario: 'Conversas que o leitor abre. ativo=false desliga. busca=texto digitado na pesquisa (padrão: o nome; use um trecho único se o nome der muitos resultados). privado=true não guarda o texto bruto. tipo=ferramentas alimenta o controle de ferramentas obrigatórias.',
    conversas: [
      { nome: 'GESTAO ferramentas', tipo: 'ferramentas', ativo: true },
      { nome: 'Sólida FERRAMENTAS', busca: 'ferrament', tipo: 'ferramentas', ativo: true },
      { nome: 'Anderson Bandeira', tipo: 'ferramentas', ativo: true, privado: true },
    ],
  });
}

// ---------------------------------------------------------------- navegador (Chrome) + CDP
const porta = 9300 + sorteio(0, 500);
mkdirSync(perfil, { recursive: true });
const args = [`--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', '--disable-gpu'];
if (!MODO_LOGIN) args.push('--headless=new');
args.push('about:blank');
const edge = spawn(NAVEGADOR, args, { stdio: 'ignore' });
// Fecha o navegador DIREITO (Browser.close) e espera ele terminar: matar o processo de uma vez faz o Chrome perder o que ainda não gravou no perfil
// (a sessão do WhatsApp Web fica em localStorage) e o WhatsApp pede o QR code de novo. Só mata à força se ele não fechar em ~10 s.
let encerrando = false;
const encerrar = async (codigo) => {
  if (encerrando) return; encerrando = true;
  try { if (typeof ws !== 'undefined' && ws && ws.readyState === 1) await Promise.race([cdp('Browser.close').catch(() => {}), espera(3000)]); } catch { /* sem conexão com o navegador */ }
  for (let i = 0; i < 20 && edge.exitCode === null; i++) await espera(500);
  try { if (edge.exitCode === null) edge.kill(); } catch { /* já fechou */ }
  process.exit(codigo);
};
async function pronto() { for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${porta}/json`)).json(); const p = l.find((x) => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* ainda subindo */ } await espera(500); } throw new Error(`o ${NOME_NAV} não abriu (o perfil do leitor já está aberto em outra janela?)`); }
let ws; let seq = 0; const pend = new Map();
try { ws = new WebSocket(await pronto()); } catch (e) { gravarStatus({ ok: false, motivo: e.message }); console.log(e.message); encerrar(1); }
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP')); });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const cdp = (metodo, params = {}) => new Promise((res, rej) => {
  const id = ++seq; const t = setTimeout(() => { pend.delete(id); rej(new Error(`${metodo}: sem resposta do navegador`)); }, 20000);   // evita travar se a página trocar no meio
  pend.set(id, (d) => { clearTimeout(t); return d.error ? rej(new Error(d.error.message)) : res(d.result); }); ws.send(JSON.stringify({ id, method: metodo, params }));
});
const avaliar = async (expr) => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
const esperar = async (expr, ms = 30000) => { const fim = Date.now() + ms; while (Date.now() < fim) { try { if (await avaliar(expr)) return true; } catch { /* página trocando */ } await espera(400); } return false; };
async function clicar(expr) {   // expr devolve o elemento; clica no centro dele com o mouse
  const r = await avaliar(`(() => { const e = (${expr}); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  if (!r) return false;
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  return true;
}
async function tecla(key, code, modifiers = 0) { try { await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, modifiers }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers }); } catch { /* tecla sem resposta: segue */ } }
process.on('uncaughtException', (e) => { try { gravarStatus({ ok: false, motivo: e.message }); } catch { /* sem status */ } console.log(e.message); encerrar(1); });
process.on('unhandledRejection', (e) => { try { gravarStatus({ ok: false, motivo: String(e && e.message || e) }); } catch { /* sem status */ } console.log(String(e && e.message || e)); encerrar(1); });
await cdp('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'Windows' });
await cdp('Page.enable');
await cdp('Page.navigate', { url: 'https://web.whatsapp.com/' });

const LISTA = '#pane-side';
const BUSCA = `document.querySelector('#side input[data-tab="3"], #side input[aria-label^="Pesquisar"], #side div[contenteditable="true"][data-tab="3"]')`;
const QR = 'canvas[aria-label], [data-ref], [data-testid="qrcode"]';
if (MODO_LOGIN) {
  console.log('Escaneie o QR code com o WhatsApp do celular (Aparelhos conectados > Conectar um aparelho). Esperando até 10 minutos...');
  if (await esperar(`!!document.querySelector('${LISTA}')`, 600000)) { console.log('Conectado. Aguardando a sincronização...'); await espera(25000); console.log('Pronto: o leitor já pode rodar sozinho. Pode fechar esta janela (ou deixe que eu fecho).'); gravarStatus({ ok: true, motivo: 'login feito' }); encerrar(0); }
  console.log('Tempo esgotado sem conectar.'); encerrar(1);
}

// ---------------------------------------------------------------- leitura
const logado = await esperar(`!!document.querySelector('${LISTA}') || !!document.querySelector('${QR}')`, 60000)
  && await avaliar(`!!document.querySelector('${LISTA}')`);
if (!logado) {
  const motivo = 'WhatsApp Web não está conectado neste computador: rode "ligar-leitor-whatsapp.bat" e escaneie o QR code';
  gravarStatus({ ok: false, motivo }); console.log(motivo); encerrar(2);
}
await espera(sorteio(3000, 6000));
if (process.argv.includes('--diag')) {   // diagnóstico: mostra como está a lateral do WhatsApp Web (não digita nada)
  console.log(await avaliar(`JSON.stringify({ campos: [...document.querySelectorAll('[contenteditable], input')].map((e) => e.tagName + '|' + (e.getAttribute('data-tab') || '') + '|' + (e.getAttribute('aria-label') || '') + '|' + (e.closest('#side') ? 'side' : e.closest('#main') ? 'main' : '?')), icones: [...document.querySelectorAll('#side [data-icon]')].slice(0, 14).map((e) => e.getAttribute('data-icon')), testids: [...document.querySelectorAll('#side [data-testid]')].slice(0, 14).map((e) => e.getAttribute('data-testid')), botoes: [...document.querySelectorAll('#side button, #side [role=button]')].slice(0, 10).map((e) => e.getAttribute('aria-label') || e.innerText.slice(0, 20)) })`));
  encerrar(0);
}

const cfg = lerJSON(cfgArq, { conversas: [] });
const resultado = [];
const novasFerramentas = [];   // mensagens do Anderson (ferramentas) a avaliar
const gruposEfetivo = [];      // grupos de obra lidos agora (para o efetivo do dia)
for (const conv of (cfg.conversas || []).filter((c) => c && c.ativo !== false && c.nome)) {
  const alvo = semAcento(conv.nome);
  try {
    // busca o nome e abre a conversa
    // só digita se o foco estiver mesmo no campo de busca (nunca no campo de mensagem de uma conversa)
    if (!(await clicar(BUSCA))) await clicar(`document.querySelector('[data-icon="search"], [data-icon="search-refreshed"], [aria-label="Pesquisar"], [aria-label="Search"]')`);
    await espera(600);
    if (!(await clicar(BUSCA)) || !(await avaliar(`!!document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.isContentEditable) && !!document.activeElement.closest('#side')`))) { const diag = await avaliar(`JSON.stringify({ ativo: (document.activeElement || {}).outerHTML ? document.activeElement.outerHTML.slice(0, 140) : '', busca: ${BUSCA} ? ${BUSCA}.outerHTML.slice(0, 140) : null, editaveis: [...document.querySelectorAll('[contenteditable=true]')].map((e) => (e.getAttribute('data-tab') || '') + ':' + (e.closest('#side') ? 'side' : e.closest('#main') ? 'main' : '?')) })`).catch(() => '?'); resultado.push({ nome: conv.nome, erro: `campo de busca não encontrado (nada foi digitado) ${diag}` }); continue; }
    // limpa a busca pelo próprio campo (Ctrl+A/Backspace não funcionam no navegador sem tela) e avisa o WhatsApp
    await avaliar(`(() => { const e = ${BUSCA}; if (!e) return; e.focus(); if (e.tagName === 'INPUT') { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ''); e.dispatchEvent(new Event('input', { bubbles: true })); } else { e.textContent = ''; e.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
    await espera(600);
    await cdp('Input.insertText', { text: conv.busca || conv.nome });
    await espera(1500);
    let achou = false;   // os resultados da busca demoram: tenta por até ~10 segundos
    for (let tentativa = 0; tentativa < 10 && !achou; tentativa++) {
      achou = await clicar(`[...document.querySelectorAll('${LISTA} span[title]')].find((s) => ${semAcentoJS()}(s.title) === ${JSON.stringify(alvo)})`);
      if (!achou) await espera(900);
    }
    if (!achou) {
      const vistos = await avaliar(`[...document.querySelectorAll('${LISTA} span[title]')].map((s) => s.title.slice(0, 30)).slice(0, 5)`).catch(() => []);
      const campo = await avaliar(`(${BUSCA} || {}).value`).catch(() => '?');
      resultado.push({ nome: conv.nome, erro: `conversa não encontrada na busca (campo: "${campo}"; vi: ${vistos.join(' | ')})` }); continue;
    }
    const abriu = await esperar(`(() => { const t = document.querySelector('#main [data-testid="conversation-info-header-chat-title"]') || document.querySelector('#main header span[title]'); return !!t && ${semAcentoJS()}(t.innerText || t.title) === ${JSON.stringify(alvo)}; })()`, 10000);
    if (!abriu) { resultado.push({ nome: conv.nome, erro: 'não consegui abrir a conversa' }); continue; }
    await espera(1500);

    // vai ao fim da conversa e sobe até encontrar mensagens já conhecidas (a lista da tela é virtual: só há ~5 mensagens por vez)
    const arqConv = join(pastaWpp, `${slug(conv.nome)}.json`);
    const antes = conv.privado ? { mensagens: [] } : lerJSON(arqConv, { mensagens: [] });
    const conhecidas = new Set((antes.mensagens || []).map((m) => m.id));
    const lidas = new Map();
    const rolar = (acao) => avaliar(`(() => { const main = document.querySelector('#main'); const sc = [...main.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY !== 'visible' && d.querySelector('[role=row]')); if (!sc) return -1; ${acao}; return sc.scrollTop; })()`);
    await rolar('sc.scrollTop = sc.scrollHeight');
    await espera(800);
    const completa = (m) => !!(m.hora || m.texto || m.midia);   // linha da tela ainda sem conteúdo = não terminou de carregar: não guarda, lê de novo depois
    const ler = async () => {
      await espera(900);
      let lote = await avaliar(`(${extrair.toString()})()`);
      if (lote.mensagens.some((m) => !completa(m))) { await espera(1200); lote = await avaliar(`(${extrair.toString()})()`); }
      let conhecida = false;
      for (const m of lote.mensagens) { if (conhecidas.has(m.id)) conhecida = true; if (completa(m)) lidas.set(m.id, m); }
      return conhecida;
    };
    for (let passo = 0; passo < 14; passo++) {
      const jaConhecida = await ler();
      if (jaConhecida && passo > 0) break;
      const topo = await rolar('sc.scrollTop = Math.max(0, sc.scrollTop - sc.clientHeight * 0.7)');
      if (topo <= 0) { await ler(); break; }
    }
    const novas = [...lidas.values()].filter((m) => !conhecidas.has(m.id));
    if (!conv.privado) {
      const todas = [...(antes.mensagens || []), ...novas].sort((a, b) => `${a.data || ''}${a.hora || ''}`.localeCompare(`${b.data || ''}${b.hora || ''}`)).slice(-800);
      gravarJSON(arqConv, { conversa: conv.nome, lidoEm: agora(), mensagens: todas });
    }
    if (conv.tipo === 'ferramentas') for (const m of lidas.values()) novasFerramentas.push({ ...m, conversa: conv.nome });
    if (conv.tipo === 'efetivo') {
      // grupo de obra: o código (Mo533) vem do nome; grupo que não é de uma obra (ex.: gestão do pós-obra) diz o local em "obra" na configuração
      const cod = (conv.nome.match(/\b(mo|po)\s*-?\s*(\d{3})/i) || []);
      const codigo = conv.obra || (cod[2] ? `${cod[1].toLowerCase() === 'po' ? 'Po' : 'Mo'}${cod[2]}` : '');
      if (codigo) gruposEfetivo.push({ codigo, arq: arqConv, lidoEm: agora() });
    }
    resultado.push({ nome: conv.nome, lidas: lidas.size, novas: novas.length });
  } catch (e) { resultado.push({ nome: conv.nome, erro: e.message }); }
  await tecla('Escape', 'Escape');
  await espera(sorteio(3000, 7000));   // pausa irregular entre uma conversa e outra
}

// ---------------------------------------------------------------- efetivo do dia (RH)
// Cada obra posta o efetivo no grupo até as 12h. Daqui sai dados/json/efetivo.json (a tela do RH mostra quem enviou, quantas pessoas
// e quem NÃO enviou). "leituras" diz quando cada grupo foi lido: o sistema só afirma que faltou se o grupo foi mesmo lido.
if (gruposEfetivo.length) {
  const efArq = join(raiz, 'dados', 'json', 'efetivo.json');
  const ef = lerJSON(efArq, {});
  ef.prazo = '12:00'; ef.dias = ef.dias || {}; ef.leituras = ef.leituras || {}; ef.obras = [...new Set([...(ef.obras || []), ...gruposEfetivo.map((g) => g.codigo)])].sort();
  const corte = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  for (const g of gruposEfetivo) {
    ef.leituras[g.codigo] = g.lidoEm;
    const msgs = lerJSON(g.arq, { mensagens: [] }).mensagens || [];
    const porDia = new Map();
    for (const m of msgs) {
      const e = lerEfetivo(m.texto, m.data); if (!e || !e.data || e.data < corte) continue;
      const antigo = porDia.get(e.data); const chave = `${m.data || ''}${m.hora || ''}`;
      if (!antigo || chave >= antigo.chave) porDia.set(e.data, { chave, hora: m.hora || '', por: m.autor || '', postadoEm: m.data || e.data, ...e });   // "retificando": vale a última mensagem do dia
    }
    for (const [dia, e] of porDia) { ef.dias[dia] = ef.dias[dia] || {}; ef.dias[dia][g.codigo] = { hora: e.hora, por: e.por, postadoEm: e.postadoEm, solida: e.solida, terceiros: e.terceiros, total: e.total }; }
  }
  // o histórico NÃO é apagado: fica tudo (quem estava em cada obra em cada dia); o `corte` só limita quanto das mensagens guardadas é relido
  ef.atualizadoEm = agora(); ef.fonte = 'WhatsApp · grupos das obras (leitura automática, só leitura)';
  gravarJSON(efArq, ef);
}

// ---------------------------------------------------------------- ferramentas obrigatórias
// Só registra o que dá para ter certeza: foto/folha do Anderson com legenda que identifica o local, ou a legenda curta numa resposta
// à foto. O resto vai para "naoIdentificadas" (a rotina diária com o Claude olha as fotos e resolve).
function identificarLocal(texto) {
  const t = semAcento(texto);
  let m = t.match(/\b(mo|po)\s*-?\s*(\d{3})/); if (m) return `${m[1] === 'mo' ? 'Mo' : 'Po'}${m[2]}`;
  if (/\b(galp|estoque|epi)/.test(t)) return 'Estoque';
  if (/(carro|strada).*anderson|anderson.*(carro|strada)/.test(t) || /^strada anderson/.test(t)) return 'Carro do Anderson';
  if (/nascimento/.test(t)) return 'Carro do Nascimento';
  if (/\benio\b/.test(t)) return 'Carro do Enio';
  return null;
}
const limite = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const check = lerJSON(checklistArq, { registros: [] });
check.registros = Array.isArray(check.registros) ? check.registros : [];
check.naoIdentificadas = [];
let adicionados = 0;
for (const m of novasFerramentas) {
  if (m.minha || !m.data || m.data < limite || !/anderson/i.test(m.autor || '')) continue;
  const texto = String(m.texto || '').trim();
  if (/deixando|retirando|retirado|quebrad|queimad|defeit|danific|falha|estragad|rota|reuni/i.test(texto)) continue;
  // só vale a folha: legenda é só o código da obra ("Mo 581"), ou fala em ferramentas/folha/checklist/galpão/carro. Foto de uma peça com o nome da obra NÃO é a folha.
  const soCodigo = /^(mo|po)\s*-?\s*\d{3}\s*$/i.test(texto);
  const dizFolha = /\b(ferramentas?|folha|checklist|lista|galp\w*|estoque|carro|strada)\b/i.test(texto);
  const eMidia = m.midia === 'imagem' || m.midia === 'documento';
  const curto = soCodigo || /^ferramentas?\b/i.test(texto);
  if (eMidia ? !(soCodigo || dizFolha || !texto) : !curto) continue;
  const local = identificarLocal(texto);
  if (!local) { if (eMidia) check.naoIdentificadas.push({ enviadoEm: m.data, hora: m.hora, conversa: m.conversa, midia: m.midia, encaminhada: m.encaminhada, legenda: texto }); continue; }
  const ja = check.registros.some((r) => r.enviadoEm === m.data && (r.local === local || String(r.local).startsWith(local)));
  if (ja) continue;
  check.registros.push({ local, enviadoEm: m.data, hora: m.hora, por: 'Anderson', obs: `lido automaticamente do WhatsApp (${m.conversa})` });
  adicionados++;
}
// só afirma que leu se ao menos uma conversa abriu de verdade (senão não mexe no "verificadoEm": o sistema nunca diz que faltou sem ter lido)
const leu = resultado.some((r) => !r.erro);
if (leu) { check.verificadoEm = agora(); gravarJSON(checklistArq, check); }
gravarStatus({ ok: leu, ferramentasNovas: adicionados, naoIdentificadas: check.naoIdentificadas.length, conversas: resultado });
console.log(`WhatsApp: ${resultado.map((r) => `${r.nome}: ${r.erro ? `ERRO (${r.erro})` : `${r.novas} novas`}`).join(' · ')} · ferramentas +${adicionados}`);
encerrar(leu ? 0 : 1);

function semAcentoJS() { return "((s) => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim())"; }
