// What activate() registers, under the manifest's id, and what deactivate()
// takes down again.

import { describe, expect, it } from "vitest";
import manifest from "../safelight.json";
import pkg from "../package.json";
import { ROTATE_CURSOR } from "../src/cursor";
import { activate, deactivate } from "../src/index";
import { GraduatedLine } from "../src/Overlay";
import { GraduatedPanel } from "../src/Panel";
import { EXT_ID, MASK_STAGE_ID, OVERLAY_ID, PANEL_ID, STAGE_ID } from "../src/params";
import { fakeApi } from "./support/fake-api";

describe("activate", () => {
  it("registers both stages, the panel, the line and its cursor", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.stages.map((s) => s.id)).toEqual([STAGE_ID, MASK_STAGE_ID]);
    expect(rig.panels).toMatchObject([
      { id: PANEL_ID, title: "Graduated Density", component: GraduatedPanel, defaultDock: { module: "develop" }, ownsBag: [`${STAGE_ID}.`] },
    ]);
    expect(rig.slots).toEqual([{ id: OVERLAY_ID, slot: "develop-canvas-overlay", component: GraduatedLine }]);
    expect(rig.cursors).toEqual([ROTATE_CURSOR]);
    deactivate();
    expect(rig.unregistered).toEqual([STAGE_ID, MASK_STAGE_ID]);
  });

  it("names everything under the manifest's id", () => {
    expect(EXT_ID).toBe(manifest.id);
    for (const id of [STAGE_ID, MASK_STAGE_ID, PANEL_ID, OVERLAY_ID, ROTATE_CURSOR.id]) expect(id.startsWith(`${manifest.id}.`)).toBe(true);
  });

  // The tone anchor opened in 3.2.5; the panel's ownsBag came in 3.2.6.
  it("keeps the manifest and package versions in step, and needs the core its API calls came in", () => {
    expect(pkg.version).toBe(manifest.version);
    expect(manifest.minAppVersion).toBe("3.2.6");
    expect(pkg.keywords).toContain("safelight-extension");
  });

  it("names no other program in what the user reads", () => {
    const text = JSON.stringify([manifest.name, manifest.description, manifest.keywords]).toLowerCase();
    for (const name of ["darktable", "ansel", "lightroom", "rawtherapee"]) expect(text).not.toContain(name);
  });
});
