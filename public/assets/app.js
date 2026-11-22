/* Portfólio Jackson FB — interações, loja e encomendas */
(() => {
'use strict';
const { CONFIG, SERVICOS, ENCOMENDA } = window.CATALOGO;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// "reduzir animações" do sistema deixa tudo mais suave, mas não congela o site
const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduce = false;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const waLink = (msg) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- dados do CONFIG no HTML ---------- */
$('#ano').textContent = new Date().getFullYear();
$$('[data-cfg]').forEach((el) => { el.textContent = CONFIG[el.dataset.cfg] || ''; });
$$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });
$$('[data-ig]').forEach((a) => { a.href = `https://instagram.com/${CONFIG.instagram}`; });
if (CONFIG.email) { const e = $('#femail'); e.hidden = false; e.href = `mailto:${CONFIG.email}`; e.textContent = CONFIG.email; }

/* ---------- loader ---------- */
(function loader() {
  const el = $('#loader'), bar = $('#ldbar'), num = $('#ldnum');
  const start = performance.now(), min = reduce ? 0 : 1100;
  let loaded = document.readyState === 'complete';
  addEventListener('load', () => { loaded = true; });
  setTimeout(() => { loaded = true; }, 3500);
  (function step(now) {
    const t = Math.min((now - start) / min, loaded ? 1 : 0.9) || (loaded ? 1 : 0);
    const p = Math.round((min ? t : 1) * 100);
    bar.style.width = p + '%'; num.textContent = p + '%';
    if (p >= 100) {
      el.classList.add('done'); document.body.classList.add('ready');
      setTimeout(() => el.remove(), 1100);
      return;
    }
    requestAnimationFrame(step);
  })(start);
})();

/* ---------- cena 3D (assets/scene3d.js) ---------- */
const scene3d = window.Scene3D ? window.Scene3D.init($('#scene'), { calm: calmo }) : null;

/* ---------- header, navegação, progresso ---------- */
const hdr = $('#hdr'), prog = $('#prog'), nav = $('#nav'), burger = $('#burger');
function onScroll() {
  const m = document.documentElement.scrollHeight - innerHeight;
  prog.style.transform = `scaleX(${m > 0 ? scrollY / m : 0})`;
  hdr.classList.toggle('solid', scrollY > 40);
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();
burger.onclick = () => {
  const o = burger.getAttribute('aria-expanded') !== 'true';
  burger.setAttribute('aria-expanded', o); nav.classList.toggle('open', o); document.body.classList.toggle('lock', o);
};
nav.addEventListener('click', (e) => { if (e.target.closest('a')) { burger.setAttribute('aria-expanded', false); nav.classList.remove('open'); document.body.classList.remove('lock'); } });

const secIO = new IntersectionObserver((es) => {
  es.forEach((e) => {
    if (!e.isIntersecting) return;
    const id = e.target.id;
    scene3d && scene3d.section(id);
    $$('#nav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  });
}, { rootMargin: '-45% 0px -45% 0px' });
['sobre', 'projetos', 'criar', 'loja', 'quiz', 'encomenda', 'processo', 'avaliacoes', 'faq', 'blog', 'contato'].forEach((id) => { const el = document.getElementById(id); el && secIO.observe(el); });
new IntersectionObserver(([e]) => { if (e.isIntersecting && scene3d) scene3d.section('topo'); }, { threshold: 0.5 }).observe($('.hero'));

/* ---------- revelar ao rolar ---------- */
const revIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revIO.unobserve(e.target); } }), { threshold: 0.12 });
function observeReveal(root = document) { $$('[data-reveal]:not(.in)', root).forEach((el) => revIO.observe(el)); }
observeReveal();
const pIO = new IntersectionObserver(([e]) => { if (e.isIntersecting) { $('#process').classList.add('in'); pIO.disconnect(); } }, { threshold: 0.4 });
pIO.observe($('#process'));

/* ---------- marquee ---------- */
const STACK = ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind', 'Three.js', 'Mercado Pago', 'Vercel', 'Automação'];
$('#mq').innerHTML = [...STACK, ...STACK].map((s) => `<span>${s}</span>`).join('');

/* ---------- cursor, brilho, botões magnéticos, cartões 3D ---------- */
if (fine && !reduce) {
  const cur = $('#cur'), dot = $('#curdot'), glow = $('#glow');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, gx = x, gy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
  (function loop() {
    cx += (x - cx) * 0.18; cy += (y - cy) * 0.18; gx += (x - gx) * 0.08; gy += (y - gy) * 0.08;
    cur.style.transform = `translate(${cx}px,${cy}px)`;
    glow.style.transform = `translate(${gx - 230}px,${gy - 230}px)`;
    requestAnimationFrame(loop);
  })();
  document.addEventListener('pointerover', (e) => { cur.classList.toggle('big', !!e.target.closest('a,button,.card,.opt,summary,input[type=range]')); });

  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest('.btn');
    if (b) { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.3}px)`; }
    const pl = e.target.closest('.plan');
    if (pl) { const r = pl.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; pl.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-6px)`; pl.style.setProperty('--mx', e.clientX - r.left + 'px'); pl.style.setProperty('--my', e.clientY - r.top + 'px'); }
    const c = e.target.closest('.card');
    if (c) {
      const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `rotateY(${px * 12}deg) rotateX(${-py * 12}deg) translateZ(8px)`;
      c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
    }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const b = e.target.closest('.btn'); if (b && !b.contains(e.relatedTarget)) b.style.transform = '';
    const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    const pl = e.target.closest('.plan'); if (pl && !pl.contains(e.relatedTarget)) pl.style.transform = '';
  });
} else {
  $('#cur').remove(); $('#curdot').remove();
}

/* ---------- carrossel 3D de projetos ---------- */
(function () {
  const cf = $('#cf'); if (!cf) return;
  const items = $$('.cf-item', cf), dots = $('#cfDots');
  let idx = 0, auto = null, parado = false;
  const desk = () => innerWidth > 860;
  dots.innerHTML = items.map((_, i) => `<button aria-label="Projeto ${i + 1}"></button>`).join('');
  function layout(dx = 0) {
    items.forEach((el, i) => {
      let off = i - idx; const n = items.length;
      if (off > n / 2) off -= n; if (off < -n / 2) off += n;
      const o = off + dx;
      el.classList.toggle('on', off === 0);
      if (!desk()) return;
      const a = Math.abs(o);
      el.style.transform = `translateX(${o * 62}%) translateZ(${-a * 260}px) rotateY(${-o * 38}deg)`;
      el.style.opacity = a > 1.6 ? 0 : 1 - a * 0.35;
      el.style.filter = `brightness(${1 - Math.min(a, 1.5) * 0.35})`;
      el.style.zIndex = 10 - Math.round(a * 2);
    });
    $$('button', dots).forEach((d, i) => d.classList.toggle('on', i === idx));
  }
  const go = (i) => { idx = (i + items.length) % items.length; layout(); document.dispatchEvent(new CustomEvent('jf:projeto', { detail: idx })); };
  const pare = () => { parado = true; clearInterval(auto); };
  $('#cfPrev').onclick = () => { pare(); go(idx - 1); };
  $('#cfNext').onclick = () => { pare(); go(idx + 1); };
  dots.onclick = (e) => { const b = e.target.closest('button'); if (b) { pare(); go($$('button', dots).indexOf(b)); } };
  cf.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { pare(); go(idx - 1); } if (e.key === 'ArrowRight') { pare(); go(idx + 1); } });
  items.forEach((el, i) => el.addEventListener('click', (e) => { if (desk() && i !== idx) { e.preventDefault(); pare(); go(i); } }));
  // arrastar
  let x0 = null, dx = 0, moved = false;
  const stage = $('#cfStage');
  stage.addEventListener('pointerdown', (e) => { if (!desk()) return; x0 = e.clientX; dx = 0; moved = false; cf.classList.add('drag'); });
  addEventListener('pointermove', (e) => { if (x0 === null) return; dx = (e.clientX - x0) / 320; if (Math.abs(dx) > 0.05) moved = true; layout(-dx); });
  addEventListener('pointerup', () => {
    if (x0 === null) return; cf.classList.remove('drag'); x0 = null;
    if (Math.abs(dx) > 0.25) { pare(); go(idx + (dx < 0 ? 1 : -1)); } else layout();
  });
  stage.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  // celular: atualiza o ponto ao rolar
  stage.addEventListener('scroll', () => { if (desk()) return; const i = Math.round(stage.scrollLeft / (items[0].offsetWidth + 16)); if (i !== idx) { idx = Math.max(0, Math.min(items.length - 1, i)); document.dispatchEvent(new CustomEvent('jf:projeto', { detail: idx })); $$('button', dots).forEach((d, k) => d.classList.toggle('on', k === idx)); } }, { passive: true });
  addEventListener('resize', () => layout());
  layout();
  if (!reduce) {
    const io = new IntersectionObserver(([e]) => { clearInterval(auto); if (e.isIntersecting && !parado && desk()) auto = setInterval(() => go(idx + 1), 4500); }, { threshold: 0.5 });
    io.observe(cf);
  }
  $$('.cf-item .card', cf).forEach((c) => c.classList.add('in'));
})();

/* ---------- paralaxe do topo (mouse ou inclinação do celular) ---------- */
if (!fine) {
  const hw = $('.hero .wrap');
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || scrollY > innerHeight) return;
    const x = Math.max(-1, Math.min(1, e.gamma / 30)) / 2, y = Math.max(-1, Math.min(1, (e.beta - 45) / 30)) / 2;
    hw.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
  });
}
if (fine) {
  const hw = $('.hero .wrap');
  addEventListener('pointermove', (e) => {
    if (scrollY > innerHeight) return;
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    hw.style.transform = `perspective(1200px) rotateY(${x * 4}deg) rotateX(${-y * 3}deg) translate3d(${x * -14}px,${y * -10}px,0)`;
  }, { passive: true });
}

/* ---------- texto que se digita ---------- */
if (!reduce) {
  const el = $('#typed'), words = ['Desenvolvedor Full Stack', 'Sites que vendem', 'Lojas virtuais', 'Sistemas e automação', 'Experiências 3D'];
  let wi = 0, ci = words[0].length, del = true;
  (function type() {
    if (del === true) { ci--; if (ci <= 0) { del = false; wi = (wi + 1) % words.length; } }
    else { ci++; if (ci >= words[wi].length) del = 'hold'; }
    el.textContent = words[wi].slice(0, Math.max(ci, 0));
    let d = del === true ? 35 : 70;
    if (del === 'hold') { d = 1800; del = true; }
    setTimeout(type, d);
  })();
}

/* ---------- toast ---------- */
let tt;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 2200); }

/* =====================================================================
   LOJA
   ===================================================================== */
const byId = (id) => SERVICOS.find((s) => s.id === id);
const multi = (s) => s.mensal || s.id === 'pagina';
let cart = store.get('jf-cart', {});
Object.keys(cart).forEach((id) => { if (!byId(id)) delete cart[id]; });

function renderPlans() {
  $('#plans').innerHTML = SERVICOS.filter((s) => s.tipo === 'servico').map((s, i) => `
    <article class="plan${s.destaque ? ' hot' : ''}" data-reveal style="--d:${i * 0.06}s">
      ${s.destaque ? '<span class="ribbon">MAIS PEDIDO</span>' : ''}
      <h3>${esc(s.nome)}</h3>
      <p class="desc">${esc(s.resumo)}</p>
      <div class="from">a partir de</div>
      <div class="price">${brl(s.preco)}</div>
      <div class="meta"><span>⏱ ${esc(s.prazo)}</span><span>Sinal ${brl(s.preco * CONFIG.sinal)}</span></div>
      <ul>${s.inclui.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="acts">
        <button class="btn ${s.destaque ? 'primary' : ''} full add" data-add="${s.id}">Adicionar ao pedido</button>
      </div>
    </article>`).join('');
  $('#extras').innerHTML = SERVICOS.filter((s) => s.tipo === 'extra').map((s, i) => `
    <div class="extra" data-reveal style="--d:${i * 0.05}s">
      <h4>${esc(s.nome)}</h4><p>${esc(s.resumo)}</p>
      <div class="row"><span class="p">${brl(s.preco)}${s.mensal ? '<small style="font:400 .8rem var(--body);color:var(--muted)">/mês</small>' : ''}</span>
      <button class="mini" data-add="${s.id}">+ Adicionar</button></div>
    </div>`).join('');
  observeReveal($('#loja'));
}

let cupom = store.get('jf-cupom', '');
const descCupom = () => (CONFIG.cupons && CONFIG.cupons[cupom]) || 0;
function totals() {
  const bruto = Object.entries(cart).reduce((a, [id, q]) => a + byId(id).preco * q, 0);
  const desc = descCupom(), sub = Math.round(bruto * (1 - desc) * 100) / 100;
  return { bruto, desc, sub, sinal: Math.round(sub * CONFIG.sinal * 100) / 100 };
}
function aplicarCupom(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) { cupom = ''; store.set('jf-cupom', ''); renderCart(); return true; }
  if (!(CONFIG.cupons && CONFIG.cupons[code])) return false;
  cupom = code; store.set('jf-cupom', code); renderCart();
  window.DB && DB.track('cupom', { cupom: code });
  return true;
}
function saveCart() { store.set('jf-cart', cart); renderCart(); }
function renderCart() {
  const ids = Object.keys(cart);
  const n = ids.reduce((a, id) => a + cart[id], 0);
  $('#count').textContent = n;
  $$('[data-add]').forEach((b) => {
    const s = byId(b.dataset.add), has = !!cart[b.dataset.add];
    b.classList.toggle('added', has && !multi(s));
    if (b.classList.contains('mini')) b.textContent = has ? (multi(s) ? `+ Adicionar (${cart[s.id]})` : '✓ No pedido') : '+ Adicionar';
    else b.textContent = has ? '✓ No pedido · ver carrinho' : 'Adicionar ao pedido';
  });
  if (!ids.length) {
    $('#items').innerHTML = '<div class="cart-empty"><div class="big">🛒</div><p>Seu pedido está vazio.</p><p style="margin-top:6px;font-size:.9rem">Escolha um pacote ou adicional na seção de pacotes.</p><a href="#loja" class="btn" style="margin-top:20px" data-close>Ver pacotes</a></div>';
    $('#cartFoot').hidden = true;
    return;
  }
  $('#cartFoot').hidden = false;
  $('#items').innerHTML = ids.map((id) => {
    const s = byId(id), q = cart[id];
    return `<div class="it">
      <div><b>${esc(s.nome)}</b><div class="sm">${s.tipo === 'servico' ? 'Projeto · ' + esc(s.prazo) : s.mensal ? 'Por mês' : 'Adicional'}</div></div>
      <div class="pr">${brl(s.preco * q)}</div>
      ${multi(s) ? `<div class="qty"><button data-m="${id}" aria-label="Diminuir">−</button><span>${q}${s.mensal ? (q > 1 ? ' meses' : ' mês') : ''}</span><button data-a="${id}" aria-label="Aumentar">+</button></div>` : '<span></span>'}
      <button class="rm" data-r="${id}">Remover</button>
    </div>`;
  }).join('');
  const t = totals();
  $('#sub').textContent = brl(t.bruto);
  $('#cupomBox').innerHTML = t.desc
    ? `<div class="ln cupom-ok"><span>Cupom ${esc(cupom)} (−${Math.round(t.desc * 100)}%)</span><span>−${brl(t.bruto - t.sub)} <button class="rm" data-cupom-x>remover</button></span></div>`
    : `<form class="cupom" data-cupom-f><input class="field" name="c" placeholder="Cupom de desconto" aria-label="Cupom de desconto" autocomplete="off"><button class="mini">Aplicar</button></form>`;
  $('#sinalPct').textContent = Math.round(CONFIG.sinal * 100) + '%';
  $('#sinalV').textContent = brl(t.sinal);
  $('#total').textContent = brl(t.sub);
}

const cartEl = $('#cart'), shade = $('#shade');
function openCart(o) {
  cartEl.classList.toggle('open', o); shade.classList.toggle('open', o);
  cartEl.setAttribute('aria-hidden', !o); document.body.classList.toggle('lock', o);
  if (o) setTimeout(() => $('#closeCart').focus(), 50);
}
$('#openCart').onclick = () => openCart(true);
$('#closeCart').onclick = shade.onclick = () => openCart(false);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && cartEl.classList.contains('open')) openCart(false); });

document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const id = add.dataset.add, s = byId(id);
    if (cart[id] && !multi(s)) { openCart(true); return; }
    cart[id] = (cart[id] || 0) + 1; saveCart();
    window.DB && DB.track('add_carrinho', { id });
    const cb = $('#openCart'); cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump');
    scene3d && scene3d.pulse();
    toast(`✓ ${s.nome} adicionado ao pedido`);
    return;
  }
  if (e.target.closest('[data-close]')) openCart(false);
});
$('#cupomBox').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = e.target.c.value;
  if (aplicarCupom(v)) toast('✓ Cupom aplicado!'); else { e.target.c.value = ''; e.target.c.placeholder = 'Cupom inválido'; }
});
$('#cupomBox').addEventListener('click', (e) => { if (e.target.closest('[data-cupom-x]')) aplicarCupom(''); });
$('#items').addEventListener('click', (e) => {
  const d = e.target.dataset;
  if (d.a) cart[d.a] = Math.min(24, cart[d.a] + 1);
  if (d.m && --cart[d.m] <= 0) delete cart[d.m];
  if (d.r) delete cart[d.r];
  if (d.a || d.m || d.r) saveCart();
});

/* ---------- checkout ---------- */
const dlg = $('#dlg');
const newNum = () => 'JF-' + Date.now().toString(36).slice(-5).toUpperCase();
function orderText(num, cli, plano) {
  const t = totals();
  const linhas = Object.entries(cart).map(([id, q]) => { const s = byId(id); return `• ${s.nome}${q > 1 ? ` x${q}` : ''} — ${brl(s.preco * q)}`; });
  return [
    `*Novo pedido ${num}* (via portfólio)`, '',
    `*Nome:* ${cli.nome}`, `*WhatsApp:* ${cli.whatsapp}`, (cli.email && `*E-mail:* ${cli.email}`) || null, (cli.projeto && `*Empresa/projeto:* ${cli.projeto}`) || null, '',
    '*Itens:*', ...linhas, '',
    t.desc ? `*Cupom:* ${cupom} (−${Math.round(t.desc * 100)}%)` : null,
    `*Total:* ${brl(t.sub)}`,
    `*Pagamento:* ${plano === 'sinal' ? `sinal de ${Math.round(CONFIG.sinal * 100)}% (${brl(t.sinal)}) + restante na entrega` : 'valor integral'}`,
    cli.obs ? `\n*Observações:* ${cli.obs}` : null,
  ].filter((x) => x || x === '').join('\n');
}
function closeBtn() { return '<button class="x" data-dlg-close aria-label="Fechar">×</button>'; }
dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-dlg-close]')) dlg.close(); });

$('#checkout').onclick = () => {
  const t = totals();
  window.DB && DB.track('checkout_inicio', { total: t.sub });
  const prev = store.get('jf-cliente', {});
  dlg.innerHTML = `<div class="dlg-in">
    <div class="dlg-top"><div><h2>Finalizar pedido</h2><p class="sm">Preencha seus dados para reservar o projeto.</p></div>${closeBtn()}</div>
    <form id="cf">
      <input class="field" name="nome" placeholder="Nome completo *" autocomplete="name" required value="${esc(prev.nome || '')}">
      <div class="two">
        <input class="field" name="whatsapp" placeholder="WhatsApp com DDD *" inputmode="tel" autocomplete="tel" required value="${esc(prev.whatsapp || '')}">
        <input class="field" name="email" type="email" placeholder="E-mail *" autocomplete="email" required value="${esc(prev.email || '')}">
      </div>
      <input class="field" name="projeto" placeholder="Empresa / nome do projeto">
      <textarea class="field" name="obs" placeholder="Observações (opcional)" style="min-height:80px"></textarea>
      <span class="lbl" style="margin:6px 0 0">Como prefere pagar?</span>
      <div class="plano">
        <label class="opt"><input type="radio" name="plano" value="sinal" checked><span><b>Sinal ${Math.round(CONFIG.sinal * 100)}%</b><em>${brl(t.sinal)} agora, resto na entrega</em></span></label>
        <label class="opt"><input type="radio" name="plano" value="total"><span><b>Integral</b><em>${brl(t.sub)} agora</em></span></label>
      </div>
      <div class="resumo">${Object.entries(cart).map(([id, q]) => `<div><span>${esc(byId(id).nome)}${q > 1 ? ' ×' + q : ''}</span><span>${brl(byId(id).preco * q)}</span></div>`).join('')}
        ${t.desc ? `<div><span>Cupom ${esc(cupom)}</span><span>−${brl(t.bruto - t.sub)}</span></div>` : ''}
        <div class="tt"><span>A pagar agora</span><span id="agora">${brl(t.sinal)}</span></div></div>
      <p class="err" id="cerr" role="alert"></p>
      <button class="btn primary full" value="mp" id="payMp">Pagar com Pix ou cartão <span class="arr">→</span></button>
      <button class="btn wa full" value="wa" formnovalidate>Prefiro combinar pelo WhatsApp</button>
      <p class="sm" style="text-align:center">🔒 Você será levado ao ambiente seguro do Mercado Pago.</p>
    </form></div>`;
  openCart(false);
  dlg.showModal();
  const f = $('#cf');
  f.addEventListener('change', () => { $('#agora').textContent = brl(f.plano.value === 'sinal' ? totals().sinal : totals().sub); });
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const via = ev.submitter && ev.submitter.value;
    const fd = Object.fromEntries(new FormData(f));
    const cli = { nome: fd.nome.trim(), whatsapp: fd.whatsapp.trim(), email: fd.email.trim(), projeto: fd.projeto.trim(), obs: fd.obs.trim() };
    const digits = cli.whatsapp.replace(/\D/g, '');
    if (cli.nome.length < 3) return ($('#cerr').textContent = 'Informe seu nome.');
    if (digits.length < 10) return ($('#cerr').textContent = 'Informe um WhatsApp válido com DDD.');
    if (via === 'mp' && !/^\S+@\S+\.\S+$/.test(cli.email)) return ($('#cerr').textContent = 'Informe um e-mail válido para o recibo do pagamento.');
    store.set('jf-cliente', { nome: cli.nome, whatsapp: cli.whatsapp, email: cli.email });
    const num = newNum(), plano = fd.plano, msg = orderText(num, cli, plano);
    store.set('jf-last', { num, msg });
    const tt = totals();
    const registro = { numero: num, origem: 'loja', nome: cli.nome, email: cli.email.toLowerCase(), whatsapp: cli.whatsapp, total: tt.sub, plano, cupom: tt.desc ? cupom : null,
      itens: Object.entries(cart).map(([id, qtd]) => ({ id, nome: byId(id).nome, qtd, preco: byId(id).preco })), dados: { projeto: cli.projeto, obs: cli.obs, via: 'whatsapp' } };
    window.DB && DB.track('checkout_' + via, { total: tt.sub });

    if (via === 'wa') {
      window.open(waLink(msg), '_blank', 'noopener');
      window.DB && DB.salvarPedido(registro);
      cart = {}; saveCart(); openCart(false);
      return showResult('ok', 'Pedido enviado!', `Seu pedido <b>${num}</b> foi aberto no WhatsApp. É só enviar a mensagem e eu respondo para combinarmos os detalhes.`);
    }

    const btn = $('#payMp'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Gerando pagamento…';
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: num, plano, cupom, cliente: cli, itens: Object.entries(cart).map(([id, qtd]) => ({ id, qtd })) }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) { location.href = data.url; return; }
      throw new Error(data.erro || 'indisponível');
    } catch (err) {
      showResult('warn', 'Pagamento online indisponível', `Não consegui abrir o Mercado Pago agora. Sem problema: envie o pedido <b>${num}</b> pelo WhatsApp e eu te mando o link de pagamento (Pix ou cartão).`,
        `<a class="btn wa full" href="${waLink(msg)}" target="_blank" rel="noopener" data-clear>Enviar pedido pelo WhatsApp</a>`);
      window.DB && DB.salvarPedido(registro);
    }
  };
};
dlg.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) { cart = {}; saveCart(); openCart(false); setTimeout(() => dlg.close(), 300); } });

function showResult(kind, title, html, extra = '') {
  const ic = { ok: '✓', warn: '!', bad: '×' }[kind];
  dlg.innerHTML = `<div class="dlg-in ok"><div style="display:flex;justify-content:flex-end">${closeBtn()}</div>
    <div class="big ${kind === 'ok' ? '' : kind}">${ic}</div><h2>${title}</h2><p class="sm" style="margin-top:8px">${html}</p>
    ${extra || '<button class="btn primary full" data-dlg-close>Continuar navegando</button>'}</div>`;
  if (!dlg.open) dlg.showModal();
  if (kind === 'ok') scene3d && scene3d.pulse();
}

/* retorno do Mercado Pago */
(function () {
  const q = new URLSearchParams(location.search), st = q.get('pedido');
  if (!st) return;
  const num = esc(q.get('n') || ''), last = store.get('jf-last', null);
  history.replaceState(null, '', location.pathname + location.hash);
  const avisar = (txt) => last ? `<a class="btn wa full" target="_blank" rel="noopener" href="${waLink(`${txt}\n\n${last.msg}`)}">Avisar no WhatsApp</a>` : '';
  setTimeout(() => {
    if (st === 'aprovado') {
      cart = {}; saveCart();
      showResult('ok', 'Pagamento aprovado!', `Obrigado! Seu pedido <b>${num}</b> está confirmado e sua vaga na agenda foi reservada. Vou te chamar no WhatsApp para começarmos o briefing.`, avisar(`Olá Jackson! Acabei de pagar o pedido ${num} pelo site.`) + '<button class="btn full" style="margin-top:10px" data-dlg-close>Fechar</button>');
    } else if (st === 'pendente') {
      showResult('warn', 'Pagamento em processamento', `O pedido <b>${num}</b> está aguardando a confirmação do pagamento (Pix ou boleto podem levar alguns minutos). Assim que aprovar, eu entro em contato.`, avisar(`Olá Jackson! Fiz o pedido ${num} e o pagamento está pendente.`) + '<button class="btn full" style="margin-top:10px" data-dlg-close>Fechar</button>');
    } else {
      showResult('bad', 'Pagamento não concluído', 'O pagamento não foi finalizado e nada foi cobrado. Seu carrinho continua salvo, é só tentar de novo ou combinar pelo WhatsApp.', '<button class="btn primary full" id="retry">Voltar ao carrinho</button>');
      const r = $('#retry'); if (r) r.onclick = () => { dlg.close(); openCart(true); };
    }
  }, 1300);
})();

renderPlans(); renderCart();
function encomendar({ tipo, recursos = [], desc = '', empresa = '' }) {
  of.reset(); os.recursos.clear();
  const r = of.querySelector(`input[name=tipo][value="${tipo}"]`); if (r) r.checked = true;
  os.tipo = tipo; const inc = PAG_INCLUSAS[tipo] || 1; os.paginas = inc; $('#opaginas').value = inc; $('#opagv').textContent = inc;
  recursos.forEach((id) => { const c = of.querySelector(`input[name=rec][value="${id}"]`); if (c) { c.checked = true; os.recursos.add(id); } });
  const pz = of.querySelector('input[name=prazo][value=normal]'); if (pz) pz.checked = true; os.prazo = 'normal';
  if (desc) of.desc.value = desc; if (empresa) of.empresa.value = empresa;
  renderEst(); go(1);
  document.getElementById('encomenda').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('✓ Sua prévia virou uma encomenda. Confira os recursos!');
}
window.JF = { encomendar, openCart, aplicarCupom, toast, showResult, scene: scene3d,
  get cart() { return { ...cart }; }, itens: () => Object.keys(cart).map((id) => byId(id).nome),
  add(id) { const s = byId(id); if (!s) return; if (!cart[id] || multi(s)) { cart[id] = (cart[id] || 0) + 1; saveCart(); } } };

/* =====================================================================
   ENCOMENDA SOB MEDIDA
   ===================================================================== */
const PAG_INCLUSAS = { landing: 1, institucional: 5, loja: 5, portfolio3d: 3, sistema: 5, outro: 1 };
const PRECO_PAGINA = (byId('pagina') || { preco: 87.5 }).preco;
const os = { step: 0, tipo: null, recursos: new Set(), paginas: 1, prazo: 'normal', orc: null };
const of = $('#oform');

$('#otipos').innerHTML = ENCOMENDA.tipos.map((t) => `<label class="opt"><input type="radio" name="tipo" value="${t.id}"><span><span class="ic">${t.icone}</span><b>${esc(t.nome)}</b><em>${t.base ? 'a partir de ' + brl(t.base) : 'sob consulta'}</em></span></label>`).join('');
$('#orecursos').innerHTML = ENCOMENDA.recursos.map((r) => `<label class="opt"><input type="checkbox" name="rec" value="${r.id}"><span><b>${esc(r.nome)}</b><em>+${brl(r.preco)}</em></span></label>`).join('');
$('#oprazos').innerHTML = ENCOMENDA.prazos.map((p) => `<label class="opt"><input type="radio" name="prazo" value="${p.id}"${p.id === 'normal' ? ' checked' : ''}><span><b>${esc(p.nome)}</b><em>${p.fator > 1 ? '+' + Math.round((p.fator - 1) * 100) + '% (prioridade)' : p.fator < 1 ? Math.round((1 - p.fator) * 100) + '% de desconto' : 'prazo do pacote'}</em></span></label>`).join('');
$('#oorc').innerHTML = ENCOMENDA.orcamentos.map((o, i) => `<label class="opt"><input type="radio" name="orc" value="${i}"><span><b>${esc(o)}</b></span></label>`).join('');

const round50 = (v) => Math.round(v / 10) * 10;
function estimate() {
  const t = ENCOMENDA.tipos.find((x) => x.id === os.tipo);
  if (!t) return null;
  const linhas = [];
  let v = t.base;
  if (t.base) linhas.push([t.nome, brl(t.base)]); else linhas.push([t.nome, 'sob consulta']);
  os.recursos.forEach((id) => { const r = ENCOMENDA.recursos.find((x) => x.id === id); v += r.preco; linhas.push([r.nome, '+' + brl(r.preco)]); });
  const extras = Math.max(0, os.paginas - (PAG_INCLUSAS[t.id] || 1));
  if (extras) { v += extras * PRECO_PAGINA; linhas.push([`${extras} página(s) extra`, '+' + brl(extras * PRECO_PAGINA)]); }
  const p = ENCOMENDA.prazos.find((x) => x.id === os.prazo);
  if (p && p.fator !== 1) linhas.push([p.nome, (p.fator > 1 ? '+' : '−') + Math.round(Math.abs(p.fator - 1) * 100) + '%']);
  v *= p ? p.fator : 1;
  return { min: v ? round50(v) : 0, max: v ? round50(v * 1.35) : 0, linhas };
}
function renderEst() {
  const e = estimate();
  if (!e) { $('#estv').textContent = '—'; $('#estn').textContent = 'Escolha o tipo de projeto para ver a estimativa.'; $('#estl').innerHTML = ''; return; }
  $('#estv').textContent = e.min ? `${brl(e.min).replace(',00', '')} – ${brl(e.max).replace(',00', '')}` : 'Sob consulta';
  $('#estn').textContent = e.min ? 'Faixa estimada para o seu projeto' : 'Me conte a ideia que eu monto uma proposta';
  $('#estl').innerHTML = e.linhas.map(([a, b]) => `<li><span>${esc(a)}</span><span>${b}</span></li>`).join('');
}
of.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'tipo') {
    os.tipo = t.value;
    const inc = PAG_INCLUSAS[t.value] || 1;
    if (os.paginas < inc) { os.paginas = inc; $('#opaginas').value = inc; $('#opagv').textContent = inc; }
    setTimeout(() => go(1), 280);
  }
  if (t.name === 'rec') t.checked ? os.recursos.add(t.value) : os.recursos.delete(t.value);
  if (t.name === 'prazo') os.prazo = t.value;
  if (t.name === 'orc') os.orc = +t.value;
  $('#oerr').textContent = '';
  renderEst();
});
$('#opaginas').addEventListener('input', (e) => { os.paginas = +e.target.value; $('#opagv').textContent = os.paginas; renderEst(); });

function validate(step) {
  if (step === 0 && !os.tipo) return 'Escolha um tipo de projeto para continuar.';
  if (step === 3) {
    const fd = new FormData(of);
    if ((fd.get('nome') || '').trim().length < 3) return 'Informe seu nome.';
    if ((fd.get('whats') || '').replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido com DDD.';
    if ((fd.get('desc') || '').trim().length < 10) return 'Conte um pouco mais sobre o projeto (mínimo 10 caracteres).';
  }
  return '';
}
function go(n) {
  if (n > os.step) { for (let s = os.step; s < n; s++) { const m = validate(s); if (m) { $('#oerr').textContent = m; go(s); return; } } }
  os.step = Math.max(0, Math.min(3, n));
  $$('.step', of).forEach((s) => s.classList.toggle('on', +s.dataset.step === os.step));
  $$('#ostepsnav button').forEach((b) => { const i = +b.dataset.go; b.classList.toggle('now', i === os.step); b.classList.toggle('done', i < os.step); });
  $('#oprev').hidden = os.step === 0;
  $('#onext').hidden = os.step === 3;
  $('#osend').hidden = os.step !== 3;
  $('#oerr').textContent = '';
}
$('#onext').onclick = () => go(os.step + 1);
$('#oprev').onclick = () => go(os.step - 1);
$('#ostepsnav').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) go(+b.dataset.go); };

of.onsubmit = (ev) => {
  ev.preventDefault();
  for (let s = 0; s <= 3; s++) { const m = validate(s); if (m) { go(s); $('#oerr').textContent = m; return; } }
  const fd = new FormData(of), e = estimate();
  const tipo = ENCOMENDA.tipos.find((x) => x.id === os.tipo);
  const rec = [...os.recursos].map((id) => ENCOMENDA.recursos.find((x) => x.id === id).nome);
  const num = 'EN-' + Date.now().toString(36).slice(-5).toUpperCase();
  const dados = {
    numero: num, nome: fd.get('nome').trim(), whatsapp: fd.get('whats').trim(), email: (fd.get('email') || '').trim(), empresa: (fd.get('empresa') || '').trim(),
    tipo: tipo.nome, recursos: rec.join(', ') || 'nenhum marcado', paginas: os.paginas,
    prazo: ENCOMENDA.prazos.find((x) => x.id === os.prazo).nome, orcamento: os.orc !== null ? ENCOMENDA.orcamentos[os.orc] : 'não informado',
    estimativa: e && e.min ? `${brl(e.min)} a ${brl(e.max)}` : 'sob consulta', descricao: fd.get('desc').trim(),
  };
  const msg = [
    `*Nova encomenda ${num}* (via portfólio)`, '',
    `*Nome:* ${dados.nome}`, `*WhatsApp:* ${dados.whatsapp}`, (dados.email && `*E-mail:* ${dados.email}`) || null, (dados.empresa && `*Empresa:* ${dados.empresa}`) || null, '',
    `*Tipo:* ${dados.tipo}`, `*Recursos:* ${dados.recursos}`, `*Páginas:* ${dados.paginas}`, `*Prazo:* ${dados.prazo}`, `*Investimento:* ${dados.orcamento}`, `*Estimativa do site:* ${dados.estimativa}`, '',
    `*Sobre o projeto:*`, dados.descricao,
  ].filter((x) => x || x === '').join('\n');

  if (CONFIG.formspree) {
    fetch(CONFIG.formspree, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...dados, _subject: `Encomenda ${num} — ${dados.tipo}` }) }).catch(() => {});
  }
  window.open(waLink(msg), '_blank', 'noopener');
  if (window.DB) {
    DB.track('encomenda', { tipo: os.tipo });
    DB.salvarPedido({ numero: num, origem: 'encomenda', nome: dados.nome, email: dados.email.toLowerCase(), whatsapp: dados.whatsapp, total: e && e.min ? e.min : 0, itens: [], dados });
  }
  showResult('ok', 'Encomenda pronta!', `Sua encomenda <b>${num}</b> foi aberta no WhatsApp. É só enviar a mensagem que eu respondo com a proposta detalhada.`,
    `<a class="btn wa full" href="${waLink(msg)}" target="_blank" rel="noopener">Abrir WhatsApp novamente</a><button class="btn full" style="margin-top:10px" data-dlg-close>Fechar</button>`);
  of.reset(); os.tipo = null; os.recursos.clear(); os.paginas = 1; os.prazo = 'normal'; os.orc = null;
  $('#opagv').textContent = 1; renderEst(); go(0);
};
go(0); renderEst();

/* =====================================================================
   SELETOR DE COR
   ===================================================================== */
(function () {
  const root = document.documentElement, sw = $('#sw'), panel = $('#ppanel'), btn = $('#pbtn');
  const PRESETS = [[255, 'Violeta'], [190, 'Ciano'], [145, 'Verde'], [330, 'Rosa'], [25, 'Laranja'], [0, 'Vermelho'], [46, 'Amarelo']];
  const hexHue = (hx) => { const r = parseInt(hx.slice(1, 3), 16) / 255, g = parseInt(hx.slice(3, 5), 16) / 255, b = parseInt(hx.slice(5, 7), 16) / 255, m = Math.max(r, g, b), d = m - Math.min(r, g, b); if (!d) return 0; const k = m === r ? ((g - b) / d) % 6 : m === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((k * 60 + 360) % 360); };
  sw.innerHTML = PRESETS.map(([v, n]) => `<button data-h="${v}" aria-label="${n}" title="${n}" style="background:hsl(${v} 100% 68%)"></button>`).join('');
  const set = (v) => {
    root.style.setProperty('--h', v);
    scene3d && scene3d.colors(v);
    $$('button', sw).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.h === v));
    store.set('portfolio-hue', v);
  };
  const saved = store.get('portfolio-hue', 255);
  set(isNaN(+saved) ? 255 : +saved);
  sw.onclick = (e) => { if (e.target.dataset.h) { set(+e.target.dataset.h); window.DB && DB.track('cor'); } };
  $('#pc').oninput = (e) => { set(hexHue(e.target.value)); window.DB && DB.track('cor'); };
  const toggle = (o) => { panel.hidden = !o; btn.setAttribute('aria-expanded', o); };
  btn.onclick = () => toggle(panel.hidden);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.picker')) toggle(false); });
})();
})();
