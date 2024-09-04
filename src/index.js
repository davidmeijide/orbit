import "./styles.css";

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

const G = 6.6743e-11; // Gravitational constant in N⋅m²/kg²
const M = 5.972e24; // Mass of Earth in kg
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100000000
);
const earthRadius = 6371000; // Earth's radius in kilometers
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function generateEarth() {
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load(
    "https://raw.githubusercontent.com/bobbyroe/threejs-earth/main/textures/00_earthmap1k.jpg"
  );
  const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
  const earthMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    specularMap: textureLoader.load(
      "https://raw.githubusercontent.com/bobbyroe/threejs-earth/main/textures/02_earthspec1k.jpg"
    ),
    bumpMap: textureLoader.load(
      "https://raw.githubusercontent.com/bobbyroe/threejs-earth/main/textures/01_earthbump1k.jpg"
    ),
    bumpScale: 0.04,
    transparent: false,
  });
  earthMaterial.map.colorSpace = THREE.SRGBColorSpace;
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);
  earthMesh.rotation.x = -Math.PI / 2; // Rotate 90 degrees around the x-axis
  const scale = 1; // Adjust the scale factor as needed
  earthMesh.scale.set(scale, scale, scale);
  earthMesh.rotation.y += 0.0005;
}

// Lights

function generateLights() {
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(30000, 0, 0);
  scene.add(directionalLight);
}

// Function to create a satellite orbit
function createSatelliteOrbit(a, e, i, Omega, omega, n, color) {
  // Create satellite geometry
  const satelliteGeometry = new THREE.SphereGeometry(0.5e6, 32, 32); // Scale for visibility
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color: color });
  const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
  scene.add(satelliteMesh);

  // Create orbit path
  const orbitPoints = [];
  const numPoints = 100; // Number of points in the orbit
  for (let j = 0; j < numPoints; j++) {
    const M = (j / numPoints) * (2 * Math.PI); // Mean anomaly
    let E = M; // Eccentric anomaly approximation
    for (let k = 0; k < 10; k++) {
      E = M + e * Math.sin(E);
    }
    const nu =
      2 *
      Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
      ); // True anomaly

    // Position in orbit
    const r = a * (1 - e * Math.cos(E)); // Radius
    const x =
      r *
      (Math.cos(nu) * Math.cos(omega) -
        Math.sin(nu) * Math.sin(omega) * Math.cos(i));
    const y =
      r *
      (Math.cos(nu) * Math.sin(omega) +
        Math.sin(nu) * Math.cos(omega) * Math.cos(i));
    const z = r * (Math.sin(nu) * Math.sin(i));
    orbitPoints.push(new THREE.Vector3(x, y, z));
  }

  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: 0.5,
    transparent: true,
  });
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  scene.add(orbitLine);

  // Animation loop for the satellite
  function animateSatellite() {
    const currentTime = performance.now() * 0.001; // Time in seconds
    const M = n * currentTime; // Mean anomaly
    let E = M; // Eccentric anomaly approximation
    for (let k = 0; k < 10; k++) {
      E = M + e * Math.sin(E);
    }
    const nu =
      2 *
      Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
      ); // True anomaly
    const r = a * (1 - e * Math.cos(E)); // Radius

    // Calculate satellite position
    const x =
      r *
      (Math.cos(nu) * Math.cos(omega) -
        Math.sin(nu) * Math.sin(omega) * Math.cos(i));
    const y =
      r *
      (Math.cos(nu) * Math.sin(omega) +
        Math.sin(nu) * Math.cos(omega) * Math.cos(i));
    const z = r * (Math.sin(nu) * Math.sin(i));

    satelliteMesh.position.set(x, y, z);
  }

  return animateSatellite; // Return the animation function
}

function calculateSemiMajorAxis(n) {
  return Math.pow((G * M) / n ** 2, 1 / 3);
}

// Create multiple satellite orbits
let satellites = require("../norad.json");
// Constants
const animateFunctions = satellites.map((satellite) =>
  createSatelliteOrbit(
    calculateSemiMajorAxis(satellite.MEAN_MOTION * ((2 * Math.PI) / 86400)),
    satellite.ECCENTRICITY,
    THREE.MathUtils.degToRad(satellite.INCLINATION),
    THREE.MathUtils.degToRad(satellite.RA_OF_ASC_NODE),
    THREE.MathUtils.degToRad(satellite.ARG_OF_PERICENTER),
    THREE.MathUtils.degToRad(satellite.MEAN_MOTION),
    0x00ff00
  )
);
// Initialize TrackballControls
const controls = new TrackballControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth damping
controls.dampingFactor = 0.25; // Damping factor
camera.position.set(earthRadius * 1.7, earthRadius * 1, 0);
camera.up = new THREE.Vector3(0, 0, -0.1);

camera.lookAt(new THREE.Vector3(0, 0, 0));
//camera.rotation.z = Math.PI * 4;
controls.maxPolaAngle = Math.PI;
// Camera position
controls.update();
// Main animation loop
function animate() {
  requestAnimationFrame(animate);
  // Update all satellites
  animateFunctions.forEach((animateSatellite) => animateSatellite());

  // Render the scene
  renderer.render(scene, camera);
  controls.update();
}
generateLights();
generateEarth();
animate();

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
