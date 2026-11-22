// Graduated Density's maths: darktable's graduated density module
// (src/iop/graduatednd.c, release-5.6.1), ported. The GPU stage (glsl.ts)
// runs the same steps per pixel; test/reference pins this file to the module's
// own C, compiled by gcc.
//
// The filter is a density ramp across a line. A pixel's place along the
// line's normal, scaled by the hardness, is its `length`; the density there is
// 2^(EV · clip(0.5 + length)), from none on the clear side to the full EV on
// the dense side. With a positive EV each channel is divided by
// colour + (1 − colour) · density, the colour being the filter's tint at half
// lightness (neutral grey: 0.5 on every channel). A negative EV multiplies by
// the same expression, with the tint inverted and the ramp reversed, which
// brightens the other side of the line.
//
// Units are the panel's: rotation in degrees as darktable's slider shows it
// (its stored rotation negated), hue in degrees and saturation in percent.
// toDarktable gives the struct darktable stores.

export interface Params {
  on: boolean;
  /** Stops of density at the filter's full strength; negative brightens the other side. */
  density: number;
  /** Percent: 0 spreads the transition over the whole frame, 100 makes it about a tenth of that. */
  hardness: number;
  /** Degrees, as darktable's slider shows it: the line's turn from level,
   *  clockwise, measured as if the frame were square (at 45° a centred line
   *  runs corner to corner). */
  rotation: number;
  /** Percent: where the line crosses the frame, 50 through the centre. */
  offset: number;
  /** Degrees of the tint's hue. */
  hue: number;
  /** Percent of the tint's saturation; 0 is a neutral filter. */
  saturation: number;
}

export type NumericKey = Exclude<keyof Params, "on">;

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_PARAMS: Readonly<Params> = {
  on: false,
  density: 1,
  hardness: 0,
  rotation: 0,
  offset: 50,
  hue: 0,
  saturation: 0,
};

// darktable leaves the offset unbounded; past these the line misses the frame
// at every angle, so the slider and the line's drag stop there.
export const RANGES: Readonly<Record<NumericKey, Range>> = {
  density: { min: -8, max: 8, step: 0.01 },
  hardness: { min: 0, max: 100, step: 1 },
  rotation: { min: -180, max: 180, step: 0.1 },
  offset: { min: -25, max: 125, step: 0.1 },
  hue: { min: 0, max: 360, step: 0.1 },
  saturation: { min: 0, max: 100, step: 0.1 },
};

export const clampTo = (key: NumericKey, v: number): number => Math.min(Math.max(v, RANGES[key].min), RANGES[key].max);

/** A value to a hundredth, as a slider's value field fits it: what the line's
 *  drag and the presets write. 0.005° or 0.005 % is under a pixel across an
 *  8000 px photo. */
export const hundredth = (v: number): number => Math.round(v * 100) / 100;

/** dt_iop_graduatednd_params_t: the struct darktable stores in a history. */
export interface DarktableParams {
  density: number;
  hardness: number;
  rotation: number;
  offset: number;
  /** 0 to 1. */
  hue: number;
  /** 0 to 1. */
  saturation: number;
}

export function toDarktable(p: Params): DarktableParams {
  return {
    density: p.density,
    hardness: p.hardness,
    rotation: -p.rotation,
    offset: p.offset,
    hue: p.hue / 360,
    saturation: p.saturation / 100,
  };
}

export function fromDarktable(d: DarktableParams): Omit<Params, "on"> {
  return {
    density: d.density,
    hardness: d.hardness,
    rotation: d.rotation === 0 ? 0 : -d.rotation,
    offset: d.offset,
    hue: d.hue * 360,
    saturation: d.saturation * 100,
  };
}

export type Rgb = [number, number, number];

// src/common/colorspaces.h hue2rgb: `hue` pre-scaled to 0..6.
function hueToChannel(m1: number, m2: number, hue: number): number {
  if (hue < 1) return m1 + (m2 - m1) * hue;
  if (hue < 3) return m2;
  return hue < 4 ? m1 + (m2 - m1) * (4 - hue) : m1;
}

/** src/common/colorspaces.h hsl2rgb, every argument 0 to 1. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) return [l, l, l];
  const m2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const m1 = 2 * l - m2;
  const h6 = h * 6;
  return [
    hueToChannel(m1, m2, h6 < 4 ? h6 + 2 : h6 - 4),
    hueToChannel(m1, m2, h6),
    hueToChannel(m1, m2, h6 > 2 ? h6 - 2 : h6 + 4),
  ];
}

/** commit_params: the filter's colour (inverted for a negative density) and its complement. */
export function filterColours(d: DarktableParams): { color: Rgb; color1: Rgb } {
  let color = hslToRgb(d.hue, d.saturation, 0.5);
  if (d.density < 0) color = color.map((c) => 1 - c) as Rgb;
  return { color, color1: color.map((c) => 1 - c) as Rgb };
}

/** process()'s filter_hardness for an image `aspect` times as wide as it is high. */
export function filterHardness(hardness: number, aspect: number): number {
  const radie = Math.hypot(1, aspect);
  return (1 / radie / (1 - (0.5 + ((hardness / 100) * 0.9) / 2))) * 0.5;
}

/** process()'s `length` at a point of the image: (u, v) run from -1 to 1
 *  across its width and down its height (pixel X of a W wide image: 2X/W - 1). */
export function gradientLength(d: DarktableParams, aspect: number, u: number, v: number): number {
  const a = (-d.rotation * Math.PI) / 180;
  const offset = (d.offset / 100) * 2;
  return (Math.sin(a) * u - Math.cos(a) * v - 1 + offset) * filterHardness(d.hardness, aspect);
}

const clip = (x: number): number => (x >= 0 ? (x <= 1 ? x : 1) : 0);

/** What the filter multiplies each channel by at `length`. */
export function filterGain(density: number, colours: { color: Rgb; color1: Rgb }, length: number): Rgb {
  const { color, color1 } = colours;
  if (density > 0) {
    const dens = 2 ** (density * clip(0.5 + length));
    return [0, 1, 2].map((c) => 1 / (color[c] + color1[c] * dens)) as Rgb;
  }
  const dens = 2 ** (-density * clip(0.5 - length));
  return [0, 1, 2].map((c) => color[c] + color1[c] * dens) as Rgb;
}

// The filter's colour works in linear Rec.2020, darktable's default working
// space, where its tints were chosen; Safelight's scene values are linear
// Rec.709. ITU-R BT.2087, row-major.
export const REC709_TO_REC2020: readonly number[] = [
  0.627403895934699, 0.329283038377884, 0.043313065687417,
  0.069097289358232, 0.919540395075459, 0.011362315566309,
  0.01639143887515, 0.088013307877226, 0.895595253247624,
];

export function invert3(m: readonly number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

export const REC2020_TO_REC709: readonly number[] = invert3(REC709_TO_REC2020);

export const apply3 = (m: readonly number[], v: readonly number[]): Rgb => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

/** The filter on a linear Rec.709 colour at image point (u, v) (see
 *  gradientLength), as the stage applies it: a neutral filter scales the
 *  colour as it is, a tinted one scales it in Rec.2020. */
export function filterPixel(p: Params, aspect: number, u: number, v: number, lin: Rgb): Rgb {
  if (!p.on) return lin;
  const d = toDarktable(p);
  const gain = filterGain(d.density, filterColours(d), gradientLength(d, aspect, u, v));
  if (d.saturation === 0) return [lin[0] * gain[0], lin[1] * gain[1], lin[2] * gain[2]];
  const wide = apply3(REC709_TO_REC2020, lin);
  return apply3(REC2020_TO_REC709, [wide[0] * gain[0], wide[1] * gain[1], wide[2] * gain[2]]);
}

export interface Preset {
  id: string;
  label: string;
  params: Omit<Params, "on">;
}

// darktable's presets (init_presets), its struct values converted to the
// panel's units, to a hundredth. ND2/ND4/ND8 are filter factors: one, two and
// three stops.
function preset(id: string, label: string, d: Partial<DarktableParams>): Preset {
  const p = fromDarktable({ density: 1, hardness: 0, rotation: 0, offset: 50, hue: 0, saturation: 0, ...d });
  return { id, label, params: { ...p, hue: hundredth(p.hue), saturation: hundredth(p.saturation) } };
}

export const PRESETS: readonly Preset[] = [
  preset("nd2-soft", "Neutral grey ND2 (soft)", { density: 1 }),
  preset("nd4-soft", "Neutral grey ND4 (soft)", { density: 2 }),
  preset("nd8-soft", "Neutral grey ND8 (soft)", { density: 3 }),
  preset("nd2-hard", "Neutral grey ND2 (hard)", { density: 1, hardness: 75 }),
  preset("nd4-hard", "Neutral grey ND4 (hard)", { density: 2, hardness: 75 }),
  preset("nd8-hard", "Neutral grey ND8 (hard)", { density: 3, hardness: 75 }),
  preset("orange-nd2", "Orange ND2 (soft)", { density: 1, hue: 0.102439, saturation: 0.8 }),
  preset("yellow-nd2", "Yellow ND2 (soft)", { density: 1, hue: 0.15122, saturation: 0.5 }),
  preset("purple-nd2", "Purple ND2 (soft)", { density: 1, hue: 0.82439, saturation: 0.5 }),
  preset("green-nd2", "Green ND2 (soft)", { density: 1, hue: 0.302439, saturation: 0.5 }),
  preset("red-nd2", "Red ND2 (soft)", { density: 1, hue: 0, saturation: 0.5 }),
  preset("blue-nd2", "Blue ND2 (soft)", { density: 1, hue: 0.663415, saturation: 0.5 }),
  preset("brown-nd4", "Brown ND4 (soft)", { density: 2, hue: 0.082927, saturation: 0.25 }),
];
