/**
 * Input Manager
 * Handles keyboard, gamepad input and maps to car controls.
 * Supports:
 *  - WASD / Arrow keys
 *  - Gamepad (Xbox/PS style)
 *  - DRS (E key / RB button)
 *  - ERS (Q key / LB button)
 *  - Camera (C key)
 *  - Reset (R key)
 */

export class InputManager {
  constructor() {
    this.keys = {};
    this.inputs = {
      throttle: 0,
      brake:    0,
      steering: 0,
      drs:      false,
      ers:      false,
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    // Callbacks
    this.onCameraToggle = null;
    this.onReset        = null;
    this.onMapToggle    = null;

    // Gamepad polling
    this._gamepadIndex = null;
    window.addEventListener('gamepadconnected',    e => { this._gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this._gamepadIndex = null; });
  }

  // -------------------------------------------------------
  _onKeyDown(e) {
    this.keys[e.code] = true;
    if (e.code === 'KeyC') this.onCameraToggle?.();
    if (e.code === 'KeyR') this.onReset?.();
    if (e.code === 'KeyM') this.onMapToggle?.();
    // Prevent arrow key scroll
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  // -------------------------------------------------------
  update(dt) {
    // Keyboard
    const kThrottle = this.keys['ArrowUp']    || this.keys['KeyW'] || false;
    const kBrake    = this.keys['ArrowDown']  || this.keys['KeyS'] || false;
    const kLeft     = this.keys['ArrowLeft']  || this.keys['KeyA'] || false;
    const kRight    = this.keys['ArrowRight'] || this.keys['KeyD'] || false;
    const kDRS      = this.keys['KeyE'] || false;
    const kERS      = this.keys['KeyQ'] || false;

    // Smooth throttle / brake (simulate pedal travel)
    const tSpeed = 4; // units per second
    const sSpeed = 3;

    if (kThrottle) {
      this.inputs.throttle = Math.min(1, this.inputs.throttle + dt * tSpeed);
    } else {
      this.inputs.throttle = Math.max(0, this.inputs.throttle - dt * tSpeed * 1.5);
    }

    if (kBrake) {
      this.inputs.brake = Math.min(1, this.inputs.brake + dt * tSpeed);
    } else {
      this.inputs.brake = Math.max(0, this.inputs.brake - dt * tSpeed * 2);
    }

    // Steering with auto-centre
    const targetSteer = kLeft ? -1 : kRight ? 1 : 0;
    this.inputs.steering += (targetSteer - this.inputs.steering) * Math.min(1, dt * sSpeed);
    if (Math.abs(this.inputs.steering) < 0.01) this.inputs.steering = 0;

    this.inputs.drs = kDRS;
    this.inputs.ers = kERS;

    // Gamepad override
    if (this._gamepadIndex !== null) {
      const gp = navigator.getGamepads?.()?.[this._gamepadIndex];
      if (gp) this._readGamepad(gp);
    }
  }

  // -------------------------------------------------------
  _readGamepad(gp) {
    const axes    = gp.axes;
    const buttons = gp.buttons;

    // Right trigger = throttle, Left trigger = brake
    const gpThrottle = buttons[7]?.value ?? 0;
    const gpBrake    = buttons[6]?.value ?? 0;
    const gpSteer    = axes[0] ?? 0;

    if (gpThrottle > 0.05 || gpBrake > 0.05) {
      this.inputs.throttle = gpThrottle;
      this.inputs.brake    = gpBrake;
    }
    if (Math.abs(gpSteer) > 0.05) this.inputs.steering = gpSteer;

    // RB = DRS, LB = ERS
    if (buttons[5]?.pressed) this.inputs.drs = true;
    if (buttons[4]?.pressed) this.inputs.ers = true;

    // Camera Y button
    if (buttons[3]?.pressed && !this._gpCamPressed) {
      this.onCameraToggle?.();
      this._gpCamPressed = true;
    } else if (!buttons[3]?.pressed) {
      this._gpCamPressed = false;
    }
  }

  // -------------------------------------------------------
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
