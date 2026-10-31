/* Local, passive observation of rendered agent output. No commands or network calls. */
class UniverseLog {
 constructor(){this.nodes=new Map();this.lines=new Set();this.sequence=0;}
 static references(line){
  const found=[];
  const urls=/https?:\/\/[^\s<>"'`]+/g;
  for(const match of line.matchAll(urls)){
   try{const url=new URL(match[0].replace(/[),.;\]}]+$/,''));found.push({kind:'star',key:url.origin+url.pathname,label:url.hostname});}catch{}
  }
  const rest=line.replace(urls,'');
  for(const m of rest.matchAll(/(?:[\w@~.-]+\/)*[\w.-]+\.(?:js|ts|tsx|jsx|py|swift|html|css|json|md|rs|go|sh|yml|yaml|toml|txt|csv|sql|java|cpp|c|h|pdf|svg|png|xlsx|docx)\b/g))found.push({kind:'planet',key:m[0],label:m[0].split('/').pop()});
  for(const m of rest.matchAll(/\b(?:functions\.[\w]+|tools\.[\w]+|(?:mcp__)[\w]+|exec_command|apply_patch|web\.run|imagegen)\b/g))found.push({kind:'tool',key:m[0],label:m[0].replace(/^tools\./,'')});
  return found;
 }
 ingest(lines){
  let changed=false;
  for(const line of lines){
   const clean=line.trim();if(!clean||this.lines.has(clean))continue;
   this.lines.add(clean);if(this.lines.size>2000)this.lines.delete(this.lines.values().next().value);
   for(const ref of UniverseLog.references(clean)){
    const id=ref.kind+':'+ref.key;const prior=this.nodes.get(id);
    const node={...ref,id,evidence:clean.slice(0,600),time:Date.now(),order:++this.sequence,slot:prior?.slot};
    if(node.slot===undefined){const used=new Set([...this.nodes.values()].map(n=>n.slot));node.slot=Array.from({length:24},(_,i)=>i).find(i=>!used.has(i));
     if(node.slot===undefined){const oldest=this.nodes.values().next().value;node.slot=oldest.slot;this.nodes.delete(oldest.id);}}
    this.nodes.delete(id);this.nodes.set(id,node);changed=true;
   }
  }
  return changed;
 }
}
class StudioUniverse {
 constructor(){
  this.logs=new Map();this.selected='';this.timers=new Map();
  this.element=document.createElement('section');this.element.className='studio-module universe-module';
  this.element.setAttribute('aria-label','Activity universe');
  this.element.innerHTML=`<div class="universe-heading"><div><span class="eyebrow">A WEB OF DISCOVERIES</span><h2>Activity universe</h2></div><span class="universe-badge">LOCAL · LIVE</span></div><label class="universe-session">Following <select aria-label="Agent session to follow"></select></label><div class="universe-space"><svg viewBox="0 0 600 460" aria-label="Files, sources and tools observed in terminal output"><defs><radialGradient id="planetGlow"><stop stop-color="#dacbff"/><stop offset=".4" stop-color="#998ac4"/><stop offset="1" stop-color="#39324f"/></radialGradient></defs><g class="universe-paths"></g><g class="universe-nodes"></g><g class="universe-spider" transform="translate(300 220)"><g class="spider-legs" fill="none" stroke="#e4d8ff" stroke-width="2" stroke-linecap="round"><path d="M-4 -5 -16 -16 -24 -13 M-5 -1 -21 -7 -27 0 M-5 4 -20 8 -23 19 M-4 7 -12 19 -10 26 M4 -5 16 -16 24 -13 M5 -1 21 -7 27 0 M5 4 20 8 23 19 M4 7 12 19 10 26"/></g><ellipse cy="5" rx="7" ry="10" fill="#c4adef"/><circle cy="-6" r="6" fill="#eee5ff"/><circle cx="-2" cy="-8" r="1.2" fill="#29233c"/><circle cx="2" cy="-8" r="1.2" fill="#29233c"/></g></svg><div class="universe-empty">Waiting for discoveries<span>Files, sources and tools will appear as your agent mentions them.</span></div></div><div class="universe-legend"><span>● Files</span><span>✦ Sources</span><span>◇ Tools</span></div><div class="universe-detail"><b>Explore the trail</b><p>Select a world to inspect its source line.</p></div><footer><span class="universe-status" role="status">Waiting for agent output</span></footer>`;
  this.select=this.element.querySelector('select');this.select.onchange=()=>{this.selected=this.select.value;this.render(false);};
 }
 attach(session){
  if(!['codex','claude'].includes(session.mode))return;
  const log=new UniverseLog();this.logs.set(session.id,{session,log});
  this.select.add(new Option((session.mode==='codex'?'Codex':'Claude')+' · '+(session.workspace.split('/').pop()||'Workspace')+' · '+(this.logs.size),session.id));
  if(!this.selected){this.selected=session.id;this.select.value=session.id;}
  session.term.onWriteParsed(()=>{
   if(this.timers.has(session.id))return;
   this.timers.set(session.id,setTimeout(()=>{
    this.timers.delete(session.id);const buffer=session.term.buffer.active,lines=[];let joined='';
    for(let i=Math.max(0,buffer.length-180);i<buffer.length;i++){
     const row=buffer.getLine(i);if(!row)continue;
     if(!row.isWrapped&&joined){lines.push(joined);joined='';}joined+=row.translateToString(true);
    }
    if(joined)lines.push(joined);
    if(log.ingest(lines)&&this.selected===session.id)this.render(true);
   },650));
  });
 }
 point(slot){slot=(slot*7)%24;const col=slot%6,row=Math.floor(slot/6);return {x:64+col*94+(row%2?12:0),y:65+row*100};}
 svg(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;}
 render(move){
  clearTimeout(this.restTimer);
  const entry=this.logs.get(this.selected);if(!entry)return;
  const nodes=[...entry.log.nodes.values()];const group=this.element.querySelector('.universe-nodes'),paths=this.element.querySelector('.universe-paths');group.replaceChildren();paths.replaceChildren();
  this.element.querySelector('.universe-empty').hidden=!!nodes.length;
  this.element.querySelector('.universe-status').textContent=nodes.length?`${nodes.length} recent worlds · observed in terminal`:'Waiting for agent output';
  this.element.querySelector('.universe-detail').replaceChildren();
  const detail=this.element.querySelector('.universe-detail');
  const explain=node=>{detail.replaceChildren();const title=document.createElement('b'),p=document.createElement('p'),small=document.createElement('small');title.textContent=node.key;p.textContent=node.evidence;small.textContent='Mention observed '+new Date(node.time).toLocaleTimeString()+'. A mention does not confirm execution or success.';detail.append(title,p,small);};
  let previous=null;
  for(const node of nodes){
   const p=this.point(node.slot);
   if(previous)paths.append(this.svg('line',{x1:previous.x,y1:previous.y,x2:p.x,y2:p.y}));previous=p;
   const g=this.svg('g',{transform:`translate(${p.x} ${p.y})`,tabindex:'0',role:'button','aria-label':`${node.kind}: ${node.key}`,class:'universe-world'});
   g.append(this.svg('circle',{r:29,fill:'transparent'}));
   if(node.kind==='planet'){g.append(this.svg('circle',{r:15,fill:'url(#planetGlow)'}));g.append(this.svg('ellipse',{rx:24,ry:6,fill:'none',stroke:'#b9a1e7',transform:'rotate(-25)'}));}
   else g.append(this.svg('path',{d:node.kind==='star'?'M0 -17 4 -4 17 0 4 4 0 17 -4 4 -17 0 -4 -4Z':'M0 -11 11 0 0 11 -11 0Z',fill:node.kind==='star'?'#f2dca1':'#8ad4cb'}));
   const text=this.svg('text',{y:38,'text-anchor':'middle'});text.textContent=node.label.length>14?node.label.slice(0,12)+'…':node.label;g.append(text);
   g.onclick=()=>explain(node);g.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();explain(node);}};group.append(g);
  }
  if(nodes.length){explain(nodes.at(-1));const last=this.point(nodes.at(-1).slot),spider=this.element.querySelector('.universe-spider');cancelAnimationFrame(this.frame);
   const target={x:last.x,y:last.y-27},from=this.position||{x:300,y:220};
   const animate=move&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&this.element.getClientRects().length&&!document.hidden;
   const start=performance.now();
   const step=now=>{const t=animate?Math.min(1,(now-start)/1800):1,ease=t*t*(3-2*t);this.position={x:from.x+(target.x-from.x)*ease,y:from.y+(target.y-from.y)*ease};spider.setAttribute('transform',`translate(${this.position.x} ${this.position.y})`);if(t<1&&!document.hidden)this.frame=requestAnimationFrame(step);else {this.position=target;spider.setAttribute('transform',`translate(${target.x} ${target.y})`);}};
   step(start);
   spider.classList.toggle('crawling',move);clearTimeout(this.restTimer);this.restTimer=setTimeout(()=>{spider.classList.remove('crawling');this.element.querySelector('.universe-status').textContent=entry.session.ended?'Session ended · trail retained':'Resting · waiting for new references';},2200);
  }else detail.textContent='The spider follows new references in this session. Nothing is sent outside this app.';
 }
}
