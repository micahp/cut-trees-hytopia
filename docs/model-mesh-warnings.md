# Model Mesh Count Warnings

## What you're seeing

At server startup (in development), the HYTOPIA SDK's **ModelRegistry** runs an optimization pipeline on every `.gltf`/`.glb` in your **project** `assets/` folder and in `@hytopia.com/assets`. It then logs a **warning** when an optimized model has more than the recommended number of meshes:

- **Default run:** try not to exceed **10 meshes**
- **Named-nodes run:** try not to exceed **20 meshes**
- **No-animations run:** ideally **1 mesh** (single material so primitives can merge)

Examples:

- `models/players/player.gltf` → 11 meshes (slightly over 10)
- `models/environment/Plains/oak-tree-medium.gltf` → 17 meshes

These warnings are **advisory**. The game still runs; the SDK is suggesting better performance if you can reduce mesh count.

## Why mesh count matters (performance)

From HYTOPIA’s styling docs and SDK behavior:

- More meshes per model → more **draw calls** and **material/state switches** → more CPU/GPU work.
- Impact on FPS depends on:
  - **How many instances** of the model are visible (e.g. many trees on screen).
  - **Target device** (mobile/low-end is more sensitive).
  - Vertex/triangle count, number of unique materials/textures, and overdraw.

So: **yes, it can become a performance issue**, especially with many instances (e.g. lots of trees) or on low-end devices. The “try not to exceed 10” guideline is there to avoid easily causing noticeable FPS drops.

## Why you get warnings for these models

Your project has its **own copies** of models under `assets/models/` (e.g. `assets/models/players/player.gltf`, `assets/models/environment/Plains/oak-tree-medium.gltf`). The SDK only logs mesh-count warnings for models that come from your **project** `assets/` directory, not for models that come only from `node_modules/@hytopia.com/assets`. So as long as you have those local copies, you’ll see the warnings for them.

The underlying **default HYTOPIA assets** (in `@hytopia.com/assets`) have the same mesh counts; the difference is whether the path is considered “project” (warning) or “library” (no warning).

## What you can do

| Option | Effect |
|--------|--------|
| **Accept the warnings** | Easiest. Treat as informational; profile on your target devices and player count. If FPS is fine, no change needed. |
| **Use library assets only (no local copies)** | Remove or stop using project copies of `player.gltf` and environment models so the game resolves them from `@hytopia.com/assets`. You won’t see the warning for those URIs (library models are not warned on). Mesh count is unchanged; you only reduce log noise. |
| **Reduce mesh count in source models** | Edit the **source** models (e.g. in BlockBench): use **fewer unique materials** and/or a **texture atlas** so the optimizer can merge primitives into fewer meshes; remove unnecessary named nodes. Then re-export. This is asset/art work and improves actual performance. |
| **Production builds** | In production (`NODE_ENV=production`), the SDK does **not** run the optimizer by default and does **not** emit these warnings. You still serve the same runtime models; you just don’t get the dev-time checks. |

## Summary

- **Could it become a performance issue?** Yes, especially with many instances (e.g. trees) or on low-end devices.
- **What to do:** Either accept the warnings and profile, or reduce mesh count in your **source** models (fewer materials / atlas / fewer nodes), or rely on library assets only to silence warnings for those URIs. No code change in the game is required for the warnings; they come from the SDK’s ModelRegistry during preload.

## References

- HYTOPIA styling: blocky/low-poly style, polygon count and performance (<https://dev.hytopia.com/styling-and-assets>).
- SDK: `ModelRegistry` (e.g. in `node_modules/hytopia`), `optimalMaxMeshCount: 10` and related hint for the default optimizer run.
