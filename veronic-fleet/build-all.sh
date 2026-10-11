#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  VERONIC FLEET - COMPLETE MASTER BUILD SCRIPT            "
echo "=========================================================="

echo "1. Synchronizing Database to Firebase Cloud..."
npm run firebase:sync

echo "2. Packaging Mobile Android APK..."
npm run apk:build

echo "3. Building Windows & Linux Desktop Installers (EXE/DEB)..."
npm run build:all || npm run build

echo "=========================================================="
echo "🎉 ALL BUILDS COMPLETED SUCCESSFULLY!"
echo "   🖥️  Windows & Linux Installers: $DIR/dist/"
echo "   📱  Android APK:                $DIR/apk/"
echo "   🔥  Firebase Firestore Live:    Connected & Synced"
echo "=========================================================="
