const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(require('os').tmpdir(),'lumen-lifecycle-'));
const bash=process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Git/bin/bash.exe'):'/bin/sh';
const registration=fs.readFileSync(path.join(root,'root/etc/uci-defaults/30_luci-theme-lumen'),'utf8');
const makefile=fs.readFileSync(path.join(root,'Makefile'),'utf8');
const postrm=makefile.match(/define Package\/luci-theme-lumen\/postrm\n([\s\S]*?)\nendef/)[1].replace(/\$\$/g,'$');
const mock=`uci() {
  [ "$1" != '-q' ] || shift
  case "$1" in
    get) [ -f "$MOCK_STATE/$2" ] || return 1; cat "$MOCK_STATE/$2" ;;
    set) key=\x24{2%%=*}; value=\x24{2#*=}; printf '%s' "$value" > "$MOCK_STATE/$key" ;;
    delete) rm -f "$MOCK_STATE/$2" ;;
    commit) printf '%s\\n' "$2" >> "$MOCK_STATE/commits" ;;
    *) return 91 ;;
  esac
}
`;
function run(script,name,state,instroot='',args=[]){
 const dir=path.join(temp,name);fs.mkdirSync(dir,{recursive:true});
 for(const [k,v] of Object.entries(state))fs.writeFileSync(path.join(dir,k),v);
 const file=path.join(temp,name+'.sh');fs.writeFileSync(file,mock+script);
 let result=spawnSync(bash,['-n',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 result=spawnSync(bash,[file,...args],{encoding:'utf8',env:{...process.env,MOCK_STATE:dir.replace(/\\/g,'/'),IPKG_INSTROOT:instroot}});assert.equal(result.status,0,result.stderr);
 return Object.fromEntries(fs.readdirSync(dir).map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]));
}
const original={'luci.main.mediaurlbase':'/luci-static/existing','unrelated-network':'preserve'};
let s=run(registration,'register',original);assert.equal(s['luci.themes.Lumen'],'/luci-static/lumen');assert.equal(s['luci.main.mediaurlbase'],original['luci.main.mediaurlbase']);assert.equal(s['unrelated-network'],'preserve');
s=run(registration,'idempotent',{'luci.themes.Lumen':'/luci-static/lumen',...original});assert(!s.commits);assert.equal(s['luci.main.mediaurlbase'],original['luci.main.mediaurlbase']);
s=run(postrm,'remove-active',{'luci.themes.Lumen':'/luci-static/lumen','luci.main.mediaurlbase':'/luci-static/lumen','unrelated-network':'preserve'});assert.equal(s['luci.main.mediaurlbase'],'/luci-static/bootstrap');assert(!s['luci.themes.Lumen']);assert.equal(s['unrelated-network'],'preserve');
s=run(postrm,'remove-inactive',{'luci.themes.Lumen':'/luci-static/lumen',...original});assert.equal(s['luci.main.mediaurlbase'],original['luci.main.mediaurlbase']);assert(!s['luci.themes.Lumen']);
s=run(postrm,'offline',{'luci.themes.Lumen':'/luci-static/lumen',...original},'/image-root');assert.equal(s['luci.themes.Lumen'],'/luci-static/lumen');assert(!s.commits);
const active={'luci.themes.Lumen':'/luci-static/lumen','luci.main.mediaurlbase':'/luci-static/lumen','unrelated-network':'preserve'};
s=run(postrm,'opkg-upgrade',active,'',['upgrade','1.0.2-r1']);assert.deepEqual(s,active);
s=run(postrm,'opkg-remove',active,'',['remove']);assert.equal(s['luci.main.mediaurlbase'],'/luci-static/bootstrap');assert(!s['luci.themes.Lumen']);
s=run(postrm,'apk-deinstall',active,'',['1.0.1-r1']);assert.equal(s['luci.main.mediaurlbase'],'/luci-static/bootstrap');assert(!s['luci.themes.Lumen']);
console.log('Package lifecycle mock checks passed: registration, idempotence, active fallback, inactive removal, offline guard, opkg upgrade/remove, APK deinstall.');
