/**
 * MEP Validation System
 * 
 * Comprehensive validation based on IPC/UPC plumbing codes
 * and NEC electrical codes.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  MEPFixture,
  MEPRoute,
  MEPNode,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  MEPSystemType,
} from '@/types/mep';
import { 
  getDrainPipeSize, 
  getVentPipeSize, 
  getMinSlope, 
  validateSlope,
  getTrapRequirements,
  getClearanceRequirements,
} from '@/data/plumbingCodes';
import { detectClashes } from './mepClashDetection';

// =============================================================================
// VALIDATION RULES
// =============================================================================

interface ValidationRule {
  id: string;
  name: string;
  category: 'slope' | 'size' | 'clearance' | 'connection' | 'code';
  check: (context: ValidationContext) => ValidationIssue[];
}

interface ValidationContext {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

interface ValidationIssue {
  type: 'error' | 'warning';
  category: 'slope' | 'size' | 'clearance' | 'connection' | 'code';
  message: string;
  elementId: string;
  elementType: 'fixture' | 'route' | 'segment' | 'node';
  codeReference?: string;
}

// =============================================================================
// VALIDATION RULES IMPLEMENTATION
// =============================================================================

const VALIDATION_RULES: ValidationRule[] = [
  // Rule 1: Check for unconnected fixtures
  {
    id: 'unconnected-fixtures',
    name: 'Unconnected Fixtures',
    category: 'connection',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const fixture of ctx.fixtures) {
        const requiredConnections = fixture.connections.filter(c => c.isRequired);
        
        for (const conn of requiredConnections) {
          const hasRoute = ctx.routes.some(r => 
            r.destination.type === 'fixture' && 
            r.destination.id === fixture.id &&
            r.systemType === conn.systemType
          );
          
          if (!hasRoute) {
            issues.push({
              type: 'warning',
              category: 'connection',
              message: `${fixture.name} missing ${conn.systemType} connection`,
              elementId: fixture.id,
              elementType: 'fixture',
              codeReference: 'IPC 301.3',
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 2: Check drainage slopes
  {
    id: 'drainage-slope',
    name: 'Drainage Slope Requirements',
    category: 'slope',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const route of ctx.routes) {
        if (route.systemType !== 'drainage') continue;
        
        for (const segment of route.segments) {
          const pipeSize = segment.size;
          const actualSlope = segment.slope || 0;
          const validation = validateSlope(actualSlope, pipeSize);
          
          if (!validation.isValid) {
            issues.push({
              type: 'error',
              category: 'slope',
              message: validation.message,
              elementId: segment.id,
              elementType: 'segment',
              codeReference: 'IPC 704.1',
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 3: Check pipe sizing
  {
    id: 'pipe-sizing',
    name: 'Pipe Sizing Requirements',
    category: 'size',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const route of ctx.routes) {
        if (route.systemType === 'drainage') {
          const requiredSize = getDrainPipeSize(route.totalDFU);
          if (route.requiredSize < requiredSize) {
            issues.push({
              type: 'error',
              category: 'size',
              message: `Drain pipe undersized: ${route.requiredSize}" used, ${requiredSize}" required for ${route.totalDFU} DFU`,
              elementId: route.id,
              elementType: 'route',
              codeReference: 'IPC Table 709.1',
            });
          }
        } else if (route.systemType === 'vent') {
          const requiredSize = getVentPipeSize(route.totalDFU);
          if (route.requiredSize < requiredSize) {
            issues.push({
              type: 'warning',
              category: 'size',
              message: `Vent pipe may be undersized: ${route.requiredSize}" used, ${requiredSize}" recommended`,
              elementId: route.id,
              elementType: 'route',
              codeReference: 'IPC Table 710.1(2)',
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 4: Check fixture clearances
  {
    id: 'fixture-clearance',
    name: 'Fixture Clearance Requirements',
    category: 'clearance',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const fixture of ctx.fixtures) {
        const clearanceReq = getClearanceRequirements(fixture.type);
        if (!clearanceReq) continue;
        
        // Check against other fixtures
        for (const other of ctx.fixtures) {
          if (other.id === fixture.id) continue;
          
          const dx = Math.abs(fixture.position.x - other.position.x);
          const dy = Math.abs(fixture.position.y - other.position.y);
          
          const minSpacing = (fixture.dimensions.width + other.dimensions.width) / 2 + 
                            Math.max(fixture.clearance.sides, other.clearance.sides);
          
          if (dx < minSpacing && dy < (fixture.dimensions.depth + other.dimensions.depth) / 2 + 20) {
            issues.push({
              type: 'warning',
              category: 'clearance',
              message: `${fixture.name} too close to ${other.name}`,
              elementId: fixture.id,
              elementType: 'fixture',
              codeReference: 'IPC 405.3.1',
            });
          }
        }
        
        // Check center-to-center for water closets
        if (fixture.type === 'toilet') {
          for (const other of ctx.fixtures) {
            if (other.id === fixture.id) continue;
            if (other.type !== 'toilet' && other.type !== 'bidet') continue;
            
            const dx = Math.abs(fixture.position.x - other.position.x);
            if (dx < clearanceReq.centerToCenter && dx > 0) {
              issues.push({
                type: 'error',
                category: 'clearance',
                message: `Toilet center-to-center spacing violation: ${Math.round(dx)}cm, minimum ${clearanceReq.centerToCenter}cm required`,
                elementId: fixture.id,
                elementType: 'fixture',
                codeReference: 'IPC 405.3.1',
              });
            }
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 5: Check trap requirements
  {
    id: 'trap-requirements',
    name: 'Trap Requirements',
    category: 'code',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const fixture of ctx.fixtures) {
        const trapReq = getTrapRequirements(fixture.type);
        if (!trapReq) continue;
        
        // Check if fixture has drainage connection
        const hasDrainage = fixture.connections.some(c => c.systemType === 'drainage');
        
        if (hasDrainage) {
        // Verify route exists and has correct sizing
          const drainRoute = ctx.routes.find(r => 
            r.destination.type === 'fixture' && 
            r.destination.id === fixture.id &&
            r.systemType === 'drainage'
          );
          
          if (drainRoute && drainRoute.requiredSize < trapReq.minTrapSize) {
            issues.push({
              type: 'error',
              category: 'code',
              message: `${fixture.name} trap undersized: ${drainRoute.requiredSize}" used, ${trapReq.minTrapSize}" minimum required`,
              elementId: fixture.id,
              elementType: 'fixture',
              codeReference: 'IPC Table 709.2',
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 6: Check vent requirements
  {
    id: 'vent-requirements',
    name: 'Vent Requirements',
    category: 'code',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      for (const fixture of ctx.fixtures) {
        const needsVent = fixture.connections.some(c => 
          c.systemType === 'vent' && c.isRequired
        );
        
        if (needsVent) {
          const hasVentRoute = ctx.routes.some(r => 
            r.destination.type === 'fixture' && 
            r.destination.id === fixture.id &&
            r.systemType === 'vent'
          );
          
          if (!hasVentRoute) {
            issues.push({
              type: 'warning',
              category: 'code',
              message: `${fixture.name} requires venting per code`,
              elementId: fixture.id,
              elementType: 'fixture',
              codeReference: 'IPC 901.2',
            });
          }
        }
      }
      
      return issues;
    },
  },
  
  // Rule 7: Check wet vent limitations
  {
    id: 'wet-vent-check',
    name: 'Wet Vent Limitations',
    category: 'code',
    check: (ctx) => {
      const issues: ValidationIssue[] = [];
      
      // Calculate total DFU connected to each drain stack
      const stackDFU: Map<string, number> = new Map();
      
      for (const route of ctx.routes) {
        if (route.systemType !== 'drainage') continue;
        
        const stackNode = ctx.nodes.find(n => n.id === route.source.nodeId);
        if (stackNode?.type === 'drain-stack') {
          const current = stackDFU.get(stackNode.id) || 0;
          stackDFU.set(stackNode.id, current + route.totalDFU);
        }
      }
      
      // Check stack capacity
      for (const [stackId, totalDFU] of stackDFU.entries()) {
        const stack = ctx.nodes.find(n => n.id === stackId);
        if (stack && stack.capacity && totalDFU > stack.capacity) {
          issues.push({
            type: 'error',
            category: 'code',
            message: `Drain stack "${stack.name}" overloaded: ${totalDFU} DFU connected, capacity ${stack.capacity} DFU`,
            elementId: stackId,
            elementType: 'node',
            codeReference: 'IPC 710.1',
          });
        }
      }
      
      return issues;
    },
  },
];

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

/**
 * Run all validation rules against MEP system
 */
export function validateMEPSystem(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[],
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
): ValidationResult {
  const context: ValidationContext = { fixtures, routes, nodes, walls };
  const allIssues: ValidationIssue[] = [];
  
  // Run all validation rules
  for (const rule of VALIDATION_RULES) {
    const issues = rule.check(context);
    allIssues.push(...issues);
  }
  
  // Deduplicate by elementId + category, keeping most severe
  const issueMap = new Map<string, ValidationIssue>();
  for (const issue of allIssues) {
    const key = `${issue.elementId}-${issue.category}`;
    const existing = issueMap.get(key);
    
    // Keep if new, or if this one is more severe (error > warning)
    if (!existing || (issue.type === 'error' && existing.type === 'warning')) {
      issueMap.set(key, issue);
    }
  }
  
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  for (const issue of issueMap.values()) {
    if (issue.type === 'error') {
      errors.push({
        id: uuidv4(),
        category: issue.category,
        message: issue.message,
        elementId: issue.elementId,
        elementType: issue.elementType,
        codeReference: issue.codeReference,
      });
    } else {
      warnings.push({
        id: uuidv4(),
        category: issue.category,
        message: issue.message,
        elementId: issue.elementId,
        elementType: issue.elementType,
      });
    }
  }
  
  // Run clash detection (already optimized)
  const clashResult = detectClashes(fixtures, routes, nodes);
  
  // Add clash-related errors (deduplicated by element pair)
  const seenClashPairs = new Set<string>();
  for (const clash of clashResult.clashes) {
    const pairKey = [clash.element1.id, clash.element2.id].sort().join('-');
    if (seenClashPairs.has(pairKey)) continue;
    seenClashPairs.add(pairKey);
    
    if (clash.severity === 'critical') {
      errors.push({
        id: clash.id,
        category: 'clearance',
        message: clash.resolution || `${clash.type} clash detected`,
        elementId: clash.element1.id,
        elementType: clash.element1.type as any,
      });
    } else {
      warnings.push({
        id: clash.id,
        category: 'clearance',
        message: clash.resolution || `${clash.type} clash detected`,
        elementId: clash.element1.id,
        elementType: clash.element1.type as any,
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get summary statistics for validation
 */
export function getValidationSummary(result: ValidationResult): {
  totalIssues: number;
  errorsByCategory: Record<string, number>;
  warningsByCategory: Record<string, number>;
} {
  const errorsByCategory: Record<string, number> = {};
  const warningsByCategory: Record<string, number> = {};
  
  for (const error of result.errors) {
    errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
  }
  
  for (const warning of result.warnings) {
    warningsByCategory[warning.category] = (warningsByCategory[warning.category] || 0) + 1;
  }
  
  return {
    totalIssues: result.errors.length + result.warnings.length,
    errorsByCategory,
    warningsByCategory,
  };
}
