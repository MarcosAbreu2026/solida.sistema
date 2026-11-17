// Configurações › Automações (pedido do Felipe, 17/11/2026): lista as ligações do sistema com outros sistemas (Mais Controle, Drive, WhatsApp, Sólides, Bitrix, e-mail,
// Google Agenda…) e mostra o status de cada uma: conectado (lido hoje), desatualizado (última leitura antiga), sem acesso ou ainda não conectado.
// O status vem do que os agentes de cada setor registram em "De onde vêm os dados" (fontes: nome, de onde lê e quando leu); as ligações do próprio sistema (banco) são testadas na hora.
import { html } from '../formato.js';

const CATALOGO = [
  { id: 'banco', nome: 'Banco de dados e login (Supabase)', faz: 'Guarda tarefas, atas, OS, cadastros e acessos; é o que mantém o sistema igual para todos.', proprio: true },
  { id: 'maiscontrole', nome: 'Mais Controle', faz: 'ERP: diário de obras, medições, financeiro e centro de custo.', re: /mais\s*controle/i },
  { id: 'drive', nome: 'Google Drive', faz: 'Pastas das obras, projetos, atas em PDF e planilhas de origem.', re: /drive/i },
  { id: 'whatsapp', nome: 'WhatsApp (grupos)', faz: 'Efetivo e produtividade das obras, ferramentas e compras; cobranças autorizadas.', re: /whats/i },
  { id: 'solides', nome: 'Sólides / Tangerino (ponto)', faz: 'Ponto e faltas do RH (só leitura).', re: /s[óo]lides|tangerino/i },
  { id: 'bitrix', nome: 'Bitrix (comercial)', faz: 'Funil de vendas e propostas do comercial.', re: /bitrix/i },
  { id: 'gmail', nome: 'E-mail (Gmail)', faz: 'Pedidos e documentos recebidos por e-mail.', re: /gmail|e-?mail/i },
  { id: 'calendar', nome: 'Google Agenda', faz: 'Reuniões e compromissos da equipe.', re: /google\s*agenda|calendar/i },
];

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

export function render({ cfg, naNuvem = false } = {}) {
  const areas = (cfg && cfg.areas) || [];
  // fontes que os agentes usam e que não estão no catálogo: aparecem no fim, para nada ficar escondido
  const conhecidas = (nome) => CATALOGO.some((c) => c.re && c.re.test(nome));
  const extras = []; const vistos = new Set();
  for (const a of areas) for (const f of (a.fontes || [])) if (f.nome && !conhecidas(f.nome) && !vistos.has(f.nome)) { vistos.add(f.nome); extras.push({ id: `x-${f.nome}`, nome: f.nome, faz: f.via || '', re: new RegExp(f.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }); }
  const itens = [...CATALOGO, ...extras].map((i) => ({ i, s: statusDe(i, areas, { naNuvem }) }));
  const conta = (cod) => itens.filter((x) => x.s.cod === cod).length;
  return html`<div class="aut">
    <p class="pequeno">As ligações do sistema com outros sistemas e o status de cada uma. O status vem da última leitura registrada pelos agentes de cada setor.</p>
    <div class="aut-resumo"><span class="aut-pil aut-ok">${conta('ok')} conectadas</span><span class="aut-pil aut-velha">${conta('velha')} desatualizadas</span><span class="aut-pil aut-erro">${conta('erro')} com problema</span><span class="aut-pil aut-nao">${conta('nao') + conta('off')} não conectadas</span></div>
    <div class="aut-lista">${itens.map(({ i, s }) => html`<div class="aut-linha"><span class="aut-bolinha aut-${s.cod}"></span><div class="aut-corpo"><b>${i.nome}</b><span class="pequeno">${i.faz}</span></div><div class="aut-st"><span class="aut-pil aut-${s.cod}">${s.txt}</span><span class="pequeno">${s.det}</span></div></div>`)}</div>
  </div>`;
}
