import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from './lib/utils/SkeletonUtils.js';
import { mergeGeometries } from './lib/utils/BufferGeometryUtils.js';

// ====== EDITÁ ACÁ TUS PROYECTOS ======
const PROYECTOS = [   // los mismos 9 de la web linkmaster
  { nombre: "Vetusmoon",                    desc: "Tienda online",    url: "https://vetusmoon.com" },
  { nombre: "Panel de la tienda",           desc: "Panel de gestión", url: "#" },
  { nombre: "Owners",                       desc: "Sitio web",        url: "#" },
  { nombre: "Portfolio 3D interactivo",     desc: "Portfolio",        url: "#" },
  { nombre: "Longbox",                      desc: "Aplicación web",   url: "#" },
  { nombre: "Catálogo de impresión 3D",     desc: "Sistema a medida", url: "#" },
  { nombre: "Bot de WhatsApp para empresa", desc: "Bot",              url: "#" },
  { nombre: "Cubitos Network+",             desc: "Herramienta",      url: "#" },
  { nombre: "Servidor y red propia",        desc: "Infraestructura",  url: "#" },
];
// Experiencia laboral: letras paradas, abajo a la derecha
const EXPERIENCIA = [
  { puesto: "Puesto 1", empresa: "Empresa", periodo: "2023 – hoy" },
  { puesto: "Puesto 2", empresa: "Empresa", periodo: "2020 – 2023" },
  { puesto: "Puesto 3", empresa: "Empresa", periodo: "2017 – 2020" },
];
// Qué extras se muestran (poner true para volver a activar alguno)
const MOSTRAR = { vacas: true, calabazas: true, pozo: true, trafico: false, experiencia: false };
// Lo que queda escrito en el maizal, en naranja
const NOMBRE = "Sebastian Rodriguez";
// =====================================

// ---------- Mapa (x: oeste-este, z: norte-sur) ----------
const VIOLETA = 0x2c1f7a;   // violeta del horizonte: el piso se funde con el cielo a lo lejos
const RUTA_Z = 30, RUTA_ANCHO = 13;          // ruta principal
const CRUCE_X = -80;                         // ruta que cruza, entre el granero y el maizal
const BORDE_N = RUTA_Z - RUTA_ANCHO / 2, BORDE_S = RUTA_Z + RUTA_ANCHO / 2;
const ALTO_GRANERO = 26;
const PASTO = { x: 2, z: 3, rx: 42, rz: 36 };
const POZO = { x: 38, z: 10, r: 3.8 };       // pozo de agua, ancho como para tirarle calabazas
// el maizal sigue mucho más allá de donde llega el ovni, para que no se le vea el final
const MAIZ = { x0: -540, x1: CRUCE_X + 6, z0: -430, z1: 132 };
const MARCA = { x: -182, z: -20, ancho: 150, fondo: 84 };  // el nombre escrito en el maizal
const MARCIANO = { x: 0, z: 0 };             // easter egg: es el punto de la "i" (se ubica al escribir el nombre)
// piedras de los proyectos: arriba a la derecha, desordenadas [x, z, tamaño, giro]
// El camino de tierra va en zigzag, sin simetría: [z, cuánto se corre en x]
const ZIGZAG = [[300, 5], [140, -3], [70, -7], [44, 9], [36, 5], [18, -8], [2, 6], [-30, -10], [-48, 3], [-85, 11],
                [-110, -5], [-150, 8], [-200, -9], [-270, 6], [-760, 0]];
function xDelCamino(z) {
  for (let i = 1; i < ZIGZAG.length; i++) {
    const [za, da] = ZIGZAG[i - 1], [zb, db] = ZIGZAG[i];
    if (z <= za && z >= zb) return CRUCE_X + da + (db - da) * (za - z) / (za - zb);
  }
  return CRUCE_X;
}
// Cuadros de los proyectos: rectángulos apaisados, en orden, a los dos lados de un pasillo que se recorre hacia adelante
const CUADRO = { ancho: 28, alto: 15.75, patas: 1.6 };
const PIEDRAS = PROYECTOS.map((_, i) => ({ x: i % 2 ? 126 : 72, z: 24 - i * 30 }));
const LIMITES = { x0: -214, x1: 156, z0: Math.min(-74, PIEDRAS[PIEDRAS.length - 1].z - 14), z1: 62 };
// El granero está girado: la parte de atrás se va hacia la izquierda y deja ver el techo
const GIRO_GRANERO = 0.65, SEN = Math.sin(GIRO_GRANERO), COS = Math.cos(GIRO_GRANERO);
const PUERTA = { x: 17.4 * SEN, z: 17.4 * COS };
const ENTRADA_Z = 40;
// sendero de tierra: de la puerta del granero hasta el camino
const SENDERO = [[PUERTA.x, PUERTA.z], [PUERTA.x + 13, ENTRADA_Z], [xDelCamino(ENTRADA_Z), ENTRADA_Z]];
function enSendero(x, z, margen) {
  for (let i = 1; i < SENDERO.length; i++) {
    const [ax, az] = SENDERO[i - 1], [bx, bz] = SENDERO[i];
    const t = THREE.MathUtils.clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
    if (Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < margen) return true;
  }
  return false;
}

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("escena"), antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;

const escena = new THREE.Scene();
escena.background = new THREE.Color(VIOLETA);   // se reemplaza por el cielo degradado más abajo
escena.fog = new THREE.Fog(VIOLETA, 70, 190);

const camara = new THREE.PerspectiveCamera(45, 1, 1, 1400);
const params = new URLSearchParams(location.search);
const ZOOM = Number(params.get("zoom") ?? 1);
// Cámara normal: baja y desde atrás, para que se vea el horizonte. Sobre el nombre del maizal sube y mira desde arriba.
const CAM_BAJA = new THREE.Vector3(0, 27, 50), MIRA_BAJA = new THREE.Vector3(0, 10, -12);
const CAM_ALTA = new THREE.Vector3(0, 39, 36), MIRA_ALTA = new THREE.Vector3(0, 2.5, -2.5);
const CAM = new THREE.Vector3(), MIRA = new THREE.Vector3();
let zoom = ZOOM;

function ajustarTamano() {
  renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
}
addEventListener("resize", ajustarTamano);
ajustarTamano();

// ---------- Luces ----------
escena.add(new THREE.HemisphereLight(0xc4bcff, 0x1a1440, 1.7));
const sol = new THREE.DirectionalLight(0xfff4e0, 2.4);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
sol.shadow.bias = -0.001;
escena.add(sol, sol.target);

const luzOvni = new THREE.SpotLight(0x4dff7c, 9, 0, 0.5, 0.8, 0); // luz verde del ovni
escena.add(luzOvni, luzOvni.target);

// ---------- Piso ----------
function plano(ancho, largo, color, x, z, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, largo), new THREE.MeshLambertMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  escena.add(m);
  return m;
}

const lienzo = (ancho, alto) => {
  const cv = document.createElement("canvas");
  cv.width = ancho; cv.height = alto;
  return [cv, cv.getContext("2d")];
};
const textura = cv => {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

// pasto en todo el piso
{
  const [cv, g] = lienzo(256, 256);
  g.fillStyle = "#0b2412"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = ["rgba(26,66,32,.5)", "rgba(4,20,10,.55)", "rgba(40,80,40,.3)"][i % 3];
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 4 + Math.random() * 5);
  }
  const t = textura(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(260, 160);
  plano(2600, 1600, 0xffffff, 0, 0, 0).material.map = t;
}

// ---------- Pasto ----------
const bordePasto = a => 1 + 0.07 * Math.sin(3 * a) + 0.05 * Math.sin(7 * a + 1);
const enParche = (p, x, z, margen = 1) => {
  const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz;
  return Math.hypot(dx, dz) < bordePasto(Math.atan2(dz, dx)) * margen;
};
const geoBrizna = new THREE.ConeGeometry(0.16, 1, 3).translate(0, 0.5, 0);
const matBrizna = new THREE.MeshLambertMaterial();
const matPasto = new THREE.MeshLambertMaterial({ color: 0x0f3017 });

function crearPasto(p, cantidad, libre = () => true) {
  const forma = new THREE.Shape();
  for (let i = 0; i <= 72; i++) {
    const a = i / 72 * Math.PI * 2, r = bordePasto(a);
    const px = Math.cos(a) * r * p.rx, py = -Math.sin(a) * r * p.rz;
    i ? forma.lineTo(px, py) : forma.moveTo(px, py);
  }
  const parche = new THREE.Mesh(new THREE.ShapeGeometry(forma), matPasto);
  parche.rotation.x = -Math.PI / 2;
  parche.position.set(p.x, 0.03, p.z);
  parche.receiveShadow = true;
  escena.add(parche);

  const briznas = new THREE.InstancedMesh(geoBrizna, matBrizna, cantidad);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let n = 0;
  while (n < cantidad) {
    const x = p.x + (Math.random() * 2 - 1) * p.rx * 1.15;
    const z = p.z + (Math.random() * 2 - 1) * p.rz * 1.15;
    if (!enParche(p, x, z, 0.97) || !libre(x, z)) continue;
    o.position.set(x, 0.03, z);
    o.rotation.set((Math.random() - .5) * .5, Math.random() * 6.28, (Math.random() - .5) * .5);
    o.scale.set(1, 0.5 + Math.random() * 0.9, 1);
    o.updateMatrix();
    briznas.setMatrixAt(n, o.matrix);
    briznas.setColorAt(n, c.setHSL(0.31 + Math.random() * 0.06, 0.55, 0.09 + Math.random() * 0.09));
    n++;
  }
  escena.add(briznas);
}
const enGranero = (x, z, margen = 0) => {             // en las coordenadas del granero girado
  const lx = x * COS - z * SEN, lz = x * SEN + z * COS;
  return Math.abs(lx) < 17 + margen && Math.abs(lz) < 17.8 + margen;
};
crearPasto(PASTO, 14000, (x, z) =>
  !enGranero(x, z) &&
  !enSendero(x, z, 3.4) &&                                // camino de entrada
  (!MOSTRAR.pozo || Math.hypot(x - POZO.x, z - POZO.z) > POZO.r + 0.4));

// ---------- Rutas ----------
const texRuta = (() => {
  const [cv, g] = lienzo(256, 256);
  g.fillStyle = "#34313f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {          // granulado del asfalto
    g.fillStyle = Math.random() < .5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.12)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = "#e9e9e9"; g.fillRect(0, 10, 256, 5); g.fillRect(0, 241, 256, 5);
  g.fillStyle = "#f2c230"; g.fillRect(20, 124, 130, 8);
  const t = textura(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
})();
const texTierra = (() => {
  const [cv, g] = lienzo(256, 256);
  g.fillStyle = "#7a5a36"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {          // piedritas y manchas
    g.fillStyle = ["rgba(50,32,16,.35)", "rgba(170,135,90,.3)", "rgba(95,68,40,.5)"][i % 3];
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
  }
  g.fillStyle = "rgba(55,36,18,.45)";      // huellas de ruedas
  g.fillRect(0, 70, 256, 22); g.fillRect(0, 164, 256, 22);
  g.fillStyle = "#4a7a2f";                 // bordes con pasto
  for (let x = 0; x < 256; x += 6) { g.fillRect(x, 0, 6, 4 + Math.random() * 9); g.fillRect(x, 256 - 4 - Math.random() * 9, 6, 14); }
  const t = textura(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
})();
function ruta(x1, z1, x2, z2, base = texRuta) {
  const largo = Math.hypot(x2 - x1, z2 - z1);
  const tex = base.clone();
  tex.repeat.set(largo / 16, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largo, RUTA_ANCHO), new THREE.MeshLambertMaterial({ map: tex }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  g.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
  g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  escena.add(g);
}
// camino de tierra en zigzag, entre el granero y el maizal
{
  const tierra = new THREE.MeshLambertMaterial({ color: 0x7a5a36 });
  ZIGZAG.forEach(([z, d], i) => {
    if (i) ruta(CRUCE_X + ZIGZAG[i - 1][1], ZIGZAG[i - 1][0], CRUCE_X + d, z, texTierra);
    const codo = new THREE.Mesh(new THREE.CircleGeometry(RUTA_ANCHO / 2, 20), tierra);   // tapa el hueco de cada curva
    codo.rotation.x = -Math.PI / 2;
    codo.position.set(CRUCE_X + d, 0.045, z);
    codo.receiveShadow = true;
    escena.add(codo);
  });
}
// sendero de tierra: de la puerta del granero al camino
{
  const tierra = new THREE.MeshLambertMaterial({ color: 0x7a5a36 });
  SENDERO.forEach(([x, z], i) => {
    const codo = new THREE.Mesh(new THREE.CircleGeometry(3, 16), tierra);
    codo.rotation.x = -Math.PI / 2;
    codo.position.set(x, 0.04, z);
    codo.receiveShadow = true;
    escena.add(codo);
    if (!i) return;
    const [ax, az] = SENDERO[i - 1];
    const tramo = new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(x - ax, z - az), 6), tierra);
    tramo.rotation.x = -Math.PI / 2;
    tramo.rotation.z = -Math.atan2(z - az, x - ax);
    tramo.position.set((x + ax) / 2, 0.04, (z + az) / 2);
    tramo.receiveShadow = true;
    escena.add(tramo);
  });
}

// ---------- Cerco de madera a los dos costados del camino ----------
{
  const madera = new THREE.MeshLambertMaterial({ color: 0x9a6a3a, flatShading: true });
  const piezas = [];                                  // [x, y, z, ancho, alto, fondo, giro]
  const tramo = (xa, za, xb, zb) => {
    const largo = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(largo / 3.4));
    const giro = -Math.atan2(zb - za, xb - xa);
    for (let i = 0; i < n; i++) {                     // postes
      const k = i / n;
      piezas.push([xa + (xb - xa) * k, 1, za + (zb - za) * k, 0.38, 2 + Math.random() * 0.25, 0.38, giro + (Math.random() - .5) * 0.15]);
    }
    for (const y of [0.75, 1.5])                      // dos tablas
      piezas.push([(xa + xb) / 2, y, (za + zb) / 2, largo + 0.3, 0.26, 0.14, giro]);
  };
  // solo donde llega la vista; cada punto se corre hacia afuera del camino
  const puntos = ZIGZAG.filter(([z]) => z <= 140 && z >= -270).map(([z, d]) => new THREE.Vector2(CRUCE_X + d, z));
  for (const lado of [-1, 1]) {
    const borde = puntos.map((p, i) => {
      const dir = new THREE.Vector2().subVectors(puntos[Math.min(i + 1, puntos.length - 1)], puntos[Math.max(i - 1, 0)]).normalize();
      return new THREE.Vector2(p.x - dir.y * lado * (RUTA_ANCHO / 2 + 1.6), p.y + dir.x * lado * (RUTA_ANCHO / 2 + 1.6));
    });
    for (let i = 1; i < borde.length; i++) {
      // del lado del granero queda abierto donde entra el camino de la puerta
      const esEntrada = puntos[i - 1].y >= ENTRADA_Z && puntos[i].y <= ENTRADA_Z && borde[i].x > puntos[i].x;
      if (!esEntrada) tramo(borde[i - 1].x, borde[i - 1].y, borde[i].x, borde[i].y);
    }
  }
  const cerco = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), madera, piezas.length);
  const o = new THREE.Object3D();
  piezas.forEach(([x, y, z, w, h, d, giro], i) => {
    o.position.set(x, y, z);
    o.rotation.set(0, giro, 0);
    o.scale.set(w, h, d);
    o.updateMatrix();
    cerco.setMatrixAt(i, o.matrix);
  });
  cerco.castShadow = true;
  cerco.frustumCulled = false;
  escena.add(cerco);
}

// ---------- Maizal (plantas 2D en cruz, muy livianas) ----------
// Marcas de marcianos en el maizal de abajo: [x, z, radio de adentro, radio de afuera]
const CIRCULOS = [];
{
  const c = { x: -136, z: 59 };                       // círculo con anillo y satélites
  CIRCULOS.push([c.x, c.z, 0, 4.5], [c.x, c.z, 8, 11.5]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) CIRCULOS.push([c.x + sx * 11.5, c.z + sz * 11.5, 0, 2.8]);
  let x = -214;                                      // hilera de círculos que crece y se achica
  for (const r of [2, 3.2, 5, 3.2, 2]) { x += r; CIRCULOS.push([x, 57, 0, r]); x += r + 1.6; }
  CIRCULOS.push([-195.6, 57, 7.5, 9.5]);             // anillo alrededor del círculo del medio
}
const enCirculos = (x, z) => CIRCULOS.some(([cx, cz, r0, r1]) => {
  const r = Math.hypot(x - cx, z - cz);
  return r >= r0 && r < r1;
});

// Máscara con el nombre en cursiva: donde hay letra no se planta maíz
let mascara = null;
function escribirNombre() {
  const PX = 8;                                      // píxeles por unidad del mundo
  const [cv] = lienzo(MARCA.ancho * PX, MARCA.fondo * PX);
  const g = cv.getContext("2d", { willReadFrequently: true });
  const lineas = NOMBRE.split(" ");
  const altoLinea = cv.height / lineas.length;
  let tam = altoLinea * 0.62;
  const fuente = () => g.font = `${tam}px Pacifico, "Brush Script MT", cursive`;
  while (fuente() && lineas.some(l => g.measureText(l).width > cv.width * 0.92) && tam > 20) tam -= 4;
  g.fillStyle = g.strokeStyle = "#ff8a1f";
  g.lineWidth = 1.2 * PX; g.lineJoin = "round";      // un poco más gruesa, para que se lea entre el maíz
  let punto = null;
  lineas.forEach((linea, n) => {
    const x0 = (cv.width - g.measureText(linea).width) / 2, base = altoLinea * (n + 0.72);
    g.strokeText(linea, x0, base);
    g.fillText(linea, x0, base);
    const k = linea.indexOf("i");
    if (k < 0 || punto) return;
    // buscar el punto de la primera "i"
    const cx = x0 + g.measureText(linea.slice(0, k)).width + g.measureText("i").width / 2;
    const rx = Math.round(cx - tam * 0.14), ry = Math.round(base - tam * 0.98), rw = Math.round(tam * 0.36), rh = Math.round(tam * 0.4);
    const zona = g.getImageData(rx, ry, rw, rh).data;
    let sx = 0, sy = 0, cuenta = 0;
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++)
      if (zona[(y * rw + x) * 4 + 3] > 100) { sx += x; sy += y; cuenta++; }
    punto = cuenta ? { x: rx + sx / cuenta, y: ry + sy / cuenta } : { x: cx, y: base - tam * 0.75 };
    // el punto pasa a ser un claro redondo, donde vive el marciano
    g.clearRect(rx, ry, rw, rh);
    g.beginPath(); g.arc(punto.x, punto.y, 3.4 * PX, 0, 6.3); g.fill();
  });
  if (punto) {
    MARCIANO.x = MARCA.x + (punto.x / cv.width - 0.5) * MARCA.ancho;
    MARCIANO.z = MARCA.z + (punto.y / cv.height - 0.5) * MARCA.fondo;
  }
  mascara = { cv, datos: g.getImageData(0, 0, cv.width, cv.height).data };
}
function enLetra(x, z) {
  const u = (x - MARCA.x) / MARCA.ancho + 0.5, v = (z - MARCA.z) / MARCA.fondo + 0.5;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  const { cv, datos } = mascara;
  return datos[(Math.floor(v * cv.height) * cv.width + Math.floor(u * cv.width)) * 4 + 3] > 100;
}
// con un margen alrededor de cada letra, así el maíz no la tapa
const enMarca = (x, z) => enLetra(x, z) || enLetra(x - 1.2, z) || enLetra(x + 1.2, z) || enLetra(x, z - 1.2) || enLetra(x, z + 1.6);

function crearMaizal() {
  escribirNombre();
  marciano.obj.position.set(MARCIANO.x, 0, MARCIANO.z);
  marciano.casa.copy(marciano.obj.position);

  // tierra debajo del maíz
  const ancho = CRUCE_X - 20 - MAIZ.x0, cx = (MAIZ.x0 + CRUCE_X - 20) / 2;
  const tramos = [[MAIZ.z0, MAIZ.z1]];
  for (const [za, zb] of tramos) plano(ancho, zb - za + 4, 0x3a2a1c, cx, (za + zb) / 2, 0.03);

  // el nombre, en naranja, sobre la tierra
  const letras = new THREE.Mesh(
    new THREE.PlaneGeometry(MARCA.ancho, MARCA.fondo),
    new THREE.MeshBasicMaterial({ map: textura(mascara.cv), transparent: true, depthWrite: false }));
  letras.rotation.x = -Math.PI / 2;
  letras.position.set(MARCA.x, 0.06, MARCA.z);
  escena.add(letras);

  // marcas de marcianos: maíz aplastado
  const paja = new THREE.MeshLambertMaterial({ color: 0xcdb85c });
  for (const [x, z, r0, r1] of CIRCULOS) {
    const m = new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r1, 56) : new THREE.CircleGeometry(r1, 36), paja);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    escena.add(m);
  }

  // dibujo de la planta
  const [cv, g] = lienzo(128, 256);
  g.lineCap = "round";
  g.strokeStyle = "#3f7d2c"; g.lineWidth = 9;
  g.beginPath(); g.moveTo(64, 256); g.lineTo(64, 40); g.stroke();
  const hoja = (y, lado, largo) => {
    g.fillStyle = y % 2 ? "#4f9a37" : "#5fae42";
    g.beginPath();
    g.moveTo(64, y);
    g.quadraticCurveTo(64 + lado * largo * .6, y - 46, 64 + lado * largo, y - 8);
    g.quadraticCurveTo(64 + lado * largo * .5, y - 22, 64, y + 14);
    g.fill();
  };
  hoja(225, -1, 56); hoja(196, 1, 58); hoja(160, -1, 54); hoja(127, 1, 52); hoja(96, -1, 44); hoja(71, 1, 38);
  g.fillStyle = "#f2c230";                         // choclo
  g.beginPath(); g.ellipse(80, 150, 9, 22, 0.35, 0, 6.3); g.fill();
  g.strokeStyle = "#d9c56a"; g.lineWidth = 4;      // penacho
  for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(64, 44); g.lineTo(64 + dx, 8); g.stroke(); }

  const cara = () => new THREE.PlaneGeometry(2.4, 4.2).translate(0, 2.1, 0);
  const geo = mergeGeometries([cara(), cara().rotateY(Math.PI / 2)]);
  // sin luces: es un dibujo 2D, se ve igual de los dos lados y es más liviano
  const mat = new THREE.MeshBasicMaterial({ map: textura(cv), alphaTest: 0.5, side: THREE.DoubleSide, color: 0xcfcfe6 });

  const o = new THREE.Object3D(), c = new THREE.Color(), matrices = [], colores = [];
  const paso = 2.3;
  for (const [za, zb] of tramos)
    for (let x = MAIZ.x0; x <= MAIZ.x1; x += paso)
      for (let z = za; z <= zb; z += paso) {
        const px = x + (Math.random() - .5) * 1.1, pz = z + (Math.random() - .5) * 1.1;
        if (enMarca(px, pz) || enCirculos(px, pz) || px > xDelCamino(pz) - RUTA_ANCHO / 2 - 3.5) continue;
        // lejos de donde vuela el ovni se planta más ralo: no se nota y es más liviano
        if ((px < -270 || pz < -150 || pz > 95) && Math.random() < 0.6) continue;
        o.position.set(px, 0, pz);
        o.rotation.y = Math.random() * 3.14;
        o.scale.setScalar(0.8 + Math.random() * 0.45);
        o.updateMatrix();
        matrices.push(o.matrix.clone());
        colores.push(c.setHSL(0.27 + Math.random() * 0.05, 0.25, 0.75 + Math.random() * 0.25).clone());
      }
  const maizal = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => { maizal.setMatrixAt(i, m); maizal.setColorAt(i, colores[i]); });
  maizal.frustumCulled = false;
  escena.add(maizal);
}

// ---------- Pozo de agua ----------
if (MOSTRAR.pozo) {
  const R = POZO.r, ALTO = 2.6 + R * 0.55, pozo = new THREE.Group();
  const piedra = new THREE.MeshLambertMaterial({ color: 0x8b8d99, flatShading: true, side: THREE.DoubleSide });
  const madera = new THREE.MeshLambertMaterial({ color: 0x7a4f28, flatShading: true });
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.25, 1.6, 10, 1, true), piedra);
  pared.position.y = 0.8;
  const brocal = new THREE.Mesh(new THREE.RingGeometry(R - 0.4, R + 0.12, 10), piedra);
  brocal.rotation.x = -Math.PI / 2;
  brocal.position.y = 1.6;
  const agua = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 20), new THREE.MeshBasicMaterial({ color: 0x1d5fae }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = 1.05;
  pozo.add(pared, brocal, agua);
  for (const lado of [-1, 1]) pozo.add(caja3(0.4, ALTO, 0.4, madera, lado * (R + 0.05), ALTO / 2, 0));   // postes
  pozo.add(caja3(R * 2 + 0.6, 0.26, 0.26, madera, 0, ALTO - 0.7, 0));                                     // travesaño del balde
  for (const lado of [-1, 1]) {                                                                   // techito a dos aguas
    const ala = caja3(R * 2 + 1.6, 0.18, R * 1.05, madera, 0, ALTO + R * 0.22, lado * R * 0.4);
    ala.rotation.x = lado * 0.6;
    pozo.add(ala);
  }
  pozo.position.set(POZO.x, 0, POZO.z);
  pozo.rotation.y = 0.4;
  pozo.traverse(p => { if (p.isMesh) p.castShadow = true; });
  escena.add(pozo);
}
function caja3(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- Cosas que el ovni puede agarrar ----------
const agarrables = [];
let enMano = null, enPozo = 0;
function agarrable(obj, tipo, extra = {}) {
  const a = { obj, tipo, estado: "libre", casa: obj.position.clone(), vy: 0, t: 0, ...extra };
  agarrables.push(a);
  return a;
}

// Calabazas al lado del granero
if (MOSTRAR.calabazas) {
  const cuerpo = new THREE.SphereGeometry(1.1, 10, 7).scale(1, 0.74, 1).translate(0, 0.8, 0);
  const tallo = new THREE.CylinderGeometry(0.1, 0.17, 0.5, 5).translate(0, 1.75, 0);
  const naranja = new THREE.MeshLambertMaterial({ color: 0xf07a13, flatShading: true });
  const verde = new THREE.MeshLambertMaterial({ color: 0x3f7d2c });
  // dispersas por todo el campo, sin tocar el granero, los senderos, el pozo ni los bloques
  const lugares = [];
  for (let i = 0; lugares.length < 30 && i < 8000; i++) {
    const x = -70 + Math.random() * 205, z = -72 + Math.random() * 130;
    if (x < xDelCamino(z) + 12 || enGranero(x, z, 3) || enSendero(x, z, 6)) continue;
    if (MOSTRAR.pozo && Math.hypot(x - POZO.x, z - POZO.z) < POZO.r + 4) continue;
    if (PIEDRAS.some(b => Math.abs(x - b.x) < 21 && z > b.z - 6 && z < b.z + 26)) continue;   // cuadro y su texto
    if (lugares.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 13)) continue;
    lugares.push([x, z]);
  }
  for (const [x, z] of lugares) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(cuerpo, naranja), t = new THREE.Mesh(tallo, verde);
    c.castShadow = true;
    const interior = new THREE.Group();
    interior.add(c, t);
    interior.scale.setScalar(1.7 + Math.random() * 0.9);
    interior.rotation.y = Math.random() * 6.28;
    g.add(interior);
    g.position.set(x, 0, z);
    escena.add(g);
    agarrable(g, "calabaza");
  }
}

// Easter egg: un marciano escondido en el maizal
const marciano = (() => {
  const [cv, g] = lienzo(256, 320);
  g.fillStyle = "#5fd35f"; g.strokeStyle = "#1c5a2a"; g.lineWidth = 8;
  g.beginPath(); g.moveTo(100, 60); g.lineTo(80, 14); g.moveTo(156, 60); g.lineTo(176, 14); g.stroke();   // antenas
  g.beginPath(); g.arc(80, 14, 9, 0, 6.3); g.arc(176, 14, 9, 0, 6.3); g.fill();
  g.beginPath(); g.roundRect(88, 190, 80, 110, 30); g.fill(); g.stroke();                                // cuerpo
  g.beginPath(); g.moveTo(92, 215); g.lineTo(40, 170); g.moveTo(164, 215); g.lineTo(216, 170); g.stroke(); // brazos
  g.beginPath(); g.ellipse(128, 122, 88, 78, 0, 0, 6.3); g.fill(); g.stroke();                            // cabeza
  g.fillStyle = "#0b0b18";
  g.beginPath(); g.ellipse(92, 124, 22, 34, 0.45, 0, 6.3); g.ellipse(164, 124, 22, 34, -0.45, 0, 6.3); g.fill();
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(86, 110, 6, 0, 6.3); g.arc(158, 110, 6, 0, 6.3); g.fill();
  g.strokeStyle = "#1c5a2a"; g.lineWidth = 5;
  g.beginPath(); g.arc(128, 160, 18, 0.2, 2.94); g.stroke();                                              // sonrisa

  const dibujo = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.5).translate(0, 2.25, 0),
    new THREE.MeshBasicMaterial({ map: textura(cv), alphaTest: 0.5, side: THREE.DoubleSide }));
  dibujo.rotation.x = -0.4;
  dibujo.position.y = -5;                       // escondido bajo tierra hasta que te acercás
  const g3 = new THREE.Group();
  g3.add(dibujo);
  g3.position.set(MARCIANO.x, 0, MARCIANO.z);
  escena.add(g3);
  return agarrable(g3, "marciano", { dibujo, asomado: 0, visto: false });
})();

// ---------- Proyectos: cuadros apaisados con una imagen y el texto pintado en el piso ----------
const piedras = [];
// Imagen del bloque. Si el proyecto tiene `img` (por ejemplo "img/vetusmoon.jpg") se usa esa; si no, una de relleno.
function imagenBloque(p, i) {
  const W = 768, H = 432, M = 22;                        // 16:9, con un marco fino
  const [cv, g] = lienzo(W, H);
  const pintar = foto => {
    g.fillStyle = "#0d0a22"; g.fillRect(0, 0, W, H);
    if (foto) {                                         // la foto, recortada para llenar el rectángulo
      const k = Math.max((W - 2 * M) / foto.width, (H - 2 * M) / foto.height);
      const sw = (W - 2 * M) / k, sh = (H - 2 * M) / k;
      g.drawImage(foto, (foto.width - sw) / 2, (foto.height - sh) / 2, sw, sh, M, M, W - 2 * M, H - 2 * M);
    } else {
      const tono = (i * 47) % 360;
      const grad = g.createLinearGradient(M, M, W - M, H - M);
      grad.addColorStop(0, `hsl(${tono}, 65%, 42%)`);
      grad.addColorStop(1, `hsl(${(tono + 50) % 360}, 70%, 18%)`);
      g.fillStyle = grad; g.fillRect(M, M, W - 2 * M, H - 2 * M);
      g.fillStyle = "rgba(255,255,255,.12)";            // trama de puntos
      for (let y = 44; y < H - 30; y += 26) for (let x = 44 + (y / 26 % 2) * 13; x < W - 30; x += 26) { g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); }
      g.fillStyle = "#f4f1de"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = '250px Bangers, Impact, "Arial Black", sans-serif';
      g.fillText(String(i + 1).padStart(2, "0"), W / 2, H / 2 + 16);
    }
    g.strokeStyle = "#f4f1de"; g.lineWidth = 8; g.strokeRect(M, M, W - 2 * M, H - 2 * M);
  };
  pintar(null);
  const tex = textura(cv);
  if (p.img) {
    const foto = new Image();
    foto.onload = () => { pintar(foto); tex.needsUpdate = true; };
    foto.src = p.img;
  }
  return tex;
}
// Texto para el piso. encendido: blanco con contorno celeste, como un rayo.
function textoPiso(p, encendido) {
  const [cv, g] = lienzo(1024, 512);
  const renglones = [];
  for (const palabra of p.nombre.toUpperCase().split(" ")) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo && (ultimo + " " + palabra).length <= 15) renglones[renglones.length - 1] = ultimo + " " + palabra;
    else renglones.push(palabra);
  }
  const fuente = tam => `${tam}px Bangers, Impact, "Arial Black", sans-serif`;
  const texto = (t, y) => {
    if (encendido) {
      g.shadowColor = "#39c8ff"; g.shadowBlur = 30;
      g.strokeStyle = "#5fd6ff"; g.lineWidth = 12; g.strokeText(t, 512, y);
      g.shadowBlur = 0;
      g.fillStyle = "#ffffff";
    } else g.fillStyle = "#cfcbe6";
    g.fillText(t, 512, y);
  };
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  let tam = 230;
  do { g.font = fuente(tam); tam -= 6; }
  while ((renglones.some(r => g.measureText(r).width > 960) || renglones.length * tam > 330) && tam > 50);
  tam += 6;
  renglones.forEach((r, n) => texto(r, 30 + tam * (n + 0.5)));
  let chico = 84;
  do { g.font = fuente(chico); chico -= 2; } while (g.measureText(p.desc.toUpperCase()).width > 900 && chico > 30);
  texto(p.desc.toUpperCase() + (p.url !== "#" ? "  ➜" : ""), 40 + tam * renglones.length + 70);
  return textura(cv);
}
function crearPiedras() {
  const oscuro = new THREE.MeshLambertMaterial({ color: 0x1d1a2b });
  const { ancho, alto, patas } = CUADRO;
  const geo = new THREE.BoxGeometry(ancho, alto, 1.2), bordes = new THREE.EdgesGeometry(geo);
  const geoPata = new THREE.BoxGeometry(0.9, patas, 0.9);
  const piso = new THREE.PlaneGeometry(ancho + 2, 17);   // letras estiradas hacia el fondo, como pintura de ruta
  PROYECTOS.forEach((p, i) => {
    const { x, z } = PIEDRAS[i];
    const foto = new THREE.MeshBasicMaterial({ map: imagenBloque(p, i) });
    const m = new THREE.Mesh(geo, [oscuro, oscuro, oscuro, oscuro, foto, oscuro]);   // la imagen va en la cara del frente
    m.position.set(x, patas + alto / 2, z);
    m.castShadow = true;
    const marco = new THREE.LineSegments(bordes, new THREE.LineBasicMaterial({ color: 0x5fd6ff, transparent: true, opacity: 0.25 }));
    m.add(marco);
    for (const lado of [-1, 1]) {
      const pata = new THREE.Mesh(geoPata, oscuro);
      pata.position.set(lado * ancho * 0.36, -alto / 2 - patas / 2, 0);
      m.add(pata);
    }
    escena.add(m);

    const capa = (encendido) => {
      const t = new THREE.Mesh(piso, new THREE.MeshBasicMaterial({
        map: textoPiso(p, encendido), transparent: true, depthWrite: false,
        opacity: encendido ? 0 : 1, blending: encendido ? THREE.AdditiveBlending : THREE.NormalBlending }));
      t.rotation.x = -Math.PI / 2;
      t.position.set(x, encendido ? 0.12 : 0.1, z + 11);
      escena.add(t);
      return t;
    };
    capa(false);
    piedras.push({ m, marco, letras: capa(true), x, z, p, luz: 0 });
  });
}

// ---------- Experiencia laboral: letras paradas en vertical ----------
// Cada renglón: [texto, tamaño en px, color]. 40 px del dibujo = 1 unidad del mundo.
function textoParado(renglones, x, z) {
  const fuente = tam => `${tam}px Bangers, Impact, "Arial Black", sans-serif`;
  const [medidor, gm] = lienzo(4, 4);
  const ancho = Math.max(...renglones.map(([t, tam]) => { gm.font = fuente(tam); return gm.measureText(t).width; })) + 60;
  const alto = renglones.reduce((a, [, tam]) => a + tam * 1.08, 0) + 30;
  const [cv, g] = lienzo(Math.ceil(ancho), Math.ceil(alto));
  g.textAlign = "center"; g.textBaseline = "top"; g.lineJoin = "round";
  let y = 18;
  for (const [t, tam, color] of renglones) {
    g.font = fuente(tam);
    g.strokeStyle = "#14101f"; g.lineWidth = tam * 0.14; g.strokeText(t, ancho / 2, y);
    g.fillStyle = color; g.fillText(t, ancho / 2, y);
    y += tam * 1.08;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(ancho / 40, alto / 40).translate(0, alto / 80, 0),
    new THREE.MeshBasicMaterial({ map: textura(cv), alphaTest: 0.5, side: THREE.DoubleSide }));
  m.position.set(x, 0, z);
  m.castShadow = true;                              // las letras dejan su sombra en el piso
  escena.add(m);
  return m;
}
function crearExperiencia() {
  const X0 = 42, PASO = 29, centro = X0 + PASO * (EXPERIENCIA.length - 1) / 2;
  textoParado([["EXPERIENCIA LABORAL", 250, "#ffd60a"]], centro, BORDE_S + 9);
  EXPERIENCIA.forEach((e, i) => textoParado([
    [e.puesto, 150, "#ffffff"],
    [e.empresa, 100, "#4dff7c"],
    [e.periodo, 84, "#c9bfff"],
  ], X0 + i * PASO, BORDE_S + 20 + (i % 2) * 4));
}

// ---------- Cielo violeta de noche, con estrellas ----------
{
  const [cv, g] = lienzo(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#0e0835");
  grad.addColorStop(0.2, "#2c1f7a");
  grad.addColorStop(1, "#2c1f7a");
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  escena.background = textura(cv);
}
// estrellas: dos tandas que titilan a destiempo
const estrellas = [2.2, 3.4].map((tamano, n) => {
  const cantidad = n ? 160 : 520, pos = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad; i++) pos.set([-1700 + Math.random() * 3400, 45 + Math.random() ** 1.6 * 560, -960 - Math.random() * 40], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
    size: tamano, sizeAttenuation: false, color: n ? 0xffffff : 0xd9d2ff, transparent: true, depthWrite: false, fog: false }));
  puntos.frustumCulled = false;
  escena.add(puntos);
  return puntos;
});
function moverCielo(dt, t) {
  estrellas[0].material.opacity = 0.7 + 0.3 * Math.sin(t * 1.7);
  estrellas[1].material.opacity = 0.65 + 0.35 * Math.sin(t * 2.6 + 2);
}

// ---------- Cartel en el techo del granero: luna y "Vetusmoon", en blanco luna ----------
// Va sobre la caída izquierda del techo (medidas en las unidades del modelo del granero).
function decorarGranero(granero) {
  const LUNA = "#f4f1de", TABLA = "#1d1a2b";
  const [cv, g] = lienzo(1024, 580);
  g.fillStyle = TABLA; g.fillRect(0, 0, 1024, 580);
  g.strokeStyle = LUNA; g.lineWidth = 14; g.strokeRect(16, 16, 992, 548);
  // luna creciente: un disco al que se le tapa un costado
  g.fillStyle = LUNA;  g.beginPath(); g.arc(512, 170, 108, 0, 6.3); g.fill();
  g.fillStyle = TABLA; g.beginPath(); g.arc(566, 140, 96, 0, 6.3); g.fill();
  g.fillStyle = LUNA; g.textAlign = "center"; g.textBaseline = "middle";
  let tam = 300;
  do { g.font = `${tam}px Bangers, Impact, "Arial Black", sans-serif`; tam -= 4; } while (g.measureText("VETUSMOON").width > 900 && tam > 60);
  g.fillText("VETUSMOON", 512, 420);

  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.2), new THREE.MeshBasicMaterial({ map: textura(cv) }));
  const alLargo = new THREE.Vector3(0, 0, 1), cuestaArriba = new THREE.Vector3(0.7886, 0.6149, 0);
  const haciaAfuera = new THREE.Vector3().crossVectors(alLargo, cuestaArriba);
  cartel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(alLargo, cuestaArriba, haciaAfuera));
  cartel.position.set(-1.93, 4.505, 0.03).addScaledVector(haciaAfuera, 0.27);
  granero.add(cartel);
}

// ---------- Polvo flotando ----------
const polvoTex = (() => {
  const [cv, g] = lienzo(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(.4, "rgba(255,255,255,.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
function nubeDePolvo(cantidad, tamano, opacidad) {
  const CAJA = [170, 40, 120];
  const base = new Float32Array(cantidad * 3), vel = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad * 3; i++) {
    base[i] = Math.random() * CAJA[i % 3];
    vel[i] = (Math.random() - .5) * (i % 3 === 1 ? 0.5 : 1.4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cantidad * 3), 3));
  const puntos = new THREE.Points(geo, new THREE.PointsMaterial({
    size: tamano, map: polvoTex, color: 0xc9bfff, opacity: opacidad,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  puntos.frustumCulled = false;
  escena.add(puntos);
  // las partículas dan la vuelta dentro de una caja que acompaña a la cámara
  return (t, cx, cz) => {
    const pos = geo.attributes.position.array, centro = [cx, CAJA[1] / 2, cz - 10];
    for (let i = 0; i < pos.length; i++) {
      const e = i % 3, L = CAJA[e];
      pos[i] = centro[e] + (((base[i] + vel[i] * t - centro[e]) % L) + L) % L - L / 2;
    }
    geo.attributes.position.needsUpdate = true;
  };
}
const polvo = [nubeDePolvo(900, 0.55, 0.75), nubeDePolvo(300, 1.1, 0.45)];

// ---------- Vacas que pasean por el pasto ----------
const vacas = [];
function animar(v, nombre) {
  if (v.anim === nombre) return;
  v.acciones[v.anim]?.fadeOut(0.25);
  v.acciones[nombre].reset().fadeIn(0.25).play();
  v.anim = nombre;
}
function nuevoDestino(v) {
  const p = v.obj.position;
  for (let i = 0; i < 30; i++) {
    const x = PASTO.x + (Math.random() * 2 - 1) * PASTO.rx, z = PASTO.z + (Math.random() * 2 - 1) * PASTO.rz;
    if (!enParche(PASTO, x, z, 0.82) || (MOSTRAR.pozo && Math.hypot(x - POZO.x, z - POZO.z) < POZO.r + 3)) continue;
    let choca = false;                              // que el camino no atraviese el granero ni el pozo
    for (let k = 0; k <= 10 && !choca; k++) {
      const cx = p.x + (x - p.x) * k / 10, cz = p.z + (z - p.z) * k / 10;
      choca = enGranero(cx, cz, 2) || (MOSTRAR.pozo && Math.hypot(cx - POZO.x, cz - POZO.z) < POZO.r + 2);
    }
    if (!choca) { v.destino = { x, z }; return; }
  }
  v.destino = null;
}
function crearVacas(gltf) {
  const clip = n => gltf.animations.find(a => a.name.endsWith("|" + n));
  const inicios = [[-24, 22], [28, -8], [24, 24]];
  for (const [x, z] of inicios) {
    const modelo = clonarConEsqueleto(gltf.scene);
    modelo.scale.setScalar(0.6);
    modelo.traverse(p => { if (p.isMesh) { p.castShadow = true; p.frustumCulled = false; } });
    const g = new THREE.Group();
    g.add(modelo);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * 6.28;
    escena.add(g);
    const mezclador = new THREE.AnimationMixer(modelo);
    const v = agarrable(g, "vaca", {
      mezclador, anim: null, destino: null, espera: Math.random() * 3,
      acciones: { quieta: mezclador.clipAction(clip("Idle")), camina: mezclador.clipAction(clip("WalkSlow")), corre: mezclador.clipAction(clip("Run")) },
    });
    v.casa.set(PUERTA.x + SEN * 6, 0, PUERTA.z + COS * 6);                           // si cae al pozo, vuelve a salir por el granero
    animar(v, "quieta");
    vacas.push(v);
  }
}
function moverVaca(v, dt) {
  v.mezclador.update(dt);
  if (v.estado !== "libre") { animar(v, "corre"); v.destino = null; v.espera = 1; return; }
  const p = v.obj.position;
  if (!v.destino) {
    animar(v, "quieta");
    if ((v.espera -= dt) <= 0) nuevoDestino(v);
    return;
  }
  const dx = v.destino.x - p.x, dz = v.destino.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.4) { v.destino = null; v.espera = 2 + Math.random() * 5; return; }
  animar(v, "camina");
  p.x += dx / d * 1.5 * dt;
  p.z += dz / d * 1.5 * dt;
  let giro = Math.atan2(dx, dz) - v.obj.rotation.y;
  giro = Math.atan2(Math.sin(giro), Math.cos(giro));
  v.obj.rotation.y += giro * Math.min(1, dt * 4);
}

// ---------- Tráfico: cada pocos segundos pasa algo por una de las dos rutas ----------
// El 10.º es un gigante, cada 3.º un esqueleto caminando, cada 2.º una rueda en llamas; el resto, autos.
if (!MOSTRAR.pozo) document.getElementById("pozo").style.display = "none";
const INTERVALO = Number(params.get("trafico") ?? 7);   // segundos entre uno y otro
const viajeros = [];
let numeroViajero = Number(params.get("desde") ?? 0), faltaParaViajero = INTERVALO, temblor = 0;
const luzFuego = new THREE.PointLight(0xff7a1a, 0, 40, 1);   // siempre en la escena; se enciende con la rueda
escena.add(luzFuego);

const caja = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const lambert = color => new THREE.MeshLambertMaterial({ color, flatShading: true });
const MAT = { negro: lambert(0x1b1a22), vidrio: lambert(0xbfe6ff), hueso: lambert(0xf2f0e6), piel: lambert(0x7fae6a), ropa: lambert(0x6b4a2b),
              faro: new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), stop: new THREE.MeshBasicMaterial({ color: 0xff3030 }),
              ojo: new THREE.MeshBasicMaterial({ color: 0xffd60a }) };

// Todos miran hacia +x; después se giran según la ruta y el sentido
function crearAuto() {
  const g = new THREE.Group();
  const colores = [0xe63946, 0x2a9d8f, 0xf4a261, 0x4361ee, 0xf2f2f2, 0xffd60a];
  const pintura = lambert(colores[Math.floor(Math.random() * colores.length)]);
  g.add(caja(4.8, 1.1, 2.3, pintura, 0, 1.05, 0), caja(2.5, 0.95, 2, MAT.vidrio, -0.3, 2.05, 0), caja(2.6, 0.12, 2.1, pintura, -0.3, 2.56, 0));
  for (const z of [-0.75, 0.75]) g.add(caja(0.1, 0.3, 0.45, MAT.faro, 2.42, 1.15, z), caja(0.1, 0.25, 0.45, MAT.stop, -2.42, 1.2, z));
  const geoRueda = new THREE.CylinderGeometry(0.58, 0.58, 0.45, 10).rotateX(Math.PI / 2);
  const ruedas = [];
  for (const x of [-1.55, 1.55]) for (const z of [-1.15, 1.15]) {
    const r = new THREE.Mesh(geoRueda, MAT.negro);
    r.position.set(x, 0.58, z);
    ruedas.push(r);
    g.add(r);
  }
  return { obj: g, vel: 32, animar: (dt, v) => ruedas.forEach(r => r.rotation.z -= v.vel * dt / 0.58) };
}

const texLlama = (() => {
  const [cv, g] = lienzo(64, 96);
  const grad = g.createRadialGradient(32, 66, 2, 32, 56, 40);
  grad.addColorStop(0, "rgba(255,255,220,1)");
  grad.addColorStop(0.35, "rgba(255,190,40,.9)");
  grad.addColorStop(0.7, "rgba(255,80,10,.5)");
  grad.addColorStop(1, "rgba(255,0,0,0)");
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(64, 60, 32, 96); g.quadraticCurveTo(0, 60, 32, 0); g.fill();
  return textura(cv);
})();
function crearRueda() {
  const g = new THREE.Group(), R = 2.1;
  const gira = new THREE.Group();
  gira.position.y = R;
  gira.add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.5, 0.5, 8, 18), MAT.negro));
  for (let i = 0; i < 3; i++) { const rayo = caja(0.22, (R - 0.5) * 2, 0.22, MAT.hueso); rayo.rotation.z = i * Math.PI / 3; gira.add(rayo); }
  g.add(gira);
  const matLlama = new THREE.SpriteMaterial({ map: texLlama, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const llamas = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const l = new THREE.Sprite(matLlama);
    // alrededor de la rueda y una estela hacia atrás
    l.userData.base = i < 6 ? [Math.cos(a) * R * 0.8, R + Math.sin(a) * R * 0.8 + 0.8] : [-(i - 5) * 1.5 - R, R * 0.7];
    llamas.push(l);
    g.add(l);
  }
  return { obj: g, vel: 26, fuego: true, animar: (dt, v) => {
    gira.rotation.z -= v.vel * dt / R;
    g.position.y = Math.abs(Math.sin(v.recorrido * 0.15)) * 0.5;       // rebota un poco
    for (const l of llamas) {
      const k = 0.7 + Math.random() * 0.7;
      l.scale.set(2.4 * k, 3.8 * k, 1);
      l.position.set(l.userData.base[0] + (Math.random() - .5) * 0.5, l.userData.base[1] + k, 0);
    }
  } };
}

// Muñeco que camina: sirve para el esqueleto y, más gordo y enorme, para el gigante
function crearCaminante(gigante) {
  const g = new THREE.Group(), cuerpo = new THREE.Group();
  const mat = gigante ? MAT.piel : MAT.hueso, grosor = gigante ? 0.6 : 0.22;
  if (gigante) {
    cuerpo.add(caja(1.3, 2.3, 1.9, MAT.ropa, 0, 3.7, 0), caja(1.2, 1.2, 1.2, mat, 0.1, 5.5, 0));
    for (const z of [-0.3, 0.3]) cuerpo.add(caja(0.1, 0.2, 0.25, MAT.ojo, 0.72, 5.7, z));
    cuerpo.add(caja(0.15, 0.15, 0.8, MAT.negro, 0.72, 5.2, 0));
  } else {
    cuerpo.add(caja(0.5, 0.4, 1, mat, 0, 2.6, 0), caja(0.25, 1.9, 0.25, mat, 0, 3.6, 0));          // pelvis y columna
    for (const y of [3.5, 3.9, 4.3]) cuerpo.add(caja(0.7, 0.16, 1.3, mat, 0.1, y, 0));            // costillas
    const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), mat);
    craneo.position.set(0.05, 5.25, 0);
    cuerpo.add(craneo, caja(0.5, 0.3, 0.6, mat, 0.2, 4.75, 0));
    for (const z of [-0.22, 0.22]) cuerpo.add(caja(0.12, 0.22, 0.22, MAT.negro, 0.58, 5.3, z));   // ojos
  }
  const miembro = (largo, y, z) => {
    const eje = new THREE.Group();
    eje.position.set(0, y, z);
    eje.add(caja(grosor, largo, grosor, mat, 0, -largo / 2, 0));
    cuerpo.add(eje);
    return eje;
  };
  const ancho = gigante ? 1.25 : 0.85;
  const brazos = [miembro(1.9, 4.6, -ancho), miembro(1.9, 4.6, ancho)];
  const piernas = [miembro(2.6, 2.6, -0.38 * (gigante ? 1.6 : 1)), miembro(2.6, 2.6, 0.38 * (gigante ? 1.6 : 1))];
  g.add(cuerpo);
  const tam = gigante ? 5 : 1.15;
  g.scale.setScalar(tam);
  let pasoAnterior = 0;
  return { obj: g, vel: gigante ? 11 : 6, animar: (dt, v) => {
    const fase = v.recorrido / tam * 1.1, vaiven = Math.sin(fase);
    piernas[0].rotation.z = vaiven * 0.6;  piernas[1].rotation.z = -vaiven * 0.6;
    brazos[0].rotation.z = -vaiven * 0.5;  brazos[1].rotation.z = vaiven * 0.5;
    cuerpo.position.y = Math.abs(Math.cos(fase)) * 0.12;
    cuerpo.rotation.x = vaiven * 0.04;
    // cada pisada del gigante hace temblar la cámara si está cerca
    const paso = Math.floor(fase / Math.PI);
    if (gigante && paso !== pasoAnterior && Math.hypot(g.position.x - mira.x, g.position.z - mira.z) < 90) temblor = 1;
    pasoAnterior = paso;
  } };
}

function lanzarViajero() {
  numeroViajero++;
  const tipo = numeroViajero % 10 === 0 ? "gigante" : numeroViajero % 3 === 0 ? "esqueleto" : numeroViajero % 2 === 0 ? "rueda" : "auto";
  const v = tipo === "auto" ? crearAuto() : tipo === "rueda" ? crearRueda() : crearCaminante(tipo === "gigante");
  const SALIDA = 115 * zoom / ZOOM;                          // arranca fuera de la pantalla
  v.enPrincipal = params.has("ruta") ? params.get("ruta") === "1" : Math.random() < 0.5;
  v.sentido = Math.random() < 0.5 ? 1 : -1;
  v.recorrido = 0;
  v.hasta = SALIDA * 2 + 60;
  const carril = tipo === "gigante" ? 0 : v.sentido * 3.2;   // cada uno por su mano
  if (v.enPrincipal) {
    v.obj.position.set(mira.x - v.sentido * SALIDA, 0, RUTA_Z + carril);
    v.obj.rotation.y = v.sentido > 0 ? 0 : Math.PI;
  } else {
    v.obj.position.set(CRUCE_X - carril, 0, mira.z - v.sentido * SALIDA);
    v.obj.rotation.y = v.sentido > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  v.obj.traverse(p => { if (p.isMesh) p.castShadow = true; });
  escena.add(v.obj);
  viajeros.push(v);
}
function moverTrafico(dt) {
  if ((faltaParaViajero -= dt) <= 0) { faltaParaViajero = INTERVALO; lanzarViajero(); }
  luzFuego.intensity = 0;
  temblor *= Math.pow(0.02, dt);
  for (let i = viajeros.length - 1; i >= 0; i--) {
    const v = viajeros[i], avance = v.vel * dt;
    v.recorrido += avance;
    if (v.enPrincipal) v.obj.position.x += v.sentido * avance; else v.obj.position.z += v.sentido * avance;
    v.animar(dt, v);
    if (v.fuego) {
      luzFuego.position.set(v.obj.position.x, 4, v.obj.position.z);
      luzFuego.intensity = 45 + Math.random() * 25;
    }
    if (v.recorrido > v.hasta) {                             // ya pasó: se saca de la escena
      escena.remove(v.obj);
      v.obj.traverse(p => p.geometry?.dispose());
      viajeros.splice(i, 1);
    }
  }
}

// ---------- Ovni y controles ----------
const ovni = { x: Number(params.get("x") ?? 14), z: Number(params.get("z") ?? 50), vx: 0, vz: 0 };
window.ovni = ovni;   // para pruebas desde la consola: ovni.x = 15; ovni.z = 12
window.trafico = { lanzar: lanzarViajero, viajeros };   // para pruebas: trafico.lanzar()
const mira = new THREE.Vector3(ovni.x, 0, ovni.z);
const $ = id => document.getElementById(id);
const ovniEl = $("ovni"), inclina = $("inclina"), pista = $("pista");
const teclas = new Set();
const MAPA = { w: "w", a: "a", s: "s", d: "d", arrowup: "w", arrowleft: "a", arrowdown: "s", arrowright: "d" };
let cercana = null, objetivo = null, listo = false;

const sobrePozo = () => MOSTRAR.pozo && Math.hypot(ovni.x - POZO.x, ovni.z - POZO.z) < POZO.r + 2.6;
const distancia = a => Math.hypot(a.obj.position.x - ovni.x, a.obj.position.z - ovni.z);
const seAgarra = a => a.estado === "libre" && (a.tipo !== "marciano" || a.asomado > 0.9);
function masCercano() {
  let mejor = null, min = 5;
  for (const a of agarrables) if (seAgarra(a) && distancia(a) < min) { min = distancia(a); mejor = a; }
  return mejor;
}
// Espacio: agarra lo que haya bajo la luz, o suelta lo que lleva
function accion() {
  if (!listo) return;
  if (enMano) {
    enMano.estado = sobrePozo() ? "pozo" : "cayendo";
    enMano.vy = 0;
    enMano = null;
    return;
  }
  const a = masCercano();
  if (a) { a.estado = "agarrado"; enMano = a; }
}
const TIENDA = { url: "https://vetusmoon.com" };
const sobreGranero = () => !enMano && enGranero(ovni.x, ovni.z, 2);
const abrir = p => { if (p.url !== "#") window.open(p.url, "_blank", "noopener"); };

addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (MAPA[k]) { teclas.add(MAPA[k]); e.preventDefault(); }
  if (k === " ") { e.preventDefault(); if (!e.repeat) accion(); }
  if (k === "enter" || k === "e") {
    if (cercana) abrir(cercana.p);
    else if (sobreGranero()) abrir(TIENDA);
  }
});
addEventListener("keyup", e => teclas.delete(MAPA[e.key.toLowerCase()]));
addEventListener("blur", () => teclas.clear());
$("agarrar").addEventListener("pointerdown", e => { e.stopPropagation(); accion(); });

// Mouse: clic en una piedra la abre. Táctil: el ovni va hacia donde tocás.
const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
const SUELO = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function apuntar(e) {
  puntero.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rayo.setFromCamera(puntero, camara);
}
function tocar(e) {
  apuntar(e);
  const p = rayo.ray.intersectPlane(SUELO, new THREE.Vector3());
  if (p) objetivo = p;
}
addEventListener("pointerdown", e => {
  if (!listo) return;
  if (e.pointerType === "mouse") {
    apuntar(e);
    const golpe = rayo.intersectObjects(piedras.map(c => c.m))[0];
    if (golpe) abrir(piedras.find(c => c.m === golpe.object).p);
  } else tocar(e);
});
addEventListener("pointermove", e => { if (objetivo) tocar(e); });
addEventListener("pointerup", () => objetivo = null);
addEventListener("pointercancel", () => objetivo = null);

const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const acercar = (dt, k) => Math.min(1, dt * k);

function moverAgarrables(dt) {
  for (const a of agarrables) {
    const p = a.obj.position;
    if (a.estado === "agarrado") {
      p.x += (ovni.x - p.x) * acercar(dt, 9);
      p.z += (ovni.z - p.z) * acercar(dt, 9);
      p.y += (5.5 - p.y) * acercar(dt, 4);
      if (a.tipo !== "marciano") a.obj.rotation.y += dt * 1.6;
    } else if (a.estado === "cayendo") {
      a.vy -= 45 * dt;
      p.y += a.vy * dt;
      if (p.y <= 0) { p.y = 0; a.estado = "libre"; }
    } else if (a.estado === "pozo") {
      p.x += (POZO.x - p.x) * acercar(dt, 8);
      p.z += (POZO.z - p.z) * acercar(dt, 8);
      a.vy -= 30 * dt;
      p.y += a.vy * dt;
      if (p.y < 1.5) a.obj.scale.multiplyScalar(Math.max(0, 1 - dt * 2.5));
      if (p.y < -6) {
        a.obj.visible = false;
        a.estado = "fuera";
        a.t = 4;
        $("pozo").textContent = "🎃 " + (++enPozo);
      }
    } else if (a.estado === "fuera" && (a.t -= dt) <= 0) {   // reaparece en su lugar
      p.copy(a.casa);
      a.obj.scale.setScalar(1);
      a.obj.visible = true;
      a.estado = "libre";
    }
  }
}

const proyectado = new THREE.Vector3();
const reloj = new THREE.Clock();
let cuadros = 0, desdeFps = 0;

function cuadro() {
  const real = reloj.getDelta(), dt = Math.min(real, 0.05), t = reloj.elapsedTime;

  // contador de FPS
  cuadros++;
  if ((desdeFps += real) >= 0.5) {
    $("fps").textContent = Math.round(cuadros / desdeFps) + " FPS";
    cuadros = 0; desdeFps = 0;
  }

  let ax = 0, az = 0;
  if (listo) {
    ax = teclas.has("d") - teclas.has("a");
    az = teclas.has("s") - teclas.has("w");
    if (objetivo) {
      const dx = objetivo.x - ovni.x, dz = objetivo.z - ovni.z, d = Math.hypot(dx, dz);
      if (d > 1) { ax = dx / d; az = dz / d; }
    }
  }
  const largo = Math.hypot(ax, az) || 1, freno = Math.pow(0.0018, dt);
  ovni.vx = (ovni.vx + ax / largo * 420 * dt) * freno;
  ovni.vz = (ovni.vz + az / largo * 420 * dt) * freno;
  ovni.x = limitar(ovni.x + ovni.vx * dt, LIMITES.x0, LIMITES.x1);
  ovni.z = limitar(ovni.z + ovni.vz * dt, LIMITES.z0, LIMITES.z1);

  // cámara que sigue al ovni, desde arriba y atrás
  mira.x += (ovni.x - mira.x) * acercar(dt, 5);
  mira.z += (ovni.z - mira.z) * acercar(dt, 5);
  // sobre el nombre del maizal la cámara se aleja, para que se lea entero
  const fuera = Math.max(Math.abs(ovni.x - MARCA.x) - MARCA.ancho / 2, Math.abs(ovni.z - MARCA.z) - MARCA.fondo / 2);
  const meta = ZOOM * (2 - THREE.MathUtils.smoothstep(fuera, -10, 12));
  zoom += (meta - zoom) * acercar(dt, 2);
  const altura = THREE.MathUtils.clamp(zoom / ZOOM - 1, 0, 1);      // 0 = cámara baja, 1 = desde arriba
  CAM.lerpVectors(CAM_BAJA, CAM_ALTA, altura);
  MIRA.lerpVectors(MIRA_BAJA, MIRA_ALTA, altura);
  camara.position.copy(mira).addScaledVector(CAM, zoom);
  camara.position.x += (Math.random() - .5) * temblor * 1.4;
  camara.position.y += (Math.random() - .5) * temblor * 1.4;
  escena.fog.near = 40 * zoom;     // poca visibilidad: la niebla empieza cerca
  escena.fog.far = 165 * zoom;
  camara.lookAt(mira.x + MIRA.x * zoom, MIRA.y * zoom, mira.z + MIRA.z * zoom);
  sol.position.set(mira.x - 40, 80, mira.z + 45);
  sol.target.position.copy(mira);
  luzOvni.position.set(ovni.x, 15, ovni.z);
  luzOvni.target.position.set(ovni.x, 0, ovni.z);

  // el ovni CSS va justo encima de su punto en el piso
  camara.updateMatrixWorld();
  proyectado.set(ovni.x, 0, ovni.z).project(camara);
  const px = (proyectado.x + 1) / 2 * innerWidth, py = (1 - proyectado.y) / 2 * innerHeight;
  const escala = limitar(innerHeight / 620, 0.8, 1.65) / Math.pow(zoom / ZOOM, 0.6);
  ovniEl.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${escala})`;
  inclina.style.transform = `rotate(${limitar(ovni.vx * 0.28, -14, 14)}deg)`;

  // bloques: al acercarse, el texto del piso se enciende
  cercana = null;
  for (const c of piedras) {
    const cerca = Math.abs(ovni.x - c.x) < 17 && ovni.z > c.z - 2 && ovni.z < c.z + 30;
    if (cerca) cercana = c;
    c.luz += ((cerca ? 1 : 0) - c.luz) * acercar(dt, 7);
    // parpadea como un rayo mientras se enciende, y de vez en cuando después
    const chispa = c.luz < 0.9 ? Math.random() : (Math.random() < 0.04 ? 0.5 : 1);
    c.letras.material.opacity = c.luz * chispa;
    c.marco.material.opacity = 0.25 + 0.75 * c.luz;
  }

  // easter egg: el marciano se asoma cuando pasás cerca
  if (marciano.estado === "libre") {
    const cerca = distancia(marciano) < 13;
    if (cerca) marciano.visto = true;
    marciano.asomado += ((cerca ? 1 : 0) - marciano.asomado) * acercar(dt, 4);
  } else marciano.asomado = 1;
  marciano.dibujo.position.y = -5 * (1 - marciano.asomado) + Math.abs(Math.sin(t * 5)) * 0.4 * marciano.asomado;
  marciano.dibujo.rotation.z = Math.sin(t * 5) * 0.08 * marciano.asomado;

  moverAgarrables(dt);
  for (const v of vacas) moverVaca(v, dt);
  if (listo && MOSTRAR.trafico) moverTrafico(dt);
  for (const mover of polvo) mover(t, mira.x, mira.z);
  moverCielo(dt, t);

  // cartelito de ayuda
  let texto = "";
  if (enMano) texto = sobrePozo() ? "Espacio ➜ tirar al pozo" : "Espacio ➜ soltar";
  else if (cercana) texto = cercana.p.url === "#" ? cercana.p.nombre : `Enter ➜ abrir ${cercana.p.nombre}`;
  else if (sobreGranero()) texto = "Enter ➜ entrar a Vetusmoon";
  else if (marciano.estado === "libre" && marciano.asomado > 0.5) texto = "👽 ¡Encontraste al marciano!";
  else if (masCercano()) texto = "Espacio ➜ agarrar";
  pista.classList.toggle("ver", !!texto);
  if (texto) pista.textContent = texto;
  $("agarrar").textContent = enMano ? "Soltar" : "Agarrar";

  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}

// ---------- Carga ----------
const gestor = new THREE.LoadingManager();
gestor.onProgress = (_, hechos, total) => $("progreso").style.width = (hechos / total * 100) + "%";
const cargador = new GLTFLoader(gestor);
const cargar = nombre => cargador.loadAsync(`./modelos/${nombre}.glb`);

Promise.all([cargar("granero"), cargar("vaca"), new Promise(r => setTimeout(r, 1600)),
             document.fonts.load('90px Bangers').catch(() => {}),    // la letra de cómic de las piedras
             document.fonts.load('90px Pacifico').catch(() => {})])  // la cursiva del nombre en el maizal
  .then(([granero, vaca]) => {
    // granero: a la altura pedida y apoyado en el piso
    const g = granero.scene;
    const caja = new THREE.Box3().setFromObject(g);
    g.scale.multiplyScalar(ALTO_GRANERO / (caja.max.y - caja.min.y));
    g.traverse(p => { if (p.isMesh) { p.castShadow = true; p.receiveShadow = true; } });
    g.rotation.y = GIRO_GRANERO;
    escena.add(g);
    decorarGranero(g);

    if (MOSTRAR.vacas) crearVacas(vaca);
    crearMaizal();
    if (MOSTRAR.experiencia) crearExperiencia();
    crearPiedras();

    $("progreso").style.width = "100%";
    requestAnimationFrame(cuadro);
    document.body.classList.add("listo");
    listo = true;
  })
  .catch(err => {
    console.error(err);
    $("estado").textContent = "No se pudo cargar la escena";
  });
