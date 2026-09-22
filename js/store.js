// 진행도 저장. 남에게 영향을 주지 않는 값이므로 암호화하지 않는다.
// 랭킹에 올라가는 기록은 입력 기록으로 재현·검증되므로 이 파일을 고쳐도 순위는 못 속인다.

import { UPGRADES, MAX_LEVEL, emptyLevels } from './sim/upgrades.js';

const KEY = 'nyanfly.progress.v1';

export function load() {
	const base = { churu: 0, levels: emptyLevels(), best: 0, runs: 0, nickname: '' };
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return base;
		const got = JSON.parse(raw);
		base.churu = Math.max(0, got.churu | 0);
		base.best = Math.max(0, got.best | 0);
		base.runs = Math.max(0, got.runs | 0);
		base.nickname = typeof got.nickname === 'string' ? got.nickname.slice(0, 12) : '';
		// 저장된 레벨을 그대로 믿지 않고 알려진 항목·범위로만 받아들인다.
		for (const u of UPGRADES) {
			const v = got.levels ? got.levels[u.id] | 0 : 0;
			base.levels[u.id] = Math.min(MAX_LEVEL, Math.max(0, v));
		}
		return base;
	} catch (e) {
		return base;
	}
}

export function save(p) {
	try {
		localStorage.setItem(KEY, JSON.stringify({
			churu: p.churu,
			levels: p.levels,
			best: p.best,
			runs: p.runs,
			nickname: p.nickname
		}));
	} catch (e) {
		// 저장 실패는 조용히 넘긴다. 이번 판은 계속 할 수 있다.
	}
}

export function reset() {
	try {
		localStorage.removeItem(KEY);
	} catch (e) {
		// 무시
	}
}
