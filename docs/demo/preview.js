'use strict';
/* This demo executes the theme's real dashboard and chart modules with local,
 * synthetic fixtures. It never calls LuCI RPC, reads router data, or changes UCI.
 * Theme modules load locally; the update preview intercepts release requests. */
const assets = '../../htdocs/luci-static/resources/';
const translations = {
  'Good night':'你好','Good morning':'早上好','Good afternoon':'下午好','Good evening':'晚上好',
  'CPU usage':'CPU 使用率','Memory':'内存','Active connections':'活动连接','Online devices':'在线设备',
  'Up for':'已运行','Live traffic':'实时流量','Download':'下载','Upload':'上传','Network interfaces':'网络接口',
  'Manage':'管理','All':'全部','System':'系统','Shortcuts':'快捷入口','Interfaces':'接口','Firewall':'防火墙',
  'Software':'软件包','System Log':'系统日志','Backup / Upgrade':'备份 / 升级','Reboot':'重启',
  'Traffic unit':'流量单位','Collecting data…':'正在收集数据…','%d cores':'%d 核心','Load %s':'负载 %s',
  'Used %s':'已用 %s','Total %s':'总计 %s','Limit %d':'上限 %d','DHCP leases':'DHCP 租约','%d devices':'%d 台设备',
  'Model':'型号','Processor':'处理器','Firmware':'固件','Kernel':'内核','System storage':'系统存储',
  'Temporary space':'临时空间','WAN connected':'WAN 已连接','WAN disconnected':'WAN 未连接',
  'Online':'在线','Offline':'离线','%dd %dh':'%d 天 %d 小时','%dh %dm':'%d 小时 %d 分','%dm':'%d 分',
  '%s · last 60 s':'%s · 最近 60 秒','%s · last %s':'%s · 最近%s','a few minutes':'几分钟'
};
const english = document.documentElement.lang === 'en';
const updatesDemo = document.documentElement.dataset.demoView === 'updates';
if (english) {
  document.title = 'Lumen · Demo data';
  document.body.classList.replace('lang_zh-cn', 'lang_en');
  document.querySelectorAll('[data-en]').forEach(el => { el.textContent = el.dataset.en; });
  document.querySelectorAll('[data-en-label]').forEach(el => {
    el.title = el.dataset.enLabel;
    el.setAttribute('aria-label', el.dataset.enLabel);
  });
}
if (updatesDemo) {
  document.body.dataset.page = 'admin-lumen-updates';
  document.querySelector('.brand-model').textContent = 'OpenWrt · Update preview';
  document.querySelector('.sb-item.active .sb-text').textContent = 'Updates';
  document.querySelector('.crumbs li:last-child').textContent = 'Updates';
  document.querySelector('.page-footer span').textContent = 'Lumen · Sample release history; not actual published releases. This page does not connect to a router.';
}
window._ = text => english ? text : translations[text] || text;
String.prototype.format = function(...args){let index=0;return this.replace(/%(?:\.(\d+))?([sdf%])/g,(_,digits,type)=>{if(type==='%')return '%';const value=args[index++];return type==='f'?Number(value).toFixed(Number(digits)||0):type==='d'?String(Math.trunc(Number(value))):String(value);});};
function content(el, children){el.replaceChildren();const add=x=>{if(x==null)return;if(Array.isArray(x)){x.forEach(add);return}el.appendChild(x instanceof Node?x:document.createTextNode(String(x)));};add(children);return el;}
window.E = function(tag, attrs={}, children=[]){const el=document.createElement(tag);Object.entries(attrs).forEach(([key,val])=>{if(typeof val==='function')el.addEventListener(key,val);else if(val!=null)el.setAttribute(key,String(val));});return content(el,children);};
window.L={resolveDefault:(promise,fallback)=>Promise.resolve(promise).catch(()=>fallback),url:()=> '#demo-action',resource:()=> '/demo/version.json'};
window.lumenConfig={hostname:'Lumen',model:'OpenWrt Router',style:document.documentElement.dataset.style};
const board={hostname:'Lumen',model:'OpenWrt Router',system:'Generic quad-core processor',kernel:'6.12',release:{description:'OpenWrt · LuCI preview'}};
const fixtureTime=1767225600;
const names=['Laptop','Phone','Tablet','Living-room TV','Workstation','Home speaker','Game console','Guest device'];
const leases=names.map((hostname,i)=>({hostname,ipaddr:'192.0.2.'+(10+i),macaddr:'02:00:00:00:00:'+String(i+1).padStart(2,'0')}));
const ifaces=[
  {interface:'uplink',up:true,proto:'dhcp',l3_device:'wan0',uptime:183600,route:[{target:'0.0.0.0',mask:0}], 'ipv4-address':[{address:'198.51.100.2',mask:24}]},
  {interface:'lan',up:true,proto:'static',l3_device:'br-lan',uptime:183600,'ipv4-address':[{address:'192.0.2.1',mask:24}]},
  {interface:'uplink6',up:true,proto:'dhcpv6',l3_device:'wan0',uptime:183600,route:[{target:'::',mask:0}], 'ipv6-address':[{address:'2001:db8:1::2',mask:64}]}
];
const info={uptime:183600,localtime:fixtureTime+43200,load:[10486,7864,5898],memory:{total:4294967296,available:3521873183},root:{total:2097152,used:367002},tmp:{total:2097152,used:8192}};
function series(){const end=Math.floor(Date.now()/1000),rt=[],ct=[],cpu=[];let rx=0,tx=0;for(let i=0;i<=75;i++){const down=(12+4*Math.sin(i*.23)+2.2*Math.sin(i*.73)+(i>35&&i<43?7:0))*1e6,up=(1.3+.5*Math.sin(i*.31)+.2*Math.cos(i*.63))*1e6;rx+=down;tx+=up;rt.push([end-75+i,rx,0,tx]);ct.push([end-75+i,80+Math.round(12*Math.sin(i*.4)),330+Math.round(28*Math.sin(i*.19)),8]);cpu.push({t:end-75+i,v:7.6+2.7*Math.sin(i*.23)+1.1*Math.cos(i*.49)});}return{rt,ct,cpu};}
let statIndex=0;
function stat(){statIndex++;return `cpu ${10000+statIndex*76} 0 0 ${100000+statIndex*924} 0 0 0 0\n`+[0,1,2,3].map(i=>`cpu${i} 2500 0 0 25000 0 0 0 0`).join('\n');}
const menu={children:{admin:{children:{
  network:{children:{network:{},firewall:{},dhcp:{}}},
  system:{children:{'package-manager':{},flash:{},reboot:{}}},
  status:{children:{logs:{}}}
}}}};
const rpc={declare:({method})=>(...args)=>Promise.resolve(method==='board'?board:method==='info'?info:method==='dump'?ifaces:method==='getDHCPLeases'?leases:method==='getRealtimeStats'?(args[0]==='conntrack'?series().ct:series().rt):{})};
const mockfs={read:p=>Promise.resolve(p==='/proc/stat'?stat():'262144')};
const poll={add:()=>{}};
const icons={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',network:'<rect x="9" y="3" width="6" height="5" rx="1"/><path d="M12 8v5M5 13h14M5 13v3M19 13v3"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z"/>',palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r=".7"/><circle cx="12" cy="7" r=".7"/><circle cx="16" cy="9" r=".7"/><path d="M7 16h5l2-3h7"/>'};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[el.dataset.icon]}</svg>`;});
document.getElementById('sidebar-toggle').addEventListener('click',()=>document.documentElement.classList.toggle(innerWidth<=1024?'sidebar-open':'sidebar-collapsed'));
document.getElementById('sidebar-overlay').addEventListener('click',()=>document.documentElement.classList.remove('sidebar-open'));
document.getElementById('theme-toggle').addEventListener('click',()=>{const root=document.documentElement,dark=root.dataset.darkmode!=='true';root.dataset.darkmode=String(dark);root.dataset.mode=dark?'dark':'light';});
document.addEventListener('click',event=>{const anchor=event.target.closest('a');if(anchor&&(anchor.getAttribute('href')==='#demo-action'||(updatesDemo&&anchor.href.startsWith('https://github.com/')))){event.preventDefault();}});
async function loadUpdates(){
  // Local fixtures keep this preview independent of actual published releases.
  const base='https://github.com/qidlek114/luci-theme-lumen/releases';
  const release=(tag,id,body,assets=[])=>({id,tag_name:tag,name:tag,body,draft:false,prerelease:false,assets});
  const tag='v1.1.0';
  const asset=name=>({name,state:'uploaded',size:1024,browser_download_url:base+'/download/'+tag+'/'+name});
  const releases=[
    release('v1.0.1',1,'Sample notes\n• Installable theme and translation packages.\n• Select the theme manually after installation.'),
    release('v1.0.2',2,'Sample notes\n• Improved responsive tables and text wrapping.\n• Clearer update status messages.'),
    release(tag,3,'Sample notes\n• Review the full range of changes before downloading.\n• Verify the signing key and package signatures.',[
      asset('luci-theme-lumen-1.1.0-r1.apk'),asset('lumen-apk.pub'),asset('SHA256SUMS'),asset('SHA256SUMS.sig')
    ])
  ];
  const demoFetch=async url=>{
    let value;
    if(url==='/demo/version.json') value={version:'1.0.0',format:'apk'};
    else if(String(url).startsWith('https://api.github.com/repos/qidlek114/luci-theme-lumen/releases?')) value=releases;
    else throw new Error('Unexpected preview request');
    return {ok:true,status:200,headers:{get:()=>null},json:async()=>value};
  };
  const files=await Promise.all(['lumen/updates.js','view/lumen/updates.js'].map(async p=>{const r=await fetch(assets+p);if(!r.ok)throw Error('Missing local theme module');return r.text();}));
  const updates=new Function('baseclass','fetch',files[0])({extend:x=>x},demoFetch);
  const view=new Function('view','dom','ui','updates',files[1])({extend:x=>x},{content},{menu:{load:()=>Promise.resolve(menu)}},updates);
  content(document.getElementById('view'),view.render(await view.load()));
  await view.checkUpdates();
  document.documentElement.dataset.demoReady='true';
}
async function load(){
  if(updatesDemo) return loadUpdates();
  const files=await Promise.all(['lumen/streamchart.js','view/lumen/dashboard.js'].map(async p=>{const r=await fetch(assets+p);if(!r.ok)throw Error('Missing local theme module');return r.text();}));
  const sc=new Function('baseclass',files[0])({extend:x=>x});
  const view=new Function('view','rpc','poll','fs','dom','ui','sc',files[1])({extend:x=>x},rpc,poll,mockfs,{content},{menu:{load:()=>Promise.resolve(menu)}},sc);
  const initial=await view.load();content(document.getElementById('view'),view.render(initial));
  await view.refresh();await view.fastTick();
  const repaint=()=>{const data=series();view.cpuChart.push(data.cpu);view.updateConn(data.ct);view.ingestTraffic(data.rt);};
  repaint();setInterval(repaint,1000);
  view.nodes.chart.closest('.ds-card').id='traffic';view.nodes.leases.closest('.ds-card').id='devices';view.nodes.storage.closest('.ds-card').id='system';
  document.documentElement.dataset.demoReady='true';
}
load().catch(error=>{document.getElementById('view').textContent='Preview could not load: '+error.message;document.documentElement.dataset.demoError='true';});
