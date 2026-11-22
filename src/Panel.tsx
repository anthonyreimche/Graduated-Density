// The panel, in the order of the module it ports: the switch, Density,
// Hardness, Rotation, then the offset darktable sets only on the canvas, the
// tint's Hue and Saturation, the module's presets, and the button that puts
// the line on the photo. Hue shows in degrees and Saturation in percent, as
// darktable shows them.
//
// It edits whatever useParamScope hands it: the photo's filter in the dock, a
// mask's in the Masking panel (and while a mask's shows, the line on the
// photo is that mask's). A drag writes live and commits on release, so one
// gesture is one undo step; the switch and a preset commit at once. Moving a
// slider or picking a preset switches the filter on, as darktable does when a
// module's parameter changes, and switching it on, turning it or moving it
// puts the line on the photo.

import { scopeTarget, type Target } from "./edit";
import { DEFAULT_PARAMS, PRESETS, RANGES, type NumericKey, type Params } from "./model";
import { LABELS } from "./params";
import { React, api } from "./rt";
import { store } from "./store";

const TIPS: Readonly<Record<keyof Params, string>> = {
  on: "Switch the filter on or off",
  density: "How many stops (EV) the filter darkens its side of the line by; below zero it brightens the other side instead",
  hardness: "How quickly the filter fades in across the line, in percent: 0 spreads it over the whole frame, 100 over about a tenth of it",
  rotation: "Turns the filter's line, in degrees. Drag an end of the line on the photo to turn it there",
  offset: "Where the line crosses the frame, in percent: 50 runs through the centre. Drag the line on the photo to move it",
  hue: "The colour of the filter's tint, in degrees",
  saturation: "How strong the tint is, in percent: 0 is a neutral grey filter",
};

/** The Hue slider's track: every hue at half lightness, as the tint takes it. */
export const HUE_TRACK = `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((h) => `hsl(${h}, 100%, 50%)`).join(", ")})`;

/** The Saturation slider's track: dark grey to the hue at full strength. */
export const saturationTrack = (hue: number): string => `linear-gradient(to right, rgb(51, 51, 51), hsl(${hue}, 100%, 50%))`;

const SHOWS_LINE: ReadonlySet<keyof Params> = new Set(["rotation", "offset"]);

export function GraduatedPanel() {
  const { Slider } = api.components;
  const { Button, Select, Stack, Toggle } = api.ui;
  const scope = api.develop.useParamScope();
  const target: Target = scopeTarget(scope);
  const p = target.read();
  const maskId = scope.maskId;
  const ours = store()((s) => (s.scope?.maskId ?? null) === maskId);
  const lineShown = store()((s) => s.editing) && ours;

  // The line shows while a panel does; with the last one it goes.
  React.useEffect(() => {
    store().getState().panelShown(true);
    return () => store().getState().panelShown(false);
  }, []);

  // While a mask's sub-panel shows, the line on the photo is that mask's.
  React.useEffect(() => {
    if (maskId === null) return;
    store().getState().editScope(scope);
    return () => store().getState().leaveMask(maskId);
  }, [maskId]);

  const take = (showLine: boolean) => {
    if (!ours) store().getState().editScope(maskId === null ? null : scope);
    if (showLine) store().getState().edit(true);
  };

  const change = (key: NumericKey, v: number) => {
    const now = target.read();
    target.write({ ...now, [key]: Math.min(Math.max(v, RANGES[key].min), RANGES[key].max), on: true }, [key, "on"]);
    take(!now.on || SHOWS_LINE.has(key));
  };

  const slider = (key: NumericKey, track?: string) => {
    const range = RANGES[key];
    return (
      <div key={key} title={TIPS[key]}>
        <Slider
          label={LABELS[key]}
          value={p[key]}
          min={range.min}
          max={range.max}
          step={range.step}
          defaultValue={DEFAULT_PARAMS[key]}
          trackBackground={track}
          onChange={(v) => change(key, v)}
          onCommit={() => target.commit(LABELS[key].toLowerCase())}
        />
      </div>
    );
  };

  return (
    <Stack gap={6} style={{ padding: 8 }}>
      <div title={TIPS.on}>
        <Toggle
          checked={p.on}
          label={LABELS.on}
          onChange={(checked) => {
            target.write({ ...target.read(), on: checked }, ["on"]);
            target.commit(checked ? "on" : "off");
            if (checked) take(true);
          }}
        />
      </div>
      {slider("density")}
      {slider("hardness")}
      {slider("rotation")}
      {slider("offset")}
      {slider("hue", HUE_TRACK)}
      {slider("saturation", saturationTrack(p.hue))}
      <Select
          value=""
          placeholder="Presets"
          ariaLabel="Graduated Density presets"
          title="Neutral and tinted filters of one, two and three stops, soft or hard. The line stays where it is"
          options={PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
          onChange={(id) => {
            const preset = PRESETS.find((candidate) => candidate.id === id);
            if (!preset) return;
            const now = target.read();
            target.write({ ...now, ...preset.params, rotation: now.rotation, offset: now.offset, on: true }, [
              "on",
              "density",
              "hardness",
              "hue",
              "saturation",
            ]);
            target.commit(preset.label);
            take(!now.on);
          }}
        />
      <Button
        size="sm"
        full
        active={lineShown}
        disabled={!p.on}
        title={lineShown ? "Take the line off the photo (Esc)" : "Show the filter's line on the photo, to move and turn it"}
        onClick={() => {
          if (lineShown) return store().getState().edit(false);
          take(true);
        }}
      >
        {lineShown ? "Done" : "Edit Line"}
      </Button>
    </Stack>
  );
}

/** The panel header's reset: the photo's filter back to its defaults, off. */
export function resetGraduated(target: Target): void {
  target.write({ ...DEFAULT_PARAMS }, Object.keys(LABELS) as (keyof Params)[]);
  target.commit("reset");
  store().getState().edit(false);
}
