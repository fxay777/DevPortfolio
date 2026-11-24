/* Retenção: consentimento, métricas, quiz, blog, chat, popup de saída e lembrete de carrinho */
(() => {
'use strict';
const { CONFIG, SERVICOS } = window.CATALOGO;
const { esc, brl, waLink, ls } = window.DB;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const JF = window.JF || {};
const byId = (id) => SERVICOS.find((s) => s.id === id);
const agora = Date.now();

/* ---------- consentimento + métricas ---------- */
(function () {
  const box = $('#consent');
  if (!DB.ativo || DB.consent()) { iniciarMetricas(); return; }
  box.hidden = false;
  $('#cYes').onclick = () => { ls.set('jf-consent', 'sim'); box.hidden = true; iniciarMetricas(); };
  $('#cNo').onclick = () => { ls.set('jf-consent', 'nao'); box.hidden = true; };
})();

function iniciarMetricas() {
  if (DB.consent() !== 'sim') return;
  const ref = document.referrer && !document.referrer.includes(location.host) ? new URL(document.referrer).hostname : '';
  const q = new URLSearchParams(location.search);
  DB.track('visita', { ref, utm: q.get('utm_source') || '', mobile: innerWidth < 760, volta: !!ls.get('jf-ultima', 0) });
  const vistas = new Set();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting && !vistas.has(e.target.id)) { vistas.add(e.target.id); DB.track('secao', { id: e.target.id }); }
  }), { threshold: 0.35 });
  $$('main section[id]').forEach((s) => io.observe(s));
  [30, 90, 180].forEach((t) => setTimeout(() => { if (!document.hidden) DB.track('tempo', { s: t }); }, t * 1000));
}

/* ---------- lembrete de carrinho para quem volta ---------- */
(function () {
  const ultima = ls.get('jf-ultima', 0);
  ls.set('jf-ultima', agora);
  const itens = JF.itens ? JF.itens() : [];
  if (!itens.length || !ultima || agora - ultima < 30 * 60 * 1000) return;
  if (new URLSearchParams(location.search).get('pedido')) return;
  setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'remind'; el.setAttribute('role', 'status');
    el.innerHTML = `<button class="x" aria-label="Fechar">×</button><b>Que bom te ver de novo! 👋</b>
      <p>Seu pedido continua salvo: ${esc(itens.slice(0, 2).join(', '))}${itens.length > 2 ? ' e mais' : ''}.</p>
      <div class="row"><button class="btn primary" data-go>Ver meu pedido</button></div>`;
    document.body.appendChild(el);
    el.querySelector('.x').onclick = () => el.remove();
    el.querySelector('[data-go]').onclick = () => { el.remove(); JF.openCart && JF.openCart(true); };
    setTimeout(() => el.remove(), 12000);
    DB.track('lembrete_carrinho');
  }, 2200);
})();

/* ---------- QUIZ ---------- */
const QUIZ = [
  { p: 'Qual é o seu principal objetivo?', o: [
    ['🛒', 'Vender produtos online', { loja: 4 }], ['💬', 'Receber mais contatos e clientes', { landing: 3, institucional: 2 }],
    ['🏢', 'Apresentar minha empresa', { institucional: 4 }], ['⚙️', 'Automatizar processos', { sistema: 4 }],
    ['✨', 'Impressionar e mostrar meu trabalho', { portfolio3d: 4 }] ] },
  { p: 'Quantos produtos ou serviços você oferece?', o: [
    ['1️⃣', 'Um só, bem específico', { landing: 3 }], ['🔢', 'De 2 a 10', { institucional: 2, portfolio3d: 1 }],
    ['📦', 'Mais de 10 produtos', { loja: 3 }], ['🔁', 'É um processo interno', { sistema: 3 }] ] },
  { p: 'Você pretende anunciar (Instagram, Google…)?', o: [
    ['📣', 'Sim, já anuncio ou vou anunciar', { landing: 2, loja: 1 }], ['🔍', 'Quero ser achado no Google', { institucional: 2, _seo: 1 }],
    ['🤝', 'Não, vou divulgar para meus clientes', { portfolio3d: 1, sistema: 1, institucional: 1 }] ] },
  { p: 'O que não pode faltar?', o: [
    ['📅', 'Agendamento ou login', { sistema: 3 }], ['💳', 'Pagamento com Pix e cartão', { loja: 2 }],
    ['🧊', 'Visual 3D marcante', { portfolio3d: 3 }], ['⚡', 'Algo simples e rápido', { landing: 2 }], ['✍️', 'Textos que vendem', { _copy: 1, institucional: 1 }] ] },
];
const quiz = { i: 0, pts: {}, resp: [] };
function quizRender() {
  const box = $('#quizBox'); if (!box) return;
  if (quiz.i < QUIZ.length) {
    const q = QUIZ[quiz.i];
    box.innerHTML = `<div class="qbar"><b style="width:${(quiz.i / QUIZ.length) * 100}%"></b></div>
      <div class="qstep"><div class="qn">Pergunta ${quiz.i + 1} de ${QUIZ.length}</div><h3>${q.p}</h3>
      <div class="qopts">${q.o.map((o, k) => `<button class="qopt" data-k="${k}"><i>${o[0]}</i><span>${o[1]}</span></button>`).join('')}</div>
      ${quiz.i ? '<button class="again" data-back>← voltar</button>' : ''}</div>`;
    return;
  }
  const pacotes = ['landing', 'institucional', 'loja', 'portfolio3d', 'sistema'];
  const best = pacotes.sort((a, b) => (quiz.pts[b] || 0) - (quiz.pts[a] || 0))[0];
  const s = byId(best);
  const extras = [quiz.pts._seo && 'seo', quiz.pts._copy && 'copy'].filter(Boolean).map(byId);
  ls.set('jf-quiz', { pacote: best, quando: Date.now() });
  DB.track('quiz_fim', { pacote: best });
  const lead = ls.get('jf-lead', null);
  box.innerHTML = `<div class="qbar"><b style="width:100%"></b></div><div class="qstep res">
    <div><div class="qn">Sua recomendação</div><div class="big">${esc(s.nome)}</div>
      <p style="color:var(--muted)">${esc(s.resumo)}</p>
      <ul>${s.inclui.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p><b style="font:800 1.6rem var(--display)">${brl(s.preco)}</b> <span style="color:var(--muted)">a partir de · ${esc(s.prazo)}</span></p>
      ${extras.length ? `<p style="color:var(--muted);margin-top:8px">Combina bem com: ${extras.map((e) => `<b style="color:var(--text)">${esc(e.nome)}</b>`).join(', ')}</p>` : ''}
      <div class="acts"><button class="btn primary" data-addq="${s.id}">Adicionar ao pedido <span class="arr">→</span></button><a class="btn" href="#encomenda">Personalizar</a></div>
      <button class="again" data-redo>Refazer o quiz</button></div>
    <div class="side">${lead ? `<b>Pronto, ${esc(lead.nome || '')}!</b><p style="color:var(--muted);font-size:.92rem;margin-top:6px">Quer tirar uma dúvida sobre esse pacote?</p>
        <a class="btn wa full" style="margin-top:12px" target="_blank" rel="noopener" href="${waLink(`Olá Jackson! Fiz o quiz no seu site e a recomendação foi *${s.nome}*. Pode me explicar melhor?`)}">Falar no WhatsApp</a>`
      : `<b>Receba uma análise grátis</b><p style="color:var(--muted);font-size:.92rem;margin-top:6px">Deixe seu contato e eu te mando dicas para o seu projeto de ${esc(s.nome.toLowerCase())}.</p>
        <form data-qlead><input class="field" name="nome" placeholder="Seu nome" required><input class="field" name="contato" placeholder="WhatsApp ou e-mail" required><button class="btn primary full">Quero a análise</button></form>`}</div>
  </div>`;
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('.qopt');
  if (o && $('#quizBox').contains(o)) {
    const q = QUIZ[quiz.i], op = q.o[+o.dataset.k];
    quiz.resp[quiz.i] = op[1];
    Object.entries(op[2]).forEach(([k, v]) => { quiz.pts[k] = (quiz.pts[k] || 0) + v; });
    if (quiz.i === 0) DB.track('quiz_inicio');
    quiz.i++; quizRender(); JF.scene && JF.scene.pulse(); return;
  }
  if (e.target.closest('[data-back]')) { quiz.i = 0; quiz.pts = {}; quiz.resp = []; quizRender(); return; }
  if (e.target.closest('[data-redo]')) { quiz.i = 0; quiz.pts = {}; quiz.resp = []; quizRender(); return; }
  const a = e.target.closest('[data-addq]');
  if (a) { JF.add(a.dataset.addq); JF.toast('✓ Adicionado ao pedido'); JF.openCart(true); DB.track('add_carrinho', { id: a.dataset.addq, de: 'quiz' }); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-qlead]'); if (!f) return;
  e.preventDefault();
  const nome = f.nome.value.trim(), contato = f.contato.value.trim();
  if (contato.replace(/\D/g, '').length < 10 && !/^\S+@\S+\.\S+$/.test(contato)) { f.contato.value = ''; f.contato.placeholder = 'Informe um WhatsApp ou e-mail válido'; return; }
  await DB.lead(nome, contato, 'quiz', { respostas: quiz.resp, pacote: (ls.get('jf-quiz', {}) || {}).pacote });
  DB.track('lead', { origem: 'quiz' });
  quizRender();
  JF.toast('✓ Recebido! Em breve eu te chamo.');
});
quizRender();

/* ---------- BLOG (últimos posts) ---------- */
function cardPost(p) {
  return `<a class="post" href="blog.html?p=${encodeURIComponent(p.slug)}" data-reveal>
    <span class="cat">${esc(p.categoria || 'Dica')}</span><h3>${esc(p.titulo)}</h3><p>${esc(p.resumo || '')}</p>
    <span class="dt">${DB.data(p.criado_em)}</span><span class="rd">Ler artigo →</span></a>`;
}
addEventListener('DOMContentLoaded', async () => {
  const el = $('#postsHome'); if (!el) return;
  const lista = await DB.posts();
  el.innerHTML = lista.slice(0, 3).map(cardPost).join('');
  requestAnimationFrame(() => $$('[data-reveal]', el).forEach((x) => x.classList.add('in')));
});

/* ---------- AVALIAÇÕES REAIS ---------- */
addEventListener('DOMContentLoaded', async () => {
  const sec = $('#avaliacoes'); if (!sec || !DB.ativo) return;
  const c = await DB.client(); if (!c) return;
  const { data } = await c.from('avaliacoes').select('nota,texto,nome_exibicao,projeto,criado_em').eq('aprovado', true).eq('autoriza_publicar', true).order('criado_em', { ascending: false }).limit(9);
  if (!data || !data.length) return;
  const media = data.reduce((a, r) => a + r.nota, 0) / data.length;
  $('#ratingSum').innerHTML = `<strong>${media.toFixed(1).replace('.', ',')}</strong><span><span style="color:#fbbf24;letter-spacing:2px">${'★'.repeat(Math.round(media))}${'☆'.repeat(5 - Math.round(media))}</span><br>${data.length} avaliaç${data.length > 1 ? 'ões' : 'ão'} de clientes reais</span>`;
  $('#reviews').innerHTML = data.map((r, i) => `<figure class="review" data-reveal style="--d:${i * 0.06}s"><span class="st" aria-label="${r.nota} de 5">${'★'.repeat(r.nota)}${'☆'.repeat(5 - r.nota)}</span>
    ${r.texto ? `<p>“${esc(r.texto)}”</p>` : '<p></p>'}<figcaption><b>${esc(r.nome_exibicao || 'Cliente')}</b>${r.projeto ? `<br><small>${esc(r.projeto)}</small>` : ''}</figcaption></figure>`).join('');
  sec.hidden = false;
  requestAnimationFrame(() => $$('[data-reveal]', sec).forEach((x) => x.classList.add('in')));
});

/* ---------- CHAT ---------- */
const chat = { aberto: false, iniciado: false };
const btn = $('#chatBtn'), box = $('#chatBox'), msgs = $('#chatMsgs'), nudge = $('#chatNudge');
const menor = Math.min(...SERVICOS.filter((s) => s.tipo === 'servico').map((s) => s.preco));
const RESP = {
  preco: () => `Os projetos começam em <b>${brl(menor)}</b> (landing page). Um site institucional completo sai a partir de <b>${brl(byId('institucional').preco)}</b> e uma loja virtual a partir de <b>${brl(byId('loja').preco)}</b>. Você pode pagar só ${Math.round(CONFIG.sinal * 100)}% para reservar.`,
  qual: () => 'Fiz um quiz de 30 segundos que recomenda o pacote ideal para o seu caso. Quer fazer?',
  pagamento: () => `Você escolhe: <b>sinal de ${Math.round(CONFIG.sinal * 100)}%</b> para reservar e o resto na entrega, ou o valor integral. Aceito Pix, cartão (inclusive parcelado) e boleto pelo Mercado Pago.`,
  prazo: () => `Em média: landing page em ${byId('landing').prazo}, site institucional em ${byId('institucional').prazo} e loja virtual em ${byId('loja').prazo}. O prazo começa quando o briefing e os conteúdos estão prontos.`,
  suporte: () => 'Você tem três caminhos: procurar a resposta na <a href="ajuda.html">Central de ajuda</a>, abrir um <b>chamado</b> na Área do cliente (fica tudo registrado e você é avisado da resposta) ou me chamar no WhatsApp.',
  pedido: () => 'Na <a href="cliente.html">Área do cliente</a> você acompanha o status do seu projeto e as atualizações que eu publico. É só entrar com o mesmo e-mail do pedido.',
};
const PARADAS = new Set('site sites quero queria meu minha para pra com como que uma tem sobre voce voces fazer posso preciso gostaria saber qual quais esta isso essa esse ola oi bom boa dia tarde noite obrigado'.split(' '));
function buscaAjuda(txt) {
  const K = window.AJUDA; if (!K) return null;
  const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termos = norm(txt).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !PARADAS.has(t));
  let best = null, bs = 0;
  K.artigos.forEach((a) => { const alvo = norm(a.q + ' ' + a.tags); const sc = termos.reduce((s, t) => s + (alvo.includes(t) ? 1 : 0), 0); if (sc > bs) { bs = sc; best = a; } });
  return bs >= 1 ? best : null;
}
const QUICK = [['preco', '💰 Quanto custa?'], ['qual', '🤔 Qual pacote é ideal?'], ['pagamento', '💳 Formas de pagamento'], ['prazo', '⏱ Prazo de entrega'], ['pedido', '📦 Acompanhar meu pedido'], ['suporte', '🛟 Preciso de suporte']];
function add(html, quem = 'bot') {
  const d = document.createElement('div'); d.className = 'msg ' + quem; d.innerHTML = html;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
}
function botDiz(html, extra = '') {
  const t = add('<div class="typing"><i></i><i></i><i></i></div>');
  t.style.padding = '0';
  setTimeout(() => { t.style.padding = ''; t.innerHTML = html + (extra ? `<div class="quick" style="margin-top:10px">${extra}</div>` : ''); msgs.scrollTop = msgs.scrollHeight; }, 650);
}
const quickHtml = () => QUICK.map(([k, t]) => `<button data-q="${k}">${t}</button>`).join('') + `<a href="${waLink('Olá Jackson, vim pelo seu portfólio!')}" target="_blank" rel="noopener">🟢 Falar com o Jackson</a>`;
function abrir(o) {
  chat.aberto = o; box.hidden = !o; nudge.hidden = true; btn.setAttribute('aria-expanded', o);
  const b = btn.querySelector('.badge-n'); if (b) b.remove();
  if (o && !chat.iniciado) {
    chat.iniciado = true;
    const n = (ls.get('jf-lead', null) || ls.get('jf-cliente', null) || {}).nome;
    botDiz(`Oi${n ? ', ' + esc(n.split(' ')[0]) : ''}! 👋 Eu sou o assistente do Jackson. Como posso te ajudar?`, quickHtml());
    DB.track('chat_aberto');
  }
  if (o) setTimeout(() => $('#chatForm input').focus(), 100);
}
btn.onclick = () => abrir(!chat.aberto);
nudge.onclick = () => abrir(true);
$('#chatX').onclick = () => abrir(false);
msgs.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]'); if (!q) return;
  const k = q.dataset.q;
  add(esc(q.textContent), 'me');
  DB.track('chat_pergunta', { k });
  let extra = '';
  if (k === 'preco') extra = '<a href="#loja" data-cl>Ver pacotes</a><button data-q="qual">Qual é o ideal?</button>';
  if (k === 'qual') extra = '<a href="#quiz" data-cl>Fazer o quiz</a><a href="#encomenda" data-cl>Encomendar sob medida</a>';
  if (k === 'pagamento' || k === 'prazo') extra = '<a href="#loja" data-cl>Ver pacotes</a><a href="#faq" data-cl>Mais dúvidas</a>';
  if (k === 'pedido') extra = '<a href="cliente.html">Abrir Área do cliente</a>';
  if (k === 'suporte') extra = '<a href="ajuda.html">📖 Central de ajuda</a><a href="cliente.html#suporte">🛟 Abrir chamado</a>';
  botDiz(RESP[k](), extra + `<a href="${waLink('Olá Jackson, vim pelo seu portfólio e tenho uma dúvida.')}" target="_blank" rel="noopener">🟢 WhatsApp</a>`);
});
msgs.addEventListener('click', (e) => { if (e.target.closest('[data-cl]') && innerWidth < 760) abrir(false); });
$('#chatForm').onsubmit = (e) => {
  e.preventDefault();
  const m = e.target.m.value.trim(); if (!m) return;
  add(esc(m), 'me'); e.target.m.value = '';
  DB.track('chat_msg');
  const low = m.toLowerCase();
  const k = /pre[çc]o|cust|valor|quanto/.test(low) ? 'preco' : /pag|pix|cart[aã]o|boleto|parcel/.test(low) ? 'pagamento' : /prazo|demor|tempo|dias/.test(low) ? 'prazo' : /pedido|acompanh|status/.test(low) ? 'pedido' : /qual|ideal|melhor|recomend/.test(low) ? 'qual' : null;
  const wa = `<a href="${waLink(m)}" target="_blank" rel="noopener">🟢 Enviar para o Jackson no WhatsApp</a>`;
  if (k) return botDiz(RESP[k](), wa);
  const art = buscaAjuda(m);
  if (art) {
    const resumo = DB.md(art.a.split(/\n\n/)[0]).replace(/<\/?p>/g, '');
    return botDiz(`<b>${esc(art.q)}</b><br>${resumo}`, `<a href="ajuda.html#${art.id}">📖 Ler completo</a><a href="cliente.html#suporte">🛟 Abrir chamado</a>` + wa);
  }
  botDiz('Boa pergunta! Essa eu prefiro responder pessoalmente. Abra um chamado ou mande direto no meu WhatsApp:', `<a href="cliente.html#suporte">🛟 Abrir chamado</a>` + wa);
};
// convite discreto depois de um tempo
if (!sessionStorage.getItem('jf-nudge')) {
  setTimeout(() => {
    if (chat.aberto || document.querySelector('dialog[open]')) return;
    sessionStorage.setItem('jf-nudge', '1');
    nudge.hidden = false;
    const b = document.createElement('span'); b.className = 'badge-n'; b.textContent = '1'; btn.appendChild(b);
    setTimeout(() => { nudge.hidden = true; }, 9000);
  }, 28000);
}

/* ---------- POPUP DE SAÍDA ---------- */
(function () {
  const dlg = $('#dlg');
  const visto = ls.get('jf-exit', 0);
  if (visto && agora - visto < 5 * 864e5) return; // no máximo 1 vez a cada 5 dias
  if (new URLSearchParams(location.search).get('pedido')) return;
  let pronto = false, mostrado = false;
  setTimeout(() => { pronto = true; }, 9000);

  function mostrar(motivo) {
    if (!pronto || mostrado || dlg.open || chat.aberto || $('#cart').classList.contains('open')) return;
    const itens = JF.itens ? JF.itens() : [];
    const cup = CONFIG.cupomSaida && CONFIG.cupons && CONFIG.cupons[CONFIG.cupomSaida] ? CONFIG.cupomSaida : '';
    const pct = cup ? Math.round(CONFIG.cupons[cup] * 100) : 0;
    if (!itens.length && ls.get('jf-lead', null) && !cup) return;
    mostrado = true; ls.set('jf-exit', Date.now());
    DB.track('saida_popup', { motivo, carrinho: itens.length });
    const x = '<div style="display:flex;justify-content:flex-end"><button class="x" data-dlg-close aria-label="Fechar">×</button></div>';
    if (itens.length) {
      dlg.innerHTML = `<div class="dlg-in ok exit">${x}<h2>Seu pedido está esperando!</h2>
        <div class="its">${itens.map((n) => `<span>✓ ${esc(n)}</span>`).join('')}</div>
        ${cup ? `<p class="sm">Finalize agora e ganhe</p><div class="off">${pct}% OFF</div><p class="sm">com o cupom <b>${cup}</b>, aplicado automaticamente.</p>` : '<p class="sm">Reserve sua vaga na agenda pagando só o sinal.</p>'}
        <button class="btn primary full" style="margin-top:18px" data-fin>${cup ? 'Aplicar cupom e finalizar' : 'Finalizar pedido'} <span class="arr">→</span></button>
        <button class="no" data-dlg-close>Agora não</button></div>`;
    } else if (cup) {
      dlg.innerHTML = `<div class="dlg-in ok exit">${x}<p class="sm">Antes de você ir…</p><div class="off">${pct}% OFF</div>
        <h2 style="font-size:1.4rem">no seu primeiro projeto</h2>
        <p class="sm" style="margin-top:6px">Deixe seu contato e libere o cupom na hora. Sem spam, prometo.</p>
        <form data-exit><input class="field" name="nome" placeholder="Seu nome" required autocomplete="name">
        <input class="field" name="contato" placeholder="WhatsApp ou e-mail" required>
        <button class="btn primary full">Liberar meu cupom</button></form>
        <button class="no" data-dlg-close>Não, obrigado</button></div>`;
    } else {
      dlg.innerHTML = `<div class="dlg-in ok exit">${x}<h2>Antes de ir…</h2><p class="sm">Quer uma análise gratuita do que o seu negócio precisa online? Deixe seu contato.</p>
        <form data-exit><input class="field" name="nome" placeholder="Seu nome" required><input class="field" name="contato" placeholder="WhatsApp ou e-mail" required>
        <button class="btn primary full">Quero minha análise</button></form><button class="no" data-dlg-close>Não, obrigado</button></div>`;
    }
    dlg.showModal();
    const fin = dlg.querySelector('[data-fin]');
    if (fin) fin.onclick = () => { if (cup) JF.aplicarCupom(cup); dlg.close(); JF.openCart(true); DB.track('saida_converteu', { tipo: 'carrinho' }); };
    const f = dlg.querySelector('[data-exit]');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const nome = f.nome.value.trim(), contato = f.contato.value.trim();
      if (contato.replace(/\D/g, '').length < 10 && !/^\S+@\S+\.\S+$/.test(contato)) { f.contato.value = ''; f.contato.placeholder = 'WhatsApp com DDD ou e-mail válido'; return; }
      DB.lead(nome, contato, 'saida', { cupom: cup });
      DB.track('saida_converteu', { tipo: 'lead' });
      if (cup) JF.aplicarCupom(cup);
      dlg.innerHTML = `<div class="dlg-in ok exit">${x}<div class="big">✓</div><h2>Cupom liberado, ${esc(nome.split(' ')[0])}!</h2>
        ${cup ? `<div class="cup">${cup}<button class="mini" data-copy>Copiar</button></div><p class="sm">Já apliquei no seu carrinho. Vale para qualquer pacote.</p>` : '<p class="sm">Recebi seu contato. Em breve eu te chamo!</p>'}
        <a class="btn primary full" href="#loja" data-dlg-close style="margin-top:16px">Ver pacotes</a></div>`;
      const c = dlg.querySelector('[data-copy]');
      if (c) c.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(cup); c.textContent = 'Copiado!'; };
    };
  }

  // computador: mouse sai pelo topo da janela
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY <= 4) mostrar('mouse'); });
  // celular: depois de 40s, rolagem rápida para cima (gesto de quem vai sair)
  let lastY = scrollY, lastT = performance.now(), cedo = true;
  setTimeout(() => { cedo = false; }, 40000);
  addEventListener('scroll', () => {
    const y = scrollY, t = performance.now();
    if (!cedo && innerWidth < 860 && lastY - y > innerHeight * 0.9 && t - lastT < 450 && y > 200) mostrar('scroll');
    if (t - lastT > 120) { lastY = y; lastT = t; }
  }, { passive: true });
  // quem troca de aba com o carrinho cheio
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pronto && JF.itens && JF.itens().length) mostrar('voltou'); });
})();
})();

/* ---------- botão "Entrar / minha conta" no topo ---------- */
(async () => {
  const hr = document.querySelector('header .hright'); if (!hr || !DB.ativo) return;
  const a = document.createElement('a'); a.className = 'conta-btn'; a.href = 'cliente.html';
  a.innerHTML = '<span class="av">👤</span><span class="t">Entrar</span>'; a.setAttribute('aria-label', 'Entrar ou criar conta');
  hr.insertBefore(a, hr.querySelector('#openCart'));
  const c = await DB.client(); if (!c) return;
  const { data: { session } } = await c.auth.getSession(); if (!session) return;
  const meta = session.user.user_metadata || {};
  const nome = meta.usuario ? '@' + meta.usuario : (meta.nome || session.user.email).split(/[\s@]/)[0];
  a.querySelector('.t').textContent = nome; a.querySelector('.av').textContent = nome.replace('@', '')[0].toUpperCase();
  a.classList.add('logado'); a.setAttribute('aria-label', 'Minha conta');
  const prev = DB.ls.get('jf-cliente', {}) || {};
  DB.ls.set('jf-cliente', { nome: prev.nome || meta.nome || '', email: session.user.email, whatsapp: prev.whatsapp || meta.whatsapp || '' });
})();
