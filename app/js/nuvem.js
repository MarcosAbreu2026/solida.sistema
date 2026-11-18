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

// login por usuário (ex.: "mariana"): por trás, vira um e-mail interno que nunca recebe mensagem
const emailDoUsuario = (u) => { const x = String(u || '').trim().toLowerCase(); return x.includes('@') ? x : `${x}@usuarios.construcaosolida.com`; };
const traduzir = (m) => {
  const t = String(m || '');
  if (/invalid login/i.test(t)) return 'Usuário ou senha errados.';
  if (/password should be|at least/i.test(t)) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (/rate limit/i.test(t)) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  return t || 'Não foi possível entrar.';
};

export async function entrar(usuario, senha) {
  if (!String(usuario || '').trim() || !senha) throw new Error('Preencha o usuário e a senha.');
  const { error } = await sb.auth.signInWithPassword({ email: emailDoUsuario(usuario), password: senha });
  if (error) throw new Error(traduzir(error.message));
  return carregarPerfil();
}
// primeiro acesso (ou senha redefinida pela diretoria): a pessoa cria a própria senha
export async function trocarSenha(senha) {
  if (String(senha || '').length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  const { error } = await sb.auth.updateUser({ password: senha });
  if (error) throw new Error(traduzir(error.message));
  await sb.rpc('senha_trocada');
  return carregarPerfil();
}
// diretoria: cria o login de alguém e redefine a senha de quem esqueceu (senha provisória)
export async function criarLogin({ usuario, nome, funcao, obras, senha }) {
  const { error } = await sb.rpc('criar_login', { p_usuario: usuario, p_nome: nome, p_funcao: funcao, p_obras: obras || [], p_senha: senha });
  if (error) throw new Error(error.message);
}
export async function redefinirSenha(id, senha) {
  const { error } = await sb.rpc('redefinir_senha', { p_id: id, p_senha: senha });
  if (error) throw new Error(error.message);
}
export async function excluirLogin(id) {
  const { error } = await sb.rpc('excluir_login', { p_id: id });
  if (error) throw new Error(error.message);
}
// abas por função (diretoria escolhe; todo mundo lê): { funcaoId: [ids] }
export async function carregarAbas() {
  const { data } = await sb.from('funcao_abas').select('funcao, abas');
  const m = {}; for (const r of data || []) m[r.funcao] = r.abas || [];
  return m;
}
export async function salvarAbas(gravar, apagar) {
  if (Object.keys(gravar).length) {
    const linhas = Object.entries(gravar).map(([funcao, abas]) => ({ funcao, abas, atualizado_em: new Date().toISOString() }));
    const { error } = await sb.from('funcao_abas').upsert(linhas);
    if (error) throw new Error(error.message);
  }
  if (apagar.length) {
    const { error } = await sb.from('funcao_abas').delete().in('funcao', apagar);
    if (error) throw new Error(error.message);
  }
}
// Cadastro de obras (diretoria): código, nome e situação (andamento · pausada · finalizada). Todos leem; só a diretoria grava.
export async function listarObras() {
  const { data, error } = await sb.from('obras_cadastro').select('*').order('codigo');
  if (error) throw new Error(error.message);
  return data || [];
}
// Grava (ou muda) um cadastro de obra: código, tipo (obra · orcamento · pos), cliente, endereço, arquitetura e situação. Só os campos informados são gravados.
// Sem as colunas novas no banco (SQL ainda não rodado), grava só código, nome e situação.
export async function salvarObra({ codigo, nome, situacao, tipo, cliente, endereco, arquitetura }) {
  const base = { codigo, atualizado_em: new Date().toISOString() };
  if (situacao !== undefined) base.situacao = situacao;
  const novos = {};
  if (tipo !== undefined) novos.tipo = tipo;
  if (cliente !== undefined) { novos.cliente = cliente || null; novos.nome = cliente || null; } else if (nome !== undefined) novos.nome = nome || null;
  if (endereco !== undefined) novos.endereco = endereco || null;
  if (arquitetura !== undefined) novos.arquitetura = arquitetura || null;
  let { error } = await sb.from('obras_cadastro').upsert({ ...base, ...novos });
  if (error && /column|schema cache/i.test(error.message)) {
    const { tipo: _t, cliente: _c, endereco: _e, arquitetura: _a, ...antigos } = novos;
    ({ error } = await sb.from('obras_cadastro').upsert({ ...base, ...antigos }));
  }
  if (error) throw new Error(error.message);
}
// Muda o código (número) da obra no cadastro e em tudo que a usa (tarefas, atas, OS, logins, agenda do pós-obra…): função renomear_obra do banco
export async function renomearObra(antigo, novo) {
  const { error } = await sb.rpc('renomear_obra', { p_antigo: antigo, p_novo: novo });
  if (error) throw new Error(error.message);
}
export async function excluirObra(codigo) {
  const { error } = await sb.from('obras_cadastro').delete().eq('codigo', codigo);
  if (error) throw new Error(error.message);
}
export function senhaProvisoria() {
  const L = 'abcdefghjkmnpqrstuvwxyz', N = '23456789', M = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const r = (s, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (v) => s[v % s.length]).join('');
  return `${r(M, 1)}${r(L, 4)}-${r(N, 4)}`;
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

// ---------------------------------------------------------------- atas e pendências (as regras de quem vê ficam no banco)
export async function listarAtasPendencias() {
  const [a, p, q] = await Promise.all([
    sb.from('atas').select('*').order('data', { ascending: false }).order('id', { ascending: false }),
    sb.from('pendencias').select('*').order('prazo', { ascending: true, nullsFirst: false }).order('id', { ascending: false }),
    sb.from('perfis').select('id, nome, funcao, obras, setores'),
  ]);
  if (a.error) throw new Error(a.error.message);
  if (p.error) throw new Error(p.error.message);
  return { atas: a.data || [], pendencias: p.data || [], pessoas: (q.data || []).filter((x) => x.funcao && x.funcao !== 'coletor') };
}
// pendência cujo ASSUNTO é um cômodo é da OBRA (não é tarefa de uma pessoa): app/js/comodos.js
import { pendenciaDaObra } from './comodos.js';
const daObraDe = (p) => (p.da_obra !== undefined ? !!p.da_obra : (!p.os && pendenciaDaObra(p.descricao)));
export async function criarAtaNuvem(ata, pendencias) {
  const { data, error } = await sb.from('atas').insert({ ...ata, criado_por: perfil.id, criado_por_nome: perfil.nome }).select().single();
  if (error) throw new Error(error.message);
  if (pendencias.length) {
    const linhas = pendencias.map((x) => ({ ...x, da_obra: !!ata.obra || daObraDe(x), ata_id: data.id, criado_por: perfil.id, obra: ata.obra || null, setor: ata.setor || null }));
    const { error: e2 } = await sb.from('pendencias').insert(linhas);
    if (e2) throw new Error(e2.message);
  }
  return data;
}
export async function criarPendenciaNuvem(p) {
  const { error } = await sb.from('pendencias').insert({ ...p, da_obra: daObraDe(p), criado_por: perfil.id });
  if (error) throw new Error(error.message);
}
// agenda semanal do pós-obra (quem vai para qual obra em qual dia)
export async function listarAgendaPos(de, ate) {
  const { data, error } = await sb.from('agenda_pos').select('*').gte('data', de).lte('data', ate).order('id');
  if (error) throw new Error(error.message);
  return data || [];
}
export async function criarAgendaPos(linha) {
  const { data, error } = await sb.from('agenda_pos').insert({ ...linha, criado_por: perfil.id }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
// gravações de reunião: o áudio vai para o armazenamento e o computador do escritório devolve o texto (Whisper)
export async function enviarGravacao(blob, duracaoS, titulo = '') {
  const ext = /ogg/.test(blob.type) ? 'ogg' : 'webm';
  const caminho = `${perfil.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
  const { error: e1 } = await sb.storage.from('audios').upload(caminho, blob, { contentType: blob.type || 'audio/webm' });
  if (e1) throw new Error(e1.message);
  const { data, error } = await sb.from('gravacoes').insert({ audio: caminho, duracao_s: duracaoS, titulo: titulo || null, criado_por: perfil.id }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function listarGravacoes() {
  const { data, error } = await sb.from('gravacoes').select('id,audio,duracao_s,titulo,status,texto,erro,modelo,criado_em,transcrita_em,criado_por').eq('criado_por', perfil.id).order('id', { ascending: false }).limit(10);
  if (error) throw new Error(error.message);
  return data || [];
}
export async function apagarGravacao(g) {
  await sb.storage.from('audios').remove([g.audio]).catch(() => {});
  const { error } = await sb.from('gravacoes').delete().eq('id', g.id);
  if (error) throw new Error(error.message);
}// dados cadastrais das obras do pós-obra completados no sistema
export async function listarObrasPos() {
  const { data, error } = await sb.from('obras_pos').select('*');
  if (error) throw new Error(error.message);
  return data || [];
}
export async function gravarObraPos(linha) {
  const { error } = await sb.from('obras_pos').upsert({ ...linha, atualizado_em: new Date().toISOString(), atualizado_por: perfil.id });
  if (error) throw new Error(error.message);
}
// histórico do efetivo (quem estava em cada obra em cada dia), gravado pelo coletor; só a diretoria, o administrativo, o RH e a coordenação leem
export async function listarEfetivoDiario() {
  const { data, error } = await sb.from('efetivo_diario').select('dia, obra, hora, solida_qtd, solida_nomes, terceiros, total').order('dia', { ascending: false }).range(0, 4999);
  if (error) throw new Error(error.message);
  return data || [];
}
// horário que cada pessoa escolheu para cada tarefa de "Minhas funções" (só ela vê e grava; vale para todas as semanas)
export async function listarHorariosTarefas() {
  const { data, error } = await sb.from('horarios_tarefas').select('tarefa, ini, dur, dias');
  if (error) throw new Error(error.message);
  return data || [];
}
export async function gravarHorarioTarefa(tarefa, v) {   // v = { ini?, dur? }
  const { error } = await sb.from('horarios_tarefas').upsert({ pessoa: perfil.id, tarefa, ini: v.ini ?? null, dur: v.dur ?? null, dias: v.dias ?? null, atualizado_em: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
export async function apagarHorarioTarefa(tarefa) {
  const { error } = await sb.from('horarios_tarefas').delete().eq('pessoa', perfil.id).eq('tarefa', tarefa);
  if (error) throw new Error(error.message);
}
// serviços do pós-obra em quadro por fase
export async function listarServicosPos() {
  const { data, error } = await sb.from('servicos_pos').select('*');
  if (error) throw new Error(error.message);
  return data || [];
}
export async function gravarServicoPos(linha) {
  const { error } = await sb.from('servicos_pos').upsert({ ...linha, atualizado_em: new Date().toISOString(), atualizado_por: perfil.id });
  if (error) throw new Error(error.message);
}
export async function listarAtualizacoesOs() {
  const { data, error } = await sb.from('os_atualizacoes').select('*').order('criado_em', { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return data || [];
}
export async function criarAtualizacaoOs(linha) {
  const { error } = await sb.from('os_atualizacoes').insert({ ...linha, criado_por: perfil.id });
  if (error) throw new Error(error.message);
}export async function apagarServicoPos(os) {
  const { error } = await sb.from('servicos_pos').delete().eq('os', os);
  if (error) throw new Error(error.message);
}
export async function criarAgendaPosLote(linhas) {
  if (!linhas.length) return;
  const { error } = await sb.from('agenda_pos').insert(linhas.map((l) => ({ ...l, criado_por: perfil.id })));
  if (error) throw new Error(error.message);
}
export async function atualizarAgendaPos(id, mudancas) {
  const { error } = await sb.from('agenda_pos').update(mudancas).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function apagarAgendaPos(id) {
  const { error } = await sb.from('agenda_pos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function atualizarAtaNuvem(id, mudancas) {
  const { error } = await sb.from('atas').update(mudancas).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function criarPendenciasNuvemLote(lista) {
  if (!lista.length) return [];
  const { data, error } = await sb.from('pendencias').insert(lista.map((p) => ({ ...p, da_obra: daObraDe(p), criado_por: perfil.id }))).select('id');
  if (error) throw new Error(error.message);
  return (data || []).map((x) => x.id);
}
export async function atualizarPendenciaNuvem(id, mudancas) {
  const { error } = await sb.from('pendencias').update(mudancas).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function apagarPendenciaNuvem(id) {
  const { error } = await sb.from('pendencias').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
// vários de uma vez; confere quantos foram mesmo apagados (sem permissão o banco não dá erro, só não apaga)
export async function apagarPendenciasNuvem(ids) {
  if (!ids.length) return;
  const { data, error } = await sb.from('pendencias').delete().in('id', ids).select('id');
  if (error) throw new Error(error.message);
  const n = (data || []).length;
  if (n < ids.length) throw new Error(n ? `só ${n} de ${ids.length} tarefas foram apagadas (as outras são de outra pessoa: só quem criou, o responsável ou a diretoria apaga)` : 'sem permissão: só quem criou a tarefa, o responsável ou a diretoria pode apagar');
}
export async function atualizarPendenciasNuvem(ids, mudancas) {
  if (!ids.length) return;
  const { error } = await sb.from('pendencias').update(mudancas).in('id', ids);
  if (error) throw new Error(error.message);
}
export async function apagarAtaNuvem(id) {
  const { error } = await sb.from('atas').delete().eq('id', id);
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
// imagem reduzida (largura máxima 1600) antes de guardar: print de tela fica leve
function reduzirImagemPedido(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image(); const u = URL.createObjectURL(arquivo);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); c.toBlob((b) => (b ? ok(b) : falha(new Error('Imagem inválida'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); falha(new Error('Não consegui abrir a imagem.')); };
    img.src = u;
  });
}
export async function urlsAnexosPedidos(caminhos) {
  const lista = [...new Set((caminhos || []).filter(Boolean))]; if (!lista.length) return {};
  const { data } = await sb.storage.from('pedidos-anexos').createSignedUrls(lista, 60 * 60 * 6);
  const m = {}; for (const x of data || []) if (x.signedUrl) m[x.path] = x.signedUrl; return m;
}
export async function listarPedidos() {
  const [{ data: ps }, { data: pf }] = await Promise.all([sb.from('pedidos').select('*').order('criado_em'), sb.from('perfis').select('id, nome, funcao')]);
  const nome = new Map((pf || []).map((p) => [p.id, p]));
  return (ps || []).map((p) => ({ id: String(p.id), data: p.criado_em, tela: p.tela, titulo: p.titulo, pessoa: (nome.get(p.autor) || {}).nome || '', funcao: (nome.get(p.autor) || {}).funcao || '', texto: p.texto, status: p.status, resposta: p.resposta, anexos: p.anexos || [] }));
}
export async function enviarPedido({ tela, titulo, texto, diretoria, arquivos = [] }) {
  const anexos = [];
  for (const [i, f] of arquivos.entries()) {
    let blob = f; let tipo = f.type || 'application/octet-stream'; let nome = f.name || `anexo-${i + 1}`;
    if (/^image\//.test(tipo)) { blob = await reduzirImagemPedido(f); tipo = 'image/jpeg'; nome = `${nome.replace(/\.[^.]+$/, '')}.jpg`; }
    const caminho = `${perfil.id}/${Date.now()}-${i}-${nome.replace(/[^\w.-]+/g, '_')}`;
    const { error: e1 } = await sb.storage.from('pedidos-anexos').upload(caminho, blob, { contentType: tipo });
    if (e1) throw new Error(`anexo "${nome}": ${e1.message}`);
    anexos.push({ nome, tipo, caminho });
  }
  const { error } = await sb.from('pedidos').insert({ autor: perfil.id, tela, titulo, texto, anexos, status: diretoria ? 'aberto' : 'aprovacao', aprovado_por: diretoria ? perfil.id : null });
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
let canal = null; let pronto = false; let estadoCanal = 'conectando'; let ouvinte = null; let ultimoMeu = null; let ultimoJson = ''; let ultimoTrack = 0;
export const estadoPresenca = () => estadoCanal;
// a mesma pessoa pode ter duas abas abertas (duas "metas" na mesma chave): vale a que enviou por último (campo t)
const listaPresenca = () => Object.values(canal ? canal.presenceState() : {}).map((xs) => xs.reduce((a, b) => ((b.t || 0) >= (a.t || 0) ? b : a), xs[0]));
// quem estiver com a tela do escritório aberta recebe a lista NA HORA em que alguém entra, sai ou anda (sem esperar o próximo ciclo)
export const ouvirPresenca = (fn) => { ouvinte = fn; };
function abrirCanal(meu) {
  const este = sb.channel('escritorio', { config: { presence: { key: meu.id } } });
  canal = este; pronto = false; estadoCanal = 'conectando'; ultimoJson = ''; ultimoTrack = 0;
  este.on('presence', { event: 'sync' }, () => { if (canal === este && ouvinte) ouvinte(listaPresenca()); });
  este.subscribe((st, err) => {
    if (canal !== este) return;
    estadoCanal = st; pronto = st === 'SUBSCRIBED';
    if (err) console.warn('Escritório virtual (tempo real):', st, err);
    if (pronto && ultimoMeu) { ultimoJson = JSON.stringify(ultimoMeu); ultimoTrack = Date.now(); este.track({ ...ultimoMeu, t: Date.now() }).catch(() => {}); }   // assim que conecta, já se anuncia
    // caiu ou não conseguiu: derruba o canal; a próxima chamada abre outro
    if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(st)) setTimeout(() => { if (canal === este) { try { sb.removeChannel(este); } catch { /* nada */ } canal = null; pronto = false; } }, 2000);
  });
}
export async function presenca(meu) {
  ultimoMeu = meu;
  if (!canal) abrirCanal(meu);
  // só reenvia quando algo mudou (posição, status, balão…) ou de tempos em tempos: cada envio faz a presença piscar para os outros
  const json = JSON.stringify(meu);
  if (pronto && (json !== ultimoJson || Date.now() - ultimoTrack > 15000)) { try { await canal.track({ ...meu, t: Date.now() }); ultimoJson = json; ultimoTrack = Date.now(); } catch { /* tenta no próximo ciclo */ } }
  return listaPresenca();
}
export async function sairDaPresenca() { ultimoMeu = null; if (canal) { try { await canal.untrack(); await sb.removeChannel(canal); } catch { /* nada */ } canal = null; pronto = false; } }

// ---------------------------------------------------------------- celular da obra (executado, efetivo e diário do dia)
export async function listarRegistrosObra(de, ate) {
  const { data, error } = await sb.from('registros_obra').select('*').gte('data', de).lte('data', ate).order('data', { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return data || [];
}
// lançar de novo no mesmo dia substitui (obra + data + tipo + item); quem lança por último fica como autor
export async function gravarRegistroObra(linha) {
  const { data, error } = await sb.from('registros_obra')
    .upsert({ ...linha, item: linha.item || '', criado_por: perfil.id }, { onConflict: 'obra,data,tipo,item' }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------- notas (chat) de cada tarefa/pendência
export async function listarNotasPend(pendenciaId) {
  const { data, error } = await sb.from('pendencias_notas').select('*').eq('pendencia_id', pendenciaId).order('criado_em', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
export async function listarNotasPendVarias(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 120) {
    const { data, error } = await sb.from('pendencias_notas').select('*').in('pendencia_id', ids.slice(i, i + 120)).order('criado_em', { ascending: true });
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}
export async function criarNotaPend(pendenciaId, texto) {
  const { error } = await sb.from('pendencias_notas').insert({ pendencia_id: pendenciaId, texto, autor: perfil.id, autor_nome: perfil.nome || '' });
  if (error) throw new Error(error.message);
}
export async function apagarNotaPend(id) {
  const { error } = await sb.from('pendencias_notas').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- quadro de OS do pós-obra (supabase/12-os-quadro.sql)
export async function listarOsQuadro() {
  const { data, error } = await sb.from('os_quadro').select('*').order('id', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
// cria (sem id) ou altera (com id); devolve a linha como ficou no banco (código, datas e pendência são feitos lá)
export async function gravarOsQuadro(linha) {
  const { id, codigo, pendencia_id, criado_em, criado_por, atualizado_em, responsavel_nome, ...resto } = linha;
  const q = id ? sb.from('os_quadro').update(resto).eq('id', id) : sb.from('os_quadro').insert(resto);
  const { data, error } = await q.select().single();
  if (error) throw new Error(error.message);
  return data;
}
export async function apagarOsQuadro(id) {
  const { error } = await sb.from('os_quadro').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function enviarFotoOs(osId, blob) {
  const caminho = `${osId}/foto-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
  const { error } = await sb.storage.from('os-fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return caminho;
}
export async function apagarFotoOs(caminho) { await sb.storage.from('os-fotos').remove([caminho]).catch(() => {}); }
export async function urlsFotosOs(caminhos) {
  if (!caminhos.length) return {};
  const { data } = await sb.storage.from('os-fotos').createSignedUrls(caminhos, 60 * 60 * 6);
  const o = {}; (data || []).forEach((x) => { if (x.signedUrl) o[x.path] = x.signedUrl; });
  return o;
}

// ---------------------------------------------------------------- setores / departamentos cadastráveis (supabase/13-setores.sql)
export async function listarSetores() {
  const { data, error } = await sb.from('setores').select('nome').order('ordem').order('nome');
  if (error) throw new Error(error.message);
  return (data || []).map((s) => s.nome);
}
export async function criarSetor(nome) {
  const { error } = await sb.from('setores').insert({ nome: String(nome).trim(), ordem: 100 });
  if (error) throw new Error(error.message);
}
export async function excluirSetor(nome) {
  const { error } = await sb.from('setores').delete().eq('nome', nome);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- configurações (supabase/19-configuracoes.sql)
export async function carregarConfiguracoes() {
  const { data, error } = await sb.from('configuracoes').select('chave, valor');
  if (error) throw new Error(error.message);
  const m = {}; for (const r of data || []) m[r.chave] = r.valor; return m;
}
export async function gravarConfiguracao(chave, valor) {
  const { error } = await sb.from('configuracoes').upsert({ chave, valor, atualizado_em: new Date().toISOString(), atualizado_por: perfil.id });
  if (error) throw new Error(error.message);
}
export async function apagarConfiguracao(chave) {
  const { error } = await sb.from('configuracoes').delete().eq('chave', chave);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- reuniões (supabase/30-reunioes.sql)
export async function listarReunioes() {
  const { data, error } = await sb.from('reunioes').select('*').order('data', { ascending: true }).order('ini', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}
export async function gravarReunioes(linhas) {
  const { data, error } = await sb.from('reunioes').insert(linhas).select();
  if (error) throw new Error(error.message);
  return data || [];
}
export async function atualizarReuniao(id, mud) {
  const { data, error } = await sb.from('reunioes').update(mud).eq('id', id).select();
  if (error) throw new Error(error.message);
  if (!data || !data.length) throw new Error('Sem permissão para mudar esta reunião.');
  return data[0];
}

// ---------------------------------------------------------------- Google Agenda do sistema (função gcal + tabela google_agenda)
export async function googleStatus() {
  const { data, error } = await sb.rpc('google_agenda_status');
  if (error) throw new Error(error.message);
  return data;
}
export async function googleSalvarCliente(clientId, clientSecret) {
  const { error } = await sb.rpc('google_agenda_salvar_cliente', { p_client_id: clientId, p_client_secret: clientSecret });
  if (error) throw new Error(error.message);
}
export async function googleDesconectar() {
  const { error } = await sb.rpc('google_agenda_desconectar');
  if (error) throw new Error(error.message);
}
export async function googleUrlAutorizar() {
  const { data, error } = await sb.functions.invoke('gcal', { body: { acao: 'url' } });
  if (error) throw new Error(error.message);
  if (data && data.erro) throw new Error(data.erro);
  return data;
}
// leva as reuniões ao Google Agenda (cria, atualiza ou apaga o evento e convida); sem conta ligada elas ficam "pendentes" e seguem quando a conta for ligada
export async function sincronizarReunioesGoogle(ids = []) {
  try { const { data } = await sb.functions.invoke('gcal', { body: { acao: 'sync', ids } }); return data; } catch { return null; }
}

// pessoas da Sólida que ainda não têm e-mail para convite do Google Agenda, e gravar o e-mail que quem cria a reunião informa (fica no cadastro da pessoa)
export async function pessoasSemEmailAgenda() {
  const { data, error } = await sb.rpc('pessoas_sem_email_agenda');
  if (error) throw new Error(error.message);
  return data || [];
}
export async function adicionarEmailAgenda(pessoaId, email) {
  const { error } = await sb.rpc('adicionar_email_agenda', { p_pessoa: pessoaId, p_email: email });
  if (error) throw new Error(error.message);
}
