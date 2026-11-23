-- contato e lista de lojas cotando (vindos da planilha), para o quadro funcionar mesmo antes do envio do Drive
alter table public.terc_itens add column if not exists contato text, add column if not exists lojas text;
