// ==========================================
// PBR Raytracer Shader
// Implements physically-based rendering with:
// - Albedo (base color)
// - Normal mapping
// - Roughness
// - Metallic
// - Ambient Occlusion
// - Height/Parallax mapping
// ==========================================

// The lightmap data
@group(1) @binding(0) var lightmap : texture_2d_array<f32>;

// The sampler used to sample the lightmap
@group(1) @binding(1) var smpl : sampler;

// The output framebuffer
@group(1) @binding(2) var framebuffer : texture_storage_2d<rgba16float, write>;

// PBR Textures
@group(1) @binding(3) var albedo_texture : texture_2d<f32>;
@group(1) @binding(4) var normal_texture : texture_2d<f32>;
@group(1) @binding(5) var arm_texture : texture_2d<f32>;  // R=AO, G=Roughness, B=Metallic
@group(1) @binding(6) var height_texture : texture_2d<f32>;

// PBR sampler (repeating)
@group(1) @binding(7) var pbr_sampler : sampler;

override WorkgroupSizeX : u32;
override WorkgroupSizeY : u32;

// PBR Configuration
const NumReflectionRays = 8;
const TextureTilingScale = 2.0;
const ParallaxScale = 0.03;
const ParallaxMinLayers = 8.0;
const ParallaxMaxLayers = 32.0;

// Fresnel reflectance at normal incidence for dielectrics
const F0_DIELECTRIC = vec3f(0.04, 0.04, 0.04);

// ==========================================
// PBR Material Sampling
// ==========================================

// Check if quad uses the PBR material texture
fn quad_uses_material(quad_idx: u32) -> bool {
  return quads[quad_idx].emissive > 0.0;
}

// Get the actual emissive value
fn get_emissive(quad_idx: u32) -> f32 {
  let raw = quads[quad_idx].emissive;
  return max(0.0, abs(raw) - 0.001);
}

// Sample albedo texture with tiling
fn sample_albedo(uv: vec2f) -> vec3f {
  let tiled_uv = uv * TextureTilingScale;
  return textureSampleLevel(albedo_texture, pbr_sampler, tiled_uv, 0.0).rgb;
}

// Sample normal map and convert from tangent space
fn sample_normal(uv: vec2f) -> vec3f {
  let tiled_uv = uv * TextureTilingScale;
  let n = textureSampleLevel(normal_texture, pbr_sampler, tiled_uv, 0.0).rgb;
  // Convert from [0,1] to [-1,1]
  return normalize(n * 2.0 - 1.0);
}

// Sample ARM texture (AO, Roughness, Metallic)
fn sample_arm(uv: vec2f) -> vec3f {
  let tiled_uv = uv * TextureTilingScale;
  return textureSampleLevel(arm_texture, pbr_sampler, tiled_uv, 0.0).rgb;
}

// Sample height map for parallax
fn sample_height(uv: vec2f) -> f32 {
  let tiled_uv = uv * TextureTilingScale;
  return textureSampleLevel(height_texture, pbr_sampler, tiled_uv, 0.0).r;
}

// ==========================================
// Parallax Occlusion Mapping
// ==========================================

fn parallax_mapping(uv: vec2f, view_dir: vec3f, normal: vec3f) -> vec2f {
  // Calculate number of layers based on viewing angle
  let num_layers = mix(ParallaxMaxLayers, ParallaxMinLayers, abs(dot(vec3f(0.0, 0.0, 1.0), view_dir)));
  let layer_depth = 1.0 / num_layers;
  var current_layer_depth = 0.0;
  
  // Calculate the amount to shift UV coordinates per layer
  let p = view_dir.xy / view_dir.z * ParallaxScale;
  let delta_uv = p / num_layers;
  
  var current_uv = uv * TextureTilingScale;
  var current_height = sample_height(current_uv / TextureTilingScale);
  
  // Steep parallax mapping
  for (var i = 0u; i < u32(num_layers); i++) {
    if (current_layer_depth >= current_height) {
      break;
    }
    current_uv -= delta_uv;
    current_height = sample_height(current_uv / TextureTilingScale);
    current_layer_depth += layer_depth;
  }
  
  // Parallax occlusion mapping interpolation
  let prev_uv = current_uv + delta_uv;
  let after_depth = current_height - current_layer_depth;
  let before_depth = sample_height((current_uv + delta_uv) / TextureTilingScale) - current_layer_depth + layer_depth;
  
  let weight = after_depth / (after_depth - before_depth);
  let final_uv = prev_uv * weight + current_uv * (1.0 - weight);
  
  return final_uv / TextureTilingScale;
}

// ==========================================
// PBR BRDF Functions
// ==========================================

// Fresnel-Schlick approximation
fn fresnel_schlick(cos_theta: f32, f0: vec3f) -> vec3f {
  return f0 + (1.0 - f0) * pow(saturate(1.0 - cos_theta), 5.0);
}

// Fresnel-Schlick with roughness for IBL
fn fresnel_schlick_roughness(cos_theta: f32, f0: vec3f, roughness: f32) -> vec3f {
  return f0 + (max(vec3f(1.0 - roughness), f0) - f0) * pow(saturate(1.0 - cos_theta), 5.0);
}

// GGX/Trowbridge-Reitz Normal Distribution Function
fn distribution_ggx(n: vec3f, h: vec3f, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let n_dot_h = max(dot(n, h), 0.0);
  let n_dot_h2 = n_dot_h * n_dot_h;
  
  let denom = n_dot_h2 * (a2 - 1.0) + 1.0;
  return a2 / (pi * denom * denom);
}

// Schlick-GGX Geometry function
fn geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return n_dot_v / (n_dot_v * (1.0 - k) + k);
}

// Smith's Geometry function
fn geometry_smith(n: vec3f, v: vec3f, l: vec3f, roughness: f32) -> f32 {
  let n_dot_v = max(dot(n, v), 0.0);
  let n_dot_l = max(dot(n, l), 0.0);
  let ggx1 = geometry_schlick_ggx(n_dot_v, roughness);
  let ggx2 = geometry_schlick_ggx(n_dot_l, roughness);
  return ggx1 * ggx2;
}

// Compute tangent and bitangent for normal mapping
fn compute_tbn(normal: vec3f, right: vec3f, up: vec3f) -> mat3x3f {
  // For quads, we can derive tangent from right vector
  let tangent = normalize(right);
  let bitangent = normalize(cross(normal, tangent));
  let corrected_tangent = cross(bitangent, normal);
  return mat3x3f(corrected_tangent, bitangent, normal);
}

// Transform normal from tangent space to world space
fn tangent_to_world(tbn: mat3x3f, tangent_normal: vec3f) -> vec3f {
  return normalize(tbn * tangent_normal);
}

// ==========================================
// PBR Lighting Calculation
// ==========================================

struct PBRMaterial {
  albedo: vec3f,
  normal: vec3f,
  metallic: f32,
  roughness: f32,
  ao: f32,
}

fn calculate_pbr_lighting(
  material: PBRMaterial,
  world_pos: vec3f,
  view_dir: vec3f,
  light_dir: vec3f,
  light_color: vec3f,
  light_intensity: f32
) -> vec3f {
  let n = material.normal;
  let v = view_dir;
  let l = light_dir;
  let h = normalize(v + l);
  
  // Calculate base reflectance at normal incidence
  var f0 = F0_DIELECTRIC;
  f0 = mix(f0, material.albedo, material.metallic);
  
  // Cook-Torrance BRDF
  let ndf = distribution_ggx(n, h, material.roughness);
  let g = geometry_smith(n, v, l, material.roughness);
  let f = fresnel_schlick(max(dot(h, v), 0.0), f0);
  
  let n_dot_l = max(dot(n, l), 0.0);
  let n_dot_v = max(dot(n, v), 0.0);
  
  // Specular contribution
  let numerator = ndf * g * f;
  let denominator = 4.0 * n_dot_v * n_dot_l + 0.0001;
  let specular = numerator / denominator;
  
  // Diffuse contribution (energy conservation)
  let ks = f;
  var kd = vec3f(1.0) - ks;
  kd *= 1.0 - material.metallic; // Metals have no diffuse
  
  let diffuse = kd * material.albedo / pi;
  
  // Combine
  let radiance = light_color * light_intensity;
  return (diffuse + specular) * radiance * n_dot_l;
}

// ==========================================
// Environment/Ambient Lighting
// ==========================================

fn calculate_ambient(material: PBRMaterial, view_dir: vec3f) -> vec3f {
  var f0 = F0_DIELECTRIC;
  f0 = mix(f0, material.albedo, material.metallic);
  
  let n_dot_v = max(dot(material.normal, view_dir), 0.0);
  let f = fresnel_schlick_roughness(n_dot_v, f0, material.roughness);
  
  let ks = f;
  var kd = 1.0 - ks;
  kd *= 1.0 - material.metallic;
  
  // Simple ambient term (in a full implementation, this would use IBL)
  let ambient_light = vec3f(0.03);
  let diffuse = kd * material.albedo * ambient_light;
  
  return diffuse * material.ao;
}

// ==========================================
// Reflection Sampling
// ==========================================

fn importance_sample_ggx(xi: vec2f, n: vec3f, roughness: f32) -> vec3f {
  let a = roughness * roughness;
  
  let phi = 2.0 * pi * xi.x;
  let cos_theta = sqrt((1.0 - xi.y) / (1.0 + (a * a - 1.0) * xi.y));
  let sin_theta = sqrt(1.0 - cos_theta * cos_theta);
  
  // Spherical to cartesian
  let h = vec3f(
    cos(phi) * sin_theta,
    sin(phi) * sin_theta,
    cos_theta
  );
  
  // Tangent space to world space
  let up = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), abs(n.z) < 0.999);
  let tangent = normalize(cross(up, n));
  let bitangent = cross(n, tangent);
  
  return normalize(tangent * h.x + bitangent * h.y + n * h.z);
}

// ==========================================
// Sky Color
// ==========================================

fn sky_color(dir: vec3f) -> vec3f {
  let t = 0.5 * (normalize(dir).y + 1.0);
  let ground = vec3f(0.6, 0.5, 0.4);
  let sky = vec3f(0.5, 0.7, 1.0);
  return mix(ground, sky, t) * 0.3;
}

// ==========================================
// Hit Sampling with Full PBR
// ==========================================

fn sample_hit_pbr(hit: HitInfo, ray_dir: vec3f) -> vec3f {
  if (hit.quad == kNoHit) {
    return sky_color(ray_dir);
  }
  
  let quad = quads[hit.quad];
  let emissive = get_emissive(hit.quad);
  let uses_material = quad_uses_material(hit.quad) && emissive < 0.5;
  
  // Get geometric normal from quad
  let geom_normal = quad.plane.xyz;
  let view_dir = -ray_dir;
  
  var material: PBRMaterial;
  var uv = hit.uv;
  
  if (uses_material) {
    // Apply parallax mapping for depth
    // Note: For a proper implementation, we need tangent space view direction
    // Simplified version using geometric data
    let tbn = compute_tbn(geom_normal, vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0));
    let tangent_view = transpose(tbn) * view_dir;
    uv = parallax_mapping(hit.uv, tangent_view, geom_normal);
    
    // Sample all PBR textures
    material.albedo = sample_albedo(uv);
    let tangent_normal = sample_normal(uv);
    material.normal = tangent_to_world(tbn, tangent_normal);
    
    let arm = sample_arm(uv);
    material.ao = arm.r;
    material.roughness = max(arm.g, 0.04); // Clamp to prevent divide by zero
    material.metallic = arm.b;
  } else {
    // Use quad color as albedo, default PBR values
    material.albedo = quad.color;
    material.normal = geom_normal;
    material.ao = 1.0;
    material.roughness = 0.5;
    material.metallic = 0.0;
  }
  
  // Sample lightmap for indirect lighting
  let lightmap_color = textureSampleLevel(lightmap, smpl, hit.uv, hit.quad, 0).rgb;
  
  // Calculate ambient lighting with AO
  let ambient = calculate_ambient(material, view_dir);
  
  // Combine lightmap (which represents GI) with ambient
  var color = lightmap_color * material.albedo * material.ao + ambient;
  
  // Add emissive contribution
  color += emissive * quad.color;
  
  return color;
}

// ==========================================
// Main Raytracer Entry Point
// ==========================================

@compute @workgroup_size(WorkgroupSizeX, WorkgroupSizeY)
fn main(@builtin(global_invocation_id) invocation_id : vec3u) {
  if (all(invocation_id.xy < textureDimensions(framebuffer))) {
    init_rand(invocation_id);

    // Calculate the fragment's NDC coordinates
    let uv = vec2f(invocation_id.xy) / vec2f(textureDimensions(framebuffer).xy);
    let ndcXY = (uv - 0.5) * vec2(2, -2);

    // Transform back to world space
    var near = common_uniforms.inv_mvp * vec4f(ndcXY, 0.0, 1);
    var far = common_uniforms.inv_mvp * vec4f(ndcXY, 1, 1);
    near /= near.w;
    far /= far.w;

    // Create primary ray
    let ray = Ray(near.xyz, normalize(far.xyz - near.xyz));
    let hit = raytrace(ray);

    // Handle sky
    if (hit.quad == kNoHit) {
      textureStore(framebuffer, invocation_id.xy, vec4(sky_color(ray.dir), 1));
      return;
    }

    // Get PBR material at hit point
    let quad = quads[hit.quad];
    let emissive = get_emissive(hit.quad);
    let uses_material = quad_uses_material(hit.quad) && emissive < 0.5;
    
    let geom_normal = quad.plane.xyz;
    let view_dir = -ray.dir;
    
    var material: PBRMaterial;
    var parallax_uv = hit.uv;
    
    if (uses_material) {
      let tbn = compute_tbn(geom_normal, vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0));
      let tangent_view = transpose(tbn) * view_dir;
      parallax_uv = parallax_mapping(hit.uv, tangent_view, geom_normal);
      
      material.albedo = sample_albedo(parallax_uv);
      let tangent_normal = sample_normal(parallax_uv);
      material.normal = tangent_to_world(tbn, tangent_normal);
      
      let arm = sample_arm(parallax_uv);
      material.ao = arm.r;
      material.roughness = max(arm.g, 0.04);
      material.metallic = arm.b;
    } else {
      material.albedo = quad.color;
      material.normal = geom_normal;
      material.ao = 1.0;
      material.roughness = 0.5;
      material.metallic = 0.0;
    }
    
    // Sample lightmap
    let lightmap_color = textureSampleLevel(lightmap, smpl, hit.uv, hit.quad, 0).rgb;
    
    // Base color from lightmap * albedo * AO
    var color = lightmap_color * material.albedo * material.ao;
    
    // Add ambient
    color += calculate_ambient(material, view_dir);
    
    // Calculate F0 for reflections
    var f0 = F0_DIELECTRIC;
    f0 = mix(f0, material.albedo, material.metallic);
    
    // Compute Fresnel for reflection intensity
    let n_dot_v = max(dot(material.normal, view_dir), 0.0);
    let fresnel = fresnel_schlick_roughness(n_dot_v, f0, material.roughness);
    
    // Reflection rays with importance sampling based on roughness
    var reflection = vec3f(0.0);
    let bounce = reflect(ray.dir, material.normal);
    
    for (var i = 0; i < NumReflectionRays; i++) {
      // Generate quasi-random sample for importance sampling
      let xi = vec2f(rand(), rand());
      let sample_dir = importance_sample_ggx(xi, material.normal, material.roughness);
      
      // Reflect the sample direction
      let reflection_dir = reflect(-view_dir, sample_dir);
      
      // Only trace rays above the surface
      if (dot(reflection_dir, geom_normal) > 0.0) {
        let reflection_ray = Ray(hit.pos + geom_normal * 0.001, reflection_dir);
        let reflection_hit = raytrace(reflection_ray);
        reflection += sample_hit_pbr(reflection_hit, reflection_dir);
      } else {
        reflection += sky_color(bounce);
      }
    }
    reflection /= f32(NumReflectionRays);
    
    // Blend reflection based on Fresnel and roughness
    // Rougher surfaces have more diffuse, less specular reflection
    let reflection_strength = fresnel * (1.0 - material.roughness * 0.9);
    color = mix(color, reflection, reflection_strength);
    
    // Add emissive
    color += emissive * quad.color;

    textureStore(framebuffer, invocation_id.xy, vec4(color, 1));
  }
}
