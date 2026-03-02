// Comprehensive post-processing shader with all effects

@group(0) @binding(0) var input : texture_2d<f32>;
@group(0) @binding(1) var output : texture_storage_2d<{OUTPUT_FORMAT}, write>;
@group(0) @binding(2) var<uniform> settings : PostProcessSettings;

struct PostProcessSettings {
  // Color correction
  brightness: f32,
  contrast: f32,
  saturation: f32,
  gamma: f32,
  
  // Color temperature (warm/cool)
  temperature: f32,
  tint: f32,
  
  // Vignette
  vignetteIntensity: f32,
  vignetteRadius: f32,
  
  // Chromatic aberration
  chromaticAberration: f32,
  
  // Film grain
  grainIntensity: f32,
  grainSize: f32,
  
  // Sharpness
  sharpness: f32,
  
  // AA mode: 0=off, 1=FXAA, 2=SMAA-lite
  aaMode: u32,
  
  // Time for animated effects
  time: f32,
  
  // Lens distortion
  lensDistortion: f32,
}

override WorkgroupSizeX : u32;
override WorkgroupSizeY : u32;

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

fn rand(co: vec2f) -> f32 {
  return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
}

// Barrel/pincushion distortion
fn lensDistort(uv: vec2f, amount: f32) -> vec2f {
  let center = vec2f(0.5);
  let fromCenter = uv - center;
  let dist = length(fromCenter);
  let distorted = fromCenter * (1.0 + amount * dist * dist);
  return center + distorted;
}

// FXAA
fn fxaa(uv: vec2i, dims: vec2i) -> vec3f {
  let rgbNW = textureLoad(input, clamp(uv + vec2i(-1, -1), vec2i(0), dims - 1), 0).rgb;
  let rgbNE = textureLoad(input, clamp(uv + vec2i(1, -1), vec2i(0), dims - 1), 0).rgb;
  let rgbSW = textureLoad(input, clamp(uv + vec2i(-1, 1), vec2i(0), dims - 1), 0).rgb;
  let rgbSE = textureLoad(input, clamp(uv + vec2i(1, 1), vec2i(0), dims - 1), 0).rgb;
  let rgbM = textureLoad(input, uv, 0).rgb;
  
  let lumaNW = luminance(rgbNW);
  let lumaNE = luminance(rgbNE);
  let lumaSW = luminance(rgbSW);
  let lumaSE = luminance(rgbSE);
  let lumaM = luminance(rgbM);
  
  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));
  
  var dir = vec2f(
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
    ((lumaNW + lumaSW) - (lumaNE + lumaSE))
  );
  
  let dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.03125, 1.0 / 128.0);
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2f(-8.0), vec2f(8.0));
  
  let rgbA = 0.5 * (
    textureLoad(input, clamp(uv + vec2i(dir * 0.167), vec2i(0), dims - 1), 0).rgb +
    textureLoad(input, clamp(uv + vec2i(dir * -0.167), vec2i(0), dims - 1), 0).rgb
  );
  
  let rgbB = rgbA * 0.5 + 0.25 * (
    textureLoad(input, clamp(uv + vec2i(dir * 0.5), vec2i(0), dims - 1), 0).rgb +
    textureLoad(input, clamp(uv + vec2i(dir * -0.5), vec2i(0), dims - 1), 0).rgb
  );
  
  let lumaB = luminance(rgbB);
  if (lumaB < lumaMin || lumaB > lumaMax) {
    return rgbA;
  }
  return rgbB;
}

// SMAA-lite edge-aware blur
fn smaaLite(uv: vec2i, dims: vec2i) -> vec3f {
  let center = textureLoad(input, uv, 0).rgb;
  let left = textureLoad(input, clamp(uv + vec2i(-1, 0), vec2i(0), dims - 1), 0).rgb;
  let right = textureLoad(input, clamp(uv + vec2i(1, 0), vec2i(0), dims - 1), 0).rgb;
  let top = textureLoad(input, clamp(uv + vec2i(0, -1), vec2i(0), dims - 1), 0).rgb;
  let bottom = textureLoad(input, clamp(uv + vec2i(0, 1), vec2i(0), dims - 1), 0).rgb;
  
  let edgeH = abs(luminance(left) - luminance(center)) + abs(luminance(right) - luminance(center));
  let edgeV = abs(luminance(top) - luminance(center)) + abs(luminance(bottom) - luminance(center));
  
  let blend = smoothstep(0.02, 0.15, max(edgeH, edgeV));
  
  if (edgeH > edgeV) {
    return mix(center, (left + center + right) / 3.0, blend * 0.5);
  }
  return mix(center, (top + center + bottom) / 3.0, blend * 0.5);
}

@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn main(@builtin(global_invocation_id) invocation_id : vec3u) {
  let dims = vec2f(textureDimensions(input));
  let dimsI = vec2i(dims);
  var uv = vec2f(invocation_id.xy) / dims;
  let pixelCoord = vec2i(invocation_id.xy);
  
  // Lens distortion
  if (abs(settings.lensDistortion) > 0.001) {
    uv = lensDistort(uv, settings.lensDistortion * 0.5);
  }
  
  // Chromatic aberration
  var color: vec3f;
  if (settings.chromaticAberration > 0.01) {
    let center = vec2f(0.5);
    let toCenter = uv - center;
    let dist = length(toCenter);
    let aberration = toCenter * dist * settings.chromaticAberration * 0.015;
    
    let uvR = clamp(uv + aberration, vec2f(0.0), vec2f(1.0));
    let uvB = clamp(uv - aberration, vec2f(0.0), vec2f(1.0));
    
    let coordR = vec2i(uvR * dims);
    let coordG = vec2i(uv * dims);
    let coordB = vec2i(uvB * dims);
    
    color = vec3f(
      textureLoad(input, clamp(coordR, vec2i(0), dimsI - 1), 0).r,
      textureLoad(input, clamp(coordG, vec2i(0), dimsI - 1), 0).g,
      textureLoad(input, clamp(coordB, vec2i(0), dimsI - 1), 0).b
    );
  } else {
    // Apply AA if enabled
    switch (settings.aaMode) {
      case 1u: {
        color = fxaa(pixelCoord, dimsI);
      }
      case 2u: {
        color = smaaLite(pixelCoord, dimsI);
      }
      default: {
        color = textureLoad(input, pixelCoord, 0).rgb;
      }
    }
  }
  
  // Sharpening
  if (settings.sharpness > 0.01) {
    let left = textureLoad(input, clamp(pixelCoord + vec2i(-1, 0), vec2i(0), dimsI - 1), 0).rgb;
    let right = textureLoad(input, clamp(pixelCoord + vec2i(1, 0), vec2i(0), dimsI - 1), 0).rgb;
    let top = textureLoad(input, clamp(pixelCoord + vec2i(0, -1), vec2i(0), dimsI - 1), 0).rgb;
    let bottom = textureLoad(input, clamp(pixelCoord + vec2i(0, 1), vec2i(0), dimsI - 1), 0).rgb;
    let blur = (left + right + top + bottom) * 0.25;
    color = color + (color - blur) * settings.sharpness;
  }
  
  // Brightness
  color = color * settings.brightness;
  
  // Contrast
  color = (color - 0.5) * settings.contrast + 0.5;
  
  // Saturation
  let gray = luminance(color);
  color = mix(vec3f(gray), color, settings.saturation);
  
  // Color temperature
  if (abs(settings.temperature) > 0.01) {
    let temp = settings.temperature;
    color.r = color.r * (1.0 + temp * 0.1);
    color.b = color.b * (1.0 - temp * 0.1);
  }
  
  // Tint (green/magenta shift)
  if (abs(settings.tint) > 0.01) {
    color.g = color.g * (1.0 + settings.tint * 0.1);
  }
  
  // Gamma correction
  color = pow(max(color, vec3f(0.0)), vec3f(1.0 / settings.gamma));
  
  // Vignette
  if (settings.vignetteIntensity > 0.01) {
    let vignetteDist = distance(uv, vec2f(0.5)) * 2.0;
    let vignette = 1.0 - smoothstep(settings.vignetteRadius, settings.vignetteRadius + 0.5, vignetteDist) * settings.vignetteIntensity;
    color = color * vignette;
  }
  
  // Film grain
  if (settings.grainIntensity > 0.001) {
    let grainUV = uv * settings.grainSize + settings.time;
    let grain = rand(grainUV) * 2.0 - 1.0;
    color = color + grain * settings.grainIntensity;
  }
  
  // Clamp final color
  color = clamp(color, vec3f(0.0), vec3f(1.0));
  
  textureStore(output, pixelCoord, vec4f(color, 1.0));
}
