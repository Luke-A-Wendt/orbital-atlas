/** Spin-free, fixed-proton hydrogen E1 channels through n = 6.
 * A channel is one reversible pair of complex |n,l,m> states. q = m_upper -
 * m_lower is the absorption convention. Strength is a squared spatial dipole
 * matrix element in a0^2, not a measured or population-weighted line intensity.
 */
export const TRANSITION_MAX_N = 6;
export const TRANSITION_RY_EV = 13.605693;
export const TRANSITION_HC_EV_NM = 1239.841984332;
export const TRANSITION_SERIES = Object.freeze(['', 'Lyman', 'Balmer', 'Paschen', 'Brackett', 'Pfund']);
export const TRANSITION_SUBSHELLS = Object.freeze(['s', 'p', 'd', 'f', 'g', 'h']);

const transitionLineNames = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
const transitionRadialCache = new Map();
const transitionMaximumCache = new Map();
const transitionChannelCache = new Map();
const transitionFactorials = [1];
for (let transitionI = 1; transitionI <= 12; transitionI++) {
  transitionFactorials[transitionI] = transitionFactorials[transitionI - 1] * transitionI;
}

function transitionValidShells(a, b) {
  return Number.isInteger(a) && Number.isInteger(b) && a >= 1 && a < b && b <= TRANSITION_MAX_N;
}

/** Model vacuum wavelengths, grouped by series then upper shell. */
export function getSpectralLines() {
  const lines = [];
  for (let a = 1; a < TRANSITION_MAX_N; a++) {
    for (let b = a + 1; b <= TRANSITION_MAX_N; b++) {
      const gap = TRANSITION_RY_EV * (1 / (a * a) - 1 / (b * b));
      lines.push({
        lowerN: a, upperN: b, series: TRANSITION_SERIES[a],
        name: `${TRANSITION_SERIES[a]} ${transitionLineNames[b - a - 1]}`,
        gap, wavelength: TRANSITION_HC_EV_NM / gap
      });
    }
  }
  return lines;
}

/** Every E1-allowed subshell pair for a < b. count includes all three q. */
export function getSubshellPairs(a, b) {
  if (!transitionValidShells(a, b)) return [];
  const pairs = [];
  for (let lowerL = 0; lowerL < a; lowerL++) {
    for (const upperL of [lowerL - 1, lowerL + 1]) {
      if (upperL < 0 || upperL >= b) continue;
      pairs.push({
        lowerL, upperL, key: `${lowerL}-${upperL}`,
        label: `${a}${TRANSITION_SUBSHELLS[lowerL]} ↔ ${b}${TRANSITION_SUBSHELLS[upperL]}`,
        count: 3 * (2 * Math.min(lowerL, upperL) + 1)
      });
    }
  }
  return pairs;
}

/** Optional l filters apply independently; undefined means all values. */
export function getChannels(a, b, lowerL, upperL) {
  if (!transitionValidShells(a, b)) return [];
  const key = `${a}-${b}`;
  if (!transitionChannelCache.has(key)) {
    const channels = [];
    for (const pair of getSubshellPairs(a, b)) {
      for (let m = -pair.lowerL; m <= pair.lowerL; m++) {
        for (let q = -1; q <= 1; q++) {
          const M = m + q;
          if (Math.abs(M) > pair.upperL) continue;
          channels.push(Object.freeze({
            id: `${key}:${pair.key}:${m}-${M}`,
            lower: Object.freeze({ n: a, l: pair.lowerL, m }),
            upper: Object.freeze({ n: b, l: pair.upperL, m: M }),
            q, subshellKey: pair.key
          }));
        }
      }
    }
    transitionChannelCache.set(key, Object.freeze(channels));
  }
  return transitionChannelCache.get(key).filter(channel =>
    (lowerL === undefined || channel.lower.l === lowerL) &&
    (upperL === undefined || channel.upper.l === upperL));
}

function transitionLaguerre(k, alpha, x) {
  if (k === 0) return 1;
  let previous = 1, current = 1 + alpha - x;
  for (let j = 2; j <= k; j++) {
    const next = ((2 * j - 1 + alpha - x) * current - (j - 1 + alpha) * previous) / j;
    previous = current;
    current = next;
  }
  return current;
}

function transitionRadialEvaluator(n, l) {
  const normalization = Math.sqrt((2 / n) ** 3 * transitionFactorials[n - l - 1] /
    (2 * n * transitionFactorials[n + l]));
  return r => {
    const x = 2 * r / n;
    return normalization * Math.exp(-x / 2) * x ** l * transitionLaguerre(n - l - 1, 2 * l + 1, x);
  };
}

/** Integral R_upper R_lower r^3 dr, with r in Bohr radii.
 * Composite Simpson integration doubles until converged. The exponential
 * product has fallen by exp(-80) at the upper bound; n<=6 leaves negligible
 * omitted tails. Values are cached once for each of the 55 subshell pairs.
 */
function transitionRadial(a, l, b, L) {
  const key = `${a}-${l}:${b}-${L}`;
  if (transitionRadialCache.has(key)) return transitionRadialCache.get(key);
  const lower = transitionRadialEvaluator(a, l), upper = transitionRadialEvaluator(b, L);
  const limit = 80 / (1 / a + 1 / b);
  const integrate = steps => {
    const h = limit / steps;
    let sum = lower(limit) * upper(limit) * limit ** 3;
    // r=0 contributes zero for every dipole pair, so its endpoint is omitted.
    for (let i = 1; i < steps; i++) {
      const r = i * h;
      sum += (i % 2 ? 4 : 2) * lower(r) * upper(r) * r ** 3;
    }
    return sum * h / 3;
  };
  let previous = integrate(1024), value = previous;
  for (let steps = 2048; steps <= 16384; steps *= 2) {
    value = integrate(steps);
    if (Math.abs(value - previous) <= 2e-11 * Math.abs(value) + 1e-12) break;
    previous = value;
  }
  transitionRadialCache.set(key, value);
  return value;
}

/** |<L,M|sqrt(4pi/3) Y_1^q|l,m>|^2, including the spherical normalization. */
function transitionAngular(l, m, L, M) {
  // Hermitian conjugation reverses q; the squared matrix element is unchanged.
  if (L === l - 1) return transitionAngular(L, M, l, m);
  if (L !== l + 1 || Math.abs(m) > l || Math.abs(M) > L) return 0;
  const q = M - m, denominator = (2 * l + 1) * (2 * l + 3);
  if (q === 0) return ((l + 1) ** 2 - m * m) / denominator;
  if (q === 1) return (l + m + 1) * (l + m + 2) / (2 * denominator);
  if (q === -1) return (l - m + 1) * (l - m + 2) / (2 * denominator);
  return 0;
}

function transitionRawStrength(channel) {
  const { lower, upper } = channel;
  const radial = transitionRadial(lower.n, lower.l, upper.n, upper.l);
  const angular = transitionAngular(lower.l, lower.m, upper.l, upper.m);
  return { radial, angular, strength: radial * radial * angular };
}

/** radial: value in a0; angular: squared angular factor; strength: value in a0².
 * relative spans 0..1 against the strongest magnetic channel on this same line,
 * across every allowed subshell pair and q, regardless of active UI filters.
 */
export function transitionStrength(channel) {
  if (!channel || !channel.lower || !channel.upper) throw new TypeError('A transition channel is required.');
  const { lower, upper } = channel;
  if (!transitionValidShells(lower.n, upper.n) ||
      ![lower.l, lower.m, upper.l, upper.m].every(Number.isInteger) ||
      lower.l < 0 || lower.l >= lower.n || upper.l < 0 || upper.l >= upper.n ||
      Math.abs(lower.m) > lower.l || Math.abs(upper.m) > upper.l ||
      Math.abs(upper.l - lower.l) !== 1 || Math.abs(upper.m - lower.m) > 1) {
    throw new RangeError('The channel must be an allowed E1 pair within n = 1…6.');
  }
  const key = `${lower.n}-${upper.n}`;
  if (!transitionMaximumCache.has(key)) {
    let maximum = 0;
    for (const candidate of getChannels(lower.n, upper.n)) {
      maximum = Math.max(maximum, transitionRawStrength(candidate).strength);
    }
    transitionMaximumCache.set(key, maximum);
  }
  const result = transitionRawStrength(channel);
  return { ...result, relative: result.strength / transitionMaximumCache.get(key) };
}
