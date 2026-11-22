/* Painel administrativo: métricas, pedidos, leads, blog e clientes */
(async () => {
'use strict';
const { esc, brl, data, waLink, md, STATUS } = DB;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app'), dlg = $('#dlg');
let tt;
const toast = (t) => { const e = $('#toast'); e.textContent = t; e.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('show'), 2400); };
const fone = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? (d.startsWith('55') ? d : '55' + d) : ''; };
const dh = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-x]')) dlg.close(); });

if (!DB.ativo) {
  app.innerHTML = `<div class="auth"><h1>Painel</h1><p class="note-box warn" style="margin-top:18px">O banco de dados ainda não está configurado. Siga o passo a passo do <b>LEIA-ME.txt</b> (parte "Supabase") e preencha <code>supabaseUrl</code> e <code>supabaseKey</code> em <code>assets/catalogo.js</code>.</p></div>`;
  return;
}
const sb = await DB.client();
const { data: { session } } = await sb.auth.getSession();
if (!session) { location.href = 'cliente.html?next=admin'; return; }
const { data: ehAdmin } = await sb.rpc('is_admin');
$('#hdrAct').innerHTML = `<a class="btn" href="index.html" target="_blank">Ver site ↗</a><button class="btn" id="sair">Sair</button>`;
$('#sair').onclick = async () => { await sb.auth.signOut(); location.href = 'cliente.html'; };
if (!ehAdmin) {
  app.innerHTML = `<div class="auth"><h1>Sem permissão</h1><p class="note-box warn" style="margin-top:18px">Você entrou como <b>${esc(session.user.email)}</b>, mas essa conta ainda não é administradora. No Supabase, abra o <b>SQL Editor</b> e rode:</p>
    <pre class="note-box" style="margin-top:12px;white-space:pre-wrap;font-size:.82rem">insert into public.admins (user_id) select id from auth.users where email = '${esc(session.user.email)}';</pre>
    <p style="color:var(--muted);margin-top:12px">Depois recarregue esta página.</p></div>`;
  return;
}

// busca tudo, passando do limite de 1000 linhas por consulta
async function tudo(build, max = 20000) {
  const out = [];
  for (let de = 0; de < max; de += 1000) {
    const { data: d, error } = await build().range(de, de + 999);
    if (error) throw error;
    out.push(...d);
    if (d.length < 1000) break;
  }
  return out;
}

const st = { aba: 'geral', dias: 30, filtro: '', busca: '' };
async function shell() {
  const semana = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ count: novos }, { count: leads7 }, { count: abertos }, { count: avPend }] = await Promise.all([
    sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('status', 'novo'),
    sb.from('leads').select('id', { count: 'exact', head: true }).gte('criado_em', semana),
    sb.from('chamados').select('id', { count: 'exact', head: true }).eq('status', 'aberto'),
    sb.from('avaliacoes').select('id', { count: 'exact', head: true }).eq('aprovado', false),
  ]);
  const abas = [['geral', 'Visão geral'], ['pedidos', 'Pedidos', novos], ['suporte', 'Suporte', abertos], ['leads', 'Leads', leads7], ['avaliacoes', 'Avaliações', avPend], ['blog', 'Blog'], ['clientes', 'Clientes']];
  app.innerHTML = `<div class="hello" style="margin-bottom:18px"><div><span class="eyebrow">Painel</span><h1>Olá, Jackson!</h1></div></div>
    <nav class="adm-tabs">${abas.map(([k, t, n]) => `<button data-aba="${k}" class="${st.aba === k ? 'on' : ''}">${t}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</nav>
    <div id="view"><p style="color:var(--muted)">Carregando…</p></div>`;
  $$('[data-aba]').forEach((b) => { b.onclick = () => { st.aba = b.dataset.aba; shell(); }; });
  try { await ({ geral, pedidos, suporte, leads, avaliacoes, blog, clientes })[st.aba]($('#view')); }
  catch (e) { $('#view').innerHTML = `<p class="note-box warn">Erro: ${esc(e.message || e)}</p>`; }
}

/* ================= VISÃO GERAL ================= */
async function geral(v) {
  const desde = new Date(Date.now() - st.dias * 864e5); desde.setHours(0, 0, 0, 0);
  const iso = desde.toISOString();
  const [ev, peds, lds] = await Promise.all([
    tudo(() => sb.from('eventos').select('tipo,sessao,dados,criado_em').gte('criado_em', iso).order('criado_em')),
    tudo(() => sb.from('pedidos').select('origem,total,valor_pago,status,criado_em').gte('criado_em', iso)),
    tudo(() => sb.from('leads').select('origem,criado_em').gte('criado_em', iso)),
  ]);
  const sess = (tipo, f) => new Set(ev.filter((e) => e.tipo === tipo && (!f || f(e))).map((e) => e.sessao));
  const visit = sess('visita'), nVis = visit.size || 0;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';
  const receita = peds.reduce((a, p) => a + Number(p.valor_pago || 0), 0);
  const ficou90 = sess('tempo', (e) => e.dados && e.dados.s >= 90).size;
  const voltaram = sess('visita', (e) => e.dados && e.dados.volta).size;

  // visitantes por dia
  const dias = [];
  for (let d = new Date(desde); d <= new Date(); d.setDate(d.getDate() + 1)) dias.push(d.toISOString().slice(0, 10));
  const porDia = Object.fromEntries(dias.map((d) => [d, new Set()]));
  ev.forEach((e) => { if (e.tipo === 'visita') { const k = e.criado_em.slice(0, 10); porDia[k] && porDia[k].add(e.sessao); } });
  const serie = dias.map((d) => [d, porDia[d].size]);
  const maxD = Math.max(1, ...serie.map((s) => s[1]));
  const cada = Math.ceil(serie.length / 10);

  const conta = (arr) => Object.entries(arr.reduce((a, k) => { a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const rows = (lst, tot, fmt = (x) => x) => lst.length ? `<div class="rows">${lst.slice(0, 8).map(([k, n]) => `<div class="rowb"><span>${esc(fmt(k))}</span><span class="t"><i style="width:${Math.max(3, (n / (tot || lst[0][1])) * 100)}%"></i></span><span>${n}</span></div>`).join('')}</div>` : '<p style="color:var(--muted);font-size:.9rem">Sem dados ainda.</p>';
  const nomesSec = { sobre: 'Sobre', projetos: 'Projetos', criar: 'Monte seu site', loja: 'Pacotes', quiz: 'Quiz', encomenda: 'Encomenda', processo: 'Processo', faq: 'Dúvidas', blog: 'Blog', contato: 'Contato' };
  const secoes = conta(ev.filter((e) => e.tipo === 'secao').map((e) => e.dados.id));
  const origens = conta(ev.filter((e) => e.tipo === 'visita').map((e) => (e.dados && (e.dados.utm || e.dados.ref)) || 'Direto / WhatsApp'));
  const quiz = conta(ev.filter((e) => e.tipo === 'quiz_fim').map((e) => e.dados.pacote));
  const posts = conta(ev.filter((e) => e.tipo === 'post').map((e) => e.dados.slug));
  const addC = conta(ev.filter((e) => e.tipo === 'add_carrinho').map((e) => e.dados.id));
  const nomeServ = (id) => (DB.CONFIG && window.CATALOGO.SERVICOS.find((s) => s.id === id) || { nome: id }).nome;

  const funil = [
    ['Visitantes', nVis], ['Viram os pacotes', sess('secao', (e) => e.dados.id === 'loja').size],
    ['Adicionaram ao carrinho', sess('add_carrinho').size], ['Abriram o checkout', sess('checkout_inicio').size],
    ['Pedidos (loja)', peds.filter((p) => p.origem === 'loja').length], ['Pagos', peds.filter((p) => Number(p.valor_pago) > 0).length],
  ];
  const popup = sess('saida_popup').size, popupOk = sess('saida_converteu').size;

  v.innerHTML = `<div class="bar-f"><span style="color:var(--muted)">Período:</span>${[7, 30, 90].map((d) => `<button class="mini ${st.dias === d ? 'added' : ''}" data-d="${d}">${d} dias</button>`).join('')}</div>
  <div class="kpis">
    <div class="kpi"><small>Visitantes</small><b>${nVis}</b><em>${voltaram} voltaram</em></div>
    <div class="kpi"><small>Ficaram +90 segundos</small><b>${pct(ficou90, nVis)}</b><em>${ficou90} pessoas</em></div>
    <div class="kpi"><small>Leads</small><b>${lds.length}</b><em>contatos capturados</em></div>
    <div class="kpi"><small>Pedidos e encomendas</small><b>${peds.length}</b><em>conversão ${pct(peds.length, nVis)}</em></div>
    <div class="kpi"><small>Recebido</small><b>${brl(receita)}</b><em>via Mercado Pago/registrado</em></div>
  </div>
  <div class="box" style="margin-bottom:16px"><h3>Visitantes por dia</h3>
    <div class="bars">${serie.map(([d, n], i) => `<div><i style="height:${(n / maxD) * 100}%" data-v="${n} · ${d.slice(8, 10)}/${d.slice(5, 7)}"></i><small>${i % cada === 0 ? d.slice(8, 10) + '/' + d.slice(5, 7) : '&nbsp;'}</small></div>`).join('')}</div></div>
  <div class="grid2">
    <div class="box funnel"><h3>Funil de vendas</h3>${rows(funil.map(([k, n]) => [k, n]), nVis || 1)}</div>
    <div class="box"><h3>Seções mais vistas</h3>${rows(secoes, nVis, (k) => nomesSec[k] || k)}</div>
    <div class="box"><h3>De onde vieram</h3>${rows(origens, nVis)}</div>
    <div class="box"><h3>Mais adicionados ao carrinho</h3>${rows(addC, 0, nomeServ)}</div>
    <div class="box"><h3>Resultado do quiz</h3>${rows(quiz, 0, nomeServ)}<p style="color:var(--muted);font-size:.82rem;margin-top:10px">${sess('quiz_inicio').size} começaram · ${sess('quiz_fim').size} terminaram</p></div>
    <div class="box"><h3>Engajamento</h3><div class="rows" style="font-size:.9rem">
      <div class="rowb"><span>Abriram o chat</span><span></span><span>${sess('chat_aberto').size}</span></div>
      <div class="rowb"><span>Popup de saída</span><span></span><span>${popup} vistos · ${popupOk} converteram (${pct(popupOk, popup)})</span></div>
      <div class="rowb"><span>Usaram cupom</span><span></span><span>${sess('cupom').size}</span></div>
      <div class="rowb"><span>Lembrete de carrinho</span><span></span><span>${sess('lembrete_carrinho').size}</span></div>
      <div class="rowb"><span>Leram posts do blog</span><span></span><span>${sess('post').size}</span></div>
      <div class="rowb"><span>Acertaram formas 3D</span><span></span><span>${sess('forma_atingida').size}</span></div>
      <div class="rowb"><span>Ganharam conquistas</span><span></span><span>${sess('conquista').size} · ${sess('jogo_completo').size} completaram tudo</span></div>
      <div class="rowb"><span>Montaram prévia do site</span><span></span><span>${sess('criador_preview').size} · ${sess('criador_quero').size} clicaram "Quero"</span></div></div></div>
    <div class="box"><h3>Posts mais lidos</h3>${rows(posts, 0)}</div>
    <div class="box"><h3>Leads por origem</h3>${rows(conta(lds.map((l) => l.origem)), 0, (k) => ({ saida: 'Popup de saída', quiz: 'Quiz' }[k] || k))}</div>
  </div>
  <p style="color:var(--muted);font-size:.82rem;margin-top:18px">Métricas contam apenas visitantes que aceitaram o aviso de privacidade. Pedidos, encomendas e leads contam todos.</p>`;
  $$('[data-d]', v).forEach((b) => { b.onclick = () => { st.dias = +b.dataset.d; geral(v); }; });
}

/* ================= PEDIDOS ================= */
async function pedidos(v) {
  const lista = await tudo(() => sb.from('pedidos').select('*, atualizacoes(*)').order('criado_em', { ascending: false }));
  const render = () => {
    const b = st.busca.toLowerCase();
    const fil = lista.filter((p) => (!st.filtro || p.status === st.filtro) && (!b || [p.numero, p.nome, p.email, p.whatsapp].join(' ').toLowerCase().includes(b)));
    const tot = fil.reduce((a, p) => a + Number(p.total || 0), 0), pago = fil.reduce((a, p) => a + Number(p.valor_pago || 0), 0);
    $('#tb', v).innerHTML = fil.length ? fil.map((p) => {
      const [rot, cor] = STATUS[p.status] || [p.status, '#999'];
      const itens = (p.itens || []).map((i) => i.nome).join(', ') || (p.dados && p.dados.tipo) || '—';
      return `<tr class="click" data-id="${p.id}"><td>${dh(p.criado_em)}</td><td><b>${esc(p.numero)}</b><br><small style="color:var(--muted)">${p.origem === 'encomenda' ? 'Encomenda' : 'Loja'}</small></td>
        <td>${esc(p.nome || '')}<br><small style="color:var(--muted)">${esc(p.email || p.whatsapp || '')}</small></td><td>${esc(itens)}</td>
        <td>${Number(p.total) ? brl(p.total) : '—'}</td><td>${brl(p.valor_pago)}</td><td><span class="pill" style="color:${cor}">${rot}</span></td></tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">Nenhum pedido encontrado.</td></tr>';
    $('#sum', v).textContent = `${fil.length} pedidos · total ${brl(tot)} · recebido ${brl(pago)}`;
  };
  v.innerHTML = `<div class="bar-f"><select class="field" id="fs"><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}" ${st.filtro === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <input class="field" id="fb" placeholder="Buscar nome, e-mail, número…" value="${esc(st.busca)}" style="flex:1;min-width:200px"><span id="sum" style="color:var(--muted);font-size:.88rem"></span></div>
    <div class="tbl"><table><thead><tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Itens / tipo</th><th>Total</th><th>Pago</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  $('#fs', v).onchange = (e) => { st.filtro = e.target.value; render(); };
  $('#fb', v).oninput = (e) => { st.busca = e.target.value; render(); };
  $('#tb', v).onclick = (e) => { const tr = e.target.closest('[data-id]'); if (tr) abrirPedido(lista.find((p) => p.id === tr.dataset.id), () => pedidos(v)); };
  render();
}

function abrirPedido(p, recarregar) {
  const d = p.dados || {}, statusAntes = p.status;
  const campos = [['Empresa / projeto', d.empresa || d.projeto], ['Tipo', d.tipo], ['Recursos', d.recursos], ['Páginas', d.paginas], ['Prazo', d.prazo], ['Investimento', d.orcamento], ['Estimativa', d.estimativa], ['Plano', p.plano], ['Cupom', p.cupom], ['Observações', d.obs]].filter(([, x]) => x);
  const ups = (p.atualizacoes || []).sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const wa = fone(p.whatsapp);
  dlg.style.width = 'min(920px,96%)';
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-top"><div><h2>${esc(p.numero)}</h2><p class="sm">${p.origem === 'encomenda' ? 'Encomenda sob medida' : 'Pedido da loja'} · ${dh(p.criado_em)}</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <div class="det" style="margin-top:18px">
      <div class="box"><h3>Cliente</h3><p><b>${esc(p.nome || '—')}</b></p><p>${esc(p.email || '')}</p><p>${esc(p.whatsapp || '')}</p>
        ${(p.itens || []).length ? `<h3 style="margin-top:16px">Itens</h3>${p.itens.map((i) => `<p>${esc(i.nome)}${i.qtd > 1 ? ' ×' + i.qtd : ''} — ${brl(i.preco * i.qtd)}</p>`).join('')}` : ''}
        ${campos.length ? `<h3 style="margin-top:16px">Detalhes</h3>${campos.map(([k, x]) => `<p><span style="color:var(--muted)">${k}:</span> ${esc(x)}</p>`).join('')}` : ''}
        ${d.descricao ? `<h3 style="margin-top:16px">Descrição</h3><p style="white-space:pre-wrap">${esc(d.descricao)}</p>` : ''}
        <div class="cta" style="margin-top:16px">${wa ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(`Olá ${(p.nome || '').split(' ')[0]}! Aqui é o Jackson, sobre o seu pedido ${p.numero}.`, wa)}">WhatsApp</a>` : ''}${p.email ? `<a class="btn" href="mailto:${esc(p.email)}?subject=${encodeURIComponent('Seu pedido ' + p.numero)}">E-mail</a>` : ''}</div></div>
      <div style="display:grid;gap:16px;align-content:start">
        <form class="box" id="fst" style="display:grid;gap:10px"><h3>Status e valores</h3>
          <select class="field" name="status">${Object.entries(STATUS).map(([k, [t]]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <div class="two"><label class="sm">Total (R$)<input class="field" name="total" type="number" step="0.01" min="0" value="${Number(p.total)}"></label>
          <label class="sm">Pago (R$)<input class="field" name="valor_pago" type="number" step="0.01" min="0" value="${Number(p.valor_pago)}"></label></div>
          <label class="sm" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="avisar" checked> Publicar a mudança de status na área do cliente</label>
          <button class="btn primary">Salvar</button></form>
        <form class="box" id="fup" style="display:grid;gap:10px"><h3>Nova atualização para o cliente</h3>
          <textarea class="field" name="texto" placeholder="Ex.: Primeira versão da página inicial pronta para você ver!" required style="min-height:90px"></textarea>
          <input class="field" name="link" type="url" placeholder="Link opcional (prévia, arquivo…) https://">
          <button class="btn">Publicar atualização</button></form>
        ${ups.length ? `<div class="box"><h3>Histórico</h3><ul class="timeline">${ups.map((u) => `<li>${esc(u.texto)}<small>${dh(u.criado_em)} <button class="rm" data-del-up="${u.id}">apagar</button></small></li>`).join('')}</ul></div>` : ''}
        <button class="rm" id="delp" style="justify-self:start;color:#f87171">Excluir pedido</button>
      </div></div></div>`;
  if (!dlg.open) dlg.showModal();
  $('#fst', dlg).onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, novo = f.status.value;
    const { error } = await sb.from('pedidos').update({ status: novo, total: Number(f.total.value) || 0, valor_pago: Number(f.valor_pago.value) || 0 }).eq('id', p.id);
    if (error) return toast('Erro: ' + error.message);
    if (f.avisar.checked && novo !== statusAntes) {
      const msgs = { pago: 'Pagamento confirmado. Sua vaga está reservada!', briefing: 'Vamos começar! Estamos na fase de briefing: alinhando conteúdo, referências e objetivos.', desenvolvimento: 'Seu projeto entrou em desenvolvimento. 🚀', revisao: 'Uma versão está pronta para você revisar e pedir ajustes.', entregue: 'Projeto entregue! Obrigado pela confiança. 🎉', cancelado: 'Pedido cancelado.' };
      await sb.from('atualizacoes').insert({ pedido_id: p.id, texto: msgs[novo] || `Status atualizado: ${STATUS[novo][0]}` });
    }
    toast('✓ Pedido atualizado'); dlg.close(); recarregar();
  };
  $('#fup', dlg).onsubmit = async (e) => {
    e.preventDefault();
    const link = e.target.link.value.trim();
    const { error } = await sb.from('atualizacoes').insert({ pedido_id: p.id, texto: e.target.texto.value.trim(), link: /^https?:\/\//i.test(link) ? link : null });
    if (error) return toast('Erro: ' + error.message);
    toast('✓ Atualização publicada'); dlg.close(); recarregar();
  };
  $$('[data-del-up]', dlg).forEach((b) => { b.onclick = async () => { await sb.from('atualizacoes').delete().eq('id', b.dataset.delUp); b.closest('li').remove(); }; });
  $('#delp', dlg).onclick = async () => {
    if (!confirm(`Excluir o pedido ${p.numero} e todas as atualizações? Isso não pode ser desfeito.`)) return;
    const { error } = await sb.from('pedidos').delete().eq('id', p.id);
    if (error) return toast('Erro: ' + error.message);
    toast('Pedido excluído'); dlg.close(); recarregar();
  };
}

/* ================= SUPORTE ================= */
const TIPOS = { duvida: 'Dúvida', alteracao: 'Alteração', problema: 'Problema', financeiro: 'Financeiro', outro: 'Outro' };
const ST_CH = { aberto: ['Aguardando você', '#fbbf24'], respondido: ['Respondido', '#4ade80'], fechado: ['Resolvido', '#9a95b8'] };
let canal = null;
dlg.addEventListener('close', () => { if (canal) { sb.removeChannel(canal); canal = null; } dlg.style.width = ''; });
async function suporte(v) {
  const [chs, perfis, peds] = await Promise.all([
    tudo(() => sb.from('chamados').select('*').order('atualizado_em', { ascending: false })),
    tudo(() => sb.from('perfis').select('id,nome,email,whatsapp')),
    tudo(() => sb.from('pedidos').select('id,numero')),
  ]);
  const quem = (id) => perfis.find((p) => p.id === id) || {};
  st.fch = st.fch || 'aberto';
  const render = () => {
    const fil = chs.filter((c) => st.fch === 'todos' || c.status === st.fch);
    $('#chs', v).innerHTML = fil.length ? fil.map((c) => { const [r, cor] = ST_CH[c.status]; const q = quem(c.user_id); const pd = peds.find((p) => p.id === c.pedido_id);
      return `<tr class="click" data-c="${c.id}"><td>${dh(c.atualizado_em)}</td><td><b>${esc(c.assunto)}</b><br><small style="color:var(--muted)">${TIPOS[c.tipo] || c.tipo}${pd ? ' · ' + esc(pd.numero) : ''}</small></td><td>${esc(q.nome || '—')}<br><small style="color:var(--muted)">${esc(q.email || '')}</small></td><td><span class="pill" style="color:${cor}">${r}</span></td></tr>`; }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:40px">Nenhum chamado aqui. 🎉</td></tr>';
  };
  v.innerHTML = `<div class="bar-f">${[['aberto', 'Aguardando você'], ['respondido', 'Respondidos'], ['fechado', 'Resolvidos'], ['todos', 'Todos']].map(([k, t]) => `<button class="mini ${st.fch === k ? 'added' : ''}" data-f="${k}">${t} (${k === 'todos' ? chs.length : chs.filter((c) => c.status === k).length})</button>`).join('')}</div>
    <div class="tbl"><table><thead><tr><th>Atualizado</th><th>Assunto</th><th>Cliente</th><th>Status</th></tr></thead><tbody id="chs"></tbody></table></div>`;
  $$('[data-f]', v).forEach((b) => { b.onclick = () => { st.fch = b.dataset.f; suporte(v); }; });
  $('#chs', v).onclick = (e) => { const tr = e.target.closest('[data-c]'); if (tr) abrirChamado(chs.find((c) => c.id === tr.dataset.c), quem, peds, () => suporte(v)); };
  render();
}
const RESPOSTAS = ['Oi! Recebi seu chamado e já estou verificando. Te retorno em breve.', 'Pronto, alteração feita! Pode conferir e me diga se ficou do jeito que você queria.', 'Pode me enviar esse arquivo pela aba Arquivos da Área do cliente?', 'Consegue me mandar um print da tela onde aparece o problema?'];
async function abrirChamado(c, quem, peds, recarregar) {
  const { data: msgs } = await sb.from('chamado_msgs').select('*').eq('chamado_id', c.id).order('criado_em');
  const q = quem(c.user_id), wa = fone(q.whatsapp), pd = peds.find((p) => p.id === c.pedido_id);
  const bolha = (m) => `<div class="tk ${m.autor === 'admin' ? 'tk-eu' : 'tk-ele'}"><div>${esc(m.texto).replace(/\n/g, '<br>')}</div><small>${m.autor === 'admin' ? 'Você' : esc(q.nome || 'Cliente')} · ${dh(m.criado_em)}</small></div>`;
  dlg.style.width = 'min(760px,96%)';
  dlg.innerHTML = `<div class="dlg-in thread"><div class="dlg-top"><div><h2 style="font-size:1.35rem">${esc(c.assunto)}</h2><p class="sm">${TIPOS[c.tipo]} · ${esc(q.nome || '')} ${esc(q.email || '')}${pd ? ' · ' + esc(pd.numero) : ''}</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <div class="tks" id="tks">${(msgs || []).map(bolha).join('')}</div>
    <div class="quick" style="margin-bottom:10px">${RESPOSTAS.map((r, i) => `<button type="button" data-r="${i}">${esc(r.slice(0, 34))}…</button>`).join('')}</div>
    <form id="frep" class="rep"><textarea class="field" name="t" placeholder="Sua resposta (o cliente vê na Área do cliente)" required></textarea>
      <div class="cta" style="margin:0;justify-content:space-between;flex-wrap:wrap">
        <span style="display:flex;gap:8px;flex-wrap:wrap">${c.status !== 'fechado' ? '<button type="button" class="btn" id="fech">Marcar resolvido</button>' : ''}${wa ? `<a class="btn wa" target="_blank" rel="noopener" href="${waLink(`Olá ${(q.nome || '').split(' ')[0]}! Respondi seu chamado "${c.assunto}" na Área do cliente: ${location.origin}/cliente.html#suporte`, wa)}">Avisar no WhatsApp</a>` : ''}</span>
        <button class="btn primary">Responder</button></div></form></div>`;
  if (!dlg.open) dlg.showModal();
  const tks = $('#tks', dlg); tks.scrollTop = tks.scrollHeight;
  const vistos = new Set((msgs || []).map((m) => m.id));
  const add = (m) => { if (vistos.has(m.id)) return; vistos.add(m.id); tks.insertAdjacentHTML('beforeend', bolha(m)); tks.scrollTop = tks.scrollHeight; };
  if (sb.channel) canal = sb.channel('adm-' + c.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamado_msgs', filter: `chamado_id=eq.${c.id}` }, (p) => add(p.new)).subscribe();
  $$('[data-r]', dlg).forEach((b) => { b.onclick = () => { $('#frep', dlg).t.value = RESPOSTAS[+b.dataset.r]; $('#frep', dlg).t.focus(); }; });
  $('#frep', dlg).onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.from('chamado_msgs').insert({ chamado_id: c.id, texto: e.target.t.value.trim() });
    if (error) return toast('Erro: ' + error.message);
    e.target.t.value = ''; c.status = 'respondido';
    const { data: n } = await sb.from('chamado_msgs').select('*').eq('chamado_id', c.id).order('criado_em'); (n || []).forEach(add);
    toast('✓ Resposta enviada');
  };
  const fe = $('#fech', dlg);
  if (fe) fe.onclick = async () => { await sb.from('chamados').update({ status: 'fechado' }).eq('id', c.id); toast('Chamado resolvido'); dlg.close(); recarregar(); };
  dlg.addEventListener('close', function f() { dlg.removeEventListener('close', f); recarregar(); });
}

/* ================= AVALIAÇÕES ================= */
async function avaliacoes(v) {
  const lista = await tudo(() => sb.from('avaliacoes').select('*').order('criado_em', { ascending: false }));
  const media = lista.length ? (lista.reduce((a, r) => a + r.nota, 0) / lista.length).toFixed(1).replace('.', ',') : '—';
  v.innerHTML = `<div class="kpis"><div class="kpi"><small>Nota média</small><b>${media}</b><em>${lista.length} avaliações</em></div>
      <div class="kpi"><small>No site</small><b>${lista.filter((r) => r.aprovado && r.autoriza_publicar).length}</b><em>aprovadas e autorizadas</em></div></div>
    <div class="reviews">${lista.map((r) => `<div class="review"><span class="st">${'★'.repeat(r.nota)}${'☆'.repeat(5 - r.nota)}</span><p>${r.texto ? '“' + esc(r.texto) + '”' : '<i style="color:var(--muted)">sem comentário</i>'}</p>
      <div><b>${esc(r.nome_exibicao || 'Cliente')}</b><br><small>${esc(r.projeto || '')} · ${data(r.criado_em)}</small></div>
      <div class="cta" style="margin:0">${!r.autoriza_publicar ? '<span class="pill" style="color:var(--muted)">Cliente não autorizou publicar</span>' : r.aprovado ? `<button class="btn" data-ap="${r.id}" data-v="0">Tirar do site</button>` : `<button class="btn primary" data-ap="${r.id}" data-v="1">Publicar no site</button>`}<button class="rm" data-del="${r.id}">apagar</button></div></div>`).join('') || '<p class="note-box">Nenhuma avaliação ainda. Elas chegam quando um pedido é marcado como Entregue e o cliente avalia na Área do cliente.</p>'}</div>`;
  $$('[data-ap]', v).forEach((b) => { b.onclick = async () => { await sb.from('avaliacoes').update({ aprovado: b.dataset.v === '1' }).eq('id', b.dataset.ap); toast(b.dataset.v === '1' ? '✓ Publicada no site' : 'Removida do site'); avaliacoes(v); }; });
  $$('[data-del]', v).forEach((b) => { b.onclick = async () => { if (!confirm('Apagar esta avaliação?')) return; await sb.from('avaliacoes').delete().eq('id', b.dataset.del); avaliacoes(v); }; });
}

/* ================= LEADS ================= */
async function leads(v) {
  const lista = await tudo(() => sb.from('leads').select('*').order('criado_em', { ascending: false }));
  const orig = { saida: 'Popup de saída', quiz: 'Quiz' };
  v.innerHTML = `<div class="bar-f"><span style="color:var(--muted)">${lista.length} contatos</span><span style="flex:1"></span><button class="btn" id="csv">Exportar planilha (CSV)</button></div>
    <div class="tbl"><table><thead><tr><th>Data</th><th>Nome</th><th>Contato</th><th>Origem</th><th>Detalhes</th><th></th></tr></thead><tbody>
    ${lista.length ? lista.map((l) => {
      const wa = fone(l.contato), mail = /@/.test(l.contato);
      const det = l.dados && (l.dados.pacote ? 'Quiz: ' + l.dados.pacote : l.dados.cupom ? 'Cupom ' + l.dados.cupom : '');
      return `<tr><td>${dh(l.criado_em)}</td><td>${esc(l.nome || '—')}</td><td>${esc(l.contato)}</td><td>${esc(orig[l.origem] || l.origem)}</td><td>${esc(det || '')}</td>
        <td style="white-space:nowrap">${wa && !mail ? `<a class="mini" target="_blank" rel="noopener" href="${waLink(`Olá ${(l.nome || '').split(' ')[0]}! Aqui é o Jackson, do site. Vi que você se interessou${l.dados && l.dados.cupom ? ` e liberou o cupom ${l.dados.cupom}` : ''}. Posso te ajudar?`, wa)}">WhatsApp</a>` : ''}
        ${mail ? `<a class="mini" href="mailto:${esc(l.contato)}">E-mail</a>` : ''} <button class="rm" data-del="${l.id}">apagar</button></td></tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:40px">Nenhum lead ainda. Eles chegam pelo popup de saída e pelo quiz.</td></tr>'}</tbody></table></div>`;
  $('#csv', v).onclick = () => {
    const linhas = [['data', 'nome', 'contato', 'origem', 'detalhes'], ...lista.map((l) => [dh(l.criado_em), l.nome || '', l.contato, l.origem, JSON.stringify(l.dados || {})])];
    const csv = '﻿' + linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
  $$('[data-del]', v).forEach((b) => { b.onclick = async () => { if (!confirm('Apagar este contato?')) return; await sb.from('leads').delete().eq('id', b.dataset.del); b.closest('tr').remove(); }; });
}

/* ================= BLOG ================= */
async function blog(v) {
  const { data: lista, error } = await sb.from('posts').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  v.innerHTML = `<div class="bar-f"><button class="btn primary" id="novo">+ Novo post</button>
      ${!lista.length && window.POSTS_PADRAO ? '<button class="btn" id="imp">Importar os 3 posts iniciais</button>' : ''}
      <span style="color:var(--muted);font-size:.88rem">${lista.length ? '' : 'Enquanto não houver posts publicados aqui, o site mostra os posts iniciais.'}</span></div>
    <div class="tbl"><table><thead><tr><th>Título</th><th>Categoria</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>
    ${lista.map((p) => `<tr class="click" data-s="${esc(p.slug)}"><td><b>${esc(p.titulo)}</b><br><small style="color:var(--muted)">/${esc(p.slug)}</small></td><td>${esc(p.categoria || '')}</td><td>${data(p.criado_em)}</td><td><span class="pill" style="color:${p.publicado ? '#4ade80' : '#fbbf24'}">${p.publicado ? 'Publicado' : 'Rascunho'}</span></td><td><a class="mini" href="blog.html?p=${encodeURIComponent(p.slug)}" target="_blank">ver</a></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">Nenhum post no banco ainda.</td></tr>'}</tbody></table></div>`;
  $('#novo', v).onclick = () => editor({}, () => blog(v));
  const imp = $('#imp', v);
  if (imp) imp.onclick = async () => {
    const { error: e } = await sb.from('posts').insert(window.POSTS_PADRAO.map((p) => ({ ...p, publicado: true })));
    if (e) return toast('Erro: ' + e.message);
    toast('✓ Posts importados'); blog(v);
  };
  $$('tr[data-s]', v).forEach((tr) => { tr.onclick = (e) => { if (e.target.closest('a')) return; editor(lista.find((p) => p.slug === tr.dataset.s), () => blog(v)); }; });
}

const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
function editor(p, recarregar) {
  const novo = !p.id;
  dlg.style.width = 'min(1100px,96%)';
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-top"><div><h2>${novo ? 'Novo post' : 'Editar post'}</h2><p class="sm">Use ## para títulos, - para listas, **negrito** e [texto](https://link).</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <form id="fp" style="display:grid;gap:12px;margin-top:16px">
      <input class="field" name="titulo" placeholder="Título" required value="${esc(p.titulo || '')}">
      <div class="two"><input class="field" name="slug" placeholder="endereco-do-post" required pattern="[a-z0-9-]{3,80}" value="${esc(p.slug || '')}"><input class="field" name="categoria" placeholder="Categoria (ex.: Guia)" value="${esc(p.categoria || '')}"></div>
      <input class="field" name="resumo" placeholder="Resumo (aparece no card e no Google)" maxlength="400" value="${esc(p.resumo || '')}">
      <div class="editor"><textarea class="field" name="conteudo" placeholder="Escreva aqui…">${esc(p.conteudo || '')}</textarea><div class="prev article"><div class="body" id="pv"></div></div></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="publicado" ${p.publicado || novo ? 'checked' : ''}> Publicado (visível no site)</label>
      <div class="cta" style="margin:0"><button class="btn primary">Salvar</button>${novo ? '' : '<button type="button" class="rm" id="delpost" style="color:#f87171">Excluir post</button>'}</div>
    </form></div>`;
  if (!dlg.open) dlg.showModal();
  const f = $('#fp', dlg);
  const pv = () => { $('#pv', dlg).innerHTML = md(f.conteudo.value); };
  f.conteudo.oninput = pv; pv();
  let slugManual = !novo;
  f.slug.oninput = () => { slugManual = true; };
  f.titulo.oninput = () => { if (!slugManual) f.slug.value = slugify(f.titulo.value); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const row = { titulo: f.titulo.value.trim(), slug: f.slug.value.trim(), categoria: f.categoria.value.trim() || null, resumo: f.resumo.value.trim() || null, conteudo: f.conteudo.value, publicado: f.publicado.checked };
    const q = novo ? sb.from('posts').insert(row) : sb.from('posts').update(row).eq('id', p.id);
    const { error } = await q;
    if (error) return toast(/duplicate/.test(error.message) ? 'Já existe um post com esse endereço.' : 'Erro: ' + error.message);
    toast('✓ Post salvo'); dlg.close(); recarregar();
  };
  const del = $('#delpost', dlg);
  if (del) del.onclick = async () => { if (!confirm('Excluir este post?')) return; await sb.from('posts').delete().eq('id', p.id); toast('Post excluído'); dlg.close(); recarregar(); };
}

/* ================= CLIENTES ================= */
async function clientes(v) {
  const [perfis, peds] = await Promise.all([
    tudo(() => sb.from('perfis').select('*').order('criado_em', { ascending: false })),
    tudo(() => sb.from('pedidos').select('email,user_id,valor_pago')),
  ]);
  v.innerHTML = `<p style="color:var(--muted);margin-bottom:14px">${perfis.length} contas criadas na Área do cliente.</p>
    <div class="tbl"><table><thead><tr><th>Desde</th><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Pedidos</th><th>Pago</th><th></th></tr></thead><tbody>
    ${perfis.map((c) => {
      const meus = peds.filter((p) => p.user_id === c.id || (c.email && (p.email || '').toLowerCase() === c.email));
      const wa = fone(c.whatsapp);
      return `<tr><td>${data(c.criado_em)}</td><td>${esc(c.nome || '—')}</td><td>${esc(c.email || '')}</td><td>${wa ? `<a class="link" target="_blank" rel="noopener" href="${waLink('Olá! Aqui é o Jackson.', wa)}">${esc(c.whatsapp)}</a>` : esc(c.whatsapp || '')}</td><td>${meus.length}</td><td>${brl(meus.reduce((a, p) => a + Number(p.valor_pago || 0), 0))}</td><td><button class="mini" data-arq="${c.id}" data-nome="${esc(c.nome || c.email || '')}">Arquivos</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">Nenhum cliente cadastrado ainda.</td></tr>'}</tbody></table></div>`;
  $$('[data-arq]', v).forEach((b) => { b.onclick = () => arquivosDe(b.dataset.arq, b.dataset.nome); });
}
async function arquivosDe(uid, nome) {
  const stg = sb.storage.from('arquivos');
  const { data, error } = await stg.list(uid, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  const fs = (data || []).filter((f) => f.name && f.id !== null);
  dlg.style.width = 'min(680px,96%)';
  dlg.innerHTML = `<div class="dlg-in"><div class="dlg-top"><div><h2>Arquivos</h2><p class="sm">${esc(nome)}</p></div><button class="x" data-x aria-label="Fechar">×</button></div>
    <div class="files">${error ? `<p class="note-box warn">${esc(error.message)}</p>` : fs.length ? fs.map((f) => `<div class="file"><span class="ic">📎</span><div><b>${esc(f.name.replace(/^\d+-/, ''))}</b><small>${f.metadata ? Math.max(1, Math.round((f.metadata.size || 0) / 1024)) + ' KB · ' : ''}${f.created_at ? dh(f.created_at) : ''}</small></div><button class="mini" data-dl="${esc(f.name)}">Baixar</button><span></span></div>`).join('') : '<p class="note-box">Este cliente ainda não enviou arquivos.</p>'}</div></div>`;
  if (!dlg.open) dlg.showModal();
  $$('[data-dl]', dlg).forEach((b) => { b.onclick = async () => { const { data: u } = await stg.createSignedUrl(`${uid}/${b.dataset.dl}`, 600); if (u) open(u.signedUrl, '_blank', 'noopener'); }; });
}

shell();
})();
