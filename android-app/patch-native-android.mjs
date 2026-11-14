import fs from "node:fs";
import path from "node:path";
const root=path.join(process.cwd(),"android");
const manifest=path.join(root,"app/src/main/AndroidManifest.xml");
if(!fs.existsSync(manifest)) throw new Error("Generated AndroidManifest.xml is missing.");
let xml=fs.readFileSync(manifest,"utf8");
if(!xml.includes("android.permission.USE_BIOMETRIC")) {
  xml=xml.replace(/<application\\b/, '<uses-permission android:name="android.permission.USE_BIOMETRIC" />\\n<application');
}

if(/<application\b[^>]*android:hardwareAccelerated=/.test(xml)) {
  xml=xml.replace(/(<application\b[^>]*?)android:hardwareAccelerated="[^"]*"/,'$1android:hardwareAccelerated="true"');
} else {
  xml=xml.replace(/<application\b/,'<application android:hardwareAccelerated="true"');
}
xml=xml.replace(/<activity\b([^>]*)>/g,(tag,attrs)=>{
  let next=attrs;
  if(/android:hardwareAccelerated=/.test(next)) next=next.replace(/android:hardwareAccelerated="[^"]*"/,'android:hardwareAccelerated="true"');
  else next+=' android:hardwareAccelerated="true"';
  if(/android:windowSoftInputMode=/.test(next)) next=next.replace(/android:windowSoftInputMode="[^"]*"/,'android:windowSoftInputMode="adjustResize"');
  else next+=' android:windowSoftInputMode="adjustResize"';
  return '<activity'+next+'>';
});
fs.writeFileSync(manifest,xml);
const styles=path.join(root,"app/src/main/res/values/styles.xml");
if(fs.existsSync(styles)){
  let x=fs.readFileSync(styles,"utf8");
  if(!x.includes("android:statusBarColor")) x=x.replace(/<style name="AppTheme.NoActionBar"([^>]*)>/,'<style name="AppTheme.NoActionBar"$1><item name="android:statusBarColor">#FFFFFF</item><item name="android:navigationBarColor">#FFFFFF</item><item name="android:windowLightStatusBar">true</item><item name="android:windowLightNavigationBar">true</item><item name="colorAccent">#0B3D91</item>');
  fs.writeFileSync(styles,x);
}
console.log("Enabled Android hardware acceleration and clean white/blue native UI.");
