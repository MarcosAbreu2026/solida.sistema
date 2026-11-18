// Teste do dicionário de cômodos: node app/js/comodos.teste.mjs
import assert from 'node:assert/strict';
import { ehComodo, comodoDe, pendenciaDaObra, assuntoDaDescricao } from './comodos.js';
const sim = ['Cozinha', 'COZINHA', 'cozinha americana', 'Área de serviço', 'area de servico', 'ÁREA SERVIÇO', 'area servico', 'A/S', 'a/s', 'AS', 'A.S.', 'A. S.', 'Ar. serviço', 'A serviço', 'Serviço', 'lavanderia',
  'Banheiro', 'banheiro social', 'BWC', 'WC', 'Bho 2', 'Lavabo', 'Qto 2', 'Quarto de casal', 'quarto de hóspedes', 'Quarto 1', 'Suíte', 'suite master', 'Suite 2', 'Master', 'Closet',
  'Sala', 'Sala de estar', 'sala de jantar', 'SL', 'Sala e cozinha', 'Cozinha/copa', 'Varanda', 'Varanda gourmet', 'Sacada', 'Terraço', 'Área gourmet', 'area gourmet', 'Churrasqueira',
  'Hall de entrada', 'Hall', 'Corredor', 'Escada', 'Garagem', 'Jardim', 'Piscina', 'Fachada', 'Cobertura', 'Laje', 'Telhado', 'Dependência', 'Dep. empregada', 'Quarto de empregada',
  'Escritório', 'Home office', 'Despensa', 'Adega', 'Banheiros', 'Quartos', 'Suítes', 'Área externa', 'Areas comuns', 'Dormitório', 'Home theater', 'Banheiro da suíte', 'Quarto 2 B'];
const nao = ['ACM', 'PLANILHA FINANCEIRA', 'Mo358', 'PO420', 'Retirar da área gourmet', 'COBRANÇA', 'Reunião', 'Cliente', 'PINTURA', 'ELÉTRICA', 'Orçamento da cozinha', 'Pedir material', 'Marcenaria', 'Esquadria', 'As pinturas', 'Ver pedra do topo', '', 'a', 'de'];
for (const t of sim) assert.ok(ehComodo(t), `deveria ser cômodo: "${t}"`);
for (const t of nao) assert.ok(!ehComodo(t), `NÃO deveria ser cômodo: "${t}"`);
assert.equal(comodoDe('A/S'), 'Área de serviço'); assert.equal(comodoDe('Ar. serviço'), 'Área de serviço'); assert.equal(comodoDe('Qto 2'), 'Quarto'); assert.equal(comodoDe('BWC'), 'Banheiro');
assert.equal(assuntoDaDescricao('COZINHA, trocar o puxador'), 'COZINHA'); assert.equal(pendenciaDaObra('A/S, trocar o tanque'), true); assert.equal(pendenciaDaObra('ACM, retirar da área gourmet'), false); assert.equal(pendenciaDaObra('sem assunto aqui'), false);
console.log(`ok: ${sim.length} cômodos reconhecidos e ${nao.length} não-cômodos recusados`);
