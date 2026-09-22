// 결정론 시뮬레이션용 난수. Math.random()은 시뮬 안에서 절대 쓰지 않는다.
// 정수 연산(imul, xor, shift)만 쓰므로 플랫폼에 상관없이 같은 값이 나온다.

// 시드와 정수 인덱스로 상태 없는 해시값을 만든다. 지형·오브젝트를 배열 없이
// 즉석 계산하는 데 쓴다.
export function hash32(seed, i) {
	let h = (seed ^ Math.imul(i | 0, 0x27d4eb2d)) | 0;
	h ^= h >>> 15;
	h = Math.imul(h, 0x85ebca6b) | 0;
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35) | 0;
	h ^= h >>> 16;
	return h >>> 0;
}

// 0 이상 1 미만의 값.
export function hashUnit(seed, i) {
	return hash32(seed, i) / 4294967296;
}

// 순차 난수기. 한 판 안에서 순서대로 값이 필요할 때 쓴다.
export function createRng(seed) {
	let s = seed | 0;
	if (s === 0) s = 0x9e3779b9 | 0;
	return function next() {
		s ^= s << 13; s |= 0;
		s ^= s >>> 17;
		s ^= s << 5; s |= 0;
		return (s >>> 0) / 4294967296;
	};
}

// 사람이 읽고 공유할 수 있는 시드 문자열 -> 정수.
export function seedFromString(str) {
	let h = 0x811c9dc5 | 0;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = Math.imul(h, 0x01000193) | 0;
	}
	return h | 0;
}
