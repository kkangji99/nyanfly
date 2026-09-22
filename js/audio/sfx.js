// 효과음. 음원 파일 없이 WebAudio로 즉석 합성한다.
// 저장소에 에셋이 늘지 않고 CSP도 건드릴 필요가 없다.
//
// 브라우저는 사용자 조작 전에는 소리를 막으므로, 첫 입력 때 resume()을 부른다.

const KEY = 'nyanfly.muted.v1';

let ctx = null;
let master = null;
let muted = false;

try {
	muted = localStorage.getItem(KEY) === '1';
} catch (e) {
	muted = false;
}

function ensure() {
	if (muted) return null;
	if (ctx) {
		// 탭이 백그라운드로 갔다 오면 멈춰 있을 수 있다.
		if (ctx.state === 'suspended') ctx.resume();
		return ctx;
	}
	const Ctor = window.AudioContext || window.webkitAudioContext;
	if (!Ctor) return null;
	ctx = new Ctor();
	master = ctx.createGain();
	master.gain.value = 0.22;
	master.connect(ctx.destination);
	return ctx;
}

export function isMuted() {
	return muted;
}

export function toggleMute() {
	muted = !muted;
	try {
		localStorage.setItem(KEY, muted ? '1' : '0');
	} catch (e) {
		// 저장 실패는 무시한다. 이번 세션에만 적용된다.
	}
	if (muted && ctx) ctx.suspend();
	else ensure();
	return muted;
}

// 짧은 음 하나. 주파수를 훑으며 지수적으로 잦아든다.
function tone(freq, endFreq, dur, type, gain) {
	const c = ensure();
	if (!c) return;
	const t = c.currentTime;
	const osc = c.createOscillator();
	const amp = c.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
	amp.gain.setValueAtTime(0, t);
	amp.gain.linearRampToValueAtTime(gain, t + 0.008);
	amp.gain.exponentialRampToValueAtTime(0.0008, t + dur);
	osc.connect(amp);
	amp.connect(master);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

// 잡음 한 줌. 흙먼지와 바람에 쓴다.
function noise(dur, gain, cutoff) {
	const c = ensure();
	if (!c) return;
	const t = c.currentTime;
	const n = Math.floor(c.sampleRate * dur);
	const buf = c.createBuffer(1, n, c.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < n; i++) {
		data[i] = (Math.random() * 2 - 1) * (1 - i / n);
	}
	const src = c.createBufferSource();
	src.buffer = buf;
	const filt = c.createBiquadFilter();
	filt.type = 'lowpass';
	filt.frequency.value = cutoff;
	const amp = c.createGain();
	amp.gain.value = gain;
	src.connect(filt);
	filt.connect(amp);
	amp.connect(master);
	src.start(t);
}

export function sfxGauge() {
	tone(880, 880, 0.04, 'square', 0.1);
}

export function sfxLaunch() {
	tone(180, 60, 0.28, 'sawtooth', 0.5);
	noise(0.3, 0.45, 1400);
}

// 튕김. 콤보가 쌓일수록 음이 올라가 리듬이 들리게 한다.
export function sfxBounce(combo) {
	const step = Math.min(combo, 12);
	tone(300 + step * 34, 180, 0.09, 'triangle', 0.3);
	noise(0.07, 0.18, 900);
}

export function sfxPerfect(combo) {
	const step = Math.min(combo, 12);
	tone(660 + step * 45, 990 + step * 45, 0.16, 'triangle', 0.32);
}

export function sfxGood() {
	tone(440, 520, 0.1, 'sine', 0.22);
}

export function sfxCloud() {
	tone(520, 760, 0.14, 'sine', 0.26);
}

export function sfxBird() {
	tone(900, 1300, 0.09, 'square', 0.14);
}

export function sfxRing() {
	tone(1200, 1700, 0.1, 'sine', 0.2);
}

export function sfxLand() {
	tone(140, 70, 0.34, 'sine', 0.36);
	noise(0.34, 0.3, 700);
}

export function sfxBuy() {
	tone(700, 1050, 0.11, 'triangle', 0.24);
}

// 첫 사용자 입력에서 부른다. 이걸 거치지 않으면 브라우저가 소리를 막는다.
export function unlock() {
	ensure();
}
