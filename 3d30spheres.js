//9/9/2026

let spheres = [];
const NUM_SPHERES = 30;
const BOUNDS = 200; // Size of the invisible boundary box they bounce inside

function setup() {
  createCanvas(500, 500, WEBGL);
  
  // Initialize 30 distinct spheres
  for (let i = 0; i < NUM_SPHERES; i++) {
    spheres.push(new PhysicsSphere());
  }
}

function draw() {
  background(20);
  
  // Add orbit control so you can view the simulation from any angle
  orbitControl();
  
  // Lighting setup for rich 3D depth
  ambientLight(60);
  pointLight(255, 255, 255, 0, 0, 300);
  directionalLight(150, 150, 150, -1, -1, -1);

  // Draw an optional faint wireframe box to visualize the boundaries
  noFill();
  stroke(50);
  box(BOUNDS * 2);

  // Update physics and draw each sphere
  for (let i = 0; i < spheres.length; i++) {
    spheres[i].update();
    spheres[i].checkWallCollisions();
    
    // Check collisions against every other sphere (nested loop)
    for (let j = i + 1; j < spheres.length; j++) {
      spheres[i].checkSphereCollision(spheres[j]);
    }
    
    spheres[i].display();
  }
}

class PhysicsSphere {
  constructor() {
    // Random position within the bounding box
    this.pos = createVector(random(-BOUNDS+20, BOUNDS-20), random(-BOUNDS+20, BOUNDS-20), random(-BOUNDS+20, BOUNDS-20));
    // Random initial orbital/drift velocity
    this.vel = createVector(random(-2, 2), random(-2, 2), random(-2, 2));
    this.radius = random(12, 22);
    this.mass = this.radius; // Mass proportional to size for realistic momentum transfer
    this.color = color(random(100, 255), random(100, 255), random(100, 255));
  }

  update() {
    // Basic kinematic step: position = position + velocity
    this.pos.add(this.vel);
  }

  checkWallCollisions() {
    // Elastic bounce off the invisible boundary box walls
    if (abs(this.pos.x) > BOUNDS - this.radius) {
      this.vel.x *= -1;
      this.pos.x = sign(this.pos.x) * (BOUNDS - this.radius);
    }
    if (abs(this.pos.y) > BOUNDS - this.radius) {
      this.vel.y *= -1;
      this.pos.y = sign(this.pos.y) * (BOUNDS - this.radius);
    }
    if (abs(this.pos.z) > BOUNDS - this.radius) {
      this.vel.z *= -1;
      this.pos.z = sign(this.pos.z) * (BOUNDS - this.radius);
    }
  }

  checkSphereCollision(other) {
    // 1. Calculate distance between sphere centers
    let dir = p5.Vector.sub(other.pos, this.pos);
    let distance = dir.mag();
    let minDist = this.radius + other.radius;

    // 2. If overlapping, resolve the 3D elastic collision
    if (distance < minDist) {
      // Overlap correction: push them apart so they never stick together
      let overlap = minDist - distance;
      let correction = dir.copy().normalize().mult(overlap * 0.5);
      this.pos.sub(correction);
      other.pos.add(correction);

      // 3. 3D Elastic Momentum Transfer Math
      let normal = dir.copy().normalize();
      
      // Relative velocity vector
      let relVel = p5.Vector.sub(this.vel, other.vel);
      
      // Calculate velocity along the normal vector (dot product)
      let speedAlongNormal = relVel.dot(normal);

      // Only resolve if they are moving towards each other
      if (speedAlongNormal > 0) {
        // Calculate scalar impulse
        let impulseMagnitude = (2 * speedAlongNormal) / (this.mass + other.mass);
        
        // Compute impulse vectors based on mass
        let impulseThis = normal.copy().mult(impulseMagnitude * other.mass);
        let impulseOther = normal.copy().mult(impulseMagnitude * this.mass);
        
        // Apply forces to change velocities
        this.vel.sub(impulseThis);
        other.vel.add(impulseOther);
      }
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    ambientMaterial(this.color);
    noStroke();
    sphere(this.radius);
    pop();
  }
}

// Quick helper function for boundary handling
function sign(num) {
  return num >= 0 ? 1 : -1;
}
