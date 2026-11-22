/*
    Reference harness for Graduated Density. build.mjs compiles it with
    sections of darktable's src/iop/graduatednd.c and src/common/colorspaces.h
    copied verbatim (gnd_core.c), so the expected values come from upstream's
    own code, compiled as C.

    It is built twice: as upstream runs, in floats, and with GND_DOUBLE, where
    every float of the copied code is a double, its float literals lose their
    suffix and its libm calls are the double ones. The float build gives
    darktable's own numbers; the double build shows the transcription is exact
    where float rounding is all that tells two answers apart.

    This file is part of the Graduated Density extension for Safelight.
    Copyright (C) 2010-2026 darktable developers. GPL-3.0-or-later.

    Commands on stdin, one per line:
      P <density> <hardness> <rotation> <offset> <hue> <saturation>
                                      set darktable's params, run commit_params
                                      and print its data
      I <W> <H> <x> <y> <w> <h>       run process() on the w x h region at (x, y)
                                      of a W x H image (scale 1) and print the
                                      output; input channel c of the region's
                                      pixel k is 0.1 + 0.08 * ((7k + 3c) % 11)
      L <W> <H> <rotation> <offset>   _set_points_from_grad on a W x H preview:
                                      [ok, xa, ya, xb, yb]
      G <W> <H> <xa> <ya> <xb> <yb>   _set_grad_from_points: [ok, rotation, offset]
*/

#include <float.h>
#include <math.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef GND_DOUBLE
#define float double
#define powf pow
#define exp2f exp2
#define fmaxf fmax
#define fminf fmin
#define fabsf fabs
#define sqrtf sqrt
#define hypotf hypot
#define cosf cos
#define sinf sin
#define OUT "%.17g"
#else
#define OUT "%.9g"
#endif

#include "gnd_core.c"

static dt_dev_pixelpipe_t pipe;
static dt_iop_graduatednd_data_t data;
static dt_dev_pixelpipe_iop_t piece;
static dt_develop_t dev;
static dt_iop_graduatednd_params_t params;
static dt_iop_module_t module;

static int ok = 1;

static double read_number(void)
{
  double v = 0.0;
  if(scanf("%lf", &v) != 1) ok = 0;
  return v;
}

static int read_int(void)
{
  int v = 0;
  if(scanf("%d", &v) != 1) ok = 0;
  return v;
}

static void preview(int w, int h)
{
  dev.preview_width = (float)w;
  dev.preview_height = (float)h;
  piece.buf_out.width = w;
  piece.buf_out.height = h;
}

int main(void)
{
  piece.data = &data;
  piece.pipe = &pipe;
  piece.colors = 4;
  gnd_gui_piece = &piece;
  module.dev = &dev;
  module.params = &params;
  char cmd[4];
  while(ok && scanf("%3s", cmd) == 1)
  {
    if(cmd[0] == 'P')
    {
      params.density = (float)read_number();
      params.hardness = (float)read_number();
      params.rotation = (float)read_number();
      params.offset = (float)read_number();
      params.hue = (float)read_number();
      params.saturation = (float)read_number();
      commit_params(&module, (dt_iop_params_t *)&params, &pipe, &piece);
      printf("{\"density\":" OUT ",\"hardness\":" OUT ",\"rotation\":" OUT ",\"offset\":" OUT, (double)data.density,
             (double)data.hardness, (double)data.rotation, (double)data.offset);
      printf(",\"color\":[" OUT "," OUT "," OUT "],\"color1\":[" OUT "," OUT "," OUT "]}\n", (double)data.color[0],
             (double)data.color[1], (double)data.color[2], (double)data.color1[0], (double)data.color1[1],
             (double)data.color1[2]);
    }
    else if(cmd[0] == 'I')
    {
      const int W = read_int(), H = read_int(), x0 = read_int(), y0 = read_int(), w = read_int(), h = read_int();
      if(!ok) break;
      piece.buf_in.width = W;
      piece.buf_in.height = H;
      const dt_iop_roi_t roi = { x0, y0, w, h, 1.0f };
      float *in = calloc((size_t)4 * w * h, sizeof(float));
      float *out = calloc((size_t)4 * w * h, sizeof(float));
      for(int k = 0; k < w * h; k++)
        for(int c = 0; c < 4; c++) in[4 * k + c] = (float)(0.1 + 0.08 * ((7 * k + 3 * c) % 11));
      process(&module, &piece, in, out, &roi, &roi);
      printf("[");
      for(int k = 0; k < w * h; k++)
        for(int c = 0; c < 3; c++) printf("%s" OUT, k || c ? "," : "", (double)out[4 * k + c]);
      printf("]\n");
      free(in);
      free(out);
    }
    else if(cmd[0] == 'L')
    {
      const int W = read_int(), H = read_int();
      const float rotation = (float)read_number(), offset = (float)read_number();
      if(!ok) break;
      preview(W, H);
      float xa = 0, ya = 0, xb = 0, yb = 0;
      const int r = _set_points_from_grad(&module, &xa, &ya, &xb, &yb, rotation, offset);
      printf("[%d," OUT "," OUT "," OUT "," OUT "]\n", r, (double)xa, (double)ya, (double)xb, (double)yb);
    }
    else if(cmd[0] == 'G')
    {
      const int W = read_int(), H = read_int();
      const float xa = (float)read_number(), ya = (float)read_number();
      const float xb = (float)read_number(), yb = (float)read_number();
      if(!ok) break;
      preview(W, H);
      float rotation = 0, offset = 0;
      const int r = _set_grad_from_points(&module, xa, ya, xb, yb, &rotation, &offset);
      printf("[%d," OUT "," OUT "]\n", r, (double)rotation, (double)offset);
    }
    else
    {
      fprintf(stderr, "unknown command %s\n", cmd);
      return 1;
    }
    fflush(stdout);
  }
  return 0;
}
