-- 그룹에서 무슨 일이 있었는지 디스코드로 보냅니다.
--
-- 우리가 디스코드 서버를 소유하고 채널을 만들어 주는 방향은 접었습니다. 봇이 남을
-- 서버에 집어넣을 수 없고, GitHub으로 로그인한 사람의 디스코드 계정도 알 수 없으며,
-- 서버 하나에 역할 250개·채널 500개라는 천장이 있습니다. 대신 이미 쓰고 있는
-- 디스코드 서버의 웹훅 주소를 방장이 붙여넣게 합니다.
--
-- 웹훅 주소는 비밀번호나 같습니다. 그 주소를 아는 사람은 누구나 그 채널에 글을 쓸 수
-- 있습니다. 그래서 주소는 이 표 밖으로 나가지 않습니다 — 앱은 주소를 읽지 않고,
-- 보내는 일도 데이터베이스가 직접 합니다.
begin;

create extension if not exists pg_net;

create table public.group_webhooks (
  group_id uuid primary key references public.groups(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS를 켜고 정책을 하나도 두지 않습니다. 이러면 아무도 읽지 못합니다.
-- 아래 security definer 함수들만 이 표에 닿습니다.
alter table public.group_webhooks enable row level security;
revoke all on table public.group_webhooks from anon, authenticated;

/**
 * 웹훅 주소를 넣거나 지웁니다. 방장만 할 수 있습니다.
 *
 * 주소를 디스코드로 못박는 것이 중요합니다. pg_net은 어디로든 요청을 보낼 수 있어서,
 * 아무 주소나 받으면 우리 데이터베이스가 남의 내부망을 두드리는 도구가 됩니다.
 */
create or replace function public.set_group_webhook(
  target_group_id uuid,
  webhook_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed text := nullif(btrim(coalesce(webhook_url, '')), '');
begin
  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = (select auth.uid())
      and role = 'OWNER'
      and status = 'ACTIVE'
  ) then
    raise exception '그룹 소유자만 알림을 설정할 수 있습니다.' using errcode = '42501';
  end if;

  if trimmed is null then
    delete from public.group_webhooks where group_id = target_group_id;
    return;
  end if;

  if trimmed !~ '^https://(discord\.com|discordapp\.com)/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' then
    raise exception '디스코드 웹훅 주소가 아닙니다.';
  end if;

  insert into public.group_webhooks(group_id, url)
  values (target_group_id, trimmed)
  on conflict (group_id)
  do update set url = excluded.url, updated_at = now();
end;
$$;

revoke all on function public.set_group_webhook(uuid, text) from public, anon, authenticated;
grant execute on function public.set_group_webhook(uuid, text) to authenticated;

/** 설정돼 있는지만 알려줍니다. 주소 자체는 돌려주지 않습니다. */
create or replace function public.has_group_webhook(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_webhooks webhook
    where webhook.group_id = target_group_id
      and exists (
        select 1 from public.group_members
        where group_id = target_group_id
          and user_id = (select auth.uid())
          and role = 'OWNER'
          and status = 'ACTIVE'
      )
  );
$$;

revoke all on function public.has_group_webhook(uuid) from public, anon, authenticated;
grant execute on function public.has_group_webhook(uuid) to authenticated;

/** 자정부터 흐른 분을 시:분으로 적습니다. */
create or replace function private.clock_text(minutes integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char((minutes / 60) % 24, 'FM00') || ':' || to_char(minutes % 60, 'FM00');
$$;

/** 머문 분을 '4시간 20분'으로 적습니다. 화면과 같은 말을 씁니다. */
create or replace function private.duration_text(minutes integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when minutes / 60 = 0 then (minutes % 60) || '분'
    when minutes % 60 = 0 then (minutes / 60) || '시간'
    else (minutes / 60) || '시간 ' || (minutes % 60) || '분'
  end;
$$;

/**
 * 한 줄을 디스코드로 보냅니다.
 *
 * allowed_mentions를 비워 두는 것이 중요합니다. 닉네임은 사용자가 정하는 값이라
 * '@everyone'으로 바꿔 두면 서버 전체에 알림이 울립니다. 파싱을 꺼서 멘션이
 * 글자 그대로만 보이게 합니다.
 *
 * 보내다 실패해도 도장 찍기는 그대로 끝나야 합니다. 그래서 통째로 감싸 두었습니다.
 */
create or replace function private.post_group_webhook(
  target_group_id uuid,
  message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  group_name text;
begin
  select webhook.url, study_group.name
  into webhook_url, group_name
  from public.group_webhooks webhook
  join public.groups study_group on study_group.id = webhook.group_id
  where webhook.group_id = target_group_id;
  if webhook_url is null then
    return;
  end if;

  begin
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'username', left('도장 · ' || group_name, 80),
        'content', left(message, 1900),
        'allowed_mentions', jsonb_build_object('parse', jsonb_build_array())
      )
    );
  exception when others then
    -- 알림이 실패했다고 도장이 사라지면 안 됩니다.
    null;
  end;
end;
$$;

/**
 * 도장·퇴근·응원·검수가 일어나면 문장을 만들어 보냅니다.
 *
 * 문장을 여기서 만드는 이유는, 그래야 멤버가 임의의 글을 그룹 채널에 밀어 넣을 수
 * 없기 때문입니다. 앱에서 글자를 받아 보내는 함수를 열어 두면 누구든 남의 이름을
 * 사칭한 줄을 만들 수 있습니다.
 */
create or replace function private.notify_group_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor text;
  target text;
  proof public.proofs%rowtype;
  kind text;
  message text;
begin
  if tg_table_name = 'proofs' then
    if new.verification_status = 'CANCELING' then
      return null;
    end if;
    select display_name into actor from public.profiles where id = new.user_id;
    if tg_op = 'UPDATE' then
      message := format('**%s**님이 퇴근했습니다. %s', actor,
        private.duration_text(new.record_minutes));
    else
      select record_kind into kind from public.groups where id = new.group_id;
      if new.start_minutes is not null then
        message := format('**%s**님이 %s에 착석했습니다.', actor,
          private.clock_text(new.start_minutes));
      elsif new.record_minutes is not null and kind = 'CLOCK' then
        message := format('**%s**님이 %s에 도장을 찍었습니다.', actor,
          private.clock_text(new.record_minutes));
      else
        message := format('**%s**님이 도장을 찍었습니다.', actor);
      end if;
    end if;
    perform private.post_group_webhook(new.group_id, message);
    return null;
  end if;

  select * into proof from public.proofs where id = new.proof_id;
  if not found then
    return null;
  end if;
  select display_name into target from public.profiles where id = proof.user_id;

  if tg_table_name = 'proof_cheers' then
    select display_name into actor from public.profiles where id = new.user_id;
    message := format('**%s**님이 **%s**님에게 응원을 보냈습니다.', actor, target);
  else
    select display_name into actor from public.profiles where id = new.reviewer_id;
    message := format('**%s**님이 **%s**님의 기록을 %s했습니다.', actor, target,
      case when new.decision = 'APPROVED' then '승인' else '반려' end);
    -- 반려 이유는 그대로 인용합니다. 줄바꿈은 인용이 끊기지 않게 한 줄로 폅니다.
    if new.note is not null and btrim(new.note) <> '' then
      message := message || E'\n> ' || regexp_replace(btrim(new.note), '\s+', ' ', 'g');
    end if;
  end if;
  perform private.post_group_webhook(proof.group_id, message);
  return null;
end;
$$;

create trigger notify_webhook_on_proof
after insert on public.proofs
for each row execute function private.notify_group_webhook();

-- 퇴근은 finished_at이 채워지는 순간 한 번만 알립니다.
create trigger notify_webhook_on_finish
after update on public.proofs
for each row
when (old.finished_at is null and new.finished_at is not null)
execute function private.notify_group_webhook();

create trigger notify_webhook_on_cheer
after insert on public.proof_cheers
for each row execute function private.notify_group_webhook();

create trigger notify_webhook_on_review
after insert on public.proof_reviews
for each row execute function private.notify_group_webhook();

commit;
