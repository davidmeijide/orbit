import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as satelliteJS from "satellite.js";

// Global variables
const satelliteData = [];
const satelliteMeshes = [];
let enabledSettings = [];
let lastUpdateTime = new Date();
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

// Earth's axial tilt (in radians, 23.5 degrees)
const earthTilt = THREE.MathUtils.degToRad(23.5);

// Rotation speed in radians per second for a 24-hour rotation period
const earthRotationSpeed = (2 * Math.PI) / 86400; // 2*PI radians in 86400 seconds (1 full rotation in 24 hours)
const earthMesh = generateEarth();

function setupTimeControl() {
  const value = document.querySelector("#time-speed");
  const slider = document.querySelector("#time-range");
  slider.addEventListener("input", (event) => {
    if (event.target.value == 0) {
      value.textContent = "Pause";
    } else {
      value.textContent = slider.value + "x";
    }
  });
}

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
  earthMesh.rotation.z = earthTilt; // Tilt the Earth around the Z-axis
  scene.add(earthMesh);
  //earthMesh.rotation.x = -Math.PI / 2; // Rotate 90 degrees around the x-axis
  return earthMesh;
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

// Function to parse TLE file and calculate satellites
function parseTleAndCalculateSatellites(tleFile) {
  const tleLines = tleFile.trim().split("\r\n");

  for (let i = 0; i < tleLines.length; i += 3) {
    const satelliteName = tleLines[i].trim().split(" ")[0];
    const line1 = tleLines[i + 1];
    const line2 = tleLines[i + 2];

    // Initialize the satellite record from the TLE lines
    const satrec = satelliteJS.twoline2satrec(line1, line2);

    // Log the satrec for debugging
    if (satrec.error) {
      console.error(
        `Error in TLE data for satellite ${satelliteName}:,
        satrec.error`
      );
      continue; // Skip if there is an error in satrec
    }

    const now = new Date();

    // Propagate the satellite's position and velocity
    const positionAndVelocity = satelliteJS.propagate(satrec, now);

    if (
      positionAndVelocity.position &&
      !isNaN(positionAndVelocity.position.x)
    ) {
      const eci = positionAndVelocity.position;
      const gmst = satelliteJS.gstime(now);
      const ecef = satelliteJS.eciToEcf(eci, gmst);

      // Push satellite data
      satelliteData.push({
        name: satelliteName,
        x: ecef.x,
        y: ecef.y,
        z: ecef.z,
        semiMajorAxis: satrec.a, // Convert km to meters
        eccentricity: satrec.ecco,
        inclination: satrec.inclo,
        raan: satrec.nodeo,
        argPerigee: satrec.argpo,
        startTime: now,
        orbitPeriod: (2 * Math.PI) / satrec.no,
        satrec: satrec,
      });

      // Create the satellite mesh
      const satelliteMesh = createSatelliteMesh(0xffff00);
      satelliteMeshes.push(satelliteMesh);

      // Create the orbit line
      createOrbitLine(satrec, satelliteName);
    } else {
      console.error(`Failed to propagate satellite: ${satelliteName}`);
    }
  }
}

function fetchSatelliteStatus() {
  fetch(
    "https://raw.githubusercontent.com/davidmeijide/orbit/main/satellite_states.json"
  )
    .then((response) => response.json())
    .then((data) => createFilterEvents(data))
    .catch(`Error when fetching satellite status`);
}

function createFilterEvents(data) {
  const filter = document.querySelector("#filters");
  const checkboxes = filter.querySelectorAll("input");
  let enabledSettings = [];

  // Attach event listeners to checkboxes
  checkboxes.forEach((element) => {
    element.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Update enabledSettings based on checked checkboxes
      enabledSettings = Array.from(checkboxes)
        .filter((i) => i.checked) // Filter checked checkboxes
        .map((i) => i.value); // Get the values of checked checkboxes

      applyFilters();
    });
  });

  // Function to apply the filters and show/hide satellite objects
  function applyFilters() {
    // Filter the satellite data based on active/inactive status
    const active_satellites = data
      .filter((element) => element.is_active == 1)
      .map((element) => element.id);
    const inactive_satellites = data
      .filter((element) => element.is_active == 0)
      .map((element) => element.id);
    //console.log(active_satellites);
    // Traverse the scene and update visibility of satellites
    scene.traverse((object) => {
      if (object.name) {
        // Check if the satellite is active or inactive
        const isActiveSatellite = active_satellites.includes(object.name);
        const isInactiveSatellite = inactive_satellites.includes(object.name);

        // Determine the visibility based on active or inactive filter states
        //console.log("isInactiveSatellite", isInactiveSatellite);
        //console.log("enabledSettings", enabledSettings);
        if (
          (enabledSettings.includes("active") && isActiveSatellite) ||
          (enabledSettings.includes("inactive") && isInactiveSatellite)
        ) {
          object.visible = true;
          //console.log("object ", object, "is now visible");
        } else {
          object.visible = false;
          //console.log("object ", object, "is now invisible");
        }
      }
    });
  }
  enabledSettings = Array.from(checkboxes)
    .filter((i) => i.checked) // Default checked boxes
    .map((i) => i.value); // Map to their values
  // Call applyFilters initially to set up visibility based on the initial state of checkboxes
  applyFilters();
}

// Function to create orbit lines
function createOrbitLine(satrec, satelliteName, numPoints = 100) {
  const orbitPoints = [];
  const now = new Date(); // Start from the current time
  const gmst = satelliteJS.gstime(now);

  // Loop over numPoints to generate the orbit
  for (let j = 0; j < numPoints; j++) {
    // Calculate the time offset (in minutes)
    const minutesOffset = (j / numPoints) * ((2 * Math.PI) / satrec.no);
    const futureDate = new Date(now.getTime() + minutesOffset * 60 * 1000); // Convert minutes to ms
    // Propagate satellite position
    const positionAndVelocity = satelliteJS.propagate(satrec, futureDate);
    const eci = positionAndVelocity.position;

    if (eci) {
      // Convert from ECI to ECEF using gmst
      const ecef = satelliteJS.eciToEcf(eci, gmst);
      orbitPoints.push(
        new THREE.Vector3(ecef.x * 1000, ecef.y * 1000, ecef.z * 1000)
      );
    }
  }

  // Create the orbit geometry and material
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

  // Create the line and add it to the scene
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  orbitLine.name = satelliteName;
  console.log(orbitLine.name);
  scene.add(orbitLine);
}

// Initialize TrackballControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth damping
controls.dampingFactor = 0.25; // Damping factor
camera.position.set(earthRadius * 1.7, earthRadius * 1, 0);
//camera.up = new THREE.Vector3(0, 0, -0.1);
camera.lookAt(new THREE.Vector3(0, 0, 0));
controls.update();

// Main animation loop
function animate() {
  requestAnimationFrame(animate);

  const now = Date.now();
  const deltaTime = (now - lastUpdateTime) / 1000; // Time difference in seconds
  lastUpdateTime = now;
  earthMesh.rotation.y += earthRotationSpeed * deltaTime;
  // Update satellite positions based on parsed data
  satelliteData.forEach((satellite, index) => {
    //console.log("satrec", satellite.satrec);
    const propagatedPositionAndVelocity = satelliteJS.propagate(
      satellite.satrec,
      new Date()
    );
    const eci = propagatedPositionAndVelocity.position;
    const gmst = satelliteJS.gstime(new Date());
    const ecef = satelliteJS.eciToEcf(eci, gmst);

    satelliteMeshes[index].position.set(
      ecef.x * 1000,
      ecef.y * 1000,
      ecef.z * 1000
    );
    if (!satelliteMeshes[index].name) {
      satelliteMeshes[index].name = satellite.name; // Name it to access it later with events
      //console.log(satelliteMeshes);
    }
  });

  // Render the scene
  renderer.render(scene, camera);
  controls.update();
}
// Generate lights and earth
generateLights();
generateEarth();
fetchSatelliteStatus();
setupTimeControl();
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
