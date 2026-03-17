/**
 * Track Layout Generator
 * Builds a Monaco-inspired circuit using cubic Bézier curves.
 * Returns:
 *  - centerline points (array of {x,z})
 *  - sector definitions
 *  - start/finish line
 *  - DRS zones
 */

// ---- Bézier helpers ----
function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }; }

function cubicBezier(p0, p1, p2, p3, t) {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const ab = lerp(a, b, t);
  const bc = lerp(b, c, t);
  return lerp(ab, bc, t);
}

function sampleBezier(p0, p1, p2, p3, steps = 20) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(cubicBezier(p0, p1, p2, p3, i / steps));
  return pts;
}

// ---- Track definition (Monaco-inspired, scaled to ~3.5 km) ----
// Control points in metres, centred at origin
const SEGMENTS = [
  // Segment 0 – Start/Finish straight (Anthony Noghès direction)
  { pts: [{x:-400,z:-80},{x:-200,z:-80},{x:0,z:-80},{x:200,z:-80}], steps:30 },

  // Segment 1 – Sainte Dévote (right hairpin)
  { pts: [{x:200,z:-80},{x:340,z:-80},{x:380,z:-60},{x:380,z:40}], steps:20 },

  // Segment 2 – Beau Rivage climb
  { pts: [{x:380,z:40},{x:380,z:160},{x:340,z:200},{x:260,z:220}], steps:25 },

  // Segment 3 – Massenet (long right)
  { pts: [{x:260,z:220},{x:100,z:240},{x:-80,z:240},{x:-200,z:200}], steps:30 },

  // Segment 4 – Casino Square left
  { pts: [{x:-200,z:200},{x:-300,z:160},{x:-340,z:80},{x:-340,z:-20}], steps:20 },

  // Segment 5 – Mirabeau (fast sweeper)
  { pts: [{x:-340,z:-20},{x:-340,z:-100},{x:-300,z:-160},{x:-220,z:-200}], steps:20 },

  // Segment 6 – Loews hairpin (slowest)
  { pts: [{x:-220,z:-200},{x:-80,z:-240},{x:80,z:-240},{x:180,z:-210}], steps:25 },

  // Segment 7 – Portier
  { pts: [{x:180,z:-210},{x:280,z:-170},{x:320,z:-120},{x:320,z:-80}], steps:18 },

  // Segment 8 – Tunnel entry
  { pts: [{x:320,z:-80},{x:320,z:0},{x:280,z:60},{x:200,z:80}], steps:20 },

  // Segment 9 – Chicane (swimming pool)
  { pts: [{x:200,z:80},{x:80,z:90},{x:-40,z:70},{x:-140,z:20}], steps:20 },

  // Segment 10 – Rascasse (slow hairpin)
  { pts: [{x:-140,z:20},{x:-280,z:-10},{x:-380,z:-40},{x:-400,z:-80}], steps:20 },
];

export const TRACK_WIDTH = 12; // metres each side → 12m total (real F1 ~7-15m)

// ---- Build flat centerline array ----
function buildCenterline() {
  const pts = [];
  for (const seg of SEGMENTS) {
    const [p0, p1, p2, p3] = seg.pts;
    const samples = sampleBezier(p0, p1, p2, p3, seg.steps);
    // avoid duplicating the join point
    for (let i = pts.length === 0 ? 0 : 1; i < samples.length; i++) {
      pts.push(samples[i]);
    }
  }
  return pts;
}

// ---- Compute normals for width ----
function buildTrackGeometry(centerline) {
  const left  = [];
  const right = [];
  const n = centerline.length;

  for (let i = 0; i < n; i++) {
    const prev = centerline[(i - 1 + n) % n];
    const next = centerline[(i + 1) % n];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    // perpendicular
    const nx = -dz / len;
    const nz =  dx / len;
    left.push ({x: centerline[i].x + nx * TRACK_WIDTH, z: centerline[i].z + nz * TRACK_WIDTH});
    right.push({x: centerline[i].x - nx * TRACK_WIDTH, z: centerline[i].z - nz * TRACK_WIDTH});
  }
  return { left, right };
}

// ---- Sector markers (indices into centerline) ----
// Three sectors, roughly equal length
function buildSectors(n) {
  return [
    { name: 'S1', start: 0,             end: Math.floor(n * 0.33), color: '#ff4444' },
    { name: 'S2', start: Math.floor(n * 0.33), end: Math.floor(n * 0.66), color: '#44aaff' },
    { name: 'S3', start: Math.floor(n * 0.66), end: n - 1,         color: '#44ff88' },
  ];
}

// ---- DRS zone: the main straight ----
function buildDRSZones(n) {
  return [
    { start: Math.floor(n * 0.90), end: Math.floor(n * 0.06), label: 'DRS ZONE' },
  ];
}

// ---- Closest point on track (for collision/minimap) ----
export function closestPointOnTrack(px, pz, centerline) {
  let minDist = Infinity;
  let minIdx  = 0;
  for (let i = 0; i < centerline.length; i++) {
    const dx = centerline[i].x - px;
    const dz = centerline[i].z - pz;
    const d  = dx * dx + dz * dz;
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return { idx: minIdx, dist: Math.sqrt(minDist) };
}

// ---- Main export ----
export class TrackLayout {
  constructor() {
    this.centerline = buildCenterline();
    const geom = buildTrackGeometry(this.centerline);
    this.leftEdge  = geom.left;
    this.rightEdge = geom.right;
    this.sectors   = buildSectors(this.centerline.length);
    this.drsZones  = buildDRSZones(this.centerline.length);

    // Start/finish position (first point)
    this.startPos = { ...this.centerline[0] };
    this.startHeading = this._computeHeading(0);

    // Lap distance checkpoints
    this._buildDistanceTable();
  }

  _computeHeading(idx) {
    const n = this.centerline.length;
    const a = this.centerline[idx];
    const b = this.centerline[(idx + 3) % n];
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  _buildDistanceTable() {
    this.distTable = [0];
    let total = 0;
    const n = this.centerline.length;
    for (let i = 1; i < n; i++) {
      const dx = this.centerline[i].x - this.centerline[i - 1].x;
      const dz = this.centerline[i].z - this.centerline[i - 1].z;
      total += Math.sqrt(dx * dx + dz * dz);
      this.distTable.push(total);
    }
    this.totalLength = total;
  }

  /** Returns progress 0..1 around the lap */
  lapProgress(idx) {
    return this.distTable[idx] / this.totalLength;
  }

  /** Check if world point is on the tarmac */
  isOnTrack(px, pz) {
    const { dist } = closestPointOnTrack(px, pz, this.centerline);
    return dist <= TRACK_WIDTH * 1.25; // some tolerance
  }

  /** Which sector index (0,1,2) is the car in */
  getSector(trackIdx) {
    for (let i = 0; i < this.sectors.length; i++) {
      if (trackIdx >= this.sectors[i].start && trackIdx <= this.sectors[i].end) return i;
    }
    return 0;
  }

  /** Is car in a DRS zone */
  inDRSZone(trackIdx) {
    for (const z of this.drsZones) {
      if (z.start < z.end) {
        if (trackIdx >= z.start && trackIdx <= z.end) return true;
      } else {
        if (trackIdx >= z.start || trackIdx <= z.end) return true;
      }
    }
    return false;
  }
}
