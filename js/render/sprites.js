// 반복해서 그리는 그림은 오프스크린 캔버스에 한 번만 그려 두고 재사용한다.
// 여기서는 Math.random()을 써도 된다. 렌더는 시뮬 결과에 영향을 주지 않는다.

const cache = new Map();

// 지정한 크기의 오프스크린 캔버스를 만들고 draw로 한 번 그려 캐시한다.
function sprite(key, w, h, draw) {
	const hit = cache.get(key);
	if (hit) return hit;
	const c = document.createElement('canvas');
	c.width = Math.ceil(w);
	c.height = Math.ceil(h);
	const g = c.getContext('2d');
	draw(g, c.width, c.height);
	cache.set(key, c);
	return c;
}

export function catSprite() {
	return sprite('cat', 56, 56, (g, w, h) => {
		const cx = w / 2, cy = h / 2, r = 18;
		// 목도리
		g.fillStyle = '#e4572e';
		g.beginPath();
		g.ellipse(cx, cy + 13, 16, 7, 0, 0, Math.PI * 2);
		g.fill();
		// 귀
		g.fillStyle = '#f7c59f';
		g.beginPath();
		g.moveTo(cx - 15, cy - 10); g.lineTo(cx - 6, cy - 22); g.lineTo(cx - 2, cy - 9);
		g.moveTo(cx + 15, cy - 10); g.lineTo(cx + 6, cy - 22); g.lineTo(cx + 2, cy - 9);
		g.fill();
		// 머리
		g.fillStyle = '#ffe3b3';
		g.beginPath();
		g.arc(cx, cy, r, 0, Math.PI * 2);
		g.fill();
		// 얼룩
		g.fillStyle = '#f7c59f';
		g.beginPath();
		g.arc(cx + 8, cy - 7, 6, 0, Math.PI * 2);
		g.arc(cx - 9, cy + 4, 5, 0, Math.PI * 2);
		g.fill();
		// 눈과 코
		g.fillStyle = '#2b2118';
		g.beginPath();
		g.arc(cx - 6, cy - 2, 2.4, 0, Math.PI * 2);
		g.arc(cx + 6, cy - 2, 2.4, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#e4572e';
		g.beginPath();
		g.moveTo(cx, cy + 4); g.lineTo(cx - 3, cy + 7); g.lineTo(cx + 3, cy + 7);
		g.fill();
		// 수염
		g.strokeStyle = 'rgba(43,33,24,0.5)';
		g.lineWidth = 1;
		g.beginPath();
		g.moveTo(cx - 9, cy + 5); g.lineTo(cx - 17, cy + 3);
		g.moveTo(cx + 9, cy + 5); g.lineTo(cx + 17, cy + 3);
		g.stroke();
	});
}

export function cloudSprite() {
	return sprite('cloud', 120, 80, (g, w, h) => {
		g.fillStyle = 'rgba(255,255,255,0.95)';
		g.beginPath();
		g.arc(38, 48, 24, 0, Math.PI * 2);
		g.arc(64, 38, 30, 0, Math.PI * 2);
		g.arc(90, 50, 22, 0, Math.PI * 2);
		g.fill();
		// 트램펄린이라는 신호로 아래쪽에 테두리를 준다.
		g.strokeStyle = 'rgba(120,180,255,0.9)';
		g.lineWidth = 4;
		g.beginPath();
		g.moveTo(22, 62); g.quadraticCurveTo(64, 78, 106, 62);
		g.stroke();
	});
}

export function birdSprite() {
	return sprite('bird', 104, 72, (g, w, h) => {
		g.fillStyle = '#5a7d9a';
		g.beginPath();
		g.ellipse(52, 40, 26, 14, 0, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#8fb8d8';
		g.beginPath();
		g.moveTo(44, 34); g.lineTo(16, 10); g.lineTo(38, 40);
		g.moveTo(60, 34); g.lineTo(88, 10); g.lineTo(66, 40);
		g.fill();
		g.fillStyle = '#ffd166';
		g.beginPath();
		g.moveTo(76, 36); g.lineTo(92, 40); g.lineTo(76, 44);
		g.fill();
		g.fillStyle = '#2b2118';
		g.beginPath();
		g.arc(68, 35, 2.6, 0, Math.PI * 2);
		g.fill();
	});
}

export function ringSprite() {
	return sprite('ring', 104, 104, (g, w, h) => {
		const cx = 52, cy = 52;
		g.strokeStyle = '#ffd166';
		g.lineWidth = 9;
		g.beginPath();
		g.arc(cx, cy, 40, 0, Math.PI * 2);
		g.stroke();
		g.strokeStyle = 'rgba(255,255,255,0.7)';
		g.lineWidth = 3;
		g.beginPath();
		g.arc(cx, cy, 40, Math.PI * 1.1, Math.PI * 1.7);
		g.stroke();
	});
}

export function cannonSprite() {
	return sprite('cannon', 96, 72, (g, w, h) => {
		g.fillStyle = '#4a4e69';
		g.beginPath();
		g.moveTo(14, 66); g.lineTo(82, 66); g.lineTo(70, 44); g.lineTo(26, 44);
		g.fill();
		g.fillStyle = '#22223b';
		g.beginPath();
		g.arc(48, 46, 15, 0, Math.PI * 2);
		g.fill();
	});
}

// 배경 언덕은 한 번 그려 두고 가로로 반복해 붙인다.
export function hillSprite(key, w, h, color) {
	return sprite(key, w, h, (g) => {
		g.fillStyle = color;
		g.beginPath();
		g.moveTo(0, h);
		for (let x = 0; x <= w; x += 12) {
			const t = x / w * Math.PI * 2;
			g.lineTo(x, h - (0.45 + 0.3 * Math.sin(t) + 0.18 * Math.sin(t * 2.7 + 1.2)) * h);
		}
		g.lineTo(w, h);
		g.closePath();
		g.fill();
	});
}

export function clearSprites() {
	cache.clear();
}
