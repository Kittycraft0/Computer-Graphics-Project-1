// ==========================================
// CORE SIMULATION CLASS
// Orchestrates N-Body physics, collisions, user input, and the rendering pipeline
// ==========================================
class Simulation {
  constructor(boxSize, initialBodies) {
    this.boxSize = boxSize;
    this.G = 5.0; // Universal Gravitational Constant (scaled for simulation pacing)
    this.score = 0;
    
    // UI variables
    this.showControls = true; // Used to fade out the interaction hint
    this.controlFade = 255;
    this.shake = 0; // Tracks the current intensity of the camera shake
    
    // Arrays to hold our physical entities
    this.bodies = [];
    this.attractors = [];
    this.particles = []; 
    
    // The player's goal: A singularity locked to the back wall of the box
    this.hole = new Hole(0, 0, -this.boxSize / 2 + 1, 60);

    // Explicitly track the camera and an offscreen 2D buffer for the HUD
    this.cam = createCamera();
    this.hud = createGraphics(windowWidth, windowHeight);
    
    // Track mouse start positions to distinguish between clicks and camera drags
    this.mouseStartX = 0;
    this.mouseStartY = 0;

    // Initialize the solar system
    for (let i = 0; i < initialBodies; i++) {
      let m;
      // Guarantee at least one of each major planetary type exists
      if (i === 0) m = 12; // Sun
      else if (i === 1) m = 6; // Gas Giant
      else if (i === 2) m = 2.5; // Terrestrial Planet
      else if (i === 3) m = 0.8; // Moon
      else {
        // Use a Log-Normal distribution for the rest of the universe.
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

  // ==========================================
  // PHYSICS & LOGIC UPDATE
  // ==========================================
  update() {
    // INTERACTION: Process WASD keyboard inputs to move the goal hole
    this.handleHoleMovement();

    // UI Logic: Fade out the camera control hint
    if (mouseIsPressed && dist(mouseX, mouseY, this.mouseStartX, this.mouseStartY) > 5) {
        this.showControls = false;
    }
    if (!this.showControls && this.controlFade > 0) {
        this.controlFade -= 5;
    }

    // Update collision debris particles. Cap at 150 to prevent severe lag.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead) {
        this.particles.splice(i, 1);
      }
    }
    if (this.particles.length > 150) {
        this.particles.splice(0, this.particles.length - 150);
    }

    // INTERACTION: Process the temporary gravity wells
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

    // N-BODY PHYSICS LOOP
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        let b1 = this.bodies[i];
        let b2 = this.bodies[j];

        // 1. Calculate Gravity
        let distVec = p5.Vector.sub(b2.pos, b1.pos);
        let distSq = distVec.magSq();
        let d = sqrt(distSq);
        
        let distForGravity = max(distSq, 100);
        let strength = (this.G * b1.mass * b2.mass) / distForGravity;
        let force = distVec.copy().setMag(strength);
        
        b1.applyForce(force);
        b2.applyForce(force.copy().mult(-1)); 

        // 2. Physical Elastic Collisions
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

            // Apply impacts to map craters onto textures
            b1.applyImpact(normal.copy().mult(-1), deltaV1);
            b2.applyImpact(normal.copy(), deltaV2);

            b1.vel.sub(p5.Vector.div(impulseVec, b1.mass));
            b2.vel.add(p5.Vector.div(impulseVec, b2.mass));

            // Generate physical particle debris
            let contactPoint = p5.Vector.lerp(b1.pos, b2.pos, b1.r / (b1.r + b2.r));
            let numParticles = constrain(floor(impulse * 1.5), 2, 15);
            for(let p = 0; p < numParticles; p++) {
                let scatter = p5.Vector.random3D().mult(random(1, 4));
                let pVel = p5.Vector.add(normal.copy().mult(random(-2, 2)), scatter);
                this.particles.push(new Particle(contactPoint.x, contactPoint.y, contactPoint.z, pVel));
            }

            this.shake = min(this.shake + impulse * 0.4, 25);
          }
        }
      }
    }

    // Update body positions, check bounds, and handle goal capture
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

  // ==========================================
  // RENDERING PIPELINE
  // ==========================================
  render() {
    // Explicitly enforce default blend mode to prevent offscreen buffers from leaking state
    blendMode(BLEND); 
    
    push(); // Begin camera translation matrix
    
    // Apply camera shake
    if (enableCameraShake && this.shake > 0.5) {
      translate(random(-this.shake, this.shake), random(-this.shake, this.shake), random(-this.shake, this.shake));
    }
    if (this.shake > 0) this.shake *= 0.9; 

    // --- 1. LIGHTING PASS ---
    ambientLight(25);
    let lightCount = 0;
    
    // Make Suns emit physical light
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

    // --- 2. OPAQUE GEOMETRY PASS ---
    this.drawWireframeBox();
    this.hole.render();

    for (let b of this.bodies) b.renderSolid();
    for (let a of this.attractors) a.render();

    // --- 3. TRANSPARENT/VOLUMETRIC PASS (TRUE Z-SORTING) ---
    // Instead of hacking the depth buffer, we calculate the distance to the camera
    // and draw the transparent objects strictly back-to-front. 
    noLights(); 
    
    // Render particles first
    for (let p of this.particles) p.render();
    
    // Sort bodies by distance from camera (furthest first)
    let cx = this.cam.eyeX;
    let cy = this.cam.eyeY;
    let cz = this.cam.eyeZ;
    
    let sortedBodies = [...this.bodies];
    sortedBodies.sort((a, b) => {
      let distA = (a.pos.x - cx)**2 + (a.pos.y - cy)**2 + (a.pos.z - cz)**2;
      let distB = (b.pos.x - cx)**2 + (b.pos.y - cy)**2 + (b.pos.z - cz)**2;
      return distB - distA; 
    });

    // Render atmospheres in sorted order
    for (let b of sortedBodies) b.renderAtmosphere();
    
    pop(); // End camera translation matrix

    // Render the Heads Up Display
    this.drawHUD();
  }

  // Draws the neon 3D bounding box
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

  // INTERACTION: WASD keyboard controls
  handleHoleMovement() {
    let speed = 5;
    if (keyIsDown(65)) this.hole.moveX(-speed, this.boxSize); // A
    if (keyIsDown(68)) this.hole.moveX(speed, this.boxSize);  // D
    if (keyIsDown(87)) this.hole.moveY(-speed, this.boxSize); // W
    if (keyIsDown(83)) this.hole.moveY(speed, this.boxSize);  // S
  }

  handleMousePress() {
    this.mouseStartX = mouseX;
    this.mouseStartY = mouseY;
  }

  // INTERACTION: 3D Raycasting
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
    
    this.hud.textAlign(RIGHT, TOP);
    this.hud.text(`Hole: WASD | Attractor: Click`, width - 20, 30);
    this.hud.textSize(12);
    this.hud.text(`Wall Attractors [var allowWallAttractors]: ${allowWallAttractors ? 'ON' : 'OFF'}`, width - 20, 50);
    this.hud.text(`Camera Shake [var enableCameraShake]: ${enableCameraShake ? 'ON' : 'OFF'}`, width - 20, 70);
    this.hud.textAlign(LEFT, BASELINE);

    push();
    resetMatrix();
    camera(0, 0, (height / 2.0) / tan(PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
    noLights(); imageMode(CENTER); image(this.hud, 0, 0);
    pop();
  }
}