// 9/11/2026

const debug = true; // Toggle for HUD and energy calculations

let balls = [];
const numBalls = 50;
const boxSize = 600;
const G = 5.0; // Cranked up the Universal Gravitational Constant
let hud; 

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  
  if (debug) {
    hud = createGraphics(windowWidth, windowHeight);
  }
  
  for (let i = 0; i < numBalls; i++) {
    let m = random(2, 8); 
    let x = random(-boxSize / 3, boxSize / 3);
    let y = random(-boxSize / 3, boxSize / 3);
    let z = random(-boxSize / 3, boxSize / 3);
    balls.push(new Ball(x, y, z, m));
  }
}

function draw() {
  background(15);
  
  let totalKinetic = 0;
  let totalPotential = 0;

  // Lighting setup
  ambientLight(60);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);
  pointLight(200, 200, 200, 0, 0, 200);

  orbitControl(2, 2, 0.1); 

  // Draw the bounding box
  push();
  noFill();
  stroke(100);
  strokeWeight(2);
  box(boxSize);
  pop();

  // Apply Gravity and Perfectly Elastic Collisions
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      let distVec = p5.Vector.sub(balls[j].pos, balls[i].pos);
      let distanceSq = distVec.magSq(); // This is r^2 (Inverse-square law denominator)
      let d = sqrt(distanceSq);

      // 1. GRAVITATIONAL PULL
      // We limit the minimum distance to prevent divide-by-zero math explosions
      let distForGravity = max(distanceSq, 100); 
      let strength = (G * balls[i].mass * balls[j].mass) / distForGravity;
      let force = distVec.copy().setMag(strength);
      
      balls[i].applyForce(force);
      balls[j].applyForce(force.copy().mult(-1)); 

      if (debug) {
        // Potential Energy (U = -G*m1*m2 / r)
        let pe = -(G * balls[i].mass * balls[j].mass) / max(d, 10);
        totalPotential += pe;
      }

      // 2. PERFECTLY ELASTIC COLLISIONS
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
          let restitution = 1.0; 
          let impulse = -(1 + restitution) * velocityAlongNormal;
          impulse /= (1 / balls[i].mass + 1 / balls[j].mass);

          let impulseVec = normal.copy().mult(impulse);
          balls[i].vel.sub(p5.Vector.div(impulseVec, balls[i].mass));
          balls[j].vel.add(p5.Vector.div(impulseVec, balls[j].mass));
        }
      }
    }
  }

  // Update positions and render
  for (let b of balls) {
    b.update();
    b.checkEdges(boxSize);
    b.show();
    
    if (debug) {
      totalKinetic += 0.5 * b.mass * b.vel.magSq();
    }
  }

  // Render the debug text on top of the 3D canvas
  if (debug && hud) {
    let totalEnergy = totalKinetic + totalPotential;
    
    hud.clear();
    hud.fill(255);
    hud.textSize(18);
    hud.textStyle(BOLD);
    hud.text(`System Energy`, 20, 30);
    hud.textSize(14);
    hud.textStyle(NORMAL);
    hud.text(`Kinetic: ${totalKinetic.toFixed(2)}`, 20, 55);
    hud.text(`Potential: ${totalPotential.toFixed(2)}`, 20, 75);
    hud.text(`Total: ${totalEnergy.toFixed(2)}`, 20, 100);

    push();
    resetMatrix();
    // Set an orthographic-style flat camera overlay
    camera(0, 0, (height / 2.0) / tan(PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
    noLights();
    imageMode(CENTER);
    image(hud, 0, 0);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (debug) {
    hud = createGraphics(windowWidth, windowHeight);
  }
}

class Ball {
  constructor(x, y, z, m) {
    this.pos = createVector(x, y, z);
    // Turned down initial velocity significantly (was 1 to 4)
    this.vel = p5.Vector.random3D().mult(random(0.1, 0.8));
    this.acc = createVector(0, 0, 0);
    this.mass = m;
    this.r = this.mass * 3; 
    
    colorMode(HSB, 360, 100, 100);
    this.col = color(random(360), 80, 90);
    colorMode(RGB, 255);
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

  show() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    specularMaterial(this.col);
    shininess(50);
    sphere(this.r, 16, 16); 
    pop();
  }
}