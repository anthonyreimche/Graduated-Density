// The panel: sliders write live and commit on release, moving one switches
// the filter on, presets keep the line, and the line goes on the photo when
// the filter switches on or the line is turned or moved.

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { activate, deactivate } from "../src/index";
import { DEFAULT_PARAMS, PRESETS } from "../src/model";
import { GraduatedPanel, HUE_TRACK } from "../src/Panel";
import { STAGE_ID, bagPatch, readParams } from "../src/params";
import { React } from "../src/rt";
import { store } from "../src/store";
import { fakeApi } from "./support/fake-api";

function setup(initial: Record<string, unknown> = {}) {
  const rig = fakeApi(initial);
  activate(rig.api);
  const view = render(<GraduatedPanel />);
  const slider = (label: string) => {
    const s = rig.sliders(view.container).find((x) => x.label === label);
    if (!s) throw new Error(`no slider ${label}`);
    return s;
  };
  return { rig, view, slider, params: () => readParams(rig.params(), STAGE_ID) };
}

afterEach(() => {
  cleanup();
  deactivate();
});

describe("GraduatedPanel", () => {
  it("shows darktable's controls in its order, plus the offset, at the defaults", () => {
    const { rig, view } = setup();
    expect(rig.sliders(view.container).map((s) => [s.label, s.value])).toEqual([
      ["Density", 1],
      ["Hardness", 0],
      ["Rotation", 0],
      ["Offset", 50],
      ["Hue", 0],
      ["Saturation", 0],
    ]);
    expect(view.getByLabelText("Enabled")).not.toBeNull();
  });

  it("explains each control in a tooltip", () => {
    const { view } = setup();
    for (const el of view.container.querySelectorAll("[data-slider]")) {
      expect(el.parentElement?.getAttribute("title")).toBeTruthy();
    }
    expect(view.getByLabelText("Graduated Density presets").getAttribute("title")).toBeTruthy();
  });

  it("writes a drag live, switches the filter on, and commits once on release", () => {
    const { rig, slider, params } = setup();
    act(() => slider("Density").onChange(1.4));
    act(() => slider("Density").onChange(2.2));
    expect(params()).toMatchObject({ on: true, density: 2.2 });
    expect(rig.commits).toEqual([]);
    act(() => slider("Density").onCommit?.());
    expect(rig.commits).toEqual(["Graduated Density: density"]);
  });

  it("puts the line on the photo when the filter switches on, and when the line is turned or moved", () => {
    const { slider } = setup(bagPatch({ ...DEFAULT_PARAMS, on: true }, STAGE_ID));
    act(() => slider("Hardness").onChange(30));
    expect(store().getState().editing).toBe(false);
    act(() => slider("Rotation").onChange(12));
    expect(store().getState().editing).toBe(true);
    act(() => store().getState().edit(false));
    act(() => slider("Offset").onChange(40));
    expect(store().getState().editing).toBe(true);
  });

  it("switches on and off with the toggle, one undo step each", () => {
    const { rig, view, params } = setup();
    act(() => void fireEvent.click(view.getByRole("checkbox")));
    expect(params().on).toBe(true);
    expect(store().getState().editing).toBe(true);
    act(() => void fireEvent.click(view.getByRole("checkbox")));
    expect(params().on).toBe(false);
    expect(rig.commits).toEqual(["Graduated Density: on", "Graduated Density: off"]);
  });

  it("applies a preset's density, hardness and tint, keeps the line, and commits under its name", () => {
    const { rig, view, params } = setup(bagPatch({ ...DEFAULT_PARAMS, on: true, rotation: 20, offset: 35 }, STAGE_ID));
    const orange = PRESETS.find((p) => p.id === "orange-nd2");
    if (!orange) throw new Error("no orange preset");
    act(() => void fireEvent.change(view.getByLabelText("Graduated Density presets"), { target: { value: "orange-nd2" } }));
    expect(params()).toEqual({ ...orange.params, on: true, rotation: 20, offset: 35 });
    expect(rig.commits).toEqual(["Graduated Density: Orange ND2 (soft)"]);
  });

  it("draws the hue track and a saturation track ending at the hue", () => {
    const { slider } = setup(bagPatch({ ...DEFAULT_PARAMS, hue: 120 }, STAGE_ID));
    expect(slider("Hue").trackBackground).toBe(HUE_TRACK);
    expect(slider("Saturation").trackBackground).toContain("hsl(120, 100%, 50%)");
  });

  it("offers Edit Line only while the filter is on, and turns into Done", () => {
    const { view } = setup();
    const button = () => view.getByRole("button");
    expect((button() as HTMLButtonElement).disabled).toBe(true);
    act(() => void fireEvent.click(view.getByRole("checkbox")));
    act(() => store().getState().edit(false));
    expect(button().textContent).toBe("Edit Line");
    act(() => void fireEvent.click(button()));
    expect(store().getState().editing).toBe(true);
    expect(button().textContent).toBe("Done");
    act(() => void fireEvent.click(button()));
    expect(store().getState().editing).toBe(false);
  });

  it("counts itself among the panels showing, and takes the line off with the last", () => {
    const { view } = setup();
    expect(store().getState().panels).toBe(1);
    act(() => store().getState().edit(true));
    view.unmount();
    expect(store().getState()).toMatchObject({ panels: 0, editing: false });
  });

  it("resets the photo's filter to its defaults, off, from the dock header", () => {
    const { rig, params } = setup(bagPatch({ ...DEFAULT_PARAMS, on: true, density: 3, hue: 50, saturation: 40 }, STAGE_ID));
    act(() => rig.panels[0].onReset?.());
    expect(params()).toEqual(DEFAULT_PARAMS);
    expect(rig.commits).toEqual(["Graduated Density: reset"]);
  });
});
