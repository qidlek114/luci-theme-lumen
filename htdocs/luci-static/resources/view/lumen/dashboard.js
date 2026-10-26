'use strict';
'require view';
'require rpc';
'require poll';
'require fs';
'require dom';
'require ui';
'require lumen.streamchart as sc';

const callSystemInfo = rpc.declare({ object: 'system', method: 'info' });
const callBoard = rpc.declare({ object: 'system', method: 'board' });
const callIfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { interface: [] } });
const callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', expect: { dhcp_leases: [] } });
const callRealtime = rpc.declare({ object: 'luci', method: 'getRealtimeStats', params: [ 'mode', 'device' ], expect: { result: [] } });
const callRealtimeMode = rpc.declare({ object: 'luci', method: 'getRealtimeStats', params: [ 'mode' ], expect: { result: [] } });

/* Lucide icons (ISC License) */
const ICON = {
	cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
	memory: '<path d="M6 19v-3"/><path d="M10 19v-3"/><path d="M14 19v-3"/><path d="M18 19v-3"/><path d="M8 11V9"/><path d="M16 11V9"/><path d="M12 11V9"/><path d="M2 15h20"/><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z"/>',
	conn: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
	users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
	plug: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
	terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
	package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
	logs: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
	globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
	save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
	power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
	flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
	wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.859a10 10 0 0 1 14 0"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/>',
	wake: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/>'
};

function svg(name) {
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>'.format(ICON[name]);
}

const ICON_TONE = { cpu: 'blue', memory: 'violet', conn: 'emerald', users: 'amber' };

function iconBox(name) {
	const el = E('div', { 'class': 'ds-card-icon tone-tile', 'data-tone': ICON_TONE[name] || 'slate' });
	el.innerHTML = svg(name);
	return el;
}

function fmtBytes(n) {
	const units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
	let i = 0;
	n = +n || 0;
	while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
	return '%s %s'.format(n >= 100 || i == 0 ? n.toFixed(0) : n.toFixed(1), units[i]);
}

const fmtRate = (v, step) => sc.fmtRate(v, step);

function fmtUptime(s) {
	const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
	return d ? _('%dd %dh').format(d, h) : (h ? _('%dh %dm').format(h, m) : _('%dm').format(m));
}

function fmtClock(epoch) {
	const t = new Date(epoch * 1000);
	const p = (v) => String(v).padStart(2, '0');
	return '%s-%s-%s %s:%s'.format(t.getUTCFullYear(), p(t.getUTCMonth() + 1), p(t.getUTCDate()), p(t.getUTCHours()), p(t.getUTCMinutes()));
}

function setBar(bar, pct) {
	bar.firstChild.style.width = '%.1f%%'.format(Math.min(100, Math.max(0, pct)));
	bar.classList.toggle('warn', pct >= 75 && pct < 90);
	bar.classList.toggle('crit', pct >= 90);
}

function avatarText(name) {
	const s = (name || '?').trim();
	return s ? s.charAt(0) : '?';
}

/* Use netifd's active default routes, including IPv6-only and renamed uplinks.
 * A conventional name is only a fallback when no default route is reported.
 * This is one interface's graph, not an aggregate of multiple WAN links. */
function selectUplink(ifaces) {
	const list = (ifaces || []).filter((i) => i && i.interface != 'loopback');
	const routed = [];

	list.forEach((iface) => {
		if (!iface.up || !(iface.l3_device || iface.device))
			return;

		(Array.isArray(iface.route) ? iface.route : []).forEach((route) => {
			if (Number(route.mask) !== 0 || ![ '0.0.0.0', '::', '0:0:0:0:0:0:0:0' ].includes(route.target))
				return;

			const metric = Number(route.metric ?? iface.metric ?? 0);
			routed.push({ iface: iface, metric: Number.isFinite(metric) ? metric : 0 });
		});
	});

	routed.sort((a, b) => a.metric - b.metric || String(a.iface.interface).localeCompare(String(b.iface.interface)));
	if (routed.length)
		return routed[0].iface;

	const conventional = list.filter((i) => i.interface == 'wan' || i.interface == 'wan6');
	return conventional.find((i) => i.up && (i.l3_device || i.device)) || conventional[0] || null;
}

return view.extend({
	cpuPrev: null,
	cpuPts: [],
	wanDevice: null,
	ctMax: 0,
	loadAvg: [ 0, 0, 0 ],

	load() {
		return Promise.all([
			L.resolveDefault(callBoard(), {}),
			L.resolveDefault(fs.read('/proc/stat'), ''),
			L.resolveDefault(ui.menu.load(), null)
		]);
	},

	render([ board, stat, menu ]) {
		/* display name / model overrides from Lumen → Appearance */
		const cfg = window.lumenConfig || {};
		board = Object.assign({}, board, { hostname: cfg.hostname || board.hostname, model: cfg.model || board.model });
		this.board = board;
		this.cores = (stat.match(/^cpu\d+ /mg) || []).length || 1;
		this.cpuPrev = this.parseCpu(stat);
		this.menu = menu;

		const n = this.nodes = {};
		const hour = new Date().getHours();
		const greet = hour < 6 ? _('Good night') : hour < 12 ? _('Good morning') : hour < 18 ? _('Good afternoon') : _('Good evening');

		const statCard = (key, title, icon) => {
			n[key + 'Value'] = E('div', { 'class': 'ds-value' }, [ '–' ]);
			n[key + 'Foot'] = E('div', { 'class': 'ds-foot' });
			n[key + 'Extra'] = E('div');
			return E('div', { 'class': 'ds-card' }, [
				E('div', { 'class': 'ds-card-head' }, [ E('p', { 'class': 'ds-card-title' }, [ title ]), iconBox(icon) ]),
				n[key + 'Value'],
				n[key + 'Extra'],
				n[key + 'Foot']
			]);
		};

		n.memBar = E('div', { 'class': 'ds-bar' }, [ E('div') ]);
		n.rootBar = E('div', { 'class': 'ds-bar' }, [ E('div') ]);
		n.tmpBar = E('div', { 'class': 'ds-bar' }, [ E('div') ]);

		n.wanPill = E('span', { 'class': 'ds-pill' }, [ E('span', { 'class': 'ds-dot' }), _('WAN') ]);
		n.uptimePill = E('span', { 'class': 'ds-pill' }, [ _('Up for') + ' ', E('b', {}, [ '–' ]) ]);
		n.clockPill = E('span', { 'class': 'ds-pill' }, [ E('b', {}, [ '–' ]) ]);

		n.rx = E('b', {}, [ '–' ]);
		n.tx = E('b', {}, [ '–' ]);
		n.chartSub = E('p', { 'class': 'ds-card-sub' }, [ 'WAN' ]);
		n.chart = E('div', { 'class': 'ds-chart' });

		n.ifaces = E('ul', { 'class': 'ds-list' });
		n.leases = E('ul', { 'class': 'ds-list' });
		n.leaseCount = E('p', { 'class': 'ds-card-sub' });

		n.storage = E('dl', { 'class': 'ds-kv' });

		const release = board.release || {};

		const view = E('div', { 'class': 'ds' }, [
			E('div', { 'class': 'ds-head' }, [
				E('div', {}, [
					E('h2', {}, [ _('%s, %s').format(greet, board.hostname || 'OpenWrt') ]),
					E('p', {}, [ [ board.model, release.description, board.kernel ? 'Linux ' + board.kernel : null ].filter(Boolean).join(' · ') ])
				]),
				E('div', { 'class': 'ds-meta' }, [ n.wanPill, n.uptimePill, n.clockPill ])
			]),

			E('div', { 'class': 'ds-grid ds-stats' }, [
				statCard('cpu', _('CPU usage'), 'cpu'),
				statCard('mem', _('Memory'), 'memory'),
				statCard('conn', _('Active connections'), 'conn'),
				statCard('dev', _('Online devices'), 'users')
			]),

			E('div', { 'class': 'ds-grid ds-row' }, [
				E('div', { 'class': 'ds-card' }, [
					E('div', { 'class': 'ds-card-head' }, [
						E('div', {}, [
							E('div', { 'class': 'ds-title-row' }, [ E('h3', { 'class': 'ds-card-title' }, [ _('Live traffic') ]), sc.unitSwitch() ]),
							n.chartSub
						]),
						E('div', { 'class': 'ds-chart-legend' }, [
							E('div', { 'class': 'ds-legend-item', 'style': '--c:hsl(var(--chart-1))' }, [ E('span', {}, [ _('Download') ]), n.rx ]),
							E('div', { 'class': 'ds-legend-item', 'style': '--c:hsl(var(--chart-2))' }, [ E('span', {}, [ _('Upload') ]), n.tx ])
						])
					]),
					n.chart
				]),
				E('div', { 'class': 'ds-card' }, [
					E('div', { 'class': 'ds-card-head' }, [
						E('h3', { 'class': 'ds-card-title' }, [ _('Network interfaces') ]),
						E('a', { 'class': 'ds-more', 'href': L.url('admin/network/network') }, [ _('Manage') + ' →' ])
					]),
					n.ifaces
				])
			]),

			E('div', { 'class': 'ds-grid ds-row-even' }, [
				E('div', { 'class': 'ds-card' }, [
					E('div', { 'class': 'ds-card-head' }, [
						E('div', {}, [ E('h3', { 'class': 'ds-card-title' }, [ _('Online devices') ]), n.leaseCount ]),
						E('a', { 'class': 'ds-more', 'href': L.url('admin/status/overview') }, [ _('All') + ' →' ])
					]),
					n.leases
				]),
				E('div', { 'class': 'ds-card' }, [
					E('div', { 'class': 'ds-card-head' }, [ E('h3', { 'class': 'ds-card-title' }, [ _('System') ]) ]),
					n.storage
				])
			]),

			this.renderLinks()
		]);

		this.nodes.root = view;

		n.cpuExtra.className = n.connExtra.className = 'ds-spark-box';
		this.cpuChart = sc.create(n.cpuExtra, { axes: false, scale: 'percent', max: 100, empty: '',
			series: [ { key: 'v', color: 'hsl(var(--chart-1))', fill: .28 } ] });
		this.connChart = sc.create(n.connExtra, { axes: false, scale: 'count', empty: '',
			series: [ { key: 'v', color: 'hsl(var(--chart-2))', fill: .3 } ] });
		this.trafficChart = sc.create(n.chart, { scale: 'rate',
			series: [ { key: 'rx', color: 'hsl(var(--chart-1))', fill: .35 }, { key: 'tx', color: 'hsl(var(--chart-2))' } ] });
		sc.onRateUnit(() => this.updateLegend());

		/* slow facts every 3 s, live series every second; the page renders
		   immediately and fills in as the first answers arrive */
		this.refresh().then(() => this.fastTick()).finally(() => {
			poll.add(() => this.refresh(), 3);
			poll.add(() => this.fastTick(), 1);
		});

		return view;
	},

	renderLinks() {
		const links = [
			[ 'admin/services/openclash', 'OpenClash', 'shield', 'violet' ],
			[ 'admin/network/xiaomi_mesh', _('Unified Wi-Fi'), 'wifi', 'sky' ],
			[ 'admin/network/network', _('Interfaces'), 'plug', 'blue' ],
			[ 'admin/network/firewall', _('Firewall'), 'flame', 'orange' ],
			[ 'admin/network/dhcp', 'DHCP', 'globe', 'teal' ],
			[ 'admin/services/ttyd', _('Terminal'), 'terminal', 'green' ],
			[ 'admin/services/wol', _('Wake on LAN'), 'wake', 'amber' ],
			[ 'admin/system/package-manager', _('Software'), 'package', 'indigo' ],
			[ 'admin/status/logs', _('System Log'), 'logs', 'slate' ],
			[ 'admin/system/flash', _('Backup / Upgrade'), 'save', 'emerald' ],
			[ 'admin/system/reboot', _('Reboot'), 'power', 'rose' ]
		].filter(([ path ]) => this.hasMenu(path));

		return E('div', { 'class': 'ds-card' }, [
			E('div', { 'class': 'ds-card-head' }, [ E('h3', { 'class': 'ds-card-title' }, [ _('Shortcuts') ]) ]),
			E('div', { 'class': 'ds-links' }, links.map(([ path, title, icon, tone ]) => {
				const a = E('a', { 'class': 'ds-link', 'href': L.url(path), 'data-tone': tone });
				const tile = E('span', { 'class': 'tone-tile' });
				tile.innerHTML = svg(icon);
				a.appendChild(tile);
				a.appendChild(E('span', {}, [ title ]));
				return a;
			}))
		]);
	},

	hasMenu(path) {
		if (!this.menu)
			return false;

		let node = this.menu;
		for (const part of path.split('/')) {
			node = node.children?.[part];
			if (!node)
				return false;
		}
		return true;
	},

	parseCpu(stat) {
		const m = (stat || '').match(/^cpu\s+(.+)$/m);
		if (!m)
			return null;

		const v = m[1].trim().split(/\s+/).map(Number);
		const idle = v[3] + (v[4] || 0);
		return { idle: idle, total: v.reduce((a, b) => a + b, 0) };
	},

	refresh() {
		return Promise.all([
			L.resolveDefault(callSystemInfo(), {}),
			L.resolveDefault(fs.read('/proc/sys/net/netfilter/nf_conntrack_max'), ''),
			L.resolveDefault(callIfaces(), []),
			L.resolveDefault(callLeases(), [])
		]).then(([ info, ctMax, ifaces, leases ]) => {
			this.ctMax = +ctMax || 0;
			this.loadAvg = info.load || this.loadAvg;
			this.updateMemory(info);
			this.updateDevices(leases);
			this.updateIfaces(ifaces);
			this.updateSystem(info);
		});
	},

	fastTick() {
		const device = this.wanDevice;
		return Promise.all([
			L.resolveDefault(fs.read('/proc/stat'), ''),
			L.resolveDefault(callRealtimeMode('conntrack'), []),
			device ? L.resolveDefault(callRealtime('interface', device), []) : null
		]).then(([ stat, ct, rt ]) => {
			this.updateCpu(stat);
			this.updateConn(ct);
			if (rt && device === this.wanDevice)
				this.ingestTraffic(rt);
		});
	},

	updateCpu(stat) {
		const n = this.nodes;
		const cur = this.parseCpu(stat);
		let pct = 0;

		if (cur && this.cpuPrev && cur.total > this.cpuPrev.total)
			pct = 100 * (1 - (cur.idle - this.cpuPrev.idle) / (cur.total - this.cpuPrev.total));

		this.cpuPrev = cur;
		this.cpuPts.push({ t: Date.now() / 1000, v: pct });
		if (this.cpuPts.length > 90) this.cpuPts.shift();
		this.cpuChart.push(this.cpuPts.slice());

		const load = this.loadAvg.map((l) => (l / 65536).toFixed(2));

		dom.content(n.cpuValue, [ pct.toFixed(1), E('small', {}, [ '%' ]) ]);
		dom.content(n.cpuFoot, [
			E('span', {}, [ _('%d cores').format(this.cores) ]),
			E('span', {}, [ _('Load %s').format(load[0]), E('span', { 'class': 'hide-narrow' }, [ ' / %s / %s'.format(load[1], load[2]) ]) ])
		]);
	},

	updateMemory(info) {
		const n = this.nodes;
		const mem = info.memory || {};
		const total = mem.total || 0;
		const avail = mem.available ?? ((mem.free || 0) + (mem.buffered || 0) + (mem.cached || 0));
		const used = Math.max(0, total - avail);
		const pct = total ? 100 * used / total : 0;

		dom.content(n.memValue, [ pct.toFixed(1), E('small', {}, [ '%' ]) ]);
		if (!n.memExtra.firstChild) n.memExtra.appendChild(n.memBar);
		setBar(n.memBar, pct);
		dom.content(n.memFoot, [ E('span', {}, [ _('Used %s').format(fmtBytes(used)) ]), E('span', {}, [ _('Total %s').format(fmtBytes(total)) ]) ]);
	},

	/* luci-bwc conntrack samples: [ time, udp, tcp, other ] */
	updateConn(ct) {
		const n = this.nodes;
		const pts = (ct || []).map((r) => ({ t: r[0], v: r[1] + r[2] + r[3] }));

		if (!pts.length)
			return;

		this.connChart.push(pts);

		const count = pts[pts.length - 1].v, max = this.ctMax;

		dom.content(n.connValue, [ String(count) ]);
		dom.content(n.connFoot, [ E('span', {}, [ _('Limit %d').format(max) ]), E('span', {}, [ max ? '%.1f%%'.format(100 * count / max) : '' ]) ]);
	},

	updateDevices(leases) {
		const n = this.nodes;
		const list = (leases || []).slice().sort((a, b) =>
			(!a.hostname - !b.hostname) || (a.hostname || a.ipaddr || '').localeCompare(b.hostname || b.ipaddr || '', undefined, { numeric: true }));

		dom.content(n.devValue, [ String(list.length) ]);
		dom.content(n.devFoot, [ E('span', {}, [ _('DHCP leases') ]) ]);
		dom.content(n.leaseCount, [ _('%d devices').format(list.length) ]);

		dom.content(n.leases, list.length ? list.slice(0, 7).map((l) => E('li', {}, [
			E('div', { 'class': 'ds-avatar' }, [ avatarText(l.hostname) ]),
			E('div', { 'class': 'ds-li-main' }, [
				E('div', { 'class': 'ds-li-title' }, [ l.hostname || _('Unknown device') ]),
				E('div', { 'class': 'ds-li-sub' }, [ l.macaddr || '' ])
			]),
			E('div', { 'class': 'ds-li-side' }, [ l.ipaddr || '' ])
		])) : E('li', {}, [ E('span', { 'class': 'ds-li-sub' }, [ _('No devices') ]) ]));
	},

	updateIfaces(ifaces) {
		const n = this.nodes;
		const list = (ifaces || []).filter((i) => i.interface != 'loopback');
		const wan = selectUplink(list);

		this.wanDevice = wan && wan.up ? (wan.l3_device || wan.device) : null;

		n.wanPill.firstChild.classList.toggle('off', !(wan && wan.up));
		n.wanPill.lastChild.textContent = wan ? (wan.up ? _('WAN connected') : _('WAN disconnected')) : _('No WAN interface');
		dom.content(n.chartSub, [ this.wanDevice ? _('%s · last %s').format(this.wanDevice, _('a few minutes')) : _('No WAN interface found') ]);

		dom.content(n.ifaces, list.map((i) => {
			const v4 = i['ipv4-address']?.[0];
			const v6 = i['ipv6-address']?.[0] || i['ipv6-prefix-assignment']?.[0];
			const addr = v4 ? '%s/%d'.format(v4.address, v4.mask) : (v6 ? '%s/%d'.format(v6.address, v6.mask) : (i.l3_device || i.device || '—'));

			return E('li', {}, [
				E('div', { 'class': 'ds-li-main' }, [
					E('div', { 'class': 'ds-li-title' }, [ i.interface.toUpperCase() ]),
					E('div', { 'class': 'ds-li-sub' }, [ '%s · %s'.format(i.proto || '—', addr) ])
				]),
				E('span', { 'class': 'ds-badge ' + (i.up ? 'up' : 'down') }, [ i.up ? (i.uptime ? fmtUptime(i.uptime) : _('Online')) : _('Offline') ])
			]);
		}));
	},

	updateSystem(info) {
		const n = this.nodes;
		const root = info.root || {}, tmp = info.tmp || {};
		const rootPct = root.total ? 100 * root.used / root.total : 0;
		const tmpPct = tmp.total ? 100 * tmp.used / tmp.total : 0;
		const release = this.board.release || {};

		n.uptimePill.lastChild.textContent = fmtUptime(info.uptime || 0);
		n.clockPill.lastChild.textContent = info.localtime ? fmtClock(info.localtime) : '–';

		if (!n.storage.firstChild) {
			const row = (k, v) => [ E('dt', {}, [ k ]), E('dd', {}, [ v ]) ];
			n.rootText = E('dd');
			n.tmpText = E('dd');

			dom.content(n.storage, [].concat(
				row(_('Model'), this.board.model || '—'),
				row(_('Processor'), this.board.system || '—'),
				row(_('Firmware'), release.description || '—'),
				row(_('Kernel'), this.board.kernel || '—'),
				[ E('dt', {}, [ _('System storage') ]), n.rootText ],
				[ E('dd', { 'style': 'grid-column:1/-1;margin-top:-.5rem' }, [ n.rootBar ]) ],
				[ E('dt', {}, [ _('Temporary space') ]), n.tmpText ],
				[ E('dd', { 'style': 'grid-column:1/-1;margin-top:-.5rem' }, [ n.tmpBar ]) ]
			));
		}

		n.rootText.textContent = '%s / %s'.format(fmtBytes(root.used * 1024), fmtBytes(root.total * 1024));
		n.tmpText.textContent = '%s / %s'.format(fmtBytes(tmp.used * 1024), fmtBytes(tmp.total * 1024));
		setBar(n.rootBar, rootPct);
		setBar(n.tmpBar, tmpPct);
	},

	/* turn luci-bwc's cumulative counters into per-second rates keyed by time */
	ingestTraffic(rt) {
		const pts = [];

		for (let i = 1; i < rt.length; i++) {
			const dt = rt[i][0] - rt[i - 1][0];
			if (dt <= 0) continue;
			pts.push({
				t: rt[i][0],
				rx: Math.max(0, (rt[i][1] - rt[i - 1][1]) / dt),
				tx: Math.max(0, (rt[i][3] - rt[i - 1][3]) / dt)
			});
		}

		if (pts.length < 2)
			return;

		this.series = pts;
		this.trafficChart.push(pts);
		this.updateLegend();
	},

	updateLegend() {
		const n = this.nodes;
		const p = this.series?.[this.series.length - 1];

		if (!p)
			return;

		const r = fmtRate(p.rx), t = fmtRate(p.tx);
		dom.content(n.rx, [ r[0], E('small', {}, [ r[1] ]) ]);
		dom.content(n.tx, [ t[0], E('small', {}, [ t[1] ]) ]);
		dom.content(n.chartSub, [ _('%s · last 60 s').format(this.wanDevice) ]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
