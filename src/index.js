import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import * as satelliteJS from "satellite.js";

// Global variables
let satelliteData = [];
const satelliteMeshes = []; // Array to hold satellite meshes

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
  const satelliteGeometry = new THREE.SphereGeometry(0.2e6, 32, 32); // Scale for visibility
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color });
  const satelliteMesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
  scene.add(satelliteMesh);
  return satelliteMesh;
}

const MU = 3.986004418e14; // Earth's gravitational parameter in m^3/s^2

// Function to parse TLE file and calculate satellites
function parseTleAndCalculateSatellites(tleFile) {
  const tleLines = tleFile.trim().split("\r\n");
  for (let i = 0; i < tleLines.length; i += 3) {
    const satelliteName = tleLines[i].trim();
    const line1 = tleLines[i + 1];
    const line2 = tleLines[i + 2];

    const satrec = satelliteJS.twoline2satrec(line1, line2);

    // Create a satellite mesh and store it
    const satelliteMesh = createSatelliteMesh(0xffff00);
    satelliteMeshes.push(satelliteMesh); // Store the mesh for later updates

    // Push satellite data
    satelliteData.push({
      name: satelliteName,
      satrec,
    });

    // Create the orbit line for the satellite
    createOrbitLine(satrec);
  }
  console.log(satelliteData);
}

// Function to create orbit lines
function createOrbitLine(satrec, numPoints = 100) {
  const orbitPoints = [];
  const now = new Date();
  const gmst = satelliteJS.gstime(now);

  for (let j = 0; j < numPoints; j++) {
    const minutesSinceEpoch =
      ((j / numPoints) * ((2 * Math.PI) / satrec.no) * 1440) / (2 * Math.PI); // Time in minutes
    const positionAndVelocity = satelliteJS.propagate(
      satrec,
      satelliteJS.jday(now) + minutesSinceEpoch / 1440.0
    );
    //console.log("positionAndVelocity", positionAndVelocity);
    const eci = positionAndVelocity.position;
    if (eci) {
      // Convert from ECI to ECEF
      const ecef = satelliteJS.eciToEcf(eci, gmst);

      // Push the new point to the orbitPoints array, converting from km to meters
      orbitPoints.push(
        new THREE.Vector3(ecef.x * 1000, ecef.y * 1000, ecef.z * 1000)
      );
    }
  }

  // Create the orbit geometry and material
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  //console.log(orbitPoints);
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x00ff00, // Green color for visibility
  });

  // Create the line and add it to the scene
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  scene.add(orbitLine);
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
  satelliteData.forEach((satellite, index) => {
    const now = new Date();
    const positionAndVelocity = satelliteJS.propagate(satellite.satrec, now);
    const eci = positionAndVelocity.position;
    const gmst = satelliteJS.gstime(now);
    const ecef = satelliteJS.eciToEcf(eci, gmst);

    satelliteMeshes[index].position.set(
      ecef.x * 1000,
      ecef.y * 1000,
      ecef.z * 1000
    );
  });

  // Render the scene
  renderer.render(scene, camera);
  controls.update();
}
// Generate lights and earth
generateLights();
generateEarth();

// Fetch TLE data and start the application
fetch(
  "https://raw.githubusercontent.com/davidmeijide/orbit/main/galileo_tle.txt"
)
  .then((response) => response.text())
  .then((tleData) => {
    parseTleAndCalculateSatellites(tleData);
    animate(); // Start the animation loop
  })
  .catch((error) => {
    console.error("Error fetching TLE file:", error);
  });

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
