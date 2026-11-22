// The GPU stages. darktable runs the filter on scene-linear values after
// exposure and ahead of every tone mapping, as a filter on the lens would sit;
// the photo's stage does the same at the tone anchor, after White Balance and
// ahead of the tone block (Exposure scales every pixel alike, so the two
// commute). Anchored stages can't be masked, so a second, scene-linear copy
// of the filter serves the masks: it keeps no values of its own on the photo
// and runs only in a mask's copy, after the tone block.

import { FILTER_GLSL, HELPERS_GLSL } from "./glsl";
import { DEFAULT_PARAMS, RANGES } from "./model";
import { LABELS, MASK_STAGE_ID, NUMERIC_KEYS, STAGE_ID, type StageId } from "./params";
import type { ProcessingStageContribution, UniformDeclaration } from "./safelight";

function uniforms(): UniformDeclaration[] {
  return [
    { key: "on", glslType: "bool", default: DEFAULT_PARAMS.on, label: LABELS.on },
    ...NUMERIC_KEYS.map(
      (key): UniformDeclaration => ({
        key,
        glslType: "float",
        default: DEFAULT_PARAMS[key],
        range: { ...RANGES[key] },
        label: LABELS[key],
      }),
    ),
  ];
}

const common = (id: StageId) => ({
  id,
  glsl: FILTER_GLSL,
  helpers: HELPERS_GLSL,
  uniforms: uniforms(),
  dormantWhen: { on: false },
  presetScope: "global" as const,
});

export function filterStage(): ProcessingStageContribution {
  return {
    ...common(STAGE_ID),
    name: "Graduated Density",
    phase: "scene-linear",
    anchor: "tone",
    // Ahead of Advanced Exposure (10) and Basic's tone block (100), so their
    // highlight compression sees the filtered sky, as it would behind a filter.
    priority: 5,
  };
}

export function maskStage(): ProcessingStageContribution {
  return {
    ...common(MASK_STAGE_ID),
    name: "Graduated Density in masks",
    phase: "scene-linear",
    priority: 5,
    mask: { maskable: true },
  };
}

export function allStages(): ProcessingStageContribution[] {
  return [filterStage(), maskStage()];
}
