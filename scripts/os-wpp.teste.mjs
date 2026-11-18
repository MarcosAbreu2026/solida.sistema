// Teste das regras do os-wpp.mjs (sem rede): node scripts/os-wpp.teste.mjs
import { lerPedidoOS, processar, MARCA } from './os-wpp.mjs';
import assert from 'node:assert/strict';
const pos = [{ codigo: 'PO420', cliente: 'Luciana' }, { codigo: 'PO318', cliente: 'Thiago Abrahão' }];
const m = (id, autor, texto, hora = '10:00') => ({ id, autor, data: '2026-11-18', hora, texto });

assert.equal(lerPedidoOS('bom dia pessoal, tudo certo?'), null);
assert.equal(lerPedidoOS(`${MARCA} Maria, para abrir a OS preciso de: ...`), null);
const a = lerPedidoOS('Nova OS PO420 - infiltração no banheiro. Problema: mancha de umidade no teto');
assert.equal(a.po, 'PO420'); assert.equal(a.assunto, 'infiltração no banheiro'); assert.match(a.problema, /mancha de umidade/);
const b = lerPedidoOS('OS PO - Carol: trocar fechadura da porta de entrada. Endereço: Rua das Acácias 193');
assert.equal(b.po, 'PO - Carol'); assert.equal(b.cliente, 'Carol'); assert.equal(b.endereco, 'Rua das Acácias 193'); assert.match(b.assunto, /trocar fechadura/);

// 1) pedido completo de PO existente → cria direto
let r = processar({ mensagens: [m('1', 'Enio', 'Nova OS PO420 - infiltração no banheiro. Problema: mancha no teto')], estado: {}, pos });
assert.equal(r.acoes.length, 1); assert.equal(r.acoes[0].tipo, 'criar'); assert.equal(r.acoes[0].campos.po, 'PO420'); assert.equal(r.acoes[0].campos.novoPO, false);
// a mesma mensagem não é tratada duas vezes
const r1b = processar({ mensagens: [m('1', 'Enio', 'Nova OS PO420 - infiltração no banheiro')], estado: r.estado, pos }); assert.equal(r1b.acoes.length, 0);
// 2) PO novo com endereço → cria o PO e a OS
r = processar({ mensagens: [m('2', 'Pedro', 'OS PO - Carol: trocar fechadura da porta. Endereço: Rua das Acácias 193')], estado: {}, pos });
assert.equal(r.acoes[0].tipo, 'criar'); assert.equal(r.acoes[0].campos.novoPO, true);
// 3) falta o PO → pergunta; a resposta completa e cria
r = processar({ mensagens: [m('3', 'Pedro', 'Nova OS troca de piso na cozinha')], estado: {}, pos });
assert.equal(r.acoes[0].tipo, 'perguntar'); assert.deepEqual(r.acoes[0].faltam, ['po']); assert.match(r.acoes[0].texto, /Qual é o PO/);
const r3 = processar({ mensagens: [m('4', 'Pedro', 'PO420', '10:05')], estado: r.estado, pos });
assert.equal(r3.acoes[0].tipo, 'criar'); assert.equal(r3.acoes[0].campos.po, 'PO420'); assert.match(r3.acoes[0].campos.assunto, /troca de piso/); assert.equal(r3.estado.pendentes.length, 0);
// 4) PO novo sem cliente e sem endereço → pergunta os dois; resposta rotulada cria
r = processar({ mensagens: [m('5', 'Enio', 'Abrir OS PO999 vazamento na garagem')], estado: {}, pos });
assert.equal(r.acoes[0].tipo, 'perguntar'); assert.deepEqual(r.acoes[0].faltam, ['cliente', 'endereco']);
const r4 = processar({ mensagens: [m('6', 'Enio', 'cliente: João Paulo\nendereço: Rua A 10, Gávea', '10:07')], estado: r.estado, pos });
assert.equal(r4.acoes[0].tipo, 'criar'); assert.equal(r4.acoes[0].campos.cliente, 'João Paulo'); assert.equal(r4.acoes[0].campos.endereco, 'Rua A 10, Gávea');
// 5) conversa comum e mensagem do próprio sistema não criam nada; resposta de OUTRA pessoa não completa o pedido de quem foi cobrado
r = processar({ mensagens: [m('7', 'Rose', 'bom dia'), m('8', 'Sistema', `${MARCA} x`)], estado: {}, pos }); assert.equal(r.acoes.length, 0);
const p1 = processar({ mensagens: [m('9', 'Pedro', 'Nova OS troca de piso')], estado: {}, pos });
const p2 = processar({ mensagens: [m('10', 'Rose', 'PO420', '10:06')], estado: p1.estado, pos }); assert.equal(p2.acoes.length, 0);
console.log('ok: todas as regras do os-wpp passaram');
