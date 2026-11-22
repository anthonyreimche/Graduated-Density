// Graduated Density inside a mask: the Masking panel's sub-panel edits that
// mask's filter under the masks' stage, and while it shows, the line on the
// photo is that mask's.

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { activate, deactivate } from "../src/index";
import { DEFAULT_PARAMS } from "../src/model";
import { GraduatedLine } from "../src/Overlay";
import { GraduatedPanel } from "../src/Panel";
import { MASK_STAGE_ID, STAGE_ID, bagPatch, readParams, stageKeys } from "../src/params";
import { React } from "../src/rt";
import type { Mask } from "../src/safelight";
import { store } from "../src/store";
import { fakeApi, type Rig } from "./support/fake-api";

const RECT = { x: 100, y: 50, w: 600, h: 400 };

function maskOf(id: string, bag: Record<string, unknown> = {}): Mask {
  return { id, name: id, visible: true, invert: false, opacity: 100, adj: {} as Mask["adj"], panels: [], components: [], bag };
}

const maskParams = (rig: Rig, id: string) =>
  readParams(rig.masks().find((m) => m.id === id)?.bag ?? {}, MASK_STAGE_ID);

function setup() {
  const rig = fakeApi(bagPatch({ ...DEFAULT_PARAMS, on: true, density: 2 }, STAGE_ID));
  rig.setMasks([maskOf("m1", bagPatch(DEFAULT_PARAMS, MASK_STAGE_ID))]);
  activate(rig.api);
  act(() => rig.setImageRect(RECT));
  return rig;
}

afterEach(() => {
  cleanup();
  deactivate();
});

const captured = new Set<number>();
Object.assign(Element.prototype, {
  setPointerCapture: (id: number) => void captured.add(id),
  releasePointerCapture: (id: number) => void captured.delete(id),
  hasPointerCapture: (id: number) => captured.has(id),
});

describe("in a mask", () => {
  it("is offered to masks, owning every key of the masks' stage", () => {
    const rig = setup();
    expect(rig.panels[0].mask).toEqual({ component: GraduatedPanel, owns: stageKeys(MASK_STAGE_ID) });
  });

  it("edits the mask's filter, not the photo's, and switches it on", () => {
    const rig = setup();
    const view = render(
      <rig.MaskScope maskId="m1">
        <GraduatedPanel />
      </rig.MaskScope>,
    );
    const density = rig.sliders(view.container).find((s) => s.label === "Density");
    expect(density?.value).toBe(1);
    act(() => density?.onChange(-1.5));
    act(() => density?.onCommit?.());
    expect(maskParams(rig, "m1")).toMatchObject({ on: true, density: -1.5 });
    expect(readParams(rig.params(), STAGE_ID).density).toBe(2);
    expect(rig.commits).toEqual(["Graduated Density: density"]);
  });

  it("hands the line to the mask while its sub-panel shows, and back to the photo after", () => {
    const rig = setup();
    const sub = render(
      <rig.MaskScope maskId="m1">
        <GraduatedPanel />
      </rig.MaskScope>,
    );
    act(() => void fireEvent.click(sub.getByRole("checkbox")));
    expect(store().getState()).toMatchObject({ editing: true });
    expect(store().getState().scope?.maskId).toBe("m1");

    const line = render(<GraduatedLine />);
    const part = line.container.querySelector('[data-gd-part="line"]');
    if (!part) throw new Error("no line");
    fireEvent.pointerDown(part, { clientX: 400, clientY: 250, pointerId: 1, button: 0 });
    fireEvent.pointerMove(part, { clientX: 400, clientY: 290, pointerId: 1, button: 0, buttons: 1 });
    fireEvent.pointerUp(part, { clientX: 400, clientY: 290, pointerId: 1, button: 0 });
    expect(maskParams(rig, "m1").offset).toBeCloseTo(60, 9);
    expect(readParams(rig.params(), STAGE_ID).offset).toBe(50);

    sub.unmount();
    expect(store().getState().scope).toBeNull();
  });
});
