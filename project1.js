// 9/9/2026
// haven't coded in javascript in so long!!! i know this language by heart though i think

console.log("script loaded!")

// scale rotate transform

// initialize the data
data={
    objects:{
        "camera":{
            pos:[2,3,4],
            angle:[0,0,0]
        },
        "cube1":{
            pos:[-3,-1,-2],
            angle:[1,1,1]
        }
    },
    cameraObject:"camera"
}



// "use ai all you want or all you can" this is fun though

// keys stuff
keys={}
document.addEventListener("keydown",(event)=>{
    //console.log("hi world"+event.key+event.code)
    // ooh event.code is better than event.key so i don't have to do tolowercase each time but then again 
    // references are longer, still nice though
    keys[event.code]=true
})
document.addEventListener("keyup",(event)=>{
    //console.log("bye world"+event.key+event.code)
    keys[event.code]=false
    //print(keys) //oh this literally prints oops
    //console.log(keys)
})
//now i can just reference keys["keyCode"] whenever i want to see if a key is pressed, nice lol

function updateCamera(keys){
    if(keys["KeyW"]){
        data.objects[data.cameraObject].pos[0]+=0.1
        //console.log(data.objects[data.cameraObject].pos[0])
    }

}

// render 2d
function render2d(data){

}
// render 3d
function render3d(data){

}

function renderCylinder(){
    background(220);

    // Enable mouse interaction (Left-click to rotate, Right-click to pan, Scroll to zoom)
    orbitControl();

    // Add smooth, realistic lighting to show off the 3D depth
    ambientLight(100);
    directionalLight(255, 255, 255, 0.5, 0.5, -1);

    // Rotate the cylinder continuously over time
    rotateX(frameCount * 0.01);
    rotateY(frameCount * 0.01);
    // omg it has quaternions YAY!!!
    // uhhh...
    rotate(angle, axis)

    // Optional: Set a color for the cylinder
    fill(100, 150, 250);
    stroke(255);

    // Draw the cylinder: cylinder(radius, height, [detailX], [detailY])
    cylinder(80, 150);
}

function setup(){
    createCanvas(windowWidth,windowHeight,WEBGL);
    background(200)
    square(300,300,400)
}
// 2. Automatically adjust the canvas if the user resizes the browser window
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// 3. Trigger true browser fullscreen on user interaction
function mousePressed() {
  // Check if the sketch is already in fullscreen mode
  let fs = fullscreen();
  // Toggle the fullscreen state
  //fullscreen(!fs); //this would be annoying
}

// loop
// using draw is better because it's essentially the same thing but like better
let loop=()=>{
    renderCylinder()
    updateCamera(keys)
}

function draw(){
    loop()
}

//let loopvariable=setInterval(loop,1000/60)