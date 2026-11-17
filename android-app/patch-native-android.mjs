import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "android");
const manifest = path.join(root, "app/src/main/AndroidManifest.xml");
if (!fs.existsSync(manifest)) throw new Error("Generated AndroidManifest.xml is missing.");

let xml = fs.readFileSync(manifest, "utf8");
if (!xml.includes("android.permission.USE_BIOMETRIC")) {
  xml = xml.replace("<application", '<uses-permission android:name="android.permission.USE_BIOMETRIC" />\n<application');
}

const appMatch = xml.match(/<application\b[^>]*>/);
if (!appMatch) throw new Error("Android application manifest element is missing.");
let appTag = appMatch[0];

function setAttribute(tag, name, value) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + '="[^"]*"');
  if (re.test(tag)) return tag.replace(re, name + '="' + value + '"');
  return tag.replace(/>$/, ' ' + name + '="' + value + '">');
}

appTag = setAttribute(appTag, "android:hardwareAccelerated", "true");
appTag = setAttribute(appTag, "android:usesCleartextTraffic", "false");
appTag = setAttribute(appTag, "android:allowBackup", "false");
xml = xml.replace(appMatch[0], appTag);

xml = xml.replace(/<activity\b([^>]*)>/g, (tag, attrs) => {
  let next = attrs;
  if (/android:hardwareAccelerated=/.test(next)) next = next.replace(/android:hardwareAccelerated="[^"]*"/, 'android:hardwareAccelerated="true"');
  else next += ' android:hardwareAccelerated="true"';
  if (/android:windowSoftInputMode=/.test(next)) next = next.replace(/android:windowSoftInputMode="[^"]*"/, 'android:windowSoftInputMode="adjustResize"');
  else next += ' android:windowSoftInputMode="adjustResize"';
  return "<activity" + next + ">";
});

for (const [attribute, expected] of [
  ["android:usesCleartextTraffic", "false"],
  ["android:allowBackup", "false"],
  ["android:hardwareAccelerated", "true"],
]) {
  if (!appTag.includes(attribute + '="' + expected + '"')) {
    throw new Error("Android manifest hardening check failed: " + attribute);
  }
}

fs.writeFileSync(manifest, xml);

const styles = path.join(root, "app/src/main/res/values/styles.xml");
if (fs.existsSync(styles)) {
  let x = fs.readFileSync(styles, "utf8");
  if (!x.includes("android:statusBarColor")) {
    x = x.replace(/<style name="AppTheme.NoActionBar"([^>]*)>/, '<style name="AppTheme.NoActionBar"$1><item name="android:statusBarColor">#FFFFFF</item><item name="android:navigationBarColor">#FFFFFF</item><item name="android:windowLightStatusBar">true</item><item name="android:windowLightNavigationBar">true</item><item name="colorAccent">#0B3D91</item>');
  }
  fs.writeFileSync(styles, x);
}

console.log("Android manifest hardening verified: HTTPS-only traffic, backup disabled, biometric permission, hardware acceleration.");
