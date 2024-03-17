import { tiny, defs } from './examples/common.js';
// Pull these names into this module's scope for convenience:
const { Vector, vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export
  const Text_Line = defs.Text_Line =
    class Text_Line extends Shape {                           // **Text_Line** embeds text in the 3D world, using a crude texture
      // method.  This Shape is made of a horizontal arrangement of quads.
      // Each is textured over with images of ASCII characters, spelling
      // out a string.  Usage:  Instantiate the Shape with the desired
      // character line width.  Then assign it a single-line string by calling
      // set_string("your string") on it. Draw the shape on a material
      // with full ambient weight, and text.png assigned as its texture
      // file.  For multi-line strings, repeat this process and draw with
      // a different matrix.
      constructor(max_size) {
        super("position", "normal", "texture_coord");
        this.max_size = max_size;
        var object_transform = Mat4.identity();
        for (var i = 0; i < max_size; i++) {                                       // Each quad is a separate Square instance:
          defs.Square.insert_transformed_copy_into(this, [], object_transform);
          object_transform.post_multiply(Mat4.translation(1.5, 0, 0));
        }
      }
      set_string(line, caller) {           // set_string():  Call this to overwrite the texture coordinates buffer with new
        // values per quad, which enclose each of the string's characters.
        this.arrays.texture_coord = [];
        for (var i = 0; i < this.max_size; i++) {
          var row = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) / 16),
            col = Math.floor((i < line.length ? line.charCodeAt(i) : ' '.charCodeAt()) % 16);

          var skip = 3, size = 32, sizefloor = size - skip;
          var dim = size * 16,
            left = (col * size + skip) / dim, top = (row * size + skip) / dim,
            right = (col * size + sizefloor) / dim, bottom = (row * size + sizefloor + 5) / dim;

          this.arrays.texture_coord.push(...Vector.cast([left, 1 - bottom], [right, 1 - bottom],
            [left, 1 - top], [right, 1 - top]));
        }
        if (!this.existing) {
          this.copy_onto_graphics_card(caller.context);
          this.existing = true;
        }
        else
          this.copy_onto_graphics_card(caller.context, ["texture_coord"], false);
      }
    }


export class Text_Demo extends Component {             // **Text_Demo** is a scene with a cube, for demonstrating the Text_Line utility Shape.
  init() {
    this.shapes = { cube: new defs.Cube(), text: new Text_Line(35) };
    this.widget_options = { make_controls: false }; // Don't create any DOM elements to control this scene
    const phong = new defs.Phong_Shader();
    const texture = new defs.Textured_Phong(1);
    this.grey = {
      shader: phong, color: color(.5, .5, .5, 1), ambient: 0,
      diffusivity: .3, specularity: .5, smoothness: 10
    }
    this.text_image = {
      shader: texture, ambient: 1, diffusivity: 0, specularity: 0,
      texture: new Texture("assets/text.png")
    };
  }

  show_score_and_lives(caller, score, lives) {
    Shader.assign_camera(Mat4.look_at(...Vector.cast([0, 0, 4], [0, 0, 0], [0, 1, 0])), this.uniforms);
    this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 500);

    // Score
    this.shapes.text.set_string("Score: " + (Math.floor(score)).toString(), caller);
    this.shapes.text.draw(caller, this.uniforms, Mat4.scale(0.1, 0.1, 0.1).times(Mat4.translation(-25, 12, 0)), this.text_image);

    // Lives
    if (lives < 0) {
      lives = 0;
    }
    this.shapes.text.set_string("Lives: " + lives.toString(), caller);
    this.shapes.text.draw(caller, this.uniforms, Mat4.scale(0.1, 0.1, 0.1).times(Mat4.translation(-25, 9, 0)), this.text_image);
  }

  show_game_over_or_hit(caller, game_over) {
    Shader.assign_camera(Mat4.look_at(...Vector.cast([0, 0, 4], [0, 0, 0], [0, 1, 0])), this.uniforms);
    // this.uniforms.projection_transform = Mat4.perspective(Math.PI / 4, caller.width / caller.height, 1, 500);
    if (game_over) {
      this.shapes.text.set_string("GAME OVER", caller);
      const translation_matrix = Mat4.translation(-6, 9, 0);
      this.shapes.text.draw(caller, this.uniforms, Mat4.scale(0.1, 0.1, 0.1).times(translation_matrix), this.text_image);
    }
    else {
      this.shapes.text.set_string("Ouch!", caller);
      const translation_matrix = Mat4.translation(0, 5, 0);
      this.shapes.text.draw(caller, this.uniforms, Mat4.scale(0.1, 0.1, 0.1).times(translation_matrix), this.text_image);
    }
  }
}