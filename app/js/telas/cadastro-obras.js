// Cadastro de obras (Cadastros da diretoria e página "Cadastro de obras" dos setores que também mexem nisso):
// primeiro o TIPO (obra · obra em orçamento · pós-obra); campos cliente e endereço obrigatórios e arquitetura opcional; a situação muda conforme o tipo.
// Quem pode excluir é só a diretoria (podeExcluir); os setores ORC Obras Novas, Pós-obra e ORC Terceirizado Laranja cadastram, editam e mudam a situação.
import { html } from '../formato.js';
import { TIPOS, SITUACOES_POR_TIPO, ROTULO_SITUACAO, ROTULO_TIPO, tipoDe, situacaoDe, clienteDe } from '../obras-tipos.js';

const opcoesTipo = (sel) => TIPOS.map(([v, n]) => html`<option value="${v}" ${v === sel ? html.seguro('selected') : ''}>${n}</option>`);
const opcoesSituacao = (tipo, sel) => (SITUACOES_POR_TIPO[tipo] || SITUACOES_POR_TIPO.obra).map(([v, n]) => html`<option value="${v}" ${v === sel ? html.seguro('selected') : ''}>${n}</option>`);
const ordem = (a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });

export function secaoObras({ obrasCad = [], podeExcluir = false, listaAberta = false }) {
  const linhaObra = (o) => { const t = tipoDe(o); const s = situacaoDe(o); return html`<form class="ac-linha ${s === 'finalizada' || s === 'nao_fechado' ? 'ac-bloq' : ''}" data-obra-cad="${o.codigo}">
    <div class="ac-quem"><b>${o.codigo}</b>${o.semCadastro ? html`<span class="pequeno pendente">ainda não cadastrada (vem dos dados): clique em Salvar para cadastrar</span>` : ''}</div>
    <label>Código <span class="pequeno">(dá para mudar o número)</span><input name="codigo_novo" value="${o.codigo}" autocapitalize="none" spellcheck="false" required></label>
    <label>Tipo<select name="tipo" data-ob-tipo>${opcoesTipo(t)}</select></label>
    <label>Cliente<input name="cliente" value="${clienteDe(o)}" placeholder="ex.: Residencial X"></label>
    <label>Endereço<input name="endereco" value="${o.endereco || ''}" placeholder="rua, número, bairro"></label>
    <label>Arquitetura <span class="pequeno">(opcional)</span><input name="arquitetura" value="${o.arquitetura || ''}"></label>
    <label>Situação<select name="situacao" data-ob-situacao>${opcoesSituacao(t, s)}</select></label>
    <span class="ac-botoes"><button type="submit" class="botao on">Salvar</button>
      ${podeExcluir ? html`<button type="button" class="botao ac-excluir" data-excluir-obra="${o.codigo}">Remover</button>` : ''}</span>
  </form>`; };
  const item = (o) => { const s = situacaoDe(o); return html`<details class="ac-obra-item"><summary><b>${o.codigo}</b><span class="ac-obra-nome">${clienteDe(o) || 'sem cliente'}${o.endereco ? html` <span class="pequeno">· ${o.endereco}</span>` : ''}</span><span class="ac-sit ac-sit-${s}">${ROTULO_SITUACAO[s] || s}</span>${!o.endereco && !o.semCadastro ? html`<span class="pequeno pendente">falta o endereço</span>` : ''}</summary>${linhaObra(o)}</details>`; };
  const grupos = [
    ['Obras (em andamento e pausadas)', obrasCad.filter((o) => tipoDe(o) === 'obra' && situacaoDe(o) !== 'finalizada'), false],
    ['Obras em orçamento (só os setores de orçamento, o pós-obra e a diretoria veem)', obrasCad.filter((o) => tipoDe(o) === 'orcamento' && situacaoDe(o) !== 'nao_fechado'), false],
    ['Pós-obras (em andamento e pausados)', obrasCad.filter((o) => tipoDe(o) === 'pos' && situacaoDe(o) !== 'finalizada'), false],
    ['Obras finalizadas', obrasCad.filter((o) => tipoDe(o) === 'obra' && situacaoDe(o) === 'finalizada'), true],
    ['Pós-obras finalizados', obrasCad.filter((o) => tipoDe(o) === 'pos' && situacaoDe(o) === 'finalizada'), true],
    ['Não fechadas (orçamentos que não viraram obra; ficam fora de todas as listas)', obrasCad.filter((o) => tipoDe(o) === 'orcamento' && situacaoDe(o) === 'nao_fechado'), true],
  ];
  const nObras = obrasCad.filter((o) => tipoDe(o) === 'obra').length; const nOrc = obrasCad.filter((o) => tipoDe(o) === 'orcamento').length; const nPos = obrasCad.filter((o) => tipoDe(o) === 'pos').length;
  return html`<section class="secao"><h2>Obras <span class="pequeno">${obrasCad.length}</span></h2>
    <p class="pequeno">Escolha primeiro o <b>tipo</b>. <b>Obra</b> e <b>pós-obra</b> têm as situações em andamento, pausada e finalizada (no pós-obra, o que anda — análise, orçamento, falta agendar — é a OS, no Quadro de OS). <b>Obra em orçamento</b> tem solicitação, em orçamento, com a arquitetura, com fornecedor e não fechado; quando fecha, vira obra. <b>Cliente</b> e <b>endereço</b> são obrigatórios; arquitetura é opcional.${podeExcluir ? '' : ' Você cadastra, edita e muda a situação; quem exclui é a diretoria.'}</p>
    <form class="ac-novo ac-novo-obra" id="ob-novo">
      <label>Tipo<select name="tipo" data-ob-tipo>${opcoesTipo('obra')}</select></label>
      <label>Código <span class="pequeno">(obra: Mo… · pós-obra: PO…, ou deixe vazio)</span><input name="codigo" placeholder="ex.: Mo565 · PO577" autocapitalize="none" spellcheck="false"></label>
      <label>Cliente <span class="pequeno">(obrigatório)</span><input name="cliente" placeholder="ex.: Sinagoga Leblon" required></label>
      <label>Endereço <span class="pequeno">(obrigatório)</span><input name="endereco" placeholder="rua, número, bairro" required></label>
      <label>Arquitetura <span class="pequeno">(opcional)</span><input name="arquitetura" placeholder="escritório de arquitetura"></label>
      <label>Situação<select name="situacao" data-ob-situacao>${opcoesSituacao('obra', 'andamento')}</select></label>
      <button type="submit" class="botao on">Cadastrar</button>
    </form>
    <details class="caixa ac-lista-obras" ${listaAberta ? html.seguro('open') : ''}>
      <summary><span class="caixa-tit">Todas as obras e pós-obras</span><span class="contador">${obrasCad.length}</span><span class="pequeno">${nObras} obras · ${nOrc} em orçamento · ${nPos} pós-obras · clique para abrir a lista</span></summary>
      <div class="caixa-corpo">
        ${grupos.filter(([, l]) => l.length).map(([titulo, l, recolhido]) => {
          const itens = [...l].sort(ordem).map(item);
          return recolhido ? html`<details class="ac-grupo-fechado"><summary class="ac-grupo-obra">${titulo} <span class="pequeno">${l.length} · clique para ver</span></summary>${itens}</details>` : html`<h3 class="ac-grupo-obra">${titulo} <span class="pequeno">${l.length}</span></h3>${itens}`;
        })}
      </div>
    </details></section>`;
}
export { ROTULO_TIPO };
