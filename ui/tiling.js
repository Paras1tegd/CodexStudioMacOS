// A persistent binary split tree. Moving a leaf moves its existing DOM and PTY.
const tiles = {
 tree:null, focused:'primary', views:new Map(), ready:false, dragged:null,
 leaves(node=this.tree){return !node?[]:node.id?[node]:[...this.leaves(node.a),...this.leaves(node.b)];},
 replace(id,replacement,node=this.tree){
  if(node.id===id)return replacement;
  if(node.id)return node;
  node.a=this.replace(id,replacement,node.a);node.b=this.replace(id,replacement,node.b);
  return !node.a?node.b:!node.b?node.a:node;
 },
 boot(){
  const ids=new Set();
  const valid=n=>{
   if(!n||typeof n!=='object')return false;
   if(n.id){if(typeof n.id!=='string'||ids.has(n.id))return false;ids.add(n.id);return ['primary','secondary'].includes(n.id)||(['shell','codex','claude'].includes(n.kind)&&n.id.startsWith('pane-'));}
   return ['row','column'].includes(n.axis)&&Number.isFinite(n.ratio)&&n.ratio>=.1&&n.ratio<=.9&&valid(n.a)&&valid(n.b);
  };
  let restored=false;try{restored=valid(settings.tileLayout)&&ids.has('primary');}catch{}
  this.tree=restored?settings.tileLayout:{id:'primary'};
  this.ready=true;document.querySelector('main').classList.add('tiling');
  this.syncSecondary();this.render();
 },
 configureSecondary(){
  if(!this.ready)return;
  const visit=n=>{if(n.id)return;const side=n.a.id==='secondary'?'a':n.b.id==='secondary'?'b':null;
   if(side){const secondary=n[side],other=n[side==='a'?'b':'a'];const before=['left','top'].includes(settings.panelLayout);n.axis=['top','bottom'].includes(settings.panelLayout)?'column':'row';n.a=before?secondary:other;n.b=before?other:secondary;n.ratio=before?settings.panelSize/100:1-settings.panelSize/100;}else{visit(n.a);visit(n.b);}};
  visit(this.tree);this.render();this.persist();
 },
 persist(){settings.tileLayout=this.tree;save();},
 syncSecondary(){
  if(!this.ready)return;
  const exists=this.leaves().some(n=>n.id==='secondary');
  if(settings.sidebar&&!exists){const before=['left','top'].includes(settings.panelLayout);this.tree={axis:['top','bottom'].includes(settings.panelLayout)?'column':'row',ratio:before?settings.panelSize/100:1-settings.panelSize/100,a:before?{id:'secondary'}:this.tree,b:before?this.tree:{id:'secondary'}};}
  if(!settings.sidebar&&exists)this.tree=this.replace('secondary',null);
  this.render();this.persist();
 },
 focus(id){this.focused=id;for(const [key,v] of this.views)v.classList.toggle('focused',key===id);},
 add(axis='row',kind=null){
  const target=this.leaves().find(n=>n.id===this.focused)||this.leaves()[0];
  kind ||= this.views.get(target.id)?.querySelector('.pane-kind')?.value||'shell';
  const leaf={id:'pane-'+crypto.randomUUID(),kind};
  this.tree=this.replace(target.id,{axis,ratio:.5,a:target,b:leaf});
  this.focused=leaf.id;this.render();this.persist();sessions.get(leaf.id)?.term.focus();
 },
 close(id,confirmed=false){
  if(id==='primary')return;
  if(id==='secondary'){sidebar(false);return;}
  const session=sessions.get(id);
  if(session&&!session.ended&&!confirmed){
   const button=this.views.get(id).querySelector('[aria-label="Close pane"]');
   button.textContent='End session?';button.title='Click again to end this session';
   button.onclick=()=>this.close(id,true);
   setTimeout(()=>{if(button.isConnected){button.textContent='×';button.title='Close pane';button.onclick=()=>this.close(id);}},4000);return;
  }
  send({type:'stop',id});session?.term.dispose();sessions.delete(id);
  this.tree=this.replace(id,null);this.views.get(id)?.remove();this.views.delete(id);
  this.focused=this.leaves()[0].id;this.render();this.persist();
 },
 view(leaf){
  if(this.views.has(leaf.id))return this.views.get(leaf.id);
  const view=document.createElement('section');view.className='tile';view.dataset.pane=leaf.id;
  const bar=document.createElement('div');bar.className='tile-bar';bar.draggable=true;
  const title=document.createElement('span');title.className='tile-title';title.textContent=leaf.id==='primary'?'Workspace':leaf.id==='secondary'?'Modules':{shell:'Terminal',codex:'Codex CLI',claude:'Claude Code'}[leaf.kind];bar.append(title);
  const select=document.createElement('select');select.className='pane-kind';select.setAttribute('aria-label','Module for new split');
  for(const [id,label] of [['shell','Terminal'],['codex','Codex'],['claude','Claude']])select.add(new Option(label,id));bar.append(select);
  for(const [label,hint,action] of [['◧','Split side by side',()=>{this.focus(leaf.id);this.add('row',select.value);}],['⬒','Split top and bottom',()=>{this.focus(leaf.id);this.add('column',select.value);}],['×',leaf.id==='secondary'?'Hide secondary pane':'Close pane',()=>this.close(leaf.id)]]){
   if(label==='×'&&leaf.id==='primary')continue;
   const button=document.createElement('button');button.textContent=label;button.title=hint;button.setAttribute('aria-label',hint);button.onclick=action;bar.append(button);
  }
  view.append(bar);view.addEventListener('pointerdown',()=>this.focus(leaf.id));view.addEventListener('focusin',()=>this.focus(leaf.id));
  bar.ondragstart=e=>{if(e.target.closest('button,select')){e.preventDefault();return;}this.dragged=leaf.id;e.dataTransfer.setData('text/plain',leaf.id);};
  bar.ondragend=()=>{this.dragged=null;document.querySelectorAll('.drop-target').forEach(v=>v.classList.remove('drop-target'));};
  view.ondragover=e=>{if(this.dragged&&this.dragged!==leaf.id){e.preventDefault();view.classList.add('drop-target');}};
  view.ondragleave=()=>view.classList.remove('drop-target');
  view.ondrop=e=>{e.preventDefault();view.classList.remove('drop-target');const from=this.leaves().find(n=>n.id===this.dragged);if(!from||from.id===leaf.id)return;const temp={id:'swap'};this.tree=this.replace(from.id,temp);this.tree=this.replace(leaf.id,from);this.tree=this.replace('swap',leaf);this.dragged=null;this.render();this.persist();};
  this.views.set(leaf.id,view);
  if(leaf.id==='primary')view.append(primarySlot);
  else if(leaf.id==='secondary')view.append(secondarySlot);
  else{
   const host=document.createElement('div');host.className='tile-terminal';view.append(host);
   // Mount before xterm measures; each leaf has its own terminal instance.
   document.querySelector('main').append(view);terminal(leaf.id,leaf.kind,host);send({type:'start',id:leaf.id,mode:leaf.kind});
   new ResizeObserver(fitAll).observe(host);
  }
  return view;
 },
 minimum(n){if(n.id)return [320,200];const a=this.minimum(n.a),b=this.minimum(n.b);return n.axis==='row'?[a[0]+b[0]+8,Math.max(a[1],b[1])]:[Math.max(a[0],b[0]),a[1]+b[1]+8];},
 render(){
  const focused=document.activeElement;
  const build=n=>{
   if(n.id)return this.view(n);
   const box=document.createElement('div');box.className='tile-split';box.dataset.axis=n.axis;const minimum=this.minimum(n);box.style.minWidth=minimum[0]+'px';box.style.minHeight=minimum[1]+'px';
   const a=build(n.a),b=build(n.b),divider=document.createElement('div');divider.className='tile-divider';divider.tabIndex=0;divider.role='separator';divider.setAttribute('aria-label','Resize panes');divider.setAttribute('aria-orientation',n.axis==='row'?'vertical':'horizontal');
   const update=()=>{a.style.flex=n.ratio+' 1 0';b.style.flex=(1-n.ratio)+' 1 0';divider.setAttribute('aria-valuenow',Math.round(n.ratio*100));fitAll();};
   divider.onpointerdown=e=>{e.preventDefault();divider.setPointerCapture(e.pointerId);};
   divider.onpointermove=e=>{if(!divider.hasPointerCapture(e.pointerId))return;const r=box.getBoundingClientRect();n.ratio=Math.max(.1,Math.min(.9,n.axis==='row'?(e.clientX-r.left)/r.width:(e.clientY-r.top)/r.height));update();};
   divider.onpointerup=e=>{divider.releasePointerCapture(e.pointerId);this.persist();};
   divider.onkeydown=e=>{const keys=n.axis==='row'?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];if(!keys.includes(e.key))return;e.preventDefault();n.ratio=Math.max(.1,Math.min(.9,n.ratio+(e.key===keys[0]?-.05:.05)));update();this.persist();};
   box.append(a,divider,b);update();return box;
  };
  // Park hidden base panes so their terminal sessions remain alive.
  if(!settings.sidebar&&this.views.has('secondary'))moduleParking.append(this.views.get('secondary'));
  const root=build(this.tree);root.style.flex='1';const min=this.minimum(this.tree);root.style.minWidth=min[0]+'px';root.style.minHeight=min[1]+'px';
  document.querySelector('main').replaceChildren(root);this.focus(this.focused);
  if(focused?.isConnected)focused.focus();fitAll();
 }
};
$('addPane').onclick=()=>tiles.add();
send({type:'ready'});
