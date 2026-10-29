import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(d,e.name);assert(!e.isSymbolicLink(),'Unexpected symlink: '+p);
  return e.isDirectory()?walk(p):[p];
});
const runtime=[...walk(path.join(root,'htdocs')),...walk(path.join(root,'root'))];
const forbidden=[/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,/\bgh[pousr]_[A-Za-z0-9]{25,}\b/,/[A-Z]:[\\/]+Users[\\/]/,/https?:\/\/[^/\s:]+:[^/\s@]+@/];
let js=0,json=0,fonts=0,assets=0;
for(const p of runtime){
  if(/\.woff2$/.test(p)){assert.equal(fs.readFileSync(p).subarray(0,4).toString(),'wOF2',p);fonts++;continue;}
  const text=fs.readFileSync(p,'utf8');for(const re of forbidden)assert(!re.test(text),'Private deployment data in '+path.relative(root,p));
  if(/\.(?:js|ut|json)$/.test(p))for(const m of text.matchAll(/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g))assert(m[0]==='0.0.0.0','Unexpected literal network address in '+path.relative(root,p));
  if(/\.js$/.test(p)){new vm.Script('(function(){\n'+text+'\n})',{filename:p});js++;}
  if(/\.json$/.test(p)){JSON.parse(text);json++;}
  if(/\.css$/.test(p))for(const m of text.matchAll(/url\(\s*['"]?([^'"\)\s]+)['"]?\s*\)/g)){
    const url=m[1];if(/^(?:data:|#|\/)/.test(url))continue;
    assert(!/^https?:/.test(url),'Remote CSS asset: '+url);
    assert(fs.existsSync(path.resolve(path.dirname(p),url.split('?')[0])),'Missing CSS asset '+url);assets++;
  }
}
const menu=JSON.parse(fs.readFileSync(path.join(root,'root/usr/share/luci/menu.d/luci-theme-lumen.json')));
assert(Object.keys(menu).every(k=>k==='admin/lumen'||k.startsWith('admin/lumen/')),'Custom routes must be namespaced');
for(const node of Object.values(menu))if(node.action?.type==='view')assert(fs.existsSync(path.join(root,'htdocs/luci-static/resources/view',node.action.path+'.js')),'Missing view '+node.action.path);
const cfg=fs.readFileSync(path.join(root,'root/etc/config/lumen'),'utf8');
assert(/config theme ['"]?main/.test(cfg),'Missing generic main section');
assert(!/option\s+(hostname|model)\s+['"][^'"]+['"]/.test(cfg),'Defaults must not contain a device identity');
for(const p of ['LICENSE','NOTICE','README.md','README.en.md','po/zh_Hans/lumen.po'])assert(fs.existsSync(path.join(root,p)),'Missing '+p);
const result=spawnSync(process.execPath,[path.join(root,'tests/portability.cjs')],{encoding:'utf8'});
process.stdout.write(result.stdout||'');assert.equal(result.status,0,result.stderr);
const lifecycle=spawnSync(process.execPath,[path.join(root,'tests/package-lifecycle.cjs')],{encoding:'utf8'});
process.stdout.write(lifecycle.stdout||'');assert.equal(lifecycle.status,0,lifecycle.stderr);
const updates=spawnSync(process.execPath,[path.join(root,'tests/updates.cjs')],{encoding:'utf8'});
process.stdout.write(updates.stdout||'');assert.equal(updates.status,0,updates.stderr);
const fontPackaging=spawnSync(process.execPath,[path.join(root,'tests/font-packaging.cjs')],{encoding:'utf8'});
process.stdout.write(fontPackaging.stdout||'');assert.equal(fontPackaging.status,0,fontPackaging.stderr);
const performance=spawnSync(process.execPath,[path.join(root,'tests/performance.cjs')],{encoding:'utf8'});
process.stdout.write(performance.stdout||'');assert.equal(performance.status,0,performance.stderr);
console.log(JSON.stringify({ok:true,js,json,fonts,localCssAssets:assets,runtimeFiles:runtime.length}));
