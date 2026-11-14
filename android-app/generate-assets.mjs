import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root=process.cwd();
const out=path.join(root,"resources");
fs.mkdirSync(out,{recursive:true});
const iconSvg=fs.readFileSync(path.join(root,"bigbullsglobal.svg"));
const splashSvg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#f2f8ff"/></linearGradient></defs>
<rect width="2732" height="2732" fill="url(#bg)"/>
<g transform="translate(1046 760) scale(1.25)"><path d="M126 151C86 124 76 87 86 54c34 33 65 43 105 38M386 151c40-27 50-64 40-97-34 33-65 43-105 38" fill="none" stroke="#0B3D91" stroke-width="30" stroke-linecap="round"/><path d="M153 105h150c91 0 142 43 142 111 0 42-22 73-60 90 48 15 76 49 76 98 0 77-59 123-157 123H153V105zm92 83v88h55c31 0 49-16 49-45 0-28-18-43-51-43h-53zm0 166v91h63c36 0 55-16 55-46 0-29-20-45-57-45h-61z" fill="#0B3D91" transform="translate(0 -45)"/><path d="M232 60l47 46-47 46" fill="none" stroke="#4DA3FF" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/></g>
<text x="1366" y="1660" text-anchor="middle" font-family="Arial,sans-serif" font-size="112" font-weight="700" letter-spacing="18" fill="#0B3D91">BIGBULL GLOBAL MARKET</text>
<text x="1366" y="1790" text-anchor="middle" font-family="Arial,sans-serif" font-size="56" letter-spacing="12" fill="#4D78A9">TRADE • INVEST • GROW</text>
</svg>`);
await sharp(iconSvg).resize(1024,1024).png().toFile(path.join(out,"icon.png"));
await sharp(splashSvg).png().toFile(path.join(out,"splash.png"));
console.log("Generated 1024px app icon and 2732px splash artwork.");
