// 9/14/2026

const debug = true; // Toggle for HUD and energy calculations

let balls = [];
let attractors = [];
let hole; // The movable goal
let score = 0; // Capture count
const numBalls = 50;
const boxSize = 600;
const G = 5.0; 

let hud; 
let cam; // We need to track the camera explicitly to cast 3D rays from it
let mouseStartX, mouseStartY;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();
  
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

  // Create the movable goal "hole"
  hole = new Hole(0, 0, 0, 50); // Position (0,0,0), radius 50
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

  // 1. Handle user-controlled hole movement
  handleHoleMovement();
  hole.show(); // Display the hole

  // 2. Process Attractors (Player Interactions)
  for (let i = attractors.length - 1; i >= 0; i--) {
    let a = attractors[i];
    a.timer--;
    
    if (a.timer <= 0) {
      attractors.splice(i, 1);
      continue;
    }

    // Apply attractor gravity to balls
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
  for (let i = balls.length - 1; i >= 0; i--) {
    // Check for capture by the hole
    if (hole.checkCapture(balls[i])) {
      balls.splice(i, 1);
      score++;
      continue;
    }

    let bi = balls[i];

    // Interact with other balls (gravity, collisions)
    for (let j = i - 1; j >= 0; j--) {
      let bj = balls[j];
      let distVec = p5.Vector.sub(bj.pos, bi.pos);
      let distanceSq = distVec.magSq(); 
      let d = sqrt(distanceSq);

      let distForGravity = max(distanceSq, 100); 
      let strength = (G * bi.mass * bj.mass) / distForGravity;
      let force = distVec.copy().setMag(strength);
      
      bi.applyForce(force);
      bj.applyForce(force.copy().mult(-1)); 

      if (debug) {
        let pe = -(G * bi.mass * bj.mass) / max(d, 10);
        totalPotential += pe;
      }

      // PERFECTLY ELASTIC COLLISIONS
      let minDist = bi.r + bj.r;
      if (d < minDist && d > 0) { 
        let overlap = minDist - d;
        let normal = distVec.copy().normalize();
        let correction = normal.copy().mult(overlap / 2);
        bi.pos.sub(correction);
        bj.pos.add(correction);

        let relativeVelocity = p5.Vector.sub(bj.vel, bi.vel);
        let velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal < 0) {
          let impulse = -2.0 * velocityAlongNormal; // 2.0 = (1 + restitution of 1.0)
          impulse /= (1 / bi.mass + 1 / bj.mass);

          let impulseVec = normal.copy().mult(impulse);
          bi.vel.sub(p5.Vector.div(impulseVec, bi.mass));
          bj.vel.add(p5.Vector.div(impulseVec, bj.mass));
        }
      }
    }
  }

  // 4. Update and Render Balls
  for (let b of balls) {
    b.update();
    b.checkEdges(boxSize);
    b.show();
    
    if (debug) {
      totalKinetic += 0.5 * b.mass * b.vel.magSq();
    }
  }

  // 5. Render Attractors (Drawn last for proper transparency)
  for (let a of attractors) {
    a.show();
  }

  // Render the HUD
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
    hud.text(`Hole: WASDQE`, width - 130, 30);

    push();
    resetMatrix();
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

// Function to handle continuous keyboard input for hole movement
function handleHoleMovement() {
  let speed = 5;
  // Use keyIsDown with key codes for smooth, continuous movement
  if (keyIsDown(65)) hole.moveX(-speed); // A
  if (keyIsDown(68)) hole.moveX(speed);  // D
  if (keyIsDown(87)) hole.moveY(-speed); // W
  if (keyIsDown(83)) hole.moveY(speed);  // S
  if (keyIsDown(81)) hole.moveZ(-speed); // Q
  if (keyIsDown(69)) hole.moveZ(speed);  // E
}

// Class for the movable hole/goal
class Hole {
  constructor(x, y, z, r) {
    this.pos = createVector(x, y, z);
    this.r = r;
  }

  // Function to move along the axes, constrained to stay within the box
  moveX(val) { this.pos.x = constrain(this.pos.x + val, -boxSize/2 + this.r, boxSize/2 - this.r); }
  moveY(val) { this.pos.y = constrain(this.pos.y + val, -boxSize/2 + this.r, boxSize/2 - this.r); }
  moveZ(val) { this.pos.z = constrain(this.pos.z + val, -boxSize/2 + this.r, boxSize/2 - this.r); }

  // Check if a ball is within the hole's capture radius
  checkCapture(ball) {
    let d = p5.Vector.dist(this.pos, ball.pos);
    // Captured if ball center is inside hole's volume
    return d < this.r;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    
    // Render as a semi-transparent, deep purple sphere to look like a gravitational sink
    fill(50, 0, 100, 180); 
    sphere(this.r, 24, 24); // More detail for the goal
    pop();
  }
}

// Check if user is clicking or dragging the camera
function mousePressed() {
  mouseStartX = mouseX;
  mouseStartY = mouseY;
}

function mouseReleased() {
  // If mouse moved a lot, it was a camera drag, don't shoot a ray.
  if (dist(mouseX, mouseY, mouseStartX, mouseStartY) > 5) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  // RAYCASTING MATH (Unprojecting 2D mouse to 3D world)
  let eye = createVector(cam.eyeX, cam.eyeY, cam.eyeZ);
  let center = createVector(cam.centerX, cam.centerY, cam.centerZ);
  let up = createVector(cam.upX, cam.upY, cam.upZ);

  let F = p5.Vector.sub(center, eye).normalize();
  let R = F.copy().cross(up).normalize();
  let U = R.copy().cross(F).normalize();

  // Find the coordinate of the mouse click on the camera's near-plane
  let d = (height / 2) / tan(PI / 6);
  let P = p5.Vector.add(eye, p5.Vector.mult(F, d));
  P.add(p5.Vector.mult(R, mouseX - width / 2));
  P.add(p5.Vector.mult(U, mouseY - height / 2));

  let dir = p5.Vector.sub(P, eye).normalize();

  let hitPoint = null;
  let closestT = Infinity;

  // 1. Check if ray hits any of the balls
  for (let b of balls) {
    let L = p5.Vector.sub(b.pos, eye);
    let tca = L.dot(dir);
    if (tca < 0) continue; // Ball is behind camera
    
    let d2 = L.dot(L) - tca * tca;
    let r2 = b.r * b.r;
    if (d2 > r2) continue; // Ray missed the ball
    
    let thc = sqrt(r2 - d2);
    let t0 = tca - thc; // Distance to intersection
    
    if (t0 < closestT) {
      closestT = t0;
      hitPoint = p5.Vector.add(eye, p5.Vector.mult(dir, t0));
    }
  }

  // 2. If no ball was hit, find where the ray hits the back of the box
  if (!hitPoint) {
    let halfBox = boxSize / 2;
    
    // Standard AABB (Axis-Aligned Bounding Box) ray intersection
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

    // tmax is the exit point (the back wall relative to camera)
    if (tmax >= tmin && tmax > 0) {
      hitPoint = P5.Vector.add(eye, p5.Vector.mult(dir, tmax));
    }
  }

  // Spawn the attractor!
  if (hitPoint) {
    attractors.push(new Attractor(hitPoint.x, hitPoint.y, hitPoint.z));
  }
}

class Attractor {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.mass = 80; // High mass to pull strongly
    this.r = 25; 
    this.timer = 180; // Survives for 3 seconds (assuming 60fps)
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    noStroke();
    fill(255, 50, 50, 120); // Mostly transparent red
    sphere(this.r, 16, 16); 
    pop();
  }
}

class Ball {
  constructor(x, y, z, m) {
    this.pos = createVector(x, y, z);
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