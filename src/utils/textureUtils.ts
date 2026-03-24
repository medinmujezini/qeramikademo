import * as THREE from 'three';
import type { TileTextureUrls } from '@/types/floorPlan';

export type PBRMapKey = 'map' | 'normalMap' | 'roughnessMap' | 'aoMap' | 'displacementMap' | 'metalnessMap';
export type PBRTextureProps = Partial<Record<PBRMapKey, THREE.Texture>>;

export function toMaterialUrlMap(urls?: TileTextureUrls): Partial<Record<PBRMapKey, string>> {
  if (!urls) return {};
  const result: Partial<Record<PBRMapKey, string>> = {};
  if (urls.albedo) result.map = urls.albedo;
  if (urls.normal) result.normalMap = urls.normal;
  if (urls.roughness) result.roughnessMap = urls.roughness;
  if (urls.ao) result.aoMap = urls.ao;
  if (urls.height) result.displacementMap = urls.height;
  if (urls.metallic) result.metalnessMap = urls.metallic;
  return result;
}
