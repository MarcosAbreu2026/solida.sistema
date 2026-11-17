// Atas e pendências (pedido de 21/10, primeira prioridade da reunião): o Bitrix está sendo pouco usado, então as
// atas e as ações que saem delas ficam aqui. Cada ata é ligada a uma obra ou a um departamento. Item que exige
// ação vira pendência, com responsável e prazo, que dá para filtrar por pessoa, setor ou obra.
// Pendências em quadro por prazo (como o Bitrix: Vencido · Hoje · Esta semana · Próxima semana · Sem prazo ·
// Em duas semanas · Concluído) ou em lista. Na nuvem os dados ficam no Supabase (tabelas atas e pendencias,
// com as regras de quem vê no próprio banco); no computador do escritório ficam só neste navegador (teste).

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana, diasEntre, ehData } from '../datas.js';
import { NA_NUVEM, perfilAtual, listarAtasPendencias, criarAtaNuvem, criarPendenciaNuvem, criarPendenciasNuvemLote, atualizarPendenciaNuvem, atualizarAtaNuvem, apagarPendenciaNuvem, apagarPendenciasNuvem, atualizarPendenciasNuvem, apagarAtaNuvem, listarNotasPend, listarNotasPendVarias, criarNotaPend, apagarNotaPend } from '../nuvem.js';
import { SETORES, SETORES_ORGANOGRAMA, funcoesDoCargo } from '../funcoes.js';
import { funcaoVe } from '../config.js';
import { sessao, idPessoa, funcaoReal, funcaoAtual, simulando } from '../sessao.js';
import { lerPessoasTarefas } from '../armazenamento.js';
import { analisarAta, lerArquivoAta, acharResponsavel, ehAtaDePendencias, lerAtaDePendencias, formatoListaPendencias, lerListaPorPessoa } from '../ata-leitor.js';
import { analisarReuniao, analisarFala, pareceResumoEmTopicos } from '../fala-leitor.js';
import { caixaConvidados } from '../reunioes.js';

export const ABAS = [['pendencias', 'Pendências'], ['atas', 'Atas'], ['pautas', 'Pautas'], ['nova', 'Nova ata']];
export const SETORES_ATA = [...SETORES_ORGANOGRAMA, 'Diretoria / geral'];

let dados = { atas: [], pendencias: [], pessoas: [], erro: '' };
let rascunho = null;   // ata lida de um arquivo/texto, esperando conferência

export const temRascunho = () => !!rascunho;
export function descartarRascunho() { rascunho = null; lote = null; }
let lote = null;   // "ata de pendências" lida: cada linha vira uma tarefa, esperando conferência
export const temLote = () => !!lote;
// Importar LISTA DE PENDÊNCIAS (aba Tarefas): PDF com a tabela Nº · Obra · Descrição · Responsável · Urgência · Desde · Previsto, em que cada linha é uma tarefa
// (com a obra, o responsável, a prioridade e o prazo da própria linha). Fica separado da importação de ata (aba Atas), que monta uma ata de uma reunião só.
export async function importarListaPendencias(arquivo, obras) {
  if (!dados.pessoas.length) await carregar();
  const r = await lerArquivoAta(arquivo);
  const formato = formatoListaPendencias(r.texto, r.paginas);
  if (!formato) throw new Error('Este PDF não parece uma lista de pendências (tabela Obra · Pendência · Urgência… ou Nº · Obra · Descrição · Responsável…). Para importar uma ata de reunião, use a aba Atas.');
  const opc = { pessoas: dados.pessoas, obras, hoje: hojeISO() };
  rascunho = null; lote = montarLote(formato === 'pessoa' ? lerListaPorPessoa(r.paginas, r.texto, opc) : lerAtaDePendencias(r.paginas, r.texto, opc), obras);
  return lote;
}
// lê um arquivo (PDF ou texto) ou texto colado e monta o rascunho da ata
export async function importar({ arquivo = null, texto = '', fala = false }, obras) {
  if (!dados.pessoas.length) await carregar();
  let t = texto; let nome = ''; let paginas = null;
  if (arquivo) { const r = await lerArquivoAta(arquivo); t = r.texto; paginas = r.paginas; nome = String(arquivo.name || '').replace(/\.[^.]+$/, ''); }
  if (!String(t).trim()) throw new Error('Não há texto para ler.');
  const opc = { pessoas: dados.pessoas, obras, hoje: hojeISO() };
  // transcrição de reunião (gravada) ou resumo em tópicos: leitor de reunião; ata pronta (PDF, texto): leitor de ata
  if (fala) rascunho = analisarFala(t, opc);
  else if (!arquivo && pareceResumoEmTopicos(t)) rascunho = analisarReuniao(t, opc);
  else rascunho = analisarAta(t, { ...opc, setores: SETORES_ATA, nomeArquivo: nome, paginas });
  return rascunho;
}

// ---------------------------------------------------------------- ata de pendências → tarefas
const normTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const primeiroNomeDe = (n) => normTxt(String(n || '').replace(/\(.*?\)/g, ' ')).split(/[\s.]+/).filter(Boolean)[0] || '';
// quadros que não são uma obra (categorias do quadro de metas): não viram obra em orçamento
const NAO_E_OBRA = /^(as built|projetos?|aditivos?|planilha padr[aã]o|or[cç]amento cliente novo)$|\s·\s/i;
const CODIGO_OBRA = /^(mo|po)\s*\d+[a-z]*$/i;
export const normalizarCodigoObra = (txt) => { const s = String(txt || '').trim(); return CODIGO_OBRA.test(s) ? s.replace(/\s+/g, '').replace(/^(mo|po)/i, (m) => m[0].toUpperCase() + m[1].toLowerCase()) : s; };
// o assunto sai do que tem que ser feito (compatibilizar → COMPATIBILIZAÇÃO, DWG ou planta → PROJETO…); a obra fica só no campo Obra
const ASSUNTOS = [[/compatibiliz/, 'COMPATIBILIZAÇÃO'], [/as built|asbuilt/, 'AS BUILT'], [/\bpop\b/, 'POP'], [/relatorio/, 'RELATÓRIO'], [/\bmetas?\b/, 'METAS'], [/paisagismo/, 'PAISAGISMO'], [/vidros?|espelhos?/, 'VIDROS'],
  [/mobiliario/, 'MOBILIÁRIO'], [/serralheria/, 'SERRALHERIA'], [/marceneiro|marcenaria/, 'MARCENARIA'], [/acustic/, 'ACÚSTICA'], [/rodape/, 'RODAPÉ'], [/escopo/, 'ESCOPO'], [/resumo/, 'RESUMO'], [/terceiros/, 'TERCEIROS'],
  [/\bdwg\b|planta|projeto/, 'PROJETO'], [/aditivo/, 'ADITIVOS'], [/fornecedor/, 'FORNECEDOR'], [/or[cç]amento/, 'ORÇAMENTO'], [/pagamento/, 'PAGAMENTO'], [/\+?controle/, 'CONTROLE'],
  [/cobrar|liga[cç][aã]o|ligar|resposta/, 'COBRANÇA'], [/pintura/, 'PINTURA'], [/pasta|arquivo|salvar/, 'ARQUIVO'], [/cliente/, 'CLIENTE'], [/reuni[aã]o/, 'REUNIÃO'], [/planilha|base de/, 'PLANILHA'], [/listagem|lista de/, 'LISTAGEM']];
// sem palavra conhecida: a primeira palavra do que tem que ser feito, pulando o verbo no infinitivo ("Ver pedra do topo" → PEDRA)
export const assuntoDoTexto = (txt) => {
  const t = normTxt(txt); const a = ASSUNTOS.find(([re]) => re.test(t)); if (a) return a[1];
  const ps = String(txt || '').trim().split(/\s+/).filter(Boolean); const p = /(ar|er|ir|or)$/i.test(ps[0] || '') && ps[1] ? ps[1] : ps[0];
  return String(p || 'GERAL').replace(/[^\p{L}\p{N}-]/gu, '').toLocaleUpperCase('pt-BR') || 'GERAL';
};
function montarLote(lido, obras) {
  if (lido.tipo === 'pessoa') {
    // lista de UMA pessoa (Ata de pendências — Mariana): ela é a responsável de todas; "Com a Julia" na observação põe a Julia como observadora
    const q = primeiroNomeDe(lido.pessoaNome); const resp = dados.pessoas.find((p) => primeiroNomeDe(p.nome) === q) || {};
    const itens = lido.itens.map((it) => {
      const geral = /^geral$/i.test(it.obraTxt); const cod = normalizarCodigoObra(it.obraTxt);
      const cad = geral ? '' : obras.find((o) => codigoDaObra(o) === codigoDaObra(cod) || normTxt(o) === normTxt(it.obraTxt) || normTxt(NOMES_OBRAS[String(o).toLowerCase()]) === normTxt(it.obraTxt));
      const obsIds = [...new Set(it.comPessoas.map((n) => { const q2 = primeiroNomeDe(n); return (dados.pessoas.find((p) => primeiroNomeDe(p.nome) === q2) || {}).id; }).filter((id) => id && id !== resp.id))];
      const notas = [it.obs, it.desde ? `Pendente desde ${dm(it.desde).slice(0, 5)}` : ''].filter(Boolean);
      return { n: it.n, incluir: true, obra: cad || '', obraPdf: !geral && !cad ? it.obraTxt : '', assunto: assuntoDoTexto(it.titulo), desc: it.titulo, responsavel: resp.id || '', observadores: obsIds, responsaveisTxt: lido.pessoaNome, setor: (resp.setores || [])[0] || '', urgencia: it.urgencia, prazo: it.prazo, hora: it.hora || '', notas };
    });
    return { titulo: lido.titulo, data: lido.data, total: lido.total, itens };
  }
  const setorTerc = SETORES_ATA.find((s) => /terceiriz\w*\s+laranja/i.test(s)) || '';
  const setorPadrao = SETORES_ATA.find((s) => /^orc\s+obras\s+novas$/i.test(s)) || '';
  const itens = lido.itens.map((it) => {
    const ids = it.responsaveis.map((nome) => { const q = primeiroNomeDe(nome); const ach = dados.pessoas.filter((p) => primeiroNomeDe(p.nome) === q); return (ach.find((p) => normTxt(p.nome) === normTxt(nome)) || ach[0] || {}).id || ''; }).filter(Boolean);
    const principal = it.obraTxt; const alvo = principal.replace(/^p[oó]s-obra\s*·\s*/i, ''); const cod = normalizarCodigoObra(alvo);
    // a obra do PDF (código ou nome) é procurada no cadastro, inclusive pelo nome (Sinagoga Leblon = Mo461)
    const cad = obras.find((o) => codigoDaObra(o) === codigoDaObra(cod) || normTxt(o) === normTxt(alvo) || normTxt(NOMES_OBRAS[String(o).toLowerCase()]) === normTxt(alvo));
    const terc = /terceiriz\w*\s+laranja/i.test(it.obraDetalhe);
    const notas = [it.nota, it.obraDetalhe && !terc ? `Quadro: ${it.obraDetalhe}` : ''].filter(Boolean);
    // sem obra no cadastro: o que está na coluna Obra é o próprio assunto do quadro (As built, Projetos, Aditivos, Planilha padrão…)
    const assunto = cad || CODIGO_OBRA.test(cod) ? assuntoDoTexto(it.titulo) : principal.toLocaleUpperCase('pt-BR');
    return { n: it.n, incluir: true, obra: cad || '', obraPdf: !cad && CODIGO_OBRA.test(cod) ? principal : '', assunto, desc: it.titulo, responsavel: ids[0] || '', observadores: ids.slice(1), responsaveisTxt: it.responsaveisTxt, setor: terc && setorTerc ? setorTerc : setorPadrao, urgencia: it.urgencia, prazo: it.prazo, notas };
  });
  return { titulo: lido.titulo, data: lido.data, total: lido.total, itens };
}
export function painelLote(obras) {
  if (!lote) return '';
  const pessoas = pessoasSelecionaveis();
  const linha = (it) => html`<tr data-lote-i="${it.n}" data-hora="${it.hora || ''}" class="lote-lin">
    <td><input type="checkbox" data-lote-inc checked title="Criar esta tarefa"></td><td class="lote-n">${it.n}</td>
    <td><select data-lote-obra><option value="">— sem obra —</option>${gruposDeObras(obras, it.obra, { criar: true })}</select>${it.obraPdf ? html`<small class="lote-obs">no PDF: ${it.obraPdf}</small>` : ''}</td>
    <td><input data-lote-assunto value="${it.assunto}"></td>
    <td><input data-lote-desc value="${it.desc}"></td>
    <td><select data-lote-resp class="${it.responsavel ? '' : 'lote-falta'}"><option value="">— escolher —</option>${pessoas.map((p) => html`<option value="${p.id}" ${p.id === it.responsavel ? html.seguro('selected') : ''}>${p.nome}</option>`)}</select>${it.observadores.length ? html`<small class="lote-obs" data-lote-obs="${it.observadores.join(',')}">+ observa: ${it.observadores.map((id) => nomeDe(id)).join(', ')}</small>` : ''}</td>
    <td><select data-lote-setor><option value="">— escolher —</option>${SETORES_ATA.map((s) => html`<option value="${s}" ${s === it.setor ? html.seguro('selected') : ''}>${s}</option>`)}</select></td>
    <td><select data-lote-urg><option value="">—</option>${Object.entries(URG).map(([v, [t]]) => html`<option value="${v}" ${v === it.urgencia ? html.seguro('selected') : ''}>${t[0] + t.slice(1).toLocaleLowerCase('pt-BR')}</option>`)}</select></td>
    <td><input type="date" data-lote-prazo value="${it.prazo || ''}"></td>
    <td><input data-lote-nota value="${it.notas.join(' · ')}" placeholder="vai para as anotações"></td></tr>`;
  return html`<section class="lote">
    <h2>Ata de pendências lida: ${lote.itens.length} ${lote.itens.length === 1 ? 'tarefa' : 'tarefas'}</h2>
    <p class="pequeno">${lote.titulo}${lote.data ? ` · ${dm(lote.data)}` : ''}. Cada linha vira uma <b>tarefa</b>, com o responsável, a prioridade e o prazo da ata. Confira, corrija o que precisar, desmarque o que não quiser criar e clique em "Criar tarefas".</p>
    <p class="pequeno">Obra que ainda não está na lista: escolha "+ Nova obra em orçamento…" ou "+ Novo pós-obra…" na própria caixinha da linha.</p>
    <div class="tabela-rolagem"><table class="lote-tab"><thead><tr><th></th><th>Nº</th><th>Obra</th><th>Assunto</th><th>O que fazer</th><th>Responsável</th><th>Setor</th><th>Prioridade</th><th>Prazo</th><th>Anotação</th></tr></thead>
    <tbody>${lote.itens.map(linha)}</tbody></table></div>
    <div class="lote-botoes"><button type="button" class="botao" data-lote-descartar>Descartar</button><button type="button" class="botao on" data-lote-criar>Criar tarefas</button><span class="pequeno lote-msg"></span></div>
  </section>`;
}
// cria as tarefas conferidas (e as obras em orçamento novas, antes). linhas = [{ obra, assunto, desc, responsavel, observadores, setor, urgencia, prazo, nota }]
export async function criarTarefasDoLote(linhas) {
  const lista = linhas.map((l) => ({
    ata_id: null, descricao: [String(l.assunto || '').trim().replace(/,/g, ' /').toLocaleUpperCase('pt-BR'), String(l.desc || '').trim()].filter(Boolean).join(', '),
    responsavel: l.responsavel, responsavel_nome: nomeDe(l.responsavel), responsavel_tipo: 'solida', responsavel_categoria: null, prazo: l.prazo || null, status: 'aberta',
    obra: l.obra || null, setor: l.setor || null, os: null, urgencia: l.urgencia || null, funcao_tarefa: null, observadores: l.observadores || [], hora: l.hora || null, duracao: 60,
  }));
  let ids = [];
  if (NA_NUVEM) ids = await criarPendenciasNuvemLote(lista);
  else { const lc = lerLocal(); for (const x of lista) { const id = lc.seq++; ids.push(id); lc.pendencias.push({ id, ...x, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); } gravarLocal(lc); }
  for (let i = 0; i < linhas.length; i++) if (linhas[i].nota && ids[i] != null) { try { await anotar(ids[i], linhas[i].nota); } catch { /* a tarefa já foi criada; a anotação pode ser refeita na janela da tarefa */ } }
  lote = null;
  await carregar();
  return ids.length;
}

// ---------------------------------------------------------------- armazenamento
const CHAVE = 'solida.atas';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { atas: [], pendencias: [], seq: 1 }; } catch { return { atas: [], pendencias: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
function pessoasLocais() {
  const m = new Map([[idPessoa(), { id: idPessoa(), nome: sessao().nome }]]);
  for (const [id, p] of Object.entries(lerPessoasTarefas())) if (p && p.nome && !m.has(id)) m.set(id, { id, nome: p.nome, funcao: p.funcao });
  return [...m.values()];
}
const souEu = () => (NA_NUVEM ? perfilAtual() && perfilAtual().id : idPessoa());

// Quem vê o quê: só sócios e administrativo veem as pendências e atas de outras pessoas da Sólida fora da própria obra
// ou departamento. Os demais veem o que é seu (responsável ou criador), da(s) sua(s) obra(s) e, quem não é de obra,
// do(s) departamento(s) da sua função. O banco já aplica esta regra para valer (tabelas atas e pendencias); aqui ela
// também vale no modo teste e no "ver como", para a tela mostrar o mesmo.
// setores da pessoa: na nuvem, os marcados em Acessos (perfis.setores); no modo teste ou "ver como", os da função
// Observadores: uma ou mais pessoas que acompanham a tarefa (veem e anotam no chat, sem editar). Lista = quem tem login, menos o responsável.
const chipObs = (nome, id, nomePessoa) => html`<span class="obs-chip" data-obs-chip="${id}">${nomePessoa}<button type="button" data-obs-del="${id}" title="Tirar">×</button><input type="hidden" name="${nome}" value="${id}"></span>`;
// Observadores (opcional): clique nos nomes da lista para acrescentar; o clique no × do nome tira. O gestor automático (pelas obras e setores) já aparece como observador, travado.
const caixaObservadores = (nome, marcados, respId, gestoresNome = '') => {
  const pessoas = pessoasSelecionaveis().filter((x) => x.id !== respId);
  return html`<div class="obs" data-obs="${nome}">
    <span class="obs-rot">Observadores <small>(opcional)</small></span>
    <div class="obs-chips">${String(gestoresNome || '').split(', ').filter(Boolean).map((n) => html`<span class="obs-chip obs-fixo" title="Gestor automático: acompanha a tarefa e não dá para tirar">🔒 ${n} <small>gestor</small></span>`)}${pessoas.filter((x) => marcados.includes(x.id)).map((x) => chipObs(nome, x.id, x.nome))}</div>
    <input type="search" class="obs-busca" placeholder="Procurar um nome…" data-obs-busca autocomplete="off">
    <div class="obs-lista">${pessoas.map((x) => html`<button type="button" class="obs-item ${marcados.includes(x.id) ? 'on' : ''}" data-obs-add="${x.id}" data-obs-nome="${x.nome}">${x.nome}</button>`)}</div>
  </div>`;
};
export const DURACOES = [[30, '30 min'], [60, '1 hora'], [90, '1h30'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas']];
// arrastar o cartão da tarefa na Agenda: muda o dia (prazo), o horário e a duração; guarda o prazo original como qualquer reprogramação
export async function definirHorarioTarefa(id, { prazo, hora, duracao }, escopo = 'uma') {
  const p = pendenciaPorId(id); if (!p) return;
  if (escopo === 'seguintes' && p.serie) {
    const delta = prazo && p.prazo ? diasEntre(p.prazo, prazo) : 0;
    const seg = seguintesDe(p);
    const mapa = Object.fromEntries(seg.map((x) => [x.id, x.prazo]));
    await atualizarVarias(seg.map((x) => x.id), (i) => ({ hora: hora || null, duracao: duracao ? Number(duracao) : null, ...(delta ? { prazo: somarDias(mapa[i], delta) } : {}) }));
  }
  if (prazo && prazo !== p.prazo) await reprogramar(id, prazo);
  const mud = { hora: hora || null, duracao: duracao ? Number(duracao) : null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}
const ABAIXO_DA_OBRA = ['estagiario', 'encarregado', 'ajudante', 'gestor_obra', 'posobra', 'estagiario_posobra', 'executor_ferramentas', 'estagiario_compras', 'orc_terceirizado', 'orc_obras_novas'];
function meusSetores() {
  const f = funcaoAtual();
  if (NA_NUVEM && !simulando() && perfilAtual() && Array.isArray(perfilAtual().setores) && perfilAtual().setores.length) return perfilAtual().setores;
  return SETORES.filter(([id]) => (f.areas || []).includes(id)).map(([, nome]) => nome);
}
function visivelParaMim(x, ehAta, pendDaAta) {
  const f = funcaoAtual();
  if (['socio', 'administrativo'].includes(f.id)) return true;
  const eu = souEu();
  if (!ehAta) {
    // TAREFA: só a minha, a de quem eu respondo (gestores), a que eu criei, as da minha obra se eu sou gestor de obra / pós-obra,
    // e a coordenação de operações segue vendo os setores dela. Os outros colegas do mesmo setor não aparecem.
    if (x.responsavel === eu || (x.gestores || []).includes(eu) || (x.observadores || []).includes(eu) || x.criado_por === eu) return true;
    // quem é de um cargo abaixo não vê a tarefa do cargo acima (a não ser como observador): o gestor de obra / pós-obra só vê da obra as de quem é de obra ou externo;
    // a coordenação de operações não vê as da diretoria
    const funcDoResp = x.responsavel ? ((dados.pessoas.find((p) => p.id === x.responsavel) || {}).funcao || '') : '';
    if (['gestor_obra', 'posobra'].includes(f.id) && x.obra && (sessao().obras || []).includes(x.obra)) return !x.responsavel || ABAIXO_DA_OBRA.includes(funcDoResp);
    if (f.id === 'coord_operacoes' && x.setor) return meusSetores().includes(x.setor) && funcDoResp !== 'socio';
    return false;
  }
  if (x.criado_por === eu) return true;
  if (x.obra && (sessao().obras || []).includes(x.obra)) return true;
  if (funcaoVe('opcao.atas.escopo_todos', f.id, false)) return true;   // Configurações: esta função vê as atas de todos os departamentos
  // ATA: só quem é do setor (ou da obra) e quem criou. Quem recebeu uma pendência da ata de outro setor vê a pendência, não a ata.
  return !f.porObra && !!x.setor && meusSetores().includes(x.setor);
}
export async function carregar() {
  try {
    if (NA_NUVEM) dados = { ...(await listarAtasPendencias()), erro: '' };
    else { const l = lerLocal(); dados = { atas: [...l.atas].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id), pendencias: l.pendencias, pessoas: pessoasLocais(), erro: '' }; }
    const todasPend = dados.pendencias;
    dados = { ...dados, pendencias: todasPend.filter((p) => visivelParaMim(p, false, [])), atas: dados.atas.filter((a) => visivelParaMim(a, true, todasPend)) };
  } catch (e) { dados = { ...dados, erro: String(e.message || e) }; }
  renovarRecorrentes();
  return dados;
}
const nomeDe = (id, reserva) => ((dados.pessoas.find((p) => p.id === id) || {}).nome) || reserva || '—';

// ---------------------------------------------------------------- revisão da ata (R01, R02…)
// Criar revisão = abrir a ata no formulário, mexer em qualquer coisa (dados, pendências, informativos) e salvar.
// Os itens mantidos continuam sendo as mesmas pendências (status e reprogramações preservados); os tirados somem; os novos entram.
// O nome ganha o próximo Rnn e o PDF novo vai para o Drive (o PDF da revisão anterior continua lá).
const mapaInfo = (p) => ({ n: p.item || null, texto: p.descricao, quem: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : '')), tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), categoria: p.responsavel ? null : (p.externoCategoria || null) });
const camposPend = (p) => ({ item: p.item || null, descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), responsavel_categoria: p.responsavel ? null : (p.externoCategoria || null), prazo: p.prazo || null });
export const todasPendencias = () => dados.pendencias;
export const ataPorId = (id) => dados.atas.find((x) => String(x.id) === String(id));
// a ata salva, na forma que o formulário entende (para editar)
export function ataComoRascunho(a) {
  const semA = (s) => semAcento(String(s || '')).toLowerCase().trim();
  const pend = dados.pendencias.filter((p) => String(p.ata_id) === String(a.id) && p.status !== 'cancelada').map((p) => ({ kind: 'pendencia', pid: p.id, item: p.item, descricao: p.descricao, responsavel: p.responsavel || '', externoTipo: p.responsavel ? '' : (p.responsavel_tipo || 'terceirizado'), externoCategoria: p.responsavel_categoria || '', externoNome: p.responsavel ? '' : (p.responsavel_nome || ''), prazo: p.prazo || '' }));
  const infos = (a.informativos || []).map((x, i) => {
    const t = typeof x === 'string' ? { texto: x } : x; const pessoa = t.quem ? dados.pessoas.find((q) => semA(q.nome) === semA(t.quem)) : null;
    return { kind: 'informativo', item: t.n || (1000 + i), descricao: t.texto, responsavel: pessoa ? pessoa.id : '', externoTipo: pessoa ? '' : (t.tipo || 'solida'), externoCategoria: t.categoria || '', externoNome: pessoa ? '' : (t.quem || '') };
  });
  return { data: a.data, obra: a.obra || '', setor: a.setor || '', local: a.local || '', participantes: a.participantes || [], tipoReuniao: a.tipo_reuniao || 'REUNIÃO', resumo: a.resumo || '', pendencias: pend, informativosLista: infos, revisando: a };
}
export async function revisar(id, { data, tipoReuniao, obra, setor, local, participantes, resumo, pendencias, informativos }) {
  const a = ataPorId(id); if (!a) throw new Error('ata não encontrada');
  const revisao = (Number(a.revisao) || 0) + 1;
  const titulo = nomePadrao({ obra, setor, data, tipo: tipoReuniao, revisao });
  const mudAta = { titulo, data, tipo: obra ? 'obra' : 'departamento', obra: obra || null, setor: setor || null, participantes, resumo, tipo_reuniao: tipoReuniao || 'REUNIÃO', revisao, local: local || null, informativos: informativos.map(mapaInfo), arquivo: null, arquivada_em: null, arquivo_erro: null };
  const existentes = dados.pendencias.filter((p) => String(p.ata_id) === String(id) && p.status !== 'cancelada');
  const manter = new Set(pendencias.filter((p) => p.pid).map((p) => String(p.pid)));
  const remover = existentes.filter((e) => !manter.has(String(e.id)));
  const agora = new Date().toISOString(); const quem = sessao().nome || '';
  const mudancasDe = (p) => {
    const e = existentes.find((x) => String(x.id) === String(p.pid)); const m = { ...camposPend(p), obra: obra || null, setor: setor || null };
    if (e && e.prazo && m.prazo && m.prazo !== e.prazo) { m.prazo_original = e.prazo_original || e.prazo; m.reprogramacoes = [...(e.reprogramacoes || []), { de: e.prazo, para: m.prazo, em: agora, por: quem }]; }
    return m;
  };
  if (NA_NUVEM) {
    await atualizarAtaNuvem(id, mudAta);
    for (const p of pendencias) { if (p.pid) await atualizarPendenciaNuvem(p.pid, mudancasDe(p)); else await criarPendenciaNuvem({ ...camposPend(p), ata_id: id, status: 'aberta', obra: obra || null, setor: setor || null }); }
    for (const e of remover) await apagarPendenciaNuvem(e.id);
  } else {
    const l = lerLocal(); Object.assign(l.atas.find((x) => String(x.id) === String(id)), mudAta);
    for (const p of pendencias) {
      if (p.pid) { const q = l.pendencias.find((x) => String(x.id) === String(p.pid)); if (q) Object.assign(q, mudancasDe(p)); }
      else l.pendencias.push({ id: l.seq++, ata_id: id, ...camposPend(p), status: 'aberta', obra: obra || null, setor: setor || null, criado_por: idPessoa(), criado_em: agora, concluida_em: null });
    }
    l.pendencias = l.pendencias.filter((x) => !remover.some((e) => String(e.id) === String(x.id)));
    gravarLocal(l);
  }
  await carregar();
  return id;
}
// ---------------------------------------------------------------- acompanhamento da ata e pauta da próxima reunião
// As pendências ficam ligadas à ata (mesmo se saírem da lista de pendências). Daqui sai o acompanhamento ("x de y concluídas")
// e a pauta da próxima reunião: o que ficou aberto da ata e das atas anteriores da mesma obra/departamento.
const pendDaAta = (a) => dados.pendencias.filter((p) => String(p.ata_id) === String(a.id) && p.status !== 'cancelada');
export function acompanhamento(a) {
  const ps = pendDaAta(a); const hoje = hojeISO();
  return { total: ps.length, feitas: ps.filter((p) => p.status === 'feita').length, abertas: ps.filter((p) => p.status === 'aberta').length, atrasadas: ps.filter((p) => p.status === 'aberta' && p.prazo && p.prazo < hoje).length, reprogramadas: ps.filter(reprogramada).length };
}
export function pautaTexto(a) {
  const hoje = hojeISO(); const mesmoLugar = (x) => (a.obra ? x.obra === a.obra : x.setor === a.setor);
  const linha = (p) => { const [ass, resto] = dividirDescricao(p.descricao); const quem = String(nomeDe(p.responsavel, p.responsavel_nome)).toLocaleUpperCase('pt-BR'); const atras = p.prazo && p.prazo < hoje ? ' [ATRASADA]' : ''; const rep = reprogramada(p) ? ` [reprogramada, era ${dm(p.prazo_original).slice(0, 5)}]` : '';
    return `- ${ass ? `${ass}, ${resto}` : p.descricao} — ${quem}${p.prazo ? ` — prazo ${dm(p.prazo).slice(0, 5)}` : ''}${atras}${rep}`; };
  const daAta = pendDaAta(a); const abertasAta = daAta.filter((p) => p.status === 'aberta').sort((x, y) => String(x.prazo || '9').localeCompare(String(y.prazo || '9')));
  const feitas = daAta.filter((p) => p.status === 'feita');
  const outras = dados.pendencias.filter((p) => String(p.ata_id) !== String(a.id) && p.status === 'aberta' && p.ata_id && mesmoLugar(p)).sort((x, y) => String(x.prazo || '9').localeCompare(String(y.prazo || '9')));
  const out = [`PAUTA DA PRÓXIMA REUNIÃO — ${a.obra || a.setor || 'Escritório'}`, `Base: ${a.titulo}`, ''];
  out.push(`1. Pendências abertas da reunião de ${dm(a.data)} (${abertasAta.length})`, ...(abertasAta.length ? abertasAta.map(linha) : ['- nenhuma pendência aberta']), '');
  if (feitas.length) out.push(`2. Concluídas desde a reunião (${feitas.length})`, ...feitas.map((p) => linha(p).replace(/ \[.*$/, '')), '');
  if (outras.length) out.push(`${feitas.length ? 3 : 2}. Outras pendências abertas ${a.obra ? 'desta obra' : 'deste departamento'}, de atas anteriores (${outras.length})`, ...outras.map(linha), '');
  out.push('Assuntos novos:', '- ');
  return out.join('\n');
}
// ---------------------------------------------------------------- nome padrão da ata
// Obra (ou pós-obra) _ aaaa.mm.dd _ ATA _ tipo _ Rnn   ex.: Mo344_2026.07.10_ATA_ARQUITETURA-CLIENTE_R00
// Salva no Drive, na pasta da obra: GERENCIAMENTO\ATA (obra) ou PÓS OBRA\PO_OBRAS\<ano>\Po_NNN\GERENCIAMENTO\ATA (pós-obra).
export const TIPOS_REUNIAO = ['REUNIÃO', 'ARQUITETURA', 'CLIENTE', 'ARQUITETURA-CLIENTE', 'TERCEIRIZADO', 'PLANEJAMENTO'];
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// A ata é da obra E do departamento (a obra manda no nome e na pasta do Drive); reunião só do escritório não tem nenhum dos dois.
const semEspaco = (s) => semAcento(s).replace(/\s*\/\s*/g, '-').replace(/\s+/g, '');
const baseDe = ({ obra, setor }) => obra || semEspaco(setor || '') || 'ESCRITORIO';
export const rev2 = (n) => `R${String(Number(n) || 0).padStart(2, '0')}`;
export function proximaRevisao({ obra, setor, data, tipo }) {
  const base = baseDe({ obra, setor });
  const iguais = dados.atas.filter((a) => baseDe(a) === base && a.data === data && (a.tipo_reuniao || 'REUNIÃO') === tipo);
  return iguais.length ? Math.max(...iguais.map((a) => Number(a.revisao) || 0)) + 1 : 0;
}
export function nomePadrao({ obra, setor, data, tipo, revisao }) {
  if (!data) return '';
  return `${baseDe({ obra, setor })}_${String(data).replace(/-/g, '.')}_ATA_${tipo || 'REUNIÃO'}_${rev2(revisao)}`;
}
// atualiza o nome mostrado no formulário (e a revisão, se a pessoa não mexeu nela)
export function atualizarNomeDoForm(form) {
  const obra = form.obra.value === '-' ? '' : form.obra.value; const setor = form.setor.value; const data = form.data.value; const tipo = form.tipo_reuniao.value;
  form.revisao.value = form.dataset.revisar ? form.dataset.revisao : 0;   // ata nova é R00; revisão é a próxima da ata editada
  const nome = nomePadrao({ obra, setor, data, tipo, revisao: form.revisao.value });
  const el = document.getElementById('ata-nome'); if (el) el.textContent = nome ? `${nome}.pdf` : 'escolha a data';
  const dest = document.getElementById('ata-destino');
  if (dest) dest.textContent = obra ? (/^Po/i.test(obra) ? 'Vai para a pasta do pós-obra: PÓS OBRA › PO_OBRAS › ano › obra › GERENCIAMENTO › ATA.' : 'Vai para a pasta da obra: OPERACOES › OBRAS › obra › GERENCIAMENTO › ATA.') : 'Sem obra: a ata fica só no sistema.';
  return nome;
}

export async function criarAta({ titulo, data, tipo, obra, setor, participantes, resumo, pendencias, informativos = [], tipoReuniao, revisao, local, horario }) {
  // informativo = texto + quem informou (Sólida, terceirizado ou cliente)
  informativos = informativos.map((p) => ({ n: p.item || null, texto: p.descricao, quem: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : '')), tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), categoria: p.responsavel ? null : (p.externoCategoria || null) }));
  const ata = { informativos, titulo, data, tipo, obra: obra || null, setor: setor || null, participantes, resumo, tipo_reuniao: tipoReuniao || 'REUNIÃO', revisao: Number(revisao) || 0, local: local || null, horario: horario || null };
  const pends = pendencias.map((p) => ({ item: p.item || null, descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), responsavel_categoria: p.responsavel ? null : (p.externoCategoria || null), prazo: p.prazo || null, status: 'aberta' }));
  let nova;
  if (NA_NUVEM) nova = await criarAtaNuvem(ata, pends);
  else {
    const l = lerLocal(); const id = l.seq++;
    nova = { id, ...ata, criado_por: idPessoa(), criado_por_nome: sessao().nome, criado_em: new Date().toISOString() };
    l.atas.push(nova);
    for (const p of pends) l.pendencias.push({ id: l.seq++, ata_id: id, ...p, obra: ata.obra, setor: ata.setor, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null });
    gravarLocal(l);
  }
  rascunho = null;
  await carregar();
  return nova;
}
export async function criarPendencia({ ata_id, descricao, responsavel, externoNome, externoTipo, externoCategoria, prazo, obra, setor, os, osFase, urgencia, funcaoTarefa, observadores, hora, duracao, recorrente = false, frequencia = 'semanal' }) {
  const p = { ata_id: ata_id || null, descricao, responsavel: responsavel || null, responsavel_nome: responsavel ? nomeDe(responsavel) : (externoNome || externoCategoria || (externoTipo === 'cliente' ? 'Cliente' : externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: responsavel ? 'solida' : (externoTipo || 'terceirizado'), responsavel_categoria: responsavel ? null : (externoCategoria || null), prazo: prazo || null, status: 'aberta', obra: obra || null, setor: setor || null, os: os || null, os_fase: osFase || null, urgencia: urgencia || null, funcao_tarefa: funcaoTarefa || null, observadores: observadores || [], hora: hora || null, duracao: duracao ? Number(duracao) : 60 };
  if (ata_id) { const a = dados.atas.find((x) => String(x.id) === String(ata_id)); const ns = [...dados.pendencias.filter((x) => String(x.ata_id) === String(ata_id)).map((x) => Number(x.item) || 0), ...((a && a.informativos) || []).map((x) => (x && x.n) || 0)]; p.item = Math.max(0, ...ns) + 1; }
  // recorrente: repete toda semana, no mesmo dia da semana. Cada ocorrência é uma tarefa; as primeiras ${SEMANAS_INICIAIS} semanas já nascem e o resto é criado aos poucos (renovarRecorrentes)
  if (recorrente && p.prazo && !ata_id) {
    const serie = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const freq = frequencia === 'mensal' ? 'mensal' : 'semanal';
    const lista = Array.from({ length: SEMANAS_INICIAIS }, (_, k) => ({ ...p, prazo: dataDaSerie(p.prazo, freq, k), serie, recorrente: true, frequencia: freq }));
    if (NA_NUVEM) await criarPendenciasNuvemLote(lista);
    else { const l = lerLocal(); for (const x of lista) l.pendencias.push({ id: l.seq++, ...x, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
    await carregar(); return;
  }
  if (NA_NUVEM) await criarPendenciaNuvem(p);
  else { const l = lerLocal(); l.pendencias.push({ id: l.seq++, ...p, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
  await carregar();
}
// ---- tarefas recorrentes (pedido do Felipe, 12/11/2026): como no Google Agenda, mudar ou excluir pergunta "só esta" ou "esta e as próximas"
const SEMANAS_INICIAIS = 12; const SEMANAS_A_FRENTE = 8;
// data da k-ésima repetição: semanal = +7 dias; mensal = mesmo dia do mês (nos meses curtos, o último dia)
export function dataDaSerie(base, freq, k) {
  if (freq !== 'mensal') return somarDias(base, 7 * k);
  const [a, m, d] = base.split('-').map(Number); const t = (m - 1) + k; const ano = a + Math.floor(t / 12); const mes = ((t % 12) + 12) % 12;
  const ult = new Date(ano, mes + 1, 0).getDate();
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}
export const ehRecorrente = (id) => { const p = pendenciaPorId(id); return !!(p && p.serie); };
const seguintesDe = (p) => dados.pendencias.filter((x) => x.serie && x.serie === p.serie && String(x.id) !== String(p.id) && String(x.prazo || '') >= String(p.prazo || ''));
async function atualizarVarias(ids, mud) {
  if (!ids.length) return;
  if (NA_NUVEM) { for (const i of ids) await atualizarPendenciaNuvem(i, typeof mud === 'function' ? mud(i) : mud); }
  else { const l = lerLocal(); for (const x of l.pendencias) if (ids.some((i) => String(i) === String(x.id))) Object.assign(x, typeof mud === 'function' ? mud(x.id) : mud); gravarLocal(l); }
}
// mantém as séries sempre com ocorrências nas próximas semanas (só o criador da tarefa renova, para não duplicar)
let renovando = false; let ultimaRenovacao = 0;
export async function renovarRecorrentes() {
  if (!NA_NUVEM || renovando || Date.now() - ultimaRenovacao < 5 * 60 * 1000) return;
  renovando = true; ultimaRenovacao = Date.now();
  try {
    const eu = souEu(); const hoje = hojeISO(); const limite = somarDias(hoje, 7 * SEMANAS_A_FRENTE);
    const series = new Map();
    for (const p of dados.pendencias) if (p.serie && p.recorrente && p.criado_por === eu && p.prazo) { const u = series.get(p.serie); if (!u || p.prazo > u.prazo) series.set(p.serie, p); }
    const novas = [];
    for (const u of series.values()) {
      const mensal = u.frequencia === 'mensal';
      if (u.prazo >= (mensal ? somarDias(hoje, 180) : limite)) continue;
      const fimGeracao = mensal ? somarDias(hoje, 365) : somarDias(hoje, 7 * SEMANAS_INICIAIS);
      let d = dataDaSerie(u.prazo, u.frequencia, 1); let k = 1;
      while (d < fimGeracao) {
        if (d >= hoje) novas.push({ descricao: u.descricao, responsavel: u.responsavel, responsavel_nome: u.responsavel_nome, responsavel_tipo: u.responsavel_tipo, responsavel_categoria: u.responsavel_categoria, prazo: d, status: 'aberta', obra: u.obra, setor: u.setor, os: u.os, urgencia: u.urgencia, funcao_tarefa: u.funcao_tarefa, observadores: u.observadores || [], hora: u.hora, duracao: u.duracao, serie: u.serie, recorrente: true, frequencia: u.frequencia || 'semanal' });
        k += 1; d = dataDaSerie(u.prazo, u.frequencia, k);
      }
    }
    if (novas.length) { await criarPendenciasNuvemLote(novas); await carregar(); }
  } catch { /* tenta de novo mais tarde */ } finally { renovando = false; }
}
export async function mudarStatus(id, status) {
  const mud = { status, concluida_em: status === 'feita' ? new Date().toISOString() : null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const p = l.pendencias.find((x) => String(x.id) === String(id)); if (p) Object.assign(p, mud); gravarLocal(l); }
  await carregar();
}
// "Excluir" na lista de pendências NÃO mexe na ata: se a pendência veio de uma ata, só sai da lista (continua no item da ata);
// só a pendência avulsa (sem ata) é apagada de verdade. Para tirar um item da ata, é pela revisão da ata.
export async function apagarPendencia(id, escopo = 'uma') {
  const p = pendenciaPorId(id);
  if (p && p.ata_id) await mudarNaLista(id, false);
  else {
    if (p && p.serie && escopo === 'seguintes') {
      // exclui esta e as próximas; as anteriores deixam de se renovar
      const seg = seguintesDe(p).map((x) => x.id);
      const antes = dados.pendencias.filter((x) => x.serie === p.serie && String(x.prazo || '') < String(p.prazo || '')).map((x) => x.id);
      if (NA_NUVEM) { await apagarPendenciasNuvem([...seg, p.id]); await atualizarPendenciasNuvem(antes, { recorrente: false }); await carregar(); return; }
      await atualizarVarias(antes, { recorrente: false });
      { const l = lerLocal(); l.pendencias = l.pendencias.filter((x) => !seg.some((i) => String(i) === String(x.id))); gravarLocal(l); }
    }
    if (NA_NUVEM) await apagarPendenciasNuvem([id]);
    else { const l = lerLocal(); l.pendencias = l.pendencias.filter((x) => String(x.id) !== String(id)); gravarLocal(l); }
    await carregar();
  }
}
export async function mudarNaLista(id, valor) {
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, { na_lista: valor });
  else { const l = lerLocal(); const p = l.pendencias.find((x) => String(x.id) === String(id)); if (p) p.na_lista = valor; gravarLocal(l); }
  await carregar();
}
export async function apagarAta(id) {
  if (NA_NUVEM) await apagarAtaNuvem(id);
  else { const l = lerLocal(); l.atas = l.atas.filter((x) => String(x.id) !== String(id)); l.pendencias = l.pendencias.filter((x) => String(x.ata_id) !== String(id)); gravarLocal(l); }
  await carregar();
}

// quantas pendências abertas são minhas (para a bolinha do menu)
export function minhasAbertas() {
  const eu = souEu();
  return dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta' && p.responsavel && p.responsavel === eu).length;
}

// ---------------------------------------------------------------- apoio
const dm = (iso) => (iso ? fmtData(iso) : '');
const textoRico = (t) => html.seguro(String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>'));
const ataDe = (p) => dados.atas.find((a) => a.id === p.ata_id);
const onde = (x) => x.obra || x.setor || '';

// em que coluna do quadro a pendência cai
function coluna(p, hoje) {
  if (p.status === 'feita') return 'concluido';
  if (!p.prazo) return 'sem';
  if (p.prazo < hoje) return 'vencido';
  if (p.prazo === hoje) return 'hoje';
  const fimSemana = somarDias(inicioDaSemana(hoje), 6);
  if (p.prazo <= fimSemana) return 'semana';
  if (p.prazo <= somarDias(fimSemana, 7)) return 'proxima';
  return 'duas';
}
const COLUNAS = [
  ['vencido', 'Vencido'], ['hoje', 'Vencimento hoje'], ['semana', 'Vencimento esta semana'], ['proxima', 'Vencimento na próxima semana'],
  ['sem', 'Sem prazo'], ['duas', 'Vencimento em duas semanas ou mais'], ['concluido', 'Concluído'],
];

// padrão da Sólida: o assunto vem primeiro, em negrito, e depois da vírgula o que é ("ACM, Retirar da área gourmet")
// a descrição é guardada como Assunto, o que fazer; no formulário são duas caixinhas
export const dividirDescricao = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? [s.slice(0, i).trim().toLocaleUpperCase('pt-BR'), s.slice(i + 1).trim()] : ['', s]; };
const descRica = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? html`<b>${s.slice(0, i).toLocaleUpperCase('pt-BR')}</b>${s.slice(i)}` : s; };
// Pessoas para escolher (responsável, observador, filtro): em ordem alfabética e sem as contas de administração (ex.: "Felipe Paiva (admin)"); quem já é responsável de uma tarefa continua aparecendo nela.
const ehConta = (p) => /\(admin\)/i.test(String(p.nome || ''));
const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { sensitivity: 'base' });
export const pessoasSelecionaveis = () => dados.pessoas.filter((p) => !ehConta(p)).sort(porNome);
const opcoesPessoas = (sel = '') => [...pessoasSelecionaveis(), ...dados.pessoas.filter((p) => ehConta(p) && p.id === sel)].map((p) => html`<option value="${p.id}" ${p.id === sel ? html.seguro('selected') : ''}>${p.nome}</option>`);

export const CATEGORIAS_TERC = ['Arquitetura', 'Ar-condicionado', 'Automação', 'ACM / fachada', 'Elétrica', 'Hidráulica', 'Iluminação', 'Esquadrias / vidros', 'Gesso / forro', 'Impermeabilização', 'Marcenaria', 'Marmoraria / pedras', 'Paisagismo', 'Pintura', 'Piscina', 'Revestimentos', 'Serralheria', 'Limpeza', 'Outro'];
const ROTULO_TIPO = { terceirizado: 'Terceirizado', cliente: 'Cliente', arquitetura: 'Arquitetura', outro: 'Externo' };
let sugestoesNomes = [];   // nomes de terceirizados já conhecidos (programações e pendências anteriores) para completar o campo
export const definirSugestoes = (lista) => { sugestoesNomes = lista; };
const nomesConhecidos = () => [...new Set([...sugestoesNomes, ...dados.pendencias.filter((p) => p.responsavel_tipo && p.responsavel_tipo !== 'solida' && p.responsavel_nome).map((p) => p.responsavel_nome)])].sort((x, y) => x.localeCompare(y, 'pt-BR'));

// Uma linha de pendência, tudo em uma linha: pendência · quem (Sólida, Terceirizado ou Cliente) · detalhe · prazo
// Sólida → escolhe a pessoa. Terceirizado → nome da empresa ou pessoa.
// Cliente → nome (opcional).
export function linhaForm(v = {}) {
  const tipo = v.responsavel ? 'solida' : (v.externoTipo === 'cliente' ? 'cliente' : (v.externoTipo === 'arquitetura' || v.externoCategoria === 'Arquitetura') ? 'arquitetura' : (v.externoTipo === 'terceirizado' || v.externoTipo === 'outro') ? 'terceirizado' : v.externoTipo === 'solida' ? 'solida' : '');   // sem tipo na ata: em branco, quem confere escolhe (nada de Sólida por padrão)
  const categoria = v.externoCategoria || (v.externoTipo === 'arquitetura' ? 'Arquitetura' : '');
  const nome = tipo === 'solida' ? '' : (v.externoNome || categoria || '');
  const falta = !!v.descricao && tipo === 'solida' && !v.responsavel;
  const dica = v.responsavelAmbiguo ? `Há mais de um ${v.responsavelAmbiguo}: escolha quem` : v.externoNome && v.externoTipo === 'solida' ? `${v.externoNome} não tem login no sistema: escolha outra pessoa` : 'Escolha o responsável';
  const info = v.kind === 'informativo';
  const [ass, resto] = dividirDescricao(v.descricao);
  return String(html`<div class="pf-linha" data-tipo="${tipo}" data-kind="${info ? 'informativo' : 'pendencia'}" data-pid="${v.pid || ''}"><select name="p_kind" data-pf-kind ${v.semKind ? html.seguro('hidden') : ''} title="Pendência vai para as pendências das pessoas; informativo só fica registrado na ata"><option value="pendencia" ${info ? '' : html.seguro('selected')}>Pendência</option><option value="informativo" ${info ? html.seguro('selected') : ''}>Informativo</option></select><input name="p_assunto" class="pf-assunto" placeholder="Assunto (ex.: ACM)" autocomplete="off" value="${ass}" title="Assunto: aparece em negrito"><input name="p_desc" placeholder="${info ? 'Informação (ex.: Fachada liberada)' : 'O que fazer (ex.: Retirar da área gourmet)'}" autocomplete="off" value="${resto}" title="${resto}">
    <select name="p_tipo" data-pf-tipo title="De onde é a pessoa: escolha para liberar o nome"><option value="" ${tipo === '' ? html.seguro('selected') : ''}>De onde é…</option><option value="solida" ${tipo === 'solida' ? html.seguro('selected') : ''}>Sólida</option><option value="terceirizado" ${tipo === 'terceirizado' ? html.seguro('selected') : ''}>Terceirizado</option><option value="cliente" ${tipo === 'cliente' ? html.seguro('selected') : ''}>Cliente</option><option value="arquitetura" ${tipo === 'arquitetura' ? html.seguro('selected') : ''}>Arquitetura</option></select>
    <select name="p_resp" class="pf-sol ${falta ? 'pf-falta' : ''}" title="${falta ? dica : ''}" ${tipo === 'solida' ? '' : html.seguro('hidden')}><option value="">Pessoa da Sólida…</option>${opcoesPessoas(v.responsavel || '')}</select>
    <input name="p_nome" class="pf-ext" list="dl-terceiros" placeholder="Nome da pessoa" autocomplete="off" value="${nome}" ${tipo === 'solida' ? html.seguro('hidden') : ''} ${tipo === '' ? html.seguro('disabled') : ''}>
    <input type="date" name="p_prazo" title="Prazo" value="${v.prazo || ''}"><button type="button" class="pf-x" data-pf-del title="Tirar esta linha">×</button><button type="button" class="pf-arrastar" draggable="true" data-pf-mover aria-label="Mudar a ordem desta linha" title="Arraste para mudar a ordem (ou use as setas ↑ ↓ do teclado)">⇅</button></div>`);
}
export const datalistTerceiros = () => html`<datalist id="dl-terceiros">${nomesConhecidos().map((n) => html`<option value="${n}">`)}</datalist>`;
const doEscopo = (p, setorFixo) => !setorFixo || /^po/i.test(p.obra || '') || (p.setor === setorFixo && !/^mo/i.test(p.obra || ''));   // escopo fixo (ex.: tela do Pós-obra): o setor, ou obras Po…
function filtrar(params, setorFixo = '') {
  const q = (params.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const pessoa = params.get('pessoa') || 'eu'; const setor = params.get('setor') || ''; const obra = params.get('obra') || '';
  const eu = souEu();
  return dados.pendencias.filter((p) => {
    if (p.status === 'cancelada' || !naLista(p) || !doEscopo(p, setorFixo)) return false;
    if (pessoa.startsWith('cat:')) { if (p.responsavel_categoria !== pessoa.slice(4)) return false; }
    else if (pessoa.startsWith('tipo:')) { if ((p.responsavel_tipo || 'solida') !== pessoa.slice(5)) return false; }
    else if (pessoa === 'sup') { if (!(p.gestores || []).includes(eu)) return false; }
    else if (pessoa === 'todos') { /* sem filtro de pessoa */ }
    else if (pessoa === 'eu' ? p.responsavel !== eu : pessoa && p.responsavel !== pessoa) return false;
    const terc = params.get('terc') || '';
    if (terc && (p.responsavel || (terc.startsWith('cat:') ? p.responsavel_categoria !== terc.slice(4) : p.responsavel_nome !== terc.slice(5)))) return false;
    if (setor && p.setor !== setor) return false;
    if (obra && codigoDaObra(p.obra) !== codigoDaObra(obra)) return false;
    if (q && !`${p.descricao} ${nomeDe(p.responsavel, p.responsavel_nome)} ${onde(p)} ${(ataDe(p) || {}).titulo || ''}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    return true;
  });
}

// só aparecem nos filtros as pessoas e os terceirizados que realmente têm pendência (senão a lista fica enorme)
// quem dá para escolher em "Ver tarefas de": o gestor escolhe quem responde a ele (estagiários e equipe do mesmo setor/obra, por gestores) e quem ele observa;
// a diretoria e o administrativo escolhem qualquer um. Quem é de cargo abaixo não enxerga o de cima, a não ser como observador.
const pessoasParaVer = () => {
  const f = funcaoAtual(); const eu = souEu();
  // diretoria e administrativo: todas as pessoas, tenham tarefa ou não
  if (['socio', 'administrativo'].includes(f.id)) return pessoasSelecionaveis().filter((x) => x.id !== eu);
  // os demais: quem responde a mim (gestores), quem eu observo e as pessoas do meu setor que são do meu cargo ou de cargo abaixo; nunca o cargo acima
  const ids = new Set(dados.pendencias.filter((p) => p.responsavel && p.responsavel !== eu && ((p.gestores || []).includes(eu) || (p.observadores || []).includes(eu))).map((p) => p.responsavel));
  const meus = meusSetores(); const meuNivel = NIVEL[f.id] ?? 3;
  for (const p of dados.pessoas) if (p.id !== eu && (NIVEL[p.funcao] ?? 3) >= meuNivel && (p.setores || []).some((s) => meus.includes(s))) ids.add(p.id);
  return pessoasSelecionaveis().filter((p) => ids.has(p.id));
};
// nível do cargo (0 = mais alto): quem é de nível abaixo não vê as tarefas do nível acima
const NIVEL = { socio: 0, administrativo: 1, coord_operacoes: 1, tecnico: 2, planejamento: 2, projetos: 2, compras: 2, ferramentas: 2, financeiro: 2, rh: 2, marketing: 3, gestor_obra: 3, posobra: 3, orc_terceirizado: 4, orc_obras_novas: 4, estagiario_compras: 4, estagiario_posobra: 4, executor_ferramentas: 4, estagiario: 4, encarregado: 5, ajudante: 6 };
const pessoasComPendencia = () => { const ids = new Set(dados.pendencias.filter((p) => naLista(p) && p.status !== 'cancelada' && p.responsavel).map((p) => p.responsavel)); return dados.pessoas.filter((p) => ids.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); };
// o campo "Terceirizado" aparece depois de escolher "Terceirizados (todos)" em Responsável: só nomes de empresa ou pessoa
// (sem tipo de serviço, para a lista não ficar enorme)
function seletorTerceirizado(atual) {
  const terc = dados.pendencias.filter((p) => naLista(p) && p.status !== 'cancelada' && !p.responsavel && p.responsavel_tipo !== 'cliente' && p.responsavel_tipo !== 'arquitetura');
  const nomes = [...new Set([...nomesConhecidos(), ...terc.map((p) => p.responsavel_nome)].filter((n) => n && !CATEGORIAS_TERC.includes(n)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return html`<label class="at-terc-sel">Terceirizado<select data-atas-filtro="terc"><option value="">Todos os terceirizados</option>
    ${nomes.map((n) => html`<option value="nome:${n}" ${atual === `nome:${n}` ? html.seguro('selected') : ''}>${n}</option>`)}</select></label>`;
}
// ---------------------------------------------------------------- telas
// Na caixinha de obra, sempre dois grupos: Obras (Mo…) e Pós-obras (os pós-obras ativos, PO… e os de nome)
// regra automática (pedido do Felipe): começa com Mo = obra (operação); começa com Po = pós-obra (maiúscula ou minúscula, tanto faz)
export const ehObraNormal = (o) => /^mo/i.test(String(o).trim());
// o código da obra (Mo531, Po577…) é o que vale para comparar: "PO531 - Aumento de carga" e "Po531" são a mesma obra
export const codigoDaObra = (o) => { const s = String(o || '').trim(); const m = s.match(/^(mo|po)\d+[a-z]?/i); return (m ? m[0] : s).toLowerCase(); };
// obras que aparecem nas pendências mas não têm código no cadastro (ex.: "PO - Alexandre"): entram na lista para dar para filtrar
export function obrasForaDoCadastro(codigos) {
  const tem = new Set(codigos.map(codigoDaObra)); const fora = new Map();
  for (const p of dados.pendencias) { if (p.status === 'cancelada' || !p.obra) continue; const k = codigoDaObra(p.obra); if (!tem.has(k) && !fora.has(k)) fora.set(k, p.obra); }
  return [...fora.values()];
}
const ehObraPura = ehObraNormal;
// Obras "em orçamento" (setor ORC Obras Novas e diretoria): ficam num grupo próprio na caixinha de obra e podem ser criadas ali mesmo
let OBRAS_ORC = new Set(); let NOMES_OBRAS = {};
export const definirObrasOrcamento = (codigos, nomes) => { OBRAS_ORC = new Set((codigos || []).map((c) => String(c).toLowerCase())); if (nomes) NOMES_OBRAS = nomes; };
// quem cadastra e edita obras: a diretoria e os setores ORC Obras Novas, Pós-obra e ORC Terceirizado Laranja (só a diretoria exclui)
export const SETORES_CADASTRO_OBRAS = ['ORC Obras Novas', 'Pós-obra', 'ORC Terceirizado Laranja'];
export const podeCriarObraOrcamento = () => NA_NUVEM && (funcaoAtual().id === 'socio' || meusSetores().some((s) => SETORES_CADASTRO_OBRAS.includes(s)));
export function gruposDeObras(obras, atual = '', { criar = false } = {}) {
  // sem repetir a mesma obra escrita de dois jeitos (Po577 / PO577 / PO577 - nome): vale a primeira
  const vistos = new Set(); const lista = [];
  for (const o of obras.filter(Boolean)) { const k = codigoDaObra(o); if (!vistos.has(k)) { vistos.add(k); lista.push(o); } }
  if (atual && !vistos.has(codigoDaObra(atual))) lista.push(atual);
  atual = lista.find((o) => codigoDaObra(o) === codigoDaObra(atual)) || atual;
  const opt = (o) => html`<option value="${o}" ${o === atual ? html.seguro('selected') : ''}>${o}</option>`;
  const emOrc = (o) => OBRAS_ORC.has(String(o).toLowerCase());
  const ob = lista.filter((o) => ehObraPura(o) && !emOrc(o)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })); const po = lista.filter((o) => !ehObraPura(o) && !emOrc(o)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const orc = lista.filter((o) => emOrc(o) && ehObraPura(o)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  // pós-obra é sempre pós-obra, mesmo que ainda esteja em orçamento; só as obras (Mo…) em orçamento ganham grupo próprio
  const posTodos = lista.filter((o) => !ehObraPura(o)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  return html`${ob.length ? html`<optgroup label="Obras">${ob.map(opt)}</optgroup>` : ''}${posTodos.length ? html`<optgroup label="Pós-obras">${posTodos.map(opt)}</optgroup>` : ''}${orc.length ? html`<optgroup label="Obras em orçamento">${orc.map(opt)}</optgroup>` : ''}${criar && podeCriarObraOrcamento() ? html`<optgroup label="Novo"><option value="__nova_orc__">+ Nova obra em orçamento…</option><option value="__novo_po__">+ Novo pós-obra…</option></optgroup>` : ''}`;
}
const selObra = (obras, atual, todos = 'Todos') => html`<label>Obra<select data-atas-filtro="obra"><option value="">${todos}</option>${gruposDeObras(obras, atual)}</select></label>`;
// Responsável: as opções de sempre no alto e, embaixo, o grupo "Equipe da Sólida" com cada pessoa (diretoria e administrativo escolhem qualquer uma; os demais, quem podem ver)
function seletorResponsavel(atual) {
  const op = ([v, t]) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`;
  const pessoas = pessoasParaVer();
  return html`<label>Responsável<select data-atas-filtro="pessoa"><option value="todos" ${atual === 'todos' ? html.seguro('selected') : ''}>Todos</option>
    ${[['eu', 'Só as minhas'], ['tipo:terceirizado', 'Terceirizados (todos)'], ['tipo:cliente', 'Clientes'], ['tipo:arquitetura', 'Arquitetura']].map(op)}
    <optgroup label="Equipe da Sólida">${op(['tipo:solida', 'Equipe da Sólida (todos)'])}${pessoas.map((x) => op([x.id, x.nome]))}</optgroup></select></label>`;
}
function barraFiltros(params, obras, aba, ctx = {}) {
  const base = ctx.base || '#/atas';
  const sel = (nome, rotulo, opcoes, atual) => html`<label>${rotulo}<select data-atas-filtro="${nome}"><option value="">Todos</option>${opcoes.map(([v, t]) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>`;
  const vista = params.get('vista') === 'lista' ? 'lista' : 'prazo';
  return html`<div class="at-filtros">
    ${aba === 'atas' ? '' : seletorResponsavel(params.get('pessoa') || 'eu')}
    ${ctx.setorFixo ? '' : sel('setor', 'Setor', SETORES_ATA.map((s) => [s, s]), params.get('setor') || '')}
    ${selObra(obras, params.get('obra') || '')}
    <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="texto…"></label>
    ${aba === 'atas' ? '' : html`<label>Ordenar por<select data-atas-filtro="ord"><option value="">Padrão</option>${[['prioridade', 'Prioridade'], ['data', 'Data'], ['assunto', 'Assunto'], ['responsavel', 'Responsável']].map(([v, t]) => html`<option value="${v}" ${params.get('ord') === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>`}
  </div>`;
}

// reprogramar: o prazo pode mudar, mas fica guardado o prazo original e cada troca (a pendência vira "reprogramada")
const reprogramada = (p) => !!p.prazo_original && p.prazo_original !== p.prazo;
const tituloRepro = (p) => `Prazo original ${dm(p.prazo_original)}${(p.reprogramacoes || []).length ? ` · ${(p.reprogramacoes || []).length} ${(p.reprogramacoes || []).length === 1 ? 'reprogramação' : 'reprogramações'}: ${(p.reprogramacoes || []).map((r) => `${dm(r.de)} → ${dm(r.para)}${r.por ? ` (${r.por})` : ''}`).join('; ')}` : ''}`;
// clicar na data abre o mini calendário (com feriados) para reprogramar; só nas pendências abertas
const prazoBtn = (p, conteudo, cls = '') => (p.status === 'feita' ? html`<span class="${cls}">${conteudo}</span>` : html`<button type="button" class="at-data-btn ${cls}" data-cal-prazo="${p.id}" title="Clique para reprogramar (escolher outra data)">${conteudo}</button>`);
const naLista = (p) => p.na_lista !== false;   // false = tirada da lista de pendências (continua só na ata)
export const pendenciaPorId = (id) => dados.pendencias.find((x) => String(x.id) === String(id));
export async function reprogramar(id, novo) {
  const p = dados.pendencias.find((x) => String(x.id) === String(id)); if (!p || (novo || '') === (p.prazo || '')) return;
  const mud = { prazo: novo || null, prazo_original: p.prazo_original || p.prazo || null, reprogramacoes: [...(p.reprogramacoes || []), { de: p.prazo || null, para: novo || null, em: new Date().toISOString(), por: sessao().nome || '' }] };
  if (!p.prazo || !novo) { mud.prazo_original = p.prazo_original || null; mud.reprogramacoes = p.reprogramacoes || []; }   // dar a primeira data (ou tirar o prazo) não é reprogramação
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}

function cartao(p, hoje) {
  const a = ataDe(p); const col = coluna(p, hoje);
  const dias = p.prazo ? diasEntre(hoje, p.prazo) : null;
  const rotuloPrazo = !p.prazo ? 'Sem prazo' : col === 'vencido' ? `${dm(p.prazo).slice(0, 5)} · ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} de atraso` : col === 'hoje' ? 'Hoje' : dm(p.prazo);
  const onde2 = p.obra || p.setor || '';   // se tem obra aparece a obra; senão, o setor
  return html`<article class="at-card at-${col}" data-tarefa="${p.id}" draggable="true" title="Clique para ver os detalhes · clique no nome para editá-lo aqui mesmo · arraste para mudar o prazo">
    <div class="at-tit" title="Clique para editar o nome da tarefa">${descRica(p.descricao)}</div>
    <div class="at-linha2"><span class="at-esq">${prazoBtn(p, rotuloPrazo, `at-prazo at-p-${col}`)}</span><span class="at-dir">${p.urgencia ? chipUrg(p.urgencia) : ""}</span></div>
    <div class="at-linha3"><span class="at-esq"><span class="at-pessoa">${nomeDe(p.responsavel, p.responsavel_nome)}</span>${p.responsavel_tipo && p.responsavel_tipo !== 'solida' ? html`<span class="at-tipo at-t-${p.responsavel_tipo}">${ROTULO_TIPO[p.responsavel_tipo] || 'Externo'}${p.responsavel_categoria ? ` · ${p.responsavel_categoria}` : ''}</span>` : ''}</span><span class="at-dir">${onde2 ? html`<span class="at-chip">${onde2}</span>` : ''}</span></div>
    ${a ? html`<div class="at-linha4"><a class="at-ata" href="#/atas?aba=atas&ata=${a.id}" title="Ata de origem">ata ${dm(a.data).slice(0, 5)}</a></div>` : ''}
    <div class="at-acoes">
      ${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺ reabrir</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`}
      <button type="button" class="ac-mini" data-pend-del="${p.id}" title="${p.ata_id ? 'Tirar da lista de pendências (o item continua na ata)' : 'Excluir esta pendência'}">${p.ata_id ? 'tirar da lista' : 'excluir'}</button>
    </div></article>`;
}

// prazo sugerido ao criar uma pendência pela caixinha (pendência nem sempre vem de uma ata)
function prazoDaColuna(id, hoje) {
  const seg = inicioDaSemana(hoje);
  if (id === 'hoje') return hoje;
  if (id === 'semana') { const sex = somarDias(seg, 4); return sex >= hoje ? sex : somarDias(seg, 6); }
  if (id === 'proxima') return somarDias(seg, 11);
  if (id === 'duas') return somarDias(seg, 18);
  return '';
}
// formulário de pendência avulsa (sem ata): janela com rótulos e grade organizada
// Nova tarefa: o MESMO cartão da janela da tarefa (formulário à esquerda, anotações à direita), com os obrigatórios marcados em vermelho e o botão "Criar tarefa".
// Os nomes dos campos (p_*, av_obra, av_setor) são os de sempre: quem grava é o mesmo código das pendências avulsas.
// PRÉVIA (16/11/2026): "Reunião" na criação de tarefa, só para o administrador (conta "(admin)" na nuvem; no teste local sempre). Ainda não grava nada.
export const reuniaoLiberada = () => !NA_NUVEM || /\(admin\)|^felipe paiva/i.test((perfilAtual() && perfilAtual().nome) || '');
const somaHora = (hhmm, min) => { const [h, m] = String(hhmm || '08:30').split(':').map(Number); const t = (h * 60 + (m || 0) + min) % (24 * 60); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function painelReuniao(prazo, hora, obras = [], setorPadrao = '') {
  const ini = hora || '08:30'; const pessoas = pessoasSelecionaveis();
  return html`<div class="tf-reuniao">
    <div class="rn-grade">
      <label>Obra ou pós-obra<select name="r_obra" class="tf-req"><option value="">— escolher —</option><option value="__nenhuma__">Nenhuma (reunião de departamento)</option>${gruposDeObras(obras, '', { criar: false })}</select></label>
      <label>Departamento<select name="r_setor" class="tf-req"><option value="">— escolher (obrigatório sem obra) —</option>${SETORES_ATA.map((s) => html`<option ${s === setorPadrao ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
    </div>
    <div class="rn-titulo-wrap"><span class="rn-prefixo" data-rn-prefixo title="Parte automática do nome da reunião">R_…_</span><input name="r_titulo" class="rn-titulo" placeholder="título da reunião" autocomplete="off"></div>
    <div class="rn-linha"><i aria-hidden="true">🕐</i><div class="rn-quando"><input type="date" name="r_data" value="${prazo || ''}"><input type="time" name="r_ini" value="${ini}"><span>até</span><input type="time" name="r_fim" value="${somaHora(ini, 60)}" min="${somaHora(ini, 60)}"><span class="rn-dica">mínimo 1 hora</span></div></div>
    <div class="rn-linha"><i aria-hidden="true">🔁</i><div class="rn-recor"><label><input type="checkbox" name="r_recor"> Reunião recorrente</label><select name="r_freq" title="Como se repete"><option value="semanal">Toda semana</option><option value="mensal">Todo mês</option></select></div></div>
    <div class="rn-linha rn-conv"><i aria-hidden="true">👥</i><div class="rn-col">${caixaConvidados(pessoas)}<label class="rn-sem"><input type="checkbox" name="r_sem_conv"> Sem convidados</label></div></div>
    <div class="rn-linha"><i aria-hidden="true">📍</i><input name="r_local" placeholder="Local da reunião (obrigatório)" autocomplete="off"></div>
    <div class="rn-linha"><i aria-hidden="true">🎥</i><label class="rn-meet-chk"><input type="checkbox" name="r_meet" checked> Reunião online: criar o link do Google Meet <span class="pequeno">(desmarque se for só presencial)</span></label></div>
    <p class="rn-aviso" hidden data-rn-erro></p>
    <p class="rn-aviso">A reunião é criada aqui e o sistema a leva sozinho para o Google Agenda do sistema, que convida as pessoas. Edite sempre por aqui.</p>
    <div class="tf-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="button" class="botao on" data-reun-salvar>Salvar reunião</button></div>
  </div>`;
}
export function formAvulsa(obras, prazo, setorPadrao = '', preset = {}) {
  const listaObras = preset.obra && !obras.includes(preset.obra) ? [preset.obra, ...obras] : obras;
  return html`<div class="tf tf-nova"><div class="tf-corpo">
    <form class="at-nova-pend at-avulsa tf-esq" id="pend-form" data-avulsa="1" data-os="${preset.os || ''}" data-os-fase="${preset.osFase || ''}" autocomplete="off">
      <div class="tf-cab"><h3>${preset.os ? 'Nova pendência da OS' : 'Nova tarefa'}</h3>${preset.os ? html`<span class="at-chip">${preset.os}</span>` : ''}<span class="pequeno">O que tem a borda vermelha precisa ser preenchido.</span></div>
      ${reuniaoLiberada() && !preset.os ? html`<div class="tf-modo" role="tablist"><button type="button" class="on" role="tab" data-tf-modo="tarefa">Tarefa</button><button type="button" role="tab" data-tf-modo="reuniao">Reunião <small>prévia</small></button></div>` : ''}
      <div class="tf-grade pf-linha av-linha" data-tipo="solida" data-kind="pendencia">
        <div class="av-obra-linha"><label>Obra<select name="av_obra" class="tf-req" required><option value="">— escolher —</option><option value="__nenhuma__" ${preset.obra ? '' : ''}>Nenhuma obra (tarefa geral)</option>${gruposDeObras(listaObras, preset.obra || '', { criar: true })}</select></label>
        ${preset.os ? '' : html`<label class="av-os tf-os" hidden>OS em aberto deste PO<select name="av_os"><option value="">— escolher a OS —</option></select></label>`}</div>
        <label class="tf-ass">${preset.os ? 'Assunto (a OS)' : 'Assunto / cômodo'}<input name="p_assunto" class="pf-assunto" placeholder="ex.: ACM" autocomplete="off" value="${preset.os || preset.assunto || ''}" ${preset.os ? html.seguro('readonly') : ''}></label>
        <label class="tf-desc">${preset.os ? 'Descrição (o que fazer)' : 'Título (o que fazer)'}<input name="p_desc" class="tf-req" placeholder="ex.: Retirar da área gourmet" autocomplete="off" value="${preset.desc || ''}"></label>
        <label>Responsável<select name="p_tipo" class="tf-req" data-pf-tipo><option value="solida">Sólida</option><option value="terceirizado">Terceirizado</option><option value="cliente">Cliente</option><option value="arquitetura">Arquitetura</option></select></label>
        <label class="av-quem">Quem
          <select name="p_resp" class="pf-sol tf-req"><option value="">Pessoa da Sólida…</option>${opcoesPessoas(preset.resp || '')}</select>
          <input name="p_nome" class="pf-ext tf-req" list="dl-terceiros" placeholder="Nome da empresa ou pessoa" autocomplete="off" hidden></label>
        <label>Departamento<select name="av_setor" class="tf-req" required><option value="">— escolher —</option>${SETORES_ATA.map((s) => html`<option value="${s}" ${s === setorPadrao ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
        <label>Prazo<input type="date" name="p_prazo" class="tf-req" value="${prazo || ''}"></label>
        <label>Horário na Agenda<input type="time" name="p_hora" value="${preset.hora || ''}"></label>
        <label>Duração<select name="p_dur"><option value="">Padrão</option>${[30, 60, 90, 120, 180, 240].map((m) => html`<option value="${m}" ${String(preset.dur || '') === String(m) ? html.seguro('selected') : ''}>${m >= 60 ? `${m / 60}h${m % 60 ? m % 60 : ''}`.replace(/^(\d+)h$/, '$1 h') : `${m} min`}</option>`)}</select></label>
        <div class="tf-recor"><label class="tf-recor-chk"><input type="checkbox" name="p_recor"> <span>Tarefa recorrente</span></label><select name="p_freq" title="Como se repete"><option value="semanal">Toda semana</option><option value="mensal">Todo mês</option></select></div>
        <div class="tf-sep"></div>
        <label>Função (Agenda)<select name="p_func"><option value="">Nenhuma</option>${opcoesFuncaoTarefa(souEu(), '')}</select></label>
        <label>Urgência<select name="p_urg"><option value="">Sem urgência</option>${Object.entries(URG).map(([v, [t]]) => html`<option value="${v}">${t[0] + t.slice(1).toLocaleLowerCase('pt-BR')}</option>`)}</select></label>
        ${caixaObservadores('p_obs', [], '')}
      </div>
      <div class="tf-botoes tf-botoes-tarefa"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar tarefa</button></div>
      ${reuniaoLiberada() && !preset.os ? painelReuniao(prazo, preset.hora, listaObras, setorPadrao) : ''}
    </form>
    <div class="tf-chat tf-dir"><h4>Anotações</h4><p class="pequeno">As anotações ficam disponíveis depois que a tarefa for criada.</p></div>
  </div></div>`;
}
function vistaPrazo(lista, hoje, setorPadrao = '') {
  return html`<div class="at-quadro">${COLUNAS.map(([id, nome]) => {
    let itens = lista.filter((p) => coluna(p, hoje) === id);
    if (id === 'concluido') itens = itens.sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 30);
    const pz = prazoDaColuna(id, hoje);
    return html`<section class="at-col at-c-${id}" data-col="${id}"><header><b>${nome}</b><span>${lista.filter((p) => coluna(p, hoje) === id).length}</span>${pz ? html`<button type="button" class="at-col-mais" data-av-nova="${pz}" data-av-setor="${setorPadrao}" title="Nova pendência com prazo ${dm(pz)}">+</button>` : ''}</header>
      <div class="at-itens">${itens.map((p) => cartao(p, hoje))}</div></section>`;
  })}</div>`;
}

function vistaLista(lista, hoje, params) {
  const st = params.get('status') || 'abertas';
  const itens = lista.filter((p) => (st === 'todas' ? true : st === 'feitas' ? p.status === 'feita' : p.status === 'aberta'));
  return html`<div class="at-lista-topo"><label>Mostrar<select data-atas-filtro="status"><option value="abertas" ${st === 'abertas' ? html.seguro('selected') : ''}>Abertas</option><option value="feitas" ${st === 'feitas' ? html.seguro('selected') : ''}>Concluídas</option><option value="todas" ${st === 'todas' ? html.seguro('selected') : ''}>Todas</option></select></label></div>
    <div class="tabela-rolagem"><table class="tab ordenavel at-tab"><thead><tr><th>Pendência</th><th>Responsável</th><th>Gestor</th><th>Prazo</th><th>Obra / setor</th><th>Ata</th><th>Situação</th><th></th></tr></thead><tbody>
      ${itens.map((p) => { const col = coluna(p, hoje); const a = ataDe(p); return html`<tr><td>${descRica(p.descricao)}</td><td>${nomeDe(p.responsavel, p.responsavel_nome)}</td><td>${p.gestores_nome || ''}</td>
        <td class="${col === 'vencido' ? 'pendente' : ''}">${prazoBtn(p, p.prazo ? dm(p.prazo) : html`<span class="muted">sem prazo</span>`)}${reprogramada(p) ? html` <span class="at-repro-tag" title="${tituloRepro(p)}">↻ era ${dm(p.prazo_original).slice(0, 5)}</span>` : ''}</td><td>${onde(p)}</td>
        <td>${a ? html`<a class="link" href="#/atas?aba=atas&ata=${a.id}">${dm(a.data).slice(0, 5)}</a>` : ''}</td>
        <td>${p.status === 'feita' ? 'Concluída' : col === 'vencido' ? 'Atrasada' : 'Aberta'}</td>
        <td class="at-acoes">${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`} <button type="button" class="ac-mini" data-pend-del="${p.id}" title="${p.ata_id ? 'Tirar da lista de pendências (o item continua na ata)' : 'Excluir esta pendência'}">${p.ata_id ? 'tirar da lista' : 'excluir'}</button></td></tr>`; })}
    </tbody></table></div>${itens.length ? '' : html`<p class="vazio">Nenhuma pendência com esses filtros.</p>`}`;
}

function listaAtas(params, obras) {
  const obra = params.get('obra') || ''; const setor = params.get('setor') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  const atas = dados.atas.filter((a) => (!obra || a.obra === obra) && (!setor || a.setor === setor) && (!q || `${a.titulo} ${a.resumo} ${onde(a)}`.toLocaleLowerCase('pt-BR').includes(q)));
  return html`${atas.length ? html`<div class="at-atas">${atas.map((a) => {
    const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada'); const ab = ps.filter((p) => p.status === 'aberta').length;
    return html`<a class="at-ata-card" href="#/atas?aba=atas&ata=${a.id}"><b>${a.titulo}</b><span class="pequeno">${dm(a.data)} · ${onde(a) || 'sem vínculo'}${a.criado_por_nome ? ` · por ${a.criado_por_nome}` : ''}</span>
      <span class="at-contagem ${ab ? 'tem' : ''}">${ps.length ? `${ab} aberta${ab === 1 ? '' : 's'} de ${ps.length}` : 'sem pendências'}</span></a>`; })}</div>` : html`<p class="vazio">Nenhuma ata ainda. Crie a primeira em "Nova ata".</p>`}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dMes = (iso) => (iso ? `${iso.slice(8, 10)}/${MESES[Number(iso.slice(5, 7)) - 1]}` : '');
// participantes no padrão da Sólida: "Nome" em preto e "(papel)" em cinza
const participantesRico = (lista) => (lista && lista.length ? lista.map((t, i) => { const m = String(t).match(/^(.*?)\s*(\(.*\))\s*$/); return html`${i ? ', ' : ''}${m ? html`${m[1]} <span class="sd-papel">${m[2]}</span>` : t}`; }) : '—');
// itens da ata na ordem em que foram lançados (pendências e informativos misturados, como na ata da Sólida)
function linhasDaAta(a, ps) {
  const itens = [...ps.map((p, i) => ({ kind: 'pend', p, n: Number(p.item) || 0, i })), ...((a.informativos || []).map((x, i) => ({ kind: 'info', x, n: (x && x.n) || 0, i: 1000 + i })))];
  return itens.sort((x, y) => ((x.n || 1e6) - (y.n || 1e6)) || (x.i - y.i));
}
function detalheAta(id, hoje, obras) {
  const a = dados.atas.find((x) => String(x.id) === String(id));
  if (!a) return html`<p class="vazio">Ata não encontrada (ou você não tem acesso a ela). <a class="link" href="#/atas?aba=atas">Voltar às atas</a></p>`;
  const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada');
  const podeApagar = funcaoReal().id === 'socio' || a.criado_por === souEu();
  return html`<p class="at-voltar"><a class="link" href="#/atas?aba=atas">← Todas as atas</a> <button type="button" class="botao on at-imprimir" data-imprimir="" title="Imprimir esta ata (ou salvar em PDF)">🖨 Imprimir ata</button></p>
    <article class="at-ata-det">
      <h2>${a.titulo}</h2>
      <p class="pequeno at-drive ${a.arquivada_em ? 'ok' : a.arquivo_erro ? 'erro' : ''}">${a.arquivada_em ? html`✓ Salva no Drive (${new Date(a.arquivada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}): ${a.arquivo || a.titulo + '.pdf'}` : a.arquivo_erro ? html`Não consegui salvar no Drive: ${a.arquivo_erro}. Vou tentar de novo no próximo ciclo.` : a.obra ? 'Aguardando ser salva no Drive (o computador do escritório salva a cada 10 minutos).' : 'Ata sem obra: fica só no sistema.'}${a.criado_por_nome ? ` Registrada por ${a.criado_por_nome}.` : ''}</p>
      ${(() => { const ac = acompanhamento(a); return ac.total ? html`<p class="at-acomp"><b>Acompanhamento:</b> ${ac.feitas} de ${ac.total} pendências concluídas${ac.atrasadas ? html` · <span class="pendente">${ac.atrasadas} ${ac.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}${ac.reprogramadas ? ` · ${ac.reprogramadas} ${ac.reprogramadas === 1 ? 'reprogramada' : 'reprogramadas'}` : ''}</p>` : ''; })()}
      ${a.resumo ? html`<div class="at-resumo">${textoRico(a.resumo)}</div>` : ''}
      <div class="sd-folha">
        <div class="sd-cab">
          <div class="sd-logo"></div>
          <div class="sd-tit">ATA DE REUNIÃO ${dm(a.data).replace(/\//g, '.')}</div><div class="sd-cod">${a.obra || a.setor || ''}</div><div class="sd-cod">R${String(Number(a.revisao) || 0).padStart(2, '0')}</div>
          <div class="sd-linha"><b>LOCAL:</b> ${a.local || '—'}${a.setor ? html` · <b>DEPARTAMENTO:</b> ${a.setor}` : ''}</div>
          <div class="sd-linha"><b>PARTICIPANTES:</b> ${participantesRico(a.participantes)}</div>
        </div>
        <div class="tabela-rolagem"><table class="sd-tab"><thead><tr><th>ITEM</th><th>TIPO</th><th></th><th>RESPONSÁVEL</th><th>DATA LIMITE</th><th class="sd-sem-pdf"></th></tr></thead><tbody>
          ${linhasDaAta(a, ps).map((r, k) => r.kind === 'info' ? html`<tr><td class="c">${k + 1}</td><td class="c sd-t-info">INFORMATIVO</td><td>${descRica(typeof r.x === 'string' ? r.x : r.x.texto)}</td><td class="c">${typeof r.x === 'string' || !r.x.quem ? '—' : html`${String(r.x.quem).toLocaleUpperCase('pt-BR')}${r.x.tipo && r.x.tipo !== 'solida' ? html`<small>${ROTULO_TIPO[r.x.tipo] || 'Externo'}${r.x.categoria ? ` · ${r.x.categoria}` : ''}</small>` : ''}`}</td><td class="c"></td><td class="sd-sem-pdf"></td></tr>`
            : html`<tr class="${r.p.status === 'feita' ? 'sd-feita' : ''}"><td class="c">${k + 1}</td><td class="c sd-t-pend">PENDÊNCIA</td><td>${descRica(r.p.descricao)}${naLista(r.p) ? '' : html` <span class="at-fora-lista" title="Tirada da lista de pendências; continua nesta ata">fora da lista</span>`}</td><td class="c">${String(nomeDe(r.p.responsavel, r.p.responsavel_nome)).toLocaleUpperCase('pt-BR')}${r.p.responsavel_tipo && r.p.responsavel_tipo !== 'solida' ? html`<small>${ROTULO_TIPO[r.p.responsavel_tipo] || 'Externo'}${r.p.responsavel_categoria ? ` · ${r.p.responsavel_categoria}` : ''}</small>` : ''}</td>
              <td class="c ${reprogramada(r.p) ? 'sd-repro' : ''}" ${reprogramada(r.p) ? html.seguro(`title="${tituloRepro(r.p).replace(/"/g, '')}"`) : ''}>${prazoBtn(r.p, r.p.prazo ? dMes(r.p.prazo) : '—')}${reprogramada(r.p) ? html`<small>↻ era ${dMes(r.p.prazo_original)}</small>` : ''}</td>
              <td class="sd-sem-pdf at-acoes">${r.p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${r.p.id}|aberta">↺</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${r.p.id}|feita" title="Concluir">✓</button>`}${naLista(r.p) ? '' : html`<button type="button" class="ac-mini" data-pend-lista="${r.p.id}" title="Voltar esta pendência para a lista de pendências">+ lista</button>`}</td></tr>`)}
        </tbody></table></div>
      </div>
      ${podeApagar ? html`<p style="margin-top:18px"><a class="botao on" href="#/atas?aba=nova&revisar=${a.id}">Criar revisão ${rev2((Number(a.revisao) || 0) + 1)}</a> <button type="button" class="botao" data-pauta="${a.id}">Pauta da próxima reunião</button> <button type="button" class="botao at-excluir" data-ata-del="${a.id}">Excluir esta ata e as pendências dela</button></p>` : ''}
    </article>`;
}

function formNova(obras, revisarId = '') {
  const hoje = hojeISO();
  const ataRev = revisarId ? ataPorId(revisarId) : null;
  if (revisarId && !ataRev) return html`<p class="vazio">Ata não encontrada. <a class="link" href="#/atas?aba=atas">Voltar às atas</a></p>`;
  const r = ataRev ? ataComoRascunho(ataRev) : rascunho;
  const proxRev = ataRev ? (Number(ataRev.revisao) || 0) + 1 : 0;
  const linhasIniciais = r && (r.pendencias.length || (r.informativosLista || []).length) ? [...r.pendencias, ...(r.informativosLista || [])].sort((x, y) => (Number(x.item) || 0) - (Number(y.item) || 0)).map((p) => linhaForm(p)).join('') : linhaForm();
  const importador = html`<details class="caixa at-importar"><summary><span class="caixa-tit">Importar uma ata pronta ou colar a transcrição</span><span class="pequeno">envie PDF/texto, ou cole a transcrição: eu leio e separo informativos e pendências</span></summary>
    <div class="caixa-corpo">
      <div class="at-gravar">
        <h4>Colar a transcrição da reunião</h4>
        <p class="pequeno">Cole abaixo a transcrição (de outro programa ou do computador do escritório) e aperte "Montar a ata": o sistema separa o que é pendência (ação, responsável e prazo) do que é informativo. É uma leitura automática: depois você confere e corrige cada linha.</p>
        <label>Transcrição colada<textarea id="ata-fala" rows="6" placeholder="Cole aqui a transcrição da reunião"></textarea></label>
        <p><button type="button" class="botao" data-ata-ler-fala>Montar a ata com a transcrição</button></p>
      </div>
      <h4>Importar uma ata pronta</h4>
      <p class="pequeno">Envie o PDF (ou um arquivo de texto) da ata, ou cole o texto abaixo. O sistema acha o título, a data, a obra, os participantes e as linhas que são ação (verbo no infinitivo, "responsável:", "prazo:", itens sob "Ações" ou "Pendências"), com responsável pelo primeiro nome e prazo. Depois você confere tudo e salva. PDF de foto ou digitalização não tem texto para ler: cole o texto.</p>
      <div class="at-imp-linha"><label class="botao">Escolher arquivo<input type="file" id="ata-arquivo" accept=".pdf,.txt,.md,.text,.csv,application/pdf,text/*" hidden></label><span class="pequeno at-imp-msg"></span></div>
      <label>…ou cole o texto da ata<textarea id="ata-colada" rows="5" placeholder="Cole aqui o texto da ata"></textarea></label>
      <p><button type="button" class="botao" data-ata-ler>Ler o texto colado</button></p>
    </div></details>`;
  return html`${ataRev ? html`<p><a class="link" href="#/atas?aba=atas&ata=${ataRev.id}">← Voltar à ata sem mudar nada</a></p><div class="aviso at-aviso-imp"><b>Criando a revisão ${rev2(proxRev)}</b> da ata ${ataRev.titulo}. Mexa no que precisar: dados da reunião, participantes, e acrescente, tire ou edite pendências e informativos. As pendências que você mantiver continuam as mesmas (com o andamento e as reprogramações); as que você tirar saem da lista de pendências. O PDF novo vai para o Drive com o nome ${rev2(proxRev)}; o anterior continua lá.</div>` : importador}
  ${r && !ataRev && r.deFala ? html`<p class="aviso at-aviso-imp">Reunião lida: encontrei <b>${r.pendencias.length}</b> ${r.pendencias.length === 1 ? 'pendência' : 'pendências'} e <b>${(r.informativosLista || []).length}</b> ${(r.informativosLista || []).length === 1 ? 'informativo' : 'informativos'}. É uma leitura automática: confira o tipo (pendência ou informativo), o assunto, o responsável e o prazo de cada linha, tire o que não serve e preencha obra, departamento, local e participantes. <button type="button" class="ac-mini" data-ata-descartar>descartar e começar do zero</button></p>` : ''}
  ${r && !ataRev && !r.deFala ? html`<p class="aviso at-aviso-imp">Ata lida${r.lidoDaTabela ? ' (padrão de ata da Sólida)' : ''}: encontrei <b>${r.pendencias.length}</b> ${r.pendencias.length === 1 ? 'pendência' : 'pendências'}${r.informativos ? `, mais ${r.informativos} informativo${r.informativos === 1 ? '' : 's'} que entraram como informativo (não viram pendência de ninguém)` : ''}${r.pendencias.some((p) => !p.responsavel && !p.externoNome) ? ', algumas sem responsável (em destaque)' : ''}. Confira, corrija o que precisar e salve. <button type="button" class="ac-mini" data-ata-descartar>descartar e começar do zero</button></p>` : ''}
  <form class="at-form" id="ata-form" ${ataRev ? html.seguro(`data-revisar="${ataRev.id}" data-revisao="${proxRev}"`) : ''}>
    <div class="at-form-grade">
      <label>Data<input type="date" name="data" value="${r ? r.data : hoje}" required></label>
      <label>Tipo da reunião<select name="tipo_reuniao">${TIPOS_REUNIAO.map((x) => html`<option ${(r && r.tipoReuniao ? r.tipoReuniao : 'REUNIÃO') === x ? html.seguro('selected') : ''}>${x}</option>`)}</select></label>
      <input name="revisao" type="hidden" value="${proxRev}">
      <label>Obra<select name="obra" required><option value="">— escolher —</option><option value="-" ${ataRev && !ataRev.obra ? html.seguro('selected') : ''}>Nenhuma</option>${gruposDeObras(obras, (r && r.obra) || '', { criar: true })}</select></label>
      <label>Departamento<select name="setor" required><option value="">— escolher —</option>${SETORES_ATA.map((s) => html`<option value="${s}" ${r && r.setor === s ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
    </div>
    <p class="at-nome-linha">Nome da ata: <b id="ata-nome">escolha a data</b> <span class="pequeno" id="ata-destino"></span></p>
    <div class="at-form-grade2"><label>Local<input name="local" required autocomplete="off" placeholder="ex.: online, ou o endereço" value="${r && r.local ? r.local : ''}"></label></div>
    <label>Participantes <span class="pequeno">escreva os nomes separados por vírgula; pode pôr a empresa entre parênteses</span><input name="participantes" required autocomplete="off" placeholder="ex.: Marcos (Sólida), Fernanda (Arquitetura), Julio (Cliente)" value="${r ? r.participantes.join(', ') : ''}"></label>
    <textarea name="resumo" hidden>${r ? r.resumo : ''}</textarea>
    <h3>Pendências <span class="pequeno">o que precisa de ação: quem faz e até quando</span></h3>
    <div id="pend-linhas">${html.seguro(linhasIniciais)}</div>
    <p><button type="button" class="ac-mini" data-pf-add>+ outro item</button></p>
    <p style="margin-top:14px"><button type="submit" class="botao on">${ataRev ? `Salvar revisão ${rev2(proxRev)}` : 'Salvar ata'}</button> <span class="pequeno at-msg"></span></p>
  </form>`;
}
// quadro de pendências (cartões + filtros + quadro por prazo ou lista); a tela do Pós-obra usa o mesmo, só com o setor dela
// ================================================================ Modo Lista (pedido do Felipe, 10/11/2026)
// As tarefas do dia em forma de lista: um bloco "Geral" (sem obra) e um por obra; dia anterior / seguinte; filtros de responsável,
// setor, obra e urgência. A pessoa já está logada: por padrão vê só as dela, e pode escolher ver as do estagiário ou de todos.
// funções (grupos do quadro) do cargo de quem é o responsável da tarefa; a que já está gravada sempre aparece
const opcoesFuncaoTarefa = (respId, atual) => {
  // "Ver como" (diretoria olhando como outro cargo): tudo vale como esse cargo, inclusive as funções que aparecem para escolher
  const cargo = simulando() || respId === souEu() ? funcaoAtual().id : ((dados.pessoas.find((x) => x.id === respId) || {}).funcao || funcaoAtual().id);
  const lista = [...funcoesDoCargo(cargo), FUNCAO_OUTRAS]; if (atual && !lista.includes(atual)) lista.unshift(atual);
  return lista.map((g) => html`<option value="${g}" ${g === atual ? html.seguro('selected') : ''}>${g === FUNCAO_OUTRAS ? 'Fora da função' : g}</option>`);
};
// Ligar a tarefa a uma função é opcional ao criar, mas OBRIGATÓRIO ao concluir (senão não conta nas funções da pessoa). "Fora da função" = fora do quadro de funções.
export const FUNCAO_OUTRAS = 'Fora da função';
// a função da tarefa deixou de ser obrigatória ao concluir (pedido do Felipe, 12/11/2026): ela continua opcional na janela da tarefa
export const precisaFuncao = () => false;
export async function definirFuncaoTarefa(id, funcao) {
  const mud = { funcao_tarefa: funcao || null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}
export function formFuncaoConcluir(id) {
  const p = pendenciaPorId(id); if (!p) return html`<p class="erro">Não achei esta tarefa.</p>`;
  const [ass, resto] = dividirDescricao(p.descricao);
  return html`<form class="at-nova-pend at-avulsa" id="fn-conc" data-id="${p.id}">
    <h3>Em qual função esta tarefa conta?</h3>
    <p class="pequeno at-av-sub"><b>${ass ? `${ass}: ` : ''}${resto}</b><br>Para concluir, a tarefa precisa estar ligada a uma função da Agenda; é assim que ela conta nas suas funções. Se não é de nenhuma, escolha "Fora da função".</p>
    <div class="at-av-grade"><label class="av-m" style="grid-column:1/-1">Função<select name="funcao" required><option value="">— escolher —</option>${opcoesFuncaoTarefa(p.responsavel, '')}</select></label></div>
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Concluir a tarefa</button></div></form>`;
}
export const URG = { alta: ['ALTA', 'urg-alta'], media: ['MÉDIA', 'urg-media'], baixa: ['BAIXA', 'urg-baixa'] };
const chipUrg = (u) => (URG[u] ? html`<span class="lt-urg ${URG[u][1]}"><i></i>${URG[u][0]}</span>` : '');
// ordenação das tarefas (lista e tabela): assunto, prioridade (urgência), responsável ou data; sem escolha, a ordem de sempre
const assuntoDe = (p) => dividirDescricao(p.descricao)[0] || String(p.descricao || '');
const pesoUrg = (p) => ({ alta: 0, media: 1, baixa: 2 }[p.urgencia] ?? 3);
export function comparador(ord) {
  return {
    assunto: (x, y) => assuntoDe(x).localeCompare(assuntoDe(y), 'pt-BR'),
    prioridade: (x, y) => pesoUrg(x) - pesoUrg(y) || String(x.prazo || '9').localeCompare(String(y.prazo || '9')),
    responsavel: (x, y) => String(nomeDe(x.responsavel, x.responsavel_nome)).localeCompare(String(nomeDe(y.responsavel, y.responsavel_nome)), 'pt-BR'),
    data: (x, y) => String(x.prazo || '9999').localeCompare(String(y.prazo || '9999')) || pesoUrg(x) - pesoUrg(y),
  }[ord];
}
const modoDe = (params) => (params.get('modo') === 'lista' ? 'lista' : 'tabela');
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaCurto = (iso) => `${SEM[new Date(`${iso}T12:00:00`).getDay()]} ${dm(iso).slice(0, 5)}`;
const SEM_LONGO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function vistaDia(params, obras, setorFixo) {
  const hoje = hojeISO(); const dia = ehData(params.get('dia')) ? params.get('dia') : hoje;
  const pessoaSel = params.get('pessoa') || 'eu';
  const p2 = new URLSearchParams(params); p2.set('pessoa', pessoaSel);
  const urg = params.get('urg') || '';
  const base = filtrar(p2, setorFixo).filter((p) => !urg || (urg === 'sem' ? !p.urgencia : p.urgencia === urg));
  const aberta = (p) => p.status === 'aberta';
  const atrasadas = dia >= hoje ? base.filter((p) => aberta(p) && p.prazo && p.prazo < hoje) : [];
  const doDia = base.filter((p) => p.prazo === dia);
  const semPrazo = dia === hoje ? base.filter((p) => aberta(p) && !p.prazo) : [];
  let itens = [...atrasadas, ...doDia, ...semPrazo];
  // ordenar por assunto, prioridade (urgência), responsável ou data; sem escolha vale a ordem padrão (atrasadas, do dia, sem prazo)
  const ord = params.get('ord') || '';
  const cmp = comparador(ord);
  if (cmp) itens = [...itens].sort(cmp);
  const feitas = itens.filter((p) => p.status === 'feita').length; const pct = itens.length ? Math.round((feitas / itens.length) * 100) : 0;
  const nomeSel = pessoaSel === 'eu' ? (sessao().nome || 'Você') : pessoaSel === 'todos' ? 'Todos' : (dados.pessoas.find((x) => x.id === pessoaSel) || {}).nome || 'Tarefas';
  const contaUrg = (u) => itens.filter((p) => aberta(p) && p.urgencia === u).length;
  const alvoPassar = dia > hoje ? dia : somarDias(hoje, 1);
  const grupos = new Map();
  const rotuloOrd = { assunto: 'por assunto', prioridade: 'por prioridade', responsavel: 'por responsável', data: 'por data' }[ord];
  if (cmp) grupos.set('__todas', { nome: `Todas as tarefas · ${rotuloOrd}`, itens });   // ordenando: uma lista só, uma tarefa atrás da outra
  else for (const p of itens) { const k = p.obra ? codigoDaObra(p.obra) : ''; if (!grupos.has(k)) grupos.set(k, { nome: p.obra || 'Geral', itens: [] }); grupos.get(k).itens.push(p); }
  const ordem = cmp ? [...grupos.entries()] : [...grupos.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'pt-BR', { numeric: true })));
  const corPessoa = (nome) => { let h = 0; for (const c of String(nome || '')) h = (h * 31 + c.charCodeAt(0)) % 4; return `lt-p${h}`; };
  // o nome do responsável só aparece quando não é óbvio: vendo só as minhas (ou só uma pessoa) ele se repetiria em toda linha; terceirizado, cliente e outras visões mostram
  const mostrarQuem = (p) => !(p.responsavel && ((pessoaSel === 'eu' && p.responsavel === souEu()) || pessoaSel === p.responsavel));
  const linha = (p) => {
    const atrasada = aberta(p) && p.prazo && p.prazo < hoje;
    const sub = p.status === 'feita' ? 'Concluída' : atrasada ? `Pendente desde ${dm(p.prazo).slice(0, 5)}` : !p.prazo ? 'Sem prazo' : '';
    const quem = nomeDe(p.responsavel, p.responsavel_nome);
    const ontem = somarDias(dia, -1); const amanha = somarDias(dia, 1);
    return html`<div class="lt-linha ${p.status === 'feita' ? 'lt-feita' : ''}" data-tarefa="${p.id}" title="Clique para ver a tarefa · clique no nome para editá-lo aqui mesmo">
      <input type="checkbox" class="lt-chk" data-pend="${p.id}|${p.status === 'feita' ? 'aberta' : 'feita'}" ${p.status === 'feita' ? html.seguro('checked') : ''} title="${p.status === 'feita' ? 'Reabrir' : 'Concluir'}">
      <div class="lt-corpo"><span class="lt-tit" title="Clique para editar o nome da tarefa">${cmp && p.obra ? html`<b class="lt-obra">${p.obra}</b> ` : ''}${descRica(p.descricao)}</span>${sub ? html`<span class="lt-sub ${atrasada ? 'lt-atraso' : ''}">${sub}</span>` : ''}${p.funcao_tarefa ? html`<span class="lt-sub">Função: ${p.funcao_tarefa}</span>` : ''}</div>
      <div class="lt-dir">${mostrarQuem(p) ? html`<span class="lt-quem ${corPessoa(quem)}">${quem}</span>` : ''}${chipUrg(p.urgencia)}
        <button type="button" class="lt-bt" data-lt-mover="${p.id}|${ontem}" title="Passar para ${dm(ontem)}">↩ Devolver para ${dm(ontem).slice(0, 5)}</button>
        <button type="button" class="lt-bt" data-lt-mover="${p.id}|${amanha}" title="Passar para ${dm(amanha)}">→ ${dm(amanha).slice(0, 5)}</button>
        <button type="button" class="lt-bt" data-lt-abrir="${p.id}">Editar</button>
        <button type="button" class="lt-bt lt-bt-ex" data-pend-del="${p.id}">Excluir</button></div></div>`;
  };
  const opt = (v, t, atual) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`;
  const gente = pessoasParaVer();
  const pilula = (chave, valor, rotulo, atual) => html`<button type="button" class="lt-pil ${atual === valor ? 'on' : ''}" data-lt-filtro="${chave}|${valor}">${rotulo}</button>`;
  const diaSem = SEM_LONGO[new Date(`${dia}T12:00:00`).getDay()];
  return html`<section class="lt">
    <div class="lt-corpo-geral">
      <div class="lt-resumo"><div class="lt-anel" style="--pct:${pct}"><b>${pct}%</b></div>
        <div><h3>${nomeSel}</h3><p>${feitas} de ${itens.length} ${itens.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</p>
          <div class="lt-urgs">${['alta', 'media', 'baixa'].map((u) => (contaUrg(u) ? html`<span class="lt-urg ${URG[u][1]}"><i></i>${contaUrg(u)} ${URG[u][0]}</span>` : ''))}</div></div>
        <div class="lt-nav">
          <button type="button" class="lt-nova" data-av-nova="${dia}" data-av-setor="${params.get('setor') || ''}" data-av-obra="${params.get('obra') || ''}" data-av-resp="${pessoaSel === 'eu' ? souEu() : (pessoaSel !== 'todos' ? pessoaSel : '')}">+ Nova tarefa</button>
          <button type="button" class="lt-seta" data-lt-dia="${somarDias(dia, -1)}" title="Dia anterior" aria-label="Dia anterior">‹</button>
          <button type="button" class="lt-hoje" data-lt-dia="${hoje}">Hoje</button>
          <div class="lt-data"><span>${diaSem}${dia === hoje ? ' · hoje' : ''}</span><b>${dm(dia)}</b></div>
          <button type="button" class="lt-seta" data-lt-dia="${somarDias(dia, 1)}" title="Dia seguinte" aria-label="Dia seguinte">›</button>
        </div>
      </div>
      <div class="lt-filtros">
        <div class="lt-grp"><span>Urgência</span>${pilula('urg', '', 'Todas', urg)}${pilula('urg', 'alta', 'Alta', urg)}${pilula('urg', 'media', 'Média', urg)}${pilula('urg', 'baixa', 'Baixa', urg)}${pilula('urg', 'sem', 'Sem', urg)}</div>
        <div class="lt-grp lt-grp-sel">
          <label>Ver tarefas de<select data-atas-filtro="pessoa">${opt('eu', 'Só as minhas', pessoaSel)}${opt('todos', 'Todos (os que eu vejo)', pessoaSel)}${opt('tipo:solida', 'Equipe da Sólida', pessoaSel)}${opt('tipo:terceirizado', 'Terceirizados (todos)', pessoaSel)}${opt('tipo:cliente', 'Clientes', pessoaSel)}${opt('tipo:arquitetura', 'Arquitetura', pessoaSel)}${gente.length ? html`<optgroup label="Pessoas">${gente.map((x) => opt(x.id, x.nome, pessoaSel))}</optgroup>` : ''}</select></label>
          ${setorFixo ? '' : html`<label>Setor<select data-atas-filtro="setor"><option value="">Todos</option>${SETORES_ATA.map((s) => opt(s, s, params.get('setor') || ''))}</select></label>`}
          ${selObra(obras, params.get('obra') || '')}
          <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="texto…"></label>
          <label>Ordenar por<select data-atas-filtro="ord"><option value="">Padrão</option>${opt('assunto', 'Assunto', ord)}${opt('prioridade', 'Prioridade', ord)}${opt('responsavel', 'Responsável', ord)}${opt('data', 'Data', ord)}</select></label></div>
      </div>
      <div class="lt-acoes">${atrasadas.length ? html`<button type="button" class="lt-bt lt-bt-grande" data-lt-passar="${atrasadas.map((p) => p.id).join(',')}|${alvoPassar}">Passar ${atrasadas.length} ${atrasadas.length === 1 ? 'pendência' : 'pendências'} para ${dm(alvoPassar).slice(0, 5)}</button>` : ''}</div>
      ${ordem.length ? ordem.map(([, g]) => html`<section class="lt-grupo"><header><h3>${g.nome}</h3><span>${g.itens.filter((p) => p.status === 'feita').length}/${g.itens.length}</span></header>${g.itens.map(linha)}</section>`) : html`<p class="lt-vazio">Nenhuma tarefa para este dia com esses filtros.</p>`}
    </div>
  </section>`;
}
// Cabeçalho que só aparece na impressão das tarefas (Tabela e Lista), no mesmo desenho da ata: logo, título e, no canto de cima à direita, a OBRA ou o DEPARTAMENTO filtrado.
// Embaixo, uma linha por filtro ativo, para quem lê o papel saber o que está vendo.
function cabecalhoImpressao(params, modo, hoje, setorFixo = '') {
  const obra = params.get('obra') || ''; const setor = params.get('setor') || setorFixo || '';
  const canto = obra ? (setor ? `${obra} · ${setor}` : obra) : setor || 'TODAS AS OBRAS';
  const rotCanto = obra ? 'OBRA' : setor ? 'DEPARTAMENTO' : '';
  const pes = params.get('pessoa') || 'eu';
  const quem = !pes || pes === 'todos' ? 'Todos' : pes === 'eu' ? (sessao().nome || 'Eu') : pes === 'sup' ? 'Quem tenho como gestor' : pes.startsWith('cat:') ? pes.slice(4) : pes.startsWith('tipo:') ? (ROTULO_TIPO[pes.slice(5)] || pes.slice(5)) : nomeDe(pes, '');
  const urg = params.get('urg') || ''; const q = (params.get('q') || '').trim();
  const dia = modo === 'lista' && ehData(params.get('dia')) ? params.get('dia') : hoje;
  return html`<div class="at-cab-imp">
    <div class="ci-linha">
      <img class="ci-logo" src="img/logo.png" alt="Sólida">
      <div class="ci-meio"><div class="ci-tit">TAREFAS</div><div class="ci-data">${dm(dia)}</div></div>
      <div class="ci-canto">${rotCanto ? html`<small>${rotCanto}</small>` : ''}<b>${canto}</b></div>
    </div>
    <div class="ci-filtros">${urg ? html`<span><b>Prioridade:</b> ${urg === 'sem' ? 'sem prioridade' : ({ alta: 'alta', media: 'média', baixa: 'baixa' }[urg] || urg)}</span>` : ''}${q ? html`<span><b>Busca:</b> ${q}</span>` : ''}</div>
  </div>`;
}
export function renderPendencias({ params, obras = [], setorFixo = '', base = '#/atas', sugestoes = [] }) {
  definirSugestoes(sugestoes);
  if (lote) return painelLote(obras);   // lista de pendências importada: conferir antes de criar as tarefas
  const hoje = hojeISO();
  const doSetor = dados.pendencias.filter((p) => naLista(p) && doEscopo(p, setorFixo));
  const abertas = doSetor.filter((p) => p.status === 'aberta');
  const atrasadas = abertas.filter((p) => p.prazo && p.prazo < hoje).length;
  const eu = souEu(); const minhas = abertas.filter((p) => p.responsavel && p.responsavel === eu).length;
  let lista = filtrar(params, setorFixo);
  const cmpTab = comparador(params.get('ord') || ''); if (cmpTab) lista = [...lista].sort(cmpTab);
  const modo = modoDe(params);
  const cabImp = cabecalhoImpressao(params, modo, hoje, setorFixo);
  if (modo === 'lista') return html`${cabImp}${datalistTerceiros()}${dados.erro ? html`<p class="erro">Não consegui carregar: ${dados.erro}</p>` : ''}${vistaDia(params, obras, setorFixo)}`;
  return html`${cabImp}${datalistTerceiros()}${dados.erro ? html`<p class="erro">Não consegui carregar: ${dados.erro}</p>` : ''}
    <div class="cards at-cards"><div class="card"><div class="card-valor">${abertas.length}</div><div class="card-rotulo">Pendências abertas</div></div>
      <div class="card"><div class="card-valor ${atrasadas ? 'tom-ruim' : ''}">${atrasadas}</div><div class="card-rotulo">Atrasadas</div></div>
      <div class="card"><div class="card-valor">${minhas}</div><div class="card-rotulo">Abertas comigo</div></div></div>
    ${barraFiltros(params, obras, 'pendencias', { base, setorFixo })}
    ${vistaPrazo(lista, hoje, setorFixo)}`;
}
export function render({ params, obras = [], msg = '', sugestoes = [] }) {
  definirSugestoes(sugestoes);
  const hoje = hojeISO();
  const aba = ABAS.some(([id]) => id === params.get('aba')) ? params.get('aba') : 'pendencias';
  const abertas = dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta');
  // Tarefas e Atas já estão no menu da esquerda (desenho do Marcos): sem as abas aqui em cima; em Atas, o botão de nova ata
  // Atas / Pautas (pedido do Felipe, 04/11): duas abas na tela de Atas
  const abasAtas = html`<div class="subnav at-abas" role="tablist"><a role="tab" class="${aba === 'atas' ? 'on' : ''}" href="#/atas?aba=atas">Atas <span class="est-n">${dados.atas.length}</span></a><a role="tab" class="${aba === 'pautas' ? 'on' : ''}" href="#/atas?aba=pautas">Pautas <span class="est-n">${new Set(dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta').map((p) => p.obra || p.setor || 'Escritório')).size}</span></a><a class="pd-bt pd-bt-cheio at-nova-bt" href="#/atas?aba=nova">+ Nova ata</a></div>`;
  const topo = (aba === 'atas' && !params.get('ata')) || aba === 'pautas' ? abasAtas
    : aba === 'nova' ? html`<div class="at-topo-bt"><a class="link" href="#/atas?aba=atas">← Atas</a></div>` : '';
  void abertas;
  let corpo;
  if (aba === 'nova') corpo = formNova(obras, params.get('revisar') || '');
  else if (aba === 'pautas') corpo = renderPautas(params, obras);
  else if (aba === 'atas') corpo = params.get('ata') ? detalheAta(params.get('ata'), hoje, obras) : html`${barraFiltros(params, obras, 'atas')}${listaAtas(params, obras)}`;
  else corpo = renderPendencias({ params, obras });
  return html`<div class="pagina atas">
    ${datalistTerceiros()}
    ${dados.erro ? html`<p class="erro">Não consegui carregar: ${dados.erro}</p>` : ''}
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    ${topo}<div style="margin-top:${topo ? 12 : 0}px">${corpo}</div>
    ${NA_NUVEM ? '' : html`<p class="pequeno" style="margin-top:20px">Modo de teste (computador do escritório): as atas ficam só neste navegador. Na internet elas ficam no banco, compartilhadas.</p>`}
  </div>`;
}

// nome de uma pessoa pelo id (Agenda, painéis)
export const nomePessoa = (id, reserva) => nomeDe(id, reserva);


// ================================================================ detalhes da tarefa (pedido do Felipe, 04/11/2026)
// Clicar no cartão (Tarefas ou Agenda) abre uma janela: título, responsável, gestor, prazo, concluir, excluir e um chat para anotar coisas.
// Arrastar o cartão muda o prazo (entre as colunas do quadro de Tarefas ou entre os dias da Agenda).
const notasCache = {};
export const notasDe = (id) => notasCache[String(id)] || [];
export async function carregarNotas(id) {
  if (NA_NUVEM) notasCache[String(id)] = await listarNotasPend(id);
  else { const l = lerLocal(); notasCache[String(id)] = (l.notas || []).filter((n) => String(n.pendencia_id) === String(id)); }
  return notasDe(id);
}
// várias de uma vez (Controle de obras do Pós-obra mostra os relatos de todas as pendências das OS)
export const notasCarregada = (id) => Object.prototype.hasOwnProperty.call(notasCache, String(id));
export async function carregarNotasVarias(ids) {
  const lista = [...new Set(ids.map(String))]; if (!lista.length) return;
  let todas = [];
  try { todas = NA_NUVEM ? await listarNotasPendVarias(lista) : (lerLocal().notas || []).filter((n) => lista.includes(String(n.pendencia_id))); } catch { todas = []; }   // sem acesso às anotações: mostra sem relatos (e não tenta de novo em loop)
  for (const id of lista) notasCache[id] = [];
  for (const n of todas) (notasCache[String(n.pendencia_id)] || (notasCache[String(n.pendencia_id)] = [])).push(n);
  for (const id of lista) notasCache[id].sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
}
export async function anotar(id, texto) {
  const t = String(texto || '').trim(); if (!t) return;
  if (NA_NUVEM) await criarNotaPend(id, t);
  else { const l = lerLocal(); l.notas = l.notas || []; l.notas.push({ id: l.seq++, pendencia_id: id, texto: t, autor_nome: sessao().nome || '', autor: idPessoa(), criado_em: new Date().toISOString() }); gravarLocal(l); }
  await carregarNotas(id);
}
export async function apagarNota(notaId, pendId) {
  if (NA_NUVEM) await apagarNotaPend(notaId);
  else { const l = lerLocal(); l.notas = (l.notas || []).filter((n) => String(n.id) !== String(notaId)); gravarLocal(l); }
  await carregarNotas(pendId);
}

// c = { assunto, desc, resp ('ext' | id da pessoa), tipo, nome, gestor ('' = automático | id), prazo }
// Duplicar: cria uma cópia aberta da tarefa (mesmo título, responsável, obra, setor, prazo, prioridade, observadores, horário e OS), sem as anotações, sem a ata
// de origem e sem a recorrência. Devolve o id da cópia para a janela abrir nela.
export async function duplicarTarefa(id) {
  const p = pendenciaPorId(id); if (!p) throw new Error('Tarefa não encontrada.');
  const copia = { ata_id: null, descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel_nome || null, responsavel_tipo: p.responsavel_tipo || 'solida', responsavel_categoria: p.responsavel_categoria || null,
    prazo: p.prazo || null, status: 'aberta', obra: p.obra || null, setor: p.setor || null, os: p.os || null, urgencia: p.urgencia || null, funcao_tarefa: p.funcao_tarefa || null,
    observadores: p.observadores || [], hora: p.hora || null, duracao: p.duracao || 60 };
  let novo;
  if (NA_NUVEM) [novo] = await criarPendenciasNuvemLote([copia]);
  else { const l = lerLocal(); novo = l.seq++; l.pendencias.push({ id: novo, ...copia, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
  await carregar();
  return novo;
}
// define (ou tira) o responsável da Sólida de uma tarefa, direto de uma lista (ex.: Controle de obras do pós-obra)
export async function definirResponsavelTarefa(id, pessoaId) {
  const mud = pessoaId ? { responsavel: pessoaId, responsavel_nome: nomeDe(pessoaId), responsavel_tipo: 'solida', responsavel_categoria: null } : { responsavel: null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}
// troca só o nome (título) da tarefa, direto no cartão; escopo 'seguintes' vale também para as próximas da série recorrente
export async function renomearTarefa(id, texto, escopo = 'uma') {
  const p = pendenciaPorId(id); if (!p) throw new Error('Tarefa não encontrada.');
  const d = String(texto || '').trim(); if (!d) throw new Error('Escreva o título da tarefa.');
  if (d === p.descricao) return;
  const mud = { descricao: d };
  if (escopo === 'seguintes' && p.serie) await atualizarVarias(seguintesDe(p).map((x) => x.id), () => mud);
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}
export async function salvarTarefa(id, c) {
  const p = pendenciaPorId(id); if (!p) throw new Error('Tarefa não encontrada.');
  const desc = String(c.desc || '').trim(); const ass = String(c.assunto || '').trim();
  if (!desc && !ass) throw new Error('Escreva o título da tarefa.');
  const mud = { obra: c.obra === undefined ? p.obra : (c.obra || null), descricao: ass ? `${ass}, ${desc}` : desc, urgencia: c.urgencia || null, funcao_tarefa: c.funcaoTarefa || null, observadores: c.observadores || [], hora: c.hora || null, duracao: c.duracao ? Number(c.duracao) : null };
  if (c.resp === 'ext') {
    const tipo = c.tipo || 'terceirizado';
    Object.assign(mud, { responsavel: null, responsavel_nome: String(c.nome || '').trim() || (tipo === 'cliente' ? 'Cliente' : tipo === 'arquitetura' ? 'Arquitetura' : null), responsavel_tipo: tipo, responsavel_categoria: null });
  } else if (c.resp) Object.assign(mud, { responsavel: c.resp, responsavel_nome: nomeDe(c.resp), responsavel_tipo: 'solida', responsavel_categoria: null });
  else throw new Error('Escolha o responsável.');
  // gestor: "automático" volta ao cálculo pelas obras e setores (o responsavel no pacote faz o banco recalcular)
  if (c.gestor) { const g = dados.pessoas.find((x) => x.id === c.gestor); Object.assign(mud, { gestores: [c.gestor], gestores_nome: g ? g.nome : '', gestores_manual: true }); }
  else if (c.gestor === '' && p.gestores_manual) Object.assign(mud, { gestores_manual: false, responsavel: mud.responsavel === undefined ? p.responsavel : mud.responsavel });
  if (c.escopo === 'seguintes' && p.serie) {
    const delta = c.prazo && p.prazo ? diasEntre(p.prazo, c.prazo) : 0;
    const seg = seguintesDe(p); const mapa = Object.fromEntries(seg.map((x) => [x.id, x.prazo]));
    await atualizarVarias(seg.map((x) => x.id), (i) => ({ ...mud, ...(delta ? { prazo: somarDias(mapa[i], delta) } : {}) }));
  }
  // tarefa que já existia e agora virou recorrente: esta vira a primeira da série e as próximas semanas são criadas
  let novasDaSerie = [];
  if (c.recorrente && !p.serie && (c.prazo || p.prazo)) {
    const serie = `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const base = c.prazo || p.prazo;
    const freq = c.frequencia === 'mensal' ? 'mensal' : 'semanal';
    Object.assign(mud, { serie, recorrente: true, frequencia: freq });
    novasDaSerie = Array.from({ length: SEMANAS_INICIAIS - 1 }, (_, k) => ({ descricao: mud.descricao, responsavel: mud.responsavel ?? p.responsavel ?? null, responsavel_nome: mud.responsavel_nome ?? p.responsavel_nome ?? null, responsavel_tipo: mud.responsavel_tipo ?? p.responsavel_tipo ?? null, responsavel_categoria: mud.responsavel_categoria ?? p.responsavel_categoria ?? null, prazo: dataDaSerie(base, freq, k + 1), status: 'aberta', obra: p.obra || null, setor: p.setor || null, os: p.os || null, urgencia: mud.urgencia, funcao_tarefa: mud.funcao_tarefa, observadores: mud.observadores || [], hora: mud.hora, duracao: mud.duracao, serie, recorrente: true, frequencia: freq }));
  }
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  if (novasDaSerie.length) {
    if (NA_NUVEM) await criarPendenciasNuvemLote(novasDaSerie);
    else { const l = lerLocal(); for (const x of novasDaSerie) l.pendencias.push({ id: l.seq++, ...x, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
  }
  await carregar();
  if ((c.prazo || '') !== (p.prazo || '')) await reprogramar(id, c.prazo || '');
}

// arrastar para uma coluna do quadro de Tarefas: muda o prazo (ou conclui). Vencido não é destino: ali só entra quem passou da data.
export async function moverParaColuna(id, col) {
  const p = pendenciaPorId(id); if (!p) return false;
  const hoje = hojeISO();
  // de volta para o Vencido: o prazo volta para o dia em que estava antes da última reprogramação (só se esse dia já passou)
  if (col === 'vencido') {
    const rs = [...(p.reprogramacoes || [])]; const ult = rs[rs.length - 1];
    if (!ult || !ult.de || ult.de >= hoje) return false;
    rs.pop();
    if (p.status === 'feita') await mudarStatus(id, 'aberta');
    const mud = { prazo: ult.de, reprogramacoes: rs };
    if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
    else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
    await carregar();
    return true;
  }
  if (col === 'concluido') { if (p.status !== 'feita') await mudarStatus(id, 'feita'); return true; }
  if (p.status === 'feita') await mudarStatus(id, 'aberta');
  await reprogramar(id, col === 'sem' ? '' : prazoDaColuna(col, hoje));
  return true;
}

const quando = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export function detalheTarefa(id, { msg = '', obras = [] } = {}) {
  const p = pendenciaPorId(id);
  if (!p) return html`<div class="tf"><p class="erro">Não achei esta tarefa (talvez outra pessoa a tenha excluído).</p><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button></div></div>`;
  const [ass, resto] = dividirDescricao(p.descricao);
  const ext = !p.responsavel; const tipo = p.responsavel_tipo && p.responsavel_tipo !== 'solida' ? p.responsavel_tipo : 'terceirizado';
  const gAtual = p.gestores_manual && (p.gestores || [])[0] ? p.gestores[0] : '';
  const a = ataDe(p); const hoje = hojeISO(); const col = coluna(p, hoje);
  const eu = souEu(); const notas = notasDe(id);
  return html`<div class="tf" data-tf-raiz="${p.id}">
    <div class="tf-corpo">
    <form id="tf-form" class="tf-esq" data-tf="${p.id}" autocomplete="off">
    <div class="tf-cab"><h3>Tarefa</h3>${p.status === 'feita' ? html`<span class="at-chip">concluída</span>` : col === 'vencido' ? html`<span class="at-chip tf-venc">vencida</span>` : ''}${onde(p) ? html`<span class="at-chip">${onde(p)}</span>` : ''}${a ? html`<a class="at-ata" href="#/atas?aba=atas&ata=${a.id}" title="Ata de origem">ata ${dm(a.data).slice(0, 5)}</a>` : ''}${p.os ? html`<a class="at-chip at-os" href="#/posobra/os/${encodeURIComponent(p.os)}">${p.os}</a>` : ''}</div>
      <div class="tf-grade">
        <label class="tf-ass">Assunto / cômodo<input name="t_assunto" value="${ass}" placeholder="ex.: ACM"></label>
        <label class="tf-desc">Título (o que fazer)<input name="t_desc" value="${resto}" placeholder="ex.: Retirar da área gourmet" required></label>
        <label>Responsável<select name="t_resp" data-tf-resp><option value="ext" ${ext ? html.seguro('selected') : ''}>Outro: terceirizado, cliente, arquitetura…</option>${opcoesPessoas(p.responsavel || '')}</select></label>
        <div class="tf-ext" ${ext ? '' : html.seguro('hidden')}><label>Quem é<select name="t_tipo"><option value="terceirizado" ${tipo === 'terceirizado' ? html.seguro('selected') : ''}>Terceirizado</option><option value="cliente" ${tipo === 'cliente' ? html.seguro('selected') : ''}>Cliente</option><option value="arquitetura" ${tipo === 'arquitetura' ? html.seguro('selected') : ''}>Arquitetura</option></select></label>
          <label>Nome<input name="t_nome" value="${ext ? (p.responsavel_nome || '') : ''}" list="dl-terceiros" placeholder="empresa ou pessoa"></label></div>
        <label>Obra<select name="t_obra"><option value="">Nenhuma</option>${gruposDeObras(obras, p.obra || '', { criar: true })}</select></label>
        <label>Prazo<input type="date" name="t_prazo" value="${p.prazo || ''}"></label>
        ${p.serie ? html`<div class="tf-recor tf-recor-on"><label class="tf-recor-chk"><input type="checkbox" checked disabled> <span>Tarefa recorrente</span></label><small>${p.frequencia === 'mensal' ? 'todo mês' : 'toda semana'}</small></div>` : html`<div class="tf-recor"><label class="tf-recor-chk"><input type="checkbox" name="t_recor"> <span>Tarefa recorrente</span></label><select name="t_freq" title="Como se repete"><option value="semanal">Toda semana</option><option value="mensal">Todo mês</option></select></div>`}
      </div>
      <div class="tf-sep"></div>
      <div class="tf-grade tf-agenda">
        <label>Horário na Agenda<input type="time" name="t_hora" value="${p.hora || ''}"></label>
        <label>Duração<select name="t_dur">${DURACOES.map(([v, t]) => html`<option value="${v}" ${(Number(p.duracao) || 60) === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>
        <label>Função (Agenda)<select name="t_func"><option value="">Nenhuma</option>${opcoesFuncaoTarefa(p.responsavel, p.funcao_tarefa)}</select></label>
        <label>Urgência<select name="t_urg"><option value="">Sem urgência</option>${Object.entries(URG).map(([v, [t]]) => html`<option value="${v}" ${p.urgencia === v ? html.seguro('selected') : ''}>${t[0] + t.slice(1).toLocaleLowerCase('pt-BR')}</option>`)}</select></label>
      </div>
      ${caixaObservadores('t_obs', p.observadores || [], p.responsavel, p.gestores_nome)}
      <p class="pequeno tf-ajuda">Normalmente você define o horário e o tempo arrastando o cartão na Agenda. Sem horário, a tarefa fica na faixa de cima do dia, como no Google Agenda.</p>
      ${reprogramada(p) ? html`<p class="pequeno">↻ ${tituloRepro(p)}</p>` : ''}
      <div class="tf-botoes">
        ${msg ? html`<span class="tf-msg">${msg}</span>` : ''}
        <button type="button" class="botao tf-dup" data-tf-dup="${p.id}" title="Cria uma cópia desta tarefa (sem as anotações) para você ajustar">⧉ Duplicar tarefa</button>
        <button type="button" class="botao tf-excluir" data-tf-excluir="${p.id}" title="${p.ata_id ? 'Tirar da lista de pendências (o item continua na ata)' : 'Excluir esta tarefa'}">${p.ata_id ? 'Tirar da lista' : 'Excluir'}</button>
        <button type="submit" class="botao on">Salvar alterações</button>
      </div>
    </form>
    <div class="tf-chat tf-dir"><h4>Anotações <span class="pequeno">${notas.length}</span></h4>
      <div class="tf-notas">${(p.reprogramacoes || []).map((r) => html`<div class="tf-nota tf-sis"><div class="tf-nota-h"><b>Reprogramada</b><span>${r.em ? quando(r.em) : ''}</span></div><div class="tf-nota-t">↻ de ${dm(r.de)} para ${dm(r.para)}${r.por ? html` · ${r.por}` : ''}</div></div>`)}${notas.length ? notas.map((n) => html`<div class="tf-nota ${n.autor === eu ? 'tf-minha' : ''}"><div class="tf-nota-h"><b>${n.autor_nome || 'Alguém'}</b><span>${quando(n.criado_em)}</span>${n.autor === eu ? html`<button type="button" class="tf-x" data-tf-nota-del="${n.id}|${p.id}" title="Apagar esta anotação">×</button>` : ''}</div><div class="tf-nota-t">${textoRico(n.texto)}</div></div>`) : html`<p class="pequeno">Nenhuma anotação ainda. Use para registrar o que foi combinado, cobrado ou resolvido.</p>`}</div>
      <form id="tf-nota" data-tf-nota="${p.id}"><textarea name="t_nota" rows="2" placeholder="Escreva uma anotação… (Ctrl+Enter envia)"></textarea><button type="submit" class="botao on">Enviar</button></form>
    </div>
    </div>
  </div>`;
}


// ================================================================ Pautas (pedido do Felipe, 04/11/2026)
// Atas / Pautas: a pauta da próxima reunião de cada obra (ou departamento) é o que ainda está aberto, e dá para filtrar
// por quem vai estar na reunião: arquitetura · arquitetura e cliente · cliente · terceirizados da obra.
// Ordenar por data (o prazo mais próximo primeiro) ou por ordem alfabética.
export const FILTROS_PAUTA = [['arquitetura', 'Arquitetura'], ['arqcliente', 'Arquitetura e cliente'], ['cliente', 'Cliente'], ['terceiros', 'Terceirizados da obra']];
const TIPOS_DA_PAUTA = { arquitetura: ['arquitetura'], arqcliente: ['arquitetura', 'cliente'], cliente: ['cliente'], terceiros: ['terceirizado'] };
const chaveTxt = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
const linhaPauta = (p, hoje) => {
  const [ass, resto] = dividirDescricao(p.descricao); const quem = nomeDe(p.responsavel, p.responsavel_nome);
  return { p, ass, resto, quem, atrasada: !!p.prazo && p.prazo < hoje };
};
function montarPautas(params) {
  const hoje = hojeISO();
  const filtro = FILTROS_PAUTA.some(([v]) => v === params.get('pauta')) ? params.get('pauta') : '';
  const alfa = params.get('ordem') === 'alfa';
  const q = chaveTxt(params.get('q'));
  const tipos = filtro ? TIPOS_DA_PAUTA[filtro] : null;
  const abertas = dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta' && (!tipos || tipos.includes(p.responsavel_tipo || 'solida')) && (!params.get('obra') || codigoDaObra(p.obra) === codigoDaObra(params.get('obra')))
    && (!params.get('setor') || p.setor === params.get('setor')) && (!q || chaveTxt(`${p.descricao} ${p.responsavel_nome} ${p.obra} ${p.setor}`).includes(q)));
  const grupos = new Map();
  for (const p of abertas) {
    const nome = p.obra || p.setor || 'Escritório';
    const g = grupos.get(nome) || { nome, tipo: p.obra ? 'obra' : 'setor', itens: [], ultimaAta: '' };
    g.itens.push(linhaPauta(p, hoje)); const a = ataDe(p); if (a && a.data > g.ultimaAta) g.ultimaAta = a.data; grupos.set(nome, g);
  }
  const porPrazo = (x, y) => String(x.p.prazo || '9999').localeCompare(String(y.p.prazo || '9999'));
  const porNome = (x, y) => chaveTxt(`${x.ass} ${x.resto}`).localeCompare(chaveTxt(`${y.ass} ${y.resto}`), 'pt-BR');
  const lista = [...grupos.values()];
  for (const g of lista) { g.itens.sort(alfa ? porNome : porPrazo); g.proximo = g.itens.map((i) => i.p.prazo).filter(Boolean).sort()[0] || ''; }
  lista.sort(alfa ? (x, y) => chaveTxt(x.nome).localeCompare(chaveTxt(y.nome), 'pt-BR', { numeric: true }) : (x, y) => String(x.proximo || '9999').localeCompare(String(y.proximo || '9999')) || chaveTxt(x.nome).localeCompare(chaveTxt(y.nome), 'pt-BR', { numeric: true }));
  return { lista, filtro, alfa, total: abertas.length, hoje };
}
export function textoDaPauta(g, filtro) {
  const rot = FILTROS_PAUTA.find(([v]) => v === filtro);
  const out = [`PAUTA DA PRÓXIMA REUNIÃO — ${g.nome}${rot ? ` · ${rot[1]}` : ''}`, ''];
  g.itens.forEach((i, n) => out.push(`${n + 1}. ${i.ass ? `${i.ass}, ${i.resto}` : i.p.descricao} — ${String(i.quem).toLocaleUpperCase('pt-BR')}${i.p.prazo ? ` — prazo ${dm(i.p.prazo).slice(0, 5)}` : ''}${i.atrasada ? ' [ATRASADA]' : ''}`));
  out.push('', 'Assuntos novos:', '- ');
  return out.join('\n');
}
function renderPautas(params, obras) {
  const { lista, filtro, alfa, total, hoje } = montarPautas(params);
  // a pauta só aparece depois que a pessoa filtra (pedido do Felipe): senão a aba fica gigante
  const filtrado = ['pauta', 'setor', 'obra', 'q'].some((k) => String(params.get(k) || '').trim());
  const sel = (nome, rotulo, opcoes, atual, todos = 'Todas') => html`<label>${rotulo}<select data-atas-filtro="${nome}"><option value="">${todos}</option>${opcoes.map(([v, t]) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>`;
  const cartaoPauta = (g) => html`<article class="at-pauta">
    <header><div><h3>${g.nome}</h3><span class="pequeno">${g.itens.length} ${g.itens.length === 1 ? 'item em aberto' : 'itens em aberto'}${g.ultimaAta ? ` · última ata ${dm(g.ultimaAta).slice(0, 5)}` : ''}</span></div>
      <button type="button" class="ac-mini" data-pauta-txt="${g.nome}" title="Copia a pauta em texto para colar no e-mail ou no WhatsApp">Copiar pauta</button></header>
    <ol class="at-pauta-itens">${g.itens.map((i) => html`<li class="${i.atrasada ? 'at-p-atras' : ''}" data-tarefa="${i.p.id}" title="Clique para abrir a tarefa">
      <span class="at-p-tit">${i.ass ? html`<b>${i.ass}</b>, ${i.resto}` : i.p.descricao}</span>
      <span class="at-p-meta"><span class="at-pessoa">${i.quem}</span>${i.p.responsavel_tipo && i.p.responsavel_tipo !== 'solida' ? html`<span class="at-tipo at-t-${i.p.responsavel_tipo}">${ROTULO_TIPO[i.p.responsavel_tipo] || 'Externo'}</span>` : ''}${i.p.prazo ? html`<span class="${i.atrasada ? 'pendente' : ''}">${i.atrasada ? 'atrasada · ' : ''}${dm(i.p.prazo).slice(0, 5)}</span>` : html`<span class="muted">sem prazo</span>`}</span></li>`)}</ol></article>`;
  return html`<div class="at-filtros at-filtros-pauta">
      ${sel('pauta', 'Pauta para', FILTROS_PAUTA, filtro, 'Todas as pautas')}
      ${sel('ordem', 'Ordenar por', [['data', 'Data (prazo mais próximo)'], ['alfa', 'Ordem alfabética']], alfa ? 'alfa' : 'data', 'Data (prazo mais próximo)')}
      ${sel('setor', 'Departamento', SETORES_ATA.map((x) => [x, x]), params.get('setor') || '', 'Todos')}
      ${selObra(obras, params.get('obra') || '', 'Todas')}
      <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="texto…"></label>
    </div>
    ${!filtrado ? html`<div class="at-pauta-vazia"><b>Nenhuma pauta aberta.</b><p>Escolha acima para quem é a pauta, o departamento ou a obra (ou procure por um texto) e a pauta aparece aqui.</p></div>` : html`<p class="pequeno at-pauta-nota">A pauta de cada obra é o que ainda está em aberto: as pendências abertas das atas e das tarefas. ${filtro ? `Mostrando só o que é de ${FILTROS_PAUTA.find(([v]) => v === filtro)[1].toLocaleLowerCase('pt-BR')}.` : 'Escolha para quem é a reunião para ver só o que cabe a eles.'} ${total} ${total === 1 ? 'item' : 'itens'} em ${lista.length} ${lista.length === 1 ? 'pauta' : 'pautas'}.</p>
    ${lista.length ? html`<div class="at-pautas">${lista.map(cartaoPauta)}</div>` : html`<p class="vazio">Nenhum item em aberto com esses filtros.</p>`}`}`;
}
export const pautaPorNome = (nome, params) => montarPautas(params).lista.find((g) => g.nome === nome) || null;
void ataDe;

// pessoas da Sólida (para escolher responsável em outras telas, como o Quadro de OS do pós-obra)
export const pessoasDaEquipe = () => pessoasSelecionaveis();

// refaz a lista de departamentos das atas/pendências depois que um setor é criado ou excluído
export const atualizarSetoresAta = () => { SETORES_ATA.splice(0, SETORES_ATA.length, ...SETORES_ORGANOGRAMA, 'Diretoria / geral'); };
