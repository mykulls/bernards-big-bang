import {tiny, defs} from './examples/common.js';
import { Bernard } from './objects.js';


// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

function platform_forces(platforms, pos, vel) {
  let f_n = vec3(0, 0, 0);
  const platform_n = vec3(0, 1, 0);

  // loop through all platforms, return once you find one that the particle intersects with or if none intersect
  for(const platform of platforms) {
    const signed_dist = pos.minus(platform.pos).dot(platform_n);

    if(signed_dist < 0 &&
       pos[0] < platform.pos[0] + platform.w &&
       pos[0] > platform.pos[0] - platform.w &&
       pos[2] < platform.pos[2] + platform.h &&
       pos[2] > platform.pos[2] - platform.h) { // particle below ground and within platform
      const platform_fric_dir = vel.times(-1).normalized();
      const spring_f = platform_n.times(-signed_dist).times(platform.ks);
      const damper_f = platform_fric_dir.times(vel.dot(platform_fric_dir)).times(platform.kd);
      f_n = spring_f.minus(damper_f);
      break;
    }
  }

  return f_n;
}

function get_forces(g, platforms, particle) {
  const { m, pos, vel } = particle;
  return g.times(m).plus(platform_forces(platforms, pos, vel));
}

class Platform {
  constructor(pos=vec3(1, 1, 1), ks=0, kd=0, w=1, h=1) {
    this.pos = pos;
    this.ks = ks;
    this.kd = kd;
    this.w = w;
    this.h = h;
  }
}

class Simulation {
  constructor(platforms=[], ts=1.0/60, g=vec3(0, -9.8, 0)) {
    this.platforms = platforms;
    this.bernard = null;
    this.ts = ts;
    this.g = g; // should only set the y direction
  }

  set_bernard(m, x, y, z, vx, vy, vz) {
    this.bernard = new Bernard(m, vec3(x, y, z), vec3(vx, vy, vz));
  }

  create_platform(x, y, z, ks, kd, w, h) {
    this.platforms.push(new Platform(vec3(x, y, z), ks, kd, w, h));
  }

  update() {
    this.bernard.f = get_forces(this.g, this.platforms, this.bernard);
    this.bernard.update(this.ts);
  }

  draw(webgl_manager, uniforms, shapes, materials) {
    const red = color(1, 0, 0, 1);

    const b_pos = this.bernard.pos;
    const b_transform =  Mat4.scale(0.5, 0.5, 0.5).pre_multiply(Mat4.translation(b_pos[0], b_pos[1], b_pos[2]));
    this.bernard.draw(webgl_manager, uniforms, shapes, materials, b_transform);

    this.platforms.forEach((platform) => {
      // !!! Draw platform
      const p1_t = Mat4.translation(platform.pos[0], platform.pos[1], platform.pos[2]).times(Mat4.scale(platform.w, 0.1, platform.h));
      shapes.box.draw(webgl_manager, uniforms, p1_t, { ...materials.plastic, color: red } );
    })
  }
}

export
const Part_two_spring_base = defs.Part_two_spring_base =
    class Part_two_spring_base extends Component
    {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
                                               // This particular scene is broken up into two pieces for easier understanding.
                                               // The piece here is the base class, which sets up the machinery to draw a simple
                                               // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
                                               // exposes only the display() method, which actually places and draws the shapes,
                                               // isolating that code so it can be experimented with on its own.
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows() };

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        this.simulation = new Simulation();
        this.simulation.set_bernard(1, 2, 4, 2, 1, 0, 1);
        this.simulation.create_platform(2.5, 1, 2.5, 12500, 10);
        this.simulation.create_platform(5, 2, 5, 12500, 10);
        this.run = false;
      }

      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Part_one_hermite, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          Shader.assign_camera( Mat4.look_at (vec3 (10, 10, 10), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


export class Part_two_spring extends Part_two_spring_base
{                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
                                                     // This particular scene is broken up into two pieces for easier understanding.
                                                     // See the other piece, My_Demo_Base, if you need to see the setup code.
                                                     // The piece here exposes only the display() method, which actually places and draws
                                                     // the shapes.  We isolate that code so it can be experimented with on its own.
                                                     // This gives you a very small code sandbox for editing a simple scene, and for
                                                     // experimenting with matrix transformations.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
        // From here on down it's just some example shapes drawn for you -- freely
        // replace them with your own!  Notice the usage of the Mat4 functions
        // translation(), scale(), and rotation() to generate matrices, and the
        // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,1,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;
    const dt = this.dt = Math.min(1/60, this.uniforms.animation_delta_time/1000);
    let t_sim = this.t_sim = t;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // !!! Draw ball (for reference)
    let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
        .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

    if(this.run) {
      const t_next = t_sim + dt;
      for(; this.t_sim <= t_next; this.t_sim += this.simulation.ts) {
        this.simulation.update();
      }
    }

    this.simulation.draw(caller, this.uniforms, this.shapes, this.materials);
  }

  render_controls()
  {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Platforms:";
    this.new_line();
    this.key_triggered_button( "Run", [], this.start );
    this.new_line();

    /* Some code for your reference
    this.key_triggered_button( "Copy input", [ "c" ], function() {
      let text = document.getElementById("input").value;
      console.log(text);
      document.getElementById("output").value = text;
    } );
    this.new_line();
    this.key_triggered_button( "Relocate", [ "r" ], function() {
      let text = document.getElementById("input").value;
      const words = text.split(' ');
      if (words.length >= 3) {
        const x = parseFloat(words[0]);
        const y = parseFloat(words[1]);
        const z = parseFloat(words[2]);
        this.ball_location = vec3(x, y, z)
        document.getElementById("output").value = "success";
      }
      else {
        document.getElementById("output").value = "invalid input";
      }
    } );
     */
  }

  start() { // callback for Run button
    document.getElementById("output").value = "start";
    this.run = !this.run;
  }
}
