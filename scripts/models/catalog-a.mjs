import { T, mat, add, box, cyl, lathe, extrude, gear, circle } from './lib.mjs';

const PI = Math.PI;

function frontWing() {
  const g = new T.Group();
  const carbon = mat(0x1b1d22, 0.4, 0.45), red = mat(0xc8102e, 0.3, 0.4), white = mat(0xe8e8e8, 0.2, 0.5);
  const airfoil = (chord, thick) => {
    const pts = [], n = 14;
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([t * chord, thick * Math.sin(PI * Math.pow(t, 0.6))]); }
    for (let i = n - 1; i > 0; i--) { const t = i / n; pts.push([t * chord, -thick * 0.3 * Math.sin(PI * t)]); }
    return pts;
  };
  add(g, extrude(airfoil(0.42, 0.035), 1.8), carbon, [0, 0, 0], [0, 0, -0.06]);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      add(g, extrude(airfoil(0.24 - i * 0.02, 0.022), 0.62), i === 3 ? red : carbon,
        [0.36 + i * 0.15, 0.03 + i * 0.075 + i * i * 0.012, side * 0.58], [0, 0, 0.28 + i * 0.2]);
    }
    add(g, extrude([[-0.06, -0.04], [0.98, -0.04], [0.98, 0.4], [0.62, 0.34], [0.12, 0.07]], 0.02), white, [0, 0, side * 0.9]);
    add(g, box(0.9, 0.014, 0.13), carbon, [0.46, -0.04, side * 0.96]);
    add(g, box(0.22, 0.26, 0.02), carbon, [0.2, 0.16, side * 0.09]);
  }
  const nose = cyl(0.06, 0.17, 1.1, 4); nose.rotateY(PI / 4);
  add(g, nose, red, [0.42, 0.33, 0], [0, 0, PI / 2 - 0.1], [0.6, 1, 1]);
  return g;
}

function keySwitch() {
  const g = new T.Group();
  const dark = mat(0x1c1c1f, 0.1, 0.7), smoke = mat(0x8a8f98, 0.1, 0.3, 0.6), stem = mat(0xd22630, 0.05, 0.5), gold = mat(0xd4a94e, 0.9, 0.3);
  add(g, box(1.4, 0.5, 1.4), dark, [0, 0.25, 0]);
  const top = cyl(0.74, 0.99, 0.55, 4); top.rotateY(PI / 4);
  add(g, top, smoke, [0, 0.775, 0]);
  add(g, box(0.56, 0.22, 0.44), stem, [0, 1.15, 0]);
  add(g, box(0.4, 0.36, 0.115), stem, [0, 1.43, 0]);
  add(g, box(0.115, 0.36, 0.4), stem, [0, 1.43, 0]);
  add(g, cyl(0.2, 0.2, 0.3), dark, [0, -0.15, 0]);
  for (const x of [-0.5, 0.5]) add(g, cyl(0.085, 0.085, 0.3, 16), dark, [x, -0.15, 0]);
  add(g, box(0.08, 0.34, 0.02), gold, [-0.38, -0.17, 0.25]);
  add(g, box(0.08, 0.34, 0.02), gold, [0.25, -0.17, 0.5]);
  for (const z of [-0.72, 0.72]) add(g, box(0.5, 0.1, 0.06), dark, [0, 0.56, z]);
  return g;
}

function turbofan() {
  const g = new T.Group();
  const titanium = mat(0x8d949c, 0.85, 0.35), spinner = mat(0x24262b, 0.5, 0.4), cowl = mat(0xd9dde2, 0.6, 0.3);
  add(g, lathe([[0, 0.58], [0.07, 0.53], [0.19, 0.34], [0.27, 0.12], [0.3, 0]]), spinner);
  add(g, cyl(0.3, 0.3, 0.32), spinner, [0, -0.16, 0]);
  const blade = new T.BoxGeometry(0.27, 0.72, 0.02, 2, 12, 1);
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + 0.36) / 0.72, a = 1.05 - 0.6 * t, x = p.getX(i) * (1 - 0.25 * t), z = p.getZ(i);
    p.setXYZ(i, x * Math.cos(a) + z * Math.sin(a), p.getY(i), -x * Math.sin(a) + z * Math.cos(a));
  }
  blade.rotateX(PI / 2); blade.translate(0, -0.1, 0.64); blade.computeVertexNormals();
  for (let i = 0; i < 22; i++) add(g, blade, titanium, [0, 0, 0], [0, (i / 22) * PI * 2, 0]);
  add(g, lathe([[1.02, -0.42], [1.1, -0.36], [1.13, 0.1], [1.09, 0.3], [1.04, 0.33], [1.01, 0.12], [1.02, -0.42]], 72), cowl);
  return g;
}

function camshaft() {
  const g = new T.Group();
  const steel = mat(0x9aa0a6, 0.9, 0.3), ground = mat(0xc9ced3, 0.95, 0.15), dark = mat(0x3b3d42, 0.8, 0.4);
  add(g, cyl(0.09, 0.09, 3.3), steel);
  for (const y of [-1.4, -0.7, 0, 0.7, 1.4]) add(g, cyl(0.15, 0.15, 0.14), ground, [0, y, 0]);
  const egg = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * PI * 2, r = 0.155 + 0.115 * Math.pow(Math.max(0, Math.cos(a)), 3);
    return [r * Math.cos(a), r * Math.sin(a)];
  });
  const phases = [0, 100, 180, 280, 90, 190, 270, 10];
  [-1.18, -0.92, -0.48, -0.22, 0.22, 0.48, 0.92, 1.18].forEach((y, i) => {
    const lobe = extrude(egg, 0.13); lobe.rotateX(PI / 2); lobe.rotateY((phases[i] * PI) / 180);
    add(g, lobe, ground, [0, y, 0]);
  });
  const sprocket = extrude(gear(20, 0.36, 0.07), 0.06, [circle(0.07, 5, 0.2, 0), circle(0.07, 5, -0.2, 0), circle(0.07, 5, 0, 0.2), circle(0.07, 5, 0, -0.2)].map((c) => c.reverse()));
  sprocket.rotateX(PI / 2);
  add(g, sprocket, dark, [0, 1.66, 0]);
  add(g, cyl(0.13, 0.13, 0.1, 6), dark, [0, 1.74, 0]);
  g.rotation.z = PI / 2;
  return g;
}

function sparkPlug() {
  const g = new T.Group();
  const ceramic = mat(0xf2efe6, 0.0, 0.25), nickel = mat(0xb9bcc0, 0.9, 0.3), zinc = mat(0x8c9096, 0.85, 0.45);
  const ins = [[0, 2.0], [0.07, 2.0], [0.09, 1.95], [0.09, 1.86], [0.06, 1.83], [0.06, 1.76], [0.13, 1.73]];
  for (let k = 0; k < 5; k++) { const y = 1.66 - k * 0.11; ins.push([0.15, y], [0.15, y - 0.05], [0.12, y - 0.07], [0.12, y - 0.09]); }
  ins.push([0.15, 1.1], [0.17, 0.95], [0.17, 0.88], [0, 0.88]);
  add(g, lathe(ins), ceramic);
  add(g, cyl(0.26, 0.26, 0.22, 6), nickel, [0, 0.78, 0]);
  add(g, lathe([[0, 0.67], [0.2, 0.67], [0.25, 0.62], [0.25, 0.56], [0.18, 0.52], [0, 0.52]]), nickel);
  const thread = [[0, 0.52]];
  for (let y = 0.52; y > 0.05; y -= 0.05) thread.push([0.15, y], [0.175, y - 0.025]);
  thread.push([0.15, 0.04], [0, 0.04]);
  add(g, lathe(thread), zinc);
  add(g, cyl(0.07, 0.05, 0.1, 24), ceramic, [0, 0, 0]);
  add(g, cyl(0.02, 0.02, 0.1, 12), nickel, [0, -0.07, 0]);
  add(g, box(0.035, 0.2, 0.06), zinc, [0.145, -0.06, 0]);
  add(g, box(0.18, 0.035, 0.06), zinc, [0.075, -0.16, 0]);
  return g;
}

export default [
  {
    file: 'motorsport/front-wing', build: frontWing,
    meta: {
      displayName: 'F1 Front Wing', answer: 'F1 Front Wing',
      accepted: ['Formula 1 front wing', 'Formula One front wing', 'Racing front wing', 'Front wing', 'Race car front wing', 'F1 wing', 'Formula 1 wing', 'F1 car front wing', 'Front wing assembly'],
      category: 'Motorsport', subcategory: 'Aerodynamics', difficulty: 'hard',
      description: 'A multi-element front wing with endplates and nose section. It is the first surface to meet the air, and it shapes the airflow for the whole car behind it.',
      hint1: 'Motorsport', hint2: 'This component plays an important role in aerodynamic performance.',
      rotation: { h: 30, v: 15 }, camera: { az: -18, el: -58, roll: 24, zoom: 1.15 },
    },
  },
  {
    file: 'electronics/key-switch', build: keySwitch,
    meta: {
      displayName: 'Mechanical Keyboard Switch', answer: 'Mechanical keyboard switch',
      accepted: ['Keyboard switch', 'Mechanical switch', 'Key switch', 'Keyswitch', 'MX switch', 'Cherry MX switch', 'Cherry MX', 'Mechanical key switch', 'Mechanical keyswitch', 'Keyboard key switch'],
      category: 'Electronics', subcategory: 'Input devices', difficulty: 'medium',
      description: 'An MX-style switch: a spring-loaded cross stem inside a two-part housing, with two metal contact legs that solder to the circuit board.',
      hint1: 'Electronics', hint2: 'This component is responsible for registering individual key presses.',
      rotation: { h: 30, v: 15 }, camera: { az: 38, el: -64, roll: -15, zoom: 1.1 },
    },
  },
  {
    file: 'aerospace/fan-stage', build: turbofan,
    meta: {
      displayName: 'Turbofan Engine Fan', answer: 'Turbofan',
      accepted: ['Turbofan engine', 'Jet engine', 'Jet engine fan', 'Turbofan fan', 'Aircraft turbine', 'Turbine', 'Jet turbine', 'Engine fan', 'Fan blades', 'Turbine fan', 'Aircraft engine', 'Plane engine', 'Jet engine turbine', 'Turbofan engine fan', 'Airplane engine', 'Aeroplane engine'],
      category: 'Aerospace', subcategory: 'Propulsion', difficulty: 'medium',
      description: 'The front fan stage of a high-bypass turbofan: twisted titanium blades around a spinner cone, inside the intake cowl. Most of an airliner\'s thrust comes from this fan.',
      hint1: 'Aerospace', hint2: 'It spins thousands of times a minute and moves enormous volumes of air to produce thrust.',
      rotation: { h: 25, v: 20 }, camera: { az: 20, el: 9, roll: 90, zoom: 0.92 },
    },
  },
  {
    file: 'automotive/valve-shaft', build: camshaft,
    meta: {
      displayName: 'Camshaft', answer: 'Camshaft',
      accepted: ['Cam shaft', 'Engine camshaft', 'Overhead camshaft', 'Cam', 'Car camshaft', 'Camshaft and sprocket'],
      category: 'Automotive', subcategory: 'Engine internals', difficulty: 'hard',
      description: 'A camshaft with eight egg-shaped lobes and a timing sprocket. As it turns, each lobe pushes a valve open at exactly the right moment.',
      hint1: 'Automotive', hint2: 'This component plays a role in controlling the movement of engine valves.',
      rotation: { h: 30, v: 15 }, camera: { az: 80, el: 7, roll: 0, zoom: 1.6 },
    },
  },
  {
    file: 'automotive/igniter', build: sparkPlug,
    meta: {
      displayName: 'Spark Plug', answer: 'Spark plug',
      accepted: ['Sparkplug', 'Sparking plug', 'Engine spark plug', 'Car spark plug', 'Ignition plug'],
      category: 'Automotive', subcategory: 'Ignition', difficulty: 'medium',
      description: 'A spark plug: ribbed ceramic insulator, hex shell, threaded body and a hooked ground electrode. The gap at its tip is where the spark jumps.',
      hint1: 'Automotive', hint2: 'It delivers a tiny bolt of electricity that starts combustion.',
      rotation: { h: 30, v: 20 }, camera: { az: 30, el: -68, roll: 40, zoom: 1.5 },
    },
  },
];
