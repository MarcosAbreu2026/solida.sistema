// Transcreve as reuniões gravadas (qualquer computador grava e envia o áudio; este computador, o do escritório, transcreve).
// Pega as gravações "pendentes" no banco, baixa o áudio, converte (ffmpeg), transcreve com o Whisper local (whisper.cpp, sem custo e
// sem mandar o áudio para outro serviço) e devolve o texto para o sistema. Roda em segundo plano, aberto pelo coletor:
// uma reunião longa demora (o computador fica trabalhando), por isso há um arquivo de trava para não rodar duas vezes.
//   node scripts/transcrever-reunioes.mjs            normal
//   node scripts/transcrever-reunioes.mjs --arquivo caminho.wav   teste: transcreve um arquivo e mostra o texto (não mexe no banco)
// Para trocar de computador: rode scripts/instalar-whisper.ps1 no computador novo (baixa o Whisper, o modelo e o ffmpeg).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2); const arqTeste = args.includes('--arquivo') ? args[args.indexOf('--arquivo') + 1] : null;
const log = (...x) => console.log(`[${new Date().toLocaleString('pt-BR')}]`, ...x);
process.on('uncaughtException', (e) => { log(`Transcrição parou: ${(e.cause && e.cause.code) || e.message}`); soltar(); process.exit(1); });

// ---- programas
function achar(dir, nome) { if (!existsSync(dir)) return null; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { const r = achar(p, nome); if (r) return r; } else if (e.name.toLowerCase() === nome) return p; } return null; }
const WHISPER = achar(join(raiz, 'ferramentas', 'whisper'), 'whisper-cli.exe');
const FFMPEG = achar(join(raiz, 'ferramentas', 'ffmpeg'), 'ffmpeg.exe');
const MODELO = ['ggml-medium.bin', 'ggml-small.bin', 'ggml-base.bin'].map((n) => join(raiz, 'ferramentas', 'whisper', 'modelos', n)).find((p) => existsSync(p));
if (!WHISPER || !FFMPEG || !MODELO) { log('Whisper, ffmpeg ou modelo não instalados neste computador. Rode scripts/instalar-whisper.ps1.'); process.exit(0); }
const NOME_MODELO = MODELO.split(/[\\/]/).pop().replace(/^ggml-|\.bin$/g, '');
// vocabulário da Sólida: ajuda o Whisper a acertar termos de obra e nomes
const DICA = 'Reunião de obras da Sólida Construção, Rio de Janeiro. Obras Mo344, Mo531, Mo533, Mo566, Mo581, Mo465, Mo358. Marcenaria, mármore, ar-condicionado, ACM, esquadrias, luminárias, aditivo, pendência, informativo, terceirizado, pós-obra, cronograma, medição, entrega. Márcio, Júlia, Simone, Mariana, Marcos, Pedro, Larissa, Enio, Agatha, Fernanda, Umber, Light Design.';

function transcrever(wav, saidaBase) {
  const r = spawnSync(WHISPER, ['-m', MODELO, '-f', wav, '-l', 'pt', '-nt', '-otxt', '-of', saidaBase, '-t', String(Math.max(2, Math.min(8, (await_cpus())))), '--prompt', DICA], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const txt = `${saidaBase}.txt`;
  if (!existsSync(txt)) throw new Error(`o Whisper não gerou texto (${(r.stderr || r.error || '').toString().slice(-200)})`);
  return readFileSync(txt, 'utf8').replace(/\s+/g, ' ').trim();
}
function await_cpus() { return Number(process.env.NUMBER_OF_PROCESSORS || 4) - 1; }
function converter(entrada, wav) {
  const r = spawnSync(FFMPEG, ['-y', '-i', entrada, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { encoding: 'utf8' });
  if (!existsSync(wav)) throw new Error(`não consegui converter o áudio (${(r.stderr || '').slice(-200)})`);
}

// ---- teste com um arquivo
if (arqTeste) {
  const wav = join(raiz, 'dados', 'audios', 'teste.wav'); mkdirSync(dirname(wav), { recursive: true }); converter(arqTeste, wav);
  const t0 = Date.now(); const texto = transcrever(wav, join(raiz, 'dados', 'audios', 'teste'));
  log(`modelo ${NOME_MODELO}, ${Math.round((Date.now() - t0) / 1000)}s`); console.log(texto); process.exit(0);
}

// ---- trava: só uma transcrição por vez
const TRAVA = join(raiz, 'dados', 'transcricao.lock');
function vivo(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
if (existsSync(TRAVA)) { const pid = Number(readFileSync(TRAVA, 'utf8')); if (pid && vivo(pid) && Date.now() - statSync(TRAVA).mtimeMs < 12 * 3600 * 1000) process.exit(0); }
mkdirSync(join(raiz, 'dados'), { recursive: true }); writeFileSync(TRAVA, String(process.pid));
function soltar() { try { rmSync(TRAVA, { force: true }); } catch { /* já solta */ } }

// ---- banco
const cfg = JSON.parse(readFileSync(join(raiz, 'config.local.json'), 'utf8').replace(/^﻿/, ''));
const r0 = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: cfg.chavePublica, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: cfg.coletorEmail, password: cfg.coletorSenha }) });
if (!r0.ok) { log(`não entrei com a conta do coletor (${r0.status})`); soltar(); process.exit(1); }
const token = (await r0.json()).access_token;
const H = { apikey: cfg.chavePublica, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const rest = async (caminho, opts = {}) => { const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${caminho}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } }); if (!r.ok) throw new Error(`${caminho.split('?')[0]}: ${r.status} ${await r.text()}`); return r.status === 204 ? null : r.json(); };
const patch = (id, corpo) => rest(`gravacoes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(corpo) });

const pendentes = await rest('gravacoes?select=*&status=in.(pendente,transcrevendo)&order=id');
if (!pendentes.length) { soltar(); process.exit(0); }
const pasta = join(raiz, 'dados', 'audios'); mkdirSync(pasta, { recursive: true });
for (const g of pendentes) {
  log(`Transcrevendo a gravação ${g.id} (${g.duracao_s ? `${Math.round(g.duracao_s / 60)} min` : 'duração desconhecida'}) com o modelo ${NOME_MODELO}…`);
  const entrada = join(pasta, `${g.id}.audio`); const wav = join(pasta, `${g.id}.wav`); const base = join(pasta, `${g.id}`);
  try {
    await patch(g.id, { status: 'transcrevendo', erro: null });
    const d = await fetch(`${cfg.supabaseUrl}/storage/v1/object/audios/${g.audio}`, { headers: { apikey: cfg.chavePublica, Authorization: `Bearer ${token}` } });
    if (!d.ok) throw new Error(`não achei o áudio no armazenamento (${d.status})`);
    writeFileSync(entrada, Buffer.from(await d.arrayBuffer()));
    converter(entrada, wav);
    const t0 = Date.now(); const texto = transcrever(wav, base);
    await patch(g.id, { status: 'pronta', texto, modelo: NOME_MODELO, transcrita_em: new Date().toISOString(), erro: null });
    log(`Gravação ${g.id} pronta em ${Math.round((Date.now() - t0) / 1000)}s (${texto.split(' ').length} palavras).`);
  } catch (e) {
    log(`Gravação ${g.id} com erro: ${e.message}`);
    try { await patch(g.id, { status: 'erro', erro: String(e.message).slice(0, 300) }); } catch { /* sem banco */ }
  } finally { for (const f of [entrada, wav, `${base}.txt`]) { try { rmSync(f, { force: true }); } catch { /* temporário */ } } }
}
soltar();
