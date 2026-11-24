/* Som ambiente de chuva, gerado ao vivo no navegador (sem arquivo de áudio, sem direitos autorais).
   - Fica ligado por padrão e começa no primeiro clique/toque (regra dos navegadores para som).
   - Botão fixo no topo para ligar/desligar e ajustar o volume. A escolha fica salva.
   - Trovões distantes de vez em quando avisam a cena 3D para piscar um relâmpago (evento "jf:trovao"). */
(function () {
  'use strict';
  const KEY = 'jf-chuva';
  let pref = { on: true, vol: 0.55 };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
  const salva = () => { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch {} };

  let ac = null, master = null, tocando = false, timers = [];

  function ruido(ctx, seg, tipo) {
    const n = ctx.sampleRate * seg, buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (tipo === 'marrom') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
      }
    }
    return buf;
  }

  function monta() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);

    const rosa = ruido(ac, 6, 'rosa'), marrom = ruido(ac, 8, 'marrom');
    // corpo da chuva
    const s1 = ac.createBufferSource(); s1.buffer = rosa; s1.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g1 = ac.createGain(); g1.gain.value = 0.55;
    s1.connect(hp).connect(lp).connect(g1).connect(master); s1.start();
    // chuvisco agudo
    const s2 = ac.createBufferSource(); s2.buffer = rosa; s2.loop = true; s2.playbackRate.value = 1.37;
    const hp2 = ac.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 4200;
    const g2 = ac.createGain(); g2.gain.value = 0.09;
    s2.connect(hp2).connect(g2).connect(master); s2.start();
    // fundo grave (chuva longe / telhado)
    const s3 = ac.createBufferSource(); s3.buffer = marrom; s3.loop = true;
    const lp3 = ac.createBiquadFilter(); lp3.type = 'lowpass'; lp3.frequency.value = 420;
    const g3 = ac.createGain(); g3.gain.value = 0.35;
    s3.connect(lp3).connect(g3).connect(master); s3.start();
    // a chuva "respira": intensidade varia devagar
    const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 0.045; lfoG.gain.value = 0.12;
    lfo.connect(lfoG).connect(g1.gain); lfo.start();

    // gotas individuais caindo perto
    const gotaBuf = ruido(ac, 0.08, 'rosa');
    function gota() {
      if (tocando && !document.hidden) {
        const s = ac.createBufferSource(); s.buffer = gotaBuf;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 4200; bp.Q.value = 6 + Math.random() * 10;
        const g = ac.createGain(), t = ac.currentTime, v = 0.05 + Math.random() * 0.12;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.05);
        const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
        if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; s.connect(bp).connect(g).connect(pan).connect(master); } else s.connect(bp).connect(g).connect(master);
        s.start(t); s.stop(t + 0.1);
      }
      timers.push(setTimeout(gota, 30 + Math.random() * 140));
    }
    gota();

    // trovão distante a cada 25-70 s
    function trovao() {
      if (tocando && !document.hidden) {
        const forca = 0.4 + Math.random() * 0.6;
        document.dispatchEvent(new CustomEvent('jf:trovao', { detail: { forca } }));
        const atraso = 0.6 + Math.random() * 2.2; // a luz chega antes do som
        const s = ac.createBufferSource(); s.buffer = marrom;
        const lpT = ac.createBiquadFilter(); lpT.type = 'lowpass'; lpT.frequency.value = 160 + Math.random() * 120;
        const g = ac.createGain(), t = ac.currentTime + atraso, dur = 2.5 + Math.random() * 2.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9 * forca, t + 0.25 + Math.random() * 0.4);
        g.gain.exponentialRampToValueAtTime(0.25 * forca, t + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(lpT).connect(g).connect(master); s.start(t, Math.random() * 3); s.stop(t + dur + 0.1);
      }
      timers.push(setTimeout(trovao, 25000 + Math.random() * 45000));
    }
    timers.push(setTimeout(trovao, 9000 + Math.random() * 8000));
    return true;
  }

  function liga() {
    if (!ac && !monta()) return;
    if (ac.state === 'suspended') ac.resume();
    tocando = true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(pref.vol, ac.currentTime, 1.2); // entra suave
    ui();
  }
  function desliga() {
    tocando = false;
    if (ac) { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(0, ac.currentTime, 0.35); }
    ui();
  }

  // ---------- botão fixo ----------
  const box = document.createElement('div'); box.className = 'chuva';
  box.innerHTML = `<button class="chuva-btn" type="button" aria-label="Som de chuva" aria-pressed="false" title="Som de chuva"><span class="chuva-ic"><i></i><i></i><i></i></span><span class="chuva-t">Chuva</span></button>
    <div class="chuva-pop" hidden><label>Volume<input type="range" min="0" max="1" step="0.05" aria-label="Volume da chuva"></label></div>`;
  const btn = box.querySelector('.chuva-btn'), pop = box.querySelector('.chuva-pop'), rng = box.querySelector('input');
  rng.value = pref.vol;
  function ui() {
    btn.setAttribute('aria-pressed', tocando);
    box.classList.toggle('on', tocando);
    box.classList.toggle('espera', pref.on && !tocando);
    btn.title = tocando ? 'Desligar a chuva' : pref.on ? 'A chuva começa no seu primeiro clique' : 'Ligar som de chuva';
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (tocando) { pref.on = false; desliga(); } else { pref.on = true; liga(); }
    pop.hidden = !tocando; salva();
  });
  rng.addEventListener('input', () => { pref.vol = +rng.value; salva(); if (tocando) master.gain.setTargetAtTime(pref.vol, ac.currentTime, 0.1); });
  document.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) pop.hidden = true; });

  function coloca() {
    const alvo = document.querySelector('header .hright');
    if (alvo) alvo.prepend(box); else { box.classList.add('solta'); document.body.appendChild(box); }
    ui();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', coloca); else coloca();

  // ---------- começa sozinho no primeiro gesto (os navegadores exigem um clique/toque/tecla) ----------
  function primeiro(e) {
    if (box.contains(e.target)) return;
    ['pointerdown', 'keydown', 'touchend'].forEach((t) => removeEventListener(t, primeiro, true));
    if (pref.on && !tocando) liga();
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => addEventListener(t, primeiro, true));
  document.addEventListener('visibilitychange', () => {
    if (!ac || !tocando) return;
    master.gain.setTargetAtTime(document.hidden ? 0 : pref.vol, ac.currentTime, 0.4);
  });

  window.Chuva = { liga, desliga, get tocando() { return tocando; } };
})();
