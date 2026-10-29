'use strict';
'require baseclass';

/*
 * Streaming SVG line charts for the Lumen theme.
 *
 * Every chart renders on one shared requestAnimationFrame loop: the time axis
 * runs at wall-clock speed one sample behind the newest data (so new points
 * slide in from the right), the y-range eases towards a "nice" maximum, and
 * curves use monotone cubic interpolation so they never overshoot.
 */

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/* ------------------------------------------------------------------ units */

let RATE_UNIT = 'bit';
try { RATE_UNIT = (localStorage.getItem('lumen-rate-unit') == 'byte') ? 'byte' : 'bit'; } catch (e) {}

const rateListeners = new Set();

function rateUnits() {
	return (RATE_UNIT == 'byte')
		? { mul: 1, base: 1024, units: [ 'B/s', 'KB/s', 'MB/s', 'GB/s' ] }
		: { mul: 8, base: 1000, units: [ 'bps', 'Kbps', 'Mbps', 'Gbps' ] };
}

/* step pins the unit (used on axes so every label shares one unit) */
function fmtRate(bytesPerSec, step) {
	const u = rateUnits();
	let n = (+bytesPerSec || 0) * u.mul;
	let i = 0;

	if (step != null) {
		n /= Math.pow(u.base, step);
		i = step;
	}
	else {
		while (n >= u.base && i < u.units.length - 1) { n /= u.base; i++; }
	}

	return [ n >= 100 || i == 0 ? n.toFixed(0) : n.toFixed(n >= 10 ? 1 : 2), u.units[i] ];
}

function niceMax(v) {
	if (!(v > 0)) return 1;
	const m = Math.pow(10, Math.floor(Math.log10(v)));
	for (const f of [ 1, 2, 2.5, 5, 10 ])
		if (f * m >= v - 1e-9) return f * m;
	return 10 * m;
}

const trim = (v, d) => String(+(+v).toFixed(d));

/* top of scale chosen so each quarter is a round step (…, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, …) */
function niceQuarters(v) {
	const raw = (v > 0 ? v : 1) / 4;
	const m = Math.pow(10, Math.floor(Math.log10(raw)));
	for (const f of [ 1, 2, 2.5, 3, 4, 5, 8, 10 ])
		if (f * m >= raw - 1e-12) return f * m * 4;
	return 40 * m;
}

/* y-scale per kind of data: a "nice" top value plus a label formatter */
const SCALES = {
	rate(peak) {
		const u = rateUnits();
		let p = peak * 1.15 * u.mul, step = 0;
		while (p >= u.base && step < u.units.length - 1) { p /= u.base; step++; }
		return {
			max: niceMax(p) * Math.pow(u.base, step) / u.mul,
			label: (v) => { const r = fmtRate(v, step); return '%s %s'.format(trim(r[0], 2), r[1]); },
			key: RATE_UNIT
		};
	},
	count(peak) {
		return {
			max: niceQuarters(Math.max(peak * 1.1, 4)),
			label: (v) => (v >= 1000) ? trim(v / 1000, 1) + 'k' : trim(v, 0)
		};
	},
	load(peak) {
		return { max: niceQuarters(Math.max(peak * 1.1, .2)), label: (v) => trim(v, 2) };
	},
	percent() {
		return { max: 100, label: (v) => trim(v, 0) + '%' };
	}
};

/* Fritsch–Carlson monotone cubic: smooth, never overshoots between samples */
function smoothPath(p) {
	const n = p.length;
	if (n < 2) return '';

	const dx = [], m = [], t = [];
	for (let i = 0; i < n - 1; i++) {
		dx[i] = p[i + 1][0] - p[i][0] || 1e-6;
		m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
	}
	t[0] = m[0]; t[n - 1] = m[n - 2];
	for (let i = 1; i < n - 1; i++)
		t[i] = (m[i - 1] * m[i] <= 0) ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);

	let d = 'M%.1f %.1f'.format(p[0][0], p[0][1]);
	for (let i = 0; i < n - 1; i++) {
		const h = dx[i] / 3;
		d += 'C%.1f %.1f %.1f %.1f %.1f %.1f'.format(p[i][0] + h, p[i][1] + t[i] * h, p[i + 1][0] - h, p[i + 1][1] - t[i + 1] * h, p[i + 1][0], p[i + 1][1]);
	}
	return d;
}

function mk(tag, attrs, parent) {
	const node = document.createElementNS(NS, tag);
	for (const k in attrs) node.setAttribute(k, attrs[k]);
	parent?.appendChild(node);
	return node;
}

/* ------------------------------------------------------------------ chart */

const charts = new Set();
let looping = false;
let lastDraw = 0;
const FRAME_INTERVAL = 1000 / 30;

function tick(now) {
	/* Samples arrive once per second. Limit layout and SVG work to 30 fps. */
	if (now - lastDraw < FRAME_INTERVAL - 1) {
		if (charts.size) requestAnimationFrame(tick);
		else looping = false;
		return;
	}
	lastDraw = now;

	for (const c of charts) {
		if (!c.el.isConnected) {
			if (c.attached) charts.delete(c);
			continue;
		}

		c.attached = true;

		/* skip work for charts scrolled out of view or in hidden tabs */
		const r = c.el.getBoundingClientRect();
		if (r.bottom < 0 || r.top > innerHeight || r.width == 0) {
			c.last = now;
			continue;
		}

		c.frame(now);
	}

	if (charts.size)
		requestAnimationFrame(tick);
	else
		looping = false;
}

class Chart {
	constructor(el, opts) {
		this.el = el;
		this.o = Object.assign({ window: 60, axes: true, scale: 'count', dots: true, series: [] }, opts);
		this.id = 'sc' + (++uid);
		this.pts = null;
		this.max = 0;
		this.last = performance.now();

		const o = this.o;
		this.pad = o.axes
			? { l: (o.scale == 'rate') ? 68 : 44, r: 8, t: 8, b: 22 }
			: { l: 0, r: 4, t: 5, b: 3 };

		const svg = this.svg = mk('svg', { 'class': o.axes ? 'sc-chart' : 'sc-chart sc-spark', 'preserveAspectRatio': 'none' });
		const defs = mk('defs', {}, svg);
		const clip = mk('clipPath', { id: this.id + 'c' }, defs);
		this.clipRect = mk('rect', {}, clip);

		this.grid = mk('g', { 'class': 'sc-grid' }, svg);
		this.axis = mk('g', { 'class': 'sc-axis' }, svg);
		const plot = mk('g', { 'clip-path': 'url(#%sc)'.format(this.id) }, svg);

		this.lines = o.series.map((s, i) => {
			const gid = '%sg%d'.format(this.id, i);
			const g = mk('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
			mk('stop', { offset: 0, style: 'stop-color:%s;stop-opacity:%s'.format(s.color, s.fill ?? .3) }, g);
			mk('stop', { offset: 1, style: 'stop-color:%s;stop-opacity:0'.format(s.color) }, g);

			return {
				s: s,
				area: (s.area !== false) ? mk('path', { style: 'fill:url(#%s)'.format(gid) }, plot) : null,
				line: mk('path', { 'class': 'sc-line', style: 'stroke:%s;stroke-width:%s'.format(s.color, s.width || (o.axes ? 1.75 : 1.5)) }, plot),
				dot: o.dots ? mk('circle', { r: o.axes ? 3 : 2.5, 'class': 'sc-dot', style: 'fill:%s'.format(s.color) }, svg) : null
			};
		});

		/* stacked draw order: later series are drawn first so the first stays on top */
		this.lines.slice().reverse().forEach((l) => { if (l.area) plot.appendChild(l.area); });
		this.lines.slice().reverse().forEach((l) => plot.appendChild(l.line));

		this.empty = E('div', { 'class': 'ds-empty' }, [ o.empty || _('Collecting data…') ]);
		el.replaceChildren(this.empty);

		charts.add(this);
		if (!looping) {
			looping = true;
			requestAnimationFrame(tick);
		}
	}

	/* replace the data: an array of { t: seconds, <key>: value, ... } in time order */
	push(pts) {
		if (!pts || pts.length < 2)
			return;

		const last = pts[pts.length - 1].t;
		if (!this.pts || last !== this.lastT) {
			this.lastT = last;
			this.arrived = performance.now();
		}

		this.pts = pts;
	}

	invalidate() {
		this.ticksKey = '';
	}

	frame(now) {
		const o = this.o, pts = this.pts;

		if (!pts)
			return;

		if (this.svg.parentNode !== this.el)
			this.el.replaceChildren(this.svg);

		const W = this.el.clientWidth || 300, H = this.el.clientHeight || 120;
		const P = this.pad, plotW = W - P.l - P.r, plotH = H - P.t - P.b;

		if (W !== this.W || H !== this.H) {
			this.svg.setAttribute('viewBox', '0 0 %d %d'.format(W, H));
			this.clipRect.setAttribute('x', P.l);
			this.clipRect.setAttribute('y', 0);
			this.clipRect.setAttribute('width', Math.max(0, plotW));
			this.clipRect.setAttribute('height', H);
			this.W = W; this.H = H; this.ticksKey = '';
		}

		/* time axis: wall-clock speed, eased towards the data clock, never backwards */
		const dt = Math.min(now - this.last, 100);
		this.last = now;
		const elapsed = Math.min((now - this.arrived) / 1000, 1.5);
		const want = this.lastT + elapsed - 1;
		if (this.tEnd == null || Math.abs(want - this.tEnd) > 3)
			this.tEnd = want;
		else
			this.tEnd += dt / 1000 + (want - this.tEnd) * (1 - Math.exp(-dt / 600));

		const tStart = this.tEnd - o.window;
		const x = (t) => P.l + (t - tStart) / o.window * plotW;
		const visible = pts.filter((p) => p.t >= tStart - 2);

		if (visible.length < 2)
			return;

		/* y-range eases towards a nice target */
		let peak = 0;
		for (const p of visible) for (const l of this.lines) peak = Math.max(peak, +p[l.s.key] || 0);
		const sc = SCALES[o.scale](peak);
		const target = o.max ?? sc.max;
		this.max = this.max ? this.max + (target - this.max) * (1 - Math.exp(-dt / 220)) : target;
		const y = (v) => P.t + plotH * (1 - Math.min((+v || 0) / this.max, 1.02));

		if (o.axes) {
			const key = '%s|%s|%d|%d'.format(target, sc.key || '', W, H);
			if (key !== this.ticksKey) {
				this.ticksKey = key;
				this.ticks = [ 0, 1, 2, 3, 4 ].map((k) => ({
					v: target * k / 4,
					line: mk('line', { x1: P.l, x2: W - P.r }),
					text: mk('text', { x: P.l - 8, 'text-anchor': 'end', 'dominant-baseline': 'middle' })
				}));
				this.ticks.forEach((tk) => { tk.text.textContent = sc.label(tk.v); });
				this.grid.replaceChildren(...this.ticks.map((tk) => tk.line));
				const t0 = mk('text', { x: P.l, y: H - 4 });
				t0.textContent = _('-%ds').format(o.window);
				const t1 = mk('text', { x: W - P.r, y: H - 4, 'text-anchor': 'end' });
				t1.textContent = _('Now');
				this.axis.replaceChildren(...this.ticks.map((tk) => tk.text), t0, t1);
			}

			for (const tk of this.ticks) {
				const yy = y(tk.v).toFixed(1);
				tk.line.setAttribute('y1', yy); tk.line.setAttribute('y2', yy);
				tk.text.setAttribute('y', yy);
			}
		}

		const base = y(0), edge = P.l + plotW;

		for (const l of this.lines) {
			const k = l.s.key;
			const pp = visible.map((p) => [ x(p.t), y(p[k]) ]);
			const d = smoothPath(pp);

			l.line.setAttribute('d', d);
			l.area?.setAttribute('d', d + 'L%.1f %.1fL%.1f %.1fZ'.format(pp[pp.length - 1][0], base, pp[0][0], base));

			if (l.dot) {
				let yy = pp[pp.length - 1][1];
				for (let i = visible.length - 1; i > 0; i--) {
					const xa = pp[i - 1][0], xb = pp[i][0];
					if (xa <= edge && xb >= edge) {
						yy = pp[i - 1][1] + (pp[i][1] - pp[i - 1][1]) * ((edge - xa) / ((xb - xa) || 1));
						break;
					}
				}
				l.dot.setAttribute('cx', edge);
				l.dot.setAttribute('cy', yy.toFixed(1));
			}
		}
	}
}

return baseclass.extend({
	create(el, opts) { return new Chart(el, opts); },

	fmtRate: fmtRate,
	niceMax: niceMax,

	getRateUnit() { return RATE_UNIT; },
	setRateUnit(unit) {
		RATE_UNIT = (unit == 'byte') ? 'byte' : 'bit';
		try { localStorage.setItem('lumen-rate-unit', RATE_UNIT); } catch (e) {}
		for (const c of charts) c.invalidate();
		rateListeners.forEach((fn) => fn(RATE_UNIT));
	},
	onRateUnit(fn) { rateListeners.add(fn); },

	/* bps / B/s segmented switch, shared by every traffic chart */
	unitSwitch() {
		const seg = E('div', { 'class': 'ds-seg', 'role': 'radiogroup', 'aria-label': _('Traffic unit') });
		const sync = () => seg.querySelectorAll('button').forEach((b) => {
			b.classList.toggle('active', b.dataset.unit == RATE_UNIT);
			b.setAttribute('aria-checked', String(b.dataset.unit == RATE_UNIT));
		});

		[ [ 'bit', 'bps' ], [ 'byte', 'B/s' ] ].forEach(([ unit, label ]) => {
			seg.appendChild(E('button', {
				'type': 'button', 'role': 'radio', 'data-unit': unit,
				'click': () => this.setRateUnit(unit)
			}, [ label ]));
		});

		this.onRateUnit(sync);
		sync();
		return seg;
	}
});
