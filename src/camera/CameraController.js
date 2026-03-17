/**
 * Camera Controller
 * Provides 4 cinematic camera modes:
 *  1. Chase Cam   – behind & above (default)
 *  2. Cockpit Cam – driver's eye view
 *  3. TV Cam      – low-angle side follow
 *  4. Helicopter  – overhead
 *
 * All cameras use smooth spring-damper interpolation.
 */

import * as THREE from 'three';


export const CAMERA_MODES = {
  CHASE:      0,
  COCKPIT:    1,
  TV_POD:     2,
  HELICOPTER: 3,
};

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode   = CAMERA_MODES.CHASE;

    // Smooth state
    this._pos    = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._vel    = new THREE.Vector3();

    // Spring constants
    this.posStiffness    = 8;
    this.targetStiffness = 12;

    // TV cam orbit angle
    this._tvAngle = 0;
  }

  // -------------------------------------------------------
  nextMode() {
    this.mode = (this.mode + 1) % 4;
  }

  setMode(m) { this.mode = m; }

  // -------------------------------------------------------
  update(carGroup, physics, dt) {
    const carPos = carGroup.position;
    const heading = physics.heading;

    let desiredPos    = new THREE.Vector3();
    let desiredTarget = new THREE.Vector3();

    switch (this.mode) {
      case CAMERA_MODES.CHASE:
        desiredPos    = this._chasePosition(carPos, heading, physics.speedKPH);
        desiredTarget = this._chaseTarget(carPos, heading);
        break;

      case CAMERA_MODES.COCKPIT:
        desiredPos    = this._cockpitPosition(carPos, heading);
        desiredTarget = this._cockpitTarget(carPos, heading);
        break;

      case CAMERA_MODES.TV_POD:
        desiredPos    = this._tvPosition(carPos, heading, physics.speedKPH);
        desiredTarget = carPos.clone().add(new THREE.Vector3(0, 0.5, 0));
        break;

      case CAMERA_MODES.HELICOPTER:
        desiredPos    = this._heliPosition(carPos);
        desiredTarget = carPos.clone().add(new THREE.Vector3(0, 0.3, 0));
        break;
    }

    // Spring interpolation
    const posStiff    = this.mode === CAMERA_MODES.COCKPIT ? 20 : this.posStiffness;
    const targetStiff = this.mode === CAMERA_MODES.COCKPIT ? 25 : this.targetStiffness;

    this._pos.lerp(desiredPos, Math.min(1, dt * posStiff));
    this._target.lerp(desiredTarget, Math.min(1, dt * targetStiff));

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._target);
  }

  // ---- Chase Camera ----
  _chasePosition(carPos, heading, speedKPH) {
    // Pull further back at high speed
    const dist  = 12 + speedKPH * 0.025;
    const height = 4 + speedKPH * 0.005;
    return new THREE.Vector3(
      carPos.x - Math.sin(heading) * dist,
      carPos.y + height,
      carPos.z - Math.cos(heading) * dist
    );
  }
  _chaseTarget(carPos, heading) {
    return new THREE.Vector3(
      carPos.x + Math.sin(heading) * 6,
      carPos.y + 1.0,
      carPos.z + Math.cos(heading) * 6
    );
  }

  // ---- Cockpit Camera ----
  _cockpitPosition(carPos, heading) {
    return new THREE.Vector3(
      carPos.x + Math.sin(heading) * 0.5,
      carPos.y + 0.65,
      carPos.z + Math.cos(heading) * 0.5
    );
  }
  _cockpitTarget(carPos, heading) {
    return new THREE.Vector3(
      carPos.x + Math.sin(heading) * 25,
      carPos.y + 0.5,
      carPos.z + Math.cos(heading) * 25
    );
  }

  // ---- TV Pod Camera (low side angle) ----
  _tvPosition(carPos, heading, speedKPH) {
    this._tvAngle += 0.004;
    const side = 14;
    return new THREE.Vector3(
      carPos.x + Math.cos(this._tvAngle) * side,
      carPos.y + 2.5,
      carPos.z + Math.sin(this._tvAngle) * side
    );
  }

  // ---- Helicopter Camera ----
  _heliPosition(carPos) {
    return new THREE.Vector3(carPos.x, carPos.y + 60, carPos.z + 10);
  }

  // ---- Teleport for respawn ----
  teleport(carPos, heading) {
    const pos = this._chasePosition(carPos, heading, 0);
    this._pos.copy(pos);
    this.camera.position.copy(pos);
    this._target.copy(this._chaseTarget(carPos, heading));
  }

  get modeName() {
    return ['CHASE', 'COCKPIT', 'TV POD', 'HELI'][this.mode];
  }
}
