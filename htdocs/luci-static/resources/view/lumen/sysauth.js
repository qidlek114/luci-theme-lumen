'use strict';
'require ui';
'require view';

return view.extend({
	render() {
		const form = document.querySelector('section > form');
		const btn = document.querySelector('section > button');
		const error = document.querySelector('section > .alert-message');
		const hostname = document.title.split(' | ')[0];

		const logo = E('div', { 'class': 'login-logo' });
		logo.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="url(#login-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="login-grad" x1="2" y1="4" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--brand-1)"/><stop offset=".55" style="stop-color:var(--brand-2)"/><stop offset="1" style="stop-color:var(--brand-3)"/></linearGradient></defs><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6.01 18H6"/><path d="M10.01 18H10"/><path d="M15 10v4"/><path d="M17.84 7.17a4 4 0 0 0-5.66 0"/><path d="M20.66 4.34a8 8 0 0 0-11.31 0"/></svg>';

		const card = E('div', { 'class': 'login-card' }, [
			E('div', { 'class': 'login-head' }, [
				logo,
				E('h2', {}, hostname),
				E('p', {}, _('Authorization Required'))
			]),
			error,
			form,
			btn
		]);

		form.addEventListener('keypress', (ev) => {
			if (ev.key === 'Enter')
				btn.click();
		});

		btn.addEventListener('click', () => {
			btn.disabled = true;
			btn.classList.add('spinning');
			btn.textContent = _('Logging in…');
			form.submit();
		});

		requestAnimationFrame(() => {
			const user = form.querySelector('input[type="text"]');
			const pass = form.querySelector('input[type="password"]');
			(user.value ? pass : user).focus();
		});

		return E('div', { 'class': 'login-wrap' }, card);
	},

	addFooter() {}
});
