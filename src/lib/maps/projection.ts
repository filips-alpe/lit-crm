import landData from './land-110m.json';

/**
 * Tiny offline map projection for the correspondence route renderer. No map
 * library and no runtime network: a bundled Natural Earth 110m land outline is
 * projected with a plain equirectangular (plate carrée) projection into the same
 * coordinate space the cards draw in. Kept pure and server-safe so it is
 * unit-testable and the land paths can be memoised once per process.
 */

export type Point = { lat: number; lng: number };

type Ring = number[][];
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: string; coordinates: unknown };
type GeoJson = { features?: Array<{ geometry?: Geometry }> };

const WORLD = { minX: -180, minY: -90, maxX: 180, maxY: 90 };
const DEFAULT_PAD_DEG = 8;
/** Smallest framed span, so two close cities (or a lone pin) still get context. */
const MIN_SPAN_DEG = 20;

const rnd = (v: number) => Math.round(v * 100) / 100;

/** Plate carrée: longitude is x, latitude is flipped to y so north is up. */
export function projectEquirect(lng: number, lat: number): [number, number] {
  // `+ 0` normalises -0 (from `-lat` at the equator) to 0.
  return [lng, -lat + 0];
}

function ringToPath(ring: Ring): string {
  const d = ring
    .map(([lng, lat], i) => {
      const [x, y] = projectEquirect(lng, lat);
      return `${i === 0 ? 'M' : 'L'}${rnd(x)},${rnd(y)}`;
    })
    .join(' ');
  return `${d} Z`;
}

/** One path per polygon (rings concatenated so holes render via even-odd fill). */
function polygonPath(rings: Ring[]): string {
  return rings.map(ringToPath).join(' ');
}

/** Convert a GeoJSON FeatureCollection of (Multi)Polygons into SVG `d` strings. */
export function polygonsToPaths(geojson: GeoJson): string[] {
  const out: string[] = [];
  for (const f of geojson.features ?? []) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      out.push(polygonPath(g.coordinates as Ring[]));
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as Ring[][]) out.push(polygonPath(poly));
    }
  }
  return out;
}

let cachedLandPaths: string[] | null = null;

/** The bundled land outline as SVG path strings — computed once, then reused. */
export function landPaths(): string[] {
  if (!cachedLandPaths) cachedLandPaths = polygonsToPaths(landData as GeoJson);
  return cachedLandPaths;
}

function ensureSpan(lo: number, hi: number, min: number): [number, number] {
  if (hi - lo >= min) return [lo, hi];
  const c = (lo + hi) / 2;
  return [c - min / 2, c + min / 2];
}

function clampSpan(lo: number, hi: number, wlo: number, whi: number): [number, number] {
  const worldSpan = whi - wlo;
  if (hi - lo >= worldSpan) return [wlo, whi];
  if (lo < wlo) {
    hi += wlo - lo;
    lo = wlo;
  }
  if (hi > whi) {
    lo -= hi - whi;
    hi = whi;
  }
  if (lo < wlo) lo = wlo;
  return [lo, hi];
}

/**
 * An SVG `viewBox` ("minX minY width height") framing `points`, padded by
 * `padDeg`, never smaller than {@link MIN_SPAN_DEG}, and clamped to world
 * bounds. With no points it returns the whole world.
 */
export function viewBoxFor(points: Point[], padDeg = DEFAULT_PAD_DEG): string {
  if (points.length === 0) {
    return `${WORLD.minX} ${WORLD.minY} ${WORLD.maxX - WORLD.minX} ${WORLD.maxY - WORLD.minY}`;
  }
  const projected = points.map((p) => projectEquirect(p.lng, p.lat));
  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);

  let [minX, maxX] = ensureSpan(Math.min(...xs) - padDeg, Math.max(...xs) + padDeg, MIN_SPAN_DEG);
  let [minY, maxY] = ensureSpan(Math.min(...ys) - padDeg, Math.max(...ys) + padDeg, MIN_SPAN_DEG);
  [minX, maxX] = clampSpan(minX, maxX, WORLD.minX, WORLD.maxX);
  [minY, maxY] = clampSpan(minY, maxY, WORLD.minY, WORLD.maxY);

  return `${rnd(minX)} ${rnd(minY)} ${rnd(maxX - minX)} ${rnd(maxY - minY)}`;
}

/** SVG path for a quadratic arc between two projected points, bowed perpendicular
 *  to the midpoint for a great-circle-ish curve. */
export function quadArc([x1, y1]: number[], [x2, y2]: number[]): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const off = len * 0.18;
  const cx = mx + (-dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}
