/* "Monte seu site em 30 segundos": prévia ao vivo que vira encomenda */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const { esc, waLink } = window.DB;
if (!$('#criForm')) return;

const SEG = {
  restaurante: { nome: 'Restaurante / café', ic: '☕', h: 'Sabor que vira tradição', sub: 'Peça pelo WhatsApp ou reserve sua mesa em segundos.', cta: 'Ver cardápio', itens: [['🍝', 'Cardápio'], ['🛵', 'Delivery'], ['📅', 'Reservas']], tipo: 'institucional', ex: 'Café da Serra' },
  saude: { nome: 'Clínica / saúde', ic: '🩺', h: 'Cuidado de verdade, perto de você', sub: 'Agende sua consulta online, sem fila e sem espera.', cta: 'Agendar consulta', itens: [['👩‍⚕️', 'Especialidades'], ['🧪', 'Exames'], ['💳', 'Convênios']], tipo: 'institucional', rec: ['agenda'], ex: 'Clínica Vida' },
  moda: { nome: 'Loja de roupas', ic: '👗', h: 'Seu estilo, entregue em casa', sub: 'Novidades toda semana, com Pix e frete para todo o Brasil.', cta: 'Comprar agora', itens: [['🆕', 'Novidades'], ['🏷️', 'Promoções'], ['🚚', 'Frete grátis']], tipo: 'loja', rec: ['pagamentos'], ex: 'Bella Moda' },
  academia: { nome: 'Academia / esporte', ic: '🏋️', h: 'Seu melhor treino começa aqui', sub: 'Planos flexíveis e aula experimental grátis.', cta: 'Aula experimental', itens: [['💪', 'Musculação'], ['🔥', 'Funcional'], ['📋', 'Planos']], tipo: 'institucional', rec: ['agenda'], ex: 'Força Total' },
  advocacia: { nome: 'Advocacia / consultoria', ic: '⚖️', h: 'Seus direitos em boas mãos', sub: 'Atendimento claro, humano e direto ao ponto.', cta: 'Falar com especialista', itens: [['📑', 'Trabalhista'], ['👨‍👩‍👧', 'Família'], ['🏢', 'Empresarial']], tipo: 'institucional', ex: 'Souza Advocacia' },
  beleza: { nome: 'Beleza / estética', ic: '💅', h: 'Realce o que você tem de melhor', sub: 'Escolha o serviço e o horário em poucos toques.', cta: 'Agendar horário', itens: [['💇', 'Cabelo'], ['💅', 'Unhas'], ['✨', 'Estética']], tipo: 'institucional', rec: ['agenda'], ex: 'Studio Glow' },
  tech: { nome: 'Tecnologia / startup', ic: '🚀', h: 'Tecnologia que acelera seu negócio', sub: 'Automatize processos e cresça sem aumentar a equipe.', cta: 'Pedir demonstração', itens: [['⚙️', 'Automação'], ['📊', 'Dashboards'], ['🛟', 'Suporte']], tipo: 'sistema', rec: ['painel', 'login'], ex: 'NovaTech' },
};
const EST = { escuro: 'Moderno escuro', claro: 'Clean claro', vibrante: 'Vibrante' };
const CORES = [255, 200, 150, 330, 20, 45, 0];
const SEC = { galeria: '🖼️ Galeria de fotos', avaliacoes: '⭐ Avaliações', agenda: '📅 Agendamento', whats: '💬 Botão de WhatsApp', mapa: '📍 Mapa e contato' };
const st = { nome: '', seg: 'restaurante', est: 'escuro', cor: 255, sec: new Set(['galeria', 'whats']), dev: 'desk', mexeu: 0 };

$('#criSeg').innerHTML = Object.entries(SEG).map(([k, v], i) => `<label class="opt"><input type="radio" name="seg" value="${k}" ${i ? '' : 'checked'}><span><b>${v.ic} ${v.nome}</b></span></label>`).join('');
$('#criEst').innerHTML = Object.entries(EST).map(([k, v], i) => `<label class="opt"><input type="radio" name="est" value="${k}" ${i ? '' : 'checked'}><span><b>${v}</b></span></label>`).join('');
$('#criCor').innerHTML = CORES.map((h, i) => `<button type="button" data-h="${h}" aria-label="Cor ${i + 1}" aria-pressed="${i === 0}" style="background:hsl(${h} 85% 58%)"></button>`).join('');
$('#criSec').innerHTML = Object.entries(SEC).map(([k, v]) => `<label class="opt"><input type="checkbox" name="sec" value="${k}" ${st.sec.has(k) ? 'checked' : ''}><span><b>${v}</b></span></label>`).join('');

const slug = (t) => (t || 'seunegocio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 22) || 'seunegocio';

function render() {
  const g = SEG[st.seg], nome = st.nome || g.ex, h = st.cor;
  const pal = st.est === 'claro'
    ? { bg: '#f7f6fb', ink: '#17141f', mut: '#6b6680', card: '#ffffff', line: '#e6e3ef' }
    : st.est === 'vibrante'
      ? { bg: `linear-gradient(160deg,hsl(${h} 70% 22%),hsl(${(h + 40) % 360} 65% 12%))`, ink: '#fff', mut: 'rgba(255,255,255,.75)', card: 'rgba(255,255,255,.1)', line: 'rgba(255,255,255,.18)' }
      : { bg: '#0d0b14', ink: '#f2f0fa', mut: '#a19cb8', card: '#17141f', line: '#2a2638' };
  const ac = `hsl(${h} 85% ${st.est === 'claro' ? 50 : 60}%)`;
  const site = $('#criSite');
  site.style.setProperty('--c-bg', pal.bg); site.style.setProperty('--c-ink', pal.ink); site.style.setProperty('--c-mut', pal.mut);
  site.style.setProperty('--c-card', pal.card); site.style.setProperty('--c-line', pal.line); site.style.setProperty('--c-ac', ac);
  site.innerHTML = `
    <div class="cs-nav"><b><i>${g.ic}</i>${esc(nome)}</b><span>Início</span><span>${esc(g.itens[0][1])}</span><span>Contato</span><em>${esc(g.cta)}</em></div>
    <div class="cs-hero"><div><small>${esc(g.nome)}</small><h4>${esc(g.h)}</h4><p>${esc(g.sub)}</p><div class="cs-btns"><em>${esc(g.cta)}</em><u>Saiba mais</u></div></div>
      <div class="cs-art"><span>${g.ic}</span></div></div>
    <div class="cs-cards">${g.itens.map(([i, t]) => `<div><span>${i}</span><b>${esc(t)}</b><i></i><i></i></div>`).join('')}</div>
    ${st.sec.has('galeria') ? `<div class="cs-sec"><b>Galeria</b><div class="cs-gal">${[0, 1, 2, 3].map((k) => `<div style="background:linear-gradient(${120 + k * 40}deg,hsl(${(h + k * 25) % 360} 70% 55%),hsl(${(h + 60 + k * 30) % 360} 70% 35%))"></div>`).join('')}</div></div>` : ''}
    ${st.sec.has('avaliacoes') ? `<div class="cs-sec"><b>Avaliações</b><div class="cs-rev">${[0, 1].map(() => '<div><span>★★★★★</span><i></i><i></i></div>').join('')}</div></div>` : ''}
    ${st.sec.has('agenda') ? `<div class="cs-sec cs-ag"><b>Agende online</b><div>${['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d, k) => `<span class="${k === 2 ? 'on' : ''}">${d}<br><small>${9 + k}h</small></span>`).join('')}</div><em>Confirmar horário</em></div>` : ''}
    ${st.sec.has('mapa') ? '<div class="cs-sec cs-map"><div class="cs-pin">📍</div><div><b>Visite a gente</b><i></i><i></i></div></div>' : ''}
    <div class="cs-foot">© ${new Date().getFullYear()} ${esc(nome)}</div>
    ${st.sec.has('whats') ? '<div class="cs-wa">💬</div>' : ''}`;
  $('#criUrl').textContent = `www.${slug(nome)}.com.br`;
  $('#criFrame').classList.toggle('mob', st.dev === 'mob');
  $('#criWa').href = waLink(resumo());
  $('#criNome').placeholder = 'Ex.: ' + g.ex;
}
function resumo() {
  const g = SEG[st.seg];
  return `Olá Jackson! Montei uma prévia no seu site e quero algo assim:\n\n*Negócio:* ${st.nome || '(sem nome ainda)'}\n*Segmento:* ${g.nome}\n*Estilo:* ${EST[st.est]}\n*Precisa ter:* ${[...st.sec].map((k) => SEC[k].replace(/^\S+\s/, '')).join(', ') || '—'}`;
}
function mexeu() {
  st.mexeu++;
  const fr = $('#criFrame'); fr.classList.remove('pop'); void fr.offsetWidth; fr.classList.add('pop');
  if (st.mexeu === 3) { DB.track('criador_preview', { seg: st.seg }); }
}

$('#criForm').addEventListener('input', (e) => {
  const t = e.target;
  if (t.name === 'nome') st.nome = t.value.trim();
  if (t.name === 'seg') st.seg = t.value;
  if (t.name === 'est') st.est = t.value;
  if (t.name === 'sec') t.checked ? st.sec.add(t.value) : st.sec.delete(t.value);
  render(); if (t.name !== 'nome' || st.nome.length === 3) mexeu();
});
$('#criCor').onclick = (e) => {
  const b = e.target.closest('[data-h]'); if (!b) return;
  st.cor = +b.dataset.h; $$('#criCor button').forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); mexeu();
};
$$('[data-dev]').forEach((b) => { b.onclick = () => { st.dev = b.dataset.dev; $$('[data-dev]').forEach((x) => x.classList.toggle('added', x === b)); render(); }; });

// moldura acompanha o mouse em 3D
const stage = $('#criStage'), frame = $('#criFrame');
stage.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  frame.style.setProperty('--ry', `${x * 16}deg`); frame.style.setProperty('--rx', `${-y * 12}deg`);
});
stage.addEventListener('pointerleave', () => { frame.style.setProperty('--ry', '-10deg'); frame.style.setProperty('--rx', '6deg'); });

$('#criQuero').onclick = () => {
  const g = SEG[st.seg];
  DB.track('criador_quero', { seg: st.seg });
  const desc = `Montei uma prévia no site: ${st.nome ? `"${st.nome}", ` : ''}${g.nome}, estilo ${EST[st.est].toLowerCase()}. Precisa ter: ${[...st.sec].map((k) => SEC[k].replace(/^\S+\s/, '')).join(', ')}.`;
  const rec = [...(g.rec || [])]; if (st.sec.has('agenda') && !rec.includes('agenda')) rec.push('agenda');
  if (window.JF && JF.encomendar) JF.encomendar({ tipo: g.tipo, recursos: rec, desc, empresa: st.nome });
  else location.hash = '#encomenda';
};
render();
})();
