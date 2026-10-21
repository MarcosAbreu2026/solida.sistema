// Gravar a reunião e transcrever ao vivo, com o reconhecimento de voz do próprio navegador (Chrome ou Edge), em português do Brasil.
// Gratuito e sem instalar nada; o áudio passa pelo serviço de voz do navegador. Se o reconhecimento parar sozinho (reunião longa),
// religa. A transcrição fica guardada aqui enquanto a página estiver aberta.
const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const suportado = !!SR;

let rec = null; let ativo = false; let finais = ''; let parcial = '';
// gravação do áudio (para a transcrição de qualidade, feita no computador do escritório)
let gravador = null; let fluxo = null; let pedacos = []; let inicio = 0;
export const gravaAudio = typeof MediaRecorder !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
export const gravando = () => ativo;
export const textoAtual = () => (finais + parcial).trim();
export const definirTexto = (t) => { finais = t ? `${String(t).trim()} ` : ''; parcial = ''; };

// aoTexto(texto) a cada novo trecho; aoEstado('gravando' | 'religando' | 'negado' | 'parado' | 'erro:...')
export function iniciar({ aoTexto, aoEstado }) {
  if (!SR && !gravaAudio) throw new Error('Este navegador não grava a voz. Use o Chrome ou o Edge.');
  if (ativo) return;
  if (!SR) { ativo = true; aoEstado('gravando'); iniciarAudio(); return; }   // sem transcrição ao vivo, mas grava o áudio para transcrever no escritório
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
  iniciarAudio();
}
function iniciarAudio() {
  if (!gravaAudio) return;
  pedacos = []; inicio = Date.now();
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((s) => {
    if (!ativo) { s.getTracks().forEach((t) => t.stop()); return; }
    fluxo = s; const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    gravador = new MediaRecorder(s, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : undefined);
    gravador.ondataavailable = (e) => { if (e.data && e.data.size) pedacos.push(e.data); };
    gravador.start(10000);   // pedaços de 10 s: se algo falhar, o que já foi gravado não se perde
  }).catch(() => { /* sem microfone para gravar o áudio: fica só a transcrição ao vivo */ });
}
// para a transcrição ao vivo e a gravação; devolve o áudio gravado ({ blob, duracaoS }) ou null
export function parar() {
  ativo = false; parcial = ''; try { if (rec) rec.stop(); } catch { /* já parado */ }
  return new Promise((resolve) => {
    const g = gravador; const s = fluxo; gravador = null; fluxo = null;
    const fim = () => { if (s) s.getTracks().forEach((t) => t.stop()); const blob = pedacos.length ? new Blob(pedacos, { type: (g && g.mimeType) || 'audio/webm' }) : null; const dur = Math.round((Date.now() - inicio) / 1000); pedacos = []; resolve(blob && blob.size > 1000 ? { blob, duracaoS: dur } : null); };
    if (g && g.state !== 'inactive') { g.onstop = fim; try { g.stop(); } catch { fim(); } } else fim();
  });
}
