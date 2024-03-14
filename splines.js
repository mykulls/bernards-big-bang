import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.
//CURVE SHAPE CLASS
export class Curve_Shape extends Shape{
  //curve_function = (t) => vec3
  constructor(curve_function, sample_count, curve_color=color(1,0,0,1)){
    super("position", "normal");

    this.material={shader: new defs.Phong_Shader(), ambient: 1.0, color: curve_color}
    this.sample_count=sample_count;

    if (curve_function && this.sample_count){
      for(let i=0; i<this.sample_count+1;i++){
        let t = i/this.sample_count;
        this.arrays.position.push(curve_function(t));
        this.arrays.normal.push(vec3(0,0,0));
      }
    }
  }
  draw(webgl_manager, uniforms){
    super.draw(webgl_manager, uniforms, Mat4.identity(), this.material, "LINE_STRIP");
  }
  update(webgl_manager, uniforms, curve_function){
    if (curve_function && this.sample_count){
      for (let i = 0; i< this.sample_count+1; i++){
        let t = 1.0*i / this.sample_count;
        this.arrays.position[i]=curve_function(t);
      }
    }
    this.copy_onto_graphics_card(webgl_manager.context);
  }
};
//SPLINE CLASS
export class Spline {
  constructor(){
    this.points = [];
    this.tangents = []; 
    this.size = 0; // aka the number of curves that make up your spline
  }
  add_point(x, y, z, tx, ty, tz){
    this.points.push(vec3(x,y,z));
    this.tangents.push(vec3(tx,ty,tz)); // this will need to be changed with hermites
    this.size+=1;
  }
  h0(t){
    return 1-t;}
  h1(t){
    return t;}
  //global t
  get_position(t){
    //check if len > 2 for this.size
    if (this.size < 2){
      return vec3(0,0,0);
    }
    // t will be a value between 0 and 1 from first point to last point
    // this is different from t in the linear interpolation equation because that describes the local t between 2 points
    // we need to find the position of t
    // A and B represents global start and end points
    const A = Math.floor(t * ((this.size) - 1));
    const B = Math.ceil(t * ((this.size) - 1));

    // we use the mod to find the local t value from the global t value
    // if t global = 0.45, 10 points we multiply by size = 4.5 mod 1 = 0.5 = local t between point 4 and point 5
    const s = (t*(this.size-1))%1.0; // s = local t and is the most important line for this part one
    let a = this.points[A].copy();
    let b = this.points[B].copy();

    //linearly interpolate using h0 and h1; with hermine spline it will be the complicated matrix equations instead of this linear interpolation
    return a.times(this.h0(s)).plus(b.times(this.h1(s)));
  }
  get_arc_length() {
    let length = 0;
    let sample_cnt = 1000;

    let prev = this.get_position(0)
    for (let i = 1; i < (sample_cnt + 1); i++) {
      const t = i / sample_cnt;
      const curr = this.get_position(t);
      length += curr.minus(prev).norm();
      prev = curr;
    }
    return length;
  }
};
//HERMITE SPLINE
export class Hermite_Spline extends Spline{
  constructor(){
    super();
  }
  add_point(x, y, z, tx, ty, tz){  //add_point stays the same
    super.add_point(x, y, z, tx, ty, tz);
  }
  get_arc_length(){
    return super.get_arc_length(); //get_arc_length stays the same
  }

  //get_position must change
  h0(t){
    return (2*t**3 - 3*t**2 + 1);}
  h00(t){
    return (t**3 - 2*t**2 + t);}
  h1(t){
    return (-2*t**3 + 3*t**2);}
  h11(t){
    return (t**3 - t**2);}
  //global t
  get_position(t){
    //check if the line has more than 2 points
    if (this.size < 2){
      return vec3(0,0,0);
    }
    // A and B represents global start and end points
    const A = Math.floor(t * ((this.size) - 1));
    const B = Math.ceil(t * ((this.size) - 1));
    // s = local t
    const s = (t*(this.size-1))%1.0; 
    let p0 = this.points[A].copy();
    let p1 = this.points[B].copy();
    let m0 = this.tangents[A].copy();
    let m1 = this.tangents[B].copy();

    //equation for hermite spline h(0)p0 + h(00)m0 + h(1)p1 + h(11)m1
    // return p0.times(this.h0(s)).plus(
    //        m0.times(
    //        this.h00(s))).plus(
    //        p1.times(this.h1(s))).plus(
    //        m1.times(
    //        this.h11(s)));
    return p0.times(this.h0(s)).plus(
          m0.times(1/(this.size-1)).times(
          this.h00(s))).plus(
          p1.times(this.h1(s))).plus(
          m1.times(1/(this.size-1)).times(
          this.h11(s)));
  }
};