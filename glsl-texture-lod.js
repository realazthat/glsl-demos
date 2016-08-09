/**
 * Demonstrate/sandbox on how to use texture2DLodEXT in webgl/regl
 */

const range = require('array-range');
const quad = require('glsl-quad');
const resl = require('resl');
const regl = require('regl')({
  extensions: ['OES_texture_float', 'EXT_shader_texture_lod'],
  // TODO: FIXME: dunno why we need this here, we do not read non-uint8 data from screen,
  // but it fails without this on gh-pages for some reason.
  attributes: {preserveDrawingBuffer: true},
  profile: true
});





function extractMiplevel({regl, texture, level,
                          outFbo, outViewport = null,
                          components = 'rgba', type = 'vec4'}) {
  console.log('regl.limits:',regl.limits);
  
  let frag = `
    #extension GL_EXT_shader_texture_lod : require
    precision highp float;

    varying vec2 v_uv;
    uniform float u_level;
    uniform sampler2D u_tex;

    void main () {
      ${type} result = texture2DLodEXT(u_tex, v_uv, u_level).${components};
      
      //${type} result = texture2D(u_tex, v_uv).${components};

      //gl_FragColor.${components} = vec4(vec3(u_level)/10.0,1);
      //gl_FragColor.${components} = result - texture2D(u_tex, v_uv).${components};
      gl_FragColor.${components} = result;
    }
  `;
  let draw = regl({
    vert: quad.shader.vert,
    frag: frag,
    attributes: {
      a_position: quad.verts,
      a_uv: quad.uvs
    },
    elements: quad.indices,
    uniforms: {
      u_tex: regl.prop('texture'),
      u_clip_y: 1,
      u_level: regl.prop('level')
    },
    framebuffer: regl.prop('fbo')
  });


  draw({texture, fbo: outFbo, level});
}

let draw = regl({
  vert: quad.shader.vert,
  frag: quad.shader.frag,
  attributes: {
    a_position: quad.verts,
    a_uv: quad.uvs
  },
  elements: quad.indices,
  uniforms: {
    u_tex: regl.prop('texture'),
    u_clip_y: 1
  },
  viewport: regl.prop('viewport')
});

resl({
  manifest: {
    texture: {
      type: 'image',
      src: 'https://raw.githubusercontent.com/realazthat/glsl-gaussian/master/assets/Storm%20Cell%20Over%20the%20Southern%20Appalachian%20Mountains-dsc_2303_0-256x256.png',
      parser: (data) => regl.texture({
        data: data,
        mag: 'nearest',
        min: 'mipmap',
        flipY: true,
        mipmap: 'nice'
      })
    }
  },
  onDone: ({texture}) => {
    
    let L = Math.ceil(Math.max(Math.log2(texture.width), Math.log2(texture.height)));
  
    function makeUint8Fbo ({width, height}) {
      return regl.framebuffer({
        color: regl.texture({
          width: width,
          height: height,
          stencil: false,
          format: 'rgba',
          type: 'uint8',
          depth: false,
          wrap: 'clamp',
          mag: 'nearest',
          min: 'nearest'
        }),
        width: width,
        height: height,
        depth: false,
        stencil: false,
        depthStencil: false,
        depthTexture: false,
        colorType: 'uint8',
        colorFormat: 'rgba'
      });
    }
  
    let scaledFbos = range(L + 1).map(function (level) {
      // level 1 should have a mipmap size of 2^(L-1)
      // level 2 should have a mipmap size of 2^(L-2)
      let mipmapSize = 1 << (L - level);

      return makeUint8Fbo({width: mipmapSize, height: mipmapSize});
    });
  
    for (let levelZeroOnly of [false, true]) {
      for (let level = 1; level < L + 1; ++level) {
        // level 1 should have a mipmap size of 2^(L-1)
        // level 2 should have a mipmap size of 2^(L-2)
        let mipmapSize = 1 << (L - level);

        let scaledFbo = scaledFbos[level];
        extractMiplevel({texture, regl, outFbo: scaledFbo, level: levelZeroOnly ? 0 : level});
      }


      let viewport = {
        x: levelZeroOnly ? 0 : 1 << L,
        y: 0,
        width: 1 << L,
        height: 1 << L
      };
      for (let level = 1; level < L + 1; ++level) {
        let lastMipmapSize = 1 << (L - (level - 1));
        let mipmapSize = 1 << (L - level);

        viewport.y += lastMipmapSize;
        viewport.width = mipmapSize;
        viewport.height = mipmapSize;
        draw({
          texture: scaledFbos[level].color[0],
          viewport: viewport
        });
      }
    }
  }
});

