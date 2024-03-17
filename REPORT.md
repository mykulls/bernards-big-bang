# Bernard's Big Bang
*Bernard's Big Bang* is an exciting game made with the WebGL tiny-graphics-js library following our alien character, Bernard. Our game adds a creative twist to the classic game Doodle Jump by taking place in space and using 3D elements, as well as incorporating physics-based interactions and animations. The user controls the movement of Bernard, moving him left, right, up, and down. The objective is to stay alive as long as possible by jumping on platforms and avoiding asteroids. 

![gameplay gif](Animation.gif)

## Table of Contents
- [Algorithms Used](https://github.com/mykulls/bernards-big-bang/#algorithms-used)
- [Setup](https://github.com/mykulls/bernards-big-bang/#setup)
- [How to Play](https://github.com/mykulls/bernards-big-bang/#how-to-play)
- [Credits](https://github.com/mykulls/bernards-big-bang/#credits)

## Algorithms Used
The algorithms that we used are splines, collision detection, mass spring damper, and rigid body dynamics and Newton’s Laws of Motion.

1. We used splines to animate the star paths. We expanded on our code from Assignment 1 Part 1 where we created Hermite splines specifying control points and tangents for the curves. The Hermite spline code is detailed in `splines.js`. Within our game, there are 3 different kinds of spline paths that alternate as Bernard gains height through the scene. Each spline has a corresponding star object whose position is updated according to a sine function in `render_animation()`. This continuous pattern of movement back and forth along the spline was adapted from Assignment 1 Part 3. Thus, the stars will always be moving back and forth along the paths, adding dimensionality to the scene of Bernard’s Big Bang.

2. In our game or simulation environment, collision detection between Bernard and various objects such as platforms and asteroids is a crucial aspect of gameplay dynamics. This detection process involves comparing the coordinates of Bernard with those of the objects to determine overlaps. Upon detection, a flag is set to indicate the collision. During the rendering loop, an update function is called to adjust the positions and velocities of the objects using symplectic movement calculations. If a collision flag is set, the update function incorporates adjustments to Bernard's velocity to simulate the effects of the collision, ensuring a realistic and immersive experience for the player. Additionally, in the asteroid-Bernard collision, the asteroid's velocity is reflected to simulate a bounce-off effect, and Bernard's position is adjusted accordingly. If Bernard runs out of lives, the game is over. Furthermore, the method ensures that asteroids are deleted if they stray too far from the playable area. 

3. We added springs on the platforms to use the mass spring damper system. When Bernard comes into contact with a platform, the system calculates the forces exerted on him by the springiness of the platform, as well as any damping effects that resist his motion. These calculations are handled within the platform_forces function, where spring forces based on Hooke's Law and damping forces proportional to velocity are determined. These forces are then combined to produce a net force acting on Bernard, influencing his movement in a realistic manner. 

4. We used rigid body dynamics and Newton’s Laws of Motion to maintain the shapes of objects, such as asteroids and Bernard, when they move, rotate, collide, and otherwise interact with each other. For example, when an asteroid hits Bernard, neither deforms. Instead, they apply forces to each other of equal magnitude and opposite direction to essentially “bounce” away from each other. We also have rigid body dynamics, as the asteroids and Bernard do not deform when they hit platforms and the ground.

## Setup
To run our program locally, we recommend using Visual Studio Code or the terminal.

### Visual Studio Code
1. Download Visual Studio Code from [https://code.visualstudio.com/](https://code.visualstudio.com/).
2. In the terminal, clone this repository and change into the `bernards-big-bang` directory:
```
git clone https://github.com/mykulls/bernards-big-bang.git
cd bernards-big-bang
```
3. Download the [_Live Server_ extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).
4. Click `Go Live` in the bottom right corner of Visual Studio Code to play our game in your browser.

### Terminal
1. Click [here](https://github.com/mykulls/bernards-big-bang/archive/refs/heads/main.zip) to download our code as a ZIP file.
2. Unzip the ZIP file and change into the `bernards-big-bang` directory:
```
tar -xvf bernards-big-bang-main.zip
cd bernards-big-bang-main
```
3. Run the server:
```
python3 server.py
```
4. In your browser, navigate to `localhost:<PORT_NUMBER>`, where PORT_NUMBER is the port your local version of the program is served at. For example, if your terminal says `serving at port 8000`, go to `localhost:8000`.

## How to Play

In the game, players control Bernard's movement using the 'A' key to move left and the 'D' key to move right, allowing them to navigate and avoid incoming asteroids. Each time Bernard collides with a platform, he will bounce off it, adding an element of challenge to the gameplay. To restart the game, players can simply refresh the page, providing a quick and easy way to start over and continue playing. Bernard has three lives which provides another challenge. He loses a life either when he falls off the platform or when he collides with an asteroid. The player’s goal is to stay alive as long as possible, with each second alive incrementing the score by one point.

## Credits
Created by Melissa Chen, Laura Lu, Michael Shi, and Juliet Zhang for CS C174C Winter 2024. Used `collisions-demo.js` and `text-demo.js` from the given `examples` folder from class, as well as Assignment 1 code (especially for splines).
