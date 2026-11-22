// The param-bag contract: the panel's params under a stage's qualified keys,
// the switch as a boolean and the rest as the panel shows them (model.ts).
// The photo's values live under the filter stage, a mask's under the mask
// stage; each stage reads only its own.

import { DEFAULT_PARAMS, RANGES, type NumericKey, type Params } from "./model";

export const EXT_ID = "graduated-density";
/** The photo's filter, ahead of the tone mapping. */
export const STAGE_ID = `${EXT_ID}.filter`;
/** The filter inside masks. */
export const MASK_STAGE_ID = `${EXT_ID}.local`;
export const PANEL_ID = `${EXT_ID}.panel`;
export const OVERLAY_ID = `${EXT_ID}.line`;

export type StageId = typeof STAGE_ID | typeof MASK_STAGE_ID;

export const KEYS: readonly (keyof Params)[] = ["on", "density", "hardness", "rotation", "offset", "hue", "saturation"];
export const NUMERIC_KEYS: readonly NumericKey[] = ["density", "hardness", "rotation", "offset", "hue", "saturation"];

/** The panel's labels, which the stages' uniforms share. */
export const LABELS: Readonly<Record<keyof Params, string>> = {
  on: "Enabled",
  density: "Density",
  hardness: "Hardness",
  rotation: "Rotation",
  offset: "Offset",
  hue: "Hue",
  saturation: "Saturation",
};

export const qualified = (stage: StageId, key: keyof Params): string => `${stage}.${key}`;

/** Every key a stage stores. */
export const stageKeys = (stage: StageId): string[] => KEYS.map((k) => qualified(stage, k));

type Bag = Readonly<Record<string, unknown>>;
export type Patch = Record<string, number | boolean>;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `bag` is the host's untyped param bag (the photo's or a mask's); a missing
 *  or non-finite value reads as the default, and a number out of range as the
 *  nearest end of it. */
export function readParams(bag: Bag, stage: StageId): Params {
  const out: Params = { ...DEFAULT_PARAMS };
  const on = bag[qualified(stage, "on")];
  if (typeof on === "boolean") out.on = on;
  else if (finite(on)) out.on = on >= 0.5;
  for (const key of NUMERIC_KEYS) {
    const v = bag[qualified(stage, key)];
    if (finite(v)) out[key] = Math.min(Math.max(v, RANGES[key].min), RANGES[key].max);
  }
  return out;
}

/** `keys` of `p` as the bag holds them; every key by default. */
export function bagPatch(p: Params, stage: StageId, keys: readonly (keyof Params)[] = KEYS): Patch {
  const out: Patch = {};
  for (const key of keys) out[qualified(stage, key)] = p[key];
  return out;
}

export const resetPatch = (stage: StageId): Patch => bagPatch(DEFAULT_PARAMS, stage);
