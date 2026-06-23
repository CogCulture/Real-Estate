// scaleUtils.js

export function pxToM(px, scalePxPerM) {
  return parseFloat((px / scalePxPerM).toFixed(2));
}

export function mToPx(m, scalePxPerM) {
  return parseFloat((m * scalePxPerM).toFixed(2));
}
