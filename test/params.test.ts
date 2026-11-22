// The param-bag contract the panel, the line and the stages share.

import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/model";
import { KEYS, MASK_STAGE_ID, STAGE_ID, bagPatch, qualified, readParams, resetPatch, stageKeys } from "../src/params";

describe("readParams", () => {
  it("reads the defaults from an empty bag", () => {
    expect(readParams({}, STAGE_ID)).toEqual(DEFAULT_PARAMS);
  });

  it("reads only its own stage's keys", () => {
    const bag = bagPatch({ ...DEFAULT_PARAMS, on: true, density: 2.5 }, MASK_STAGE_ID);
    expect(readParams(bag, STAGE_ID)).toEqual(DEFAULT_PARAMS);
    expect(readParams(bag, MASK_STAGE_ID)).toMatchObject({ on: true, density: 2.5 });
  });

  it("round-trips every key", () => {
    const p = { on: true, density: -1.25, hardness: 40, rotation: -33.3, offset: 71.2, hue: 210, saturation: 35 };
    expect(readParams(bagPatch(p, STAGE_ID), STAGE_ID)).toEqual(p);
  });

  it("holds numbers to their ranges and drops what isn't a number", () => {
    const bag = {
      [qualified(STAGE_ID, "density")]: 99,
      [qualified(STAGE_ID, "offset")]: -400,
      [qualified(STAGE_ID, "hue")]: "red",
      [qualified(STAGE_ID, "hardness")]: Number.NaN,
      [qualified(STAGE_ID, "on")]: 1,
    };
    expect(readParams(bag, STAGE_ID)).toEqual({ ...DEFAULT_PARAMS, on: true, density: 8, offset: -25 });
  });
});

describe("patches", () => {
  it("write only the keys asked for", () => {
    expect(bagPatch({ ...DEFAULT_PARAMS, density: 3 }, STAGE_ID, ["density", "on"])).toEqual({
      [`${STAGE_ID}.density`]: 3,
      [`${STAGE_ID}.on`]: false,
    });
  });

  it("reset writes every key at its default", () => {
    expect(Object.keys(resetPatch(STAGE_ID)).sort()).toEqual(stageKeys(STAGE_ID).sort());
    expect(stageKeys(MASK_STAGE_ID)).toHaveLength(KEYS.length);
  });
});
