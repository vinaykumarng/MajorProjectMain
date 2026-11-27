import QRCode from '../vendor/qrcode/index.js';
import correction from '../vendor/qrcode/QRErrorCorrectLevel.js';

export function tracePath(batchId) {
  return '/trace?' + new URLSearchParams({ batch: batchId });
}

export function qrSvg(url) {
  const qr = new QRCode(-1, correction.M);
  qr.addData(url);
  qr.make();
  const size = qr.getModuleCount();
  const margin = 4;
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  const width = size + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${width}" width="${width * 8}" height="${width * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;
}
