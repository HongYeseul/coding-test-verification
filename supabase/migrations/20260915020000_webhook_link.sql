-- 알림에서 그룹 화면으로 바로 갈 수 있게 합니다.
--
-- 들어오는 웹훅은 버튼(components)을 보내지 못합니다. 버튼은 애플리케이션이 소유한
-- 웹훅에서만 되는데 우리에겐 봇이 없습니다. 대신 임베드는 제목이 링크가 되므로,
-- 문장 자체를 누르면 열리게 했습니다. 따로 '바로가기' 줄을 덧붙이는 것보다
-- 한 줄로 끝나고 손가락으로 누를 자리도 넓습니다.
--
-- 임베드 제목은 마크다운을 그리지 않습니다. 이름에 감싸 두던 **는 빼야 글자 그대로
-- 찍히지 않습니다. 제목은 디스코드가 알아서 굵게 그립니다.
begin;

/** 알림에 적을 주소입니다. 도메인이 바뀌면 여기 한 곳만 고칩니다. */
create or replace function private.site_url()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'https://coding-test-verification.vercel.app';
$$;

-- 인자가 늘어 예전 것을 남겨 두면 호출이 어느 쪽인지 모호해집니다.
drop function private.post_group_webhook(uuid, text);

create or replace function private.post_group_webhook(
  target_group_id uuid,
  title text,
  note text default null,
  color integer default 1921169 -- --brand의 라이트 값 #1d5091
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  group_name text;
  group_slug text;
  embed jsonb;
begin
  select webhook.url, study_group.name, study_group.slug
  into webhook_url, group_name, group_slug
  from public.group_webhooks webhook
  join public.groups study_group on study_group.id = webhook.group_id
  where webhook.group_id = target_group_id;
  if webhook_url is null then
    return;
  end if;

  embed := jsonb_build_object(
    'title', left(title, 240),
    'url', private.site_url() || '/groups/' || group_slug,
    'color', color
  );
  if note is not null and btrim(note) <> '' then
    embed := embed || jsonb_build_object('description', left(note, 1900));
  end if;

  begin
    perform net.http_post(
      url := webhook_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'username', left('도장 · ' || group_name, 80),
        'allowed_mentions', jsonb_build_object('parse', jsonb_build_array()),
        'embeds', jsonb_build_array(embed)
      )
    );
  exception when others then
    -- 알림이 실패했다고 도장이 사라지면 안 됩니다.
    null;
  end;
end;
$$;

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
      message := format('%s님이 퇴근했습니다. %s', actor,
        private.duration_text(new.record_minutes));
    else
      select record_kind into kind from public.groups where id = new.group_id;
      if new.start_minutes is not null then
        message := format('%s님이 %s에 착석했습니다.', actor,
          private.clock_text(new.start_minutes));
      elsif new.record_minutes is not null and kind = 'CLOCK' then
        message := format('%s님이 %s에 도장을 찍었습니다.', actor,
          private.clock_text(new.record_minutes));
      else
        message := format('%s님이 도장을 찍었습니다.', actor);
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
    perform private.post_group_webhook(proof.group_id,
      format('%s님이 %s님에게 응원을 보냈습니다.', actor, target));
    return null;
  end if;

  select display_name into actor from public.profiles where id = new.reviewer_id;
  message := format('%s님이 %s님의 기록을 %s했습니다.', actor, target,
    case when new.decision = 'APPROVED' then '승인' else '반려' end);
  -- 반려 이유는 그대로 인용합니다. 줄바꿈은 인용이 끊기지 않게 한 줄로 폅니다.
  perform private.post_group_webhook(
    proof.group_id,
    message,
    case
      when new.note is null or btrim(new.note) = '' then null
      else '> ' || regexp_replace(btrim(new.note), '\s+', ' ', 'g')
    end,
    -- 반려만 색을 달리 둡니다. 채널이 바쁠 때 눈에 걸려야 하는 줄입니다.
    case when new.decision = 'APPROVED' then 1921169 else 11221553 end
  );
  return null;
end;
$$;

commit;
