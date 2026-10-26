'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const resources = 'htdocs/luci-static/resources/';
const dashboard = read(resources + 'view/lumen/dashboard.js');
const rpc = { declare: () => () => Promise.resolve({}) };
const select = new Function('rpc', dashboard.replace('return view.extend({', 'return selectUplink;\nreturn view.extend({'))(rpc);
const iface = (name, up, target, mask = 0, metric = 0) => ({
	interface: name, up, l3_device: 'device-' + name,
	route: target ? [{ target, mask, metric }] : []
});
const v4 = iface('uplink', true, '0.0.0.0');
const v6 = iface('mobile6', true, '::');
assert.equal(select([v4]), v4, 'Renamed IPv4 uplink');
assert.equal(select([v6]), v6, 'IPv6-only uplink');
assert.equal(select([iface('wan', false), v4]), v4, 'Active route wins over down wan');
assert.equal(select([iface('wan', true), v6]), v6, 'Active IPv6 route wins over name alone');
const backup = iface('backup', true, '0.0.0.0', 0, 100);
assert.equal(select([backup, v4]), v4, 'Lowest route metric wins');
assert.equal(select([iface('guest', true, '0.0.0.0', 8), v6]), v6, 'Non-default network route is ignored');
assert.equal(select([iface('wan6', true)]).interface, 'wan6', 'Named fallback when routes are unavailable');
assert.equal(select([iface('wan', false)]).up, false, 'Disconnected uplink remains explicitly disconnected');
assert.equal(select([]), null, 'Missing uplink is not invented');
const view = { extend: x => x };
const d = new Function('rpc', 'view', '_', dashboard)(rpc, view, x => x);
assert.equal(d.hasMenu.call({ menu: null }, 'admin/services/openclash'), false);
assert.equal(d.hasMenu.call({ menu: { children: { admin: { children: { lumen: {} } } } } }, 'admin/lumen'), true);
const realtime = read(resources + 'view/lumen/realtime.js');
const rt = new Function('rpc', 'view', '_', 'sc', 'L', realtime)(rpc, view, x => x, {}, {
	env: { dispatchpath: ['admin', 'lumen', 'realtime', 'bandwidth'] },
	resolveDefault: (promise, fallback) => promise.catch(() => fallback)
});
async function main() {
	assert.equal((await rt.load())[0], 'bandwidth', 'Realtime resolves the namespaced leaf route');
	const header = read('root/usr/share/ucode/luci/template/themes/lumen/header.ut');
	const inline = header.match(/<script>\s*([\s\S]*?)<\/script>/)[1]
		.replace(/{{ forced \?[^\n]+}}/, 'null')
		.replace(/{{ sprintf\('%J'[^\n]+}}/, '{}');
	const values = new Map([['shadcn-mode', 'dark'], ['shadcn-sidebar', 'collapsed']]);
	let legacyListener = false;
	const attrs = {};
	const page = { setAttribute: (k, v) => attrs[k] = v, classList: { add() {} } };
	const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
	new Function('document', 'window', 'localStorage', inline)({ documentElement: page }, {
		matchMedia: () => ({ matches: false, addListener() { legacyListener = true; } })
	}, storage);
	assert.ok(legacyListener, 'Legacy Safari matchMedia listener');
	assert.equal(values.get('shadcn-mode'), 'dark', 'Other theme preference is preserved');
	assert.equal(values.get('lumen-mode'), 'dark', 'Preference migrates only into the new theme');
	assert.equal(attrs['data-darkmode'], true);
	console.log('Portability behavior checks passed.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
