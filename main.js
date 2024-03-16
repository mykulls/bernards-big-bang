import { tiny, defs } from "./examples/common.js";
import { Bernard, Star, symplectic_euler } from "./objects.js";
import { Curve_Shape, Spline, Hermite_Spline } from "./splines.js";

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } =
  tiny;

function platform_forces(platforms, pos, vel) {
  let f_n = vec3(0, 0, 0);
  const platform_n = vec3(0, 1, 0);
  pos = pos.plus(vec3(0, -1.25, 0));

  for (const platform of platforms) {
    const signed_dist = pos.minus(platform.pos).dot(platform_n);

    if (
      signed_dist < 0 &&
      pos[2] < platform.pos[2] + platform.h &&
      pos[2] > platform.pos[2] - platform.h &&
      pos[0] >= platform.pos[0] - platform.w &&
      pos[0] <= platform.pos[0] + platform.w
    ) {
      // particle below ground and within platform and intersects from top
      const platform_fric_dir = vel.times(-1).normalized();
      const spring_f = platform_n.times(-signed_dist).times(platform.ks);
      const damper_f = platform_fric_dir
        .times(vel.dot(platform_fric_dir))
        .times(platform.kd);
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
  constructor(pos = vec3(1, 1, 1), ks = 0, kd = 0, w = 5, h = 1) {
    this.pos = pos;
    this.ks = ks;
    this.kd = kd;
    this.w = w;
    this.h = h;
  }
}

class Simulation {
  constructor(platforms = [], ts = 1.0 / 60, g = vec3(0, -9.8, 0)) {
    this.platforms = platforms;
    this.bernard = null;
    this.ts = ts;
    this.movementFlag = "none";
    this.g = g; // should only set the y direction
    this.num_splines = 20;
    this.curve_pos_list = [];
    this.star_list = [];
  }

  set_bernard(m, x, y, z, vx, vy, vz) {
    this.bernard = new Bernard(m, vec3(x, y, z), vec3(vx, vy, vz));
  }

  create_platform(x, y, z, ks, kd, w, h) {
    this.platforms.push(new Platform(vec3(x, y, z), ks, kd, w, h));
  }

  create_stars() {
    for (let i = 0; i < this.num_splines; i++) {
      this.star_list[i] = new Star(0.5);
    }
  }

  update(movementFlag) {
    for (let i = 0; i < this.num_splines; i++) {
      this.star_list[i].pos = this.curve_pos_list[i];
    }

    this.bernard.f = get_forces(this.g, this.platforms, this.bernard);
    this.bernard.update(this.ts, movementFlag);
  }

  collision() {
    // bernard's comparison points
    const platform_n = vec3(0, 1, 0);
    const pos = this.bernard.pos;
    const lefthead = pos.plus(vec3(-0.5, 0, 0));
    const leftbody = pos.plus(vec3(-0.75, -1.25, 0));
    const righthead = pos.plus(vec3(0.5, 0, 0));
    const rightbody = pos.plus(vec3(0.75, -1.25, 0));
    const tophead = pos.plus(vec3(0, 0.5, 0));

    // Collision with platforms
    for (const platform of this.platforms) {
      // const signed_dist = pos.minus(platform.pos).dot(platform_n);
      // console.log(signed_dist);

      if (
        leftbody[2] < platform.pos[2] + platform.h &&
        leftbody[2] > platform.pos[2] - platform.h &&
        leftbody[0] >= platform.pos[0] + platform.w &&
        pos[0] >  platform.pos[0] &&
        Math.abs(leftbody[1] - platform.pos[1]) <= 0.1 // Check y coordinate
      ) {
        const res = "right";
        console.log("collided with the right of the platform");
        return res;
      } else if (
        rightbody[2] < platform.pos[2] + platform.h &&
        rightbody[2] > platform.pos[2] - platform.h &&
        rightbody[0] >= platform.pos[0] - platform.w &&
        pos[0] <  platform.pos[0] &&
        Math.abs(rightbody[1] - platform.pos[1]) <= 0.1 // Check y coordinate
      ) {
        console.log("collided with the left of the platform");
        const res = "left";
        return res;
      }
    }

  }

  draw(webgl_manager, uniforms, shapes, materials) {
    const red = color(1, 0, 0, 1);

    const b_pos = this.bernard.pos;
    const b_transform = Mat4.scale(0.5, 0.5, 0.5).pre_multiply(
      Mat4.translation(b_pos[0], b_pos[1], b_pos[2])
    );
    this.bernard.draw(webgl_manager, uniforms, materials, b_transform);

    this.platforms.forEach((platform) => {
      // !!! Draw platform
      const p1_t = Mat4.translation(
        platform.pos[0],
        platform.pos[1],
        platform.pos[2]
      ).times(Mat4.scale(platform.w, 0.1, platform.h));
      shapes.box.draw(webgl_manager, uniforms, p1_t, {
        ...materials.plastic,
        color: red,
      });
    });

    //draw stars
    for (let i = 0; i < this.num_splines; i++) {
      this.star_list[i].draw(webgl_manager, uniforms, shapes, materials);
    }
  }
}

export const Part_two_spring_base =
  (defs.Part_two_spring_base = class Part_two_spring_base extends Component {
    init() {
      console.log("init");

      // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
      this.hover = this.swarm = false;

      this.shapes = {
        box: new defs.Cube(),
        ball: new defs.Subdivision_Sphere(4),
        axis: new defs.Axis_Arrows(),
      };

      const phong = new defs.Phong_Shader();
      const tex_phong = new defs.Textured_Phong();
      this.materials = {};
      this.materials.plastic = {
        shader: phong,
        ambient: 0.2,
        diffusivity: 1,
        specularity: 0.5,
        color: color(0.9, 0.5, 0.9, 1),
      };
      this.materials.metal = {
        shader: phong,
        ambient: 0.2,
        diffusivity: 1,
        specularity: 1,
        color: color(0.9, 0.5, 0.9, 1),
      };
      this.materials.rgb = {
        shader: tex_phong,
        ambient: 0.5,
        texture: new Texture("assets/rgb.jpg"),
      };

      this.ball_location = vec3(1, 1, 1);
      this.ball_radius = 0.25;
      
        //instantiate simulation
        this.simulation = new Simulation();
        //set bernard from laura's changes
        this.simulation.set_bernard(1, -3, 4, 2, 0, 0, 0);
        this.simulation.create_platform(-5, 1, 2, 15000, 20, 5, 5);
        this.simulation.create_platform(5, 2, 5, 15000, 20, 5, 5);
        //set bernard from michael's changes
        //this.simulation.set_bernard(1, 2, 4, 2, 1, 0, 1);
        // this.simulation.create_platform(2.5, 1, 2.5, 12500, 10);
        // this.simulation.create_platform(5, 2, 5, 12500, 10);
        this.simulation.create_stars();
        this.run = false;
        
        //instantiate star/spline vars
        this.spline_list = [];
        this.curve_fn_list = [];
        this.curve_list = [];
        for (let i = 0; i < this.simulation.num_splines; i++){
          // add spline to spline list
          let type = i % 3;
          if (type === 0){
            this.spline_list[i] = new Hermite_Spline();
            this.spline_list[i].add_point( 20.0, 10.0+(i*10), 0.0, 20.0, -20.0, 0.0);
            this.spline_list[i].add_point( 0.0,  5.0+(i*10), 0.0, -20.0, 20.0, 0.0);
            this.spline_list[i].add_point( -20.0, 0.0+(i*10), 0.0, -20.0, 20.0, 0.0);
          }
          else if (type === 1){
            this.spline_list[i] = new Hermite_Spline();
            this.spline_list[i].add_point( -20.0, 5.0+(i*10), 0.0, 35.0, 0.0, 0.0);
            this.spline_list[i].add_point( -10.0, 8.0+(i*10), 0.0, 35.0, 0.0, 0.0);
            this.spline_list[i].add_point( 0.0, 5.0+(i*10), 0.0, 35.0, 0.0, 0.0);
            this.spline_list[i].add_point( 10.0, 8.0+(i*10), 0.0, 35.0, 0.0, 0.0);
            this.spline_list[i].add_point( 20.0, 5.0+(i*10), 0.0, 35.0, 0.0, 0.0);
          }
          else if (type === 2){
            this.spline_list[i] = new Hermite_Spline();
            this.spline_list[i].add_point( -20.0, 10.0+(i*10), 0.0, 20.0, -20.0, 0.0);
            this.spline_list[i].add_point( 0.0,  5.0+(i*10), 0.0, 20.0, 20.0, 0.0);
            this.spline_list[i].add_point( 20.0, 0.0+(i*10), 0.0, -20.0, 20.0, 0.0);
          }

          // add curve fn to curve fn list
          this.curve_fn_list[i] = (t) => this.spline_list[i].get_position(t);
          // add curve to curve list
          this.curve_list[i] = new Curve_Shape(this.curve_fn_list[i], 100);
        }
      }
      render_animation( caller )
      {                                             
        const b_pos = this.simulation.bernard.pos;

        if (!caller.controls) {
            Shader.assign_camera(Mat4.translation(0, -b_pos[1]-5, -50), this.uniforms);    // Locate the camera here (inverted matrix).
        }
        this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 500);
        this.uniforms.lights = [defs.Phong_Shader.light_source(vec4(0, 69, 100, 1), color(1, 1, 1, 1), 100000)];    // Slight top angle fill light

        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

      this.uniforms.projection_transform = Mat4.perspective(
        Math.PI / 4,
        caller.width / caller.height,
        1,
        500
      );
      this.uniforms.lights = [
        defs.Phong_Shader.light_source(
          vec4(0, 69, 100, 1),
          color(1, 1, 1, 1),
          100000
        ),
      ]; // Slight top angle fill light

      this.shapes.axis.draw(
        caller,
        this.uniforms,
        Mat4.identity(),
        this.materials.rgb
      );
    }
  });

export class main extends Part_two_spring_base {
  render_animation(caller) {
    // Call the setup code that we left inside the base class:
    super.render_animation(caller);

    const b_pos = this.simulation.bernard.pos;
    Shader.assign_camera(
      Mat4.translation(-b_pos[0], -b_pos[1] - 2.5, -b_pos[2] - 20),
      this.uniforms
    ); // Locate the camera here (inverted matrix).
    const blue = color(0, 0, 1, 1),
      yellow = color(1, 1, 0, 1);

    const t = (this.t = this.uniforms.animation_time / 1000);
    const dt = (this.dt = Math.min(
      1 / 60,
      this.uniforms.animation_delta_time / 1000
    ));
    let t_sim = (this.t_sim = t);

    // // !!! Draw ground
    // let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    // this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // // !!! Draw ball (for reference)
    // let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
    //     .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    // this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

    // draw the star curves
    // for (let i = 0; i < this.simulation.num_splines; i++){
    //   this.curve_list[i].draw(caller, this.uniforms);
    // }

    if (this.run) {
      const t_next = t_sim + dt;
      for (; this.t_sim <= t_next; this.t_sim += this.simulation.ts) {
        // curves for stars
        this.simulation.curve_pos_list = [];
        for (let i = 0; i < this.simulation.num_splines; i++) {
          const curve_sample_t = 0.5 * (Math.sin(t_sim + 10 * i) + 1);
          this.simulation.curve_pos_list[i] =
            this.spline_list[i].get_position(curve_sample_t);
        }
        const res = this.simulation.collision();
        if (res === "left" || res ==="right") {
          this.simulation.update(res);
        }
        this.simulation.update(this.movementFlag);
        this.movementFlag = "none"; //reset it
      }
    }
    this.simulation.draw(caller, this.uniforms, this.shapes, this.materials);
  }

  render_controls() {
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Platforms:";
    this.new_line();
    this.key_triggered_button("Run", ["r"], this.start);
    this.new_line();

    // Define callback functions for moving left and right
    const moveLeft = () => {
      // console.log("move left")
      this.movementFlag = "left";
    };
    const moveRight = () => {
      this.movementFlag = "right";
    };

    // Bind the callback functions to the buttons with key bindings
    this.key_triggered_button("Move Left", ["a"], moveLeft);
    this.key_triggered_button("Move Right", ["d"], moveRight);
  }

  start() {
    // callback for Run button
    this.run = !this.run;
  }
}
