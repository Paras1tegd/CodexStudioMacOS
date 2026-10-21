#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
APP="$HOME/Applications/Codex Studio.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc Studio.swift -o "$APP/Contents/MacOS/CodexStudio" -framework Cocoa -framework WebKit
cp -R ui "$APP/Contents/Resources/"
cp pty_host.py settings_host.py "$APP/Contents/Resources/"
if [ -f Studio.icns ]; then cp Studio.icns "$APP/Contents/Resources/"; fi
python3 - "$PWD" "$APP" <<'PY'
import plistlib,sys
from pathlib import Path
root,app=sys.argv[1:]
info={'CFBundleName':'Codex Studio','CFBundleDisplayName':'Codex Studio','CFBundleIdentifier':'local.codexstudio.app','CFBundleExecutable':'CodexStudio','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.0','CFBundleVersion':'1','NSHighResolutionCapable':True,'LSMinimumSystemVersion':'13.0','StudioSourceRoot':root}
info['CFBundleIconFile']='Studio.icns'
with open(Path(app)/'Contents/Info.plist','wb') as f: plistlib.dump(info,f)
PY
codesign --force --deep --sign - "$APP"
echo "Built: $APP"
