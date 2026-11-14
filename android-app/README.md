# BigbullsGlobal Android App

Standalone Android app project. Existing website files remain untouched.

## Build
The GitHub Actions workflow `.github/workflows/build-bigbullsglobal-android.yml` builds a debug APK on pushes to `feature/bigbullsglobal-android-app` and uploads it as `BigbullsGlobal-test-apk`.

Run locally: `npm install && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug`.

A debug APK is for testing and is not a Play Store release. A signed release requires a private keystore.
