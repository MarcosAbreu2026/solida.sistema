// Gravar a reunião e transcrever ao vivo, com o reconhecimento de voz do próprio navegador (Chrome ou Edge), em português do Brasil.
// Gratuito e sem instalar nada; o áudio passa pelo serviço de voz do navegador. Se o reconhecimento parar sozinho (reunião longa),
// religa. A transcrição fica guardada aqui enquanto a página estiver aberta.
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const suportado = !!SR;

let rec = null; let ativo = false; let finais = ''; let parcial = '';
export const gravando = () => ativo;
export const textoAtual = () => (finais + parcial).trim();
export const definirTexto = (t) => { finais = t ? `${String(t).trim()} ` : ''; parcial = ''; };

// aoTexto(texto) a cada novo trecho; aoEstado('gravando' | 'religando' | 'negado' | 'parado' | 'erro:...')
export function iniciar({ aoTexto, aoEstado }) {
  if (!SR) throw new Error('Este navegador não grava e transcreve a voz. Use o Chrome ou o Edge.');
  if (ativo) return;
  rec = new SR(); rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = true;
  rec.onresult = (e) => {
    parcial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finais += `${r[0].transcript.trim()}. `; else parcial += r[0].transcript;
    }
    aoTexto(textoAtual());
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { ativo = false; aoEstado('negado'); }
    else if (e.error !== 'no-speech' && e.error !== 'aborted') aoEstado(`erro:${e.error}`);
  };
  rec.onend = () => {
    if (ativo) { try { rec.start(); aoEstado('gravando'); } catch { setTimeout(() => { if (ativo) { try { rec.start(); } catch { /* tenta de novo no próximo fim */ } } }, 500); } }
    else aoEstado('parado');
  };
  ativo = true;
  try { rec.start(); aoEstado('gravando'); } catch (err) { ativo = false; throw err; }
}
export function parar() { ativo = false; parcial = ''; try { if (rec) rec.stop(); } catch { /* já parado */ } }
