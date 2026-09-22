// 지형과 공중 오브젝트. 전부 시드와 인덱스로 즉석 계산하므로 배열을 들고 있지 않고,
// 코스 길이에도 제한이 없다. 화면 밖은 계산조차 하지 않는다.

import { hash32, hashUnit } from './rng.js';

export const NODE_W = 110;   // 지형 노드 간격(px)
export const SLOT_W = 520;   // 공중 오브젝트 슬롯 폭(px)
export const FLAT_X = 900;   // 발사 직후 평지 구간 길이(px)

export const OBJ_NONE = 0;
export const OBJ_CLOUD = 1;
export const OBJ_BIRD = 2;
export const OBJ_RING = 3;

export const OBJ_R = 46;     // 오브젝트 충돌 반지름(px)
export const CAT_R = 18;     // 냥이 충돌 반지름(px)

// 노드 하나의 높이. 큰 기복과 잔 기복을 겹쳐 둔다.
function nodeH(seed, i) {
	const a = hashUnit(seed, i) * 240;
	const b = hashUnit(seed ^ 0x5bf03635, i * 3 + 1) * 80;
	return a + b;
}

// 노드 사이는 smoothstep으로 보간한다. 기울기가 연속이라 착지가 튀지 않는다.
// 발사 지점 근처는 평지로 만들어 첫 발사가 항상 같은 조건에서 시작하게 한다.
function flatten(x) {
	if (x >= FLAT_X) return 1;
	if (x <= 0) return 0;
	const t = x / FLAT_X;
	return t * t;
}

export function terrainHeightAt(seed, x) {
	const fi = x / NODE_W;
	const i = Math.floor(fi);
	const t = fi - i;
	const h0 = nodeH(seed, i);
	const h1 = nodeH(seed, i + 1);
	const s = t * t * (3 - 2 * t);
	return (h0 + (h1 - h0) * s) * flatten(x);
}

// 위 높이 함수의 해석적 미분. 수치 미분을 쓰면 계단이 생겨 반사 방향이 흔들린다.
export function terrainSlopeAt(seed, x) {
	const fi = x / NODE_W;
	const i = Math.floor(fi);
	const t = fi - i;
	const h0 = nodeH(seed, i);
	const h1 = nodeH(seed, i + 1);
	const s = t * t * (3 - 2 * t);
	const ds = 6 * t * (1 - t) / NODE_W;
	const f = flatten(x);
	const df = x >= FLAT_X || x <= 0 ? 0 : 2 * x / (FLAT_X * FLAT_X);
	return (h1 - h0) * ds * f + (h0 + (h1 - h0) * s) * df;
}

// 슬롯에 놓인 오브젝트의 종류. 발사 직후 두 칸은 비워 둔다.
export function slotKind(seed, slot) {
	if (slot < 2) return OBJ_NONE;
	const r = hash32(seed, slot * 7 + 13) % 100;
	if (r < 42) return OBJ_CLOUD;
	if (r < 70) return OBJ_BIRD;
	if (r < 86) return OBJ_RING;
	return OBJ_NONE;
}

export function slotX(seed, slot) {
	return slot * SLOT_W + (0.2 + hashUnit(seed, slot * 11 + 5) * 0.6) * SLOT_W;
}

// 지면에서 띄운 높이. 링은 조금 더 높게 둬서 상승 구간에서 만나게 한다.
export function slotY(seed, slot) {
	const kind = slotKind(seed, slot);
	const x = slotX(seed, slot);
	const base = kind === OBJ_RING ? 300 : 170;
	return terrainHeightAt(seed, x) + base + hashUnit(seed, slot * 17 + 3) * 520;
}
