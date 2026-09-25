// 9/18/2026

// ==========================================
// CORE SIMULATION CLASS
// ==========================================
class Simulation {
  constructor(boxSize, initialBodies) {
    this.boxSize = boxSize;
    this.G = 5.0; 
    this.score = 0;
    
    this.showControls = true; 
    this.controlFade = 255;
    this.shake = 0; 
    
    this.bodies = [];
    this.attractors = [];
    this.particles = []; 
    
    this.hole = new Hole(0, 0, -this.boxSize / 2 + 1, 60);
    this.ship = new Ship(0, 0, 0);
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

  fireAttractor() {
    let newAttractor = this.ship.fire();
    this.attractors.push(newAttractor);
  }

  update() {
    this.ship.handleInput();
    this.ship.update(this.boxSize);

    this.handleHoleMovement();

    if (mouseIsPressed && dist(mouseX, mouseY, this.mouseStartX, this.mouseStartY) > 5) {
        this.showControls = false;
    }
    if (!this.showControls && this.controlFade > 0) {
        this.controlFade -= 5;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead) this.particles.splice(i, 1);
    }
    if (this.particles.length > 150) {
        this.particles.splice(0, this.particles.length - 150);
    }

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
      a.applyGravity(this.ship, this.G);
    }

    for (let i = 0; i < this.bodies.length; i++) {
      let b1 = this.bodies[i];

      let shipDistVec = p5.Vector.sub(b1.pos, this.ship.pos);
      let shipDist = shipDistVec.mag();
      let shipMinDist = b1.r + this.ship.radius;
      
      if (shipDist < shipMinDist && shipDist > 0) {
          let overlap = shipMinDist - shipDist;
          let normal = shipDistVec.copy().normalize();
          
          let totalMass = this.ship.mass + b1.mass;
          let shipRatio = b1.mass / totalMass;
          let b1Ratio = this.ship.mass / totalMass;
          
          this.ship.pos.sub(normal.copy().mult(overlap * shipRatio));
          b1.pos.add(normal.copy().mult(overlap * b1Ratio));

          let relativeVel = p5.Vector.sub(b1.vel, this.ship.vel);
          let velAlongNormal = relativeVel.dot(normal);

          if (velAlongNormal < 0) {
              let impulse = -1.8 * velAlongNormal; 
              impulse /= (1 / this.ship.mass + 1 / b1.mass);
              let impulseVec = normal.copy().mult(impulse);
              
              this.ship.vel.sub(p5.Vector.div(impulseVec, this.ship.mass));
              b1.vel.add(p5.Vector.div(impulseVec, b1.mass));
              
              this.shake = min(this.shake + impulse * 2.0, 25);
          }
      }

      for (let j = i + 1; j < this.bodies.length; j++) {
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
    let localCamOffset, worldCamOffset, worldCamPos, lookAtTarget;
    let localFwd = createVector(0, 0, -1);
    let worldFwd = this.ship.orientation.rotateVector(localFwd);
    let localUp = createVector(0, 1, 0); 
    let worldUp = this.ship.orientation.rotateVector(localUp);

    if (firstPerson) {
        worldCamPos = p5.Vector.add(this.ship.pos, p5.Vector.mult(worldFwd, this.ship.radius));
        lookAtTarget = p5.Vector.add(worldCamPos, worldFwd);
    } else {
        let camDist = 80;
        let camHeight = 25;
        localCamOffset = createVector(0, -camHeight, camDist); 
        worldCamOffset = this.ship.orientation.rotateVector(localCamOffset);
        worldCamPos = p5.Vector.add(this.ship.pos, worldCamOffset);
        lookAtTarget = this.ship.pos; 
    }

    if (enableCameraShake && this.shake > 0.5) {
      worldCamPos.add(p5.Vector.random3D().mult(this.shake));
    }
    if (this.shake > 0) this.shake *= 0.9; 

    camera(
        worldCamPos.x, worldCamPos.y, worldCamPos.z, 
        lookAtTarget.x, lookAtTarget.y, lookAtTarget.z, 
        worldUp.x, worldUp.y, worldUp.z 
    );
    
    perspective(PI / 3, width / height, 1, 10000);

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
    
    if (!firstPerson) {
        this.ship.render();
    }

    for (let b of this.bodies) b.renderSolid();
    for (let a of this.attractors) a.render();

    drawingContext.depthMask(false); 
    noLights(); 
    
    blendMode(ADD);
    for (let p of this.particles) p.render();
    for (let p of this.ship.exhaust) p.render(); // Render ship thruster exhaust
    blendMode(BLEND);

    let camPos = createVector(worldCamPos.x, worldCamPos.y, worldCamPos.z);
    let sortedBodies = [...this.bodies].sort((a, b) => {
        let distA = p5.Vector.dist(camPos, a.pos);
        let distB = p5.Vector.dist(camPos, b.pos);
        return distB - distA; 
    });

    for (let b of sortedBodies) b.renderAtmosphere();
    drawingContext.depthMask(true); 

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
    //let speed = 5;
    //if (keyIsDown(65)) this.hole.moveX(-speed, this.boxSize); 
    //if (keyIsDown(68)) this.hole.moveX(speed, this.boxSize);  
    //if (keyIsDown(87)) this.hole.moveY(-speed, this.boxSize); 
    //if (keyIsDown(83)) this.hole.moveY(speed, this.boxSize);  
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
    this.hud.clear();
    
    if (this.controlFade > 0) {
        //this.hud.fill(255, this.controlFade);
        //this.hud.textSize(24);
        //this.hud.textStyle(BOLD);
        //this.hud.textAlign(CENTER, BOTTOM);
        //this.hud.text("Left Click + Drag to Rotate Camera", width / 2, height - 30);
        ////this.hud.textAlign(LEFT, BASELINE); 
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
    //this.hud.text(`Ship Vel: ${this.ship.vel.mag().toFixed(1)}`, 20, 80);
    
    this.hud.textAlign(RIGHT, TOP);
    this.hud.text(`Move: WSADEQ | Turn: Arrows | Fire: Space`, width - 20, 30);
    //this.hud.text(`View: ${firstPerson ? '1st Person' : '3rd Person'} (var firstPerson)`, width - 20, 50);
    this.hud.textAlign(LEFT, BASELINE);

    push();
    resetMatrix();
    camera(0, 0, (height / 2.0) / tan(PI * 30.0 / 180.0), 0, 0, 0, 0, 1, 0);
    noLights(); imageMode(CENTER); image(this.hud, 0, 0);
    pop();
  }
}