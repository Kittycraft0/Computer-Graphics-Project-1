## 🎨 Title  
Gravity Well: Exoplanet Simulator

---
## ✨ Description  
This project is an interactive, physically-accurate 3D N-body gravity simulation. I was inspired by orbital mechanics and wanted to see how procedural generation could make a physics simulation feel like an active, living universe. 

The interaction is multifaceted:
- **Mouse Input (Raycasting):** Users can click on planets to place temporary, high-mass "Gravity Wells" (Cyan crystals) on their surfaces, violently altering the orbits of everything nearby.
- **Keyboard Input (WASD):** Users control a mechanical singularity gate on the back wall, acting as a goal to "capture" the planets. 
- **Object Interactions:** The planets attract each other using inverse-square gravity, elastically collide based on mass/momentum, generate procedural heat-glows, and physically scar each other by burning permanent craters into their spinning textures.

---
## ⚙️ Setup  
Open the `index.html` file in code/code5 in any modern web browser to run the code. Folders with lower code numbers are working previous iterations saved before foundational changes to preserve their unique styles.
- **Libraries used:** `p5.js`
- **Controls:** Left Click + Drag to rotate the 3D camera. Scroll to zoom. Use WASD to move the capture gate. Click on planets to spawn attractors. You can open the developer console and set `debug = false` to hide the HUD.

---
## 🔍 Reflection  
If I were to extend this in the future, I would add a way to merge planets upon collision instead of bouncing them, or add a slider to control the universal gravitational constant. 

A major challenge during development was figuring out how to map a 3D world-space collision vector onto the 2D UV texture of a spinning sphere so craters showed up in the right spot. 

Critiques/Opinions: I think p5.js is very cool and heavily streamlines the graphics process so I can work much more on the physics and game functionality without needing to worry about making a graphics engine. It really opens up my options, especially with the ability to utilize dynamic lighting and live 3D shaders for use in a game.