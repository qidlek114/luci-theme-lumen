'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'htdocs/luci-static/resources');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const doc = { hidden: false };
const calls = [];
let now = 100000;
let limit = '16384';
const clock = { now: () => now };
const rpc = { declare: ({ method }) => (...args) => {
	calls.push([method, ...args]);
	return Promise.resolve(method === 'info' ? {} : []);
} };
const file = { read: name => {
	calls.push(['read', name]);
	return Promise.resolve(name.includes('nf_conntrack_max') ? limit : '');
} };
const view = { extend: object => object };
const L = { resolveDefault: (promise, fallback) => Promise.resolve(promise).catch(() => fallback) };
const dashboard = new Function('rpc', 'fs', 'view', 'L', 'document', 'Date', source('view/lumen/dashboard.js'))(rpc, file, view, L, doc, clock);
for (const method of ['updateMemory', 'updateDevices', 'updateIfaces', 'updateSystem', 'updateCpu', 'updateConn', 'ingestTraffic'])
	dashboard[method] = () => {};
dashboard.wanDevice = 'wan';

const realtime = new Function('rpc', 'view', '_', 'sc', 'L', 'document', source('view/lumen/realtime.js'))(rpc, view, x => x, {}, L, doc);
realtime.mode = 'connections';
realtime.M = { rows: rows => rows };
realtime.chart = { push() {} };
realtime.renderLegend = () => {};

async function main() {
	doc.hidden = true;
	await Promise.all([dashboard.refresh(), dashboard.fastTick(), realtime.tick(), realtime.refreshConnections()]);
	assert.equal(calls.length, 0, 'Hidden dashboard and realtime views make no polling requests');

	doc.hidden = false;
	await dashboard.refresh();
	assert.equal(dashboard.ctMax, 16384);
	for (let i = 0; i < 19; i++) { now += 3000; await dashboard.refresh(); }
	assert.equal(calls.filter(c => c[0] === 'read' && c[1].includes('nf_conntrack_max')).length, 1, 'Limit is cached for a minute');
	limit = '32768';
	now += 3000;
	await dashboard.refresh();
	assert.equal(dashboard.ctMax, 32768, 'Changed limit becomes visible after cache expires');
	assert.equal(calls.filter(c => c[0] === 'read' && c[1].includes('nf_conntrack_max')).length, 2);

	limit = '';
	now += 60000;
	await dashboard.refresh();
	assert.equal(dashboard.ctMax, 32768, 'A failed read keeps the last valid limit');
	limit = '65536';
	await dashboard.refresh();
	assert.equal(dashboard.ctMax, 65536, 'A failed read is retried at the next poll');

	const before = calls.length;
	await dashboard.fastTick();
	await realtime.tick();
	assert.ok(calls.length > before, 'Visible views resume live updates');

	const chartSource = source('lumen/streamchart.js').replace('return baseclass.extend({', 'return { tick, charts };\nreturn baseclass.extend({');
	let scheduled = 0, layouts = 0, frames = 0;
	const chart = new Function('baseclass', 'localStorage', 'requestAnimationFrame', 'innerHeight', chartSource)(
		{}, { getItem: () => null }, () => { scheduled++; }, 800);
	chart.charts.add({ el: { isConnected: true, getBoundingClientRect: () => { layouts++; return { top: 0, bottom: 100, width: 100 }; } }, frame: () => { frames++; } });
	for (let i = 1; i <= 120; i++) chart.tick(i * 1000 / 120);
	assert.ok(frames >= 25 && frames <= 31, `Expected approximately 30 draws per second, got ${frames}`);
	assert.equal(layouts, frames, 'Skipped frames do not trigger layout reads');
	assert.equal(scheduled, 120, 'The animation remains scheduled');
	console.log('Background polling, limit caching and chart rendering checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
