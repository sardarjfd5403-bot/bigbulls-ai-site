# BigbullsGlobal Android App

This is a separate Android app project. It does not edit or replace the existing website frontend.

## Product behavior
- App name: BigbullsGlobal
- White/blue brand mark.
- Unauthenticated users see the existing website landing page and its existing login/signup UI.
- After a Supabase session is available, the app opens the Android-only terminal copy.
- The Android terminal preserves the existing four terminal tabs and adds Profile as tab five.
- Profile is a native Android-only client workspace styled to match the dark trading terminal. It no longer embeds the website landing page. Account Centre opens the app's Accounts tab; Profile and client services open the Android-only dark portal copy at `client-portal.html`, which uses the existing Supabase configuration and server-side workflows. The root website files are not modified.
- The Android app copy is isolated under `android-app/`; the root website and root `terminal.html` are not modified.

## Shared session
The Capacitor app is configured to load from the same website origin under `/android-app/`. The login page, Android terminal and embedded Client Portal therefore share the website origin and the existing Supabase auth storage key. No service-role key is included.

## Branding
The Android build script applies a blue adaptive launcher icon with the white BIGBULLS mark after generating the native Android project.

## Build a debug APK
From this directory:
```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```
Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`.

The app currently uses the deployed HTTPS site as its Capacitor server URL. Deploying the new `android-app/` directory is required before the APK can load the new app shell. This does not require changing the root website.

A signed Play Store AAB requires a release keystore and signing secrets. Do not publish an unsigned build.
