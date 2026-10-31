// Run with swift -module-cache-path .build/module-cache tests/test_tiling.swift
import Foundation
import JavaScriptCore
let context = JSContext()!
context.exceptionHandler = { _, error in fputs("\(error!.toString()!)\n", stderr); exit(1) }
context.evaluateScript("""
const $=()=>({}),send=()=>{},save=()=>{},fitAll=()=>{};
const settings={sidebar:false,panelLayout:'right',panelSize:36};
const sessions=new Map();let sequence=0;const crypto={randomUUID:()=>String(++sequence)};
function check(ok,message){if(!ok)throw Error(message)}
""")
context.evaluateScript(try String(contentsOfFile:"ui/tiling.js",encoding:.utf8))
context.evaluateScript("""
tiles.render=()=>{};tiles.ready=true;tiles.tree={id:'primary'};
for(let i=0;i<32;i++)tiles.add(i%2?'row':'column','shell');
check(tiles.leaves().length===33,'No fixed pane count');
check(new Set(tiles.leaves().map(n=>n.id)).size===33,'Unique terminal IDs');
const saved=JSON.stringify(settings.tileLayout);
check(JSON.parse(saved).a,'Split tree persists');
settings.sidebar=true;tiles.syncSecondary();check(tiles.leaves().length===34,'Secondary joins existing tree');
settings.panelLayout='top';tiles.configureSecondary();check(tiles.tree.axis==='column'&&tiles.tree.a.id==='secondary','Secondary position control');
settings.sidebar=false;tiles.syncSecondary();check(tiles.leaves().length===33,'Hide only secondary');
const original=tiles.leaves().filter(n=>n.id!=='primary').map(n=>n.id);
for(const id of original)tiles.close(id);
check(tiles.tree.id==='primary','Removing leaves collapses empty split containers');
check(JSON.stringify(settings.tileLayout)==='{"id":"primary"}','Closed panes are not restored');
""")
print("Tiling tests passed")
