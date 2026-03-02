// Fast Frustum Culling
// First-pass culling before Hi-Z occlusion test

import * as THREE from 'three';

/**
 * FrustumCuller - Efficient frustum culling for scene objects
 * 
 * This is a fast first-pass cull before Hi-Z testing.
 * Rejects objects completely outside the view frustum.
 */
export class FrustumCuller {
  private frustum: THREE.Frustum = new THREE.Frustum();
  private projScreenMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempBox: THREE.Box3 = new THREE.Box3();
  private tempSphere: THREE.Sphere = new THREE.Sphere();
  
  /**
   * Update frustum from camera
   * Call once per frame before culling
   */
  updateFrustum(camera: THREE.Camera): void {
    this.projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
  }
  
  /**
   * Test if a bounding box intersects the frustum
   */
  intersectsBox(box: THREE.Box3): boolean {
    return this.frustum.intersectsBox(box);
  }
  
  /**
   * Test if a bounding sphere intersects the frustum
   */
  intersectsSphere(sphere: THREE.Sphere): boolean {
    return this.frustum.intersectsSphere(sphere);
  }
  
  /**
   * Test if an object intersects the frustum
   * Handles Mesh, Group, and other Object3D types
   */
  intersectsObject(object: THREE.Object3D): boolean {
    if (object instanceof THREE.Mesh) {
      // Use bounding sphere for fast initial test
      if (object.geometry.boundingSphere === null) {
        object.geometry.computeBoundingSphere();
      }
      
      if (object.geometry.boundingSphere) {
        this.tempSphere.copy(object.geometry.boundingSphere);
        this.tempSphere.applyMatrix4(object.matrixWorld);
        
        if (!this.frustum.intersectsSphere(this.tempSphere)) {
          return false;
        }
      }
      
      // More precise box test
      if (object.geometry.boundingBox === null) {
        object.geometry.computeBoundingBox();
      }
      
      if (object.geometry.boundingBox) {
        this.tempBox.copy(object.geometry.boundingBox);
        this.tempBox.applyMatrix4(object.matrixWorld);
        return this.frustum.intersectsBox(this.tempBox);
      }
      
      return true;
    }
    
    // For groups/other objects, compute bounds from children
    this.tempBox.setFromObject(object);
    return this.frustum.intersectsBox(this.tempBox);
  }
  
  /**
   * Cull a list of objects against the frustum
   * Returns only visible objects
   */
  cullObjects<T extends THREE.Object3D>(objects: T[]): T[] {
    return objects.filter(obj => this.intersectsObject(obj));
  }
  
  /**
   * Traverse a scene and return all visible meshes
   */
  getVisibleMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const visible: THREE.Mesh[] = [];
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) {
        if (this.intersectsObject(object)) {
          visible.push(object);
        }
      }
    });
    
    return visible;
  }
  
  /**
   * Apply frustum culling to a scene
   * Sets `visible` property on meshes
   */
  applyToScene(scene: THREE.Scene): { visible: number; culled: number } {
    let visible = 0;
    let culled = 0;
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const isVisible = this.intersectsObject(object);
        object.visible = isVisible;
        
        if (isVisible) {
          visible++;
        } else {
          culled++;
        }
      }
    });
    
    return { visible, culled };
  }
  
  /**
   * Restore visibility for all meshes in a scene
   */
  restoreScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = true;
      }
    });
  }
  
  /**
   * Get frustum planes for advanced culling
   */
  getPlanes(): THREE.Plane[] {
    return this.frustum.planes;
  }
  
  /**
   * Test which frustum planes a box is outside of
   * Returns bitmask of planes (useful for hierarchical culling)
   */
  getOutsidePlanes(box: THREE.Box3): number {
    let outsideMask = 0;
    const planes = this.frustum.planes;
    
    for (let i = 0; i < 6; i++) {
      const plane = planes[i];
      
      // Get corner that's most in the direction of the plane normal
      const px = plane.normal.x > 0 ? box.max.x : box.min.x;
      const py = plane.normal.y > 0 ? box.max.y : box.min.y;
      const pz = plane.normal.z > 0 ? box.max.z : box.min.z;
      
      const distance = plane.normal.x * px + plane.normal.y * py + plane.normal.z * pz + plane.constant;
      
      if (distance < 0) {
        outsideMask |= (1 << i);
      }
    }
    
    return outsideMask;
  }
}
