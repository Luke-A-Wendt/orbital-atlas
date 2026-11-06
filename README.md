# [Orbital Atlas](https://luke-a-wendt.github.io/orbital-atlas/)

An interactive atlas of the hydrogen atom. Explore orbital shapes, watch transitions between energy states, and follow the mathematics behind the visualizations.

## Orbits

Explore hydrogen's **91 spatial eigenstates through principal quantum number 6**, across the s, p, d, f, g and h families. Choose the quantum numbers directly or select a shape from the orbital atlas.

- Rotate and zoom the three-dimensional view with a mouse or touch screen.
- Reveal shells and nodes with **Whole, Half, Wedge and Slice** views.
- Switch between **Real** orbital shapes and **Complex** eigenstates.
- View a luminous **Cloud** or individually shaded **Granular** probability samples.
- Use blue-to-white **Density** shading or cyclic-rainbow **Phase** coloring.
- Inspect bound-state energy, radial nodes and the radial probability distribution.

Complex states can show circulating probability-current tracers. Flow speed is adjustable from ¼× to 4×. Real starts in Cloud; Complex starts in Granular with a wedge cut. Each basis remembers its own Cloud/Granular choice during the session, while each rendering style retains its scene settings.

## Spectra

Explore **15 spectral lines, 55 orbital pairs and 465 magnetic-state transition channels** between shells 1 through 6. The catalog covers the Lyman, Balmer, Paschen, Brackett and Pfund series.

Select a wavelength by clicking a spectral line or dragging the snapping marker. Closely spaced lines remain individually selectable in the combined spectrum. Filter the available transitions, compare their dipole strengths, and choose a pair to bring its animation into view.

The transition viewer shows population transfer between two orbital distributions on the same spatial scale. The state-card borders brighten with their respective populations, and the display alternates between absorption and stimulated emission. Transition speed is separate from tracer flow speed. The initial pair is **2p ↔ 3d, with m = 0 for both states**.

Dipole strength is reported in squared Bohr radii, with a percentage relative to the strongest channel at that wavelength. Filtering does not change that reference. The viewer shares the orbital explorer's Cloud/Granular rendering, cutaways and appearance controls.

## Math

An equation-first guide connects the pictures to their underlying model. Eleven topics cover hydrogen wavefunctions, quantum numbers, energy levels, radial and angular structure, probability density and current, spectral lines, selection rules, dipole coupling and driven transitions.

Each topic presents its main equations followed by an expandable deep dive with concise derivations, worked details and interpretation. Links from the visualizations lead to the relevant explanations.

## Implementation

- **Local GPU rendering.** JavaScript and WebGL 2 evaluate and display the orbital distributions on the viewer's device. Cloud rendering integrates density along viewing rays; Granular rendering uses shaded sphere impostors with depth testing.
- **Efficient transition rendering.** Cached radial lookup data and precomputed endpoint samples avoid resampling both orbitals on every animation frame. The Granular transition path skips the volume pass and uses one point vertex per sphere when the device supports its projected size, with a quad fallback for larger footprints.
- **Adaptive tracer counts.** The tracer slider sets a desired maximum: up to 10,000 in Cloud and 200,000 in Granular. Active counts decrease under load and recover when performance allows. Granular targets 30 FPS without reducing resolution; Cloud targets 30 FPS in Orbits and 60 FPS in Spectra. Actual performance depends on the device.
- **Calculated transition strengths.** Converged numerical radial integrals combine with algebraic angular factors to compute dipole matrix elements. Results are cached rather than integrated during animation.
- **Responsive, self-contained pages.** Square viewers place controls alongside the animation on wider screens and underneath on smaller screens. The generated HTML pages embed their runtime resources, including shaders, styles, equations and fonts. They also work locally without a server or runtime CDN dependencies. Equations are pre-rendered with KaTeX and retain MathML.

## Scientific scope

The model uses nonrelativistic hydrogen with a fixed proton and no electron spin. The spectral catalog describes electric-dipole transitions; it does not include fine structure, external-field splitting, decay or line broadening.

Particles are probability samples, not solid electrons or measured trajectories. Brightness and particle size are visual mappings. Cutaways reveal existing structure without changing the quantum state.

The transition animation shows an optical-cycle-averaged, driven two-state population cycle at an adjustable illustrative speed. It is not a spontaneous-decay simulation. Its tracers show component circulation rather than the complete transport current of the driven state. Real-basis previews change the displayed shapes; reported coupling strengths remain those of the selected complex-state channel. Relative dipole strength is not a measured spectral intensity or an oscillator strength.

## Science references and visual inspiration

- [NIST DLMF — Spherical harmonics](https://dlmf.nist.gov/14.30)
- [NIST DLMF — Quantum mechanics and orthogonal polynomials](https://dlmf.nist.gov/18.39#ii)
- [MIT OpenCourseWare — Hydrogen atom wavefunctions and orbitals](https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/pages/unit-i-the-atom/lecture-6-hydrogen-atom-wavefunctions-orbitals/)
- [MIT OpenCourseWare — Probability current and conservation](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/d87c768c4e1181fde8d4366112169719_MIT8_04S16_LecNotes6.pdf)
- [NIST — Atomic energies and wavelengths](https://physics.nist.gov/Pubs/AtSpec/node01.html)
- [NIST — Atomic spectroscopy, selection rules and line strengths](https://www.nist.gov/pml/atomic-spectroscopy-compendium-basic-ideas-notation-data-and-formulas/atomic-spectroscopy)
- [NIST DLMF — Angular coupling identities](https://dlmf.nist.gov/34.3#vii)
- [MIT OpenCourseWare — Driven two-level systems](https://ocw.mit.edu/courses/6-728-applied-quantum-and-statistical-physics-fall-2006/16029f7c397abce618505381ec3a82dc_twolevel04.pdf)

Visual inspiration: [kavan010/Atoms](https://github.com/kavan010/Atoms) and [the accompanying video](https://youtu.be/OSAOh4L41Wg). The browser renderer is independently implemented; the original C++ source is not redistributed. Bundled KaTeX assets and fonts retain their included license notices.
