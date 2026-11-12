-- Correção (13/11/2026): a pendência de cada OS usava sempre origem = 'os_quadro', e o índice pendencias_origem_unica só deixa uma.
-- A 2ª OS com responsável ou data limite dava "duplicate key value violates unique constraint". Agora a origem é única por OS: 'os_quadro:OS-035'.
-- (A função os_quadro_pendencia() foi recriada no Supabase com essa mudança; ver 12-os-quadro.sql para o resto do corpo.)
update public.pendencias set origem = 'os_quadro:' || os where origem = 'os_quadro' and os is not null;
