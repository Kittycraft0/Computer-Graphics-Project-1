// 9/14/2026

let sim;
var debug = true;
var allowWallAttractors = false;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  // Increase global noise detail for more fractal, realistic textures
  noiseDetail(6, 0.5);
  sim = new Simulation(600, 50); 
}

function draw() {
  background(5, 5, 12); 

  orbitControl(2, 2, 0.1);

  sim.update();
  sim.render();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (sim) sim.resizeHUD();
}

function mousePressed() {
  sim.handleMousePress();
}

function mouseReleased() {
  sim.handleMouseRelease();
}

// ==========================================
// CORE SIMULATION CLASS
// ==========================================
class Simulation {
  constructor(boxSize, initialBodies) {
    this.boxSize = boxSize;
    this.G = 5.0;
    this.score = 0;
    
    this.bodies = [];
    this.attractors = [];
    this.hole = new Hole(0, 0, -this.boxSize / 2 + 1, 60);

    this.cam = createCamera();
    this.hud = createGraphics(windowWidth, windowHeight);
    
    this.mouseStartX = 0;
    this.mouseStartY = 0;

    for (let i = 0; i < initialBodies; i++) {
      let m = 0.5 + exp(randomGaussian(0.4, 0.7)); 
      m = constrain(m, 0.5, 20); 
      
      let x = random(-this.boxSize / 3, this.boxSize / 3);
      let y = random(-this.boxSize / 3, this.boxSize / 3);
      let z = random(-this.boxSize / 3, this.boxSize / 3);
      this.bodies.push(new CelestialBody(x, y, z, m));
    }
  }

  resizeHUD() {
    this.hud = createGraphics(windowWidth, windowHeight);
  }

  update() {
    this.handleHoleMovement();

    for (let i = this.attractors.length - 1; i >= 0; i--) {
      let a = this.attractors[i];
      a.update();
      if (a.isDead) {
        this.attractors.splice(i, 1);
        continue;
      }
      for (let b of this.bodies) {
        a.applyGravity(b, this.G);
      }
    }

    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        let b1 = this.bodies[i];
        let b2 = this.bodies[j];

        let distVec = p5.Vector.sub(b2.pos, b1.pos);
        let distSq = distVec.magSq();
        let d = sqrt(distSq);
        let distForGravity = max(distSq, 100);
        let strength = (this.G * b1.mass * b2.mass) / distForGravity;
        let force = distVec.copy().setMag(strength);
        
        b1.applyForce(force);
        b2.applyForce(force.copy().mult(-1));

        let minDist = b1.r + b2.r;
        if (d < minDist && d > 0) {
          let overlap = minDist - d;
          let normal = distVec.copy().normalize();
          let correction = normal.copy().mult(overlap / 2);
          b1.pos.sub(correction);
          b2.pos.add(correction);

          let relativeVel = p5.Vector.sub(b2.vel, b1.vel);
          let velAlongNormal = relativeVel.dot(normal);

          if (velAlongNormal < 0) {
            let impulse = -2.0 * velAlongNormal;
            impulse /= (1 / b1.mass + 1 / b2.mass);
            let impulseVec = normal.copy().mult(impulse);
            b1.vel.sub(p5.Vector.div(impulseVec, b1.mass));
            b2.vel.add(p5.Vector.div(impulseVec, b2.mass));
          }
        }
      }
    }

    for (let i = this.bodies.length - 1; i >= 0; i--) {
      let b = this.bodies[i];
      b.update();
      if (this.hole.checkCapture(b, this.boxSize)) {
        this.bodies.splice(i, 1);
        this.score++;
        continue;
      }
      b.checkEdges(this.boxSize);
    }
  }

  render() {
    ambientLight(25);
    let lightCount = 0;
    for (let b of this.bodies) {
      if (b.type === 'sun' && lightCount < 3) { 
        // Sun light color matches its generated texture color
        colorMode(HSB, 360, 100, 100);
        let lx = b.pos.x; let ly = b.pos.y; let lz = b.pos.z;
        pointLight(b.sunHue, b.sunSat, 100, lx, ly, lz);
        colorMode(RGB, 255);
        lightCount++;
      }
    }
    
    if (lightCount === 0) {
      directionalLight(220, 215, 210, 1, 0.5, -1);
    }

    pointLight(150, 50, 255, this.hole.pos.x, this.hole.pos.y, this.hole.pos.z + 50);

    this.drawWireframeBox();
    this.hole.render();

    for (let b of this.bodies) {
      b.renderSolid();
    }
    for (let a of this.attractors) {
      a.render();
    }

    drawingContext.depthMask(false);
    noLights();
    for (let b of this.bodies) {
      b.renderAtmosphere();
    }
    drawingContext.depthMask(true);

    if (debug) {
      this.drawHUD();
    }
  }

  drawWireframeBox() {
    let hs = this.boxSize / 2;
    push();
    stroke(80, 100, 150, 60); 
    strokeWeight(1);
    noFill();
    
    line(-hs, -hs, hs, hs, -hs, hs);
    line(hs, -hs, hs, hs, hs, hs);
    line(hs, hs, hs, -hs, hs, hs);
    line(-hs, hs, hs, -hs, -hs, hs);
    
    line(-hs, -hs, -hs, hs, -hs, -hs);
    line(hs, -hs, -hs, hs, hs, -hs);
    line(hs, hs, -hs, -hs, hs, -hs);
    line(-hs, hs, -hs, -hs, -hs, -hs);
    
    line(-hs, -hs, hs, -hs, -hs, -hs);
    line(hs, -hs, hs, hs, -hs, -hs);
    line(hs, hs, hs, hs, hs, -hs);
    line(-hs, hs, hs, -hs, hs, -hs);
    pop();
  }

  handleHoleMovement() {
    let speed = 5;
    if (keyIsDown(65)) this.hole.moveX(-speed, this.boxSize);
    if (keyIsDown(68)) this.hole.moveX(speed, this.boxSize);
    if (keyIsDown(87)) this.hole.moveY(-speed, this.boxSize);
    if (keyIsDown(83)) this.hole.moveY(speed, this.boxSize);
  }

  handleMousePress() {
    this.mouseStartX = mouseX;
    this.mouseStartY = mouseY;
  }

  handleMouseRelease() {
    if (dist(mouseX, mouseY, this.mouseStartX, this.mouseStartY) > 5) return;
    
    let eye = createVector(this.cam.eyeX, this.cam.eyeY, this.cam.eyeZ);
    let center = createVector(this.cam.centerX, this.cam.centerY, this.cam.centerZ);
    let up = createVector(this.cam.upX, this.cam.upY, this.cam.upZ);

    let F = p5.Vector.sub(center, eye).normalize();
    let R = F.copy().cross(up).normalize();
    let U = R.copy().cross(F).normalize();

    let d = (height / 2) / tan(PI / 6);
    let P = p5.Vector.add(eye, p5.Vector.mult(F, d));
    P.add(p5.Vector.mult(R, mouseX - width / 2));
    P.add(p5.Vector.mult(U, mouseY - height / 2));

    let dir = p5.Vector.sub(P, eye).normalize();

    let hitPoint = null;
    let closestT = Infinity;

    for (let b of this.bodies) {
      let L = p5.Vector.sub(b.pos, eye);
      let tca = L.dot(dir);
      if (tca < 0) continue;
      
      let d2 = L.dot(L) - tca * tca;
      if (d2 > b.r * b.r) continue;
      
      let t0 = tca - sqrt(b.r * b.r - d2);
      if (t0 < closestT) {
        closestT = t0;
        hitPoint = p5.Vector.add(eye, p5.Vector.mult(dir, t0));
      }
    }

    if (!hitPoint && allowWallAttractors) {
      let hs = this.boxSize / 2;
      let tx1 = (-hs - eye.x) / dir.x; let tx2 = (hs - eye.x) / dir.x;
      let tmin = max(min(tx1, tx2), -Infinity); let tmax = min(max(tx1, tx2), Infinity);
      let ty1 = (-hs - eye.y) / dir.y; let ty2 = (hs - eye.y) / dir.y;
      tmin = max(tmin, min(ty1, ty2)); tmax = min(tmax, max(ty1, ty2));
      let tz1 = (-hs - eye.z) / dir.z; let tz2 = (hs - eye.z) / dir.z;
      tmin = max(tmin, min(tz1, tz2)); tmax = min(tmax, max(tz1, tz2));

      if (tmax >= tmin && tmax > 0) {
        hitPoint = p5.Vector.add(eye, p5.Vector.mult(dir, tmax));
      }
    }

    if (hitPoint) {
      this.attractors.push(new Attractor(hitPoint.x, hitPoint.y, hitPoint.z));
    }
  }

  drawHUD() {
    let totKE = 0; let totPE = 0;
    for (let i = 0; i < this.bodies.length; i++) {
      let bi = this.bodies[i];
      totKE += 0.5 * bi.mass * bi.vel.magSq();
      for (let j = i + 1; j < this.bodies.length; j++) {
        let bj = this.bodies[j];
        let d = max(10, p5.Vector.dist(bi.pos, bj.pos));
        totPE += -(this.G * bi.mass * bj.mass) / d;
      }
    }
    
    this.hud.clear();
    this.hud.fill(255);
    this.hud.textSize(18); this.hud.textStyle(BOLD);
    this.hud.text(`Score: ${this.score}`, 20, 30);
    this.hud.textSize(14); this.hud.textStyle(NORMAL);
    this.hud.text(`Bodies: ${this.bodies.length}`, 20, 55);
    this.hud.text(`Total E: ${(totKE + totPE).toFixed(2)}`, 20, 80);
    this.hud.text(`Hole: WASD | Attractor: Click`, width - 210, 30);
    this.hud.textSize(12);
    this.hud.text(`Wall Attractors: ${allowWallAttractors ? 'ON' : 'OFF'}`, width - 180, 50);

    push();
    resetMatrix();
    camera(0, 0, (height / 2.0) / tan(PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
    noLights(); imageMode(CENTER); image(this.hud, 0, 0);
    pop();
  }
}

// ==========================================
// BASE ENTITY CLASS
// ==========================================
class Entity {
  constructor(x, y, z, m) {
    this.pos = createVector(x, y, z);
    this.vel = createVector(0, 0, 0);
    this.acc = createVector(0, 0, 0);
    this.mass = m;
  }
  applyForce(force) {
    this.acc.add(p5.Vector.div(force, this.mass));
  }
}

// ==========================================
// CELESTIAL BODY CLASS
// ==========================================
class CelestialBody extends Entity {
  constructor(x, y, z, m) {
    super(x, y, z, m);
    
    this.r = Math.cbrt(this.mass) * 12; 
    this.vel = p5.Vector.random3D().mult(random(0.1, 0.8));
    
    if (this.mass > 9) {
      this.type = 'sun';
    } else if (this.mass > 4) {
      this.type = 'gas_giant';
    } else if (this.mass > 1.5) {
      this.type = 'terrestrial';
      let biomeRoll = random();
      if (biomeRoll < 0.3) this.biome = 'earth';
      else if (biomeRoll < 0.6) this.biome = 'mars';
      else if (biomeRoll < 0.8) this.biome = 'venus';
      else this.biome = 'ice';
    } else {
      this.type = 'moon';
    }

    this.tex = createGraphics(256, 128);
    this.generateTexture();
  }

  generateTexture() {
    this.tex.colorMode(HSB, 360, 100, 100, 100);
    this.tex.noStroke();
    let bx = random(1000); let by = random(1000);

    if (this.type === 'sun') {
      // Realistic Stellar Blackbody Spectrum
      let starType = random();
      if (starType < 0.3) { this.sunHue = 0; this.sunSat = 60; } // Red Dwarf
      else if (starType < 0.6) { this.sunHue = 35; this.sunSat = 40; } // G-Type (Yellow/White)
      else { this.sunHue = 220; this.sunSat = 20; } // Blue/White Giant

      for (let py = 0; py < 128; py+=4) {
        for (let px = 0; px < 256; px+=4) {
          let n = noise(bx + px*0.05, by + py*0.05);
          let b = map(n, 0, 1, 70, 100);
          this.tex.fill(this.sunHue, this.sunSat + map(n,0,1,-10,10), b);
          this.tex.rect(px, py, 4, 4);
        }
      }

    } else if (this.type === 'gas_giant') {
      // Realistic Gas Giants: Jovian (Brown/Red/Cream) or Neptunian (Blue/Cyan)
      let isJovian = random() > 0.5;
      let baseHue = isJovian ? random(15, 45) : random(180, 220);
      let satMult = isJovian ? random(0.4, 0.7) : random(0.6, 0.9); // Jovians are less saturated

      for (let py = 0; py < 128; py+=4) {
        for (let px = 0; px < 256; px+=4) {
          // Combination of turbulence and sine-wave banding
          let turb = noise(bx + px*0.02, by + py*0.04);
          let band = sin((py * 0.15) + (turb * 4.0));
          
          let hOffset = map(turb, 0, 1, -15, 15);
          let s = map(band, -1, 1, 30, 90) * satMult;
          let b = map(band, -1, 1, 40, 90);
          
          let finalHue = (baseHue + hOffset + 360) % 360;
          this.tex.fill(finalHue, s, b);
          this.tex.rect(px, py, 4, 4);
        }
      }

    } else if (this.type === 'terrestrial') {
      this.tex.colorMode(RGB, 255);
      for (let py = 0; py < 128; py+=4) {
        for (let px = 0; px < 256; px+=4) {
          let n = noise(bx + px*0.03, by + py*0.03);
          
          // SURFACE PASS
          if (this.biome === 'earth') {
            if (n < 0.55) this.tex.fill(15, 45, 80); // Deep, realistic dark ocean
            else if (n < 0.6) this.tex.fill(40, 90, 120); // Shallows
            else if (n < 0.8) this.tex.fill(60, 90, 40); // Muted green/brown land
            else this.tex.fill(180, 170, 160); // Muted mountains
          } 
          else if (this.biome === 'mars') {
            if (n < 0.4) this.tex.fill(120, 50, 30); // Darker basalt/iron
            else if (n < 0.8) this.tex.fill(180, 80, 50); // Muted rust dunes
            else this.tex.fill(210, 190, 180); // CO2 poles
          }
          else if (this.biome === 'venus') {
            // Venus is entirely cloud-covered, so we bake the clouds directly
            let vClouds = noise(bx + px*0.05, by + py*0.02);
            let c = map(vClouds, 0, 1, 150, 240);
            this.tex.fill(c, c*0.9, c*0.6); // Sickly yellow/white
          }
          else if (this.biome === 'ice') {
            let crack = abs(noise(bx + px*0.05, by + py*0.05) - 0.5);
            if (crack < 0.03) this.tex.fill(20, 60, 100); // Deep blue sub-surface water cracks
            else if (n < 0.6) this.tex.fill(160, 200, 220); // Old ice
            else this.tex.fill(220, 240, 255); // Fresh snow/ice
          }
          this.tex.rect(px, py, 4, 4);

          // CLOUD PASS (Overlays white noise on Earth/Mars)
          if (this.biome === 'earth' || this.biome === 'mars') {
            let cloudNoise = noise(bx + 100 + px*0.04, by + 100 + py*0.04);
            if (cloudNoise > 0.6) {
              let alpha = map(cloudNoise, 0.6, 1.0, 0, 200);
              let cColor = this.biome === 'earth' ? 255 : 200; // Earth has white clouds, Mars has dusty clouds
              this.tex.fill(cColor, cColor, cColor, alpha);
              this.tex.rect(px, py, 4, 4);
            }
          }
        }
      }

    } else { 
      // MOONS - High contrast cratering
      this.tex.colorMode(RGB, 255);
      for (let py = 0; py < 128; py+=4) {
        for (let px = 0; px < 256; px+=4) {
          let n = noise(bx + px*0.08, by + py*0.08);
          // Abs trick to make crater-like ridges
          let crater = abs(noise(bx + 50 + px*0.1, by + 50 + py*0.1) - 0.5);
          let gray = map(n, 0, 1, 60, 140);
          if (crater < 0.1) gray -= 30; // Darker impact zones
          
          this.tex.fill(gray, gray, gray);
          this.tex.rect(px, py, 4, 4);
        }
      }
    }
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  checkEdges(bSize) {
    let halfBox = bSize / 2;
    if (this.pos.x > halfBox - this.r) { this.pos.x = halfBox - this.r; this.vel.x *= -1; }
    else if (this.pos.x < -halfBox + this.r) { this.pos.x = -halfBox + this.r; this.vel.x *= -1; }
    if (this.pos.y > halfBox - this.r) { this.pos.y = halfBox - this.r; this.vel.y *= -1; }
    else if (this.pos.y < -halfBox + this.r) { this.pos.y = -halfBox + this.r; this.vel.y *= -1; }
    if (this.pos.z > halfBox - this.r) { this.pos.z = halfBox - this.r; this.vel.z *= -1; }
    else if (this.pos.z < -halfBox + this.r) { this.pos.z = -halfBox + this.r; this.vel.z *= -1; }
  }

  renderSolid() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    let axis = createVector(this.vel.y, -this.vel.x, 0).normalize();
    if (axis.magSq() > 0) rotate(frameCount * 0.02, axis);

    noStroke();
    if (this.type === 'sun') {
      emissiveMaterial(this.tex.get(128,64)); 
    }
    texture(this.tex);
    sphere(this.r, 24, 24);
    pop();
  }

  renderAtmosphere() {
    if (this.type === 'moon' || this.biome === 'venus') return; // Venus clouds are baked in, Moons have none

    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    
    if (this.type === 'sun') {
      colorMode(HSB, 360, 100, 100, 100);
      fill(this.sunHue, this.sunSat, 100, 30);
      sphere(this.r * 1.5, 16, 16);
      colorMode(RGB, 255);
    } else if (this.type === 'gas_giant') {
      fill(255, 255, 255, 25); // Subtle white haze over the vibrant clouds
      sphere(this.r * 1.25, 16, 16);
    } else if (this.type === 'terrestrial') {
      if (this.biome === 'earth') fill(80, 150, 255, 45); // Classic atmospheric scattering
      else if (this.biome === 'mars') fill(200, 100, 50, 20); // Very thin dust
      else if (this.biome === 'ice') fill(200, 230, 255, 30); // Frigid haze
      
      sphere(this.r * 1.15, 16, 16);
    }
    pop();
  }
}

// ==========================================
// TARGET HOLE CLASS
// ==========================================
class Hole extends Entity {
  constructor(x, y, z, r) {
    super(x, y, z, Infinity); 
    this.r = r;
  }

  moveX(val, boxSize) { this.pos.x = constrain(this.pos.x + val, -boxSize/2 + this.r, boxSize/2 - this.r); }
  moveY(val, boxSize) { this.pos.y = constrain(this.pos.y + val, -boxSize/2 + this.r, boxSize/2 - this.r); }

  checkCapture(b, boxSize) {
    if (b.pos.z - b.r <= -boxSize / 2 + 5) {
      if (dist(b.pos.x, b.pos.y, this.pos.x, this.pos.y) < this.r) return true;
    }
    return false;
  }

  render() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    noStroke();
    fill(0);
    plane(this.r * 1.8);

    strokeWeight(1);
    noFill();
    
    push();
    rotateZ(frameCount * 0.05);
    stroke(100, 200, 255, 150);
    torus(this.r, 2, 16, 3);
    pop();

    push();
    rotateZ(-frameCount * 0.03);
    stroke(200, 100, 255, 150);
    torus(this.r * 0.8, 1, 12, 3);
    pop();
    
    pop();
  }
}

// ==========================================
// ATTRACTOR CLASS
// ==========================================
class Attractor extends Entity {
  constructor(x, y, z) {
    super(x, y, z, 80);
    this.timer = 180;
    this.isDead = false;
  }

  update() {
    this.timer--;
    if (this.timer <= 0) this.isDead = true;
  }

  applyGravity(body, G) {
    let distVec = p5.Vector.sub(this.pos, body.pos);
    let distSq = distVec.magSq();
    let strength = (G * body.mass * this.mass) / max(distSq, 100);
    body.applyForce(distVec.copy().setMag(strength));
  }

  render() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotateX(frameCount * 0.1);
    rotateY(frameCount * 0.1);
    
    noFill();
    stroke(0, 255, 255, map(this.timer, 0, 180, 0, 255));
    strokeWeight(2);
    sphere(15, 4, 2); 
    pop();
  }
}