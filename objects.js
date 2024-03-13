import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, hex_color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

function symplectic_euler(cur_pos, cur_vel, f, m, ts) {
    const cur_acc = f.times(1.0 / m);
    const vel = cur_vel.plus(cur_acc.times(ts));
    const pos = cur_pos.plus(vel.times(ts));
    return { vel, pos };
}

export class Star {
    constructor(scale){
        this.scale = scale;
        this.pos = vec3(2,2,2);
        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            cone: new defs.Rounded_Closed_Cone(50,50),
        };
    }
    draw(webgl_manager, uniforms, shapes, materials){
        const star_color = hex_color("#FCF4A3");

        let star_transform = Mat4.identity();
        star_transform = star_transform
            .times(Mat4.scale(this.scale, this.scale, this.scale));

        //top point
        let point1_transform = star_transform
            .times(Mat4.rotation(Math.PI/2, -1,0,0))
            .times(Mat4.translation(0, 0, 1.15));
        //right top point
        let point2_transform = star_transform
            .times(Mat4.rotation(Math.PI/2, -1, 0, 0))
            .times(Mat4.rotation(Math.PI/3, 0, 1, 0))
            .times(Mat4.translation(0, 0, 1.15));
        //right bottom point
        let point3_transform = star_transform
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI/4, 0, 1, 0))
            .times(Mat4.translation(0, 0, 1.15));
        //left bottom point
        let point4_transform = star_transform
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI/4, 0, -1, 0))
            .times(Mat4.translation(0, 0, 1.15));
        //left top point
        let point5_transform = star_transform
            .times(Mat4.rotation(Math.PI/2, -1, 0, 0))
            .times(Mat4.rotation(Math.PI/3, 0, -1, 0))
            .times(Mat4.translation(0, 0, 1.15));

        this.shapes.sphere.draw(webgl_manager, uniforms, star_transform, { ...materials.plastic, color: star_color});
        this.shapes.cone.draw(webgl_manager, uniforms, point2_transform, { ...materials.plastic, color: star_color});
        this.shapes.cone.draw(webgl_manager, uniforms, point1_transform, { ...materials.plastic, color: star_color});
        this.shapes.cone.draw(webgl_manager, uniforms, point3_transform, { ...materials.plastic, color: star_color});
        this.shapes.cone.draw(webgl_manager, uniforms, point4_transform, { ...materials.plastic, color: star_color});
        this.shapes.cone.draw(webgl_manager, uniforms, point5_transform, { ...materials.plastic, color: star_color});
    }
};

class Particle {
    constructor(m=0, pos=vec3(0, 0, 0), vel=vec3(0, 0, 0), f=vec3(0, 0, 0)) {
      this.m = m;
      this.pos = pos;
      this.vel = vel;
      this.f = f;
      this.original_vel = vel;
      this.original_pos = pos;
    }
  
    update(ts) {
        ({ vel: this.vel, pos: this.pos } = symplectic_euler(this.pos, this.vel, this.f, this.m, ts));
        if(this.pos[1] < -10) {
          this.pos = this.original_pos;
          this.vel = this.original_vel;
        }
    }
  }

export class Bernard extends Particle {
    constructor(m=0, pos=vec3(0, 0, 0), vel=vec3(0, 0, 0), f=vec3(0, 0, 0)){
        super(m, pos, vel, f);
        // this.pos = vec3(2,1,-4);
        this.shapes = {
            sphere: new defs.Subdivision_Sphere(4),
            cylinder: new defs.Capped_Cylinder(50,50),
        };
    }
    move_left = () => {
        this.pos[0] -= 0.25;
        //this.f -= 0.25;
        console.log(this.pos);
    }

    move_right = () => {
        this.pos[0] += 0.25;
        //this.f += 0.25;
        console.log(this.pos);
    }

    draw(webgl_manager, uniforms, materials, bernard_transform){
        const body_color = hex_color("#96C38D");
        const pupil_color = hex_color("#FFFFFF");
        const eye_color = hex_color("001a00");

        let body_transform = bernard_transform
            .times(Mat4.scale(1.4, 1.4, 1.4))
            .times(Mat4.translation(0, -1.25, 0));
        let r_antenna_transform = bernard_transform
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.translation(0.5, 0, -1))
            .times(Mat4.scale(.1, .1, 1.25));
        let l_antenna_transform = bernard_transform
            .times(Mat4.rotation(Math.PI/2, 1, 0, 0))
            .times(Mat4.translation(-0.5, 0, -1))
            .times(Mat4.scale(.1, .1, 1.25));
        let ra_bulb_transform = bernard_transform
            .times(Mat4.scale(0.3, 0.3, 0.3))
            .times(Mat4.translation(1.75 ,6, 0));
        let la_bulb_transform = bernard_transform
            .times(Mat4.scale(0.3, 0.3, 0.3))
            .times(Mat4.translation(-1.75, 6, 0));
        let r_eye_transform = bernard_transform
            .times(Mat4.scale(0.25, 0.25, 0.25))
            .times(Mat4.translation(1, 1, 2.85));
        let l_eye_transform = bernard_transform
            .times(Mat4.scale(0.25, 0.25, 0.25))
            .times(Mat4.translation(-1, 1, 2.85));
        let r_pupil_transform = bernard_transform
            .times(Mat4.scale(0.1, 0.1, 0.1))
            .times(Mat4.translation(3.4,3.4,8.35));
        let l_pupil_transform = bernard_transform
            .times(Mat4.scale(0.1, 0.1, 0.1))
            .times(Mat4.translation(-2.55,3.5,8.55));
        
        this.shapes.sphere.draw(webgl_manager, uniforms, bernard_transform, {...materials.plastic, color: body_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, body_transform, {...materials.plastic, color: body_color});
        this.shapes.cylinder.draw(webgl_manager, uniforms, r_antenna_transform, {...materials.plastic, color: body_color});
        this.shapes.cylinder.draw(webgl_manager, uniforms, l_antenna_transform, {...materials.plastic, color: body_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, ra_bulb_transform, {...materials.plastic, color: body_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, la_bulb_transform, {...materials.plastic, color: body_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, r_eye_transform, {...materials.plastic, color: eye_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, l_eye_transform, {...materials.plastic, color: eye_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, r_pupil_transform, {...materials.plastic, color: pupil_color});
        this.shapes.sphere.draw(webgl_manager, uniforms, l_pupil_transform, {...materials.plastic, color: pupil_color});
    }
    
}