// Onde cada ata vai no Drive (pedido do Felipe, 11/11/2026):
//   ata de OBRA (Mo…)      →  OPERACOES\OBRAS\<MoXXX_...>\GERENCIAMENTO\ATAS
//   ata de PÓS-OBRA (Po…)  →  PÓS OBRA\PO_OBRAS\<ano atual>\<pasta do pós-obra>\GERENCIAMENTO\ATAS   (a pasta do pós-obra é criada se não existir)
//   ata de DEPARTAMENTO (sem obra)  →  <pasta do departamento>\GERENCIAMENTO\ATAS   (GERENCIAMENTO e ATAS são criadas se faltarem)
// Só calcula o caminho (e se ele já existe); quem cria a pasta é quem grava o PDF.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sub = (dir, teste) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).find(teste) : undefined);
const limpaNome = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

// departamento (setor da ata) → pasta de primeiro nível do Drive. Os setores sem pasta própria ficam na mais próxima (ver comentários).
export const PASTA_DO_SETOR = {
  'Operação': 'OPERACOES', 'Técnico / qualidade': 'OPERACOES',
  'Pós-obra': 'PÓS OBRA',
  'Suprimentos e compras': 'COMPRAS', 'Transporte e logística': 'COMPRAS', 'Ferramentas / EPI': 'COMPRAS',
  'Projetos': 'PROJETOS', 'Planejamento': 'PLANEJAMENTO',
  'Comercial': 'ORÇAMENTOS', 'ORC Terceirizado Laranja': 'ORÇAMENTOS', 'ORC Obras Novas': 'ORÇAMENTOS',
  'Marketing': 'MARKETING SOLIDA', 'Novos negócios': 'SOLIDA', 'Diretoria / geral': 'SOLIDA',
  'Financeiro': 'FINANCEIRO GERAL', 'RH': 'RH GERAL', 'Administrativo': 'ADM GERAL',
};

const acharTopo = (drive, nome) => sub(drive, (x) => norm(x) === norm(nome));
function gerenciamentoAtas(pastaBase) {
  const ger = join(pastaBase, sub(pastaBase, (x) => /^gerenciamento$/i.test(x)) || 'GERENCIAMENTO');
  const ata = join(ger, sub(ger, (x) => /^atas?$/i.test(x)) || 'ATAS');
  return { pasta: ata, existe: existsSync(ata) };
}

// a = { obra, setor }; devolve { pasta, existe } ou null (com motivo em .erro)
// obrasCad = obras do cadastro do sistema ([{ codigo, nome }]): obra cadastrada que ainda não tem pasta em OPERACOES\\OBRAS ganha a pasta
export function pastaDaAta(drive, a, anoAtual = String(new Date().getFullYear()), obrasCad = []) {
  const obra = String(a.obra || '').trim();
  if (obra) {
    const cod = norm(obra).replace(/_/g, '').replace(/\s+/g, '');
    if (/^mo/i.test(obra)) {
      const base = join(drive, 'OPERACOES', 'OBRAS');
      const n = sub(base, (x) => /^mo\d/i.test(x) && norm(x).replace(/_/g, '').replace(/\s+/g, '').startsWith(cod));
      if (n) return gerenciamentoAtas(join(base, n));
      // obra já cadastrada no sistema mas sem pasta em OPERACOES\\OBRAS: cria a pasta (<codigo>_<nome>)
      const cad = (obrasCad || []).find((o) => norm(o.codigo).replace(/\s+/g, '') === cod);
      if (!cad) return { erro: `a obra ${obra} não tem pasta em OPERACOES\\OBRAS e não está no cadastro do sistema` };
      const nomePasta = limpaNome(`${cad.codigo}${cad.nome ? `_${cad.nome}` : ''}`);
      return { pasta: join(base, nomePasta, 'GERENCIAMENTO', 'ATAS'), existe: false, criaPastaDaObra: true };
    }
    // pós-obra: PÓS OBRA\PO_OBRAS\<ano atual>\<pasta do pós-obra>; se o pós-obra não tem pasta, cria
    const topo = acharTopo(drive, 'PÓS OBRA') || 'PÓS OBRA';
    const poObras = join(drive, topo, sub(join(drive, topo), (x) => /^po_obras$/i.test(x)) || 'PO_OBRAS');
    const anos = existsSync(poObras) ? readdirSync(poObras, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name)).map((e) => e.name).sort().reverse() : [];
    for (const ano of anos) {   // pasta já existente (do ano atual ou de anos anteriores)
      const n = sub(join(poObras, ano), (x) => norm(x).replace(/_/g, '').replace(/\s+/g, '').startsWith(cod));
      if (n) return gerenciamentoAtas(join(poObras, ano, n));
    }
    const pastaNova = join(poObras, anoAtual, limpaNome(obra));
    return { pasta: join(pastaNova, 'GERENCIAMENTO', 'ATAS'), existe: false, criaPastaDoPosObra: true };
  }
  const topoNome = PASTA_DO_SETOR[a.setor];
  if (!topoNome) return { erro: `o departamento "${a.setor || '—'}" ainda não tem pasta definida no Drive` };
  const topo = acharTopo(drive, topoNome);
  if (!topo) return { erro: `não achei a pasta ${topoNome} no Drive (departamento ${a.setor})` };
  return gerenciamentoAtas(join(drive, topo));
}
