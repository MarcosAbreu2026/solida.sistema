// Classificação CINZA (a Sólida executa) × LARANJA (terceiro / fornecedor do cliente) de um serviço de uma obra.
// Antes valia só a cor da fase na programação (ehTerceiro) e, em programacao.js, qualquer nome com maiúscula entre parênteses: na Mo602
// alvenaria, pintura, hidráulica e elétrica saíam laranja. Agora decide, nesta ordem (pedido do Marcos, 20/11/2026):
//  1. serviço próprio conhecido (alvenaria, pintura, rede hidráulica, caixinhas, conduítes/eletrocalha, elétrica…) → CINZA, qualquer que seja a cor;
//  2. o código ou o nome bate com um item do ESCOPO/orçamento da obra (o que a Sólida contratou executar) → CINZA;
//  3. o nome (ou a loja) bate com um item da planilha de terceirizados LARANJA da obra (projetos.json › obras[].terceirizados) → LARANJA;
//  4. sem nenhuma das duas fontes: vale a cor da fase (cinza neutro = Sólida; outra cor = terceiro) como antes.
// Obra que tem a planilha de terceirizados lida e o serviço não está na lista laranja: CINZA (a cor sozinha não manda mais).
export const normTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'mat', 'mo', 'e', 'ou', 'a', 'o', 'infra']);
const tokens = (s) => [...new Set(normTxt(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, '')))];

// serviços que a equipe da Sólida faz (lista do Marcos para a Mo602, vale para todas as obras)
export const CINZA_FIXO = /\b(alvenaria|pintura|pintar|massa corrida|lixar|selador|emboco|reboco|contrapiso|rede hidraulica|hidraulica|hidrossanit|caixinha|conduite|eletrocalha|eletrica|eletrico|tomada|interruptor|fiacao|infra de eletrica|demolicao|limpeza)\b/;
// apelidos de fornecedor/serviço laranja que aparecem escritos de outro jeito na programação (BRICS = Briggs = infra de incêndio)
export const LARANJA_APELIDO = [[/\b(brics|brigs|briggs|brigss)\b/, /incendio/]];

// cor de fundo da fase: cinza neutro = Sólida; qualquer outra cor = terceiro (regra antiga, só quando não há outra fonte)
export const corEhTerceiro = (cor) => {
  const h = String(cor || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) > 14;
};

const bate = (txt, alvo) => { const a = tokens(txt); const b = tokens(alvo); if (!a.length || !b.length) return false; const n = a.filter((x) => b.includes(x)).length; return n >= Math.min(2, a.length, b.length) && n / Math.min(a.length, b.length) >= 0.6; };

// p = obra do projetos.json ({ escopo.grupos[].itens[{cod,desc}], terceirizados.laranja[{cod,item,loja}] }) → (l, cor) => 'cinza' | 'laranja'
export function classificadorDaObra(p) {
  const escopo = (((p && p.escopo && p.escopo.grupos) || []).flatMap((g) => g.itens || []));
  const codsEscopo = new Set(escopo.map((i) => normTxt(i.cod).replace(/ /g, '')).filter(Boolean));
  const laranja = (((p && p.terceirizados && p.terceirizados.laranja) || []).filter((i) => i.item));
  const temPlanilha = laranja.length > 0;
  const alvosLaranja = laranja.map((i) => ({ txt: String(i.item).replace(/\s*-\s*(mat|mo|mat e mo|mo e mat)\s*$/i, ''), loja: String(i.loja || '').split(/\n|\//)[0].replace(/\([^)]*\)/g, '').trim() }));
  return (l, cor) => {
    const x = typeof l === 'string' ? { tarefa: l } : (l || {});
    const texto = normTxt(`${x.fase || ''} ${x.tarefa || x.texto || ''} ${x.funcionario || ''}`);
    const nome = normTxt(`${x.tarefa || x.texto || ''}`);
    if (CINZA_FIXO.test(nome)) return 'cinza';
    for (const [a, b] of LARANJA_APELIDO) if (a.test(texto) || (b.test(nome) && a.test(normTxt(x.funcionario)))) return 'laranja';
    const cod = normTxt(x.cod).replace(/ /g, '');
    if (cod && codsEscopo.has(cod)) return 'cinza';
    if (escopo.some((i) => bate(nome, i.desc))) return 'cinza';
    for (const a of alvosLaranja) if (bate(nome, a.txt) || (a.loja.length > 3 && texto.includes(normTxt(a.loja)))) return 'laranja';
    if (temPlanilha || escopo.length) return 'cinza';
    return corEhTerceiro(cor !== undefined ? cor : x.cor) ? 'laranja' : 'cinza';
  };
}
