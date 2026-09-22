// 그리기 전용 계층. 시뮬 상태는 읽기만 한다.
// 입자·화면 흔들림·히트스톱은 여기에만 존재하므로 결정론에 영향을 주지 않는다.

import {
	NODE_W, OBJ_CLOUD, OBJ_BIRD, OBJ_NONE, SLOT_W,
	slotKind, slotX, slotY, terrainHeightAt
} from '../sim/world.js';
import {
	FX_BIRD, FX_CLOUD, FX_RING,
	PHASE_AIM, PHASE_FLY, PHASE_POWER, aimAngleDeg
} from '../sim/sim.js';
import {
	birdSprite, cannonSprite, catSprite, cloudSprite, hillSprite, ringSprite
} from './sprites.js';
import {
	sfxBird, sfxBounce, sfxCloud, sfxGood, sfxLand, sfxLaunch, sfxPerfect, sfxRing
} from '../audio/sfx.js';

const DPR_CAP = 2;          // 캔버스 픽셀 수 상한
const PARTICLE_CAP = 220;   // 입자 상한
const FLOAT_CAP = 24;       // 떠오르는 글자 상한
const TRAIL_N = 32;         // 궤적 점 개수

// 손맛을 만드는 값들. 물리가 아니라 체감을 담당한다.
// 히트스톱은 main.js가 읽어 시뮬을 아주 짧게 멈추는 데 쓴다. 시뮬의 프레임 번호는
// 그대로이므로 리플레이와 결정론에는 영향이 없다.
const HITSTOP_PERFECT = 0.085;
const HITSTOP_HIT = 0.035;
const PUNCH_PERFECT = 0.16;
const PUNCH_HIT = 0.07;
const SPEED_LINE_FROM = 900;   // 이 속도(px/s)부터 속도선을 그린다

export function createView(canvas) {
	const view = {
		canvas,
		g: canvas.getContext('2d'),
		w: 0,
		h: 0,
		camX: 0,
		camY: 0,
		scale: 1,   // 카메라 추적용
		zoom: 1,    // 실제로 그릴 때 쓰는 배율(펀치가 얹힌다)
		shake: 0,
		hitstop: 0,
		punch: 0,
		squash: 0,
		prevPhase: -1,
		// 풀을 미리 만들어 두고 돌려 쓴다. 매 프레임 새 객체를 만들지 않는다.
		parts: new Array(PARTICLE_CAP),
		partHead: 0,
		floats: new Array(FLOAT_CAP),
		floatHead: 0,
		fxSeen: 0,
		trail: new Float32Array(TRAIL_N * 2),
		trailHead: 0
	};
	for (let i = 0; i < PARTICLE_CAP; i++) {
		view.parts[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 3, color: '#fff' };
	}
	for (let i = 0; i < FLOAT_CAP; i++) {
		view.floats[i] = { x: 0, y: 0, life: 0, text: '', color: '#fff' };
	}
	resize(view);
	return view;
}

export function resize(view) {
	const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
	const w = view.canvas.clientWidth;
	const h = view.canvas.clientHeight;
	view.canvas.width = Math.round(w * dpr);
	view.canvas.height = Math.round(h * dpr);
	view.g.setTransform(dpr, 0, 0, dpr, 0, 0);
	view.w = w;
	view.h = h;
}

function spawnParticle(view, x, y, vx, vy, life, r, color) {
	const p = view.parts[view.partHead % PARTICLE_CAP];
	view.partHead++;
	p.x = x; p.y = y; p.vx = vx; p.vy = vy;
	p.life = life; p.max = life; p.r = r; p.color = color;
}

function spawnFloat(view, x, y, text, color) {
	const f = view.floats[view.floatHead % FLOAT_CAP];
	view.floatHead++;
	f.x = x; f.y = y; f.life = 0.9; f.text = text; f.color = color;
}

function burst(view, x, y, n, spread, life, color) {
	for (let k = 0; k < n; k++) {
		const a = Math.random() * Math.PI * 2;
		const sp = 60 + Math.random() * spread;
		spawnParticle(view, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
			life * (0.7 + Math.random() * 0.6), 2 + Math.random() * 3, color);
	}
}

// 흙먼지. 위쪽 반구로만 뿌려 땅에서 튄 것처럼 보이게 한다.
function dust(view, x, y, n, spread) {
	for (let k = 0; k < n; k++) {
		const a = (Math.random() * 0.8 - 0.05) * Math.PI;
		const sp = 100 + Math.random() * spread;
		spawnParticle(view, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
			0.4 + Math.random() * 0.5, 2 + Math.random() * 4, '#d8c39a');
	}
}

// 단계가 바뀌는 순간에만 일어나는 연출: 발사 반동과 착지.
function watchPhase(view, s) {
	if (view.prevPhase === s.phase) return;
	const from = view.prevPhase;
	view.prevPhase = s.phase;

	if (s.phase === PHASE_FLY && from === PHASE_POWER) {
		sfxLaunch();
		view.shake = 16;
		view.punch = 0.22;
		view.squash = 1;
		dust(view, 20, terrainHeightAt(s.seed, 0) + 30, 26, 420);
	} else if (s.phase !== PHASE_FLY && from === PHASE_FLY) {
		sfxLand();
		view.shake = 10;
		dust(view, s.x, s.y, 18, 220);
	}
}

// 시뮬이 남긴 효과 기록을 읽어 입자와 소리로 바꾼다. 아직 읽지 않은 것만 처리한다.
function consumeFx(view, s) {
	const cap = s.fx.length;
	let from = s.fxHead - cap;
	if (from < view.fxSeen) from = view.fxSeen;
	for (let i = from; i < s.fxHead; i++) {
		const f = s.fx[i % cap];
		let color = '#ffd9a0';
		if (f.type === FX_CLOUD) color = '#bfe3ff';
		else if (f.type === FX_BIRD) color = '#cfe6f5';
		else if (f.type === FX_RING) color = '#ffd166';

		burst(view, f.x, f.y, f.type === FX_RING ? 10 : (f.perfect ? 22 : 12),
			f.perfect ? 320 : 160, 0.5, color);

		// 접촉 종류에 따라 소리를 낸다. 콤보가 쌓이면 음이 올라가 리듬이 들린다.
		if (f.type === FX_RING) sfxRing();
		else if (f.type === FX_CLOUD) sfxCloud();
		else if (f.type === FX_BIRD) sfxBird();
		else sfxBounce(s.combo);

		if (f.quality > 0) {
			spawnFloat(view, f.x, f.y + 40, f.perfect ? '완벽!' : '좋음',
				f.perfect ? '#ffd166' : '#bfe3ff');
			view.shake = Math.min(18, view.shake + (f.perfect ? 12 : 5));
			// 맞은 순간 화면을 짧게 멈추고 카메라를 당긴다. 이게 때린 느낌을 만든다.
			view.hitstop = Math.max(view.hitstop, f.perfect ? HITSTOP_PERFECT : HITSTOP_HIT);
			view.punch = Math.max(view.punch, f.perfect ? PUNCH_PERFECT : PUNCH_HIT);
			view.squash = 1;
			if (f.perfect) sfxPerfect(s.combo); else sfxGood();

			// 완벽하면 사방으로 고르게 퍼지는 링을 한 겹 더 뿌린다.
			if (f.perfect) {
				for (let k = 0; k < 16; k++) {
					const a = (k / 16) * Math.PI * 2;
					spawnParticle(view, f.x, f.y, Math.cos(a) * 420, Math.sin(a) * 420,
						0.3, 3, '#fff3c4');
				}
			}
		}
	}
	view.fxSeen = s.fxHead;
}

export function updateView(view, s, dt) {
	watchPhase(view, s);
	consumeFx(view, s);

	for (let i = 0; i < PARTICLE_CAP; i++) {
		const p = view.parts[i];
		if (p.life <= 0) continue;
		p.life -= dt;
		p.vy -= 900 * dt;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
	}
	for (let i = 0; i < FLOAT_CAP; i++) {
		const f = view.floats[i];
		if (f.life <= 0) continue;
		f.life -= dt;
		f.y += 70 * dt;
	}
	if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 46);
	if (view.punch > 0) view.punch = Math.max(0, view.punch - dt * 0.9);
	if (view.squash > 0) view.squash = Math.max(0, view.squash - dt * 5);
	if (view.hitstop > 0) view.hitstop = Math.max(0, view.hitstop - dt);

	if (s.phase === PHASE_FLY) {
		const i = (view.trailHead % TRAIL_N) * 2;
		view.trail[i] = s.x;
		view.trail[i + 1] = s.y;
		view.trailHead++;
	}

	// 카메라: 냥이를 따라가되 빠를수록 넓게 본다.
	const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
	const want = s.phase === PHASE_FLY
		? Math.max(0.42, Math.min(1, 620 / (260 + speed * 0.42)))
		: 1;
	view.scale += (want - view.scale) * Math.min(1, dt * 3);

	const lead = s.phase === PHASE_FLY ? Math.min(360, s.vx * 0.22) : 40;
	const gh = terrainHeightAt(s.seed, s.x);
	const targetX = s.x + lead;
	const targetY = Math.max(gh + 60, s.y + 40);
	const k = Math.min(1, dt * 6);
	view.camX += (targetX - view.camX) * k;
	view.camY += (targetY - view.camY) * k;

	// 실제로 그릴 때 쓰는 배율. 카메라 펀치가 여기에 얹힌다.
	view.zoom = view.scale * (1 + view.punch);
}

export function resetView(view) {
	view.camX = 0;
	view.camY = 0;
	view.scale = 1;
	view.zoom = 1;
	view.shake = 0;
	view.hitstop = 0;
	view.punch = 0;
	view.squash = 0;
	view.prevPhase = -1;
	view.fxSeen = 0;
	view.trailHead = 0;
	view.trail.fill(0);
	for (let i = 0; i < PARTICLE_CAP; i++) view.parts[i].life = 0;
	for (let i = 0; i < FLOAT_CAP; i++) view.floats[i].life = 0;
}

// 월드 좌표 -> 화면 좌표. 월드는 y가 위로 양수이므로 부호를 뒤집는다.
function sx(view, wx) {
	return (wx - view.camX) * view.zoom + view.w * 0.42;
}
function sy(view, wy) {
	return view.h * 0.66 - (wy - view.camY) * view.zoom;
}

function drawSky(view) {
	const g = view.g;
	const grad = g.createLinearGradient(0, 0, 0, view.h);
	grad.addColorStop(0, '#7fb7e8');
	grad.addColorStop(0.55, '#bfe0f5');
	grad.addColorStop(1, '#f2e6cf');
	g.fillStyle = grad;
	g.fillRect(0, 0, view.w, view.h);

	g.fillStyle = 'rgba(255,238,190,0.85)';
	g.beginPath();
	g.arc(view.w * 0.82, view.h * 0.16, 44, 0, Math.PI * 2);
	g.fill();
}

// 배경 언덕. 캐시한 그림을 가로로 반복해 붙이므로 그리기 비용이 거의 없다.
const HILL_LAYERS = [
	{ key: 'hillFar', w: 640, h: 190, color: '#9ec7d8', factor: 0.12, y: 0.62 },
	{ key: 'hillNear', w: 520, h: 150, color: '#7fae9a', factor: 0.28, y: 0.70 }
];

function drawParallax(view) {
	const g = view.g;
	for (let i = 0; i < HILL_LAYERS.length; i++) {
		const L = HILL_LAYERS[i];
		const img = hillSprite(L.key, L.w, L.h, L.color);
		const off = -((view.camX * L.factor) % L.w);
		const top = view.h * L.y;
		for (let x = off - L.w; x < view.w + L.w; x += L.w) {
			g.drawImage(img, x, top, L.w, L.h);
		}
		g.fillStyle = L.color;
		g.fillRect(0, top + L.h - 1, view.w, view.h - top - L.h + 2);
	}
}

// 지형. 화면에 보이는 구간만 계산한다.
function drawTerrain(view, s) {
	const g = view.g;
	const left = view.camX - (view.w * 0.42) / view.zoom - NODE_W;
	const right = left + view.w / view.zoom + NODE_W * 2;
	const step = 6 / view.zoom;

	g.beginPath();
	g.moveTo(sx(view, left), view.h + 2);
	for (let wx = left; wx <= right; wx += step) {
		g.lineTo(sx(view, wx), sy(view, terrainHeightAt(s.seed, wx)));
	}
	g.lineTo(sx(view, right), view.h + 2);
	g.closePath();
	g.fillStyle = '#8a6b4a';
	g.fill();

	// 잔디 선
	g.beginPath();
	let first = true;
	for (let wx = left; wx <= right; wx += step) {
		const px = sx(view, wx);
		const py = sy(view, terrainHeightAt(s.seed, wx));
		if (first) { g.moveTo(px, py); first = false; } else { g.lineTo(px, py); }
	}
	g.strokeStyle = '#7fb069';
	g.lineWidth = Math.max(3, 9 * view.zoom);
	g.stroke();
}

// 공중 오브젝트. 보이는 슬롯만 훑는다.
function drawObjects(view, s) {
	const g = view.g;
	const left = view.camX - (view.w * 0.42) / view.zoom;
	const right = left + view.w / view.zoom;
	const from = Math.floor(left / SLOT_W) - 1;
	const to = Math.floor(right / SLOT_W) + 1;
	for (let k = from; k <= to; k++) {
		if (k < 0 || k >= s.consumed.length) continue;
		const kind = slotKind(s.seed, k);
		if (kind === OBJ_NONE) continue;
		let img = ringSprite();
		if (kind === OBJ_CLOUD) img = cloudSprite();
		else if (kind === OBJ_BIRD) img = birdSprite();
		const px = sx(view, slotX(s.seed, k));
		const py = sy(view, slotY(s.seed, k));
		const w = img.width * view.zoom;
		const h = img.height * view.zoom;
		g.globalAlpha = s.consumed[k] === 1 ? 0.22 : 1;
		g.drawImage(img, px - w / 2, py - h / 2, w, h);
	}
	g.globalAlpha = 1;
}

function drawTrail(view) {
	const g = view.g;
	const n = Math.min(TRAIL_N, view.trailHead);
	if (n < 2) return;
	g.strokeStyle = 'rgba(255,255,255,0.45)';
	g.lineWidth = Math.max(2, 3 * view.zoom);
	g.beginPath();
	for (let i = 0; i < n; i++) {
		const idx = ((view.trailHead - n + i) % TRAIL_N) * 2;
		const px = sx(view, view.trail[idx]);
		const py = sy(view, view.trail[idx + 1]);
		if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
	}
	g.stroke();
}

// 빠를 때 뒤로 흐르는 속도선. 속도감은 숫자보다 이걸로 전달된다.
function drawSpeedLines(view, s) {
	const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
	if (speed < SPEED_LINE_FROM) return;
	const g = view.g;
	const t = Math.min(1, (speed - SPEED_LINE_FROM) / 2200);
	g.strokeStyle = `rgba(255,255,255,${0.1 + t * 0.3})`;
	g.lineWidth = 2;
	g.beginPath();
	for (let i = 0; i < 9; i++) {
		// 화면 고정 위치에 그린다. 카메라가 아니라 속도를 표현하는 장식이다.
		const y = (i * 97 + ((view.camX * 0.7) % 97)) % view.h;
		const len = 60 + t * 220;
		const x = (i * 211 + ((view.camX * 1.6) % 211)) % (view.w + len) - len;
		g.moveTo(x, y);
		g.lineTo(x + len, y);
	}
	g.stroke();
}

function drawParticles(view) {
	const g = view.g;
	for (let i = 0; i < PARTICLE_CAP; i++) {
		const p = view.parts[i];
		if (p.life <= 0) continue;
		const px = sx(view, p.x);
		const py = sy(view, p.y);
		// 화면 밖은 그리지 않는다.
		if (px < -20 || px > view.w + 20 || py < -20 || py > view.h + 20) continue;
		g.globalAlpha = Math.max(0, p.life / p.max);
		g.fillStyle = p.color;
		g.beginPath();
		g.arc(px, py, p.r * view.zoom, 0, Math.PI * 2);
		g.fill();
	}
	g.globalAlpha = 1;
}

function drawFloats(view) {
	const g = view.g;
	g.font = 'bold 22px system-ui, sans-serif';
	g.textAlign = 'center';
	g.lineWidth = 4;
	for (let i = 0; i < FLOAT_CAP; i++) {
		const f = view.floats[i];
		if (f.life <= 0) continue;
		g.globalAlpha = Math.max(0, f.life / 0.9);
		g.strokeStyle = 'rgba(0,0,0,0.45)';
		g.fillStyle = f.color;
		const px = sx(view, f.x);
		const py = sy(view, f.y);
		g.strokeText(f.text, px, py);
		g.fillText(f.text, px, py);
	}
	g.globalAlpha = 1;
	g.textAlign = 'left';
}

// 조준·파워 게이지. 시뮬이 프레임 번호로 정한 값을 그대로 보여준다.
function drawAim(view, s) {
	const g = view.g;
	const px = sx(view, 0);
	const py = sy(view, terrainHeightAt(s.seed, 0) + 24);
	const deg = s.phase === PHASE_AIM ? aimAngleDeg(s.aimIndex) : s.lockedAngle;
	const rad = deg * Math.PI / 180;
	const len = (90 + (s.phase === PHASE_POWER ? s.powerIndex : 0) * 1.1) * view.zoom;

	g.save();
	g.translate(px, py);
	g.strokeStyle = s.phase === PHASE_POWER ? '#e4572e' : '#ffd166';
	g.lineWidth = 7 * view.zoom;
	g.lineCap = 'round';
	g.beginPath();
	g.moveTo(0, 0);
	g.lineTo(Math.cos(rad) * len, -Math.sin(rad) * len);
	g.stroke();
	g.restore();

	if (s.phase === PHASE_POWER) {
		const bw = 240, bh = 18;
		const bx = view.w / 2 - bw / 2;
		const by = view.h - 72;
		g.fillStyle = 'rgba(0,0,0,0.35)';
		g.fillRect(bx, by, bw, bh);
		g.fillStyle = s.powerIndex > 88 ? '#ffd166' : '#e4572e';
		g.fillRect(bx, by, bw * (s.powerIndex / 100), bh);
		g.strokeStyle = 'rgba(255,255,255,0.8)';
		g.lineWidth = 2;
		g.strokeRect(bx, by, bw, bh);
		// 최고점 표시
		g.fillStyle = '#fff';
		g.fillRect(bx + bw - 3, by - 5, 3, bh + 10);
	}
}

// 타이밍 창이 열려 있으면 냥이 주변에 링을 그려 지금 누르라고 알린다.
function drawTimingRing(view, s) {
	if (s.windowUsed || s.frame > s.windowEnd) return;
	const g = view.g;
	const left = s.windowEnd - s.frame;
	const t = left / (s.stats.timingWindow + 1);
	g.strokeStyle = 'rgba(255,209,102,0.9)';
	g.lineWidth = 4;
	g.beginPath();
	g.arc(sx(view, s.x), sy(view, s.y), (26 + 42 * (1 - t)) * view.zoom, 0, Math.PI * 2);
	g.stroke();
}

// 냥이. 부딪히면 납작해지고 빠르면 진행 방향으로 늘어난다.
function drawCat(view, s) {
	const g = view.g;
	const cat = catSprite();
	const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
	const stretch = Math.min(0.28, speed / 9000);
	const kx = (1 + stretch + view.squash * 0.38) * view.zoom;
	const ky = (1 - stretch * 0.7 - view.squash * 0.3) * view.zoom;

	g.save();
	g.translate(sx(view, s.x), sy(view, s.y));
	if (s.phase === PHASE_FLY) g.rotate(-Math.atan2(s.vy, Math.max(1, s.vx)) * 0.6);
	g.scale(kx, ky);
	g.drawImage(cat, -cat.width / 2, -cat.height / 2);
	g.restore();
}

export function render(view, s) {
	const g = view.g;
	drawSky(view);

	g.save();
	if (view.shake > 0) {
		g.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
	}

	drawParallax(view);
	drawTerrain(view, s);
	drawObjects(view, s);
	if (s.phase === PHASE_FLY) {
		drawTrail(view);
		drawSpeedLines(view, s);
	}

	// 대포
	const cannon = cannonSprite();
	const cw = cannon.width * view.zoom;
	const ch = cannon.height * view.zoom;
	g.drawImage(cannon, sx(view, 0) - cw / 2,
		sy(view, terrainHeightAt(s.seed, 0)) - ch + 6 * view.zoom, cw, ch);

	if (s.phase === PHASE_AIM || s.phase === PHASE_POWER) drawAim(view, s);

	drawCat(view, s);
	drawTimingRing(view, s);
	drawParticles(view);
	drawFloats(view);
	g.restore();
}
