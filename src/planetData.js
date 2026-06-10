// All the numbers that describe the solar system.
//
// Two kinds of values live here:
//   • DISPLAY values (radius, orbitRadius, spinSpeed, axialTilt) — these are
//     deliberately NOT to scale. Real distances/sizes are impossible to show
//     together (the Sun would be 1000s of pixels and Neptune off-screen), so
//     these are hand-tuned just to look good and stay readable.
//   • facts[] — the REAL NASA figures shown in the click-through callouts.
//
// `texture` paths point at the 2K maps in /public/textures.

// The Sun sits at the center; it has no orbit.
export const SUN = {
  key: 'sun',
  name: 'Sun',
  texture: '/textures/sun.jpg',
  radius: 5,
  spinSpeed: 0.02,
  color: 0xffcc66,
  facts: [
    { label: 'Type', value: 'G-type main-sequence' },
    { label: 'Diameter', value: '1,391,000 km' },
    { label: 'Mass', value: '1.989 × 10³⁰ kg' },
    { label: 'Surface temp', value: '5,500 °C' },
    { label: 'Core temp', value: '15,000,000 °C' },
  ],
};

// Earth's Moon. Built as a child of Earth, but clickable in its own right.
export const MOON = {
  key: 'moon',
  name: 'Moon',
  texture: '/textures/moon.jpg',
  radius: 0.24,
  orbitRadius: 2.0, // distance from Earth (display only)
  spinSpeed: 0.04,
  color: 0xaaaaaa,
  facts: [
    { label: 'Orbit distance', value: '384,400 km (from Earth)' },
    { label: 'Orbital period', value: '27.3 days' },
    { label: 'Diameter', value: '3,475 km' },
    { label: 'Mass', value: '7.35 × 10²² kg' },
    { label: 'Surface temp', value: '−20 °C avg' },
  ],
};

// The eight planets, in order out from the Sun.
export const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    texture: '/textures/mercury.jpg',
    radius: 0.45,
    orbitRadius: 14,
    spinSpeed: 0.05,
    axialTilt: 0.03,
    color: 0xa9a9a9,
    facts: [
      { label: 'Orbit distance', value: '57.9M km · 0.39 AU' },
      { label: 'Orbital period', value: '88 days' },
      { label: 'Diameter', value: '4,879 km' },
      { label: 'Mass', value: '3.30 × 10²³ kg' },
      { label: 'Surface temp', value: '167 °C avg' },
    ],
  },
  {
    key: 'venus',
    name: 'Venus',
    texture: '/textures/venus.jpg',
    radius: 0.85,
    orbitRadius: 19,
    spinSpeed: 0.03,
    axialTilt: 177.4,
    color: 0xd9b38c,
    facts: [
      { label: 'Orbit distance', value: '108.2M km · 0.72 AU' },
      { label: 'Orbital period', value: '225 days' },
      { label: 'Diameter', value: '12,104 km' },
      { label: 'Mass', value: '4.87 × 10²⁴ kg' },
      { label: 'Surface temp', value: '464 °C avg' },
    ],
  },
  {
    key: 'earth',
    name: 'Earth',
    texture: '/textures/earth_daymap.jpg',
    radius: 0.9,
    orbitRadius: 25,
    spinSpeed: 0.15,
    axialTilt: 23.4,
    color: 0x4f9bd6,
    moon: MOON,
    facts: [
      { label: 'Orbit distance', value: '149.6M km · 1.00 AU' },
      { label: 'Orbital period', value: '365.25 days' },
      { label: 'Diameter', value: '12,742 km' },
      { label: 'Mass', value: '5.97 × 10²⁴ kg' },
      { label: 'Surface temp', value: '15 °C avg' },
    ],
  },
  {
    key: 'mars',
    name: 'Mars',
    texture: '/textures/mars.jpg',
    radius: 0.5,
    orbitRadius: 32,
    spinSpeed: 0.14,
    axialTilt: 25.2,
    color: 0xc1440e,
    facts: [
      { label: 'Orbit distance', value: '227.9M km · 1.52 AU' },
      { label: 'Orbital period', value: '687 days' },
      { label: 'Diameter', value: '6,779 km' },
      { label: 'Mass', value: '6.42 × 10²³ kg' },
      { label: 'Surface temp', value: '−65 °C avg' },
    ],
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    texture: '/textures/jupiter.jpg',
    radius: 2.4,
    orbitRadius: 48,
    spinSpeed: 0.4,
    axialTilt: 3.1,
    color: 0xd8ca9d,
    facts: [
      { label: 'Orbit distance', value: '778.5M km · 5.20 AU' },
      { label: 'Orbital period', value: '11.86 years' },
      { label: 'Diameter', value: '139,820 km' },
      { label: 'Mass', value: '1.898 × 10²⁷ kg' },
      { label: 'Surface temp', value: '−110 °C (cloud top)' },
    ],
  },
  {
    key: 'saturn',
    name: 'Saturn',
    texture: '/textures/saturn.jpg',
    radius: 2.0,
    orbitRadius: 66,
    spinSpeed: 0.38,
    axialTilt: 26.7,
    color: 0xe3d9a6,
    rings: { inner: 2.6, outer: 4.4, texture: '/textures/saturn_ring.png' },
    facts: [
      { label: 'Orbit distance', value: '1.43B km · 9.58 AU' },
      { label: 'Orbital period', value: '29.45 years' },
      { label: 'Diameter', value: '116,460 km' },
      { label: 'Mass', value: '5.68 × 10²⁶ kg' },
      { label: 'Surface temp', value: '−140 °C (cloud top)' },
    ],
  },
  {
    key: 'uranus',
    name: 'Uranus',
    texture: '/textures/uranus.jpg',
    radius: 1.4,
    orbitRadius: 82,
    spinSpeed: 0.25,
    axialTilt: 97.8,
    color: 0x9fd8e0,
    facts: [
      { label: 'Orbit distance', value: '2.87B km · 19.2 AU' },
      { label: 'Orbital period', value: '84 years' },
      { label: 'Diameter', value: '50,724 km' },
      { label: 'Mass', value: '8.68 × 10²⁵ kg' },
      { label: 'Surface temp', value: '−195 °C' },
    ],
  },
  {
    key: 'neptune',
    name: 'Neptune',
    texture: '/textures/neptune.jpg',
    radius: 1.35,
    orbitRadius: 96,
    spinSpeed: 0.26,
    axialTilt: 28.3,
    color: 0x4166f5,
    facts: [
      { label: 'Orbit distance', value: '4.50B km · 30.1 AU' },
      { label: 'Orbital period', value: '164.8 years' },
      { label: 'Diameter', value: '49,244 km' },
      { label: 'Mass', value: '1.02 × 10²⁶ kg' },
      { label: 'Surface temp', value: '−200 °C' },
    ],
  },
];
