// 결정론 시뮬레이션 코어.
//
// 이 폴더의 모듈은 다음을 절대 쓰지 않는다. 하나라도 어기면 리플레이와 기록 검증이
// 무의미해진다.
//   1. Math.random()                 -> rng.js의 해시·난수기만 사용
//   2. Date.now(), performance.now() -> 시간은 프레임 번호로만 표현
//   3. DOM, Canvas 접근
//   4. Math.sin/cos/tan/pow/exp      -> trig.js의 다항식 근사 사용
// Math.sqrt/floor/round/abs/min/max/imul은 IEEE가 결과를 규정하므로 허용한다.

import { detCos, detSin, DEG } from './trig.js';
import {
	CAT_R, OBJ_BIRD, OBJ_CLOUD, OBJ_NONE, OBJ_R, OBJ_RING, SLOT_W,
	slotKind, slotX, slotY, terrainHeightAt, terrainSlopeAt
} from './world.js';
import { deriveStats } from './upgrades.js';

// 시뮬 로직을 바꾸면 이 값을 올린다. 버전이 다른 리플레이는 재생하지 않는다.
export const SIM_VERSION = 1;

export const DT = 1 / 120;
export const G = 1000;
export const MAX_FRAMES = 120 * 180;

export const PHASE_AIM = 0;
export const PHASE_POWER = 1;
export const PHASE_FLY = 2;
export const PHASE_DONE = 3;

// 조준 각도는 정수 단계로 양자화한다. 클릭한 프레임이 각도를 정확히 결정한다.
const ANGLE_STEPS = 72;
const ANGLE_MIN = 8;
const ANGLE_MAX = 82;
const POWER_MIN = 0.45;

// 접촉 효과
const CLOUD_UP = 430;
const BIRD_UP = 250;
const BIRD_FWD = 150;
const RING_FWD = 210;
const BONUS_UP = 300;
const BONUS_FWD = 200;
// 보너스를 받을수록 효과가 줄어든다(냥이가 지친다). 기하급수라 총 획득량이
// 수렴하므로 완벽하게 눌러도 판이 무한히 이어지지 않는다.
const BONUS_DECAY = 0.975;

// 종료 판정
const STOP_SPEED = 25;
const STOP_FRAMES = 45;

// 렌더가 읽어가는 효과 기록. 매 프레임 객체를 만들지 않도록 고정 크기 풀을 돌려 쓴다.
const FX_CAP = 48;
export const FX_BOUNCE = 0;
export const FX_CLOUD = 1;
export const FX_BIRD = 2;
export const FX_RING = 3;

function createFxPool() {
	const pool = new Array(FX_CAP);
	for (let i = 0; i < FX_CAP; i++) {
		pool[i] = { type: 0, x: 0, y: 0, frame: 0, quality: 0, perfect: false };
	}
	return pool;
}

export function createSim(seed, levels) {
	return {
		seed: seed | 0,
		version: SIM_VERSION,
		stats: deriveStats(levels),
		frame: 0,
		phase: PHASE_AIM,

		// 냥이 상태 (y는 위가 양수, 지면 높이 기준)
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		grounded: false,
		stillFrames: 0,

		// 게이지
		aimIndex: 0,
		powerIndex: 0,
		lockedAngle: 0,
		lockedPower: 0,

		// 타이밍 창
		contactFrame: -1000,
		windowEnd: -1000,
		windowUsed: true,
		lastClickFrame: -1000,
		combo: 0,
		bonusDecay: 1,
		bestCombo: 0,
		perfects: 0,
		goods: 0,

		// 결과
		maxX: 0,
		peakY: 0,

		// 슬롯 소비 기록. 한 판에 한 번만 할당한다.
		consumed: new Uint8Array(4096),

		// 입력 기록. 이것만 있으면 판을 그대로 재현할 수 있다.
		inputs: [],

		// 렌더 전용 효과 기록
		fx: createFxPool(),
		fxHead: 0
	};
}

function pushFx(s, type, x, y, quality, perfect) {
	const f = s.fx[s.fxHead % FX_CAP];
	f.type = type;
	f.x = x;
	f.y = y;
	f.frame = s.frame;
	f.quality = quality;
	f.perfect = perfect;
	s.fxHead++;
}

// 삼각 파형 게이지. 프레임 번호만으로 값이 정해지므로 클릭 프레임이 곧 결과다.
function gaugeValue(frame, period) {
	const p = frame % (period * 2);
	return (p < period ? p : period * 2 - p) / period;
}

export function aimAngleDeg(index) {
	return ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * (index / (ANGLE_STEPS - 1));
}

function applyBonus(s, diff, type, hx, hy) {
	const w = s.stats.timingWindow;
	const quality = 1 - diff / (w + 1);
	const perfect = diff <= w * 0.3;
	s.windowUsed = true;
	s.combo++;
	if (s.combo > s.bestCombo) s.bestCombo = s.combo;
	if (perfect) s.perfects++; else s.goods++;

	// 콤보가 이어질수록 보너스가 커진다. 상한을 둬서 무한 가속을 막는다.
	const comboMul = (1 + Math.min(s.combo - 1, 10) * 0.06) * s.bonusDecay;
	s.bonusDecay *= BONUS_DECAY;
	if (s.vy < 0) s.vy = 0;
	s.vy += BONUS_UP * quality * comboMul;
	s.vx += BONUS_FWD * quality * comboMul;
	pushFx(s, type, hx, hy, quality, perfect);
}

// 접촉이 일어나면 기본 효과를 주고 보너스 창을 연다. 접촉 직전에 이미 눌러둔
// 클릭이 창 안이면 그 자리에서 소급 적용한다. 미리 눌러도 맞춰 눌러도 공정하다.
function openWindow(s, type, hx, hy) {
	const w = s.stats.timingWindow;
	s.contactFrame = s.frame;
	s.windowEnd = s.frame + w;
	s.windowUsed = false;
	if (s.frame - s.lastClickFrame <= w) {
		applyBonus(s, s.frame - s.lastClickFrame, type, hx, hy);
	} else {
		// 아직 창이 열려 있으므로 콤보를 여기서 끊지 않는다.
		// 창이 만료되면 step()이 끊는다.
		pushFx(s, type, hx, hy, 0, false);
	}
}

// 버튼 입력. 프레임 번호를 기록에 남기고 단계별로 다르게 동작한다.
export function click(s) {
	if (s.phase === PHASE_DONE) return;
	s.inputs.push(s.frame);

	if (s.phase === PHASE_AIM) {
		s.lockedAngle = aimAngleDeg(s.aimIndex);
		s.phase = PHASE_POWER;
		return;
	}
	if (s.phase === PHASE_POWER) {
		s.lockedPower = POWER_MIN + (1 - POWER_MIN) * (s.powerIndex / 100);
		const v = s.stats.launchSpeed * s.lockedPower;
		const a = s.lockedAngle * DEG;
		s.vx = v * detCos(a);
		s.vy = v * detSin(a);
		s.phase = PHASE_FLY;
		return;
	}

	// 비행 중: 열린 창 안이면 보너스.
	s.lastClickFrame = s.frame;
	if (!s.windowUsed && s.frame <= s.windowEnd) {
		applyBonus(s, s.frame - s.contactFrame, FX_BOUNCE, s.x, s.y);
	} else {
		s.combo = 0;
	}
}

// 공중 오브젝트 충돌. 주변 슬롯 세 칸만 본다.
function checkObjects(s) {
	const slot = Math.floor(s.x / SLOT_W);
	const hitR = OBJ_R + CAT_R;
	for (let k = slot - 1; k <= slot + 1; k++) {
		if (k < 0 || k >= s.consumed.length) continue;
		if (s.consumed[k]) continue;
		const kind = slotKind(s.seed, k);
		if (kind === OBJ_NONE) continue;
		const ox = slotX(s.seed, k);
		const oy = slotY(s.seed, k);
		const dx = s.x - ox;
		const dy = s.y - oy;
		if (dx * dx + dy * dy > hitR * hitR) continue;

		s.consumed[k] = 1;
		if (kind === OBJ_CLOUD) {
			if (s.vy < 0) s.vy = 0;
			s.vy += CLOUD_UP;
			openWindow(s, FX_CLOUD, ox, oy);
		} else if (kind === OBJ_BIRD) {
			if (s.vy < 0) s.vy = 0;
			s.vy += BIRD_UP;
			s.vx += BIRD_FWD;
			openWindow(s, FX_BIRD, ox, oy);
		} else {
			s.vx += RING_FWD;
			pushFx(s, FX_RING, ox, oy, 1, false);
		}
	}
}

function stepGround(s) {
	const gh = terrainHeightAt(s.seed, s.x);
	if (s.y > gh) {
		s.grounded = false;
		s.stillFrames = 0;
		return;
	}
	s.y = gh;

	const slope = terrainSlopeAt(s.seed, s.x);
	const inv = 1 / Math.sqrt(slope * slope + 1);
	const nx = -slope * inv;   // 법선
	const ny = inv;
	const tx = inv;            // 접선(진행 방향)
	const ty = slope * inv;

	const vn = s.vx * nx + s.vy * ny;
	let vt = s.vx * tx + s.vy * ty;

	if (vn < -60) {
		// 튕김: 법선 성분을 반사하고 접선에는 마찰을 건다.
		vt *= 1 - s.stats.slide * DT * 60;
		const vnOut = -vn * s.stats.bounce;
		s.vx = tx * vt + nx * vnOut;
		s.vy = ty * vt + ny * vnOut;
		s.grounded = false;
		openWindow(s, FX_BOUNCE, s.x, s.y);
	} else {
		// 구르기: 중력의 접선 성분이 더해지므로 내리막에서 자연히 가속한다.
		vt += -G * ty * DT;
		vt -= vt * s.stats.rollFriction * DT;
		s.vx = tx * vt;
		s.vy = ty * vt;
		s.grounded = true;
	}

	if (s.grounded && s.vx < STOP_SPEED) {
		s.stillFrames++;
	} else {
		s.stillFrames = 0;
	}
}

export function step(s) {
	if (s.phase === PHASE_DONE) return;
	s.frame++;

	if (s.phase === PHASE_AIM) {
		s.aimIndex = Math.floor(gaugeValue(s.frame, s.stats.aimPeriod) * (ANGLE_STEPS - 1));
		return;
	}
	if (s.phase === PHASE_POWER) {
		s.powerIndex = Math.floor(gaugeValue(s.frame, s.stats.powerPeriod) * 100);
		return;
	}

	// 비행
	s.vy -= G * DT;
	const d = s.stats.drag * DT;
	s.vx -= s.vx * d;
	s.vy -= s.vy * d;
	s.x += s.vx * DT;
	s.y += s.vy * DT;

	if (s.x > s.maxX) s.maxX = s.x;
	if (s.y > s.peakY) s.peakY = s.y;

	checkObjects(s);
	stepGround(s);

	// 창이 닫히면 다음 접촉까지 보너스를 잠근다.
	if (!s.windowUsed && s.frame > s.windowEnd) {
		s.windowUsed = true;
		s.combo = 0;
	}

	if (s.stillFrames >= STOP_FRAMES || s.frame >= MAX_FRAMES) {
		s.phase = PHASE_DONE;
	}
}

export function distanceM(s) {
	return s.maxX / 10;
}

export function churuEarned(s) {
	return Math.floor(distanceM(s) * s.stats.churuRate);
}

// 리플레이 재생. 저장된 입력만으로 판을 그대로 재현한다.
// 랭킹 검증과 유령 재생이 모두 이 함수 하나로 해결된다.
export function replay(seed, levels, inputs) {
	const s = createSim(seed, levels);
	let idx = 0;
	while (s.phase !== PHASE_DONE && s.frame < MAX_FRAMES) {
		while (idx < inputs.length && inputs[idx] === s.frame) {
			click(s);
			idx++;
		}
		step(s);
	}
	return s;
}
