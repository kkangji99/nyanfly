// 시뮬 안에서 쓰는 삼각함수.
//
// Math.sin/cos는 IEEE 754가 정확도를 규정하지 않아 브라우저·CPU마다 마지막 비트가
// 다를 수 있다. 결정론이 깨지면 리플레이와 기록 검증이 전부 무의미해지므로, 여기서는
// 사칙연산만 쓰는 다항식 근사로 직접 계산한다. 사칙연산은 IEEE가 결과를 한 값으로
// 규정하므로 어디서 돌려도 같다.

const HALF_PI = 1.5707963267948966;
export const PI = 3.141592653589793;
export const DEG = PI / 180;

// |x| <= PI/4 구간의 테일러 급수. 이 범위에서 오차는 배정도 한계 수준이다.
function kernelSin(x) {
	const x2 = x * x;
	return x * (1 - x2 * (1 / 6 - x2 * (1 / 120 - x2 * (1 / 5040 - x2 * (1 / 362880 - x2 / 39916800)))));
}

function kernelCos(x) {
	const x2 = x * x;
	return 1 - x2 * (1 / 2 - x2 * (1 / 24 - x2 * (1 / 720 - x2 * (1 / 40320 - x2 / 3628800))));
}

// x를 PI/2 단위로 줄인 뒤 사분면에 맞춰 커널을 고른다.
// HALF_PI 자체가 근사값이라 미세한 오차가 있지만, 그 오차도 모든 환경에서 동일하다.
export function detSin(x) {
	const n = Math.round(x / HALF_PI);
	const r = x - n * HALF_PI;
	switch (n & 3) {
		case 0: return kernelSin(r);
		case 1: return kernelCos(r);
		case 2: return -kernelSin(r);
		default: return -kernelCos(r);
	}
}

export function detCos(x) {
	const n = Math.round(x / HALF_PI);
	const r = x - n * HALF_PI;
	switch (n & 3) {
		case 0: return kernelCos(r);
		case 1: return -kernelSin(r);
		case 2: return -kernelCos(r);
		default: return kernelSin(r);
	}
}
