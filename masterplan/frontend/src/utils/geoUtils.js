// geoUtils.js

export function calculateAreaFromLatLng(latlngs) {
  // Shoelace formula on lat/lng pairs
  // Each degree of latitude ≈ 111,320 meters
  // Each degree of longitude ≈ 111,320 * cos(lat) meters
  const R = 6371000; // Earth radius in meters
  let area = 0;
  const n = latlngs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = latlngs[i].lng * (Math.PI / 180) * R * Math.cos(latlngs[i].lat * Math.PI / 180);
    const yi = latlngs[i].lat * (Math.PI / 180) * R;
    const xj = latlngs[j].lng * (Math.PI / 180) * R * Math.cos(latlngs[j].lat * Math.PI / 180);
    const yj = latlngs[j].lat * (Math.PI / 180) * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
}

export function getBoundingBoxMeters(latlngs) {
  if (!latlngs || latlngs.length === 0) return { widthM: 0, heightM: 0 };
  const lats = latlngs.map(p => p.lat);
  const lngs = latlngs.map(p => p.lng);
  const latDiff = Math.max(...lats) - Math.min(...lats);
  const lngDiff = Math.max(...lngs) - Math.min(...lngs);
  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const widthM = lngDiff * 111320 * Math.cos(centerLat * Math.PI / 180);
  const heightM = latDiff * 111320;
  return { widthM, heightM };
}

export function rotateLatLngs(latlngs, angleDegrees) {
  if (!latlngs || latlngs.length === 0) return latlngs;
  const angleRad = (angleDegrees * Math.PI) / 180;
  
  let sumLat = 0;
  let sumLng = 0;
  latlngs.forEach(p => {
    sumLat += p.lat;
    sumLng += p.lng;
  });
  const cx = sumLng / latlngs.length;
  const cy = sumLat / latlngs.length;
  
  return latlngs.map(p => {
    const x = p.lng - cx;
    const y = p.lat - cy;
    const rx = x * Math.cos(angleRad) - y * Math.sin(angleRad);
    const ry = x * Math.sin(angleRad) + y * Math.cos(angleRad);
    return {
      lat: ry + cy,
      lng: rx + cx
    };
  });
}

export function calculatePolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i][0] * points[j][1] - points[j][0] * points[i][1];
  }
  return Math.abs(area / 2);
}

export function rotatePoint(x, y, cx, cy, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = x - cx;
  const dy = y - cy;
  return [
    dx * cos - dy * sin + cx,
    dx * sin + dy * cos + cy
  ];
}

