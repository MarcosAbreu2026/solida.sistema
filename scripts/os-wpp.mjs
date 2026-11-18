// OS pelo WhatsApp (pedido do Felipe, 18/11/2026): lê as mensagens novas do grupo do Pós-obra e abre OS no Quadro de OS (de PO que já existe ou de PO novo).
// Sem IA e sem API paga: são regras de texto simples (como o efetivo-parser). Se faltar informação, o sistema PERGUNTA no próprio grupo e, quando a pessoa responde, cria a OS sozinho.
// Roda dentro do leitor do WhatsApp (leitor-whatsapp.mjs), no computador do escritório. Estado em dados/whatsapp/os-wpp.json (só neste computador).
//
// O que vira pedido de OS: mensagem que COMEÇA com "OS", "Nova OS", "Abrir OS", "Chamado" ou "Solicitação" (ou tem "nova OS" / "abrir OS" no texto). Exemplos:
//   "Nova OS PO420 - infiltração no banheiro. Problema: mancha de umidade no teto"
//   "OS PO - Carol: trocar fechadura da porta de entrada. Endereço: Rua das Acácias 193"
// Mensagens comuns da conversa NÃO criam nada. Cada mensagem é tratada uma só vez (id da mensagem) e a OS leva a origem "wpp:<id>", então nunca duplica.
//
// Modos (dados/whatsapp-grupos.json › na conversa: "os_wpp": { "modo": "simulacao" | "ativo" }):
//   simulacao (padrão): só escreve no dados/whatsapp/os-wpp-log.json o que FARIA (criar/perguntar); não cria nada e não envia nada.
//   ativo: cria as OS (e o PO novo, se for o caso) e envia as perguntas no grupo.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const MARCA = '🤖 Sistema Sólida:';   // toda mensagem enviada pelo sistema começa assim (e o sistema ignora o que começa assim)
const HORAS_VALIDADE = 72;                   // pergunta sem resposta é esquecida depois de 3 dias

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const limpa = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^[\s:\-–—,.]+|[\s:\-–—,.]+$/g, '').trim();
const chavePO = (s) => { const m = /^(?:po)\s*[-_]?\s*(\d{2,4}[a-z]?)\b/i.exec(String(s || '').trim()); return m ? `po${m[1].toLowerCase()}` : semAcento(s); };
const GATILHO = /^\s*(?:nova\s+os|abrir\s+os|os\s+nova|novo\s+chamado|abrir\s+chamado|chamado|solicita[cç][aã]o(?:\s+de\s+os)?|os)\b\s*[:\-–—]?\s*/i;
const GATILHO_NO_TEXTO = /\b(?:nova\s+os|abrir\s+(?:uma\s+)?os|abrir\s+chamado)\b/i;

// ---------------------------------------------------------------- leitura de uma mensagem
// devolve null (não é pedido de OS) ou { po: 'PO420' | '', cliente, endereco, assunto, problema }
export function lerPedidoOS(texto) {
  const t = String(texto || '').trim();
  if (!t || t.startsWith(MARCA)) return null;
  const comGatilho = GATILHO.test(t) || GATILHO_NO_TEXTO.test(t);
  if (!comGatilho) return null;
  let resto = t.replace(GATILHO, '').trim();
  const linhas = resto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const unido = linhas.join('\n');
  const campo = (nome) => { const m = new RegExp(`(?:^|\\n|[.;])\\s*${nome}\\s*[:\\-–]\\s*([^\\n]+)`, 'i').exec(unido); return m ? limpa(m[1]) : ''; };
  let po = ''; let cliente = campo('cliente'); const endereco = campo('endere[cç]o');
  const mCod = /\bpo\s*[-_]?\s*(\d{2,4}[a-z]?)\b/i.exec(unido);
  if (mCod) po = `PO${mCod[1].toUpperCase()}`;
  else { const mNome = /\bpo\s*[-–]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,35}?)(?=\s*(?:[:.,;\n]|$|\s-\s|\s–\s))/i.exec(unido); if (mNome) { po = `PO - ${limpa(mNome[1])}`; if (!cliente) cliente = limpa(mNome[1]); } }
  let assunto = campo('assunto');
  let problema = campo('(?:problema|relato|descri[cç][aã]o)');
  if (!assunto) {
    // primeira frase útil: sem o código do PO e sem os campos rotulados
    let base = linhas.filter((l) => !/^(?:cliente|endere[cç]o|problema|relato|descri[cç][aã]o|assunto)\s*[:\-–]/i.test(l))[0] || '';
    base = base.replace(/\bpo\s*[-_]?\s*\d{2,4}[a-z]?\b/ig, '').replace(/\bpo\s*[-–]\s*[A-Za-zÀ-ÿ ]{2,35}?(?=\s*[:.,;]|$)/i, '').replace(/\b(?:cliente|endere[cç]o|problema|relato)\s*[:\-–].*$/i, '');
    base = limpa(base);
    const primeira = limpa(base.split(/[.;]\s|\s[-–]\s/)[0]);
    assunto = primeira.slice(0, 100);
    if (!problema) { const depois = limpa(base.slice(primeira.length)); if (depois) problema = depois; }
  }
  if (!problema) { const outras = linhas.slice(1).filter((l) => !/^(?:cliente|endere[cç]o|assunto)\s*[:\-–]/i.test(l)).join(' '); if (outras) problema = limpa(outras); }
  return { po, cliente: limpa(cliente), endereco: limpa(endereco), assunto: limpa(assunto), problema: limpa(problema) };
}

// ---------------------------------------------------------------- o que falta e a pergunta
// pos = [{ codigo, cliente }] (PO cadastrados). Devolve o PO já resolvido (existente ou novo) e a lista do que falta.
export function avaliar(campos, pos = []) {
  const c = { ...campos }; const faltam = [];
  let existente = null;
  if (c.po) existente = pos.find((p) => chavePO(p.codigo) === chavePO(c.po)) || null;
  if (!existente && !c.po && c.cliente) {
    const k = semAcento(c.cliente); existente = pos.find((p) => p.cliente && semAcento(p.cliente) === k) || pos.find((p) => p.cliente && (semAcento(p.cliente).includes(k) || k.includes(semAcento(p.cliente)))) || null;
  }
  if (existente) { c.po = existente.codigo; c.novoPO = false; }
  else {
    c.novoPO = true;
    if (!c.po && !c.cliente) faltam.push('po');
    else { if (!c.cliente) faltam.push('cliente'); if (!c.endereco) faltam.push('endereco'); if (!c.po && c.cliente) c.po = `PO - ${c.cliente}`; }
  }
  if (!c.assunto) faltam.push('assunto');
  return { campos: c, faltam: [...new Set(faltam)] };
}
const PERGUNTA = {
  po: 'Qual é o PO? (o código, ex.: PO420, ou o nome do cliente)',
  cliente: 'Qual o nome do cliente deste PO novo?',
  endereco: 'Qual o endereço da obra (rua, número, bairro)? O PO ainda não está cadastrado.',
  assunto: 'Qual o assunto da OS? (ex.: infiltração no banheiro)',
};
export function montarPergunta(autor, faltam) {
  const quem = limpa(autor) || 'Pessoal';
  return `${MARCA} ${quem}, para abrir a OS preciso de:\n${faltam.map((f) => `• ${PERGUNTA[f]}`).join('\n')}\nResponda aqui no grupo (pode ser numa mensagem só).`;
}

// resposta de quem foi cobrado: linhas rotuladas ("endereço: ...") ou, sem rótulo, o texto vai para o que falta (na ordem)
export function aplicarResposta(pend, texto) {
  const c = { ...pend.campos }; const t = String(texto || '').trim();
  const rot = (nome) => { const m = new RegExp(`(?:^|\\n)\\s*${nome}\\s*[:\\-–]\\s*([^\\n]+)`, 'i').exec(t); return m ? limpa(m[1]) : ''; };
  const lab = { po: rot('(?:po|obra)'), cliente: rot('cliente'), endereco: rot('endere[cç]o'), assunto: rot('assunto') };
  for (const k of Object.keys(lab)) if (lab[k]) c[k === 'po' ? 'po' : k] = lab[k];
  let faltam = pend.faltam.filter((f) => !lab[f]);
  const linhas = t.split(/\r?\n/).map((l) => limpa(l)).filter(Boolean).filter((l) => !/^(?:po|obra|cliente|endere[cç]o|assunto)\s*[:\-–]/i.test(l));
  if (faltam.length && linhas.length) {
    if (faltam.length === 1 || linhas.length === 1) {
      const f = faltam[0]; const txt = linhas.join(' ');
      if (f === 'po') { const m = /\bpo\s*[-_]?\s*(\d{2,4}[a-z]?)\b/i.exec(txt); if (m) c.po = `PO${m[1].toUpperCase()}`; else c.cliente = txt; }
      else c[f] = txt;
      faltam = faltam.slice(1);
      // com mais de um faltando e uma linha só: se parece endereço, vale para o endereço
      if (pend.faltam.includes('endereco') && /\b(rua|av\.?|avenida|estrada|travessa|alameda|pra[cç]a|r\.)\b/i.test(txt) && !c.endereco) { c.endereco = txt; if (f !== 'endereco') c[f] = pend.campos[f] || ''; }
    } else {
      faltam.forEach((f, i) => { if (linhas[i]) c[f === 'po' ? 'po' : f] = linhas[i]; });
    }
  }
  return c;
}

// ---------------------------------------------------------------- estado em disco
const lerJSON = (arq, padrao) => { try { return JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return padrao; } };
const gravarJSON = (arq, obj) => { mkdirSync(dirname(arq), { recursive: true }); writeFileSync(arq, `${JSON.stringify(obj, null, 2)}\n`, 'utf8'); };
const quando = (m) => `${m.data || ''}T${m.hora || '00:00'}`;
const horasEntre = (a, b) => { const x = Date.parse(a); const y = Date.parse(b); return Number.isFinite(x) && Number.isFinite(y) ? (y - x) / 3600000 : 0; };

// Núcleo sem rede: recebe as mensagens novas (em ordem), o estado e os PO cadastrados; devolve o que fazer.
export function processar({ mensagens, estado, pos, agora = new Date().toISOString() }) {
  const est = { processadas: [], pendentes: [], ...(estado || {}) };
  const feitas = new Set(est.processadas);
  const acoes = [];
  est.pendentes = est.pendentes.filter((p) => horasEntre(p.desde, agora) <= HORAS_VALIDADE);
  for (const m of [...mensagens].sort((a, b) => quando(a).localeCompare(quando(b)))) {
    if (!m.id || feitas.has(m.id)) continue;
    feitas.add(m.id);
    const texto = String(m.texto || '').trim();
    if (!texto || texto.startsWith(MARCA)) continue;   // o que o próprio sistema escreveu
    const autor = m.autor || '';
    // 1) resposta a uma pergunta nossa (mesma pessoa, depois da pergunta)
    const pend = est.pendentes.find((p) => p.autor === autor && p.perguntou);
    if (pend && !GATILHO.test(texto)) {
      const campos = aplicarResposta(pend, texto);
      const av = avaliar(campos, pos);
      if (!av.faltam.length) { acoes.push({ tipo: 'criar', origem: pend.origem, autor, quando: pend.quando, campos: av.campos }); est.pendentes = est.pendentes.filter((p) => p !== pend); }
      else { pend.campos = campos; pend.faltam = av.faltam; acoes.push({ tipo: 'perguntar', origem: pend.origem, autor, faltam: av.faltam, texto: montarPergunta(autor, av.faltam) }); }
      continue;
    }
    // 2) pedido novo
    const req = lerPedidoOS(texto); if (!req) continue;
    const av = avaliar(req, pos);
    if (!av.faltam.length) acoes.push({ tipo: 'criar', origem: `wpp:${m.id}`, autor, quando: quando(m), campos: av.campos });
    else {
      est.pendentes = est.pendentes.filter((p) => p.autor !== autor);   // um pedido aberto por pessoa
      est.pendentes.push({ origem: `wpp:${m.id}`, autor, desde: agora, quando: quando(m), campos: av.campos, faltam: av.faltam, perguntou: true });
      acoes.push({ tipo: 'perguntar', origem: `wpp:${m.id}`, autor, faltam: av.faltam, texto: montarPergunta(autor, av.faltam) });
    }
  }
  est.processadas = [...feitas].slice(-1500);
  return { estado: est, acoes };
}

// ---------------------------------------------------------------- banco (conta do coletor) e execução
async function entrar(raiz) {
  const arq = join(raiz, 'config.local.json');
  if (!existsSync(arq)) throw new Error('Sem config.local.json (conta do coletor).');
  const cfg = JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, ''));
  const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: cfg.chavePublica, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cfg.coletorEmail, password: cfg.coletorSenha }) });
  if (!r.ok) throw new Error(`Não entrei com a conta do coletor (${r.status}).`);
  const token = (await r.json()).access_token;
  const H = { Authorization: `Bearer ${token}`, apikey: cfg.chavePublica, 'Content-Type': 'application/json' };
  return {
    async pos() { const x = await fetch(`${cfg.supabaseUrl}/rest/v1/obras_cadastro?select=codigo,cliente,tipo&tipo=eq.pos`, { headers: H }); if (!x.ok) throw new Error(`obras_cadastro: ${x.status}`); return x.json(); },
    async rpc(nome, args) { const x = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${nome}`, { method: 'POST', headers: H, body: JSON.stringify(args) }); if (!x.ok) throw new Error(`${nome}: ${x.status} ${await x.text()}`); const t = await x.text(); return t ? JSON.parse(t) : null; },
  };
}

// roda uma rodada: mensagens novas do grupo → cria OS / pergunta. `enviar(texto)` manda no grupo (só no modo ativo). Devolve um resumo.
export async function rodar({ raiz, mensagens, modo = 'simulacao', enviar = null }) {
  const arqEstado = join(raiz, 'dados', 'whatsapp', 'os-wpp.json');
  const arqLog = join(raiz, 'dados', 'whatsapp', 'os-wpp-log.json');
  const primeiraVez = !existsSync(arqEstado);
  const estado = lerJSON(arqEstado, {});
  if (primeiraVez) {   // histórico do grupo: marca tudo como já visto, sem criar nem perguntar nada (só mensagens novas daqui em diante)
    gravarJSON(arqEstado, { processadas: mensagens.map((m) => m.id).filter(Boolean).slice(-1500), pendentes: [], inicio: new Date().toISOString() });
    return { ok: true, baseline: mensagens.length, acoes: 0 };
  }
  let db = null; let pos = [];
  try { db = await entrar(raiz); pos = await db.pos(); } catch (e) { return { ok: false, motivo: e.message }; }
  const { estado: novo, acoes } = processar({ mensagens, estado, pos });
  const log = lerJSON(arqLog, { registros: [] });
  const resumo = { criadas: 0, perguntas: 0, simuladas: 0, erros: [] };
  for (const a of acoes) {
    const reg = { em: new Date().toISOString(), modo, ...a };
    try {
      if (modo !== 'ativo') { resumo.simuladas++; reg.resultado = 'simulado'; }
      else if (a.tipo === 'criar') {
        const c = a.campos;
        if (c.novoPO) await db.rpc('po_wpp_criar', { p_codigo: c.po, p_cliente: c.cliente || c.po, p_endereco: c.endereco });
        const origemTxt = `Aberta pelo WhatsApp por ${a.autor || 'alguém do grupo'} (${String(a.quando || '').replace('T', ' ')})`;
        const cod = await db.rpc('os_wpp_criar', { p_origem: a.origem, p_cliente: c.po, p_assunto: c.assunto, p_problema: [c.problema, origemTxt].filter(Boolean).join('\n') });
        reg.resultado = `criada ${cod}`; resumo.criadas++;
        if (enviar) { await enviar(`${MARCA} OS ${cod} aberta para ${c.po}: ${c.assunto}. Já está no Quadro de OS (Solicitação).`); }
      } else if (a.tipo === 'perguntar') {
        if (enviar) { await enviar(a.texto); reg.resultado = 'perguntou'; resumo.perguntas++; } else reg.resultado = 'sem como enviar';
      }
    } catch (e) { reg.resultado = `erro: ${e.message}`; resumo.erros.push(e.message); }
    log.registros.push(reg);
  }
  log.registros = log.registros.slice(-300);
  // estado só avança para as ações que deram certo (se algo falhou, a mensagem será tratada de novo na próxima rodada)
  if (resumo.erros.length) novo.processadas = estado.processadas || [];
  gravarJSON(arqEstado, novo); gravarJSON(arqLog, log);
  return { ok: true, ...resumo, acoes: acoes.length };
}
