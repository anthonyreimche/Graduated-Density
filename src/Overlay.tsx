// The filter's line on the photo, in the develop-canvas-overlay slot, while a
// Graduated Density panel shows, the filter is on and the line is being
// edited (store.ts). It is drawn as darktable draws it: a dark line under a
// light one, with a small triangle at each end on the clear side. Dragging an
// end turns the line about the other end; dragging the line moves it without
// turning it. A drag writes the filter live and commits once on release.
// Only the line and its ends take the pointer, so the rest of the canvas pans
// and zooms as always, and Ctrl/Cmd/Space make them click-through (core's
// passthrough).
//
// The line lives in source UV, through the canvas's own mapping, so it stays
// on the same part of the photo through zoom, pan, crop and straighten. Where
// darktable's ends fall outside the visible part of the photo, the line is
// drawn across what is visible instead.

import type { PointerEvent } from "react";
import { editing, type Target } from "./edit";
import { gradFromPoints, offsetThrough, pointsFromGrad, type Point } from "./line";
import { clampTo, hundredth, toDarktable, type Params } from "./model";
import { ROTATE_CURSOR_ID } from "./cursor";
import { React, api } from "./rt";
import { clipLine, endMark, within } from "./screen";
import type { OverlayRect } from "./safelight";
import { store } from "./store";

type Part = "a" | "b" | "line";

interface Drag {
  part: Part;
  pointerId: number;
  /** The pointer at the press, in source UV. */
  start: Point;
  /** The line's ends at the press, in source UV. */
  a: Point;
  b: Point;
  /** Where the drag's writes go: the scope being edited at the press. */
  target: Target;
  /** The line's ends as the last move left them, in source UV. */
  last: { a: Point; b: Point } | null;
}

const MARK = 9;
const GRAB = 10;

/** The filter's rotation and offset for a drag that has reached `at`
 *  (source UV), and the line's ends to draw meanwhile. */
function dragged(d: Drag, at: Point, p: Params): { patch: Pick<Params, "rotation" | "offset">; a: Point; b: Point } {
  if (d.part === "line") {
    const shift = { x: at.x - d.start.x, y: at.y - d.start.y };
    const a = { x: d.a.x + shift.x, y: d.a.y + shift.y };
    const b = { x: d.b.x + shift.x, y: d.b.y + shift.y };
    return { patch: { rotation: p.rotation, offset: hundredth(clampTo("offset", offsetThrough(-p.rotation, a))) }, a, b };
  }
  const a = d.part === "a" ? at : d.a;
  const b = d.part === "b" ? at : d.b;
  const grad = gradFromPoints(a, b);
  const rotation = grad.rotation === 0 ? 0 : -grad.rotation;
  return {
    patch: { rotation: hundredth(clampTo("rotation", rotation)), offset: hundredth(clampTo("offset", grad.offset)) },
    a,
    b,
  };
}

/** The line's ends on screen: darktable's where both are in view, else the
 *  visible stretch of the line; null where none of it is in view. */
function screenEnds(a: Point, b: Point, rect: OverlayRect, toScreen: (u: number, v: number) => Point): [Point, Point] | null {
  const sa = toScreen(a.x, a.y);
  const sb = toScreen(b.x, b.y);
  if (within(sa, rect) && within(sb, rect)) return [sa, sb];
  return clipLine(sa, sb, rect);
}

/** The ends a drag left the line with, while they still describe the filter
 *  (to the hundredth the drag wrote). */
interface Kept {
  stage: string;
  a: Point;
  b: Point;
}

const describes = (k: Kept, stage: string, p: Params): boolean => {
  if (k.stage !== stage) return false;
  const g = gradFromPoints(k.a, k.b);
  const turn = Math.abs(((g.rotation + p.rotation + 540) % 360) - 180);
  return turn <= 0.005 + 1e-9 && Math.abs(g.offset - p.offset) <= 0.005 + 1e-9;
};

export function GraduatedLine() {
  const overlay = api.develop.useDevelopOverlay();
  api.stores.useDevelopStore((s) => s.paramBag);
  api.stores.useDevelopStore((s) => s.params.masks);
  store()((s) => s.scope);
  const photoId = api.stores.useDevelopStore((s) => s.photoId);
  const panels = store()((s) => s.panels);
  const editingLine = store()((s) => s.editing);
  const root = React.useRef<HTMLDivElement | null>(null);
  const drag = React.useRef<Drag | null>(null);
  const kept = React.useRef<Kept | null>(null);
  const [live, setLive] = React.useState<{ a: Point; b: Point } | null>(null);
  const [hover, setHover] = React.useState<Part | null>(null);

  const target = editing();
  const p = target.read();
  const shown = editingLine && panels > 0 && p.on;
  const { rect, toScreen, toImage } = overlay;

  // darktable keeps the ends where a drag left them; they are dropped once
  // the filter moves some other way.
  const still = kept.current && describes(kept.current, target.stage, p) ? kept.current : null;
  const [ua, ub] = live ? [live.a, live.b] : still ? [still.a, still.b] : pointsFromGrad(toDarktable(p).rotation, p.offset);
  const ends = shown && photoId && rect && toScreen && toImage ? screenEnds(ua, ub, rect, toScreen) : null;

  /** Ends the drag in progress, if any: one undo step for what it wrote. */
  const finish = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.last) kept.current = { stage: d.target.stage, a: d.last.a, b: d.last.b };
    setLive(null);
    if (d.last) d.target.commit(d.part === "line" ? "move line" : "turn line");
  };

  React.useEffect(() => {
    drag.current = null;
    kept.current = null;
    setLive(null);
  }, [photoId]);

  // A drag whose line goes (Escape, the panel closing, the line dragged out
  // of view, the overlay unmounting) never sees its release: end it here.
  const drawn = ends !== null;
  React.useEffect(() => {
    if (!drawn) finish();
  }, [drawn]);
  React.useEffect(() => () => finish(), []);

  // Escape is held only while the line is on the photo, so it reaches
  // whatever is under this the rest of the time.
  React.useEffect(() => (shown ? api.ui.onEscape(() => store().getState().edit(false)) : undefined), [shown]);

  if (!ends || !toImage) return null;
  const [sa, sb] = ends;

  const pointerUv = (e: PointerEvent<Element>): Point | null => {
    if (!root.current) return null;
    const at = api.develop.framePoint(root.current, e.clientX, e.clientY);
    return toImage(at.x, at.y);
  };

  const onDown = (part: Part) => (e: PointerEvent<SVGElement>) => {
    if (e.button !== 0) return;
    const at = pointerUv(e);
    if (!at) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // The ends as drawn, in source UV, so a press doesn't move the line.
    drag.current = { part, pointerId: e.pointerId, start: at, a: toImage(sa.x, sa.y), b: toImage(sb.x, sb.y), target, last: null };
  };

  const onMove = (e: PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || e.buttons === 0) return;
    const at = pointerUv(e);
    if (!at || (!d.last && at.x === d.start.x && at.y === d.start.y)) return;
    const now = d.target.read();
    const next = dragged(d, at, now);
    d.last = { a: next.a, b: next.b };
    setLive(d.last);
    d.target.write({ ...now, ...next.patch, on: true }, ["rotation", "offset", "on"]);
  };

  const onUp = (e: PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    finish();
  };

  const dragging = drag.current?.part ?? null;
  const hot = (part: Part) => (dragging ? dragging === part : hover === part);
  const lineHot = hot("line");
  const handlers = (part: Part) => ({
    onPointerDown: onDown(part),
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onLostPointerCapture: onUp,
    onPointerEnter: () => setHover(part),
    onPointerLeave: () => setHover((h) => (h === part ? null : h)),
  });
  const mark = (part: "a" | "b") => {
    const pts = endMark(part === "a" ? sa : sb, sa, sb, part === "a" ? 1 : -1, MARK);
    const strong = hot(part);
    return (
      <polygon
        data-gd-mark={part}
        points={pts.map((q) => `${q.x},${q.y}`).join(" ")}
        fill={`rgba(255,255,255,${strong ? 1 : 0.5})`}
        stroke={`rgba(0,0,0,${strong ? 1 : 0.5})`}
        strokeWidth={1}
        pointerEvents="none"
      />
    );
  };
  const rotate = api.cursors.resolve(ROTATE_CURSOR_ID);

  return (
    <div ref={root} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="rgba(0,0,0,0.8)" strokeWidth={lineHot ? 5 : 3} strokeLinecap="round" pointerEvents="none" />
        <line x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke="rgba(255,255,255,0.8)" strokeWidth={lineHot ? 2 : 1} strokeLinecap="round" pointerEvents="none" />
        {mark("a")}
        {mark("b")}
        <line
          data-gd-part="line"
          x1={sa.x}
          y1={sa.y}
          x2={sb.x}
          y2={sb.y}
          stroke="transparent"
          strokeWidth={2 * GRAB}
          pointerEvents="stroke"
          style={{ cursor: api.cursors.resolve("crop-move"), touchAction: "none" }}
          {...handlers("line")}
        >
          <title>Drag to move the filter's line</title>
        </line>
        {(["a", "b"] as const).map((part) => {
          const at = part === "a" ? sa : sb;
          return (
            <circle
              key={part}
              data-gd-part={part}
              cx={at.x}
              cy={at.y}
              r={GRAB}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: rotate, touchAction: "none" }}
              {...handlers(part)}
            >
              <title>Drag to turn the filter's line about its other end</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
