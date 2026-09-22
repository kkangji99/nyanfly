// 랭킹. 설정이 없으면 로컬 저장소로만 동작하고, 설정이 있으면 Supabase에 올린다.
//
// 기록은 거리만 보내지 않고 재현에 필요한 {seed, levels, inputs}를 함께 보낸다.
// 서버는 거리를 믿지 않고 replay()로 다시 돌려 검증할 수 있다.

import { SUPABASE_KEY, SUPABASE_URL, isConfigured } from './config.js';
import { SIM_VERSION } from '../sim/sim.js';

const LOCAL_KEY = 'nyanfly.scores.v1';
const TOP_N = 10;

function readLocal() {
	try {
		const raw = localStorage.getItem(LOCAL_KEY);
		if (!raw) return [];
		const rows = JSON.parse(raw);
		return Array.isArray(rows) ? rows : [];
	} catch (e) {
		return [];
	}
}

function writeLocal(rows) {
	try {
		localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 50)));
	} catch (e) {
		// 저장 공간이 없으면 랭킹만 포기한다. 게임 진행에는 영향이 없다.
	}
}

// 닉네임은 길이만 제한한다. 화면에 넣을 때는 반드시 textContent로 출력한다.
function cleanName(name) {
	const n = (name || '').trim();
	if (n.length === 0) return '익명냥';
	return n.slice(0, 12);
}

export function localTop() {
	return readLocal()
		.filter((r) => r.simVersion === SIM_VERSION)
		.sort((a, b) => b.distance - a.distance)
		.slice(0, TOP_N);
}

export async function submit(record) {
	const row = {
		nickname: cleanName(record.nickname),
		distance: Math.floor(record.distance),
		seed: record.seed | 0,
		simVersion: SIM_VERSION,
		levels: record.levels,
		inputs: record.inputs,
		perfects: record.perfects | 0,
		bestCombo: record.bestCombo | 0,
		at: Date.now()
	};

	const rows = readLocal();
	rows.push(row);
	writeLocal(rows.sort((a, b) => b.distance - a.distance));

	if (!isConfigured()) return { mode: 'local', rows: localTop() };

	try {
		const res = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: SUPABASE_KEY,
				Authorization: `Bearer ${SUPABASE_KEY}`,
				Prefer: 'return=minimal'
			},
			body: JSON.stringify({
				nickname: row.nickname,
				distance: row.distance,
				seed: row.seed,
				sim_version: row.simVersion,
				levels: row.levels,
				inputs: row.inputs
			})
		});
		if (!res.ok) throw new Error(`등록 실패 ${res.status}`);
		return { mode: 'remote', rows: await fetchTop() };
	} catch (e) {
		// 네트워크가 죽어도 게임은 계속 돌아야 한다. 로컬 랭킹으로 떨어진다.
		return { mode: 'local', rows: localTop(), error: String(e.message || e) };
	}
}

export async function fetchTop() {
	if (!isConfigured()) return localTop();
	try {
		const url = `${SUPABASE_URL}/rest/v1/scores`
			+ `?select=nickname,distance,seed&sim_version=eq.${SIM_VERSION}`
			+ `&order=distance.desc&limit=${TOP_N}`;
		const res = await fetch(url, {
			headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
		});
		if (!res.ok) throw new Error(`조회 실패 ${res.status}`);
		return await res.json();
	} catch (e) {
		return localTop();
	}
}
