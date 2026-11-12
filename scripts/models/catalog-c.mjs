import { T, mat, add, rod, box, cyl, sph, tor, lathe, extrude, gear, circle } from './lib.mjs';

const PI = Math.PI;

function piston() {
  const g = new T.Group();
  const alu = mat(0xb9bdc2, 0.85, 0.35), steel = mat(0x7d8288, 0.9, 0.4), dark = mat(0x34373c, 0.8, 0.45);
  const body = [[0, 0.5], [0.5, 0.5]];
  for (const y of [0.42, 0.32, 0.22]) body.push([0.5, y], [0.47, y], [0.47, y - 0.04], [0.5, y - 0.04]);
  body.push([0.5, -0.32], [0.44, -0.32], [0.44, 0.3], [0, 0.3]);
  add(g, lathe(body, 56), alu);
  add(g, cyl(0.12, 0.12, 0.92, 24), steel, [0, 0, 0], [PI / 2, 0, 0]);
  add(g, cyl(0.2, 0.2, 0.24, 28), dark, [0, 0, 0], [PI / 2, 0, 0]);
  add(g, extrude([[-0.1, -0.1], [0.1, -0.1], [0.17, -1.25], [-0.17, -1.25]], 0.13), dark);
  add(g, extrude(circle(0.38), 0.26, [circle(0.25).reverse()]), dark, [0, -1.55, 0]);
  for (const x of [-0.43, 0.43]) { add(g, box(0.15, 0.26, 0.24), dark, [x, -1.55, 0]); add(g, cyl(0.05, 0.05, 0.5, 12), steel, [x, -1.55, 0]); }
  return g;
}

function planetary() {
  const g = new T.Group();
  const steel = mat(0xa8adb3, 0.9, 0.3), brass = mat(0xc49a45, 0.9, 0.3), dark = mat(0x3a3d42, 0.8, 0.45);
  add(g, extrude(gear(12, 0.3, 0.09), 0.2, [circle(0.1, 24).reverse()]), brass, [0, 0, 0], [0, 0, PI / 12]);
  for (let i = 0; i < 3; i++) {
    const a = PI / 2 + (i / 3) * PI * 2, x = 0.6 * Math.cos(a), y = 0.6 * Math.sin(a);
    add(g, extrude(gear(12, 0.3, 0.09), 0.2, [circle(0.08, 24).reverse()]), steel, [x, y, 0], [0, 0, a]);
    add(g, cyl(0.08, 0.08, 0.34, 20), dark, [x, y, -0.07], [PI / 2, 0, 0]);
  }
  add(g, extrude(circle(1.14, 72), 0.2, [gear(36, 0.9, 0.09, true).reverse()]), dark);
  add(g, extrude(circle(0.78, 3).map(([x, y]) => [-y, x]), 0.05), brass, [0, 0, -0.2]);
  add(g, cyl(0.13, 0.13, 0.7, 24), steel, [0, 0, -0.55], [PI / 2, 0, 0]);
  return g;
}

function dna() {
  const g = new T.Group();
  const blue = mat(0x2f6fb5, 0.1, 0.4), red = mat(0xc0392b, 0.1, 0.4), pairs = [mat(0xe6b422, 0.1, 0.5), mat(0x3b9a57, 0.1, 0.5)];
  const H = 3.2, R = 0.5, turns = 1.6;
  const at = (t, phase) => { const a = t * turns * PI * 2 + phase; return [R * Math.cos(a), (t - 0.5) * H, R * Math.sin(a)]; };
  class Helix extends T.Curve {
    constructor(phase) { super(); this.phase = phase; }
    getPoint(t, target = new T.Vector3()) { return target.set(...at(t, this.phase)); }
  }
  const offset = PI * 0.8; // unequal grooves, like the real molecule
  add(g, new T.TubeGeometry(new Helix(0), 160, 0.07, 10), blue);
  add(g, new T.TubeGeometry(new Helix(offset), 160, 0.07, 10), red);
  for (let i = 0; i < 17; i++) {
    const t = (i + 0.5) / 17, a = at(t, 0), b = at(t, offset), mid = a.map((v, k) => (v + b[k]) / 2);
    rod(g, a, mid, 0.035, pairs[i % 2], 8); rod(g, mid, b, 0.035, pairs[(i + 1) % 2], 8);
  }
  for (const [t, p, m] of [[0, 0, blue], [1, 0, blue], [0, offset, red], [1, offset, red]]) add(g, sph(0.07, 12), m, at(t, p));
  return g;
}

function joystick() {
  const g = new T.Group();
  const black = mat(0x18191c, 0.2, 0.6), steel = mat(0xb8bcc1, 0.9, 0.25), ball = mat(0xc62828, 0.1, 0.25), grey = mat(0x5c6066, 0.3, 0.6), gold = mat(0xd4a94e, 0.9, 0.3);
  add(g, box(1.35, 0.04, 1.0), steel);
  add(g, cyl(0.36, 0.36, 0.02), black, [0, 0.04, 0]);
  add(g, cyl(0.06, 0.06, 1.25, 20), steel, [0, 0.62, 0]);
  add(g, sph(0.26), ball, [0, 1.3, 0]);
  add(g, box(0.86, 0.5, 0.86), black, [0, -0.27, 0]);
  add(g, box(0.96, 0.04, 0.96), grey, [0, -0.54, 0]);
  add(g, cyl(0.12, 0.1, 0.26, 20), grey, [0, -0.68, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2, x = 0.54 * Math.cos(a), z = 0.54 * Math.sin(a);
    add(g, box(0.16, 0.26, 0.42), grey, [x, -0.32, z], [0, -a, 0]);
    for (const s of [-0.13, 0.13]) add(g, box(0.1, 0.02, 0.06), gold, [x * 1.24 - s * Math.sin(a), -0.32, z * 1.24 + s * Math.cos(a)], [0, -a, 0]);
  }
  return g;
}

function bearing() {
  const g = new T.Group();
  const race = mat(0xc2c6cb, 0.95, 0.15), balls = mat(0xe3e6ea, 1.0, 0.08), cage = mat(0xb8924a, 0.85, 0.35);
  add(g, lathe([[1.0, -0.2], [1.0, 0.2], [0.83, 0.2], [0.83, 0.09], [0.79, 0], [0.83, -0.09], [0.83, -0.2], [1.0, -0.2]], 72), race);
  add(g, lathe([[0.45, -0.2], [0.45, 0.2], [0.62, 0.2], [0.62, 0.09], [0.66, 0], [0.62, -0.09], [0.62, -0.2], [0.45, -0.2]], 72), race);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; add(g, sph(0.1, 20), balls, [0.725 * Math.cos(a), 0, 0.725 * Math.sin(a)]); }
  add(g, tor(0.725, 0.022, 72, 8), cage, [0, 0.07, 0], [PI / 2, 0, 0]);
  add(g, tor(0.725, 0.022, 72, 8), cage, [0, -0.07, 0], [PI / 2, 0, 0]);
  return g;
}

export default [
  {
    file: 'automotive/reciprocating-part', build: piston,
    meta: {
      displayName: 'Piston & Connecting Rod', answer: 'Piston',
      accepted: ['Piston and connecting rod', 'Engine piston', 'Piston rod', 'Connecting rod', 'Con rod', 'Conrod', 'Piston assembly', 'Piston with connecting rod', 'Car piston', 'Piston and conrod', 'Piston and con rod', 'Piston and rod', 'Pistons'],
      category: 'Automotive', subcategory: 'Engine internals', difficulty: 'medium',
      description: 'A piston with its ring grooves, wrist pin and connecting rod. Burning fuel shoves it down the cylinder; the rod turns that push into rotation.',
      hint1: 'Automotive', hint2: 'It is driven up and down thousands of times a minute by small explosions.',
      rotation: { h: 30, v: 15 }, camera: { az: 86, el: -44, roll: 65, zoom: 1.1 },
    },
  },
  {
    file: 'industrial/gear-train', build: planetary,
    meta: {
      displayName: 'Planetary Gearset', answer: 'Planetary gear',
      accepted: ['Planetary gearset', 'Planetary gear set', 'Planetary gearbox', 'Planetary gears', 'Epicyclic gear', 'Epicyclic gearing', 'Epicyclic gearbox', 'Epicyclic gear train', 'Planetary gear train', 'Sun and planet gear', 'Planetary gear system', 'Epicyclic gears', 'Planetary transmission', 'Planetary drive'],
      category: 'Industrial machinery', subcategory: 'Power transmission', difficulty: 'expert',
      description: 'A planetary (epicyclic) gearset: a central sun gear, three planet gears on a carrier, and an outer ring gear with internal teeth. Compact, strong, and found in every automatic gearbox.',
      hint1: 'Industrial machinery', hint2: 'It trades speed for torque in a very compact space, with parts named after the heavens.',
      rotation: { h: 35, v: 15 }, camera: { az: 74, el: 12, roll: -20, zoom: 1.1 },
    },
  },
  {
    file: 'random/twisted-ladder', build: dna,
    meta: {
      displayName: 'DNA Double Helix', answer: 'DNA',
      accepted: ['DNA double helix', 'Double helix', 'DNA strand', 'DNA molecule', 'Deoxyribonucleic acid', 'DNA helix', 'DNA model', 'Helix', 'DNA structure'],
      category: 'Biology', subcategory: 'Molecular models', difficulty: 'hard',
      description: 'A model of the DNA double helix: two sugar-phosphate backbones wound around each other, joined by base pairs like the rungs of a twisted ladder.',
      hint1: 'Biology', hint2: 'Every living cell carries a copy of this, and it holds the instructions for building you.',
      rotation: { h: 30, v: 28 }, camera: { az: 12, el: 83, roll: 0, zoom: 1.45 },
    },
  },
  {
    file: 'gaming/cabinet-control', build: joystick,
    meta: {
      displayName: 'Arcade Joystick', answer: 'Arcade joystick',
      accepted: ['Joystick', 'Arcade stick', 'Fight stick', 'Arcade joystick lever', 'Joystick lever', 'Arcade lever', 'Ball top joystick', 'Arcade controller', 'Fightstick', 'Arcade control stick', 'Joy stick', 'Arcade joy stick'],
      category: 'Gaming', subcategory: 'Arcade hardware', difficulty: 'hard',
      description: 'An arcade joystick lever seen without its cabinet: ball top, shaft and mounting plate above, and underneath, the four microswitches that register each direction.',
      hint1: 'Gaming', hint2: 'Four small switches underneath it click as a player pushes in each direction.',
      rotation: { h: 30, v: 20 }, camera: { az: 28, el: -70, roll: 12, zoom: 1.15 },
    },
  },
  {
    file: 'industrial/rolling-element', build: bearing,
    meta: {
      displayName: 'Ball Bearing', answer: 'Ball bearing',
      accepted: ['Bearing', 'Ball bearings', 'Deep groove ball bearing', 'Roller bearing', 'Bearings', 'Wheel bearing', 'Skate bearing', 'Rolling bearing', 'Radial ball bearing', 'Rolling element bearing'],
      category: 'Industrial machinery', subcategory: 'Machine elements', difficulty: 'hard',
      description: 'A deep-groove ball bearing: hardened steel balls held in a cage between an inner and an outer race, letting a shaft spin with almost no friction.',
      hint1: 'Industrial machinery', hint2: 'It lets one part spin freely inside another with very little friction.',
      rotation: { h: 30, v: 20 }, camera: { az: 0, el: 7, roll: 30, zoom: 0.95 },
    },
  },
];
