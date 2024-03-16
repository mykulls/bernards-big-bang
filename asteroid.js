import { tiny, defs } from './examples/common.js';
import { Bernard } from './objects.js';
import { Text_Demo } from './text.js';

// Pull these names into this module's scope for convenience:
const { vec3, unsafe3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export
    const Body = defs.Body =
        class Body {                                   // **Body** can store and update the properties of a 3D body that incrementally
            // moves from its previous place due to velocities.  It conforms to the
            // approach outlined in the "Fix Your Timestep!" blog post by Glenn Fiedler.
            constructor(shape, material, size) {
                Object.assign(this,
                    { shape, material, size })
            }
            emplace(location_matrix, linear_velocity, angular_velocity, spin_axis = vec3(0, 0, 0).randomized(1).normalized()) {                               // emplace(): assign the body's initial values, or overwrite them.
                this.center = location_matrix.times(vec4(0, 0, 0, 1)).to3();
                this.rotation = Mat4.translation(...this.center.times(-1)).times(location_matrix);
                this.previous = { center: this.center.copy(), rotation: this.rotation.copy() };
                // drawn_location gets replaced with an interpolated quantity:
                this.drawn_location = location_matrix;
                this.temp_matrix = Mat4.identity();
                return Object.assign(this, { linear_velocity, angular_velocity, spin_axis })
            }
            advance(time_amount) {                           // advance(): Perform an integration (the simplistic Forward Euler method) to
                // advance all the linear and angular velocities one time-step forward.
                this.previous = { center: this.center.copy(), rotation: this.rotation.copy() };
                // Apply the velocities scaled proportionally to real time (time_amount):
                // Linear velocity first, then angular:
                this.center = this.center.plus(this.linear_velocity.times(time_amount));
                this.rotation.pre_multiply(Mat4.rotation(time_amount * this.angular_velocity, ...this.spin_axis));
            }
            blend_rotation(alpha) {                        // blend_rotation(): Just naively do a linear blend of the rotations, which looks
                // ok sometimes but otherwise produces shear matrices, a wrong result.

                // TODO:  Replace this function with proper quaternion blending, and perhaps
                // store this.rotation in quaternion form instead for compactness.
                return this.rotation.map((x, i) => vec4(...this.previous.rotation[i]).mix(x, alpha));
            }
            blend_state(alpha) {                             // blend_state(): Compute the final matrix we'll draw using the previous two physical
                // locations the object occupied.  We'll interpolate between these two states as
                // described at the end of the "Fix Your Timestep!" blog post.
                this.drawn_location = Mat4.translation(...this.previous.center.mix(this.center, alpha))
                    .times(this.blend_rotation(alpha))
                    .times(Mat4.scale(...this.size));
            }
            // The following are our various functions for testing a single point,
            // p, against some analytically-known geometric volume formula
            // (within some margin of distance).
            static intersect_cube(p, margin = 0) {
                return p.every(value => value >= -1 - margin && value <= 1 + margin)
            }
            static intersect_sphere(p, margin = 0) {
                return p.dot(p) < 1 + margin;
            }
            check_if_colliding(b, collider) {                                     // check_if_colliding(): Collision detection function.
                // DISCLAIMER:  The collision method shown below is not used by anyone; it's just very quick
                // to code.  Making every collision body an ellipsoid is kind of a hack, and looping
                // through a list of discrete sphere points to see if the ellipsoids intersect is *really* a
                // hack (there are perfectly good analytic expressions that can test if two ellipsoids
                // intersect without discretizing them into points).
                if (this == b)
                    return false;                     // Nothing collides with itself.
                // Convert sphere b to the frame where a is a unit sphere:
                const T = this.inverse.times(b.drawn_location, this.temp_matrix);

                const { intersect_test, points, leeway } = collider;
                // For each vertex in that b, shift to the coordinate frame of
                // a_inv*b.  Check if in that coordinate frame it penetrates
                // the unit sphere at the origin.  Leave some leeway.
                return points.arrays.position.some(p =>
                    intersect_test(T.times(p.to4(1)).to3(), leeway));
            }
        }


export
    const Simulation = defs.Simulation =
        class Simulation extends Component {
            // **Simulation** manages the stepping of simulation time.  Subclass it when making
            // a Component that is a physics demo.  This technique is careful to totally decouple
            // the simulation from the frame rate (see below).
            time_accumulator = 0;
            time_scale = 1;
            t = 0;
            dt = 1 / 20;
            bodies = [];
            steps_taken = 0;
            simulate(frame_time) {                                     // simulate(): Carefully advance time according to Glenn Fiedler's
                // "Fix Your Timestep" blog post.
                // This line gives ourselves a way to trick the simulator into thinking
                // that the display framerate is running fast or slow:
                frame_time = this.time_scale * frame_time;

                // Avoid the spiral of death; limit the amount of time we will spend
                // computing during this timestep if display lags:
                this.time_accumulator += Math.min(frame_time, 0.1);
                // Repeatedly step the simulation until we're caught up with this frame:
                while (Math.abs(this.time_accumulator) >= this.dt) {                                                       // Single step of the simulation for all bodies:
                    this.update_state(this.dt);
                    for (let b of this.bodies)
                        b.advance(this.dt);
                    // Following the advice of the article, de-couple
                    // our simulation time from our frame rate:
                    this.t += Math.sign(frame_time) * this.dt;
                    this.time_accumulator -= Math.sign(frame_time) * this.dt;
                    this.steps_taken++;
                }
                // Store an interpolation factor for how close our frame fell in between
                // the two latest simulation time steps, so we can correctly blend the
                // two latest states and display the result.
                let alpha = this.time_accumulator / this.dt;
                for (let b of this.bodies) b.blend_state(alpha);
            }
            render_controls() {                       // render_controls(): Create the buttons for interacting with simulation time.
                this.key_triggered_button("Speed up time", ["Shift", "T"], () => this.time_scale *= 5);
                this.key_triggered_button("Slow down time", ["t"], () => this.time_scale /= 5); this.new_line();
                this.live_string(box => { box.textContent = "Time scale: " + this.time_scale }); this.new_line();
                this.live_string(box => { box.textContent = "Fixed simulation time step size: " + this.dt }); this.new_line();
                this.live_string(box => { box.textContent = this.steps_taken + " timesteps were taken so far." });
            }
            render_animation(caller) {                                     // display(): advance the time and state of our whole simulation.
                if (this.uniforms.animate)
                    this.simulate(this.uniforms.animation_delta_time);
                // Draw each shape at its current location:
                for (let b of this.bodies)
                    b.shape.draw(caller, this.uniforms, b.drawn_location, b.material);
            }
            update_state(dt)      // update_state(): Your subclass of Simulation has to override this abstract function.
            { throw "Override this" }
        }


export
    const Test_Data = defs.Test_Data =
        class Test_Data {                             // **Test_Data** pre-loads some Shapes that other Scenes can borrow.
            constructor() {
                this.shapes = {
                    subSphere: new defs.Subdivision_Sphere(1),
                    rock: new defs.Rock(1),
                    wall: new defs.Square(),
                };
            }
            random_shape(shape_list = this.shapes) {                                       // random_shape():  Extract a random shape from this.shapes.
                const shape_names = Object.keys(shape_list);
                const first_two_shapes = shape_names.slice(0, 2);
                return shape_list[first_two_shapes[~~(first_two_shapes.length * Math.random())]];
            }
        }

export class Asteroid extends Simulation {                                           // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    init() {
        this.data = new Test_Data();
        this.shapes = { ...this.data.shapes };
        this.shapes.square = new defs.Square();
        this.shapes.platform = new defs.Cube();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        const shader = new defs.Fake_Bump_Map(1);
        this.material = { shader, color: color(.4, .8, .4, 1), ambient: 0.4, specularity: 0 };
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color(.9, .5, .9, 1) }
        this.materials.metal = { shader: phong, ambient: .2, diffusivity: 1, specularity: 1, color: color(.9, .5, .9, 1) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture("assets/rgb.jpg") }
        this.platform_material = { shader, color: color(1, 0.5, 0.2, 1), ambient: 0.1, diffusivity: 0.9 };
        this.front_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/front.png", "LINEAR_MIPMAP_LINEAR") };
        this.left_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/left.png", "LINEAR_MIPMAP_LINEAR") };
        this.back_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/back.png", "LINEAR_MIPMAP_LINEAR") };
        this.right_space_material = { shader, color: color(0, 0, 0, 1), ambient: 1, diffusivity: 0.1, specularity: 0.1, texture: new Texture("./assets/right.png", "LINEAR_MIPMAP_LINEAR") };

        this.bernard = new Bernard(1, vec3(0, 12, 0), vec3(0, 0, 0));

        this.text = new Text_Demo();
        this.display_ouch = false;
        this.message_timer = 0;
        this.score = 0;
        this.lives = 3;
    }
    random_color() {
        return {
            ...this.material,
            color: color(0.4 + 0.4 * Math.random(), 0.4 + 0.4 * Math.random(), 0.4 + 0.4 * Math.random(), 1),
            ambient: 0.1
        }
    }
    lose_game() {
        this.text.show_game_over_or_hit(this, true);
        return;
    }
    update_state(dt) {                 // update_state():  Override the base time-stepping code to say what this particular
        // scene should do to its bodies every frame -- including applying forces.

        // Game over
        if (this.lives <= 0) {
            this.lose_game();
            return;
        }

        // Create the platform
        const platform_size = vec3(10, 1, 5);
        const platform_position = vec3(0, 5, 0);
        const platform = new Body(this.shapes.platform, this.platform_material, platform_size)
            .emplace(Mat4.translation(...platform_position), vec3(0, 0, 0), vec3(0, 0, 0));

        // Update the platform state
        platform.advance(dt);
        platform.blend_state(1);

        // Earn 1 point for every second alive
        this.score += dt;

        // Generate additional moving bodies if there ever aren't enough:
        while (this.bodies.length < 3) { // Change value to increase or decrease the number of asteroids
            const initial_y_position = 30;
            this.bodies.push(
                new Body(
                    this.data.random_shape(),
                    this.random_color(),
                    vec3(2, 2 + Math.random(), 2)
                ).emplace(
                    Mat4.translation(...vec3(0, initial_y_position, 0).randomized(10)),
                    vec3(0, -1, 0).randomized(2).normalized().times(3),
                    Math.random()
                )
            );
        }

        for (let b of this.bodies) {
            b.linear_velocity[1] += dt * -9.8;

            // If about to fall through the floor, reverse y velocity
            if (b.center[1] < -8 && b.linear_velocity[1] < 0) {
                b.linear_velocity[1] *= -0.5;  // Bounce factor
            }

            // Check for collision with the platform
            if (
                b.center[1] - b.size[1] / 2 < platform.center[1] + platform.size[1] / 2 &&
                b.center[1] + b.size[1] / 2 > platform.center[1] - platform.size[1] / 2 &&
                b.center[0] - b.size[0] / 2 < platform.center[0] + platform.size[0] / 2 + 4.5 &&
                b.center[0] + b.size[0] / 2 > platform.center[0] - platform.size[0] / 2 - 4.5 &&
                b.center[2] - b.size[2] / 2 < platform.center[2] + platform.size[2] / 2 + 2 &&
                b.center[2] + b.size[2] / 2 > platform.center[2] - platform.size[2] / 2 - 2 &&
                b.linear_velocity[1] < 0
            ) {
                b.linear_velocity[1] *= -0.5;  // Bounce factor
            }

            const leeway = 3;
            const x_collision = b.center[0] >= this.bernard.pos[0] - leeway && b.center[0] <= this.bernard.pos[0] + leeway;
            const y_collision = b.center[1] >= this.bernard.pos[1] - leeway && b.center[1] <= this.bernard.pos[1] + leeway;
            const z_collision = b.center[2] >= this.bernard.pos[2] - leeway && b.center[2] <= this.bernard.pos[2] + leeway;

            if (x_collision && y_collision && z_collision) { // Bernard hit by asteroid
                this.lives -= 1;
                this.display_ouch = true;
                this.message_timer = 25;

                if (this.lives <= 0) {
                    this.lose_game();
                }

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
                this.bernard.pos[0] -= reflection[0] * factor;
                // this.bernard.pos[1] -= reflection[1] * factor;
                this.bernard.pos[2] -= reflection[2] * factor;

                if (this.bernard.pos[1] < -8) {
                    this.bernard.pos[1] = -8;
                }

                if (this.bernard.pos[1] <= 5) {
                    this.bernard.pos[1] = 5;
                }
            }
        }

        // Delete bodies that stray too far away:
        this.bodies = this.bodies.filter(b => b.center.norm() < 50);
    }

    render_animation(caller) {                                 // display(): Draw everything else in the scene besides the moving bodies.
        super.render_animation(caller);
        const b_pos = this.bernard.pos;

        if (!caller.controls) {
            this.animated_children.push(caller.controls = new defs.Movement_Controls({ uniforms: this.uniforms }));
            caller.controls.add_mouse_controls(caller.canvas);
        }
        // Set camera to point relative to Bernard's y position
        Shader.assign_camera(Mat4.translation(-b_pos[0], -b_pos[1] - 5, -50), this.uniforms);    // Locate the camera here (inverted matrix).
        this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 500);
        this.uniforms.lights = [defs.Phong_Shader.light_source(vec4(0, 69, 100, 1), color(1, 1, 1, 1), 100000)];    // Slight top angle fill light

        // Draw the ground
        this.shapes.square.draw(caller, this.uniforms, Mat4.translation(0, -10, 0)
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(100, 100, 1)),
            { ...this.material });

        // Draw the platform
        this.shapes.platform.draw(caller, this.uniforms,
            Mat4.translation(0, 5, 0).times(Mat4.scale(10, 1, 5)),
            { ...this.platform_material });

        // Display Ouch! message when asteroid hits Bernard
        if (this.display_ouch) {
            this.text.show_game_over_or_hit(caller, false);
            this.message_timer -= 1;
            if (this.message_timer < 0) {
                this.message_timer = 0;
                this.display_ouch = false;
            }
        }

        // Always show score in top left corner
        this.text.show_score_and_lives(this, this.score, this.lives);

        // Draw Bernard
        const b_transform = Mat4.scale(2, 2, 2).pre_multiply(Mat4.translation(b_pos[0], b_pos[1], b_pos[2]));
        this.bernard.draw(caller, this.uniforms, this.materials, b_transform);

        let model_transform = Mat4.identity().times(Mat4.scale(400, 400, 400));
        this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.translation(0, 0, -1)), { ...this.front_space_material });
        this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.right_space_material });
        this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(-Math.PI / 2, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.left_space_material });
        this.shapes.wall.draw(caller, this.uniforms, model_transform.times(Mat4.rotation(Math.PI, 0, 1, 0)).times(Mat4.translation(0, 0, -1)), { ...this.back_space_material });
    }
}
