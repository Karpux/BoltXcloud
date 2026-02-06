# Bolt Xcloud Android App

This is a minimal WebView wrapper that loads Xbox Cloud Gaming and injects the Bolt Xcloud userscript.

## Flavors
- `mobile`: regular launcher icon
- `tv`: Android TV launcher icon

## Build (Android Studio)
1. Open the `android/` folder in Android Studio.
2. Let Gradle sync.
3. Select build variant: `mobileDebug`, `mobileRelease`, `tvDebug`, or `tvRelease`.
4. Build APK: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Notes
- The script asset is at `android/app/src/main/assets/bolt-xcloud.user.js`.
- When you update the userscript, copy it again into assets before building.
