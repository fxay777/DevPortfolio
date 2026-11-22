/* Área do cliente: login, pedidos, linha do tempo e perfil */
(async () => {
'use strict';
const { esc, brl, data, waLink, STATUS, ETAPAS, CONFIG } = DB;
const app = document.getElementById('app');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let tt;
const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 2400); };
const next = new URLSearchParams(location.search).get('next');

if (!DB.ativo) {
  app.innerHTML = `<div class="auth"><span class="eyebrow">Área do cliente</span><h1>Acompanhe seu projeto</h1>
    <p class="note-box" style="margin-top:20px">A área do cliente ainda está sendo ativada. Enquanto isso, acompanhe seu pedido direto comigo pelo WhatsApp.</p>
    <a class="btn wa full" style="margin-top:16px" href="${waLink('Olá Jackson! Quero saber o status do meu pedido.')}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>`;
  return;
}
const sb = await DB.client();
if (!sb) { app.innerHTML = '<p class="note-box warn">Não foi possível conectar. Verifique sua internet e recarregue a página.</p>'; return; }

let modo = 'entrar';
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'PASSWORD_RECOVERY') { modo = 'nova-senha'; telaAuth(); }
  if (ev === 'SIGNED_OUT') { modo = 'entrar'; telaAuth(); }
});

async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (location.hash.includes('type=recovery')) { modo = 'nova-senha'; return telaAuth(); }
  if (!session) return telaAuth(location.hash === '#suporte' ? 'Entre ou crie sua conta para abrir um chamado. É rapidinho!' : location.hash === '#arquivos' ? 'Entre para enviar seus arquivos.' : '');
  if (next === 'admin') { location.href = 'admin.html'; return; }
  painel(session.user);
}

function telaAuth(msg = '', tipo = '') {
  $('#hdrAct').innerHTML = '<a class="btn" href="index.html">← Voltar ao site</a>';
  const prev = DB.ls.get('jf-cliente', {}) || {};
  const tabs = modo === 'entrar' || modo === 'criar'
    ? `<div class="tabs" role="tablist"><button data-m="entrar" class="${modo === 'entrar' ? 'on' : ''}">Entrar</button><button data-m="criar" class="${modo === 'criar' ? 'on' : ''}">Criar conta</button></div>` : '';
  let form = '';
  if (modo === 'entrar') form = `<form id="af"><input class="field" name="email" type="email" placeholder="Seu e-mail" autocomplete="email" required value="${esc(prev.email || '')}">
      <input class="field" name="senha" type="password" placeholder="Senha" autocomplete="current-password" required minlength="6">
      <button class="btn primary full">Entrar <span class="arr">→</span></button>
      <button type="button" class="again" data-m="esqueci" style="background:none;border:0;color:var(--muted);text-decoration:underline;cursor:pointer">Esqueci minha senha</button></form>`;
  if (modo === 'criar') form = `<form id="af"><input class="field" name="nome" placeholder="Nome" autocomplete="name" required value="${esc(prev.nome || '')}">
      <input class="field" name="whatsapp" placeholder="WhatsApp com DDD" inputmode="tel" autocomplete="tel" value="${esc(prev.whatsapp || '')}">
      <input class="field" name="email" type="email" placeholder="E-mail (use o mesmo do pedido)" autocomplete="email" required value="${esc(prev.email || '')}">
      <input class="field" name="senha" type="password" placeholder="Crie uma senha (mín. 6 caracteres)" autocomplete="new-password" required minlength="6">
      <button class="btn primary full">Criar minha conta <span class="arr">→</span></button></form>`;
  if (modo === 'esqueci') form = `<form id="af"><p class="sm" style="color:var(--muted)">Digite seu e-mail e eu te mando um link para criar uma nova senha.</p>
      <input class="field" name="email" type="email" placeholder="Seu e-mail" autocomplete="email" required>
      <button class="btn primary full">Enviar link</button><button type="button" class="btn full" data-m="entrar">Voltar</button></form>`;
  if (modo === 'nova-senha') form = `<form id="af"><p class="sm" style="color:var(--muted)">Escolha sua nova senha.</p>
      <input class="field" name="senha" type="password" placeholder="Nova senha (mín. 6 caracteres)" autocomplete="new-password" required minlength="6">
      <button class="btn primary full">Salvar nova senha</button></form>`;
  app.innerHTML = `<div class="auth"><span class="eyebrow">Área do cliente</span><h1>${modo === 'criar' ? 'Crie sua conta' : modo === 'entrar' ? 'Acompanhe seu projeto' : 'Recuperar acesso'}</h1>
    <p style="color:var(--muted)">Veja o status dos seus pedidos, as atualizações do projeto e fale comigo quando quiser.</p>
    ${tabs}${msg ? `<p class="note-box ${tipo}" style="margin-top:16px">${msg}</p>` : ''}${form}</div>`;
  app.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { modo = b.dataset.m; telaAuth(); }; });
  $('#af').onsubmit = enviarAuth;
}

async function enviarAuth(e) {
  e.preventDefault();
  const f = e.target, b = f.querySelector('.btn.primary'); b.disabled = true;
  const v = (n) => (f[n] ? f[n].value.trim() : '');
  const url = location.origin + location.pathname;
  try {
    if (modo === 'entrar') {
      const { error } = await sb.auth.signInWithPassword({ email: v('email'), password: f.senha.value });
      if (error) throw error;
      return iniciar();
    }
    if (modo === 'criar') {
      const { data: d, error } = await sb.auth.signUp({ email: v('email'), password: f.senha.value, options: { data: { nome: v('nome'), whatsapp: v('whatsapp') }, emailRedirectTo: url } });
      if (error) throw error;
      DB.ls.set('jf-cliente', { nome: v('nome'), whatsapp: v('whatsapp'), email: v('email') });
      if (d.session) return iniciar();
      modo = 'entrar';
      return telaAuth(`Quase lá! Enviei um link de confirmação para <b>${esc(v('email'))}</b>. Abra seu e-mail, confirme e depois entre aqui.`, 'ok');
    }
    if (modo === 'esqueci') {
      const { error } = await sb.auth.resetPasswordForEmail(v('email'), { redirectTo: url });
      if (error) throw error;
      modo = 'entrar';
      return telaAuth('Se existir uma conta com esse e-mail, você vai receber o link em instantes. Confira também o spam.', 'ok');
    }
    if (modo === 'nova-senha') {
      const { error } = await sb.auth.updateUser({ password: f.senha.value });
      if (error) throw error;
      history.replaceState(null, '', location.pathname);
      toast('✓ Senha atualizada!');
      return iniciar();
    }
  } catch (err) {
    b.disabled = false;
    const m = String(err.message || err);
    const traduz = /Invalid login/i.test(m) ? 'E-mail ou senha incorretos.' : /not confirmed/i.test(m) ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).' : /already registered/i.test(m) ? 'Esse e-mail já tem conta. Use a aba Entrar.' : /Password should/i.test(m) ? 'A senha precisa ter pelo menos 6 caracteres.' : /rate limit/i.test(m) ? 'Muitas tentativas. Aguarde alguns minutos.' : 'Não deu certo: ' + esc(m);
    let el = f.querySelector('.err'); if (!el) { el = document.createElement('p'); el.className = 'err'; f.prepend(el); }
    el.textContent = traduz;
  }
}

const ABAS = [['pedidos', 'Meus pedidos'], ['suporte', 'Suporte'], ['arquivos', 'Arquivos'], ['dados', 'Meus dados']];
const TIPOS = { duvida: 'Dúvida', alteracao: 'Alteração', problema: 'Problema no site', financeiro: 'Financeiro', outro: 'Outro' };
const ST_CH = { aberto: ['Aguardando resposta', '#fbbf24'], respondido: ['Respondido', '#4ade80'], fechado: ['Resolvido', '#9a95b8'] };
let U = null, P = null, PEDIDOS = [], CHAMADOS = [], AVALS = [], aba = (location.hash.slice(1) || 'pedidos');
const dlg = document.createElement('dialog'); document.body.appendChild(dlg);
let canal = null;
dlg.addEventListener('close', () => { if (canal) { sb.removeChannel(canal); canal = null; } });
dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-x]')) dlg.close(); });
const dh = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function painel(user) {
  U = user;
  const [{ data: perfil }, { data: pedidos, error }, { data: admin }, { data: chs }, { data: avs }] = await Promise.all([
    sb.from('perfis').select('*').eq('id', user.id).maybeSingle(),
    sb.from('pedidos').select('*, atualizacoes(*)').order('criado_em', { ascending: false }),
    sb.rpc('is_admin'),
    sb.from('chamados').select('*').eq('user_id', user.id).order('atualizado_em', { ascending: false }),
    sb.from('avaliacoes').select('*').eq('user_id', user.id),
  ]);
  P = perfil || {}; PEDIDOS = pedidos || []; CHAMADOS = chs || []; AVALS = avs || [];
  const nome = P.nome || (user.user_metadata && user.user_metadata.nome) || user.email.split('@')[0];
  $('#hdrAct').innerHTML = `${admin ? '<a class="btn" href="admin.html">Painel</a>' : ''}<a class="btn" href="ajuda.html">Ajuda</a><button class="btn" id="sair">Sair</button>`;
  $('#sair').onclick = () => sb.auth.signOut();
  const resp = CHAMADOS.filter((c) => c.status === 'respondido').length;
  app.innerHTML = `<div class="hello"><div><span class="eyebrow">Área do cliente</span><h1>Olá, ${esc(nome.split(' ')[0])}!</h1>
      <p style="color:var(--muted);margin-top:6px">${resp ? `<b style="color:var(--ok)">Você tem ${resp} resposta${resp > 1 ? 's' : ''} nova${resp > 1 ? 's' : ''} no suporte.</b>` : PEDIDOS.length ? `Você tem ${PEDIDOS.length} pedido${PEDIDOS.length > 1 ? 's' : ''}.` : 'Aqui você acompanha seus projetos.'}</p></div>
      <div class="cta" style="margin:0"><a class="btn primary" href="index.html#loja">Novo pedido</a><button class="btn" data-novo-ch>Abrir chamado</button></div></div>
    <nav class="tabs cli-tabs" style="margin:0 0 26px">${ABAS.map(([k, t]) => `<button data-aba="${k}" class="${aba === k ? 'on' : ''}">${t}${k === 'suporte' && resp ? ` <span class="count" style="display:inline-grid;min-width:20px;height:20px;font-size:.72rem">${resp}</span>` : ''}</button>`).join('')}</nav>
    ${error ? `<p class="note-box warn">Não consegui carregar seus pedidos agora (${esc(error.message)}).</p>` : ''}
    <div id="view"></div>`;
  app.querySelectorAll('[data-aba]').forEach((b) => { b.onclick = () => { aba = b.dataset.aba; history.replaceState(null, '', '#' + aba); app.querySelectorAll('[data-aba]').forEach((x) => x.classList.toggle('on', x === b)); render(); }; });
  render();
}
app.addEventListener('click', (e) => {
  if (e.target.closest('[data-novo-ch]')) novoChamado(e.target.closest('[data-novo-ch]').dataset.novoCh || '');
  const ch = e.target.closest('[data-ch]'); if (ch) abrirChamado(ch.dataset.ch);
  const av = e.target.closest('[data-avaliar]'); if (av) avaliar(av.dataset.avaliar);
});

function render() {
  const v = $('#view');
  if (aba === 'pedidos') {
    v.innerHTML = `<div class="orders">${PEDIDOS.length ? PEDIDOS.map(cardPedido).join('') : `<div class="empty-st"><h3>Nenhum pedido ainda</h3><p>Os pedidos feitos com o e-mail <b>${esc(U.email)}</b> aparecem aqui automaticamente.</p>
      <div class="cta" style="justify-content:center"><a class="btn primary" href="index.html#loja">Ver pacotes</a><a class="btn" href="index.html#encomenda">Encomendar sob medida</a></div></div>`}</div>`;
  }
  if (aba === 'suporte') {
    v.innerHTML = `<div class="sup-top"><div><h3 style="font:700 1.3rem var(--display)">Seus chamados</h3><p style="color:var(--muted);font-size:.92rem">Cada pedido de ajuda fica registrado aqui, com toda a conversa.</p></div>
        <div class="cta" style="margin:0"><a class="btn" href="ajuda.html">📖 Central de ajuda</a><button class="btn primary" data-novo-ch>+ Novo chamado</button></div></div>
      ${CHAMADOS.length ? `<div class="ch-list">${CHAMADOS.map((c) => { const [r, cor] = ST_CH[c.status]; const ped = PEDIDOS.find((p) => p.id === c.pedido_id);
        return `<button class="ch-item" data-ch="${c.id}"><div><b>${esc(c.assunto)}</b><small>${TIPOS[c.tipo] || c.tipo}${ped ? ' · ' + esc(ped.numero) : ''} · atualizado ${dh(c.atualizado_em)}</small></div><span class="pill" style="color:${cor}">${r}</span></button>`; }).join('')}</div>`
      : `<div class="empty-st"><h3>Nenhum chamado</h3><p>Precisa de ajuda, quer pedir uma alteração ou tem uma dúvida? Abra um chamado e eu respondo por aqui.</p><div class="cta" style="justify-content:center"><button class="btn primary" data-novo-ch>Abrir meu primeiro chamado</button></div></div>`}`;
  }
  if (aba === 'arquivos') arquivos(v);
  if (aba === 'dados') {
    v.innerHTML = `<form id="pf" class="order-card" style="display:grid;gap:12px;max-width:560px"><h3>Meus dados</h3>
        <label class="sm">Nome<input class="field" name="nome" value="${esc(P.nome || '')}"></label>
        <label class="sm">WhatsApp<input class="field" name="whatsapp" value="${esc(P.whatsapp || '')}"></label>
        <label class="sm">E-mail da conta<input class="field" value="${esc(U.email)}" disabled></label>
        <button class="btn primary">Salvar</button></form>`;
    $('#pf').onsubmit = async (e) => {
      e.preventDefault();
      const row = { id: U.id, nome: e.target.nome.value.trim().slice(0, 120), whatsapp: e.target.whatsapp.value.trim().slice(0, 30) };
      const { error: er } = await sb.from('perfis').upsert(row);
      if (!er) Object.assign(P, row);
      toast(er ? 'Erro ao salvar: ' + er.message : '✓ Dados salvos');
    };
  }
}

/* ---------- chamados ---------- */
function novoChamado(pedidoId) {
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-top"><div><h2>Novo chamado</h2><p class="sm">Conte o que precisa. Você recebe a resposta aqui na Área do cliente.</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <form id="fch" style="display:grid;gap:12px;margin-top:18px">
      <div class="chips" id="tiposCh">${Object.entries(TIPOS).map(([k, t], i) => `<label class="opt"><input type="radio" name="tipo" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${t}</b></span></label>`).join('')}</div>
      ${PEDIDOS.length ? `<select class="field" name="pedido"><option value="">Sobre qual pedido? (opcional)</option>${PEDIDOS.map((p) => `<option value="${p.id}" ${p.id === pedidoId ? 'selected' : ''}>${esc(p.numero)} · ${esc((p.itens || []).map((i) => i.nome).join(', ') || (p.dados && p.dados.tipo) || 'Projeto')}</option>`).join('')}</select>` : ''}
      <input class="field" name="assunto" placeholder="Assunto (ex.: Trocar a foto da página inicial)" required minlength="3" maxlength="140">
      <textarea class="field" name="texto" placeholder="Descreva com detalhes. Se tiver imagens, envie na aba Arquivos e cite o nome aqui." required></textarea>
      <div class="sug-box" id="sugCh" hidden></div>
      <p class="err" id="chErr"></p>
      <button class="btn primary full">Enviar chamado</button></form></div>`;
  dlg.showModal();
  const f = $('#fch', dlg);
  // sugere artigos da ajuda enquanto digita
  let tm;
  f.assunto.oninput = () => { clearTimeout(tm); tm = setTimeout(() => {
    const K = window.AJUDA, box = $('#sugCh', dlg); if (!K) return;
    const norm = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const ts = norm(f.assunto.value).split(/[^a-z0-9]+/).filter((t) => t.length > 3);
    const achados = ts.length ? K.artigos.map((a) => [a, ts.filter((t) => norm(a.q + ' ' + a.tags).includes(t)).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    box.hidden = !achados.length;
    box.innerHTML = achados.length ? `<small>Talvez isso resolva na hora:</small>${achados.map(([a]) => `<a href="ajuda.html#${a.id}" target="_blank">📖 ${esc(a.q)}</a>`).join('')}` : '';
  }, 350); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = f.querySelector('.btn.primary'); b.disabled = true;
    const id = crypto.randomUUID ? crypto.randomUUID() : undefined;
    const row = { assunto: f.assunto.value.trim(), tipo: f.tipo.value, pedido_id: (f.pedido && f.pedido.value) || null, user_id: U.id };
    if (id) row.id = id;
    const { error } = await sb.from('chamados').insert(row);
    if (error) { b.disabled = false; $('#chErr', dlg).textContent = 'Não consegui abrir: ' + error.message; return; }
    let chId = id;
    if (!chId) { const { data: d } = await sb.from('chamados').select('id').eq('user_id', U.id).order('criado_em', { ascending: false }).limit(1); chId = d && d[0] && d[0].id; }
    await sb.from('chamado_msgs').insert({ chamado_id: chId, texto: f.texto.value.trim() });
    DB.track && DB.consent() === 'sim' && DB.track('chamado_novo', { tipo: row.tipo });
    dlg.close(); toast('✓ Chamado aberto! Eu respondo por aqui.');
    aba = 'suporte'; history.replaceState(null, '', '#suporte');
    await painel(U); abrirChamado(chId);
  };
}

async function abrirChamado(id) {
  const c = CHAMADOS.find((x) => x.id === id) || (await sb.from('chamados').select('*').eq('id', id).maybeSingle()).data;
  if (!c) return;
  const { data: msgs } = await sb.from('chamado_msgs').select('*').eq('chamado_id', id).order('criado_em');
  const [r, cor] = ST_CH[c.status];
  const bolha = (m) => `<div class="tk ${m.autor === 'admin' ? 'tk-ele' : 'tk-eu'}"><div>${esc(m.texto).replace(/\n/g, '<br>')}</div><small>${m.autor === 'admin' ? 'Jackson' : 'Você'} · ${dh(m.criado_em)}</small></div>`;
  dlg.innerHTML = `<div class="dlg-in thread"><div class="dlg-top"><div><h2 style="font-size:1.35rem">${esc(c.assunto)}</h2><p class="sm">${TIPOS[c.tipo] || c.tipo} · <span class="pill" style="color:${cor};font-size:.72rem;padding:3px 9px">${r}</span></p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <div class="tks" id="tks">${(msgs || []).map(bolha).join('')}</div>
    <form id="frep" class="rep"><textarea class="field" name="t" placeholder="${c.status === 'fechado' ? 'Escreva para reabrir o chamado…' : 'Escreva sua resposta…'}" required></textarea>
      <div class="cta" style="margin:0;justify-content:space-between"><button type="button" class="rm" id="fechar" ${c.status === 'fechado' ? 'hidden' : ''}>✓ Marcar como resolvido</button><button class="btn primary">Enviar</button></div></form></div>`;
  if (!dlg.open) dlg.showModal();
  const tks = $('#tks', dlg); tks.scrollTop = tks.scrollHeight;
  const vistos = new Set((msgs || []).map((m) => m.id));
  const add = (m) => { if (vistos.has(m.id)) return; vistos.add(m.id); tks.insertAdjacentHTML('beforeend', bolha(m)); tks.scrollTop = tks.scrollHeight; };
  // resposta chega ao vivo (Supabase Realtime)
  if (sb.channel) {
    canal = sb.channel('ch-' + id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamado_msgs', filter: `chamado_id=eq.${id}` }, (p) => add(p.new)).subscribe();
  }
  $('#frep', dlg).onsubmit = async (e) => {
    e.preventDefault();
    const t = e.target.t.value.trim(); if (!t) return;
    const b = e.target.querySelector('.btn.primary'); b.disabled = true;
    const { error } = await sb.from('chamado_msgs').insert({ chamado_id: id, texto: t });
    b.disabled = false;
    if (error) return toast('Erro: ' + error.message);
    e.target.t.value = '';
    const { data: novas } = await sb.from('chamado_msgs').select('*').eq('chamado_id', id).order('criado_em');
    (novas || []).forEach(add);
    c.status = 'aberto'; $('#fechar', dlg).hidden = false;
  };
  $('#fechar', dlg).onclick = async () => {
    await sb.from('chamados').update({ status: 'fechado' }).eq('id', id);
    c.status = 'fechado'; toast('✓ Que bom que resolveu!'); dlg.close(); painel(U);
  };
  if (c.status === 'respondido') c._visto = true;
}

/* ---------- arquivos ---------- */
const fmtTam = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
async function arquivos(v) {
  v.innerHTML = `<label class="drop" id="drop"><input type="file" id="fi" multiple hidden>
      <b>Arraste seus arquivos aqui</b><span>ou toque para escolher · logo, fotos, textos, PDFs · até 25 MB cada</span></label>
    <div id="upl"></div><div class="files" id="files"><p style="color:var(--muted)">Carregando…</p></div>`;
  const st = sb.storage.from('arquivos');
  async function lista() {
    const { data, error } = await st.list(U.id, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    const el = $('#files', v);
    if (error) { el.innerHTML = `<p class="note-box warn">Não consegui listar: ${esc(error.message)}</p>`; return; }
    const fs = (data || []).filter((f) => f.name && f.id !== null);
    el.innerHTML = fs.length ? fs.map((f) => `<div class="file"><span class="ic">${/\.(png|jpe?g|gif|webp|svg)$/i.test(f.name) ? '🖼️' : /\.pdf$/i.test(f.name) ? '📄' : '📎'}</span>
        <div><b>${esc(f.name.replace(/^\d+-/, ''))}</b><small>${f.metadata ? fmtTam(f.metadata.size || 0) + ' · ' : ''}${f.created_at ? dh(f.created_at) : ''}</small></div>
        <button class="mini" data-dl="${esc(f.name)}">Baixar</button><button class="rm" data-rm="${esc(f.name)}">apagar</button></div>`).join('')
      : '<div class="empty-st" style="padding:30px"><p>Nenhum arquivo enviado ainda.</p></div>';
  }
  async function enviar(files) {
    const box = $('#upl', v);
    for (const f of files) {
      if (f.size > 25 * 1048576) { toast(`${f.name} passa de 25 MB`); continue; }
      const nome = Date.now() + '-' + f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_').slice(-80);
      box.innerHTML = `<p class="note-box">Enviando ${esc(f.name)}…</p>`;
      const { error } = await st.upload(`${U.id}/${nome}`, f, { upsert: false, contentType: f.type || undefined });
      box.innerHTML = error ? `<p class="note-box warn">Erro em ${esc(f.name)}: ${esc(error.message)}</p>` : '';
      if (!error) toast('✓ ' + f.name + ' enviado');
    }
    lista();
  }
  const drop = $('#drop', v), fi = $('#fi', v);
  fi.onchange = () => enviar([...fi.files]);
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', (e) => enviar([...e.dataTransfer.files]));
  $('#files', v).onclick = async (e) => {
    const dl = e.target.dataset.dl, rm = e.target.dataset.rm;
    if (dl) { const { data } = await st.createSignedUrl(`${U.id}/${dl}`, 600); if (data) open(data.signedUrl, '_blank', 'noopener'); }
    if (rm && confirm('Apagar este arquivo?')) { await st.remove([`${U.id}/${rm}`]); lista(); }
  };
  lista();
}

/* ---------- avaliação ---------- */
function avaliar(pedidoId) {
  const p = PEDIDOS.find((x) => x.id === pedidoId);
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-top"><div><h2>Como foi o projeto?</h2><p class="sm">Sua opinião me ajuda a melhorar, e pode ajudar outras pessoas a decidir.</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <form id="fav" style="display:grid;gap:12px;margin-top:18px">
      <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}</div>
      <textarea class="field" name="texto" placeholder="Conte como foi trabalhar comigo e o resultado do site" maxlength="1200"></textarea>
      <input class="field" name="nome" placeholder="Como quer aparecer (ex.: Ana S., Clínica Bem Estar)" value="${esc((P.nome || '').split(' ')[0])}" maxlength="80">
      <label class="sm" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="pub" checked style="margin-top:4px"> Autorizo exibir minha avaliação (nome acima, nota e texto) no site.</label>
      <p class="err" id="avErr"></p><button class="btn primary full">Enviar avaliação</button></form></div>`;
  dlg.showModal();
  let nota = 0;
  const pinta = () => $$('#stars button', dlg).forEach((b) => b.classList.toggle('on', +b.dataset.n <= nota));
  $('#stars', dlg).onclick = (e) => { const b = e.target.closest('[data-n]'); if (b) { nota = +b.dataset.n; pinta(); } };
  $('#fav', dlg).onsubmit = async (e) => {
    e.preventDefault();
    if (!nota) { $('#avErr', dlg).textContent = 'Escolha de 1 a 5 estrelas.'; return; }
    const f = e.target;
    const { error } = await sb.from('avaliacoes').insert({ pedido_id: pedidoId, nota, texto: f.texto.value.trim() || null, nome_exibicao: f.nome.value.trim() || null, autoriza_publicar: f.pub.checked, projeto: p ? ((p.itens || []).map((i) => i.nome).join(', ') || (p.dados && p.dados.tipo) || null) : null, user_id: U.id });
    if (error) { $('#avErr', dlg).textContent = /duplicate/.test(error.message) ? 'Você já avaliou este pedido.' : 'Erro: ' + error.message; return; }
    dlg.close(); toast('✓ Obrigado pela avaliação! 💜'); painel(U);
  };
}

function cardPedido(p) {
  const [rot, cor] = STATUS[p.status] || [p.status, '#999'];
  const idx = Math.max(ETAPAS.indexOf(p.status === 'aguardando_pagamento' || p.status === 'pendente' ? 'novo' : p.status), 0);
  const estimativa = p.origem === 'encomenda' && p.status === 'novo';
  const rest = estimativa ? 0 : Math.max(0, Number(p.total) - Number(p.valor_pago));
  const itens = (p.itens || []).map((i) => `${esc(i.nome)}${i.qtd > 1 ? ' ×' + i.qtd : ''}`).join(', ') || esc((p.dados && p.dados.tipo) || 'Projeto sob medida');
  const ups = (p.atualizacoes || []).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const nomes = { novo: 'Pedido', pago: 'Pago', briefing: 'Briefing', desenvolvimento: 'Criação', revisao: 'Revisão', entregue: 'Entregue' };
  return `<article class="order-card">
    <div class="top"><div><h3>${itens}</h3><p style="color:var(--muted);font-size:.88rem">${esc(p.numero)} · ${p.origem === 'encomenda' ? 'Encomenda' : 'Pacote'} · ${data(p.criado_em)}</p></div>
      <span class="pill" style="color:${cor}">${rot}</span></div>
    ${p.status === 'cancelado' ? '' : `<div class="track">${ETAPAS.map((s, i) => `<div class="${i <= idx ? 'feito' : ''}"><i></i>${nomes[s]}</div>`).join('')}</div>`}
    <div class="kv"><div>${estimativa ? 'Estimativa' : 'Total'}<b>${p.total > 0 ? brl(p.total) : 'a definir'}</b></div><div>Pago<b>${brl(p.valor_pago)}</b></div>${p.total > 0 && !estimativa ? `<div>Restante<b>${brl(rest)}</b></div>` : ''}${p.cupom ? `<div>Cupom<b>${esc(p.cupom)}</b></div>` : ''}</div>
    ${ups.length ? `<b style="font-family:var(--display)">Atualizações do projeto</b><ul class="timeline">${ups.map((u) => `<li>${esc(u.texto)}${u.link && /^https?:\/\//i.test(u.link) ? ` <a class="link" href="${esc(u.link)}" target="_blank" rel="noopener">abrir ↗</a>` : ''}<small>${new Date(u.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></li>`).join('')}</ul>` : '<p style="color:var(--muted);font-size:.9rem">Assim que eu começar, as novidades do projeto aparecem aqui.</p>'}
    <div class="cta" style="margin-top:18px">
      ${rest > 0 && p.status !== 'cancelado' ? `<a class="btn primary" target="_blank" rel="noopener" href="${waLink(`Olá Jackson! Quero pagar o restante (${brl(rest)}) do pedido ${p.numero}.`)}">Pagar restante</a>` : ''}
      <button class="btn" data-novo-ch="${p.id}">Pedir ajuda / alteração</button>
      ${p.status === 'entregue' && !AVALS.some((a) => a.pedido_id === p.id) ? `<button class="btn" data-avaliar="${p.id}">⭐ Avaliar projeto</button>` : ''}
      ${AVALS.some((a) => a.pedido_id === p.id) ? '<span class="pill" style="color:var(--ok)">Avaliado ✓</span>' : ''}</div>
  </article>`;
}

iniciar();
})();
