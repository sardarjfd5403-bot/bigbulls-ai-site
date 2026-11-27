import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "android");
const manifest = path.join(root, "app/src/main/AndroidManifest.xml");
if (!fs.existsSync(manifest)) throw new Error("Generated AndroidManifest.xml is missing.");

let xml = fs.readFileSync(manifest, "utf8");
if (!xml.includes("android.permission.REQUEST_INSTALL_PACKAGES")) {
  xml = xml.replace("<application", '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n<application');
}
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

const javaRoot = path.join(root, "app/src/main/java");
function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { const found = findFile(full, name); if (found) return found; }
    else if (entry.name === name) return full;
  }
  return null;
}
const mainActivity = findFile(javaRoot, "MainActivity.java");
if (!mainActivity) throw new Error("Generated MainActivity.java was not found.");
const mainSource = fs.readFileSync(mainActivity, "utf8");
const packageName = (mainSource.match(/^package\s+([\w.]+);/m) || [])[1];
if (!packageName) throw new Error("Could not detect Android package name.");
const nativeDir = path.dirname(mainActivity);
const pluginFile = path.join(nativeDir, "ApkUpdaterPlugin.java");
const pluginSource = [
'package ' + packageName + ';',
'import android.app.DownloadManager;',
'import android.content.BroadcastReceiver;',
'import android.content.Context;',
'import android.content.Intent;',
'import android.content.IntentFilter;',
'import android.net.Uri;',
'import android.os.Build;',
'import android.os.Environment;',
'import android.provider.Settings;',
'import com.getcapacitor.Plugin;',
'import com.getcapacitor.PluginCall;',
'import com.getcapacitor.PluginMethod;',
'import com.getcapacitor.annotation.CapacitorPlugin;',
'@CapacitorPlugin(name = "ApkUpdater")',
'public class ApkUpdaterPlugin extends Plugin {',
'  private BroadcastReceiver receiver;',
'  @PluginMethod public void downloadAndInstall(PluginCall call) {',
'    String url = call.getString("url");',
'    if (url == null || !url.startsWith("https://")) { call.reject("A secure APK download URL is required."); return; }',
'    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {',
'      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));',
'      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(settings);',
'      call.reject("Allow BIGBULLS to install unknown apps, then tap Update Now again."); return;',
'    }',
'    try {',
'      DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);',
'      DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));',
'      request.setTitle("BIGBULLS Android update"); request.setDescription("Downloading latest BIGBULLS APK");',
'      request.setMimeType("application/vnd.android.package-archive");',
'      request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);',
'      request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, "BIGBULLS-Android.apk");',
'      long id = manager.enqueue(request);',
'      if (receiver != null) { try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {} }',
'      receiver = new BroadcastReceiver() { public void onReceive(Context context, Intent intent) {',
'        if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;',
'        try { Uri apk = manager.getUriForDownloadedFile(id); if (apk == null) throw new IllegalStateException("APK download failed.");',
'          Intent install = new Intent(Intent.ACTION_VIEW); install.setDataAndType(apk, "application/vnd.android.package-archive");',
'          install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); context.startActivity(install); call.resolve();',
'        } catch (Exception error) { call.reject("Could not open Android installer: " + error.getMessage()); }',
'        try { context.unregisterReceiver(this); } catch (Exception ignored) {} receiver = null;',
'      }};',
'      IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);',
'      if (Build.VERSION.SDK_INT >= 33) getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED); else getContext().registerReceiver(receiver, filter);',
'    } catch (Exception error) { call.reject("Could not start APK download: " + error.getMessage()); }',
'  }',
'}'
].join("\n");
fs.writeFileSync(pluginFile, pluginSource);
let updated = mainSource;
if (!updated.includes("ApkUpdaterPlugin.class")) {
  updated = updated.replace("public class MainActivity extends BridgeActivity {", "public class MainActivity extends BridgeActivity {\n  @Override public void onCreate(android.os.Bundle savedInstanceState) {\n    registerPlugin(ApkUpdaterPlugin.class);\n    super.onCreate(savedInstanceState);\n  }");
}
if (!updated.includes("ApkUpdaterPlugin.class")) throw new Error("Could not register native APK updater plugin.");
fs.writeFileSync(mainActivity, updated);
