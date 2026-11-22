/* Modo Explorador: missões, XP, conquistas, caça às formas 3D, sons e prêmio */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const { esc, ls, CONFIG } = window.DB;
const JF = window.JF || {};
const mobile = matchMedia('(pointer:coarse)').matches;

const MISSOES = [
  { id: 'explorar', ic: '🚀', nome: 'Primeiros passos', desc: 'Role até a seção Sobre', xp: 50 },
  { id: 'caca', ic: '🎯', nome: 'Caçador de formas', desc: `${mobile ? 'Toque' : 'Clique'} em 5 formas 3D que flutuam pela página`, xp: 200, meta: 5 },
  { id: 'projetos', ic: '🖼️', nome: 'Curador', desc: 'Veja os 4 projetos do carrossel', xp: 100, meta: 4 },
  { id: 'criar', ic: '✨', nome: 'Visionário', desc: 'Monte a prévia do seu site', xp: 200 },
  { id: 'quiz', ic: '🧠', nome: 'Autoconhecimento', desc: 'Termine o quiz "Qual site é ideal"', xp: 150 },
  { id: 'cor', ic: '🎨', nome: 'Artista', desc: 'Troque a cor do site (botão no canto)', xp: 50 },
  { id: 'faq', ic: '❓', nome: 'Curioso', desc: 'Abra uma pergunta frequente', xp: 50 },
];
const NIVEIS = [[0, 'Visitante'], [150, 'Explorador'], [400, 'Pioneiro'], [800, 'Lenda']];
const CAP_FORMAS = 300; // XP máximo vindo de formas (10 por forma)

const S = Object.assign({ xp: 0, feitas: {}, caca: 0, xpFormas: 0, proj: [], premio: false, som: false, aberto: false }, ls.get('jf-jogo', {}) || {});
const salva = () => ls.set('jf-jogo', S);
const nivel = () => { let n = NIVEIS[0], prox = null; NIVEIS.forEach((l, i) => { if (S.xp >= l[0]) { n = l; prox = NIVEIS[i + 1] || null; } }); return { nome: n[1], base: n[0], prox }; };
const feitas = () => MISSOES.filter((m) => S.feitas[m.id]).length;

/* ---------- som (WebAudio, desligado por padrão) ---------- */
let ac = null;
function tom(freq, dur = 0.12, tipo = 'sine', vol = 0.08, quando = 0) {
  if (!S.som) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime + quando, o = ac.createOscillator(), g = ac.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
const somAcerto = (n) => tom(520 + n * 60, 0.12, 'triangle', 0.07);
const somConquista = () => [660, 880, 1320].forEach((f, i) => tom(f, 0.18, 'sine', 0.07, i * 0.09));
const somVitoria = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tom(f, 0.25, 'triangle', 0.08, i * 0.11));

/* ---------- confete ---------- */
const cv = document.createElement('canvas'); cv.className = 'confete'; document.body.appendChild(cv);
const cx = cv.getContext('2d'); let pecas = [], animando = false;
function confete(n = 140, x = innerWidth / 2, y = innerHeight * 0.35) {
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const h = +getComputedStyle(document.documentElement).getPropertyValue('--h') || 255;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
    pecas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, hh: 3 + Math.random() * 5, c: `hsl(${[h, (h + 294) % 360, 45, 150][i % 4]} 90% 65%)`, vida: 1 });
  }
  if (!animando) { animando = true; requestAnimationFrame(passo); }
}
function passo() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  pecas.forEach((p) => { p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vida -= 0.006;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.max(0, p.vida); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.hh / 2, p.w, p.hh); cx.restore(); });
  pecas = pecas.filter((p) => p.vida > 0 && p.y < innerHeight + 40);
  if (pecas.length) requestAnimationFrame(passo); else { animando = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
}

/* ---------- HUD ---------- */
const hud = document.createElement('div');
hud.className = 'hud'; hud.innerHTML = `<button class="hud-pill" id="hudPill" aria-expanded="false" aria-controls="hudPanel"><span class="hud-bolt">⚡</span><b id="hudXp">0 XP</b><span id="hudNv"></span><span class="hud-ring" id="hudRing"></span></button>
  <div class="hud-panel" id="hudPanel" hidden role="dialog" aria-label="Missões"></div>`;
document.body.appendChild(hud);
const pill = $('#hudPill'), panel = $('#hudPanel');

function renderHud(bump) {
  const n = nivel(), f = feitas();
  $('#hudXp').textContent = `${S.xp} XP`;
  $('#hudNv').textContent = `${n.nome} · ${f}/${MISSOES.length}`;
  const pct = n.prox ? (S.xp - n.base) / (n.prox[0] - n.base) : 1;
  $('#hudRing').style.setProperty('--p', Math.round(pct * 100));
  if (bump) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
  const cup = CONFIG.cupomExplorador && CONFIG.cupons && CONFIG.cupons[CONFIG.cupomExplorador] ? CONFIG.cupomExplorador : '';
  panel.innerHTML = `<div class="hud-top"><div><small>Modo Explorador</small><b>${n.nome}</b></div><button class="x" data-hx aria-label="Fechar">×</button></div>
    <div class="hud-bar"><i style="width:${Math.round(pct * 100)}%"></i></div>
    <p class="hud-sub">${n.prox ? `Faltam <b>${n.prox[0] - S.xp} XP</b> para <b>${n.prox[1]}</b>` : 'Nível máximo alcançado! 🏆'}</p>
    <ul class="hud-ms">${MISSOES.map((m) => {
      const ok = S.feitas[m.id], prog = m.id === 'caca' ? Math.min(S.caca, m.meta) : m.id === 'projetos' ? Math.min(S.proj.length, m.meta) : null;
      return `<li class="${ok ? 'feita' : ''}"><span class="ic">${ok ? '✓' : m.ic}</span><div><b>${m.nome}</b><small>${m.desc}${prog !== null && !ok ? ` · ${prog}/${m.meta}` : ''}</small></div><em>+${m.xp}</em></li>`;
    }).join('')}</ul>
    ${cup ? `<div class="hud-premio ${S.premio ? 'feita' : ''}">${S.premio ? `🏆 Prêmio liberado: cupom <b>${cup}</b> (${Math.round(CONFIG.cupons[cup] * 100)}% OFF)` : `🎁 Complete as ${MISSOES.length} missões e ganhe <b>${Math.round(CONFIG.cupons[cup] * 100)}% OFF</b> no seu projeto`}</div>` : ''}
    <label class="hud-som"><input type="checkbox" id="hudSom" ${S.som ? 'checked' : ''}> 🔊 Efeitos sonoros</label>`;
  $('#hudSom').onchange = (e) => { S.som = e.target.checked; salva(); if (S.som) somConquista(); };
}
function abre(o) { S.aberto = o; panel.hidden = !o; pill.setAttribute('aria-expanded', o); hud.classList.toggle('on', o); }
pill.onclick = () => abre(panel.hidden);
hud.addEventListener('click', (e) => { if (e.target.closest('[data-hx]')) abre(false); });
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.hud') && !panel.hidden) abre(false); });

/* ---------- XP flutuante e conquista ---------- */
function flutua(txt, x, y) {
  const el = document.createElement('div'); el.className = 'xp-pop'; el.textContent = txt;
  el.style.left = x + 'px'; el.style.top = y + 'px'; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
function ganhaXp(v) { S.xp += v; salva(); renderHud(true); }
const fila = []; let mostrando = false;
function conquista(m) {
  fila.push(m); if (mostrando) return;
  (function proximo() {
    const c = fila.shift(); if (!c) { mostrando = false; return; }
    mostrando = true;
    const el = document.createElement('div'); el.className = 'conq'; el.setAttribute('role', 'status');
    el.innerHTML = `<div class="conq-ic">${c.ic}</div><div><small>Conquista desbloqueada</small><b>${esc(c.nome)}</b><span>+${c.xp} XP</span></div>`;
    document.body.appendChild(el);
    const r = pill.getBoundingClientRect();
    confete(70, innerWidth / 2, 110); somConquista();
    setTimeout(() => { el.classList.add('sai'); flutua(`+${c.xp} XP`, r.left + r.width / 2, r.top); }, 2300);
    setTimeout(() => { el.remove(); proximo(); }, 2800);
  })();
}
function completa(id) {
  if (S.feitas[id]) return;
  const m = MISSOES.find((x) => x.id === id); if (!m) return;
  S.feitas[id] = Date.now(); ganhaXp(m.xp); conquista(m);
  DB.track('conquista', { id, total: feitas() });
  if (feitas() === MISSOES.length) setTimeout(vitoria, 3200);
}
function vitoria() {
  if (S.premio) return;
  S.premio = true; salva(); renderHud(true);
  DB.track('jogo_completo', { xp: S.xp });
  const cup = CONFIG.cupomExplorador && CONFIG.cupons && CONFIG.cupons[CONFIG.cupomExplorador] ? CONFIG.cupomExplorador : '';
  if (cup && JF.aplicarCupom) JF.aplicarCupom(cup);
  confete(260); setTimeout(() => confete(160, innerWidth * 0.2, innerHeight * 0.5), 300); setTimeout(() => confete(160, innerWidth * 0.8, innerHeight * 0.5), 550);
  somVitoria(); JF.scene && JF.scene.warp(1.4);
  const dlg = $('#dlg'); if (!dlg) return;
  dlg.innerHTML = `<div class="dlg-in ok exit"><div style="display:flex;justify-content:flex-end"><button class="x" data-dlg-close aria-label="Fechar">×</button></div>
    <div class="big" style="font-size:2.4rem">🏆</div><h2>Você é uma Lenda!</h2><p class="sm">Explorou o site inteiro e juntou <b>${S.xp} XP</b>.</p>
    ${cup ? `<p class="sm" style="margin-top:14px">Seu prêmio:</p><div class="off">${Math.round(CONFIG.cupons[cup] * 100)}% OFF</div><div class="cup">${cup}</div><p class="sm">Já apliquei no seu carrinho. Vale para qualquer pacote.</p>` : ''}
    <a class="btn primary full" href="#loja" data-dlg-close style="margin-top:16px">Usar meu prêmio <span class="arr">→</span></a></div>`;
  if (!dlg.open) dlg.showModal();
}

/* ---------- gatilhos das missões ---------- */
// 1. rolar até Sobre
function rolou() { if (scrollY > innerHeight * 0.6) { completa('explorar'); removeEventListener('scroll', rolou); } }
if (!S.feitas.explorar) addEventListener('scroll', rolou, { passive: true });
// 2. caça às formas 3D
let combo = 0, ultimo = 0;
if (JF.scene && JF.scene.onHit) {
  JF.scene.onHit(({ x, y }) => {
    const agora = Date.now(); combo = agora - ultimo < 1600 ? combo + 1 : 1; ultimo = agora;
    S.caca++; somAcerto(combo);
    if (S.xpFormas < CAP_FORMAS) { S.xpFormas += 10; S.xp += 10; }
    flutua(combo > 1 ? `Combo x${combo}! +10` : '+10', x, y);
    salva(); renderHud(true);
    if (S.caca === 1) DB.track('forma_atingida', { primeira: true });
    if (S.caca >= 5) completa('caca');
  });
  JF.scene.onMira((on) => document.body.classList.toggle('mira', on));
}
// 3. projetos do carrossel
document.addEventListener('jf:projeto', (e) => {
  if (!S.proj.includes(e.detail)) { S.proj.push(e.detail); salva(); renderHud(); }
  if (S.proj.length >= 4) completa('projetos');
});
if (!S.proj.includes(0)) { S.proj.push(0); salva(); }
// 4-6. eventos do site
document.addEventListener('jf:evento', (e) => {
  const t = e.detail.tipo;
  if (t === 'criador_preview' || t === 'criador_quero') completa('criar');
  if (t === 'quiz_fim') completa('quiz');
  if (t === 'cor') completa('cor');
});
// 7. abrir uma pergunta do FAQ
document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('.faq details') && e.target.open) completa('faq'); }, true);

/* ---------- dica para descobrir a caça ---------- */
setTimeout(() => {
  if (S.caca || document.querySelector('dialog[open]')) return;
  const d = document.createElement('div'); d.className = 'dica3d';
  d.innerHTML = `🎯 <b>Psiu!</b> As formas 3D flutuando são ${mobile ? 'tocáveis' : 'clicáveis'}. Acerte 5 e ganhe XP!`;
  document.body.appendChild(d);
  pill.classList.add('chama');
  setTimeout(() => d.classList.add('sai'), 6500); setTimeout(() => { d.remove(); pill.classList.remove('chama'); }, 7000);
}, 14000);

/* ---------- entrada cinematográfica ---------- */
(function () {
  let n = 0;
  const t = setInterval(() => { if (document.body.classList.contains('ready') || ++n > 60) { clearInterval(t); JF.scene && JF.scene.warp(1.2); } }, 100);
})();

/* ---------- título da aba chama de volta ---------- */
const tituloOriginal = document.title;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const faltam = MISSOES.length - feitas(), itens = JF.itens ? JF.itens().length : 0;
    document.title = itens ? '🛒 Seu pedido está te esperando…' : faltam && feitas() ? `🎯 Faltam ${faltam} missões! · Jackson FB` : '👀 Volta aqui, tem mais coisa!';
  } else document.title = tituloOriginal;
});

renderHud();
if (feitas() === MISSOES.length && !S.premio) vitoria();
})();
