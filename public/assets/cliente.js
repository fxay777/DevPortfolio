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
  app.innerHTML = `<div class="auth"><span class="eyebrow">Área do cliente</span><h1>Cadastro em configuração</h1>
    <p class="note-box warn" style="margin-top:20px">O cadastro e o login ficam disponíveis assim que o banco de dados (Supabase) estiver conectado.
    Enquanto isso, fale comigo direto pelo WhatsApp.</p>
    <a class="btn wa full" style="margin-top:16px" href="${waLink('Olá Jackson! Quero saber o status do meu pedido.')}" target="_blank" rel="noopener">Falar no WhatsApp</a></div>`;
  return;
}
const sb = await DB.client();
if (!sb) { app.innerHTML = '<p class="note-box warn">Não foi possível conectar. Verifique sua internet e recarregue a página.</p>'; return; }

let modo = 'entrar', emailPendente = DB.ls.get('jf-verificar', '') || '', emailMascara = '';
sb.auth.onAuthStateChange((ev) => {
  if (ev === 'PASSWORD_RECOVERY') { modo = 'nova-senha'; telaAuth(); }
  if (ev === 'SIGNED_OUT') { modo = 'entrar'; telaAuth(); }
});
const URL_AQUI = location.origin + location.pathname;

/* ---------- força da senha ---------- */
function forca(sen) {
  let p = 0;
  if (sen.length >= 8) p++; if (sen.length >= 12) p++;
  if (/[a-z]/.test(sen) && /[A-Z]/.test(sen)) p++;
  if (/\d/.test(sen)) p++; if (/[^A-Za-z0-9]/.test(sen)) p++;
  if (/^(.)\1+$/.test(sen) || /^(12345|senha|password|qwerty)/i.test(sen)) p = 0;
  return Math.min(p, 4);
}
const NIVEL_SENHA = [['Muito fraca', '#f87171'], ['Fraca', '#fb923c'], ['Média', '#fbbf24'], ['Boa', '#a3e635'], ['Forte', '#4ade80']];
const medidor = (nome) => `<div class="senha-med" data-med="${nome}"><i></i><i></i><i></i><i></i><span>Use 8+ caracteres, com letras maiúsculas, números e símbolos</span></div>`;
function ligaMedidor(f, nome) {
  const inp = f[nome], med = f.querySelector(`[data-med="${nome}"]`); if (!inp || !med) return;
  inp.addEventListener('input', () => {
    const v = inp.value, n = forca(v), [t, c] = NIVEL_SENHA[n];
    med.querySelectorAll('i').forEach((el, k) => { el.style.background = v && k < Math.max(1, n) ? c : ''; });
    med.querySelector('span').textContent = v ? `Senha ${t.toLowerCase()}` : 'Use 8+ caracteres, com letras maiúsculas, números e símbolos';
    med.querySelector('span').style.color = v ? c : '';
  });
}
const olho = '<button type="button" class="olho" data-olho aria-label="Mostrar senha">👁</button>';
app.addEventListener('click', (e) => {
  const o = e.target.closest('[data-olho]'); if (!o) return;
  const inp = o.previousElementSibling; inp.type = inp.type === 'password' ? 'text' : 'password';
  o.setAttribute('aria-label', inp.type === 'password' ? 'Mostrar senha' : 'Esconder senha');
});

async function precisa2FA() {
  try {
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return !error && data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  } catch { return false; }
}

async function iniciar() {
  const h = location.hash;
  const { data: { session } } = await sb.auth.getSession();
  if (h.includes('type=recovery')) { modo = 'nova-senha'; return telaAuth(); }
  if (!session) return telaAuth(h === '#suporte' ? 'Entre ou crie sua conta para abrir um chamado. É rapidinho!' : h === '#arquivos' ? 'Entre para enviar seus arquivos.' : '');
  if (/type=(signup|email|magiclink)/.test(h) || h.includes('access_token')) {
    history.replaceState(null, '', location.pathname + location.search);
    DB.ls.set('jf-verificar', '');
    toast('✓ E-mail confirmado! Bem-vindo(a).');
  }
  if (await precisa2FA()) { modo = '2fa'; return telaAuth(); }
  if (next === 'admin') { location.href = 'admin.html'; return; }
  painel(session.user);
}

function telaAuth(msg = '', tipo = '') {
  $('#hdrAct').innerHTML = '<a class="btn" href="index.html">← Voltar ao site</a>';
  const prev = DB.ls.get('jf-cliente', {}) || {};
  const tabs = modo === 'entrar' || modo === 'criar'
    ? `<div class="tabs" role="tablist"><button data-m="entrar" class="${modo === 'entrar' ? 'on' : ''}">Entrar</button><button data-m="criar" class="${modo === 'criar' ? 'on' : ''}">Criar conta</button></div>` : '';
  let form = '', titulo = 'Acompanhe seu projeto', sub = 'Veja o status dos seus pedidos, as atualizações do projeto e fale comigo quando quiser.';
  if (modo === 'entrar') form = `<form id="af"><input class="field" name="login" placeholder="E-mail ou usuário" autocomplete="username" autocapitalize="none" spellcheck="false" required value="${esc(prev.usuario ? '@' + prev.usuario : prev.email || '')}">
      <div class="campo-senha"><input class="field" name="senha" type="password" placeholder="Senha" autocomplete="current-password" required minlength="6">${olho}</div>
      <button class="btn primary full">Entrar <span class="arr">→</span></button>
      <button type="button" class="linkbtn" data-m="esqueci">Esqueci minha senha</button></form>`;
  if (modo === 'criar') { titulo = 'Crie sua conta'; sub = 'Escolha um usuário, informe seu e-mail e crie uma senha. Depois é só confirmar o e-mail.';
    form = `<form id="af"><label class="lbl-c">Usuário</label>
      <div class="campo-user"><span>@</span><input class="field" name="usuario" placeholder="seu.usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_.]{3,20}"></div>
      <small class="user-st" id="userSt">3 a 20 caracteres: letras, números, _ ou .</small>
      <label class="lbl-c">E-mail</label>
      <input class="field" name="email" type="email" placeholder="voce@email.com" autocomplete="email" required value="${esc(prev.email || '')}">
      <label class="lbl-c">Senha</label>
      <div class="campo-senha"><input class="field" name="senha" type="password" placeholder="Crie uma senha" autocomplete="new-password" required minlength="8">${olho}</div>
      ${medidor('senha')}
      <input class="field" name="senha2" type="password" placeholder="Repita a senha" autocomplete="new-password" required>
      <label class="aceite"><input type="checkbox" name="termos" required> Li e aceito a <a class="link" href="privacidade.html" target="_blank">política de privacidade</a>.</label>
      <button class="btn primary full">Criar minha conta <span class="arr">→</span></button></form>`; }
  if (modo === 'verificar') { titulo = 'Confirme seu e-mail'; sub = '';
    form = `<div class="verif"><div class="verif-ic">✉️</div>
      <p>Enviei um link de confirmação para<br><b>${esc(emailPendente || emailMascara || 'o seu e-mail')}</b></p>
      ${emailPendente ? '' : '<input class="field" id="emailReenv" type="email" placeholder="Digite seu e-mail para reenviar" autocomplete="email">'}
      <ol><li>Abra seu e-mail (veja também o <b>spam</b> e a aba <b>Promoções</b>)</li><li>Clique em <b>Confirmar e-mail</b></li><li>Você volta para cá já com a conta ativa</li></ol>
      <button class="btn primary full" id="reenv">Reenviar e-mail</button>
      <button class="btn full" data-m="entrar">Já confirmei, quero entrar</button>
      <button type="button" class="linkbtn" data-m="criar">Usar outro e-mail</button></div>`; }
  if (modo === '2fa') { titulo = 'Verificação em duas etapas'; sub = 'Abra o app autenticador do seu celular e digite o código de 6 números.';
    form = `<form id="af"><input class="field codigo" name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required autofocus>
      <button class="btn primary full">Verificar <span class="arr">→</span></button>
      <a class="linkbtn" target="_blank" rel="noopener" href="${waLink('Olá Jackson! Perdi acesso ao meu app autenticador (2FA) da Área do cliente.')}">Perdi o celular / não tenho o código</a>
      <button type="button" class="linkbtn" id="sair2fa">Sair</button></form>`; }
  if (modo === 'esqueci') { titulo = 'Recuperar acesso'; sub = '';
    form = `<form id="af"><p class="sm" style="color:var(--muted)">Digite seu e-mail e eu te mando um link para criar uma nova senha.</p>
      <input class="field" name="email" type="email" placeholder="Seu e-mail" autocomplete="email" required>
      <button class="btn primary full">Enviar link</button><button type="button" class="btn full" data-m="entrar">Voltar</button></form>`; }
  if (modo === 'nova-senha') { titulo = 'Nova senha'; sub = '';
    form = `<form id="af"><div class="campo-senha"><input class="field" name="senha" type="password" placeholder="Nova senha" autocomplete="new-password" required minlength="8">${olho}</div>
      ${medidor('senha')}<input class="field" name="senha2" type="password" placeholder="Repita a nova senha" autocomplete="new-password" required>
      <button class="btn primary full">Salvar nova senha</button></form>`; }
  app.innerHTML = `<div class="auth"><span class="eyebrow">Área do cliente</span><h1>${titulo}</h1>
    ${sub ? `<p style="color:var(--muted)">${sub}</p>` : ''}
    ${tabs}${msg ? `<p class="note-box ${tipo}" style="margin-top:16px">${msg}</p>` : ''}${form}
    ${modo === 'entrar' || modo === 'criar' ? '<p class="seguro">🔒 Conexão segura · senha criptografada · 2FA disponível</p>' : ''}</div>`;
  app.querySelectorAll('[data-m]').forEach((b) => { b.onclick = () => { modo = b.dataset.m; telaAuth(); }; });
  const f = $('#af');
  if (f) { f.onsubmit = enviarAuth; ligaMedidor(f, 'senha'); }
  if (modo === 'criar') {
    const u = f.usuario, st = $('#userSt'); let tm, seq = 0;
    u.addEventListener('input', () => {
      u.value = u.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20);
      clearTimeout(tm); u.dataset.ok = '';
      if (u.value.length < 3) { st.textContent = '3 a 20 caracteres: letras, números, _ ou .'; st.className = 'user-st'; return; }
      st.textContent = 'Verificando…'; st.className = 'user-st';
      const meu = ++seq;
      tm = setTimeout(async () => {
        const { data: livre, error } = await sb.rpc('usuario_disponivel', { u: u.value });
        if (meu !== seq) return;
        if (error) { st.textContent = 'Não consegui verificar agora.'; return; }
        u.dataset.ok = livre ? '1' : '0';
        st.textContent = livre ? `✓ @${u.value} está disponível` : `✗ @${u.value} já está em uso`;
        st.className = 'user-st ' + (livre ? 'ok' : 'no');
      }, 380);
    });
  }
  if (modo === '2fa') {
    const c = f.codigo; c.focus();
    c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 6); if (c.value.length === 6) f.requestSubmit(); });
    $('#sair2fa').onclick = () => sb.auth.signOut();
  }
  const rv = $('#reenv');
  if (rv) rv.onclick = async () => {
    const er = $('#emailReenv'); if (!emailPendente && er && /\S+@\S+\.\S+/.test(er.value)) emailPendente = er.value.trim();
    if (!emailPendente) { toast('Digite o seu e-mail para reenviar.'); if (er) er.focus(); return; }
    rv.disabled = true;
    const { error } = await sb.auth.resend({ type: 'signup', email: emailPendente, options: { emailRedirectTo: URL_AQUI } });
    if (error) { rv.disabled = false; toast(/rate|seconds/i.test(error.message) ? 'Aguarde um pouco antes de reenviar.' : 'Erro: ' + error.message); return; }
    toast('✓ E-mail reenviado!');
    let n = 60; const tm = setInterval(() => { rv.textContent = `Reenviar em ${--n}s`; if (n <= 0) { clearInterval(tm); rv.disabled = false; rv.textContent = 'Reenviar e-mail'; } }, 1000);
  };
}

async function enviarAuth(e) {
  e.preventDefault();
  const f = e.target, b = f.querySelector('.btn.primary'); b.disabled = true;
  const v = (n) => (f[n] ? f[n].value.trim() : '');
  const erro = (t) => { b.disabled = false; let el = f.querySelector('.err'); if (!el) { el = document.createElement('p'); el.className = 'err'; f.prepend(el); } el.textContent = t; };
  try {
    if (modo === 'entrar') {
      const login = v('login');
      const naoConfirmado = (email, mascara) => { emailPendente = email || ''; emailMascara = mascara || ''; if (email) DB.ls.set('jf-verificar', email); modo = 'verificar'; return telaAuth('Seu e-mail ainda não foi confirmado. Confirme pelo link que enviei ou peça um novo abaixo.', 'warn'); };
      if (login.includes('@') && !login.startsWith('@')) {
        const { error } = await sb.auth.signInWithPassword({ email: login, password: f.senha.value });
        if (error) { if (/not confirmed/i.test(error.message)) return naoConfirmado(login); throw error; }
      } else {
        // login com nome de usuário: o servidor resolve sem expor o e-mail
        const r = await fetch('/api/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: login, senha: f.senha.value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (/not confirmed/i.test(d.erro || '')) return naoConfirmado('', d.email);
          if (r.status === 503 || r.status === 404) throw new Error('Entrar com usuário ainda não está ativo. Use seu e-mail.');
          throw new Error(d.erro || 'Invalid login');
        }
        const { error } = await sb.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
        if (error) throw error;
      }
      return iniciar();
    }
    if (modo === 'criar') {
      const usuario = v('usuario').toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(usuario)) return erro('Usuário inválido: use 3 a 20 caracteres (letras, números, _ ou .).');
      if (f.usuario.dataset.ok === '0') return erro(`@${usuario} já está em uso. Escolha outro.`);
      if (!f.usuario.dataset.ok) { const { data: livre } = await sb.rpc('usuario_disponivel', { u: usuario }); if (!livre) return erro(`@${usuario} já está em uso. Escolha outro.`); }
      if (f.senha.value.length < 8 || forca(f.senha.value) < 2) return erro('Escolha uma senha mais forte: 8+ caracteres misturando letras, números ou símbolos.');
      if (f.senha.value !== f.senha2.value) return erro('As senhas não são iguais.');
      if (!f.termos.checked) return erro('Aceite a política de privacidade para continuar.');
      const { data: d, error } = await sb.auth.signUp({ email: v('email'), password: f.senha.value, options: { data: { usuario, nome: usuario }, emailRedirectTo: URL_AQUI } });
      if (error) { if (/database error|usuario_indisponivel/i.test(error.message)) return erro(`@${usuario} acabou de ser usado por outra pessoa. Escolha outro.`); throw error; }
      DB.ls.set('jf-cliente', { ...(DB.ls.get('jf-cliente', {}) || {}), usuario, email: v('email') });
      if (DB.track) DB.track('cadastro');
      if (d.session) return iniciar();
      if (d.user && Array.isArray(d.user.identities) && d.user.identities.length === 0) { modo = 'entrar'; return telaAuth('Esse e-mail já tem conta. Entre com sua senha ou use "Esqueci minha senha".', 'warn'); }
      emailPendente = v('email'); emailMascara = ''; DB.ls.set('jf-verificar', emailPendente);
      modo = 'verificar'; return telaAuth();
    }
    if (modo === '2fa') {
      const { data: fs, error: e0 } = await sb.auth.mfa.listFactors(); if (e0) throw e0;
      const fac = ((fs && fs.totp) || []).find((x) => x.status === 'verified') || ((fs && fs.totp) || [])[0];
      if (!fac) return iniciar();
      const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: fac.id }); if (e1) throw e1;
      const { error: e2 } = await sb.auth.mfa.verify({ factorId: fac.id, challengeId: ch.id, code: v('codigo') }); if (e2) throw e2;
      toast('✓ Verificado!');
      return iniciar();
    }
    if (modo === 'esqueci') {
      const { error } = await sb.auth.resetPasswordForEmail(v('email'), { redirectTo: URL_AQUI });
      if (error) throw error;
      modo = 'entrar';
      return telaAuth('Se existir uma conta com esse e-mail, você vai receber o link em instantes. Confira também o spam.', 'ok');
    }
    if (modo === 'nova-senha') {
      if (f.senha.value.length < 8 || forca(f.senha.value) < 2) return erro('Escolha uma senha mais forte.');
      if (f.senha.value !== f.senha2.value) return erro('As senhas não são iguais.');
      const { error } = await sb.auth.updateUser({ password: f.senha.value });
      if (error) throw error;
      history.replaceState(null, '', location.pathname);
      toast('✓ Senha atualizada!');
      return iniciar();
    }
  } catch (err) {
    const m = String(err.message || err);
    erro(/Invalid login/i.test(m) ? 'Usuário/e-mail ou senha incorretos.'
      : /invalid.*(code|totp)|code.*(invalid|expired)/i.test(m) ? 'Código incorreto ou expirado. Confira o app e tente de novo.'
      : /already registered|already been registered/i.test(m) ? 'Esse e-mail já tem conta. Use a aba Entrar.'
      : /Password should|weak/i.test(m) ? 'Senha fraca demais. Use 8+ caracteres com letras, números e símbolos.'
      : /rate limit|too many/i.test(m) ? 'Muitas tentativas. Aguarde alguns minutos.'
      : /same.*password|different from the old/i.test(m) ? 'A nova senha precisa ser diferente da atual.'
      : 'Não deu certo: ' + m);
    if (modo === '2fa') { f.codigo.value = ''; f.codigo.focus(); }
  }
}

const ABAS = [['pedidos', 'Meus pedidos'], ['suporte', 'Suporte'], ['arquivos', 'Arquivos'], ['seguranca', 'Segurança'], ['dados', 'Meus dados']];
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
  const usuario = P.usuario || (user.user_metadata && user.user_metadata.usuario) || '';
  const nome = P.nome && P.nome !== usuario ? P.nome : usuario ? '@' + usuario : user.email.split('@')[0];
  $('#hdrAct').innerHTML = `${admin ? '<a class="btn" href="admin.html">Painel</a>' : ''}<a class="btn" href="ajuda.html">Ajuda</a><button class="btn" id="sair">Sair</button>`;
  $('#sair').onclick = () => sb.auth.signOut();
  const resp = CHAMADOS.filter((c) => c.status === 'respondido').length;
  app.innerHTML = `<div class="hello"><div><span class="eyebrow">Área do cliente</span><h1>Olá, ${esc(nome.startsWith('@') ? nome : nome.split(' ')[0])}!</h1>
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
  if (!ABAS.some(([k]) => k === aba)) aba = 'pedidos';
  if (aba === 'seguranca') return seguranca(v);
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
        <label class="sm">Usuário<input class="field" value="@${esc(P.usuario || '')}" disabled title="O usuário não pode ser trocado"></label>
        <label class="sm">Nome<input class="field" name="nome" value="${esc(P.nome && P.nome !== P.usuario ? P.nome : '')}" placeholder="Seu nome (opcional)"></label>
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

/* ---------- segurança: e-mail, 2FA, senha, sessões ---------- */
async function seguranca(v) {
  v.innerHTML = '<p style="color:var(--muted)">Carregando…</p>';
  const [{ data: ud }, { data: fs }] = await Promise.all([sb.auth.getUser(), sb.auth.mfa.listFactors()]);
  const user = (ud && ud.user) || U;
  const ativos = ((fs && fs.totp) || []).filter((f) => f.status === 'verified');
  const verificado = !!(user.email_confirmed_at || user.confirmed_at);
  v.innerHTML = `<div class="seg-grid">
    <div class="order-card seg"><div class="seg-h"><span class="seg-ic">✉️</span><div><h3>E-mail</h3><p>${esc(user.email)}</p></div>
      <span class="pill" style="color:${verificado ? 'var(--ok)' : '#fbbf24'}">${verificado ? 'Verificado' : 'Não verificado'}</span></div>
      ${verificado ? '<p class="sm">Seu e-mail foi confirmado. É por ele que você recupera o acesso.</p>' : '<button class="btn" id="reenvSeg">Reenviar e-mail de verificação</button>'}</div>
    <div class="order-card seg" id="segMfa"><div class="seg-h"><span class="seg-ic">🔐</span><div><h3>Verificação em duas etapas (2FA)</h3><p>Além da senha, o login pede um código do app autenticador do seu celular.</p></div>
      <span class="pill" style="color:${ativos.length ? 'var(--ok)' : 'var(--muted)'}">${ativos.length ? 'Ativada' : 'Desativada'}</span></div>
      <div id="mfaBox">${ativos.length
        ? `<p class="sm">📱 ${esc(ativos[0].friendly_name || 'App autenticador')} · ativada em ${data(ativos[0].created_at)}</p><button class="rm" id="mfaOff" style="color:#f87171">Desativar 2FA</button>`
        : '<button class="btn primary" id="mfaOn">Ativar 2FA</button><p class="sm" style="margin-top:10px">Funciona com Google Authenticator, Microsoft Authenticator, Authy ou 1Password.</p>'}</div></div>
    <form class="order-card seg" id="fsenha"><div class="seg-h"><span class="seg-ic">🔑</span><div><h3>Trocar senha</h3><p>Escolha uma senha que você não usa em outros sites.</p></div></div>
      <div class="campo-senha"><input class="field" name="senha" type="password" placeholder="Nova senha" autocomplete="new-password" required minlength="8">${olho}</div>
      ${medidor('senha')}<input class="field" name="senha2" type="password" placeholder="Repita a nova senha" autocomplete="new-password" required>
      <p class="err"></p><button class="btn">Salvar nova senha</button></form>
    <div class="order-card seg"><div class="seg-h"><span class="seg-ic">💻</span><div><h3>Aparelhos conectados</h3><p>Último acesso: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</p></div></div>
      <p class="sm">Esqueceu a conta aberta em outro computador? Saia de todos de uma vez.</p><button class="btn" id="sairTodos">Sair de todos os aparelhos</button></div>
  </div>`;
  const rs = $('#reenvSeg', v);
  if (rs) rs.onclick = async () => { const { error } = await sb.auth.resend({ type: 'signup', email: user.email, options: { emailRedirectTo: URL_AQUI } }); toast(error ? 'Aguarde um pouco antes de reenviar.' : '✓ E-mail reenviado!'); };
  const fsn = $('#fsenha', v); ligaMedidor(fsn, 'senha');
  fsn.onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, er = f.querySelector('.err');
    if (f.senha.value.length < 8 || forca(f.senha.value) < 2) { er.textContent = 'Escolha uma senha mais forte.'; return; }
    if (f.senha.value !== f.senha2.value) { er.textContent = 'As senhas não são iguais.'; return; }
    const { error } = await sb.auth.updateUser({ password: f.senha.value });
    if (error) { er.textContent = /reauth|recent/i.test(error.message) ? 'Por segurança, saia e entre de novo antes de trocar a senha.' : /different|same/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : error.message; return; }
    f.reset(); er.textContent = ''; toast('✓ Senha alterada!');
  };
  $('#sairTodos', v).onclick = async () => { if (!confirm('Sair da sua conta em todos os aparelhos, inclusive neste?')) return; await sb.auth.signOut({ scope: 'global' }); };
  const off = $('#mfaOff', v);
  if (off) off.onclick = async () => {
    if (!confirm('Desativar a verificação em duas etapas? Sua conta fica protegida só pela senha.')) return;
    const { error } = await sb.auth.mfa.unenroll({ factorId: ativos[0].id });
    if (error) { toast(/aal2|assurance/i.test(error.message) ? 'Para desativar, saia e entre de novo usando o código do app.' : 'Erro: ' + error.message); return; }
    await sb.auth.refreshSession(); toast('2FA desativada'); seguranca(v);
  };
  const on = $('#mfaOn', v);
  if (on) on.onclick = async () => {
    on.disabled = true;
    // limpa tentativas antigas que não foram concluídas
    for (const f of ((fs && fs.all) || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data: en, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Celular ' + new Date().toLocaleDateString('pt-BR') });
    if (error) { on.disabled = false; toast('Erro: ' + error.message); return; }
    const qr = (en.totp && en.totp.qr_code) || '';
    const src = qr.startsWith('data:') ? qr : 'data:image/svg+xml;utf-8,' + encodeURIComponent(qr);
    const segredo = (en.totp && en.totp.secret) || '';
    $('#mfaBox', v).innerHTML = `<div class="mfa-setup">
      <ol class="passos"><li><b>Instale um app autenticador</b> no celular (Google Authenticator, Microsoft Authenticator ou Authy).</li>
        <li><b>Escaneie o QR code</b> com o app${segredo ? ' ou digite a chave manualmente' : ''}.</li><li><b>Digite o código de 6 números</b> que aparece no app.</li></ol>
      <div class="qr"><img src="${src}" alt="QR code para o app autenticador" width="180" height="180"></div>
      ${segredo ? `<div class="chave"><code>${esc(segredo)}</code><button type="button" class="mini" id="copChave">Copiar</button></div>` : ''}
      <form id="fmfa" class="mfa-form"><input class="field codigo" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
        <button class="btn primary">Confirmar e ativar</button></form><p class="err" id="mfaErr"></p>
      <button type="button" class="linkbtn" id="mfaCancel">Cancelar</button></div>`;
    const cp = $('#copChave', v); if (cp) cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(segredo); cp.textContent = 'Copiado!'; };
    $('#mfaCancel', v).onclick = async () => { await sb.auth.mfa.unenroll({ factorId: en.id }); seguranca(v); };
    const fm = $('#fmfa', v), c = fm.codigo;
    c.addEventListener('input', () => { c.value = c.value.replace(/\D/g, '').slice(0, 6); });
    fm.onsubmit = async (e) => {
      e.preventDefault();
      const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: en.id });
      const { error: e2 } = e1 ? { error: e1 } : await sb.auth.mfa.verify({ factorId: en.id, challengeId: ch.id, code: c.value });
      if (e2) { $('#mfaErr', v).textContent = 'Código incorreto. Confira se o horário do celular está automático e tente o código novo.'; c.value = ''; c.focus(); return; }
      if (DB.track) DB.track('2fa_ativado');
      toast('🔐 2FA ativada! Sua conta está mais protegida.');
      seguranca(v);
    };
    c.focus();
  };
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
