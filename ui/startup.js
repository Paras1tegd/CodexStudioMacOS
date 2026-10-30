/* Local SVG artwork. One clock owns the entire sequence, including its handoff.
   No terminal state, timers on individual pieces, network, or persistent state. */
class StudioStartup {
  static duration = 3200;
  constructor() {
    this.root = document.getElementById('startupIntro');
    this.symbol = this.root.querySelector('.startup-symbol');
    this.svg = this.root.querySelector('svg');
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.addEventListener('change', event => { if (event.matches) this.finish(); });
    // The first interaction reveals the already-running workspace immediately.
    document.addEventListener('keydown', () => this.finish(), {capture:true});
    document.addEventListener('pointerdown', () => this.finish(), {capture:true});
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.finish(); });
    window.addEventListener('resize', () => { if (this.running) this.measure(); });
    this.strands = this.prepare();
  }
  prepare() {
    const ribbon = [
      [12,15.915], [9.827,14.66],[7.653,13.405],[5.48,12.15],
      [5.48,10.12],[5.48,8.1],[5.48,6.07],
      [5.48,3.17],[7.84,.79],[10.74,.79],
      [12.25,.79],[13.65,1.43],[14.64,2.55]
    ];
    const destinations = [
      [[5.7,6.83],[8.1,9.415]], [[8.1,9.415],[10.5,12]],
      [[10.5,12],[8.1,14.585]], [[8.1,14.585],[5.7,17.17]],
      [[13.68,16.56],[16.68,16.56]], [[16.68,16.56],[19.68,16.56]]
    ];
    return [0,1,5,4,3,2].map((destination,i) => {
      let [start,end] = destinations[destination];
      const angle = i*Math.PI/3, cos = Math.cos(angle), sin = Math.sin(angle);
      const from = ribbon.map(([x,y]) => [12+(x-12)*cos-(y-12)*sin,12+(x-12)*sin+(y-12)*cos]);
      const distance = (a,b) => (a[0]-b[0])**2+(a[1]-b[1])**2;
      if (distance(from[0],end)+distance(from[12],start)<distance(from[0],start)+distance(from[12],end)) [start,end]=[end,start];
      const to = from.map((_,j) => [start[0]+(end[0]-start[0])*j/12,start[1]+(end[1]-start[1])*j/12]);
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      for (const [key,value] of Object.entries({fill:'none',stroke:'currentColor','stroke-width':1.57,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:1})) path.setAttribute(key,value);
      this.svg.append(path);
      return {path,from,to};
    });
  }
  measure() {
    const target = document.querySelector('.mark svg').getBoundingClientRect();
    this.target = {x:target.x+target.width/2-innerWidth/2, y:target.y+target.height/2-innerHeight/2, scale:target.width/112};
  }
  static ease(t) { return t*t*t*(t*(t*6-15)+10); }
  render(time) {
    const phase = (start,end) => StudioStartup.ease(Math.max(0,Math.min(1,(time-start)/(end-start))));
    const morph = phase(940,2050), dock = phase(2340,3200);
    this.strands.forEach(({path,from,to},i) => {
      const points = from.map(([x,y],j) => [x+(to[j][0]-x)*morph,y+(to[j][1]-y)*morph]);
      let d = `M${points[0].join(' ')}`;
      for (let j=1;j<points.length;j+=3) d+=`C${points.slice(j,j+3).map(p=>p.join(' ')).join(' ')}`;
      path.setAttribute('d',d);
      const drawn = phase(70+i*42,560+i*42);
      path.style.strokeDasharray = '1 1';
      path.style.strokeDashoffset = 1-drawn;
      path.style.opacity = phase(i*42,150+i*42);
    });
    const scale = (.84+.16*phase(0,900))*(1-dock)+this.target.scale*dock;
    const y = -38*(1-dock)+this.target.y*dock;
    this.symbol.style.transform = `translate3d(${this.target.x*dock}px,${y}px,0) scale(${scale})`;
    this.svg.style.transform = `rotate(${-60*(1-phase(0,1500))}deg)`;
    this.root.style.setProperty('--intro-color',morph);
    this.root.style.setProperty('--intro-veil',1-phase(2350,3090));
    this.root.style.setProperty('--intro-aura',phase(0,800)*(1-phase(1850,2700)));
    this.root.style.setProperty('--intro-orbit',phase(100,650)*(1-phase(1000,1900)));
    this.root.style.setProperty('--intro-orbit-scale',.82+.18*phase(0,1700));
    this.root.style.setProperty('--intro-orbit-turn',`${-30+90*phase(0,2100)}deg`);
    this.root.style.setProperty('--intro-title',phase(1150,1750)*(1-phase(2200,2540)));
    this.root.style.setProperty('--intro-title-y',`${8*(1-phase(1150,1750))-6*phase(2200,2540)}px`);
    document.body.style.setProperty('--intro-workspace',phase(2450,3100));
  }
  play(enabled = true) {
    this.finish();
    if (!enabled || this.motion.matches || document.hidden) return;
    this.running = true;
    this.measure();
    this.render(0);
    document.body.classList.add('opening');
    const start = performance.now();
    const frame = now => {
      if (!this.running) return;
      const elapsed = now-start;
      if (elapsed >= StudioStartup.duration) { this.finish(); return; }
      this.render(elapsed);
      this.frame = requestAnimationFrame(frame);
    };
    this.frame = requestAnimationFrame(frame);
    // A bounded fallback also clears the overlay if animation frames stall.
    this.timeout = setTimeout(() => this.finish(),StudioStartup.duration+250);
  }
  finish() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timeout);
    this.running = false;
    document.body.classList.remove('opening');
    document.body.style.removeProperty('--intro-workspace');
  }
}
