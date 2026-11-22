/* Camada compartilhada: Supabase, métricas anônimas, leads, blog e utilidades.
   Funciona mesmo sem Supabase configurado (aí tudo cai no WhatsApp / posts padrão). */
(function () {
  'use strict';
  const { CONFIG } = window.CATALOGO;
  const SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  const ativo = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
  let clientP = null;

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  function client() {
    if (!ativo) return Promise.resolve(null);
    if (clientP) return clientP;
    clientP = new Promise((ok) => {
      const make = () => ok(window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } }));
      if (window.supabase && window.supabase.createClient) return make();
      const s = document.createElement('script');
      s.src = SB_CDN; s.async = true; s.onload = make; s.onerror = () => ok(null);
      document.head.appendChild(s);
    });
    return clientP;
  }

  /* ---------- consentimento (LGPD) ---------- */
  const consent = () => ls.get('jf-consent', null); // 'sim' | 'nao' | null
  function sessao() {
    let s = ls.get('jf-sid', null);
    if (!s) { s = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); ls.set('jf-sid', s); }
    return s;
  }

  /* ---------- métricas anônimas ---------- */
  const fila = [];
  let timer = null;
  function track(tipo, dados = {}) {
    // avisa o resto do site (missões, conquistas) mesmo sem métricas ligadas
    try { document.dispatchEvent(new CustomEvent('jf:evento', { detail: { tipo, dados } })); } catch {}
    if (!ativo || consent() !== 'sim') return;
    fila.push({ sessao: sessao(), tipo: String(tipo).slice(0, 40), pagina: location.pathname.slice(0, 200), dados });
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  async function flush() {
    if (!fila.length) return;
    const lote = fila.splice(0, fila.length);
    const c = await client(); if (!c) return;
    try { await c.from('eventos').insert(lote); } catch {}
  }
  addEventListener('pagehide', flush);

  /* ---------- leads ---------- */
  async function lead(nome, contato, origem, dados = {}) {
    ls.set('jf-lead', { nome, contato, quando: Date.now() });
    const c = await client(); if (!c) return false;
    const { error } = await c.from('leads').insert({ nome: (nome || '').slice(0, 120), contato: String(contato).slice(0, 160), origem, dados });
    return !error;
  }

  /* ---------- pedidos (WhatsApp / encomenda) ---------- */
  async function salvarPedido(p) {
    const c = await client(); if (!c) return false;
    const { data: { session } = {} } = await c.auth.getSession();
    const { error } = await c.from('pedidos').insert({ ...p, status: 'novo', user_id: session ? session.user.id : null });
    if (error) console.warn('pedido:', error.message);
    return !error;
  }

  /* ---------- blog ---------- */
  async function posts() {
    const c = await client();
    if (c) {
      const { data, error } = await c.from('posts').select('slug,titulo,resumo,categoria,criado_em,conteudo').eq('publicado', true).order('criado_em', { ascending: false }).limit(50);
      if (!error && data && data.length) return data;
    }
    return (window.POSTS_PADRAO || []).slice();
  }

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const data = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const waLink = (msg, num = CONFIG.whatsapp) => `https://wa.me/${String(num).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;

  // Markdown simples e SEGURO (escapa todo HTML antes): ## título, ### subtítulo, - lista, 1. lista, **negrito**, *itálico*, [link](https://...), > citação
  function md(txt) {
    const inline = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#|mailto:|[a-z0-9-]+\.html)[^\s)]*)\)/g, (m, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
    const out = []; let lista = null;
    const fecha = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
    String(txt || '').split(/\r?\n/).forEach((l) => {
      const t = l.trim();
      let m;
      if (!t) return fecha();
      if ((m = t.match(/^(#{2,3})\s+(.*)/))) { fecha(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); return; }
      if ((m = t.match(/^[-*]\s+(.*)/))) { if (lista !== 'ul') { fecha(); out.push('<ul>'); lista = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); return; }
      if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (lista !== 'ol') { fecha(); out.push('<ol>'); lista = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); return; }
      if ((m = t.match(/^>\s?(.*)/))) { fecha(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); return; }
      fecha(); out.push(`<p>${inline(t)}</p>`);
    });
    fecha();
    return out.join('\n');
  }

  const STATUS = {
    novo: ['Recebido', '#a78bfa'], aguardando_pagamento: ['Aguardando pagamento', '#fbbf24'], pendente: ['Pagamento em análise', '#fbbf24'],
    pago: ['Pago · vaga reservada', '#4ade80'], briefing: ['Briefing', '#38bdf8'], desenvolvimento: ['Em desenvolvimento', '#818cf8'],
    revisao: ['Em revisão', '#f472b6'], entregue: ['Entregue', '#4ade80'], cancelado: ['Cancelado', '#f87171'],
  };
  const ETAPAS = ['novo', 'pago', 'briefing', 'desenvolvimento', 'revisao', 'entregue'];

  // aplica a cor escolhida pelo visitante em todas as páginas
  try { const raw = localStorage.getItem('portfolio-hue'), h = raw === null ? NaN : +JSON.parse(raw); if (h >= 0 && h <= 360) document.documentElement.style.setProperty('--h', h); } catch {}

  window.DB = { ativo, client, track, flush, lead, salvarPedido, posts, consent, ls, esc, brl, data, waLink, md, STATUS, ETAPAS, CONFIG };
})();
