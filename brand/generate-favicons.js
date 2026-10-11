const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('logo.svg');

[16, 32, 48, 128, 192, 512].forEach(s => {
  sharp(svg).resize(s, s).png().toFile(`favicon-${s}.png`);
  console.log(`Generated favicon-${s}.png`);
});

sharp(svg).resize(180, 180).png().toFile('apple-touch-icon.png');
console.log('Generated apple-touch-icon.png');

console.log('Done!');