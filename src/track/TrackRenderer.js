/**
 * Track Renderer (Three.js)
 * Builds all visual geometry for the circuit:
 *  - Asphalt surface (extruded track ribbon)
 *  - Kerbs (red/white alternating)
 *  - Barriers (Armco / concrete wall)
 *  - Runoff areas
 *  - Start/Finish line
 *  - Sector markers
 *  - Environment (skybox gradient, grass, sea)
 *  - Track-side buildings (Monaco boxes)
 */

import * as THREE from 'three';
import { TRACK_WIDTH } from './TrackLayout.js';


const KERB_WIDTH    = 1.0;
const BARRIER_H     = 0.8;
const BARRIER_THICK = 0.3;

export class TrackRenderer {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildSurface();
    this._buildKerbs();
    this._buildBarriers();
    this._buildRunoff();
    this._buildStartFinish();
    this._buildEnvironment();
    this._buildSectorMarkers();
    this._buildGrandstand();
  }

  // -------------------------------------------------------
  _buildSurface() {
    const cl  = this.track.centerline;
    const n   = cl.length;
    const hw  = TRACK_WIDTH;

    const verts = [];
    const uvs   = [];
    const idx   = [];

    let vIdx = 0;
    let dist = 0;

    for (let i = 0; i < n; i++) {
      const prev = cl[(i - 1 + n) % n];
      const next = cl[(i + 1) % n];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz =  dx / len;

      if (i > 0) {
        const ddx = cl[i].x - cl[i - 1].x;
        const ddz = cl[i].z - cl[i - 1].z;
        dist += Math.sqrt(ddx * ddx + ddz * ddz);
      }
      const u = dist / 20; // texture repeat every 20m

      verts.push(cl[i].x + nx * hw, 0, cl[i].z + nz * hw);
      verts.push(cl[i].x - nx * hw, 0, cl[i].z - nz * hw);
      uvs.push(0, u, 1, u);

      if (i < n - 1) {
        idx.push(vIdx, vIdx + 1, vIdx + 2);
        idx.push(vIdx + 1, vIdx + 3, vIdx + 2);
      }
      vIdx += 2;
    }

    // close loop
    const last = (n - 1) * 2;
    idx.push(last, last + 1, 0);
    idx.push(last + 1, 1, 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = this._asphaltMaterial();
    this.group.add(new THREE.Mesh(geo, mat));
  }

  // -------------------------------------------------------
  _asphaltMaterial() {
    // Procedural asphalt via canvas texture
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, size, size);

    // Noise grain
    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.5;
      const v = Math.floor(Math.random() * 40 + 20);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // White racing line highlight (centre strip)
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(size * 0.4, 0, size * 0.2, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);

    return new THREE.MeshLambertMaterial({ map: tex, color: 0x444444 });
  }

  // -------------------------------------------------------
  _buildKerbs() {
    const cl  = this.track.centerline;
    const n   = cl.length;
    const hw  = TRACK_WIDTH;
    const kw  = KERB_WIDTH;

    // Alternating red/white 1-metre blocks
    for (let i = 0; i < n; i++) {
      const prev = cl[(i - 1 + n) % n];
      const next = cl[(i + 1) % n];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz =  dx / len;

      // Only place every 3rd point to avoid overdraw
      if (i % 3 !== 0) continue;

      const color = Math.floor(i / 3) % 2 === 0 ? 0xdd2222 : 0xeeeeee;
      const mat   = new THREE.MeshLambertMaterial({ color });

      // Left kerb
      const lx = cl[i].x + nx * (hw + kw / 2);
      const lz = cl[i].z + nz * (hw + kw / 2);
      const lg = new THREE.BoxGeometry(kw * 1.2, 0.06, kw * 1.2);
      const lm = new THREE.Mesh(lg, mat);
      lm.position.set(lx, 0.03, lz);
      this.group.add(lm);

      // Right kerb
      const rx = cl[i].x - nx * (hw + kw / 2);
      const rz = cl[i].z - nz * (hw + kw / 2);
      const rm = new THREE.Mesh(lg.clone(), mat.clone());
      rm.position.set(rx, 0.03, rz);
      this.group.add(rm);
    }
  }

  // -------------------------------------------------------
  _buildBarriers() {
    const cl = this.track.centerline;
    const n  = cl.length;
    const hw = TRACK_WIDTH + KERB_WIDTH + 0.5;

    const leftPts  = [];
    const rightPts = [];

    for (let i = 0; i < n; i++) {
      const prev = cl[(i - 1 + n) % n];
      const next = cl[(i + 1) % n];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz =  dx / len;
      leftPts.push (new THREE.Vector3(cl[i].x + nx * hw, BARRIER_H / 2, cl[i].z + nz * hw));
      rightPts.push(new THREE.Vector3(cl[i].x - nx * hw, BARRIER_H / 2, cl[i].z - nz * hw));
    }

    const makeWall = (pts, color) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segLen = Math.sqrt(dx * dx + dz * dz);
        const angle  = Math.atan2(dx, dz);
        const geo = new THREE.BoxGeometry(BARRIER_THICK, BARRIER_H, segLen);
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((a.x + b.x) / 2, BARRIER_H / 2, (a.z + b.z) / 2);
        mesh.rotation.y = angle;
        this.group.add(mesh);
      }
    };

    makeWall(leftPts,  0xcccccc);
    makeWall(rightPts, 0xcccccc);
  }

  // -------------------------------------------------------
  _buildRunoff() {
    // Wide flat runoff area (green) behind barriers
    const cl = this.track.centerline;
    const n  = cl.length;
    const hw = TRACK_WIDTH + 8;

    const verts = [], uvs = [], idx = [];
    let vIdx = 0;

    for (let i = 0; i < n; i++) {
      const prev = cl[(i - 1 + n) % n];
      const next = cl[(i + 1) % n];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const nx = -dz / len;
      const nz =  dx / len;

      verts.push(cl[i].x + nx * hw, -0.01, cl[i].z + nz * hw);
      verts.push(cl[i].x - nx * hw, -0.01, cl[i].z - nz * hw);
      uvs.push(0, i / 10, 1, i / 10);

      if (i < n - 1) {
        idx.push(vIdx, vIdx + 1, vIdx + 2);
        idx.push(vIdx + 1, vIdx + 3, vIdx + 2);
      }
      vIdx += 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
    this.group.add(new THREE.Mesh(geo, mat));
  }

  // -------------------------------------------------------
  _buildStartFinish() {
    const cl = this.track.centerline;
    const pt = cl[0];
    const pt2 = cl[3];
    const dx = pt2.x - pt.x;
    const dz = pt2.z - pt.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = -dz / len;
    const nz =  dx / len;
    const angle = Math.atan2(dx, dz);

    // Chequered flag line
    const lineGeo = new THREE.PlaneGeometry(TRACK_WIDTH * 2, 2);
    lineGeo.rotateX(-Math.PI / 2);
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width = 256; lineCanvas.height = 32;
    const ctx = lineCanvas.getContext('2d');
    const sq = 16;
    for (let x = 0; x < 256 / sq; x++) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#fff' : '#000';
        ctx.fillRect(x * sq, y * sq, sq, sq);
      }
    }
    const lineTex = new THREE.CanvasTexture(lineCanvas);
    const lineMat = new THREE.MeshLambertMaterial({ map: lineTex, transparent: true, opacity: 0.9 });
    const lineMesh = new THREE.Mesh(lineGeo, lineMat);
    lineMesh.position.set(pt.x, 0.02, pt.z);
    lineMesh.rotation.y = angle;
    this.group.add(lineMesh);

    // Gantry poles
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    [-1, 1].forEach(side => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(pt.x + nx * TRACK_WIDTH * side, 4, pt.z + nz * TRACK_WIDTH * side);
      this.group.add(pole);
    });
    const crossGeo = new THREE.BoxGeometry(TRACK_WIDTH * 2 + 2, 0.3, 0.3);
    const cross = new THREE.Mesh(crossGeo, poleMat);
    cross.position.set(pt.x, 8.1, pt.z);
    cross.rotation.y = angle;
    this.group.add(cross);
  }

  // -------------------------------------------------------
  _buildEnvironment() {
    // Ground plane (sea/harbour)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x0e4b6e })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this.group.add(ground);

    // Ambient lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    // Directional sun
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.2);
    sun.position.set(200, 500, 300);
    sun.castShadow = false;
    this.scene.add(sun);

    // Fill light (sky bounce)
    const fill = new THREE.DirectionalLight(0x8ab4d9, 0.4);
    fill.position.set(-200, 200, -200);
    this.scene.add(fill);
  }

  // -------------------------------------------------------
  _buildSectorMarkers() {
    const cl = this.track.centerline;
    const sectorColors = [0xff4444, 0x44aaff, 0x44ff88];

    this.track.sectors.forEach((sector, si) => {
      const pt = cl[sector.start];
      if (!pt) return;
      const geo = new THREE.BoxGeometry(0.5, 2, TRACK_WIDTH * 2 + 2);
      const mat = new THREE.MeshLambertMaterial({ color: sectorColors[si], transparent: true, opacity: 0.6 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pt.x, 1, pt.z);
      this.group.add(mesh);
    });
  }

  // -------------------------------------------------------
  _buildGrandstand() {
    // Simple coloured boxes to represent grandstands along the main straight
    const positions = [
      { x: -300, z: -120, w: 150, d: 20, h: 12, color: 0xcc3333 },
      { x: -100, z: -120, w: 150, d: 20, h: 10, color: 0x3355cc },
      { x:  100, z: -120, w: 100, d: 15, h: 8,  color: 0x33aa55 },
    ];

    positions.forEach(p => {
      const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const mat = new THREE.MeshLambertMaterial({ color: p.color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x, p.h / 2, p.z);
      this.group.add(mesh);

      // Roof stripe
      const roofGeo = new THREE.BoxGeometry(p.w, 0.5, p.d + 0.5);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(p.x, p.h + 0.25, p.z);
      this.group.add(roof);
    });

    // Lamp posts along the straight
    for (let x = -380; x <= 180; x += 40) {
      const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 10, 6);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 5, -95);
      this.group.add(pole);

      const lampGeo = new THREE.SphereGeometry(0.3, 8, 8);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 10.3, -95);
      this.group.add(lamp);
    }
  }
}
