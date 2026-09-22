// Supabase 설정. 브라우저에 노출되는 publishable(anon) 키만 넣는다.
// secret / service_role 키는 어떤 경우에도 이 저장소에 두지 않는다.
//
// 비워 두면 게임은 로컬 랭킹으로만 동작한다. 실제 연동은 이 두 값을 채우고
// supabase/schema.sql 을 적용하면 된다.
export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';

export function isConfigured() {
	return SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
}
