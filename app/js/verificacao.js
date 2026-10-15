// Confere os cálculos do sistema contra os valores que a planilha R01 calculou.
// Valores de referência lidos da aba Dashboard/Equipe da planilha salva em 13/10/2026 (Ver por = Semana).
// Quando a planilha for reexportada com outra data, atualize REF abaixo com os números da aba Dashboard.

import { carregarDados } from './dados.js';
import { montarBase, resumoPeriodo, equipeNoPeriodo } from './regras.js';
import { periodo } from './datas.js';
import { esc } from './formato.js';

const REF = {
  hoje: '2026-10-13',
  verPor: 'Semana',
  cards: {
    obrasComAtividade: 10, servicosAbertos: 37, concluidosNoPeriodo: 0, prazosVencidos: 11,
    diarias: 9, custo: 1917.27272727273, receita: 22804.36, margem: 20887.0872727273,
  },
  semanas: [
    ['2026-08-24', 36], ['2026-08-31', 45], ['2026-09-07', 21], ['2026-09-14', 39],
    ['2026-09-21', 32], ['2026-09-28', 28], ['2026-10-05', 0], ['2026-10-12', 9],
  ],
  // Resumo do período (Dashboard B33:P42): obra, situação, serv. abertos, diárias, custo, receita
  resumo: [
    ['PO415', 'Execução', 1, 2, 350, 0],
    ['PO288', 'Fixo', 1, 1.5, 343.636363636364, 0],
    ['MO556 - Estúdio Pindó', 'Execução', 1, 1.5, 345, 0],
    ['PO - Liessin Leblon', 'Execução', 4, 1, 230, 0],
    ['PO322', 'Orçamento', 1, 1, 230, 0],
    ['PO - Escritório Posto 6', 'Análise', 1, 1, 190, 0],
    ['PO074', 'Análise', 1, 0.5, 113.636363636364, 0],
    ['PO318', 'Fixo', 1, 0.5, 115, 0],
    ['PO533 - Aumento de carga', 'Execução', 1, 0, 0, 9918.39],
    ['PO577', 'Execução', 1, 0, 0, 12885.97],
  ],
  // Equipe!G (diárias no período) — quem não está aqui tem 0
  equipeSemana: { 'Marcelo': 1, 'Ajudante (s/ nome)': 1, 'Carlos': 2, 'Nascimento': 3, 'Cleviano': 1, 'Ênio': 1 },
};

const TOL = 0.005;
const linhas = [];
const igual = (a, b) => (typeof b === 'number' ? Math.abs((a ?? 0) - b) < TOL : a === b);

function conferir(grupo, item, obtido, esperado) {
  linhas.push({ grupo, item, obtido, esperado, ok: igual(obtido, esperado) });
}

async function rodar() {
  const dados = await carregarDados();
  const base = montarBase(dados, REF.hoje);
  const p = periodo(REF.verPor, REF.hoje);
  const r = resumoPeriodo(base, p);

  for (const [k, v] of Object.entries(REF.cards)) conferir('Dashboard — cards', k, r.cards[k], v);

  r.diariasPorSemana.forEach((s, i) => {
    conferir('Dashboard — diárias por semana', `semana ${s.inicio}`, s.inicio, REF.semanas[i][0]);
    conferir('Dashboard — diárias por semana', `diárias ${s.inicio}`, s.diarias, REF.semanas[i][1]);
  });

  conferir('Dashboard — resumo do período', 'quantidade de linhas', r.resumo.length, REF.resumo.length);
  REF.resumo.forEach(([obra, sit, ab, di, cu, re], i) => {
    const l = r.resumo[i] || { obra: {} };
    conferir('Dashboard — resumo do período', `linha ${i + 1} obra`, l.obra.obra, obra);
    conferir('Dashboard — resumo do período', `${obra} situação`, l.obra.situacao, sit);
    conferir('Dashboard — resumo do período', `${obra} serv. abertos`, l.obra.abertas, ab);
    conferir('Dashboard — resumo do período', `${obra} diárias`, l.diarias, di);
    conferir('Dashboard — resumo do período', `${obra} custo`, l.custo, cu);
    conferir('Dashboard — resumo do período', `${obra} receita`, l.receita, re);
  });

  for (const l of equipeNoPeriodo(base, p)) {
    const nome = l.pessoa.nome;
    conferir('Equipe — diárias no período', nome, l.diarias, REF.equipeSemana[nome] || 0);
    const orig = dados.equipe.find((e) => e.profissional === nome);
    conferir('Equipe — diárias total', nome, l.diariasTotal, orig.diarias_total ?? 0);
    conferir('Equipe — custo total', nome, l.custoTotal, orig.custo_total ?? 0);
  }

  for (const o of base.obras) {
    const orig = dados.obras.find((x) => x.obra === o.obra);
    conferir('Obras — situação calculada', o.obra, o.situacao, orig.situacao_calculada);
  }

  for (const s of base.servicos) {
    conferir('Serviços — status do prazo', s.os || s.obra, s.statusPrazo, s.status_prazo);
    conferir('Serviços — dias em atraso', s.os || s.obra, s.diasAtraso, s.dias_atraso);
  }

  mostrar();
}

function mostrar() {
  const falhas = linhas.filter((l) => !l.ok);
  const grupos = [...new Set(linhas.map((l) => l.grupo))];
  const fmtV = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) : v ?? '(vazio)');
  document.getElementById('resultado').innerHTML = `
    <div class="aviso" style="border-color:${falhas.length ? 'var(--ruim)' : 'var(--bom)'}">
      <b>${falhas.length ? '✗' : '✓'}</b>
      <span>${linhas.length - falhas.length} de ${linhas.length} conferências batem com a planilha${falhas.length ? ` — ${falhas.length} divergências` : ''}.</span>
    </div>
    ${grupos.map((g) => {
      const ls = linhas.filter((l) => l.grupo === g);
      const f = ls.filter((l) => !l.ok).length;
      return `<section class="bloco"><header class="bloco-topo"><h2>${esc(g)}</h2>
        <span class="nota">${f ? `${f} divergências` : `${ls.length} ok`}</span></header>
        <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th></th><th>Item</th><th class="n">Sistema</th><th class="n">Planilha</th></tr></thead>
        <tbody>${ls.filter((l) => !l.ok || ls.length <= 40).map((l) => `<tr>
          <td>${l.ok ? '<span class="prazo p-ok"><b>✓</b></span>' : '<span class="prazo p-vencido"><b>!</b></span>'}</td>
          <td>${esc(l.item)}</td><td class="n">${esc(fmtV(l.obtido))}</td><td class="n">${esc(fmtV(l.esperado))}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    }).join('')}`;
  window.resultadoVerificacao = { total: linhas.length, falhas };
}

rodar().catch((e) => {
  document.getElementById('resultado').innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  console.error(e);
});
