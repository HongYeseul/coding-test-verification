-- 알림이 오는 채널에 아직 들어오지 않은 멤버를 위해 초대 링크를 둡니다.
--
-- 웹훅 주소로는 초대 링크를 알 수 없습니다. 웹훅을 조회하면 guild_id와 channel_id는
-- 나오지만 초대 코드는 나오지 않고, 초대를 만들려면 그 서버에 우리 봇이 들어가 있어야
-- 합니다. 그래서 방장이 따로 붙여넣습니다.
--
-- 웹훅 주소와 정반대로 다룹니다. 초대 링크는 원래 남에게 주라고 있는 값이라 멤버가
-- 읽어도 됩니다. groups의 select 정책이 이미 활성 멤버만 허용하고, 공개 목록 함수들은
-- 내보낼 키를 하나씩 지정하므로 이 컬럼은 그리로 새지 않습니다.
begin;

alter table public.groups add column discord_invite_url text;

-- 검사를 여기 두는 것이 중요합니다. 방장은 브라우저에서 groups를 직접 고칠 수 있어서,
-- 앱에서만 걸러 두면 'javascript:'로 시작하는 주소를 멤버 화면의 링크로 심을 수 있습니다.
alter table public.groups add constraint groups_discord_invite_url_check check (
  discord_invite_url is null
  or discord_invite_url ~ '^https://(discord\.gg|discord\.com/invite|discordapp\.com/invite)/[A-Za-z0-9-]{2,64}$'
);

commit;
