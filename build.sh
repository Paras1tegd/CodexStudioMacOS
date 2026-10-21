#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:---development}"
case "$MODE" in
  --development) APP="$HOME/Applications/Codex Studio.app" ;;
  --release) APP="$PWD/.build/release/Codex Studio.app" ;;
  *) echo "Usage: bash build.sh [--development|--release]" >&2; exit 2 ;;
esac
if [ "$MODE" = --release ]; then
  rm -rf "$APP"
fi
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc Studio.swift -o "$APP/Contents/MacOS/CodexStudio" -framework Cocoa -framework WebKit
cp -R ui "$APP/Contents/Resources/"
cp pty_host.py settings_host.py "$APP/Contents/Resources/"
if [ -f Studio.icns ]; then cp Studio.icns "$APP/Contents/Resources/"; fi
python3 - "$PWD" "$APP" "$MODE" <<'PY'
import plistlib,sys
from pathlib import Path
root,app,mode=sys.argv[1:]
info={'CFBundleName':'Codex Studio','CFBundleDisplayName':'Codex Studio','CFBundleIdentifier':'local.codexstudio.app','CFBundleExecutable':'CodexStudio','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.0','CFBundleVersion':'1','NSHighResolutionCapable':True,'LSMinimumSystemVersion':'13.0'}
if mode == '--development': info['StudioSourceRoot'] = root
info['CFBundleIconFile']='Studio.icns'
with open(Path(app)/'Contents/Info.plist','wb') as f: plistlib.dump(info,f)
PY
if [ "$MODE" = --release ]; then
  find "$APP" -name .DS_Store -delete
  find "$APP" -name __pycache__ -type d -exec rm -rf {} +
  xattr -cr "$APP"
fi
codesign --force --deep --sign - "$APP"
if [ "$MODE" = --release ]; then
  COPYFILE_DISABLE=1 ditto -c -k --norsrc --keepParent "$APP" "$PWD/.build/release/CodexStudioMacOS.zip"
fi
echo "Built: $APP"
