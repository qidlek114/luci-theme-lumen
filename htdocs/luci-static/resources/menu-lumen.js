'use strict';
'require baseclass';
'require ui';

/* Lucide icons (ISC License), keyed by top-level menu node name */
const ICONS = {
	lumen: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
	dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
	status: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
	system: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
	services: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
	network: '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
	vpn: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
	nas: '<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>',
	statistics: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
	docker: '<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/>',
	logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
	_default: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>',
	_chevron: '<path d="m9 18 6-6-6-6"/>'
};

function icon(name, cls) {
	const span = E('span', { 'class': cls || 'sb-icon', 'data-icon': ICONS[name] ? name : '_default' });
	span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>'
		.format(ICONS[name] || ICONS._default);
	return span;
}

const EMPTY_TEXT = [ '', '-', '—', '?', 'none', _('none') ];
const INTERACTIVE = 'input:not([type="hidden"]), select, textarea, button, .cbi-dropdown, .cbi-checkbox, img';

/* a cell is a placeholder only if it holds no elements at all, or a lone <em>none</em> */
function isEmptyCell(td) {
	const kids = td.children;

	if (td.querySelector(INTERACTIVE))
		return false;

	if (kids.length > 1 || (kids.length == 1 && (kids[0].tagName != 'EM' || kids[0].children.length)))
		return false;

	return EMPTY_TEXT.includes(td.textContent.trim());
}

/* hide table columns in which every row is an empty placeholder */
function collapseEmptyColumns(root) {
	root.querySelectorAll('table.table, div.table').forEach((table) => {
		const own = Array.from(table.querySelectorAll('.tr')).filter((tr) => tr.closest('.table') === table);
		const rows = own.filter((tr) => !tr.classList.contains('placeholder') && tr.querySelector(':scope > .td'));
		const heads = own.filter((tr) => !rows.includes(tr));

		table.querySelectorAll('.col-empty').forEach((el) => el.classList.remove('col-empty'));

		if (rows.length < 2)
			return;

		const width = Math.max(...rows.map((r) => r.children.length));

		for (let i = 0; i < width; i++) {
			const cells = rows.map((r) => r.children[i]).filter(Boolean);

			if (!cells.length || !cells.every(isEmptyCell))
				continue;

			cells.forEach((td) => td.classList.add('col-empty'));
			heads.forEach((tr) => tr.children[i]?.classList.add('col-empty'));
		}
	});
}

/* ttyd (1.7+) reads client options from the URL: hand it a palette matching the theme */
const TERM_THEMES = {
	dark: {
		background: '#101012', foreground: '#e4e4e7', cursor: '#fafafa', cursorAccent: '#101012', selectionBackground: '#3f3f46',
		black: '#27272a', red: '#f87171', green: '#4ade80', yellow: '#facc15', blue: '#60a5fa', magenta: '#c084fc', cyan: '#22d3ee', white: '#e4e4e7',
		brightBlack: '#71717a', brightRed: '#fca5a5', brightGreen: '#86efac', brightYellow: '#fde047', brightBlue: '#93c5fd', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#fafafa'
	},
	light: {
		background: '#ffffff', foreground: '#18181b', cursor: '#18181b', cursorAccent: '#ffffff', selectionBackground: '#e4e4e7',
		black: '#18181b', red: '#dc2626', green: '#16a34a', yellow: '#a16207', blue: '#2563eb', magenta: '#9333ea', cyan: '#0e7490', white: '#71717a',
		brightBlack: '#52525b', brightRed: '#ef4444', brightGreen: '#22c55e', brightYellow: '#ca8a04', brightBlue: '#3b82f6', brightMagenta: '#a855f7', brightCyan: '#0891b2', brightWhite: '#3f3f46'
	}
};

function themeTerminal(view) {
	if (!/^admin-services-ttyd/.test(document.body.dataset.page || ''))
		return;

	const frame = view.querySelector('iframe');
	const dark = document.documentElement.getAttribute('data-darkmode') == 'true';
	const mode = dark ? 'dark' : 'light';

	if (!frame || frame.dataset.themed == mode)
		return;

	const url = new URL(frame.getAttribute('src'), location.href);
	url.searchParams.set('theme', JSON.stringify(TERM_THEMES[mode]));
	url.searchParams.set('fontSize', '13');
	url.searchParams.set('fontFamily', '"Geist Mono", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace');
	url.searchParams.set('lineHeight', '1.2');
	url.searchParams.set('titleFixed', document.title.split(' | ')[0] + ' · ' + _('Terminal'));

	frame.dataset.themed = mode;
	frame.classList.add('term-frame');
	frame.removeAttribute('style');
	frame.src = url.toString();

	/* ttyd lives on another port, i.e. another origin: browsers that refuse to
	   embed it still get a working terminal through a direct window */
	let bar = view.querySelector('.term-bar');
	if (!bar) {
		bar = E('div', { 'class': 'term-bar' }, [
			E('span', { 'class': 'term-dot' }),
			E('span', { 'class': 'term-addr' }, [ url.host ]),
			E('a', { 'class': 'btn small term-open', 'target': '_blank', 'rel': 'noopener' }, [ _('Open in new window') ])
		]);
		frame.parentNode.insertBefore(bar, frame);
	}
	bar.querySelector('.term-open').href = url.toString();
}

const SECTION_HEADINGS = '.xm-section > .xm-section-head h3, .cbi-map > .cbi-section > h3, #view > div > .cbi-section > h3';

/* views may re-render their DOM at any time, so sections are always looked up fresh */
function sectionTargets(view) {
	return Array.from(view.querySelectorAll(SECTION_HEADINGS))
		.filter((h) => h.offsetParent && h.textContent.trim())
		.map((h) => ({ title: h.textContent.trim(), el: h.closest('section, .cbi-section') || h }));
}

/* sticky chip bar that jumps between the sections of a long page */
function updateSectionNav(view) {
	const heads = sectionTargets(view);
	const key = heads.map((h) => h.title).join('\n');
	let nav = document.querySelector('#section-nav');

	if (heads.length < 4) {
		nav?.remove();
		return;
	}

	if (nav && nav.dataset.key === key)
		return;

	nav?.remove();
	nav = E('nav', { 'id': 'section-nav', 'class': 'section-nav', 'data-key': key }, heads.map((h, i) => E('button', {
		'type': 'button',
		'class': 'section-chip',
		'click': () => sectionTargets(view)[i]?.el.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}, [ h.title ])));

	view.parentNode.insertBefore(nav, view);
	highlightSection();
}

function highlightSection() {
	const nav = document.querySelector('#section-nav');
	const view = document.querySelector('#view');

	if (!nav || !view)
		return;

	let active = 0;
	sectionTargets(view).forEach((t, i) => { if (t.el.getBoundingClientRect().top < 160) active = i; });

	if (nav.active === active)
		return;

	nav.active = active;
	Array.from(nav.children).forEach((chip, i) => chip.classList.toggle('active', i == active));

	/* keep the active chip in view without moving the page */
	const chip = nav.children[active];
	nav.scrollTo({ left: Math.max(0, chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2), behavior: 'smooth' });
}

let sectionTick = false;
window.addEventListener('scroll', () => {
	if (sectionTick)
		return;

	sectionTick = true;
	requestAnimationFrame(() => { sectionTick = false; highlightSection(); });
}, { passive: true });

return baseclass.extend({
	__init__() {
		this.bindChrome();
		this.watchView();

		/* the menu is cached per session; drop it once after the theme was updated */
		const ver = window.lumenConfig?.ver;
		try {
			if (ver && localStorage.getItem('lumen-ver') !== ver) {
				ui.menu.flushCache();
				localStorage.setItem('lumen-ver', ver);
			}
		} catch (e) {}

		ui.menu.load().then((tree) => this.render(tree));
	},

	watchView() {
		const view = document.querySelector('#view');
		let timer = null;

		if (!view)
			return;

		const run = () => {
			observer.disconnect();
			collapseEmptyColumns(view);
			updateSectionNav(view);
			themeTerminal(view);
			observer.observe(view, { childList: true, subtree: true });
		};

		const observer = new MutationObserver(() => {
			clearTimeout(timer);
			timer = setTimeout(run, 150);
		});

		observer.observe(view, { childList: true, subtree: true });
	},

	render(tree) {
		let node = tree;
		let url = '';

		this.renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}

		this.renderBreadcrumb(tree);
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + (level || 0)] == child.name);

			ul.appendChild(E('li', { 'class': 'tabmenu-item-%s%s'.format(child.name, isActive ? ' active' : '') }, [
				E('a', { 'href': L.url(url, child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				activeNode = child;
		});

		if (ul.children.length == 0)
			return E([]);

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

		return ul;
	},

	renderMainMenu(tree, url) {
		const nav = document.querySelector('#mainmenu');
		const footer = document.querySelector('#sidebar-footer');
		const children = ui.menu.getChildren(tree);
		const path = L.env.dispatchpath;
		const label = E('div', { 'class': 'sb-label' }, [ _('Navigation') ]);

		nav.appendChild(label);

		children.forEach((child) => {
			const sub = ui.menu.getChildren(child);
			const isActive = (path[1] == child.name);

			if (child.name == 'logout') {
				footer.insertBefore(E('a', { 'class': 'sb-item sb-logout', 'href': L.url(url, child.name) }, [
					icon('logout'), E('span', { 'class': 'sb-text' }, [ _(child.title) ])
				]), footer.firstChild);
				return;
			}

			if (!sub.length) {
				nav.appendChild(E('a', {
					'class': 'sb-item' + (isActive ? ' active' : ''),
					'href': L.url(url, child.name),
					'title': _(child.title)
				}, [ icon(child.name), E('span', { 'class': 'sb-text' }, [ _(child.title) ]) ]));
				return;
			}

			nav.appendChild(E('details', { 'class': 'sb-group', 'open': isActive ? '' : null }, [
				E('summary', { 'class': 'sb-item' + (isActive ? ' active' : ''), 'title': _(child.title) }, [
					icon(child.name),
					E('span', { 'class': 'sb-text' }, [ _(child.title) ]),
					icon('_chevron', 'sb-chevron')
				]),
				E('ul', { 'class': 'sb-sub' }, sub.map((s) => E('li', {}, [
					E('a', {
						'class': (isActive && path[2] == s.name) ? 'active' : '',
						'href': L.url(url, child.name, s.name)
					}, [ _(s.title) ])
				])))
			]));
		});
	},

	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length ? child.name === L.env.requestpath[0] : index === 0;

			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				this.renderMainMenu(child, child.name);
		});

		if (ul.children.length > 1)
			ul.style.display = '';
	},

	renderBreadcrumb(tree) {
		const ol = document.querySelector('#breadcrumb');
		const path = L.env.dispatchpath;
		const crumbs = [];
		let node = tree;

		for (let i = 0; i < path.length && node; i++) {
			node = node.children?.[path[i]];

			if (i == 0 || !node || !node.title)
				continue;

			crumbs.push(E('li', {}, [
				(i == path.length - 1)
					? E('span', { 'class': 'current' }, [ _(node.title) ])
					: E('a', { 'href': L.url.apply(L, path.slice(0, i + 1)) }, [ _(node.title) ])
			]));
		}

		crumbs.forEach((li) => ol.appendChild(li));
	},

	bindChrome() {
		const root = document.documentElement;
		const mobile = window.matchMedia('(max-width: 1024px)');
		const tablet = window.matchMedia('(min-width: 768px) and (max-width: 1024px)');
		const toggle = document.querySelector('#sidebar-toggle');
		const overlay = document.querySelector('#sidebar-overlay');
		const theme = document.querySelector('#theme-toggle');

		toggle?.addEventListener('click', () => {
			if (mobile.matches) {
				root.classList.toggle('sidebar-open');
			}
			else {
				const collapsed = root.classList.toggle('sidebar-collapsed');
				try { localStorage.setItem('lumen-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (e) {}
			}
		});

		overlay?.addEventListener('click', () => root.classList.remove('sidebar-open'));

		/* clicking a group icon in the collapsed rail expands the sidebar */
		document.querySelector('#mainmenu')?.addEventListener('click', (ev) => {
			const summary = ev.target.closest('summary');

			if (summary && root.classList.contains('sidebar-collapsed') && !mobile.matches) {
				root.classList.remove('sidebar-collapsed');
				summary.parentNode.open = false;
				try { localStorage.setItem('lumen-sidebar', 'expanded'); } catch (e) {}
			}

			/* tablet icon rail: a group icon opens the full drawer on that group */
			if (summary && tablet.matches && !root.classList.contains('sidebar-open')) {
				ev.preventDefault();
				summary.parentNode.open = true;
				root.classList.add('sidebar-open');
			}
		});

		theme?.addEventListener('click', () => {
			const order = [ 'system', 'light', 'dark' ];
			const next = order[(order.indexOf(root.getAttribute('data-mode')) + 1) % order.length];
			window.lumenSetMode?.(next);
			theme.setAttribute('title', { system: _('Follow system'), light: _('Light'), dark: _('Dark') }[next]);
		});
	}
});
