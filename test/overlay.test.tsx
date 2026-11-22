// The line on the canvas: drawn through the canvas mapping where darktable
// draws it, its ends turn it, its body moves it, one undo step per drag.

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { activate, deactivate } from "../src/index";
import { pointsFromGrad } from "../src/line";
import { DEFAULT_PARAMS, type Params } from "../src/model";
import { GraduatedLine } from "../src/Overlay";
import { STAGE_ID, bagPatch, readParams } from "../src/params";
import { React } from "../src/rt";
import { store } from "../src/store";
import { fakeApi, type Rect } from "./support/fake-api";

const RECT = { x: 100, y: 50, w: 600, h: 400 };

function setup(over: Partial<Params> = {}, rect: Rect = RECT) {
  const rig = fakeApi(bagPatch({ ...DEFAULT_PARAMS, on: true, ...over }, STAGE_ID));
  activate(rig.api);
  act(() => rig.setImageRect(rect));
  act(() => store().getState().panelShown(true));
  act(() => store().getState().edit(true));
  const view = render(<GraduatedLine />);
  const part = (name: "a" | "b" | "line") => {
    const el = view.container.querySelector<SVGElement>(`[data-gd-part="${name}"]`);
    if (!el) throw new Error(`no ${name}`);
    return el;
  };
  const end = (name: "a" | "b") => {
    const el = part(name);
    return { x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")) };
  };
  return { rig, view, part, end, params: () => readParams(rig.params(), STAGE_ID) };
}

afterEach(() => {
  cleanup();
  deactivate();
});

// jsdom has no pointer capture.
const captured = new Set<number>();
Object.assign(Element.prototype, {
  setPointerCapture: (id: number) => void captured.add(id),
  releasePointerCapture: (id: number) => void captured.delete(id),
  hasPointerCapture: (id: number) => captured.has(id),
});

// jsdom lays nothing out: the overlay root sits at the origin, unzoomed.
// A move carries the held primary button, as a drag's moves do.
const press = (el: Element, x: number, y: number, type: "pointerDown" | "pointerMove" | "pointerUp") =>
  fireEvent[type](el, { clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === "pointerUp" ? 0 : 1 });

const hundredth = (x: number) => Math.round(x * 100) / 100;
const onHundredths = (x: number) => expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThan(1e-9);

const screen = (u: number, v: number) => ({ x: RECT.x + u * RECT.w, y: RECT.y + v * RECT.h });

describe("GraduatedLine", () => {
  it("draws darktable's line: level and centred at the defaults, a tenth in from each side", () => {
    const { end } = setup();
    expect(end("a")).toEqual(screen(0.1, 0.5));
    expect(end("b")).toEqual(screen(0.9, 0.5));
  });

  it("follows the rotation and the offset", () => {
    const { end } = setup({ rotation: 30, offset: 40 });
    const [a, b] = pointsFromGrad(-30, 40);
    expect(end("a").x).toBeCloseTo(screen(a.x, a.y).x, 9);
    expect(end("b").y).toBeCloseTo(screen(b.x, b.y).y, 9);
    // Clockwise: the right end is lower.
    expect(end("b").y).toBeGreaterThan(end("a").y);
  });

  it("draws nothing while off, while no panel shows, or until the line is edited", () => {
    const { rig, view } = setup();
    act(() => store().getState().edit(false));
    expect(view.container.querySelector("svg")).toBeNull();
    act(() => store().getState().edit(true));
    act(() => rig.replace(bagPatch({ ...DEFAULT_PARAMS, on: false }, STAGE_ID)));
    expect(view.container.querySelector("svg")).toBeNull();
    act(() => rig.replace(bagPatch({ ...DEFAULT_PARAMS, on: true }, STAGE_ID)));
    act(() => store().getState().panelShown(false));
    expect(view.container.querySelector("svg")).toBeNull();
  });

  it("takes the line off on Escape and gives the key back", () => {
    const { rig, view } = setup();
    let taken = false;
    act(() => {
      taken = rig.escape();
    });
    expect(taken).toBe(true);
    expect(view.container.querySelector("svg")).toBeNull();
    expect(rig.escape()).toBe(false);
  });

  it("turns the line about its other end, live, and commits once", () => {
    const { rig, part, end, params } = setup();
    const b = end("b");
    press(part("a"), 160, 250, "pointerDown");
    // a to the left end's spot raised: the line now climbs to the left.
    press(part("a"), 160, 150, "pointerMove");
    const p = params();
    expect(rig.commits).toEqual([]);
    const angle = (Math.atan2((b.y - 150) / RECT.h, (b.x - 160) / RECT.w) * 180) / Math.PI;
    // Written to a hundredth, as the slider's value field fits it.
    expect(p.rotation).toBe(hundredth(angle));
    onHundredths(p.offset);
    expect(end("a")).toEqual({ x: 160, y: 150 });
    expect(end("b")).toEqual(b);
    press(part("a"), 160, 150, "pointerUp");
    expect(rig.commits).toEqual(["Graduated Density: turn line"]);
    // The ends stay where the drag left them.
    expect(end("a").x).toBeCloseTo(160, 9);
    expect(end("a").y).toBeCloseTo(150, 9);
  });

  it("moves the line without turning it", () => {
    const { rig, part, params } = setup({ rotation: 20 });
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 290, "pointerMove");
    press(part("line"), 400, 290, "pointerUp");
    expect(params().rotation).toBe(20);
    // 40 px of 400 is a tenth of the height: at 20° the line's offset drops by cos 20° · 10.
    expect(params().offset).toBe(hundredth(50 + Math.cos((20 * Math.PI) / 180) * 10));
    expect(rig.commits).toEqual(["Graduated Density: move line"]);
  });

  it("puts the dense side on the drag's left: dragging the line's ends past each other flips it", () => {
    const { part, end, params } = setup();
    const a = end("a");
    press(part("b"), end("b").x, end("b").y, "pointerDown");
    press(part("b"), a.x - 200, a.y, "pointerMove");
    expect(Math.abs(params().rotation)).toBeCloseTo(180, 9);
  });

  it("keeps the offset within reach when the line is dragged far off the photo", () => {
    const { part, params } = setup();
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 9000, "pointerMove");
    expect(params().offset).toBe(125);
  });

  it("a click without a move is no undo step", () => {
    const { rig, part } = setup();
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 250, "pointerUp");
    expect(rig.commits).toEqual([]);
  });

  it("a move back to where the press was is no undo step", () => {
    const { rig, part } = setup();
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 250, "pointerMove");
    press(part("line"), 400, 250, "pointerUp");
    expect(rig.commits).toEqual([]);
  });

  it("ends a drag whose pointer capture is lost as a release would", () => {
    const { rig, part, params } = setup();
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 290, "pointerMove");
    fireEvent.lostPointerCapture(part("line"), { pointerId: 1 });
    expect(rig.commits).toEqual(["Graduated Density: move line"]);
    const offset = params().offset;
    // A hover afterwards, with no button held, moves nothing.
    fireEvent.pointerMove(part("line"), { clientX: 400, clientY: 350, pointerId: 1, buttons: 0 });
    expect(params().offset).toBe(offset);
  });

  it("ignores a move with no button held, even mid-drag", () => {
    const { part, params } = setup();
    press(part("line"), 400, 250, "pointerDown");
    fireEvent.pointerMove(part("line"), { clientX: 400, clientY: 330, pointerId: 1, buttons: 0 });
    expect(params().offset).toBe(50);
  });

  it("commits a drag cut short by Escape, and a later hover moves nothing", () => {
    const { rig, view, part, params } = setup();
    const line = part("line");
    press(line, 400, 250, "pointerDown");
    press(line, 400, 290, "pointerMove");
    act(() => void rig.escape());
    expect(view.container.querySelector("svg")).toBeNull();
    expect(rig.commits).toEqual(["Graduated Density: move line"]);
    act(() => store().getState().edit(true));
    const offset = params().offset;
    fireEvent.pointerMove(part("line"), { clientX: 400, clientY: 350, pointerId: 1, buttons: 1 });
    expect(params().offset).toBe(offset);
  });

  it("commits a drag that takes the line out of view", () => {
    const { rig, view, part, params } = setup();
    press(part("line"), 400, 250, "pointerDown");
    press(part("line"), 400, 9000, "pointerMove");
    expect(params().offset).toBe(125);
    expect(view.container.querySelector("svg")).toBeNull();
    expect(rig.commits).toEqual(["Graduated Density: move line"]);
  });

  it("commits a drag cut short when the overlay goes", () => {
    const { rig, view, part } = setup();
    press(part("a"), 160, 250, "pointerDown");
    press(part("a"), 160, 180, "pointerMove");
    view.unmount();
    expect(rig.commits).toEqual(["Graduated Density: turn line"]);
  });

  it("draws the visible stretch of the line when darktable's ends are out of view", () => {
    // Zoomed in: the image runs past the view on every side.
    const rig = fakeApi(bagPatch({ ...DEFAULT_PARAMS, on: true }, STAGE_ID));
    activate(rig.api);
    act(() => rig.setImageRect({ x: -200, y: -150, w: 1200, h: 800 }, 1.5, { x: 0, y: 0, w: 800, h: 500 }));
    act(() => store().getState().panelShown(true));
    act(() => store().getState().edit(true));
    const view = render(<GraduatedLine />);
    const at = (name: string) => {
      const el = view.container.querySelector(`[data-gd-part="${name}"]`);
      return { x: Number(el?.getAttribute("cx")), y: Number(el?.getAttribute("cy")) };
    };
    // The line at y 250 crosses the view from 0 to 800; a tenth in from each end.
    expect(at("a").x).toBeCloseTo(80, 9);
    expect(at("a").y).toBeCloseTo(250, 9);
    expect(at("b").x).toBeCloseTo(720, 9);
  });
});
