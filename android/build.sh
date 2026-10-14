#!/usr/bin/env bash
# Builds Mossy Meadows for Android without Gradle (works offline with Debian's
# Android build tools): debug APK, release APK and release AAB.
#
#   ./build.sh            # web build + debug + release APK + AAB
#   SKIP_WEB=1 ./build.sh # reuse game/dist
#
# Release signing: android/release.keystore + android/release.properties
# (created automatically on first run, never committed — keep a backup!).
set -euo pipefail
cd "$(dirname "$0")"
HERE=$(pwd)
ROOT=$(cd .. && pwd)
SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
BT=${BUILD_TOOLS:-$SDK/build-tools/debian}
ANDROID_JAR=${ANDROID_JAR:-$SDK/platforms/android-23/android.jar}
VERSION_NAME=$(node -p "require('$ROOT/game/package.json').version")
VERSION_CODE=${VERSION_CODE:-$(echo "$VERSION_NAME" | awk -F. '{print $1*10000+$2*100+$3}')}
OUT=$HERE/build
DIST=$ROOT/builds
rm -rf "$OUT" && mkdir -p "$OUT/assets/www" "$OUT/classes" "$DIST"

echo "==> Web build ($VERSION_NAME / $VERSION_CODE)"
if [ -z "${SKIP_WEB:-}" ]; then (cd "$ROOT/game" && npm run build --silent); fi
cp "$ROOT/game/dist/index.html" "$OUT/assets/www/index.html"

echo "==> Resources"
aapt2 compile --dir res -o "$OUT/res.zip"

echo "==> Java"
javac -nowarn -Xlint:-options --release 8 -classpath "$ANDROID_JAR" -d "$OUT/classes" $(find src -name '*.java')
"$BT/dx" --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes"

link() { # $1 = out, extra args...
  local out=$1; shift
  aapt2 link -o "$out" -I "$ANDROID_JAR" --manifest AndroidManifest.xml -A "$OUT/assets" "$OUT/res.zip" \
    --min-sdk-version 24 --target-sdk-version 36 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" --auto-add-overlay "$@"
}

add_dex() { python3 - "$1" "$OUT/classes.dex" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], 'classes.dex')
PY
}

# ---------- keys
DEBUG_KS=$HERE/debug.keystore.jks
if [ ! -f "$DEBUG_KS" ]; then
  keytool -genkeypair -keystore "$DEBUG_KS" -storepass android -keypass android -alias androiddebugkey \
    -dname "CN=Android Debug,O=Android,C=US" -keyalg RSA -keysize 2048 -validity 10000 >/dev/null 2>&1
fi
REL_PROPS=$HERE/release.properties
REL_KS=$HERE/release.jks
if [ ! -f "$REL_KS" ]; then
  PASS=$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)
  keytool -genkeypair -keystore "$REL_KS" -storepass "$PASS" -keypass "$PASS" -alias mossy \
    -dname "CN=Mossy Meadows,O=Mossy Meadows,C=FR" -keyalg RSA -keysize 4096 -validity 10000 >/dev/null 2>&1
  printf 'storePassword=%s\nkeyAlias=mossy\n' "$PASS" > "$REL_PROPS"
  echo "   (new release key generated: android/release.jks — back it up!)"
fi
REL_PASS=$(grep storePassword "$REL_PROPS" | cut -d= -f2)

sign_apk() { # in out ks pass alias
  "$BT/zipalign" -p -f 4 "$1" "$OUT/aligned.apk"
  java -jar "$BT/apksigner.jar" sign --ks "$3" --ks-pass "pass:$4" --key-pass "pass:$4" --ks-key-alias "$5" \
    --min-sdk-version 24 --v4-signing-enabled false --out "$2" "$OUT/aligned.apk"
  java -jar "$BT/apksigner.jar" verify --min-sdk-version 24 "$2"
}

echo "==> Debug APK"
link "$OUT/debug-unsigned.apk" --debug-mode
add_dex "$OUT/debug-unsigned.apk"
sign_apk "$OUT/debug-unsigned.apk" "$DIST/mossy-meadows-$VERSION_NAME-debug.apk" "$DEBUG_KS" android androiddebugkey

echo "==> Release APK"
link "$OUT/release-unsigned.apk"
add_dex "$OUT/release-unsigned.apk"
sign_apk "$OUT/release-unsigned.apk" "$DIST/mossy-meadows-$VERSION_NAME-release.apk" "$REL_KS" "$REL_PASS" mossy

echo "==> Release AAB"
link "$OUT/proto.zip" --proto-format
# base module layout: manifest/, dex/, res/, resources.pb, assets/
python3 - "$OUT/proto.zip" "$OUT/classes.dex" "$OUT/base-module.zip" <<'PY'
import sys, zipfile
proto, dex, out = sys.argv[1:4]
with zipfile.ZipFile(proto) as src, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for info in src.infolist():
        name = info.filename
        data = src.read(name)
        z.writestr('manifest/AndroidManifest.xml' if name == 'AndroidManifest.xml' else name, data)
    z.write(dex, 'dex/classes.dex')
PY
# Google's bundletool (validates the bundle and writes BundleConfig.pb). Not in git:
#   npm pack bundletoolheavy && tar xzf bundletoolheavy-*.tgz && cp package/bundletoolfile/*.jar android/tools/bundletool.jar
BUNDLETOOL="$ROOT/android/tools/bundletool.jar"
[ -f "$BUNDLETOOL" ] || { echo "missing $BUNDLETOOL (see comment in build.sh)"; exit 1; }
rm -f "$OUT/base.aab"
java -jar "$BUNDLETOOL" build-bundle --modules="$OUT/base-module.zip" --output="$OUT/base.aab"
java -jar "$BUNDLETOOL" validate --bundle="$OUT/base.aab" >/dev/null
jarsigner -sigalg SHA256withRSA -digestalg SHA-256 -keystore "$REL_KS" -storepass "$REL_PASS" \
  -signedjar "$DIST/mossy-meadows-$VERSION_NAME-release.aab" "$OUT/base.aab" mossy >/dev/null
echo "==> Done"
ls -la "$DIST"
