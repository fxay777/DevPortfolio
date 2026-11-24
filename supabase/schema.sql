-- =====================================================================
-- BANCO DE DADOS DO PORTFÓLIO  (Supabase → SQL Editor → New query → colar tudo → Run)
-- Pode rodar de novo sem problema: tudo usa "if not exists"/"or replace".
-- =====================================================================

-- ---------- administradores ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
-- (sem policies: ninguém lê/escreve pelo site; você se adiciona pelo SQL, veja o fim do arquivo)

-- Administrador só tem poderes depois de confirmar o 2FA no login (nível "aal2").
-- Assim, mesmo que alguém descubra sua senha, não entra no painel sem o código do seu celular.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- usado pelo painel para saber se deve pedir o 2FA (não dá nenhum poder)
create or replace function public.admin_cadastrado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.admin_cadastrado() to authenticated;

-- ---------- perfis dos clientes ----------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text check (char_length(nome) <= 120),
  whatsapp text check (char_length(whatsapp) <= 30),
  email text,
  criado_em timestamptz not null default now()
);
alter table public.perfis add column if not exists email text;
-- nome de usuário único (minúsculas, 3 a 20 caracteres: letras, números, _ e .)
alter table public.perfis add column if not exists usuario text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_usuario_formato') then
    alter table public.perfis add constraint perfis_usuario_formato check (usuario ~ '^[a-z0-9_.]{3,20}$');
  end if;
end $$;
create unique index if not exists perfis_usuario_unico on public.perfis (usuario);

-- o site pergunta se um usuário está livre antes de cadastrar
create or replace function public.usuario_disponivel(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(u) ~ '^[a-z0-9_.]{3,20}$'
     and lower(u) not in ('admin','administrador','suporte','jackson','jacksonfb','root','sistema')
     and not exists (select 1 from public.perfis where usuario = lower(u));
$$;
grant execute on function public.usuario_disponivel(text) to anon, authenticated;
alter table public.perfis enable row level security;
drop policy if exists perfis_dono on public.perfis;
create policy perfis_dono on public.perfis for all to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- o cliente não pode trocar o e-mail do perfil pelo site
create or replace function public.perfil_protege() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then new.email = old.email; new.id = old.id; new.usuario = old.usuario; end if;
  return new;
end $$;
drop trigger if exists perfil_protege on public.perfis;
create trigger perfil_protege before update on public.perfis for each row execute function public.perfil_protege();

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(new.raw_user_meta_data->>'usuario'));
begin
  if u is null or u = '' then  -- conta criada fora do site (ex.: painel do Supabase)
    u := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if not public.usuario_disponivel(u) then
    raise exception 'usuario_indisponivel' using errcode = '23505';
  end if;
  insert into public.perfis (id, usuario, nome, whatsapp, email)
  values (new.id, u, left(coalesce(new.raw_user_meta_data->>'nome', u), 120), left(new.raw_user_meta_data->>'whatsapp', 30), lower(new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

-- ---------- pedidos e encomendas ----------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null check (char_length(numero) <= 20),
  origem text not null default 'loja' check (origem in ('loja', 'encomenda')),
  user_id uuid references auth.users(id) on delete set null,
  nome text check (char_length(nome) <= 120),
  email text check (char_length(email) <= 160),
  whatsapp text check (char_length(whatsapp) <= 30),
  itens jsonb not null default '[]' check (pg_column_size(itens) < 8000),
  dados jsonb not null default '{}' check (pg_column_size(dados) < 8000),
  total numeric(10,2) not null default 0,
  plano text,
  cupom text,
  valor_pago numeric(10,2) not null default 0,
  status text not null default 'novo' check (status in
    ('novo','aguardando_pagamento','pendente','pago','briefing','desenvolvimento','revisao','entregue','cancelado')),
  mp_payment_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_email_idx on public.pedidos (lower(email));
create index if not exists pedidos_user_idx on public.pedidos (user_id);
alter table public.pedidos enable row level security;

drop policy if exists pedidos_ler on public.pedidos;
create policy pedidos_ler on public.pedidos for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or lower(email) = lower(auth.jwt()->>'email'));

-- o site pode CRIAR pedidos novos (WhatsApp / encomenda), mas nunca marcar como pago
drop policy if exists pedidos_criar on public.pedidos;
create policy pedidos_criar on public.pedidos for insert to anon, authenticated
  with check (status = 'novo' and valor_pago = 0 and mp_payment_id is null
              and (user_id is null or user_id = auth.uid()));

drop policy if exists pedidos_admin on public.pedidos;
create policy pedidos_admin on public.pedidos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists pedidos_admin_del on public.pedidos;
create policy pedidos_admin_del on public.pedidos for delete to authenticated using (public.is_admin());

-- ---------- atualizações do projeto (linha do tempo na área do cliente) ----------
create table if not exists public.atualizacoes (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  texto text not null check (char_length(texto) <= 2000),
  link text check (char_length(link) <= 500),
  criado_em timestamptz not null default now()
);
alter table public.atualizacoes enable row level security;
drop policy if exists atualiz_ler on public.atualizacoes;
create policy atualiz_ler on public.atualizacoes for select to authenticated
  using (public.is_admin() or exists (select 1 from public.pedidos p where p.id = pedido_id
         and (p.user_id = auth.uid() or lower(p.email) = lower(auth.jwt()->>'email'))));
drop policy if exists atualiz_admin on public.atualizacoes;
create policy atualiz_admin on public.atualizacoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- leads (quem deixou contato no popup, quiz, etc.) ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  nome text check (char_length(nome) <= 120),
  contato text not null check (char_length(contato) between 5 and 160),
  origem text not null check (char_length(origem) <= 30),
  dados jsonb not null default '{}' check (pg_column_size(dados) < 4000),
  criado_em timestamptz not null default now()
);
alter table public.leads enable row level security;
drop policy if exists leads_criar on public.leads;
create policy leads_criar on public.leads for insert to anon, authenticated with check (true);
drop policy if exists leads_admin on public.leads;
create policy leads_admin on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- eventos anônimos de navegação (métricas do painel) ----------
create table if not exists public.eventos (
  id bigint generated always as identity primary key,
  sessao text not null check (char_length(sessao) <= 40),
  tipo text not null check (char_length(tipo) <= 40),
  pagina text check (char_length(pagina) <= 200),
  dados jsonb not null default '{}' check (pg_column_size(dados) < 2000),
  criado_em timestamptz not null default now()
);
create index if not exists eventos_data_idx on public.eventos (criado_em desc);
alter table public.eventos enable row level security;
drop policy if exists eventos_criar on public.eventos;
create policy eventos_criar on public.eventos for insert to anon, authenticated with check (true);
drop policy if exists eventos_admin on public.eventos;
create policy eventos_admin on public.eventos for select to authenticated using (public.is_admin());
drop policy if exists eventos_admin_del on public.eventos;
create policy eventos_admin_del on public.eventos for delete to authenticated using (public.is_admin());

-- ---------- blog ----------
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,80}$'),
  titulo text not null check (char_length(titulo) <= 160),
  resumo text check (char_length(resumo) <= 400),
  conteudo text not null default '',
  categoria text check (char_length(categoria) <= 40),
  publicado boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists posts_ler on public.posts;
create policy posts_ler on public.posts for select to anon, authenticated using (publicado or public.is_admin());
drop policy if exists posts_admin on public.posts;
create policy posts_admin on public.posts for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- SUPORTE: chamados ----------
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete set null,
  assunto text not null check (char_length(assunto) between 3 and 140),
  tipo text not null default 'duvida' check (tipo in ('duvida','alteracao','problema','financeiro','outro')),
  status text not null default 'aberto' check (status in ('aberto','respondido','fechado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists chamados_user_idx on public.chamados (user_id, atualizado_em desc);
alter table public.chamados enable row level security;
drop policy if exists chamados_ler on public.chamados;
create policy chamados_ler on public.chamados for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists chamados_criar on public.chamados;
create policy chamados_criar on public.chamados for insert to authenticated
  with check (user_id = auth.uid() and status = 'aberto'
    and (pedido_id is null or exists (select 1 from public.pedidos p where p.id = pedido_id
         and (p.user_id = auth.uid() or lower(p.email) = lower(auth.jwt()->>'email')))));
drop policy if exists chamados_editar on public.chamados;
create policy chamados_editar on public.chamados for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists chamados_admin_del on public.chamados;
create policy chamados_admin_del on public.chamados for delete to authenticated using (public.is_admin());

-- o cliente só pode mudar o status do próprio chamado (fechar / reabrir)
create or replace function public.chamado_protege() returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    new.user_id = old.user_id; new.pedido_id = old.pedido_id; new.assunto = old.assunto; new.tipo = old.tipo; new.criado_em = old.criado_em;
    if new.status not in ('fechado','aberto') then new.status = old.status; end if;
  end if;
  new.atualizado_em = now();
  return new;
end $$;
drop trigger if exists chamado_protege on public.chamados;
create trigger chamado_protege before update on public.chamados for each row execute function public.chamado_protege();

create table if not exists public.chamado_msgs (
  id bigint generated always as identity primary key,
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  autor text not null default 'cliente' check (autor in ('cliente','admin')),
  user_id uuid default auth.uid(),
  texto text not null check (char_length(texto) between 1 and 4000),
  anexo text check (char_length(anexo) <= 500),
  criado_em timestamptz not null default now()
);
create index if not exists chamado_msgs_idx on public.chamado_msgs (chamado_id, criado_em);
alter table public.chamado_msgs enable row level security;
drop policy if exists msgs_ler on public.chamado_msgs;
create policy msgs_ler on public.chamado_msgs for select to authenticated
  using (public.is_admin() or exists (select 1 from public.chamados c where c.id = chamado_id and c.user_id = auth.uid()));
drop policy if exists msgs_criar on public.chamado_msgs;
create policy msgs_criar on public.chamado_msgs for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.chamados c where c.id = chamado_id and c.user_id = auth.uid()));
drop policy if exists msgs_admin_del on public.chamado_msgs;
create policy msgs_admin_del on public.chamado_msgs for delete to authenticated using (public.is_admin());

-- quem escreveu é decidido pelo banco, e o status do chamado acompanha a conversa
create or replace function public.msg_nova() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.autor = case when public.is_admin() and not exists (select 1 from public.chamados c where c.id = new.chamado_id and c.user_id = auth.uid()) then 'admin' else 'cliente' end;
  new.user_id = auth.uid();
  update public.chamados set status = case when new.autor = 'admin' then 'respondido' else 'aberto' end, atualizado_em = now() where id = new.chamado_id;
  return new;
end $$;
drop trigger if exists msg_nova on public.chamado_msgs;
create trigger msg_nova before insert on public.chamado_msgs for each row execute function public.msg_nova();

-- respostas aparecem ao vivo (Supabase Realtime)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chamado_msgs') then
    alter publication supabase_realtime add table public.chamado_msgs;
  end if;
end $$;

-- ---------- avaliações dos clientes ----------
create table if not exists public.avaliacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete set null,
  nota int not null check (nota between 1 and 5),
  texto text check (char_length(texto) <= 1200),
  nome_exibicao text check (char_length(nome_exibicao) <= 80),
  projeto text check (char_length(projeto) <= 120),
  autoriza_publicar boolean not null default false,
  aprovado boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (user_id, pedido_id)
);
alter table public.avaliacoes enable row level security;
drop policy if exists aval_publicas on public.avaliacoes;
create policy aval_publicas on public.avaliacoes for select to anon, authenticated
  using ((aprovado and autoriza_publicar) or user_id = auth.uid() or public.is_admin());
drop policy if exists aval_criar on public.avaliacoes;
create policy aval_criar on public.avaliacoes for insert to authenticated
  with check (user_id = auth.uid() and aprovado = false
    and (pedido_id is null or exists (select 1 from public.pedidos p where p.id = pedido_id
         and (p.user_id = auth.uid() or lower(p.email) = lower(auth.jwt()->>'email')))));
drop policy if exists aval_admin on public.avaliacoes;
create policy aval_admin on public.avaliacoes for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists aval_admin_del on public.avaliacoes;
create policy aval_admin_del on public.avaliacoes for delete to authenticated using (public.is_admin() or user_id = auth.uid());

-- ---------- arquivos dos clientes (logo, fotos, textos) ----------
-- Cada cliente só enxerga a própria pasta (arquivos/<id do cliente>/...). Você vê todas.
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;
drop policy if exists arquivos_enviar on storage.objects;
create policy arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists arquivos_ver on storage.objects;
create policy arquivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists arquivos_apagar on storage.objects;
create policy arquivos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- atualiza "atualizado_em" ----------
create or replace function public.toca_atualizado() returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end $$;
drop trigger if exists pedidos_toca on public.pedidos;
create trigger pedidos_toca before update on public.pedidos for each row execute function public.toca_atualizado();

-- ---------- segurança: funções internas não podem ser chamadas pelo site ----------
revoke execute on function public.novo_usuario() from public, anon, authenticated;
revoke execute on function public.msg_nova() from public, anon, authenticated;
revoke execute on function public.perfil_protege() from public, anon, authenticated;
revoke execute on function public.chamado_protege() from public, anon, authenticated;
revoke execute on function public.toca_atualizado() from public, anon, authenticated;
revoke execute on function public.admin_cadastrado() from public, anon;
grant execute on function public.admin_cadastrado() to authenticated;

-- =====================================================================
-- DEPOIS de criar sua conta pelo site (cliente.html), rode SÓ esta linha
-- trocando pelo seu e-mail, para virar administrador:
--
--   insert into public.admins (user_id) select id from auth.users where email = 'SEU@EMAIL.com';
-- =====================================================================
