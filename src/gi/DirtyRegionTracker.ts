import * as THREE from 'three';
import { ProbeVolume, IrradianceProbe } from './ProbeVolume';

export interface ChangeEvent {
  type: 'wall-moved' | 'wall-added' | 'wall-removed' | 
        'fixture-moved' | 'fixture-added' | 'fixture-removed' |
        'light-changed' | 'light-moved';
  bounds: THREE.Box3;
  timestamp: number;
  priority: number;  // Higher = more urgent to update
}

export class DirtyRegionTracker {
  private dirtyRegions: THREE.Box3[] = [];
  private changeEvents: ChangeEvent[] = [];
  private paddingMargin = 0.5;  // meters of padding around changes
  private maxEventAge = 5000;   // ms to keep events before auto-clearing
  
  constructor(paddingMargin: number = 0.5) {
    this.paddingMargin = paddingMargin;
  }
  
  /**
   * Mark a region as dirty, requiring probe updates
   */
  markDirty(bounds: THREE.Box3, eventType?: ChangeEvent['type']): void {
    // Expand bounds by padding margin
    const expanded = bounds.clone().expandByScalar(this.paddingMargin);
    
    // Try to merge with existing dirty regions if overlapping
    let merged = false;
    for (let i = 0; i < this.dirtyRegions.length; i++) {
      if (this.dirtyRegions[i].intersectsBox(expanded)) {
        this.dirtyRegions[i].union(expanded);
        merged = true;
        break;
      }
    }
    
    if (!merged) {
      this.dirtyRegions.push(expanded);
    }
    
    // Merge overlapping regions
    this.dirtyRegions = this.mergeOverlapping(this.dirtyRegions);
    
    // Track event if type provided
    if (eventType) {
      this.changeEvents.push({
        type: eventType,
        bounds: expanded,
        timestamp: Date.now(),
        priority: this.getEventPriority(eventType),
      });
    }
  }
  
  /**
   * Mark dirty from a wall change
   */
  markWallDirty(
    oldStart: { x: number; y: number },
    oldEnd: { x: number; y: number },
    newStart: { x: number; y: number },
    newEnd: { x: number; y: number },
    height: number
  ): void {
    // Create bounds for old position
    const oldBounds = new THREE.Box3(
      new THREE.Vector3(
        Math.min(oldStart.x, oldEnd.x) - 0.2,
        0,
        Math.min(oldStart.y, oldEnd.y) - 0.2
      ),
      new THREE.Vector3(
        Math.max(oldStart.x, oldEnd.x) + 0.2,
        height,
        Math.max(oldStart.y, oldEnd.y) + 0.2
      )
    );
    
    // Create bounds for new position
    const newBounds = new THREE.Box3(
      new THREE.Vector3(
        Math.min(newStart.x, newEnd.x) - 0.2,
        0,
        Math.min(newStart.y, newEnd.y) - 0.2
      ),
      new THREE.Vector3(
        Math.max(newStart.x, newEnd.x) + 0.2,
        height,
        Math.max(newStart.y, newEnd.y) + 0.2
      )
    );
    
    this.markDirty(oldBounds, 'wall-moved');
    this.markDirty(newBounds, 'wall-moved');
  }
  
  /**
   * Mark dirty from a light change
   */
  markLightDirty(
    position: { x: number; y: number; z: number },
    radius: number = 5
  ): void {
    const bounds = new THREE.Box3(
      new THREE.Vector3(position.x - radius, position.y - radius, position.z - radius),
      new THREE.Vector3(position.x + radius, position.y + radius, position.z + radius)
    );
    
    this.markDirty(bounds, 'light-changed');
  }
  
  /**
   * Get probes affected by dirty regions
   */
  getAffectedProbes(probeVolume: ProbeVolume): IrradianceProbe[] {
    return probeVolume.probes.filter(probe => 
      this.dirtyRegions.some(region => 
        region.containsPoint(probe.position)
      )
    );
  }
  
  /**
   * Get probes sorted by update priority
   */
  getPrioritizedProbes(
    probeVolume: ProbeVolume,
    cameraPosition: THREE.Vector3
  ): IrradianceProbe[] {
    const affectedProbes = this.getAffectedProbes(probeVolume);
    
    // Include already-dirty probes
    const dirtyProbes = probeVolume.probes.filter(p => p.isDirty);
    const allProbes = new Set([...affectedProbes, ...dirtyProbes]);
    
    // Sort by priority
    return Array.from(allProbes).sort((a, b) => {
      // Dirty probes first
      if (a.isDirty !== b.isDirty) return a.isDirty ? -1 : 1;
      
      // Then by distance to camera (closer = higher priority)
      const distA = a.position.distanceToSquared(cameraPosition);
      const distB = b.position.distanceToSquared(cameraPosition);
      return distA - distB;
    });
  }
  
  /**
   * Get all dirty regions
   */
  getDirtyRegions(): THREE.Box3[] {
    return this.dirtyRegions;
  }
  
  /**
   * Check if any regions are dirty
   */
  hasDirtyRegions(): boolean {
    return this.dirtyRegions.length > 0;
  }
  
  /**
   * Clear a specific region after it's been processed
   */
  clearRegion(bounds: THREE.Box3): void {
    this.dirtyRegions = this.dirtyRegions.filter(region => 
      !bounds.containsBox(region)
    );
  }
  
  /**
   * Clear all dirty regions
   */
  clearAllRegions(): void {
    this.dirtyRegions = [];
    this.changeEvents = [];
  }
  
  /**
   * Clean up old events
   */
  cleanup(): void {
    const now = Date.now();
    this.changeEvents = this.changeEvents.filter(
      event => now - event.timestamp < this.maxEventAge
    );
  }
  
  /**
   * Merge overlapping bounding boxes
   */
  private mergeOverlapping(boxes: THREE.Box3[]): THREE.Box3[] {
    if (boxes.length <= 1) return boxes;
    
    const merged: THREE.Box3[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < boxes.length; i++) {
      if (used.has(i)) continue;
      
      let current = boxes[i].clone();
      used.add(i);
      
      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < boxes.length; j++) {
          if (used.has(j)) continue;
          if (current.intersectsBox(boxes[j])) {
            current.union(boxes[j]);
            used.add(j);
            changed = true;
          }
        }
      }
      
      merged.push(current);
    }
    
    return merged;
  }
  
  /**
   * Get priority for event type
   */
  private getEventPriority(type: ChangeEvent['type']): number {
    switch (type) {
      case 'light-changed':
      case 'light-moved':
        return 10;  // Highest - lights affect everything
      case 'wall-moved':
      case 'wall-added':
      case 'wall-removed':
        return 8;   // High - walls block light
      case 'fixture-moved':
      case 'fixture-added':
      case 'fixture-removed':
        return 5;   // Medium
      default:
        return 3;
    }
  }
}
