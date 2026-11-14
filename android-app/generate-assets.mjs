import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root=process.cwd();
const out=path.join(root,"resources");
fs.mkdirSync(out,{recursive:true});
const webDir=path.join(root,"www");
fs.mkdirSync(webDir,{recursive:true});
if(!fs.existsSync(path.join(webDir,"index.html"))) throw new Error("Android portal www/index.html is missing.");
const iconSvg=fs.readFileSync(path.join(root,"bigbullsglobal.svg"));
const mark=String.raw`<g transform="translate(830 650) scale(1.05)">
<path d="M122 108h145c86 0 132 39 132 103 0 39-20 68-55 84 45 15 70 46 70 91 0 72-55 118-148 118H122V108zm91 76v80h50c30 0 47-15 47-41 0-25-17-39-49-39h-48zm0 154v87h58c34 0 52-15 52-44 0-28-19-43-54-43h-56z" fill="#0b3d91" transform="translate(0 -32)"/>
<path d="M300 108h68c77 0 119 36 119 98 0 37-19 65-52 80 42 14 66 43 66 85 0 68-51 111-137 111h-64v-77h61c32 0 48-14 48-39 0-24-17-38-50-38h-59v-72h54c27 0 42-13 42-36 0-22-15-35-43-35h-53z" fill="#38a3ff" opacity=".95" transform="translate(-24 -18) scale(.72)"/>
</g>`;
const splashSvg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#ffffff"/><circle cx="1366" cy="1366" r="490" fill="#f5faff"/>${mark}</svg>`);
await sharp(iconSvg).resize(1024,1024).png().toFile(path.join(out,"icon.png"));
await sharp(splashSvg).png().toFile(path.join(out,"splash.png"));
console.log("Generated clean white/blue BB launcher icon and white splash screen.");
