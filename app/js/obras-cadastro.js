// O Cadastros manda nas listas de obras (regra do Felipe, 10/11/2026). O dados.json dos agentes e as pastas do Drive ainda trazem obras que
// já acabaram (ex.: Mo344, Mo565D); aqui elas saem de TODAS as listas de obras de uma vez — Planejamento, Operação, Efetivo, RH,
// Projetos — em vez de cada tela filtrar por conta própria. Finalizada e "não fechado" saem; pausada continua (as telas mostram "Pausada").
// É idempotente: guarda a lista original em _porObraTodas/_obrasTodas, então reabrir uma obra no Cadastros traz ela de volta na próxima tela.

export const obraFora = (obrasCad, cod) => {
  const up = String(cod || '').toUpperCase();
  return (obrasCad || []).some((c) => ['finalizada', 'nao_fechado'].includes(c.situacao) && String(c.codigo).toUpperCase() === up);
};

export function aplicarCadastroNasObras({ cfg, obrasCad, projetos, estoque }) {
  if (!Array.isArray(obrasCad) || !obrasCad.length) return;   // sem cadastro (modo local): fica o que os agentes mandaram
  const fora = new Set(obrasCad.filter((c) => ['finalizada', 'nao_fechado'].includes(c.situacao)).map((c) => String(c.codigo).toUpperCase()));
  // variante que o cadastro não conhece (Mo565C, Mo565P…) acompanha a família: se a obra-mãe (Mo565) ou outra variante está finalizada e a própria variante não está cadastrada, ela sai também
  const familia = (cod) => { const m = String(cod || '').trim().match(/^(mo|po)\s*0*(\d+)/i); return m ? m[1].toUpperCase() + m[2] : ''; };
  const cadastradas = new Set(obrasCad.map((c) => String(c.codigo).toUpperCase()));
  const familiasFora = new Set(obrasCad.filter((c) => ['finalizada', 'nao_fechado'].includes(c.situacao)).map((c) => familia(c.codigo)).filter(Boolean));
  const ativasNaFamilia = new Set(obrasCad.filter((c) => !['finalizada', 'nao_fechado'].includes(c.situacao)).map((c) => familia(c.codigo)).filter(Boolean));
  const ok = (cod) => { const u = String(cod || '').toUpperCase(); if (fora.has(u)) return false; const fam = familia(cod); return !(fam && !cadastradas.has(u) && familiasFora.has(fam) && !ativasNaFamilia.has(fam)); };
  if (cfg) {
    for (const a of (cfg.areas || [])) {
      if (!Array.isArray(a.porObra) && !Array.isArray(a._porObraTodas)) continue;
      a._porObraTodas = a._porObraTodas || a.porObra;
      a.porObra = a._porObraTodas.filter((o) => ok(o && o.obra));
    }
    if (Array.isArray(cfg.obras) || Array.isArray(cfg._obrasTodas)) {
      cfg._obrasTodas = cfg._obrasTodas || cfg.obras;
      cfg.obras = cfg._obrasTodas.filter(ok);
    }
  }
  // planilha de estoque: colunas de obra (lista de códigos)
  if (estoque && (Array.isArray(estoque.obras) || Array.isArray(estoque._obrasTodas))) {
    estoque._obrasTodas = estoque._obrasTodas || estoque.obras;
    estoque.obras = estoque._obrasTodas.filter((o) => ok(typeof o === 'string' ? o : o && o.obra));
  }
  if (projetos && (Array.isArray(projetos.obras) || Array.isArray(projetos._obrasTodas))) {
    projetos._obrasTodas = projetos._obrasTodas || projetos.obras;
    projetos.obras = projetos._obrasTodas.filter((p) => ok(p && p.obra));
  }
}
