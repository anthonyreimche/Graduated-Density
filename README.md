# Graduated Density for Safelight

A [Safelight](https://github.com/anthonyreimche/SafeLight) extension that ports
[**darktable**](https://www.darktable.org/)'s *graduated density* module: an
optical graduated neutral density filter. It darkens one side of the photo,
fading in across a line, the way a graduated filter in front of the lens holds
back a bright sky. It can be neutral grey or tinted, soft or hard, and you
place it by dragging its line on the photo.

Needs Safelight 3.2.6 or later.

## The controls

- **Enabled**: the filter's switch. Off by default. Moving a slider or picking
  a preset switches it on, as in darktable.
- **Density** (-8 to 8 EV, default 1): how many stops the filter holds back
  at its full strength. Below zero it brightens the other side of the line
  instead.
- **Hardness** (0 % to 100 %, default 0 %): how quickly the filter fades in
  across the line. At 0 % the fade spans the whole frame; at 100 % about a
  tenth of it.
- **Rotation** (-180° to 180°, default 0°): turns the line, clockwise. At 0°
  the filter darkens the top.
- **Offset** (-25 % to 125 %, default 50 %): where the line crosses the frame;
  50 % is through the centre. darktable sets this only by dragging the line.
- **Hue** (0° to 360°) and **Saturation** (0 % to 100 %, default 0 %): the
  filter's tint. At 0 % saturation the filter is neutral grey.
- **Presets**: darktable's own. Neutral grey ND2, ND4 and ND8 (one, two and
  three stops), soft and hard, and orange, yellow, purple, green, red, blue
  and brown tints. A preset leaves the line where it is.
- **Edit Line**: puts the line on the photo. Drag an end of the line to turn
  it about the other end, or drag the line itself to move it. Done or Escape
  takes it off again. Switching the filter on, or moving Rotation or Offset,
  puts it on the photo too.

**In masks:** add Graduated Density to a mask from the Masking panel's Adjust
tab to filter only inside that mask. While a mask's Graduated Density shows,
the line on the photo is that mask's.

## The math

Faithful to `src/iop/graduatednd.c` (params version 1) and `hsl2rgb` from
`src/common/colorspaces.h` at darktable `release-5.6.1`.

- A pixel's **length** is its distance across the line, scaled by the
  hardness and by the frame's diagonal. The density there is
  2^(EV · clip(0.5 + length)): none on the clear side, the full EV on the
  dense side.
- Each channel is divided by `tint + (1 − tint) · density`, where the tint is
  the hue and saturation at half lightness. Neutral grey is 0.5 on every
  channel, so a 1 EV filter divides the dense side by 1.5, as darktable does.
- A negative EV multiplies by the same expression with the tint inverted and
  the ramp reversed.

`test/reference/` holds the oracle. `npm run reference` copies those sections
of darktable's C source into a harness, compiles it with gcc in float (as
darktable runs) and in double, and writes `fixtures.json`. The extension's
model matches the double build to 1e-12 and the float build to 1e-5. That
covers every preset and the corners of each slider, the colour each setting
commits, and the line's ends for 133 rotations and offsets.

### Where it sits

darktable runs the filter on scene-linear values after exposure and before any
tone mapping, where a filter on the lens would act. The photo's stage does the
same: it sits at Safelight's tone anchor, after White Balance and ahead of the
tone block (Basic's exposure and highlight shoulder, Advanced Exposure).
Exposure scales every pixel alike, so the order between the two doesn't
matter.

Masks use a second, scene-linear copy of the filter, which runs after the tone
block. Anchored stages can't be masked.

### How it maps onto Safelight

- **The line's frame:** the filter is placed on the whole photo as decoded
  (upright, before crop and straighten), so a crop doesn't move it off the
  sky. darktable places it on the cropped frame.
- **Tint space:** the tint works in linear Rec.2020, darktable's default
  working space. A neutral filter scales every channel alike, so for it the
  space doesn't matter.
- **Pixel position:** darktable measures a pixel's place at its corner,
  Safelight at its centre, so the line sits half a pixel apart. On a 6000 px
  photo that is 1/12000 of the frame.
- **Matching darktable:** rendered through darktable-cli 5.6.1 and through
  Safelight on a 256 × 192 chart, 13 cases (neutral and tinted presets,
  every slider, both signs) differ by at most 0.043 at a hard 4 EV edge, a
  mean of 0.009 EV or less. All of that is the half pixel: measured at
  darktable's corners, the model matches darktable-cli to 1.7e-5.
- **Cost:** no texture reads, a handful of operations per pixel. While off,
  both stages are dormant and leave every photo exactly as it was.

## Licence and credit

GPL-3.0-or-later. The maths is a port of darktable's graduated density module,
Copyright (C) 2010-2026 darktable developers, GPL-3.0-or-later.

## Development

```
npm run check       # typecheck, build, unit tests
npm run test:gpu    # the stages on the real renderer, in a SafeLight checkout
npm run reference   # rebuild test/reference/fixtures.json (needs gcc)
npm run update-types
```
