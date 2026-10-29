'use strict';

// Exercise the real make recipes on staged source files without an SDK.
// This does not claim to build or install an APK/IPK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-font-packaging-'));
const collect = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
	const item = path.join(dir, entry.name);
	return entry.isDirectory() ? collect(item) : [item];
});

try {
	const mock = path.join(temp, 'mock');
	fs.mkdirSync(path.join(mock, 'feeds/luci'), { recursive: true });
	fs.writeFileSync(path.join(mock, 'rules.mk'), '');
	fs.writeFileSync(path.join(mock, 'feeds/luci/luci.mk'), '');
	const driver = path.join(temp, 'driver.mk');
	fs.writeFileSync(driver, `
INSTALL_DIR := mkdir -p
INSTALL_DATA := cp -p
CP := cp -pR
include ${path.join(root, 'Makefile')}
.PHONY: check-prepare check-fonts
check-prepare:
\t$(call Build/Prepare/luci-theme-lumen)
check-fonts:
\t$(call Package/luci-theme-lumen-fonts/install,$(FONT_DEST))
`);
	const srcTheme = path.join(root, 'htdocs/luci-static/lumen');
	const sourceFonts = collect(path.join(srcTheme, 'fonts'));
	assert.equal(sourceFonts.filter(p => p.endsWith('.woff2')).length, 208);
	const css = fs.readFileSync(path.join(srcTheme, 'fonts.css'), 'utf8');
	const refs = [...css.matchAll(/url\(fonts\/([^\)]+)\)/g)].map(m => m[1]);
	assert.equal(refs.length, 208);
	for (const file of refs) assert(fs.existsSync(path.join(srcTheme, 'fonts', file)), file);

	for (const [format, apkFlag] of [['apk', 'y'], ['ipk', '']]) {
		const build = path.join(temp, format, 'build');
		const addon = path.join(temp, format, 'addon');
		fs.mkdirSync(build, { recursive: true });
		fs.cpSync(path.join(root, 'htdocs'), path.join(build, 'htdocs'), { recursive: true });
		const run = target => {
			const result = spawnSync('make', ['-f', driver, `TOPDIR=${mock}`, `PKG_BUILD_DIR=${build}`,
				`FONT_DEST=${addon}`, `CONFIG_USE_APK=${apkFlag}`, target], { cwd: root, encoding: 'utf8' });
			assert.equal(result.status, 0, result.stdout + result.stderr);
		};
		run('check-prepare');
		const core = path.join(build, 'htdocs/luci-static/lumen');
		assert(!fs.existsSync(path.join(core, 'fonts.css')));
		assert(!fs.existsSync(path.join(core, 'fonts')));
		assert.equal(collect(path.join(build, 'htdocs')).filter(p => p.endsWith('.woff2')).length, 0);
		const version = JSON.parse(fs.readFileSync(path.join(build, 'htdocs/luci-static/resources/lumen/version.json')));
		assert.deepEqual(version, { version: '1.0.2', format });
		run('check-fonts');
		const installed = path.join(addon, 'www/luci-static/lumen');
		assert.equal(fs.readFileSync(path.join(installed, 'fonts.css'), 'utf8'), css);
		for (const file of refs) {
			assert.deepEqual(fs.readFileSync(path.join(installed, 'fonts', file)),
				fs.readFileSync(path.join(srcTheme, 'fonts', file)), file);
		}
		for (const license of ['LICENSE-noto-serif-sc.txt', 'LICENSE-source-serif-4.txt'])
			assert(fs.existsSync(path.join(installed, 'fonts', license)), license);
	}
	console.log('Font split staging checks passed for APK and IPK metadata.');
} finally {
	fs.rmSync(temp, { recursive: true, force: true });
}
