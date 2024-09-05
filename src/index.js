import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import * as satelliteJS from "satellite.js";

// Global variable to store satellite data
let satelliteData = [];

// Three.js scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100000000
);
const earthRadius = 6371000; // Earth's radius in meters
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Function to generate the Earth
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
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);
  earthMesh.rotation.x = -Math.PI / 2; // Rotate 90 degrees around the x-axis
}

// Function to generate lights
function generateLights() {
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(30000, 0, 0);
  scene.add(directionalLight);
}

// Function to create satellite meshes
function createSatelliteMesh(color) {
  const satelliteGeometry = new THREE.SphereGeometry(0.5e6, 32, 32); // Scale for visibility
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color });
  const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
  scene.add(satelliteMesh);
  return satelliteMesh;
}

function parseTleAndCalculateSatellites(tleFile) {
  const tleLines = tleFile.trim().split("\n");
  for (let i = 0; i < tleLines.length; i += 3) {
    const satelliteName = tleLines[i].trim();
    const line1 = tleLines[i + 1];
    const line2 = tleLines[i + 2];

    const satrec = satelliteJS.twoline2satrec(line1, line2);
    const now = new Date();
    const positionAndVelocity = satelliteJS.propagate(satrec, now);
    const eci = positionAndVelocity.position;
    const gmst = satelliteJS.gstime(now);
    const ecef = satelliteJS.eciToEcf(eci, gmst);

    satelliteData.push({
      name: satelliteName,
      x: ecef.x,
      y: ecef.y,
      z: ecef.z,
    });
  }
}

// Initialize TrackballControls
const controls = new TrackballControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth damping
controls.dampingFactor = 0.25; // Damping factor
camera.position.set(earthRadius * 1.7, earthRadius * 1, 0);
camera.up = new THREE.Vector3(0, 0, -0.1);
camera.lookAt(new THREE.Vector3(0, 0, 0));
controls.update();

// Main animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update satellite positions based on parsed data
  satelliteData.forEach((satellite) => {
    const satelliteMesh = createSatelliteMesh(0x00ff00);
    satelliteMesh.position.set(satellite.x, satellite.y, satellite.z);
  });

  // Render the scene
  renderer.render(scene, camera);
  controls.update();
}

generateLights();
generateEarth();

fetch("../galileo_tle.txt")
  .then((response) => response.text())
  .then((tleData) => {
    console.log(tleData);
    //parseTleAndCalculateSatellites(tleData);
    animate(); // Start the animation loop
  })
  .catch((error) => {
    console.error("Error fetching TLE file:", error);
  });
// Start the application

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
