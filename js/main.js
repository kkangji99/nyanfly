// 앱 진입점. 고정 타임스텝 시뮬과 가변 프레임 렌더를 이어 붙인다.

import {
	DT, PHASE_AIM, PHASE_DONE, PHASE_POWER,
	churuEarned, click, createSim, distanceM, step
} from './sim/sim.js';
import { isMuted, sfxBuy, sfxGauge, toggleMute, unlock } from './audio/sfx.js';
import { MAX_LEVEL, UPGRADES, costOf } from './sim/upgrades.js';
import { createView, render, resetView, resize, updateView } from './render/render.js';
import { fetchTop, submit } from './net/leaderboard.js';
import { isConfigured } from './net/config.js';
import { load, save } from './store.js';
import { dom, fmtDist, renderRank, renderShop, setHud, setResult, setTitle, showPanel } from './ui/ui.js';

const HINTS = ['각도를 정하세요', '파워를 정하세요', '닿는 순간 클릭!', ''];

const progress = load();
const view = createView(dom.stage);

let sim = createSim(newSeed(), progress.levels);
let playing = false;
let submitted = false;
let acc = 0;          // 시뮬 누적 시간
let lastMs = 0;

// 판마다 새 시드. 시드 자체는 결정론과 무관하게 골라도 된다.
function newSeed() {
	return (Math.random() * 0x7fffffff) | 0;
}

function startRun() {
	sim = createSim(newSeed(), progress.levels);
	resetView(view);
	// 최고 기록 지점에 깃발을 꽂아 두면 그걸 넘는 순간이 눈에 보인다.
	view.best = progress.best;
	acc = 0;
	playing = true;
	submitted = false;
	showPanel(null);
}

function finishRun() {
	playing = false;
	const dist = distanceM(sim);
	const earned = churuEarned(sim);
	const isNew = dist > progress.best;

	progress.churu += earned;
	progress.runs += 1;
	if (isNew) progress.best = Math.floor(dist);
	save(progress);

	setResult(dist, sim.perfects, sim.bestCombo, earned, isNew);
	dom.btnSubmit.disabled = false;
	dom.btnSubmit.textContent = '랭킹 등록';
	showPanel(dom.result);
}

// 입력은 한 곳으로 모은다. 마우스, 터치, 스페이스가 모두 같은 클릭이다.
function onPress() {
	// 브라우저는 사용자 조작 전에 소리를 막으므로 첫 입력에서 열어 준다.
	unlock();
	if (!playing) return;
	// 게이지를 확정하는 소리. 발사 전 두 클릭에도 반응이 있어야 손맛이 산다.
	if (sim.phase === PHASE_AIM || sim.phase === PHASE_POWER) sfxGauge();
	click(sim);
}

// 한 프레임의 일. 고정 타임스텝으로 시뮬을 돌리고 렌더는 실제 경과 시간으로 움직인다.
// rAF와 점검용 구동이 같은 경로를 쓰도록 따로 뺐다.
function advance(dt) {
	// 탭을 다시 열었을 때 한꺼번에 몰아 돌지 않게 상한을 둔다. 타이밍이 생명인
	// 게임이라 밀린 시간을 따라잡는 대신 버린다.
	if (dt > 0.25) dt = 0.25;

	if (playing) {
		// 히트스톱 중에는 시뮬을 세우고 화면만 움직인다. 맞은 순간이 눈에 박히게
		// 하는 연출이다. 시뮬의 프레임 번호는 그대로이므로 리플레이에는 영향이 없다.
		if (view.hitstop <= 0) {
			acc += dt;
			while (acc >= DT) {
				step(sim);
				acc -= DT;
			}
		}

		const phase = sim.phase;
		setHud(fmtDist(distanceM(sim)), progress.best, sim.combo, HINTS[phase]);
		if (phase === PHASE_DONE) finishRun();
	}

	// 판이 끝난 뒤에도 계속 불러야 한다. 여기서 안 부르면 펀치·섬광·입자 같은
	// 연출값이 마지막 프레임 값에 그대로 얼어붙는다.
	updateView(view, sim, dt);

	if (perfOn) {
		const t0 = performance.now();
		render(view, sim);
		sampleFrame(performance.now() - t0, dt);
	} else {
		render(view, sim);
	}
}

// --- 계측 (P 키) ---
// render() 소요 시간은 창이 실제로 보이는 상태에서만 의미가 있다. 탭이 숨겨져 있으면
// 브라우저가 그리기를 건너뛰어 0에 가까운 값이 나온다.
const PERF_N = 120;
const perfRender = new Float32Array(PERF_N);
const perfFrame = new Float32Array(PERF_N);
let perfHead = 0;
let perfOn = false;
let perfShownAt = 0;

function sampleFrame(renderMs, dt) {
	const i = perfHead % PERF_N;
	perfRender[i] = renderMs;
	perfFrame[i] = dt * 1000;
	perfHead++;

	// 표시는 4프레임에 한 번만 갱신한다. 계측 자체가 비용이 되면 안 된다.
	if (perfHead - perfShownAt < 4) return;
	perfShownAt = perfHead;

	const n = Math.min(PERF_N, perfHead);
	let rSum = 0, rMax = 0, fSum = 0;
	for (let k = 0; k < n; k++) {
		rSum += perfRender[k];
		if (perfRender[k] > rMax) rMax = perfRender[k];
		fSum += perfFrame[k];
	}
	const rAvg = rSum / n;
	const fAvg = fSum / n;
	let alive = 0;
	for (let k = 0; k < view.parts.length; k++) if (view.parts[k].life > 0) alive++;

	// 계측 표시는 켰을 때만 4프레임마다 만들므로 문자열을 새로 만들어도 괜찮다.
	dom.perf.textContent = `render  ${rAvg.toFixed(2)} ms  (최대 ${rMax.toFixed(2)})
frame   ${fAvg.toFixed(2)} ms  ${(1000 / fAvg).toFixed(0)} fps
예산    16.67 ms 중 ${(rAvg / 16.67 * 100).toFixed(1)}%
입자    ${alive} / ${view.parts.length}
지형표본 ${view.tn}   배율 ${view.zoom.toFixed(2)}`;
}

function togglePerf() {
	perfOn = !perfOn;
	perfHead = 0;
	perfShownAt = 0;
	dom.perf.classList.toggle('hidden', !perfOn);
	if (perfOn) dom.perf.textContent = '측정 중...';
}

function frame(ms) {
	requestAnimationFrame(frame);
	if (lastMs === 0) lastMs = ms;
	const dt = (ms - lastMs) / 1000;
	lastMs = ms;
	advance(dt);
}

function buy(id) {
	const up = UPGRADES.find((u) => u.id === id);
	if (!up) return;
	const level = progress.levels[id] | 0;
	if (level >= MAX_LEVEL) return;
	const cost = costOf(up, level);
	if (progress.churu < cost) return;

	progress.churu -= cost;
	progress.levels[id] = level + 1;
	save(progress);
	sfxBuy();
	renderShop(progress, buy);
}

async function openRank(note) {
	showPanel(dom.rank);
	dom.nickname.value = progress.nickname;
	renderRank([], '불러오는 중...');
	const rows = await fetchTop();
	const fallback = isConfigured() ? '' : '서버 설정이 없어 이 기기의 기록만 보여줍니다.';
	renderRank(rows, note || fallback);
}

// --- 버튼 연결 ---

dom.btnPlay.addEventListener('click', startRun);
dom.btnRetry.addEventListener('click', startRun);

dom.btnShop.addEventListener('click', () => {
	renderShop(progress, buy);
	showPanel(dom.shop);
});
dom.btnShopFromTitle.addEventListener('click', () => {
	renderShop(progress, buy);
	showPanel(dom.shop);
});
dom.btnShopClose.addEventListener('click', () => {
	setTitle(progress);
	showPanel(dom.title);
});

dom.btnRankFromTitle.addEventListener('click', () => openRank());
dom.btnRankClose.addEventListener('click', () => {
	setTitle(progress);
	showPanel(dom.title);
});

dom.nickname.addEventListener('change', () => {
	progress.nickname = dom.nickname.value.slice(0, 12);
	save(progress);
});

dom.btnSubmit.addEventListener('click', async () => {
	if (submitted) return;
	submitted = true;
	dom.btnSubmit.disabled = true;
	dom.btnSubmit.textContent = '등록 중...';

	const res = await submit({
		nickname: progress.nickname,
		distance: distanceM(sim),
		seed: sim.seed,
		levels: progress.levels,
		inputs: sim.inputs,
		perfects: sim.perfects,
		bestCombo: sim.bestCombo
	});
	dom.btnSubmit.textContent = '등록 완료';
	await openRank(res.mode === 'local'
		? '서버 설정이 없어 이 기기에만 저장했습니다.'
		: '');
});

// --- 입력 ---

dom.stage.addEventListener('pointerdown', (e) => {
	e.preventDefault();
	onPress();
});

window.addEventListener('keydown', (e) => {
	if (e.code === 'KeyP' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) {
		togglePerf();
		return;
	}
	if (e.code !== 'Space' && e.code !== 'Enter') return;
	// 입력란에 글자를 넣는 중이면 게임 입력으로 쓰지 않는다.
	if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
	e.preventDefault();
	if (playing) onPress();
	else if (!dom.title.classList.contains('hidden')) startRun();
	else if (!dom.result.classList.contains('hidden')) startRun();
});

window.addEventListener('resize', () => resize(view));

// 소리 토글. 캔버스 클릭으로 새지 않게 이벤트를 여기서 끊는다.
function syncMuteLabel() {
	dom.btnMute.textContent = isMuted() ? '소리 켜기' : '소리 끄기';
}

dom.btnMute.addEventListener('pointerdown', (e) => e.stopPropagation());
dom.btnMute.addEventListener('click', (e) => {
	e.stopPropagation();
	toggleMute();
	syncMuteLabel();
});

// --- 개발용 점검 창구 ---
// 로컬에서만 붙인다. 배포된 페이지에서는 아무것도 노출하지 않는다.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
	window.__nyanfly = {
		get sim() { return sim; },
		get view() { return view; },
		get progress() { return progress; },
		press: onPress,
		start: startRun,
		// 창이 숨겨져 rAF가 멈춰도 게임을 굴려 볼 수 있게 한다.
		advance
	};
}

// --- 시작 ---

setTitle(progress);
syncMuteLabel();
dom.nickname.value = progress.nickname;
showPanel(dom.title);
requestAnimationFrame(frame);
