// Registro dos painéis: id do departamento (organograma.js) → painel(ctx). Início e obra têm o seu próprio.
import * as operacao from './operacao.js';
import * as posobra from './posobra.js';
import * as tecnico from './tecnico.js';
import * as projetos from './projetos.js';
import * as planejamento from './planejamento.js';
import * as orcTerc from './orc-terceirizado.js';
import * as orcamentos from './orcamentos.js';
import * as comercial from './comercial.js';
import * as compras from './compras.js';
import * as materiais from './materiais.js';
import * as transporte from './transporte.js';
import * as ferramentas from './ferramentas.js';
import * as financeiro from './financeiro.js';
import * as rh from './rh.js';
import * as administrativo from './administrativo.js';
import { painelGenerico } from './comum.js';

const PAINEIS = {
  operacao, posobra, tecnico, projetos, planejamento, 'orc-terceirizado': orcTerc, orcamentos, comercial,
  compras, materiais, transporte, ferramentas, financeiro, rh, administrativo,
};

export function painelDe(id, ctx) {
  const m = PAINEIS[id];
  return String(m && m.painel ? m.painel(ctx) : painelGenerico(ctx));
}
