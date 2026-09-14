// 9/9/2026
console.log("AI dungeon crawler script opened!")
// Game configurations
let tileSize = 40;
let player = { x: 1, y: 1 };
let score = 0;
let gameState = "PLAY"; // Can be "PLAY" or "WIN"

// Map Legend: 
// 0 = Floor, 1 = Wall, 2 = Exit, 3 = Coin
let mapGrid = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 3, 1, 0, 0, 0, 2, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
  [1, 3, 0, 1, 0, 0, 0, 1, 0, 1],
  [1, 1, 0, 0, 0, 1, 3, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

let cols = 10;
let rows = 10;

function setup() {
  createCanvas(cols * tileSize, rows * tileSize);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(200);

  if (gameState === "PLAY") {
    drawMap();
    drawPlayer();
    drawUI();
  } else if (gameState === "WIN") {
    // Win Screen
    background(50);
    fill(255);
    textSize(32);
    text("You Escaped!", width / 2, height / 2 - 20);
    textSize(20);
    fill(255, 215, 0);
    text("Final Score: " + score, width / 2, height / 2 + 20);
  }
}

// Function to render the grid
function drawMap() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let tile = mapGrid[y][x];
      
      if (tile === 1) { // Wall
        fill(70);
      } else if (tile === 2) { // Exit
        fill(50, 200, 50);
      } else if (tile === 3) { // Coin
        fill(255, 215, 0);
      } else { // Floor
        fill(30); 
      }
      
      stroke(20);
      rect(x * tileSize, y * tileSize, tileSize, tileSize);
      
      // Draw coin symbol ($) on top of the tile
      if (tile === 3) {
        fill(0);
        textSize(20);
        noStroke();
        text("$", x * tileSize + tileSize / 2, y * tileSize + tileSize / 2);
      }
    }
  }
}

// Function to render the player
function drawPlayer() {
  fill(50, 150, 255); // Blue player
  stroke(255);
  strokeWeight(2);
  circle(player.x * tileSize + tileSize / 2, player.y * tileSize + tileSize / 2, tileSize * 0.7);
  strokeWeight(1); // Reset stroke weight for other shapes
}

// Function to display the score
function drawUI() {
  fill(255);
  noStroke();
  textSize(16);
  textAlign(LEFT, TOP);
  text("Score: " + score, 10, 10);
  textAlign(CENTER, CENTER); // Reset for other text
}

// Handle movement inputs (WASD or Arrow Keys)
function keyPressed() {
  if (gameState !== "PLAY") return;

  let nextX = player.x;
  let nextY = player.y;

  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') nextX--;
  if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') nextX++;
  if (keyCode === UP_ARROW || key === 'w' || key === 'W') nextY--;
  if (keyCode === DOWN_ARROW || key === 's' || key === 'S') nextY++;

  // Ensure player doesn't walk out of bounds
  if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows) {
    let nextTile = mapGrid[nextY][nextX];
    
    // Check if the next tile is NOT a wall
    if (nextTile !== 1) { 
      player.x = nextX;
      player.y = nextY;
      
      // Collect coin logic
      if (nextTile === 3) {
        score += 10;
        mapGrid[nextY][nextX] = 0; // Turn the coin tile into a floor tile
      }
      
      // Exit logic
      if (nextTile === 2) {
        gameState = "WIN";
      }
    }
  }
}