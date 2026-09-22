// 밸런스 점검 도구. node tools/balance.mjs 로 돌린다.
// 숙련 플레이어를 자동으로 흉내내 각도·레벨별 기록 분포를 뽑는다.
import {
	createSim, click, step, distanceM, aimAngleDeg,
	PHASE_AIM, PHASE_POWER, PHASE_FLY, PHASE_DONE, MAX_FRAMES
} from '../js/sim/sim.js';
import { emptyLevels, UPGRADES, MAX_LEVEL } from '../js/sim/upgrades.js';

export function levelsAt(n) {
	const l = emptyLevels();
	for (const u of UPGRADES) l[u.id] = Math.min(n, MAX_LEVEL);
	return l;
}

// 목표 각도 근처에서 조준을 확정하고, 파워는 최고점에서 누른다.
export function play(seed, levels, targetDeg, timing) {
	const s = createSim(seed, levels);
	while (s.phase !== PHASE_DONE && s.frame < MAX_FRAMES) {
		if (s.phase === PHASE_AIM) {
			if (Math.abs(aimAngleDeg(s.aimIndex) - targetDeg) < 1.2) click(s);
		} else if (s.phase === PHASE_POWER) {
			if (s.powerIndex >= 99) click(s);
		} else if (s.phase === PHASE_FLY && timing) {
			if (!s.windowUsed && s.frame <= s.windowEnd) click(s);
		}
		step(s);
	}
	return s;
}

const SEEDS = [1, 7, 42, 777, 31337, 98765, -991, 20260922];

if (import.meta.filename === process.argv[1]) {
	console.log('== 각도별 (시드 777, 무업, 타이밍 O) ==');
	for (const a of [20, 30, 35, 40, 45, 50, 60, 70]) {
		const s = play(777, emptyLevels(), a, true);
		console.log(`  ${String(a).padStart(2)}도: ${distanceM(s).toFixed(0).padStart(5)}m  ${(s.frame / 120).toFixed(1)}초  완벽 ${s.perfects} 최고콤보 ${s.bestCombo}`);
	}

	console.log('== 레벨별 (각도 40, 시드 8개 평균) ==');
	for (const n of [0, 2, 4, 6, 8]) {
		let t = 0, x = 0, sec = 0;
		for (const sd of SEEDS) {
			const a = play(sd, levelsAt(n), 40, true);
			const b = play(sd, levelsAt(n), 40, false);
			t += distanceM(a); x += distanceM(b); sec += a.frame / 120;
		}
		const k = SEEDS.length;
		console.log(`  레벨 ${n}: 타이밍 O ${(t / k).toFixed(0).padStart(5)}m / 타이밍 X ${(x / k).toFixed(0).padStart(5)}m  (평균 ${(sec / k).toFixed(1)}초)`);
	}
}
