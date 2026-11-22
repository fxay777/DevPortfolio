// Servidor do site na Cloudflare (Workers).
// - Arquivos do site: pasta public/ (a Cloudflare serve sozinha)
// - POST /api/checkout   cria o pagamento no Mercado Pago e registra o pedido
// - POST /api/webhook-mp recebe a confirmação de pagamento do Mercado Pago
//
// Secrets (Cloudflare > seu Worker > Settings > Variables and Secrets > tipo "Secret"):
//   MP_ACCESS_TOKEN       Access Token do Mercado Pago (APP_USR-...)        obrigatório
//   SUPABASE_SECRET_KEY   Secret key do Supabase (sb_secret_...)           opcional
// Variáveis comuns (tipo "Text"):
//   SUPABASE_URL          https://xxxx.supabase.co                          opcional
//   SITE_URL              https://seudominio.com.br                         opcional
import CATALOGO from '../public/assets/catalogo.js';

const { CONFIG, SERVICOS } = CATALOGO;
const round = (v) => Math.round(v * 100) / 100;
const clean = (v, max) => String(v || '').replace(/[<>]/g, '').trim().slice(0, max);
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

/* ---------- Supabase pelo servidor ---------- */
function banco(env) {
  const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const ativo = !!(URL_ && KEY);
  async function rest(path, { method = 'GET', body, prefer } = {}) {
    if (!ativo) return null;
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (!KEY.startsWith('sb_')) headers.Authorization = `Bearer ${KEY}`; // chaves antigas (JWT)
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${URL_.replace(/\/$/, '')}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt.slice(0, 300)}`);
    return txt ? JSON.parse(txt) : null;
  }
  return { ativo, rest };
}

/* ---------- POST /api/checkout ---------- */
async function checkout(request, env) {
  if (request.method !== 'POST') return json({ erro: 'Método não permitido' }, 405, { Allow: 'POST' });
  const token = env.MP_ACCESS_TOKEN;
  if (!token) return json({ erro: 'Pagamento online não configurado' }, 503);

  let body = {};
  try { body = (await request.json()) || {}; } catch { body = {}; }

  // preços SEMPRE do catálogo do servidor, nunca do navegador
  const cupom = clean(body.cupom, 30).toUpperCase();
  const desconto = (CONFIG.cupons && CONFIG.cupons[cupom]) || 0;
  const sinal = body.plano === 'sinal';
  const fator = (sinal ? CONFIG.sinal : 1) * (1 - desconto);
  const pedido = Array.isArray(body.itens) ? body.itens.slice(0, 30) : [];
  const items = [], itensDb = [];
  let total = 0;
  for (const it of pedido) {
    const s = SERVICOS.find((x) => x.id === it.id);
    if (!s) continue;
    const qtd = Math.max(1, Math.min(24, parseInt(it.qtd, 10) || 1));
    items.push({
      id: s.id,
      title: `${s.nome}${s.mensal ? ' (mês)' : ''}${sinal ? ` · sinal ${Math.round(CONFIG.sinal * 100)}%` : ''}${desconto ? ` · -${Math.round(desconto * 100)}%` : ''}`,
      description: s.resumo.slice(0, 250),
      quantity: qtd,
      unit_price: round(s.preco * fator),
      currency_id: 'BRL',
    });
    itensDb.push({ id: s.id, nome: s.nome, qtd, preco: s.preco });
    total += s.preco * qtd;
  }
  if (!items.length) return json({ erro: 'Carrinho vazio' }, 400);
  total = round(total * (1 - desconto));

  const cli = body.cliente || {};
  const nome = clean(cli.nome, 80), email = clean(cli.email, 120).toLowerCase();
  let numero = /^JF-[A-Z0-9]{3,12}$/.test(body.numero || '') ? body.numero : 'JF-' + Date.now().toString(36).toUpperCase();
  const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

  const db = banco(env);
  if (db.ativo) {
    try {
      // nunca reaproveita um número que já existe (evita mexer no pedido de outra pessoa)
      const existe = await db.rest(`pedidos?numero=eq.${encodeURIComponent(numero)}&select=id`);
      if (existe && existe.length) numero = 'JF-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(-10);
      await db.rest('pedidos', {
        method: 'POST',
        body: {
          numero, origem: 'loja', nome, email, whatsapp: clean(cli.whatsapp, 30), itens: itensDb, total,
          plano: sinal ? 'sinal' : 'total', cupom: desconto ? cupom : null, status: 'aguardando_pagamento',
          dados: { projeto: clean(cli.projeto, 120), obs: clean(cli.obs, 500) },
        },
      });
    } catch (e) { console.error(e.message); }
  }

  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        payer: { name: nome, email: email || undefined },
        external_reference: numero,
        statement_descriptor: 'JACKSONFB DEV',
        notification_url: `${site}/api/webhook-mp`,
        back_urls: {
          success: `${site}/?pedido=aprovado&n=${encodeURIComponent(numero)}`,
          pending: `${site}/?pedido=pendente&n=${encodeURIComponent(numero)}`,
          failure: `${site}/?pedido=falhou&n=${encodeURIComponent(numero)}`,
        },
        auto_return: 'approved',
        metadata: { numero, plano: sinal ? 'sinal' : 'total', cupom: desconto ? cupom : '' },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.init_point) {
      console.error('Mercado Pago:', r.status, JSON.stringify(data).slice(0, 500));
      return json({ erro: 'Não foi possível criar o pagamento' }, 502);
    }
    return json({ url: data.init_point, numero });
  } catch (e) {
    console.error(e);
    return json({ erro: 'Falha ao falar com o Mercado Pago' }, 502);
  }
}

/* ---------- POST /api/webhook-mp ---------- */
// Não confia no conteúdo do aviso: consulta o pagamento direto na API do Mercado Pago.
async function webhook(request, env, url) {
  const token = env.MP_ACCESS_TOKEN, db = banco(env);
  let body = {};
  if (request.method === 'POST') { try { body = (await request.json()) || {}; } catch { body = {}; } }
  const q = url.searchParams;
  const tipo = body.type || q.get('type') || q.get('topic');
  const id = (body.data && body.data.id) || q.get('data.id') || q.get('id');
  if (!token || !db.ativo || tipo !== 'payment' || !/^\d+$/.test(String(id || ''))) return json({ ok: true, ignorado: true });

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('MP ' + r.status);
    const p = await r.json();
    const numero = p.external_reference;
    if (!numero) return json({ ok: true });

    const [ped] = (await db.rest(`pedidos?numero=eq.${encodeURIComponent(numero)}&select=id,status,valor_pago,mp_payment_id`)) || [];
    if (!ped) return json({ ok: true, semPedido: true });

    const mapa = { approved: 'pago', authorized: 'pago', pending: 'pendente', in_process: 'pendente', rejected: 'aguardando_pagamento', cancelled: 'aguardando_pagamento', refunded: 'cancelado', charged_back: 'cancelado' };
    let status = mapa[p.status] || ped.status;
    const avancado = ['briefing', 'desenvolvimento', 'revisao', 'entregue'].includes(ped.status);
    if (avancado && status === 'pago') status = ped.status; // não volta um projeto que já avançou

    const pagoAgora = p.status === 'approved' && ped.mp_payment_id !== String(p.id);
    await db.rest(`pedidos?id=eq.${ped.id}`, {
      method: 'PATCH',
      body: { status, mp_payment_id: String(p.id), ...(pagoAgora ? { valor_pago: round(Number(ped.valor_pago) + Number(p.transaction_amount || 0)) } : {}) },
    });
    if (pagoAgora) {
      await db.rest('atualizacoes', { method: 'POST', body: { pedido_id: ped.id, texto: `Pagamento de R$ ${Number(p.transaction_amount).toFixed(2).replace('.', ',')} confirmado. Sua vaga na agenda está reservada!` } });
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e.message);
    return json({ erro: 'falha' }, 500); // o Mercado Pago tenta de novo
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/checkout') return checkout(request, env);
    if (url.pathname === '/api/webhook-mp') return webhook(request, env, url);
    if (url.pathname.startsWith('/api/')) return json({ erro: 'Não encontrado' }, 404);
    return env.ASSETS.fetch(request);
  },
};
