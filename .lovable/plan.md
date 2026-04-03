

# Approve — Line numbers confirmed

The prompt is correct. The current code builds full-width geometry (`curtainW`) for each of the two panel meshes, so both panels are 360cm wide and overlap massively. The fix makes each panel half-width so they meet at center when closed and slide apart when opened.

## Verified changes

| Line | Current | Change to |
|---|---|---|
| 248 | `PlaneGeometry(curtainW, curtainH, ...)` | `PlaneGeometry(curtainW / 2, curtainH, ...)` |
| 255 | `x / curtainW` | `x / (curtainW / 2)` |
| 263 | `openAmount * curtainW / 2` | `openAmount * curtainW / 4` |
| 321 | `planeGeometry args={[curtainW, curtainH]}` | `args={[curtainW / 2, curtainH]}` |
| 328 | `planeGeometry args={[curtainW, curtainH]}` | `args={[curtainW / 2, curtainH]}` |

All line numbers match the current file. No other changes needed. One file: `Curtain3D.tsx`.

