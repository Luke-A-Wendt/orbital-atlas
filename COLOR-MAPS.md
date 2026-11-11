# Color maps

The 63 Igor Pro 10 palettes are sampled from WaveMetrics’ published [color table chart](https://www.wavemetrics.com/products/igorpro/creatinggraphs/colortab), [PNG](https://www.wavemetrics.com/sites/default/files/ColorTablesGraph10.png). Each row retains all 409 published RGB samples. These are visual reproductions of the chart, not native Igor 16-bit table exports. Narrow bands are preserved at chart resolution; interpolation between adjacent samples is linear.

The original Atlas Blue is the default granular preset’s colormap. Geo32 remains available. Igor’s Blue is labeled “Blue (Igor Pro)”. Fire, Viridis and Magma remain available. Density, phase, thumbnails, legends and swatches share the same palette data. GPU rendering uses a small shared lookup texture rather than expanding each table into shader branches.

## MATLAB additions

The distinct predefined maps listed in the [MATLAB colormap documentation](https://www.mathworks.com/help/matlab/ref/colormap.html) are included, including Sky, Abyss and Nebula. Cool, Gray and Turbo are consolidated with the visually equivalent CyanMagenta, Grays and Turbo ramps already present; small differences in sampled documentation images are treated as sampling artifacts. These are visual reproductions sampled from MathWorks’ published color strips, not MATLAB numeric table exports. The center row, excluding its two-pixel margin, is resampled to 409 RGB values. Narrow categorical bands are limited by that chart resolution. The distinct darker Copper ramp is labeled Copper (dark). Vendor suffixes are omitted from MATLAB-derived display names. Retired IDs resolve to their retained equivalents. The unheaded menu follows a precomputed nearest-neighbor / 2-opt path through sampled Oklab palette colors, minimizing abrupt changes between adjacent ramps. Blue participates in the same ordering; all IDs remain stable.

Stepped and repeated striped maps are placed together at the bottom of the menu, ordered from broad bands to fine patterns. Approximate band counts determine the ordering, with the existing perceptual order retained for ties. Smooth maps keep their relative order; there are no visible group headings.

The full collection was compared across all sampled RGB positions. Eight visually equivalent 256 variants (Grays, Rainbow, YellowHot, BlueHot, BlueRedGreen, RedWhiteBlue, PlanetEarth and Terrain) are consolidated under their plain names. Distinct coarse/banded variants remain. The 78-entry menu contains no repeated IDs; aliases preserve retired selections.
