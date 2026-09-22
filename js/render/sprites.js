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

// 외곽선을 먼저 굵게 그려 두면 캐릭터가 배경에서 확실히 떠오른다.
function outlined(g, path, fill, line) {
	g.strokeStyle = line || 'rgba(58,42,30,0.9)';
	g.lineWidth = 3;
	g.lineJoin = 'round';
	g.stroke(path);
	g.fillStyle = fill;
	g.fill(path);
}

export function catSprite() {
	return sprite('cat', 76, 68, (g, w, h) => {
		const cx = w / 2;
		const cy = h / 2 + 2;

		// 꼬리
		const tail = new Path2D();
		tail.moveTo(cx - 14, cy + 6);
		tail.quadraticCurveTo(cx - 34, cy + 2, cx - 30, cy - 16);
		g.strokeStyle = 'rgba(58,42,30,0.9)';
		g.lineWidth = 12;
		g.lineCap = 'round';
		g.stroke(tail);
		g.strokeStyle = '#f0b884';
		g.lineWidth = 7;
		g.stroke(tail);

		// 뒷발
		const paw = new Path2D();
		paw.ellipse(cx - 9, cy + 15, 8, 6, -0.2, 0, Math.PI * 2);
		paw.ellipse(cx + 9, cy + 15, 8, 6, 0.2, 0, Math.PI * 2);
		outlined(g, paw, '#ffe3b3');

		// 목도리
		const scarf = new Path2D();
		scarf.ellipse(cx, cy + 11, 17, 7, 0, 0, Math.PI * 2);
		outlined(g, scarf, '#e4572e');
		// 목도리 끝단이 뒤로 날린다
		const flap = new Path2D();
		flap.moveTo(cx - 12, cy + 10);
		flap.quadraticCurveTo(cx - 26, cy + 14, cx - 30, cy + 24);
		flap.quadraticCurveTo(cx - 20, cy + 18, cx - 10, cy + 16);
		outlined(g, flap, '#cf4926');

		// 귀
		const ears = new Path2D();
		ears.moveTo(cx - 17, cy - 8);
		ears.lineTo(cx - 8, cy - 25);
		ears.lineTo(cx - 1, cy - 8);
		ears.closePath();
		ears.moveTo(cx + 17, cy - 8);
		ears.lineTo(cx + 8, cy - 25);
		ears.lineTo(cx + 1, cy - 8);
		ears.closePath();
		outlined(g, ears, '#f0b884');

		// 귀 안쪽
		g.fillStyle = '#f19e9e';
		g.beginPath();
		g.moveTo(cx - 13, cy - 10);
		g.lineTo(cx - 8, cy - 20);
		g.lineTo(cx - 4, cy - 10);
		g.moveTo(cx + 13, cy - 10);
		g.lineTo(cx + 8, cy - 20);
		g.lineTo(cx + 4, cy - 10);
		g.fill();

		// 머리. 아래로 갈수록 살짝 어두워지게 해서 덩어리감을 준다.
		const head = new Path2D();
		head.arc(cx, cy, 19, 0, Math.PI * 2);
		const grad = g.createLinearGradient(0, cy - 19, 0, cy + 19);
		grad.addColorStop(0, '#fff0d2');
		grad.addColorStop(1, '#f5cf9b');
		outlined(g, head, grad);

		// 얼룩
		g.save();
		g.clip(head);
		g.fillStyle = 'rgba(240,184,132,0.85)';
		g.beginPath();
		g.arc(cx + 11, cy - 9, 8, 0, Math.PI * 2);
		g.arc(cx - 12, cy + 6, 6, 0, Math.PI * 2);
		g.fill();
		g.restore();

		// 눈. 위쪽에 흰 점을 넣으면 살아 있는 느낌이 난다.
		g.fillStyle = '#2b2118';
		g.beginPath();
		g.ellipse(cx - 7, cy - 2, 2.8, 3.4, 0, 0, Math.PI * 2);
		g.ellipse(cx + 7, cy - 2, 2.8, 3.4, 0, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#fff';
		g.beginPath();
		g.arc(cx - 6, cy - 3.4, 1.1, 0, Math.PI * 2);
		g.arc(cx + 8, cy - 3.4, 1.1, 0, Math.PI * 2);
		g.fill();

		// 볼
		g.fillStyle = 'rgba(241,158,158,0.55)';
		g.beginPath();
		g.arc(cx - 12, cy + 3, 3.6, 0, Math.PI * 2);
		g.arc(cx + 12, cy + 3, 3.6, 0, Math.PI * 2);
		g.fill();

		// 코와 입
		g.fillStyle = '#e4572e';
		g.beginPath();
		g.moveTo(cx, cy + 3);
		g.lineTo(cx - 3, cy + 6);
		g.lineTo(cx + 3, cy + 6);
		g.fill();
		g.strokeStyle = 'rgba(43,33,24,0.7)';
		g.lineWidth = 1.4;
		g.beginPath();
		g.moveTo(cx, cy + 6);
		g.quadraticCurveTo(cx - 3, cy + 9, cx - 5, cy + 7);
		g.moveTo(cx, cy + 6);
		g.quadraticCurveTo(cx + 3, cy + 9, cx + 5, cy + 7);
		g.stroke();

		// 수염
		g.strokeStyle = 'rgba(43,33,24,0.45)';
		g.lineWidth = 1.2;
		g.beginPath();
		g.moveTo(cx - 10, cy + 4); g.lineTo(cx - 20, cy + 1);
		g.moveTo(cx - 10, cy + 6); g.lineTo(cx - 19, cy + 7);
		g.moveTo(cx + 10, cy + 4); g.lineTo(cx + 20, cy + 1);
		g.moveTo(cx + 10, cy + 6); g.lineTo(cx + 19, cy + 7);
		g.stroke();
	});
}

export function cloudSprite() {
	return sprite('cloud', 136, 92, (g, w, h) => {
		// 구름 덩어리
		const body = new Path2D();
		body.arc(42, 52, 26, 0, Math.PI * 2);
		body.arc(70, 40, 32, 0, Math.PI * 2);
		body.arc(99, 54, 24, 0, Math.PI * 2);
		g.fillStyle = '#ffffff';
		g.fill(body);
		// 아래쪽 그늘
		g.save();
		g.clip(body);
		const grad = g.createLinearGradient(0, 20, 0, 80);
		grad.addColorStop(0, 'rgba(255,255,255,0)');
		grad.addColorStop(1, 'rgba(150,190,230,0.55)');
		g.fillStyle = grad;
		g.fillRect(0, 0, w, h);
		g.restore();

		// 트램펄린 면. 여기를 밟는다는 신호다.
		g.strokeStyle = '#4f9bdd';
		g.lineWidth = 5;
		g.lineCap = 'round';
		g.beginPath();
		g.moveTo(22, 68);
		g.quadraticCurveTo(70, 88, 116, 68);
		g.stroke();
		g.strokeStyle = 'rgba(255,255,255,0.85)';
		g.lineWidth = 2;
		g.beginPath();
		g.moveTo(24, 65);
		g.quadraticCurveTo(70, 84, 114, 65);
		g.stroke();
	});
}

export function birdSprite() {
	return sprite('bird', 116, 84, (g, w, h) => {
		const cx = 58, cy = 46;

		// 날개(뒤)
		const wingBack = new Path2D();
		wingBack.moveTo(cx - 4, cy - 4);
		wingBack.quadraticCurveTo(cx - 34, cy - 30, cx - 44, cy - 10);
		wingBack.quadraticCurveTo(cx - 28, cy - 4, cx - 6, cy + 4);
		outlined(g, wingBack, '#6f9fc4');

		// 몸통
		const body = new Path2D();
		body.ellipse(cx, cy, 27, 17, -0.1, 0, Math.PI * 2);
		const grad = g.createLinearGradient(0, cy - 17, 0, cy + 17);
		grad.addColorStop(0, '#8fc0e2');
		grad.addColorStop(1, '#5d87a8');
		outlined(g, body, grad);

		// 꼬리
		const tail = new Path2D();
		tail.moveTo(cx - 24, cy - 2);
		tail.lineTo(cx - 44, cy + 10);
		tail.lineTo(cx - 24, cy + 9);
		tail.closePath();
		outlined(g, tail, '#6f9fc4');

		// 부리
		const beak = new Path2D();
		beak.moveTo(cx + 22, cy - 3);
		beak.lineTo(cx + 40, cy + 2);
		beak.lineTo(cx + 22, cy + 7);
		beak.closePath();
		outlined(g, beak, '#ffc75a');

		// 날개(앞) — 위로 들어올린 모양이라 날고 있는 게 보인다
		const wingFront = new Path2D();
		wingFront.moveTo(cx + 2, cy - 6);
		wingFront.quadraticCurveTo(cx - 14, cy - 36, cx + 14, cy - 30);
		wingFront.quadraticCurveTo(cx + 20, cy - 16, cx + 12, cy - 2);
		outlined(g, wingFront, '#a8d2ee');

		// 눈
		g.fillStyle = '#2b2118';
		g.beginPath();
		g.arc(cx + 13, cy - 4, 3, 0, Math.PI * 2);
		g.fill();
		g.fillStyle = '#fff';
		g.beginPath();
		g.arc(cx + 14, cy - 5, 1.1, 0, Math.PI * 2);
		g.fill();
	});
}

export function ringSprite() {
	return sprite('ring', 120, 120, (g, w, h) => {
		const cx = 60, cy = 60, r = 44;
		// 바깥 빛
		const glow = g.createRadialGradient(cx, cy, r - 12, cx, cy, r + 12);
		glow.addColorStop(0, 'rgba(255,209,102,0)');
		glow.addColorStop(0.5, 'rgba(255,209,102,0.45)');
		glow.addColorStop(1, 'rgba(255,209,102,0)');
		g.fillStyle = glow;
		g.fillRect(0, 0, w, h);

		g.strokeStyle = 'rgba(58,42,30,0.55)';
		g.lineWidth = 13;
		g.beginPath();
		g.arc(cx, cy, r, 0, Math.PI * 2);
		g.stroke();
		g.strokeStyle = '#ffce5a';
		g.lineWidth = 9;
		g.beginPath();
		g.arc(cx, cy, r, 0, Math.PI * 2);
		g.stroke();
		// 하이라이트
		g.strokeStyle = 'rgba(255,255,255,0.85)';
		g.lineWidth = 3;
		g.beginPath();
		g.arc(cx, cy, r, Math.PI * 1.08, Math.PI * 1.62);
		g.stroke();
	});
}

// 대포 받침. 포신은 따로 그려서 조준 각도로 회전시킨다.
export function cannonBaseSprite() {
	return sprite('cannonBase', 104, 64, (g, w, h) => {
		const body = new Path2D();
		body.moveTo(12, 58);
		body.lineTo(92, 58);
		body.lineTo(78, 26);
		body.lineTo(26, 26);
		body.closePath();
		const grad = g.createLinearGradient(0, 26, 0, 58);
		grad.addColorStop(0, '#5c6184');
		grad.addColorStop(1, '#343a5c');
		outlined(g, body, grad);

		// 바퀴
		const wheel = new Path2D();
		wheel.arc(32, 54, 11, 0, Math.PI * 2);
		wheel.arc(72, 54, 11, 0, Math.PI * 2);
		outlined(g, wheel, '#8a6b4a');
		g.fillStyle = '#5c4630';
		g.beginPath();
		g.arc(32, 54, 4, 0, Math.PI * 2);
		g.arc(72, 54, 4, 0, Math.PI * 2);
		g.fill();
	});
}

// 포신. 원점을 왼쪽 가운데(회전축)에 두고 오른쪽으로 뻗는다.
export function cannonBarrelSprite() {
	return sprite('cannonBarrel', 92, 44, (g, w, h) => {
		const cy = h / 2;
		const body = new Path2D();
		body.moveTo(6, cy - 13);
		body.lineTo(72, cy - 16);
		body.lineTo(72, cy + 16);
		body.lineTo(6, cy + 13);
		body.closePath();
		const grad = g.createLinearGradient(0, cy - 16, 0, cy + 16);
		grad.addColorStop(0, '#6b7196');
		grad.addColorStop(1, '#2f3452');
		outlined(g, body, grad);

		// 포구
		const mouth = new Path2D();
		mouth.ellipse(74, cy, 6, 17, 0, 0, Math.PI * 2);
		outlined(g, mouth, '#1c2038');

		// 회전축 뭉치
		const hub = new Path2D();
		hub.arc(10, cy, 15, 0, Math.PI * 2);
		outlined(g, hub, '#4a4e69');
	});
}

// 배경 언덕. 한 번 그려 두고 가로로 반복해 붙인다.
export function hillSprite(key, w, h, color) {
	return sprite(key, w, h, (g) => {
		g.fillStyle = color;
		g.beginPath();
		g.moveTo(0, h);
		for (let x = 0; x <= w; x += 10) {
			const t = x / w * Math.PI * 2;
			g.lineTo(x, h - (0.45 + 0.3 * Math.sin(t) + 0.18 * Math.sin(t * 2.7 + 1.2)) * h);
		}
		g.lineTo(w, h);
		g.closePath();
		g.fill();
	});
}

// 배경에 흩뿌릴 나무. 앞쪽 언덕 위에 얹으면 깊이가 생긴다.
export function treeSprite() {
	return sprite('tree', 56, 82, (g, w, h) => {
		g.strokeStyle = '#6b5136';
		g.lineWidth = 7;
		g.lineCap = 'round';
		g.beginPath();
		g.moveTo(28, 78);
		g.lineTo(28, 46);
		g.stroke();
		const crown = new Path2D();
		crown.arc(28, 34, 19, 0, Math.PI * 2);
		crown.arc(15, 44, 13, 0, Math.PI * 2);
		crown.arc(41, 44, 13, 0, Math.PI * 2);
		g.fillStyle = '#5f9e63';
		g.fill(crown);
		g.save();
		g.clip(crown);
		g.fillStyle = 'rgba(255,255,255,0.18)';
		g.fillRect(0, 0, w, 40);
		g.restore();
	});
}

// 지면에 세우는 풀 다발.
export function grassSprite() {
	return sprite('grass', 26, 20, (g) => {
		g.strokeStyle = '#4f8c48';
		g.lineWidth = 2.4;
		g.lineCap = 'round';
		g.beginPath();
		g.moveTo(13, 19); g.quadraticCurveTo(6, 12, 3, 3);
		g.moveTo(13, 19); g.lineTo(13, 2);
		g.moveTo(13, 19); g.quadraticCurveTo(20, 12, 23, 4);
		g.stroke();
	});
}

// 100m마다 세우는 거리 표지. 속도감과 진행감을 같이 준다.
export function postSprite() {
	return sprite('post', 18, 56, (g) => {
		g.fillStyle = 'rgba(58,42,30,0.75)';
		g.fillRect(7, 8, 4, 48);
		g.fillStyle = '#fff6e6';
		g.fillRect(2, 6, 14, 4);
	});
}

// 최고 기록 지점에 꽂는 깃발.
export function flagSprite() {
	return sprite('flag', 44, 74, (g) => {
		g.strokeStyle = 'rgba(58,42,30,0.85)';
		g.lineWidth = 4;
		g.lineCap = 'round';
		g.beginPath();
		g.moveTo(9, 72);
		g.lineTo(9, 6);
		g.stroke();
		const cloth = new Path2D();
		cloth.moveTo(11, 8);
		cloth.lineTo(40, 17);
		cloth.lineTo(11, 30);
		cloth.closePath();
		outlined(g, cloth, '#ffd166');
	});
}

export function clearSprites() {
	cache.clear();
}
