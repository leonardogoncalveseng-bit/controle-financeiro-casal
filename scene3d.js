// ===================================================
// CENA 3D - Anime.js + Three.js Adapter
// Cubos flutuantes que explodem e implodem em loop
// ===================================================
import { animate, createTimer, stagger, utils } from 'animejs';
import * as THREE from 'three';
import { getInstances } from 'animejs/adapters/three';

const container = document.getElementById('scene-container');
if (container) {
  const { width, height } = container.getBoundingClientRect();

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.z = 7;
  scene.add(camera);

  // Iluminação suave e cinematic
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const pointLight = new THREE.PointLight(0x38bdf8, 6, 25, 0.5);
  pointLight.position.set(0, 0, 3);
  pointLight.castShadow = true;
  scene.add(pointLight);

  const dirLight = new THREE.DirectionalLight(0xa855f7, 1.5);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);

  // Grid 3D de cubos (InstancedMesh)
  const gridSize = 4;
  const cellSize = 1.8 / gridSize;
  const spread = (gridSize - 1) / 2 * cellSize;
  const geometry = new THREE.BoxGeometry(cellSize * 0.85, cellSize * 0.85, cellSize * 0.85);
  const material = new THREE.MeshLambertMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.7,
  });

  const totalCubes = gridSize * gridSize * gridSize;
  const mesh = new THREE.InstancedMesh(geometry, material, totalCubes);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Posicionamento inicial da grid
  const instances = getInstances(mesh);

  utils.set(instances, {
    x: stagger([-spread, spread], { grid: [gridSize, gridSize, gridSize], axis: 'x' }),
    y: stagger([-spread, spread], { grid: [gridSize, gridSize, gridSize], axis: 'y' }),
    z: stagger([-spread, spread], { grid: [gridSize, gridSize, gridSize], axis: 'z' }),
  });

  // Animação: rotação contínua suave de toda a malha
  animate(mesh, {
    rotateY: { to: 360, duration: 14000 },
    rotateX: { to: 360, duration: 20000 },
    loop: true,
    ease: 'linear',
  });

  // Animação: pulsação da luz
  animate(pointLight, {
    intensity: [12, 2],
    duration: 3000,
    loop: true,
    alternate: true,
    ease: 'inOutSine',
  });

  // Animação: explosão e implosão dos cubos partindo do centro
  animate(instances, {
    x: (inst) => inst.x * 8,
    y: (inst) => inst.y * 8,
    z: (inst) => inst.z * 8,
    duration: 2500,
    delay: stagger([0, 600], { grid: true, from: 'center', reversed: true, ease: 'in(3)' }),
    loop: true,
    loopDelay: 800,
    alternate: true,
    ease: 'inOutExpo',
  });

  // Animação da cor: transição suave entre tons
  animate(material, {
    color: ['#1e293b', '#0f3460', '#1e293b'],
    duration: 6000,
    loop: true,
    ease: 'inOutSine',
  });

  // Render loop
  createTimer({ onUpdate: () => renderer.render(scene, camera) });

  // Responsividade
  window.addEventListener('resize', () => {
    const { width: w, height: h } = container.getBoundingClientRect();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}
