// 9/16/2026
// 🎨✨Web Graphics with p5.js - Main Entry Point

let sim; // Global variable to hold our simulation instance
var debug = true; // Toggles the Heads Up Display (HUD)
var allowWallAttractors = false; // Toggles placing gravity wells on the bounding box
var enableCameraShake = false; // Toggles arcade-style camera shake on impacts

function setup() {
  // WEBGL mode enables hardware-accelerated 3D rendering
  createCanvas(windowWidth, windowHeight, WEBGL);
  
  // Increase Perlin noise detail for more organic, highly-fractal planet textures
  // 6 octaves, 0.5 falloff creates a much more rugged look
  noiseDetail(6, 0.5); 
  
  // Initialize the simulation: 600px cubic bounding box, 50 initial celestial bodies
  sim = new Simulation(600, 50); 
}

function draw() {
  // Deep space background color (very dark blue/gray)
  background(5, 5, 12); 
  
  // INTERACTION: orbitControl allows the user to rotate the 3D camera 
  // by clicking and dragging, and zoom by scrolling.
  orbitControl(2, 2, 0.1);

  // Step the physics engine forward 1 frame, then draw the results
  sim.update();
  sim.render();
}

// Ensure the canvas dynamically resizes if the user resizes their browser window
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (sim) sim.resizeHUD();
}

// Pass mouse events into the simulation class for 3D raycasting
function mousePressed() {
  sim.handleMousePress();
}

function mouseReleased() {
  sim.handleMouseRelease();
}