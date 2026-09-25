// 9/16/2026
// 🎨✨Web Graphics with p5.js - Main Entry Point

let sim; 
var debug = true; 
var enableCameraShake = false; 

// --- NEW VIEW TOGGLE ---
var firstPerson = false; // Set to true to sit in the cockpit!

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  noiseDetail(6, 0.5); 
  sim = new Simulation(1200, 40); 
}

function draw() {
  background(5, 5, 12); 

  sim.update();
  sim.render();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (sim) sim.resizeHUD();
}

// INTERACTION: Firing projectiles
function keyPressed() {
  if (keyCode === 32) { // Spacebar
    sim.fireAttractor();
  }
}