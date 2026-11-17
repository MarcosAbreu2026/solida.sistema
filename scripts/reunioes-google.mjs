// Ponte entre as reuniões do sistema e o Google Agenda do sistema (roda no COMPUTADOR DO ESCRITÓRIO, com a conta do coletor de config.local.json).
//   node scripts/reunioes-google.mjs pendentes                 grava dados/json/reunioes-pendentes.json com o que falta levar (ou tirar) do Google Agenda
//   node scripts/reunioes-google.mjs marcar <id> ok <idEvento>  a reunião já está no Google Agenda
//   node scripts/reunioes-google.mjs marcar <id> erro "texto"   deu errado (aparece na tela da reunião)
// Quem mexe no Google Agenda é a rotina do agente (docs/procedimentos/sincronizar-reunioes-google-agenda.md): ela lê o arquivo, cria/atualiza/apaga os eventos na
// conta do Google do sistema (logada no Chrome do escritório) e depois chama "marcar". Edição é sempre pelo sistema; o que for mudado direto no Google Agenda não volta.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgArq = join(raiz, 'config.local.json');
if (!existsSync(cfgArq)) { console.log('Sem config.local.json.'); process.exit(0); }
const cfg = JSON.parse(readFileSync(cfgArq, 'utf8').replace(/^﻿/, ''));
const { supabaseUrl, chavePublica } = cfg;
const r0 = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: chavePublica, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cfg.coletorEmail, password: cfg.coletorSenha }) });
if (!r0.ok) { console.log(`Não entrei com a conta do coletor (${r0.status}).`); process.exit(1); }
const token = (await r0.json()).access_token;
const H = { Authorization: `Bearer ${token}`, apikey: chavePublica, 'Content-Type': 'application/json' };
const [modo, id, resultado, extra] = process.argv.slice(2);

if (modo === 'pendentes') {
  const r = await fetch(`${supabaseUrl}/rest/v1/reunioes?gcal_sync=eq.pendente&select=*&order=data.asc,ini.asc`, { headers: H });
  if (!r.ok) { console.log(`Erro ao ler as reuniões (${r.status}) ${await r.text()}`); process.exit(1); }
  const reunioes = await r.json();
  // e-mails das pessoas da Sólida convidadas
  const ids = [...new Set(reunioes.flatMap((x) => x.convidados || []))];
  const pessoas = ids.length ? await (await fetch(`${supabaseUrl}/rest/v1/perfis?id=in.(${ids.join(',')})&select=id,nome,email`, { headers: H })).json() : [];
  const porId = new Map((Array.isArray(pessoas) ? pessoas : []).map((p) => [p.id, p]));
  const saida = reunioes.map((x) => ({
    id: x.id, acao: x.cancelada ? 'apagar' : (x.gcal_event_id ? 'atualizar' : 'criar'), eventoGoogle: x.gcal_event_id || null,
    titulo: x.nome, data: x.data, inicio: x.ini, fim: x.fim, local: x.local || '',
    convidados: [...(x.convidados || []).map((i) => (porId.get(i) || {}).email).filter(Boolean), ...(x.emails_externos || [])],
    semEmail: (x.convidados || []).filter((i) => !(porId.get(i) || {}).email).map((i) => (porId.get(i) || {}).nome || i),
  }));
  mkdirSync(join(raiz, 'dados', 'json'), { recursive: true });
  writeFileSync(join(raiz, 'dados', 'json', 'reunioes-pendentes.json'), JSON.stringify({ geradoEm: new Date().toISOString(), reunioes: saida }, null, 2));
  console.log(`${saida.length} reunião(ões) para levar ao Google Agenda.`);
} else if (modo === 'marcar' && id && resultado) {
  const mud = resultado === 'ok' ? { gcal_sync: 'ok', gcal_erro: null, gcal_sync_em: new Date().toISOString(), ...(extra ? { gcal_event_id: extra } : {}) }
    : { gcal_sync: 'erro', gcal_erro: String(extra || 'Falhou').slice(0, 300), gcal_sync_em: new Date().toISOString() };
  const r = await fetch(`${supabaseUrl}/rest/v1/reunioes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(mud) });
  console.log(r.ok ? `Reunião ${id} marcada: ${resultado}.` : `Erro ao marcar (${r.status}) ${await r.text()}`);
} else { console.log('Uso: node scripts/reunioes-google.mjs pendentes | marcar <id> ok <idEvento> | marcar <id> erro "texto"'); }
