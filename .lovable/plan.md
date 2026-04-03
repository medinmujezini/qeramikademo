

# Verdict: Approve — one small revision

## Analysis

The prompt is correct. The sine wave fold displacement on `PlaneGeometry` creates valleys where Z goes negative, and since `DoubleSide` rendering shows the wall behind, you get visible gaps. A flat backing plane is the standard "liner" fix.

## Revision

The prompt says to position the backing plane "1-2cm behind." Given `foldDepth = 0.025` (2.5cm amplitude), the backing should sit at Z = `-foldDepth` (the deepest valley) minus a tiny epsilon, so **Z = -0.03**. Using -0.01 or -0.02 would still intersect some fold valleys. Specify Z = -0.03 instead of "1-2cm behind."

Also: the backing plane should use `side={THREE.FrontSide}` (not DoubleSide) since it only needs to face the room.

## Plan

### File: `src/components/3d/Curtain3D.tsx`

After the existing `<mesh geometry={panelGeometry}>` blocks (around lines 290-305), add a flat backing plane for `panel` type only:

```tsx
{curtain.type === 'panel' && panelGeometry && (
  <>
    <mesh position={[-panelOffsetX, 0, -0.03]}>
      <planeGeometry args={[curtainW * (1 - openAmount), curtainH]} />
      <meshStandardMaterial
        color={curtain.fabricColor} roughness={roughness} metalness={0}
        side={THREE.FrontSide}
      />
    </mesh>
    <mesh position={[panelOffsetX, 0, -0.03]}>
      <planeGeometry args={[curtainW * (1 - openAmount), curtainH]} />
      <meshStandardMaterial
        color={curtain.fabricColor} roughness={roughness} metalness={0}
        side={THREE.FrontSide}
      />
    </mesh>
  </>
)}
```

One file change. No other modifications.

