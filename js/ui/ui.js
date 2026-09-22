// 화면과 버튼. 시뮬은 건드리지 않고 상태만 읽어 표시한다.
// 사용자가 입력한 문자열은 전부 textContent로만 출력한다.

import { MAX_LEVEL, UPGRADES, costOf } from '../sim/upgrades.js';

const el = (id) => document.getElementById(id);

export const dom = {
	stage: el('stage'),
	hud: el('hud'),
	hudDist: el('hudDist'),
	hudBest: el('hudBest'),
	hudCombo: el('hudCombo'),
	hudHint: el('hudHint'),

	title: el('titleScreen'),
	titleBest: el('titleBest'),
	titleChuru: el('titleChuru'),

	result: el('resultScreen'),
	resDist: el('resDist'),
	resUnit: el('resUnit'),
	resNew: el('resNew'),
	resPerfect: el('resPerfect'),
	resCombo: el('resCombo'),
	resChuru: el('resChuru'),

	shop: el('shopScreen'),
	shopChuru: el('shopChuru'),
	shopList: el('shopList'),

	rank: el('rankScreen'),
	rankList: el('rankList'),
	rankNote: el('rankNote'),
	nickname: el('nickname'),

	btnPlay: el('btnPlay'),
	btnRetry: el('btnRetry'),
	btnShop: el('btnShop'),
	btnShopFromTitle: el('btnShopFromTitle'),
	btnShopClose: el('btnShopClose'),
	btnSubmit: el('btnSubmit'),
	btnRankFromTitle: el('btnRankFromTitle'),
	btnRankClose: el('btnRankClose')
};

const PANELS = [dom.title, dom.result, dom.shop, dom.rank];

// 한 번에 하나의 패널만 보여준다. 패널이 없으면 플레이 중이다.
export function showPanel(panel) {
	for (const p of PANELS) p.classList.toggle('hidden', p !== panel);
	dom.hud.classList.toggle('hidden', panel !== null);
}

export function fmtDist(m) {
	return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.floor(m)} m`;
}

export function setHud(text, best, combo, hint) {
	dom.hudDist.textContent = text;
	dom.hudBest.textContent = `최고 ${fmtDist(best)}`;
	dom.hudCombo.textContent = combo > 1 ? `${combo} 콤보` : '';
	dom.hudHint.textContent = hint;
}

export function setTitle(progress) {
	dom.titleBest.textContent = fmtDist(progress.best);
	dom.titleChuru.textContent = String(progress.churu);
}

export function setResult(distance, perfects, combo, churu, isNew) {
	dom.resDist.textContent = distance >= 1000
		? (distance / 1000).toFixed(2)
		: String(Math.floor(distance));
	dom.resUnit.textContent = distance >= 1000 ? ' km' : ' m';
	dom.resPerfect.textContent = String(perfects);
	dom.resCombo.textContent = String(combo);
	dom.resChuru.textContent = String(churu);
	dom.resNew.classList.toggle('hidden', !isNew);
}

// 상점 목록. 항목마다 버튼을 만들고 구매 콜백을 붙인다.
export function renderShop(progress, onBuy) {
	dom.shopChuru.textContent = String(progress.churu);
	dom.shopList.textContent = '';

	for (const up of UPGRADES) {
		const level = progress.levels[up.id] | 0;
		const cost = costOf(up, level);
		const maxed = level >= MAX_LEVEL;
		const afford = !maxed && progress.churu >= cost;

		const item = document.createElement('div');
		item.className = 'shop-item';

		const left = document.createElement('div');
		const name = document.createElement('div');
		name.className = 'name';
		name.textContent = up.name;
		const desc = document.createElement('div');
		desc.className = 'desc';
		desc.textContent = up.desc;
		const pips = document.createElement('div');
		pips.className = 'pips';
		pips.textContent = '●'.repeat(level) + '○'.repeat(MAX_LEVEL - level);
		left.append(name, desc, pips);

		const btn = document.createElement('button');
		btn.textContent = maxed ? '최대' : `츄르 ${cost}`;
		btn.disabled = !afford;
		btn.addEventListener('click', () => onBuy(up.id));

		item.append(left, btn);
		dom.shopList.append(item);
	}
}

// 랭킹 목록. 닉네임은 textContent로만 넣는다.
export function renderRank(rows, note) {
	dom.rankList.textContent = '';
	if (!rows || rows.length === 0) {
		const li = document.createElement('li');
		li.textContent = '아직 기록이 없습니다.';
		dom.rankList.append(li);
	} else {
		for (const r of rows) {
			const li = document.createElement('li');
			li.textContent = r.nickname || '익명냥';
			const span = document.createElement('span');
			span.textContent = fmtDist(r.distance);
			li.append(span);
			dom.rankList.append(li);
		}
	}
	dom.rankNote.textContent = note || '';
}
