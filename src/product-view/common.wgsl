const pi = 3.14159265359;

// Quad describes 2D rectangle on a plane
struct Quad {
  // The surface plane
  plane    : vec4f,
  // A plane with a normal in the 'u' direction, intersecting the origin, at
  // right-angles to the surface plane.
  // The dot product of 'right' with a 'vec4(pos, 1)' will range between [-1..1]
  // if the projected point is within the quad.
  right    : vec4f,
  // A plane with a normal in the 'v' direction, intersecting the origin, at
  // right-angles to the surface plane.
  // The dot product of 'up' with a 'vec4(pos, 1)' will range between [-1..1]
  // if the projected point is within the quad.
  up       : vec4f,
  // The diffuse color of the quad
  color    : vec3f,
  // Emissive value. 0=no emissive, 1=full emissive.
  emissive : f32,
};

// Triangle for mesh geometry
struct Triangle {
  v0: vec3f,
  _pad0: f32,
  v1: vec3f,
  _pad1: f32,
  v2: vec3f,
  _pad2: f32,
  color: vec3f,
  _pad3: f32,
};

// Ray is a start point and direction.
struct Ray {
  start : vec3f,
  dir   : vec3f,
}

// Value for HitInfo.quad if no intersection occured.
const kNoHit = 0xffffffffu;
// Bit flag to indicate triangle hit (high bit of quad index)
const kTriangleHitFlag = 0x80000000u;

// HitInfo describes the hit location of a ray-quad/triangle intersection
struct HitInfo {
  // Distance along the ray to the intersection
  dist : f32,
  // The quad/triangle index that was hit (high bit set for triangle)
  quad : u32,
  // The position of the intersection
  pos : vec3f,
  // The UVs of the quad at the point of intersection (or barycentric for triangles)
  uv : vec2f,
  // Surface normal at hit point
  normal : vec3f,
}

// CommonUniforms uniform buffer data
struct CommonUniforms {
  // Model View Projection matrix
  mvp : mat4x4f,
  // Inverse of mvp
  inv_mvp : mat4x4f,
  // Random seed for the workgroup
  seed : vec3u,
  // Number of triangles
  triangle_count : u32,
}

// The common uniform buffer binding.
@group(0) @binding(0) var<uniform> common_uniforms : CommonUniforms;

// The quad buffer binding.
@group(0) @binding(1) var<storage> quads : array<Quad>;

// The triangle buffer binding.
@group(0) @binding(2) var<storage> triangles : array<Triangle>;

// intersect_ray_quad will check to see if the ray 'r' intersects the quad 'q'.
// If an intersection occurs, and the intersection is closer than 'closest' then
// the intersection information is returned, otherwise 'closest' is returned.
fn intersect_ray_quad(r : Ray, quad : u32, closest : HitInfo) -> HitInfo {
  let q = quads[quad];
  let plane_dist = dot(q.plane, vec4(r.start, 1));
  let ray_dist = plane_dist / -dot(q.plane.xyz, r.dir);
  let pos = r.start + r.dir * ray_dist;
  let uv = vec2(dot(vec4f(pos, 1), q.right),
                dot(vec4f(pos, 1), q.up)) * 0.5 + 0.5;
  let hit = plane_dist > 0 &&
            ray_dist > 0 &&
            ray_dist < closest.dist &&
            all((uv > vec2f()) & (uv < vec2f(1)));
  return HitInfo(
    select(closest.dist, ray_dist, hit),
    select(closest.quad, quad,     hit),
    select(closest.pos,  pos,      hit),
    select(closest.uv,   uv,       hit),
    select(closest.normal, q.plane.xyz, hit),
  );
}

// Möller–Trumbore ray-triangle intersection
fn intersect_ray_triangle(r : Ray, tri_idx : u32, closest : HitInfo) -> HitInfo {
  let tri = triangles[tri_idx];
  let edge1 = tri.v1 - tri.v0;
  let edge2 = tri.v2 - tri.v0;
  let h = cross(r.dir, edge2);
  let a = dot(edge1, h);
  
  // Check if ray is parallel to triangle
  if (abs(a) < 1e-8) {
    return closest;
  }
  
  let f = 1.0 / a;
  let s = r.start - tri.v0;
  let u = f * dot(s, h);
  
  if (u < 0.0 || u > 1.0) {
    return closest;
  }
  
  let q = cross(s, edge1);
  let v = f * dot(r.dir, q);
  
  if (v < 0.0 || u + v > 1.0) {
    return closest;
  }
  
  let t = f * dot(edge2, q);
  
  if (t > 1e-5 && t < closest.dist) {
    let pos = r.start + r.dir * t;
    let normal = normalize(cross(edge1, edge2));
    // Flip normal if back-facing
    let facing_normal = select(normal, -normal, dot(normal, r.dir) > 0);
    return HitInfo(
      t,
      tri_idx | kTriangleHitFlag,
      pos,
      vec2f(u, v),
      facing_normal,
    );
  }
  return closest;
}

// raytrace finds the closest intersecting quad/triangle for the given ray
fn raytrace(ray : Ray) -> HitInfo {
  var hit = HitInfo();
  hit.dist = 1e20;
  hit.quad = kNoHit;
  hit.normal = vec3f(0, 1, 0);
  
  // Check quads (room walls)
  for (var q = 0u; q < arrayLength(&quads); q++) {
    hit = intersect_ray_quad(ray, q, hit);
  }
  
  // Check triangles (furniture model)
  for (var t = 0u; t < common_uniforms.triangle_count; t++) {
    hit = intersect_ray_triangle(ray, t, hit);
  }
  
  return hit;
}

// Get the color of a hit surface
fn get_hit_color(hit : HitInfo) -> vec3f {
  if (hit.quad == kNoHit) {
    return vec3f(0.0);
  }
  
  // Check if this is a triangle hit
  if ((hit.quad & kTriangleHitFlag) != 0u) {
    let tri_idx = hit.quad & ~kTriangleHitFlag;
    return triangles[tri_idx].color;
  }
  
  // Quad hit
  return quads[hit.quad].color;
}

// A pseudo random number. Initialized with init_rand(), updated with rand().
var<private> rnd : vec3u;

// Initializes the random number generator.
fn init_rand(invocation_id : vec3u) {
  const A = vec3(1741651 * 1009,
                 140893  * 1609 * 13,
                 6521    * 983  * 7 * 2);
  rnd = (invocation_id * A) ^ common_uniforms.seed;
}

// Returns a random number between 0 and 1.
fn rand() -> f32 {
  const C = vec3(60493  * 9377,
                 11279  * 2539 * 23,
                 7919   * 631  * 5 * 3);

  rnd = (rnd * C) ^ (rnd.yzx >> vec3(4u));
  return f32(rnd.x ^ rnd.y) / f32(0xffffffff);
}

// Returns a random point within a unit sphere centered at (0,0,0).
fn rand_unit_sphere() -> vec3f {
    var u = rand();
    var v = rand();
    var theta = u * 2.0 * pi;
    var phi = acos(2.0 * v - 1.0);
    var r = pow(rand(), 1.0/3.0);
    var sin_theta = sin(theta);
    var cos_theta = cos(theta);
    var sin_phi = sin(phi);
    var cos_phi = cos(phi);
    var x = r * sin_phi * sin_theta;
    var y = r * sin_phi * cos_theta;
    var z = r * cos_phi;
    return vec3f(x, y, z);
}

fn rand_concentric_disk() -> vec2f {
    let u = vec2f(rand(), rand());
    let uOffset = 2.f * u - vec2f(1, 1);

    if (uOffset.x == 0 && uOffset.y == 0){
        return vec2f(0, 0);
    }

    var theta = 0.0;
    var r = 0.0;
    if (abs(uOffset.x) > abs(uOffset.y)) {
        r = uOffset.x;
        theta = (pi / 4) * (uOffset.y / uOffset.x);
    } else {
        r = uOffset.y;
        theta = (pi / 2) - (pi / 4) * (uOffset.x / uOffset.y);
    }
    return r * vec2f(cos(theta), sin(theta));
}

fn rand_cosine_weighted_hemisphere() -> vec3f {
    let d = rand_concentric_disk();
    let z = sqrt(max(0.0, 1.0 - d.x * d.x - d.y * d.y));
    return vec3f(d.x, d.y, z);
}
