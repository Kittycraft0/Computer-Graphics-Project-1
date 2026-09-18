// 9/16/2026
// 🎨✨Web Graphics with p5.js

let sim;
var debug = true;
var allowWallAttractors = false;
var enableCameraShake = false; // Toggle for arcade-style collision impacts

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noiseDetail(6, 0.5); 
  sim = new Simulation(600, 50); 
}

function draw() {
  background(5, 5, 12); 
  
  // INTERACTION: Allows the user to rotate the 3D camera by clicking and dragging
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

// Rodrigues' rotation formula
// Used to inverse-rotate 3D world impacts onto the 2D UV texture map of a spinning planet
function rotateAroundAxis(v, k, theta) {
  let cosT = cos(theta);
  let sinT = sin(theta);
  
  let term1 = p5.Vector.mult(v, cosT);
  let crossKV = k.copy().cross(v);
  let term2 = p5.Vector.mult(crossKV, sinT);
  let dotKV = k.dot(v);
  let term3 = p5.Vector.mult(k, dotKV * (1 - cosT));
  
  return p5.Vector.add(term1, p5.Vector.add(term2, term3));
}

// ==========================================
// CORE SIMULATION CLASS
// ==========================================
class Simulation {
  constructor(boxSize, initialBodies) {
    this.boxSize = boxSize;
    this.G = 5.0; // Gravity constant
    this.score = 0;
    this.showControls = true; 
    this.controlFade = 255;
    this.shake = 0; 
    
    this.bodies = [];
    this.attractors = [];
    this.particles = []; 
    this.hole = new Hole(0, 0, -this.boxSize / 2 + 1, 60);

    this.cam = createCamera();
    this.hud = createGraphics(windowWidth, windowHeight);
    
    this.mouseStartX = 0;
    this.mouseStartY = 0;

    for (let i = 0; i < initialBodies; i++) {
      let m;
      if (i === 0) m = 12; 
      else if (i === 1) m = 6; 
      else if (i === 2) m = 2.5; 
      else if (i === 3) m = 0.8; 
      else {
        m = 0.5 + exp(randomGaussian(0.4, 0.7)); 
        m = constrain(m, 0.5, 20); 
      }
      
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
    // INTERACTION: Process WASD keyboard inputs for the hole
    this.handleHoleMovement();

    if (mouseIsPressed && dist(mouseX, mouseY, this.mouseStartX, this.mouseStartY) > 5) {
        this.showControls = false;
    }
    if (!this.showControls && this.controlFade > 0) {
        this.controlFade -= 5;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead) {
        this.particles.splice(i, 1);
      }
    }

    // INTERACTION: Process player-placed gravity attractors
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

    // INTERACTION (Object-to-Object): Gravity and elastic collisions
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
            
            let deltaV1 = impulse / b1.mass;
            let deltaV2 = impulse / b2.mass;

            b1.applyImpact(normal.copy().mult(-1), deltaV1);
            b2.applyImpact(normal.copy(), deltaV2);

            b1.vel.sub(p5.Vector.div(impulseVec, b1.mass));
            b2.vel.add(p5.Vector.div(impulseVec, b2.mass));

            // Particle Ejecta
            let contactPoint = p5.Vector.lerp(b1.pos, b2.pos, b1.r / (b1.r + b2.r));
            let numParticles = constrain(floor(impulse * 1.5), 5, 30);
            for(let p = 0; p < numParticles; p++) {
                let scatter = p5.Vector.random3D().mult(random(1, 4));
                let pVel = p5.Vector.add(normal.copy().mult(random(-2, 2)), scatter);
                this.particles.push(new Particle(contactPoint.x, contactPoint.y, contactPoint.z, pVel));
            }

            // Calculate shake even if disabled, so we decay it properly
            this.shake = min(this.shake + impulse * 0.4, 25);
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
        this.shake = min(this.shake + 5, 15);
        continue;
      }
      b.checkEdges(this.boxSize);
    }
  }

  render() {
    push(); 
    if (enableCameraShake && this.shake > 0.5) {
      translate(random(-this.shake, this.shake), random(-this.shake, this.shake), random(-this.shake, this.shake));
    }
    // Always decay shake so it doesn't build up endlessly while disabled
    if (this.shake > 0) this.shake *= 0.9;

    ambientLight(25);
    let lightCount = 0;
    
    for (let b of this.bodies) {
      if (b.type === 'sun' && lightCount < 3) { 
        colorMode(HSB, 360, 100, 100);
        pointLight(b.sunHue, b.sunSat, 100, b.pos.x, b.pos.y, b.pos.z);
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
    
    for (let p of this.particles) {
      p.render();
    }
    for (let b of this.bodies) {
      b.renderAtmosphere();
    }
    drawingContext.depthMask(true);

    pop(); // End camera translation matrix

    this.drawHUD();
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

  // INTERACTION: Raycasting from 2D screen to 3D world to place attractors
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
    this.hud.clear();
    
    if (this.controlFade > 0) {
        this.hud.fill(255, this.controlFade);
        this.hud.textSize(24);
        this.hud.textStyle(BOLD);
        this.hud.textAlign(CENTER, BOTTOM);
        this.hud.text("Left Click + Drag to Rotate Camera", width / 2, height - 30);
        this.hud.textAlign(LEFT, BASELINE); 
    }

    if (!debug) return;

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
    
    this.hud.fill(255);
    this.hud.textSize(18); this.hud.textStyle(BOLD);
    this.hud.text(`Score: ${this.score}`, 20, 30);
    this.hud.textSize(14); this.hud.textStyle(NORMAL);
    this.hud.text(`Bodies: ${this.bodies.length}`, 20, 55);
    this.hud.text(`Total E: ${(totKE + totPE).toFixed(2)}`, 20, 80);
    this.hud.text(`Hole: WASD | Attractor: Click`, width - 210, 30);
    this.hud.textSize(12);
    this.hud.text(`Wall Attractors: ${allowWallAttractors ? 'ON' : 'OFF'}`, width - 180, 50);
    this.hud.text(`Camera Shake: ${enableCameraShake ? 'ON' : 'OFF'}`, width - 180, 70);

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
// PARTICLE CLASS 
// ==========================================
class Particle {
    constructor(x, y, z, vel) {
        this.pos = createVector(x, y, z);
        this.vel = vel;
        this.life = random(20, 50);
        this.maxLife = this.life;
        this.size = random(1, 3);
    }
    update() {
        this.pos.add(this.vel);
        this.life--;
    }
    render() {
        push();
        translate(this.pos.x, this.pos.y, this.pos.z);
        noStroke();
        let alpha = map(this.life, 0, this.maxLife, 0, 255);
        fill(255, map(this.life, 0, this.maxLife, 50, 255), 0, alpha);
        box(this.size); 
        pop();
    }
}

// ==========================================
// CRATER CLASS 
// ==========================================
class Crater {
    constructor(u, v, size, initialLife) {
        this.u = u;
        this.v = v;
        this.size = size;
        this.life = initialLife; 
        this.maxLife = initialLife;
        
        this.offsets = [];
        for (let a = 0; a < TWO_PI; a += PI / 4) {
            this.offsets.push(random(0.7, 1.3));
        }
    }
    update() {
        let fadeRate = map(this.size, 5, 30, 1.5, 0.2); 
        this.life -= fadeRate;
    }
    isDead() {
        return this.life <= 0;
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
    this.heat = 0; 
    
    this.spinAxis = p5.Vector.random3D();
    this.spinAngle = random(TWO_PI);
    this.spinRate = random(0.01, 0.04);
    this.craters = []; 

    if (this.mass > 9) this.type = 'sun';
    else if (this.mass > 4) this.type = 'gas_giant';
    else if (this.mass > 1.5) {
      this.type = 'terrestrial';
      let biomeRoll = random();
      if (biomeRoll < 0.25) this.biome = 'earth';
      else if (biomeRoll < 0.50) this.biome = 'mars';
      else if (biomeRoll < 0.70) this.biome = 'venus';
      else if (biomeRoll < 0.85) this.biome = 'ice';
      else this.biome = 'exotic'; 
    } else {
      this.type = 'moon';
    }

    this.texWidth = 256;
    this.texHeight = 128;
    this.baseTex = createGraphics(this.texWidth, this.texHeight);
    this.generateBaseTexture();
    this.tex = createGraphics(this.texWidth, this.texHeight);
  }

  generateBaseTexture() {
    this.baseTex.colorMode(HSB, 360, 100, 100, 100);
    this.baseTex.noStroke();
    let bx = random(1000); let by = random(1000);

    if (this.type === 'sun') {
      let starType = random();
      if (starType < 0.3) { this.sunHue = 0; this.sunSat = 60; } 
      else if (starType < 0.6) { this.sunHue = 35; this.sunSat = 40; } 
      else { this.sunHue = 220; this.sunSat = 20; } 

      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let n = noise(bx + px*0.05, by + py*0.05);
          let b = map(n, 0, 1, 70, 100);
          this.baseTex.fill(this.sunHue, this.sunSat + map(n,0,1,-10,10), b);
          this.baseTex.rect(px, py, 4, 4);
        }
      }

    } else if (this.type === 'gas_giant') {
      let baseHue = random(360); 
      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let turb = noise(bx + px*0.02, by + py*0.04);
          let band = sin((py * 0.15) + (turb * 4.0));
          let hOffset = map(turb, 0, 1, -15, 15);
          let finalHue = (baseHue + hOffset + 360) % 360;
          this.baseTex.fill(finalHue, map(band, -1, 1, 40, 90), map(band, -1, 1, 40, 90));
          this.baseTex.rect(px, py, 4, 4);
        }
      }

    } else if (this.type === 'terrestrial') {
      this.baseTex.colorMode(RGB, 255);
      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let n = noise(bx + px*0.03, by + py*0.03);
          
          if (this.biome === 'earth') {
            if (n < 0.55) this.baseTex.fill(15, 45, 80); 
            else if (n < 0.6) this.baseTex.fill(40, 90, 120); 
            else if (n < 0.8) this.baseTex.fill(60, 90, 40); 
            else this.baseTex.fill(180, 170, 160); 
          } 
          else if (this.biome === 'mars') {
            if (n < 0.4) this.baseTex.fill(120, 50, 30); 
            else if (n < 0.8) this.baseTex.fill(180, 80, 50); 
            else this.baseTex.fill(210, 190, 180); 
          }
          else if (this.biome === 'venus') {
            let vClouds = noise(bx + px*0.05, by + py*0.02);
            let c = map(vClouds, 0, 1, 150, 240);
            this.baseTex.fill(c, c*0.9, c*0.6); 
          }
          else if (this.biome === 'ice') {
            let crack = abs(noise(bx + px*0.05, by + py*0.05) - 0.5);
            if (crack < 0.03) this.baseTex.fill(20, 60, 100); 
            else if (n < 0.6) this.baseTex.fill(160, 200, 220); 
            else this.baseTex.fill(220, 240, 255); 
          }
          else if (this.biome === 'exotic') {
            if (n < 0.5) this.baseTex.fill(0, 255, 150); 
            else if (n < 0.75) this.baseTex.fill(30, 10, 50); 
            else this.baseTex.fill(10, 10, 10); 
          }
          this.baseTex.rect(px, py, 4, 4);

          if (this.biome === 'earth' || this.biome === 'mars' || this.biome === 'exotic') {
            let cloudNoise = noise(bx + 100 + px*0.04, by + 100 + py*0.04);
            if (cloudNoise > 0.6) {
              let alpha = map(cloudNoise, 0.6, 1.0, 0, 200);
              let cR = 255, cG = 255, cB = 255;
              if (this.biome === 'mars') { cR = 200; cG = 180; cB = 160; }
              if (this.biome === 'exotic') { cR = 200; cG = 50; cB = 255; } 
              this.baseTex.fill(cR, cG, cB, alpha);
              this.baseTex.rect(px, py, 4, 4);
            }
          }
        }
      }
    } else { 
      this.baseTex.colorMode(RGB, 255);
      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let n = noise(bx + px*0.08, by + py*0.08);
          let crater = abs(noise(bx + 50 + px*0.1, by + 50 + py*0.1) - 0.5);
          let gray = map(n, 0, 1, 60, 140);
          if (crater < 0.1) gray -= 30; 
          this.baseTex.fill(gray, gray, gray);
          this.baseTex.rect(px, py, 4, 4);
        }
      }
    }
  }

  applyImpact(worldNormal, deltaV) {
    this.heat = constrain(this.heat + deltaV * 40, 0, 255);
    if (this.type === 'gas_giant' || this.type === 'sun') return;

    let localNormal = rotateAroundAxis(worldNormal, this.spinAxis, -this.spinAngle);
    let u = 0.5 - (atan2(localNormal.z, localNormal.x) / TWO_PI);
    let v = 0.5 + (asin(constrain(localNormal.y, -1, 1)) / PI);

    let craterSize = constrain(deltaV * 8, 5, 30); 
    let initialLife = map(craterSize, 5, 30, 300, 800); 

    this.craters.push(new Crater(u, v, craterSize, initialLife));
  }

  drawJaggedShape(gfx, cx, cy, radius, offsets) {
    gfx.beginShape();
    let idx = 0;
    for (let a = 0; a < TWO_PI; a += PI / 4) {
      let r = radius * offsets[idx];
      gfx.vertex(cx + cos(a) * r, cy + sin(a) * r);
      idx++;
    }
    gfx.endShape(CLOSE);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.spinAngle += this.spinRate;
    
    if (this.heat > 0.1) this.heat *= 0.985;
    else this.heat = 0;

    let textureNeedsUpdate = false;
    for (let i = this.craters.length - 1; i >= 0; i--) {
        this.craters[i].update();
        if (this.craters[i].isDead()) this.craters.splice(i, 1);
        textureNeedsUpdate = true;
    }

    if (textureNeedsUpdate || this.craters.length === 0 && frameCount === 1) {
        this.tex.clear();
        this.tex.image(this.baseTex, 0, 0); 
        this.tex.noStroke();
        this.tex.colorMode(RGB, 255);
        
        for (let c of this.craters) {
            let px = c.u * this.texWidth;
            let py = c.v * this.texHeight;
            let alpha = constrain(map(c.life, 0, c.maxLife, 0, 200), 0, 200);
            
            let offsets = [0, -this.texWidth, this.texWidth];
            for(let offsetX of offsets) {
                let drawX = px + offsetX;
                this.tex.fill(15, 10, 10, alpha);
                this.drawJaggedShape(this.tex, drawX, py, c.size * 1.8, c.offsets);
                this.tex.fill(255, 60, 0, alpha * 0.9);
                this.drawJaggedShape(this.tex, drawX, py, c.size * 1.2, c.offsets);
                this.tex.fill(255, 200, 150, alpha);
                this.drawJaggedShape(this.tex, drawX, py, c.size * 0.5, c.offsets);
            }
        }
    }
  }

  checkEdges(bSize) {
    let halfBox = bSize / 2;
    let heatGain = 0;

    if (this.pos.x > halfBox - this.r) { this.pos.x = halfBox - this.r; heatGain = abs(this.vel.x); this.vel.x *= -1; }
    else if (this.pos.x < -halfBox + this.r) { this.pos.x = -halfBox + this.r; heatGain = abs(this.vel.x); this.vel.x *= -1; }
    
    if (this.pos.y > halfBox - this.r) { this.pos.y = halfBox - this.r; heatGain = abs(this.vel.y); this.vel.y *= -1; }
    else if (this.pos.y < -halfBox + this.r) { this.pos.y = -halfBox + this.r; heatGain = abs(this.vel.y); this.vel.y *= -1; }
    
    if (this.pos.z > halfBox - this.r) { this.pos.z = halfBox - this.r; heatGain = abs(this.vel.z); this.vel.z *= -1; }
    else if (this.pos.z < -halfBox + this.r) { this.pos.z = -halfBox + this.r; heatGain = abs(this.vel.z); this.vel.z *= -1; }

    if (heatGain > 0) this.heat = constrain(this.heat + (heatGain * 5), 0, 255);
  }

  renderSolid() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    rotate(this.spinAngle, this.spinAxis);
    noStroke();
    if (this.type === 'sun') emissiveMaterial(this.tex.get(128,64)); 
    texture(this.tex);
    sphere(this.r, 24, 24);
    pop();
  }

  renderAtmosphere() {
    if (this.heat > 1) {
      push();
      translate(this.pos.x, this.pos.y, this.pos.z);
      noStroke();
      fill(255, map(this.heat, 0, 255, 150, 50), 0, this.heat * 0.35); 
      sphere(this.r * 1.05, 16, 16);
      pop();
    }

    if (this.type === 'moon' || this.biome === 'venus') return; 

    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    
    let heatExpansion = map(this.heat, 0, 255, 0, this.r * 0.5);
    let innerR = (this.type === 'sun' ? this.r * 1.3 : this.r * 1.1) + heatExpansion;
    let outerR = (this.type === 'sun' ? this.r * 1.6 : this.r * 1.25) + heatExpansion;
    let baseR, baseG, baseB, baseAlpha;

    if (this.type === 'sun') {
      colorMode(HSB, 360, 100, 100, 100);
      baseR = this.sunHue; baseG = this.sunSat; baseB = 100; baseAlpha = 30;
      colorMode(RGB, 255);
    } else if (this.type === 'gas_giant') {
      baseR = 255; baseG = 255; baseB = 255; baseAlpha = 20;
    } else if (this.type === 'terrestrial') {
      if (this.biome === 'earth') { baseR=80; baseG=150; baseB=255; baseAlpha=35; }
      else if (this.biome === 'mars') { baseR=200; baseG=100; baseB=50; baseAlpha=15; }
      else if (this.biome === 'ice') { baseR=200; baseG=230; baseB=255; baseAlpha=25; }
      else if (this.biome === 'exotic') { baseR=150; baseG=50; baseB=255; baseAlpha=30; }
    }

    if (this.type !== 'sun' && this.heat > 0) {
      let heatFactor = this.heat / 255;
      baseR = lerp(baseR, 255, heatFactor);
      baseG = lerp(baseG, 100, heatFactor);
      baseB = lerp(baseB, 0, heatFactor);
      baseAlpha = lerp(baseAlpha, 80, heatFactor); 
    }

    if (this.type === 'sun') colorMode(HSB, 360, 100, 100, 100);
    fill(baseR, baseG, baseB, baseAlpha * 1.5);
    sphere(innerR, 16, 16);
    fill(baseR, baseG, baseB, baseAlpha * 0.5);
    sphere(outerR, 16, 16);
    if (this.type === 'sun') colorMode(RGB, 255);
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