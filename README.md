# Orbital Atlas

An interactive, self-contained atlas of the hydrogen atom: explore the shape of a wavefunction, see probability flow, and unfold the mathematics behind it.

**[Orbital Atlas](https://luke-a-wendt.github.io/orbital-atlas/)**

<img width="1608" height="774" alt="image" src="https://github.com/user-attachments/assets/ff367c9a-196d-4311-baa8-4f1ba5879eb5" />
<img width="1609" height="774" alt="image" src="https://github.com/user-attachments/assets/47554eb4-0c20-4cfe-836e-7e5b2c9fcb81" />
<img width="1612" height="774" alt="image" src="https://github.com/user-attachments/assets/a95fc988-c2cd-4420-a9f1-1baad517f35b" />

## Explore the atom

- **91 spatial eigenstates** through principal quantum number 6, grouped into s, p, d, f, g, and h families.
- **Drag, rotate, and zoom** the three-dimensional cloud on a mouse or touch screen.
- **Whole, half, wedge, and slice views** reveal nested radial shells and nodal structure.
- **Density and phase coloring**, complex and real orbital bases, and animated probability-current tracers.
- **Cloud and sculpted-particle rendering** in a charcoal, gray, and blue interface.
- **Adaptive GPU quality** from Efficient through Ultra, with high-quality shaded spheres and automatic adjustment to the device’s performance.
- **Typeset mathematics** with scalable delimiters, radicals, and locally bundled math fonts.

The opening scene is the whole **6f state with m = +1**. The cloud remains stationary while tracers illustrate circulating probability current. These are illustrative samples of a wavefunction, not solid electrons or measured electron trajectories.

## Repository contents

| Path | Contents |
| --- | --- |
| `index.html` | Complete, standalone website; the file GitHub Pages serves |
| `src/index.template.html` | Editable interface template |
| `src/math-guide.tex.html` | Readable TeX source for the mathematics guide |
| `src/math-fragments.tex.json` | Readable TeX source for interface symbols |
| `src/assets/app.js` | Interface state, controls, atlas, and radial plot |
| `src/assets/renderer.js` | Hydrogen wavefunctions, GPU rendering, motion, and quality control |
| `src/assets/style.css` | Responsive dark interface |
| `src/assets/math-guide.html` | Typeset equations and explanations |
| `src/assets/math-typography.css` | Math layout and local font definitions |
| `src/assets/math-fragments.json` | Pre-rendered math symbols used by the interface |
| `src/assets/fonts/` | Bundled mathematical fonts |
| `src/assets/licenses/` | Notices for bundled third-party typography assets |
| `scripts/build-standalone.py` | Reproducible offline builder; uses Python's standard library |
| `scripts/render-math.cjs` | Optional offline math typesetting tool |
| `scripts/vendor/katex.cjs` | Bundled compiler used only when editing the TeX sources |
| `DEPLOYMENT.md` | GitHub Pages, offline use, and source-editing instructions |
| `RENDERING-NOTES.md` | Rendering techniques, adaptive quality, and scientific interpretation |
| `.nojekyll` | Static publishing marker |

## Science and inspiration

The physics model is nonrelativistic hydrogen with a fixed proton, without spin or external fields. The in-app mathematics explains normalized radial functions, spherical harmonics, the Born rule, and probability current, with links to NIST and MIT references.

Visual inspiration comes from [kavan010/Atoms](https://github.com/kavan010/Atoms) and [the accompanying video](https://youtu.be/OSAOh4L41Wg). The orbital renderer is independently implemented; the original C++ source is not redistributed. Bundled typography carries its included license notices.
