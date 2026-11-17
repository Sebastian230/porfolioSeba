import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from './lib/utils/SkeletonUtils.js';
import { mergeGeometries } from './lib/utils/BufferGeometryUtils.js';

// Minijuego de carreras del portfolio: la nave contra 4 bots. Hay tres pistas (carrera.html?pista=campo, bosque o secuoyas):
//   campo    — diseño propio, con todas las cosas del portfolio; se larga cruzando el puente
//   bosque   — un ocho al estilo del "Figure-8 Circuit" de Mario Kart, entre los pinos gigantes; en el cruce una rama pasa
//              por arriba, con rampa, y la otra por abajo
//   secuoyas — persecución entre árboles gigantes, como la de las motos voladoras en la luna boscosa de Star Wars:
//              no hay pista marcada y los troncos están en el medio del camino
//   maizal   — camino de tierra que serpentea por dentro del maizal
//   barrio   — circuito callejero entre graneros, con esquinas cerradas (al estilo de los barrios de Re-Volt)
//   fantasma — camino de tierra con mucha niebla, cráneos y espantapájaros (al estilo del pueblo fantasma de Re-Volt)
// Los trazados de las dos últimas son propios: de Re-Volt se toma la idea, no los mapas ni sus archivos.

// ====== PISTAS ======
// puntos: por dónde pasa el centro de la pista [x, z]; el primero es la largada y se corre en el orden en que están
const ocho = (a, n) => Array.from({ length: n }, (_, k) => {            // lemniscata: un ocho acostado de 2a de ancho
  const t = -0.5 + k / n * Math.PI * 2, d = 1 + Math.sin(t) ** 2;
  return [a * Math.cos(t) / d, a * Math.sin(t) * Math.cos(t) / d];
});
const PISTAS = {
  campo: {
    ancho: 100, suelo: "tierra", niebla: [320, 1500], barreras: true,
    puntos: [[0, 300], [0, -300], [120, -600], [420, -760], [760, -640], [860, -340], [700, -80], [440, 40], [400, 300], [600, 520], [560, 800], [300, 900], [60, 760]],
    laguna: { x: 230, z: -120, r: 55 },
    rio: [[230, -120], [120, -60], [0, -20], [-200, 40], [-500, -60], [-900, 30], [-1500, -40], [-2400, 20]],   // nace en la laguna y cruza la pista bajo el puente
    puente: [0, -20],
    graneros: [[205, 330, 0.65]],
    maiz: [[0.03, 0.2], [0.52, 0.72], [0.86, 0.97]],        // tramos de la vuelta (de 0 a 1) con maizal a los costados
  },
  bosque: {
    ancho: 108, suelo: "asfalto", niebla: [220, 1150], barreras: true, cruce: true,
    puntos: ocho(920, 22),
  },
  barrio: {
    ancho: 104, suelo: "asfalto", niebla: [260, 1300], barreras: true, cerco: true,
    puntos: [[0, 0], [0, -600], [150, -750], [600, -750], [750, -600], [750, -300], [600, -150], [400, -150], [300, -50], [300, 200], [450, 350],
             [750, 350], [900, 500], [900, 750], [750, 900], [150, 900], [0, 750]],
    graneros: [[375, -450, 0.65], [600, 625, 2.2], [150, 420, 1.2], [150, 680, 4]],
  },
  maizal: {                                              // todo entre el maíz: no se ve qué viene después de cada curva
    ancho: 96, suelo: "tierra", niebla: [200, 1000], barreras: true, craneos: 12, filasMaiz: 13,
    puntos: [[0, 0], [0, -500], [250, -800], [600, -650], [650, -300], [450, 0], [650, 300], [1000, 200], [1150, -200], [1400, -450], [1650, -150],
             [1500, 300], [1200, 650], [700, 750], [250, 550]],
    maiz: [[0, 1]],
  },
  fantasma: {
    ancho: 96, suelo: "tierra", niebla: [110, 780], barreras: true, craneos: 30,
    puntos: [[0, 0], [0, -400], [-200, -700], [100, -950], [500, -900], [650, -600], [450, -350], [600, -50], [950, 50], [1100, 400], [850, 700], [450, 650], [250, 400]],
    maiz: [[0.1, 0.24], [0.6, 0.74]],
  },
  secuoyas: {
    ancho: 150, suelo: "hojas", niebla: [130, 950], vueltas: 2, troncos: true, sinAdornos: true, pared: 22, camara: [31, 12],
    puntos: [[0, 0], [0, -500], [200, -950], [650, -1150], [1100, -1000], [1250, -550], [1000, -150], [1150, 300], [900, 750], [400, 850], [150, 450]],
  },
};
const NOMBRE_PISTA = PISTAS[new URLSearchParams(location.search).get("pista")] ? new URLSearchParams(location.search).get("pista") : "campo";
const DEF = PISTAS[NOMBRE_PISTA];
const VUELTAS = DEF.vueltas ?? 3;
// La nave del portfolio llega a unos 106 de velocidad; acá corre al triple
const VEL_MAX = 320, AGARRE = 0.8, GIRO = 1.5, ALTURA = 5;
const G = 2.3;                                          // el decorado va agrandado: los autos son miniaturas a control remoto
const NOMBRES = Object.keys(PISTAS), SIGUIENTE = NOMBRES[(NOMBRES.indexOf(NOMBRE_PISTA) + 1) % NOMBRES.length];
const HABILIDAD = [0.9, 0.93, 0.96, 0.985];             // tope de velocidad de cada bot, como parte del de la nave
const COLORES = [0x4dff7c, 0xff4a4a, 0x4ad2ff, 0xc77dff, 0xffd23c];   // el primero es el tuyo
// =====================

const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const acercar = (dt, k) => Math.min(1, dt * k);
const VIOLETA = 0x1c1452;

// ---------- Idiomas: los mismos del portfolio ----------
const IDIOMAS = ["es", "en", "pt", "zh"];
let guardado = null;
try { guardado = localStorage.getItem("idioma"); } catch { /* sin almacenamiento */ }
const pedido = params.get("lang") ?? guardado ?? (navigator.language || "es").slice(0, 2);
const IDIOMA = IDIOMAS.includes(pedido) ? pedido : "es";
const T = {
  es: { campo: "Carrera del campo", bosque: "Carrera del bosque", secuoyas: "Persecución en el bosque gigante", barrio: "Carrera del barrio", maizal: "Carrera del maizal", fantasma: "Camino fantasma", silencio: "Sonido", golpe: "¡Tronco!", vuelta: "Vuelta", ya: "¡YA!", ultima: "¡Última vuelta!", turbo: "¡Turbo!", gano: "¡Ganaste!", llego: "¡Llegaste!",
        otra: "Otra vez", garaje: "Garaje", elegir: "Elegí tu vehículo", largar: "¡A correr!", datos: ["Velocidad", "Aceleración", "Giro"],
        vehiculos: { ovni: "Ovni", buggy: "Buggy", monstruo: "Monstruo", formula: "Fórmula", escarabajo: "Escarabajo" }, cambiar: "Otra pista: ", volver: "Volver al portfolio", salir: "← Portfolio", vos: "Vos", cargando: "Cargando",
        bots: ["Troll", "Rana", "Vaca", "Calabaza"], ayuda: "W acelerar · A D doblar · S frenar · R reiniciar · G garaje · M sonido", tactil: "Tocá a la izquierda o a la derecha para doblar" },
  en: { campo: "Farm race", bosque: "Forest race", secuoyas: "Giant forest chase", barrio: "Neighbourhood race", maizal: "Cornfield race", fantasma: "Ghost road", silencio: "Sound", golpe: "Tree!", vuelta: "Lap", ya: "GO!", ultima: "Final lap!", turbo: "Boost!", gano: "You win!", llego: "Finished!",
        otra: "Race again", garaje: "Garage", elegir: "Pick your vehicle", largar: "Race!", datos: ["Speed", "Acceleration", "Handling"],
        vehiculos: { ovni: "UFO", buggy: "Buggy", monstruo: "Monster", formula: "Formula", escarabajo: "Beetle" }, cambiar: "Next track: ", volver: "Back to the portfolio", salir: "← Portfolio", vos: "You", cargando: "Loading",
        bots: ["Troll", "Frog", "Cow", "Pumpkin"], ayuda: "W accelerate · A D steer · S brake · R restart · G garage · M sound", tactil: "Touch left or right to steer" },
  pt: { campo: "Corrida do campo", bosque: "Corrida da floresta", secuoyas: "Perseguição na floresta gigante", barrio: "Corrida do bairro", maizal: "Corrida do milharal", fantasma: "Estrada fantasma", silencio: "Som", golpe: "Tronco!", vuelta: "Volta", ya: "JÁ!", ultima: "Última volta!", turbo: "Turbo!", gano: "Você venceu!", llego: "Você chegou!",
        otra: "De novo", garaje: "Garagem", elegir: "Escolha seu veículo", largar: "Correr!", datos: ["Velocidade", "Aceleração", "Curva"],
        vehiculos: { ovni: "Óvni", buggy: "Buggy", monstruo: "Monstro", formula: "Fórmula", escarabajo: "Fusca" }, cambiar: "Outra pista: ", volver: "Voltar ao portfólio", salir: "← Portfólio", vos: "Você", cargando: "Carregando",
        bots: ["Troll", "Rã", "Vaca", "Abóbora"], ayuda: "W acelerar · A D virar · S frear · R reiniciar · G garagem · M som", tactil: "Toque à esquerda ou à direita para virar" },
  zh: { campo: "农场赛", bosque: "森林赛", secuoyas: "巨木森林追逐", barrio: "街区赛", maizal: "玉米地赛", fantasma: "幽灵之路", silencio: "声音", golpe: "撞树了！", vuelta: "圈", ya: "出发！", ultima: "最后一圈！", turbo: "加速！", gano: "你赢了！", llego: "到达终点！",
        otra: "再来一次", garaje: "车库", elegir: "选择你的载具", largar: "开始！", datos: ["速度", "加速", "转向"],
        vehiculos: { ovni: "飞碟", buggy: "越野车", monstruo: "大脚车", formula: "方程式", escarabajo: "甲壳虫" }, cambiar: "下一条赛道：", volver: "返回作品集", salir: "← 作品集", vos: "你", cargando: "加载中",
        bots: ["巨魔", "青蛙", "奶牛", "南瓜"], ayuda: "W 加速 · A D 转向 · S 刹车 · R 重新开始 · G 车库 · M 声音", tactil: "点击左侧或右侧转向" },
}[IDIOMA];
document.documentElement.lang = IDIOMA;
document.title = `${T[NOMBRE_PISTA]} · Sebastian Rodriguez`;
const TACTIL = matchMedia("(pointer: coarse)").matches;
$("cargando").textContent = T.cargando + "…";
$("salir").textContent = T.salir;
$("ayuda").textContent = TACTIL ? T.tactil : T.ayuda;
$("otra").textContent = T.otra;
$("cambiar").textContent = T.cambiar + T[SIGUIENTE];
$("volver").textContent = T.volver;
$("bGaraje").textContent = T.garaje + " (G)";
$("garaje").querySelector("h1").textContent = T.elegir;
$("largar").textContent = T.largar;
$("otra").onclick = () => reiniciar();
$("cambiar").onclick = () => { location.href = `./carrera.html?pista=${SIGUIENTE}`; };
$("volver").onclick = () => { location.href = "./"; };
for (const nombre of NOMBRES) {                         // selector de pistas, arriba
  const b = Object.assign(document.createElement("a"), { textContent: T[nombre], href: `./carrera.html?pista=${nombre}` });
  if (nombre === NOMBRE_PISTA) b.className = "activo";
  $("pistas").append(b);
}

// ---------- La pista, muestreada cada PASO unidades ----------
// px, pz: el centro; tx, tz: hacia dónde va; nx, nz: hacia el costado; curva: cuánto dobla; alto: la loma del puente
const PASO = 8, MEDIA = DEF.ancho / 2;
const curvaPista = new THREE.CatmullRomCurve3(DEF.puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
const N = Math.round(curvaPista.getLength() / PASO);
const px = new Float32Array(N), pz = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
const nx = new Float32Array(N), nz = new Float32Array(N), curva = new Float32Array(N), alto = new Float32Array(N);
const barrera = new Int8Array(N);                       // topes en las curvas: de qué lado está el de afuera (1, -1 o 0 si no hay)
{
  const pts = curvaPista.getSpacedPoints(N);
  for (let i = 0; i < N; i++) { px[i] = pts[i].x; pz[i] = pts[i].z; }
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N, d = Math.hypot(px[b] - px[a], pz[b] - pz[a]);
    tx[i] = (px[b] - px[a]) / d; tz[i] = (pz[b] - pz[a]) / d;
    nx[i] = -tz[i]; nz[i] = tx[i];
  }
  const cruda = new Float32Array(N);                      // con signo: positiva si dobla hacia el lado de (nx, nz)
  for (let i = 0; i < N; i++) { const b = (i + 1) % N; cruda[i] = Math.asin(limitar(tx[i] * tz[b] - tz[i] * tx[b], -1, 1)) / PASO; }
  const suave = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -3; k <= 3; k++) s += cruda[(i + k + N) % N]; suave[i] = s / 7; curva[i] = Math.abs(s / 7); }
  // hay tope donde la curva es cerrada (y un poco antes y después), del lado de afuera
  if (DEF.barreras) for (let i = 0; i < N; i++) if (Math.abs(suave[i]) > 1 / 520)
    for (let k = -7; k <= 7; k++) barrera[(i + k + N) % N] = suave[i] > 0 ? -1 : 1;
}
const alCostado = (i, lat) => [px[i] + nx[i] * lat, pz[i] + nz[i] * lat];
// el punto de la pista más cercano, buscando alrededor de donde ya se estaba (así el cruce del ocho no confunde)
function masCerca(x, z, desde, ventana = 25) {
  let mejor = desde, min = Infinity;
  for (let k = -ventana; k <= ventana; k++) {
    const i = (desde + k + N) % N, d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
    if (d < min) { min = d; mejor = i; }
  }
  return mejor;
}
const lejosDePista = (x, z, cuanto) => { for (let i = 0; i < N; i += 2) if ((x - px[i]) ** 2 + (z - pz[i]) ** 2 < cuanto * cuanto) return false; return true; };
const cajaPista = { x0: Math.min(...px), x1: Math.max(...px), z0: Math.min(...pz), z1: Math.max(...pz) };
// puente: la pista hace una loma al cruzar el río
let EN_PUENTE = -1, LARGO_PUENTE = 9, ABAJO = -1;        // dónde está, cuántos puntos de pista ocupa hacia cada lado y qué punto pasa por debajo
const ALTO_PUENTE = 7, ALTO_CRUCE = 17;
if (DEF.puente) {
  EN_PUENTE = masCerca(DEF.puente[0], DEF.puente[1], 0, Math.floor(N / 2));
  for (let k = -LARGO_PUENTE; k <= LARGO_PUENTE; k++) alto[(EN_PUENTE + k + N) % N] = ALTO_PUENTE * (1 - (k / LARGO_PUENTE) ** 2);
}
// cruce del ocho: la segunda pasada sube por una rampa y cruza por arriba; la primera pasa por debajo
if (DEF.cruce) {
  let min = Infinity;
  for (let i = 0; i < N; i++) for (let j = i + Math.floor(N / 4); j < N && j < i + Math.floor(3 * N / 4); j++) {
    const d = (px[i] - px[j]) ** 2 + (pz[i] - pz[j]) ** 2;
    if (d < min) { min = d; ABAJO = i; EN_PUENTE = j; }
  }
  LARGO_PUENTE = 26;
  for (let k = -LARGO_PUENTE; k <= LARGO_PUENTE; k++) {
    const s = limitar((1 - Math.abs(k) / LARGO_PUENTE) / 0.72, 0, 1);   // rampa suave, con un tramo plano arriba
    alto[(EN_PUENTE + k + N) % N] = ALTO_CRUCE * s * s * (3 - 2 * s);
  }
}
const enPuente = i => EN_PUENTE >= 0 && Math.min((i - EN_PUENTE + N) % N, (EN_PUENTE - i + N) % N) <= LARGO_PUENTE + 1;
// donde la pista de arriba pasa sobre la de abajo queda el hueco del túnel
const sobreLaDeAbajo = (x, z) => { if (ABAJO < 0) return false; for (let k = -14; k <= 14; k++) { const i = (ABAJO + k + N) % N; if ((x - px[i]) ** 2 + (z - pz[i]) ** 2 < (MEDIA + 5) ** 2) return true; } return false; };

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $("escena"), antialias: true, powerPreference: "high-performance" });
const RESOLUCION = Math.min(devicePixelRatio, 1.25);
renderer.setPixelRatio(RESOLUCION);
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(VIOLETA, ...DEF.niebla);
const camara = new THREE.PerspectiveCamera(60, 1, 1, 7000);
function ajustarTamano() {
  renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
}
addEventListener("resize", ajustarTamano);
ajustarTamano();
escena.add(new THREE.HemisphereLight(0xc4bcff, 0x1a1440, 1.05));
const sol = new THREE.DirectionalLight(0xfff4e0, 1.2);
sol.position.set(-40, 80, 45);
escena.add(sol);

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
const polvoTex = (() => {                               // una mancha redonda y difusa, para los brillos
  const [cv, g] = lienzo(64, 64), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.4, "rgba(255,255,255,.5)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const lambert = color => new THREE.MeshLambertMaterial({ color, flatShading: true });
const tenir = (geo, hex) => {                           // el color va en los vértices, para unir piezas en un solo dibujo
  const c = new THREE.Color(hex), n = geo.attributes.position.count, colores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
  return geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
};
const MAT_TENIDO = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// muchas copias de una misma pieza en un solo dibujo. lista: [{ x, z, y, giro, tam, color }]
function instancias(geo, material, lista) {
  const m = new THREE.InstancedMesh(geo, material, lista.length), o = new THREE.Object3D(), c = new THREE.Color();
  lista.forEach((p, i) => {
    o.position.set(p.x, p.y ?? 0, p.z);
    o.rotation.set(0, p.giro ?? 0, 0);
    Array.isArray(p.tam) ? o.scale.set(...p.tam) : o.scale.setScalar(p.tam ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (p.color !== undefined) m.setColorAt(i, c.set(p.color));
  });
  m.frustumCulled = false;
  escena.add(m);
  return m;
}

// cielo violeta de noche, con estrellas en una cúpula que acompaña a la cámara
{
  const [cv, g] = lienzo(4, 256), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#070419"); grad.addColorStop(0.42, "#1c1452"); grad.addColorStop(1, "#1c1452");
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  escena.background = textura(cv);
}
const estrellas = (() => {
  const cantidad = 700, pos = new Float32Array(cantidad * 3);
  for (let i = 0; i < cantidad; i++) {
    const a = Math.random() * 6.28, h = 0.06 + Math.random() ** 1.5 * 0.9, r = Math.sqrt(1 - h * h);
    pos.set([Math.cos(a) * r * 3000, h * 3000, Math.sin(a) * r * 3000], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const puntos = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, color: 0xd9d2ff, transparent: true, depthWrite: false, fog: false }));
  puntos.frustumCulled = false;
  escena.add(puntos);
  return puntos;
})();
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
  t.repeat.set(900, 900);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ map: t }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.set((cajaPista.x0 + cajaPista.x1) / 2, 0, (cajaPista.z0 + cajaPista.z1) / 2);
  escena.add(piso);
}

// ---------- La pista ----------
// una cinta que sigue una lista de puntos { x, z, y, nx, nz, medio } (medio: la mitad del ancho)
function cinta(puntos, material, cerrada, cadaUV, orden = 0) {
  const pos = [], uv = [], indices = [];
  let largo = 0;
  const n = puntos.length + (cerrada ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const p = puntos[k % puntos.length];
    if (k) { const a = puntos[k - 1]; largo += Math.hypot(p.x - a.x, p.z - a.z); }
    pos.push(p.x + p.nx * p.medio, p.y, p.z + p.nz * p.medio, p.x - p.nx * p.medio, p.y, p.z - p.nz * p.medio);
    uv.push(largo / cadaUV, 0, largo / cadaUV, 1);
    if (k) indices.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k, 2 * k - 1, 2 * k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  material.side = THREE.DoubleSide;
  const m = new THREE.Mesh(geo, material);
  m.frustumCulled = false;
  m.renderOrder = orden;
  escena.add(m);
  return m;
}
{
  const [cv, g] = lienzo(256, 256);
  if (DEF.suelo === "tierra") {
    g.fillStyle = "#4b3520"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {                      // piedritas y manchas
      g.fillStyle = ["rgba(30,18,8,.4)", "rgba(110,84,54,.3)", "rgba(60,42,24,.5)"][i % 3];
      g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    g.fillStyle = "rgba(28,18,8,.4)";                    // huellas
    for (const y of [50, 96, 150, 196]) g.fillRect(0, y, 256, 10);
    g.fillStyle = "#234a22";                             // bordes con pasto
    for (let x = 0; x < 256; x += 6) { g.fillRect(x, 0, 6, 3 + Math.random() * 6); g.fillRect(x, 256 - 3 - Math.random() * 6, 6, 10); }
  } else if (DEF.suelo === "hojas") {                    // piso de bosque: tierra oscura con hojas caídas, sin bordes marcados
    g.fillStyle = "#1c2114"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1300; i++) {
      g.fillStyle = ["rgba(70,48,22,.5)", "rgba(20,40,18,.6)", "rgba(96,70,30,.35)", "rgba(8,14,8,.5)"][i % 4];
      g.fillRect(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 2 + Math.random() * 3);
    }
  } else {
    g.fillStyle = "#34313f"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 500; i++) {                      // granulado del asfalto
      g.fillStyle = Math.random() < .5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.12)";
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    g.fillStyle = "#e9e9e9"; g.fillRect(0, 6, 256, 5); g.fillRect(0, 245, 256, 5);
    g.fillStyle = "#f2c230"; g.fillRect(20, 125, 130, 6);
  }
  const t = textura(cv);
  t.wrapS = THREE.RepeatWrapping;
  cinta(Array.from({ length: N }, (_, i) => ({ x: px[i], z: pz[i], y: alto[i] + 0.1, nx: nx[i], nz: nz[i], medio: MEDIA })),
        new THREE.MeshLambertMaterial({ map: t }), true, 60);
}
// largada: franja a cuadros en el piso y un arco con el cráneo de oro arriba
{
  const [cv, g] = lienzo(256, 32);
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? "#111" : "#f4f1de"; g.fillRect(x * 16, y * 16, 16, 16); }
  const cuadros = new THREE.MeshBasicMaterial({ map: textura(cv) });
  const giro = Math.atan2(tx[0], tz[0]);
  const franja = new THREE.Mesh(new THREE.PlaneGeometry(DEF.ancho, 12), cuadros);
  franja.rotation.order = "YXZ";
  franja.rotation.set(-Math.PI / 2, giro, 0);
  franja.position.set(px[0], 0.2, pz[0]);
  const arco = new THREE.Group(), madera = lambert(0x7a5230);
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(4, 56, 4), madera);
    poste.position.set(lado * (MEDIA + 4), 28, 0);
    arco.add(poste);
  }
  const viga = new THREE.Mesh(new THREE.BoxGeometry(DEF.ancho + 12, 10, 2), cuadros);
  viga.position.y = 53;
  arco.add(viga);
  const oro = new THREE.MeshPhongMaterial({ color: 0xffc93c, emissive: 0x7a5200, specular: 0xffffff, shininess: 90, flatShading: true });
  const craneo = armarCraneo(oro, new THREE.MeshBasicMaterial({ color: 0x2a1a00 }));
  craneo.scale.setScalar(3.2);
  craneo.position.y = 55;
  craneo.rotation.y = Math.PI;                           // mira a los que vienen llegando
  arco.add(craneo);
  arco.position.set(px[0], 0, pz[0]);
  arco.rotation.y = giro;
  escena.add(franja, arco);
}

// ---------- Las cosas del portfolio ----------
function armarCraneo(hueso, hueco) {
  const c = new THREE.Group(), en = (geo, mat, x, y, z, giroZ = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = giroZ;
    c.add(m);
  };
  en(new THREE.SphereGeometry(1.9, 10, 8).scale(1.15, 0.95, 1).translate(0, 3.2, 0), hueso, 0, 0, 0);
  en(new THREE.CylinderGeometry(0.75, 1.35, 3.6, 6).rotateX(Math.PI / 2 + 0.35).translate(0, 2.2, 2.3), hueso, 0, 0, 0);   // hocico
  for (const lado of [-1, 1]) {
    en(new THREE.SphereGeometry(0.62, 10, 8).scale(0.5, 1, 1), hueco, lado * 1.75, 3.15, 0.95);                            // cuencas
    en(new THREE.CylinderGeometry(0.36, 0.46, 1.7, 7).rotateZ(Math.PI / 2), hueso, lado * 2.6, 3.9, -0.2);                 // cuernos
    en(new THREE.ConeGeometry(0.36, 2.3, 7), hueso, lado * 3.55, 4.95, -0.2, -lado * 0.3);
  }
  return c;
}
function crearFarola(X, Z, giro) {
  const ALTO = 13, R = 4;
  const madera = lambert(0x7a5230), hierro = new THREE.MeshPhongMaterial({ color: 0x2a2a31, specular: 0x555555, shininess: 30 });
  const f = new THREE.Group();
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, ALTO, 7), madera);
  poste.position.y = ALTO / 2;
  const brazo = new THREE.Mesh(new THREE.TorusGeometry(R, 0.25, 8, 22, Math.PI), hierro);      // medio arco: sube, cruza y baja
  brazo.position.set(-R, ALTO, 0);
  const pantalla = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 10), hierro);
  pantalla.position.set(-2 * R, ALTO - 0.6, 0);
  const bombita = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
  bombita.position.set(-2 * R, ALTO - 1.4, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xffd98a, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(11, 11, 1);
  halo.position.copy(bombita.position);
  // el charco de luz en el piso es pintado, no una luz de verdad: así no le cuesta nada a la placa
  const charco = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial({
    map: polvoTex, color: 0xffc960, opacity: 0.38, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  charco.rotation.x = -Math.PI / 2;
  charco.position.set(-2 * R - 6, 0.3, 0);
  f.add(poste, brazo, pantalla, bombita, halo, charco);
  f.position.set(X, 0, Z);
  f.scale.setScalar(G);
  f.rotation.y = giro;                                   // el brazo apunta hacia -x
  escena.add(f);
}
function crearEspantapajaros(X, Z, giro) {
  const H = 10 * G, g = new THREE.Group();
  const madera = lambert(0x7a5230), rojo = lambert(0xb3202a), paja = lambert(0xd9b84a), naranja = lambert(0xf07a13), negro = new THREE.MeshBasicMaterial({ color: 0x1a0d02 });
  const pieza = (geo, material, x, y, z, giroZ = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.z = giroZ;
    g.add(m);
  };
  pieza(new THREE.BoxGeometry(0.7, H * 0.9, 0.7), madera, 0, H * 0.45, 0);                    // palo clavado en el piso
  pieza(new THREE.BoxGeometry(H * 1.68, H * 0.07, H * 0.07), madera, 0, H * 0.7, 0);          // travesaño
  pieza(new THREE.BoxGeometry(H * 0.26, H * 0.3, H * 0.2), rojo, 0, H * 0.58, 0);             // camisa
  for (const lado of [-1, 1]) {
    pieza(new THREE.BoxGeometry(H * 0.6, H * 0.18, H * 0.19), rojo, lado * H * 0.5, H * 0.7, 0, -lado * 0.06);   // mangas
    for (let i = 0; i < 8; i++)                                                               // paja saliendo de las mangas
      pieza(new THREE.ConeGeometry(H * 0.022, H * (0.26 + (i % 3) * 0.05), 4), paja, lado * H * 0.86, H * (0.7 + (i % 5 - 2) * 0.035), H * (i % 4 - 1.5) * 0.03,
            -lado * (Math.PI / 2 + (i % 5 - 2) * 0.2));
  }
  const R = H * 0.45, cy = H * 0.74 + R * 0.8;                                                // cabezota de calabaza
  pieza(new THREE.SphereGeometry(R, 12, 8).scale(1, 0.82, 1), naranja, 0, cy, 0);
  for (const lado of [-1, 1]) pieza(new THREE.ConeGeometry(R * 0.2, R * 0.34, 3), negro, lado * R * 0.38, cy + R * 0.1, R * 0.9);   // ojos
  pieza(new THREE.BoxGeometry(R * 0.9, R * 0.14, 0.2), negro, 0, cy - R * 0.22, R * 0.92);    // boca
  g.position.set(X, 0, Z);
  g.rotation.set(0, giro, 0.04);
  escena.add(g);
}
function crearTroll() {                                 // agachado: asoma la cabeza por la boca del arco
  const piel = lambert(0x4f6b3e), oscuro = lambert(0x2b2015), hueso = new THREE.MeshLambertMaterial({ color: 0xe9e4d0 });
  const ojo = new THREE.MeshBasicMaterial({ color: 0xffd60a, fog: false });
  const pieza = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const g = new THREE.Group();                            // mira hacia +z
  g.add(pieza(4.8, 3, 4, piel, 0, 1.5, -3.2), pieza(3, 2.5, 2.7, piel, 0, 3, 0.3), pieza(0.9, 1.2, 1.2, piel, 0, 2.7, 2), pieza(1.9, 0.3, 0.3, oscuro, 0, 2.05, 1.7));
  for (const lado of [-1, 1])
    g.add(pieza(0.6, 0.5, 0.2, ojo, lado * 0.85, 3.5, 1.7), pieza(0.5, 1.3, 0.3, piel, lado * 1.9, 3.6, 0.2), pieza(0.3, 0.7, 0.3, hueso, lado * 0.7, 2.4, 1.75),
          pieza(1.3, 1.1, 1.5, piel, lado * 2.3, 0.6, 1), pieza(1.5, 2.8, 1.7, piel, lado * 2.9, 1.4, -1.5));
  const garrote = new THREE.Group();
  garrote.add(pieza(0.8, 5.4, 0.8, oscuro, 0, 2.7, 0), pieza(1.5, 2, 1.5, oscuro, 0, 4.9, 0));
  garrote.position.set(2.2, 2.3, 1.1);
  garrote.rotation.x = -0.95;
  g.add(garrote);
  g.scale.setScalar(1.5);
  escena.add(g);
  return g;
}
function crearRana(X, Z) {
  const verde = lambert(0x2c5527), claro = new THREE.MeshBasicMaterial({ color: 0xd8d27a }), negro = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const bola = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const g = new THREE.Group();
  g.add(bola(1.3, verde, 0, 0.75, -0.1, 1.15, 0.55, 1.55), bola(0.9, verde, 0, 0.95, 1.3, 1.1, 0.6, 1));
  for (const lado of [-1, 1])
    g.add(bola(0.36, verde, lado * 0.6, 1.5, 1.35), bola(0.2, claro, lado * 0.66, 1.55, 1.62), bola(0.1, negro, lado * 0.68, 1.56, 1.8),
          bola(0.6, verde, lado * 1.45, 0.4, -0.9, 0.9, 0.55, 1.7), bola(0.3, verde, lado * 1.05, 0.25, 1.5, 1, 0.5, 1.4));
  g.scale.setScalar(1.6);
  g.position.set(X, 0.2, Z);
  escena.add(g);
  return g;
}
function crearPozo(X, Z) {
  const R = 6, pozo = new THREE.Group();
  const piedra = new THREE.MeshLambertMaterial({ color: 0x8b8d99, flatShading: true, side: THREE.DoubleSide });
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.25, 2, 10, 1, true), piedra);
  pared.position.y = 1;
  const agua = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 20), new THREE.MeshBasicMaterial({ color: 0x3aa85a }));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = 1.4;
  const brillo = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.6, R * 3.6), new THREE.MeshBasicMaterial({
    map: polvoTex, color: 0x6dff7a, opacity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  brillo.rotation.x = -Math.PI / 2;
  brillo.position.y = 2.2;
  pozo.add(pared, agua, brillo);
  pozo.position.set(X, 0, Z);
  pozo.scale.setScalar(G);
  escena.add(pozo);
}
// geometrías que se repiten por instancias
const GEO = {
  calabaza: (() => {
    const g = mergeGeometries([tenir(new THREE.SphereGeometry(1.1, 10, 7).scale(1, 0.74, 1).translate(0, 0.8, 0), 0xf07a13),
                               tenir(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 5).translate(0, 1.75, 0), 0x3f7d2c)]);
    return g;
  })(),
  pino: (() => {
    const copa = (r, h, y) => tenir(new THREE.ConeGeometry(r, h, 6, 1, true).translate(0, y, 0), 0x0f2e1c);
    return mergeGeometries([tenir(new THREE.CylinderGeometry(0.45, 0.7, 3, 5, 1, true).translate(0, 1.5, 0), 0x2a1c12), copa(3.4, 5, 5), copa(2.7, 4.5, 7.8), copa(1.9, 4, 10.4)]);
  })(),
  banco: (() => {
    const MADERA = 0x7a5230, HIERRO = 0x2a2a31;
    const tabla = (w, h, d, hex, x, y, z, inclinada = 0) => tenir(new THREE.BoxGeometry(w, h, d).rotateX(inclinada).translate(x, y, z), hex);
    const partes = [];
    for (const z of [-0.35, 0.35, 1.05]) partes.push(tabla(7.4, 0.2, 0.6, MADERA, 0, 1.55, z));
    partes.push(tabla(7.4, 0.6, 0.18, MADERA, 0, 2.35, -0.88, -0.2), tabla(7.4, 0.6, 0.18, MADERA, 0, 3.1, -1.03, -0.2));
    for (const x of [-3.3, 3.3])
      partes.push(tabla(0.3, 1.55, 0.3, HIERRO, x, 0.775, 1.1), tabla(0.3, 3.4, 0.3, HIERRO, x, 1.7, -0.78, -0.2), tabla(0.3, 0.2, 2.3, HIERRO, x, 2.35, 0.2), tabla(0.3, 0.7, 0.3, HIERRO, x, 1.95, 1.1));
    return mergeGeometries(partes);
  })(),
};

// ---------- Río, laguna y puente (solo en el campo) ----------
let texAgua = null, rana = null, troll = null;
const rioPts = [];                                       // puntos del río, para no plantar nada encima
if (DEF.rio) {
  const [cv, g] = lienzo(256, 128);
  g.fillStyle = "#123a7a"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "rgba(140,190,255,.45)"; g.lineWidth = 3; g.lineCap = "round";
  for (let i = 0; i < 22; i++) {                         // olitas
    const x = Math.random() * 256, y = 8 + Math.random() * 112, l = 14 + Math.random() * 26;
    for (const dx of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + l / 2, y - 5, x + dx + l, y); g.stroke(); }
  }
  texAgua = textura(cv);
  texAgua.wrapS = THREE.RepeatWrapping;
  const curvaRio = new THREE.CatmullRomCurve3(DEF.rio.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const pts = curvaRio.getSpacedPoints(Math.round(curvaRio.getLength() / 12));
  pts.forEach((p, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], d = Math.hypot(b.x - a.x, b.z - a.z);
    rioPts.push({ x: p.x, z: p.z, y: 0, nx: -(b.z - a.z) / d, nz: (b.x - a.x) / d, medio: 8 });
  });
  cinta(rioPts.map(p => ({ ...p, y: 0.05, medio: 10.5 })), new THREE.MeshBasicMaterial({ color: 0x241b12 }), false, 36, -2);   // orillas de barro
  cinta(rioPts.map(p => ({ ...p, y: 0.07 })), new THREE.MeshBasicMaterial({ map: texAgua }), false, 36, -1);

  // laguna de orilla irregular, verde flúo, con la rana en su hoja
  const L = DEF.laguna, borde = a => 1 + 0.13 * Math.sin(2 * a + 1) + 0.08 * Math.sin(3 * a + 4) + 0.05 * Math.sin(5 * a);
  const charco = (r, y, color) => {
    const forma = new THREE.Shape();
    for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, x = Math.cos(a) * r * borde(a), z = Math.sin(a) * r * borde(a); i ? forma.lineTo(x, -z) : forma.moveTo(x, -z); }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(L.x, y, L.z);
    escena.add(m);
  };
  charco(L.r + 2.5, 0.09, 0x241b12);
  charco(L.r, 0.11, 0x2c8048);
  const hoja = new THREE.Mesh(new THREE.CircleGeometry(7, 28, 0.35, Math.PI * 2 - 0.7), new THREE.MeshBasicMaterial({ color: 0x1b4d24 }));
  hoja.rotation.x = -Math.PI / 2;
  hoja.position.set(L.x, 0.15, L.z);
  const resplandor = new THREE.Mesh(new THREE.PlaneGeometry(L.r * 3.4, L.r * 3.4), new THREE.MeshBasicMaterial({
    map: polvoTex, color: 0x6dff7a, opacity: 0.16, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  resplandor.rotation.x = -Math.PI / 2;
  resplandor.position.set(L.x, 0.4, L.z);
  escena.add(hoja, resplandor);
  rana = crearRana(L.x, L.z);

  // puente de piedra, con la boca del arco por donde pasa el río
  paredesDelPuente();
  const boca = new THREE.MeshBasicMaterial({ color: 0x0a0812, side: THREE.DoubleSide });
  for (const lado of [-1, 1]) {
    const arco = new THREE.Mesh(new THREE.CircleGeometry(6.2, 18, 0, Math.PI), boca);
    const [ax, az] = alCostado(EN_PUENTE, lado * (MEDIA + 0.9));
    arco.position.set(ax, 0, az);
    arco.rotation.y = Math.atan2(nx[EN_PUENTE] * lado, nz[EN_PUENTE] * lado);
    escena.add(arco);
  }
  troll = crearTroll();
  const [trx, trz] = alCostado(EN_PUENTE, MEDIA + 4);    // del lado de la laguna
  troll.position.set(trx, 0.1, trz);
  troll.rotation.y = Math.atan2(nx[EN_PUENTE], nz[EN_PUENTE]);
}
if (DEF.cruce) paredesDelPuente();
// dos paredes de piedra que siguen la loma de la pista, de baranda a piso. Donde pasa otra pista por debajo, la pared
// no llega al piso: queda solo el borde del puente y se forma el túnel
function paredesDelPuente() {
  const piedra = new THREE.MeshLambertMaterial({ color: 0x6f7286, flatShading: true, side: THREE.DoubleSide });
  for (const lado of [-1, 1]) {
    const pos = [], indices = [];
    for (let k = -LARGO_PUENTE; k <= LARGO_PUENTE; k++) {
      const i = (EN_PUENTE + k + N) % N, [x, z] = alCostado(i, lado * (MEDIA + 0.6)), n = pos.length / 3;
      pos.push(x, sobreLaDeAbajo(x, z) ? alto[i] - 2.5 : 0, z, x, alto[i] + 2.2, z);   // la pared sube un poco más que la pista: es la baranda
      if (k > -LARGO_PUENTE) indices.push(n - 2, n - 1, n, n, n - 1, n + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const pared = new THREE.Mesh(geo, piedra);
    pared.frustumCulled = false;
    escena.add(pared);
  }
}
const lejosDelAgua = (x, z, cuanto) => {
  if (DEF.laguna && Math.hypot(x - DEF.laguna.x, z - DEF.laguna.z) < DEF.laguna.r * 1.3 + cuanto) return false;
  for (const p of rioPts) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (8 + cuanto) ** 2) return false;
  return true;
};
const GRANEROS = DEF.graneros ?? [];
const lejosDelGranero = (x, z, cuanto) => GRANEROS.every(([gx, gz]) => Math.hypot(x - gx, z - gz) > cuanto);

// ---------- Decorado alrededor de la pista ----------
const turbos = [], obstaculos = [], troncos = [];       // troncos: árboles en medio del camino, [{ i, lat, x, z, r }]
{
  const borde = [], frac = i => i / N;
  const conMaiz = i => (DEF.maiz ?? []).some(([a, b]) => frac(i) >= a && frac(i) <= b);

  // cerco de madera a los dos costados (en el campo), menos en el puente
  if (DEF.suelo === "tierra" || DEF.cerco) {
    const piezas = [];
    for (let i = 0; i < N; i++) for (const lado of [-1, 1]) {
      if (enPuente(i) || barrera[i] === lado) continue;   // donde hay tope no hace falta cerco
      const [x, z] = alCostado(i, lado * (MEDIA + 4)), giro = Math.atan2(tx[i], tz[i]);
      if (i % 2 === 0) piezas.push({ x, z, y: 1.3 * G, giro, tam: [0.5 * G, 2.6 * G, 0.5 * G] });
      for (const y of [1, 2]) piezas.push({ x: x + tx[i] * PASO / 2, z: z + tz[i] * PASO / 2, y: y * G, giro, tam: [0.18 * G, 0.32 * G, PASO + 0.4] });
    }
    instancias(new THREE.BoxGeometry(1, 1, 1), lambert(0x7a5230), piezas);
  }

  // maizal: plantas 2D en cruz, en hileras a los costados
  if (DEF.maiz) {
    const [cv, g] = lienzo(128, 256);
    g.lineCap = "round";
    g.strokeStyle = "#8a8f34"; g.lineWidth = 9;
    g.beginPath(); g.moveTo(64, 256); g.lineTo(64, 40); g.stroke();
    const hoja = (y, lado, largo) => {
      g.fillStyle = y % 2 ? "#a3a83a" : "#c2b94a";
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + lado * largo * .6, y - 46, 64 + lado * largo, y - 8);
      g.quadraticCurveTo(64 + lado * largo * .5, y - 22, 64, y + 14);
      g.fill();
    };
    hoja(225, -1, 56); hoja(196, 1, 58); hoja(160, -1, 54); hoja(127, 1, 52); hoja(96, -1, 44); hoja(71, 1, 38);
    g.fillStyle = "#f2c230";
    g.beginPath(); g.ellipse(80, 150, 9, 22, 0.35, 0, 6.3); g.fill();
    const cara = () => new THREE.PlaneGeometry(4 * G, 7 * G).translate(0, 3.5 * G, 0);
    const plantas = [];
    for (let i = 0; i < N; i++) {
      if (!conMaiz(i) || enPuente(i)) continue;
      for (const lado of [-1, 1]) for (let fila = 0; fila < (DEF.filasMaiz ?? 7); fila++) for (let k = 0; k < (i % 2 ? 1 : 2); k++) {
        const [x, z] = alCostado(i, lado * (MEDIA + 12 + fila * 7 + Math.random() * 2.5));
        const px2 = x + tx[i] * (k * 4 + Math.random() * 2), pz2 = z + tz[i] * (k * 4 + Math.random() * 2);
        if (!lejosDePista(px2, pz2, MEDIA + 9) || !lejosDelAgua(px2, pz2, 6) || !lejosDelGranero(px2, pz2, 75)) continue;
        plantas.push({ x: px2, z: pz2, giro: Math.random() * 3.14, tam: 0.8 + Math.random() * 0.45 });
      }
    }
    instancias(mergeGeometries([cara(), cara().rotateY(Math.PI / 2)]),
               new THREE.MeshBasicMaterial({ map: textura(cv), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x9a9ab0 }), plantas);
  }

  // topes en las curvas: una baranda baja, a rayas rojas y blancas, del lado de afuera
  {
    const piezas = [];
    for (let i = 0; i < N; i++) {
      if (!barrera[i]) continue;
      const [x, z] = alCostado(i, barrera[i] * (MEDIA + 2));
      piezas.push({ x, z, y: alto[i] + 1.6 * G, giro: Math.atan2(tx[i], tz[i]), tam: [1.6 * G, 3.2 * G, PASO + 0.5], color: (i >> 1) % 2 ? 0xd92b2b : 0xf4f1de });
    }
    if (piezas.length) instancias(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), piezas);
  }

  // farolas con su banco al lado, repartidas por la vuelta y alternando de costado
  const bancos = [];
  for (let k = 0; k < (DEF.sinAdornos ? 0 : 10); k++) {
    const i = Math.round((k + 0.5) / 10 * N) % N, lado = k % 2 ? 1 : -1;
    if (enPuente(i)) continue;
    const [x, z] = alCostado(i, lado * (MEDIA + 7)), haciaX = -nx[i] * lado, haciaZ = -nz[i] * lado;   // hacia la pista
    if (!lejosDePista(x, z, MEDIA + 4)) continue;
    crearFarola(x, z, Math.atan2(haciaZ, -haciaX));
    const [bx, bz] = alCostado((i + 4) % N, lado * (MEDIA + 13));
    if (lejosDePista(bx, bz, MEDIA + 8)) bancos.push({ x: bx, z: bz, giro: Math.atan2(haciaX, haciaZ), tam: 1.5 * G });
    borde.push([x, z], [bx, bz]);
  }
  if (bancos.length) instancias(GEO.banco, MAT_TENIDO, bancos);

  // cuadros de los proyectos, como carteles de publicidad al costado de la pista
  if (!DEF.sinAdornos) {
    const FOTOS = ["vetusmoon", "panel", "owners", "portfolio", "longbox", "catalogo3d", "bot", "cubitos", "servidor", "redes", "netplus", "secplus"];
    const oscuro = new THREE.MeshLambertMaterial({ color: 0x1d1a2b }), cargador = new THREE.TextureLoader();
    const geo = new THREE.BoxGeometry(56, 31.5, 2), pata = new THREE.BoxGeometry(1.6, 12, 1.6);
    FOTOS.forEach((nombre, k) => {
      const i = Math.round((k + 0.2) / FOTOS.length * N) % N, lado = k % 2 ? -1 : 1;
      const [x, z] = alCostado(i, lado * (MEDIA + 42));
      if (enPuente(i) || !lejosDePista(x, z, MEDIA + 34) || !lejosDelAgua(x, z, 20) || !lejosDelGranero(x, z, 60)) return;
      const tex = cargador.load(`./img/${nombre}.jpg`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(geo, [oscuro, oscuro, oscuro, oscuro, new THREE.MeshBasicMaterial({ map: tex }), oscuro]);
      m.position.set(x, 12 + 15.75, z);
      m.rotation.y = Math.atan2(-tx[i] - nx[i] * lado * 0.5, -tz[i] - nz[i] * lado * 0.5);   // de frente a los que vienen, algo girado hacia la pista
      for (const s of [-1, 1]) { const p = new THREE.Mesh(pata, oscuro); p.position.set(s * 20, -15.75 - 6, 0); m.add(p); }
      escena.add(m);
      borde.push([x, z]);
    });
  }

  // cráneos gigantes y espantapájaros, mirando la carrera desde afuera de las curvas
  {
    const hueso = new THREE.MeshLambertMaterial({ color: 0xf2f0e6, flatShading: true }), hueco = new THREE.MeshBasicMaterial({ color: 0x151019 });
    const cuantos = DEF.sinAdornos ? 0 : DEF.craneos ?? 8;
    for (let k = 0; k < cuantos; k++) {
      const i = Math.round((k + 0.75) / cuantos * N) % N, lado = k % 2 ? 1 : -1;
      const [x, z] = alCostado(i, lado * (MEDIA + 34));
      if (enPuente(i) || !lejosDePista(x, z, MEDIA + 26) || !lejosDelAgua(x, z, 12) || !lejosDelGranero(x, z, 50)) continue;
      const giro = Math.atan2(-nx[i] * lado, -nz[i] * lado);
      if (k % 3 === 2) crearEspantapajaros(x, z, giro);
      else {
        const c = armarCraneo(hueso, hueco);
        c.scale.setScalar(2.6 * G);
        c.position.set(x, -1.5 * G, z);
        c.rotation.set(-0.2, giro, (Math.random() - 0.5) * 0.3);
        c.rotation.order = "YXZ";
        escena.add(c);
      }
      borde.push([x, z]);
    }
  }
  const libreDeCosas = (x, z, cuanto) => borde.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > cuanto);

  // calabazas de adorno, al borde de la pista y sueltas por el campo
  {
    const lista = [];
    for (let k = 0; k < (DEF.sinAdornos ? 0 : 520); k++) {
      const i = Math.floor(Math.random() * N), [x, z] = alCostado(i, (Math.random() < 0.5 ? -1 : 1) * (MEDIA + 12 + Math.random() ** 2 * 140));
      if (enPuente(i) || !lejosDePista(x, z, MEDIA + 11) || !lejosDelAgua(x, z, 3) || !lejosDelGranero(x, z, 42) || !libreDeCosas(x, z, 7)) continue;
      lista.push({ x, z, giro: Math.random() * 6.28, tam: [1.4, 2, 2.8, 3.6][k % 4] * G });
    }
    if (lista.length) instancias(GEO.calabaza, MAT_TENIDO, lista);
  }

  // secuoyas: troncos gigantes, pelados, con la copa bien arriba. Unos van en medio del camino (se chocan) y el resto
  // forma el bosque de alrededor, bien tupido
  if (DEF.troncos) {
    const lista = [], c = new THREE.Color();
    const sumar = (x, z, r) => lista.push({ x, z, giro: Math.random() * 6.28, tam: r / 0.56, color: c.setHSL(0.04 + Math.random() * 0.05, 0.35, 0.55 + Math.random() * 0.4).getHex() });
    for (let i = 26; i < N - 12; i += 8 + Math.floor(Math.random() * 6)) {
      const r = 4 + Math.random() * 2.5, lat = (Math.random() * 2 - 1) * (MEDIA - 12), [x, z] = alCostado(i, lat);
      troncos.push({ i, lat, x, z, r });
      sumar(x, z, r);
      if (Math.random() < 0.45) {                         // a veces viene otro al lado, dejando un hueco para pasar
        const lat2 = lat + (lat > 0 ? -1 : 1) * (44 + Math.random() * 24), r2 = 4 + Math.random() * 2, [x2, z2] = alCostado(i + 2, lat2);
        if (Math.abs(lat2) < MEDIA - 8) { troncos.push({ i: i + 2, lat: lat2, x: x2, z: z2, r: r2 }); sumar(x2, z2, r2); }
      }
    }
    for (let k = 0; k < 40000 && lista.length < 900; k++) {
      const x = cajaPista.x0 - 500 + Math.random() * (cajaPista.x1 - cajaPista.x0 + 1000), z = cajaPista.z0 - 500 + Math.random() * (cajaPista.z1 - cajaPista.z0 + 1000);
      let d = Infinity;
      for (let i = 0; i < N; i += 2) d = Math.min(d, Math.hypot(x - px[i], z - pz[i]));
      const r = 4 + Math.random() * 4;
      if (d < MEDIA + DEF.pared + r + 4 || (d > 420 && Math.random() < 0.6) || lista.some(p => Math.hypot(x - p.x, z - p.z) < 20)) continue;
      sumar(x, z, r);
    }
    const copa = (r, h, y) => tenir(new THREE.ConeGeometry(r, h, 7, 1, true).translate(0, y, 0), 0x12331f);
    instancias(mergeGeometries([tenir(new THREE.CylinderGeometry(0.5, 0.62, 16, 8, 1, true).translate(0, 8, 0), 0x6a3a22), copa(3.4, 5, 13), copa(2.7, 4.5, 16), copa(1.9, 4, 19)]),
               MAT_TENIDO, lista);
  }

  // pinos: chicos cerca de la pista y cada vez más grandes hacia afuera. En el bosque son muchos más y gigantes
  if (!DEF.troncos) {
    const bosque = NOMBRE_PISTA === "bosque", lista = [], c = new THREE.Color();
    const margen = bosque ? 900 : 650, cuantos = bosque ? 620 : 260;
    for (let k = 0; k < 30000 && lista.length < cuantos; k++) {
      const x = cajaPista.x0 - margen + Math.random() * (cajaPista.x1 - cajaPista.x0 + 2 * margen);
      const z = cajaPista.z0 - margen + Math.random() * (cajaPista.z1 - cajaPista.z0 + 2 * margen);
      let d = Infinity;
      for (let i = 0; i < N; i += 2) d = Math.min(d, Math.hypot(x - px[i], z - pz[i]));
      const tam = bosque ? 1.6 + Math.min(1, (d - MEDIA) / 320) ** 1.3 * 13 : 1.3 + Math.min(1, (d - MEDIA) / 500) * 5;
      const copa = 3.4 * tam * 1.3;
      if (d < MEDIA + 10 + copa * 0.8 || (!bosque && d < MEDIA + 60) || !lejosDelAgua(x, z, 10 + copa) || !lejosDelGranero(x, z, 120 + copa) || !libreDeCosas(x, z, 8 + copa * 0.5)) continue;
      if (lista.some(p => Math.hypot(x - p.x, z - p.z) < (bosque ? 9 : 14) + tam * 2.2)) continue;
      const s = tam * (1 + Math.random() * 0.3);
      lista.push({ x, z, giro: Math.random() * 6.28, tam: [s, s * (0.9 + Math.random() * 0.35), s], color: c.setHSL(0.22 + Math.random() * 0.2, 0.3, 0.6 + Math.random() * 0.4).getHex() });
    }
    instancias(GEO.pino, MAT_TENIDO, lista);
  }

  // en la pista: flechas de turbo y calabazas para esquivar
  for (let k = 0; k < 6; k++) {
    let i = Math.round((k + 0.35) / 6 * N) % N;
    while (enPuente(i) || troncos.some(t => Math.abs(t.i - i) < 5)) i = (i + 4) % N;
    const lat = (k % 2 ? 1 : -1) * MEDIA * 0.42, [x, z] = alCostado(i, lat);
    turbos.push({ i, lat, x, z });
  }
  for (let k = 0; k < (DEF.troncos ? 0 : Math.floor((N - 80) / 42)); k++) {
    let i = (40 + Math.round(k * 42 + Math.random() * 16)) % N;
    while (enPuente(i) || turbos.some(t => Math.abs(t.i - i) < 8)) i = (i + 5) % N;
    const lat = (Math.random() * 2 - 1) * (MEDIA - 8), [x, z] = alCostado(i, lat);
    obstaculos.push({ i, lat, x, z, vivo: true, t: 0, vx: 0, vz: 0, giro: 0 });
  }
}
// dibujos de los turbos (flechas pintadas que laten) y de las calabazas de la pista
const matTurbo = (() => {
  const [cv, g] = lienzo(128, 128);
  g.strokeStyle = "#39ff14"; g.lineWidth = 16; g.lineJoin = "miter";
  for (const y of [100, 62, 24]) { g.beginPath(); g.moveTo(18, y + 22); g.lineTo(64, y - 14); g.lineTo(110, y + 22); g.stroke(); }
  return new THREE.MeshBasicMaterial({ map: textura(cv), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
})();
for (const t of turbos) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), matTurbo);
  m.rotation.order = "YXZ";
  m.rotation.set(-Math.PI / 2, Math.atan2(tx[t.i], tz[t.i]) + Math.PI, 0);   // las flechas apuntan hacia adelante
  m.position.set(t.x, alto[t.i] + 0.3, t.z);
  escena.add(m);
}
for (const o of obstaculos) {
  o.m = new THREE.Mesh(GEO.calabaza, MAT_TENIDO);
  o.m.scale.setScalar(6.5);
  o.m.position.set(o.x, 0, o.z);
  escena.add(o.m);
}

// ---------- Naves ----------
function crearNave(color) {
  const g = new THREE.Group(), cuerpo = new THREE.Group(), R = 4.7;
  const perfil = [[0, -0.85], [1.9, -0.85], [R * 0.84, -0.3], [R, 0.02], [R * 0.84, 0.42], [2.3, 0.85], [0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y));
  const plato = new THREE.Mesh(new THREE.LatheGeometry(perfil, 28), new THREE.MeshPhongMaterial({ color: 0xb9bfc6, specular: 0x555a60, shininess: 28 }));
  const aro = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.32, 6, 28), new THREE.MeshBasicMaterial({ color }));   // el color de cada corredor
  aro.rotation.x = Math.PI / 2;
  aro.position.y = 0.2;
  const vidrio = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.7, 18, 1, true), vidrio);
  tubo.position.y = 1.95;
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.75, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), vidrio);
  cupula.position.y = 2.8;
  const antena = new THREE.Group();
  antena.position.set(3.2, 0.3, -2.3);
  const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 6), new THREE.MeshPhongMaterial({ color: 0x8f969e }));
  varilla.position.y = 1.8;
  const punto = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  punto.position.y = 3.7;
  antena.add(varilla, punto);
  // el fuego del turbo, atrás
  const fuego = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0x39ff14, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fuego.position.set(0, 0, -6.5);
  fuego.visible = false;
  cuerpo.add(plato, aro, tubo, cupula, antena, fuego);
  g.add(cuerpo);
  // en el piso: la sombra y un resplandor del color de la nave
  const piso = new THREE.Group();
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(4.6, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  const luz = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: polvoTex, color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  luz.rotation.x = -Math.PI / 2;
  luz.position.y = 0.05;
  piso.add(sombra, luz);
  escena.add(g, piso);
  return { g, cuerpo, antena, fuego, piso };
}
// Autos a control remoto, al estilo de Re-Volt: carrocería de cajas, ruedas grandes y antena. Miran hacia +z.
// r: radio de las ruedas; trocha: de la rueda al centro; ejes: dónde van el eje de adelante y el de atrás
const FORMAS = {
  buggy: { r: 1.5, trocha: 2.7, ejes: [3, -3], piezas: (c, m) => {
    c(4, 0.8, 8.6, m.pintura, 0, 1.7, 0); c(3.4, 0.6, 2.8, m.pintura, 0, 2.3, 2.7); c(3, 1.3, 3, m.vidrio, 0, 2.7, -0.4);
    c(3.2, 0.25, 0.25, m.gris, 0, 3.5, -1.9); c(4.8, 0.2, 1.3, m.pintura, 0, 3.7, -4); for (const x of [-1.7, 1.7]) c(0.3, 1.4, 0.3, m.negro, x, 3, -4);
    c(4.4, 0.5, 0.5, m.negro, 0, 1.4, 4.4); } },
  monstruo: { r: 2.6, trocha: 3.4, ejes: [3.5, -3.5], piezas: (c, m) => {
    c(4.6, 1.5, 8.2, m.pintura, 0, 4.6, 0); c(4.2, 1.7, 3.6, m.pintura, 0, 6.1, -0.2); c(3.8, 1.1, 0.2, m.vidrio, 0, 6.2, 1.66);
    for (const x of [-2.15, 2.15]) c(0.15, 1, 2.6, m.vidrio, x, 6.2, -0.2);
    for (const x of [-1.9, 1.9]) for (const z of [3.5, -3.5]) c(0.45, 2.2, 0.45, m.gris, x, 3.2, z);
    c(5, 0.7, 0.7, m.negro, 0, 4.1, 4.3); c(4, 0.5, 2.4, m.negro, 0, 5.5, -2.9); } },
  formula: { r: 1.3, trocha: 2.8, ejes: [3.5, -3.1], piezas: (c, m) => {
    c(1.6, 0.9, 9.2, m.pintura, 0, 1.4, 0.2); c(3.6, 0.7, 3.4, m.pintura, 0, 1.3, -0.9); c(5.4, 0.2, 1.1, m.pintura, 0, 0.8, 5);
    c(4.6, 0.25, 1.2, m.pintura, 0, 3.1, -4.4); for (const x of [-1.9, 1.9]) c(0.2, 1.7, 1.2, m.negro, x, 2.4, -4.4);
    c(0.9, 0.8, 1, m.negro, 0, 2.2, -0.2); c(0.8, 1, 1.5, m.pintura, 0, 2.3, -1.6); c(4.2, 0.2, 0.2, m.gris, 0, 1.3, 3.5); c(4.2, 0.2, 0.2, m.gris, 0, 1.3, -3.1); } },
  escarabajo: { r: 1.45, trocha: 2.5, ejes: [2.7, -2.7], piezas: (c, m) => {
    c(4.6, 1.3, 7.6, m.pintura, 0, 2, 0); c(3.9, 1.4, 3.8, m.pintura, 0, 3.3, -0.3); c(3.6, 0.9, 0.2, m.vidrio, 0, 3.4, 1.62); c(3.6, 0.9, 0.2, m.vidrio, 0, 3.4, -2.22);
    for (const x of [-1.98, 1.98]) c(0.12, 0.8, 2.6, m.vidrio, x, 3.4, -0.3);
    c(3.6, 0.5, 1.6, m.pintura, 0, 2.8, 2.9); for (const x of [-1.5, 1.5]) c(0.7, 0.5, 0.2, m.luz, x, 2.2, 3.82); c(4.8, 0.4, 0.5, m.gris, 0, 1.5, 3.9); c(4.8, 0.4, 0.5, m.gris, 0, 1.5, -3.9); } },
};
// velocidad, aceleración y giro de cada vehículo, como parte de los de la nave; pasto: cuánto conserva fuera de la pista
const VEHICULOS = {
  ovni: { vel: 1, acel: 1, giro: 1 },
  buggy: { vel: 1, acel: 1.12, giro: 1.06 },
  monstruo: { vel: 0.94, acel: 1.25, giro: 0.95, pasto: 0.66 },
  formula: { vel: 1.06, acel: 0.88, giro: 0.9 },
  escarabajo: { vel: 0.97, acel: 1, giro: 1.22 },
};
function crearAuto(tipo, color) {
  const F = FORMAS[tipo], g = new THREE.Group(), cuerpo = new THREE.Group();
  const m = { pintura: lambert(color), negro: lambert(0x17161d), vidrio: lambert(0x9fd8ff), gris: lambert(0x8f969e), luz: new THREE.MeshBasicMaterial({ color: 0xfff2b0 }) };
  F.piezas((w, h, d, mat, x, y, z) => { const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); p.position.set(x, y, z); cuerpo.add(p); }, m);
  // ruedas: cada una cuelga de un pivote (las de adelante doblan) y gira sobre su eje
  const geoRueda = new THREE.CylinderGeometry(F.r, F.r, F.r * 0.95, 12).rotateZ(Math.PI / 2), geoTaza = new THREE.CylinderGeometry(F.r * 0.45, F.r * 0.45, F.r * 1.02, 6).rotateZ(Math.PI / 2);
  const ruedas = [], delanteras = [];
  F.ejes.forEach((z, eje) => { for (const lado of [-1, 1]) {
    const pivote = new THREE.Group(), rueda = new THREE.Mesh(geoRueda, m.negro);
    rueda.add(new THREE.Mesh(geoTaza, m.pintura));
    pivote.position.set(lado * F.trocha, F.r, z);
    pivote.add(rueda);
    g.add(pivote);
    ruedas.push(rueda);
    if (!eje) delanteras.push(pivote);
  } });
  const alto = Math.max(...cuerpo.children.map(p => p.position.y + p.geometry.parameters.height / 2));
  const antena = new THREE.Group();                       // la antena del control remoto
  antena.position.set(1.4, alto - 0.3, F.ejes[1] + 0.6);
  const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 5, 5), m.gris);
  varilla.position.y = 2.5;
  const punto = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  punto.position.y = 5;
  antena.add(varilla, punto);
  const fuego = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0x39ff14, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fuego.position.set(0, F.r + 0.6, F.ejes[1] - 3.2);
  fuego.visible = false;
  cuerpo.add(antena, fuego);
  g.add(cuerpo);
  g.rotation.order = "YXZ";
  const piso = new THREE.Group();
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(F.trocha * 2 + 2.4, Math.abs(F.ejes[0] - F.ejes[1]) + 5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  const luz = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ map: polvoTex, color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  luz.rotation.x = -Math.PI / 2;
  luz.position.y = 0.05;
  piso.add(sombra, luz);
  piso.rotation.order = "YXZ";
  escena.add(g, piso);
  return { g, cuerpo, antena, fuego, piso, ruedas, delanteras, radio: F.r };
}
// le pone a un corredor su vehículo (y saca el que tenía)
function vestir(n, tipo) {
  if (n.g) escena.remove(n.g, n.piso);
  Object.assign(n, { ruedas: [], delanteras: [], radio: 0 }, tipo === "ovni" ? crearNave(n.color) : crearAuto(tipo, n.color), { tipo, v: VEHICULOS[tipo] });
}
const TIPOS = Object.keys(VEHICULOS);
let elegido = "buggy";
try { elegido = localStorage.getItem("carreraVehiculo") ?? "buggy"; } catch { /* sin almacenamiento */ }
if (!VEHICULOS[elegido]) elegido = "buggy";
if (params.get("auto") && VEHICULOS[params.get("vehiculo")]) elegido = params.get("vehiculo");
const naves = COLORES.map((color, k) => ({
  color, yo: k === 0, nombre: k ? T.bots[k - 1] : T.vos,
  bot: k || params.get("auto") ? { tope: k ? HABILIDAD[k - 1] : 1, carril: 0, carrilAhora: 0, fase: k * 1.7 } : null,
  x: 0, z: 0, ang: 0, vel: 0, ix: 0, iz: 0, i: 0, lat: 0, vuelta: -1, turbo: 0, giro: 0, golpe: 0, llego: null,
}));
const yo = naves[0];
naves.forEach((n, k) => vestir(n, k ? TIPOS[(TIPOS.indexOf(elegido) + k) % TIPOS.length] : elegido));   // los bots, con los otros cuatro

// ---------- Garaje: se elige el vehículo antes de largar ----------
let enGaraje = false;
function abrirGaraje() {
  enGaraje = true;
  reiniciar();
  $("garaje").classList.add("ver");
  pintarGaraje();
}
function pintarGaraje() {
  const barra = v => `<i><b style="width:${Math.round((v - 0.8) / 0.5 * 100)}%"></b></i>`;
  $("autos").innerHTML = TIPOS.map(t => { const v = VEHICULOS[t];
    return `<button type="button" data-tipo="${t}" class="${t === yo.tipo ? "activo" : ""}"><strong>${T.vehiculos[t]}</strong>${T.datos[0]}${barra(v.vel)}${T.datos[1]}${barra(v.acel)}${T.datos[2]}${barra(v.giro)}</button>`; }).join("");
}
$("autos").addEventListener("click", e => {
  const tipo = e.target.closest("button")?.dataset.tipo;
  if (!tipo) return;
  elegido = tipo;
  try { localStorage.setItem("carreraVehiculo", tipo); } catch { /* sin almacenamiento */ }
  naves.forEach((n, k) => vestir(n, k ? TIPOS[(TIPOS.indexOf(elegido) + k) % TIPOS.length] : elegido));
  pintarGaraje();
});
function largar() { enGaraje = false; $("garaje").classList.remove("ver"); reiniciar(); }
$("largar").onclick = largar;
$("bGaraje").onclick = abrirGaraje;
let cuenta = 0, tiempo = 0, terminado = false, avisoT = 0;
function reiniciar() {
  // parrilla: de a dos por fila, detrás de la línea; vos largás último
  naves.forEach((n, k) => {
    const orden = k === 0 ? naves.length - 1 : k - 1;      // vos al fondo
    const f = Math.floor(orden / 2), ii = (N - 4 - f * 3 + N) % N, l = (orden % 2 ? 1 : -1) * MEDIA * 0.4;
    [n.x, n.z] = alCostado(ii, l);
    Object.assign(n, { ang: Math.atan2(tx[ii], tz[ii]), vel: 0, ix: 0, iz: 0, i: ii, lat: l, vuelta: -1, turbo: 0, giro: 0, golpe: 0, llego: null });
    if (n.yo && !params.get("auto")) n.bot = null;       // si venías de terminar una carrera, volvés a manejar vos
    if (n.bot) Object.assign(n.bot, { carril: l, carrilAhora: l });
  });
  for (const o of obstaculos) { o.vivo = true; o.m.position.set(o.x, alto[o.i], o.z); o.m.rotation.set(0, 0, 0); }
  cuenta = 3.99; tiempo = 0; terminado = false;
  camAng = yo.ang;
  $("fin").classList.remove("ver");
}

// ---------- Sonido: todo hecho en el momento con osciladores, sin archivos. Arranca con la primera tecla o toque ----------
let audio = null, motor = null, sonidoOn = true;
try { sonidoOn = localStorage.getItem("sonido") !== "no"; } catch { /* sin almacenamiento */ }
function prenderSonido() {
  if (audio || params.get("auto") || params.get("prueba")) return;
  try {
    audio = new AudioContext();
    const osc = audio.createOscillator(), filtro = audio.createBiquadFilter(), vol = audio.createGain();
    osc.type = "sawtooth";
    filtro.type = "lowpass"; filtro.frequency.value = 900;
    vol.gain.value = 0;
    osc.connect(filtro).connect(vol).connect(audio.destination);
    osc.start();
    motor = { osc, vol, filtro };
  } catch { audio = null; }
}
for (const gesto of ["keydown", "pointerdown"]) addEventListener(gesto, prenderSonido, { once: false });
function sonar(frec, dura, tipo = "square", vol = 0.05, cae = 0.5) {
  if (!audio || !sonidoOn) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.type = tipo;
  o.frequency.setValueAtTime(frec, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, frec * cae), t + dura);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + dura);
}
function sonarMotor() {                                  // el zumbido del motor a control remoto: sube con la velocidad
  if (!motor) return;
  const corre = sonidoOn && !enGaraje && !document.hidden, k = yo.vel / VEL_MAX;
  motor.osc.frequency.setTargetAtTime(70 + k * 260 + (yo.turbo > 0 ? 60 : 0), audio.currentTime, 0.05);
  motor.filtro.frequency.setTargetAtTime(500 + k * 1800, audio.currentTime, 0.05);
  motor.vol.gain.setTargetAtTime(corre ? 0.012 + k * 0.03 : 0, audio.currentTime, 0.08);
}

// ---------- Controles ----------
const teclas = new Set();
const MAPA = { w: "gas", arrowup: "gas", s: "freno", arrowdown: "freno", a: "izq", arrowleft: "izq", d: "der", arrowright: "der" };
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (MAPA[k]) { teclas.add(MAPA[k]); e.preventDefault(); }
  if (k === "r" && !enGaraje) reiniciar();
  if (k === "g") abrirGaraje();
  if (k === "m") { sonidoOn = !sonidoOn; try { localStorage.setItem("sonido", sonidoOn ? "si" : "no"); } catch { /* sin almacenamiento */ } }
  if (k === "enter" && enGaraje) return largar();
  if (k === "escape") location.href = "./";
  if (k === "enter" && terminado) reiniciar();
});
addEventListener("keyup", e => teclas.delete(MAPA[e.key.toLowerCase()]));
addEventListener("blur", () => teclas.clear());
// táctil: acelera sola; se dobla tocando la mitad izquierda o derecha de la pantalla
const dedos = new Map();
addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" && !e.target.closest("button, a")) dedos.set(e.pointerId, e.clientX); });
addEventListener("pointermove", e => { if (dedos.has(e.pointerId)) dedos.set(e.pointerId, e.clientX); });
for (const fin of ["pointerup", "pointercancel"]) addEventListener(fin, e => dedos.delete(e.pointerId));
function mandos() {
  let giro = teclas.has("der") - teclas.has("izq"), gas = teclas.has("gas") - teclas.has("freno");
  if (TACTIL) {
    gas = 1;
    for (const x of dedos.values()) giro += x > innerWidth / 2 ? 1 : -1;
    if (dedos.size >= 2 && giro === 0) gas = -1;         // un dedo de cada lado: frena
  }
  return [gas, limitar(giro, -1, 1)];
}

// ---------- Bots: siguen la pista por su carril, frenan antes de las curvas y esquivan calabazas ----------
function pilotoBot(n, t, dt) {
  const b = n.bot, adelante = Math.round(3 + n.vel * 0.035);   // apunta a un punto cercano: si mira muy lejos, corta las curvas por el pasto
  let carril = b.carril + Math.sin(t * 0.4 + b.fase) * 5;
  for (const tb of turbos) { const d = (tb.i - n.i + N) % N; if (d > 2 && d < 34 && Math.abs(tb.lat - carril) < 26) carril = tb.lat; }   // si le queda a mano, va por el turbo
  for (const o of obstaculos) {
    const d = (o.i - n.i + N) % N;
    if (o.vivo && d > 0 && d < 28 && Math.abs(o.lat - carril) < 15) carril += (carril >= o.lat ? 1 : -1) * 22;
  }
  for (const tr of troncos) {
    const d = (tr.i - n.i + N) % N;
    if (d >= 0 && d < 30 && Math.abs(tr.lat - carril) < tr.r + 8) carril = tr.lat + (carril >= tr.lat ? 1 : -1) * (tr.r + 13);
  }
  b.carrilAhora += (limitar(carril, -MEDIA + 9, MEDIA - 9) - b.carrilAhora) * acercar(dt, DEF.troncos ? 5 : 2.5);
  const j = (n.i + adelante) % N, [mx, mz] = alCostado(j, b.carrilAhora);
  let dif = Math.atan2(mx - n.x, mz - n.z) - n.ang;
  dif = Math.atan2(Math.sin(dif), Math.cos(dif));
  let c = 1e-5;
  for (let k = 0; k < adelante + 22; k++) c = Math.max(c, curva[(n.i + k) % N]);
  const segura = GIRO * n.v.giro * 0.85 / c;                        // lo más rápido que puede doblar lo que viene
  return [n.vel < segura ? 1 : -1, limitar(-dif * 3, -1, 1)];
}
const avance = n => n.vuelta * N + n.i;

// ---------- Física: un paso corto de simulación ----------
function paso(dt, t) {
  for (const n of naves) {
    let gas = 0, giro = 0;
    if (cuenta <= 0) {
      if (n.llego !== null && !n.bot) n.bot = { tope: 0.8, carril: 0, carrilAhora: n.lat, fase: 0 };   // al llegar, la tuya sigue sola
      [gas, giro] = n.bot ? pilotoBot(n, t, dt) : mandos();
    }
    const enPista = Math.abs(n.lat) < MEDIA + 2;
    let tope = VEL_MAX * n.v.vel * (enPista ? 1 : n.v.pasto ?? 0.42) * (n.turbo > 0 ? 1.3 : 1);
    if (n.bot && n.llego === null && !n.yo) {             // los bots aflojan si se te escapan y aprietan si quedan lejos
      const d = avance(n) - avance(yo);
      tope *= n.bot.tope * (d > 45 ? 0.93 : d < -45 ? 1.06 : 1);
    } else if (n.bot) tope *= n.bot.tope;
    const meta = gas > 0 ? tope : 0;
    const k = gas < 0 ? 2.2 : gas > 0 ? (n.vel > tope ? 2.5 : AGARRE * n.v.acel * (n.turbo > 0 ? 2.5 : 1)) : 0.35;
    n.vel += (meta - n.vel) * (1 - Math.exp(-k * dt));
    n.giro += (giro - n.giro) * acercar(dt, 9);
    n.ang -= n.giro * GIRO * n.v.giro * Math.min(1, n.vel / 50) * dt;
    n.x += (Math.sin(n.ang) * n.vel + n.ix) * dt;
    n.z += (Math.cos(n.ang) * n.vel + n.iz) * dt;
    const frena = Math.exp(-4 * dt);
    n.ix *= frena; n.iz *= frena;
    n.turbo = Math.max(0, n.turbo - dt);

    // dónde está respecto de la pista, y las vueltas
    const antes = n.i;
    n.i = masCerca(n.x, n.z, antes);
    n.lat = (n.x - px[n.i]) * nx[n.i] + (n.z - pz[n.i]) * nz[n.i];
    if (n.i - antes < -N / 2) n.vuelta++;
    else if (n.i - antes > N / 2) n.vuelta--;
    // tope de las curvas: no deja salir, y la nave se acomoda y sigue rozándolo
    const b = barrera[n.i], sale = n.lat * b - (MEDIA - 3.6);
    if (b && sale > 0) {
      n.x -= nx[n.i] * b * sale; n.z -= nz[n.i] * b * sale;
      n.lat -= b * sale;
      let dif = Math.atan2(tx[n.i], tz[n.i]) - n.ang;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      n.ang += dif * acercar(dt, 4);
      n.vel *= Math.exp(-0.35 * dt);
    }
    const tope_lat = MEDIA + (DEF.pared ?? 90);          // muy afuera no se puede ir: hay como una pared blanda
    if (Math.abs(n.lat) > tope_lat) {
      const sobra = (Math.abs(n.lat) - tope_lat) * Math.sign(n.lat);
      n.x -= nx[n.i] * sobra; n.z -= nz[n.i] * sobra;
      n.vel *= Math.exp(-2 * dt);
    }
    n.golpe = Math.max(0, n.golpe - dt);
    for (const tr of troncos) {                          // los troncos no se atraviesan: rebota y pierde velocidad
      const dx = n.x - tr.x, dz = n.z - tr.z, d = Math.hypot(dx, dz), junto = tr.r + 3.8;
      if (d >= junto || d < 0.001) continue;
      n.x += dx / d * (junto - d); n.z += dz / d * (junto - d);
      if (n.golpe <= 0) {
        n.vel *= 0.4; n.ix += dx / d * 70; n.iz += dz / d * 70; n.golpe = 0.6;
        if (n.yo && !n.bot) { temblor = 1; avisar(T.golpe); sonar(110, 0.3, "sawtooth", 0.1, 0.4); }
      }
    }
    if (n.vuelta >= VUELTAS && n.llego === null) {
      n.llego = tiempo;
      if (n.yo) { terminar(); [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => sonar(f, 0.3, "triangle", 0.07, 1), k * 130)); }
    }
    for (const tb of turbos) if ((n.x - tb.x) ** 2 + (n.z - tb.z) ** 2 < 22 * 22) { if (n.yo && n.turbo <= 0) { avisar(T.turbo); sonar(300, 0.5, "sawtooth", 0.05, 4); } n.turbo = 1.7; }
    for (const o of obstaculos) if (o.vivo && (n.x - o.x) ** 2 + (n.z - o.z) ** 2 < 10.5 * 10.5) {     // ¡calabazazo!
      o.vivo = false; o.t = 0;
      o.vx = Math.sin(n.ang) * n.vel * 0.7 + (Math.random() - 0.5) * 60; o.vz = Math.cos(n.ang) * n.vel * 0.7 + (Math.random() - 0.5) * 60;
      n.vel *= 0.5;
      if (n.yo) { temblor = 1; sonar(160, 0.25, "square", 0.08, 0.3); }
    }
  }
  // choques entre naves: se empujan
  for (let a = 0; a < naves.length; a++) for (let b = a + 1; b < naves.length; b++) {
    const A = naves[a], B = naves[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d >= 9.4 || d < 0.001 || Math.abs(alto[A.i] - alto[B.i]) > 7) continue;   // una arriba del puente y otra abajo: no se tocan
    const ux = dx / d, uz = dz / d, mete = (9.4 - d) / 2;
    A.x -= ux * mete; A.z -= uz * mete; B.x += ux * mete; B.z += uz * mete;
    A.ix -= ux * 26; A.iz -= uz * 26; B.ix += ux * 26; B.iz += uz * 26;
    A.vel *= 0.985; B.vel *= 0.985;
  }
  for (const o of obstaculos) if (!o.vivo) {              // la calabaza sale volando y al rato vuelve a su lugar
    o.t += dt;
    if (o.t > 6) { o.vivo = true; o.m.position.set(o.x, alto[o.i], o.z); o.m.rotation.set(0, 0, 0); o.m.scale.setScalar(6.5); continue; }
    o.m.position.x += o.vx * dt; o.m.position.z += o.vz * dt;
    o.m.position.y = Math.max(0, alto[o.i] + 70 * o.t - 90 * o.t * o.t);
    o.m.rotation.x += dt * 9; o.m.rotation.z += dt * 6;
    if (o.t > 5.4) o.m.scale.setScalar(Math.max(0.01, 6.5 * (6 - o.t) / 0.6));
    if (o.m.position.y <= 0) { o.vx *= Math.exp(-3 * dt); o.vz *= Math.exp(-3 * dt); }
  }
  if (cuenta <= 0 && !terminado) tiempo += dt;
}
const puestos = () => [...naves].sort((a, b) => (a.llego ?? Infinity) - (b.llego ?? Infinity) || avance(b) - avance(a));
const reloj2 = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
function avisar(texto) {
  $("aviso").textContent = texto;
  $("aviso").classList.add("ver");
  avisoT = 1.3;
}
function terminar() {
  terminado = true;
  const orden = puestos();
  $("fin").querySelector("h1").textContent = orden[0] === yo ? T.gano : T.llego;
  $("fin").querySelector("ol").innerHTML = orden.map((n, k) =>
    `<li class="${n.yo ? "vos" : ""}"><span>${k + 1}. ${n.nombre}</span><span>${n.llego !== null ? reloj2(n.llego) : "—"}</span></li>`).join("");
  setTimeout(() => $("fin").classList.add("ver"), 900);
}

// ---------- Minimapa ----------
const mapa = (() => {
  const cv = $("mapa"), g = cv.getContext("2d"), M = 26;
  const k = Math.min((cv.width - 2 * M) / (cajaPista.x1 - cajaPista.x0), (cv.height - 2 * M) / (cajaPista.z1 - cajaPista.z0));
  const ax = x => cv.width / 2 + (x - (cajaPista.x0 + cajaPista.x1) / 2) * k, az = z => cv.height / 2 + (z - (cajaPista.z0 + cajaPista.z1) / 2) * k;
  const [fondo, gf] = lienzo(cv.width, cv.height);
  gf.lineJoin = gf.lineCap = "round";
  for (const [color, ancho] of [["#f4f1de", 12], ["#2a2350", 8]]) {
    gf.strokeStyle = color; gf.lineWidth = ancho;
    gf.beginPath();
    for (let i = 0; i <= N; i += 2) i ? gf.lineTo(ax(px[i % N]), az(pz[i % N])) : gf.moveTo(ax(px[0]), az(pz[0]));
    gf.closePath(); gf.stroke();
  }
  gf.fillStyle = "#fff"; gf.fillRect(ax(px[0]) - 7, az(pz[0]) - 2, 14, 4);   // la largada
  return () => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(fondo, 0, 0);
    for (let n = naves.length - 1; n >= 0; n--) {
      const v = naves[n];
      g.fillStyle = "#" + v.color.toString(16).padStart(6, "0");
      g.beginPath(); g.arc(ax(v.x), az(v.z), v.yo ? 9 : 6, 0, 6.3); g.fill();
      if (v.yo) { g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.stroke(); }
    }
  };
})();

// ---------- Cuadro a cuadro ----------
const reloj = new THREE.Clock();
let camAng = 0, temblor = 0, fov = 60, cuadros = 0, desdeFps = 0, nivel = 0, mediasLentas = 0, numeroCuadro = 0;
const NIVELES = [1, 0.85, 0.7, 0.58];
const miradaCam = new THREE.Vector3();
const alturaEn = n => alto[n.i];
function simular(dt, t) {
  const antes = Math.ceil(cuenta);
  cuenta -= dt;
  if (Math.ceil(cuenta) !== antes && antes >= 1 && antes <= 3) sonar(antes === 1 ? 880 : 440, antes === 1 ? 0.6 : 0.18, "square", 0.06, 1);   // pip, pip, ¡piiip!
  for (let resto = dt; resto > 1e-5; resto -= 1 / 120) paso(Math.min(resto, 1 / 120), t);
}
function cuadro() {
  const real = reloj.getDelta(), dt = Math.min(real, 0.05), t = reloj.elapsedTime;
  cuadros++;
  if ((desdeFps += real) >= 0.5) {
    const fps = cuadros / desdeFps;
    $("fps").textContent = Math.round(fps) + " FPS";
    // calidad adaptable: si no llega a 50 FPS, baja de a poco la resolución
    mediasLentas = fps < 50 && t > 4 && !document.hidden ? mediasLentas + 1 : 0;
    if (mediasLentas >= 4 && nivel < NIVELES.length - 1) { mediasLentas = 0; renderer.setPixelRatio(RESOLUCION * NIVELES[++nivel]); ajustarTamano(); }
    cuadros = 0; desdeFps = 0;
  }
  if (!enGaraje) simular(dt, t);
  sonarMotor();

  // naves
  for (const n of naves) {
    const y = alturaEn(n);
    const rapidez = n.vel / VEL_MAX;
    n.g.rotation.y = n.ang;
    if (n.tipo === "ovni") {
      n.g.position.set(n.x, ALTURA + y + Math.sin(t * 2.6 + n.color) * 0.3, n.z);
      n.cuerpo.rotation.z = n.giro * 0.45;                // se ladea al doblar
      n.cuerpo.rotation.x = -0.05 - 0.1 * rapidez;        // y baja la trompa con la velocidad
      n.antena.rotation.x = -0.9 * rapidez;               // la antena se va para atrás
    } else {                                              // auto: va apoyado en el piso
      const a = (n.i + N - 1) % N, b = (n.i + 1) % N;
      n.g.position.set(n.x, y, n.z);
      n.g.rotation.x = -Math.atan((alto[b] - alto[a]) / (2 * PASO));          // sube y baja las rampas
      n.cuerpo.rotation.z = -n.giro * 0.13 * Math.min(1, rapidez * 2);        // la carrocería se vuelca hacia afuera de la curva
      n.cuerpo.rotation.x = -0.04 * rapidez + Math.sin(t * 31 + n.color) * 0.012 * rapidez;   // y tiembla con la velocidad
      n.cuerpo.position.y = Math.abs(Math.sin(t * 23 + n.color)) * 0.14 * rapidez;            // la suspensión
      for (const r of n.ruedas) r.rotation.x += n.vel * dt / n.radio;        // las ruedas giran lo que avanza
      for (const p of n.delanteras) p.rotation.y = -n.giro * 0.5;            // y las de adelante doblan
      n.antena.rotation.x = -0.75 * rapidez + Math.sin(t * 17 + n.color) * 0.08 * rapidez;   // la antena chicotea
      n.antena.rotation.z = -n.giro * 0.4;
      n.piso.rotation.y = n.ang;
    }
    n.fuego.visible = n.turbo > 0;
    if (n.turbo > 0) n.fuego.scale.setScalar(7 + Math.random() * 4);
    n.piso.position.set(n.x, y + 0.25, n.z);
  }
  if (rana) rana.position.y = 0.2 + Math.max(0, Math.sin(t * 2.2)) ** 6 * 2;
  if (texAgua) texAgua.offset.x -= dt * 0.12;
  if (troll) troll.position.y = 0.1 + Math.sin(t * 2) * 0.12;
  matTurbo.opacity = 0.65 + 0.35 * Math.sin(t * 9);

  // cámara: detrás de la nave, girando con ella con un poco de retraso
  if (enGaraje) camAng += dt * 0.5;                       // en el garaje la cámara da vueltas alrededor de tu vehículo
  let dif = enGaraje ? 0 : yo.ang - camAng;
  dif = Math.atan2(Math.sin(dif), Math.cos(dif));
  camAng += dif * acercar(dt, 5);
  const sx = Math.sin(camAng), sz = Math.cos(camAng), y = alturaEn(yo);
  temblor = Math.max(0, temblor - dt * 2.5);
  const [lejos, arriba] = DEF.camara ?? [40, 19];
  camara.position.set(yo.x - sx * lejos + (Math.random() - .5) * temblor * 2, y + arriba + (Math.random() - .5) * temblor * 2, yo.z - sz * lejos);
  miradaCam.set(yo.x + sx * 28, y + 4, yo.z + sz * 28);
  if (enGaraje) miradaCam.set(yo.x, y - 9, yo.z);          // el vehículo queda arriba, despejado del cartel del garaje
  camara.lookAt(miradaCam);
  const fovMeta = 56 + 16 * Math.min(1.3, yo.vel / VEL_MAX) + (yo.turbo > 0 ? 6 : 0);    // con la velocidad se abre el campo de visión
  fov += (fovMeta - fov) * acercar(dt, 3);
  camara.fov = fov;
  camara.updateProjectionMatrix();
  estrellas.position.copy(camara.position);
  estrellas.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.7);

  // marcador
  const lugar = puestos().indexOf(yo) + 1;
  $("puesto").innerHTML = `${lugar}<small>/${naves.length}</small>`;
  $("vuelta").textContent = `${T.vuelta} ${limitar(yo.vuelta + 1, 1, VUELTAS)}/${VUELTAS}`;
  $("tiempo").textContent = reloj2(yo.llego ?? tiempo);
  $("velocidad").innerHTML = `${Math.round(yo.vel)}<small> km/h</small>`;
  $("velocidad").classList.toggle("turbo", yo.turbo > 0);
  $("cuenta").textContent = cuenta > 0 ? Math.ceil(cuenta > 3 ? 3 : cuenta) : cuenta > -0.8 ? T.ya : "";
  if (yo.vuelta === VUELTAS - 1 && !ultimaAvisada) { ultimaAvisada = true; avisar(T.ultima); }
  if (yo.vuelta < VUELTAS - 1) ultimaAvisada = false;
  avisoT -= dt;
  if (avisoT <= 0) $("aviso").classList.remove("ver");
  if (++numeroCuadro % 2 === 0) mapa();

  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}
let ultimaAvisada = false;

// ---------- Carga: el granero y las vacas, solo en las pistas que los usan ----------
async function cargarGraneros() {
  const cargador = new GLTFLoader(), cargar = nombre => cargador.loadAsync(`./modelos/${nombre}.glb`);
  const [granero, vaca] = await Promise.all([cargar("granero"), cargar("vaca")]);
  const caja = new THREE.Box3().setFromObject(granero.scene), escala = 78 / (caja.max.y - caja.min.y);
  GRANEROS.forEach(([x, z, giro], k) => {
    const g = k ? granero.scene.clone() : granero.scene;
    g.scale.setScalar(escala);
    g.position.set(x, 0, z);
    g.rotation.y = giro;
    escena.add(g);
  });
  const [gx, gz] = GRANEROS[0];
  for (const [dx, dz, giro] of [[-78, 44, 0.6], [70, 62, 2.4], [30, -84, 4], [-60, -64, 5.2]]) {   // vacas pastando alrededor del primero
    const modelo = clonarConEsqueleto(vaca.scene);
    modelo.scale.setScalar(2.4);
    modelo.traverse(p => { if (p.isMesh) p.frustumCulled = false; });
    modelo.position.set(gx + dx, 0, gz + dz);
    modelo.rotation.y = giro;
    escena.add(modelo);
  }
  crearPozo(gx - 96, gz - 12);
}
Promise.all([GRANEROS.length ? cargarGraneros() : null, document.fonts.load('90px Bangers').catch(() => {})])
  .catch(err => console.error(err))                       // si falla un modelo, se corre igual
  .then(() => {
    reiniciar();
    if (params.get("prueba")) probar();
    for (let t = 0; t < Number(params.get("salto") ?? 0); t += 1 / 60) simular(1 / 60, t);   // ?salto=20: arranca con la carrera ya empezada (para pruebas)
    if (params.get("desde")) {                           // ?desde=0.5: pone tu nave a mitad de la vuelta (para pruebas)
      const i = Math.round(Number(params.get("desde")) * N) % N;
      Object.assign(yo, { x: px[i], z: pz[i], i, ang: Math.atan2(tx[i], tz[i]), vel: 200 });
    }
    camAng = yo.ang;
    if (!["auto", "prueba", "salto", "desde"].some(k => params.get(k))) abrirGaraje();
    document.body.classList.add("listo");
    requestAnimationFrame(cuadro);
  });

// ?prueba=1: corre una carrera entera de un saque, sin dibujar, y deja el resultado en la página (para revisar sin jugar)
function probar() {
  let t = 0, maxLat = 0, pasos = 0;
  const afuera = naves.map(() => 0);
  while (t < 240 && naves.some(n => n.llego === null)) {
    simular(1 / 60, t); t += 1 / 60; pasos++;
    naves.forEach((n, k) => { maxLat = Math.max(maxLat, Math.abs(n.lat)); if (Math.abs(n.lat) > MEDIA) afuera[k]++; });
  }
  let radio = Infinity;
  for (let i = 0; i < N; i++) radio = Math.min(radio, 1 / Math.max(curva[i], 1e-9));
  const salida = Object.assign(document.createElement("pre"), { id: "prueba" });
  salida.textContent = JSON.stringify({ pista: NOMBRE_PISTA, largo: N * PASO, radioMinimo: Math.round(radio), maxFueraDelCentro: Math.round(maxLat), mediaPista: MEDIA, abajo: +(ABAJO / N).toFixed(3), arriba: +(EN_PUENTE / N).toFixed(3), porcentajeAfuera: afuera.map(a => +(a / pasos * 100).toFixed(1)),
    llegadas: puestos().map(n => [n.nombre, n.llego === null ? null : +n.llego.toFixed(1)]) });
  document.body.append(salida);
  reiniciar();
}
window.carrera = { naves, reiniciar, simular };
