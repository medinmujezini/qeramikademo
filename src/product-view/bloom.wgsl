// Bloom post-processing shader with adjustable parameters

@group(0) @binding(0) var input : texture_2d<f32>;
@group(0) @binding(1) var output : texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var blurInput : texture_2d<f32>;
@group(0) @binding(3) var<uniform> settings : BloomSettings;

struct BloomSettings {
  threshold: f32,
  intensity: f32,
  radius: f32,
  _pad: f32,
}

override WorkgroupSizeX : u32;
override WorkgroupSizeY : u32;

// Extract bright pixels for bloom
@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn extractBright(@builtin(global_invocation_id) invocation_id : vec3u) {
  let color = textureLoad(input, invocation_id.xy, 0).rgb;
  let brightness = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let softThreshold = settings.threshold * 0.5;
  let contribution = smoothstep(softThreshold, settings.threshold, brightness);
  let bloomColor = color * contribution;
  textureStore(output, invocation_id.xy, vec4f(bloomColor, 1.0));
}

// Gaussian blur horizontal pass with adjustable radius
@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn blurHorizontal(@builtin(global_invocation_id) invocation_id : vec3u) {
  let weights = array<f32, 9>(0.0625, 0.09375, 0.125, 0.15625, 0.1875, 0.15625, 0.125, 0.09375, 0.0625);
  let dims = textureDimensions(input);
  let uv = vec2i(invocation_id.xy);
  let scale = i32(max(1.0, settings.radius));
  
  var result = vec3f(0.0);
  var totalWeight = 0.0;
  for (var i = -4; i <= 4; i++) {
    let offset = vec2i(i * scale, 0);
    let coord = clamp(uv + offset, vec2i(0), vec2i(dims) - 1);
    let weight = weights[i + 4];
    result += textureLoad(input, coord, 0).rgb * weight;
    totalWeight += weight;
  }
  textureStore(output, uv, vec4f(result / totalWeight, 1.0));
}

// Gaussian blur vertical pass with adjustable radius
@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn blurVertical(@builtin(global_invocation_id) invocation_id : vec3u) {
  let weights = array<f32, 9>(0.0625, 0.09375, 0.125, 0.15625, 0.1875, 0.15625, 0.125, 0.09375, 0.0625);
  let dims = textureDimensions(input);
  let uv = vec2i(invocation_id.xy);
  let scale = i32(max(1.0, settings.radius));
  
  var result = vec3f(0.0);
  var totalWeight = 0.0;
  for (var i = -4; i <= 4; i++) {
    let offset = vec2i(0, i * scale);
    let coord = clamp(uv + offset, vec2i(0), vec2i(dims) - 1);
    let weight = weights[i + 4];
    result += textureLoad(input, coord, 0).rgb * weight;
    totalWeight += weight;
  }
  textureStore(output, uv, vec4f(result / totalWeight, 1.0));
}

// Composite bloom back onto original
@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn composite(@builtin(global_invocation_id) invocation_id : vec3u) {
  let original = textureLoad(input, invocation_id.xy, 0).rgb;
  let bloom = textureLoad(blurInput, invocation_id.xy, 0).rgb;
  let result = original + bloom * settings.intensity;
  textureStore(output, invocation_id.xy, vec4f(result, 1.0));
}
