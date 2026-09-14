// 9/14/2026

var debug = true; 
var allowWallAttractors = false; 

let balls = [];
let attractors = [];
let hole; 
let score = 0; 
const numBalls = 50;
const boxSize = 600;
const G = 5.0; 

let hud; 
let cam; 
let mouseStartX, mouseStartY;
let holeTex;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();
  
  if (debug) {
    hud = createGraphics(windowWidth, windowHeight);
  }
  
  // Generate the Swirling Vortex Hole Texture
  holeTex = createGraphics(128, 128);
  holeTex.background(10, 0, 20); 
  holeTex.noFill();
  for(let i = 0; i < 12; i++) {
    holeTex.stroke(150, 50, 255, 255 - (i * 20));
    holeTex.strokeWeight(3);
    holeTex.circle(64, 64, i * 10 + random(0, 5)); 
  }
  
  // Initialize Gas Giants
  for (let i = 0; i < numBalls; i++) {
    let m = random(2, 8); 
    let x = random(-boxSize / 3, boxSize / 3);
    let y = random(-boxSize / 3, boxSize / 3);
    let z = random(-boxSize / 3, boxSize / 3);
    balls.push(new Ball(x, y, z, m));
  }

  hole = new Hole(0, 0, 80); 
}

function draw() {
  background(5, 5, 10); // Deep space background
  
  let totalKinetic = 0;
  let totalPotential = 0;

  // Cinematic Lighting Setup (Warm main sun, cool blue rim light)
  ambientLight(40);
  directionalLight(255, 240, 220, 1, 0.5, -1);
  directionalLight(50, 80, 150, -1, -0.5, 1);

  orbitControl(2, 2, 0.1); 

  // Draw the custom wireframe box 
  drawWireframeBox(boxSize);

  // 1. Handle user-controlled hole movement
  handleHoleMovement();
  hole.show(); 

  // 2. Process Attractors 
  for (let i = attractors.length - 1; i >= 0; i--) {
    let a = attractors[i];
    a.timer--;
    
    if (a.timer <= 0) {
      attractors.splice(i, 1);
      continue;
    }

    for (let b of balls) {
      let distVec = p5.Vector.sub(a.pos, b.pos);
      let distanceSq = distVec.magSq();
      let d = sqrt(distanceSq);
      
      let distForGravity = max(distanceSq, 100);
      let strength = (G * b.mass * a.mass) / distForGravity;
      let force = distVec.copy().setMag(strength);
      b.applyForce(force);

      if (debug) {
        totalPotential += -(G * b.mass * a.mass) / max(d, 10);
      }
    }
  }

  // 3. Apply Normal Gravity and Collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      let distVec = p5.Vector.sub(balls[j].pos, balls[i].pos);
      let distanceSq = distVec.magSq(); 
      let d = sqrt(distanceSq);

      let distForGravity = max(distanceSq, 100); 
      let strength = (G * balls[i].mass * balls[j].mass) / distForGravity;
      let force = distVec.copy().setMag(strength);
      
      balls[i].applyForce(force);
      balls[j].applyForce(force.copy().mult(-1)); 

      if (debug) {
        totalPotential += -(G * balls[i].mass * balls[j].mass) / max(d, 10);
      }

      // Perfectly Elastic Collisions (Core bouncing)
      let minDist = balls[i].r + balls[j].r;
      if (d < minDist && d > 0) { 
        let overlap = minDist - d;
        let normal = distVec.copy().normalize();
        let correction = normal.copy().mult(overlap / 2);
        balls[i].pos.sub(correction);
        balls[j].pos.add(correction);

        let relativeVelocity = p5.Vector.sub(balls[j].vel, balls[i].vel);
        let velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal < 0) {
          let impulse = -2.0 * velocityAlongNormal; 
          impulse /= (1 / balls[i].mass + 1 / balls[j].mass);

          let impulseVec = normal.copy().mult(impulse);
          balls[i].vel.sub(p5.Vector.div(impulseVec, balls[i].mass));
          balls[j].vel.add(p5.Vector.div(impulseVec, balls[j].mass));
        }
      }
    }
  }

  // 4. Update and Render SOLID Planet Cores
  for (let i = balls.length - 1; i >= 0; i--) {
    let b = balls[i];
    b.update();
    
    if (hole.checkCapture(b)) {
      balls.splice(i, 1);
      score++;
      continue; 
    }

    b.checkEdges(boxSize);
    b.showSolid();
    
    if (debug) {
      totalKinetic += 0.5 * b.mass * b.vel.magSq();
    }
  }

  // 5. Render VOLUMETRIC Atmospheres (2nd Pass)
  // We disable the WebGL depth mask so the transparent gas clouds don't clip each other
  drawingContext.depthMask(false);
  noLights(); // Turn off lights so the atmospheres glow evenly
  for (let b of balls) {
    b.showAtmosphere();
  }
  for (let a of attractors) {
    a.show();
  }
  drawingContext.depthMask(true); // Re-enable for the next frame

  // 6. Render the HUD
  if (debug && hud) {
    let totalEnergy = totalKinetic + totalPotential;
    
    hud.clear();
    hud.fill(255);
    hud.textSize(18);
    hud.textStyle(BOLD);
    hud.text(`Score: ${score}`, 20, 30);
    hud.textSize(14);
    hud.textStyle(NORMAL);
    hud.text(`Balls: ${balls.length}`, 20, 55);
    hud.text(`System Energy`, 20, 80);
    hud.text(`Kinetic: ${totalKinetic.toFixed(2)}`, 20, 105);
    hud.text(`Potential: ${totalPotential.toFixed(2)}`, 20, 125);
    hud.text(`Total: ${totalEnergy.toFixed(2)}`, 20, 150);
    hud.text(`Hole: WASD`, width - 110, 30);
    hud.textSize(12);
    hud.text(`Wall Attractors: ${allowWallAttractors ? 'ON' : 'OFF'}`, width - 150, 50);

    push();
    resetMatrix();
    camera(0, 0, (height / 2.0) / tan(PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
    imageMode(CENTER);
    image(hud, 0, 0);
    pop();
  }
}

function drawWireframeBox(size) {
  let hs = size / 2; 
  
  push();
  stroke(0, 200, 255, 40); // Faded cyan so it doesn't distract from the planets
  strokeWeight(2);
  noFill();
  
  // Front face
  line(-hs, -hs, hs, hs, -hs, hs);
  line(hs, -hs, hs, hs, hs, hs);
  line(hs, hs, hs, -hs, hs, hs);
  line(-hs, hs, hs, -hs, -hs, hs);
  
  // Back face
  line(-hs, -hs, -hs, hs, -hs, -hs);
  line(hs, -hs, -hs, hs, hs, -hs);
  line(hs, hs, -hs, -hs, hs, -hs);
  line(-hs, hs, -hs, -hs, -hs, -hs);
  
  // Connecting lines
  line(-hs, -hs, hs, -hs, -hs, -hs);
  line(hs, -hs, hs, hs, -hs, -hs);
  line(hs, hs, hs, hs, hs, -hs);
  line(-hs, hs, hs, -hs, hs, -hs);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (debug) {
    hud = createGraphics(windowWidth, windowHeight);
  }
}

function handleHoleMovement() {
  let speed = 5;
  if (keyIsDown(65)) hole.moveX(-speed); // A
  if (keyIsDown(68)) hole.moveX(speed);  // D
  if (keyIsDown(87)) hole.moveY(-speed); // W
  if (keyIsDown(83)) hole.moveY(speed);  // S
}

class Hole {
  constructor(x, y, r) {
    this.pos = createVector(x, y, -boxSize / 2 + 1); 
    this.r = r;
  }

  moveX(val) { this.pos.x = constrain(this.pos.x + val, -boxSize/2 + this.r, boxSize/2 - this.r); }
  moveY(val) { this.pos.y = constrain(this.pos.y + val, -boxSize/2 + this.r, boxSize/2 - this.r); }

  checkCapture(ball) {
    if (ball.pos.z - ball.r <= -boxSize / 2 + 5) { 
      let d = dist(ball.pos.x, ball.pos.y, this.pos.x, this.pos.y);
      if (d < this.r) { return true; }
    }
    return false;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    texture(holeTex); 
    circle(0, 0, this.r * 2); 
    pop();
  }
}

function mousePressed() {
  mouseStartX = mouseX;
  mouseStartY = mouseY;
}

function mouseReleased() {
  if (dist(mouseX, mouseY, mouseStartX, mouseStartY) > 5) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  let eye = createVector(cam.eyeX, cam.eyeY, cam.eyeZ);
  let center = createVector(cam.centerX, cam.centerY, cam.centerZ);
  let up = createVector(cam.upX, cam.upY, cam.upZ);

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

  for (let b of balls) {
    let L = p5.Vector.sub(b.pos, eye);
    let tca = L.dot(dir);
    if (tca < 0) continue; 
    
    let d2 = L.dot(L) - tca * tca;
    let r2 = b.r * b.r;
    if (d2 > r2) continue; 
    
    let thc = sqrt(r2 - d2);
    let t0 = tca - thc; 
    
    if (t0 < closestT) {
      closestT = t0;
      hitPoint = p5.Vector.add(eye, p5.Vector.mult(dir, t0));
    }
  }

  if (!hitPoint && allowWallAttractors) {
    let halfBox = boxSize / 2;
    
    let tx1 = (-halfBox - eye.x) / dir.x;
    let tx2 = ( halfBox - eye.x) / dir.x;
    let tmin = max(min(tx1, tx2), -Infinity);
    let tmax = min(max(tx1, tx2), Infinity);

    let ty1 = (-halfBox - eye.y) / dir.y;
    let ty2 = ( halfBox - eye.y) / dir.y;
    tmin = max(tmin, min(ty1, ty2));
    tmax = min(tmax, max(ty1, ty2));

    let tz1 = (-halfBox - eye.z) / dir.z;
    let tz2 = ( halfBox - eye.z) / dir.z;
    tmin = max(tmin, min(tz1, tz2));
    tmax = min(tmax, max(tz1, tz2));

    if (tmax >= tmin && tmax > 0) {
      hitPoint = p5.Vector.add(eye, p5.Vector.mult(dir, tmax));
    }
  }

  if (hitPoint) {
    attractors.push(new Attractor(hitPoint.x, hitPoint.y, hitPoint.z));
  }
}

class Attractor {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.mass = 80; 
    this.r = 25; 
    this.timer = 180; 
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    // Fade out smoothly
    let alpha = map(this.timer, 0, 180, 0, 150);
    fill(255, 50, 50, alpha); 
    // Pulse effect
    sphere(this.r + sin(frameCount * 0.2) * 5, 16, 16); 
    pop();
  }
}

class Ball {
  constructor(x, y, z, m) {
    this.pos = createVector(x, y, z);
    this.vel = p5.Vector.random3D().mult(random(0.1, 0.8));
    this.acc = createVector(0, 0, 0);
    this.mass = m;
    this.r = this.mass * 3.5; 
    
    // GENERATE PROCEDURAL GAS GIANT TEXTURE
    this.baseHue = random(360);
    this.tex = createGraphics(256, 128);
    this.tex.colorMode(HSB, 360, 100, 100);
    this.tex.noStroke();
    
    // Random noise offsets so every planet is completely unique
    let xOffBase = random(1000);
    let yOffBase = random(1000);
    
    for (let py = 0; py < 128; py += 4) {
      for (let px = 0; px < 256; px += 4) {
        // High stretch on Y creates horizontal bands, swirl distorts them into storms
        let swirl = noise(xOffBase + px * 0.05, yOffBase + py * 0.05) * 20;
        let n = noise(xOffBase + px * 0.02, yOffBase + py * 0.1);
        let n2 = noise(xOffBase + px * 0.01, yOffBase + (py + swirl) * 0.05);
        
        let hueVal = (this.baseHue + map(n2, 0, 1, -30, 30)) % 360;
        if (hueVal < 0) hueVal += 360;
        
        let satVal = map(n, 0, 1, 40, 100);
        let briVal = map(n2, 0, 1, 30, 90);
        
        this.tex.fill(hueVal, satVal, briVal);
        this.tex.rect(px, py, 4, 4);
      }
    }
  }

  applyForce(force) {
    let f = p5.Vector.div(force, this.mass);
    this.acc.add(f);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  checkEdges(bSize) {
    let halfBox = bSize / 2;
    let restitution = 1.0; 

    if (this.pos.x > halfBox - this.r) {
      this.pos.x = halfBox - this.r;
      this.vel.x *= -restitution;
    } else if (this.pos.x < -halfBox + this.r) {
      this.pos.x = -halfBox + this.r;
      this.vel.x *= -restitution;
    }

    if (this.pos.y > halfBox - this.r) {
      this.pos.y = halfBox - this.r;
      this.vel.y *= -restitution;
    } else if (this.pos.y < -halfBox + this.r) {
      this.pos.y = -halfBox + this.r;
      this.vel.y *= -restitution;
    }

    if (this.pos.z > halfBox - this.r) {
      this.pos.z = halfBox - this.r;
      this.vel.z *= -restitution;
    } else if (this.pos.z < -halfBox + this.r) {
      this.pos.z = -halfBox + this.r;
      this.vel.z *= -restitution;
    }
  }

  showSolid() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    // Rotate the planet based on its velocity to give it a tumbling spin
    let axis = createVector(this.vel.y, -this.vel.x, 0).normalize();
    if (axis.magSq() > 0) {
      rotate(frameCount * 0.02, axis);
    }

    noStroke();
    texture(this.tex); // Applies the diffuse gas texture
    sphere(this.r, 24, 24); // High detail for the solid core
    pop();
  }

  showAtmosphere() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    
    // Render a slightly larger, transparent halo
    colorMode(HSB, 360, 100, 100, 255);
    fill(this.baseHue, 100, 100, 35); // 35 out of 255 opacity
    sphere(this.r * 1.35, 16, 16); 
    colorMode(RGB, 255);
    pop();
  }
}