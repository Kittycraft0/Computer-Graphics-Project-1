//9/9/2026
let angle = 0;
let rotationAxis;
let spinSpeed = 0;
let friction = 0.98; // Friction factor (1.0 = spins forever, 0.95 = slows down quickly)

function setup() {
  createCanvas(400, 400, WEBGL);
  // Initialize the rotation axis pointing straight up
  rotationAxis = createVector(0, 1, 0);
}

function draw() {
  background(220);
  
  // Setup lighting
  ambientLight(100);
  directionalLight(255, 255, 255, 0.5, 0.5, -1);

  // 1. Calculate continuous spin when mouse is NOT dragged
  if (!mouseIsPressed) {
    angle += spinSpeed;
    spinSpeed *= friction; // Apply friction to slow it down smoothly
  }

  // 2. Apply the axis-angle rotation to the world matrix
  // rotate(angle, [x, y, z]) uses a custom vector to prevent gimbal lock
  rotate(angle, rotationAxis);

  // Draw the cylinder
  fill(100, 150, 250);
  stroke(255);
  cylinder(80, 150);
}

// Triggers continuously while the user clicks and drags the mouse
function mouseDragged() {
  // Calculate how fast and in what direction the mouse moved on this frame
  let dx = mouseX - pmouseX;
  let dy = mouseY - pmouseY;
  
  // Calculate the magnitude of the movement (velocity)
  let speed = sqrt(dx * dx + dy * dy);
  
  if (speed > 0) {
    // Perpendicular logic: Moving X rotates around Y axis. Moving Y rotates around X axis.
    // Flipping dy and dx automatically creates a vector perpendicular to the drag path.
    rotationAxis = createVector(-dy, dx, 0).normalize();
    
    // Scale down the speed so the interaction feels natural and controllable
    spinSpeed = speed * 0.01;
    angle += spinSpeed;
  }
}