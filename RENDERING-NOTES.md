# Rendering notes

## What the reference project does

The source inspected was [kavan010/Atoms](https://github.com/kavan010/Atoms), specifically [`src/atom_raytracer.cpp`](https://github.com/kavan010/Atoms/blob/main/src/atom_raytracer.cpp) and [`src/atom_realtime.cpp`](https://github.com/kavan010/Atoms/blob/main/src/atom_realtime.cpp).

The raytracer intersects a camera ray with spherical particles, chooses the closest sphere, computes its surface normal, and sends another ray toward a point light to determine shadowing. Surface color is multiplied by diffuse and ambient illumination. Its fire palette maps density from black/purple through red/orange/yellow to white. That combination explains the dimensional beads and bright high-density regions. The inspected implementation does not use emissive global illumination, reflections, path tracing, or bloom.

It runs ray tests in ordinary GLSL 4.30 shaders, with a shader storage buffer of spheres. It does not invoke hardware ray-tracing APIs. Its per-pixel scans through all spheres and shadow candidates would be costly to port directly. The real-time source also constructs sphere meshes; the current fragment shader there outputs density color without using its computed lighting. The exact source revision used in the video is unknown.

No upstream license file was present in the inspected repository. This package uses independently written code and includes inspiration links rather than redistributing that project’s source.

## Browser implementation

The underlying hydrogen wavefunctions are unchanged by the visual style. Radial Laguerre functions and angular spherical harmonics determine density; particles sample that distribution. Complex-state tracers follow the azimuthal probability-current field. Their visualization time is rescaled for visibility, not a laboratory time scale.

Cloud mode integrates the analytic density along viewing rays. The stationary density image is cached when the camera and rendering settings stay fixed, allowing the animated particle layer to update with much less work. Phase color depends on time and requires updates.

Sculpted particles use sphere impostors: the GPU reconstructs an analytic ray–sphere intersection inside each particle’s projected footprint, shades its normal, and uses depth testing so nearer surfaces hide farther ones. A density-dependent blue palette gives cold dark-blue edges and pale-blue/white high-density regions. These are illustrative probability samples, not literal solid electron balls. Lighting, exposure, and bright centers are visual mappings, not light emitted by a hydrogen eigenstate.

Ultra is the highest visual-quality preset in the ordinary WebGL 2 pipeline. It uses the same analytic sphere surfaces, local shading, and blue density palette as the other sculpted-particle presets, with a larger rendering budget. It does not require a particular GPU brand. The current renderer does not trace secondary shadow rays or simulate reflections, multiple light bounces, or global illumination. The lighting is an artistic aid to reading the shape and density.

Adaptive quality can use all four presets, including Ultra, on mobile or desktop. It responds to measured frame performance, reduces work when the device slows down, and raises detail more cautiously when there is sustained headroom. Cooldown intervals avoid rapid switching. A manual preset remains available for a fixed preference. There is no remote renderer, compute server, or external service.

Paused or stationary views reuse the displayed image until an interaction changes it, avoiding repeated GPU draws. A visible playback clock uses real elapsed time, excludes hidden-tab intervals, and does not silently pause because of an operating-system reduced-motion preference.

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

## Validation limits

The update is checked with JavaScript syntax and structural checks, analytic wavefunction checks, animation-clock regression tests, and native OpenGL ES shader compilation/rendering. Native shader checks verify the graphics code separately from browser integration. No claim is made that this update has been tested on physical Samsung S9 or Pixel 9 devices. The managed browser preview service was unavailable during this build.
