#!/bin/bash
# Lance le téléphone virtuel Android (s'il ne tourne pas déjà), compile l'appli, l'installe et l'ouvre.
#   npm run emulateur             → compile puis installe la dernière version
#   npm run emulateur -- --vite   → sans recompiler (installe le dernier APK compilé)
set -e
SDK="$HOME/Library/Android/sdk"
ADB="$SDK/platform-tools/adb"
AVD="${AVD:-Medium_Phone_API_37.0}"
APK="android/app/build/outputs/apk/debug/app-debug.apk"

if ! "$ADB" devices | grep -q "emulator-"; then
  echo "Démarrage du téléphone virtuel ($AVD)…"
  nohup "$SDK/emulator/emulator" -avd "$AVD" >/dev/null 2>&1 &
fi

if [ "$1" != "--vite" ]; then
  echo "Compilation de l'appli…"
  npm run android:apk --silent >/dev/null 2>&1 || { echo "Compilation impossible :"; npm run android:apk; exit 1; }
fi

echo "Attente du téléphone virtuel…"
"$ADB" wait-for-device
until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

echo "Installation…"
"$ADB" install -r -g "$APK" >/dev/null
"$ADB" shell am start -n fr.bodhiyoga.seances/.MainActivity >/dev/null
echo "Mes séances Yoga est ouvert dans le téléphone virtuel."
