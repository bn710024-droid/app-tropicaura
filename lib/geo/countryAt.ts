import { COUNTRY_SHAPES, SHAPE_SCALE } from './countryShapes';

type Ring = { xs: number[]; ys: number[]; minX: number; maxX: number; minY: number; maxY: number };

let decoded: [string, Ring[]][] | null = null;

/** Décode une polyligne compacte (deltas en base 32, comme le format « encoded polyline »). */
function decodeRing(encoded: string): Ring {
  const xs: number[] = [];
  const ys: number[] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    y += next();
    x += next();
    xs.push(x / SHAPE_SCALE);
    ys.push(y / SHAPE_SCALE);
  }
  return {
    xs,
    ys,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function shapes() {
  if (!decoded) {
    decoded = Object.entries(COUNTRY_SHAPES).map(([code, rings]) => [code, rings.map(decodeRing)]);
  }
  return decoded;
}

function contains(r: Ring, x: number, y: number) {
  if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) return false;
  let inside = false;
  for (let i = 0, j = r.xs.length - 1; i < r.xs.length; j = i++) {
    const xi = r.xs[i];
    const yi = r.ys[i];
    const xj = r.xs[j];
    const yj = r.ys[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance (en degrés de latitude) du point au contour de l'anneau. */
function distance(r: Ring, x: number, y: number, k: number) {
  let min = Infinity;
  for (let i = 0, j = r.xs.length - 1; i < r.xs.length; j = i++) {
    const ax = r.xs[j];
    const ay = r.ys[j];
    const dx = (r.xs[i] - ax) * k;
    const dy = r.ys[i] - ay;
    const px = (x - ax) * k;
    const py = y - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len));
    const d = Math.hypot(px - t * dx, py - t * dy);
    if (d < min) min = d;
  }
  return min;
}

const NEAR = 0.3; // ≈ 33 km : en deçà, la frontière simplifiée ne permet pas de trancher
const COAST = 0.6; // ≈ 66 km : au-delà, on est en pleine mer

/**
 * Pays qui contient un point, calculé sur l'appareil (aucune requête réseau).
 * Les contours étant simplifiés, `hint` (le pays des réglages de l'appareil) départage
 * les points proches d'une frontière.
 */
export function countryAt(latitude: number, longitude: number, hint?: string | null) {
  const k = Math.cos((latitude * Math.PI) / 180);
  let inside: string | null = null;
  let nearest: string | null = null;
  let nearestD = Infinity;
  let hintD = Infinity;

  for (const [code, rings] of shapes()) {
    let hits = 0;
    let d = Infinity;
    for (const r of rings) {
      if (
        longitude < r.minX - 1 / k ||
        longitude > r.maxX + 1 / k ||
        latitude < r.minY - 1 ||
        latitude > r.maxY + 1
      ) {
        continue;
      }
      if (contains(r, longitude, latitude)) hits++;
      d = Math.min(d, distance(r, longitude, latitude, k));
    }
    if (hits % 2 === 1) {
      inside = code;
      d = 0;
    }
    if (code === hint) hintD = d;
    if (d < nearestD) {
      nearestD = d;
      nearest = code;
    }
  }

  if (hint && hintD < NEAR) return hint;
  if (inside) return inside;
  return nearestD < COAST ? nearest : null;
}
