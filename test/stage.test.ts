// What the stages declare. Unit tests can't run GLSL (the GPU suite does);
// these pin where the filter runs, what keeps a photo untouched at rest, the
// cost per pixel, and the keys the panel writes.

import { describe, expect, it } from "vitest";
import { FILTER_GLSL, HELPERS_GLSL } from "../src/glsl";
import { MASK_STAGE_ID, STAGE_ID, resetPatch, stageKeys } from "../src/params";
import { allStages, filterStage, maskStage } from "../src/stage";
import { inlineFetches } from "./support/fetch-budget";

describe("the photo's stage", () => {
  const stage = filterStage();

  it("runs on scene-linear values at the tone anchor, ahead of the tone block", () => {
    expect(stage).toMatchObject({ id: STAGE_ID, phase: "scene-linear", anchor: "tone", priority: 5 });
    expect(stage.priority).toBeLessThan(10);
  });

  it("declares nothing the tone anchor refuses", () => {
    expect(stage.passes).toBeUndefined();
    expect(stage.space).toBeUndefined();
    expect(stage.mask).toBeUndefined();
    expect(stage.reads).toBeUndefined();
    expect(stage.produces).toBeUndefined();
  });

  it("sleeps while off", () => {
    expect(stage.dormantWhen).toEqual({ on: false });
    expect(stage.glsl.trim().startsWith("if (on) {")).toBe(true);
  });
});

describe("the masks' stage", () => {
  const stage = maskStage();

  it("is maskable, in scene-linear, and sleeps on the photo, which never stores its keys", () => {
    expect(stage).toMatchObject({ id: MASK_STAGE_ID, phase: "scene-linear", mask: { maskable: true }, dormantWhen: { on: false } });
    expect(stage.anchor).toBeUndefined();
    expect(stage.uniforms.find((u) => u.key === "on")?.default).toBe(false);
  });

  it("runs the same filter as the photo's", () => {
    expect(stage.glsl).toBe(filterStage().glsl);
    expect(stage.helpers).toBe(filterStage().helpers);
  });
});

describe("both stages", () => {
  it("declare every key the panel stores, at the defaults the reset writes", () => {
    for (const stage of allStages()) {
      const id = stage.id === STAGE_ID ? STAGE_ID : MASK_STAGE_ID;
      const declared = new Map(stage.uniforms.map((u) => [`${stage.id}.${u.key}`, u.default]));
      expect([...declared.keys()].sort()).toEqual(stageKeys(id).sort());
      for (const [k, v] of Object.entries(resetPatch(id))) expect(declared.get(k)).toEqual(v);
    }
  });

  it("read no texture: the filter is a formula of the pixel's place", () => {
    expect(inlineFetches(FILTER_GLSL, HELPERS_GLSL)).toBe(0);
  });

  it("use no ints and no globals, so they share a program and run as 32-bit floats everywhere", () => {
    const src = `${HELPERS_GLSL}\n${FILTER_GLSL}`;
    expect(src).not.toMatch(/\b(int|ivec[234])\b/);
    // Globals aren't namespaced per stage: the photo's stage and the masks'
    // would declare them twice.
    expect(HELPERS_GLSL.trim()).not.toMatch(/^const\b/m);
  });

  it("name no helper parameter or local after a uniform key, which the host rewrites", () => {
    const keys = allStages()[0].uniforms.map((u) => u.key);
    const declared = [...HELPERS_GLSL.matchAll(/\b(?:float|vec[23]|mat3)\s+(\w+)/g)].map((m) => m[1]);
    for (const name of declared) expect(keys).not.toContain(name);
  });

  it("reads the place from source UV and the photo's own aspect", () => {
    expect(FILTER_GLSL).toContain("srcUv");
    expect(FILTER_GLSL).toContain("uImageAspect");
  });
});
