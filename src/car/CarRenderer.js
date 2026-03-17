/**
 * F1 Car 3D Model (Three.js procedural mesh)
 * Builds a stylized but recognisable open-wheel F1 car:
 *  - Monocoque chassis
 *  - Sidepods
 *  - Front / rear wings with DRS flap
 *  - Suspension / wheels
 *  - Halo cockpit protection
 *  - Team livery (Red Bull-inspired)
 */

import * as THREE from 'three';


const BODY_COLOR   = 0x1a3a6b;  // dark blue (main)
const ACCENT_COLOR = 0xffcc00;  // yellow accent
const WING_COLOR   = 0xcccccc;
const WHEEL_COLOR  = 0x111111;
const HALO_COLOR   = 0xd4af37;  // gold

export class CarRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildChassis();
    this._buildSidepods();
    this._buildFrontWing();
    this._buildRearWing();
    this._buildWheels();
    this._buildHalo();
    this._buildCockpit();
    this._buildExhaust();

    // Shadow plane under car
    const shadowGeo = new THREE.PlaneGeometry(4.5, 2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, 0.01, 0);
    this.group.add(shadow);

    // DRS flap reference
    this._drsFlap = this._rearWingFlap;
  }

  // -------------------------------------------------------
  _mat(color, emissive = 0x000000) {
    return new THREE.MeshLambertMaterial({ color, emissive });
  }

  // -------------------------------------------------------
  _buildChassis() {
    const mat = this._mat(BODY_COLOR);

    // Main tub (tapered nose cone)
    const nosePath = new THREE.Shape();
    nosePath.moveTo(0, 0.2);
    nosePath.lineTo(0.5, 0.35);
    nosePath.lineTo(0.5, -0.1);
    nosePath.lineTo(0, -0.05);

    const extSettings = { depth: 4.2, bevelEnabled: false };
    // Use a box approximation instead for simplicity
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.45, 4.2);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.set(0, 0.22, 0);
    this.group.add(body);

    // Nose cone (pointed)
    const noseGeo = new THREE.CylinderGeometry(0.01, 0.35, 1.4, 12);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, this._mat(0x888888));
    nose.position.set(0, 0.18, -2.8);
    this.group.add(nose);

    // Engine cover hump
    const humpGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.6, 12);
    humpGeo.rotateX(Math.PI / 2);
    const hump = new THREE.Mesh(humpGeo, this._mat(BODY_COLOR));
    hump.position.set(0, 0.55, 0.8);
    hump.scale.y = 0.6;
    this.group.add(hump);

    // Air intake
    const intakeGeo = new THREE.BoxGeometry(0.22, 0.28, 0.6);
    const intake = new THREE.Mesh(intakeGeo, this._mat(0x111111));
    intake.position.set(0, 0.7, -0.6);
    this.group.add(intake);

    // Accent stripe
    const stripeGeo = new THREE.BoxGeometry(0.72, 0.06, 4.0);
    const stripe = new THREE.Mesh(stripeGeo, this._mat(ACCENT_COLOR));
    stripe.position.set(0, 0.46, 0);
    this.group.add(stripe);

    // Floor/plank
    const floorGeo = new THREE.BoxGeometry(1.5, 0.06, 3.8);
    const floor = new THREE.Mesh(floorGeo, this._mat(0x111111));
    floor.position.set(0, 0.03, 0.1);
    this.group.add(floor);
  }

  // -------------------------------------------------------
  _buildSidepods() {
    const mat = this._mat(BODY_COLOR);
    [-1, 1].forEach(side => {
      const geo = new THREE.BoxGeometry(0.35, 0.4, 1.8);
      const pod = new THREE.Mesh(geo, mat);
      pod.position.set(side * 0.52, 0.2, 0.5);
      this.group.add(pod);

      // Cooling louvers
      for (let i = 0; i < 4; i++) {
        const louverGeo = new THREE.BoxGeometry(0.04, 0.12, 0.25);
        const louver = new THREE.Mesh(louverGeo, this._mat(0x222222));
        louver.position.set(side * 0.71, 0.28, 0.2 + i * 0.28);
        this.group.add(louver);
      }
    });
  }

  // -------------------------------------------------------
  _buildFrontWing() {
    const mat = this._mat(WING_COLOR);

    // Main plane
    const mainGeo = new THREE.BoxGeometry(1.9, 0.06, 0.5);
    const main = new THREE.Mesh(mainGeo, mat);
    main.position.set(0, 0.08, -2.55);
    this.group.add(main);

    // End plates
    [-1, 1].forEach(side => {
      const epGeo = new THREE.BoxGeometry(0.06, 0.22, 0.52);
      const ep = new THREE.Mesh(epGeo, mat);
      ep.position.set(side * 0.97, 0.16, -2.55);
      this.group.add(ep);
    });

    // Upper flap (closer to nose)
    const flapGeo = new THREE.BoxGeometry(1.5, 0.05, 0.3);
    const flap = new THREE.Mesh(flapGeo, this._mat(BODY_COLOR));
    flap.position.set(0, 0.14, -2.42);
    this.group.add(flap);

    // Nose pillar
    const pillarGeo = new THREE.BoxGeometry(0.12, 0.14, 0.15);
    const pillar = new THREE.Mesh(pillarGeo, this._mat(0x888888));
    pillar.position.set(0, 0.15, -2.55);
    this.group.add(pillar);
  }

  // -------------------------------------------------------
  _buildRearWing() {
    const mat = this._mat(BODY_COLOR);

    // Main plane
    const mainGeo = new THREE.BoxGeometry(1.3, 0.07, 0.45);
    const main = new THREE.Mesh(mainGeo, mat);
    main.position.set(0, 0.85, 2.0);
    this.group.add(main);

    // DRS movable flap
    const flapGeo = new THREE.BoxGeometry(1.3, 0.06, 0.22);
    this._rearWingFlap = new THREE.Mesh(flapGeo, this._mat(ACCENT_COLOR));
    this._rearWingFlap.position.set(0, 0.94, 2.11);
    this.group.add(this._rearWingFlap);

    // End plates
    [-1, 1].forEach(side => {
      const epGeo = new THREE.BoxGeometry(0.07, 0.38, 0.55);
      const ep = new THREE.Mesh(epGeo, mat);
      ep.position.set(side * 0.68, 0.75, 2.0);
      this.group.add(ep);
    });

    // Rear wing pillars
    [-1, 1].forEach(side => {
      const pilGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.58, 6);
      const pil = new THREE.Mesh(pilGeo, mat);
      pil.position.set(side * 0.3, 0.58, 2.04);
      this.group.add(pil);
    });

    // Beam wing
    const beamGeo = new THREE.BoxGeometry(0.9, 0.05, 0.28);
    const beam = new THREE.Mesh(beamGeo, mat);
    beam.position.set(0, 0.52, 1.88);
    this.group.add(beam);
  }

  // -------------------------------------------------------
  _buildWheels() {
    this.wheels = [];
    const positions = [
      { x: -0.85, y: 0.33, z: -1.7, isFront: true  },
      { x:  0.85, y: 0.33, z: -1.7, isFront: true  },
      { x: -0.90, y: 0.33, z:  1.55, isFront: false },
      { x:  0.90, y: 0.33, z:  1.55, isFront: false },
    ];

    const tyreMat  = new THREE.MeshLambertMaterial({ color: WHEEL_COLOR });
    const rimMat   = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const logoMat  = new THREE.MeshLambertMaterial({ color: 0xff3300 });

    positions.forEach((p, i) => {
      const wheelGroup = new THREE.Group();

      // Tyre
      const tyreGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.32, 20);
      tyreGeo.rotateZ(Math.PI / 2);
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      wheelGroup.add(tyre);

      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 20);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      // Brake disc glow colour
      const discGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.36, 12);
      discGeo.rotateZ(Math.PI / 2);
      this['_brakeDisc' + i] = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0x222222 }));
      wheelGroup.add(this['_brakeDisc' + i]);

      // Pirelli logo stripe
      const logoGeo = new THREE.BoxGeometry(0.345, 0.06, 0.02);
      const logo = new THREE.Mesh(logoGeo, logoMat);
      logo.position.set(0, 0, 0.165);
      wheelGroup.add(logo);

      // Suspension arm
      const armGeo = new THREE.CylinderGeometry(0.03, 0.03, p.x < 0 ? -p.x * 0.8 : p.x * 0.8, 6);
      armGeo.rotateZ(Math.PI / 2);
      const arm = new THREE.Mesh(armGeo, new THREE.MeshLambertMaterial({ color: 0x555555 }));
      arm.position.set(p.x * 0.4, 0, 0);
      wheelGroup.add(arm);

      wheelGroup.position.set(p.x, p.y, p.z);
      this.group.add(wheelGroup);
      this.wheels.push({ group: wheelGroup, isFront: p.isFront, baseZ: p.z });
    });
  }

  // -------------------------------------------------------
  _buildHalo() {
    const mat = this._mat(HALO_COLOR);

    // Halo arch (left + right + top bar)
    const archGeo = new THREE.TorusGeometry(0.42, 0.055, 8, 20, Math.PI);
    const arch = new THREE.Mesh(archGeo, mat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.x = Math.PI / 2;
    arch.position.set(0, 0.62, -0.45);
    this.group.add(arch);

    // Centre pillar
    const cPilGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8);
    const cPil = new THREE.Mesh(cPilGeo, mat);
    cPil.position.set(0, 0.82, -0.32);
    cPil.rotation.x = 0.15;
    this.group.add(cPil);
  }

  // -------------------------------------------------------
  _buildCockpit() {
    // Visor / headrest
    const visorGeo = new THREE.BoxGeometry(0.38, 0.22, 0.55);
    const visor = new THREE.Mesh(visorGeo, new THREE.MeshLambertMaterial({
      color: 0x22aaff, transparent: true, opacity: 0.7
    }));
    visor.position.set(0, 0.56, -0.5);
    this.group.add(visor);

    // Headrest
    const headGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.28, 10);
    const head = new THREE.Mesh(headGeo, this._mat(0xffd700));
    head.position.set(0, 0.6, -0.25);
    head.rotation.x = 0.3;
    this.group.add(head);
  }

  // -------------------------------------------------------
  _buildExhaust() {
    const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8);
    const exhaustMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0, 0.44, 2.22);
    exhaust.rotation.x = Math.PI / 2 + 0.15;
    this.group.add(exhaust);
  }

  // -------------------------------------------------------
  /** Call every frame with current physics state */
  update(physics, dt) {
    // Position & heading
    this.group.position.set(physics.x, 0, physics.z);
    this.group.rotation.y = physics.heading;

    // Wheel rotation (rolling)
    const wheelCirc = 2 * Math.PI * 0.33;
    const rotDelta  = (physics.speed * dt) / wheelCirc * (Math.PI * 2);

    this.wheels.forEach((w, i) => {
      w.group.rotation.x = (w.group.rotation.x || 0) + rotDelta;

      // Front wheel steering
      if (w.isFront) {
        w.group.rotation.y = physics.steering * 0.38;
      }
    });

    // DRS flap animation
    if (this._rearWingFlap) {
      const targetAngle = physics.drsActive && physics.drsAvailable ? -0.4 : 0;
      this._rearWingFlap.rotation.x += (targetAngle - this._rearWingFlap.rotation.x) * 0.15;
    }

    // Brake disc glow
    const brakeIntensity = physics.brake;
    for (let i = 0; i < 4; i++) {
      const disc = this['_brakeDisc' + i];
      if (disc) {
        const r = Math.floor(brakeIntensity * 200);
        const g = Math.floor(brakeIntensity * 60);
        disc.material.color.setRGB(r / 255, g / 255, 0);
      }
    }

    // Body lean on steering (visual only)
    this.group.rotation.z = -physics.steering * 0.025;
  }

  setPosition(x, z, heading) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
  }
}
