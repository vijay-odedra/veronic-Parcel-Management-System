#!/bin/bash
set -e

APK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="/home/vijay-odedra/Android/Sdk"
BUILD_TOOLS="$SDK/build-tools/35.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
KEYSTORE="$APK_DIR/dropbook-release.keystore"

echo "=================================================="
echo "  BUILDING PRODUCTION RELEASE ANDROID APK (SDK 34)"
echo "=================================================="

cd "$APK_DIR"
rm -rf obj/* bin/*
mkdir -p obj bin assets/db

# 1. Sync assets from public directory & db
cp -r "$APK_DIR/../public/"* "$APK_DIR/assets/"
cp -r "$APK_DIR/db/"* "$APK_DIR/assets/db/"

# 2. Compile binary resources & generate R.java
"$BUILD_TOOLS/aapt" package -f -m \
  -J src \
  -M AndroidManifest.xml \
  -S res \
  -I "$PLATFORM"

# 3. Compile Java with Java 8/11 compatibility
javac -source 8 -target 8 -g:none -cp "$PLATFORM" -d obj src/com/dropbook/fleet/*.java

# 4. Generate Dalvik Executable (classes.dex)
"$BUILD_TOOLS/d8" --output bin/ obj/com/dropbook/fleet/*.class --lib "$PLATFORM"

# 5. Package into unaligned APK
"$BUILD_TOOLS/aapt" package -f \
  -M AndroidManifest.xml \
  -S res \
  -A assets \
  -I "$PLATFORM" \
  -F bin/DropBook.unsigned.apk

# 6. Add classes.dex into APK
cd bin
"$BUILD_TOOLS/aapt" add DropBook.unsigned.apk classes.dex
cd ..

# 7. ZipAlign (4-byte alignment)
"$BUILD_TOOLS/zipalign" -f -v -p 4 bin/DropBook.unsigned.apk bin/DropBook.aligned.apk

# 8. Cryptographically Sign APK with Production Release Keystore (v1, v2, v3 schemes)
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:dropbook123 \
  --ks-key-alias dropbook \
  --key-pass pass:dropbook123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$APK_DIR/DropBook.apk" \
  bin/DropBook.aligned.apk

# 9. Verify Signature
"$BUILD_TOOLS/apksigner" verify --verbose "$APK_DIR/DropBook.apk"

# 10. Copy to Release-Package
mkdir -p "$APK_DIR/../../Release-Package/APK"
cp "$APK_DIR/DropBook.apk" "$APK_DIR/../../Release-Package/APK/DropBook.apk"

echo "=================================================="
echo "🎉 PRODUCTION APK SUCCESSFULLY COMPILED & SIGNED!"
echo "   📱 $APK_DIR/DropBook.apk"
echo "   📱 $APK_DIR/../../Release-Package/APK/DropBook.apk"
echo "=================================================="
