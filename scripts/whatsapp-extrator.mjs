// Função que roda DENTRO da página do WhatsApp Web (é enviada como texto ao navegador) e devolve as mensagens carregadas
// da conversa aberta. Só lê o que está na tela; não clica, não envia e não baixa nada.
// Retorna { titulo, mensagens: [{ id, autor, data, hora, texto, midia, encaminhada, minha }] }

export function extrair() {
  const hoje = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const dataDoRotulo = (t) => {
    const x = semAcento(t).trim();
    let m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    if (x === 'hoje') return iso(hoje);
    if (x === 'ontem') { const d = new Date(hoje); d.setDate(d.getDate() - 1); return iso(d); }
    const i = DIAS.findIndex((n) => semAcento(n) === x);
    if (i >= 0) { const d = new Date(hoje); let volta = (d.getDay() - i + 7) % 7; if (volta === 0) volta = 7; d.setDate(d.getDate() - volta); return iso(d); }
    return null;
  };
  const main = document.querySelector('#main');
  if (!main) return { titulo: '', mensagens: [] };
  const tEl = main.querySelector('[data-testid="conversation-info-header-chat-title"]') || main.querySelector('header span[title]');
  const titulo = ((tEl && (tEl.innerText || tEl.title)) || '').trim();
  const mensagens = [];
  let dataAtual = null; let ultimoAutor = '';
  main.querySelectorAll('[role="row"], span').forEach((linha) => {
    if (!linha.matches('[role="row"]')) { if (!linha.closest('[role="row"]') && !linha.children.length) { const rot = dataDoRotulo(linha.innerText); if (rot) dataAtual = rot; } return; }   // rótulo de data (Hoje, Ontem, quinta-feira, 14/10/2026)
    const caixa = linha.querySelector('div[data-id]'); if (!caixa) return;
    const id = caixa.getAttribute('data-id'); if (!id) return;
    const pre = caixa.querySelector('[data-pre-plain-text]');
    let autor = ''; let data = dataAtual; let hora = '';
    if (pre) {
      const m = pre.getAttribute('data-pre-plain-text').match(/^\[(\d{1,2}):(\d{2}), (\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.*?):\s*$/);
      if (m) { hora = `${pad(m[1])}:${m[2]}`; data = `${m[5]}-${pad(m[4])}-${pad(m[3])}`; autor = m[6]; }
    }
    const bruto = (caixa.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!hora) { const h = [...bruto].reverse().find((s) => /^\d{1,2}:\d{2}$/.test(s)); if (h) { const [a, b] = h.split(':'); hora = `${pad(a)}:${b}`; } }
    const minha = /^true_/.test(id);
    const encaminhada = bruto.some((s) => /^encaminhada$/i.test(s));
    if (!autor) {
      if (minha) autor = 'Você';
      else { const p = bruto[0] && !/^(encaminhada|\d{1,2}:\d{2})$/i.test(bruto[0]) && bruto[0].length < 40 ? bruto[0] : ''; autor = p || ultimoAutor || titulo; }
    }
    ultimoAutor = autor;
    const campos = [...(pre || caixa).querySelectorAll('span.selectable-text')];   // o último é o texto da própria mensagem (o primeiro pode ser a citação de outra)
    const texto = campos.length ? campos[campos.length - 1].innerText.trim() : '';
    let midia = '';
    if (caixa.querySelector('img[src^="blob:"], [data-icon="media-play"], [data-icon="image"]')) midia = 'imagem';
    if (caixa.querySelector('[data-icon*="document"], [data-icon="ic-description"]') || /\.pdf\b/i.test(bruto.join(' '))) midia = midia || 'documento';
    if (caixa.querySelector('[data-icon="audio-play"], [data-icon="ptt-status"]')) midia = 'audio';
    mensagens.push({ id, autor, data, hora, texto, midia, encaminhada, minha });
  });
  return { titulo, mensagens };
}
