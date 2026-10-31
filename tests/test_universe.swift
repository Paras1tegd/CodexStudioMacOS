import Foundation
import JavaScriptCore
let context = JSContext()!
context.exceptionHandler = { _, error in fputs("\(error!.toString()!)\n", stderr); exit(1) }
// JavaScriptCore does not supply the browser URL implementation.
context.evaluateScript("class URL { constructor(s){const m=s.match(/^(https?:)\\/\\/([^/]+)([^?#]*)/);if(!m)throw Error('URL');this.hostname=m[2];this.origin=m[1]+'//'+m[2];this.pathname=m[3]||'/';} }")
context.evaluateScript(try String(contentsOfFile:"ui/universe.js",encoding:.utf8))
context.evaluateScript("""
function check(ok,message){if(!ok)throw Error(message)}
const log=new UniverseLog();
check(!log.ingest(['Working…','Hello world']),'No invented worlds');
check(log.ingest(['Read ui/app.js using functions.exec','Found https://example.com/docs?q=secret#part']),'References extracted');
check(log.nodes.size===3,'File, tool and source');
check([...log.nodes.values()].some(n=>n.key==='https://example.com/docs'),'Query excluded from world identity');
check(!log.ingest(['Read ui/app.js using functions.exec']),'Repeated terminal redraw ignored');
check(log.ingest(['Updated ui/app.js']),'New evidence revisits existing world');
check(log.nodes.size===3,'Revisit does not duplicate planet');
for(let i=0;i<100;i++)log.ingest(['Read file'+i+'.py']);
check(log.nodes.size===24,'Bounded worlds');
check(new Set([...log.nodes.values()].map(n=>n.slot)).size===24,'No overlapping slots');
const other=new UniverseLog();check(other.nodes.size===0,'Session isolation');
check(!UniverseLog.references('https://example.com/app.js').some(n=>n.kind==='planet'),'URL file is not a workspace file');
""")
print("PASS: observed references, redraw deduplication, revisits, bounded map, session isolation")
