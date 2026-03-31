/**
 * triplanarMaterial.ts — Creates MeshStandardMaterial with triplanar
 * texture projection via onBeforeCompile shader injection.
 *
 * Triplanar mapping projects the texture along world X, Y, Z axes and
 * blends based on the surface normal, so extruded geometry side-faces
 * (which have bad UVs) still show proper texture.
 */

import * as THREE from 'three';

export interface TriplanarMaterialOptions {
  color?: string | THREE.Color;
  map?: THREE.Texture | null;
  roughness?: number;
  metalness?: number;
  /** World-space texture repeat — smaller = larger texture. Default 1.0 (1 repeat per meter) */
  textureScale?: number;
  side?: THREE.Side;
  /** Blending sharpness — higher = sharper axis transitions. Default 4.0 */
  sharpness?: number;
}

/**
 * Creates a MeshStandardMaterial with triplanar projection.
 * If no `map` texture is provided, returns a plain material (no shader injection).
 */
export function createTriplanarMaterial(options: TriplanarMaterialOptions): THREE.MeshStandardMaterial {
  const {
    color = '#e5e7eb',
    map = null,
    roughness = 0.9,
    metalness = 0,
    textureScale = 1.0,
    side = THREE.DoubleSide,
    sharpness = 4.0,
  } = options;

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    side,
  });

  if (!map) return material;

  // Ensure texture is repeat-wrapped for triplanar sampling
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  // Store uniforms ref so we can update them later
  const uniforms = {
    uTriplanarMap: { value: map },
    uTriplanarScale: { value: textureScale },
    uTriplanarSharpness: { value: sharpness },
  };

  material.onBeforeCompile = (shader) => {
    // Merge our uniforms
    shader.uniforms.uTriplanarMap = uniforms.uTriplanarMap;
    shader.uniforms.uTriplanarScale = uniforms.uTriplanarScale;
    shader.uniforms.uTriplanarSharpness = uniforms.uTriplanarSharpness;

    // Vertex shader — pass world position and world normal
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
vTriWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTriWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`
    );

    // Fragment shader — triplanar sampling
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uTriplanarMap;
uniform float uTriplanarScale;
uniform float uTriplanarSharpness;
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;`
    );

    // Replace the map_fragment include with triplanar sampling
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `// Triplanar mapping
{
  vec3 triBlend = pow(abs(vTriWorldNormal), vec3(uTriplanarSharpness));
  triBlend /= (triBlend.x + triBlend.y + triBlend.z + 0.0001);

  vec4 xProj = texture2D(uTriplanarMap, vTriWorldPosition.yz * uTriplanarScale);
  vec4 yProj = texture2D(uTriplanarMap, vTriWorldPosition.xz * uTriplanarScale);
  vec4 zProj = texture2D(uTriplanarMap, vTriWorldPosition.xy * uTriplanarScale);

  vec4 triColor = xProj * triBlend.x + yProj * triBlend.y + zProj * triBlend.z;

  // Apply as sRGB → linear (texture2D returns linear when colorSpace is set)
  diffuseColor.rgb *= triColor.rgb;
}`
    );
  };

  // Mark material as needing recompile
  material.needsUpdate = true;
  // Custom key so Three.js caches the modified program properly
  material.customProgramCacheKey = () =>
    `triplanar_${textureScale}_${sharpness}`;

  return material;
}
