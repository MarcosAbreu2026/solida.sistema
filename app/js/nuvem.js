// Sistema na nuvem (Vercel + Supabase). Quando o endereço não é o do computador do escritório
// (localhost), tudo passa por aqui: login, dados lidos do Drive (o computador do escritório manda a cada
// 10 min para o Supabase), marcações das tarefas, Feed, pedidos de alteração, fotos e presença no escritório.
// As regras de quem vê o quê ficam no próprio banco (supabase/schema.sql): esta parte só pede os dados.


export const NA_NUVEM = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

const URL_SUPABASE = 'https://ghqlkznukbdqnbwhqbdn.supabase.co';
// chave pública do projeto (feita para ficar no navegador; o que cada um vê é controlado pelas regras do banco)
const CHAVE_PUBLICA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocWxrem51a2JkcW5id2hxYmRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODgzMzAsImV4cCI6MjEwNzY2NDMzMH0.FzacsPfSnMGJLown00Ti4hk6_oFfWrFbnvfRV1GPg8o';

// a biblioteca do Supabase só é baixada na nuvem (no computador do escritório o sistema funciona sem internet)
export const sb = NA_NUVEM
  ? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')).createClient(URL_SUPABASE, CHAVE_PUBLICA, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// ---------------------------------------------------------------- login
let perfil = null;          // { id, email, nome, funcao, obras, ativo }
export const perfilAtual = () => perfil;

export async function carregarPerfil() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { perfil = null; return null; }
  const { data } = await sb.from('perfis').select('*').eq('id', session.user.id).maybeSingle();
  perfil = data || { id: session.user.id, email: session.user.email, nome: session.user.email.split('@')[0], funcao: null, obras: [], ativo: true };
  return perfil;
}

const DOMINIO = '@construcaosolida.com';
const traduzir = (m) => {
  const t = String(m || '');
  if (/invalid login/i.test(t)) return 'E-mail ou senha errados.';
  if (/email not confirmed/i.test(t)) return 'Confirme o seu e-mail: abra o link que chegou na sua caixa de entrada.';
  if (/already registered|already been registered/i.test(t)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci a senha".';
  if (/password should be|at least/i.test(t)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/construcaosolida/i.test(t)) return `Use o seu e-mail ${DOMINIO}.`;
  if (/rate limit/i.test(t)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  return t || 'Não foi possível entrar.';
};
const conferirEmail = (email) => {
  const e = String(email || '').trim().toLowerCase();
  if (!e.endsWith(DOMINIO)) throw new Error(`Use o seu e-mail ${DOMINIO}.`);
  return e;
};

export async function entrar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email: conferirEmail(email), password: senha });
  if (error) throw new Error(traduzir(error.message));
  return carregarPerfil();
}
export async function criarConta(email, senha, nome) {
  if (String(senha || '').length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  const { data, error } = await sb.auth.signUp({ email: conferirEmail(email), password: senha, options: { data: { nome: String(nome || '').trim() }, emailRedirectTo: `${location.origin}/` } });
  if (error) throw new Error(traduzir(error.message));
  return data.session ? carregarPerfil() : null;   // null = falta confirmar o e-mail
}
export async function esqueciSenha(email) {
  const { error } = await sb.auth.resetPasswordForEmail(conferirEmail(email), { redirectTo: `${location.origin}/` });
  if (error) throw new Error(traduzir(error.message));
}
export async function trocarSenha(senha) {
  if (String(senha || '').length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) throw new Error(traduzir(error.message));
}
export async function sair() { perfil = null; await sb.auth.signOut(); }

// ---------------------------------------------------------------- equipe (diretoria libera e define a função)
export async function listarPerfis() {
  const { data } = await sb.from('perfis').select('*').order('nome');
  return data || [];
}
export async function salvarPerfil(id, mudancas) {
  const { error } = await sb.from('perfis').update(mudancas).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- dados lidos do Drive
// O computador do escritório manda cada arquivo em duas pastas: todos/ (sem valores) e valores/ (completo,
// só sócio e financeiro conseguem ler — regra do banco).
const veValoresNuvem = () => perfil && ['socio', 'financeiro'].includes(perfil.funcao);
export async function baixar(nome) {
  for (const pasta of veValoresNuvem() ? ['valores', 'todos'] : ['todos']) {
    const { data, error } = await sb.storage.from('dados').download(`${pasta}/${nome}.json`);
    if (!error && data) { try { return JSON.parse(await data.text()); } catch { /* arquivo inválido */ } }
  }
  return null;
}

// ---------------------------------------------------------------- marcações (mesmo formato do servidor local)
// devolve linhas { pessoa, nome, funcao, obras, registro, data, tarefa, valor }
export async function linhasTarefas() {
  const [{ data: ps }, { data: ms }] = await Promise.all([
    sb.from('perfis').select('id, nome, funcao, obras').not('funcao', 'is', null),
    sb.from('tarefas_marcadas').select('pessoa, data, tarefa, valor'),
  ]);
  const quem = new Map((ps || []).map((p) => [p.id, p]));
  const out = (ps || []).map((p) => ({ pessoa: p.id, nome: p.nome, funcao: p.funcao, obras: p.obras || [], registro: true }));
  for (const m of ms || []) { const p = quem.get(m.pessoa) || {}; out.push({ pessoa: m.pessoa, nome: p.nome || '', funcao: p.funcao || '', data: m.data, tarefa: m.tarefa, valor: m.valor }); }
  return out;
}
export async function marcarTarefa({ data, tarefa, valor }) {
  if (!perfil || !data || !tarefa) return;
  if (valor) await sb.from('tarefas_marcadas').upsert({ pessoa: perfil.id, data, tarefa, valor, em: new Date().toISOString() });
  else await sb.from('tarefas_marcadas').delete().match({ pessoa: perfil.id, data, tarefa });
}

// ---------------------------------------------------------------- Feed (devolve os mesmos "eventos" do servidor local)
export async function eventosFeed() {
  const [{ data: ps }, { data: cs }, { data: ks }, { data: pf }] = await Promise.all([
    sb.from('feed_posts').select('*').order('criado_em'), sb.from('feed_comentarios').select('*').order('criado_em'),
    sb.from('feed_curtidas').select('*'), sb.from('perfis').select('id, nome, funcao'),
  ]);
  const nome = new Map((pf || []).map((p) => [p.id, p]));
  const ev = [];
  for (const p of ps || []) {
    const a = nome.get(p.autor) || {};
    ev.push({ id: String(p.id), acao: 'publicar', autor: a.nome || '', funcao: a.funcao || '', texto: p.texto, em: p.criado_em });
    if (p.fixado) ev.push({ acao: 'fixar', post: String(p.id), valor: true, em: p.criado_em });
  }
  for (const c of cs || []) ev.push({ id: String(c.id), acao: 'comentar', post: String(c.post), autor: (nome.get(c.autor) || {}).nome || '', texto: c.texto, em: c.criado_em });
  for (const k of ks || []) ev.push({ acao: 'curtir', post: String(k.post), autor: (nome.get(k.pessoa) || {}).nome || '', valor: true });
  return ev;
}
export async function acaoFeed({ acao, post, texto, valor }) {
  let r;
  if (acao === 'publicar') r = await sb.from('feed_posts').insert({ autor: perfil.id, texto });
  else if (acao === 'comentar') r = await sb.from('feed_comentarios').insert({ post: Number(post), autor: perfil.id, texto });
  else if (acao === 'curtir') r = valor ? await sb.from('feed_curtidas').upsert({ post: Number(post), pessoa: perfil.id }) : await sb.from('feed_curtidas').delete().match({ post: Number(post), pessoa: perfil.id });
  else if (acao === 'fixar') r = await sb.from('feed_posts').update({ fixado: !!valor }).eq('id', Number(post));
  else if (acao === 'apagar') r = texto && texto.startsWith('c:') ? await sb.from('feed_comentarios').delete().eq('id', Number(texto.slice(2))) : await sb.from('feed_posts').delete().eq('id', Number(post));
  if (r && r.error) throw new Error(r.error.message);
}

// ---------------------------------------------------------------- pedidos de alteração (formato do servidor local)
export async function listarPedidos() {
  const [{ data: ps }, { data: pf }] = await Promise.all([sb.from('pedidos').select('*').order('criado_em'), sb.from('perfis').select('id, nome, funcao')]);
  const nome = new Map((pf || []).map((p) => [p.id, p]));
  return (ps || []).map((p) => ({ id: String(p.id), data: p.criado_em, tela: p.tela, titulo: p.titulo, pessoa: (nome.get(p.autor) || {}).nome || '', funcao: (nome.get(p.autor) || {}).funcao || '', texto: p.texto, status: p.status, resposta: p.resposta }));
}
export async function enviarPedido({ tela, titulo, texto, diretoria }) {
  const { error } = await sb.from('pedidos').insert({ autor: perfil.id, tela, titulo, texto, status: diretoria ? 'aberto' : 'aprovacao', aprovado_por: diretoria ? perfil.id : null });
  if (error) throw new Error(error.message);
}
export async function decidirPedido(id, status) {
  const { error } = await sb.from('pedidos').update({ status, aprovado_por: perfil.id, ...(status === 'recusado' ? { resposta: 'Recusado pela diretoria.' } : {}) }).eq('id', Number(id)).eq('status', 'aprovacao');
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- fotos do perfil (pasta = id da pessoa)
// devolve { chaveDoNome: url }
export async function listarFotos(chaveFoto) {
  const { data: pf } = await sb.from('perfis').select('id, nome');
  const out = {};
  await Promise.all((pf || []).map(async (p) => {
    const { data: l } = await sb.storage.from('fotos').list(p.id, { limit: 1 });
    if (!l || !l.length) return;
    const { data } = await sb.storage.from('fotos').createSignedUrl(`${p.id}/${l[0].name}`, 60 * 60 * 6);
    if (data && data.signedUrl) out[chaveFoto(p.nome)] = data.signedUrl;
  }));
  return out;
}
export async function enviarFoto(blob) {
  const { data: l } = await sb.storage.from('fotos').list(perfil.id);
  if (l && l.length) await sb.storage.from('fotos').remove(l.map((x) => `${perfil.id}/${x.name}`));
  const { error } = await sb.storage.from('fotos').upload(`${perfil.id}/foto-${Date.now()}.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
}
export async function removerFoto() {
  const { data: l } = await sb.storage.from('fotos').list(perfil.id);
  if (l && l.length) await sb.storage.from('fotos').remove(l.map((x) => `${perfil.id}/${x.name}`));
}

// ---------------------------------------------------------------- escritório virtual (presença em tempo real)
let canal = null; let pronto = false;
export async function presenca(meu) {
  if (!canal) {
    canal = sb.channel('escritorio', { config: { presence: { key: meu.id } } });
    canal.subscribe((st) => { pronto = st === 'SUBSCRIBED'; });
  }
  if (pronto) await canal.track(meu);
  return Object.values(canal.presenceState()).map((xs) => xs[xs.length - 1]);
}
export async function sairDaPresenca() { if (canal) { try { await canal.untrack(); await sb.removeChannel(canal); } catch { /* nada */ } canal = null; pronto = false; } }
