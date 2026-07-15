const { createCanvas } = require('canvas');
const canvas = createCanvas(200, 200);
const ctx = canvas.getContext('2d');

ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);

ctx.save();
// Start clipFunc
ctx.beginPath();
ctx.rect(0, 0, 200, 200);
ctx.moveTo(50, 50);
ctx.lineTo(150, 50);
ctx.lineTo(150, 150);
ctx.lineTo(50, 150);
ctx.closePath();
ctx.clip("evenodd");
// Konva calls this automatically:
ctx.clip(); 

// Draw something that should be clipped
ctx.fillStyle = 'blue';
ctx.fillRect(0, 0, 200, 200);
ctx.restore();

// The center (50,50 to 150,150) should remain RED because the blue was clipped out of it!
const imgData = ctx.getImageData(100, 100, 1, 1).data;
console.log("Center color (should be red 255,0,0):", imgData[0], imgData[1], imgData[2]);
const edgeData = ctx.getImageData(10, 10, 1, 1).data;
console.log("Edge color (should be blue 0,0,255):", edgeData[0], edgeData[1], edgeData[2]);
