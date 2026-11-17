// Contas ligadas a cada automação (pedido do Felipe, 17/11/2026): quem lê as fontes é o COMPUTADOR DO ESCRITÓRIO, então só ele sabe qual conta está logada em cada uma.
// Este módulo roda dentro do enviar-nuvem.mjs (no escritório), monta dados/json/automacoes.json e ele segue para a nuvem como os outros arquivos.
// A tela Configurações › Automações só LÊ esse arquivo (nada é digitado à mão).
//   - banco (Supabase): a conta do coletor que grava na nuvem (config.local.json) e o projeto;
//   - whatsapp: o número da conta do WhatsApp Web que o leitor usa (o leitor grava dados/whatsapp/conta.json ao conectar);
//   - drive: o e-mail da conta do Google Drive para computador (lido do que o próprio Drive deixa nos arquivos de log, se achar);
//   - mais controle, sólides, bitrix, gmail, agenda: quem escreve é o agente que lê a fonte (docs/contrato-agentes.md › "Contas das automações"),
//     porque é ele quem vê a conta logada na tela. Este módulo só preserva o que o agente gravou.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const ler = (arq) => { try { return JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const agora = () => new Date().toISOString();

function numeroBonito(n) {
  const d = String(n || '').replace(/\D/g, '');
  const m = /^55(\d{2})(9?\d{4})(\d{4})$/.exec(d);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : (d ? `+${d}` : '');
}

// e-mail da conta do Google Drive para computador: procura nos logs do DriveFS o e-mail que mais aparece
function emailDoDrive() {
  try {
    const base = join(process.env.LOCALAPPDATA || '', 'Google', 'DriveFS');
    if (!existsSync(base)) return '';
    const candidatos = [];
    const logs = join(base, 'Logs');
    if (existsSync(logs)) for (const f of readdirSync(logs)) candidatos.push(join(logs, f));
    const recentes = candidatos.filter((f) => { try { return statSync(f).isFile(); } catch { return false; } })
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, 3);
    const cont = new Map();
    for (const f of recentes) {
      const txt = readFileSync(f, 'utf8').slice(-400000);
      for (const m of txt.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) cont.set(m[0].toLowerCase(), (cont.get(m[0].toLowerCase()) || 0) + 1);
    }
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || '';
  } catch { return ''; }
}

export function montarAutomacoes(raiz, cfg = {}) {
  const arq = join(raiz, 'dados', 'json', 'automacoes.json');
  const atual = ler(arq) || {};
  const itens = { ...(atual.itens || {}) };
  const marca = (id, conta, extra = {}) => { if (conta) itens[id] = { ...(itens[id] || {}), conta, lidoEm: agora(), ...extra }; };
  marca('banco', cfg.coletorEmail ? `Conta do coletor: ${cfg.coletorEmail} · projeto App Solida Construção` : '');
  const wa = ler(join(raiz, 'dados', 'whatsapp', 'conta.json'));
  if (wa && wa.numero) itens.whatsapp = { ...(itens.whatsapp || {}), conta: [wa.nome, numeroBonito(wa.numero)].filter(Boolean).join(' · '), lidoEm: wa.lidoEm || agora() };
  marca('drive', emailDoDrive());
  const saida = { ...atual, atualizadoEm: agora(), computador: os.hostname(), usuarioWindows: os.userInfo().username, itens };
  try { writeFileSync(arq, JSON.stringify(saida, null, 2)); } catch { /* sem pasta dados/json: nada a mandar */ }
  return saida;
}
