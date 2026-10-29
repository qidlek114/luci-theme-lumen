'use strict';
'require view';
'require dom';
'require ui';
'require rpc';
'require lumen.updates as updates';

const updateStatus = rpc.declare({ object: 'lumen.update', method: 'status', expect: { '': {} } });
const updateStart = rpc.declare({ object: 'lumen.update', method: 'start', expect: { '': {} } });
const updateConfirm = rpc.declare({ object: 'lumen.update', method: 'confirm', expect: { '': {} } });
const updateRollback = rpc.declare({ object: 'lumen.update', method: 'rollback', expect: { '': {} } });

/* Even release Markdown is text: never parse remote HTML or create remote images. */
function textNode(tag, attrs, value) {
	const node = E(tag, attrs || {});
	node.textContent = String(value == null ? '' : value);
	return node;
}

function externalLink(url, label) {
	return textNode('a', { href: url, target: '_blank', rel: 'noopener noreferrer', referrerpolicy: 'no-referrer' }, label);
}

function issueText(issue) {
	switch (issue.code) {
	case 'timeout': return _('The check timed out. Try again later.');
	case 'rate-limit': return _('GitHub refused or rate-limited the request. Try again later.');
	case 'page-limit': return _('The release history exceeds the 10-page limit. The results are incomplete.');
	case 'unsupported-tag': return _('Some stable release tags could not be compared as semantic versions.');
	case 'ambiguous-version': return _('Different releases have the same version number. The results need manual review.');
	case 'changed-results': return _('The release history changed during this check. Please check again.');
	case 'invalid-response': return _('GitHub returned unexpected release data.');
	case 'http': return _('GitHub returned an error. Try again later.');
	default: return _('Could not reach GitHub. Check this browser’s connection and try again.');
	}
}

function assetLabel(kind) {
	switch (kind) {
	case 'theme': return _('Theme package');
	case 'fonts': return _('Optional fonts package');
	case 'translation': return _('Simplified Chinese package');
	case 'key': return _('Verification key');
	default: return _('Checksums / signature');
	}
}

function packageManagerPath(menu) {
	return [ 'admin/system/package-manager', 'admin/system/opkg' ].find((path) => {
		let node = menu;
		for (const part of path.split('/')) {
			node = node && node.children && node.children[part];
			if (!node) return false;
		}
		return true;
	}) || null;
}

return view.extend({
	load() {
		// Reading this local resource does not contact GitHub.
		return Promise.all([
			updates.readInstalled(L.resource('lumen/version.json')).catch(() => null),
			Promise.resolve().then(() => ui.menu.load()).catch(() => null),
			updateStatus().catch(() => null)
		]).then(([ installed, menu, automatic ]) => ({ installed: installed, menu: menu, automatic: automatic }));
	},

	render(data) {
		this.installed = data.installed;
		this.initialVersion = data.installed && data.installed.version;
		this.operation = null;
		const packagePath = packageManagerPath(data.menu);
		this.busy = false;
		this.catalog = null;
		this.versionLine = textNode('p', {}, '');
		this.status = E('div', { role: 'status', 'aria-live': 'polite', style: 'overflow-wrap:anywhere' });
		this.details = E('div');
		this.checkButton = textNode('button', {
			'class': 'cbi-button cbi-button-action', type: 'button', click: () => this.checkUpdates()
		}, _('Check release history in this browser'));
		this.automaticStatus = E('p', { role: 'status', 'aria-live': 'polite' });
		this.autoButton = textNode('button', { 'class': 'cbi-button cbi-button-apply', type: 'button', click: () => this.startAutomatic() }, _('Check and update automatically'));
		this.rollbackButton = textNode('button', { 'class': 'cbi-button', type: 'button', click: () => this.startRollback() }, _('Restore previous version'));
		this.renderInstalled();
		this.setStatus(this.installed ? _('Updates are checked only when you press the button.') :
			_('Installed version or package format is unavailable. Update status cannot be determined.'), !this.installed);

		setTimeout(() => this.refreshAutomatic(data.automatic), 0);
		return E('div', { style: 'min-width:0;max-width:100%' }, [
			textNode('h2', {}, _('Lumen updates')),
			E('div', { 'class': 'cbi-section', style: 'min-width:0' }, [
				this.versionLine,
				textNode('p', {}, _('Automatic updates verify the release and preserve a signed rollback package. Keep this page open until the update finishes.')),
				E('div', { style: 'display:flex;flex-wrap:wrap;gap:1em;align-items:center;margin:1em 0' }, [ this.autoButton, this.rollbackButton ]),
				this.automaticStatus,
				textNode('p', {}, _('The release-history check connects this browser to the public GitHub API without a token or login credentials.')),
				E('div', { style: 'display:flex;flex-wrap:wrap;gap:1em;align-items:center;margin:1em 0' }, [
					this.checkButton, externalLink(updates.releasesURL, _('Open GitHub releases')),
					packagePath ? textNode('a', { href: L.url(packagePath) }, _('Open LuCI package manager')) :
						textNode('span', {}, _('To install a downloaded package, open Software from the System menu.'))
				]),
				this.status
			]),
			this.details
		]);
	},

	async startAutomatic() {
		this.operation = 'update';
		try { sessionStorage.removeItem('lumen-update-reloaded'); } catch (e) {}
		this.autoButton.disabled = true;
		this.rollbackButton.disabled = true;
		this.automaticStatus.textContent = _('Starting the signed update check…');
		try {
			const result = await updateStart();
			if (result.state === 'error') return this.renderAutomatic(result);
			setTimeout(() => this.refreshAutomatic(), 1500);
		}
		catch (e) { this.renderAutomatic({ state: 'error', code: 'unavailable' }); }
	},

	async startRollback() {
		this.operation = 'rollback';
		this.autoButton.disabled = true;
		this.rollbackButton.disabled = true;
		this.automaticStatus.textContent = _('Restoring the previous signed version…');
		try {
			const result = await updateRollback();
			if (result.state === 'error') return this.renderAutomatic(result);
			setTimeout(() => this.refreshAutomatic(), 1500);
		}
		catch (e) { this.renderAutomatic({ state: 'error', code: 'unavailable' }); }
	},

	async refreshAutomatic(initial) {
		try {
			const result = initial || await updateStatus();
			// An older restored package can remove the normal updater while its
			// rpcd provider is still loaded. Detect that transition and open the
			// retained page rather than leaving a stale, unusable view behind.
			if (this.operation === 'rollback' && (result.state === 'rolled_back' ||
				(result.state === 'error' && result.code === 'unavailable'))) {
				const current = await updates.readInstalled(L.resource('lumen/version.json'));
				if (current.version !== this.initialVersion) { location.reload(); return; }
				if (result.state === 'error') {
					this.automaticStatus.textContent = _('Waiting for the router to reconnect…');
					setTimeout(() => this.refreshAutomatic(), 3000);
					return;
				}
			}
			this.renderAutomatic(result);
			if (result.state === 'waiting' && result.target) {
				// Reload the complete page first. A successful RPC alone does not prove
				// the new LuCI page and assets can be served and loaded by the browser.
				const marker = 'lumen-update-reloaded';
				if (sessionStorage.getItem(marker) !== result.target) {
					sessionStorage.setItem(marker, result.target);
					location.reload();
					return;
				}
				const [ installed, css, js ] = await Promise.all([
					updates.readInstalled(L.resource('lumen/version.json')),
					fetch(L.resource('../lumen/lumen.css'), { credentials: 'same-origin', cache: 'no-store' }),
					fetch(L.resource('lumen/updates.js'), { credentials: 'same-origin', cache: 'no-store' })
				]);
				if (installed.version === result.target && css.ok && js.ok) {
					await updateConfirm();
					sessionStorage.removeItem(marker);
				}
			}
			if ([ 'starting', 'checking', 'downloading', 'installing', 'waiting', 'rolling_back' ].includes(result.state))
				setTimeout(() => this.refreshAutomatic(), 3000);
		}
		catch (e) {
			if (this.operation === 'rollback') {
				try {
					const current = await updates.readInstalled(L.resource('lumen/version.json'));
					if (current.version !== this.initialVersion) { location.reload(); return; }
				}
				catch (ignored) {}
			}
			this.automaticStatus.textContent = _('Waiting for the router to reconnect…');
			setTimeout(() => this.refreshAutomatic(), 3000);
		}
	},

	renderAutomatic(result) {
		const state = result && result.state || 'error';
		const messages = {
			idle: _('Ready to check for a signed update.'),
			starting: _('Starting the signed update check…'),
			current: _('No newer release was found.'),
			checking: _('Checking the latest stable release…'),
			downloading: _('Downloading and verifying the update and rollback packages…'),
			installing: _('Installing the verified update…'),
			waiting: _('Checking that the updated page loads successfully…'),
			success: _('The signed update was installed and the page reconnected.'),
			rolling_back: _('Restoring the previous signed version…'),
			rolled_back: _('The previous signed version was restored.'),
			error: _('The update did not complete. No unverified package was installed.')
		};
		const errors = {
			network: _('GitHub is unreachable through the direct connection and configured local proxy.'),
			metadata: _('The release or installed version information is invalid.'),
			unsupported: _('The installed package version cannot be safely matched to a rollback release.'),
			old_release: _('The previous release could not be downloaded or verified.'),
			new_release: _('The new release could not be downloaded, verified, or matched to this firmware.'),
			disk: _('There is not enough free storage for the update and rollback packages.'),
			runtime: _('A required update tool is unavailable.'),
			recovery: _('Automatic recovery needs attention. Do not remove the backup.'),
			rollback_failed: _('The previous version could not be restored; the current version was recovered.'),
			busy: _('Another update or rollback is already running.'),
			pending: _('An earlier update still needs recovery.'),
			no_backup: _('No verified previous version is available yet.'),
			unavailable: _('The updater is unavailable. Reload the page and try again.')
		};
		this.automaticStatus.textContent = (messages[state] || messages.error) + (errors[result && result.code] ? ' ' + errors[result.code] : '');
		const active = [ 'starting', 'checking', 'downloading', 'installing', 'waiting', 'rolling_back' ].includes(state);
		this.autoButton.disabled = active;
		this.rollbackButton.disabled = active;
	},

	renderInstalled() {
		this.versionLine.textContent = this.installed ?
			_('Installed version: %s · Package format: %s').format(this.installed.version, this.installed.format.toUpperCase()) :
			_('Installed version: unknown');
	},

	setStatus(message, warning) {
		this.status.className = warning ? 'alert-message warning' : '';
		this.status.setAttribute('role', warning ? 'alert' : 'status');
		dom.content(this.status, [ textNode('p', {}, message) ]);
	},

	async checkUpdates() {
		if (this.busy) return;
		this.busy = true;
		this.checkButton.disabled = true;
		this.catalog = null;
		dom.content(this.details, []);
		this.setStatus(_('Checking releases… Please wait.'), false);
		try {
			// Refresh the local metadata too, so an old open tab cannot keep an old baseline.
			try {
				this.installed = await updates.readInstalled(L.resource('lumen/version.json'));
			}
			catch (e) {
				this.installed = null;
				this.renderInstalled();
				this.setStatus(_('Installed version or package format is unavailable. Update status cannot be determined.'), true);
				return;
			}
			this.renderInstalled();
			this.catalog = await updates.fetchReleases();
			if (!this.catalog.complete) {
				this.setStatus(_('The check is incomplete. Update status and the full release-note range cannot be determined.'), true);
				this.status.appendChild(E('ul', {}, this.catalog.issues.map((issue) => textNode('li', {}, issueText(issue)))));
				this.status.appendChild(textNode('p', {}, _('No version selection or downloads are shown for incomplete results. Open GitHub releases or try again.')));
				return;
			}
			if (!this.catalog.releases.length) {
				this.setStatus(_('No stable releases were returned. Update status cannot be determined.'), true);
				return;
			}
			const newer = updates.newerReleases(this.catalog, this.installed.version);
			if (!newer.length) {
				const latest = this.catalog.releases[this.catalog.releases.length - 1];
				this.setStatus(updates.compareVersions(this.installed.version, latest.version) > 0 ?
					_('The installed version is newer than the published stable releases.') :
					_('No newer stable release was found.'), false);
				return;
			}
			this.setStatus(_('New stable releases are available. Choose a target version to review every intervening release.'), false);
			this.target = E('select', { style: 'max-width:100%', 'aria-label': _('Target version'), change: () => this.renderSelection() },
				newer.slice().reverse().map((release) => textNode('option', { value: release.tag }, release.tag)));
			this.target.value = newer[newer.length - 1].tag;
			this.notes = E('div');
			this.files = E('div');
			dom.content(this.details, [
				E('div', { 'class': 'cbi-section', style: 'min-width:0' }, [
					textNode('h3', {}, _('Target version')), this.target,
					textNode('p', {}, _('Only published stable releases newer than the installed version are listed.'))
				]), this.notes, this.files
			]);
			this.renderSelection();
		}
		catch (e) {
			this.setStatus(_('The check could not be completed. Update status cannot be determined.'), true);
			dom.content(this.details, []);
		}
		finally {
			this.busy = false;
			this.checkButton.disabled = false;
		}
	},

	renderSelection() {
		try {
			const range = updates.releaseRange(this.catalog, this.installed.version, this.target.value);
			const selected = range[range.length - 1];
			dom.content(this.notes, [
				textNode('h3', {}, _('Release notes from %s to %s (%d releases)').format(this.installed.version, selected.version, range.length))
			].concat(range.map((release) => E('section', { 'class': 'cbi-section', style: 'min-width:0;max-width:100%;overflow-wrap:anywhere' }, [
				textNode('h4', {}, release.tag + (release.name !== release.tag ? ' — ' + release.name : '')),
				externalLink(release.url, _('Open this release on GitHub')),
				textNode('div', { style: 'white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;margin-top:1em' },
					release.body || _('No release notes were provided for this version.'))
			]))));

			const assets = updates.downloads(selected, this.installed.format);
			const rows = assets.map((asset) => E('li', { style: 'margin:0.75em 0;overflow-wrap:anywhere;word-break:break-word' }, [
				textNode('span', {}, assetLabel(asset.kind) + ': '), externalLink(asset.url, asset.name)
			]));
			const content = [
				textNode('h3', {}, _('Downloads for %s (%s)').format(selected.tag, this.installed.format.toUpperCase())),
				textNode('p', {}, _('The package format matches this installation. Check the target release’s firmware and LuCI requirements before installing.')),
				textNode('p', {}, _('Verify the signing key and package signatures before installing. A checksum alone does not authenticate the publisher.')),
				textNode('p', {}, _('These download links are for manual installation. For the latest compatible release, use the automatic update button above.'))
			];
			if (!assets.some((asset) => asset.kind === 'theme'))
				content.push(textNode('p', { 'class': 'alert-message warning' }, _('This release has no theme package matching the installed package format.')));
			if (selected.omittedAssets)
				content.push(textNode('p', { 'class': 'alert-message warning' }, _('Some assets were omitted because their download links or upload state could not be verified.')));
			content.push(E('ul', {}, rows));
			content.push(externalLink(selected.url, _('Open this release on GitHub')));
			dom.content(this.files, [ E('div', { 'class': 'cbi-section', style: 'min-width:0;overflow-wrap:anywhere' }, content) ]);
		}
		catch (e) {
			this.setStatus(_('The selected version cannot be compared safely. Please check again.'), true);
			dom.content(this.notes, []);
			dom.content(this.files, []);
		}
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
