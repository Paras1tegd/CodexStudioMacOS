import Cocoa
import WebKit

final class TerminalSession {
    let process = Process()
    let input = Pipe()
    let output = Pipe()
    var pending = Data()
    var onMessage: (([String: Any]) -> Void)?
    init(id: String, mode: String, cwd: String, root: URL, options: [String:Any] = [:]) throws {
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        let data = try JSONSerialization.data(withJSONObject: options)
        process.arguments = [root.appendingPathComponent("pty_host.py").path, mode, cwd, String(data:data,encoding:.utf8)!]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.standardError
        var environment = ProcessInfo.processInfo.environment
        environment["PYTHONUNBUFFERED"] = "1"
        process.environment = environment
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receive(data) }
        }
        try process.run()
    }
    func receive(_ data: Data) {
        pending.append(data)
        while let newline = pending.firstIndex(of: 10) {
            let line = pending[..<newline]
            if let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any] { onMessage?(value) }
            pending.removeSubrange(...newline)
        }
    }
    func send(_ value: [String: Any]) {
        guard process.isRunning, var data = try? JSONSerialization.data(withJSONObject: value) else { return }
        data.append(10)
        try? input.fileHandleForWriting.write(contentsOf: data)
    }
    func stop() {
        output.fileHandleForReading.readabilityHandler = nil
        try? input.fileHandleForWriting.close()
        if process.isRunning { process.terminate() }
    }
    deinit { stop() }
}

final class Studio: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var sessions: [String: TerminalSession] = [:]
    var root: URL!
    var cwd = FileManager.default.homeDirectoryForCurrentUser.path
    var css = ""
    var timer: Timer?
    func applicationDidFinishLaunching(_ notification: Notification) {
        let dev = Bundle.main.object(forInfoDictionaryKey: "StudioSourceRoot") as? String
        if let dev = dev, FileManager.default.fileExists(atPath: dev + "/ui/index.html") { root = URL(fileURLWithPath: dev) }
        else { root = Bundle.main.resourceURL! }
        if let saved = UserDefaults.standard.string(forKey: "workspace"), FileManager.default.fileExists(atPath: saved) { cwd = saved }
        else { cwd = root.path }
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "studio")
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 1180,height: 780), styleMask: [.titled,.closable,.miniaturizable,.resizable], backing: .buffered, defer: false)
        window.title = "Codex Studio"
        window.minSize = NSSize(width: 820,height: 520)
        window.backgroundColor = NSColor(calibratedWhite: 0.08,alpha: 1)
        window.titlebarAppearsTransparent = true
        window.contentView = web
        window.delegate = self
        window.setFrameAutosaveName("StudioWindow")
        window.center()
        menu()
        web.loadFileURL(root.appendingPathComponent("ui/index.html"), allowingReadAccessTo: root.appendingPathComponent("ui"))
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        css = (try? String(contentsOf: root.appendingPathComponent("ui/style.css"),encoding: .utf8)) ?? ""
        timer = Timer.scheduledTimer(withTimeInterval: 0.7, repeats: true) { [weak self] _ in self?.checkStyle() }
    }
    func checkStyle() {
        guard let new = try? String(contentsOf: root.appendingPathComponent("ui/style.css"),encoding: .utf8), new != css else { return }
        css = new; call("refreshCSS", [new])
    }
    func call(_ name: String, _ args: [Any] = []) {
        guard let data = try? JSONSerialization.data(withJSONObject: args), let encoded = String(data: data,encoding: .utf8) else { return }
        web.evaluateJavaScript("window.studio?.\(name)(...\(encoded))", completionHandler: nil)
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        let id = body["id"] as? String ?? ""
        switch type {
        case "ready": call("boot", [["cwd":cwd,"settings":UserDefaults.standard.dictionary(forKey:"appearance") ?? [:]]])
        case "start":
            guard sessions[id] == nil, let mode = body["mode"] as? String, ["shell","codex","github"].contains(mode) else { return }
            do {
                let session = try TerminalSession(id:id,mode:mode,cwd:cwd,root:root,options:UserDefaults.standard.dictionary(forKey:"appearance") ?? [:])
                sessions[id] = session
                session.onMessage = { [weak self] value in self?.call("receive", [id,value]) }
            } catch { call("toast", ["Could not start terminal: \(error.localizedDescription)"]) }
        case "input": if let input = body["input"] as? String { sessions[id]?.send(["input":input]) }
        case "resize": if let cols=body["cols"] as? Int, let rows=body["rows"] as? Int { sessions[id]?.send(["cols":cols,"rows":rows]) }
        case "stop": sessions[id]?.stop(); sessions.removeValue(forKey:id)
        case "settings": if let settings=body["value"] as? [String:Any] { UserDefaults.standard.set(settings,forKey:"appearance") }
        case "integration": integration(body)
        case "folder": chooseFolder()
        case "copy": if let text=body["text"] as? String { NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text,forType:.string) }
        case "error": NSLog("Studio UI: %@",body["text"] as? String ?? "unknown error")
        default: break
        }
    }
    func integration(_ request: [String:Any]) {
        let directory = cwd
        let helper = root.appendingPathComponent("settings_host.py").path
        DispatchQueue.global(qos:.userInitiated).async {
            let process = Process(), output = Pipe()
            process.executableURL = URL(fileURLWithPath:"/usr/bin/python3")
            let data = (try? JSONSerialization.data(withJSONObject:request)) ?? Data()
            process.arguments = [helper, directory, String(data:data,encoding:.utf8) ?? "{}"]
            process.standardOutput = output
            process.standardError = FileHandle.nullDevice
            var result: [String:Any]
            do {
                try process.run()
                let bytes = output.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                result = (try? JSONSerialization.jsonObject(with:bytes) as? [String:Any]) ?? ["error":"Could not read integration settings."]
            } catch { result = ["error":error.localizedDescription] }
            DispatchQueue.main.async { self.call(request["target"] as? String == "widget" ? "githubWidget" : "integration",[result]) }
        }
    }
    func chooseFolder() {
        let panel = NSOpenPanel(); panel.canChooseFiles=false; panel.canChooseDirectories=true; panel.allowsMultipleSelection=false
        panel.message="Choose the workspace for new terminal sessions. Existing sessions stay in their current folder."
        panel.directoryURL=URL(fileURLWithPath:cwd)
        panel.beginSheetModal(for:window) { [weak self] response in
            guard response == .OK, let self=self, let url=panel.url else { return }
            self.cwd=url.path; UserDefaults.standard.set(self.cwd,forKey:"workspace"); self.call("folder",[self.cwd])
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy)->Void) {
        guard let url=navigationAction.request.url else { decisionHandler(.cancel); return }
        decisionHandler(url.isFileURL && url.resolvingSymlinksInPath().standardizedFileURL.path.hasPrefix(root.appendingPathComponent("ui").resolvingSymlinksInPath().standardizedFileURL.path + "/") ? .allow : .cancel)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        let alert=NSAlert(); alert.messageText="Close Codex Studio?"; alert.informativeText="This ends all Codex and shell sessions in this window.";alert.addButton(withTitle:"Close sessions");alert.addButton(withTitle:"Keep working")
        return alert.runModal() == .alertFirstButtonReturn
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool { true }
    func applicationShouldTerminate(_ sender:NSApplication)->NSApplication.TerminateReply {
        if window.isVisible && !windowShouldClose(window) { return .terminateCancel }; return .terminateNow
    }
    func applicationWillTerminate(_ notification:Notification) { timer?.invalidate();sessions.values.forEach{$0.stop()} }
    @objc func settingsAction(){call("action",["settings"])}
    @objc func sidebarAction(){call("action",["sidebar"])}
    @objc func newAction(){call("action",["new"])}
    @objc func copyAction(){call("copy")}
    @objc func pasteAction(){if let text=NSPasteboard.general.string(forType:.string){call("paste",[text])}}
    func menu() {
        let bar=NSMenu()
        func group(_ title:String,_ entries:[(String,Selector,String)]) {
            let item=NSMenuItem();bar.addItem(item);let menu=NSMenu(title:title);item.submenu=menu
            for (title,action,key) in entries {let e=NSMenuItem(title:title,action:action,keyEquivalent:key);e.target=self;menu.addItem(e)}
        }
        group("Codex Studio",[("Settings…",#selector(settingsAction),","),("Quit Codex Studio",#selector(NSApplication.terminate(_:)),"q")])
        bar.items[0].submenu?.items.last?.target=NSApp
        group("File",[("New Codex Session",#selector(newAction),"n")])
        group("Edit",[("Copy",#selector(copyAction),"c"),("Paste",#selector(pasteAction),"v")])
        group("View",[("Toggle Terminal",#selector(sidebarAction),"j")])
        NSApp.mainMenu=bar
    }
}
let app=NSApplication.shared
app.setActivationPolicy(.regular)
let delegate=Studio()
app.delegate=delegate
app.run()
