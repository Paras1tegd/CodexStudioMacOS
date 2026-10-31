// Run: swift -module-cache-path .build/module-cache tests/test_startup.swift
import Foundation
import JavaScriptCore
let context = JSContext()!
context.exceptionHandler = { _, error in
    fputs("\(error!.toString()!)\n", stderr)
    exit(1)
}
for path in ["ui/app.js", "ui/startup.js", "ui/tiling.js", "ui/universe.js"] {
    context.setObject(try String(contentsOfFile:path,encoding:.utf8), forKeyedSubscript:"source" as NSString)
    context.evaluateScript("new Function(source)")
}
context.evaluateScript("""
let frames=new Map(),timers=new Map(),sequence=0,handlers={},opening=false;
const style=()=>({setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}});
const svg={style:style(),append(){}};
const symbol={style:style()};
const root={style:style(),querySelector(s){return s==='svg'?svg:symbol}};
const motion={matches:false,addEventListener(t,fn){this.change=fn}};
const window={matchMedia(){return motion},addEventListener(t,fn){handlers[t]=fn}};
const document={hidden:false,body:{style:style(),classList:{add(){opening=true},remove(){opening=false}}},
 getElementById(){return root},querySelector(){return {getBoundingClientRect(){return {x:32,y:32,width:32,height:32}}}},
 createElementNS(){return {style:style(),setAttribute(k,v){this[k]=v}}},addEventListener(t,fn){handlers[t]=fn}};
const innerWidth=1180,innerHeight=780,performance={now(){return 0}};
function requestAnimationFrame(fn){frames.set(++sequence,fn);return sequence}
function cancelAnimationFrame(id){frames.delete(id)}
function setTimeout(fn){timers.set(++sequence,fn);return sequence}
function clearTimeout(id){timers.delete(id)}
function check(ok,message){if(!ok)throw Error(message)}
function tick(time){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time))}
""")
context.evaluateScript(try String(contentsOfFile:"ui/startup.js",encoding:.utf8))
context.evaluateScript("""
const intro=new StudioStartup();
intro.play(false);check(!opening&&!frames.size,'Disabled startup must not animate');
motion.matches=true;intro.play();check(!opening,'Reduced motion must skip startup');motion.matches=false;
intro.play();check(opening&&frames.size===1,'Startup should schedule one frame');
intro.play();check(frames.size===1&&timers.size===1,'Replay must replace pending work');
for(let time=0;time<=3200;time+=16){tick(time);for(const {path} of intro.strands)check(!/NaN|Infinity/.test(path.d),'Artwork must remain finite');}
check(!opening&&!frames.size&&!timers.size,'Completion must release all work');
for(const event of ['keydown','pointerdown']){intro.play();handlers[event]();check(!opening&&!frames.size&&!timers.size,event+' must dismiss immediately');}
intro.play();motion.change({matches:true});check(!opening,'Changing Reduce Motion must dismiss');
intro.play();document.hidden=true;handlers.visibilitychange();check(!opening,'Backgrounding must dismiss');
intro.play();check(!opening,'Hidden pages must not start');document.hidden=false;
intro.play();[...timers.values()][0]();check(!opening&&!frames.size,'Fallback must clean up stalled animation');
""")
print("PASS: JavaScript syntax; startup disable, replay, completion, interruption, reduced motion, visibility, and timeout cleanup")
