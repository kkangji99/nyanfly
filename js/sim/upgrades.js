// 업그레이드. 전부 시뮬 결과에 영향을 주므로 리플레이에 레벨을 함께 저장한다.

export const MAX_LEVEL = 8;

export const UPGRADES = [
	{ id: 'power', name: '대포 화력', base: 40, desc: '발사 속도가 빨라진다.' },
	{ id: 'aim', name: '조준 훈련', base: 55, desc: '게이지가 느려져 맞추기 쉬워진다.' },
	{ id: 'drag', name: '유선형 자세', base: 50, desc: '공기저항이 줄어 멀리 난다.' },
	{ id: 'bounce', name: '젤리 발바닥', base: 45, desc: '지면에서 더 높이 튄다.' },
	{ id: 'timing', name: '박자 감각', base: 60, desc: '타이밍 판정 창이 넓어진다.' },
	{ id: 'churu', name: '츄르 사랑', base: 35, desc: '츄르를 더 많이 얻는다.' }
];

export function emptyLevels() {
	const o = {};
	for (let i = 0; i < UPGRADES.length; i++) o[UPGRADES[i].id] = 0;
	return o;
}

export function costOf(up, level) {
	if (level >= MAX_LEVEL) return Infinity;
	return Math.round(up.base * Math.pow(1.55, level));
}

// 레벨을 실제 시뮬 상수로 바꾼다. 여기서만 숫자를 조율하면 게임 밸런스가 잡힌다.
export function deriveStats(levels) {
	const L = (id) => Math.min(MAX_LEVEL, Math.max(0, (levels && levels[id]) | 0));
	return {
		// 발사 초속(px/s). 사거리는 속도의 제곱에 비례하므로 성장 체감이 가장 크다.
		launchSpeed: 800 + L('power') * 200,
		// 게이지 반주기(프레임). 낮을수록 빠르다.
		aimPeriod: 54 + L('aim') * 7,
		powerPeriod: 40 + L('aim') * 6,
		// 공기저항 계수(1/s)
		drag: 0.45 - L('drag') * 0.045,
		// 지면 반발계수
		bounce: 0.34 + L('bounce') * 0.045,
		// 지면 마찰(접선 감쇠)과 구르기 마찰(1/s)
		slide: 0.30,
		rollFriction: 0.60 - L('bounce') * 0.045,
		// 타이밍 창(프레임, 접촉 기준 ±)
		timingWindow: 7 + L('timing') * 2,
		// 츄르 획득 배율
		churuRate: 1 + L('churu') * 0.28
	};
}
