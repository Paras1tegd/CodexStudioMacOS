#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:---development}"
case "$MODE" in
  --development) APP="$HOME/Applications/Codex Studio.app" ;;
  --release) APP="$PWD/.build/release/Codex Studio.app" ;;
  *) echo "Usage: bash build.sh [--development|--release]" >&2; exit 2 ;;
esac
if [ "$MODE" = --development ] && pgrep -x CodexStudio >/dev/null; then
  echo "Quit Codex Studio normally before installing, or use --release to build separately." >&2
  exit 1
fi
if [ "$MODE" = --release ]; then
  rm -rf "$APP"
fi
mkdir -p .build/icon-cache
swiftc -module-cache-path .build/icon-cache icon.swift -o .build/draw-icon
.build/draw-icon .build/icon-1024.png
mkdir -p Studio.iconset
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" .build/icon-1024.png --out "Studio.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" .build/icon-1024.png --out "Studio.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
# ICNS supports PNG representations directly; keep packing dependency-free.
/usr/bin/python3 - <<'ICON'
from pathlib import Path
import struct
entries = [('icp4','16x16'),('icp5','32x32'),('icp6','32x32@2x'),
           ('ic07','128x128'),('ic08','256x256'),('ic09','512x512'),
           ('ic10','512x512@2x'),('ic11','16x16@2x'),
           ('ic12','32x32@2x'),('ic13','128x128@2x'),('ic14','256x256@2x')]
chunks=[]
for kind, name in entries:
    data=Path('Studio.iconset/icon_'+name+'.png').read_bytes()
    chunks.append(kind.encode()+struct.pack('>I',len(data)+8)+data)
payload=b''.join(chunks)
Path('Studio.icns').write_bytes(b'icns'+struct.pack('>I',len(payload)+8)+payload)
ICON
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -module-cache-path .build/icon-cache Studio.swift -o "$APP/Contents/MacOS/CodexStudio" -framework Cocoa -framework WebKit
cp -R ui "$APP/Contents/Resources/"
cp pty_host.py settings_host.py "$APP/Contents/Resources/"
cp Studio.icns "$APP/Contents/Resources/StudioIcon.icns"
cp .build/icon-1024.png "$APP/Contents/Resources/StudioIcon.png"
python3 - "$PWD" "$APP" "$MODE" <<'PY'
import plistlib,sys
from pathlib import Path
root,app,mode=sys.argv[1:]
info={'CFBundleName':'Codex Studio','CFBundleDisplayName':'Codex Studio','CFBundleIdentifier':'local.codexstudio.app','CFBundleExecutable':'CodexStudio','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.0','CFBundleVersion':'2','NSHighResolutionCapable':True,'LSMinimumSystemVersion':'13.0'}
if mode == '--development': info['StudioSourceRoot'] = root
info['CFBundleIconFile']='StudioIcon.icns'
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
# Notify Launch Services after replacing an installed bundle (including its icon).
if [ "$MODE" = --development ]; then
  touch "$APP"
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
fi
echo "Built: $APP"
