'use strict';
// Exercise the actual shell state machine with disposable paths and mocked
// system commands. Cryptographic primitives and router boot are separately
// tested on real OpenWrt; this test does not claim real package installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'root/usr/libexec/lumen-update'), 'utf8');
const temps = [];
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function executable(file, contents) { fs.writeFileSync(file, contents, { mode: 0o755 }); }
function makeHarness(format, scenario) {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-auto-test-')); temps.push(dir);
 const bin = path.join(dir, 'bin'), state = path.join(dir, 'state'), runtime = path.join(dir, 'run');
 const assets = path.join(dir, 'assets'), releases = path.join(dir, 'releases'), data = path.join(dir, 'device.json');
 for (const p of [bin, state, runtime, path.join(assets, 'keys'), path.join(assets, 'rescue'), releases]) fs.mkdirSync(p, { recursive: true });
 fs.writeFileSync(data, JSON.stringify({ version:'1.0.2', format }));
 fs.writeFileSync(path.join(assets,'keys/lumen-apk.pub'), 'public key');
 fs.writeFileSync(path.join(assets,'keys/lumen-usign.pub'), 'public key');
 executable(path.join(assets, 'recovery-init'), '#!/bin/sh\nexit 0\n');
 for (const name of ['menu.json','acl.json','lumen.recovery','view.js','session-access.uc'])
  fs.copyFileSync(path.join(root,'root/usr/share/lumen-update/rescue',name),path.join(assets,'rescue',name));
 fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify({ draft:false, prerelease:false, tag_name:'v'+(scenario==='current'?'1.0.2':'1.0.3') }));
 for (const version of ['1.0.2','1.0.3']) {
  const d=path.join(releases,'v'+version); fs.mkdirSync(d);
  const core=format==='apk'?`luci-theme-lumen-${version}-r1.apk`:`luci-theme-lumen_${version}-r1_all.ipk`;
  const zh=format==='apk'?`luci-i18n-lumen-zh-cn-${version}.apk`:`luci-i18n-lumen-zh-cn_${version}_all.ipk`;
  const info=`BUILDINFO-openwrt-${format==='apk'?'25.12.6':'24.10.8'}.json`;
  const files={ [core]:'core '+version, [zh]:'translation '+version,
   [info]:JSON.stringify({ openwrt_release:format==='apk'?'25.12.6':'24.10.8', package_format:format }) };
  for (const [name,content] of Object.entries(files)) fs.writeFileSync(path.join(d,name),content);
  fs.writeFileSync(path.join(d,'SHA256SUMS'),Object.entries(files).map(([name,content])=>`${digest(content)}  ${name}\n`).join(''));
  fs.writeFileSync(path.join(d,'SHA256SUMS.sig'),scenario==='bad-signature'&&version==='1.0.3'?'bad':'valid');
 }
 // Only the test copy is pointed at disposable locations and mock commands.
 const script=path.join(dir,'updater');
 const testSource=source.replace('PATH=/usr/sbin:/usr/bin:/sbin:/bin',`PATH=${bin}:/usr/bin:/bin:/sbin`)
  .replace('STATE=/etc/lumen-updater',`STATE=${state}`).replace('RUNTIME=/var/run/lumen-updater',`RUNTIME=${runtime}`)
  .replace('ASSETS=/usr/share/lumen-update',`ASSETS=${assets}`)
  .replace('RESCUE_MENU=/usr/share/luci/menu.d/zz-lumen-update-rescue.json',`RESCUE_MENU=${dir}/system/menu/zz-lumen-update-rescue.json`)
  .replace('RESCUE_ACL=/usr/share/rpcd/acl.d/luci-app-lumen-rescue.json',`RESCUE_ACL=${dir}/system/acl/luci-app-lumen-rescue.json`)
  .replace('RESCUE_RPC=/usr/share/rpcd/ucode/lumen.recovery',`RESCUE_RPC=${dir}/system/rpc/lumen.recovery`)
  .replace('RESCUE_VIEW=/www/luci-static/resources/view/lumen-rescue.js',`RESCUE_VIEW=${dir}/system/view/lumen-rescue.js`)
  .replaceAll('/www/luci-static/resources/lumen/version.json',data)
  .replaceAll('/etc/init.d/lumen-update-recovery',path.join(dir,'recovery-init'))
  .replaceAll('/etc/init.d/rpcd',path.join(dir,'rpcd-init'))
  .replaceAll('/usr/libexec/lumen-update',script);
 executable(script,testSource);
 executable(path.join(dir,'rpcd-init'),'#!/bin/sh\nexit 0\n');
 executable(path.join(bin,'jsonfilter'),`#!/usr/bin/python3
import json,sys
args=sys.argv[1:]
try:
 data=json.load(open(args[args.index('-i')+1])) if '-i' in args else json.load(sys.stdin)
 for part in args[args.index('-e')+1].replace('@.','').split('.'): data=data[part]
 print(str(data).lower() if isinstance(data,bool) else data)
except Exception: sys.exit(1)
`);
 executable(path.join(bin,'ubus'),`#!/bin/sh
case "$*" in
 '-S list lumen.recovery')
  case '${scenario}' in
   rpc-never) exit 1;;
   rpc-delayed)
    n=$(cat '${dir}/rpc-attempts' 2>/dev/null || echo 0)
    n=$((n+1)); printf '%s\\n' "$n" > '${dir}/rpc-attempts'
    [ "$n" -ge 3 ] || exit 1;;
  esac
  echo lumen.recovery;;
 *) printf '%s\\n' '{"release":{"version":"${format==='apk'?'25.12.6':'24.10.8'}"}}';;
esac
`);
 executable(path.join(bin,'uci'),`#!/bin/sh
case "$*" in
 *openclash.config.enable*) echo 1;; *openclash.config.http_port*) echo 7890;;
 *authentication*enabled*) echo 1;; *authentication*username*) echo test-user;;
 *authentication*password*) echo test-password;; *) exit 1;; esac
`);
 executable(path.join(bin,'curl'),`#!/bin/sh
printf '%s\\n' "$*" >> '${dir}/curl-args'
out= url= direct=no
while [ "$#" -gt 0 ]; do
 case "$1" in --noproxy) shift; [ "$1" != '*' ] || direct=yes;; -o) shift; out="$1";; https://*) url="$1";; esac
 shift
done
if [ "$direct" = yes ]; then
 case "${scenario}:$url" in direct-api-only:*/releases/latest) ;; *) exit 1;; esac
fi
cat >/dev/null
case "$url" in */releases/latest) cp '${dir}/latest.json' "$out";;
 */releases/download/*) tail="\x24{url#*/releases/download/}"; cp '${releases}/'"$tail" "$out";; *) exit 1;; esac
`);
 executable(path.join(bin,'usign'),`#!/bin/sh
while [ "$#" -gt 0 ]; do case "$1" in -x) shift; sig="$1";; esac; shift; done
[ "$(cat "$sig")" = valid ]
`);
 const versionRead=`$(/usr/bin/python3 -c 'import json; print(json.load(open("${data}"))["version"])')`;
 const doInstall=`
printf '%s\\n' "$*" >> '${dir}/install-log'
case ' ${scenario} ' in *' install-fail '*) case "$*" in *1.0.3*) exit 1;; esac;; esac
version=1.0.2; case "$*" in *1.0.3*) version=1.0.3;; esac
printf '{"version":"%s","format":"${format}"}\\n' "$version" > '${data}'
`;
 executable(path.join(bin,'apk'),`#!/bin/sh
case "$1" in
 info) [ "$3" != luci-theme-lumen-fonts ];;
 list) v=${versionRead}; case "$3" in luci-theme-lumen) echo "luci-theme-lumen-$v-r1 noarch [installed]";; luci-i18n-lumen-zh-cn) echo "luci-i18n-lumen-zh-cn-$v noarch [installed]";; esac;;
 *) case " $* " in *' verify '*) exit 0;; *' add '*) case " $* " in *' --simulate '*) case ' ${scenario} ' in *' unrelated-plan '*) case "$*" in *1.0.3*) echo '(1/2) Upgrading unrelated-package (1 -> 2)';; esac;; esac; echo 'OK: test'; exit 0;; esac; ${doInstall};; esac;;
esac
`);
 executable(path.join(bin,'opkg'),`#!/bin/sh
case "$1" in
 print-architecture) echo 'arch all 100'; exit 0;;
 list-installed) v=${versionRead}; case "$2" in luci-theme-lumen) echo "luci-theme-lumen - $v-r1";; luci-i18n-lumen-zh-cn) echo "luci-i18n-lumen-zh-cn - $v";; esac; exit 0;;
esac
case " $* " in *' --noaction '*) exit 0;; *' install '*) ${doInstall};; esac
`);
 executable(path.join(bin,'flock'),'#!/bin/sh\nexit 0\n');
 executable(path.join(bin,'ucode'),'#!/bin/sh\nexit 0\n');
 executable(path.join(bin,'setsid'),'#!/bin/sh\nexec "$@"\n');
 // Gate the two clocks independently so a fast CI host cannot run the
 // watchdog before the test has observed the worker's waiting state.
 executable(path.join(bin,'sleep'),`#!/bin/sh
 case "$1" in
  2) if [ '${scenario}' = timeout ]; then /bin/sleep 0.002; else
      while [ ! -f '${dir}/worker-go' ] && [ -f '${state}/pending' ]; do /bin/sleep 0.01; done
     fi;;
  5) while [ ! -f '${dir}/watchdog-go' ] && [ -f '${state}/pending' ]; do /bin/sleep 0.01; done
     /bin/sleep 0.002;;
 esac
 `);
 executable(path.join(bin,'sync'),'#!/bin/sh\nexit 0\n');
 return { dir, state, data, script };
}
async function awaitState(h, predicate, timeout=20000) {
 const end=Date.now()+timeout;
 let lastStatus;
 while(Date.now()<end) {
  try { const status=JSON.parse(fs.readFileSync(path.join(h.state,'status.json'),'utf8')); lastStatus=status; if(predicate(status)) return status; } catch(e) {}
  await wait(10);
 }
 throw new Error('Timed out waiting for updater state; last state: '+JSON.stringify(lastStatus));
}
function invoke(h, action) { return spawnSync('/bin/sh',[h.script,action],{encoding:'utf8'}); }
async function runWorker(h, script=h.script) {
 const child=spawn('/bin/sh',[script,'worker'],{stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,stderr}));});
 return {child,done};
}
function installed(h){return JSON.parse(fs.readFileSync(h.data,'utf8')).version;}
function log(h){try{return fs.readFileSync(path.join(h.dir,'install-log'),'utf8');}catch(e){return '';}}
async function main(){
 for(const format of ['apk','ipk']) {
  {
   const h=makeHarness(format,'current'), process=await runWorker(h), result=await process.done;
   assert.equal(result.code,0,result.stderr);assert.equal((await awaitState(h,s=>s.state==='current')).installed,'1.0.2');
   assert.equal(log(h),'');assert(!fs.existsSync(path.join(h.state,'pending')));
   const args=fs.readFileSync(path.join(h.dir,'curl-args'),'utf8');assert(args.includes('--proxy'));assert(!args.includes('test-password'));
  }
  {
   const h=makeHarness(format,'bad-signature'), process=await runWorker(h), result=await process.done;
   assert.notEqual(result.code,0);assert.equal((await awaitState(h,s=>s.state==='error')).code,'new_release');
   assert.equal(log(h),'');assert.equal(installed(h),'1.0.2');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  if (format === 'apk') {
   const h=makeHarness(format,'unrelated-plan'), process=await runWorker(h), result=await process.done;
   assert.notEqual(result.code,0);assert.equal((await awaitState(h,s=>s.state==='error')).code,'new_release');
   assert.equal(log(h),'');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  if (format === 'apk') {
   const h=makeHarness(format,'rpc-delayed'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting');
   assert(Number(fs.readFileSync(path.join(h.dir,'rpc-attempts'),'utf8')) >= 3, 'Retry until the retained RPC bridge registers');
   const result=invoke(h,'confirm');assert.equal(result.status,0,result.stderr);
   fs.writeFileSync(path.join(h.dir,'worker-go'),'');assert.equal((await process.done).code,0);
  }
  if (format === 'apk') {
   const h=makeHarness(format,'rpc-never'), process=await runWorker(h), result=await process.done;
   assert.notEqual(result.code,0);assert.equal((await awaitState(h,s=>s.state==='error')).code,'recovery');
   assert.equal(installed(h),'1.0.2');assert.equal(log(h),'');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  {
   const h=makeHarness(format,'success'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting'); assert.equal(installed(h),'1.0.3');
   const result=invoke(h,'confirm');assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).state,'confirmed');
   fs.writeFileSync(path.join(h.dir,'worker-go'),'');
   assert.equal((await process.done).code,0);assert.equal((await awaitState(h,s=>s.state==='success')).target,'1.0.3');
   assert(fs.existsSync(path.join(h.state,'current')));assert(!fs.existsSync(path.join(h.state,'pending')));
   const rollback=invoke(h,'manual-rollback');assert.equal(rollback.status,0,rollback.stderr);assert.equal(installed(h),'1.0.2');
   assert.equal((await awaitState(h,s=>s.state==='rolled_back')).installed,'1.0.2');
   const menu=path.join(h.dir,'system/menu/zz-lumen-update-rescue.json');
   assert.equal(JSON.parse(fs.readFileSync(menu,'utf8'))['admin/lumen/updates'].action.path,'lumen-rescue');
   assert(fs.existsSync(path.join(h.dir,'system/rpc/lumen.recovery')));
   assert(fs.existsSync(path.join(h.dir,'system/acl/luci-app-lumen-rescue.json')));
   assert(fs.existsSync(path.join(h.dir,'system/view/lumen-rescue.js')));
   assert(fs.existsSync(path.join(h.state,'current')),'The rollback transaction must remain until the next confirmed update');
   // Simulate an older package removing every updater file it owned. The
   // independent recovery copy must still perform and confirm the next update.
   fs.rmSync(path.join(h.dir,'assets'),{recursive:true}); fs.rmSync(h.script);
   fs.rmSync(path.join(h.dir,'worker-go'));
   const recovery=path.join(h.state,'recovery.sh');
   const again=spawnSync('/bin/sh',[recovery,'start'],{encoding:'utf8'});
   assert.equal(again.status,0,again.stderr);assert.equal(JSON.parse(again.stdout).state,'started');
   await awaitState(h,s=>s.state==='waiting');
   const confirmation=spawnSync('/bin/sh',[recovery,'confirm'],{encoding:'utf8'});
   assert.equal(confirmation.status,0,confirmation.stderr);fs.writeFileSync(path.join(h.dir,'worker-go'),'');
   await awaitState(h,s=>s.state==='success');assert.equal(installed(h),'1.0.3');
   assert(!fs.existsSync(menu),'The original update page must return after confirmation');
   assert(fs.existsSync(recovery),'The independent updater must remain available for future recovery');
  }
  {
   const h=makeHarness(format,'success');
   const menu=path.join(h.dir,'system/menu/zz-lumen-update-rescue.json');
   fs.mkdirSync(path.dirname(menu),{recursive:true});fs.writeFileSync(menu,'unrelated user file');
   const process=await runWorker(h), result=await process.done;
   assert.notEqual(result.code,0);assert.equal((await awaitState(h,s=>s.state==='error')).code,'recovery');
   assert.equal(installed(h),'1.0.2');assert.equal(fs.readFileSync(menu,'utf8'),'unrelated user file');
   assert.equal(log(h),'');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  if (format === 'apk') {
   const h=makeHarness(format,'direct-api-only'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting');
   const result=invoke(h,'confirm');assert.equal(result.status,0,result.stderr);
   fs.writeFileSync(path.join(h.dir,'worker-go'),'');assert.equal((await process.done).code,0);
   const args=fs.readFileSync(path.join(h.dir,'curl-args'),'utf8');
   assert(args.includes('--noproxy *') && args.includes('--proxy'));
  }
  {
   const h=makeHarness(format,'install-fail'), process=await runWorker(h), result=await process.done;
   assert.notEqual(result.code,0);assert.equal((await awaitState(h,s=>s.state==='rolled_back')).installed,'1.0.2');
   assert.equal(installed(h),'1.0.2');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  {
   const h=makeHarness(format,'timeout'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting');
   const result=await process.done;assert.equal(result.code,0,result.stderr);
   assert.equal((await awaitState(h,s=>s.state==='rolled_back')).installed,'1.0.2');
   assert.equal(installed(h),'1.0.2');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  {
   const h=makeHarness(format,'worker-crash'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting');process.child.kill('SIGKILL');
   fs.writeFileSync(path.join(h.dir,'worker-go'),'');fs.writeFileSync(path.join(h.dir,'watchdog-go'),'');await process.done;
   await awaitState(h,s=>s.state==='rolled_back');
   assert.equal(installed(h),'1.0.2');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  {
   const h=makeHarness(format,'power-loss'), process=await runWorker(h);
   await awaitState(h,s=>s.state==='waiting');process.child.kill('SIGKILL');
   fs.writeFileSync(path.join(h.dir,'worker-go'),'');await process.done;
   assert(fs.existsSync(path.join(h.state,'pending')));assert.equal(installed(h),'1.0.3');
   const recovery=invoke(h,'boot-recover');assert.equal(recovery.status,0,recovery.stderr);
   assert.equal(installed(h),'1.0.2');assert(!fs.existsSync(path.join(h.state,'pending')));
  }
  console.log('PASS automatic updater state machine: '+format+' signature rejection, rollback and update again without theme-owned updater, collision safety, timeout, crash and reboot recovery');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const dir of temps)fs.rmSync(dir,{recursive:true,force:true});});
