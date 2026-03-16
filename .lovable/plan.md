

## Build Fix

There's a TypeScript error in `BlueprintImportWizard.tsx` — `NodeJS.Timeout` isn't available in browser TypeScript. Fix lines 146-147 by replacing `NodeJS.Timeout` with `ReturnType<typeof setTimeout>`.

This is a one-line-each fix, independent of the QA document work.

