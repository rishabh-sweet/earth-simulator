import * as THREE from 'three';

// Work out which way the Sun is, for a given moment in time.
//
// We find the "sub-solar point" — the spot on Earth where the Sun is directly
// overhead — as a latitude/longitude, then turn that into a 3D direction that
// lines up with how the Blue Marble texture is wrapped onto our sphere.
//
// The math is the standard astronomy approximation (good to ~0.5°), which is
// far more accuracy than the eye needs.
export function getSunDirection(date = new Date()) {
  // --- Day of the year (1–366) in UTC ---
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000);

  // --- Sub-solar latitude = the Sun's declination ---
  // Swings between +23.44° (June) and -23.44° (December) over the year.
  const declination =
    -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

  // --- Sub-solar longitude ---
  // At 12:00 UTC the Sun sits roughly over the prime meridian (0°), and the
  // sub-solar point drifts 15° west for every hour after that.
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const longitude = -(utcHours - 12) * 15;

  // --- Convert (latitude, longitude) into a unit direction vector ---
  // This mapping matches the equirectangular texture: longitude 0° points
  // along +X, the North Pole points along +Y, and east is toward -Z.
  const lat = THREE.MathUtils.degToRad(declination);
  const lon = THREE.MathUtils.degToRad(longitude);

  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon)
  ).normalize();
}
