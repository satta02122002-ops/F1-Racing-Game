/**
 * HUD Manager
 * Updates all on-screen telemetry displays:
 *  - Speedometer (analogue canvas gauge)
 *  - Gear & RPM bar
 *  - Lap timer (current, best, last)
 *  - DRS / ERS indicators
 *  - Throttle / Brake bars
 *  - Mini-map with car dot
 *  - Sector flash messages
 *  - Race finish screen
 */

export class HUD {
  constructor(track) {
    this.track = track;

    // Cache DOM elements
    this.elLap        = document.getElementById('lap-display');
    this.elLapTime    = document.getElementById('lap-time-display');
    this.elBestLap    = document.getElementById('best-lap-display');
    this.elTotalTime  = document.getElementById('total-time-display');
    this.elLastLap    = document.getElementById('last-lap-display');
    this.elPosition   = document.getElementById('position-display');
    this.elStatus     = document.getElementById('race-status');
    this.elSpeedVal   = document.getElementById('speed-value');
    this.elGearNum    = document.getElementById('gear-number');
    this.elRpmBar     = document.getElementById('rpm-bar');
    this.elDRS        = document.getElementById('drs-indicator');
    this.elERS        = document.getElementById('ers-indicator');
    this.elThrottle   = document.getElementById('throttle-bar');
    this.elBrake      = document.getElementById('brake-bar');
    this.elCountdown  = document.getElementById('countdown-display');
    this.elFinish     = document.getElementById('finish-screen');
    this.elFinishStats= document.getElementById('finish-stats');

    // Speedometer canvas
    this.speedoCanvas  = document.getElementById('speedo-canvas');
    this.speedoCtx     = this.speedoCanvas.getContext('2d');

    // Mini map canvas
    this.mapCanvas = document.getElementById('map-canvas');
    this.mapCtx    = this.mapCanvas.getContext('2d');
    this._buildMapBackground();

    // Sector flash timeout
    this._flashTimeout = null;
  }

  // -------------------------------------------------------
  update(physics, race) {
    const kph = Math.abs(physics.speedKPH);

    // Speed
    this.elSpeedVal.textContent = Math.round(kph);

    // Gear
    this.elGearNum.textContent = physics.gear === 0 ? 'R' : (physics.speed < 0.5 && physics.throttle < 0.05 ? 'N' : physics.gear);

    // RPM bar
    this.elRpmBar.style.width = (physics.rpmFraction * 100).toFixed(1) + '%';
    // Change colour as RPM approaches limiter
    if (physics.rpmFraction > 0.92) {
      this.elRpmBar.style.background = '#e10600';
    } else if (physics.rpmFraction > 0.75) {
      this.elRpmBar.style.background = 'linear-gradient(90deg, #00cc44, #ffcc00, #e10600)';
    } else {
      this.elRpmBar.style.background = 'linear-gradient(90deg, #00cc44, #ffcc00)';
    }

    // Pedals
    this.elThrottle.style.width = (physics.throttle * 100).toFixed(1) + '%';
    this.elBrake.style.width    = (physics.brake    * 100).toFixed(1) + '%';

    // DRS / ERS
    this.elDRS.classList.toggle('active', physics.drsActive && physics.drsAvailable);
    this.elERS.classList.toggle('active', physics.ersActive && physics.ersEnergy > 0);

    // Lap info
    if (race) {
      this.elLap.textContent    = `${race.currentLap} / ${race.totalLaps}`;
      this.elLapTime.textContent  = this._fmt(race.lapTime);
      this.elTotalTime.textContent = this._fmt(race.totalTime);
      if (race.bestLap < Infinity) this.elBestLap.textContent = this._fmt(race.bestLap);
      if (race.lastLap) this.elLastLap.textContent = this._fmt(race.lastLap);
    }

    // Speedo gauge
    this._drawSpeedometer(kph);

    // Mini map car dot
    this._updateMiniMap(physics);
  }

  // -------------------------------------------------------
  _drawSpeedometer(kph) {
    const ctx = this.speedoCtx;
    const cx  = 110, cy = 120, r = 95;
    ctx.clearRect(0, 0, 220, 220);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Track arc
    const startAngle = Math.PI * 0.75;
    const endAngle   = Math.PI * 2.25;
    const fraction   = Math.min(kph / 380, 1);
    const needleEnd  = startAngle + fraction * (endAngle - startAngle);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Speed arc
    const gradient = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    gradient.addColorStop(0,   '#00cc44');
    gradient.addColorStop(0.6, '#ffcc00');
    gradient.addColorStop(1,   '#e10600');
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, startAngle, needleEnd);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * (endAngle - startAngle);
      const isMajor = i % 2 === 0;
      const innerR = isMajor ? r - 26 : r - 22;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (r - 2),  cy + Math.sin(angle) * (r - 2));
      ctx.lineTo(cx + Math.cos(angle) * innerR,    cy + Math.sin(angle) * innerR);
      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth   = isMajor ? 2 : 1;
      ctx.stroke();

      if (isMajor) {
        const spd = Math.round((i / 10) * 380);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(spd, cx + Math.cos(angle) * (innerR - 10), cy + Math.sin(angle) * (innerR - 10) + 3);
      }
    }

    // Needle
    const needleAngle = needleEnd;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 20), cy + Math.sin(needleAngle) * (r - 20));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e10600';
    ctx.fill();
  }

  // -------------------------------------------------------
  _buildMapBackground() {
    const ctx  = this.mapCtx;
    const cl   = this.track.centerline;
    const W    = 150, H = 150;

    // Find bounds
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    cl.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    });
    this._mapBounds = { minX, maxX, minZ, maxZ };
    const pad = 10;
    this._mapScale = Math.min(
      (W - pad * 2) / (maxX - minX),
      (H - pad * 2) / (maxZ - minZ)
    );
    this._mapOffX = pad + (W - pad * 2 - (maxX - minX) * this._mapScale) / 2;
    this._mapOffZ = pad + (H - pad * 2 - (maxZ - minZ) * this._mapScale) / 2;

    // Draw static track outline
    this._mapBg = document.createElement('canvas');
    this._mapBg.width  = W;
    this._mapBg.height = H;
    const bgCtx = this._mapBg.getContext('2d');

    bgCtx.fillStyle = '#0a0a0a';
    bgCtx.fillRect(0, 0, W, H);

    bgCtx.beginPath();
    cl.forEach((p, i) => {
      const mx = (p.x - minX) * this._mapScale + this._mapOffX;
      const mz = (p.z - minZ) * this._mapScale + this._mapOffZ;
      if (i === 0) bgCtx.moveTo(mx, mz); else bgCtx.lineTo(mx, mz);
    });
    bgCtx.closePath();
    bgCtx.strokeStyle = '#555';
    bgCtx.lineWidth = 4;
    bgCtx.stroke();

    // Sector colours
    this.track.sectors.forEach((s, si) => {
      const colors = ['#ff4444', '#44aaff', '#44ff88'];
      bgCtx.beginPath();
      for (let i = s.start; i <= s.end && i < cl.length; i++) {
        const p  = cl[i];
        const mx = (p.x - minX) * this._mapScale + this._mapOffX;
        const mz = (p.z - minZ) * this._mapScale + this._mapOffZ;
        if (i === s.start) bgCtx.moveTo(mx, mz); else bgCtx.lineTo(mx, mz);
      }
      bgCtx.strokeStyle = colors[si];
      bgCtx.lineWidth   = 2;
      bgCtx.stroke();
    });

    // Start/finish dot
    const sp = cl[0];
    const sx = (sp.x - minX) * this._mapScale + this._mapOffX;
    const sz = (sp.z - minZ) * this._mapScale + this._mapOffZ;
    bgCtx.beginPath();
    bgCtx.arc(sx, sz, 3, 0, Math.PI * 2);
    bgCtx.fillStyle = '#ffffff';
    bgCtx.fill();
  }

  _updateMiniMap(physics) {
    const ctx = this.mapCtx;
    const W = 150, H = 150;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this._mapBg, 0, 0);

    const { minX, minZ } = this._mapBounds;
    const cx = (physics.x - minX) * this._mapScale + this._mapOffX;
    const cz = (physics.z - minZ) * this._mapScale + this._mapOffZ;

    // Car dot with heading arrow
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(physics.heading);

    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = '#e10600';
    ctx.fill();
    ctx.restore();
  }

  // -------------------------------------------------------
  showCountdown(text, onDone) {
    this.elCountdown.textContent = text;
    this.elCountdown.style.display = 'flex';
    // Remove after animation
    setTimeout(() => {
      this.elCountdown.style.display = 'none';
      if (onDone) onDone();
    }, 900);
  }

  flashSector(sectorName, isPersonalBest, isPurple) {
    if (this._flashTimeout) {
      clearTimeout(this._flashTimeout);
      const old = document.querySelector('.sector-flash');
      if (old) old.remove();
    }
    const div = document.createElement('div');
    div.className = `sector-flash ${isPurple ? 'purple' : isPersonalBest ? 'green' : 'yellow'}`;
    div.textContent = `${sectorName} ${isPurple ? '★ BEST' : isPersonalBest ? '▲ PB' : ''}`;
    document.getElementById('hud').appendChild(div);
    this._flashTimeout = setTimeout(() => div.remove(), 2000);
  }

  showFinishScreen(stats) {
    let html = '';
    html += `<div><span class="stat-label">TOTAL TIME</span><br><span class="stat-value">${this._fmt(stats.totalTime)}</span></div>`;
    html += `<div><span class="stat-label">BEST LAP</span><br><span class="stat-value purple">${this._fmt(stats.bestLap)}</span></div>`;
    html += `<div><span class="stat-label">LAPS COMPLETED</span><br><span class="stat-value">${stats.laps}</span></div>`;
    html += `<div><span class="stat-label">TYRE WEAR</span><br><span class="stat-value">${Math.round(stats.tyreWear * 100)}%</span></div>`;
    this.elFinishStats.innerHTML = html;
    this.elFinish.style.display  = 'flex';
  }

  hideFinishScreen() {
    this.elFinish.style.display = 'none';
  }

  setRaceStatus(text) {
    this.elStatus.textContent = text;
  }

  // -------------------------------------------------------
  _fmt(ms) {
    if (!ms || ms === Infinity) return '--:--.---';
    const total = Math.abs(ms);
    const m   = Math.floor(total / 60000);
    const s   = Math.floor((total % 60000) / 1000);
    const ms_ = Math.floor(total % 1000);
    return `${m}:${String(s).padStart(2,'0')}.${String(ms_).padStart(3,'0')}`;
  }
}
