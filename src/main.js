/**
 * F1 Racing Game - Main Entry Point
 * Bootstraps Three.js, initialises all systems, runs the game loop.
 */

import * as THREE from 'three';

import { CarPhysics }      from './physics/CarPhysics.js';
import { CarRenderer }     from './car/CarRenderer.js';
import { TrackLayout }     from './track/TrackLayout.js';
import { TrackRenderer }   from './track/TrackRenderer.js';
import { CameraController, CAMERA_MODES } from './camera/CameraController.js';
import { HUD }             from './ui/HUD.js';
import { InputManager }    from './utils/InputManager.js';
import { RaceManager, RACE_STATE } from './utils/RaceManager.js';

class F1Game {
  constructor() {
    this._setupRenderer();
    this._setupScene();
    this._setupSystems();
    this._setupCallbacks();
    this._startCountdown();

    window.game = this;
    this._loop  = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // -------------------------------------------------------
  _setupRenderer() {
    this.canvas   = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setClearColor(0x87CEEB); // sky blue

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // -------------------------------------------------------
  _setupScene() {
    this.scene  = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0008);

    this.camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.2,
      3000
    );

    // Sky gradient background
    this._buildSkybox();
  }

  // -------------------------------------------------------
  _buildSkybox() {
    // Simple sky hemisphere
    const skyGeo = new THREE.SphereGeometry(1500, 16, 16);
    skyGeo.scale(-1, 1, 1); // invert
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 1; skyCanvas.height = 256;
    const ctx = skyCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0,   '#1a3a6b');
    grad.addColorStop(0.4, '#5b9bd5');
    grad.addColorStop(1,   '#c9e8f7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.wrapT = THREE.ClampToEdgeWrapping;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Sun disc
    const sunGeo = new THREE.CircleGeometry(30, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff8cc });
    const sun    = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(400, 600, -800);
    this.scene.add(sun);
  }

  // -------------------------------------------------------
  _setupSystems() {
    // Track
    this.track        = new TrackLayout();
    this.trackRenderer = new TrackRenderer(this.scene, this.track);

    // Car
    this.physics = new CarPhysics();
    this.carRenderer = new CarRenderer(this.scene);

    // Place car at start
    const sp = this.track.startPos;
    const sh = this.track.startHeading;
    this.physics.reset(sp.x, sp.z, sh);
    this.carRenderer.setPosition(sp.x, sp.z, sh);

    // Camera
    this.camCtrl = new CameraController(this.camera);
    this.camCtrl.teleport(this.carRenderer.group.position, sh);

    // HUD
    this.hud = new HUD(this.track);

    // Input
    this.input = new InputManager();

    // Race
    this.race = new RaceManager(this.track, 3);

    // Timing
    this._lastTime  = performance.now();
    this._isRunning = false;
  }

  // -------------------------------------------------------
  _setupCallbacks() {
    // Camera cycle
    this.input.onCameraToggle = () => {
      this.camCtrl.nextMode();
    };

    // Reset / Respawn
    this.input.onReset = () => this._respawn();

    // Race events
    this.race.onLapComplete = (lap, time, isBest) => {
      if (isBest) this.hud.flashSector('LAP ' + (lap - 1), true, true);
    };

    this.race.onSectorComplete = (name, time, isPB, isPurple) => {
      this.hud.flashSector(name, isPB, isPurple);
    };

    this.race.onRaceFinish = (stats) => {
      stats.tyreWear = this.physics.tyreWear;
      this.hud.showFinishScreen(stats);
      this.hud.setRaceStatus('FINISHED');
      this._isRunning = false;
    };
  }

  // -------------------------------------------------------
  _startCountdown() {
    const sequence = ['3', '2', '1', 'GO!'];
    let i = 0;
    const next = () => {
      if (i >= sequence.length) {
        this.race.start();
        this._isRunning = true;
        this.hud.setRaceStatus('RACING');
        return;
      }
      this.hud.showCountdown(sequence[i++], next);
    };

    // Show loading screen while we set up, then start countdown
    this._simulateLoading(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('game-container').style.display = 'block';
      setTimeout(next, 300);
    });
  }

  _simulateLoading(onDone) {
    const bar   = document.getElementById('loading-bar');
    const label = document.getElementById('loading-text');
    const steps = [
      [10,  'Loading Track Geometry...'],
      [30,  'Building Car Model...'],
      [55,  'Initialising Physics...'],
      [75,  'Setting Up HUD...'],
      [90,  'Preparing Race...'],
      [100, 'Ready!'],
    ];
    let s = 0;
    const tick = () => {
      if (s >= steps.length) { setTimeout(onDone, 200); return; }
      bar.style.width  = steps[s][0] + '%';
      label.textContent = steps[s][1];
      s++;
      setTimeout(tick, 200);
    };
    tick();
  }

  // -------------------------------------------------------
  _respawn() {
    const sp = this.track.startPos;
    const sh = this.track.startHeading;
    this.physics.reset(sp.x, sp.z, sh);
    this.carRenderer.setPosition(sp.x, sp.z, sh);
    this.camCtrl.teleport(this.carRenderer.group.position, sh);
  }

  restart() {
    this.hud.hideFinishScreen();
    this.race.reset();
    this._respawn();
    this._isRunning = false;
    this.hud.setRaceStatus('READY');
    setTimeout(() => this._startCountdown(), 100);
  }

  // -------------------------------------------------------
  _loop(now) {
    requestAnimationFrame(this._loop);

    const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap at 50ms
    this._lastTime = now;

    if (!this._isRunning) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Input
    this.input.update(dt);

    // Physics
    const onTrack = this.track.isOnTrack(this.physics.x, this.physics.z);
    this.physics.update(dt, this.input.inputs, onTrack);

    // Race state
    this.race.update(dt, this.physics);

    // 3D update
    this.carRenderer.update(this.physics, dt);
    this.camCtrl.update(this.carRenderer.group, this.physics, dt);

    // HUD
    this.hud.update(this.physics, this.race);

    // Render
    this.renderer.render(this.scene, this.camera);
  }
}

// ---- Boot ----
new F1Game();
