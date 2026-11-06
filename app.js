import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { ColladaLoader }  from 'three/addons/loaders/ColladaLoader.js';
import { GLTFLoader }     from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* ═══════════════════════════════════════════════════════════════
   КОНСТАНТЫ
   ═══════════════════════════════════════════════════════════════ */
const MODEL_FILE_DEFAULT = 'model.dae';
let MODEL_FILE = null;
const UNIT_SCALE = 1.0;
const HUMAN_FILE = 'human.glb';

const TEXTURE_LIST = [
  { file: 'con_pine.bmp', name: 'Сосна' },
  { file: 'con_bok.bmp',  name: 'Бук' },
  { file: 'con_ash.bmp',  name: 'Ясень' },
  { file: 'con_oak.bmp',  name: 'Дуб' }
];

const FINISH_CATEGORIES = [
  { key: 'treads',          label: 'Ступени' },
  { key: 'risers',          label: 'Подступенки' },
  { key: 'stringers',       label: 'Тетивы' },
  { key: 'kosour',          label: 'Косоуры' },
  { key: 'welcome_steps',   label: 'Приглас. ступени' },
  { key: 'welcome_risers',  label: 'Приглас. подступенки' },
  { key: 'handrail',        label: 'Поручень' },
  { key: 'bottomrail',      label: 'Подбалясенник' },
  { key: 'baluster',        label: 'Балясины' },
  { key: 'posts',           label: 'Столбы' },
  { key: 'covering',        label: 'Панель перекрытия' }
];

/* ═══════════════════════════════════════════════════════════════
   DOM-ССЫЛКИ
   ═══════════════════════════════════════════════════════════════ */
const canvas      = document.getElementById('canvas');
const loadingEl   = document.getElementById('loading');
const loadingTxt  = document.getElementById('loadingText');
const toastEl     = document.getElementById('toast');
const infoEl      = document.getElementById('info');
const panelEl     = document.getElementById('panel');
const panelToggle = document.getElementById('panelToggle');
const fileInput   = document.getElementById('fileInput');
const progress    = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const rulerHint   = document.getElementById('rulerHint');
const humanHint   = document.getElementById('humanHint');
const heightSlider= document.getElementById('heightSlider');
const heightValue = document.getElementById('heightValue');
const rotationSlider = document.getElementById('rotationSlider');
const rotationValue  = document.getElementById('rotationValue');
const finishRows  = document.getElementById('finishRows');

const floatRuler         = document.getElementById('floatRuler');
const floatHuman         = document.getElementById('floatHuman');
const floatHeightSlider  = document.getElementById('floatHeightSlider');
const floatHeightValue   = document.getElementById('floatHeightValue');
const floatRotationSlider= document.getElementById('floatRotationSlider');
const floatRotationValue = document.getElementById('floatRotationValue');

const priceOverlay   = document.getElementById('priceModalOverlay');
const priceBody      = document.getElementById('priceModalBody');
const priceSubtitle  = document.getElementById('priceModalSubtitle');
const priceBtn       = document.getElementById('btnPrice');
const priceSummary   = document.getElementById('priceSummary');

const paramsOverlay  = document.getElementById('paramsModalOverlay');
const paramsBody     = document.getElementById('paramsModalBody');
const paramsSubtitle = document.getElementById('paramsModalSubtitle');

const orderOverlay   = document.getElementById('orderModalOverlay');
const orderBody      = document.getElementById('orderModalBody');
const orderSubtitle  = document.getElementById('orderModalSubtitle');

const drawingsOverlay = document.getElementById('drawingsModalOverlay');
const drawingsBody    = document.getElementById('drawingsModalBody');
const drawingsSubtitle = document.getElementById('drawingsModalSubtitle');

const ui = {
  file:   document.getElementById('iFile'),
  meshes: document.getElementById('iMeshes'),
  verts:  document.getElementById('iVerts'),
  tris:   document.getElementById('iTris'),
  size:   document.getElementById('iSize'),
  anims:  document.getElementById('iAnims'),
  animRow:document.getElementById('animRow'),
};

function isMobile() { return window.matchMedia('(max-width:640px)').matches; }

/* ═══════════════════════════════════════════════════════════════
   РЕНДЕРЕР / СЦЕНА / СВЕТ
   ═══════════════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

scene.background = new THREE.Color('#0f1116');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
camera.position.set(4, 3, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.rotateSpeed = 0.9;
controls.panSpeed = 0.8;
controls.zoomSpeed = 1.0;
controls.screenSpacePanning = true;
controls.autoRotateSpeed = 1.6;

controls.addEventListener('start', () => {
  if (isMobile() && panelEl.classList.contains('open')) {
    panelEl.classList.remove('open');
    panelToggle.classList.remove('active');
  }
});

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2f3a, 1.6));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(5, 9, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0006;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.DirectionalLight(0xa8c4ff, 0.9);
fillLight.position.set(-7, 4, -6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(0, -6, -4);
scene.add(rimLight);

/* ---------- Сетка ---------- */
let gridHelper = null;
let gridVisible = false;

function buildGrid(radius, yPos) {
  if (gridHelper) {
    scene.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
  }
  const size = Math.max(radius * 6, 1);
  gridHelper = new THREE.GridHelper(size, 20, 0x4a5568, 0x272c37);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.55;
  gridHelper.material.depthWrite = false;
  gridHelper.position.y = yPos;
  gridHelper.visible = gridVisible;
  scene.add(gridHelper);
}

/* ═══════════════════════════════════════════════════════════════
   СОСТОЯНИЕ
   ═══════════════════════════════════════════════════════════════ */
let currentModel = null;
let currentMixer = null;
let objectUrls   = [];
const fileMap    = new Map();

const elementGroups = {
  s1_treads: [], s1_risers: [], s1_stringers: [], s1_kosour: [],
  s1_welcome_steps: [], s1_welcome_risers: [],
  s1_handrail: [], s1_baluster: [], s1_posts: [], s1_covering: [],
  s2_treads: [], s2_risers: [], s2_stringers: [], s2_kosour: [],
  s2_welcome_steps: [], s2_welcome_risers: [],
  s2_handrail: [], s2_baluster: [], s2_posts: [], s2_covering: [],
  r2_posts: [], r2_handrail: [], r2_bottomrail: [], r2_baluster: [],
  r3_posts: [], r3_handrail: [], r3_bottomrail: [], r3_baluster: [],
  wall: [], opening: [], floor: [],
};

const elementVisible = {
  s1_treads: true, s1_risers: true, s1_stringers: true, s1_kosour: true,
  s1_welcome_steps: true, s1_welcome_risers: true,
  s1_handrail: true, s1_baluster: true, s1_posts: true, s1_covering: true,
  s2_treads: true, s2_risers: true, s2_stringers: true, s2_kosour: true,
  s2_welcome_steps: true, s2_welcome_risers: true,
  s2_handrail: true, s2_baluster: true, s2_posts: true, s2_covering: true,
  r2_posts: true, r2_handrail: true, r2_bottomrail: true, r2_baluster: true,
  r3_posts: true, r3_handrail: true, r3_bottomrail: true, r3_baluster: true,
  wall: true, opening: true, floor: true,
};

const elementIncluded = {};
for (const key in elementVisible) elementIncluded[key] = true;
const blockIncluded = {};

function blockKeyForElementKey(key) {
  if (!key) return null;
  if (key.startsWith('r')) return 'upperRailing_' + key.split('_')[0];
  if (!key.startsWith('s')) return null;
  const parts = key.split('_');
  const prefix = parts[0];
  const category = parts.slice(1).join('_');
  if (category === 'risers' || category === 'welcome_risers') return 'risers_' + prefix;
  if (category === 'covering') return 'panels_' + prefix;
  return null;
}

function isElementIncluded(key) {
  const block = blockKeyForElementKey(key);
  if (block && blockIncluded[block] === false) return false;
  return elementIncluded[key] !== false;
}

function isElementVisible(key) {
  return isElementIncluded(key) && elementVisible[key] !== false;
}

let glassWalls = true;
const WALL_OPACITY    = 0.15;
const WINDOW_OPACITY  = 0.55;

const textureCache = new Map();
const texLoader = new THREE.TextureLoader();

function getTexture(file) {
  if (textureCache.has(file)) return textureCache.get(file);
  const tex = texLoader.load(file);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(file, tex);
  return tex;
}

const originalMaterialState = new Map();

const currentFinish = {
  treads: null, risers: null, stringers: null, kosour: null,
  welcome_steps: null, welcome_risers: null,
  handrail: null, bottomrail: null, baluster: null, posts: null, covering: null,
};

const COLOR_PALETTE = [
  { key: 'clear',   name: 'Лак б/ц',        hex: '#ffffff' },
  { key: 'light',   name: 'Светлый дуб',    hex: '#e6d5b8' },
  { key: 'dark',    name: 'Тёмный орех',    hex: '#5c3a21' },
  { key: 'redwood', name: 'Красное дерево', hex: '#8b1a1a' },
  { key: 'mocha',   name: 'Мокко',          hex: '#6f4e37' },
  { key: 'wenge',   name: 'Венге',          hex: '#3b2b2b' },
  { key: 'honey',   name: 'Медовый',        hex: '#d4a373' },
  { key: 'ash',     name: 'Ясень',          hex: '#f5deb3' },
  { key: 'black',   name: 'Черный',         hex: '#1a1a1a' },
  { key: 'gray',    name: 'Серый',          hex: '#808080' },
  { key: 'white',   name: 'Белый',          hex: '#ffffff' }
];

let paintEnabled = true; 
let deliveryEnabled = true;
let deliveryKmKnown = false;
let montageEnabled = true;
let selectedBaluster = 'original';
let balusterModels = {};
let balusterManifest = [];
let balusterLoadPromise = null;

/* Пилот балясин: точёная часть из GLB + отдельные хвостовики.
   Номинальная высота рисунка 680 мм, посадка 20 мм в ступень/подбалясенник
   и 35 мм в поручень. */
const BALUSTER_NOMINAL_HEIGHT = 0.680;
const BALUSTER_EMBED_BOTTOM = 0.020;
const BALUSTER_EMBED_TOP = 0.035;
// Масштаб текстуры как у исходной балясины StairCon:
// 1.2 оборота по окружности и 0.45 метра по высоте на один повтор.
const BALUSTER_UV_AROUND = 1.2;
const BALUSTER_UV_PER_METER = 0.45;
const balusterTemplateCache = new Map();
let activeBalusterMaterial = null;

const currentColor = {
  treads: null, risers: null, stringers: null, kosour: null,
  welcome_steps: null, welcome_risers: null,
  handrail: null, bottomrail: null, baluster: null, posts: null, covering: null,
};

let bomData = null;       
let projectParams = null;
let priceData = null;
let productionPrices = null;
const PRODUCTION_PRICES_LS_KEY = 'staircon_production_prices';
let bomGroups = [];       
let bomLoadPromise = null;

const allVertices = [];

/* ═══════════════════════════════════════════════════════════════
   КЛАССИФИКАЦИЯ МАТЕРИАЛОВ
   ═══════════════════════════════════════════════════════════════ */
function classifyMaterial(str) {
  if (!str) return null;
  const n = str.toUpperCase();

  let m = n.match(/^([123])_P\d/i);
  if (m) return 'r' + m[1] + '_posts';
  m = n.match(/^([123])_HRFR/i);
  if (m) return 'r' + m[1] + '_handrail';
  m = n.match(/^([123])_BRFR/i);
  if (m) return 'r' + m[1] + '_bottomrail';
  m = n.match(/^([123])_BA\d*FR/i);
  if (m) return 'r' + m[1] + '_baluster';

  m = n.match(/^([12])_(SP|STPR|ENPR)/i);
  if (m) return 's' + m[1] + '_posts';
  m = n.match(/^([12])_ST/i);
  if (m) return 's' + m[1] + '_stringers';
  m = n.match(/^([12])_TR/i);
  if (m) return 's' + m[1] + '_treads';
  m = n.match(/^([12])_RI/i);
  if (m) return 's' + m[1] + '_risers';
  m = n.match(/^([12])_HRR/i);
  if (m) return 's' + m[1] + '_handrail';
  m = n.match(/^([12])_BA/i);
  if (m) return 's' + m[1] + '_baluster';
  m = n.match(/^([12])_FC/i);
  if (m) return 's' + m[1] + '_covering';
  m = n.match(/^([12])_POST CAP/i);
  if (m) return 's' + m[1] + '_post_caps';

  if (n.includes('TREAD'))         return 's1_treads';
  if (n.includes('RISER'))         return 's1_risers';
  if (n.includes('STRING'))        return 's1_stringers';
  if (n.includes('HANDRAIL'))      return 's1_handrail';
  if (n.includes('BOTTOMRAIL'))    return 'r2_bottomrail';
  if (n.includes('BALUSTER'))      return 's1_baluster';
  if (n.includes('POST'))          return 's1_posts';
  if (n.includes('BEGIN_WALL'))    return 'wall';
  if (n.includes('BEGIN_OPENING')) return 'opening';
  if (n.includes('PARKETT'))       return 'floor';
  if (n.includes('ASH'))           return 'floor';
  if (n.includes('OBJECT3D'))      return 'floor';
  return null;
}

function isWindowTexture(matName) {
  if (!matName) return false;
  return matName.toLowerCase().includes('window');
}

/* ═══════════════════════════════════════════════════════════════
   LoadingManager
   ═══════════════════════════════════════════════════════════════ */
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const decoded = decodeURIComponent(url).split('?')[0].split('#')[0];
  const base = decoded.split('/').pop().toLowerCase();
  if (fileMap.has(base)) return fileMap.get(base);
  if (fileMap.has(decoded.toLowerCase())) return fileMap.get(decoded.toLowerCase());
  return url;
});

/* ═══════════════════════════════════════════════════════════════
   УТИЛИТЫ
   ═══════════════════════════════════════════════════════════════ */
function showProgress(v) {
  if (v <= 0 || v >= 100) { progress.classList.remove('show'); return; }
  progress.classList.add('show');
  progressBar.style.width = v + '%';
}
function setLoading(show, text) {
  if (text) loadingTxt.textContent = text;
  loadingEl.classList.toggle('show', show);
}
let toastTimer = null;
function showToast(msg, ok = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('ok', ok);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4000);
}
const fmtInt = (n) => new Intl.NumberFormat('ru-RU').format(n);
function fmtNum(v) {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}
function formatRub(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽';
}
function disposeObject(root) {
  const textures = new Set();
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m) return;
      for (const key in m) { const v = m[key]; if (v && v.isTexture) textures.add(v); }
      m.dispose();
    });
  });
  textures.forEach(t => t.dispose());
}
function findNearestVertex(point, radius) {
  let bestDist = radius;
  let bestVert = null;
  for (let i = 0; i < allVertices.length; i++) {
    const d = point.distanceTo(allVertices[i]);
    if (d < bestDist) { bestDist = d; bestVert = allVertices[i]; }
  }
  return bestVert;
}

/* ═══════════════════════════════════════════════════════════════
   OBB / ПЛОЩАДЬ ПОВЕРХНОСТИ
   ═══════════════════════════════════════════════════════════════ */
function computeOBB(vs) {
  if (!vs || vs.length < 4) return null;
  const c = new THREE.Vector3();
  vs.forEach(v => c.add(v));
  c.divideScalar(vs.length);

  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  vs.forEach(v => {
    const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
    xx += dx * dx; xy += dx * dy; xz += dx * dz;
    yy += dy * dy; yz += dy * dz; zz += dz * dz;
  });
  const M = [xx, xy, xz, yy, yz, zz];

  function mulM(v) {
    return new THREE.Vector3(
      M[0] * v.x + M[1] * v.y + M[2] * v.z,
      M[1] * v.x + M[3] * v.y + M[4] * v.z,
      M[2] * v.x + M[4] * v.y + M[5] * v.z
    );
  }
  let v1 = new THREE.Vector3(1, 0.5, 0.3).normalize();
  for (let i = 0; i < 100; i++) {
    v1 = mulM(v1);
    if (v1.length() < 1e-12) break;
    v1.normalize();
  }
  const lam1 = v1.dot(mulM(v1));
  const M2 = [
    M[0] - lam1 * v1.x * v1.x, M[1] - lam1 * v1.x * v1.y, M[2] - lam1 * v1.x * v1.z,
    M[3] - lam1 * v1.y * v1.y, M[4] - lam1 * v1.y * v1.z,
    M[5] - lam1 * v1.z * v1.z
  ];
  function mulM2(v) {
    return new THREE.Vector3(
      M2[0] * v.x + M2[1] * v.y + M2[2] * v.z,
      M2[1] * v.x + M2[3] * v.y + M2[4] * v.z,
      M2[2] * v.x + M2[4] * v.y + M2[5] * v.z
    );
  }
  let v2 = new THREE.Vector3(0, 1, 0);
  if (Math.abs(v1.dot(v2)) > 0.9) v2.set(1, 0, 0);
  v2.sub(v1.clone().multiplyScalar(v2.dot(v1))).normalize();
  for (let i = 0; i < 100; i++) {
    v2 = mulM2(v2);
    v2.sub(v1.clone().multiplyScalar(v2.dot(v1)));
    if (v2.length() < 1e-12) break;
    v2.normalize();
  }
  const v3 = new THREE.Vector3().crossVectors(v1, v2).normalize();

  let min1 = Infinity, max1 = -Infinity;
  let min2 = Infinity, max2 = -Infinity;
  let min3 = Infinity, max3 = -Infinity;
  vs.forEach(v => {
    const d = v.clone().sub(c);
    const p1 = d.dot(v1), p2 = d.dot(v2), p3 = d.dot(v3);
    if (p1 < min1) min1 = p1; if (p1 > max1) max1 = p1;
    if (p2 < min2) min2 = p2; if (p2 > max2) max2 = p2;
    if (p3 < min3) min3 = p3; if (p3 > max3) max3 = p3;
  });
  const d1 = max1 - min1, d2 = max2 - min2, d3 = max3 - min3;
  const dims = [d1, d2, d3].sort((a, b) => b - a);
  return { area: dims[0] * dims[1], length: dims[0], volume: d1 * d2 * d3 };
}

function meshSurfaceArea(obj) {
  const geo = obj.geometry;
  if (!geo) return 0;
  const pos = geo.attributes.position;
  if (!pos) return 0;
  let total = 0;
  const idx = geo.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(pos, idx.getX(i));
      b.fromBufferAttribute(pos, idx.getX(i + 1));
      c.fromBufferAttribute(pos, idx.getX(i + 2));
      total += new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
    }
  } else {
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      total += new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() * 0.5;
    }
  }
  return total;
}

const meshAnalysisCache = new WeakMap();
function getMeshAnalysis(obj) {
  if (meshAnalysisCache.has(obj)) return meshAnalysisCache.get(obj);
  const geo = obj.geometry;
  if (!geo || !geo.attributes.position) return null;
  const pos = geo.attributes.position;
  obj.updateMatrixWorld(true);
  const vs = [];
  for (let i = 0; i < pos.count; i++) {
    vs.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld));
  }
  const obb = computeOBB(vs);
  if (!obb) { meshAnalysisCache.set(obj, null); return null; }
  const res = { obbArea: obb.area, obbLength: obb.length, obbVolume: obb.volume, surface: meshSurfaceArea(obj) };
  meshAnalysisCache.set(obj, res);
  return res;
}

/* ═══════════════════════════════════════════════════════════════
   ПАРСЕР XML (BOM + параметры)
   ═══════════════════════════════════════════════════════════════ */
function getAttr(node, name) {
  if (!node) return '';
  const attrs = node.querySelectorAll('attribute');
  for (let i = 0; i < attrs.length; i++) {
    if (attrs[i].getAttribute('name') === name) {
      return attrs[i].getAttribute('value') || '';
    }
  }
  return '';
}

function parseBOM(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const result = { items: [], params: {} };

  const q = (sel) => xml.querySelector(sel);
  const txt = (sel) => { const n = q(sel); return n ? n.textContent.trim() : null; };
  const num = (sel) => { const v = txt(sel); return v != null ? parseFloat(v) : null; };
  const textList = (sel) => {
    const v = txt(sel);
    return v ? v.split('/').map(s => s.trim()).filter(Boolean) : [];
  };
  const numList = (sel) => textList(sel)
    .map(s => parseFloat(s.replace(',', '.')))
    .filter(Number.isFinite);

  const riseList = numList('rise');
  const goingList = numList('going');
  const numRisersList = numList('numberofrisers');
  const pitchList = textList('pitch');
  const recalcGoingList = numList('recalculatedgoing');

  result.params = {
    ceiling:       num('ceiling'),
    floorheight:   num('floorheight'),
    floorthick:    num('floorthickness'),
    headroom:      num('headroom'),
    rise:          num('rise'),
    going:         num('going'),
    recalcGoing:   txt('recalculatedgoing'),
    numRisers:     num('numberofrisers'),
    widths:        num('widths'),
    pitch:         txt('pitch'),
    riseList:      riseList,
    goingList:     goingList,
    numRisersList: numRisersList,
    pitchList:     pitchList,
    recalcGoingList: recalcGoingList,
    flightCount:   Math.max(goingList.length, numRisersList.length, pitchList.length, 1),
    numRisersTotal: numRisersList.reduce((sum, n) => sum + n, 0),
    hasLanding:    false,
    landingDepth:  recalcGoingList.length >= 3 ? recalcGoingList[1] : null,
    railingHeight: txt('railing > height'),
    handrailDim:   txt('handrail > dim'),
    balusterDim:   txt('baluster > dim'),
    newelName:     txt('newel > name'),
    floorName:     txt('floor > name'),
  };

  const details = xml.querySelectorAll('detail');
  details.forEach((d) => {
    const nameAttr = d.getAttribute('name') || '';
    const typeNode = d.querySelector('type');
    const typeId = typeNode ? typeNode.getAttribute('id') : '';
    const typeExtra = typeNode ? (typeNode.getAttribute('extra') || '') : '';
    if (!typeId || typeId === 'Bolt') return;
    if (String(typeExtra).toLowerCase() === 'landing') result.params.hasLanding = true;

    const dim = d.querySelector('dim');
    if (!dim) return;

    const T = parseFloat(dim.querySelector('thickness')?.textContent) || 0;
    const W = parseFloat(dim.querySelector('width')?.textContent) || 0;
    const L = parseFloat(dim.querySelector('length')?.textContent) || 0;
    if (!L) return;

    const matNode = d.querySelector('material');
    const mat = matNode ? (matNode.textContent || '').trim() : '';

    const subtype    = getAttr(d, 'subtype');
    const stringtype = getAttr(d, 'stringtype');

    result.items.push({ name: nameAttr, type: typeId, T, W, L, mat, subtype, stringtype });
  });

  return result;
}

async function loadBOM() {
  if (bomLoadPromise) return bomLoadPromise;
  bomLoadPromise = doLoadBOM();
  return bomLoadPromise;
}

async function doLoadBOM() {
  bomGroups = [];
  let xmlFiles = [];
  try {
    const parts = location.pathname.split('/').filter(x => x);
    const owner = location.hostname.split('.')[0];
    const repo = parts[0];
    if (owner && repo) {
      const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/');
      if (r.ok) {
        const files = await r.json();
        xmlFiles = files.filter(f => f.name && f.name.toLowerCase().endsWith('.xml')).map(f => f.name);
      }
    }
  } catch (e) { console.warn('GitHub API не сработал:', e.message); }

  // Локальный запуск / GitHub Pages без API: список XML лежит в bom-manifest.json.
  if (!xmlFiles.length) {
    try {
      const r = await fetch('bom-manifest.json', { cache: 'no-store' });
      if (r.ok) {
        const manifest = await r.json();
        const files = Array.isArray(manifest) ? manifest : (manifest.files || []);
        xmlFiles = files.filter(n => typeof n === 'string' && n.toLowerCase().endsWith('.xml'));
      }
    } catch (e) { /* ignore */ }
  }

  if (!xmlFiles.length && MODEL_FILE) {
    const fallback = MODEL_FILE.replace(/\.(dae|xml)$/i, '.xml');
    try {
      const r = await fetch(fallback, { method: 'HEAD' });
      if (r.ok) xmlFiles = [fallback];
    } catch (e) { /* ignore */ }
  }

  if (!xmlFiles.length) {
    console.log('XML не найдены');
    buildConfiguratorPanel();
    return;
  }

  console.log('%c→ Найдено XML: ' + xmlFiles.length, 'color:#5b8cff;font-weight:bold');

  for (const name of xmlFiles) {
    try {
      const r = await fetch(name, { cache: 'no-store' });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      const decoder = new TextDecoder('windows-1252');
      const text = decoder.decode(buf);
      const parsed = parseBOM(text);

      let floor = 1;
      if (parsed.params && parsed.params.floorName) {
        const m = parsed.params.floorName.match(/(\d+)/);
        if (m) floor = parseInt(m[1], 10);
      }

      bomGroups.push({ file: name, floor: floor, params: parsed.params, items: parsed.items });
      console.log('%c✔ ' + name + ' (этаж ' + floor + ', ' + parsed.items.length + ' деталей)', 'color:#31d0aa;font-weight:bold');
    } catch (err) { console.warn('Ошибка чтения ' + name + ':', err.message); }
  }

  bomGroups.sort((a, b) => a.floor - b.floor);
  if (bomGroups.length) bomData = { items: bomGroups[0].items, params: bomGroups[0].params };
  buildConfiguratorPanel();
}

async function loadProjectParams() {
  try {
    const r = await fetch('project-params.json', { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      projectParams = data;
      const rawKm = data.delivery_km;
      if (rawKm !== null && rawKm !== undefined && String(rawKm).trim() !== '') {
        const km = Number(rawKm);
        if (Number.isFinite(km) && km >= 0) {
          currentKm = km;
          deliveryKmKnown = true;
        }
      }
    }
  } catch (e) { /* файла может не быть — не ошибка */ }
}

/* ═══════════════════════════════════════════════════════════════
   ВЛОЖЕННЫЙ ПРАЙС ПРОИЗВОДСТВА
   Файл — база, localStorage из админки — верхний слой.
   ═══════════════════════════════════════════════════════════════ */
function mergeProductionPrices(base, override) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) base = {};
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const next = override[key];
    if (next && typeof next === 'object' && !Array.isArray(next) &&
        out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = mergeProductionPrices(out[key], next);
    } else {
      out[key] = next;
    }
  }
  return out;
}

async function loadProductionPrices() {
  let filePrices = null;
  let localPrices = null;
  const priceUrl = window.PRODUCTION_PRICES_URL || 'production_prices.json';

  try {
    const r = await fetch(priceUrl, { cache: 'no-store' });
    if (r.ok) filePrices = await r.json();
  } catch (err) {
    console.warn('production_prices.json не загружен:', err.message);
  }

  if (!window.PRODUCTION_PRICES_URL && window.ALLOW_LOCAL_PRODUCTION_PRICES) {
    try {
      const raw = localStorage.getItem(PRODUCTION_PRICES_LS_KEY);
      if (raw) localPrices = JSON.parse(raw);
    } catch (err) {
      console.warn('Локальные настройки производства повреждены:', err.message);
    }
  }

  productionPrices = mergeProductionPrices(filePrices || {}, localPrices || {});
  if (filePrices) console.log('%c✔ production_prices.json загружен', 'color:#31d0aa;font-weight:bold');
  if (localPrices) console.log('%c✔ Настройки производства применены из localStorage', 'color:#31d0aa;font-weight:bold');
  return productionPrices;
}

/* ═══════════════════════════════════════════════════════════════
   АВТОПОИСК DAE В РЕПОЗИТОРИИ
   ═══════════════════════════════════════════════════════════════ */
async function findModelFile() {
  try {
    const r = await fetch(MODEL_FILE_DEFAULT, { method: 'HEAD' });
    if (r.ok) {
      console.log('%c✔ Найден ' + MODEL_FILE_DEFAULT, 'color:#31d0aa;font-weight:bold');
      return MODEL_FILE_DEFAULT;
    }
  } catch (e) { /* ignore */ }

  try {
    const parts = location.pathname.split('/').filter(x => x);
    const owner = location.hostname.split('.')[0];
    const repo = parts[0];
    if (!owner || !repo) throw new Error('owner/repo не определены');

    const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/');
    if (!r.ok) throw new Error('GitHub API: HTTP ' + r.status);

    const files = await r.json();
    const dae = files.find(f => f.name && f.name.toLowerCase().endsWith('.dae'));
    if (dae) {
      console.log('%c✔ Найден в репозитории: ' + dae.name, 'color:#31d0aa;font-weight:bold');
      return dae.name;
    }
  } catch (e) { console.warn('Автопоиск через API не сработал:', e.message); }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   ЗАГРУЗКА МОДЕЛИ
   ═══════════════════════════════════════════════════════════════ */
function loadCollada(url, fileName) {
  setLoading(true, 'Загрузка «' + fileName + '»…');
  showProgress(5);

  for (const k in elementGroups) elementGroups[k] = [];
  allVertices.length = 0;
  originalMaterialState.clear();
  
  const loader = new ColladaLoader(manager);
  loader.load(url,
    (collada) => {
      setLoading(false);
      showProgress(0);
      const model = collada.scene;
      if (!model) { showToast('Файл не содержит сцены'); return; }

      if (currentModel) {
        scene.remove(currentModel);
        disposeObject(currentModel);
        currentModel = null;
      }
      if (currentMixer) { currentMixer.stopAllAction(); currentMixer = null; }

      let meshCount = 0, vertCount = 0, triCount = 0;
      const seenGeom = new Set();

      model.traverse((obj) => {
        if (!obj.isMesh && !obj.isSkinnedMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;

        if (obj.geometry && !seenGeom.has(obj.geometry)) {
          seenGeom.add(obj.geometry);
          const g = obj.geometry;
          const pos = g.attributes.position;
          if (pos) vertCount += pos.count;
          triCount += g.index ? g.index.count / 3 : (pos ? pos.count / 3 : 0);
        }
        meshCount++;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (!m) return;
          ['map','emissiveMap','specularMap','normalMap','aoMap','alphaMap'].forEach((k) => {
            if (m[k] && m[k].isTexture) {
              if (k === 'map' || k === 'emissiveMap') m[k].colorSpace = THREE.SRGBColorSpace;
              m[k].anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
          });
          m.needsUpdate = true;
        });

        const matName = mats[0] && mats[0].name ? mats[0].name : '';
        const objName = obj.name || (obj.parent && obj.parent.name) || '';
        const group = classifyMaterial(objName) || classifyMaterial(matName);
        
        if (group) {
          if (!elementGroups[group]) elementGroups[group] = [];
          elementGroups[group].push(obj);
          if (group === 'wall' && isWindowTexture(matName)) obj.userData.isWindow = true;
        }

        mats.forEach((m) => {
          if (!m) return;
          originalMaterialState.set(obj.uuid, {
            map: m.map || null,
            color: m.color ? m.color.getHex() : 0xffffff
          });
        });
      });

      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (box.isEmpty()) { showToast('Модель не содержит геометрии'); return; }

      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);

      const v = new THREE.Vector3();
      const seenPos = new Set();
      model.traverse((obj) => {
        if (!obj.isMesh && !obj.isSkinnedMesh) return;
        const g = obj.geometry;
        if (!g || !g.attributes || !g.attributes.position) return;
        const pos = g.attributes.position;
        obj.updateMatrixWorld();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
          const key = v.x.toFixed(3) + '|' + v.y.toFixed(3) + '|' + v.z.toFixed(3);
          if (!seenPos.has(key)) { seenPos.add(key); allVertices.push(v.clone()); }
        }
      });

      const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
      const r = Math.max(sphere.radius, 0.0001);

      const sc = keyLight.shadow.camera;
      sc.left = -r * 1.6; sc.right = r * 1.6;
      sc.top = r * 1.6; sc.bottom = -r * 1.6;
      sc.near = r * 0.05; sc.far = r * 30;
      sc.updateProjectionMatrix();
      keyLight.position.copy(new THREE.Vector3(1, 1.7, 1).normalize().multiplyScalar(r * 6));
      keyLight.target.position.set(0, 0, 0);
      keyLight.target.updateMatrixWorld();

      buildGrid(r, -size.y / 2);

      const clips = collada.animations || [];
      if (clips.length) {
        currentMixer = new THREE.AnimationMixer(model);
        clips.forEach((clip) => {
          const a = currentMixer.clipAction(clip);
          a.setLoop(THREE.LoopRepeat, Infinity);
          a.play();
        });
      }

      currentModel = model;
      scene.add(currentModel);
      splitSharedGroupsByLevel();
      classifyBalustersByHandrail();

      applyGlassWalls();
      setHumanHeight(humanHeight);
      buildFinishPanel();
      buildBalusterPanel();
      buildColorPanel();
      applyCeilingTransparency();

      const modelName = fileName.replace(/\.(dae|xml)$/i, '');
      if (modelName) {
        const projectTitle = projectParams && projectParams.title ? projectParams.title : modelName;
        document.title = projectTitle + (window.INTERNAL_MODE ? ' — расчёт и техкарта' : ' — 3D просмотр');
        priceSubtitle.textContent = projectParams && projectParams.title
          ? projectParams.title + (projectParams.number ? ' · ' + projectParams.number : '')
          : modelName;
        paramsSubtitle.textContent = projectParams && projectParams.title
          ? projectParams.title + (projectParams.number ? ' · ' + projectParams.number : '')
          : modelName;
        orderSubtitle.textContent = modelName;
      }

      ui.file.textContent   = fileName;
      ui.meshes.textContent = fmtInt(meshCount);
      ui.verts.textContent  = fmtInt(Math.round(vertCount));
      ui.tris.textContent   = fmtInt(Math.round(triCount));
      ui.size.textContent   = fmtNum(size.x) + ' × ' + fmtNum(size.y) + ' × ' + fmtNum(size.z);

      if (clips.length) {
        ui.animRow.style.display = 'flex';
        ui.anims.textContent = fmtInt(clips.length);
      } else {
        ui.animRow.style.display = 'none';
      }

      infoEl.classList.add('show');
      panelEl.classList.remove('hidden');
      fitCamera();
      applyUrlState();

      priceBtn.style.display = 'inline-flex';
      document.getElementById('btnOrder').style.display = 'inline-flex';
      updatePriceSummary();
    },
    (evt) => {
      if (evt && evt.total) {
        const p = Math.round((evt.loaded / evt.total) * 100);
        showProgress(p);
        setLoading(true, 'Загрузка… ' + p + '%');
      }
    },
    (err) => {
      setLoading(false);
      showProgress(0);
      console.error(err);
      showToast('Ошибка загрузки. Проверьте, что это корректный .dae');
    }
  );
}

/* ═══════════════════════════════════════════════════════════════
   РЕСАЙЗ И ЦИКЛ РЕНДЕРА
   ═══════════════════════════════════════════════════════════════ */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (currentMixer) currentMixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

resize();
animate();

/* ═══════════════════════════════════════════════════════════════
   ФИТ КАМЕРЫ
   ═══════════════════════════════════════════════════════════════ */
function getModelFocusBox() {
  const box = new THREE.Box3();
  let hasGeometry = false;

  for (const key in elementGroups) {
    if (!/^[sr]\d+_/.test(key) || key.endsWith('_covering')) continue;
    for (const obj of elementGroups[key]) {
      if (!obj || obj.visible === false) continue;
      const objBox = new THREE.Box3().setFromObject(obj);
      if (objBox.isEmpty()) continue;
      box.union(objBox);
      hasGeometry = true;
    }
  }

  if (!hasGeometry && currentModel) {
    return new THREE.Box3().setFromObject(currentModel);
  }
  return box;
}

function centerCameraTarget() {
  if (!currentModel) return;
  const box = getModelFocusBox();
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  controls.target.copy(sphere.center);
  controls.update();
}

function fitCamera() {
  if (!currentModel) return;
  const box = getModelFocusBox();
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.0001);
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const zoomFactor = isMobile() ? 0.78 : 1.18;
  const dist = (radius / Math.sin(fovRad / 2)) * zoomFactor;
  const dir = new THREE.Vector3(1, 0.62, 1).normalize();
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.near = Math.max(radius / 500, 0.001);
  camera.far = radius * 800;
  camera.updateProjectionMatrix();
  controls.target.copy(sphere.center);
  controls.minDistance = radius * 0.05;
  controls.maxDistance = radius * 60;
  controls.update();
}

/* Потолок/перекрытие всегда полупрозрачный: форму видно, но он не закрывает лестницу. */
function applyCeilingTransparency() {
  const makeTransparent = (obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const cloned = mats.map((m) => (m ? m.clone() : m));
    obj.material = Array.isArray(obj.material) ? cloned : cloned[0];
    cloned.forEach((m) => {
      if (!m) return;
      m.transparent = true;
      m.opacity = 0.25;
      m.depthWrite = false;
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    });
    obj.castShadow = false;
    obj.receiveShadow = false;
  };

  for (const key in elementGroups) {
    if (!(key.endsWith('_covering') || key === 'opening')) continue;
    (elementGroups[key] || []).forEach(makeTransparent);
  }

  /* Верхняя белая плоскость в группе floor — это потолок. */
  const floorMeshes = elementGroups.floor || [];
  if (!floorMeshes.length) return;
  let topY = -Infinity;
  const boxes = floorMeshes.map((obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.max.y > topY) topY = box.max.y;
    return { obj, box };
  });
  boxes.forEach(({ obj, box }) => {
    if (box.max.y < topY - 0.25) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const isWhite = mats.some((m) => {
      if (!m || m.map || !m.color) return false;
      const hex = m.color.getHex();
      return hex === 0xe6e6e6 || hex === 0xffffff;
    });
    if (isWhite) makeTransparent(obj);
  });
}

/* ═══════════════════════════════════════════════════════════════
   ЛИНЕЙКА
   ═══════════════════════════════════════════════════════════════ */
let rulerMode = false;
let rulerPoints = [];
const rulerGroup = new THREE.Group();
scene.add(rulerGroup);

const rulerLineMat = new THREE.LineBasicMaterial({ color: 0xff7043 });
const rulerDotMat  = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
const rulerDotGeo  = new THREE.SphereGeometry(0.03, 12, 12);

const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

const snapDotGeo = new THREE.SphereGeometry(0.05, 16, 16);
const snapDotMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85 });
const snapDot = new THREE.Mesh(snapDotGeo, snapDotMat);
snapDot.visible = false;
snapDot.renderOrder = 1000;
scene.add(snapDot);

const SNAP_RADIUS = 0.05;

function setRulerMode(on) {
  rulerMode = on;
  document.getElementById('btnRuler').classList.toggle('ruler-on', on);
  canvas.classList.toggle('ruler-mode', on);
  rulerHint.classList.toggle('show', on);
  floatRuler.classList.toggle('show', on);
  if (on && humanMode) setHumanMode(false);
  if (!on) {
    if (rulerPoints.length === 1) rulerPoints = [];
    snapDot.visible = false;
  }
}

function clearRuler() {
  rulerPoints = [];
  while (rulerGroup.children.length) {
    const c = rulerGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (c.material.map) c.material.map.dispose();
      c.material.dispose();
    }
  }
}

function makeLabelSprite(text) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const dpr = 2, W = 240, H = 70;
  c.width = W * dpr; c.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = 'rgba(20, 22, 30, 0.92)';
  ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 2;
  const r = 14;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r); ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H); ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r); ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9f43';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.7, 0.2, 1);
  return sprite;
}

function addMeasurePoint(point) {
  const dot = new THREE.Mesh(rulerDotGeo, rulerDotMat);
  dot.position.copy(point);
  dot.renderOrder = 999;
  rulerGroup.add(dot);
}

function addMeasureLine(p1, p2) {
  const geo = new THREE.BufferGeometry().setFromPoints([p1.clone(), p2.clone()]);
  const line = new THREE.Line(geo, rulerLineMat);
  line.renderOrder = 998;
  rulerGroup.add(line);
}

function formatDistance(distance) {
  return (distance * UNIT_SCALE * 1000).toFixed(0) + ' мм';
}

function handleRulerTap(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!currentModel) return;
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) return;
  let point = hits[0].point.clone();
  const nearVert = findNearestVertex(point, SNAP_RADIUS);
  if (nearVert) point = nearVert.clone();
  rulerPoints.push(point);
  addMeasurePoint(point);
  if (rulerPoints.length === 2) {
    const p1 = rulerPoints[0], p2 = rulerPoints[1];
    addMeasureLine(p1, p2);
    const dist = p1.distanceTo(p2);
    const sprite = makeLabelSprite(formatDistance(dist));
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    sprite.position.copy(mid);
    rulerGroup.add(sprite);
    rulerPoints = [];
  }
}

function handleRulerHover(clientX, clientY) {
  if (!rulerMode || !currentModel) { snapDot.visible = false; return; }
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) { snapDot.visible = false; return; }
  const point = hits[0].point.clone();
  const nearVert = findNearestVertex(point, SNAP_RADIUS);
  if (nearVert) {
    snapDot.position.copy(nearVert);
    snapDot.visible = true;
    snapDotMat.color.setHex(0xffd166);
    snapDotMat.opacity = 0.85;
  } else {
    snapDot.position.copy(point);
    snapDot.visible = true;
    snapDotMat.color.setHex(0xffffff);
    snapDotMat.opacity = 0.4;
  }
}

/* ═══════════════════════════════════════════════════════════════
   ЧЕЛОВЕЧЕК
   ═══════════════════════════════════════════════════════════════ */
let humanMode = false;
let humanHeight = 185;
let humanRotation = 0;
const humanGroup = new THREE.Group();
humanGroup.visible = false;
scene.add(humanGroup);

let humanTemplate = null;
let humanTemplateHeight = 1.8;
let pendingHumanState = null;

const humanLoader = new GLTFLoader();
/* ---------- Загрузка 5 моделей балясин ---------- */
const balusterLoader = new GLTFLoader();
for (let i = 1; i <= 5; i++) {
  balusterLoader.load('baluster_' + i + '.glb', (gltf) => {
    balusterModels[i] = gltf.scene;
    console.log('%c✔ Загружена baluster_' + i + '.glb', 'color:#31d0aa');
  }, undefined, (err) => console.warn('Ошибка загрузки baluster_' + i + '.glb:', err));
}
humanLoader.load(HUMAN_FILE, (gltf) => {
  humanTemplate = gltf.scene;
  const box = new THREE.Box3().setFromObject(humanTemplate);
  const size = box.getSize(new THREE.Vector3());
  humanTemplateHeight = size.y > 0.001 ? size.y : 1.8;

  humanTemplate.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true; obj.receiveShadow = true;
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.color) m.color.setHex(0xff9f43);
          m.emissive = new THREE.Color(0x3d2408);
          m.emissiveIntensity = 0.15;
          m.needsUpdate = true;
        });
      }
    }
  });
  console.log('%c✔ ' + HUMAN_FILE + ' загружен', 'color:#31d0aa;font-weight:bold');
  // Сразу собираем человечка, чтобы высотная метка была доступна до первого клика.
  makeHumanFigure(humanHeight);
  applyPendingHuman();
}, undefined, (err) => { console.warn('human.glb не загружен:', err); });

function setHumanHeight(cm) {
  humanHeight = cm;
  heightValue.textContent = cm + ' см';
  if (floatHeightValue) floatHeightValue.textContent = cm + ' см';
  makeHumanFigure(cm);
}

function makeHumanFigure(heightCm) {
  while (humanGroup.children.length) {
    const c = humanGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
  }
  const targetH = (heightCm / 100) * UNIT_SCALE;
  if (!humanTemplate) {
    const tempMat = new THREE.MeshStandardMaterial({ color: 0xff9f43, roughness: 0.5 });
    const tempGeo = new THREE.CylinderGeometry(targetH * 0.08, targetH * 0.08, targetH, 12);
    const tempMesh = new THREE.Mesh(tempGeo, tempMat);
    tempMesh.position.y = targetH / 2;
    tempMesh.castShadow = true;
    humanGroup.add(tempMesh);
    humanGroup.userData.topY = targetH;
    return;
  }
  const clone = humanTemplate.clone(true);
  const scale = targetH / humanTemplateHeight;
  clone.scale.setScalar(scale);
  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  clone.position.y = -box.min.y;
  clone.traverse((obj) => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });
  humanGroup.add(clone);
  humanGroup.add(makeHeightLabel(heightCm, targetH));
  humanGroup.userData.topY = targetH;
  humanGroup.rotation.y = (humanRotation * Math.PI) / 180;
}

function makeHeightLabel(text, yPos) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const dpr = 2, W = 200, H = 60;
  c.width = W * dpr; c.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = 'rgba(20, 22, 30, 0.92)';
  ctx.strokeStyle = '#31d0aa'; ctx.lineWidth = 2;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(W - r, 0);
  ctx.quadraticCurveTo(W, 0, W, r); ctx.lineTo(W, H - r);
  ctx.quadraticCurveTo(W, H, W - r, H); ctx.lineTo(r, H);
  ctx.quadraticCurveTo(0, H, 0, H - r); ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4be0bc';
  ctx.font = '700 26px Inter, Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text + ' см', W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, yPos + 0.15, 0);
  sprite.scale.set(0.55, 0.165, 1);
  // Имя нужно, чтобы по клику понимать: попали в высотную метку или в модель.
  sprite.name = 'humanHeightLabel';
  return sprite;
}

function setHumanMode(on) {
  humanMode = on;
  document.getElementById('btnHuman').classList.toggle('human-on', on);
  canvas.classList.toggle('human-mode', on);
  humanHint.classList.toggle('show', on);
  if (on && rulerMode) setRulerMode(false);
  floatHuman.classList.toggle('show', on && humanGroup.visible);

  // На телефоне панель закрываем, чтобы она не перекрывала место установки.
  if (on && isMobile()) {
    panelEl.classList.remove('open');
    panelToggle.classList.remove('active');
  }
}

function placeHuman(clientX, clientY) {
  if (!currentModel) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(currentModel, true);
  if (!hits.length) return;

  // Пересобираем человечка, чтобы высотная метка точно соответствовала текущему росту.
  makeHumanFigure(humanHeight);

  humanGroup.position.copy(hits[0].point.clone());
  humanGroup.visible = true;
  floatHuman.classList.add('show');
}

function parseVec3(value) {
  if (!value) return null;
  const parts = String(value).split(',').map(Number);
  if (parts.length !== 3 || parts.some((v) => !isFinite(v))) return null;
  return new THREE.Vector3(parts[0], parts[1], parts[2]);
}

function applyPendingHuman() {
  if (!pendingHumanState) return;
  humanHeight = pendingHumanState.height;
  humanRotation = pendingHumanState.rotation;
  makeHumanFigure(humanHeight);
  humanGroup.position.copy(pendingHumanState.position);
  humanGroup.rotation.y = (humanRotation * Math.PI) / 180;
  humanGroup.visible = true;
  if (typeof syncHumanHeightUI === 'function') syncHumanHeightUI(humanHeight);
  if (typeof syncHumanRotationUI === 'function') syncHumanRotationUI(humanRotation);
  setHumanMode(false);
}

function applyUrlState() {
  const params = new URLSearchParams(location.search);
  const cam = parseVec3(params.get('cam'));
  const target = parseVec3(params.get('target'));
  if (cam && target) {
    camera.position.copy(cam);
    controls.target.copy(target);
    controls.update();
  }

  const human = parseVec3(params.get('human'));
  if (human) {
    pendingHumanState = {
      position: human,
      height: Math.max(100, Math.min(250, parseInt(params.get('humanH'), 10) || humanHeight)),
      rotation: parseInt(params.get('humanR'), 10) || 0
    };
    if (humanTemplate) applyPendingHuman();
  }
}

function buildShareUrl() {
  const params = new URLSearchParams(location.search);
  params.set('cam', camera.position.x.toFixed(3) + ',' + camera.position.y.toFixed(3) + ',' + camera.position.z.toFixed(3));
  params.set('target', controls.target.x.toFixed(3) + ',' + controls.target.y.toFixed(3) + ',' + controls.target.z.toFixed(3));
  if (humanGroup.visible) {
    params.set('human', humanGroup.position.x.toFixed(3) + ',' + humanGroup.position.y.toFixed(3) + ',' + humanGroup.position.z.toFixed(3));
    params.set('humanH', String(humanHeight));
    params.set('humanR', String(humanRotation));
  } else {
    params.delete('human');
    params.delete('humanH');
    params.delete('humanR');
  }
  return location.origin + location.pathname + '?' + params.toString();
}

/* ---------- Указатель ---------- */
let pointerDown = false;
let downX = 0, downY = 0;

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  downX = e.clientX;
  downY = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  pointerDown = false;
  const dx = Math.abs(e.clientX - downX);
  const dy = Math.abs(e.clientY - downY);
  if (dx < 6 && dy < 6) {
    // Клик по высотной метке показывает плашку человечка и не переставляет его.
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (humanGroup.visible) {
      const labelHits = raycaster.intersectObjects(humanGroup.children, true);
      const clickedLabel = labelHits.find(hit => hit.object.name === 'humanHeightLabel' || (hit.object.parent && hit.object.parent.name === 'humanHeightLabel'));
      if (clickedLabel) {
        floatHuman.classList.add('show');
        return;
      }
    }

    if (rulerMode) handleRulerTap(e.clientX, e.clientY);
    else if (humanMode) placeHuman(e.clientX, e.clientY);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (rulerMode) handleRulerHover(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => { snapDot.visible = false; });

/* ═══════════════════════════════════════════════════════════════
   ПАНЕЛЬ + АККОРДЕОНЫ
   ═══════════════════════════════════════════════════════════════ */
if (isMobile()) {
  panelEl.classList.remove('hidden');
  panelEl.classList.remove('open');
} else {
  panelEl.classList.remove('hidden');
}

panelToggle.addEventListener('click', () => {
  const isOpen = panelEl.classList.toggle('open');
  panelToggle.classList.toggle('active', isOpen);
});

function reorderPanelLayout() {
  const accBody = document.querySelector('#accView .acc-body');
  if (!accBody) return;
  for (const id of ['accWood', 'accBaluster', 'accPaint']) {
    const el = document.getElementById(id);
    if (el) accBody.appendChild(el);
  }
  const params = document.getElementById('btnParams');
  const tools = document.getElementById('accTools');
  if (params && tools && params.parentElement) {
    params.parentElement.insertBefore(tools, params.nextSibling);
  }
  const savePos = document.getElementById('btnSavePos');
  const reset = document.getElementById('btnReset');
  if (savePos && reset && savePos.parentElement) {
    savePos.parentElement.insertBefore(reset, savePos.nextSibling);
  }
}
reorderPanelLayout();

document.querySelectorAll('.acc-header').forEach((h) => {
  h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
});

function montageMeshMinY(obj) {
  try {
    obj.updateWorldMatrix(true, false);
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    if (!bb) return null;
    let minY = Infinity;
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          const v = new THREE.Vector3(x, y, z);
          obj.localToWorld(v);
          if (v.y < minY) minY = v.y;
        }
      }
    }
    return minY;
  } catch {
    return null;
  }
}

function montageMeshCenterXZ(obj) {
  try {
    obj.updateWorldMatrix(true, false);
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    if (!bb) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          const v = new THREE.Vector3(x, y, z);
          obj.localToWorld(v);
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }
      }
    }
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, minY, maxY };
  } catch {
    return null;
  }
}

function montageMeshBounds(obj) {
  try {
    obj.updateWorldMatrix(true, false);
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox;
    if (!bb) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          const v = new THREE.Vector3(x, y, z);
          obj.localToWorld(v);
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }
      }
    }
    return {
      minX, maxX, minY, maxY, minZ, maxZ,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      cz: (minZ + maxZ) / 2
    };
  } catch {
    return null;
  }
}

/* DAE не содержит этажей в именах мешей: все столбы/поручни/балясины
   попадают в s1_*. Разделяем их по высоте: элементы, начинающиеся
   на уровне ограждения этажа, переносим в rN_*. */
function splitSharedGroupsByLevel() {
  const levels = [];
  for (const key in elementGroups) {
    const match = key.match(/^r(\d+)_(bottomrail|handrail|posts|baluster)$/);
    if (!match) continue;
    const arr = elementGroups[key] || [];
    if (!arr.length) continue;
    const ys = arr.map(montageMeshMinY).filter(Number.isFinite);
    if (!ys.length) continue;
    levels.push({ floor: Number(match[1]), y: Math.min(...ys) });
  }
  if (!levels.length) return;
  levels.sort((a, b) => a.y - b.y);

  for (const level of levels) {
    const sourceFloor = level.floor - 1;
    if (sourceFloor < 1) continue;
    for (const cat of ['posts', 'handrail', 'baluster']) {
      const sourceKey = 's' + sourceFloor + '_' + cat;
      const source = elementGroups[sourceKey];
      if (!source || !source.length) continue;
      const remaining = [];
      for (const obj of source) {
        const y = montageMeshMinY(obj);
        if (y == null) { remaining.push(obj); continue; }
        if (y >= level.y - 0.1 && level.floor > sourceFloor) {
          const targetKey = 'r' + level.floor + '_' + cat;
          if (!elementGroups[targetKey]) elementGroups[targetKey] = [];
          elementGroups[targetKey].push(obj);
        } else {
          remaining.push(obj);
        }
      }
      elementGroups[sourceKey] = remaining;
    }
  }

  /* Части одной балясины могут быть отдельными мешами. Если один меш
     уже отнесён к ограждению этажа, переносим и совпадающие с ним
     по X/Z части. Иначе при скрытии ограждения остаётся «лишняя»
     половина балясины на марше. */
  for (const level of levels) {
    const sourceFloor = level.floor - 1;
    if (sourceFloor < 1) continue;
    const sourceKey = 's' + sourceFloor + '_baluster';
    const targetKey = 'r' + level.floor + '_baluster';
    const source = elementGroups[sourceKey];
    const target = elementGroups[targetKey];
    if (!source || !source.length || !target || !target.length) continue;

    const targetBoxes = target.map(montageMeshCenterXZ).filter(Boolean);
    if (!targetBoxes.length) continue;

    const remaining = [];
    for (const obj of source) {
      const box = montageMeshCenterXZ(obj);
      const paired = box && targetBoxes.some((t) =>
        Math.hypot(t.x - box.x, t.z - box.z) <= 0.05 &&
        box.maxY >= t.minY - 0.1 &&
        box.minY <= t.maxY + 0.1
      );
      if (paired) target.push(obj);
      else remaining.push(obj);
    }
    elementGroups[sourceKey] = remaining;
  }
}

/* Правило клиента: балясина относится к тому ограждению, с поручнем
   которого она сопрягается. Наклонный поручень — лестница (s*),
   горизонтальный — ограждение этажа (r*). Высота балясины не важна. */
function classifyBalustersByHandrail() {
  const handrails = [];
  for (const key in elementGroups) {
    if (!key.endsWith('_handrail')) continue;
    for (const obj of elementGroups[key] || []) {
      const b = montageMeshBounds(obj);
      if (!b) continue;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      if (span < 0.25) continue;
      handrails.push({ key, b, dx: b.maxX - b.minX, dz: b.maxZ - b.minZ });
    }
  }
  if (!handrails.length) return;

  const balusters = [];
  for (const key in elementGroups) {
    if (!key.endsWith('_baluster')) continue;
    for (const obj of elementGroups[key] || []) {
      const b = montageMeshBounds(obj);
      if (!b) continue;
      const verts = obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position
        ? obj.geometry.attributes.position.count
        : 0;
      balusters.push({ key, obj, b, verts });
    }
  }
  if (!balusters.length) return;

  /* Точёная часть и хвостовик одной балясины — отдельные меши.
     Объединяем их в кластер по X/Z и классифицируем по детальной части. */
  const clusters = [];
  for (const item of balusters) {
    let cluster = clusters.find((c) =>
      Math.hypot(c.cx - item.b.cx, c.cz - item.b.cz) <= 0.06 &&
      Math.abs(c.cy - item.b.cy) <= 0.3
    );
    if (!cluster) {
      cluster = { cx: item.b.cx, cz: item.b.cz, cy: item.b.cy, items: [] };
      clusters.push(cluster);
    }
    cluster.items.push(item);
  }

  for (const key in elementGroups) {
    if (key.endsWith('_baluster')) elementGroups[key] = [];
  }

  for (const cluster of clusters) {
    const rep = cluster.items.reduce((a, b) => a.verts >= b.verts ? a : b);
    let best = null;
    for (const h of handrails) {
      const dx = Math.max(h.b.minX - rep.b.cx, 0, rep.b.cx - h.b.maxX);
      const dz = Math.max(h.b.minZ - rep.b.cz, 0, rep.b.cz - h.b.maxZ);
      const dist = Math.hypot(dx, dz);
      if (dist > 0.08) continue;

      const useX = h.dx >= h.dz;
      const t = useX
        ? (rep.b.cx - h.b.minX) / Math.max(h.dx, 1e-6)
        : (rep.b.cz - h.b.minZ) / Math.max(h.dz, 1e-6);
      const railY = h.b.minY + Math.max(0, Math.min(1, t)) * (h.b.maxY - h.b.minY);
      const gap = railY - rep.b.maxY;
      if (gap < -0.15 || gap > 0.45) continue;
      const score = gap + dist * 0.5;
      if (!best || score < best.score) best = { key: h.key, score };
    }

    if (!best) {
      for (const item of cluster.items) {
        if (!elementGroups[item.key]) elementGroups[item.key] = [];
        elementGroups[item.key].push(item.obj);
      }
      continue;
    }

    const targetKey = best.key.replace('_handrail', '_baluster');
    if (!elementGroups[targetKey]) elementGroups[targetKey] = [];
    for (const item of cluster.items) elementGroups[targetKey].push(item.obj);
  }
}

function applyElementVisibility() {
  const replacing = selectedBaluster !== 'original';

  for (const key in elementGroups) {
    const visible = isElementVisible(key);
    const isBalusterGroup = key.endsWith('_baluster');
    elementGroups[key].forEach((obj) => {
      // В режиме замены исходные балясины (и точёные части, и хвостовики)
      // всегда скрыты — иначе появляется вторая балясина.
      obj.visible = (replacing && isBalusterGroup) ? false : visible;
    });
  }

  replacedBalustersGroup.children.forEach((obj) => {
    obj.visible = replacing && isElementVisible(obj.userData.groupKey);
  });
}

function applyGlassWalls() {
  elementGroups.wall.forEach((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const isWin = obj.userData.isWindow;
    mats.forEach((m) => {
      if (!m) return;
      if (glassWalls) {
        m.transparent = true;
        m.opacity = isWin ? WINDOW_OPACITY : WALL_OPACITY;
        m.depthWrite = false;
      } else {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    });
  });
  updatePriceSummary();
}

const CATEGORY_META = {
  treads: { icon: '🪵', label: 'Ступени' },
  risers: { icon: '📐', label: 'Подступенки' },
  stringers: { icon: '🏗', label: 'Тетивы' },
  kosour: { icon: '📏', label: 'Косоуры' },
  welcome_steps: { icon: '🌀', label: 'Пригласительные ступени' },
  welcome_risers: { icon: '🌀', label: 'Пригласительные подступенки' },
  handrail: { icon: '➖', label: 'Поручень' },
  bottomrail: { icon: '🪵', label: 'Подбалясенник' },
  baluster: { icon: '🪜', label: 'Балясины' },
  posts: { icon: '🏛', label: 'Столбы' },
  covering: { icon: '📏', label: 'Панели проёма' },
};
const RAILING_CATEGORIES = ['posts', 'handrail', 'bottomrail', 'baluster'];

function createOrderButton(id, keys, icon, label) {
  const btn = document.createElement('button');
  const active = keys.every((key) => elementIncluded[key] !== false);
  btn.className = 'btn' + (active ? ' active' : '');
  btn.id = id;
  btn.dataset.elementButton = '1';
  btn.innerHTML = '<span class="ico">' + icon + '</span> ' + label;
  btn.addEventListener('click', () => {
    const next = !keys.every((key) => elementIncluded[key] !== false);
    keys.forEach((key) => {
      elementIncluded[key] = next;
      elementVisible[key] = next;
    });
    btn.classList.toggle('active', next);
    applyElementVisibility();
    if (typeof updatePriceSummary === 'function') updatePriceSummary();
  });
  return btn;
}

function createVisualButton(id, keys, icon, label) {
  const list = Array.isArray(keys) ? keys : [keys];
  const btn = document.createElement('button');
  const active = list.every((key) => elementVisible[key] !== false);
  btn.className = 'btn' + (active ? ' active' : '');
  btn.id = id;
  btn.innerHTML = '<span class="ico">' + icon + '</span> ' + label;
  btn.addEventListener('click', () => {
    const next = !list.every((key) => elementVisible[key] !== false);
    list.forEach((key) => { elementVisible[key] = next; });
    btn.classList.toggle('active', next);
    applyElementVisibility();
  });
  return btn;
}

function addRows(container, entries) {
  for (let i = 0; i < entries.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'row';
    entries.slice(i, i + 2).forEach((entry) => row.appendChild(entry));
    container.appendChild(row);
  }
}

function addMasterBlock(container, title, blockKey, detailEntries) {
  const block = document.createElement('div');
  block.className = 'view-group config-block';

  const master = document.createElement('button');
  const included = blockIncluded[blockKey] !== false;
  master.className = 'btn config-master' + (included ? ' active' : '');
  master.dataset.masterBlock = blockKey;
  master.innerHTML = '<span class="ico">' + (included ? '✓' : '○') + '</span> ' + title;
  block.appendChild(master);

  let details = null;
  if (detailEntries.length) {
    details = document.createElement('div');
    details.className = 'config-details';
    details.style.display = included ? '' : 'none';
    addRows(details, detailEntries);
    block.appendChild(details);
  }

  master.addEventListener('click', () => {
    const next = blockIncluded[blockKey] === false;
    blockIncluded[blockKey] = next;
    master.classList.toggle('active', next);
    master.querySelector('.ico').textContent = next ? '✓' : '○';
    if (details) details.style.display = next ? '' : 'none';
    applyElementVisibility();
    if (typeof updatePriceSummary === 'function') updatePriceSummary();
  });

  container.appendChild(block);
}

function buildConfiguratorPanel() {
  const accBody = document.querySelector('#accView .acc-body');
  if (!accBody) return;

  Array.from(accBody.children).forEach((child) => {
    if (child.classList.contains('view-group') || child.classList.contains('btn')) child.remove();
  });

  let container = document.getElementById('configuratorGroups');
  if (!container) {
    container = document.createElement('div');
    container.id = 'configuratorGroups';
    accBody.appendChild(container);
  }
  if (accBody.firstElementChild !== container) accBody.insertBefore(container, accBody.firstElementChild);
  container.innerHTML = '';

  if (!bomGroups || !bomGroups.length) {
    const note = document.createElement('div');
    note.className = 'panel-note';
    note.textContent = 'XML не загружен — группы элементов появятся после загрузки.';
    container.appendChild(note);
  } else {
    bomGroups.forEach((group) => {
      const classified = classifyBOMItems(group.items, group.floor);
      const floorPrefix = 's' + group.floor;
      const railPrefix = 'r' + (group.floor + 1);

      const stairGroup = document.createElement('div');
      stairGroup.className = 'view-group';
      const stairTitle = document.createElement('div');
      stairTitle.className = 'view-group-title';
      stairTitle.textContent = 'Лестница ' + group.floor + '→' + (group.floor + 1);
      stairGroup.appendChild(stairTitle);

      const riserKeys = [];
      if ((classified.stair.risers || []).length) riserKeys.push(floorPrefix + '_risers');
      if ((classified.stair.welcome_risers || []).length) riserKeys.push(floorPrefix + '_welcome_risers');
      if (riserKeys.length) {
        addMasterBlock(stairGroup, 'Подступенки', 'risers_' + floorPrefix, []);
      }

      const coveringKeys = [];
      if ((classified.stair.covering || []).length) coveringKeys.push(floorPrefix + '_covering');
      if (coveringKeys.length) {
        addMasterBlock(stairGroup, 'Панели проёма', 'panels_' + floorPrefix, []);
      }

      const visualEntries = [];
      if ((classified.stair.treads || []).length) {
        visualEntries.push(createVisualButton(
          'el_' + floorPrefix + '_treads',
          [floorPrefix + '_treads'],
          CATEGORY_META.treads.icon,
          CATEGORY_META.treads.label
        ));
      }
      if ((classified.stair.welcome_steps || []).length) {
        visualEntries.push(createVisualButton(
          'el_' + floorPrefix + '_welcome_steps',
          [floorPrefix + '_welcome_steps'],
          CATEGORY_META.welcome_steps.icon,
          CATEGORY_META.welcome_steps.label
        ));
      }
      const stringerKeys = [];
      if ((classified.stair.stringers || []).length) stringerKeys.push(floorPrefix + '_stringers');
      if ((classified.stair.kosour || []).length) stringerKeys.push(floorPrefix + '_kosour');
      if (stringerKeys.length) {
        const label = stringerKeys.length === 2
          ? 'Тетивы/косоуры'
          : (stringerKeys[0].endsWith('_stringers') ? 'Тетивы' : 'Косоуры');
        visualEntries.push(createVisualButton(
          'el_' + floorPrefix + '_stringers_kosour',
          stringerKeys,
          '🏗',
          label
        ));
      }
      if ((classified.stair.handrail || []).length) {
        visualEntries.push(createVisualButton(
          'el_' + floorPrefix + '_handrail',
          [floorPrefix + '_handrail'],
          CATEGORY_META.handrail.icon,
          CATEGORY_META.handrail.label
        ));
      }
      if ((classified.stair.baluster || []).length) {
        visualEntries.push(createVisualButton(
          'el_' + floorPrefix + '_baluster',
          [floorPrefix + '_baluster'],
          CATEGORY_META.baluster.icon,
          CATEGORY_META.baluster.label
        ));
      }
      if (visualEntries.length) {
        const subtitle = document.createElement('div');
        subtitle.className = 'config-subtitle';
        subtitle.textContent = 'Показ (не влияет на заказ)';
        stairGroup.appendChild(subtitle);
        const visual = document.createElement('div');
        visual.className = 'config-details config-details-open';
        addRows(visual, visualEntries);
        stairGroup.appendChild(visual);
      }

      if ((classified.stair.posts || []).length) {
        const note = document.createElement('div');
        note.className = 'config-note';
        note.textContent = 'Столбы лестницы — несущие, остаются в заказе.';
        stairGroup.appendChild(note);
      }

      container.appendChild(stairGroup);

      const hasRailing = RAILING_CATEGORIES.some((key) => (classified.railing[key] || []).length);
      if (hasRailing) {
        addMasterBlock(
          container,
          'Ограждение ' + (group.floor + 1) + ' этажа',
          'upperRailing_' + railPrefix,
          []
        );
      }
    });
  }

  const visualEntries = [
    createVisualButton('el_wall', ['wall'], '🧱', 'Стена'),
    createVisualButton('el_opening', ['opening'], '🪟', 'Проём'),
    createVisualButton('el_floor', ['floor'], '🌳', 'Пол'),
  ];
  const visualGroup = document.createElement('div');
  visualGroup.className = 'view-group';
  const visualTitle = document.createElement('div');
  visualTitle.className = 'view-group-title';
  visualTitle.textContent = 'Показ помещения';
  visualGroup.appendChild(visualTitle);
  addRows(visualGroup, visualEntries);

  const glassRow = document.createElement('div');
  glassRow.className = 'row';
  const glassBtn = document.createElement('button');
  glassBtn.className = 'btn' + (glassWalls ? ' active' : '');
  glassBtn.id = 'btnGlass';
  glassBtn.innerHTML = '<span class="ico">◇</span> Стекло';
  glassBtn.addEventListener('click', () => {
    glassWalls = !glassWalls;
    glassBtn.classList.toggle('active', glassWalls);
    applyGlassWalls();
  });
  glassRow.appendChild(glassBtn);
  visualGroup.appendChild(glassRow);
  container.appendChild(visualGroup);
}

function getExcludedSummary() {
  const labels = new Set();

  for (const block in blockIncluded) {
    if (blockIncluded[block] !== false) continue;
    if (block.startsWith('risers_')) labels.add('Подступенки');
    else if (block.startsWith('panels_')) labels.add('Панели проёма');
    else if (block.startsWith('upperRailing_')) {
      const match = block.match(/_r(\d+)$/);
      labels.add('Ограждение ' + (match ? match[1] : 'верхнего') + ' этажа');
    }
  }

  for (const key in elementIncluded) {
    if (elementIncluded[key] !== false) continue;
    const block = blockKeyForElementKey(key);
    if (block && blockIncluded[block] === false) continue;
    const category = key.replace(/^[sr]\d+_/, '');
    const meta = CATEGORY_META[category];
    if (meta) labels.add(meta.label);
  }

  return Array.from(labels);
}

/* ---------- Линейка / человечек ---------- */
document.getElementById('btnRuler').addEventListener('click', () => setRulerMode(!rulerMode));
document.getElementById('btnRulerClear').addEventListener('click', () => {
  clearRuler();
  showToast('Замеры очищены', true);
});
document.getElementById('floatRulerOff').addEventListener('click', () => setRulerMode(false));

document.getElementById('btnHuman').addEventListener('click', () => {
  setHumanMode(!humanMode);
  if (humanMode && !humanGroup.visible && currentModel) {
    showToast('Поставьте человечка на ступень', true);
  }
});
document.getElementById('btnHumanRemove').addEventListener('click', () => {
  humanGroup.visible = false;
  setHumanMode(false);
  showToast('Человечек убран', true);
});
document.getElementById('floatHumanOff').addEventListener('click', () => {
  // Выключаем режим, но человечка не убираем: плашку можно вернуть кликом по метке.
  setHumanMode(false);
});

function syncHumanHeightUI(cm) {
  heightSlider.value = cm;
  floatHeightSlider.value = cm;
  heightValue.textContent = cm + ' см';
  floatHeightValue.textContent = cm + ' см';
}
function syncHumanRotationUI(deg) {
  rotationSlider.value = deg;
  floatRotationSlider.value = deg;
  rotationValue.textContent = deg + '°';
  floatRotationValue.textContent = deg + '°';
  humanGroup.rotation.y = (deg * Math.PI) / 180;
}

heightSlider.addEventListener('input', (e) => {
  const cm = parseInt(e.target.value, 10);
  setHumanHeight(cm);
  syncHumanHeightUI(cm);
});
rotationSlider.addEventListener('input', (e) => {
  humanRotation = parseInt(e.target.value, 10);
  syncHumanRotationUI(humanRotation);
});
floatHeightSlider.addEventListener('input', (e) => {
  const cm = parseInt(e.target.value, 10);
  setHumanHeight(cm);
  syncHumanHeightUI(cm);
});
floatRotationSlider.addEventListener('input', (e) => {
  humanRotation = parseInt(e.target.value, 10);
  syncHumanRotationUI(humanRotation);
});

/* ---------- Камера / прочее ---------- */
document.getElementById('btnFit').addEventListener('click', fitCamera);
document.getElementById('btnRotate').addEventListener('click', (e) => {
  if (!controls.autoRotate) centerCameraTarget();
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle('active', controls.autoRotate);
});
document.getElementById('btnShot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'view-' + Date.now() + '.png';
  a.click();
  showToast('Снимок сохранён', true);
});
document.getElementById('btnShare').addEventListener('click', async () => {
  const url = buildShareUrl();
  history.replaceState(null, '', url);
  const title = document.title || '3D Viewer';
  if (navigator.share) {
    try { await navigator.share({ title, text: 'Посмотрите 3D-модель', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка с позицией и человечком скопирована', true);
  } catch { prompt('Скопируйте ссылку вручную:', url); }
});
document.getElementById('bgColor').addEventListener('input', (e) => {
  scene.background.set(e.target.value);
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('Сбросить все настройки? Модель, отделка и видимость вернутся к исходному виду.')) return;
  for (const k in currentColor) { currentColor[k] = null; applyColor(k); }
  setPaintEnabled(true);
  
  for (const key in elementVisible) elementVisible[key] = true;
  for (const key in elementIncluded) elementIncluded[key] = true;
  for (const key in blockIncluded) blockIncluded[key] = true;
  
  glassWalls = true;
  buildConfiguratorPanel();
  controls.autoRotate = false;
  document.getElementById('btnRotate').classList.remove('active');
  applyElementVisibility();
  applyGlassWalls();
  if (rulerMode) setRulerMode(false);
  if (humanMode) setHumanMode(false);
  humanGroup.visible = false;
  humanRotation = 0;
  syncHumanRotationUI(0);
  
  selectedBaluster = 'original';
  buildBalusterPanel();
  
  for (const k in currentFinish) { currentFinish[k] = null; applyFinish(k); }
  buildFinishPanel();
  
  const bg = '#0f1116';
  document.getElementById('bgColor').value = bg;
  scene.background.set(bg);
  if (currentModel) fitCamera();
});

document.getElementById('btnSavePos').addEventListener('click', () => {
  const newUrl = buildShareUrl();
  history.replaceState(null, '', newUrl);
  navigator.clipboard.writeText(newUrl).then(() => {
    showToast('Ссылка с позицией и человечком скопирована', true);
  }).catch(() => prompt('Скопируйте ссылку вручную:', newUrl));
});

window.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  switch (e.key.toLowerCase()) {
    case 'f': document.getElementById('btnFit').click(); break;
    case 'r': document.getElementById('btnRotate').click(); break;
    case 'm': document.getElementById('btnRuler').click(); break;
    case 'h': document.getElementById('btnHuman').click(); break;
  }
});

/* ═══════════════════════════════════════════════════════════════
   ОТДЕЛКА (панель текстур)
   ═══════════════════════════════════════════════════════════════ */
function buildFinishPanel() {
  finishRows.innerHTML = '';

  FINISH_CATEGORIES.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'finish-row';
    row.dataset.key = cat.key;

    const header = document.createElement('div');
    header.className = 'finish-header';
    header.innerHTML =
      '<span class="label">' + cat.label + '</span>' +
      '<span class="value">' +
        '<span class="finish-current">Как в проекте</span>' +
        '<span class="arrow">▼</span>' +
      '</span>';

    const options = document.createElement('div');
    options.className = 'finish-options';

    const optOriginal = document.createElement('button');
    optOriginal.className = 'finish-option selected';
    optOriginal.dataset.file = '';
    optOriginal.dataset.name = 'Как в проекте';
    optOriginal.innerHTML = '<span class="swatch" style="background:#1a1d25;"></span>Как в проекте';
    options.appendChild(optOriginal);

    TEXTURE_LIST.forEach((t) => {
      const opt = document.createElement('button');
      opt.className = 'finish-option';
      opt.dataset.file = t.file;
      opt.dataset.name = t.name;
      opt.innerHTML = '<span class="swatch" style="background-image:url(' + t.file + ');"></span>' + t.name;
      options.appendChild(opt);
    });

    row.appendChild(header);
    row.appendChild(options);

    header.addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      finishRows.querySelectorAll('.finish-row.open').forEach((r) => {
        if (r !== row) r.classList.remove('open');
      });
      row.classList.toggle('open', !isOpen);
    });

    options.addEventListener('click', (e) => {
      const btn = e.target.closest('.finish-option');
      if (!btn) return;
      const file = btn.dataset.file;
      const name = btn.dataset.name;
      currentFinish[cat.key] = file ? { file, name } : null;
      options.querySelectorAll('.finish-option').forEach((o) => o.classList.remove('selected'));
      btn.classList.add('selected');
      row.querySelector('.finish-current').textContent = file ? name : 'Как в проекте';
      row.classList.remove('open');
      applyFinish(cat.key);
    });

    finishRows.appendChild(row);
  });
}

function applyFinish(categoryKey) {
  const choice = currentFinish[categoryKey];

  for (const groupKey in elementGroups) {
    if (!groupKey.endsWith('_' + categoryKey)) continue;
    
    const meshes = elementGroups[groupKey];
    meshes.forEach((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const orig = originalMaterialState.get(obj.uuid);

      mats.forEach((m) => {
        if (!m) return;
        if (!choice) {
          if (orig) {
            m.map = orig.map;
            if (m.color) m.color.setHex(orig.color);
          }
        } else {
          m.map = getTexture(choice.file);
          if (m.color) m.color.setHex(0xffffff); 
        }
        m.needsUpdate = true;
      });
    });
  }

  if (categoryKey === 'baluster') updateGeneratedBalusterMaterial();
  updatePriceSummary();
}

/* ═══════════════════════════════════════════════════════════════
   БАЛЯСИНЫ (ВЫБОР ФОРМЫ)
   ═══════════════════════════════════════════════════════════════ */
function buildBalusterPanel() {
  const container = document.getElementById('balusterButtons');
  if (!container) return;
  container.innerHTML = '';

  const btnOrig = document.createElement('button');
  btnOrig.className = 'btn' + (selectedBaluster === 'original' ? ' active' : '');
  btnOrig.innerHTML = 'Как в проекте';
  btnOrig.style.flex = '1 1 100%';
  btnOrig.onclick = () => {
    selectedBaluster = 'original';
    buildBalusterPanel();
    replaceBalustersInScene();
    buildClientPriceModal();
    updatePriceSummary();
  };
  container.appendChild(btnOrig);

  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (selectedBaluster === String(i) ? ' active' : '');
    btn.innerHTML = 'Вид ' + i;
    btn.style.flex = '1 1 40%';
    btn.onclick = () => {
      selectedBaluster = String(i);
      buildBalusterPanel();
      replaceBalustersInScene();
      buildClientPriceModal();
      updatePriceSummary();
    };
    container.appendChild(btn);
  }
}

// Создаем два независимых контейнера
const shortBalustersGroup = new THREE.Group();
const longBalustersGroup = new THREE.Group();
shortBalustersGroup.name = "short_balusters_container";
longBalustersGroup.name = "long_balusters_container";
scene.add(longBalustersGroup); // Добавляем в сцену ТОЛЬКО длинный контейнер

// Для совместимости с остальным кодом (кнопки видимости и т.д.)
const replacedBalustersGroup = longBalustersGroup;

let isReplacing = false; 

/* Цилиндрические UV: u — вокруг оси, v — по высоте в метрах.
   yOffset нужен для хвостовиков, чтобы текстура продолжалась от GLB. */
function setCylindricalUV(geometry, yOffset) {
  const pos = geometry.attributes.position;
  const uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  const shift = yOffset || 0;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + shift;
    const z = pos.getZ(i);
    uv.setXY(
      i,
      BALUSTER_UV_AROUND * (0.5 + Math.atan2(z, x) / (2 * Math.PI)),
      y * BALUSTER_UV_PER_METER
    );
  }

  geometry.setAttribute('uv', uv);
  return uv;
}

/* ───────────────────────────────────────────────────────────────
   Разбор GLB рисунка: отделяем точёную часть от прямых концов.
   Возвращает профиль вращения в метрах при номинальной высоте 680 мм.
   ─────────────────────────────────────────────────────────────── */
function getBalusterTemplate(id) {
  if (balusterTemplateCache.has(id)) return balusterTemplateCache.get(id);

  const source = balusterModels[id];
  if (!source) return null;

  const root = source.clone(true);
  root.rotation.set(0, 0, 0);
  root.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (size.x === maxDim) root.rotation.z = Math.PI / 2;
  else if (size.z === maxDim) root.rotation.x = -Math.PI / 2;
  root.updateMatrixWorld(true);

  box = new THREE.Box3().setFromObject(root);
  size = box.getSize(new THREE.Vector3());
  if (!isFinite(size.y) || size.y < 1e-6) return null;

  // Новый GLB экспортируется как целая балясина 680 мм в реальных
  // миллиметрах. Старый файл после импорта получается 512 мм, поэтому
  // приводим общую высоту к 0.68 м, но саму геометрию не перестраиваем.
  const scale = BALUSTER_NOMINAL_HEIGHT / size.y;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const yMin = box.min.y;

  // Собираем все меши GLB в один массив вершин. Матрица меша
  // (поворот/масштаб экспорта) применяется один раз.
  const rawPositions = [];
  const rawIndices = [];
  const v = new THREE.Vector3();

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const geo = o.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const offset = rawPositions.length / 3;

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      rawPositions.push(
        (v.x - cx) * scale,
        (v.y - yMin) * scale,
        (v.z - cz) * scale
      );
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) rawIndices.push(idx.getX(i) + offset);
    } else {
      for (let i = 0; i < pos.count; i++) rawIndices.push(i + offset);
    }
  });

  if (!rawPositions.length) return null;

  // В новых GLB не будет нормалей. Свариваем совпадающие вершины,
  // иначе computeVertexNormals даёт гранёный вид на каждой грани.
  // Допуск 0.01 мм: он не склеивает соседние кольца профиля.
  const positions = [];
  const weldedIndexOfRaw = new Int32Array(rawPositions.length / 3);
  const weldMap = new Map();
  const weldTol = 100000;

  for (let i = 0, p = 0; i < rawPositions.length; i += 3, p++) {
    const x = rawPositions[i];
    const y = rawPositions[i + 1];
    const z = rawPositions[i + 2];
    const key = Math.round(x * weldTol) + '|' +
                Math.round(y * weldTol) + '|' +
                Math.round(z * weldTol);
    let wi = weldMap.get(key);
    if (wi === undefined) {
      wi = positions.length / 3;
      weldMap.set(key, wi);
      positions.push(x, y, z);
    }
    weldedIndexOfRaw[p] = wi;
  }

  const indices = [];
  for (let i = 0; i < rawIndices.length; i += 3) {
    const a = weldedIndexOfRaw[rawIndices[i]];
    const b = weldedIndexOfRaw[rawIndices[i + 1]];
    const c = weldedIndexOfRaw[rawIndices[i + 2]];
    if (a === b || b === c || c === a) continue;
    indices.push(a, b, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  // Проверяем ориентацию замкнутой поверхности: если обход обратный,
  // нормали будут смотреть внутрь и балясина станет невидимой.
  let signedVolume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx2 = positions[c], cy = positions[c + 1], cz2 = positions[c + 2];
    signedVolume += (ax * (by * cz2 - bz * cy) +
                     ay * (bz * cx2 - bx * cz2) +
                     az * (bx * cy - by * cx2)) / 6;
  }
  if (signedVolume < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
    geometry.setIndex(indices);
  }

  // Сглаженные нормали по всей поверхности — без граней.
  geometry.computeVertexNormals();

  // UV генерируем цилиндрически с тем же масштабом, что у StairCon.
  setCylindricalUV(geometry, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // Радиус на каждом уровне Y — только для поиска точёной части
  // и диаметра хвостовиков. Сама геометрия не меняется.
  const rings = new Map();
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    const r = Math.hypot(positions[i], positions[i + 2]);
    const key = Math.round(y * 100000) / 100000;
    const old = rings.get(key);
    if (old === undefined || r > old) rings.set(key, r);
  }

  const ys = [...rings.keys()].sort((a, b) => a - b);
  if (!ys.length) return null;

  const localMin = ys[0];
  const localMax = ys[ys.length - 1];
  const maxRadiusIn = (a, b) => {
    let r = 0;
    for (const y of ys) if (y >= a && y <= b) r = Math.max(r, rings.get(y));
    return r;
  };

  const bottomRadius = maxRadiusIn(localMin, localMin + 0.025) || 0.015;
  const topRadius    = maxRadiusIn(localMax - 0.025, localMax) || bottomRadius;
  const tol = 0.00003;

  let first = null;
  for (const y of ys) {
    if (y < localMin + 0.002) continue;
    if (rings.get(y) > bottomRadius + tol) { first = y; break; }
  }
  let last = null;
  for (let i = ys.length - 1; i >= 0; i--) {
    const y = ys[i];
    if (y > localMax - 0.002) continue;
    if (rings.get(y) > topRadius + tol) { last = y; break; }
  }

  // Если рисунок целиком цилиндрический — берём среднюю часть.
  if (first === null || last === null || last - first < 0.10) {
    first = localMin + (localMax - localMin) * 0.15;
    last  = localMax - (localMax - localMin) * 0.15;
  }

  let sourceMaterial = null;
  source.traverse((o) => {
    if (!sourceMaterial && o.isMesh && o.material) {
      sourceMaterial = Array.isArray(o.material) ? o.material[0] : o.material;
    }
  });

  const tpl = {
    geometry,
    height: BALUSTER_NOMINAL_HEIGHT,
    decoFirst: first,
    decoLast: last,
    decoHeight: last - first,
    bottomRadius,
    topRadius,
    endRadius: (bottomRadius + topRadius) / 2,
    sourceMaterial: sourceMaterial ? sourceMaterial.clone() : null,
  };
  balusterTemplateCache.set(id, tpl);
  return tpl;
}

/* Опорные точки: верх ступени/подбалясенника и низ поручня. */
function getBalusterMount(anchor, box) {
  const x = (box.min.x + box.max.x) / 2;
  const z = (box.min.z + box.max.z) / 2;
  const y = (box.min.y + box.max.y) / 2;

  const treads = [];
  const bottomrails = [];
  const handrails = [];
  for (const k in elementGroups) {
    if (k.endsWith('_treads'))      treads.push(...elementGroups[k]);
    if (k.endsWith('_bottomrail'))  bottomrails.push(...elementGroups[k]);
    if (k.endsWith('_handrail'))    handrails.push(...elementGroups[k]);
  }

  const downRay = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0));
  const upRay   = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0));

  const downHit = downRay.intersectObjects(treads.concat(bottomrails), true)[0];
  const upHit   = upRay.intersectObjects(handrails, true)[0];

  let bottom = downHit ? downHit.point.y : null;
  let top    = upHit ? upHit.point.y : null;

  // Страховка: старый хвостовик StairCon заходит в ступень ~30 мм,
  // а в поручень — на 30…50 мм.
  if (!isFinite(bottom) || !isFinite(top) || top - bottom < 0.4 || top - bottom > 1.5) {
    bottom = box.min.y + 0.030;
    top    = box.max.y - 0.040;
  }

  return { bottom, top, clear: top - bottom, x, z };
}

function makeBalusterMaterial(template, sourceMesh) {
  // Берём материал исходной балясины StairCon, чтобы рисунок совпал
  // по текстуре с остальной лестницей (а не серый материал GLB).
  let sourceMat = null;
  if (sourceMesh) {
    sourceMesh.traverse((o) => {
      if (!sourceMat && o.isMesh && o.material) {
        sourceMat = Array.isArray(o.material) ? o.material[0] : o.material;
      }
    });
  }
  if (!sourceMat) sourceMat = template.sourceMaterial;

  let m;
  if (sourceMat) m = sourceMat.clone();
  else m = new THREE.MeshStandardMaterial({ color: 0xd6aa74, roughness: 0.75 });

  m.side = THREE.FrontSide;
  m.userData.baseMap = m.map || null;
  m.userData.baseColor = m.color ? m.color.getHex() : 0xffffff;
  return m;
}

/* Цвет/покрытие для сгенерированных балясин (они не входят в elementGroups). */
function updateGeneratedBalusterMaterial() {
  const m = activeBalusterMaterial;
  if (!m) return;

  const finish = currentFinish.baluster;
  if (finish && finish.file) m.map = getTexture(finish.file);
  else m.map = m.userData.baseMap || null;

  const colorKey = currentColor.baluster;
  const colorObj = COLOR_PALETTE.find(c => c.key === colorKey);
  const colorHex = colorObj ? colorObj.hex : null;

  if (!paintEnabled || !colorKey) {
    if (m.color) m.color.setHex(m.userData.baseColor || 0xffffff);
    if (m.isMeshStandardMaterial) m.roughness = 0.8;
    if (m.isMeshPhongMaterial) m.shininess = 10;
  } else if (colorKey === 'clear') {
    if (m.color) m.color.setHex(0xffffff);
    if (m.isMeshStandardMaterial) {
      m.roughness = 0.1;
      m.metalness = 0.2;
      m.envMapIntensity = 1.5;
    }
    if (m.isMeshPhongMaterial) {
      m.shininess = 300;
      m.specular = new THREE.Color(0xffffff);
    }
  } else {
    if (colorKey === 'white' || colorKey === 'redwood' || colorKey === 'black') m.map = null;
    else m.map = m.userData.baseMap || null;
    if (m.color) m.color.set(colorHex);
    if (m.isMeshStandardMaterial) m.roughness = 0.5;
    if (m.isMeshPhongMaterial) m.shininess = 30;
  }
  m.needsUpdate = true;
}

function createGeneratedBaluster(anchor, template, groupKey, material) {
  anchor.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(anchor);
  const mount = getBalusterMount(anchor, box);

  // Точёную часть (рисунок) центрируем в видимом просвете.
  // Сам меш GLB не масштабируем и не пересобираем.
  const decoHeight = template.decoHeight;
  const decoCenter = (template.decoFirst + template.decoLast) / 2;
  const glbBottom  = mount.bottom + mount.clear / 2 - decoCenter;
  const glbTop     = glbBottom + template.height;

  const targetBottom = mount.bottom - BALUSTER_EMBED_BOTTOM;
  const targetTop    = mount.top + BALUSTER_EMBED_TOP;

  const wrapper = new THREE.Group();
  wrapper.position.set(mount.x, glbBottom, mount.z);
  wrapper.userData.groupKey = groupKey;
  wrapper.userData.clearHeight = mount.clear;
  wrapper.userData.cutLength = targetTop - targetBottom;
  wrapper.userData.anchorName = anchor.name || '';
  wrapper.userData.decoHeight = decoHeight;
  wrapper.userData.glbHeight = template.height;

  if (decoHeight > mount.clear + 0.001) {
    console.warn(
      'Рисунок выше просвета, средняя часть не уменьшается:',
      decoHeight.toFixed(3), '>', mount.clear.toFixed(3)
    );
  }

  // Оригинальная геометрия GLB — как есть.
  const body = new THREE.Mesh(template.geometry, material);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.persistentGeometry = true;
  wrapper.add(body);

  const addTail = (y0, y1, radius) => {
    const len = y1 - y0;
    if (len <= 0.0005) return;
    const geo = new THREE.CylinderGeometry(radius, radius, len, 32, 1, false);
    // Хвостовик должен продолжать текстуру GLB, а не начинать её заново.
    setCylindricalUV(geo, (y0 + y1) / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = (y0 + y1) / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.disposableGeometry = true;
    wrapper.add(mesh);
  };

  // Локальные координаты обёртки: 0 — низ GLB.
  // Если GLB не достаёт до ступени/поручня — достраиваем только хвост.
  // Если GLB уже заходит глубже 20/35 мм — ничего не подрезаем.
  const localBottom = targetBottom - glbBottom;
  const localTop    = targetTop - glbBottom;

  if (localBottom < -0.0005) {
    addTail(localBottom, 0, template.bottomRadius);
  }
  if (localTop > template.height + 0.0005) {
    addTail(template.height, localTop, template.topRadius);
  }

  return wrapper;
}

function replaceBalustersInScene() {
  if (isReplacing) return;
  isReplacing = true;

  // 1. ОЧИСТКА ОБОИХ КОНТЕЙНЕРОВ
  // Геометрия рисунка кэшируется и общая для всех балясин — её не удаляем.
  // Материал тоже общий, освобождаем один раз после очистки.
  const oldMaterial = activeBalusterMaterial;
  [shortBalustersGroup, longBalustersGroup].forEach(group => {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((o) => {
        if (o.isMesh && o.geometry && o.userData.disposableGeometry) {
          o.geometry.dispose();
        }
      });
    }
    group.children = [];
  });
  if (oldMaterial) oldMaterial.dispose();
  activeBalusterMaterial = null;

  const allOriginalBalusters = [
    ...(elementGroups['s1_baluster'] || []), ...(elementGroups['s2_baluster'] || []),
    ...(elementGroups['r2_baluster'] || []), ...(elementGroups['r3_baluster'] || [])
  ];

  // 2. Если выбрано "Как в проекте"
  if (selectedBaluster === 'original') {
    applyElementVisibility();
    isReplacing = false;
    return;
  }

  // 3. Получаем шаблон рисунка (пока не скрываем исходные балясины)
  const template = getBalusterTemplate(selectedBaluster);
  if (!template) {
    showToast('Модель балясины еще не загрузилась. Подождите.', true);
    isReplacing = false;
    return;
  }

  // 4. Скрываем старые балясины: и точёные части, и хвостовики StairCon.
  allOriginalBalusters.forEach(m => m.visible = false);

  // 5. Ставим по одной балясине на каждый старый длинный хвостовик (47 шт.),
  //    а не на все 94 объекта сцены.
  const processedMeshes = new Set();
  let generated = 0;

  allOriginalBalusters.forEach((oldMesh) => {
    let groupKey = 's1_baluster';
    for (const k in elementGroups) {
      if (k.includes('baluster') && elementGroups[k].includes(oldMesh)) {
        groupKey = k; break;
      }
    }
    if (processedMeshes.has(oldMesh.uuid)) return;
    processedMeshes.add(oldMesh.uuid);

    oldMesh.updateMatrixWorld(true);
    const oldBox = new THREE.Box3().setFromObject(oldMesh);
    const oldSize = oldBox.getSize(new THREE.Vector3());
    if (oldSize.y < 0.6) return; // короткие точёные части — не опорные

    if (!activeBalusterMaterial) activeBalusterMaterial = makeBalusterMaterial(template, oldMesh);
    longBalustersGroup.add(createGeneratedBaluster(oldMesh, template, groupKey, activeBalusterMaterial));
    generated++;
  });

  updateGeneratedBalusterMaterial();
  console.log('%cБалясины: сгенерировано ' + generated + ' шт.', 'color:#31d0aa;font-weight:bold');

  // 6. Управление видимостью
  if (shortBalustersGroup.parent) {
      scene.remove(shortBalustersGroup);
  }
  
  if (!longBalustersGroup.parent) {
      scene.add(longBalustersGroup);
  }
  longBalustersGroup.visible = true;
  applyElementVisibility();
  isReplacing = false;
}

/* ═══════════════════════════════════════════════════════════════
   ПОКРАСКА (панель цветов)
   ═══════════════════════════════════════════════════════════════ */
function buildColorPanel() {
  const colorRows = document.getElementById('colorRows');
  if (!colorRows) return;
  colorRows.innerHTML = '';

  FINISH_CATEGORIES.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'finish-row';
    row.dataset.key = cat.key;

    const header = document.createElement('div');
    header.className = 'finish-header';
    header.innerHTML =
      '<span class="label">' + cat.label + '</span>' +
      '<span class="value">' +
        '<span class="finish-current">Без тонировки</span>' +
        '<span class="arrow">▼</span>' +
      '</span>';

    const options = document.createElement('div');
    options.className = 'color-options';

    const optOrig = document.createElement('div');
    optOrig.className = 'color-swatch original';
    optOrig.innerHTML = '✕';
    optOrig.title = 'Без тонировки';
    optOrig.addEventListener('click', () => {
      currentColor[cat.key] = null;
      row.querySelector('.finish-current').textContent = 'Без тонировки';
      options.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
      optOrig.classList.add('selected');
      row.classList.remove('open');
      applyColor(cat.key);
    });
    options.appendChild(optOrig);

    COLOR_PALETTE.forEach((color) => {
      if (color.name === 'Натуральный') return;
      
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.background = color.hex;
      swatch.title = color.name;
      
      swatch.addEventListener('click', () => {
        currentColor[cat.key] = color.key;
        row.querySelector('.finish-current').textContent = color.name;
        options.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('selected'));
        swatch.classList.add('selected');
        row.classList.remove('open');
        applyColor(cat.key);
      });
      options.appendChild(swatch);
    });

    row.appendChild(header);
    row.appendChild(options);

    header.addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      colorRows.querySelectorAll('.finish-row.open').forEach((r) => {
        if (r !== row) r.classList.remove('open');
      });
      row.classList.toggle('open', !isOpen);
    });

    colorRows.appendChild(row);
  });
}

function hasUsableMap(map) {
  const image = map && map.image;
  return !!(image && (image.width > 0 || image.height > 0));
}

function applyColor(categoryKey) {
  const colorKey = currentColor[categoryKey];
  const colorObj = COLOR_PALETTE.find(c => c.key === colorKey);
  const colorHex = colorObj ? colorObj.hex : null;

  for (const groupKey in elementGroups) {
    if (!groupKey.endsWith('_' + categoryKey)) continue;
    
    elementGroups[groupKey].forEach((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const orig = originalMaterialState.get(obj.uuid);

      mats.forEach((m) => {
        if (!m) return;
        
        if (!paintEnabled || !colorKey) {
          if (orig) {
            m.map = hasUsableMap(orig.map) ? orig.map : null;
            if (m.color) m.color.setHex(orig.color);
          }
          if (m.isMeshStandardMaterial) m.roughness = 0.8;
          if (m.isMeshPhongMaterial) m.shininess = 10;
        } else {
          if (colorKey === 'clear') {
            if (orig && hasUsableMap(orig.map)) {
              m.map = orig.map;
              if (m.color) m.color.setHex(0xffffff);
            } else {
              m.map = null;
              if (m.color) m.color.setHex(0xd8c3a5);
            }
            if (m.isMeshStandardMaterial) {
              m.roughness = 0.1;
              m.metalness = 0.2;
              m.envMapIntensity = 1.5;
              m.roughnessMap = null;
            }
            if (m.isMeshPhongMaterial) {
              m.shininess = 300;
              m.specular = new THREE.Color(0xffffff);
              m.specularMap = null;
            }
          } else {
            if (colorKey === 'white' || colorKey === 'redwood' || colorKey === 'black') {
              m.map = null; 
            } else {
              m.map = orig && hasUsableMap(orig.map) ? orig.map : null;
            }
            if (m.color) m.color.set(colorHex);
            if (m.isMeshStandardMaterial) m.roughness = 0.5;
            if (m.isMeshPhongMaterial) m.shininess = 30;
          }
        }
        m.needsUpdate = true;
      });
    });
  }

  if (categoryKey === 'baluster') updateGeneratedBalusterMaterial();
  updatePriceSummary();
}

function setPaintEnabled(enabled) {
  paintEnabled = !!enabled;
  for (const k in currentColor) applyColor(k);
  buildColorPanel();
  const btn = document.getElementById('btnGlobalPaint');
  if (btn) {
    btn.classList.toggle('active', paintEnabled);
    btn.textContent = paintEnabled ? 'Покраска включена' : 'Покраска отключена';
  }
  if (typeof priceModal !== 'undefined' && priceModal && priceModal.overlay.classList.contains('show')) {
    buildClientPriceModal();
  }
}

const globalPaintBtn = document.getElementById('btnGlobalPaint');
if (globalPaintBtn) {
  globalPaintBtn.addEventListener('click', () => {
    setPaintEnabled(!paintEnabled);
    showToast(paintEnabled ? 'Покраска включена' : 'Покраска отключена', true);
  });
}

/* ═══════════════════════════════════════════════════════════════
   КЛАССИФИКАЦИЯ BOM-ЭЛЕМЕНТОВ
   ═══════════════════════════════════════════════════════════════ */
function classifyBOMItems(items, floor) {
  const result = { stair: {}, railing: {} };
  if (!items || !items.length) return result;

  const stairItems = items.filter(d => d.name && d.name.startsWith(floor + '_'));
  const welcomeSteps = stairItems.filter(d => d.type === 'Step' && d.subtype === 'bullnose');

  let welcomeRiserNames = [];
  if (welcomeSteps.length > 0) {
    const risers = stairItems
      .filter(d => d.type === 'Riser')
      .sort((a, b) => {
        const na = parseInt((a.name || '').replace(/\D+/g, ''), 10) || 0;
        const nb = parseInt((b.name || '').replace(/\D+/g, ''), 10) || 0;
        return na - nb;
      });
    welcomeRiserNames = risers.slice(0, welcomeSteps.length).map(r => r.name);
  }

  items.forEach(d => {
    if (!d.name) return;
    const m = d.name.match(/^(\d+)_/);
    if (!m) return;
    const prefix = parseInt(m[1], 10);

    let target = null;
    if (prefix === floor)          target = result.stair;
    else if (prefix === floor + 1) target = result.railing;
    else return;

    let catKey = null;
    if (d.type === 'Step') {
      catKey = (d.subtype === 'bullnose') ? 'welcome_steps' : 'treads';
    } else if (d.type === 'Riser') {
      catKey = welcomeRiserNames.includes(d.name) ? 'welcome_risers' : 'risers';
    } else if (d.type === 'String') {
      catKey = (d.stringtype === 'cut') ? 'kosour' : 'stringers';
    } else if (d.type === 'Newel')      catKey = 'posts';
    else if (d.type === 'NewelCap')     catKey = 'post_caps';
    else if (d.type === 'Handrail')     catKey = 'handrail';
    else if (d.type === 'Baluster')     catKey = 'baluster';
    else if (d.type === 'Covering')     catKey = 'covering';
    else if (d.type === 'Bottomrail')   catKey = 'bottomrail';

    if (!catKey) return;
    if (!target[catKey]) target[catKey] = [];
    target[catKey].push(d);
  });

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   КАЛЬКУЛЯТОР
   ═══════════════════════════════════════════════════════════════ */
function getMaterialForKey(key) {
  const chosen = currentFinish[key];
  if (!chosen || !chosen.file) return 'pine';
  const mats = priceData && priceData.materials ? priceData.materials : {};
  for (const matKey in mats) {
    const t = mats[matKey].textures || [];
    if (t.indexOf(chosen.file) !== -1) return matKey;
  }
  return 'pine';
}

function getMaterialInfo(matKey) {
  const mats = priceData && priceData.materials ? priceData.materials : {};
  return mats[matKey] || mats.pine || { name: 'Сосна' };
}

function getDXFPaintArea(catKey, items) {
  if (!items || !items.length) return 0;

  if (catKey === 'posts') {
    let total = 0;
    items.forEach(d => { total += (4 * 80 * d.L) / 1e6; });
    return total;
  }
  if (catKey === 'baluster') {
    let total = 0;
    items.forEach(d => { total += (4 * 45 * d.L) / 1e6; });
    return total;
  }

  let total = 0;
  items.forEach(d => {
    if (d.name && d.name.endsWith('End')) return;
    const dxf = d.name ? dxfCache[d.name] : null;
    if (dxf) {
      const T = d.T / 1000;
      total += (dxf.area / 1e6) * 2 + (dxf.perimeter / 1000) * T;
    } else {
      total += 2 * (d.W * d.L) / 1e6;
    }
  });
  return total;
}

/* Типоразмер балясины для группы:
   ограждение — 860, косоур — 930, тетива при угле > 40° — 680, иначе 930. */
function getBalusterSizeForGroup(prefix, items, bomGroup) {
  if (prefix.charAt(0) === 'r') return '860';

  if (items && items.kosour && items.kosour.length) return '930';

  const hasStringers = items && items.stringers && items.stringers.length;
  if (hasStringers) {
    const pitchText = bomGroup && bomGroup.params ? bomGroup.params.pitch : null;
    const pitch = pitchText != null ? parseFloat(String(pitchText).replace(',', '.')) : NaN;
    if (isFinite(pitch) && pitch > 40) return '680';
  }

  return '930';
}

/* Цена одной балясины: матрица рисунок×высота×материал, затем
   таблица высота×материал + надбавка за рисунок, затем базовая цена. */
function getBalusterPricing(size, materialKey, drawing) {
  const baseCat = priceData.categories.baluster || {};
  let basePrice = baseCat.prices ? Number(baseCat.prices[materialKey]) : 0;
  if (!isFinite(basePrice)) basePrice = 0;

  const drawingData = priceData.baluster_types && priceData.baluster_types[drawing];
  let extra = drawingData ? Number(drawingData.extra_cost) : 0;
  if (!isFinite(extra)) extra = 0;

  const matrixRow = priceData.baluster_matrix && priceData.baluster_matrix[drawing];
  const matrixSize = matrixRow && matrixRow[size];
  let matrixPrice = matrixSize ? matrixSize[materialKey] : null;
  if (typeof matrixPrice === 'string') matrixPrice = parseFloat(matrixPrice);
  if (isFinite(matrixPrice) && matrixPrice > 0) {
    return { price: matrixPrice, source: 'matrix', basePrice: basePrice, extra: extra };
  }

  const sizeRow = priceData.baluster_prices && priceData.baluster_prices[size];
  let sizePrice = sizeRow ? sizeRow[materialKey] : null;
  if (typeof sizePrice === 'string') sizePrice = parseFloat(sizePrice);
  if (isFinite(sizePrice) && sizePrice > 0) {
    return { price: sizePrice + extra, source: 'size', basePrice: basePrice, extra: extra };
  }

  return { price: basePrice + extra, source: 'base', basePrice: basePrice, extra: extra };
}

function buildGroupResult(prefix, title, classified, paintPrice, countMontage, bomGroup) {
  const out = {
    prefix: prefix,
    title: title,
    categories: [],
    materialTotal: 0,
    paintTotal: 0,
    montageCost: 0
  };
  if (!priceData || !priceData.categories) return out;

  const balusterSize = getBalusterSizeForGroup(prefix, classified, bomGroup);

  for (const catKey in priceData.categories) {
    const cat = priceData.categories[catKey];
    const items = classified[catKey];
    if (!items || !items.length) continue;

    const visKey = prefix + '_' + catKey;
    if (!isElementIncluded(visKey)) continue;

    const matKey = getMaterialForKey(catKey);
    const matInfo = getMaterialInfo(matKey);
    const unitPrice = (cat.prices && cat.prices[matKey]) || 0;
    const coef = (cat.method === 'm2' && cat.coef) ? cat.coef : 1;

    let qty = 0;
    if (cat.method === 'm2') {
      items.forEach(d => { qty += (d.W * d.L) / 1e6; });
      qty *= coef;
    } else if (cat.method === 'length') {
      const extra = (cat.extra_mm || 0) / 1000;
      items.forEach(d => { qty += d.L / 1000 + extra; });
    } else if (cat.method === 'count') {
      qty = items.length;
    }

    const paintArea = getDXFPaintArea(catKey, items);

    let currentUnitPrice = unitPrice;
    let extraName = '';
    let priceNote = '';

    if (catKey === 'baluster' && selectedBaluster !== 'original') {
      const bType = priceData.baluster_types && priceData.baluster_types[selectedBaluster];
      const pricing = getBalusterPricing(balusterSize, matKey, selectedBaluster);

      currentUnitPrice = pricing.price;
      extraName = ' ' + balusterSize + ' (' + (bType ? bType.name : 'Вид ' + selectedBaluster) + ')';

      if (pricing.source === 'base') {
        priceNote = 'Цена для типоразмера ' + balusterSize + ' не заполнена — используется базовая ' +
          formatRub(pricing.basePrice) +
          (pricing.extra > 0 ? ' + рисунок ' + formatRub(pricing.extra) : '') +
          ' = ' + formatRub(pricing.price) + '/шт.';
      }
    }

    let paintCost = 0;
    let paintName = 'Цвет не выбран';

    if (paintEnabled) {
      const selKey = currentColor[catKey] || 'clear';
      const paintData = priceData && priceData.paints ? priceData.paints[selKey] : null;
      const unitPaintPrice = paintData ? paintData.price_m2 : 1800;
      
      paintCost = paintArea * unitPaintPrice;
      paintName = paintData ? paintData.name : 'Лак б/ц';
    } else {
      paintName = 'Без покраски';
    }

    out.categories.push({
      key: catKey,
      name: cat.name + extraName,
      materialName: matInfo.name,
      count: items.length,
      qty: qty,
      method: cat.method,
      unitPrice: currentUnitPrice,
      priceNote: priceNote,
      balusterSize: catKey === 'baluster' ? balusterSize : null,
      paintArea: paintArea,
      materialCost: qty * currentUnitPrice,
      paintCost: paintCost,
      paintName: paintName
    });

    out.materialTotal += qty * currentUnitPrice;
    out.paintTotal += paintCost;
  }

  if (countMontage) {
    const treadMatKey = getMaterialForKey('treads');
    const baseMontage = (treadMatKey === 'pine') ? 25000 : 30000;
    let coef = 1.0;
    const hasRisers =
      ((classified.risers || []).length > 0 && isElementIncluded(prefix + '_risers')) ||
      ((classified.welcome_risers || []).length > 0 && isElementIncluded(prefix + '_welcome_risers'));
    if (hasRisers) coef += 0.10;
    const coveringCount = isElementIncluded(prefix + '_covering')
      ? (classified.covering || []).length
      : 0;
    out.montageCost = baseMontage * coef + 1200 * coveringCount;
  }

  return out;
}

function calculatePrice(km) {
  const result = {
    groups: [],
    materialTotal: 0,
    paintTotal: 0,
    deliveryCost: 0,
    deliveryKm: km || 0,
    montageCost: 0,
    total: 0
  };
  if (!bomGroups || !bomGroups.length || !priceData || !priceData.categories) return result;

  const paintPrice = (priceData.paint && priceData.paint.price_m2) || 0;

  for (const group of bomGroups) {
    const classified = classifyBOMItems(group.items, group.floor);

    const stairResult = buildGroupResult('s' + group.floor, 'Лестница ' + group.floor + '→' + (group.floor + 1), classified.stair, paintPrice, true, group);
    if (stairResult.categories.length) result.groups.push(stairResult);

    const railingResult = buildGroupResult('r' + (group.floor + 1), 'Ограждение ' + (group.floor + 1) + ' этажа', classified.railing, paintPrice, false, group);
    if (railingResult.categories.length) result.groups.push(railingResult);

    result.materialTotal += stairResult.materialTotal + railingResult.materialTotal;
    result.paintTotal += stairResult.paintTotal + railingResult.paintTotal;
  }

  const base = 60 * (km || 0) + 800;
  result.deliveryCost = deliveryEnabled && deliveryKmKnown ? Math.max(4500, base) : 0;
  const montageBlock = calculateMontageBlock();
  result.montageBlock = montageBlock;
  result.montageCost = montageEnabled && montageBlock ? montageBlock.final : 0;

  result.total = result.materialTotal + result.paintTotal + result.deliveryCost + result.montageCost;
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   ТЕХКАРТА ПРОИЗВОДСТВА
   Считаем все категории BOM: дерево по заготовкам, работы,
   покраску по рецептам, фурнитуру, накладные, наценку и УСН.
   ═══════════════════════════════════════════════════════════════ */
const TECH_CATEGORY_META = {
  treads:        { name: 'Ступени',                 detail: 'Step_straight', works: ['glue_short', 'calibration', 'cnc_programming', 'cnc_cutting', 'sanding'], glue: true },
  welcome_steps: { name: 'Пригласительные ступени', detail: 'Step_straight', works: ['glue_short', 'calibration', 'cnc_programming', 'cnc_cutting', 'sanding'], glue: true },
  risers:        { name: 'Подступенки',             detail: 'Riser',         works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  welcome_risers:{ name: 'Пригласительные подступенки', detail: 'Riser',     works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  stringers:     { name: 'Тетивы',                  detail: 'String',        works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  kosour:        { name: 'Косоуры',                 detail: 'String',        works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  posts:         { name: 'Столбы',                  detail: 'Newel',         works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  post_caps:     { name: 'Заглушки столбов',        detail: 'Newel',         works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  handrail:      { name: 'Поручень',                detail: 'Handrail',      works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  bottomrail:    { name: 'Подбалясенник',           detail: 'Handrail',      works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding'] },
  covering:      { name: 'Панель перекрытия',       detail: 'Step_straight', works: ['glue_short', 'calibration', 'cnc_programming', 'cnc_cutting', 'sanding'], glue: true },
  baluster:      { name: 'Балясины',                detail: 'Baluster',      works: [] }
};

function techNum(value, fallback) {
  const fb = isFinite(Number(fallback)) ? Number(fallback) : 0;
  if (value === null || value === undefined || value === '') return fb;
  const n = Number(value);
  return isFinite(n) ? n : fb;
}

function getTechWoodKey(catKey) {
  const finish = (currentFinish && (currentFinish[catKey] || currentFinish.treads || currentFinish.baluster)) || null;
  if (!finish || !finish.file) return 'pine';
  const file = String(finish.file).toLowerCase();
  if (file.indexOf('oak') !== -1) return 'oak';
  if (file.indexOf('ash') !== -1) return 'ash';
  if (file.indexOf('bok') !== -1 || file.indexOf('beech') !== -1) return 'beech';
  return 'pine';
}

function getTechWood(catKey) {
  const woods = (productionPrices && productionPrices.woods) || {};
  const key = getTechWoodKey(catKey);
  const info = woods[key] || woods.pine || { name: 'Сосна', pricePerM3: 32000, workCoef: 1 };
  return {
    key: woods[key] ? key : 'pine',
    name: info.name || key,
    pricePerM3: techNum(info.pricePerM3, 32000),
    workCoef: techNum(info.workCoef, 1)
  };
}

function getBalusterBlankMm() {
  let blank = null;
  if (balusterManifest && !Array.isArray(balusterManifest) && balusterManifest.defaults) {
    blank = balusterManifest.defaults.blank_mm;
  }
  return {
    thickness: techNum(blank && blank.thickness_mm, 50),
    width: techNum(blank && blank.width_mm, 50),
    length: techNum(blank && blank.length_mm, 1000)
  };
}

function getTechDetailCoef(catKey, items) {
  const meta = TECH_CATEGORY_META[catKey] || { detail: 'Step_straight' };
  let detailKey = meta.detail;
  if ((catKey === 'treads' || catKey === 'welcome_steps') &&
      (items || []).some(d => String(d.subtype || '').toLowerCase().indexOf('wind') !== -1)) {
    detailKey = 'Step_winder';
  }
  const table = (productionPrices && productionPrices.detail_coefficients) || {};
  const entry = table[detailKey];
  return entry ? techNum(entry.coef, 1) : 1;
}

function getTechPaintRecipe(catKey) {
  if (!paintEnabled) return null;
  const recipes = (productionPrices && productionPrices.paint_recipes) || {};
  let key = (currentColor && (currentColor[catKey] || currentColor.treads || currentColor.baluster)) || 'clear';

  if (!recipes[key]) {
    if (key === 'white' && recipes.white) key = 'white';
    else if (key === 'clear' && recipes.clear) key = 'clear';
    else {
      const stained = Object.keys(recipes).find(k => recipes[k] && recipes[k].stain && recipes[k].stain.enabled);
      key = stained || (recipes.clear ? 'clear' : Object.keys(recipes)[0]);
    }
  }

  const recipe = recipes[key] || null;
  return recipe ? { key: key, recipe: recipe } : null;
}

function getTechPaintMaterialRate(recipe) {
  if (!recipe) return 0;
  const inventory = (productionPrices && productionPrices.paint_inventory) || {};
  let rate = 0;

  ['stain', 'primer', 'lacquer'].forEach(blockType => {
    const block = recipe[blockType];
    if (!block || !block.enabled) return;
    const consumption = techNum(block.consumption, 0);
    if (consumption <= 0) return;

    const comps = (block.components || []).filter(c => c.component && inventory[c.component]);
    const totalVolume = comps.reduce((sum, c) => sum + techNum(c.volume, 0), 0);
    if (!totalVolume) return;

    let mixCostPerMl = 0;
    comps.forEach(c => {
      const pricePerLiter = techNum(inventory[c.component].pricePerLiter, 0);
      mixCostPerMl += (techNum(c.volume, 0) / totalVolume) * (pricePerLiter / 1000);
    });
    rate += consumption * mixCostPerMl;
  });

  return rate;
}

function getTechItemArea(d, catKey) {
  if (d.name && d.name.endsWith('End')) return 0;
  if (catKey === 'posts') {
    const t = techNum(d.T, 80);
    const w = techNum(d.W, 80);
    return (2 * (t + w) * techNum(d.L, 0)) / 1e6;
  }
  if (catKey === 'baluster') return (Math.PI * 45 * techNum(d.L, 0)) / 1e6;

  const dxf = d.name ? dxfCache[d.name] : null;
  if (dxf) {
    return (dxf.area / 1e6) * 2 + (dxf.perimeter / 1000) * (techNum(d.T, 0) / 1000);
  }
  return (2 * techNum(d.W, 0) * techNum(d.L, 0)) / 1e6;
}

/* Площадь одной плоскости склейки: для щитов и ступеней клей считается
   по площади контура, а не по двум лицам и кромкам. */
function getTechGlueArea(items) {
  let total = 0;
  (items || []).forEach(d => {
    if (d.name && d.name.endsWith('End')) return;
    const dxf = d.name ? dxfCache[d.name] : null;
    total += dxf ? (dxf.area / 1e6) : ((techNum(d.W, 0) * techNum(d.L, 0)) / 1e6);
  });
  return total;
}

/* Категории, которые изготовляются как щит из ламелей 50×50 → 45×45. */
const TECH_PANEL_CATEGORIES = new Set([
  'treads', 'welcome_steps', 'stringers', 'kosour', 'covering'
]);

/* Тонкие детали (подступенки) — из доски, а не из бруска 50×50. */
const TECH_BOARD_CATEGORIES = new Set(['risers', 'welcome_risers']);

function getTechDetailType(d, catKey) {
  const type = d.type || '';
  if (type === 'Step') {
    if (d.subtype === 'bullnose') return 'Пригласительная';
    if (String(d.subtype || '').toLowerCase().indexOf('wind') !== -1) return 'Забежная';
    return 'Прямая';
  }
  if (type === 'Riser') return 'Подступенок';
  if (type === 'String') return String(d.stringtype || '').toLowerCase() === 'cut' ? 'Косоур' : 'Тетива';
  if (type === 'Newel') return 'Столб';
  if (type === 'NewelCap') return 'Заглушка столба';
  if (type === 'Handrail') return 'Поручень';
  if (type === 'Baluster') return 'Балясина';
  if (type === 'Bottomrail') return 'Подбалясенник';
  if (type === 'Covering') return 'Панель перекрытия';
  return (TECH_CATEGORY_META[catKey] && TECH_CATEGORY_META[catKey].name) || type || catKey;
}

/* Данные для закупки/изготовления:
   - щит: количество ламелей ceil(W/45) и длина заготовки (L + 100, кратно 50);
   - тонкая деталь: доска 50 мм (сосна) или 30 мм (твердолиственные);
   - брус: толщина доски 50 мм, при сечении больше толщины — несколько слоёв;
   - балясина: брусок 50×50×1000. */
function getTechLamelInfo(d, catKey, woodKey) {
  const t = techNum(d.T, 0);
  const w = techNum(d.W, 0);
  const l = techNum(d.L, 0);
  const key = woodKey || getTechWoodKey(catKey);
  const isPine = key === 'pine';
  const thinBoard = isPine ? 50 : 30;

  if (catKey === 'baluster') {
    const blank = getBalusterBlankMm();
    return {
      text: 'брус ' + blank.thickness + '×' + blank.width + '×' + blank.length + ' (точение)',
      count: 0,
      length: blank.length,
      isPanel: false,
      boardThickness: 50,
      barCount: 1,
      barLength: blank.length,
      rawVolume: (blank.thickness * blank.width * blank.length) / 1e9
    };
  }

  if (TECH_PANEL_CATEGORIES.has(catKey) && t >= 35 && w >= 120 && l > 0) {
    const count = Math.ceil(w / 45);
    const length = Math.ceil((l + 100) / 50) * 50;
    return {
      text: count + ' шт × ' + length + ' мм',
      count: count,
      length: length,
      isPanel: true,
      boardThickness: 50,
      barCount: count,
      barLength: length,
      rawVolume: (count * 50 * 50 * length) / 1e9
    };
  }

  if ((TECH_BOARD_CATEGORIES.has(catKey) || (w >= 120 && t > 0 && t < 35)) && l > 0) {
    const length = Math.ceil((l + 50) / 50) * 50;
    return {
      text: 'доска ' + thinBoard + '×' + w + '×' + length,
      count: 0,
      length: length,
      isPanel: false,
      boardThickness: thinBoard,
      barCount: 1,
      barLength: length,
      rawVolume: (thinBoard * w * length) / 1e9
    };
  }

  const barW = w || 80;
  const isPost = catKey === 'posts' || d.type === 'Newel';
  const boardLength = l > 0 ? Math.ceil((l + (isPost ? 200 : 100)) / 50) * 50 : 0;
  const boardThickness = (t > 0 && t <= 25) ? thinBoard : 50;

  if (t > 0 && t <= 25) {
    return {
      text: 'доска ' + boardThickness + '×' + barW + '×' + boardLength,
      count: 0,
      length: boardLength,
      isPanel: false,
      boardThickness: boardThickness,
      barCount: 1,
      barLength: boardLength,
      rawVolume: (boardThickness * barW * boardLength) / 1e9
    };
  }

  const barsNeeded = Math.max(1, Math.ceil(t / 45)) * Math.max(1, Math.ceil(barW / 45));
  const boardWidth = Math.max(100, Math.ceil((barW + 30) / 10) * 10);
  const stripsPerBoard = Math.max(1, Math.floor((boardWidth - 10) / 45));
  const boardsNeeded = Math.ceil(barsNeeded / stripsPerBoard);
  return {
    text: boardsNeeded + ' доск. 50×' + boardWidth + '×' + boardLength + ' (' + barsNeeded + ' брус. 45×45)',
    count: 0,
    length: boardLength,
    isPanel: false,
    boardThickness: boardThickness,
    barCount: barsNeeded,
    barLength: boardLength,
    boardsNeeded: boardsNeeded,
    barWidth: boardWidth,
    rawVolume: (boardsNeeded * boardThickness * boardWidth * boardLength) / 1e9
  };
}

function getTechPlugForCategory(catKey) {
  const map = { treads: 'Step', welcome_steps: 'Step', handrail: 'Handrail', posts: 'Post' };
  const type = map[catKey];
  if (!type) return null;
  const plugs = (productionPrices && productionPrices.plugs) || {};
  return plugs[type] || null;
}

function calcTechCategory(catKey, items) {
  const meta = TECH_CATEGORY_META[catKey] || {
    name: catKey,
    detail: 'Step_straight',
    works: ['calibration', 'cnc_programming', 'cnc_cutting', 'sanding']
  };
  const wood = getTechWood(catKey);
  const settings = (productionPrices && productionPrices.settings) || {};
  const blank = getBalusterBlankMm();
  const detailCoef = getTechDetailCoef(catKey, items);
  const isBaluster = catKey === 'baluster';

  let area = 0;
  let volume = 0;
  let finishedVolume = 0;
  let procurementVolume = 0;
  let woodCost = 0;
  const itemRows = [];

  (items || []).forEach(d => {
    const itemArea = getTechItemArea(d, catKey);
    area += itemArea;

    const srcT = techNum(d.T, 0);
    const srcW = techNum(d.W, 0);
    const srcL = techNum(d.L, 0);
    const lamel = getTechLamelInfo(d, catKey, wood.key);

    let displayVolume, displayDims;
    if (isBaluster) {
      displayVolume = (blank.thickness * blank.width * blank.length) / 1e9;
      displayDims = blank.thickness + '×' + blank.width + '×' + blank.length;
    } else {
      displayVolume = (srcT * srcW * srcL) / 1e9;
      displayDims = srcT + '×' + srcW + '×' + srcL;
    }

    // Дерево покупаем по заготовке: ламели 50×50, брус, балясина 50×50×1000.
    // Строгание 50×50 → 45×45 — это работа, а не потеря материала.
    const itemCost = lamel.rawVolume * wood.pricePerM3;
    volume += lamel.rawVolume;
    finishedVolume += displayVolume;
    procurementVolume += lamel.rawVolume;
    woodCost += itemCost;

    itemRows.push({
      name: d.name || '—',
      type: getTechDetailType(d, catKey),
      dims: displayDims,
      volume: displayVolume,
      lamels: lamel.text,
      lamelCount: lamel.count,
      lamelLength: lamel.length,
      isPanel: lamel.isPanel,
      rawVolume: lamel.rawVolume,
      boardThickness: lamel.boardThickness,
      barCount: lamel.barCount,
      barLength: lamel.barLength,
      woodKey: wood.key,
      cost: itemCost,
      area: itemArea,
      category: meta.name
    });
  });

  const workRows = [];
  const workBaseMap = new Map();
  let workCost = 0;
  const glueArea = getTechGlueArea(items);

  if (isBaluster) {
    const bw = (productionPrices.baluster_work && productionPrices.baluster_work[wood.key]) || null;
    const base = bw ? techNum(bw.base_per_pcs, 0) : 0;
    const markup = bw ? techNum(bw.markup_percent, 0) : 0;
    const piece = base * (1 + markup / 100);
    const amount = piece * items.length;
    workRows.push({
      key: 'baluster_turning',
      name: 'Точение балясин',
      category: meta.name,
      qty: items.length,
      unit: 'pcs',
      amount: amount,
      piece: piece,
      markup: markup
    });
    workCost += amount;
  } else {
    let workKeys = (meta.works || []).slice();
    const maxLength = items.reduce((max, d) => Math.max(max, techNum(d.L, 0)), 0);
    if (workKeys.indexOf('glue_short') !== -1 && maxLength > 2000) {
      workKeys = workKeys.map(k => k === 'glue_short' ? 'glue_long' : k);
    }
    const lengthM = items.reduce((sum, d) => sum + techNum(d.L, 0), 0) / 1000;

    workKeys.forEach(key => {
      const work = productionPrices.works && productionPrices.works[key];
      if (!work) return;
      const unit = work.unit || 'pcs';
      const isGlue = key === 'glue_short' || key === 'glue_long';
      const qty = isGlue ? glueArea : (unit === 'm2' ? area : (unit === 'm' ? lengthM : items.length));
      const perUnit = techNum(work.perUnit, 0);
      const amount = perUnit * qty * detailCoef * wood.workCoef;
      const base = techNum(work.base, 0);

      if (amount !== 0 || base !== 0) {
        workRows.push({
          key: key,
          name: work.name || key,
          category: meta.name,
          qty: qty,
          unit: unit,
          amount: amount,
          base: base,
          detailCoef: detailCoef,
          workCoef: wood.workCoef
        });
        workCost += amount;
        if (base !== 0) workBaseMap.set(key, { key: key, name: work.name || key, base: base });
      }
    });
  }

  let paintMaterial = 0;
  let paintLabor = 0;
  let paintName = 'Без покраски';
  const paintSel = getTechPaintRecipe(catKey);
  if (paintSel) {
    const paintWork = productionPrices.works && productionPrices.works.painting;
    paintMaterial = area * getTechPaintMaterialRate(paintSel.recipe);
    paintLabor = area * techNum(paintWork && paintWork.perUnit, 0);
    paintName = paintSel.recipe.name || paintSel.key;
  }

  let hardwareCost = 0;
  const hardwareRows = [];
  const hardware = (productionPrices.hardware) || {};

  if (meta.glue && area > 0) {
    const glueKg = glueArea * techNum(settings.glue_consumption_kg_m2, 0);
    const gluePrice = techNum(hardware.glue_kg && hardware.glue_kg.pricePerKg, 0);
    const glueCost = glueKg * gluePrice;
    if (glueCost > 0) {
      hardwareCost += glueCost;
      hardwareRows.push({ name: 'Клей', qty: glueKg, unit: 'кг', cost: glueCost });
    }
  }

  const plug = getTechPlugForCategory(catKey);
  if (plug) {
    const plugHw = hardware[plug.hardware];
    const qty = items.length * techNum(plug.qtyPerItem, 0);
    const cost = qty * techNum(plugHw && plugHw.pricePerPcs, 0);
    if (cost > 0) {
      hardwareCost += cost;
      hardwareRows.push({ name: plug.name || 'Заглушки', qty: qty, unit: 'шт', cost: cost });
    }
  }

  const costBeforeOverhead = woodCost + workCost + paintMaterial + paintLabor + hardwareCost;

  return {
    key: catKey,
    name: meta.name,
    wood: wood,
    count: items.length,
    area: area,
    volume: volume,
    finishedVolume: finishedVolume,
    procurementVolume: procurementVolume,
    woodCost: woodCost,
    workCost: workCost,
    workRows: workRows,
    workBaseMap: Array.from(workBaseMap.values()),
    paintName: paintName,
    paintMaterial: paintMaterial,
    paintLabor: paintLabor,
    paintCost: paintMaterial + paintLabor,
    hardwareCost: hardwareCost,
    hardwareRows: hardwareRows,
    costBeforeOverhead: costBeforeOverhead,
    overhead: 0,
    cost: costBeforeOverhead,
    markup: 0,
    usn: 0,
    final: costBeforeOverhead,
    items: itemRows
  };
}

function calculateTechGroup(bomGroup, section) {
  const classified = classifyBOMItems(bomGroup.items, bomGroup.floor);
  const categoryMap = section === 'stair' ? classified.stair : classified.railing;
  const prefix = section === 'stair' ? ('s' + bomGroup.floor) : ('r' + (bomGroup.floor + 1));
  const catKeys = Object.keys(categoryMap).filter(key =>
    categoryMap[key] && categoryMap[key].length && isElementIncluded(prefix + '_' + key)
  );
  if (!catKeys.length) return null;

  const balusterSize = getBalusterSizeForGroup(prefix, categoryMap, bomGroup);
  const categories = catKeys.map(key => {
    const category = calcTechCategory(key, categoryMap[key]);
    category.blockKey = prefix + '_' + key;
    if (key === 'baluster') category.name += ' (' + balusterSize + ')';
    return category;
  });

  const area = categories.reduce((sum, c) => sum + c.area, 0);
  const lamelMap = new Map();
  let lamelCount = 0;
  let lamelVolume = 0;
  let procurementVolume = 0;
  const boardVolumeMap = new Map();
  categories.forEach(c => {
    c.items.forEach(item => {
      procurementVolume += item.rawVolume || 0;
      boardVolumeMap.set(item.boardThickness, (boardVolumeMap.get(item.boardThickness) || 0) + (item.rawVolume || 0));
      if (item.isPanel && item.lamelCount > 0) {
        lamelMap.set(item.lamelLength, (lamelMap.get(item.lamelLength) || 0) + item.lamelCount);
        lamelCount += item.lamelCount;
        lamelVolume += item.rawVolume || 0;
      }
    });
  });
  const lamelRows = Array.from(lamelMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(pair => ({ length: pair[0], count: pair[1] }));
  const boardVolumes = Array.from(boardVolumeMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(pair => ({ thickness: pair[0], volume: pair[1] }));

  const settings = (productionPrices && productionPrices.settings) || {};
  const overheads = (productionPrices && productionPrices.overheads) || {};
  const rent = techNum(overheads.rent, 0);
  const workingDays = techNum(overheads.working_days_per_month, 22);
  const electricityDay = techNum(overheads.electricity_price, 0) * techNum(overheads.electricity_usage_kw, 0);
  const normM2Day = techNum(overheads.production_norm_m2_per_day, 0);
  const overheadPerM2 = (workingDays > 0 && normM2Day > 0)
    ? ((rent / workingDays) + electricityDay) / normM2Day
    : 0;

  const markupPercent = techNum(settings.markup_percent, 40);
  const usnPercent = techNum(settings.usn_percent, 6);

  categories.forEach(c => {
    c.overhead = c.area * overheadPerM2;
    c.productionCost = c.woodCost + c.workCost + c.hardwareCost + c.overhead;
    c.productionMarkup = c.productionCost * markupPercent / 100;
    c.productionPrice = c.productionCost + c.productionMarkup;
    c.cost = c.costBeforeOverhead + c.overhead;
    c.markup = c.cost * markupPercent / 100;
    c.usn = (c.cost + c.markup) * usnPercent / 100;
    c.final = c.cost + c.markup + c.usn;
  });

  const baseMap = new Map();
  categories.forEach(c => c.workBaseMap.forEach(item => baseMap.set(item.key, item)));
  const baseRows = Array.from(baseMap.values()).map(item => ({
    key: item.key,
    name: item.name + ' (настройка)',
    category: 'Группа',
    qty: 1,
    unit: 'компл.',
    amount: item.base
  }));

  const sum = (field) => categories.reduce((total, c) => total + c[field], 0) + (field === 'workCost' ? baseRows.reduce((total, r) => total + r.amount, 0) : 0);
  const productionCost = sum('woodCost') + sum('workCost') + sum('hardwareCost') + sum('overhead');
  const productionMarkup = productionCost * markupPercent / 100;
  const productionPrice = productionCost + productionMarkup;
  const totals = {
    area: area,
    count: categories.reduce((total, c) => total + c.count, 0),
    finishedVolume: sum('finishedVolume'),
    procurementVolume: procurementVolume,
    lamelCount: lamelCount,
    lamelVolume: lamelVolume,
    woodCost: sum('woodCost'),
    workCost: sum('workCost'),
    paintMaterial: sum('paintMaterial'),
    paintLabor: sum('paintLabor'),
    paintCost: sum('paintCost'),
    hardwareCost: sum('hardwareCost'),
    overhead: sum('overhead'),
    productionCost: productionCost,
    productionMarkup: productionMarkup,
    productionPrice: productionPrice,
    cost: sum('cost'),
    markup: sum('markup'),
    usn: sum('usn'),
    final: sum('final')
  };

  return {
    title: section === 'stair'
      ? ('Лестница ' + bomGroup.floor + '→' + (bomGroup.floor + 1))
      : ('Ограждение ' + (bomGroup.floor + 1) + ' этажа'),
    file: bomGroup.file,
    floor: bomGroup.floor,
    section: section,
    balusterSize: balusterSize,
    categories: categories,
    lamelRows: lamelRows,
    lamelCount: lamelCount,
    lamelVolume: lamelVolume,
    boardVolumes: boardVolumes,
    procurementVolume: procurementVolume,
    finishedVolume: sum('finishedVolume'),
    workRows: categories.reduce((rows, c) => rows.concat(c.workRows), []).concat(baseRows),
    baseRows: baseRows,
    overheadPerM2: overheadPerM2,
    markupPercent: markupPercent,
    usnPercent: usnPercent,
    totals: totals
  };
}

function calculateTechCard() {
  if (!productionPrices) return null;
  if (!bomGroups || !bomGroups.length) return null;

  const groups = [];
  bomGroups.forEach(group => {
    const stair = calculateTechGroup(group, 'stair');
    if (stair) groups.push(stair);
    const railing = calculateTechGroup(group, 'railing');
    if (railing) groups.push(railing);
  });

  if (!groups.length) return null;

  const totals = {
    area: 0, count: 0, finishedVolume: 0, procurementVolume: 0, lamelCount: 0, lamelVolume: 0,
    woodCost: 0, workCost: 0,
    paintMaterial: 0, paintLabor: 0, paintCost: 0,
    hardwareCost: 0, overhead: 0, productionCost: 0, productionMarkup: 0, productionPrice: 0,
    cost: 0, markup: 0, usn: 0, final: 0
  };
  groups.forEach(g => {
    for (const key of Object.keys(totals)) totals[key] += g.totals[key] || 0;
  });

  return { groups: groups, totals: totals };
}

/* ═══════════════════════════════════════════════════════════════
   МОНТАЖНЫЙ БЛОК
   196,80 × N_K + 142,80 × S_K; N_K — количество с размерным
   коэффициентом, S_K — площадь поверхностей с коэффициентом.
   База: труд 14 ₽/чел.-мин, накладные 4,30 ₽/чел.-мин,
   подача 4 000 ₽, проезд 1 000 ₽, крепёж 262,40 ₽.
   Наценка 30% к базе, УСН 6% в цене заказчика.
   ═══════════════════════════════════════════════════════════════ */
const MONTAGE_WORKERS = 2;
const MONTAGE_LABOR_RATE = 14;
const MONTAGE_OVERHEAD_RATE = 4.30;
const MONTAGE_LOADING = 4000;
const MONTAGE_TRAVEL = 1000;
const MONTAGE_FASTENERS = 262.40;
const MONTAGE_MARKUP = 0.30;
const MONTAGE_USN = 0.06;

function montageSizeCoefficient(type, area) {
  if (type === 'Step') return area > 0.445 ? 1.25 : 1;
  if (type === 'String') return area > 1.35 ? 1.5 : (area > 0.5 ? 1.25 : 1);
  if (type === 'Handrail') return area > 0.5 ? 1.5 : (area > 0.25 ? 1.25 : 1);
  if (type === 'Bottomrail') return area > 0.4 ? 1.5 : 1;
  if (type === 'Newel') return area > 0.5 ? 1.25 : 1;
  if (type === 'Baluster') return area > 0.16 ? 1.25 : 1;
  return 1;
}

function calculateMontageBlock() {
  if (!bomGroups || !bomGroups.length) return null;
  let nk = 0;
  let sk = 0;
  let parts = 0;

  for (const group of bomGroups) {
    const classified = classifyBOMItems(group.items, group.floor);
    for (const section of ['stair', 'railing']) {
      const prefix = section === 'stair' ? 's' + group.floor : 'r' + (group.floor + 1);
      const categoryMap = section === 'stair' ? classified.stair : classified.railing;
      for (const catKey in categoryMap) {
        const items = categoryMap[catKey];
        if (!items || !items.length) continue;
        if (!isElementIncluded(prefix + '_' + catKey)) continue;
        for (const detail of items) {
          const area = getTechItemArea(detail, catKey);
          const coefficient = montageSizeCoefficient(detail.type || '', area);
          nk += coefficient;
          sk += area * coefficient;
          parts++;
        }
      }
    }
  }

  if (!parts) return null;
  const operations = 196.80 * nk + 142.80 * sk;
  const personMinutes = operations / 18.30;
  const labor = MONTAGE_LABOR_RATE * personMinutes;
  const overhead = MONTAGE_OVERHEAD_RATE * personMinutes;
  const base = labor + overhead + MONTAGE_LOADING + MONTAGE_TRAVEL + MONTAGE_FASTENERS;
  const markup = base * MONTAGE_MARKUP;
  const final = Math.round((base + markup) / (1 - MONTAGE_USN));
  const usn = final * MONTAGE_USN;

  return {
    parts: parts,
    nk: nk,
    sk: sk,
    operations: operations,
    personMinutes: personMinutes,
    labor: labor,
    overhead: overhead,
    loading: MONTAGE_LOADING,
    travel: MONTAGE_TRAVEL,
    fasteners: MONTAGE_FASTENERS,
    base: base,
    markup: markup,
    usn: usn,
    final: final,
    workers: MONTAGE_WORKERS,
    durationHours: personMinutes / MONTAGE_WORKERS / 60
  };
}

/* ═══════════════════════════════════════════════════════════════
   ДОПОЛНИТЕЛЬНЫЕ СТРОКИ БЛОКОВ: МОНТАЖ / ПОКРАСКА / УСН
   Суммы блоков не входят в стоимость блока: они собираются
   в основной калькулятор отдельными строками.
   ═══════════════════════════════════════════════════════════════ */
const techCardOptions = { paint: true, montage: true, usn: true };
const techCardBlockExtras = {};
let techCardDataCache = null;

function getTechCardMountingRate() {
  const work = productionPrices && productionPrices.works && productionPrices.works.mounting;
  return techNum(work && work.perUnit, 800);
}

function ensureTechCardExtras(data) {
  if (!data || !data.groups) return;
  const rate = getTechCardMountingRate();
  data.groups.forEach(group => {
    (group.categories || []).forEach(category => {
      const key = category.blockKey;
      if (!techCardBlockExtras[key]) {
        techCardBlockExtras[key] = {
          paint: Math.round(category.paintCost || 0),
          montage: Math.round(techNum(category.area, 0) * rate)
        };
      }
    });
  });
}

function getTechCardMainTotals(data) {
  if (!data || !data.groups) return null;
  ensureTechCardExtras(data);
  const production = data.groups.reduce((sum, g) => sum + techNum(g.totals.productionPrice, 0), 0);
  let paint = 0;
  data.groups.forEach(group => {
    (group.categories || []).forEach(category => {
      const extras = techCardBlockExtras[category.blockKey] || {};
      if (techCardOptions.paint) paint += techNum(extras.paint, 0);
    });
  });
  const montageBlock = calculateMontageBlock();
  const montage = techCardOptions.montage && montageBlock ? montageBlock.final : 0;
  const usnRate = techNum(productionPrices && productionPrices.settings && productionPrices.settings.usn_percent, 6);
  const usnBase = production + paint;
  const usn = techCardOptions.usn ? usnBase * usnRate / 100 : 0;
  return {
    production: production,
    paint: paint,
    montage: montage,
    montageBlock: montageBlock,
    usn: usn,
    usnRate: usnRate,
    usnBase: usnBase,
    total: production + paint + montage + usn
  };
}

function getTechCardUsnShare(category, main) {
  if (!main || !techCardOptions.usn || main.usnBase <= 0) return 0;
  const extras = techCardBlockExtras[category.blockKey] || { paint: 0, montage: 0 };
  const blockBase = techNum(category.productionPrice, 0) +
    (techCardOptions.paint ? techNum(extras.paint, 0) : 0);
  return main.usn * blockBase / main.usnBase;
}

function escapeTechHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function renderTechCard(data) {
  if (!data) return '';
  const t = data.totals;
  const fmtM2 = v => (Number(v) || 0).toFixed(2) + ' м²';
  const fmtM3 = v => (Number(v) || 0).toFixed(3) + ' м³';
  const main = getTechCardMainTotals(data);

  let html = '<div class="tech-procurement-head">' +
    '<div><div class="tech-procurement-title">Данные для закупки и изготовления</div>' +
    '<div class="tech-muted">Все детали из XML: габариты, объём, ламели/заготовки и материал. Стоимость — справочно, в конце каждой группы.</div></div>' +
    '<div class="tech-procurement-total"><b>' + t.count + '</b> деталей<br><b>' + t.lamelCount + '</b> ламелей<br><b>' + fmtM3(t.procurementVolume) + '</b> заготовок</div>' +
    '</div>';

  if (main) {
    html += '<div class="tech-main-panel">' +
      '<div class="tech-main-toggles">' +
        '<label><input type="checkbox" id="techOptPaint"' + (techCardOptions.paint ? ' checked' : '') + '> Покраска</label>' +
        '<label><input type="checkbox" id="techOptMontage"' + (techCardOptions.montage ? ' checked' : '') + '> Монтаж</label>' +
        '<label><input type="checkbox" id="techOptUsn"' + (techCardOptions.usn ? ' checked' : '') + '> УСН ' + techNum(main.usnRate, 6) + '%</label>' +
      '</div>' +
      '<div class="tech-main-totals">' +
        '<div><span>Производство с наценкой</span><b>' + formatRub(main.production) + '</b></div>' +
        '<div class="' + (techCardOptions.paint ? '' : 'tech-off') + '"><span>Покраска всех блоков</span><b>' + (techCardOptions.paint ? formatRub(main.paint) : 'отключено') + '</b></div>' +
        '<div class="' + (techCardOptions.montage ? '' : 'tech-off') + '"><span>Монтаж всех блоков</span><b>' + (techCardOptions.montage ? formatRub(main.montage) : 'отключено') + '</b></div>' +
        '<div class="' + (techCardOptions.usn ? '' : 'tech-off') + '"><span>УСН ' + techNum(main.usnRate, 6) + '%</span><b>' + (techCardOptions.usn ? formatRub(main.usn) : 'отключено') + '</b></div>' +
        '<div class="tech-main-final"><span>Итого без доставки</span><b>' + formatRub(main.total) + '</b></div>' +
      '</div>' +
      '<div class="tech-main-note">Покраска и монтаж не входят в стоимость блока: суммы блоков собираются здесь отдельными строками. Монтаж считается монтажным блоком; распределение по блокам — справочно. УСН начисляется на производство и покраску, монтажный блок уже содержит свой УСН.</div>' +
      '</div>';
  }

  if (main && main.montageBlock) {
    const mb = main.montageBlock;
    html += '<details class="tech-cost-details"><summary>Монтажный блок · <b>' + formatRub(mb.final) + '</b></summary>' +
      '<div class="tech-totals-grid">' +
        '<div class="tech-kpi"><span>Деталей</span><b>' + mb.parts + '</b></div>' +
        '<div class="tech-kpi"><span>N_K</span><b>' + mb.nk.toFixed(2) + '</b></div>' +
        '<div class="tech-kpi"><span>S_K</span><b>' + mb.sk.toFixed(3) + ' м²</b></div>' +
        '<div class="tech-kpi"><span>Монтажные операции</span><b>' + formatRub(mb.operations) + '</b></div>' +
        '<div class="tech-kpi"><span>Человеко-минуты</span><b>' + Math.round(mb.personMinutes) + '</b></div>' +
        '<div class="tech-kpi"><span>Бригада</span><b>' + mb.workers + ' чел. · ' + mb.durationHours.toFixed(2) + ' ч</b></div>' +
        '<div class="tech-kpi"><span>Оплата монтажников</span><b>' + formatRub(mb.labor) + '</b></div>' +
        '<div class="tech-kpi"><span>Накладные</span><b>' + formatRub(mb.overhead) + '</b></div>' +
        '<div class="tech-kpi"><span>Подача</span><b>' + formatRub(mb.loading) + '</b></div>' +
        '<div class="tech-kpi"><span>Проезд</span><b>' + formatRub(mb.travel) + '</b></div>' +
        '<div class="tech-kpi"><span>Крепёж</span><b>' + formatRub(mb.fasteners) + '</b></div>' +
        '<div class="tech-kpi"><span>Базовые расходы</span><b>' + formatRub(mb.base) + '</b></div>' +
        '<div class="tech-kpi"><span>Наценка 30%</span><b>' + formatRub(mb.markup) + '</b></div>' +
        '<div class="tech-kpi"><span>УСН 6%</span><b>' + formatRub(mb.usn) + '</b></div>' +
        '<div class="tech-kpi tech-kpi-final"><span>Монтаж заказчику</span><b>' + formatRub(mb.final) + '</b></div>' +
      '</div>' +
      '<div class="tech-note">Формула: 196,80 × N_K + 142,80 × S_K. Веса 80% количество / 20% площадь. Труд 14 ₽/чел.-мин, накладные 4,30 ₽/чел.-мин. База включает подачу 4 000 ₽, проезд 1 000 ₽, крепёж 262,40 ₽. Наценка 30% и УСН 6%.</div>' +
      '</details>';
  }

  html += '<div class="tech-board-picker">' +
    '<div class="tech-board-picker-title">Подбор доски на складе <span>только щиты / ламели</span></div>' +
    '<div class="tech-board-picker-grid">' +
      '<label><span>Порода</span><select id="techBoardWood"></select></label>' +
      '<label><span>Толщина доски</span><select id="techBoardThickness"><option value="50">50 мм</option><option value="30">30 мм</option></select></label>' +
      '<label><span>Ширина доски, мм</span><input type="number" id="techBoardWidth" value="150" min="50" step="5"></label>' +
      '<label><span>Длина доски, мм</span><input type="number" id="techBoardLength" value="3000" min="500" step="50"></label>' +
      '<label><span>Строгание кромки, мм</span><input type="number" id="techBoardEdge" value="3" min="0" step="1"></label>' +
      '<label><span>Пропил, мм</span><input type="number" id="techBoardKerf" value="4" min="0" step="1"></label>' +
    '</div>' +
    '<div id="techBoardResult" class="tech-board-result">Введите фактическую ширину и длину доски.</div>' +
    '<div class="tech-board-note">Ширина и длина на складе плавают. Выход = floor((ширина − строгание кромки − 2 пропила) / 50): покупной брусок 50 мм, после строгания 45 мм. Резерв на кривизну и торцовку — 15%. Объём в таблице — по бруску 50×50, здесь — фактическая доска.</div>' +
    '</div>';

  html += '<details class="tech-cost-details"><summary>Сводка производства и допущения · <b>' + formatRub(t.productionPrice) + '</b></summary>';
  html += '<div class="tech-totals-grid">' +
    '<div class="tech-kpi"><span>Площадь деталей</span><b>' + fmtM2(t.area) + '</b></div>' +
    '<div class="tech-kpi"><span>Дерево</span><b>' + formatRub(t.woodCost) + '</b></div>' +
    '<div class="tech-kpi"><span>Работы</span><b>' + formatRub(t.workCost) + '</b></div>' +
    '<div class="tech-kpi"><span>Покраска (справочно)</span><b>' + formatRub(t.paintCost) + '</b></div>' +
    '<div class="tech-kpi"><span>Фурнитура</span><b>' + formatRub(t.hardwareCost) + '</b></div>' +
    '<div class="tech-kpi"><span>Накладные</span><b>' + formatRub(t.overhead) + '</b></div>' +
    '<div class="tech-kpi"><span>Себестоимость</span><b>' + formatRub(t.productionCost) + '</b></div>' +
    '<div class="tech-kpi"><span>Наценка</span><b>' + formatRub(t.productionMarkup) + '</b></div>' +
    '<div class="tech-kpi tech-kpi-final"><span>Производство</span><b>' + formatRub(t.productionPrice) + '</b></div>' +
    '</div>';

  html += '<div class="tech-note">Техкарта внутренняя: цены древесины за м³, работы по нормам, покраска по рецептам, накладные по норме выработки, наценка и УСН из админки. Балясины считаются от заготовки 50×50×1000 мм и работы за штуку.</div>';

  const settings = (productionPrices && productionPrices.settings) || {};
  const overheads = (productionPrices && productionPrices.overheads) || {};
  const cncWork = productionPrices && productionPrices.works && productionPrices.works.cnc_programming;
  html += '<div class="tech-note tech-note-assumptions"><b>Допущения расчёта:</b> ' +
    'дерево — по заготовкам: щиты 50×50, доска 50/30 мм, столбы 2 доски 50×100–120, балясина 50×50×1000; строгание — работа (калибровка); ' +
    'клей — по одной плоскости склейки; ' +
    'УП ЧПУ — ' + formatRub(techNum(cncWork && cncWork.perUnit, 0)) + '/деталь + ' + formatRub(techNum(cncWork && cncWork.base, 0)) + ' на группу; ' +
    'накладные — ' + formatRub(((techNum(overheads.rent, 0) / Math.max(1, techNum(overheads.working_days_per_month, 22))) + techNum(overheads.electricity_price, 0) * techNum(overheads.electricity_usage_kw, 0)) / Math.max(0.0001, techNum(overheads.production_norm_m2_per_day, 5))) + '/м²; ' +
    'наценка ' + techNum(settings.markup_percent, 40) + '% на себестоимость; УСН ' + techNum(settings.usn_percent, 6) + '% сверху.' +
    '</div></details>';

  data.groups.forEach(group => {
    const g = group.totals;
    html += '<div class="tech-group">' +
      '<div class="tech-group-head"><div><div class="tech-group-title">' + escapeTechHtml(group.title) + '</div>' +
      '<div class="tech-group-sub">' + escapeTechHtml(group.file) + ' · ' + g.count + ' деталей · ' + fmtM2(g.area) + ' · заготовок ' + fmtM3(g.procurementVolume) + ' · балясины ' + escapeTechHtml(group.balusterSize) + '</div></div></div>';

    html += '<div class="tech-subhead">Закупка и изготовление</div>';
    const boardText = (group.boardVolumes || []).map(b => b.thickness + ' мм — ' + fmtM3(b.volume)).join(' · ');
    if (group.lamelRows.length || boardText) {
      html += '<div class="tech-lamel-summary">';
      if (group.lamelRows.length) {
        html += '<b>Ламели 50×50 → 45×45:</b> ' +
          group.lamelRows.map(row => row.count + ' × ' + row.length + ' мм').join(' · ') +
          '<span>Всего ' + group.lamelCount + ' шт · объём ламелей ' + fmtM3(group.lamelVolume) + '</span>';
      }
      if (boardText) html += '<span>Заготовки по толщине: ' + boardText + '</span>';
      html += '</div>';
    }

    html += '<div class="tech-table-wrap"><table class="tech-table tech-table-procurement"><thead><tr>' +
      '<th>Щит / Деталь</th><th>Тип</th><th>Габариты, мм</th><th>Объём детали / заготовки, м³</th><th>Ламели / заготовка</th>' +
      '</tr></thead><tbody>';

    group.categories.forEach(c => {
      html += '<tr class="tech-cat-row"><td colspan="5"><b>' + escapeTechHtml(c.name) + '</b> · ' + c.count + ' шт · ' + escapeTechHtml(c.wood.name) + '</td></tr>';
      c.items.forEach(item => {
        html += '<tr>' +
          '<td>' + escapeTechHtml(item.name) + '</td>' +
          '<td>' + escapeTechHtml(item.type) + '</td>' +
          '<td>' + escapeTechHtml(item.dims) + '</td>' +
          '<td>' + item.volume.toFixed(3) + ' / ' + item.rawVolume.toFixed(3) + '</td>' +
          '<td>' + escapeTechHtml(item.lamels) + '</td>' +
          '</tr>';
      });
    });
    html += '</tbody></table></div>';

    html += '<div class="tech-subhead">Блоки: монтаж и покраска</div>';
    html += '<div class="tech-table-wrap"><table class="tech-table tech-block-table"><thead><tr>' +
      '<th>Блок</th><th>Производство</th><th>Монтаж, ₽</th><th>Покраска, ₽</th><th>в т.ч. УСН</th>' +
      '</tr></thead><tbody>';
    group.categories.forEach(c => {
      const blockExtras = techCardBlockExtras[c.blockKey] || { paint: 0, montage: 0 };
      const blockUsn = getTechCardUsnShare(c, main);
      html += '<tr>' +
        '<td><b>' + escapeTechHtml(c.name) + '</b><div class="tech-muted">' + escapeTechHtml(c.wood.name) + '</div></td>' +
        '<td>' + formatRub(c.productionPrice) + '</td>' +
        '<td><input type="number" data-tech-block="' + escapeTechHtml(c.blockKey) + '" data-tech-field="montage" value="' + Math.round(blockExtras.montage || 0) + '"' + (techCardOptions.montage ? '' : ' disabled') + '></td>' +
        '<td><input type="number" data-tech-block="' + escapeTechHtml(c.blockKey) + '" data-tech-field="paint" value="' + Math.round(blockExtras.paint || 0) + '"' + (techCardOptions.paint ? '' : ' disabled') + '></td>' +
        '<td>' + (techCardOptions.usn ? formatRub(blockUsn) : '—') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<details class="tech-cost-details"><summary>Производство по категориям · <b>' + formatRub(g.productionPrice) + '</b></summary>';
    html += '<div class="tech-table-wrap"><table class="tech-table"><thead><tr>' +
      '<th>Категория</th><th>Кол-во</th><th>Площадь</th><th>Дерево</th><th>Работы</th><th>Покраска</th><th>Фурнитура</th><th>Накладные</th><th>Производство</th>' +
      '</tr></thead><tbody>';

    group.categories.forEach(c => {
      html += '<tr>' +
        '<td><b>' + escapeTechHtml(c.name) + '</b><div class="tech-muted">' + escapeTechHtml(c.wood.name) + ' · ' + fmtM3(c.volume) + '</div></td>' +
        '<td>' + c.count + ' шт</td>' +
        '<td>' + fmtM2(c.area) + '</td>' +
        '<td>' + formatRub(c.woodCost) + '</td>' +
        '<td>' + formatRub(c.workCost) + '</td>' +
        '<td>' + formatRub(c.paintCost) + '<div class="tech-muted">' + escapeTechHtml(c.paintName) + '</div></td>' +
        '<td>' + formatRub(c.hardwareCost) + '</td>' +
        '<td>' + formatRub(c.overhead) + '</td>' +
        '<td>' + formatRub(c.cost - c.paintCost) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    html += '<div class="tech-group-totals">' +
      '<div><span>Дерево</span><b>' + formatRub(g.woodCost) + '</b></div>' +
      '<div><span>Работы</span><b>' + formatRub(g.workCost) + '</b></div>' +
      '<div><span>Фурнитура</span><b>' + formatRub(g.hardwareCost) + '</b></div>' +
      '<div><span>Накладные</span><b>' + formatRub(g.overhead) + '</b></div>' +
      '<div><span>Себестоимость</span><b>' + formatRub(g.productionCost) + '</b></div>' +
      '<div><span>Наценка ' + group.markupPercent + '%</span><b>' + formatRub(g.productionMarkup) + '</b></div>' +
      '<div class="tech-group-final"><span>Производство</span><b>' + formatRub(g.productionPrice) + '</b></div>' +
      '</div>';
    html += '</details>';

    let workRows = '';
    group.workRows.forEach(w => {
      const qtyText = w.unit === 'm2' ? fmtM2(w.qty) : (w.unit === 'm' ? w.qty.toFixed(2) + ' м' : w.qty + ' ' + (w.unit === 'pcs' ? 'шт' : (w.unit || '')));
      workRows += '<tr><td><b>' + escapeTechHtml(w.category || 'Группа') + '</b><div class="tech-muted">' + escapeTechHtml(w.name) + '</div></td><td>' + qtyText + '</td><td>' + formatRub(w.amount) + '</td></tr>';
    });
    html += '<details class="tech-details"><summary>Работы по группе</summary>' +
      '<div class="tech-table-wrap"><table class="tech-table tech-table-compact"><thead><tr><th>Категория / работа</th><th>Количество</th><th>Стоимость</th></tr></thead><tbody>' +
      workRows + '</tbody></table></div></details>';

    html += '<div class="tech-muted" style="margin-top:8px;">Накладные: ' + formatRub(group.overheadPerM2) + '/м². Покраска: материал + работа.</div>';
    html += '</div>';
  });

  return html;
}

function wireTechBoardCalculator(data) {
  const woodSel = document.getElementById('techBoardWood');
  const thickSel = document.getElementById('techBoardThickness');
  const widthInput = document.getElementById('techBoardWidth');
  const lengthInput = document.getElementById('techBoardLength');
  const edgeInput = document.getElementById('techBoardEdge');
  const kerfInput = document.getElementById('techBoardKerf');
  const resultEl = document.getElementById('techBoardResult');
  if (!woodSel || !thickSel || !widthInput || !lengthInput || !edgeInput || !kerfInput || !resultEl) return;

  const woods = (productionPrices && productionPrices.woods) || {};
  woodSel.innerHTML = Object.keys(woods).map(key =>
    '<option value="' + escapeTechHtml(key) + '">' + escapeTechHtml(woods[key].name || key) + '</option>'
  ).join('');
  woodSel.value = woods.pine ? 'pine' : (Object.keys(woods)[0] || 'pine');
  thickSel.value = '50';

  const thick30 = thickSel.querySelector('option[value="30"]');
  const loss = techNum(productionPrices && productionPrices.settings && productionPrices.settings.loss_board_percent, 15);

  const calc = () => {
    const woodKey = woodSel.value;
    const isPine = woodKey === 'pine';
    if (isPine) {
      thickSel.value = '50';
      if (thick30) thick30.disabled = true;
    } else if (thick30) {
      thick30.disabled = false;
    }

    const thickness = techNum(thickSel.value, 50);
    const width = techNum(widthInput.value, 150);
    const length = techNum(lengthInput.value, 3000);
    const edge = techNum(edgeInput.value, 3);
    const kerf = techNum(kerfInput.value, 4);

    const items = [];
    (data.groups || []).forEach(group => {
      (group.categories || []).forEach(category => {
        (category.items || []).forEach(item => {
          if (item.isPanel && item.woodKey === woodKey && item.boardThickness === thickness) items.push(item);
        });
      });
    });

    if (!items.length) {
      resultEl.innerHTML = 'Для этой породы и толщины щитов нет. Щиты делаются из ламелей 50 мм; 30 мм — для тонких деталей.';
      return;
    }

    const bars = items.reduce((sum, item) => sum + techNum(item.barCount, 0), 0);
    const linearM = items.reduce((sum, item) => sum + techNum(item.barCount, 0) * techNum(item.barLength, 0) / 1000, 0);
    const usable = Math.max(0, Math.floor((width - edge - kerf * 2) / 50));
    const usableExact = (width - edge - kerf * 2) / 50;
    const boards = (usable > 0 && length > 0)
      ? Math.ceil((linearM / (usable * (length / 1000))) * (1 + loss / 100))
      : 0;
    const volume = (boards * thickness * width * length) / 1e9;
    const wood = woods[woodKey] || {};
    const cost = volume * techNum(wood.pricePerM3, 0);
    const lamelWord = usable === 1 ? 'ламель' : ((usable >= 2 && usable <= 4) ? 'ламели' : 'ламелей');
    const panelBaseCost = items.reduce((sum, item) => sum + techNum(item.cost, 0), 0);
    const markupPct = techNum(productionPrices && productionPrices.settings && productionPrices.settings.markup_percent, 40);
    const usnPct = techNum(productionPrices && productionPrices.settings && productionPrices.settings.usn_percent, 6);
    const finalWithPurchase = data.totals.final + (cost - panelBaseCost) * (1 + markupPct / 100) * (1 + usnPct / 100);

    resultEl.innerHTML =
      '<div><span>Ламелей в щитах</span><b>' + bars + ' шт</b></div>' +
      '<div><span>Общая длина ламелей</span><b>' + linearM.toFixed(1) + ' м</b></div>' +
      '<div><span>Выход с одной доски</span><b>' + usable + ' ' + lamelWord + '</b></div>' +
      '<div><span>Нужно досок</span><b>' + boards + ' шт</b></div>' +
      '<div><span>Объём доски</span><b>' + volume.toFixed(3) + ' м³</b></div>' +
      '<div><span>Дерево на щиты</span><b>' + formatRub(cost) + '</b></div>' +
      '<div class="tech-board-final"><span>Цена техкарты при этой доске</span><b>' + formatRub(finalWithPurchase) + '</b><small>база: ' + formatRub(data.totals.final) + '</small></div>' +
      '<div class="tech-board-formula">' + width + ' − ' + edge + ' − ' + kerf + ' − ' + kerf + ' = ' + (width - edge - kerf * 2) + ' мм; ' + (width - edge - kerf * 2) + ' / 50 = ' + usableExact.toFixed(2) + ' → ' + usable + ' ' + lamelWord + '; резерв ' + loss + '%</div>';
  };

  ['input', 'change'].forEach(evt => {
    woodSel.addEventListener(evt, calc);
    thickSel.addEventListener(evt, calc);
    widthInput.addEventListener(evt, calc);
    lengthInput.addEventListener(evt, calc);
    edgeInput.addEventListener(evt, calc);
    kerfInput.addEventListener(evt, calc);
  });
  calc();
}

function wireTechCardExtras(data) {
  const paintToggle = document.getElementById('techOptPaint');
  const montageToggle = document.getElementById('techOptMontage');
  const usnToggle = document.getElementById('techOptUsn');
  const refresh = () => {
    if (paintToggle) techCardOptions.paint = paintToggle.checked;
    if (montageToggle) techCardOptions.montage = montageToggle.checked;
    if (usnToggle) techCardOptions.usn = usnToggle.checked;
    buildTechCardModal();
  };
  [paintToggle, montageToggle, usnToggle].forEach(el => {
    if (el) el.addEventListener('change', refresh);
  });

  document.querySelectorAll('#techCardBody [data-tech-block]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.techBlock;
      const field = input.dataset.techField;
      if (!techCardBlockExtras[key]) techCardBlockExtras[key] = { paint: 0, montage: 0 };
      techCardBlockExtras[key][field] = Number(input.value) || 0;
      buildTechCardModal();
    });
  });
}

async function buildTechCardModal() {
  const body = document.getElementById('techCardBody');
  if (!body) return;

  if (!bomGroups || !bomGroups.length) {
    body.innerHTML = '<div class="price-empty">XML-файлы Staircon не найдены.<br>Проверьте bom-manifest.json и XML в папке проекта.</div>';
    return;
  }

  if (!productionPrices) await loadProductionPrices();
  if (!productionPrices) {
    body.innerHTML = '<div class="price-empty">Не удалось загрузить production_prices.json.<br>Откройте админку и проверьте прайс.</div>';
    return;
  }

  if (!dxfLoadPromise) {
    body.innerHTML = '<div class="price-empty"><div class="spinner" style="margin-bottom:14px;"></div><div id="techDxfProgress">Загрузка DXF… <b>0 / 0</b></div></div>';
    await loadAllDXF((done, total) => {
      const progressEl = document.getElementById('techDxfProgress');
      if (progressEl) progressEl.innerHTML = 'Загрузка DXF… <b>' + done + ' / ' + total + '</b>';
    });
  } else {
    await dxfLoadPromise;
  }

  const data = calculateTechCard();
  if (!data) {
    body.innerHTML = '<div class="price-empty">Не удалось собрать техкарту: нет категорий BOM или прайса.</div>';
    return;
  }
  techCardDataCache = data;
  ensureTechCardExtras(data);
  body.innerHTML = renderTechCard(data);
  wireTechBoardCalculator(data);
  wireTechCardExtras(data);
}

/* ═══════════════════════════════════════════════════════════════
   МОДАЛКА СМЕТЫ
   ═══════════════════════════════════════════════════════════════ */
let currentKm = 0;

function buildPriceModal() {
  if (!bomGroups || !bomGroups.length) {
    priceBody.innerHTML = '<div class="price-empty">XML-файлы из Staircon не найдены.<br>Загрузите их в репозиторий.</div>';
    return;
  }

  if (Object.keys(dxfCache).length < 46) {
    priceBody.innerHTML = '<div class="price-empty"><div class="spinner" style="margin-bottom:14px;"></div><div id="dxfProgress">Загрузка DXF… <b>0 / 46</b></div></div>';
    const prog = document.getElementById('dxfProgress');
    loadAllDXF((done, total) => {
      if (prog) prog.innerHTML = 'Загрузка DXF… <b>' + done + ' / ' + total + '</b>';
    }).then(() => { buildClientPriceModal(); });
    return;
  }

  const result = calculatePrice(currentKm);
  priceBody.innerHTML = '';

  const kmRow = document.createElement('div');
  kmRow.className = 'input-row';
  kmRow.innerHTML = '<label>📍 Расстояние доставки:</label><input type="number" id="deliveryKmInput" min="0" step="1" value="' + currentKm + '"><span class="unit">км</span>';
  priceBody.appendChild(kmRow);
  kmRow.querySelector('input').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    currentKm = isFinite(v) && v >= 0 ? v : 0;
    buildClientPriceModal();
    updatePriceSummary();
  });

  let techData = null;
  try { techData = calculateTechCard(); } catch (err) { console.warn('Техкарта для калькулятора не собралась:', err); }
  if (techData) {
    techCardDataCache = techData;
    ensureTechCardExtras(techData);
  }
  const techMain = getTechCardMainTotals(techData);
  const deliveryCost = result.deliveryCost;

  if (techMain) {
    const techPanel = document.createElement('div');
    techPanel.className = 'price-tech-totals';
    techPanel.innerHTML =
      '<div class="price-tech-title">Итог технологической карты</div>' +
      '<div class="price-tech-toggles">' +
        '<label><input type="checkbox" id="priceTechPaint"' + (techCardOptions.paint ? ' checked' : '') + '> Покраска</label>' +
        '<label><input type="checkbox" id="priceTechMontage"' + (techCardOptions.montage ? ' checked' : '') + '> Монтаж</label>' +
        '<label><input type="checkbox" id="priceTechUsn"' + (techCardOptions.usn ? ' checked' : '') + '> УСН ' + techNum(techMain.usnRate, 6) + '%</label>' +
      '</div>' +
      '<div class="price-totals">' +
        '<div class="price-totals-row"><span>Производство с наценкой</span><span>' + formatRub(techMain.production) + '</span></div>' +
        '<div class="price-totals-row' + (techCardOptions.paint ? '' : ' price-row-off') + '"><span>Покраска всех блоков</span><span>' + (techCardOptions.paint ? formatRub(techMain.paint) : 'отключено') + '</span></div>' +
        '<div class="price-totals-row' + (techCardOptions.montage ? '' : ' price-row-off') + '"><span>Монтаж всех блоков</span><span>' + (techCardOptions.montage ? formatRub(techMain.montage) : 'отключено') + '</span></div>' +
        '<div class="price-totals-row' + (techCardOptions.usn ? '' : ' price-row-off') + '"><span>УСН ' + techNum(techMain.usnRate, 6) + '%</span><span>' + (techCardOptions.usn ? formatRub(techMain.usn) : 'отключено') + '</span></div>' +
        '<div class="price-totals-row"><span>Доставка (' + result.deliveryKm + ' км)</span><span>' + formatRub(deliveryCost) + '</span></div>' +
        '<div class="price-totals-row total"><span>ИТОГО</span><span>' + formatRub(techMain.total + deliveryCost) + '</span></div>' +
      '</div>' +
      '<div class="price-tech-note">Покраска и монтаж вынесены из стоимости блоков в отдельные строки. Наценка применена к производству; покраска и монтаж правятся в техкарте. УСН распределяется по блокам пропорционально.</div>';
    priceBody.appendChild(techPanel);
    wirePriceTechTotals();
  }

  if (techMain) {
    const detailTitle = document.createElement('div');
    detailTitle.className = 'price-tech-detail-title';
    detailTitle.textContent = 'Детализация по старому прайсу — справочно';
    priceBody.appendChild(detailTitle);
  }

  result.groups.forEach((g) => {
    const groupBlock = document.createElement('div');
    groupBlock.className = 'price-group';
    const groupTotal = g.materialTotal + g.paintTotal;
    const title = document.createElement('div');
    title.className = 'price-group-title';
    title.innerHTML = '<span>' + g.title + '</span><span class="sum">' + formatRub(groupTotal) + '</span>';
    groupBlock.appendChild(title);

    const body = document.createElement('div');
    body.className = 'price-group-body';

    g.categories.forEach((cat) => {
      const block = document.createElement('div');
      block.className = 'price-cat';
      let qtyText = '';
      let unitText = '';
      if (cat.method === 'm2') qtyText = cat.qty.toFixed(3) + ' м²';
      else if (cat.method === 'length') qtyText = cat.qty.toFixed(2) + ' м';
      else if (cat.method === 'count') {
        qtyText = cat.qty + ' шт';
        if (cat.unitPrice != null) unitText = ' × ' + formatRub(cat.unitPrice);
      }

      const noteHtml = cat.priceNote
        ? '<div style="font-size:11px; color:var(--danger); margin-top:4px;">' + cat.priceNote + '</div>'
        : '';

      block.innerHTML =
        '<div class="price-cat-name"><span>' + cat.name + '</span><span class="material">' + cat.materialName + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:4px;"><span>Изготовление (' + qtyText + unitText + ')</span><span>' + formatRub(cat.materialCost) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted);"><span>Покраска: ' + cat.paintName + ' (' + cat.paintArea.toFixed(2) + ' м²)</span><span>' + formatRub(cat.paintCost) + '</span></div>' +
        noteHtml +
        '<div class="price-cat-result" style="margin-top:8px; border-top:1px solid var(--border); padding-top:4px;">' + formatRub(cat.materialCost + cat.paintCost) + '</div>';
      body.appendChild(block);
    });

    groupBlock.appendChild(body);
    priceBody.appendChild(groupBlock);
  });

  if (!techMain) {
    const totals = document.createElement('div');
    totals.className = 'price-totals';
    totals.innerHTML =
      '<div class="price-totals-row"><span>Изготовление</span><span>' + formatRub(result.materialTotal) + '</span></div>' +
      '<div class="price-totals-row"><span>Покраска</span><span>' + formatRub(result.paintTotal) + '</span></div>' +
      '<div class="price-totals-row"><span>Доставка (' + result.deliveryKm + ' км)</span><span>' + formatRub(result.deliveryCost) + '</span></div>' +
      '<div class="price-totals-row"><span>Монтаж</span><span>' + formatRub(result.montageCost) + '</span></div>' +
      '<div class="price-totals-row total"><span>ИТОГО</span><span>' + formatRub(result.total) + '</span></div>';
    priceBody.appendChild(totals);
  }
}

function priceQuantityForCategory(cat, items) {
  let qty = 0;
  if (cat.method === 'm2') {
    items.forEach(d => { qty += (d.W * d.L) / 1e6; });
    qty *= cat.coef || 1;
  } else if (cat.method === 'length') {
    const extra = (cat.extra_mm || 0) / 1000;
    items.forEach(d => { qty += d.L / 1000 + extra; });
  } else if (cat.method === 'count') {
    qty = items.length;
  }
  return qty;
}

function createGeneratedCategory(draft, catKey) {
  if (draft.categories[catKey]) return draft.categories[catKey];
  const defaults = {
    bottomrail: { name: 'Подбалясенник', method: 'm2', coef: 1, prices: { pine: 0, beech: 0, ash: 0, oak: 0 } },
    post_caps: { name: 'Заглушки столбов', method: 'count', prices: { pine: 0, beech: 0, ash: 0, oak: 0 } }
  };
  const cat = defaults[catKey] || { name: catKey, method: 'count', prices: { pine: 0, beech: 0, ash: 0, oak: 0 } };
  draft.categories[catKey] = JSON.parse(JSON.stringify(cat));
  return draft.categories[catKey];
}

function priceResultWith(data) {
  const old = priceData;
  priceData = data;
  const result = calculatePrice(currentKm);
  priceData = old;
  return result;
}

function fillMissingMaterialPrices(draft) {
  const woodKeys = ['pine', 'beech', 'ash', 'oak'];
  const reference = { bottomrail: 'handrail', post_caps: 'posts' };
  for (const catKey in draft.categories) {
    const cat = draft.categories[catKey];
    if (!cat || !cat.prices) continue;
    const baseMat = getMaterialForKey(catKey);
    const basePrice = Number(cat.prices[baseMat]) || 0;
    if (!basePrice) continue;
    const refCat = reference[catKey] ? draft.categories[reference[catKey]] : null;
    for (const wood of woodKeys) {
      if (Number(cat.prices[wood]) > 0) continue;
      let ratio = 1;
      if (refCat && refCat.prices) {
        const refBase = Number(refCat.prices[baseMat]) || 0;
        const refWood = Number(refCat.prices[wood]) || 0;
        if (refBase > 0 && refWood > 0) ratio = refWood / refBase;
      } else {
        const origCat = priceData && priceData.categories ? priceData.categories[catKey] : null;
        const origBase = origCat && origCat.prices ? Number(origCat.prices[baseMat]) || 0 : 0;
        const origWood = origCat && origCat.prices ? Number(origCat.prices[wood]) || 0 : 0;
        if (origBase > 0 && origWood > 0) ratio = origWood / origBase;
      }
      cat.prices[wood] = Math.round(basePrice * ratio);
    }
  }

  const bal = draft.categories.baluster;
  if (bal && bal.prices) {
    const baseMat = getMaterialForKey('baluster');
    const basePrice = Number(bal.prices[baseMat]) || 0;
    for (const size in draft.baluster_prices) {
      const row = draft.baluster_prices[size] || {};
      const sizeBase = Number(row[baseMat]) || basePrice;
      for (const wood of woodKeys) {
        if (Number(row[wood]) > 0) continue;
        const ratio = basePrice > 0 && Number(bal.prices[wood]) > 0
          ? Number(bal.prices[wood]) / basePrice
          : 1;
        row[wood] = Math.round(sizeBase * ratio);
      }
    }
  }
}

async function generatePriceDraft() {
  if (!priceData || !bomGroups || !bomGroups.length) return null;
  if (!dxfLoadPromise) {
    showToast('Подготовка DXF для расчёта…', true);
    await loadAllDXF();
  } else {
    await dxfLoadPromise;
  }
  const tech = calculateTechCard();
  if (!tech) return null;
  const draft = JSON.parse(JSON.stringify(priceData));
  draft.baluster_prices = draft.baluster_prices || { 680: {}, 860: {}, 930: {} };
  const acc = {};
  const balusterAcc = {};
  const techGroupByFile = new Map();
  tech.groups.forEach(g => techGroupByFile.set(g.file + ':' + g.section, g));

  for (const group of bomGroups) {
    const classified = classifyBOMItems(group.items, group.floor);
    for (const section of ['stair', 'railing']) {
      const prefix = section === 'stair' ? 's' + group.floor : 'r' + (group.floor + 1);
      const categoryMap = section === 'stair' ? classified.stair : classified.railing;
      const techGroup = techGroupByFile.get(group.file + ':' + section);
      if (!techGroup) continue;
      for (const techCat of techGroup.categories) {
        const catKey = techCat.key;
        const items = categoryMap[catKey];
        if (!items || !items.length) continue;
        if (!isElementIncluded(prefix + '_' + catKey)) continue;
        const cat = createGeneratedCategory(draft, catKey);
        const qty = priceQuantityForCategory(cat, items);
        if (!qty) continue;
        const wood = techCat.wood && techCat.wood.key ? techCat.wood.key : getMaterialForKey(catKey);
        if (!acc[catKey]) acc[catKey] = {};
        if (!acc[catKey][wood]) acc[catKey][wood] = { prod: 0, qty: 0 };
        acc[catKey][wood].prod += techCat.productionPrice;
        acc[catKey][wood].qty += qty;
        if (catKey === 'baluster') {
          const size = techGroup.balusterSize || '930';
          if (!balusterAcc[size]) balusterAcc[size] = {};
          if (!balusterAcc[size][wood]) balusterAcc[size][wood] = { prod: 0, count: 0 };
          balusterAcc[size][wood].prod += techCat.productionPrice;
          balusterAcc[size][wood].count += items.length;
        }
      }
    }
  }

  for (const catKey in acc) {
    const cat = createGeneratedCategory(draft, catKey);
    if (!cat.prices) cat.prices = {};
    for (const wood in acc[catKey]) {
      const item = acc[catKey][wood];
      if (item.qty > 0) cat.prices[wood] = Math.round(item.prod / item.qty);
    }
  }
  for (const size in balusterAcc) {
    if (!draft.baluster_prices[size]) draft.baluster_prices[size] = {};
    for (const wood in balusterAcc[size]) {
      const item = balusterAcc[size][wood];
      if (item.count > 0) draft.baluster_prices[size][wood] = Math.round(item.prod / item.count);
    }
  }

  const oldResult = calculatePrice(currentKm);
  const draftResultBeforeScale = priceResultWith(draft);
  const fixedNew = draftResultBeforeScale.paintTotal + draftResultBeforeScale.montageCost + draftResultBeforeScale.deliveryCost;
  const targetMaterial = Math.max(0, oldResult.total - fixedNew);
  const scale = draftResultBeforeScale.materialTotal > 0 && targetMaterial > 0
    ? targetMaterial / draftResultBeforeScale.materialTotal
    : 1;
  if (Math.abs(scale - 1) > 0.0001) {
    for (const catKey in draft.categories) {
      const cat = draft.categories[catKey];
      if (!cat.prices) continue;
      for (const wood in cat.prices) {
        if (typeof cat.prices[wood] === 'number' && cat.prices[wood] > 0) {
          cat.prices[wood] = Math.round(cat.prices[wood] * scale);
        }
      }
    }
    for (const size in draft.baluster_prices) {
      for (const wood in draft.baluster_prices[size]) {
        if (typeof draft.baluster_prices[size][wood] === 'number' && draft.baluster_prices[size][wood] > 0) {
          draft.baluster_prices[size][wood] = Math.round(draft.baluster_prices[size][wood] * scale);
        }
      }
    }
  }

  fillMissingMaterialPrices(draft);

  return {
    draft: draft,
    oldResult: oldResult,
    draftResult: priceResultWith(draft),
    scale: scale
  };
}

async function applyGeneratedPrice() {
  const generated = await generatePriceDraft();
  if (!generated) {
    showToast('Нет данных для пересчёта цены', true);
    return;
  }
  const oldTotal = generated.oldResult.total;
  const newTotal = generated.draftResult.total;
  if (!confirm('Пересчитать клиентскую цену?\n\nБыло: ' + formatRub(oldTotal) + '\nСтанет: ' + formatRub(newTotal) + '\n\nИтог сохраняется, меняется распределение по категориям.')) return;
  try {
    const res = await fetch('/api/projects/' + encodeURIComponent(window.PROJECT_ID) + '/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generated.draft)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('Клиентская цена пересчитана', true);
    setTimeout(() => location.reload(), 700);
  } catch (err) {
    showToast('Не удалось сохранить цену: ' + err.message, true);
  }
}

function setupGeneratePriceButton() {
  if (!window.INTERNAL_MODE || !window.PROJECT_ID) return;
  const priceBtn = document.getElementById('btnPrice');
  if (!priceBtn || document.getElementById('btnGeneratePrice')) return;
  const btn = document.createElement('button');
  btn.className = 'btn big';
  btn.id = 'btnGeneratePrice';
  btn.innerHTML = '<span class="ico">🧮</span> Пересчитать клиентскую цену';
  btn.addEventListener('click', applyGeneratedPrice);
  priceBtn.parentElement.insertBefore(btn, priceBtn.nextSibling);
}

async function buildClientPriceModal() {
  if (!bomGroups || !bomGroups.length) {
    priceBody.innerHTML = '<div class="price-empty">XML-файлы StairCon не найдены.</div>';
    return;
  }
  if (!priceData || !priceData.categories) {
    priceBody.innerHTML = '<div class="price-empty">Прайс для расчёта не загружен.</div>';
    return;
  }

  if (!dxfLoadPromise) {
    priceBody.innerHTML = '<div class="price-empty"><div class="spinner" style="margin-bottom:14px;"></div><div id="priceDxfProgress">Подготовка расчёта…</div></div>';
    const progress = document.getElementById('priceDxfProgress');
    await loadAllDXF((done, total) => {
      if (progress) progress.textContent = 'Подготовка расчёта… ' + done + ' / ' + total;
    });
  } else {
    await dxfLoadPromise;
  }

  const scrollTop = priceBody.scrollTop;
  const result = calculatePrice(currentKm);
  priceBody.innerHTML = '';

  const intro = document.createElement('div');
  intro.className = 'price-client-intro';
  intro.innerHTML =
    '<div class="price-client-note">Предварительный расчёт. Порода дерева и покраска учитываются по выбранным настройкам; по умолчанию — сосна и лак б/ц. Точная стоимость — после согласования.</div>';
  priceBody.appendChild(intro);

  const toggleHint = document.createElement('div');
  toggleHint.className = 'price-client-note';
  toggleHint.textContent = 'Отключите то, что делаете сами — сумма пересчитается.';
  priceBody.appendChild(toggleHint);

  const excluded = getExcludedSummary();
  if (excluded.length) {
    const excludedNote = document.createElement('div');
    excludedNote.className = 'price-client-note';
    excludedNote.textContent = 'Исключено из заказа: ' + excluded.join(', ') + '.';
    priceBody.appendChild(excludedNote);
  }

  if (!result.groups.length) {
    const empty = document.createElement('div');
    empty.className = 'price-empty';
    empty.textContent = 'Нет данных для расчёта. Проверьте XML и выбранные элементы.';
    priceBody.appendChild(empty);
    return;
  }

  result.groups.forEach((group) => {
    const groupBlock = document.createElement('div');
    groupBlock.className = 'price-group';
    const title = document.createElement('div');
    title.className = 'price-group-title';
    title.innerHTML = '<span>' + group.title + '</span>';
    groupBlock.appendChild(title);

    const body = document.createElement('div');
    body.className = 'price-group-body';

    group.categories.forEach((cat) => {
      const block = document.createElement('div');
      block.className = 'price-cat';
      let qtyText = '';
      let unitText = '';
      if (cat.method === 'm2') qtyText = cat.qty.toFixed(3) + ' м²';
      else if (cat.method === 'length') qtyText = cat.qty.toFixed(2) + ' м';
      else if (cat.method === 'count') {
        qtyText = cat.qty + ' шт';
        if (cat.unitPrice != null) unitText = ' × ' + formatRub(cat.unitPrice);
      }

      block.innerHTML =
        '<div class="price-cat-name"><span>' + cat.name + '</span><span class="material">' + cat.materialName + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted); margin-top:4px;"><span>Изготовление (' + qtyText + unitText + ')</span><span>' + formatRub(cat.materialCost) + '</span></div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--muted);"><span>Покраска: ' + cat.paintName + ' (' + cat.paintArea.toFixed(2) + ' м²)</span><span>' + formatRub(cat.paintCost) + '</span></div>' +
        '<div class="price-cat-result" style="margin-top:8px; border-top:1px solid var(--border); padding-top:4px;">' + formatRub(cat.materialCost + cat.paintCost) + '</div>';
      body.appendChild(block);
    });

    groupBlock.appendChild(body);
    priceBody.appendChild(groupBlock);
  });

  const totals = document.createElement('div');
  totals.className = 'price-totals';

  const addTotalsRow = (label, value, options = {}) => {
    const row = document.createElement('div');
    const checked = options.checked !== false;
    row.className = 'price-totals-row' + (options.onChange && !checked ? ' price-row-off' : '');
    const left = document.createElement(options.onChange ? 'label' : 'span');
    if (options.onChange) {
      left.className = 'price-toggle-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => options.onChange(input.checked));
      left.appendChild(input);
      left.appendChild(document.createTextNode(' ' + label));
    } else {
      left.textContent = label;
    }
    const right = document.createElement('span');
    right.textContent = formatRub(value);
    row.appendChild(left);
    row.appendChild(right);
    totals.appendChild(row);
  };

  addTotalsRow('Изготовление', result.materialTotal);
  addTotalsRow('Покраска', result.paintTotal, {
    checked: paintEnabled,
    onChange: (checked) => setPaintEnabled(checked)
  });
  const deliveryLabel = deliveryKmKnown
    ? 'Доставка (' + currentKm + ' км)'
    : 'Доставка — уточняется';
  addTotalsRow(deliveryLabel, result.deliveryCost, {
    checked: deliveryEnabled,
    onChange: (checked) => {
      deliveryEnabled = checked;
      buildClientPriceModal();
    }
  });
  addTotalsRow('Монтаж', result.montageCost, {
    checked: montageEnabled,
    onChange: (checked) => {
      montageEnabled = checked;
      buildClientPriceModal();
    }
  });

  const totalRow = document.createElement('div');
  totalRow.className = 'price-totals-row total';
  totalRow.innerHTML = '<span>ИТОГО</span><span>' + formatRub(result.total) + '</span>';
  totals.appendChild(totalRow);

  priceBody.appendChild(totals);

  if (window.INTERNAL_MODE && result.montageBlock) {
    const mb = result.montageBlock;
    const details = document.createElement('details');
    details.className = 'price-client-note';
    details.style.marginTop = '10px';
    details.innerHTML =
      '<summary>Как рассчитан монтаж · ' + formatRub(mb.final) + '</summary>' +
      '<div style="display:grid; gap:4px; margin-top:6px; font-size:11px;">' +
        '<div>Деталей: ' + mb.parts + ' · N_K: ' + mb.nk.toFixed(2) + ' · S_K: ' + mb.sk.toFixed(3) + ' м²</div>' +
        '<div>Монтажные операции: ' + formatRub(mb.operations) + ' · ' + Math.round(mb.personMinutes) + ' чел.-мин</div>' +
        '<div>Бригада: ' + mb.workers + ' чел. · ' + mb.durationHours.toFixed(2) + ' ч</div>' +
        '<div>Труд: ' + formatRub(mb.labor) + ' · накладные: ' + formatRub(mb.overhead) + '</div>' +
        '<div>Подача: ' + formatRub(mb.loading) + ' · проезд: ' + formatRub(mb.travel) + ' · крепёж: ' + formatRub(mb.fasteners) + '</div>' +
        '<div>База: ' + formatRub(mb.base) + ' · наценка 30%: ' + formatRub(mb.markup) + ' · УСН 6%: ' + formatRub(mb.usn) + '</div>' +
      '</div>';
    priceBody.appendChild(details);
  }

  priceBody.scrollTop = scrollTop;
}

function updatePriceSummary() {
  if (!priceSummary) return;
  if (!bomGroups || !bomGroups.length || !priceData || !priceData.categories) {
    priceSummary.style.display = 'none';
    return;
  }
  const result = calculatePrice(currentKm);
  if (!result.groups.length) {
    priceSummary.style.display = 'none';
    return;
  }
  priceSummary.style.display = 'block';
  priceSummary.innerHTML = 'Предварительно<b>' + formatRub(result.total) + '</b>';
}

function wirePriceTechTotals() {
  const paint = document.getElementById('priceTechPaint');
  const montage = document.getElementById('priceTechMontage');
  const usn = document.getElementById('priceTechUsn');
  const refresh = () => {
    if (paint) techCardOptions.paint = paint.checked;
    if (montage) techCardOptions.montage = montage.checked;
    if (usn) techCardOptions.usn = usn.checked;
    buildClientPriceModal();
  };
  [paint, montage, usn].forEach(el => {
    if (el) el.addEventListener('change', refresh);
  });
}

/* ═══════════════════════════════════════════════════════════════
   МОДАЛКА ПАРАМЕТРОВ ЛЕСТНИЦЫ
   ═══════════════════════════════════════════════════════════════ */
function buildParamsModal() {
  paramsBody.innerHTML = '';

  function row(label, value, section = false) {
    if (!section && (value === null || value === undefined || value === '' || value === 0)) return;
    const el = document.createElement('div');
    el.className = 'param-row' + (section ? ' section' : '');
    el.innerHTML = section ? '<span>' + label + '</span>' : '<span class="label">' + label + '</span><span class="value">' + value + '</span>';
    paramsBody.appendChild(el);
  }

  function mm(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) + ' мм' : null;
  }
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function opening(v) {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const s = String(v).trim();
    return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s)) + ' мм' : s + ' мм';
  }

  const pp = projectParams || {};
  const projectKeys = [
    'param_height_mm', 'param_width_mm', 'param_opening_mm', 'param_angle_deg',
    'param_steps', 'param_floors', 'param_note'
  ];
  const hasProjectParams = projectKeys.some((key) =>
    pp[key] !== undefined && pp[key] !== null && String(pp[key]).trim() !== ''
  );

  if (hasProjectParams) {
    row('Параметры проекта', null, true);
    row('Высота этажа', mm(pp.param_height_mm));
    row('Ширина марша', mm(pp.param_width_mm));
    row('Проём', opening(pp.param_opening_mm));
    row('Угол наклона', num(pp.param_angle_deg) != null ? String(pp.param_angle_deg) + '°' : null);
    row('Количество ступеней', num(pp.param_steps));
    row('Этажей / участков', num(pp.param_floors));
    row('Примечание', pp.param_note ? String(pp.param_note) : null);
  }

  if (bomData && bomData.params) {
    const p = bomData.params;

    row('Этаж и перекрытие', null, true);
    row('Высота этажа (пол-пол)', mm(p.floorheight));
    row('Высота потолка 1 этажа', mm(p.ceiling));
    row('Толщина перекрытия', mm(p.floorthick));
    row('Просвет под перекрытием', mm(p.headroom));

    row('Ступени', null, true);
    const flightCount = Number(p.flightCount) || 1;
    const uniqueNums = (values, digits = 1) => {
      const list = (values || []).map(v => Number(v).toFixed(digits));
      const uniq = Array.from(new Set(list));
      return uniq.length ? uniq.join(' / ') : null;
    };
    if (flightCount > 1) {
      row('Маршей', flightCount);
      const risers = p.numRisersList || [];
      row('Подъёмов по маршам', risers.length
        ? risers.map(n => Math.round(n)).join(' / ')
        : null);
      row('Высота ступени', p.riseList && p.riseList.length ? uniqueNums(p.riseList) + ' мм' : mm(p.rise));
      row('Глубина ступени', p.goingList && p.goingList.length ? uniqueNums(p.goingList) + ' мм' : (p.going ? p.going.toFixed(1) + ' мм' : null));
      row('Угол наклона', p.pitchList && p.pitchList.length ? p.pitchList.join(' / ') : p.pitch);
    } else {
      row('Высота ступени', mm(p.rise));
      row('Глубина ступени', p.going ? p.going.toFixed(1) + ' мм' : null);
      row('Количество подъёмов', p.numRisers);
      row('Угол наклона', p.pitch);
    }
    row('Ширина марша', mm(p.widths));
    if (p.hasLanding) {
      row('Площадка', p.landingDepth ? Math.round(p.landingDepth) + ' мм' : 'есть');
    } else if (p.recalcGoingList && p.recalcGoingList.length > 1) {
      row('Расчётная глубина', p.recalcGoingList.map(v => Math.round(v)).join(' / ') + ' мм');
    }

    row('Ограждение и элементы', null, true);
    row('Высота ограждения', p.railingHeight ? p.railingHeight + ' мм' : null);
    row('Сечение поручня', p.handrailDim ? p.handrailDim.replace(/x/gi, ' × ') + ' мм' : null);
    row('Балясина', '45 мм (стандарт)');
    row('Посадочное место балясины', p.balusterDim ? p.balusterDim.replace('⌀', 'Ø') + ' мм' : null);
    row('Сечение столба', p.newelName);
    return;
  }

  if (currentModel) {
    const box = new THREE.Box3().setFromObject(currentModel);
    const size = box.getSize(new THREE.Vector3());
    row('Габариты сцены (модель + помещение)', null, true);
    row('Ширина', Math.round(size.x * 1000) + ' мм');
    row('Глубина', Math.round(size.z * 1000) + ' мм');
    row('Высота', Math.round(size.y * 1000) + ' мм');
  }

  if (hasProjectParams) {
    const note = document.createElement('div');
    note.className = 'price-empty';
    note.style.marginTop = '12px';
    note.textContent = 'Детальные размеры ступеней и ограждения появятся после загрузки XML.';
    paramsBody.appendChild(note);
    return;
  }

  row('Что входит в параметры', null, true);
  ['Высота этажа', 'Ширина марша', 'Угол наклона', 'Количество ступеней', 'Материал', 'Покраска', 'Балясины', 'Столбы', 'Поручень'].forEach((label) => row(label, '—'));
  const note = document.createElement('div');
  note.className = 'price-empty';
  note.style.marginTop = '12px';
  note.textContent = 'Точные параметры появятся после загрузки XML или заполнения карточки проекта.';
  paramsBody.appendChild(note);
}

/* ═══════════════════════════════════════════════════════════════
   БЛАНК ЗАКАЗА
   ═══════════════════════════════════════════════════════════════ */
const ORDER_PDF_FILE = 'Olyga Toksovo.pdf';

function buildOrderModal() {
  if (!bomData || !priceData) {
    orderBody.innerHTML = '<div class="price-empty">Нет данных. Загрузите XML и price.json.</div>';
    return;
  }

  const result = calculatePrice(currentKm);
  orderBody.innerHTML = '';

  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU');
  const modelName = (MODEL_FILE || '').replace(/\.(dae|xml)$/i, '');

  const header = document.createElement('div');
  header.className = 'order-section';
  header.innerHTML =
    '<div style="text-align:center;padding:6px 0 12px;">' +
      '<div style="font-size:20px;font-weight:800;color:var(--text);">Бланк заказа</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' +
        (modelName || 'Лестница') + ' · ' + dateStr +
      '</div>' +
    '</div>';
  orderBody.appendChild(header);

  const pdfSec = document.createElement('div');
  pdfSec.className = 'order-section';
  pdfSec.innerHTML =
    '<div class="order-section-title">Вид сверху (чертёж)</div>' +
    '<div class="order-image-frame">' +
      '<iframe src="' + encodeURI(ORDER_PDF_FILE) + '#toolbar=0&navpanes=0&scrollbar=0"></iframe>' +
    '</div>';
  orderBody.appendChild(pdfSec);

  let shotSrc = '';
  try {
    renderer.render(scene, camera);
    shotSrc = canvas.toDataURL('image/png');
  } catch (e) { console.warn('Не удалось сделать снимок:', e); }

  if (shotSrc) {
    const shotSec = document.createElement('div');
    shotSec.className = 'order-section';
    shotSec.innerHTML =
      '<div class="order-section-title">3D-вид</div>' +
      '<div class="order-image-frame"><img id="orderShotImg" src="' + shotSrc + '"></div>';
    orderBody.appendChild(shotSec);
  }

  if (bomData.params) {
    const p = bomData.params;
    const rows = [];
    const push = (label, val) => { if (val) rows.push('<div class="param-row"><span class="label">' + label + '</span><span class="value">' + val + '</span></div>'); };

    if (p.floorheight)  push('Высота этажа',     Math.round(p.floorheight) + ' мм');
    if (p.flightCount > 1) {
      push('Маршей', p.flightCount);
      if (p.numRisersList && p.numRisersList.length) {
        push('Подъёмов по маршам', p.numRisersList.map(n => Math.round(n)).join(' / '));
      }
      if (p.riseList && p.riseList.length) {
        const uniq = Array.from(new Set(p.riseList.map(v => Number(v).toFixed(1))));
        push('Высота ступени', uniq.join(' / ') + ' мм');
      }
      if (p.goingList && p.goingList.length) {
        push('Глубина ступени', p.goingList.map(v => Number(v).toFixed(1)).join(' / ') + ' мм');
      }
      if (p.pitchList && p.pitchList.length) push('Угол наклона', p.pitchList.join(' / '));
    } else {
      if (p.rise)      push('Высота ступени',   Math.round(p.rise) + ' мм');
      if (p.going)     push('Глубина ступени',  p.going.toFixed(1) + ' мм');
      if (p.numRisers) push('Количество подъёмов', p.numRisers);
      if (p.pitch)     push('Угол наклона',     p.pitch);
    }
    if (p.widths)       push('Ширина марша',     Math.round(p.widths) + ' мм');
    if (p.hasLanding)   push('Площадка',         p.landingDepth ? Math.round(p.landingDepth) + ' мм' : 'есть');
    else if (p.recalcGoingList && p.recalcGoingList.length > 1) {
      push('Расчётная глубина', p.recalcGoingList.map(v => Math.round(v)).join(' / ') + ' мм');
    }
    if (p.railingHeight) push('Высота ограждения', p.railingHeight + ' мм');
    push('Балясина', '45 мм (стандарт)');
    if (p.balusterDim) push('Посадочное место балясины', p.balusterDim.replace('⌀', 'Ø') + ' мм');

    if (rows.length) {
      const paramsSec = document.createElement('div');
      paramsSec.className = 'order-section';
      paramsSec.innerHTML =
        '<div class="order-section-title">Параметры лестницы</div>' + rows.join('');
      orderBody.appendChild(paramsSec);
    }
  }

  const grouped = classifyBOMItems(bomData.items, bomData.params.floorName ? parseInt(bomData.params.floorName.match(/(\d+)/)[1], 10) : 1);

  const tableRows = [];
  let idx = 0;
  for (const catKey in priceData.categories) {
    const cat = priceData.categories[catKey];
    const items = grouped.stair[catKey];
    if (!items || !items.length) continue;

    const found = result.groups[0].categories.find(c => c.key === catKey);
    if (!found) continue;

    idx++;
    tableRows.push(
      '<tr>' +
        '<td class="num">' + idx + '</td>' +
        '<td>' + cat.name + '</td>' +
        '<td class="mat">' + found.materialName + '</td>' +
        '<td class="qty">' + found.count + ' шт</td>' +
        '<td class="sum">' + formatRub(found.materialCost) + '</td>' +
      '</tr>'
    );
  }

  const tableSec = document.createElement('div');
  tableSec.className = 'order-section';
  tableSec.innerHTML =
    '<div class="order-section-title">Состав заказа</div>' +
    '<table class="order-table">' +
      '<thead><tr>' +
        '<th>№</th><th>Наименование</th><th>Материал</th><th>Кол-во</th><th>Сумма</th>' +
      '</tr></thead>' +
      '<tbody>' + tableRows.join('') + '</tbody>' +
    '</table>';
  orderBody.appendChild(tableSec);

  const totalsSec = document.createElement('div');
  totalsSec.className = 'order-section';
  totalsSec.innerHTML =
    '<div class="order-section-title">Итоги</div>' +
    '<div class="order-totals">' +
        '<div class="order-totals-row"><span>Материал</span><span>' + formatRub(result.materialTotal) + '</span></div>' +
      '<div class="order-totals-row"><span>Покраска</span><span>' + formatRub(result.paintTotal) + '</span></div>' +
      '<div class="order-totals-row"><span>Доставка (' + result.deliveryKm + ' км)</span><span>' + formatRub(result.deliveryCost) + '</span></div>' +
      '<div class="order-totals-row"><span>Монтаж</span><span>' + formatRub(result.montageCost) + '</span></div>' +
      '<div class="order-totals-row total"><span>ИТОГО</span><span>' + formatRub(result.total) + '</span></div>' +
    '</div>';
  orderBody.appendChild(totalsSec);

  const leadSec = document.createElement('div');
  leadSec.className = 'order-section';
  leadSec.innerHTML =
    '<div class="order-lead-row">' +
      '🕐 Срок изготовления:' +
      '<input type="number" id="orderLead" min="1" step="1" value="30">' +
      '<span class="unit">рабочих дней</span>' +
    '</div>';
  orderBody.appendChild(leadSec);
}

document.getElementById('orderDownload').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = encodeURI(ORDER_PDF_FILE);
  a.download = ORDER_PDF_FILE;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('PDF открыт. Сохраните через Ctrl+S', true);
});

document.getElementById('orderShare').addEventListener('click', async () => {
  const url = location.origin + location.pathname + location.search;
  const title = 'Бланк заказа · ' + (document.title || '3D Viewer');
  if (navigator.share) {
    try { await navigator.share({ title, text: 'Бланк заказа лестницы', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Ссылка скопирована в буфер обмена', true);
  } catch { prompt('Скопируйте ссылку вручную:', url); }
});

/* ═══════════════════════════════════════════════════════════════
   МОДАЛЬНЫЕ ОКНА
   ═══════════════════════════════════════════════════════════════ */
let drawingsCache = null;

async function loadDrawingsData() {
  if (drawingsCache) return drawingsCache;
  try {
    const response = await fetch('drawings.json', { cache: 'no-store' });
    if (response.ok) drawingsCache = await response.json();
  } catch (error) {
    console.warn('drawings.json не загружен:', error.message);
  }
  return drawingsCache || { pdf: [], dxf: [] };
}

async function buildDrawingsModal() {
  drawingsSubtitle.textContent = projectParams && projectParams.title
    ? projectParams.title + (projectParams.number ? ' · ' + projectParams.number : '')
    : 'Вид сверху и официальный PDF';
  drawingsBody.innerHTML = '<div class="price-empty">Загрузка чертежей…</div>';

  const data = await loadDrawingsData();
  const pdfs = Array.isArray(data.pdf) ? data.pdf : [];
  const dxfs = Array.isArray(data.dxf) ? data.dxf : [];
  drawingsBody.innerHTML = '';

  if (!pdfs.length && !dxfs.length) {
    drawingsBody.innerHTML = '<div class="price-empty">Чертёж не загружен. Добавьте PDF из StairCon или DXF в карточке заявки.</div>';
    return;
  }

  if (pdfs.length) {
    const section = document.createElement('div');
    section.className = 'drawing-section';

    const title = document.createElement('div');
    title.className = 'drawing-section-title';
    title.textContent = 'Официальный чертёж (PDF)';
    section.appendChild(title);

    const frame = document.createElement('div');
    frame.className = 'drawing-pdf-frame';
    const iframe = document.createElement('iframe');
    iframe.src = pdfs[0].url + '#toolbar=0&navpanes=0&scrollbar=0';
    iframe.loading = 'lazy';
    frame.appendChild(iframe);
    section.appendChild(frame);

    const actions = document.createElement('div');
    actions.className = 'drawing-actions';
    pdfs.forEach((pdf) => {
      const link = document.createElement('a');
      link.className = 'btn primary';
      link.href = pdf.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Открыть ' + pdf.name;
      actions.appendChild(link);
    });
    section.appendChild(actions);
    drawingsBody.appendChild(section);
  }

  dxfs.forEach((dxf) => {
    const views = Array.isArray(dxf.views) ? dxf.views : [];
    const section = document.createElement('div');
    section.className = 'drawing-section';

    const title = document.createElement('div');
    title.className = 'drawing-section-title';
    title.textContent = 'Вид сверху (DXF): ' + dxf.name;
    section.appendChild(title);

    const toolbar = document.createElement('div');
    toolbar.className = 'drawing-toolbar';
    const select = document.createElement('select');
    views.forEach((view, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = view.name;
      select.appendChild(option);
    });
    const download = document.createElement('a');
    download.className = 'btn';
    download.href = dxf.url;
    download.textContent = 'Скачать DXF';
    toolbar.appendChild(select);
    toolbar.appendChild(download);
    section.appendChild(toolbar);

    const imageWrap = document.createElement('div');
    imageWrap.className = 'drawing-image';
    const image = document.createElement('img');
    image.alt = 'Вид сверху';
    if (views.length) image.src = views[0].url;
    imageWrap.appendChild(image);
    section.appendChild(imageWrap);

    select.addEventListener('change', () => {
      const view = views[Number(select.value)];
      if (view) image.src = view.url;
    });

    if (!views.length) {
      const note = document.createElement('div');
      note.className = 'price-empty';
      note.textContent = 'Предпросмотр DXF не удалось построить. Скачайте файл.';
      section.appendChild(note);
    }

    drawingsBody.appendChild(section);
  });
}

function makeModal(overlayId, closeBtnId, closeIconId, onOpen) {
  const overlay = document.getElementById(overlayId);
  const openFn  = () => { if (onOpen) onOpen(); overlay.classList.add('show'); };
  const closeFn = () => overlay.classList.remove('show');

  if (closeBtnId)  document.getElementById(closeBtnId).addEventListener('click', closeFn);
  if (closeIconId) document.getElementById(closeIconId).addEventListener('click', closeFn);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeFn(); });
  return { openFn, closeFn, overlay };
}

const priceModal  = makeModal('priceModalOverlay',  'priceModalCloseBtn',  'priceModalClose',  buildClientPriceModal);
if (priceSummary) priceSummary.addEventListener('click', priceModal.openFn);
const paramsModal = makeModal('paramsModalOverlay', 'paramsModalCloseBtn', 'paramsModalClose', buildParamsModal);
const orderModal  = makeModal('orderModalOverlay',  'orderModalCloseBtn',  'orderModalClose',  buildOrderModal);
const techCardModal = makeModal('techCardOverlay', 'techCardCloseBtn', 'techCardClose', buildTechCardModal);
const drawingsModal = makeModal('drawingsModalOverlay', 'drawingsModalCloseBtn', 'drawingsModalClose', buildDrawingsModal);

priceBtn.addEventListener('click', priceModal.openFn);
setupGeneratePriceButton();
document.getElementById('btnParams').addEventListener('click', paramsModal.openFn);
document.getElementById('btnDrawings').addEventListener('click', drawingsModal.openFn);
document.getElementById('btnOrder').addEventListener('click', orderModal.openFn);
document.getElementById('btnTechCard').addEventListener('click', techCardModal.openFn);
document.getElementById('techCardRefresh').addEventListener('click', () => {
  buildTechCardModal();
});
document.getElementById('btnAdminCost').addEventListener('click', () => {
  const password = window.prompt('Пароль для админки цен:', '');
  if (password === null) return;
  if (password === 'admin') {
    window.open(window.ADMIN_URL || 'admin.html', '_blank');
  } else {
    showToast('Неверный пароль', true);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (priceModal.overlay.classList.contains('show'))  priceModal.closeFn();
    if (paramsModal.overlay.classList.contains('show')) paramsModal.closeFn();
    if (orderModal.overlay.classList.contains('show'))  orderModal.closeFn();
    if (techCardModal.overlay.classList.contains('show')) techCardModal.closeFn();
    if (drawingsModal.overlay.classList.contains('show')) drawingsModal.closeFn();
  }
});

/* ═══════════════════════════════════════════════════════════════
   DXF ПАРСЕР + ЗАГРУЗЧИК
   ═══════════════════════════════════════════════════════════════ */
const dxfCache = {};

function parseDXF(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim());
  const pairs = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i], 10);
    if (!isNaN(code)) pairs.push([code, lines[i + 1]]);
  }

  const polylines = [];
  let inEntities = false;
  let current = null;
  let i = 0;

  while (i < pairs.length) {
    const [code, value] = pairs[i];

    if (code === 0 && value === 'SECTION') {
      if (pairs[i+1] && pairs[i+1][0] === 2 && pairs[i+1][1] === 'ENTITIES') inEntities = true;
    }
    if (code === 0 && value === 'ENDSEC') inEntities = false;

    if (!inEntities) { i++; continue; }

    if (code === 0 && value === 'POLYLINE') {
      current = { layer: '', vertices: [] };
      i++;
      while (i < pairs.length && pairs[i][0] !== 0) {
        if (pairs[i][0] === 8) current.layer = pairs[i][1];
        i++;
      }
      continue;
    }

    if (code === 0 && value === 'VERTEX' && current) {
      const v = { x: 0, y: 0, bulge: 0 };
      i++;
      while (i < pairs.length && pairs[i][0] !== 0) {
        const [c, val] = pairs[i];
        if (c === 10) v.x = parseFloat(val);
        if (c === 20) v.y = parseFloat(val);
        if (c === 42) v.bulge = parseFloat(val);
        i++;
      }
      current.vertices.push(v);
      continue;
    }

    if (code === 0 && value === 'SEQEND' && current) {
      if (current.vertices.length > 2) polylines.push(current);
      current = null;
      i++;
      continue;
    }

    i++;
  }

  return { polylines };
}

function polylineAreaAndPerimeter(vertices) {
  const n = vertices.length;
  if (n < 3) return { area: 0, perimeter: 0 };

  let area = 0;
  let perimeter = 0;

  for (let i = 0; i < n; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % n];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const chord = Math.hypot(dx, dy);

    area += 0.5 * (p1.x * p2.y - p2.x * p1.y);

    const b = p1.bulge || 0;
    if (Math.abs(b) < 1e-9) {
      perimeter += chord;
    } else {
      const theta = 4 * Math.atan(b);
      const r = chord / (2 * Math.sin(theta / 2));
      area += 0.5 * r * r * (theta - Math.sin(theta));
      perimeter += Math.abs(r * theta);
    }
  }

  return { area: Math.abs(area), perimeter };
}

async function loadOneDXF(name) {
  const urls = [name + '.DXF', name + '.dxf'];
  for (const url of urls) {
    try {
     const r = await fetch(url);
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || text.length < 50) continue;
      const dxf = parseDXF(text);
      const contour = dxf.polylines.find(p => p.layer === 'CONTOUR');
      if (!contour) continue;
      const res = polylineAreaAndPerimeter(contour.vertices);
      return res;
    } catch (e) { /* пробуем следующий url */ }
  }
  return null;
}

let dxfLoadPromise = null;

async function loadAllDXF(progressCb) {
  if (dxfLoadPromise) return dxfLoadPromise;
  dxfLoadPromise = (async () => {
    if (!bomGroups || !bomGroups.length) return;

    const allNames = new Set();
    bomGroups.forEach(group => {
      const classified = classifyBOMItems(group.items, group.floor);

      ['stair', 'railing'].forEach(section => {
        for (const catKey in classified[section]) {
          (classified[section][catKey] || []).forEach(d => {
            if (!d.name) return;
            if (d.name.endsWith('End')) return;
            allNames.add(d.name);
          });
        }
      });
    });

    const toLoad = Array.from(allNames);
    console.log('%c→ Загрузка ' + toLoad.length + ' DXF...', 'color:#5b8cff;font-weight:bold');

    let done = 0;
    const concurrency = 8;
    let idx = 0;

    async function worker() {
      while (idx < toLoad.length) {
        const name = toLoad[idx++];
        const res = await loadOneDXF(name);
        if (res) dxfCache[name] = res;
        done++;
        if (progressCb) progressCb(done, toLoad.length);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const ok = Object.keys(dxfCache).length;
    console.log('%c✔ DXF загружено: ' + ok + ' / ' + toLoad.length, 'color:#31d0aa;font-weight:bold');
    return dxfCache;
  })();
  return dxfLoadPromise;
}

/* ═══════════════════════════════════════════════════════════════
   РАЗМЕРЫ ПРОЁМА
   ═══════════════════════════════════════════════════════════════ */
let openingDimsVisible = false;
const openingDimsGroup = new THREE.Group();
scene.add(openingDimsGroup);

function buildOpeningDimensions() {
  while (openingDimsGroup.children.length) {
    const c = openingDimsGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material && c.material.map) c.material.map.dispose();
    if (c.material) c.material.dispose();
  }

  const coverMeshes = [...(elementGroups['s1_covering'] || []), ...(elementGroups['s2_covering'] || [])];
  if (!coverMeshes.length) return;

  coverMeshes.forEach(mesh => {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry;
    if (!geom) return;

    const pos = geom.attributes.position;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y;
      if (y > maxY) maxY = y;
    }

    const edges = new THREE.EdgesGeometry(geom, 30); 
    const edgePos = edges.attributes.position;
    const drawnEdges = new Set(); 

    for (let i = 0; i < edgePos.count; i += 2) {
      const p1 = new THREE.Vector3().fromBufferAttribute(edgePos, i).applyMatrix4(mesh.matrixWorld);
      const p2 = new THREE.Vector3().fromBufferAttribute(edgePos, i + 1).applyMatrix4(mesh.matrixWorld);

      if (Math.abs(p1.y - maxY) < 0.01 && Math.abs(p2.y - maxY) < 0.01) {
        const dist = p1.distanceTo(p2);
        if (dist > 0.05) {
          const key = [p1.x.toFixed(2), p1.z.toFixed(2), p2.x.toFixed(2), p2.z.toFixed(2)].sort().join('|');
          if (!drawnEdges.has(key)) {
            drawnEdges.add(key);
            const text = Math.round(dist * 1000) + ' мм';
            const sprite = makeLabelSprite(text);
            const canvas = sprite.material.map.image;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#5b8cff';
            ctx.stroke();
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            sprite.position.copy(mid);
            openingDimsGroup.add(sprite);
          }
        }
      }
    }
    edges.dispose();
  });
  
  openingDimsGroup.visible = openingDimsVisible;
  console.log(`%c✔ Построено размеров проёма: ${openingDimsGroup.children.length}`, 'color:#31d0aa');
}

document.getElementById('btnShowOpeningDims').addEventListener('click', (e) => {
  openingDimsVisible = !openingDimsVisible;
  e.currentTarget.classList.toggle('active', openingDimsVisible);
  
  if (openingDimsGroup.children.length === 0) {
    buildOpeningDimensions();
  }
  
  openingDimsGroup.visible = openingDimsVisible;
  showToast(openingDimsVisible ? 'Размеры проёма включены' : 'Размеры проёма скрыты', true);
});

/* ═══════════════════════════════════════════════════════════════
   СТАРТ
   ═══════════════════════════════════════════════════════════════ */
(async () => {
  try {
    const r = await fetch('price.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    priceData = await r.json();
    console.log('%c✔ price.json загружен', 'color:#31d0aa;font-weight:bold');
  } catch (err) {
    console.log('price.json не найден:', err.message);
  }

  MODEL_FILE = await findModelFile();
  if (!MODEL_FILE) {
    showToast('Файл .dae не найден. Загрузите его в репозиторий.');
    return;
  }

  await loadProductionPrices();
  await loadProjectParams();
  await loadBOM();
  loadCollada(MODEL_FILE, MODEL_FILE);
})();

console.log('%c◈ 3D Viewer готов', 'color:#5b8cff;font-weight:bold;font-size:14px');
console.log('Линейка — M. Человечек — H.');
window.elementGroups = elementGroups;
window.scene = scene;
window.camera = camera;
window.controls = controls;
window.renderer = renderer;
window.getBomDebug = () => ({
  groups: bomGroups.map(g => ({
    file: g.file,
    floor: g.floor,
    count: g.items.length,
    balusters: g.items.filter(i => i.type === 'Baluster').length
  })),
  total: bomGroups.reduce((s, g) => s + g.items.length, 0),
  balusters: bomGroups.reduce((s, g) => s + g.items.filter(i => i.type === 'Baluster').length, 0)
});
window.getGeneratedBalusters = () => longBalustersGroup.children.map(w => ({
  name: w.userData.anchorName,
  clear: w.userData.clearHeight,
  cut: w.userData.cutLength,
  x: w.position.x,
  y: w.position.y,
  z: w.position.z
}));
