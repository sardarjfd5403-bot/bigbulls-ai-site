create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_role text not null check (author_role in ('client','admin')),
  body text not null check (length(trim(body)) between 2 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages(ticket_id, created_at);
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_ticket_messages from anon;
grant select, insert on public.support_ticket_messages to authenticated;
drop policy if exists "ticket participants read messages" on public.support_ticket_messages;
create policy "ticket participants read messages"
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = (select auth.uid()) or public.is_bigbulls_admin())
  )
);
drop policy if exists "clients and admins send ticket messages" on public.support_ticket_messages;
create policy "clients and admins send ticket messages"
on public.support_ticket_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    (author_role = 'admin' and public.is_bigbulls_admin())
    or
    (author_role = 'client' and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = (select auth.uid()) and t.status <> 'closed'
    ))
  )
);
