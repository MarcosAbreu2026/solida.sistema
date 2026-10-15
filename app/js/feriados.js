// Feriados que param as obras no Rio de Janeiro (nacionais, estaduais RJ e municipais da cidade do Rio).
// Usados para dividir a programação semanal só pelos dias úteis. Conferir a lista todo ano.
// Carnaval e Quarta de Cinzas são ponto facultativo: entraram como feriado por costume das obras.

const FERIADOS = {
  '2026-01-01': 'Confraternização Universal',
  '2026-01-20': 'São Sebastião (Rio)',
  '2026-02-16': 'Carnaval',
  '2026-02-17': 'Carnaval',
  '2026-04-03': 'Sexta-feira Santa',
  '2026-04-21': 'Tiradentes',
  '2026-04-23': 'São Jorge (RJ)',
  '2026-05-01': 'Dia do Trabalho',
  '2026-06-04': 'Corpus Christi',
  '2026-09-07': 'Independência',
  '2026-10-12': 'Nossa Senhora Aparecida',
  '2026-10-19': 'Dia do Comerciário (RJ)',
  '2026-11-02': 'Finados',
  '2026-11-15': 'Proclamação da República',
  '2026-11-20': 'Consciência Negra',
  '2026-12-25': 'Natal',
  '2027-01-01': 'Confraternização Universal',
  '2027-01-20': 'São Sebastião (Rio)',
  '2027-02-08': 'Carnaval',
  '2027-02-09': 'Carnaval',
  '2027-03-26': 'Sexta-feira Santa',
  '2027-04-21': 'Tiradentes',
  '2027-04-23': 'São Jorge (RJ)',
  '2027-05-01': 'Dia do Trabalho',
  '2027-05-27': 'Corpus Christi',
  '2027-09-07': 'Independência',
  '2027-10-12': 'Nossa Senhora Aparecida',
  '2027-10-18': 'Dia do Comerciário (RJ)',
  '2027-11-02': 'Finados',
  '2027-11-15': 'Proclamação da República',
  '2027-11-20': 'Consciência Negra',
  '2027-12-25': 'Natal',
};

export const feriado = (iso) => FERIADOS[iso] || null;
