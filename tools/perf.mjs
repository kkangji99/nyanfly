// 시뮬 비용 측정. node tools/perf.mjs
//
// 렌더는 캔버스가 필요하므로 여기서 못 잰다. 브라우저에서 P 키를 눌러 나오는
// 계측 표시로 확인한다(js/main.js).
//
// 시뮬은 120Hz 고정 타임스텝이므로, 60fps 화면에서는 한 프레임에 2회 돈다.
// 한 프레임 예산 16.7ms 안에서 시뮬이 차지하는 몫을 본다.

import { createSim, step, click, MAX_FRAMES, PHASE_DONE, previewPath } from '../js/sim/sim.js';
import { emptyLevels, UPGRADES, MAX_LEVEL } from '../js/sim/upgrades.js';
import { play, levelsAt } from './balance.mjs';

function maxed() {
	const l = emptyLevels();
	for (const u of UPGRADES) l[u.id] = MAX_LEVEL;
	return l;
}

// step() 한 번의 평균 비용. 오브젝트가 많은 비행 구간에서 잰다.
function measureStep() {
	const runs = 40;
	let frames = 0;
	const t0 = process.hrtime.bigint();
	for (let r = 0; r < runs; r++) {
		const s = createSim(1000 + r, maxed());
		click(s);                      // 각도 확정
		while (s.phase !== 2 && s.frame < 200) step(s);
		click(s);                      // 발사
		while (s.phase !== PHASE_DONE && s.frame < MAX_FRAMES) {
			step(s);
			frames++;
		}
	}
	const ns = Number(process.hrtime.bigint() - t0);
	return { perStepUs: ns / frames / 1000, frames };
}

// 조준 궤적 미리보기는 조준 단계에서 매 프레임 돈다. 실제로는 시뮬을 182스텝 굴린다.
function measurePreview() {
	const s = createSim(4242, maxed());
	const out = new Float32Array(26 * 2);
	const iters = 20000;
	const t0 = process.hrtime.bigint();
	for (let i = 0; i < iters; i++) previewPath(s, out, 26, 7);
	const ns = Number(process.hrtime.bigint() - t0);
	return ns / iters / 1000;
}

const st = measureStep();
const pv = measurePreview();
const budget = 1000 / 60;

console.log('== 시뮬 비용 ==');
console.log(`  step() 1회        : ${st.perStepUs.toFixed(3)} us  (표본 ${st.frames.toLocaleString()} 프레임)`);
console.log(`  60fps 한 프레임분 : ${(st.perStepUs * 2 / 1000).toFixed(4)} ms  (120Hz 시뮬이므로 2회)`);
console.log(`  프레임 예산 대비  : ${(st.perStepUs * 2 / 1000 / budget * 100).toFixed(2)} %`);
console.log(`  궤적 미리보기 1회 : ${pv.toFixed(3)} us  (조준 단계에서만, 예산의 ${(pv / 1000 / budget * 100).toFixed(2)} %)`);

// 한 판을 끝까지 돌리는 데 걸리는 실제 시간. 서버 검증 비용의 상한이 된다.
const t0 = process.hrtime.bigint();
const s = play(31337, levelsAt(MAX_LEVEL), 40, true);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log('== 기록 검증 비용 ==');
console.log(`  풀업 한 판 재현   : ${ms.toFixed(2)} ms  (${(s.frame / 120).toFixed(1)}초 분량, ${Math.round(s.maxX / 10)}m)`);
console.log('  서버에서 이 비용으로 제출 기록을 다시 돌려 거리를 검증할 수 있다.');
