'use strict';
'require view';
'require form';
'require rpc';

const callBoard = rpc.declare({ object: 'system', method: 'board' });

return view.extend({
	load() {
		return L.resolveDefault(callBoard(), {});
	},

	render(board) {
		const m = new form.Map('lumen', _('Appearance'),
			_('Choose the look of this interface and how the device is named in it. Changes apply to every browser after saving.'));

		const s = m.section(form.NamedSection, 'main', 'theme');
		s.addremove = false;
		s.tab('look', _('Look'));
		s.tab('device', _('Device'));

		let o = s.taboption('look', form.ListValue, 'style', _('Style'),
			_('Claude pairs a warm paper look and serif type with a carbon-fibre dark mode.'));
		o.value('default', _('Default (shadcn)'));
		o.value('claude', _('Claude · paper & carbon'));
		o.default = 'default';

		o = s.taboption('look', form.ListValue, 'mode', _('Colour mode'),
			_('Lock the interface to light or dark, or follow each device. When locked, the toggle in the top bar is hidden.'));
		o.value('auto', _('Follow system'));
		o.value('light', _('Always light'));
		o.value('dark', _('Always dark'));
		o.default = 'auto';

		o = s.taboption('device', form.Value, 'hostname', _('Display name'),
			_('Shown in the sidebar, dashboard, login page and browser title. Leave empty to use the system hostname; the real hostname is set under System.'));
		o.placeholder = board.hostname || 'OpenWrt';
		o.rmempty = true;

		o = s.taboption('device', form.Value, 'model', _('Device model'),
			_('Leave empty to use the detected hardware model.'));
		o.placeholder = board.model || '';
		o.rmempty = true;

		return m.render();
	}
});
