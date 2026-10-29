'use strict';
'require view';
'require rpc';
'require poll';
'require dom';
'require lumen.streamchart as sc';

/*
 * Realtime graphs (load / bandwidth / connections) on the shared streaming
 * chart. One view serves all three menu entries; the mode comes from the URL.
 */

const callRealtime = rpc.declare({ object: 'luci', method: 'getRealtimeStats', params: [ 'mode', 'device' ], expect: { result: [] } });
const callRealtimeMode = rpc.declare({ object: 'luci', method: 'getRealtimeStats', params: [ 'mode' ], expect: { result: [] } });
const callDevices = rpc.declare({ object: 'luci-rpc', method: 'getNetworkDevices', expect: { '': {} } });
const callHostHints = rpc.declare({ object: 'luci-rpc', method: 'getHostHints', expect: { '': {} } });
const callConntrack = rpc.declare({ object: 'luci', method: 'getConntrackList', expect: { result: [] } });

const WINDOW = 240;

const MODES = {
	load: {
		title: _('System load'),
		descr: _('Load average is the number of tasks waiting for the CPU over time. Values that stay above the core count mean the system is busy.'),
		scale: 'load',
		series: [
			{ key: 'l1', name: _('1 min'), color: 'hsl(var(--chart-1))', fill: .3 },
			{ key: 'l5', name: _('5 min'), color: 'hsl(var(--chart-3))', fill: .18 },
			{ key: 'l15', name: _('15 min'), color: 'hsl(var(--chart-4))', fill: .12 }
		],
		fmt: (v) => (+v).toFixed(2),
		rows: (rt) => rt.map((r) => ({ t: r[0], l1: r[1] / 100, l5: r[2] / 100, l15: r[3] / 100 }))
	},
	connections: {
		title: _('Connection count'),
		descr: _('Active connections in the connection tracking table, by protocol.'),
		scale: 'count',
		series: [
			{ key: 'tcp', name: 'TCP', color: 'hsl(var(--chart-1))', fill: .3 },
			{ key: 'udp', name: 'UDP', color: 'hsl(var(--chart-2))', fill: .22 },
			{ key: 'other', name: _('Other'), color: 'hsl(var(--chart-4))', fill: .15 }
		],
		fmt: (v) => String(Math.round(v)),
		rows: (rt) => rt.map((r) => ({ t: r[0], udp: r[1], tcp: r[2], other: r[3] }))
	},
	bandwidth: {
		title: _('Live traffic'),
		descr: _('Live receive and transmit rates of each network interface.'),
		scale: 'rate',
		series: [
			{ key: 'rx', name: _('Download'), color: 'hsl(var(--chart-1))', fill: .35 },
			{ key: 'tx', name: _('Upload'), color: 'hsl(var(--chart-2))', fill: .25 }
		],
		fmt: (v) => { const r = sc.fmtRate(v); return r[0] + ' ' + r[1]; },
		rows: (rt) => {
			const out = [];
			for (let i = 1; i < rt.length; i++) {
				const dt = rt[i][0] - rt[i - 1][0];
				if (dt <= 0) continue;
				out.push({ t: rt[i][0], rx: Math.max(0, (rt[i][1] - rt[i - 1][1]) / dt), tx: Math.max(0, (rt[i][3] - rt[i - 1][3]) / dt) });
			}
			return out;
		}
	}
};

function fmtBytes(n) {
	const u = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
	let i = 0;
	n = +n || 0;
	while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
	return '%s %s'.format(n >= 100 || i == 0 ? n.toFixed(0) : n.toFixed(1), u[i]);
}

/* devices worth graphing first: the uplink, the LAN bridge, then physical ports */
function deviceRank(name) {
	if (/^pppoe-|^wan/.test(name)) return 0;
	if (/^br-/.test(name)) return 1;
	if (/^eth|^lan/.test(name)) return 2;
	return 3;
}

return view.extend({
	load() {
		const requested = L.env.dispatchpath[L.env.dispatchpath.length - 1];
		const mode = Object.prototype.hasOwnProperty.call(MODES, requested) ? requested : 'load';

		return Promise.all([
			mode,
			(mode == 'bandwidth') ? L.resolveDefault(callDevices(), {}) : null,
			(mode == 'connections') ? L.resolveDefault(callHostHints(), {}) : null
		]);
	},

	render([ mode, devices, hints ]) {
		const M = this.M = MODES[mode] || MODES.load;

		this.mode = mode;
		this.hints = hints || {};
		this.legend = E('div', { 'class': 'rt-legend' });
		this.chartEl = E('div', { 'class': 'rt-chart' });

		const headRight = [];
		const top = [];

		if (mode == 'bandwidth') {
			const names = Object.keys(devices || {}).filter((n) => n != 'lo').sort((a, b) => deviceRank(a) - deviceRank(b) || a.localeCompare(b));
			let saved = null;
			try { saved = localStorage.getItem('lumen-bw-dev'); } catch (e) {}
			this.device = names.includes(saved) ? saved : names[0];

			top.push(E('div', { 'class': 'rt-devices', 'role': 'tablist' }, names.map((name) => E('button', {
				'type': 'button',
				'role': 'tab',
				'class': 'rt-chip' + (name == this.device ? ' active' : ''),
				'click': (ev) => this.selectDevice(name, ev.currentTarget)
			}, [ name ]))));

			headRight.push(sc.unitSwitch());
			sc.onRateUnit(() => this.renderLegend());
		}

		this.chart = this.makeChart();

		const card = E('div', { 'class': 'ds-card rt-card' }, [
			E('div', { 'class': 'rt-head' }, [
				E('div', {}, [
					E('div', { 'class': 'ds-title-row' }, [ E('h3', { 'class': 'ds-card-title' }, [ M.title ]) ].concat(headRight)),
					this.sub = E('p', { 'class': 'ds-card-sub' }, [ _('Last %d min · updated every second').format(WINDOW / 60) ])
				]),
				this.legend
			]),
			this.chartEl
		]);

		const nodes = [
			E('h2', {}, [ { load: _('Load'), bandwidth: _('Traffic'), connections: _('Connections') }[mode] || M.title ]),
			E('div', { 'class': 'cbi-map-descr' }, [ M.descr ])
		].concat(top, [ card ]);

		if (mode == 'connections') {
			this.connTable = E('table', { 'class': 'table rt-conn' });
			nodes.push(E('div', { 'class': 'ds-card' }, [
				E('div', { 'class': 'rt-head' }, [
					E('div', {}, [
						E('h3', { 'class': 'ds-card-title' }, [ _('Active connections') ]),
						this.connSub = E('p', { 'class': 'ds-card-sub' }, [ _('Sorted by traffic, up to 100 shown') ])
					])
				]),
				E('div', { 'class': 'rt-table-wrap' }, [ this.connTable ])
			]));
		}

		this.tick().finally(() => {
			poll.add(() => this.tick(), 1);
			if (mode == 'connections') {
				this.refreshConnections();
				poll.add(() => this.refreshConnections(), 3);
			}
		});

		return E('div', { 'class': 'rt' }, nodes);
	},

	makeChart() {
		return sc.create(this.chartEl, { window: WINDOW, scale: this.M.scale, series: this.M.series });
	},

	selectDevice(name, btn) {
		this.device = name;
		try { localStorage.setItem('lumen-bw-dev', name); } catch (e) {}
		btn.parentNode.querySelectorAll('.rt-chip').forEach((b) => b.classList.toggle('active', b === btn));
		this.pts = null;
		this.chart = this.makeChart();
		this.renderLegend();
		this.tick();
	},

	tick() {
		if (document.hidden)
			return Promise.resolve();

		const req = (this.mode == 'bandwidth')
			? (this.device ? callRealtime('interface', this.device) : Promise.resolve([]))
			: callRealtimeMode(this.mode == 'connections' ? 'conntrack' : 'load');
		const device = this.device;

		return L.resolveDefault(req, []).then((rt) => {
			if (device !== this.device)
				return;

			this.pts = this.M.rows(rt || []);
			this.chart.push(this.pts);
			this.renderLegend();
		});
	},

	/* current value plus average and peak over the visible window */
	renderLegend() {
		const M = this.M, pts = this.pts || [];
		const recent = pts.filter((p) => p.t >= (pts.length ? pts[pts.length - 1].t : 0) - WINDOW);

		dom.content(this.legend, M.series.map((s) => {
			const vals = recent.map((p) => +p[s.key] || 0);
			const cur = vals.length ? vals[vals.length - 1] : null;
			const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
			const peak = vals.length ? Math.max(...vals) : null;
			const f = (v) => (v == null) ? '–' : M.fmt(v);
			const split = f(cur).split(' ');

			return E('div', { 'class': 'rt-legend-item', 'style': '--c:' + s.color }, [
				E('span', { 'class': 'rt-name' }, [ s.name ]),
				E('b', {}, [ split[0], split[1] ? E('small', {}, [ split[1] ]) : '' ]),
				E('span', { 'class': 'rt-stats' }, [ _('avg %s · peak %s').format(f(avg), f(peak)) ])
			]);
		}));
	},

	refreshConnections() {
		if (document.hidden)
			return Promise.resolve();

		return L.resolveDefault(callConntrack(), []).then((list) => {
			const hosts = new Map();
			Object.values(this.hints).forEach((host) => {
				[ ...(host.ipaddrs || []), ...(host.ip6addrs || []) ].forEach((ip) => {
					if (!hosts.has(ip)) hosts.set(ip, host);
				});
			});
			const name = (ip) => {
				const h = hosts.get(ip);
				return h?.name ? E('span', { 'class': 'rt-host' }, [ h.name, E('small', {}, [ ip ]) ]) : ip;
			};
			const rows = (list || []).slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 100);

			dom.content(this.connSub, [ _('%d total, top %d by traffic').format((list || []).length, rows.length) ]);
			dom.content(this.connTable, [
				E('tr', { 'class': 'tr table-titles' }, [ _('Protocol'), _('Source'), _('Destination'), _('Traffic'), _('Packets') ].map((t) => E('th', { 'class': 'th' }, [ t ])))
			].concat(rows.map((c) => E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ E('span', { 'class': 'rt-proto rt-' + (c.layer4 || 'other') }, [ '%s %s'.format((c.layer3 || '').replace('ipv', 'v'), (c.layer4 || '').toUpperCase()) ]) ]),
				E('td', { 'class': 'td rt-addr' }, [ name(c.src), c.sport ? E('small', {}, [ ':' + c.sport ]) : '' ]),
				E('td', { 'class': 'td rt-addr' }, [ name(c.dst), c.dport ? E('small', {}, [ ':' + c.dport ]) : '' ]),
				E('td', { 'class': 'td rt-num' }, [ fmtBytes(c.bytes) ]),
				E('td', { 'class': 'td rt-num' }, [ String(c.packets || 0) ])
			]))));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
