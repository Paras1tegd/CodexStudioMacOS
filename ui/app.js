const Xterm = window.Xterm;
const $ = id => document.getElementById(id);
const send = message => {window.webkit?.messageHandlers.studio.postMessage(message);if(message.type==='start')setTimeout(()=>{const s=sessions.get(message.id);if(s){s.fit.fit();send({type:'resize',id:s.id,cols:s.term.cols,rows:s.term.rows});}},100);};
const palettes = {
  Graphite: ['#141517','#1b1c1f','#191a1d','#2c2d32','#ececef','#929399','#b8acd9','#28272e'],
  Midnight: ['#0d1520','#131e2d','#101b29','#253449','#dce6f3','#8295ad','#8bbbf2','#203047'],
  Dune: ['#ebe6de','#f8f5ee','#f1ece3','#dcd4c7','#3c3832','#8b8173','#8e684a','#e9e1d5'],
  Forest: ['#121b18','#19241f','#15201c','#2b3b32','#e1e9df','#8eaa98','#a9c49b','#29392e']
};
let settings = {theme:'Graphite',fontSize:14,sidebar:false,model:'',effort:'',customThemes:{},panelOpacity:100,highlightOpacity:100,settingsOpacity:100,githubWidget:false};
let catalog=[], integrationBusy=false;
let active = null, workspace = '', counter = 0;
const sessions = new Map();
function save(){send({type:'settings',value:settings});}
function theme(){
 const p=settings.customThemes[settings.theme] || palettes[settings.theme] || palettes.Graphite;
 const alpha=(hex,n)=>hex+Math.round(n*2.55).toString(16).padStart(2,'0');
 for(const [key,color,value] of [['panel-fill',p[1],settings.panelOpacity],['sidebar-fill',p[2],settings.panelOpacity],['highlight-fill',p[7],settings.highlightOpacity],['settings-fill',p[1],settings.settingsOpacity]])document.documentElement.style.setProperty('--'+key,alpha(color,value));
 ['bg','surface','panel','line','text','muted','accent','hover'].forEach((k,i)=>document.documentElement.style.setProperty('--'+k,p[i]));
 const luminance=[1,3,5].map(i=>parseInt(p[0].slice(i,i+2),16));
 document.documentElement.style.colorScheme = (luminance[0]*.2126+luminance[1]*.7152+luminance[2]*.0722)>150?'light':'dark';
 sessions.forEach(s=>{s.term.options.fontSize=settings.fontSize;s.term.options.theme={background:'#00000000',foreground:p[4],cursor:p[6],selectionBackground:p[6]+'44',black:p[0],brightBlack:p[5],red:'#d87878',green:'#83ab82',yellow:'#c2a16f',blue:'#85a8d3',magenta:'#b69bcc',cyan:'#7db5b0',white:p[4]};});
 $('fontSize').textContent=settings.fontSize;
 document.querySelectorAll('.theme-card').forEach(b=>{b.classList.toggle('selected',b.dataset.theme===settings.theme);b.setAttribute('aria-pressed',b.dataset.theme===settings.theme);});
 fitAll();
}
function fitAll(){requestAnimationFrame(()=>sessions.forEach(s=>{if(s.host.offsetWidth>0&&s.host.offsetHeight>0){try{s.fit.fit();}catch{}}}));}
function terminal(id, mode){
 if(sessions.has(id))return sessions.get(id);
 const host=mode==='shell'?$('shell'):document.createElement('div');
 if(mode!=='shell'){host.className='terminal-host';$('terminals').append(host);}
 const term=new Xterm.Terminal({allowTransparency:true,cursorBlink:true,fontFamily:'Menlo, Monaco, monospace',fontSize:settings.fontSize,lineHeight:1.28,scrollback:10000,allowProposedApi:false,convertEol:false});
 const fit=new Xterm.FitAddon();term.loadAddon(fit);term.open(host);
 const s={id,mode,term,fit,host,ended:false,workspace,model:settings.model,effort:settings.effort};sessions.set(id,s);
 term.onData(input=>send({type:'input',id,input}));
 term.onResize(size=>send({type:'resize',id,...size}));
 term.attachCustomKeyEventHandler(event=>{
   if(event.metaKey&&['j',',','n','c','v','a'].includes(event.key.toLowerCase())){
     if(event.key.toLowerCase()==='c'&&!term.hasSelection()) return true;
     return false;
   }
   return true;
 });
 if(mode!=='shell'){
  const tab=document.createElement('button');tab.className='tab';tab.textContent=mode==='github'?'GitHub sign-in':'◌  Session '+(++counter);tab.role='tab';tab.onclick=()=>activate(id);tab.dataset.id=id;$('tabs').append(tab);activate(id);
 }
 theme();return s;
}
function activate(id){active=id;sessions.forEach(s=>{if(s.mode!=='shell')s.host.hidden=s.id!==id;});document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b.dataset.id===id);b.setAttribute('aria-selected',b.dataset.id===id);});fitAll();sessions.get(id)?.term.focus();updateStatus();}
function updateStatus(){const s=sessions.get(active);$('status').textContent=s?.ended?'Session ended · start a new session':'●  '+((s?.workspace||workspace).split('/').pop()||'Workspace')+'  /  '+(s?.mode==='github'?'GitHub sign-in':(s?.model||'Codex default')+(s?.effort?' · '+s.effort:''));}
function createCodex(){const id='codex-'+Date.now();terminal(id,'codex');send({type:'start',id,mode:'codex'});}
function sidebar(show){settings.sidebar=show;$('sidebar').hidden=!show;$('toggle').setAttribute('aria-pressed',show);if(show&&!sessions.has('shell')){terminal('shell','shell');send({type:'start',id:'shell',mode:'shell'});}fitAll();save();if(show)sessions.get('shell')?.term.focus();else sessions.get(active)?.term.focus();}
function dialog(show){$('overlay').hidden=!show;document.querySelector('header').inert=show;document.querySelector('main').inert=show;if(show){syncSettings();refreshIntegration();$('closeSettings').focus();}else sessions.get(active)?.term.focus();}
window.studio = {
 boot(config){settings={...settings,...config.settings};settings.customThemes ||= {};renderThemes();workspace=config.cwd;$('folderName').textContent=workspace.split('/').pop()||'Workspace';$('folder').title=workspace+' — choose folder for new sessions';theme();createCodex();if(settings.sidebar)sidebar(true);showGithubWidget(settings.githubWidget);},
 receive(id,msg){const s=sessions.get(id);if(!s)return;if(msg.data)s.term.write(Uint8Array.from(atob(msg.data),c=>c.charCodeAt(0)));if(msg.exit!==undefined){s.ended=true;s.term.writeln('\r\n\x1b[90mSession ended ('+msg.exit+'). Start a new session to continue.\x1b[0m');updateStatus();}},
 folder(path){workspace=path;$('folderName').textContent=path.split('/').pop();$('folder').title=path;createCodex();if(settings.githubWidget)loadGithubWidget();toast('New Codex session opened in '+path.split('/').pop());},
 integration(result){
  integrationBusy=false;document.querySelectorAll('[data-section="github"] button').forEach(b=>b.disabled=false);
  if(result.error){$('githubMessage').textContent=result.error;return;}
  if(settings.githubWidget)loadGithubWidget();catalog=result.models||[];renderModels();$('githubWorkspace').textContent=result.cwd;
  $('repository').value=result.repo||'';
  $('githubStatus').textContent=!result.git?'This folder is not a Git repository.':result.repo?'Linked to '+result.repo:result.hasOrigin?'Origin uses another host or URL format.':'No origin remote linked.';
  $('saveRepository').disabled=!result.git;
  $('githubAccount').replaceChildren();
  for(const a of result.accounts||[])$('githubAccount').add(new Option(a.login+(a.active?' (active)':''),a.login,a.active,a.active));
  if(!$('githubAccount').options.length)$('githubAccount').add(new Option('No signed-in accounts',''));
  $('switchAccount').disabled=!result.gh||!(result.accounts||[]).length;
  $('loginGithub').disabled=!result.gh;
  $('githubMessage').textContent=result.gh?'Sign-in opens a separate terminal tab. Return here and refresh when finished.':'GitHub CLI is not installed. Install it from cli.github.com, then refresh to sign in or switch accounts.';
 },
 githubWidget:receiveGithubWidget,
 toast,
 copy(){if(!$('overlay').hidden){const el=document.activeElement;if(el instanceof HTMLInputElement&&el.type!=='color'&&el.type!=='range'){send({type:'copy',text:el.value.substring(el.selectionStart||0,el.selectionEnd||0)});return;}send({type:'copy',text:window.getSelection()?.toString()||''});return;}const s=[...sessions.values()].find(s=>s.term.hasSelection());if(s)send({type:'copy',text:s.term.getSelection()});},
 paste(text){if(!$('overlay').hidden){const el=document.activeElement;if(el instanceof HTMLInputElement&&['text','search'].includes(el.type)){el.setRangeText(text,el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}return;}const s=[...sessions.values()].find(s=>s.host.contains(document.activeElement))||sessions.get(active);s?.term.paste(text);},
 action(name){if(name==='sidebar')sidebar(!settings.sidebar);if(name==='settings')dialog(true);if(name==='new')createCodex();},
 refreshCSS(css){let el=$('liveStyle');if(!el){el=document.createElement('style');el.id='liveStyle';document.head.append(el);}el.textContent=css;fitAll();toast('Appearance updated · sessions kept running');}
};
new ResizeObserver(fitAll).observe($('terminals'));
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500);}
const colorNames=['Background','Terminal panel','Sidebar','Borders','Text','Muted text','Accent','Highlights'];
function renderThemes(){
 $('themes').replaceChildren();
 for(const [name,p] of Object.entries({...palettes,...settings.customThemes})){
  const b=document.createElement('button');b.className='theme-card';b.dataset.theme=name;
  const swatch=document.createElement('div');swatch.className='swatch';const label=document.createElement('span');label.textContent=name;b.append(swatch,label);
  b.style.setProperty('--swatch-bg',p[1]);b.style.setProperty('--swatch-accent',p[6]);b.style.setProperty('--swatch-line',p[3]);
  b.onclick=()=>{settings.theme=name;theme();syncEditor();save();};$('themes').append(b);
 }
}
function syncEditor(){
 const custom=Object.hasOwn(settings.customThemes,settings.theme);
 $('themeName').value=custom?settings.theme:'';
 const p=settings.customThemes[settings.theme]||palettes[settings.theme]||palettes.Graphite;
 $('colorFields').replaceChildren();colorNames.forEach((name,i)=>{const label=document.createElement('label');label.textContent=name;const input=document.createElement('input');input.type='color';input.value=p[i];input.id='color'+i;label.append(input);$('colorFields').append(label);});
 $('updateTheme').disabled=$('deleteTheme').disabled=!custom;
}
function syncSettings(){
 for(const key of ['panelOpacity','highlightOpacity','settingsOpacity']){$(key).value=settings[key];$(key+'Value').textContent=settings[key]+'%';}
 renderModels();syncEditor();
}
function renderModels(){
 const known=catalog.some(m=>m.id===settings.model);
 $('model').replaceChildren(new Option('Codex default',''));
 for(const m of catalog)$('model').add(new Option(m.name,m.id));
 $('model').value=known?settings.model:'';$('customModel').value=known?'':settings.model;renderEfforts();
}
function renderEfforts(){
 const model=catalog.find(m=>m.id===settings.model);
 const levels=model?.efforts||['none','minimal','low','medium','high','xhigh','max','ultra'];
 $('effort').replaceChildren(new Option('Model default',''));
 for(const value of levels)$('effort').add(new Option(value[0].toUpperCase()+value.slice(1),value));
 if(settings.effort&&!levels.includes(settings.effort)){settings.effort='';save();}
 $('effort').value=settings.effort;
}
function refreshIntegration(action='status',extra={}){
 if(integrationBusy)return;integrationBusy=true;$('githubMessage').textContent='Checking…';
 document.querySelectorAll('[data-section="github"] button').forEach(b=>b.disabled=true);
 send({type:'integration',action,...extra});
}
for(const button of document.querySelectorAll('[data-page]'))button.onclick=()=>{
 document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-selected',b===button));
 document.querySelectorAll('[data-section]').forEach(s=>s.hidden=s.dataset.section!==button.dataset.page);document.querySelector('.settings-scroll').scrollTop=0;
};
for(const key of ['panelOpacity','highlightOpacity','settingsOpacity'])$(key).oninput=()=>{settings[key]=Number($(key).value);$(key+'Value').textContent=settings[key]+'%';theme();save();};
function storeTheme(update){
 const name=update?settings.theme:$('themeName').value.trim();
 if(!name||Object.hasOwn(palettes,name)||['__proto__','constructor','prototype'].includes(name)||(!update&&Object.hasOwn(settings.customThemes,name))){$('themeMessage').textContent='Choose a unique name for your theme.';return;}
 settings.customThemes[name]=colorNames.map((_,i)=>$('color'+i).value);settings.theme=name;renderThemes();theme();syncEditor();save();$('themeMessage').textContent='Theme saved.';
}
$('saveTheme').onclick=()=>storeTheme(false);$('updateTheme').onclick=()=>storeTheme(true);
$('deleteTheme').onclick=()=>{if(!Object.hasOwn(settings.customThemes,settings.theme))return;if(!confirm('Delete “'+settings.theme+'”?'))return;delete settings.customThemes[settings.theme];settings.theme='Graphite';renderThemes();theme();syncEditor();save();};
$('model').onchange=()=>{settings.model=$('model').value;$('customModel').value='';renderEfforts();save();};
$('customModel').onchange=()=>{const value=$('customModel').value.trim();if(/\s/.test(value)){toast('Model IDs cannot contain spaces.');return;}settings.model=value||$('model').value;renderEfforts();save();};
$('effort').onchange=()=>{settings.effort=$('effort').value;save();};
$('startConfigured').onclick=()=>{dialog(false);createCodex();};
$('chooseRepoFolder').onclick=()=>{dialog(false);send({type:'folder'});};
$('saveRepository').onclick=()=>{if(confirm('Set this workspace’s origin remote to '+$('repository').value+'?'))refreshIntegration('remote',{repo:$('repository').value});};
$('switchAccount').onclick=()=>{if(confirm('Switch GitHub CLI on this Mac to '+$('githubAccount').value+'?'))refreshIntegration('switch',{login:$('githubAccount').value});};
$('refreshGithub').onclick=()=>refreshIntegration();
$('loginGithub').onclick=()=>{dialog(false);const id='github-'+Date.now();terminal(id,'github');send({type:'start',id,mode:'github'});};
renderThemes();
$('toggle').onclick=()=>sidebar(!settings.sidebar);$('closeShell').onclick=()=>sidebar(false);
$('restartShell').onclick=()=>{const old=sessions.get('shell');if(old&&!old.ended&&!confirm('End the current shell and start a new one?'))return;send({type:'stop',id:'shell'});old?.term.dispose();sessions.delete('shell');$('shell').replaceChildren();terminal('shell','shell');send({type:'start',id:'shell',mode:'shell'});};
$('new').onclick=createCodex;$('folder').onclick=()=>send({type:'folder'});$('settings').onclick=()=>dialog(true);$('closeSettings').onclick=$('done').onclick=()=>dialog(false);
$('overlay').onclick=e=>{if(e.target===$('overlay'))dialog(false);};
for(const [id,delta] of [['smaller',-1],['larger',1]])$(id).onclick=()=>{settings.fontSize=Math.max(10,Math.min(24,settings.fontSize+delta));theme();save();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('overlay').hidden)dialog(false);if(!$('overlay').hidden&&e.key==='Tab'){const els=[...$('overlay').querySelectorAll('button,input,select,summary')].filter(el=>!el.disabled&&el.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0].focus();}}});
new ResizeObserver(fitAll).observe(document.querySelector('main'));
new ResizeObserver(fitAll).observe($('shell'));
let widgetBusy=false, widgetReload=false;
function showGithubWidget(show){
 settings.githubWidget=!!show;$('githubWidget').hidden=!show;
 $('toggleGithubWidget').setAttribute('aria-pressed',!!show);
 if(show)loadGithubWidget();fitAll();save();
}
function loadGithubWidget(action='contributions',extra={}){
 if(widgetBusy){widgetReload=true;return;}
 widgetBusy=true;$('refreshWidget').disabled=true;$('applyWidgetRepo').disabled=true;
 $('widgetMessage').textContent=action==='remote'?'Updating origin…':'Loading contributions…';
 send({type:'integration',target:'widget',action,...extra});
}
function receiveGithubWidget(result){
 widgetBusy=false;$('refreshWidget').disabled=false;$('applyWidgetRepo').disabled=false;
 if(result.cwd&&result.cwd!==workspace){loadGithubWidget();return;}
 if(result.repo!==undefined){
  $('widgetRepo').textContent=result.repo||'No repository linked';
  $('widgetRepo').title=result.repo||'Workspace origin';
  if($('widgetRepoForm').hidden)$('widgetRepoInput').value=result.repo||'';
 }
 $('widgetMessage').textContent=result.error||'';
 if(result.calendar){
  $('widgetLogin').textContent='@'+result.login;
  $('widgetTotal').textContent=result.calendar.totalContributions.toLocaleString();
  const weeks=result.calendar.weeks.slice(-26),grid=$('contributionGrid');
  grid.replaceChildren();
  const levels=['NONE','FIRST_QUARTILE','SECOND_QUARTILE','THIRD_QUARTILE','FOURTH_QUARTILE'];
  for(const week of weeks){
   const column=document.createElement('div');column.className='contribution-week';
   for(const day of week.contributionDays){
    const cell=document.createElement('span');cell.className='contribution-day';
    cell.dataset.level=Math.max(0,levels.indexOf(day.contributionLevel));
    cell.style.gridRow=day.weekday+1;
    cell.title=day.date+': '+day.contributionCount+' contributions';column.append(cell);
   }
   grid.append(column);
  }
  grid.setAttribute('aria-label',result.login+': '+result.calendar.totalContributions+' contributions in the past year. Calendar shows the last 26 weeks.');
 }else if(result.error){
  $('widgetTotal').textContent='—';$('widgetLogin').textContent='';
  $('contributionGrid').replaceChildren();
  $('contributionGrid').setAttribute('aria-label','Contributions unavailable');
 }else{
  $('widgetRepoForm').hidden=true;
  loadGithubWidget();return;
 }
 if(widgetReload){widgetReload=false;loadGithubWidget();}
}
$('toggleGithubWidget').onclick=()=>showGithubWidget(!settings.githubWidget);
$('hideWidget').onclick=()=>showGithubWidget(false);
$('refreshWidget').onclick=()=>loadGithubWidget();
$('editWidgetRepo').onclick=()=>{$('widgetRepoForm').hidden=!$('widgetRepoForm').hidden;if(!$('widgetRepoForm').hidden)$('widgetRepoInput').focus();};
$('widgetRepoForm').onsubmit=e=>{e.preventDefault();loadGithubWidget('remote',{repo:$('widgetRepoInput').value});};
$('widgetChooseFolder').onclick=()=>send({type:'folder'});

window.addEventListener('error',e=>send({type:'error',text:e.message}));
send({type:'ready'});
