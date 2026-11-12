import { T, mat, add, rod, box, cyl, sph, tor, lathe, extrude } from './lib.mjs';

const PI = Math.PI;

function spaceProbe() {
  const g = new T.Group();
  const white = mat(0xeceae4, 0.2, 0.5), gold = mat(0xc9a03f, 0.8, 0.35), dark = mat(0x2b2d31, 0.5, 0.5), alu = mat(0xa9adb3, 0.85, 0.35);
  add(g, lathe(Array.from({ length: 13 }, (_, i) => [i / 12, 0.26 * (i / 12) ** 2]), 64), white);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + 0.4; rod(g, [0.95 * Math.cos(a), 0.24, 0.95 * Math.sin(a)], [0, 0.62, 0], 0.012, alu); }
  add(g, cyl(0.1, 0.13, 0.06, 24), white, [0, 0.62, 0]);
  add(g, cyl(0.44, 0.44, 0.24, 10), gold, [0, -0.14, 0]);
  rod(g, [0.3, -0.2, 0], [2.5, -0.55, 0.35], 0.014, alu); rod(g, [0.3, -0.28, 0.06], [2.5, -0.55, 0.35], 0.01, alu);
  rod(g, [-0.3, -0.2, 0], [-1.0, -0.4, -0.1], 0.02, alu);
  rod(g, [-1.0, -0.4, -0.1], [-1.75, -0.6, -0.2], 0.1, dark, 16);
  for (const t of [0.15, 0.5, 0.85]) add(g, cyl(0.14, 0.14, 0.015, 16), dark, [-1.0 - 0.75 * t, -0.4 - 0.2 * t, -0.1 - 0.1 * t], [0, 0, PI / 2 - 0.26]);
  rod(g, [0, -0.2, 0.3], [0.25, -0.35, 1.35], 0.018, alu);
  add(g, box(0.26, 0.32, 0.22), dark, [0.27, -0.38, 1.42]);
  add(g, cyl(0.07, 0.07, 0.2, 16), white, [0.27, -0.2, 1.52], [PI / 2, 0, 0]);
  rod(g, [0.1, -0.26, -0.3], [1.0, -1.0, -1.5], 0.008, gold, 6); rod(g, [-0.1, -0.26, -0.3], [-1.0, -1.0, -1.5], 0.008, gold, 6);
  return g;
}

function caliper() {
  const g = new T.Group();
  const steel = mat(0xc4c8cc, 0.9, 0.25), brushed = mat(0x9da2a8, 0.85, 0.4), dark = mat(0x33363b, 0.6, 0.5);
  add(g, box(3.2, 0.26, 0.04), steel, [0.6, 0, 0]);
  add(g, extrude([[-1, -1], [-0.95, -1], [-0.72, -0.25], [-0.72, 0.3], [-0.76, 0.56], [-0.8, 0.56], [-0.9, 0.13], [-1, 0.13]], 0.04), steel);
  const x = -0.1;
  add(g, extrude([[x, -0.25], [x + 0.23, -1], [x + 0.28, -1], [x + 0.28, 0.13], [x + 0.18, 0.13], [x + 0.08, 0.56], [x + 0.04, 0.56], [x, 0.3]], 0.05), brushed);
  add(g, box(0.85, 0.46, 0.075), brushed, [x + 0.425, 0, 0]);
  add(g, cyl(0.09, 0.09, 0.05, 24), dark, [x + 0.72, -0.28, 0], [PI / 2, 0, 0]);
  add(g, cyl(0.05, 0.05, 0.14, 16), dark, [x + 0.4, 0.29, 0]);
  add(g, box(0.75, 0.05, 0.015), steel, [2.55, 0, 0]);
  return g;
}

function gyroscope() {
  const g = new T.Group();
  const brass = mat(0xc9a14a, 0.9, 0.3), steel = mat(0xb7bbc0, 0.9, 0.25), dark = mat(0x2a2420, 0.4, 0.6);
  add(g, tor(1, 0.04), brass);
  add(g, tor(1, 0.04), brass, [0, 0, 0], [0, PI / 2, 0]);
  add(g, tor(1, 0.04), brass, [0, 0, 0], [PI / 2, 0, 0]);
  add(g, lathe([[0, 0.05], [0.45, 0.05], [0.5, 0.11], [0.7, 0.11], [0.7, -0.11], [0.5, -0.11], [0.45, -0.05], [0, -0.05]], 64), steel);
  add(g, cyl(0.03, 0.03, 2.3, 16), steel);
  for (const y of [-1.15, 1.15]) add(g, sph(0.075, 16), brass, [0, y, 0]);
  add(g, cyl(0.05, 0.3, 0.5, 24), dark, [0, -1.45, 0]);
  add(g, cyl(0.5, 0.56, 0.08, 40), dark, [0, -1.73, 0]);
  return g;
}

function iris() {
  const g = new T.Group();
  const black = mat(0x17181b, 0.6, 0.35), blade = mat(0x3a3d44, 0.8, 0.3), brass = mat(0xb8924a, 0.9, 0.3);
  add(g, lathe([[0.92, -0.09], [1.12, -0.09], [1.12, 0.09], [0.92, 0.09], [0.92, -0.09]], 72), black);
  add(g, box(0.3, 0.05, 0.1), brass, [1.24, 0, 0]);
  add(g, cyl(0.05, 0.05, 0.16, 16), brass, [1.36, 0.06, 0]);
  // Each blade is a crescent: the ring disc minus an offset circle. Together
  // the offset circles leave a rounded nine-sided opening in the middle.
  const A = 0.95, B = 0.9, c = 0.5, alpha = Math.atan2(0.886, 0.3425), beta = Math.atan2(0.886, -0.1575);
  const pts = [];
  for (let i = 0; i <= 28; i++) { const a = alpha + (i / 28) * (2 * PI - 2 * alpha); pts.push([A * Math.cos(a), A * Math.sin(a)]); }
  for (let i = 1; i < 28; i++) { const a = 2 * PI - beta - (i / 28) * (2 * PI - 2 * beta); pts.push([c + B * Math.cos(a), B * Math.sin(a)]); }
  for (let i = 0; i < 9; i++) {
    const b = extrude(pts, 0.012); b.rotateX(PI / 2); b.rotateY((i / 9) * PI * 2);
    add(g, b, blade, [0, -0.03 + i * 0.007, 0], [0.02, 0, 0]);
  }
  return g;
}

function vacuumTube() {
  const g = new T.Group();
  const glass = mat(0xcfe3ea, 0.0, 0.05, 0.3), bakelite = mat(0x3a2418, 0.1, 0.5), nickel = mat(0xb5b8bc, 0.9, 0.3), plate = mat(0x55585e, 0.7, 0.5), mica = mat(0xd8cfb8, 0.1, 0.6);
  add(g, lathe([[0, 2.12], [0.05, 2.1], [0.08, 2.0], [0.28, 1.93], [0.42, 1.7], [0.45, 1.3], [0.45, 0.35], [0.4, 0.25]]), glass);
  add(g, cyl(0.42, 0.42, 0.35), bakelite, [0, 0.1, 0]);
  add(g, cyl(0.1, 0.1, 0.32, 20), bakelite, [0, -0.2, 0]);
  add(g, box(0.05, 0.3, 0.14), bakelite, [0.1, -0.2, 0]);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; add(g, cyl(0.035, 0.035, 0.3, 12), nickel, [0.28 * Math.cos(a), -0.2, 0.28 * Math.sin(a)]); }
  add(g, box(0.34, 0.82, 0.2), plate, [0, 1.1, 0]);
  for (const y of [0.64, 1.56]) add(g, cyl(0.41, 0.41, 0.02), mica, [0, y, 0]);
  for (const x of [-0.25, 0.25]) add(g, cyl(0.012, 0.012, 1.3, 8), nickel, [x, 0.95, 0]);
  add(g, tor(0.12, 0.014, 32, 8), nickel, [0, 1.75, 0], [PI / 2, 0, 0]);
  return g;
}

export default [
  {
    file: 'aerospace/deep-space-probe', build: spaceProbe,
    meta: {
      displayName: 'Deep-Space Probe', answer: 'Space probe',
      accepted: ['Deep space probe', 'Voyager', 'Voyager probe', 'Voyager 1', 'Voyager 2', 'Voyager spacecraft', 'Spacecraft', 'Probe', 'Satellite', 'Space satellite', 'Interplanetary probe', 'Pioneer probe', 'Space craft', 'Unmanned spacecraft', 'NASA probe', 'Robotic spacecraft'],
      category: 'Aerospace', subcategory: 'Spacecraft', difficulty: 'hard',
      description: 'A Voyager-style deep-space probe: a large high-gain dish over a ten-sided bus, with long booms carrying its instruments and power source well away from the body.',
      hint1: 'Aerospace', hint2: 'It works alone, billions of kilometres from the nearest person, and phones home through a large dish.',
      rotation: { h: 35, v: 20 }, camera: { az: 112, el: 62, roll: -30, zoom: 1.05 },
    },
  },
  {
    file: 'industrial/measuring-tool', build: caliper,
    meta: {
      displayName: 'Vernier Caliper', answer: 'Vernier caliper',
      accepted: ['Caliper', 'Calipers', 'Vernier calipers', 'Vernier', 'Callipers', 'Calliper', 'Vernier calliper', 'Vernier callipers', 'Digital caliper', 'Digital calipers', 'Slide caliper', 'Dial caliper', 'Measuring caliper', 'Sliding caliper'],
      category: 'Industrial machinery', subcategory: 'Measuring tools', difficulty: 'medium',
      description: 'A vernier caliper: a ruled beam with a fixed jaw and a sliding jaw, plus a depth rod out the far end. Machinists use it to measure to a fraction of a millimetre.',
      hint1: 'Industrial tools', hint2: 'A precision instrument: something is gripped between its jaws and a reading is taken.',
      rotation: { h: 30, v: 15 }, camera: { az: 76, el: 14, roll: 52, zoom: 1.6 },
    },
  },
  {
    file: 'technology/spinning-instrument', build: gyroscope,
    meta: {
      displayName: 'Gyroscope', answer: 'Gyroscope',
      accepted: ['Gyro', 'Toy gyroscope', 'Mechanical gyroscope', 'Gyroscope toy', 'Gimbal gyroscope', 'Gyroscopic top', 'Gyrostat'],
      category: 'Technology', subcategory: 'Instruments', difficulty: 'easy',
      description: 'A caged gyroscope on its pedestal. Once the heavy rotor is spinning it stubbornly resists being tilted — the principle behind navigation instruments.',
      hint1: 'Technology', hint2: 'Set its heavy wheel spinning and it refuses to fall over.',
      rotation: { h: 30, v: 15 }, camera: { az: 0, el: 80, roll: 0, zoom: 1.1 },
    },
  },
  {
    file: 'technology/light-control', build: iris,
    meta: {
      displayName: 'Iris Diaphragm', answer: 'Aperture diaphragm',
      accepted: ['Iris diaphragm', 'Camera aperture', 'Aperture', 'Lens aperture', 'Iris', 'Camera iris', 'Aperture blades', 'Lens diaphragm', 'Diaphragm', 'Iris mechanism', 'Aperture mechanism', 'Lens iris', 'Camera diaphragm', 'Aperture iris', 'Iris aperture', 'Camera lens aperture', 'Aperture ring'],
      category: 'Photography', subcategory: 'Camera mechanisms', difficulty: 'expert',
      description: 'An iris diaphragm from a camera lens: nine thin overlapping blades in a ring. Moving the lever swings the blades to widen or narrow the opening.',
      hint1: 'Photography', hint2: 'This mechanism controls how much light is allowed through.',
      rotation: { h: 30, v: 25 }, camera: { az: 35, el: 11, roll: 18, zoom: 1.1 },
    },
  },
  {
    file: 'electronics/glass-valve', build: vacuumTube,
    meta: {
      displayName: 'Vacuum Tube', answer: 'Vacuum tube',
      accepted: ['Valve', 'Thermionic valve', 'Triode', 'Electron tube', 'Radio tube', 'Radio valve', 'Vacuum valve', 'Tube', 'Amplifier tube', 'Amp tube', 'Thermionic tube', 'Vacuum tube triode', 'Pentode', 'Electronic valve', 'Tube valve'],
      category: 'Electronics', subcategory: 'Vintage components', difficulty: 'medium',
      description: 'A vacuum tube (thermionic valve): metal electrodes sealed in an evacuated glass envelope on an eight-pin base. Before transistors, these did all the amplifying.',
      hint1: 'Electronics', hint2: 'Before the transistor, this glowing component amplified signals in radios and early computers.',
      rotation: { h: 30, v: 20 }, camera: { az: 25, el: -57, roll: 140, zoom: 1.15 },
    },
  },
];
