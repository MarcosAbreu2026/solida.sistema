// Configurações › Automações (pedido do Felipe, 17/11/2026): lista as ligações do sistema com outros sistemas (Mais Controle, Drive, WhatsApp, Sólides, Bitrix, e-mail,
// Google Agenda…) e mostra o status de cada uma: conectado (lido hoje), desatualizado (última leitura antiga), sem acesso ou ainda não conectado.
// O status vem do que os agentes de cada setor registram em "De onde vêm os dados" (fontes: nome, de onde lê e quando leu); as ligações do próprio sistema (banco) são testadas na hora.
import { html } from '../formato.js';

const CATALOGO = [
  { id: 'banco', nome: 'Banco de dados e login (Supabase)', faz: 'Guarda tarefas, atas, OS, cadastros e acessos; é o que mantém o sistema igual para todos.', proprio: true, contaPadrao: 'App Solida Construção · projeto ghqlkznukbdqnbwhqbdn' },
  { id: 'maiscontrole', nome: 'Mais Controle', faz: 'ERP: diário de obras, medições, financeiro e centro de custo.', re: /mais\s*controle/i },
  { id: 'drive', nome: 'Google Drive', faz: 'Pastas das obras, projetos, atas em PDF e planilhas de origem.', re: /drive/i },
  { id: 'whatsapp', nome: 'WhatsApp (grupos)', faz: 'Efetivo e produtividade das obras, ferramentas e compras; cobranças autorizadas.', re: /whats/i },
  { id: 'solides', nome: 'Sólides / Tangerino (ponto)', faz: 'Ponto e faltas do RH (só leitura).', re: /s[óo]lides|tangerino/i },
  { id: 'bitrix', nome: 'Bitrix (comercial)', faz: 'Funil de vendas e propostas do comercial.', re: /bitrix/i },
  { id: 'gmail', nome: 'E-mail (Gmail)', faz: 'Pedidos e documentos recebidos por e-mail.', re: /gmail|e-?mail/i },
  { id: 'calendar', nome: 'Google Agenda (do sistema)', faz: 'Recebe as reuniões criadas no sistema e convida as pessoas; uma única conta, logada no computador do escritório.', re: /google\s*agenda|calendar/i },
];

const dataBR = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const dataDe = (txt) => { const m = String(txt || '').match(/(\d{2})\/(\d{2})(?:[,\s]+(\d{2}):(\d{2}))?/); if (!m) return null; const hj = new Date(); const d = new Date(hj.getFullYear(), Number(m[2]) - 1, Number(m[1]), Number(m[3] || 12), Number(m[4] || 0)); if (d > hj) d.setFullYear(d.getFullYear() - 1); return d; };
const diasAtras = (d) => { const hj = new Date(); return Math.round((new Date(hj.getFullYear(), hj.getMonth(), hj.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); };

function statusDe(item, areas, { naNuvem }) {
  if (item.proprio) return naNuvem ? { cod: 'ok', txt: 'Conectado', det: 'Banco respondendo normalmente.' } : { cod: 'off', txt: 'Desconectado', det: 'Modo de teste neste computador (dados só neste navegador).' };
  const usos = [];
  for (const a of areas) for (const f of (a.fontes || [])) if (item.re.test(`${f.nome} ${f.via || ''}`)) usos.push({ area: a.nome, f });
  if (!usos.length) return { cod: 'nao', txt: 'Não conectado', det: 'Nenhum agente lê esta fonte ainda.' };
  const semAcesso = usos.filter((u) => /sem acesso|pede login|desconect/i.test(u.f.via || ''));
  const datas = usos.map((u) => dataDe(u.f.ultima)).filter(Boolean).sort((a, b) => b - a);
  const quem = [...new Set(usos.map((u) => u.area))].join(', ');
  if (semAcesso.length === usos.length) return { cod: 'erro', txt: 'Sem acesso', det: `Pede login ou está desconectado. Usada por: ${quem}.` };
  if (!datas.length) return { cod: 'velha', txt: 'Sem leitura registrada', det: `Usada por: ${quem}.` };
  const n = diasAtras(datas[0]);
  const quando = n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
  if (n <= 1) return { cod: 'ok', txt: 'Conectado', det: `Última leitura ${quando}. Usada por: ${quem}.` };
  if (n <= 7) return { cod: 'velha', txt: 'Desatualizado', det: `Última leitura ${quando}. Usada por: ${quem}.` };
  return { cod: 'erro', txt: 'Parado', det: `Última leitura ${quando}. Usada por: ${quem}.` };
}

function painelGoogle(g, redirect) {
  if (!g) return '';
  const passos = html`<ol class="aut-passos"><li>Abra <b>console.cloud.google.com</b> com a conta Google do sistema e crie um projeto (ex.: "Sistema Sólida").</li>
    <li>Em <b>APIs e serviços › Biblioteca</b>, ative a <b>Google Calendar API</b> (é gratuita).</li>
    <li>Em <b>Tela de permissão OAuth</b>, escolha "Externo", preencha o nome do app e, em "Usuários de teste", inclua a conta Google do sistema.</li>
    <li>Em <b>Credenciais › Criar credenciais › ID do cliente OAuth › Aplicativo da Web</b>, em "URIs de redirecionamento autorizados" cole: <code>${redirect}</code></li>
    <li>Copie o <b>ID do cliente</b> e a <b>Chave secreta</b> e cole abaixo.</li></ol>`;
  return html`<section class="aut-google"><h3>Google Agenda do sistema <span class="aut-pil aut-${g.conectado ? 'ok' : 'nao'}">${g.conectado ? 'Conectado' : g.configurado ? 'Falta autorizar a conta' : 'Não configurado'}</span></h3>
    ${g.conectado ? html`<p>Conta ligada: <b>${g.email || '(sem e-mail)'}</b>${g.conectadoEm ? html` <span class="pequeno">desde ${dataBR(g.conectadoEm)}</span>` : ''}. As reuniões criadas ou editadas no sistema vão sozinhas para o Google Agenda dessa conta, que convida as pessoas.</p>
      <button type="button" class="botao" data-gcal-desconectar>Desconectar</button>`
      : html`${!g.configurado ? html`<p class="pequeno">Uma única vez, a diretoria liga a conta Google do sistema. A API do Google Agenda é gratuita.</p>${passos}` : html`<p class="pequeno">Cliente OAuth salvo. Falta entrar com a conta Google do sistema e autorizar.</p>`}
      <form class="aut-gform" data-gcal-form>
        <label>ID do cliente<input name="gc_id" autocomplete="off" placeholder="xxxxxxxx.apps.googleusercontent.com"></label>
        <label>Chave secreta<input name="gc_sec" type="password" autocomplete="new-password" placeholder="GOCSPX-…"></label>
        <button type="submit" class="botao">Salvar</button>${g.configurado ? html`<button type="button" class="botao on" data-gcal-conectar>Conectar conta do Google</button>` : ''}
      </form>`}
  </section>`;
}

export function render({ cfg, naNuvem = false, contas = null, google = null, redirectGoogle = '' } = {}) {
  const doItem = (id) => (id === 'calendar' && google && google.conectado ? { conta: google.email, lidoEm: google.conectadoEm } : (contas && contas.itens && contas.itens[id]) || null);
  const areas = (cfg && cfg.areas) || [];
  // fontes que os agentes usam e que não estão no catálogo: aparecem no fim, para nada ficar escondido
  const conhecidas = (nome) => CATALOGO.some((c) => c.re && c.re.test(nome));
  const extras = []; const vistos = new Set();
  for (const a of areas) for (const f of (a.fontes || [])) if (f.nome && !conhecidas(f.nome) && !vistos.has(f.nome)) { vistos.add(f.nome); extras.push({ id: `x-${f.nome}`, nome: f.nome, faz: f.via || '', re: new RegExp(f.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }); }
  const itens = [...CATALOGO, ...extras].map((i) => ({ i, s: i.id === 'calendar' && google ? (google.conectado ? { cod: 'ok', txt: 'Conectado', det: 'Reuniões do sistema vão sozinhas para este calendário.' } : { cod: 'nao', txt: google.configurado ? 'Falta autorizar' : 'Não conectado', det: 'Configure a ligação com o Google abaixo.' }) : statusDe(i, areas, { naNuvem }) }));
  const conta = (cod) => itens.filter((x) => x.s.cod === cod).length;
  return html`<div class="aut">
    <p class="pequeno">As ligações do sistema com outros sistemas e o status de cada uma. O status vem da última leitura registrada pelos agentes de cada setor.</p>
    ${painelGoogle(google, redirectGoogle)}
    <div class="aut-resumo"><span class="aut-pil aut-ok">${conta('ok')} conectadas</span><span class="aut-pil aut-velha">${conta('velha')} desatualizadas</span><span class="aut-pil aut-erro">${conta('erro')} com problema</span><span class="aut-pil aut-nao">${conta('nao') + conta('off')} não conectadas</span></div>
    <div class="aut-lista"><div class="aut-linha aut-cab"><span></span><b>Item</b><b>Status</b><b>Conta conectada</b></div>
    ${itens.map(({ i, s }) => html`<div class="aut-linha"><span class="aut-bolinha aut-${s.cod}"></span><div class="aut-corpo"><b>${i.nome}</b><span class="pequeno">${i.faz}</span></div><div class="aut-st"><span class="aut-pil aut-${s.cod}">${s.txt}</span><span class="pequeno">${s.det}</span></div>
      <div class="aut-conta">${(() => { const c = doItem(i.id); const txt = (c && c.conta) || i.contaPadrao || ''; return txt ? html`<b>${txt}</b>${c && c.lidoEm ? html`<span class="pequeno">visto em ${dataBR(c.lidoEm)}</span>` : ''}` : html`<span class="pequeno aut-nada">Ainda não informada pelo computador do escritório</span>`; })()}</div></div>`)}</div>
    <p class="pequeno">As contas vêm do computador do escritório, que é quem lê as fontes: ele registra qual conta está logada em cada uma${contas && contas.computador ? ` (último envio: ${contas.computador}, ${dataBR(contas.atualizadoEm)})` : ''}. Nada aqui é digitado à mão.</p>
  </div>`;
}
