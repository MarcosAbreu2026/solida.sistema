// Agenda (desenho do Marcos: "Agenda" no topo do menu) = as funções da semana de cada pessoa (antes "Minhas funções")
// com as tarefas (pendências com prazo) no mesmo calendário, como no Google Agenda.
import * as meudia from './meudia.js';

export function render(opts) {
  return meudia.render({ ...opts, soFuncoes: true, aba: 'funcoes' });
}
