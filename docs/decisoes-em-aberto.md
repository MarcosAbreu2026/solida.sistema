# Decisões em aberto — perguntar ao Felipe antes de decidir

## Já respondidas (13/10/2026)
- **1. Onde roda:** web (navegador/celular). Fase 1 roda local com `iniciar.bat`; hospedagem fica para depois.
- **3. Fonte dos dados na fase 1:** JSON exportado, por enquanto. Felipe perguntou se isso depende de um PC
  (sim: alguém roda o script quando a planilha muda). Ler direto do Drive continua em aberto; a troca fica isolada em `app/js/dados.js`.
- **5. Acesso na fase 1:** sem login. Seletor Sócio/Funcionário igual ao do Painel da Empresa (Funcionário não vê R$);
  é só uma troca de visão, não é segurança. Login de verdade entra na Fase 2.
- **Visual e estrutura:** o sistema segue o Painel da Empresa (Solida.exe): barra lateral com Visão geral e os 8 setores,
  mesmas cores, fonte e logo. O Pós-obra é um setor; os outros aparecem como "Aguardando" até as próximas fases.
- **6. Diária do Arthur:** ainda não informada; o sistema mostra o aviso e conta R$ 0,00.

- **(14/10) Acessos:** login individual com usuário e senha, por função; hospedagem Supabase + Vercel grátis;
  leitura do WhatsApp (realizado × meta) feita pelos agentes. Detalhes em `docs/acessos-e-funcoes.md`.

## Ainda em aberto
- Lista de pessoas (nome, usuário, função, obras) — Felipe vai mandar.
- Revisão das tarefas de cada função (montadas a partir do POP R14).
- Aba de instruções e treinamentos (depois).

1. **Onde o sistema roda:** web (acessa pelo navegador/celular) ou executável Windows como o Painel da Empresa atual? (Fase 2 com várias pessoas preenchendo pede web + banco de dados.)
2. **Relação com o Painel da Empresa:** este sistema substitui o painel atual (dados.json no Drive) ou o pós-obra vira mais uma fonte para ele?
3. **Fonte dos dados na fase 1:** ler a planilha direto do Google Drive, ou exportar JSON (script em `scripts/`) e publicar?
4. **Hospedagem e custo:** há orçamento para servidor/banco (ex.: Supabase, Vercel, Google Cloud)? Requisito fixo: sem API de IA paga.
5. **Acesso:** quem vê o quê (sócios, Ênio, equipe do pós-obra, outros setores). Login com Google da empresa?
6. **Valor da diária do Arthur (PJ).**
7. **Agenda:** manter texto livre (como a PAS no WhatsApp) ou passar a escolher profissionais de uma lista?
8. **Divergências entre operação e cobrança** (Junior drenagem, Po88, ArpoBrasil): qual planilha é a referência quando discordarem?
