import fs from "node:fs/promises";
import path from "node:path";

const res = path.resolve("android/app/src/main/res");
const files = [
  ["values/bigbulls_launcher.xml", `<resources><color name="bigbulls_launcher_background">#0066FF</color></resources>`],
  ["drawable/ic_launcher_foreground.xml", `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="512" android:viewportHeight="512">
    <path android:fillColor="#FFFFFF" android:pathData="M153,104h146c80,0 124,38 124,100 0,38 -19,66 -52,81 43,13 67,43 67,87 0,69 -53,111 -141,111H153V104z M244,180v73h54c25,0 39,-13 39,-37 0,-23 -15,-36 -41,-36h-52z M244,325v81h61c31,0 47,-14 47,-41 0,-26 -17,-40 -48,-40h-60z"/>
    <path android:fillColor="#FFFFFF" android:strokeColor="#FFFFFF" android:strokeWidth="17" android:strokeLineCap="round" android:fillAlpha="0" android:pathData="M108,128c-29,18 -44,47 -44,85 0,36 15,65 44,84 M101,128c-45,24 -68,62 -68,113 0,48 23,87 68,111"/>
</vector>`],
  ["mipmap-anydpi-v26/ic_launcher.xml", `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/bigbulls_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`],
  ["mipmap-anydpi-v26/ic_launcher_round.xml", `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/bigbulls_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`]
];
for (const [relative, content] of files) {
  const target = path.join(res, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content + "\n", "utf8");
}
console.log("BigbullsGlobal blue/white adaptive launcher icons installed.");
