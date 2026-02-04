import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Venezuelan flag colors
const yellow = '#FFCD00';
const blue = '#00247D';
const red = '#CF142B';

// Background - deep blue circle
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
ctx.fillStyle = blue;
ctx.fill();

// Inner gold ring
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2);
ctx.strokeStyle = yellow;
ctx.lineWidth = 8;
ctx.stroke();

// Stars arc (8 stars of Venezuela) - small yellow dots in an arc
const starCount = 8;
const starRadius = size / 2 - 55;
for (let i = 0; i < starCount; i++) {
  const angle = (Math.PI * 0.15) + (i * (Math.PI * 0.7) / (starCount - 1));
  const x = size / 2 + starRadius * Math.cos(angle + Math.PI * 0.15);
  const y = size / 2 - starRadius * Math.sin(angle + Math.PI * 0.15) + 20;

  // Draw a small star shape
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = yellow;
  ctx.fill();
}

// "MVGA" text - big and bold in center
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 120px Arial, Helvetica, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('MVGA', size / 2, size / 2 - 15);

// Subtitle text
ctx.fillStyle = yellow;
ctx.font = 'bold 28px Arial, Helvetica, sans-serif';
ctx.fillText('MAKE VENEZUELA', size / 2, size / 2 + 60);
ctx.fillText('GREAT AGAIN', size / 2, size / 2 + 92);

// Red accent line under subtitle
ctx.beginPath();
ctx.moveTo(size / 2 - 130, size / 2 + 115);
ctx.lineTo(size / 2 + 130, size / 2 + 115);
ctx.strokeStyle = red;
ctx.lineWidth = 4;
ctx.stroke();

// Save
const buffer = canvas.toBuffer('image/png');
writeFileSync('scripts/mvga-logo.png', buffer);
console.log('Logo saved to scripts/mvga-logo.png');
console.log(`Size: ${buffer.length} bytes`);
