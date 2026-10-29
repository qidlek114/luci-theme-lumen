'use strict';
'require view';
'require rpc';

const status = rpc.declare({ object: 'lumen.recovery', method: 'status', expect: { '': {} } });
const start = rpc.declare({ object: 'lumen.recovery', method: 'start', expect: { '': {} } });
const confirm = rpc.declare({ object: 'lumen.recovery', method: 'confirm', expect: { '': {} } });
const chinese = String((L.env && L.env.lang) || document.documentElement.lang || '').toLowerCase().startsWith('zh');
const tr = (en, zh) => chinese ? zh : en;

return view.extend({
	load() {
		return Promise.all([
			fetch(L.resource('lumen/version.json'), { credentials: 'same-origin', cache: 'no-store' })
				.then(r => r.ok ? r.json() : null).catch(() => null),
			status().catch(() => null)
		]);
	},

	render(data) {
		this.button = E('button', { 'class': 'cbi-button cbi-button-apply', type: 'button',
			click: () => this.startUpdate() }, [tr('Check and update automatically', '一键检查并更新')]);
		this.message = E('p', { role: 'status', 'aria-live': 'polite' });
		this.started = false;
		setTimeout(() => this.refresh(data[1]), 0);
		return E('div', { style: 'min-width:0;max-width:100%' }, [
			E('h2', {}, [tr('Lumen updates', 'Lumen 主题更新')]),
			E('div', { 'class': 'cbi-section', style: 'min-width:0' }, [
				E('p', {}, [tr('Installed version: ', '当前版本：') +
					(data[0] && data[0].version || tr('unknown', '未知'))]),
				E('p', {}, [tr('The retained updater remains available after rollback. It verifies signatures before installing. Keep this page open until the update finishes.',
					'回退后仍可使用此更新入口。安装前会验证签名，请保持本页面打开直到更新完成。')]),
				this.button,
				this.message
			])
		]);
	},

	async startUpdate() {
		this.started = true;
		this.button.disabled = true;
		this.message.textContent = tr('Starting the signed update check…', '正在启动签名更新检查…');
		try {
			try {
				sessionStorage.removeItem('lumen-rescue-reloaded');
				sessionStorage.removeItem('lumen-rescue-returned');
			} catch (e) {}
			const result = await start();
			if (result.state === 'error') return this.show(result);
			setTimeout(() => this.refresh(), 1500);
		} catch (e) { this.show({ state: 'error', code: 'unavailable' }); }
	},

	async refresh(initial) {
		try {
			const result = initial || await status();
			this.show(result);
			if (result && result.state === 'success' && result.target) {
				// The worker removed the temporary menu override before reporting
				// success. Reopen the complete page, including its rollback button.
				// Limit this to once in case storage or menu restoration fails.
				try {
					if (sessionStorage.getItem('lumen-rescue-returned') !== result.target) {
						sessionStorage.setItem('lumen-rescue-returned', result.target);
						location.reload();
						return;
					}
				} catch (e) { /* The user can reload manually. */ }
			}
			if (result && result.state === 'waiting' && result.target) {
				let reloaded = false;
				try {
					reloaded = sessionStorage.getItem('lumen-rescue-reloaded') === result.target;
					if (!reloaded) sessionStorage.setItem('lumen-rescue-reloaded', result.target);
				} catch (e) { /* Continue only after the current page can load the assets. */ reloaded = true; }
				if (!reloaded) { location.reload(); return; }
				const [ metadata, css, helper, normalPage ] = await Promise.all([
					fetch(L.resource('lumen/version.json'), { credentials: 'same-origin', cache: 'no-store' }),
					fetch(L.resource('../lumen/lumen.css'), { credentials: 'same-origin', cache: 'no-store' }),
					fetch(L.resource('lumen/updates.js'), { credentials: 'same-origin', cache: 'no-store' }),
					fetch(L.resource('view/lumen/updates.js'), { credentials: 'same-origin', cache: 'no-store' })
				]);
				if (metadata.ok && css.ok && helper.ok && normalPage.ok && (await metadata.json()).version === result.target) {
					await confirm();
					try { sessionStorage.removeItem('lumen-rescue-reloaded'); } catch (e) {}
				}
			}
			if (result && ['starting', 'checking', 'downloading', 'installing', 'waiting', 'rolling_back'].includes(result.state))
				setTimeout(() => this.refresh(), 3000);
		} catch (e) {
			this.message.textContent = tr('Waiting for the router to reconnect…', '正在等待路由器重新连接…');
			if (this.started) setTimeout(() => this.refresh(), 3000);
		}
	},

	show(result) {
		const state = result && result.state || 'error';
		const messages = {
			idle: tr('Ready to check for a signed update.', '可以检查已签名的更新。'),
			starting: tr('Starting the signed update check…', '正在启动签名更新检查…'),
			checking: tr('Checking the latest stable release…', '正在检查最新正式版本…'),
			downloading: tr('Downloading and verifying packages…', '正在下载并验证安装包…'),
			installing: tr('Installing the verified update…', '正在安装已验证的更新…'),
			waiting: tr('Checking the updated page…', '正在检查更新后的页面…'),
			current: tr('No newer release was found.', '没有发现更新的正式版本。'),
			success: tr('The signed update was installed and the page reconnected.', '已安装签名更新，页面已成功重新连接。'),
			rolled_back: tr('The previous version was restored. You can update again here.', '已恢复上一个版本，可以在这里再次一键更新。'),
			rolling_back: tr('Restoring the previous signed version…', '正在恢复上一个已签名版本…'),
			error: tr('The update did not complete. No unverified package was installed.', '更新未完成，未安装未经验证的安装包。')
		};
		this.message.textContent = messages[state] || messages.error;
		if (result && state === 'error' && result.code) this.message.textContent += ' (' + result.code + ')';
		this.button.disabled = ['starting', 'checking', 'downloading', 'installing', 'waiting', 'rolling_back'].includes(state);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
