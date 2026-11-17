// Função "gcal": liga as reuniões do sistema ao Google Agenda do sistema (API gratuita do Google, uma única conta Google).
//   POST { acao: 'url' }                 (diretoria) devolve o endereço para autorizar a conta do Google
//   GET  ?code=...&state=...             (o Google volta aqui) guarda a autorização, mostra a conta ligada e envia as reuniões pendentes
//   POST { acao: 'sync', ids?: [...] }   leva ao Google Agenda as reuniões indicadas e as pendentes (cria, atualiza ou apaga o evento e convida as pessoas)
// Os segredos (ID/chave do cliente OAuth e a autorização da conta) ficam na tabela google_agenda, que só esta função lê (service role).
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDIRECT = `${URL_SB}/functions/v1/gcal`;
const VOLTA = 'https://sistema-solida.vercel.app/#/configuracoes?secao=automacoes';
const FUSO = 'America/Sao_Paulo';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const servico = () => createClient(URL_SB, SERVICO, { auth: { persistSession: false } });
async function usuario(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const sb = createClient(URL_SB, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  if (error || !data.user) return null;
  return { sb, id: data.user.id };
}

async function config() {
  const { data } = await servico().from('google_agenda').select('*').eq('id', 1).single();
  return data as Record<string, string | null> | null;
}
async function tokenDeAcesso(cfg: Record<string, string | null>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.client_id!, client_secret: cfg.client_secret!, refresh_token: cfg.refresh_token!, grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`Google recusou a autorização (${j.error_description || j.error || r.status}). Conecte a conta de novo em Configurações › Automações.`);
  return j.access_token as string;
}

const hora = (h: string) => (String(h).length === 5 ? `${h}:00` : String(h));
function eventoDe(r: Record<string, unknown>, emails: string[]) {
  return {
    summary: r.nome, location: r.local || undefined,
    description: `Reunião criada no Sistema Sólida.${r.setor ? `\nDepartamento: ${r.setor}` : ''}${r.obra ? `\nObra: ${r.obra}` : ''}\nPara mudar a reunião, edite no sistema.`,
    start: { dateTime: `${r.data}T${hora(String(r.ini))}`, timeZone: FUSO },
    end: { dateTime: `${r.data}T${hora(String(r.fim))}`, timeZone: FUSO },
    attendees: emails.map((email) => ({ email })),
    reminders: { useDefault: true },
  };
}

async function levar(cfg: Record<string, string | null>, ids: number[]) {
  const sb = servico(); const resultado: Record<string, string> = {};
  const { data: porId } = ids.length ? await sb.from('reunioes').select('*').in('id', ids) : { data: [] };
  const { data: pend } = await sb.from('reunioes').select('*').eq('gcal_sync', 'pendente').order('data').limit(40);
  const mapa = new Map<number, Record<string, unknown>>();
  for (const r of [...(porId || []), ...(pend || [])]) mapa.set(r.id as number, r);
  const acesso = await tokenDeAcesso(cfg);
  const cal = encodeURIComponent(cfg.calendar_id || 'primary');
  const H = { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' };
  for (const r of mapa.values()) {
    const id = String(r.id);
    try {
      const evId = r.gcal_event_id as string | null;
      if (r.cancelada) {
        if (evId) { const d = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${evId}?sendUpdates=all`, { method: 'DELETE', headers: H }); if (!d.ok && d.status !== 404 && d.status !== 410) throw new Error(`apagar: ${d.status} ${await d.text()}`); }
        await sb.from('reunioes').update({ gcal_sync: 'ok', gcal_erro: null, gcal_sync_em: new Date().toISOString() }).eq('id', r.id);
        resultado[id] = 'apagada'; continue;
      }
      const pessoas = ((r.convidados as string[]) || []);
      const { data: perfis } = pessoas.length ? await sb.from('perfis').select('id,nome,emails_agenda').in('id', pessoas) : { data: [] };
      const semEmail = (perfis || []).filter((p: { emails_agenda: string[] | null }) => !(p.emails_agenda || []).length).map((p: { nome: string }) => p.nome);
      const emails = [...new Set([...(perfis || []).flatMap((p: { emails_agenda: string[] | null }) => p.emails_agenda || []).filter(Boolean), ...(((r.emails_externos as string[]) || []))])];
      const corpo = JSON.stringify(eventoDe(r, emails));
      const url = evId ? `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${evId}?sendUpdates=all` : `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?sendUpdates=all`;
      const resp = await fetch(url, { method: evId ? 'PATCH' : 'POST', headers: H, body: corpo });
      const ev = await resp.json();
      if (!resp.ok) throw new Error(`${resp.status} ${(ev.error && ev.error.message) || ''}`);
      await sb.from('reunioes').update({ gcal_event_id: ev.id, gcal_sync: 'ok', gcal_erro: semEmail.length ? `Sem e-mail da Sólida cadastrado (não foram convidados): ${semEmail.join(', ')}` : null, gcal_sync_em: new Date().toISOString() }).eq('id', r.id);
      resultado[id] = evId ? 'atualizada' : 'criada';
    } catch (e) {
      await sb.from('reunioes').update({ gcal_sync: 'erro', gcal_erro: String((e as Error).message || e).slice(0, 300), gcal_sync_em: new Date().toISOString() }).eq('id', r.id);
      resultado[id] = 'erro';
    }
  }
  return resultado;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  try {
    // 1) o Google volta aqui depois da autorização
    if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
      const cfg = await config();
      const state = url.searchParams.get('state') || '';
      const volta = (q: string) => Response.redirect(`${VOLTA}&gcal=${q}`, 302);
      if (url.searchParams.get('error')) return volta('negado');
      if (!cfg || !cfg.oauth_state || cfg.oauth_state !== state || Date.now() - Date.parse(String(cfg.oauth_state_em)) > 15 * 60 * 1000) return volta('estado');
      const t = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: cfg.client_id!, client_secret: cfg.client_secret!, redirect_uri: REDIRECT, grant_type: 'authorization_code' }) });
      const tj = await t.json();
      if (!t.ok || !tj.refresh_token) return volta('semtoken');
      let email = '';
      try { const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tj.access_token}` } })).json(); email = u.email || ''; } catch { /* sem e-mail */ }
      await servico().from('google_agenda').update({ refresh_token: tj.refresh_token, email, oauth_state: null, conectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq('id', 1);
      try { await levar({ ...cfg, refresh_token: tj.refresh_token }, []); } catch { /* as pendentes seguem na próxima */ }
      return volta('ok');
    }
    const u = await usuario(req);
    if (!u) return json({ erro: 'Entre no sistema primeiro.' }, 401);
    const corpo = await req.json().catch(() => ({}));
    // 2) endereço de autorização (só a diretoria)
    if (corpo.acao === 'url') {
      const { data: dir } = await u.sb.rpc('eh_diretoria');
      if (!dir) return json({ erro: 'Só a diretoria.' }, 403);
      const cfg = await config();
      if (!cfg || !cfg.client_id || !cfg.client_secret) return json({ erro: 'Salve primeiro o ID e a chave do cliente OAuth do Google.' }, 400);
      const state = crypto.randomUUID();
      await servico().from('google_agenda').update({ oauth_state: state, oauth_state_em: new Date().toISOString() }).eq('id', 1);
      const q = new URLSearchParams({ client_id: cfg.client_id, redirect_uri: REDIRECT, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events openid email', access_type: 'offline', prompt: 'consent', state });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, redirect: REDIRECT });
    }
    // 3) levar reuniões ao Google Agenda
    if (corpo.acao === 'sync') {
      const cfg = await config();
      if (!cfg || !cfg.refresh_token) return json({ ok: false, motivo: 'nao_conectado' });
      // só reuniões que a própria pessoa pode ver (regras do banco); as pendentes de todos seguem junto
      const ids: number[] = [];
      if (Array.isArray(corpo.ids) && corpo.ids.length) {
        const { data } = await u.sb.from('reunioes').select('id').in('id', corpo.ids.map(Number).filter(Number.isFinite));
        ids.push(...(data || []).map((x: { id: number }) => x.id));
      }
      return json({ ok: true, resultado: await levar(cfg, ids) });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
