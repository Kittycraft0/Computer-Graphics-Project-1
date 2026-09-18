// Rodrigues' rotation formula
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
// PARTICLE CLASS (Debris generated from collisions)
// ==========================================
class Particle {
    constructor(x, y, z, vel) {
        this.pos = createVector(x, y, z);
        this.vel = vel;
        this.life = random(10, 30);
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
    
    // We now just use one texture and bake impacts directly into it!
    this.tex = createGraphics(this.texWidth, this.texHeight);
    this.generateTexture();
  }

  generateTexture() {
    this.tex.colorMode(HSB, 360, 100, 100, 100);
    this.tex.noStroke();
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
          this.tex.fill(this.sunHue, this.sunSat + map(n,0,1,-10,10), b);
          this.tex.rect(px, py, 4, 4);
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
          this.tex.fill(finalHue, map(band, -1, 1, 40, 90), map(band, -1, 1, 40, 90));
          this.tex.rect(px, py, 4, 4);
        }
      }
    } else if (this.type === 'terrestrial') {
      this.tex.colorMode(RGB, 255);
      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let n = noise(bx + px*0.03, by + py*0.03);
          
          if (this.biome === 'earth') {
            if (n < 0.55) this.tex.fill(15, 45, 80); 
            else if (n < 0.6) this.tex.fill(40, 90, 120); 
            else if (n < 0.8) this.tex.fill(60, 90, 40); 
            else this.tex.fill(180, 170, 160); 
          } 
          else if (this.biome === 'mars') {
            if (n < 0.4) this.tex.fill(120, 50, 30); 
            else if (n < 0.8) this.tex.fill(180, 80, 50); 
            else this.tex.fill(210, 190, 180); 
          }
          else if (this.biome === 'venus') {
            let vClouds = noise(bx + px*0.05, by + py*0.02);
            let c = map(vClouds, 0, 1, 150, 240);
            this.tex.fill(c, c*0.9, c*0.6); 
          }
          else if (this.biome === 'ice') {
            let crack = abs(noise(bx + px*0.05, by + py*0.05) - 0.5);
            if (crack < 0.03) this.tex.fill(20, 60, 100); 
            else if (n < 0.6) this.tex.fill(160, 200, 220); 
            else this.tex.fill(220, 240, 255); 
          }
          else if (this.biome === 'exotic') {
            if (n < 0.5) this.tex.fill(0, 255, 150); 
            else if (n < 0.75) this.tex.fill(30, 10, 50); 
            else this.tex.fill(10, 10, 10); 
          }
          this.tex.rect(px, py, 4, 4);

          // Render volumetric clouds
          if (this.biome === 'earth' || this.biome === 'mars' || this.biome === 'exotic') {
            let cloudNoise = noise(bx + 100 + px*0.04, by + 100 + py*0.04);
            if (cloudNoise > 0.6) {
              let alpha = map(cloudNoise, 0.6, 1.0, 0, 200);
              let cR = 255, cG = 255, cB = 255;
              if (this.biome === 'mars') { cR = 200; cG = 180; cB = 160; }
              if (this.biome === 'exotic') { cR = 200; cG = 50; cB = 255; } 
              this.tex.fill(cR, cG, cB, alpha);
              this.tex.rect(px, py, 4, 4);
            }
          }
        }
      }
    } else { 
      this.tex.colorMode(RGB, 255);
      for (let py = 0; py < this.texHeight; py+=4) {
        for (let px = 0; px < this.texWidth; px+=4) {
          let n = noise(bx + px*0.08, by + py*0.08);
          let crater = abs(noise(bx + 50 + px*0.1, by + 50 + py*0.1) - 0.5);
          let gray = map(n, 0, 1, 60, 140);
          if (crater < 0.1) gray -= 30; 
          this.tex.fill(gray, gray, gray);
          this.tex.rect(px, py, 4, 4);
        }
      }
    }
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

  // Bakes craters directly into the texture once, eliminating lag
  applyImpact(worldNormal, deltaV) {
    this.heat = constrain(this.heat + deltaV * 40, 0, 255);
    if (this.type === 'gas_giant' || this.type === 'sun') return;

    let localNormal = rotateAroundAxis(worldNormal, this.spinAxis, -this.spinAngle);
    let u = 0.5 - (atan2(localNormal.z, localNormal.x) / TWO_PI);
    let v = 0.5 + (asin(constrain(localNormal.y, -1, 1)) / PI);
    let craterSize = constrain(deltaV * 8, 5, 30); 

    let offsets = [];
    for (let a = 0; a < TWO_PI; a += PI / 4) offsets.push(random(0.7, 1.3));

    this.tex.noStroke();
    this.tex.colorMode(RGB, 255);
    
    // Draw across the seams
    let seamOffsets = [0, -this.texWidth, this.texWidth];
    for(let offsetX of seamOffsets) {
        let drawX = (u * this.texWidth) + offsetX;
        let py = v * this.texHeight;
        
        // 1. Semi-transparent dark scorch (stacks nicely)
        this.tex.fill(10, 5, 5, 120); 
        this.drawJaggedShape(this.tex, drawX, py, craterSize * 1.8, offsets);
        
        // 2. Additive glowing magma (Brightens intersections!)
        this.tex.blendMode(ADD);
        this.tex.fill(255, 60, 0, 100);
        this.drawJaggedShape(this.tex, drawX, py, craterSize * 1.2, offsets);
        this.tex.fill(255, 200, 150, 120);
        this.drawJaggedShape(this.tex, drawX, py, craterSize * 0.5, offsets);
        this.tex.blendMode(BLEND); // Reset
    }
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.spinAngle += this.spinRate;
    
    if (this.heat > 0.1) this.heat *= 0.985;
    else this.heat = 0;
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