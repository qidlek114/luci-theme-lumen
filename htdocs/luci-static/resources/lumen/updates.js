'use strict';
'require baseclass';

/* Public, browser-side release discovery only. No credentials or installation API. */
const API = 'https://api.github.com/repos/qidlek114/luci-theme-lumen/releases';
const RELEASES = 'https://github.com/qidlek114/luci-theme-lumen/releases';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const REQUEST_TIMEOUT = 15000;
const TOTAL_TIMEOUT = 30000;

function failure(code, extra) {
	return Object.assign(new Error(code), { code: code }, extra || {});
}

function parseVersion(value) {
	if (typeof value !== 'string' || value.length > 200)
		return null;
	const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
	if (!match || (match[4] && match[4].split('.').some((p) => /^\d+$/.test(p) && p.length > 1 && p[0] === '0')))
		return null;
	return { parts: match.slice(1, 4), version: match.slice(1, 4).join('.'), prerelease: match[4] || '' };
}

function compareVersions(a, b) {
	const left = parseVersion(a), right = parseVersion(b);
	if (!left || !right || left.prerelease || right.prerelease)
		throw failure('invalid-version');
	// Compare decimal strings, including values larger than Number.MAX_SAFE_INTEGER.
	for (let i = 0; i < 3; i++) {
		if (left.parts[i].length !== right.parts[i].length)
			return left.parts[i].length < right.parts[i].length ? -1 : 1;
		if (left.parts[i] !== right.parts[i])
			return left.parts[i] < right.parts[i] ? -1 : 1;
	}
	return 0;
}

function releaseURL(tag) {
	const parsed = parseVersion(tag);
	return parsed && !parsed.prerelease ? RELEASES + '/tag/' + encodeURIComponent(tag) : null;
}

function assetURL(value, tag, name) {
	if (typeof value !== 'string' || typeof name !== 'string' || !name || /[\x00-\x20\x7f/\\]/.test(name))
		return null;
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash)
			return null;
		const parts = url.pathname.split('/').map(decodeURIComponent);
		if (parts.length !== 7 || parts[0] !== '' || parts[1] !== 'qidlek114' || parts[2] !== 'luci-theme-lumen' ||
			parts[3] !== 'releases' || parts[4] !== 'download' || parts[5] !== tag || parts[6] !== name)
			return null;
		return url.href;
	}
	catch (e) {
		return null;
	}
}

async function requestJSON(url, options) {
	const opts = options || {};
	const fetcher = opts.fetcher || fetch;
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
	let timer;
	const timed = new Promise((resolve, reject) => {
		timer = setTimeout(() => {
			reject(failure('timeout'));
			if (controller) controller.abort();
		}, opts.timeout || REQUEST_TIMEOUT);
	});

	try {
		return await Promise.race([ timed, (async () => {
			let response;
			try {
				response = await fetcher(url, {
					method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
					referrerPolicy: 'no-referrer', mode: opts.local ? 'same-origin' : 'cors',
					headers: { 'Accept': opts.local ? 'application/json' : 'application/vnd.github+json' },
					signal: controller ? controller.signal : undefined
				});
			}
			catch (e) {
				throw failure('network');
			}
			if (!response || !response.ok) {
				const status = response && response.status;
				const get = (name) => response && response.headers && response.headers.get(name);
				if (status === 403 || status === 429) {
					const reset = Number(get('x-ratelimit-reset'));
					throw failure('rate-limit', { status: status, retryAt: Number.isFinite(reset) && reset > 0 ? reset * 1000 : null });
				}
				throw failure('http', { status: status || 0 });
			}
			try {
				return { value: await response.json(), link: response.headers && response.headers.get('link') || '' };
			}
			catch (e) {
				throw failure('invalid-response');
			}
		})() ]);
	}
	finally {
		clearTimeout(timer);
	}
}

async function readInstalled(url, options) {
	const response = await requestJSON(url, Object.assign({}, options, { local: true }));
	const data = response.value;
	const parsed = data && parseVersion(data.version);
	if (!parsed || parsed.prerelease || (data.format !== 'apk' && data.format !== 'ipk'))
		throw failure('metadata');
	return { version: parsed.version, format: data.format };
}

function normalizeRelease(raw) {
	if (!raw || typeof raw !== 'object' || typeof raw.draft !== 'boolean' || typeof raw.prerelease !== 'boolean')
		throw failure('invalid-response');
	if (raw.draft || raw.prerelease)
		return null;
	const parsed = parseVersion(raw.tag_name);
	if (!parsed)
		throw failure('unsupported-tag');
	if (parsed.prerelease)
		return null;
	if (!Number.isSafeInteger(raw.id) || raw.id < 1 || !Array.isArray(raw.assets) ||
		(raw.body != null && typeof raw.body !== 'string') || (raw.name != null && typeof raw.name !== 'string'))
		throw failure('invalid-response');
	const assets = [];
	let omittedAssets = 0;
	for (const asset of raw.assets) {
		const url = asset && assetURL(asset.browser_download_url, raw.tag_name, asset.name);
		if (url && asset.state === 'uploaded')
			assets.push({ name: asset.name, url: url, size: Number.isSafeInteger(asset.size) && asset.size >= 0 ? asset.size : null });
		else
			omittedAssets++;
	}
	return {
		id: raw.id, tag: raw.tag_name, version: parsed.version, name: raw.name || raw.tag_name,
		body: raw.body || '', url: releaseURL(raw.tag_name), assets: assets, omittedAssets: omittedAssets
	};
}

async function fetchReleases(options) {
	const opts = options || {};
	const deadline = Date.now() + Math.min(opts.totalTimeout || TOTAL_TIMEOUT, TOTAL_TIMEOUT);
	const releases = [], issues = [], seen = new Map(), versions = new Map();
	let pages = 0, exhausted = false;
	for (let page = 1; page <= MAX_PAGES; page++) {
		try {
			const remaining = deadline - Date.now();
			if (remaining <= 0) throw failure('timeout');
			const response = await requestJSON(API + '?per_page=' + PAGE_SIZE + '&page=' + page, {
				fetcher: opts.fetcher, timeout: Math.min(opts.timeout || REQUEST_TIMEOUT, REQUEST_TIMEOUT, remaining)
			});
			if (!Array.isArray(response.value) || response.value.length > PAGE_SIZE)
				throw failure('invalid-response');
			pages++;
			for (const raw of response.value) {
				try {
					const release = normalizeRelease(raw);
					if (!release) continue;
					if (seen.has(release.id)) {
						// Even an unchanged duplicate can signal page boundaries moving mid-check.
						issues.push({ code: 'changed-results' });
						continue;
					}
					if (versions.has(release.version))
						issues.push({ code: 'ambiguous-version' });
					versions.set(release.version, release.id);
					seen.set(release.id, release);
					releases.push(release);
				}
				catch (e) {
					issues.push({ code: e.code || 'invalid-response' });
				}
			}
			// Fixed page URLs only. A full page is followed even without a Link header.
			const hasNext = /\brel\s*=\s*["']?next\b/i.test(response.link);
			if (response.value.length < PAGE_SIZE && !hasNext) {
				exhausted = true;
				break;
			}
		}
		catch (e) {
			issues.push({ code: e.code || 'network', status: e.status, retryAt: e.retryAt });
			break;
		}
	}
	if (!exhausted && pages === MAX_PAGES)
		issues.push({ code: 'page-limit' });
	releases.sort((a, b) => compareVersions(a.version, b.version));
	return {
		releases: releases, complete: exhausted && issues.length === 0,
		issues: issues.filter((issue, i) => issues.findIndex((other) => other.code === issue.code) === i),
		pages: pages, checkedAt: Date.now()
	};
}

function newerReleases(catalog, installed) {
	if (!catalog || !catalog.complete) throw failure('incomplete');
	return catalog.releases.filter((release) => compareVersions(release.version, installed) > 0);
}

function releaseRange(catalog, installed, targetTag) {
	const newer = newerReleases(catalog, installed);
	const target = newer.find((release) => release.tag === targetTag);
	if (!target) throw failure('invalid-target');
	return newer.filter((release) => compareVersions(release.version, target.version) <= 0)
		.sort((a, b) => compareVersions(a.version, b.version));
}

function downloads(release, format) {
	if (format !== 'apk' && format !== 'ipk') throw failure('metadata');
	return release.assets.map((asset) => {
		let kind = null;
		if (new RegExp('^luci-theme-lumen-fonts[-_][A-Za-z0-9.+~_-]+\\.' + format + '$').test(asset.name)) kind = 'fonts';
		else if (new RegExp('^luci-theme-lumen[-_][A-Za-z0-9.+~_-]+\\.' + format + '$').test(asset.name)) kind = 'theme';
		else if (new RegExp('^luci-i18n-lumen-zh-cn[-_][A-Za-z0-9.+~_-]+\\.' + format + '$').test(asset.name)) kind = 'translation';
		else if (asset.name === 'lumen-usign.pub' || (format === 'apk' && asset.name === 'lumen-apk.pub')) kind = 'key';
		else if (asset.name === 'SHA256SUMS' || asset.name === 'SHA256SUMS.sig') kind = 'checksum';
		return kind ? Object.assign({ kind: kind }, asset) : null;
	}).filter(Boolean).sort((a, b) => {
		const order = { theme: 0, fonts: 1, translation: 2, key: 3, checksum: 4 };
		return order[a.kind] - order[b.kind] || a.name.localeCompare(b.name);
	});
}

return baseclass.extend({
	apiURL: API, releasesURL: RELEASES, parseVersion: parseVersion, compareVersions: compareVersions,
	releaseURL: releaseURL, assetURL: assetURL, readInstalled: readInstalled,
	fetchReleases: fetchReleases, newerReleases: newerReleases, releaseRange: releaseRange, downloads: downloads
});
