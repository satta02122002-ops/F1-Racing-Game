/**
 * F1 Car Physics Engine
 * Simulates realistic F1 car behaviour:
 *  - Weight transfer, tyre slip, downforce, drag
 *  - Gear box with realistic ratios
 *  - DRS & ERS boost
 *  - Tyre wear & grip degradation
 */

export const GEAR_RATIOS = [0, 3.5, 2.5, 1.9, 1.5, 1.2, 1.0, 0.85]; // N + 7 gears
export const FINAL_DRIVE  = 3.6;
export const WHEEL_RADIUS = 0.33; // metres

export class CarPhysics {
  constructor() {
    // --- Dimensions & Mass ---
    this.mass       = 798;   // kg (driver + car, F1 minimum)
    this.wheelbase  = 3.6;   // metres
    this.trackWidth = 1.8;   // metres
    this.cgHeight   = 0.30;  // metres (centre of gravity)
    this.cgFront    = 0.46;  // fraction from front (46/54 weight dist)

    // --- Engine ---
    this.maxRPM       = 15000;
    this.idleRPM      = 5000;
    this.currentRPM   = 5000;
    this.gear         = 1;
    this.gearUpCooldown   = 0;
    this.gearDownCooldown = 0;

    // --- State ---
    this.speed        = 0;    // m/s longitudinal
    this.lateralSpeed = 0;    // m/s lateral (slip)
    this.heading      = 0;    // radians, world yaw
    this.angularVel   = 0;    // rad/s yaw rate
    this.x            = 0;
    this.z            = 0;

    // --- Inputs (0-1 or -1..1) ---
    this.throttle = 0;
    this.brake    = 0;
    this.steering = 0;        // -1 left, +1 right

    // --- Aero ---
    this.downforceCoeff = 3.5;  // higher = more grip at speed
    this.dragCoeff      = 0.8;

    // --- Tyre ---
    this.tyreGrip       = 1.0;  // 0..1
    this.tyreWear       = 0;    // 0..1 (1 = dead)
    this.tyreTemp       = 80;   // °C, optimal ~90-100

    // --- DRS / ERS ---
    this.drsActive    = false;
    this.drsAvailable = false;
    this.ersEnergy    = 1.0;    // 0..1 battery
    this.ersActive    = false;

    // --- Flags ---
    this.isOnTrack  = true;
    this.offTrackTimer = 0;

    // --- Accumulated ---
    this.totalDistance = 0;
    this.lastPosition  = { x: 0, z: 0 };
  }

  // -------------------------------------------------------
  //  Main update — called every frame with dt in seconds
  // -------------------------------------------------------
  update(dt, inputs, onTrack = true) {
    this.throttle = inputs.throttle ?? 0;
    this.brake    = inputs.brake    ?? 0;
    this.steering = inputs.steering ?? 0;
    this.drsActive = inputs.drs     ?? false;
    this.ersActive = inputs.ers     ?? false;

    this.isOnTrack = onTrack;
    if (!onTrack) {
      this.offTrackTimer += dt;
      this.tyreGrip = Math.max(0.3, this.tyreGrip - dt * 0.05);
    } else {
      this.offTrackTimer = Math.max(0, this.offTrackTimer - dt * 2);
    }

    // ERS management
    if (this.ersActive && this.ersEnergy > 0) {
      this.ersEnergy = Math.max(0, this.ersEnergy - dt * 0.06);
    } else if (!this.ersActive && this.brake > 0.1) {
      // Regen under braking
      this.ersEnergy = Math.min(1, this.ersEnergy + dt * 0.04 * this.brake);
    }

    this._updateGearbox(dt);
    this._updateEngine(dt);
    this._updateDynamics(dt);
    this._updateTyres(dt);
    this._integratePosition(dt);
  }

  // -------------------------------------------------------
  _updateGearbox(dt) {
    this.gearUpCooldown   = Math.max(0, this.gearUpCooldown   - dt);
    this.gearDownCooldown = Math.max(0, this.gearDownCooldown - dt);

    // Auto gear shift thresholds
    const upRPM   = 14200;
    const downRPM = 6500;

    if (this.currentRPM > upRPM && this.gear < 7 && this.gearUpCooldown <= 0) {
      this.gear++;
      this.gearUpCooldown = 0.08; // 80ms shift
      this.currentRPM *= 0.72;
    }
    if (this.currentRPM < downRPM && this.gear > 1 && this.gearDownCooldown <= 0 && this.throttle > 0.1) {
      this.gear--;
      this.gearDownCooldown = 0.06;
      this.currentRPM = Math.min(this.maxRPM * 0.9, this.currentRPM * 1.38);
    }
  }

  // -------------------------------------------------------
  _updateEngine(dt) {
    const ratio = GEAR_RATIOS[this.gear] * FINAL_DRIVE;
    const wheelRPM = (Math.abs(this.speed) / (2 * Math.PI * WHEEL_RADIUS)) * 60;
    const targetRPM = wheelRPM * ratio + this.idleRPM;

    // Blend RPM toward drivetrain RPM
    this.currentRPM += (targetRPM - this.currentRPM) * Math.min(1, dt * 18);
    this.currentRPM  = Math.max(this.idleRPM, Math.min(this.maxRPM, this.currentRPM));
  }

  // -------------------------------------------------------
  _updateDynamics(dt) {
    const speedKPH = this.speed * 3.6;
    const absSpeed = Math.abs(this.speed);

    // Downforce increases grip with speed
    const downforce = this.downforceCoeff * (speedKPH / 250) ** 1.6;
    const normalForce = (this.mass * 9.81 + downforce * 1000) / this.mass;

    // --- Longitudinal ---
    const grip = this.tyreGrip * normalForce;

    // Engine torque curve (peak ~10500 RPM)
    const rpmFraction = this.currentRPM / this.maxRPM;
    const torqueCurve = Math.sin(rpmFraction * Math.PI * 0.85) * 0.9 + 0.1;
    const baseEnginePower = 745 * 1000; // ~1000hp in watts
    const engineForce = torqueCurve * baseEnginePower / Math.max(1, absSpeed);

    // DRS reduces drag by ~20% and gives small speed boost
    const drsMultiplier = (this.drsActive && this.drsAvailable && speedKPH > 180) ? 1.22 : 1.0;
    const ersBoost = (this.ersActive && this.ersEnergy > 0) ? 1.15 : 1.0;

    const driveForce   = engineForce * this.throttle * Math.min(1, grip * 0.6) * drsMultiplier * ersBoost;
    const brakeForce   = grip * 28 * this.brake;
    const rollingResist = this.speed * 0.35;
    const aeroDrag     = Math.sign(this.speed) * this.dragCoeff * absSpeed * absSpeed * 0.5
                         * (this.drsActive && this.drsAvailable ? 0.78 : 1.0);

    const offTrackSlow = this.isOnTrack ? 1.0 : 0.25; // massive slowdown off track
    const netForce = (driveForce - brakeForce) * offTrackSlow - rollingResist - aeroDrag;

    const longAccel = netForce / this.mass;
    this.speed += longAccel * dt;
    this.speed  = Math.max(-20, Math.min(105, this.speed)); // ~378 kph max

    // --- Lateral (steering) ---
    const maxSteer = 0.032 * Math.max(0.3, 1 - (speedKPH / 320) * 0.55); // less steering at speed
    const steerAngle = this.steering * maxSteer;

    // Slip angle → lateral grip
    const lateralGrip = grip * this.tyreGrip;
    const centripetal  = (this.speed * this.speed * Math.tan(steerAngle)) / this.wheelbase;
    const maxLateral   = lateralGrip * 18 * (1 + downforce * 0.4);

    // Actual yaw rate clamped by available lateral grip
    const targetYaw = Math.max(-maxLateral, Math.min(maxLateral, centripetal));
    this.angularVel += (targetYaw - this.angularVel) * Math.min(1, dt * 12);
    this.heading += this.angularVel * dt;
  }

  // -------------------------------------------------------
  _updateTyres(dt) {
    const absSpeed = Math.abs(this.speed);
    const load = absSpeed * 0.0002 + Math.abs(this.steering) * 0.0003 + this.throttle * 0.0001;
    this.tyreWear = Math.min(1, this.tyreWear + load * dt);

    // Temperature management (simplified)
    const heatTarget = 80 + this.throttle * 30 + Math.abs(this.steering) * 20;
    this.tyreTemp += (heatTarget - this.tyreTemp) * dt * 0.3;
    this.tyreTemp = Math.max(60, Math.min(135, this.tyreTemp));

    // Optimal temp window 85–110°C
    const tempGrip = this.tyreTemp > 60 && this.tyreTemp < 130
      ? 1 - Math.abs(this.tyreTemp - 97) / 60
      : 0.6;

    // Wear degrades grip after 50%
    const wearGrip = this.tyreWear > 0.5
      ? 1 - (this.tyreWear - 0.5) * 0.8
      : 1.0;

    this.tyreGrip = Math.max(0.3, Math.min(1.0, tempGrip * wearGrip));
  }

  // -------------------------------------------------------
  _integratePosition(dt) {
    const vx = Math.sin(this.heading) * this.speed;
    const vz = Math.cos(this.heading) * this.speed;
    this.x += vx * dt;
    this.z += vz * dt;

    const dx = this.x - this.lastPosition.x;
    const dz = this.z - this.lastPosition.z;
    this.totalDistance += Math.sqrt(dx * dx + dz * dz);
    this.lastPosition = { x: this.x, z: this.z };
  }

  // -------------------------------------------------------
  get speedKPH()   { return this.speed * 3.6; }
  get rpmFraction() { return (this.currentRPM - this.idleRPM) / (this.maxRPM - this.idleRPM); }

  reset(x = 0, z = 0, heading = 0) {
    this.speed       = 0;
    this.lateralSpeed = 0;
    this.heading     = heading;
    this.angularVel  = 0;
    this.x = x; this.z = z;
    this.gear        = 1;
    this.currentRPM  = this.idleRPM;
    this.tyreWear    = 0;
    this.tyreTemp    = 80;
    this.tyreGrip    = 1.0;
    this.ersEnergy   = 1.0;
    this.totalDistance = 0;
    this.lastPosition  = { x, z };
  }
}
