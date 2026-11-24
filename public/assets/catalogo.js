/* =====================================================================
   CATÁLOGO E CONFIGURAÇÕES DO SITE  —  edite só este arquivo
   ---------------------------------------------------------------------
   Este arquivo é lido pelo site (navegador) E pelo servidor (/api/checkout),
   então o preço cobrado no Mercado Pago é SEMPRE o daqui, nunca o que
   chega do navegador. Mudou o preço aqui = mudou em todo lugar.
   ===================================================================== */
(function (root) {
  const CONFIG = {
    nome: 'Jackson FB',
    // ⚠️ CONFIRA: número com DDI 55 + DDD + celular (9 dígitos), só números.
    whatsapp: '555499915886',
    whatsappExibicao: '(54) 99915-886',
    instagram: 'jacksonfb_',
    email: '', // ex.: 'contato@seudominio.com' (aparece no rodapé se preenchido)
    // Formspree (opcional): crie um form grátis em formspree.io e cole a URL.
    // Se preenchido, cada encomenda também chega no seu e-mail.
    formspree: '',
    // Percentual do sinal para reservar o projeto (0.5 = 50%)
    sinal: 0.5,

    // Cupons de desconto (0.1 = 10%). O servidor confere o cupom antes de cobrar.
    cupons: { BEMVINDO10: 0.1, EXPLORADOR15: 0.15 },
    // Prêmio de quem completa todas as missões do site ('' desliga)
    cupomExplorador: 'EXPLORADOR15',
    // Cupom oferecido no popup para quem está saindo do site ('' desliga o popup de cupom)
    cupomSaida: 'BEMVINDO10',

    // Supabase (login, área do cliente, painel, blog, métricas).
    // Supabase → Project Settings → API Keys. A "Publishable key" (sb_publishable_...)
    // pode ficar aqui: ela é pública e o banco é protegido pelas regras do schema.sql.
    // NUNCA coloque aqui a "Secret key".
    supabaseUrl: 'https://aborpbjapsglzeiojdpo.supabase.co',
    supabaseKey: 'sb_publishable_VHCT7r5KtIUhXjMFou4xsg_cDVpIzx9',
  };

  // tipo: 'servico' (projeto) | 'extra' (adicional) ;  mensal: cobra por mês
  const SERVICOS = [
    {
      id: 'landing', tipo: 'servico', nome: 'Landing Page', preco: 315, prazo: '5 a 7 dias', destaque: false,
      resumo: 'Uma página de alta conversão para vender um produto, serviço ou captar contatos.',
      inclui: ['Design exclusivo e responsivo', 'Botão de WhatsApp e formulário', 'SEO básico e Google Analytics', 'Publicação na Vercel'],
    },
    {
      id: 'institucional', tipo: 'servico', nome: 'Site Institucional', preco: 630, prazo: '10 a 15 dias', destaque: true,
      resumo: 'Site completo de até 5 páginas para apresentar sua empresa com autoridade.',
      inclui: ['Até 5 páginas (Início, Sobre, Serviços…)', 'Painel para editar textos', 'SEO on-page completo', 'Animações e microinterações'],
    },
    {
      id: 'loja', tipo: 'servico', nome: 'Loja Virtual', preco: 1225, prazo: '20 a 30 dias', destaque: false,
      resumo: 'E-commerce com carrinho, Pix, cartão e painel de pedidos para vender todo dia.',
      inclui: ['Catálogo, busca e filtros', 'Pagamento Pix e cartão (Mercado Pago)', 'Cálculo de frete e cupons', 'Painel de produtos e pedidos'],
    },
    {
      id: 'portfolio3d', tipo: 'servico', nome: 'Portfólio / Site 3D', preco: 875, prazo: '15 a 20 dias', destaque: false,
      resumo: 'Experiência imersiva com cenas 3D interativas que deixam sua marca inesquecível.',
      inclui: ['Cena 3D sob medida (Three.js)', 'Animações de scroll', 'Otimizado para celular', 'Carregamento rápido'],
    },
    {
      id: 'sistema', tipo: 'servico', nome: 'Sistema Web / Automação', preco: 1575, prazo: 'sob escopo', destaque: false,
      resumo: 'Painéis, agendamentos, CRMs e automações que economizam horas da sua equipe.',
      inclui: ['Login e níveis de acesso', 'Banco de dados e API', 'Integrações (WhatsApp, planilhas, pagamentos)', 'Relatórios e dashboards'],
    },

    { id: 'manutencao', tipo: 'extra', nome: 'Manutenção mensal', preco: 52.5, mensal: true, resumo: 'Atualizações, backups, pequenas alterações e suporte prioritário.' },
    { id: 'dominio', tipo: 'extra', nome: 'Domínio + e-mail profissional', preco: 42, resumo: 'Registro e configuração do domínio .com.br e e-mail com a sua marca.' },
    { id: 'seo', tipo: 'extra', nome: 'Pacote SEO Google', preco: 140, resumo: 'Google Meu Negócio, Search Console e otimização para aparecer nas buscas.' },
    { id: 'copy', tipo: 'extra', nome: 'Textos persuasivos', preco: 105, resumo: 'Escrita dos textos do site focada em conversão (copywriting).' },
    { id: 'pagina', tipo: 'extra', nome: 'Página adicional', preco: 87.5, resumo: 'Uma página extra no seu site com o mesmo padrão de design.' },
  ];

  // Formulário "Encomenda sob medida": base por tipo + adicionais (estimativa ao vivo)
  const ENCOMENDA = {
    tipos: [
      { id: 'landing', nome: 'Landing page', base: 315, icone: '◎' },
      { id: 'institucional', nome: 'Site institucional', base: 630, icone: '▣' },
      { id: 'loja', nome: 'Loja virtual', base: 1225, icone: '◈' },
      { id: 'portfolio3d', nome: 'Site / portfólio 3D', base: 875, icone: '⬡' },
      { id: 'sistema', nome: 'Sistema / automação', base: 1575, icone: '⌘' },
      { id: 'outro', nome: 'Outra ideia', base: 0, icone: '✦' },
    ],
    recursos: [
      { id: 'painel', nome: 'Painel administrativo', preco: 280 },
      { id: 'login', nome: 'Login de usuários', preco: 210 },
      { id: 'pagamentos', nome: 'Pagamentos online', preco: 245 },
      { id: 'agenda', nome: 'Agendamento online', preco: 210 },
      { id: 'blog', nome: 'Blog / notícias', preco: 140 },
      { id: 'idiomas', nome: 'Mais de um idioma', preco: 175 },
      { id: 'integracoes', nome: 'Integração WhatsApp / API', preco: 140 },
      { id: 'anim3d', nome: 'Elementos 3D / animações', preco: 315 },
    ],
    prazos: [
      { id: 'normal', nome: 'Prazo normal', fator: 1 },
      { id: 'rapido', nome: 'Preciso rápido', fator: 1.25 },
      { id: 'flex', nome: 'Sem pressa', fator: 0.95 },
    ],
    orcamentos: ['Até R$ 350', 'R$ 350 a 1.000', 'R$ 1.000 a 2.000', 'Acima de R$ 2.000', 'Ainda não sei'],
  };

  const API = { CONFIG, SERVICOS, ENCOMENDA };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.CATALOGO = API;
})(typeof self !== 'undefined' ? self : this);
