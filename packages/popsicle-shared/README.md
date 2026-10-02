# popsicle-shared

The things both apps must agree on. Copy this folder into the mobile repo (or make it a git submodule)
rather than reconciling by hand: anything here that differs between the two apps is a bug.

- `copy.ts`      the product's words, and the US/UK spelling pairs
- `tokens.ts`    type scale, text colors that pass contrast, the health and confidence rules
- `motion.ts`    durations and curves, as numbers for React Native and strings for CSS
- `severity.ts`  severities, response windows, and how a window is phrased

Nothing here imports React, React Native or Next, so both runtimes use it unchanged.
