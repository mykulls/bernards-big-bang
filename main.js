import { tiny, defs } from "./examples/common.js";
import { Bernard, Star } from "./objects.js";
import { Curve_Shape, Hermite_Spline } from "./splines.js";
import { Body } from "./asteroid.js";
import { Text_Demo } from './text.js';

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
      pos[1] > platform.pos[1] - 0.5 &&
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
    this.asteroids = [];
    this.shapes = {
      subSphere: new defs.Subdivision_Sphere(1),
      rock: new defs.Rock(1),
    };
    this.shader = new defs.Fake_Bump_Map(1);
    this.material = { shader: this.shader, color: color(.4, .8, .4, 1), ambient: 0.4, specularity: 0 };
    this.text = new Text_Demo();
    this.score = 0;
    this.lives = 3;
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

  random_color() {
    return {
      ...this.material,
      color: color(0.4 + 0.4 * Math.random(), 0.4 + 0.4 * Math.random(), 0.4 + 0.4 * Math.random(), 1),
      ambient: 0.1
    }
  }

  random_shape(shape_list = this.shapes) {                                       // random_shape():  Extract a random shape from this.shapes.
    const shape_names = Object.keys(shape_list);
    return shape_list[shape_names[~~(shape_names.length * Math.random())]];
  }

  update(movementFlag, dt, collideCallback) {
    for (let i = 0; i < this.num_splines; i++) {
      this.star_list[i].pos = this.curve_pos_list[i];
    }

    this.bernard.f = get_forces(this.g, this.platforms, this.bernard);
    this.bernard.update(this.ts, movementFlag, () => { this.lives -= 1 });

    // Earn 1 point for every second alive
    this.score += 1 / 60;

    // Generate additional moving bodies if there ever aren't enough:
    while (this.asteroids.length < 3) { // Change value to increase or decrease the number of asteroids
      const initial_y_position = this.bernard.pos[1] + 15;
      const initial_x_position = this.bernard.pos[0];
      this.asteroids.push(
        new Body(
          this.random_shape(),
          this.random_color(),
          vec3(1, 1, 1)
        ).emplace(
          Mat4.translation(...vec3(initial_x_position + (Math.random() - 0.5) * 30, initial_y_position, 2)),
          vec3((Math.random() - 0.5) * 10, -Math.random() * 2, 0),
          Math.random()
        )
      );
    }

    for (let b of this.asteroids) {
      b.linear_velocity[1] += dt * -9.8;

      const leeway = 2;
      const x_collision = b.center[0] >= this.bernard.pos[0] - leeway && b.center[0] <= this.bernard.pos[0] + leeway;
      const y_collision = b.center[1] >= this.bernard.pos[1] - leeway && b.center[1] <= this.bernard.pos[1] + leeway;

      // Don't need z collision, in same plane already
      if (x_collision && y_collision) {
        collideCallback();
        this.message_timer = 25;

        console.log("collided with asteroid");
        this.lives -= 1;
        if (this.lives <= 0) {
          this.run = false;
          return;
        }

        const index = this.asteroids.indexOf(b);
        b.linear_velocity[0] += 0.5;

        const distance = Math.sqrt(
          Math.pow(b.center[0] - this.bernard.pos[0], 2) +
          Math.pow(b.center[1] - this.bernard.pos[1], 2) +
          Math.pow(b.center[2] - this.bernard.pos[2], 2)
        );
        const normal = [
          (b.center[0] - this.bernard.pos[0]) / distance,
          (b.center[1] - this.bernard.pos[1]) / distance,
          (b.center[2] - this.bernard.pos[2]) / distance
        ];
        const dot_product = normal[0] * b.linear_velocity[0] +
          normal[1] * b.linear_velocity[1] +
          normal[2] * b.linear_velocity[2];

        const factor = 0.1;
        const reflection = [
          factor * b.linear_velocity[0] - 2 * dot_product * normal[0],
          factor * b.linear_velocity[1] - 2 * dot_product * normal[1],
          factor * b.linear_velocity[2] - 2 * dot_product * normal[2]
        ];
        b.linear_velocity.set(reflection);
        this.bernard.pos = vec3(this.bernard.pos[0] - reflection[0] * 0.05, this.bernard.pos[1] - reflection[1] * 0.05, this.bernard.pos[2]);
      }
    }

    for (let b of this.asteroids) {
      b.advance(dt);
      const initial_y_position = this.bernard.pos[1] + 15;
      const initial_x_position = this.bernard.pos[0];
      if (b.center.norm() > 40) {
        b.emplace(
          Mat4.translation(...vec3(initial_x_position + (Math.random() - 0.5) * 30, initial_y_position, 2)),
          vec3(Math.random() * 5 - 2.5, -Math.random() * 2, 0),
          Math.random()
        )
      }
    }
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
      if (pos[1] < platform.pos[1]) {
        continue;
      }

      if (
        leftbody[2] < platform.pos[2] + platform.h / 2 &&
        leftbody[2] > platform.pos[2] - platform.h / 2 &&
        leftbody[0] <= platform.pos[0] + platform.w / 2 + 1 &&
        pos[0] > platform.pos[0] + platform.w / 2 + 1 &&
        Math.abs(leftbody[1] - platform.pos[1]) <= 0.1 // Check y coordinate
      ) {
        const res = "right";
        console.log("collided with the right of the platform");
        return res;
      } else if (
        rightbody[2] < platform.pos[2] + platform.h / 2 &&
        rightbody[2] > platform.pos[2] - platform.h / 2 &&
        rightbody[0] >= platform.pos[0] - platform.w / 2 - 1 &&
        pos[0] < platform.pos[0] - platform.w / 2 - 1 &&
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
      ).times(Mat4.scale(platform.w, 0.5, platform.h));
      shapes.box.draw(webgl_manager, uniforms, p1_t, {
        ...materials.platform,
      });
    });

    //draw stars
    for (let i = 0; i < this.num_splines; i++) {
      this.star_list[i].draw(webgl_manager, uniforms, shapes, materials);
    }

    // Draw each shape at its current location:
    for (let b of this.asteroids) {
      b.shape.draw(webgl_manager, uniforms, b.drawn_location, b.material);
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
        wall: new defs.Square(),
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

      //instantiate simulation
      this.simulation = new Simulation();

      const shader = this.simulation.shader;
      this.materials.platform = { shader, color: color(1, 0.5, 0.2, 1), ambient: 0.1, diffusivity: 0.9 };
      this.front_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/front.png", "LINEAR_MIPMAP_LINEAR") };
      this.left_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/left.png", "LINEAR_MIPMAP_LINEAR") };
      this.back_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/back.png", "LINEAR_MIPMAP_LINEAR") };
      this.right_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/right.png", "LINEAR_MIPMAP_LINEAR") };
      this.ball_location = vec3(1, 1, 1);
      this.ball_radius = 0.25;

      //set bernard from laura's changes
      this.simulation.set_bernard(1, -3, 4, 2, 0, 0, 0);
      this.simulation.create_platform(-3, 1, 2, 15000, 20, 3, 3);
      this.simulation.create_platform(6, 5, 2, 15000, 20, 2, 2);
      this.simulation.create_platform(13, 4, 2, 15000, 20, 2, 2);
      this.simulation.create_platform(-10, 12, 2, 15000, 20, 2, 2);
      this.simulation.create_platform(-20, 8, 2, 15000, 20, 2, 2);
      this.simulation.create_platform(-32, 4, 2, 15000, 20, 3, 3);
      this.simulation.create_platform(2, 42, 2, 15000, 20, 2, 2);



      //set bernard from michael's changes
      //this.simulation.set_bernard(1, 2, 4, 2, 1, 0, 1);
      // this.simulation.create_platform(2.5, 1, 2.5, 12500, 10);
      // this.simulation.create_platform(5, 2, 5, 12500, 10);
      this.simulation.create_stars();
      this.run = false;
      this.text = new Text_Demo();
      this.display_ouch = false;
      this.message_timer = 0;

      //instantiate star/spline vars
      this.spline_list = [];
      this.curve_fn_list = [];
      this.curve_list = [];
      for (let i = 0; i < this.simulation.num_splines; i++) {
        // add spline to spline list
        let type = i % 3;
        if (type === 0) {
          this.spline_list[i] = new Hermite_Spline();
          this.spline_list[i].add_point(20.0, 10.0 + (i * 10), 0.0, 20.0, -20.0, 0.0);
          this.spline_list[i].add_point(0.0, 5.0 + (i * 10), 0.0, -20.0, 20.0, 0.0);
          this.spline_list[i].add_point(-20.0, 0.0 + (i * 10), 0.0, -20.0, 20.0, 0.0);
        }
        else if (type === 1) {
          this.spline_list[i] = new Hermite_Spline();
          this.spline_list[i].add_point(-20.0, 5.0 + (i * 10), 0.0, 35.0, 0.0, 0.0);
          this.spline_list[i].add_point(-10.0, 8.0 + (i * 10), 0.0, 35.0, 0.0, 0.0);
          this.spline_list[i].add_point(0.0, 5.0 + (i * 10), 0.0, 35.0, 0.0, 0.0);
          this.spline_list[i].add_point(10.0, 8.0 + (i * 10), 0.0, 35.0, 0.0, 0.0);
          this.spline_list[i].add_point(20.0, 5.0 + (i * 10), 0.0, 35.0, 0.0, 0.0);
        }
        else if (type === 2) {
          this.spline_list[i] = new Hermite_Spline();
          this.spline_list[i].add_point(-20.0, 10.0 + (i * 10), 0.0, 20.0, -20.0, 0.0);
          this.spline_list[i].add_point(0.0, 5.0 + (i * 10), 0.0, 20.0, 20.0, 0.0);
          this.spline_list[i].add_point(20.0, 0.0 + (i * 10), 0.0, -20.0, 20.0, 0.0);
        }

        // add curve fn to curve fn list
        this.curve_fn_list[i] = (t) => this.spline_list[i].get_position(t);
        // add curve to curve list
        this.curve_list[i] = new Curve_Shape(this.curve_fn_list[i], 100);
      }
    }
    render_animation(caller) {
      const b_pos = this.simulation.bernard.pos;
      this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 500);
      this.uniforms.lights = [defs.Phong_Shader.light_source(vec4(0, 69, 100, 1), color(1, 1, 1, 1), 100000)];    // Slight top angle fill light

      const t = this.t = this.uniforms.animation_time / 1000;
      const angle = Math.sin(t);

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

      // Always show score in top left corner
      this.simulation.text.show_score_and_lives(caller, this.simulation.score, this.simulation.lives);

      if (this.simulation.lives <= 0) {
        this.simulation.text.show_game_over_or_hit(caller, true);
        this.run = false;
      }

      const model_transform = Mat4.identity().times(Mat4.scale(400, 400, 400));
      this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.translation(0, 0, -1)), { ...this.front_space_material });
      this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.right_space_material });
      this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(-Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.left_space_material });
      this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(Math.PI, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.back_space_material });
    }
  });

export class main extends Part_two_spring_base {
  hit_asteroid() {
    this.display_ouch = true;
  }

  render_animation(caller) {
    // Call the setup code that we left inside the base class:
    super.render_animation(caller);

    const blue = color(0, 0, 1, 1),
      yellow = color(1, 1, 0, 1);

    const t = (this.t = this.uniforms.animation_time / 1000);
    const dt = (this.dt = Math.min(
      1 / 60,
      this.uniforms.animation_delta_time / 1000
    ));
    let t_sim = (this.t_sim = t);

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
        if (res === "left" || res === "right") {
          this.simulation.update(res, dt, () => this.hit_asteroid());
        }
        else {
          this.simulation.update(this.movementFlag, dt, () => this.hit_asteroid());
        }

        this.movementFlag = "none"; //reset it
      }
    }

    // Display Ouch! message when asteroid hits Bernard
    if (this.display_ouch) {
      this.text.show_game_over_or_hit(caller, false);
      this.message_timer -= 1;
      if (this.message_timer < 0) {
        this.message_timer = 0;
        this.display_ouch = false;
      }
    }

    this.simulation.draw(caller, this.uniforms, this.shapes, this.materials);
    const b_pos = this.simulation.bernard.pos;
    Shader.assign_camera(
      Mat4.translation(-b_pos[0], -b_pos[1] - 2, -b_pos[2] - 20),
      this.uniforms
    ); // Locate the camera here (inverted matrix).
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
