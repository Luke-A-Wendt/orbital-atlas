# [Orbital Atlas](https://Luke-A-Wendt.github.io/orbital-atlas/)

An interactive exploration of hydrogen orbitals and spectral transitions. Rotate luminous probability clouds, reveal their interiors, and explore the mathematics behind their shapes and motion.

## Orbital explorer

The full atlas appears directly on the page, with shell and orbital-family filters. Explore all 91 spatial eigenstates through principal quantum number 6, arranged into s, p, d, f, g, and h families. Complex and real orbital views reveal different symmetries, while probability-current tracers show circulation within stationary states.

Cloud and sculpted-particle modes share a blue density palette and a seamless rainbow phase palette. Half, wedge, and slice views expose radial shells and angular nodes. Mouse, touch, and keyboard controls support rotation and zoom, with adaptive rendering quality from Efficient to Ultra.

## Hydrogen spectrum

The spectrum connects 15 spectral lines to 55 allowed orbital pairs and 465 electric-dipole magnetic-state pairs. Select a wavelength directly on the spectrum, filter by the magnitude of the change in magnetic quantum number, and explore every compatible state pair and its relative dipole strength. Each reversible pair appears once. For zero change in magnetic number, sign-reversed pairs share one card labeled by the magnitude of m. A magnetic-sign selector reverses both magnetic numbers and circulation while preserving the table layout. For a magnetic-number change of one, card labels display the actual signed states.

The transition viewer animates population transfer between two states, with independent controls for circulation, appearance, slicing, and playback. Its initial selection is the infrared Pfund-alpha line, comparing 5g and 6f with magnetic quantum number +1 for both states. The selected pair remains fixed until another is chosen.

## Mathematics and physical interpretation

The illustrated mathematics guide covers hydrogen wavefunctions, spherical harmonics, normalization, probability density and current, spectral energies, selection rules, dipole matrix elements, and driven two-state dynamics.

The model uses nonrelativistic hydrogen with a fixed proton and omits spin, external fields, and fine structure. Transition clouds show optical-cycle-averaged density. Component phase colors and circulation tracers are visual aids, not measured electron trajectories or a simulation of spontaneous emission. Real-basis previews retain coupling information for the selected complex states.

## Local computation

The standalone `index.html` bundles the application, mathematics, styles, and fonts. It runs offline from a local file without a previous visit or cached resources. Rendering uses WebGL 2; all computation takes place on the viewing device, with no external compute services or runtime network dependencies.

## Repository structure

| Path | Contents |
| --- | --- |
| `index.html` | Complete standalone website |
| `src/index.template.html` | Editable page layout |
| `src/assets/app.js` | Orbital explorer and atlas controls |
| `src/assets/renderer.js` | Orbital rendering and probability-current animation |
| `src/assets/spectrum.js` | Spectrum selection and transition controls |
| `src/assets/spectrum-renderer.js` | Two-state cloud and particle rendering |
| `src/assets/transitions.js` | Spectral lines, allowed channels, and dipole strengths |
| `src/assets/*.css` | Interface and mathematics styling |
| `src/math-guide.tex.html` | Mathematics guide source |
| `src/math-fragments.tex.json` | Interface mathematics source |
| `src/assets/fonts/` | Bundled mathematical fonts |
| `src/assets/licenses/` | Third-party license notices |
| `scripts/` | Offline build and mathematics typesetting tools |
| `RENDERING-NOTES.md` | Rendering methods and scientific interpretation |

## Credits

Author [Dr. Luke A. Wendt](https://github.com/Luke-A-Wendt)  
Co-author [Astra Ultra](https://openai.com/index/gpt-6-astra/)

Visual inspiration: [kavan010/Atoms](https://github.com/kavan010/Atoms) and [the accompanying video](https://youtu.be/OSAOh4L41Wg). The orbital renderer is independently implemented. Mathematical references are linked throughout the in-app guide.
