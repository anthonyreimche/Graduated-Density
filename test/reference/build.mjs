// Builds test/reference/fixtures.json from darktable's own C code.
//
// Copies sections of src/iop/graduatednd.c and src/common/colorspaces.h
// (release-5.6.1, the darktable installed here) verbatim into
// .build/gnd_core.c, behind a small shim for the darktable headers they lean
// on, compiles harness.c with gcc twice (float as upstream runs, and double),
// runs both over the cases below and writes what they printed. The unit tests
// read the fixtures, so they need neither gcc nor the upstream source.
//
// The shim's distortion calls are the identity and the preview is the image
// itself, so the line maths runs in the image's own normalized coordinates,
// which is where the extension places its line. The upstream files are
// fetched once into .build/ (DARKTABLE_SOURCE points at a darktable checkout
// instead). CC names the compiler (default gcc).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, ".build");
const TAG = "release-5.6.1";
const FILES = ["src/iop/graduatednd.c", "src/common/colorspaces.h"];

mkdirSync(build, { recursive: true });

async function upstream(file) {
  if (process.env.DARKTABLE_SOURCE) return readFileSync(join(process.env.DARKTABLE_SOURCE, file), "utf8");
  const cached = join(build, file.replace(/\//g, "_"));
  if (!existsSync(cached)) {
    const res = await fetch(`https://raw.githubusercontent.com/darktable-org/darktable/${TAG}/${file}`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    writeFileSync(cached, await res.text());
  }
  return readFileSync(cached, "utf8");
}

const [gnd, colorspaces] = (await Promise.all(FILES.map(upstream))).map((s) => s.replace(/\r\n/g, "\n"));

/** The text from the line holding `start` up to (not including) the line holding `end`. */
function section(c, name, start, end) {
  const a = c.indexOf(start);
  if (a < 0) throw new Error(`${name} has no "${start}"`);
  const from = c.lastIndexOf("\n", a) + 1;
  const b = c.indexOf(end, a);
  if (b < 0) throw new Error(`${name} has no "${end}" after "${start}"`);
  return c.slice(from, c.lastIndexOf("\n", b) + 1);
}

const SHIM = `typedef int gboolean;
#define TRUE 1
#define FALSE 0
#define restrict
#define DT_OMP_FOR(...)
#define dt_omploop_sfence()
#define DT_PIXEL_SIMD_CHANNELS 4
#define for_each_channel(_var, ...) for (size_t _var = 0; _var < DT_PIXEL_SIMD_CHANNELS; _var++)
#define for_four_channels(_var, ...) for (size_t _var = 0; _var < 4; _var++)
typedef float dt_aligned_pixel_t[4];
typedef float dt_boundingbox_t[4];
/* src/common/math.h */
#ifdef GND_DOUBLE
#define M_PI_F 3.14159265358979323846
#define M_PI_2f 1.57079632679489661923
#else
#define M_PI_F 3.14159265358979323846f
#define M_PI_2f 1.57079632679489661923f
#endif
#define CLIP(x) (((x) >= 0) ? ((x) <= 1 ? (x) : 1) : 0)
static inline float deg2radf(const float deg) { return deg * M_PI_F / 180.f; }
static inline float rad2degf(const float radians) { return radians / M_PI_F * 180.f; }
static inline float max3f(const float *a) { return fmaxf(fmaxf(a[0], a[1]), a[2]); }
static inline float min3f(const float *a) { return fminf(fminf(a[0], a[1]), a[2]); }
/* the fields of darktable's pipe structs the module reads */
typedef struct dt_iop_roi_t { int x, y, width, height; float scale; } dt_iop_roi_t;
typedef struct dt_dev_pixelpipe_t { int mask_display; } dt_dev_pixelpipe_t;
#define DT_DEV_PIXELPIPE_DISPLAY_MASK 1
typedef struct dt_dev_pixelpipe_iop_t
{
  void *data;
  dt_dev_pixelpipe_t *pipe;
  int colors;
  dt_iop_roi_t buf_in, buf_out;
} dt_dev_pixelpipe_iop_t;
typedef struct dt_develop_t
{
  float preview_width, preview_height;
  dt_dev_pixelpipe_t *preview_pipe;
} dt_develop_t;
typedef struct dt_iop_module_t
{
  dt_develop_t *dev;
  void *params;
  void *gui_data;
  int iop_order;
} dt_iop_module_t;
typedef void dt_iop_params_t;
#define dt_iop_have_required_input_format(...) 1
#define dt_iop_alpha_copy(...)
static inline void copy_pixel_nontemporal(float *const out, const dt_aligned_pixel_t in)
{
  for(int c = 0; c < 4; c++) out[c] = in[c];
}
/* the GUI's view of the image: the image itself, undistorted */
#define DT_DEV_TRANSFORM_DIR_FORW_EXCL 0
static dt_dev_pixelpipe_iop_t *gnd_gui_piece;
static void dt_dev_get_preview_size(const dt_develop_t *dev, float *wd, float *ht)
{
  *wd = dev->preview_width;
  *ht = dev->preview_height;
}
static int dt_dev_distort_backtransform_plus(dt_develop_t *dev, dt_dev_pixelpipe_t *pipe, int order, int dir, float *pts, size_t n)
{
  (void)dev; (void)pipe; (void)order; (void)dir; (void)pts; (void)n;
  return 1;
}
static int dt_dev_distort_transform_plus(dt_develop_t *dev, dt_dev_pixelpipe_t *pipe, int order, int dir, float *pts, size_t n)
{
  (void)dev; (void)pipe; (void)order; (void)dir; (void)pts; (void)n;
  return 1;
}
static dt_dev_pixelpipe_iop_t *dt_dev_distort_get_iop_pipe(dt_develop_t *dev, dt_dev_pixelpipe_t *pipe, dt_iop_module_t *self)
{
  (void)dev; (void)pipe; (void)self;
  return gnd_gui_piece;
}
`;

const copied = [
  "/* src/common/colorspaces.h */",
  section(colorspaces, "colorspaces.h", "// for efficiency, 'hue' must be pre-scaled", "/** trigger updating the display profile"),
  "/* src/iop/graduatednd.c */",
  section(gnd, "graduatednd.c", "typedef struct dt_iop_graduatednd_params_t", "typedef struct dt_iop_graduatednd_global_data_t"),
  section(gnd, "graduatednd.c", "typedef struct dt_iop_graduatednd_data_t", "const char *name()"),
  section(gnd, "graduatednd.c", "static inline float f(const float t", "static inline void _update_saturation_slider_end_color"),
  section(gnd, "graduatednd.c", "static inline float _compute_density", "#ifdef HAVE_OPENCL"),
  section(gnd, "graduatednd.c", "void commit_params(", "void init_pipe("),
].join("\n");

/** The copied code with its float literals' suffix dropped, for the double build. */
const unsuffixed = (src) => src.replace(/(?<![\w.])(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?f\b/g, "$1$2");

writeFileSync(join(build, "gnd_core.c"), `${SHIM}
#ifdef GND_DOUBLE
${unsuffixed(copied)}
#else
${copied}
#endif
`);
writeFileSync(join(build, "harness.c"), readFileSync(join(here, "harness.c"), "utf8"));

const compile = (name, defines) => {
  const exe = join(build, process.platform === "win32" ? `${name}.exe` : name);
  // -ffp-contract=off: no fused multiply-adds, so each operation rounds as written.
  execFileSync(
    process.env.CC ?? "gcc",
    ["-O2", "-ffp-contract=off", "-std=c11", "-Wall", "-Wno-unused-function", ...defines, "-o", exe, join(build, "harness.c"), "-lm"],
    { cwd: build, stdio: "inherit" },
  );
  return exe;
};
const EXES = { float: compile("gnd-harness", []), double: compile("gnd-harness-double", ["-DGND_DOUBLE"]) };

// dt_iop_graduatednd_params_t field order (graduatednd.c L43-51).
const FIELDS = ["density", "hardness", "rotation", "offset", "hue", "saturation"];
const DEFAULTS = { density: 1, hardness: 0, rotation: 0, offset: 50, hue: 0, saturation: 0 };

// darktable's presets (init_presets), then the corners of every slider.
const CASES = [
  ["neutral grey ND2 (soft)", { density: 1 }],
  ["neutral grey ND4 (soft)", { density: 2 }],
  ["neutral grey ND8 (soft)", { density: 3 }],
  ["neutral grey ND2 (hard)", { density: 1, hardness: 75 }],
  ["neutral grey ND4 (hard)", { density: 2, hardness: 75 }],
  ["neutral grey ND8 (hard)", { density: 3, hardness: 75 }],
  ["orange ND2 (soft)", { density: 1, hue: 0.102439, saturation: 0.8 }],
  ["yellow ND2 (soft)", { density: 1, hue: 0.15122, saturation: 0.5 }],
  ["purple ND2 (soft)", { density: 1, hue: 0.82439, saturation: 0.5 }],
  ["green ND2 (soft)", { density: 1, hue: 0.302439, saturation: 0.5 }],
  ["red ND2 (soft)", { density: 1, hue: 0, saturation: 0.5 }],
  ["blue ND2 (soft)", { density: 1, hue: 0.663415, saturation: 0.5 }],
  ["brown ND4 (soft)", { density: 2, hue: 0.082927, saturation: 0.25 }],
  ["density 0", { density: 0 }],
  ["density -1", { density: -1 }],
  ["density -2.5, tinted", { density: -2.5, hue: 0.55, saturation: 0.7 }],
  ["density -8, hard", { density: -8, hardness: 100 }],
  ["density 8, hard", { density: 8, hardness: 100 }],
  ["hardness 50", { density: 1.5, hardness: 50 }],
  ["rotation 30", { density: 1, rotation: 30, hardness: 20 }],
  ["rotation -120, offset 30", { density: 2, rotation: -120, offset: 30 }],
  ["rotation 90", { density: 1, rotation: 90, hardness: 60 }],
  ["rotation 180, offset 70", { density: 1, rotation: 180, offset: 70 }],
  ["offset 0", { density: 1, offset: 0 }],
  ["offset 100", { density: 1, offset: 100 }],
  ["offset -20, rotation 45", { density: 1.2, offset: -20, rotation: 45 }],
  ["offset 125, rotation -45", { density: 1.2, offset: 125, rotation: -45 }],
  ["hue 1, saturation 1", { density: 1, hue: 1, saturation: 1 }],
  ["hue 0.5, saturation 1, hard", { density: 0.7, hue: 0.5, saturation: 1, hardness: 90, rotation: 12 }],
];

// W x H images and the region of each that process() runs on: a whole image
// (with a width that leaves pixels over from the four-wide loop) and a tile
// away from the corner.
const IMAGES = [
  [29, 17, 0, 0, 29, 17],
  [101, 67, 13, 9, 16, 10],
];

const LINE_ROTATIONS = [-180, -135, -90, -60, -45, -30, -10, 0, 0.5, 10, 30, 45, 60, 89.9, 90, 100, 135, 170, 180];
const LINE_OFFSETS = [50, 20, 80, 0, 100, -10, 110];
const LINES = LINE_ROTATIONS.flatMap((r) => LINE_OFFSETS.map((o) => [r, o]));
const PREVIEW = [300, 200];

const GRADS = [
  [0.1, 0.5, 0.9, 0.5],
  [0.9, 0.5, 0.1, 0.5],
  [0.5, 0.1, 0.5, 0.9],
  [0.5, 0.9, 0.5, 0.1],
  [0.2, 0.2, 0.8, 0.7],
  [0.8, 0.7, 0.2, 0.2],
  [0.3, 0.8, 0.7, 0.1],
  [0.7, 0.1, 0.3, 0.8],
  [0.1, 0.3, 0.6, 0.35],
  [0.45, 0.2, 0.5, 0.9],
  [0.55, 0.9, 0.5, 0.2],
  [-0.2, 0.4, 1.3, 0.1],
  [0.4, 0.4, 0.45, 0.42],
  [0.6, 0.25, 0.60005, 0.75],
];

const fmt = (v) => v.toPrecision(17);
const lines = [];
for (const [, over] of CASES) {
  const p = { ...DEFAULTS, ...over };
  lines.push("P " + FIELDS.map((k) => fmt(p[k])).join(" "));
  for (const im of IMAGES) lines.push("I " + im.join(" "));
}
for (const [r, o] of LINES) lines.push(`L ${PREVIEW.join(" ")} ${fmt(r)} ${fmt(o)}`);
for (const g of GRADS) lines.push(`G ${PREVIEW.join(" ")} ${g.map(fmt).join(" ")}`);

function run(exe) {
  const out = execFileSync(exe, { input: lines.join("\n") + "\n", maxBuffer: 1 << 28 }).toString().trim().split(/\r?\n/);
  let k = 0;
  const next = () => JSON.parse(out[k++]);
  const cases = CASES.map(() => ({ data: next(), images: IMAGES.map(next) }));
  const pointsFromGrad = LINES.map(next);
  const gradFromPoints = GRADS.map(next);
  if (k !== out.length) throw new Error(`${exe} printed ${out.length} lines, read ${k}`);
  return { cases, pointsFromGrad, gradFromPoints };
}

const asFloat = run(EXES.float);
const asDouble = run(EXES.double);

writeFileSync(
  join(here, "fixtures.json"),
  JSON.stringify({
    upstream: `darktable ${TAG} src/iop/graduatednd.c, src/common/colorspaces.h`,
    defaults: DEFAULTS,
    images: IMAGES,
    preview: PREVIEW,
    cases: CASES.map(([name, over], i) => ({
      name,
      params: { ...DEFAULTS, ...over },
      float: asFloat.cases[i],
      double: asDouble.cases[i],
    })),
    lines: LINES.map(([rotation, offset], i) => ({
      rotation,
      offset,
      float: asFloat.pointsFromGrad[i],
      double: asDouble.pointsFromGrad[i],
    })),
    grads: GRADS.map((points, i) => ({ points, float: asFloat.gradFromPoints[i], double: asDouble.gradFromPoints[i] })),
  }),
);
console.log(
  `fixtures.json: ${CASES.length} params x ${IMAGES.length} images, ${LINES.length} lines, ${GRADS.length} grads, float and double builds`,
);
