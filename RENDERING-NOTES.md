# Rendering notes

## What the reference project does

The source inspected was [kavan010/Atoms](https://github.com/kavan010/Atoms), specifically [`src/atom_raytracer.cpp`](https://github.com/kavan010/Atoms/blob/main/src/atom_raytracer.cpp) and [`src/atom_realtime.cpp`](https://github.com/kavan010/Atoms/blob/main/src/atom_realtime.cpp).

The raytracer intersects a camera ray with spherical particles, chooses the closest sphere, computes its surface normal, and sends another ray toward a point light to determine shadowing. Surface color is multiplied by diffuse and ambient illumination. Its fire palette maps density from black/purple through red/orange/yellow to white. That combination explains the dimensional beads and bright high-density regions. The inspected implementation does not use emissive global illumination, reflections, path tracing, or bloom.

It runs ray tests in ordinary GLSL 4.30 shaders, with a shader storage buffer of spheres. It does not invoke hardware ray-tracing APIs. Its per-pixel scans through all spheres and shadow candidates would be costly to port directly. The real-time source also constructs sphere meshes; the current fragment shader there outputs density color without using its computed lighting. The exact source revision used in the video is unknown.

No upstream license file was present in the inspected repository. This package uses independently written code and includes inspiration links rather than redistributing that project’s source.

## Browser implementation

The underlying hydrogen wavefunctions are unchanged by the visual style. Radial Laguerre functions and angular spherical harmonics determine density; particles sample that distribution. Complex-state tracers follow the azimuthal probability-current field. Their visualization time is rescaled for visibility, not a laboratory time scale.

Cloud mode integrates the analytic density along viewing rays. The stationary density image is cached when the camera and rendering settings stay fixed, allowing the animated particle layer to update with much less work. Phase color depends on time and requires updates. Phase uses a vibrant cyclic rainbow in the volume, tracers, granular particles, and legend. Hue wraps every full turn, with smooth channel transitions and identical colors at −π and +π. This removes the artificial color seam at the phase boundary. The palette is evaluated directly in the GPU shader without a texture or external dependency. Density retains its blue-to-white map.

Granular particles use sphere impostors: the GPU reconstructs an analytic ray–sphere intersection inside each particle’s projected footprint, shades its normal, and uses depth testing so nearer surfaces hide farther ones. A density-dependent blue palette gives cold dark-blue edges and pale-blue/white high-density regions. These are illustrative probability samples, not literal solid electron balls. Lighting, exposure, and bright centers are visual mappings, not light emitted by a hydrogen eigenstate.

Granular uses matte sphere impostors with local shading and depth testing. The renderer does not trace secondary shadow rays or simulate reflections, multiple light bounces, or global illumination.

Cloud and Granular remember separate requested tracer ceilings. Selecting Real in Cloud starts with zero tracers; selecting Complex starts with 5,000. Users can adjust either afterward. Granular starts with 200,000. Each style retains its cut settings, intensity, flow speed, auto rotation and axes. Basis and Density/Phase are shared across styles. The main explorer defaults to Granular with a wedge; the transition viewer retains Whole for Granular. Granular intensity and flow speed default to 2. Flow speed snaps to ¼×, ½×, 1×, 2× or 4×. Its control is shown only for Complex; flow runs continuously. A background limiter reduces active samples quickly and restores them gradually up to the selected ceiling. Granular targets 30 FPS in both viewers and never changes its raster resolution. Cloud retains adaptive resolution and targets 30 FPS in the main explorer and 60 FPS in the transition viewer. The requested slider setting is never overwritten by the limiter. Idle/hidden scenes do not drive upward adjustments. There is no remote rendering or external compute.

Paused or stationary views reuse the displayed image until an interaction changes it, avoiding repeated GPU draws. A visible playback clock uses real elapsed time, excludes hidden-tab intervals, and does not silently pause because of an operating-system reduced-motion preference.

## Interactive spectrum

The spectrum enumerates every bound-state electric-dipole (E1) channel between principal shells 1 through 6 in the spin-free, fixed-proton model. Its 15 wavelengths span Lyman, Balmer, Paschen, Brackett and Pfund. A shell pair contains `2a − 1` subshell pairs and `3[a² + (a − 1)²]` magnetic channels, where `a` is the lower principal quantum number. The complete catalog has 55 subshell pairs and 465 reversible magnetic-state pairs. Absorption and reverse emission are counted once. A fixed difference in principal quantum number contains several wavelengths; it does not identify one line.

The `transitions.js` data module generates the catalog deterministically. Stable channel IDs identify the two complex magnetic states. A cached array for each shell pair supports inexpensive independent subshell and polarization filters. The absorption convention is `q = m_upper − m_lower`; the atom's magnetic-number change reverses during emission. Real atlas orbitals are alternative basis combinations, not extra independent states to count.

Each channel's coupling strength is the squared spatial dipole matrix element, in Bohr-radius squared. Normalized hydrogen radial functions are integrated with composite Simpson quadrature, doubling the sample count to convergence; the exponential tail is bounded well beyond the relevant radial support. One signed radial overlap is cached for each of the 55 subshell pairs. Exact algebraic spherical-component angular factors supply the magnetic-state dependence, without per-frame integration. Each relative strength is normalized against the strongest channel on the same wavelength across all subshells and all polarizations. Filtering does not renormalize these percentages. These values are not measured line intensities, branching probabilities, or oscillator strengths: population, frequency, field polarization and observation geometry also matter.

The separate cloud view shows an optical-cycle-averaged, resonantly driven two-state population. Its density is `(1 − P)` times the normalized lower-state density plus `P` times the normalized upper-state density, with `P = sin²(π × cycle)`. Both distributions use the same physical coordinate scale and a common exposure after mixing. The display uses the same adjustable slowed cycle for every channel, independent of dipole strength; physical Rabi frequencies would depend on the dipole amplitude and applied field. Its return leg represents stimulated emission under continued driving. This is not a periodic spontaneous-decay model or an electron trajectory.

Complex states with opposite magnetic numbers have the same probability density but opposite circulation. Channels can therefore share cloud shapes while differing in magnetic labels, phase and coupling. The viewer isolates one channel at a time; a real field may simultaneously couple multiple degenerate sublevels. Multilevel dynamics, spin, external fields, decay, broadening, multiphoton processes and forbidden-transition mechanisms are outside this visualization.

The transition viewer defaults to the 2p–3d pair with both magnetic numbers zero, Real, Density, Cloud and Whole with tracers off. It offers the same basis, color, cloud/granular style, intensity, current samples, flow speed, cut rotation/position, camera, axes and tracer ceilings. Scene settings persist when the selected line or magnetic pair changes. The population cycle has a separate clock from flow and phase-color animation.

Real orbitals is a basis-shape preview. Each endpoint is replaced by the corresponding normalized cosine or sine combination of signed magnetic states. The preview changes displayed density and makes its stationary component circulation zero; it does not recalculate the chosen complex channel's polarization or dipole strength. A physical real-basis coupling calculation would transform the complete dipole-amplitude matrix before squaring. The preview is labeled explicitly so these different interpretations remain separate.

The optical-cycle-averaged density has no single wavefunction phase. In Phase mode, the volume blends the two component colors using their local population-weighted densities. Individual endpoint particles carry their own component phase colors. This preserves the cyclic rainbow convention without assigning a fictitious global phase to a mixture or reintroducing interference. Phase colors depend on the chosen component-phase convention and are not an observable interference pattern.

Current samples illustrate population-weighted stationary component circulation. Their signed magnetic numbers set direction; real components and m = 0 do not circulate. They are not paths carrying an electron from one shape to the other. In particular, the weighted stationary currents are divergence-free, while changing the population changes local density by Pdot × (rho_upper − rho_lower). The guide explains that this overlay is not the full transport current of the driven quantum state. Both endpoint distributions remain normalized, so their population mixture integrates to one.

Compact radial-amplitude lookup textures and analytic spherical-harmonic angular factors keep density evaluation local to the GPU. Endpoint samples are prepared when the state pair or basis changes; population changes adjust their contributions without CPU resampling on every frame. Cloud and sphere shading use the mixed density and a common exposure. Sphere impostors give the granular view depth-tested surfaces and local lighting. Only the visible viewer renders; a fully paused view redraws when its controls change. Population cycling, touch rotation and zoom remain available alongside series, subshell and magnetic-channel selection. Model wavelengths are vacuum values calculated from the atlas's fixed-proton energy scale, not measured air wavelengths or fine-structure multiplets. Ultraviolet and infrared lines have explicitly illustrative interface colors.

The mathematics guide derives the energy model, degeneracy, all catalog counts, selection rules, polarization convention, radial/angular matrix elements, relative-strength normalization, coherent population cycle, optical averaging, basis previews, component-phase coloring and the limits of the current overlay. Primary references include [NIST's energy and wavelength relation](https://physics.nist.gov/Pubs/AtSpec/node01.html), [NIST's selection rules and line-strength discussion](https://www.nist.gov/pml/atomic-spectroscopy-compendium-basic-ideas-notation-data-and-formulas/atomic-spectroscopy), [NIST DLMF's angular coupling identities](https://dlmf.nist.gov/34.3#vii), and [MIT's driven two-level treatment](https://ocw.mit.edu/courses/6-728-applied-quantum-and-statistical-physics-fall-2006/16029f7c397abce618505381ec3a82dc_twolevel04.pdf).

## Offline packaging and mathematics

The distributed `index.html` embeds the interface, GPU shaders, mathematics, fonts, and license notices. It runs from a local file on its first use, without fetching resources or relying on a service-worker cache. Its content security policy blocks network connections and external runtime resources. Reference links remain ordinary optional links.

Equations and interface symbols are pre-rendered with KaTeX and retain accessible MathML. Included local fonts make glyph shape and scalable delimiters consistent across supported browsers. The readable TeX sources and bundled optional math compiler are included for offline editing; using the website does not run that compiler or require Node.js. KaTeX code/CSS and font licenses are preserved separately.

## Scope and interpretation

- Hydrogen with a fixed proton, nonrelativistic, without spin or external fields.
- All spatial states for n = 1 through 6; both complex and real bases.
- Complex ±m have the same density and opposite currents. Real stationary states and m = 0 have zero current.
- Cutaways only hide geometry; they do not collapse or renormalize the quantum state.
- Brightness is rescaled for each orbital, with nonlinear exposure and a finite viewing radius. Colors are not an absolute cross-orbital probability scale.
- Sphere sizes are chosen for legibility. They are not the physical radius of an electron.

## Physics validation

All 465 channels were checked against independent enumeration, including selection rules, uniqueness, polarization partitions, symmetry and normalization. Every radial overlap was compared with a 70-digit analytic exponential-polynomial integral; the maximum scaled discrepancy was below `1.9 × 10⁻¹³`. Independently integrated angular factors agreed within `6.2 × 10⁻¹⁶`. The summed `1s → 2p` oscillator-strength benchmark is `0.41619671798`. These numerical checks validate the finite hydrogen model and matrix elements; they do not imply that omitted physical effects are simulated.

No claim is made that the site has been tested on physical Samsung S9 or Pixel 9 devices. Browser layout, interaction and shader checks are separate from the numerical physics validation.

## Granular appearance

Granular mode uses the tracer-count budget and depth buffer, with matte beads. In the transition viewer it renders only the particles, avoiding a second full-volume ray march on every population update. Orbital sampling and current remain the same.

The transition viewer uses the same blue density palette for both components; phase retains its cyclic rainbow. Counts are weighted by their respective populations.

The transition limiter uses a roughly 33.3 ms frame budget in Granular and 16.7 ms in Cloud, with GPU timing when available. Without GPU timers, it probes for extra tracers after sustained frame pacing near the style’s target. Slider values are requested ceilings in both styles, never overwritten by active counts. Hardware, display refresh and volume cost can still prevent reaching the target.


## Pages and navigation

Orbits, Spectra and Math have separate static entrypoints (`orbits.html`, `spectra.html`, `math.html`); `index.html` opens Orbits. Each file embeds its runtime resources. Normal tab navigation updates the URL and switches the active page without discarding viewer settings; direct links, reloads and browser Back/Forward also select the corresponding page. The orbital renderer and atlas thumbnails initialize only when Orbits is first opened, and inactive pages do not run their animations.

Both viewers use square animation surfaces with controls in a right sidebar on wide windows and underneath on narrow windows. Orbits places Flow speed before Look inside; they share a row when the controls container is wide enough. Spectra keeps Real/Complex beside Transition speed. Both viewers expose appearance choices and cutaway selection directly, with tracer/intensity and cut/rotation/axes adjustments in section gears. Spectra places the transition animation and its controls before the wavelength selector and allowed-pair grid. Choosing a pair returns to the animation. The wavelength marker remains mounted during pointer capture and advances one line per equal drag interval, making tightly clustered lines selectable; arrow keys, Home and End also select exact lines. Math presents eleven equation-first topics, with initially closed derivations and worked details. Topic anchors `math.html#math-topic-1` through `math.html#math-topic-11` support links from the viewers.


## Transition particle throughput

The transition Granular path uses a single point vertex per sphere when its projected footprint fits the device point-size limit. The fragment shader still performs the analytic ray–sphere intersection, matte shading and depth write. Close-up views and devices with insufficient point-size support retain the instanced-quad path. This removes repeated per-corner wavefunction evaluations without changing the density distribution.

Granular starts at its own requested tracer ceiling when selected. Its limiter changes only particle count to target 30 FPS; raster resolution remains fixed at its initial device tier. After sustained headroom, it probes upward toward the requested count. Cloud remembers its adaptive raster tier separately. The slider remains the requested maximum, not a guarantee on every device.
