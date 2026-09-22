// 개발용 정적 서버. 외부 의존성 없이 돌아간다.
//   node tools/serve.mjs [포트]
// ES 모듈은 file:// 에서 안 되므로 로컬 확인은 이 서버로 한다.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.argv[2] || 5173);

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon'
};

createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://localhost');
		let rel = decodeURIComponent(url.pathname);
		if (rel.endsWith('/')) rel += 'index.html';

		// 경로 탈출 방지. 저장소 바깥은 절대 내보내지 않는다.
		const target = resolve(join(ROOT, normalize(rel)));
		if (target !== ROOT && !target.startsWith(ROOT + sep)) {
			res.writeHead(403).end('forbidden');
			return;
		}

		const body = await readFile(target);
		res.writeHead(200, {
			'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
			'Cache-Control': 'no-store'
		}).end(body);
	} catch (e) {
		res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(String(e.code || e.message));
	}
}).listen(PORT, () => {
	console.log(`nyanfly: http://localhost:${PORT}/`);
});
