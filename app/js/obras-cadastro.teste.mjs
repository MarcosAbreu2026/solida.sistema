import { aplicarCadastroNasObras } from './obras-cadastro.js';
const cfg = { areas: [{ porObra: ['Mo565', 'Mo565C', 'Mo565P', 'Mo565D', 'Mo358', 'Mo602', 'Mo999'].map((obra) => ({ obra })) }], obras: ['Mo565C', 'Mo358'] };
aplicarCadastroNasObras({ cfg, obrasCad: [{ codigo: 'Mo565', situacao: 'finalizada' }, { codigo: 'Mo565D', situacao: 'finalizada' }, { codigo: 'Mo358', situacao: 'andamento' }, { codigo: 'Mo602', situacao: 'andamento' }] });
const r = cfg.areas[0].porObra.map((o) => o.obra).join(',');
if (r !== 'Mo358,Mo602,Mo999') throw new Error('falhou: ' + r);
console.log('ok', r, cfg.obras.join(','));
