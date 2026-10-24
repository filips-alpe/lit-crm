import { describe, expect, it } from 'vitest';
import { projectEquirect, quadArc, viewBoxFor, polygonsToPaths } from './projection';

function box(s: string) {
  const [minX, minY, w, h] = s.split(/\s+/).map(Number);
  return { minX, minY, w, h, maxX: minX + w, maxY: minY + h };
}

describe('projectEquirect', () => {
  it('maps the origin to the origin', () => {
    expect(projectEquirect(0, 0)).toEqual([0, 0]);
  });

  it('keeps longitude as x', () => {
    expect(projectEquirect(10, 0)).toEqual([10, 0]);
    expect(projectEquirect(-74, 0)).toEqual([-74, 0]);
  });

  it('flips latitude so north is up (negative y)', () => {
    expect(projectEquirect(0, 45)).toEqual([0, -45]);
    expect(projectEquirect(-74, 40)).toEqual([-74, -40]);
  });
});

describe('viewBoxFor', () => {
  it('frames two points with both inside the box', () => {
    const london = { lat: 51.5, lng: -0.1 };
    const philly = { lat: 39.95, lng: -75.16 };
    const b = box(viewBoxFor([london, philly]));
    const [lx, ly] = projectEquirect(london.lng, london.lat);
    const [px, py] = projectEquirect(philly.lng, philly.lat);
    expect(lx).toBeGreaterThanOrEqual(b.minX);
    expect(lx).toBeLessThanOrEqual(b.maxX);
    expect(ly).toBeGreaterThanOrEqual(b.minY);
    expect(ly).toBeLessThanOrEqual(b.maxY);
    expect(px).toBeGreaterThanOrEqual(b.minX);
    expect(py).toBeLessThanOrEqual(b.maxY);
    expect(py).toBeGreaterThanOrEqual(b.minY);
  });

  it('gives a single point a regional view (minimum span)', () => {
    const b = box(viewBoxFor([{ lat: 48.86, lng: 2.29 }]));
    expect(b.w).toBeGreaterThanOrEqual(20);
    expect(b.h).toBeGreaterThanOrEqual(20);
    // centred on the point
    const [x, y] = projectEquirect(2.29, 48.86);
    expect(b.minX + b.w / 2).toBeCloseTo(x, 1);
    expect(b.minY + b.h / 2).toBeCloseTo(y, 1);
  });

  it('clamps the box to world bounds near the antimeridian / poles', () => {
    const b = box(viewBoxFor([{ lat: 89, lng: 179 }]));
    expect(b.minX).toBeGreaterThanOrEqual(-180);
    expect(b.maxX).toBeLessThanOrEqual(180);
    expect(b.minY).toBeGreaterThanOrEqual(-90);
    expect(b.maxY).toBeLessThanOrEqual(90);
  });

  it('returns the whole world when given no points', () => {
    expect(box(viewBoxFor([]))).toMatchObject({ minX: -180, minY: -90, w: 360, h: 180 });
  });
});

describe('polygonsToPaths', () => {
  it('projects a Polygon feature collection into SVG path strings', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const paths = polygonsToPaths(fc);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M/);
    expect(paths[0]).toMatch(/Z$/);
    // y is flipped: lat 10 -> y -10
    expect(paths[0]).toContain('10,-10');
  });

  it('handles MultiPolygon geometries', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
              [
                [
                  [5, 5],
                  [6, 5],
                  [6, 6],
                  [5, 5],
                ],
              ],
            ],
          },
        },
      ],
    };
    expect(polygonsToPaths(fc)).toHaveLength(2);
  });
});

describe('quadArc', () => {
  it('bows a quadratic curve perpendicular to the midpoint', () => {
    expect(quadArc([0, 0], [100, 0])).toBe('M0,0 Q50,18 100,0');
  });
});
