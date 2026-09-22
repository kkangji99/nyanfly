// 시뮬 코어 테스트. node --test tests/ 로 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createSim, click, step, replay, distanceM, PHASE_DONE, PHASE_FLY, MAX_FRAMES } from '../js/sim/sim.js';
import { emptyLevels, deriveStats, MAX_LEVEL, UPGRADES } from '../js/sim/upgrades.js';
import { terrainHeightAt, terrainSlopeAt, NODE_W } from '../js/sim/world.js';
import { hash32 } from '../js/sim/rng.js';
import { play } from '../tools/balance.mjs';

function maxedLevels() {
	const l = emptyLevels();
	for (const u of UPGRADES) l[u.id] = MAX_LEVEL;
	return l;
}

// 정해진 프레임에 클릭하는 대본대로 한 판을 끝까지 돌린다.
function runScript(seed, levels, frames) {
	const s = createSim(seed, levels);
	const set = new Set(frames);
	while (s.phase !== PHASE_DONE && s.frame < MAX_FRAMES) {
		if (set.has(s.frame)) click(s);
		step(s);
	}
	return s;
}

// 접촉할 때마다 바로 눌러 보너스를 노리는 자동 플레이어.
function runAuto(seed, levels, aimFrame, powerFrame) {
	const s = createSim(seed, levels);
	click(s); // 각도 확정은 첫 프레임에
	let guard = 0;
	while (s.phase !== PHASE_DONE && s.frame < MAX_FRAMES && guard++ < MAX_FRAMES + 10) {
		if (s.phase === PHASE_FLY && !s.windowUsed && s.frame <= s.windowEnd) click(s);
		step(s);
		if (s.frame === powerFrame) click(s);
	}
	return s;
}

test('같은 시드와 같은 입력은 항상 같은 결과를 낸다', () => {
	const frames = [7, 33, 90, 140, 190, 240, 300, 380, 460];
	const a = runScript(12345, emptyLevels(), frames);
	const b = runScript(12345, emptyLevels(), frames);
	assert.equal(a.frame, b.frame);
	assert.equal(a.maxX, b.maxX);
	assert.equal(a.vx, b.vx);
	assert.equal(a.bestCombo, b.bestCombo);
});

test('replay()가 실제 플레이와 완전히 일치한다', () => {
	const live = runAuto(98765, emptyLevels(), 1, 25);
	const again = replay(live.seed, emptyLevels(), live.inputs);
	assert.equal(again.maxX, live.maxX, '거리가 다르면 서버 검증이 불가능하다');
	assert.equal(again.frame, live.frame);
	assert.equal(again.perfects, live.perfects);
	assert.equal(again.bestCombo, live.bestCombo);
});

test('다른 시드는 다른 코스를 만든다', () => {
	const a = runScript(1, emptyLevels(), [5, 30]);
	const b = runScript(2, emptyLevels(), [5, 30]);
	assert.notEqual(a.maxX, b.maxX);
});

test('한 판은 반드시 끝난다', () => {
	for (const seed of [1, 7, 4242, -991, 0x7fffffff]) {
		const s = runAuto(seed, maxedLevels(), 1, 25);
		assert.equal(s.phase, PHASE_DONE, `시드 ${seed}에서 종료되지 않았다`);
		assert.ok(s.frame < MAX_FRAMES, `시드 ${seed}가 프레임 상한까지 갔다`);
	}
});

test('지형 기울기는 높이 함수의 실제 미분과 일치한다', () => {
	const seed = 555;
	const h = 0.01;
	for (let x = 950; x < 950 + NODE_W * 6; x += 13.7) {
		const num = (terrainHeightAt(seed, x + h) - terrainHeightAt(seed, x - h)) / (2 * h);
		const ana = terrainSlopeAt(seed, x);
		assert.ok(Math.abs(num - ana) < 1e-3, `x=${x}: 수치 ${num} vs 해석 ${ana}`);
	}
});

test('해시는 인덱스마다 골고루 퍼진다', () => {
	const buckets = new Array(10).fill(0);
	for (let i = 0; i < 10000; i++) buckets[hash32(42, i) % 10]++;
	for (const b of buckets) assert.ok(b > 800 && b < 1200, `편중: ${buckets}`);
});

test('업그레이드는 기록을 크게 늘린다', () => {
	// 조준 조건을 고정해야 공정하다. 고정 프레임에 누르면 게이지 주기가 달라 파워가 제각각이다.
	let base = 0, full = 0;
	for (const seed of [1, 7, 42, 777]) {
		base += distanceM(play(seed, emptyLevels(), 40, true));
		full += distanceM(play(seed, maxedLevels(), 40, true));
	}
	assert.ok(full > base * 3,
		`풀업 ${(full / 4).toFixed(0)}m 가 무업 ${(base / 4).toFixed(0)}m 대비 3배에 못 미친다`);
});

test('타이밍 실력이 업그레이드만큼 기록을 좌우한다', () => {
	// 같은 장비에서 접촉마다 누르는 플레이어와 발사만 하고 손 놓는 플레이어를 비교한다.
	let sharp = 0, lazy = 0;
	for (const seed of [1, 7, 42, 777]) {
		sharp += distanceM(play(seed, emptyLevels(), 40, true));
		lazy += distanceM(play(seed, emptyLevels(), 40, false));
	}
	assert.ok(sharp > lazy * 3,
		`타이밍 ${(sharp / 4).toFixed(0)}m vs 방치 ${(lazy / 4).toFixed(0)}m — 실력 보상이 부족하다`);
});

test('완벽 타이밍을 이어가면 콤보가 쌓인다', () => {
	const s = play(777, emptyLevels(), 35, true);
	assert.ok(s.bestCombo >= 5, `최고 콤보가 ${s.bestCombo}에 그쳤다 — 콤보 체인이 끊기고 있다`);
});

test('보너스 감쇠가 있어 완벽하게 눌러도 판이 수렴한다', () => {
	for (const seed of [1, 7, 42, 777, 31337]) {
		const s = play(seed, maxedLevels(), 40, true);
		assert.equal(s.phase, PHASE_DONE);
		assert.ok(s.frame < MAX_FRAMES, `시드 ${seed}가 프레임 상한까지 갔다`);
	}
});

test('업그레이드 비용은 레벨마다 오르고 최대 레벨에서 막힌다', async () => {
	const { costOf } = await import('../js/sim/upgrades.js');
	const up = UPGRADES[0];
	assert.ok(costOf(up, 1) > costOf(up, 0));
	assert.equal(costOf(up, MAX_LEVEL), Infinity);
});

test('공기저항과 타이밍 창은 레벨이 올라도 뒤집히지 않는다', () => {
	for (let l = 0; l <= MAX_LEVEL; l++) {
		const lv = emptyLevels();
		lv.drag = l; lv.timing = l; lv.bounce = l; lv.aim = l;
		const st = deriveStats(lv);
		assert.ok(st.drag > 0, `레벨 ${l}에서 공기저항이 0 이하가 된다`);
		assert.ok(st.rollFriction > 0, `레벨 ${l}에서 구르기 마찰이 0 이하가 된다`);
		assert.ok(st.timingWindow > 0);
		assert.ok(st.aimPeriod > 0);
	}
});
