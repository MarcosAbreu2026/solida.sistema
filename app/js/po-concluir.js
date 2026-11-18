// Finalizar um PO (situação "finalizada" no Cadastro): as OS abertas dele passam para Concluído e as tarefas abertas (das OS e as soltas do PO) ficam concluídas.
// O PO sai da lista do Controle de obras (aparece só em "Todas"). Pedido do Felipe, 18/11/2026.
import * as osq from './os-quadro.js';
import * as atas from './telas/atas.js';
import { rotuloPO } from './telas/posobra-controle.js';

export function doPO(codigo) {
  const chave = rotuloPO(codigo).chave;
  const os = osq.lista.filter((o) => o.cliente && rotuloPO(o.cliente).chave === chave && o.status !== 'concluido');
  const codigos = new Set(osq.lista.filter((o) => o.cliente && rotuloPO(o.cliente).chave === chave).map((o) => o.codigo));
  const tarefas = atas.todasPendencias().filter((p) => p.status === 'aberta' && p.na_lista !== false && ((p.os && codigos.has(p.os)) || (p.obra && !/^mo/i.test(p.obra) && rotuloPO(p.obra).chave === chave)));
  return { os, tarefas };
}
export async function concluirTudo(codigo) {
  const { os, tarefas } = doPO(codigo);
  for (const o of os) await osq.mover(o.id, 'concluido');
  for (const p of tarefas) await atas.mudarStatus(p.id, 'feita');
  return { os: os.length, tarefas: tarefas.length };
}
