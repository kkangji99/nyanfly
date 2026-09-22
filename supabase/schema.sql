-- nyanfly 랭킹 스키마 (Supabase / PostgreSQL)
--
-- 클라이언트가 보내는 거리는 믿지 않는다. 기록에는 재현에 필요한
-- seed / levels / inputs 가 함께 들어오므로, 서버에서 replay()를 돌려
-- 거리를 다시 계산해 검증할 수 있다. 아래 제약은 그 전에 걸러낼 수 있는
-- 말이 안 되는 값을 막는 1차 방어선이다.

create table if not exists public.scores (
	id           bigint generated always as identity primary key,
	created_at   timestamptz not null default now(),
	nickname     text        not null,
	distance     integer     not null,
	seed         integer     not null,
	sim_version  integer     not null,
	levels       jsonb       not null,
	inputs       jsonb       not null,
	verified     boolean     not null default false,

	-- 값의 범위 검사
	constraint nickname_len   check (char_length(nickname) between 1 and 12),
	constraint distance_range check (distance between 0 and 2000000),
	constraint inputs_size    check (jsonb_array_length(inputs) between 2 and 4000)
);

-- 랭킹 조회는 버전별 상위 거리순이다.
create index if not exists scores_rank_idx
	on public.scores (sim_version, distance desc);

-- 연속 등록 제한: 같은 닉네임이 10초 안에 다시 올리지 못하게 한다.
create or replace function public.scores_rate_limit()
returns trigger
language plpgsql
as $$
begin
	if exists (
		select 1 from public.scores
		where nickname = new.nickname
		  and created_at > now() - interval '10 seconds'
	) then
		raise exception '너무 빠른 연속 등록입니다';
	end if;
	return new;
end;
$$;

drop trigger if exists scores_rate_limit_trg on public.scores;
create trigger scores_rate_limit_trg
	before insert on public.scores
	for each row execute function public.scores_rate_limit();

-- 행 단위 보안: 조회와 등록만 허용하고 수정·삭제는 막는다.
alter table public.scores enable row level security;

drop policy if exists scores_select on public.scores;
create policy scores_select on public.scores
	for select using (true);

drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores
	for insert with check (true);

-- update / delete 정책은 만들지 않는다. RLS가 켜져 있으면 정책이 없는 동작은 거부된다.
