'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const helperSource = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/lumen/updates.js'), 'utf8');
const viewSource = fs.readFileSync(path.join(root, 'htdocs/luci-static/resources/view/lumen/updates.js'), 'utf8');
const API = 'https://api.github.com/repos/qidlek114/luci-theme-lumen/releases';
const REPO = 'https://github.com/qidlek114/luci-theme-lumen/releases';
const helper = fetcher => new Function('baseclass', 'fetch', helperSource)({ extend: value => value }, fetcher);
const response = (value, status = 200, headers = {}) => ({
	ok: status >= 200 && status < 300, status,
	headers: { get: name => headers[name.toLowerCase()] || null },
	json: async () => value
});
const release = (tag, id, extra = {}) => ({
	id, tag_name: tag, name: tag, body: 'Notes for ' + tag,
	draft: false, prerelease: false, assets: [], ...extra
});
const asset = (name, tag = 'v1.0.2', extra = {}) => ({
	name, state: 'uploaded', size: 1024,
	browser_download_url: REPO + '/download/' + encodeURIComponent(tag) + '/' + encodeURIComponent(name), ...extra
});
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('semantic ordering is numeric, stable-only, and precise for large components', () => {
	const u = helper(() => { throw new Error('Unexpected request'); });
	assert.equal(u.compareVersions('v1.10.0', '1.9.9'), 1);
	assert.equal(u.compareVersions('2.0.0', 'v10.0.0'), -1);
	assert.equal(u.compareVersions('1.2.3+build.4', 'v1.2.3'), 0);
	assert.equal(u.compareVersions('1.0.9007199254740993', '1.0.9007199254740992'), 1);
	assert.equal(u.parseVersion('01.2.3'), null);
	assert.equal(u.parseVersion('1.2'), null);
	assert.equal(u.parseVersion('1.2.3-01'), null);
	assert.equal(u.parseVersion('1.2.3-rc.1').prerelease, 'rc.1');
	assert.throws(() => u.compareVersions('1.2.3-rc.1', '1.2.3'), { code: 'invalid-version' });
});

test('range includes every stable intervening release in numeric order', async () => {
	const rows = [
		release('v1.10.0', 5), release('v1.0.1', 1), release('v2.0.0', 6),
		release('v1.0.3', 3), release('v1.2.0', 4), release('v1.0.2', 2),
		release('v9.0.0', 7, { draft: true }), release('v8.0.0', 8, { prerelease: true }),
		release('v3.0.0-rc.1', 9)
	];
	const u = helper(async () => response(rows));
	const catalog = await u.fetchReleases();
	assert.equal(catalog.complete, true);
	assert.deepEqual(u.releaseRange(catalog, '1.0.1', 'v1.10.0').map(r => r.version), ['1.0.2', '1.0.3', '1.2.0', '1.10.0']);
	assert.deepEqual(u.releaseRange(catalog, '1.0.1', 'v1.0.3').map(r => r.version), ['1.0.2', '1.0.3']);
	assert.throws(() => u.releaseRange(catalog, '1.0.1', 'v1.0.1'), { code: 'invalid-target' });
	assert.throws(() => u.releaseRange(catalog, '1.0.1', 'v99.0.0'), { code: 'invalid-target' });
});

test('all pages are fetched and release order is not assumed from creation dates', async () => {
	const calls = [];
	const u = helper(async (url, init) => {
		calls.push({ url, init });
		const page = Number(new URL(url).searchParams.get('page'));
		return response(page === 1 ? Array.from({ length: 100 }, (_, i) => release('v1.0.' + (100 - i), 101 - i)) : [release('v0.9.0', 1)]);
	});
	const catalog = await u.fetchReleases();
	assert.equal(catalog.complete, true);
	assert.equal(catalog.pages, 2);
	assert.equal(u.releaseRange(catalog, '1.0.1', 'v1.0.100').length, 99);
	assert.deepEqual(calls.map(c => c.url), [API + '?per_page=100&page=1', API + '?per_page=100&page=2']);
	for (const { init } of calls) {
		assert.equal(init.method, 'GET');
		assert.equal(init.credentials, 'omit');
		assert.equal(init.referrerPolicy, 'no-referrer');
		assert.equal(init.redirect, 'error');
		assert.equal(init.cache, 'no-store');
		assert.equal(init.mode, 'cors');
		assert.equal(Object.keys(init.headers).some(k => /authorization|cookie/i.test(k)), false);
	}
});

test('a next-page indication is followed using only the fixed repository endpoint', async () => {
	const calls = [];
	const u = helper(async url => {
		calls.push(url);
		return calls.length === 1 ? response([release('v1.0.3', 3)], 200, { link: '<https://attacker.invalid/next>; rel="next"' }) :
			response([release('v1.0.2', 2)]);
	});
	const catalog = await u.fetchReleases();
	assert.equal(catalog.complete, true);
	assert.equal(catalog.releases.length, 2);
	assert.equal(calls[1], API + '?per_page=100&page=2');
});

test('ten full pages are incomplete and cannot be selected as a full upgrade range', async () => {
	let calls = 0;
	const u = helper(async () => {
		const page = ++calls;
		return response(Array.from({ length: 100 }, (_, i) => release('v1.' + page + '.' + i, page * 100 + i)));
	});
	const catalog = await u.fetchReleases();
	assert.equal(calls, 10);
	assert.equal(catalog.complete, false);
	assert.equal(catalog.issues.some(i => i.code === 'page-limit'), true);
	assert.throws(() => u.newerReleases(catalog, '1.0.1'), { code: 'incomplete' });
	assert.throws(() => u.releaseRange(catalog, '1.0.1', 'v1.10.99'), { code: 'incomplete' });
});

test('rate limits and later-page failures never produce a complete catalog', async () => {
	for (const status of [403, 429, 500]) {
		let calls = 0;
		const u = helper(async () => ++calls === 1 ?
			response([release('v1.0.2', 2)], 200, { link: '<next>; rel="next"' }) :
			response({}, status, { 'x-ratelimit-reset': '1800000000' }));
		const catalog = await u.fetchReleases();
		assert.equal(catalog.complete, false);
		assert.equal(catalog.releases.length, 1);
		assert.equal(catalog.issues[0].code, status === 500 ? 'http' : 'rate-limit');
		if (status !== 500) assert.equal(catalog.issues[0].retryAt, 1800000000000);
	}
	const offline = await helper(async () => { throw new TypeError('Failed to fetch'); }).fetchReleases();
	assert.equal(offline.complete, false);
	assert.equal(offline.issues[0].code, 'network');
});

test('timeouts cover fetch and stalled response bodies and abort the request', async () => {
	let aborted = false;
	const start = Date.now();
	const u = helper((url, init) => {
		init.signal.addEventListener('abort', () => { aborted = true; });
		return new Promise(() => {});
	});
	const catalog = await u.fetchReleases({ timeout: 10 });
	assert.equal(catalog.complete, false);
	assert.equal(catalog.issues[0].code, 'timeout');
	assert.equal(aborted, true);
	assert.ok(Date.now() - start < 1000);
	const stalled = helper(async () => ({ ...response([]), json: () => new Promise(() => {}) }));
	assert.equal((await stalled.fetchReleases({ totalTimeout: 10 })).issues[0].code, 'timeout');
});

test('malformed data, unsupported tags, and moving pagination are explicitly incomplete', async () => {
	for (const value of [{ message: 'not an array' }, [null], [release('nightly', 1)], [release('v1.0.2', 1, { assets: null })]]) {
		assert.equal((await helper(async () => response(value)).fetchReleases()).complete, false);
	}
	const conflicting = await helper(async () => response([release('v1.0.2', 1), release('1.0.2+build', 2)])).fetchReleases();
	assert.equal(conflicting.issues[0].code, 'ambiguous-version');
	let page = 0;
	const duplicate = await helper(async () => response([release('v1.0.2', 2)], 200, ++page === 1 ? { link: '<next>; rel="next"' } : {})).fetchReleases();
	assert.equal(duplicate.complete, false);
	assert.equal(duplicate.releases.length, 1);
	assert.equal(duplicate.issues[0].code, 'changed-results');
});

test('metadata is local and rejects unknown version or package format', async () => {
	const calls = [];
	const u = helper(async (url, init) => { calls.push({ url, init }); return response({ version: '1.0.1', format: 'apk' }); });
	assert.deepEqual(await u.readInstalled('/luci-static/resources/lumen/version.json'), { version: '1.0.1', format: 'apk' });
	assert.equal(calls[0].init.mode, 'same-origin');
	assert.equal(calls[0].init.credentials, 'omit');
	for (const invalid of [{ version: 'latest', format: 'apk' }, { version: '1.0.1', format: 'exe' }, { format: 'apk' }, { version: '1.0.1-rc.1', format: 'ipk' }]) {
		await assert.rejects(u.readInstalled('/local', { fetcher: async () => response(invalid) }), { code: 'metadata' });
	}
});

test('download URLs are restricted to this release and repository; package formats are separated', async () => {
	const u = helper(async () => response([]));
	const name = 'luci-theme-lumen-1.0.2-r1.apk';
	const valid = asset(name).browser_download_url;
	assert.equal(u.assetURL(valid, 'v1.0.2', name), valid);
	for (const bad of [
		valid.replace('https:', 'http:'), valid.replace('github.com', 'github.com.attacker.invalid'),
		valid.replace('github.com', 'user:pass@github.com'), valid.replace('qidlek114', 'other-owner'),
		valid.replace('luci-theme-lumen/releases', 'other-repo/releases'), valid.replace('/v1.0.2/', '/v9.0.0/'),
		valid + '?redirect=elsewhere', valid + '#fragment', 'javascript:alert(1)',
		valid.replace('/v1.0.2/', '/v1.0.2%2Fescape/'), valid.replace('/download/', '/tag/'),
		valid.replace('github.com', 'github.com:444')
	]) assert.equal(u.assetURL(bad, 'v1.0.2', name), null, bad);
	const names = [name, 'luci-theme-lumen-fonts-1.0.2-r1.apk', 'luci-i18n-lumen-zh-cn-1.0.2.apk', 'luci-theme-lumen_1.0.2-r1_all.ipk',
		'luci-theme-lumen-fonts_1.0.2-r1_all.ipk', 'luci-i18n-lumen-zh-cn_1.0.2_all.ipk', 'lumen-apk.pub', 'lumen-usign.pub', 'SHA256SUMS', 'SHA256SUMS.sig', 'source.zip'];
	const catalog = await u.fetchReleases({ fetcher: async () => response([release('v1.0.2', 2, {
		assets: names.map(n => asset(n)).concat(asset('unsafe.apk', 'v1.0.2', { browser_download_url: 'https://attacker.invalid/unsafe.apk' }))
	})]) });
	const selected = catalog.releases[0];
	assert.equal(selected.omittedAssets, 1);
	const apk = u.downloads(selected, 'apk'), ipk = u.downloads(selected, 'ipk');
	assert.equal(apk.filter(a => a.kind === 'theme').length, 1);
	assert.equal(ipk.filter(a => a.kind === 'theme').length, 1);
	assert.equal(apk.filter(a => a.kind === 'fonts').length, 1);
	assert.equal(ipk.filter(a => a.kind === 'fonts').length, 1);
	assert.equal(ipk.filter(a => a.kind === 'translation').length, 1);
	assert.equal(apk.some(a => a.name.endsWith('.ipk')), false);
	assert.equal(ipk.some(a => a.name.endsWith('.apk') || a.name === 'lumen-apk.pub'), false);
	assert.equal(apk.some(a => a.name === 'source.zip'), false);
	assert.equal(apk.filter(a => a.kind === 'checksum').length, 2);
});

// Small DOM implementation intentionally forbids innerHTML. No browser dependencies.
class Element {
	constructor(tag, attrs = {}, children = []) {
		this.tag = tag;
		this.attributes = {};
		this.children = [];
		for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
		for (const child of children) this.appendChild(child);
	}
	setAttribute(name, value) {
		this.attributes[name] = value;
		if (name === 'value') this.value = value;
		if (name === 'class') this.className = value;
	}
	appendChild(child) { this.children.push(child); return child; }
	set textContent(text) { this.children = [String(text)]; }
	get textContent() { return this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
	set innerHTML(value) { throw new Error('HTML parsing is forbidden: ' + value); }
}
const E = (tag, attrs, children) => new Element(tag, attrs, children || []);
const all = (node, tag) => (node instanceof Element ? (node.tag === tag ? [node] : []).concat(node.children.flatMap(c => all(c, tag))) : []);
const dom = { content: (node, children) => { node.children = children.slice(); } };
const L = { resource: name => '/luci-static/resources/' + name, url: name => '/cgi-bin/luci/' + name };
String.prototype.format = function (...values) { let i = 0; return this.replace(/%[sd]/g, () => String(values[i++])); };
const menuWith = name => ({ children: { admin: { children: { system: { children: { [name]: {} } } } } } });
const makeView = (u, loadMenu = async () => menuWith('package-manager'), injected = {}) =>
	new Function('view', 'dom', 'ui', 'updates', 'L', 'E', '_', 'rpc', 'setTimeout', 'sessionStorage', 'location', 'fetch', viewSource)
		({ extend: value => value }, dom, { menu: { load: loadMenu } }, u, L, E, text => text,
			injected.rpc || { declare: () => async () => ({ state: 'idle' }) }, injected.setTimeout || (() => 0),
			injected.sessionStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} },
			injected.location || { reload: () => {} }, injected.fetch || (async () => ({ ok: true })));

test('the view is manual, renders hostile notes as text, and updates the full selected range', async () => {
	const calls = [];
	const hostile = '<img src="https://attacker.invalid/pixel" onerror="alert(1)"><script>alert(1)</script>';
	const rows = [release('v1.1.0', 4, { name: hostile, body: hostile }), release('v1.0.3', 3, { body: '' }),
		release('v1.0.2', 2, { assets: [asset('luci-theme-lumen-1.0.2-r1.apk')] })];
	const u = helper(async (url, init) => {
		calls.push({ url, init });
		return response(url.startsWith('/luci-static/') ? { version: '1.0.1', format: 'apk' } : rows);
	});
	const view = makeView(u);
	assert.equal(calls.length, 0, 'Module evaluation does not fetch');
	const tree = view.render(await view.load());
	assert.equal(calls.length, 1, 'Load only fetches installed local metadata');
	assert.equal(calls[0].url, '/luci-static/resources/lumen/version.json');
	assert.equal(view.handleSave, null);
	assert.equal(view.handleSaveApply, null);
	await view.checkUpdates();
	assert.equal(calls.filter(c => c.url.startsWith(API)).length, 1);
	assert.equal(view.target.value, 'v1.1.0');
	assert.equal(all(view.notes, 'section').length, 3);
	assert.ok(view.notes.textContent.includes(hostile));
	assert.equal(all(tree, 'img').length, 0);
	assert.equal(all(tree, 'script').length, 0);
	assert.ok(view.notes.textContent.includes('No release notes were provided for this version.'));
	view.target.value = 'v1.0.3';
	view.renderSelection();
	assert.equal(all(view.notes, 'section').length, 2, 'Changing the target rebuilds the complete range');
	assert.equal(view.notes.textContent.includes(hostile), false);
	view.target.value = 'v1.0.2';
	view.renderSelection();
	assert.equal(all(view.files, 'a').filter(a => a.attributes.href.includes('/download/')).length, 1);
	for (const link of all(tree, 'a').filter(a => String(a.attributes.href).startsWith('https:'))) {
		assert.equal(link.attributes.target, '_blank');
		assert.equal(link.attributes.rel, 'noopener noreferrer');
	}
	assert.equal(calls.length, 3, 'Target changes do not make further requests');
});

test('automatic updates have fixed RPC calls and confirm only after a page reload and local assets', async () => {
	const calls = [], storage = new Map(); let reloads = 0, assetOK = true;
	const injected = {
		rpc: { declare: ({ object, method }) => async (...args) => {
			calls.push({ object, method, args });
			return method === 'start' ? { state: 'started' } : { state: 'idle' };
		} },
		sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
		location: { reload: () => { reloads++; } },
		fetch: async url => ({ ok: assetOK && url.startsWith('/luci-static/') })
	};
	const u = helper(async () => response({ version: '1.0.3', format: 'apk' }));
	const view = makeView(u, async () => menuWith('package-manager'), injected);
	view.render(await view.load());
	await view.startAutomatic();
	assert.deepEqual(calls.find(c => c.method === 'start'), { object: 'lumen.update', method: 'start', args: [] });
	await view.refreshAutomatic({ state: 'waiting', target: '1.0.3' });
	assert.equal(reloads, 1);assert.equal(calls.some(c => c.method === 'confirm'), false);
	assetOK = false;
	await view.refreshAutomatic({ state: 'waiting', target: '1.0.3' });
	assert.equal(calls.some(c => c.method === 'confirm'), false, 'A missing resource cannot confirm the update');
	assetOK = true;
	await view.refreshAutomatic({ state: 'waiting', target: '1.0.3' });
	assert.deepEqual(calls.find(c => c.method === 'confirm'), { object: 'lumen.update', method: 'confirm', args: [] });
});

test('the UI never reports up-to-date on errors, empty lists, or missing metadata', async () => {
	for (const outcome of ['http', 'empty', 'metadata']) {
		const calls = [];
		const u = helper(async url => {
			calls.push(url);
			if (url.startsWith('/')) return response(outcome === 'metadata' ? {} : { version: '1.0.1', format: 'ipk' });
			return response([], outcome === 'http' ? 500 : 200);
		});
		const view = makeView(u), tree = view.render(await view.load());
		await view.checkUpdates();
		assert.equal(view.status.attributes.role, 'alert');
		assert.equal(view.status.textContent.includes('No newer stable release was found.'), false);
		assert.equal(all(view.details, 'select').length, 0);
		assert.equal(all(view.details, 'a').length, 0);
		assert.equal(view.checkButton.disabled, false);
		if (outcome === 'metadata') assert.equal(calls.some(url => url.startsWith(API)), false);
		else assert.ok(all(tree, 'a').some(a => a.attributes.href === '/cgi-bin/luci/admin/system/package-manager'));
	}
});

test('package manager links come from the accessible menu, never from the package format', async () => {
	for (const format of ['ipk', 'apk']) {
		for (const name of ['package-manager', 'opkg']) {
			const u = helper(async () => response({ version: '1.0.1', format }));
			const view = makeView(u, async () => menuWith(name));
			const tree = view.render(await view.load());
			const internal = all(tree, 'a').filter(a => a.attributes.href.startsWith('/'));
			assert.equal(internal.length, 1);
			assert.equal(internal[0].attributes.href, '/cgi-bin/luci/admin/system/' + name);
		}
	}
	for (const loadMenu of [async () => null, async () => ({}), async () => { throw new Error('Menu denied'); }]) {
		const view = makeView(helper(async () => response({ version: '1.0.1', format: 'apk' })), loadMenu);
		const tree = view.render(await view.load());
		assert.equal(all(tree, 'a').some(a => a.attributes.href.startsWith('/')), false);
		assert.ok(tree.textContent.includes('open Software from the System menu'));
	}
});

test('only a complete stable history may report no newer version', async () => {
	for (const installed of ['1.0.2', '2.0.0']) {
		const u = helper(async url => response(url.startsWith('/') ? { version: installed, format: 'apk' } : [release('v1.0.2', 2)]));
		const view = makeView(u);
		view.render(await view.load());
		await view.checkUpdates();
		assert.equal(view.status.attributes.role, 'status');
		assert.equal(view.status.textContent, installed === '1.0.2' ? 'No newer stable release was found.' :
			'The installed version is newer than the published stable releases.');
	}
});

(async () => {
	for (const { name, run } of tests) {
		await run();
		console.log('PASS ' + name);
	}
	console.log('Update behavior checks passed: ' + tests.length + ' groups.');
})().catch(error => { console.error(error); process.exitCode = 1; });
