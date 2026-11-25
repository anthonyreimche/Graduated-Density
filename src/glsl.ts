// The filter per pixel, as model.ts filterPixel computes it: process()'s
// length and density from graduatednd.c with the ramp eased (rampWeight), the
// tint from colorspaces.h hsl2rgb at half lightness. The position is the
// pixel's source UV, so the filter stays on the same part of the photo through
// crop, straighten and zoom, and lines up in the extra draw a later
// `reads: "current"` stage asks for (which runs in source texels);
// uImageAspect is the uncropped photo's width over its height. The host
// rewrites every whole word that matches a uniform key, so the helpers'
// parameters are named apart from the keys.

import { REC2020_TO_REC709, REC709_TO_REC2020 } from "./model";

/** A row-major 3x3 matrix as a GLSL mat3 constructor (column-major). */
function glslMat3(m: readonly number[]): string {
  const cols = [0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => m[r * 3 + c]));
  return `mat3(${cols.map((v) => v.toPrecision(17)).join(", ")})`;
}

// Function names are namespaced per stage, but globals aren't: the matrices
// are locals, so the photo's stage and the mask stage can share a program.
export const HELPERS_GLSL = `
float gdChannel(float m1, float m2, float h6) {
  if (h6 < 1.0) return m1 + (m2 - m1) * h6;
  if (h6 < 3.0) return m2;
  return h6 < 4.0 ? m1 + (m2 - m1) * (4.0 - h6) : m1;
}
vec3 gdTint(float h, float s) {
  if (s == 0.0) return vec3(0.5);
  float m2 = 0.5 + s - 0.5 * s;
  float m1 = 1.0 - m2;
  float h6 = h * 6.0;
  return vec3(
    gdChannel(m1, m2, h6 < 4.0 ? h6 + 2.0 : h6 - 4.0),
    gdChannel(m1, m2, h6),
    gdChannel(m1, m2, h6 > 2.0 ? h6 - 2.0 : h6 + 4.0));
}
vec3 gdFilter(vec3 rgb, vec2 uv, float aspect, float gdEv, float gdHard, float gdTurn, float gdShift, float gdHueDeg, float gdSatPct) {
  float a = radians(gdTurn);
  float fh = 1.0 / sqrt(1.0 + aspect * aspect) / (1.0 - (0.5 + gdHard / 100.0 * 0.9 / 2.0)) * 0.5;
  float len = (sin(a) * (2.0 * uv.x - 1.0) - cos(a) * (2.0 * uv.y - 1.0) - 1.0 + gdShift / 100.0 * 2.0) * fh;
  vec3 tint = gdTint(gdHueDeg / 360.0, gdSatPct / 100.0);
  if (gdEv < 0.0) tint = 1.0 - tint;
  float w = smoothstep(0.0, 1.0, 0.5 + len / 1.5);
  vec3 gain = gdEv > 0.0
    ? 1.0 / (tint + (1.0 - tint) * exp2(gdEv * w))
    : tint + (1.0 - tint) * exp2(-gdEv * (1.0 - w));
  if (gdSatPct == 0.0) return rgb * gain;
  const mat3 to2020 = ${glslMat3(REC709_TO_REC2020)};
  const mat3 to709 = ${glslMat3(REC2020_TO_REC709)};
  return to709 * (gain * (to2020 * rgb));
}
`;

export const FILTER_GLSL = `if (on) {
  lin = gdFilter(lin, srcUv, uImageAspect, density, hardness, rotation, offset, hue, saturation);
}`;
