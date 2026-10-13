-- ============================================================================
-- yoga-app — schéma Supabase
-- À coller tel quel dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque (il ne supprime aucune donnée).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Administrateurs : les comptes autorisés à modifier la bibliothèque
--    et à valider les fiches. Ajoutez votre email à la fin du script.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  ajoute_le timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Aucune politique : la table n'est lisible ni modifiable depuis l'appli,
-- seulement via le SQL Editor ou la clé secrète.

-- Vrai si l'utilisateur connecté est administrateur.
-- security definer : peut lire admins malgré la RLS ; search_path figé par sécurité.
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;
revoke all on function public.est_admin() from public;
grant execute on function public.est_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bibliothèque de postures (alimentée par npm run sync-bibliotheque)
-- ---------------------------------------------------------------------------
create table if not exists public.postures (
  id            text primary key,                -- P001…
  sanskrit      text,
  fr            text not null,
  en            text,
  famille       text not null,
  niveau        smallint not null default 1 check (niveau between 1 and 3),
  styles        text[] not null default '{}',
  phase         text,
  respirations  smallint,
  minutes       numeric(4,1),
  cotes         boolean not null default false,
  accessoires   text,
  zones         text[] not null default '{}',
  preparations  text[] not null default '{}',
  contres       text[] not null default '{}',
  precautions   text,
  variante_de   text,                            -- ID de la posture dont celle-ci est une variante
  maj_le        timestamptz not null default now()
);
alter table public.postures add column if not exists variante_de text;
alter table public.postures enable row level security;

drop policy if exists "postures : lecture publique" on public.postures;
create policy "postures : lecture publique" on public.postures
  for select to anon, authenticated using (true);

drop policy if exists "postures : écriture admin" on public.postures;
create policy "postures : écriture admin" on public.postures
  for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- ---------------------------------------------------------------------------
-- 3. Fiches « Comment faire ? » : cache partagé des fiches Gemini + validation
--    Une seule fiche par posture. Les fiches générées sont écrites par le
--    serveur (clé secrète) ; seuls les admins peuvent les modifier ou valider.
-- ---------------------------------------------------------------------------
create table if not exists public.fiches (
  posture_id  text primary key references public.postures(id) on delete cascade,
  contenu     jsonb not null,                      -- entree[], alignement[], respiration, sortie, variantes
  statut      text not null default 'generee' check (statut in ('generee', 'validee')),
  modele      text,                                -- modèle Gemini qui l'a rédigée
  valide_par  text,                                -- email de l'admin
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now()
);
alter table public.fiches enable row level security;

drop policy if exists "fiches : lecture publique" on public.fiches;
create policy "fiches : lecture publique" on public.fiches
  for select to anon, authenticated using (true);

drop policy if exists "fiches : modification admin" on public.fiches;
create policy "fiches : modification admin" on public.fiches
  for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- ---------------------------------------------------------------------------
-- 4. Séances enregistrées : chacun ne voit et ne modifie que les siennes
-- ---------------------------------------------------------------------------
create table if not exists public.seances (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  style        text not null,
  duree        smallint not null,
  niveau       text not null,
  cible_id     text references public.postures(id) on delete set null,
  titre        text,
  contenu      jsonb not null,                     -- la séance complète (phases, postures, durées)
  cree_le      timestamptz not null default now(),
  maj_le       timestamptz not null default now()
);
create index if not exists seances_user_idx on public.seances (user_id, maj_le desc);
create index if not exists seances_cible_idx on public.seances (cible_id);
alter table public.seances enable row level security;

drop policy if exists "seances : propriétaire" on public.seances;
create policy "seances : propriétaire" on public.seances
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. maj_le mis à jour automatiquement
-- ---------------------------------------------------------------------------
create or replace function public.touche_maj_le()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

drop trigger if exists postures_maj on public.postures;
create trigger postures_maj before update on public.postures for each row execute function public.touche_maj_le();
drop trigger if exists fiches_maj on public.fiches;
create trigger fiches_maj before update on public.fiches for each row execute function public.touche_maj_le();
drop trigger if exists seances_maj on public.seances;
create trigger seances_maj before update on public.seances for each row execute function public.touche_maj_le();

-- ---------------------------------------------------------------------------
-- 6. VOTRE COMPTE ADMIN — remplacez l'email puis lancez le script
-- ---------------------------------------------------------------------------
insert into public.admins (email) values (lower('VOTRE.EMAIL@exemple.fr'))
on conflict (email) do nothing;
