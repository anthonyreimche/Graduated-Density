// Graduated Density, a Safelight extension (GPL-3.0-or-later).
//
// darktable's graduated density module: an optical graduated neutral density
// filter, neutral or tinted, across a line on the photo. Registers the two
// stages (stage.ts: the photo's, ahead of the tone mapping, and the masks'),
// the Develop panel (Panel.tsx) and the line on the canvas (Overlay.tsx).

import { ROTATE_CURSOR } from "./cursor";
import { photoTarget } from "./edit";
import { GraduatedLine } from "./Overlay";
import { GraduatedPanel, resetGraduated } from "./Panel";
import { EXT_ID, MASK_STAGE_ID, OVERLAY_ID, PANEL_ID, STAGE_ID, stageKeys } from "./params";
import { initRuntime } from "./rt";
import type { SafelightAPI } from "./safelight";
import { allStages } from "./stage";
import { initStore } from "./store";

export { EXT_ID, PANEL_ID };

let host: SafelightAPI | null = null;

export function activate(api: SafelightAPI): void {
  initRuntime(api);
  initStore();
  host = api;
  api.registerCursor(ROTATE_CURSOR);
  // Off, both stages are dormant: the live view leaves them out, and every
  // other render runs them as an exact no-op.
  for (const stage of allStages()) api.registerProcessingStage(stage);
  api.registerPanel({
    id: PANEL_ID,
    title: "Graduated Density",
    component: GraduatedPanel,
    defaultDock: { module: "develop", direction: "right", width: 268 },
    modules: ["develop"],
    onReset: () => resetGraduated(photoTarget),
    ownsBag: [`${STAGE_ID}.`],
    mask: { component: GraduatedPanel, owns: stageKeys(MASK_STAGE_ID) },
  });
  api.registerSlot({ id: OVERLAY_ID, slot: "develop-canvas-overlay", component: GraduatedLine });
}

export function deactivate(): void {
  const api = host;
  if (!api) return;
  host = null;
  // A throw here would skip the host's sweep of this extension's
  // registrations, so a failure is logged instead.
  try {
    for (const stage of allStages()) api.unregisterProcessingStage(stage.id);
  } catch (err) {
    console.warn("[graduated-density] deactivate failed:", err);
  }
}
