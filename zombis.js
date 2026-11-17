import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from './lib/utils/SkeletonUtils.js';

// Modo zombis del portfolio, en primera persona y en cel shading: sos el ovni, con una metralleta de tambor, encerrado
// en un caserón de campo. Toma las reglas clásicas del género (rondas, puntos, puertas y armas que se compran, ventanas
// con tablas que los zombis arrancan y vos reponés, corriente, ventajas, caja misteriosa, mejoradora y premios).
// El mapa, los nombres y los sonidos son propios; los modelos del zombi y de las armas son de Quaternius (CC0).

// ====== AJUSTES ======
// El mapa es el MAP02 de Freedoom (https://freedoom.github.io), un juego de código abierto con licencia BSD: ver mapas/FREEDOOM-COPYING.txt.
// Se pasó a un JSON con sus paredes, pisos y una grilla para caminar; las puertas, los puestos y las reglas son nuestros.
const MAPA = await (await fetch("./mapas/freedoom-map02.json")).json();
const COSTO_PUERTAS = [750, 1000, 1000, 1250, 1500, 1500, 2000];
// qué va en cada lugar, del más cercano a la largada al más lejano
const PUESTOS = ["revolver", "tommy", "caja", "escopeta", "jugo", "rifle", "trampa", "turbo", "tirador", "palanca", "laser", "mejora"];
const ARMAS = [
  // dano por bala · cadencia en tiros por segundo. Un zombi tiene 150 de vida
  { id: "pistola", modelo: "pistola", largo: 0.95, dano: 50, cadencia: 4, cargador: 8, reserva: 80, recarga: 1.3, color: 0xffd23c, abre: 0.03 },   // la de arranque
  { id: "revolver", modelo: "revolver", largo: 1.05, dano: 160, cadencia: 1.7, cargador: 6, reserva: 60, recarga: 2.1, color: 0xffb060, abre: 0.01, costo: 800 },
  { id: "tommy", modelo: "metralleta", largo: 1.7, dano: 45, cadencia: 15, cargador: 32, reserva: 256, recarga: 1.8, color: 0xffd23c, abre: 0.09, costo: 1000 },
  { id: "escopeta", modelo: "escopeta", largo: 2.3, dano: 80, cadencia: 1.1, cargador: 6, reserva: 54, recarga: 2.2, color: 0xff8a1f, perdigones: 9, abre: 0.3, costo: 1500 },
  { id: "rifle", modelo: "rifle", largo: 2.3, dano: 100, cadencia: 7.5, cargador: 30, reserva: 210, recarga: 2.2, color: 0xffe9a0, abre: 0.035, costo: 1800 },
  { id: "tirador", modelo: "tirador", largo: 2.6, dano: 320, cadencia: 2.6, cargador: 10, reserva: 80, recarga: 2.4, color: 0xf4f1de, abre: 0.005, costo: 2200 },
  { id: "laser", modelo: "laser", largo: 2.2, tinte: 0x4dff7c, dano: 400, cadencia: 3.2, cargador: 12, reserva: 96, recarga: 1.6, color: 0x4dff7c, atraviesa: true, costo: 2800 },
  // estas solo salen de la caja
  { id: "pesada", modelo: "pesada", largo: 2.4, dano: 130, cadencia: 11, cargador: 100, reserva: 300, recarga: 4.2, color: 0xffc040, abre: 0.07 },
  { id: "franco", modelo: "franco", largo: 2.7, dano: 3000, cadencia: 0.9, cargador: 5, reserva: 45, recarga: 2.6, color: 0xf4f1de, atraviesa: true },
  { id: "cohete", modelo: "cohete", largo: 2.1, vista: 1.15, dano: 1500, cadencia: 0.7, cargador: 1, reserva: 20, recarga: 2.2, color: 0xff5a2a, onda: 20 },
  { id: "rayo", modelo: "metralleta", largo: 1.7, tinte: 0xff3ad0, dano: 800, cadencia: 3, cargador: 20, reserva: 160, recarga: 2.4, color: 0xff3ad0, onda: 13 },
];
const ARMA = id => ARMAS.find(a => a.id === id);
const CUCHILLO = { dano: 150, alcance: 9, espera: 0.7 };
const VENTAJAS = { jugo: { costo: 2500, icono: "🎃" }, turbo: { costo: 2000, icono: "⚡" } };   // jugo: aguantás más golpes; turbo: te movés y recargás más rápido
const COSTO_CAJA = 950, COSTO_MEJORA = 5000, COSTO_TRAMPA = 1000, MAX_ZOMBIS = 30, TABLAS = 6;
// la dificultad sube por cantidad, no por aguante
const vidaZombi = () => 150;                              // siempre la misma: tres tiros de pistola
const cuantosZombis = r => Math.round(8 + r * 7 + r * r * 0.5);
const GOLPE = 34, NIVEL_MAX = 5;                         // aguantás tres manotazos; recomprar un arma la sube de nivel (+15 % de daño)
// =====================

const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
const acercar = (dt, k) => Math.min(1, dt * k);
const NOCHE = 0x07060f;
const ESCALA = 0.12, CELDA = MAPA.g * ESCALA, COLS = MAPA.cols, FILAS = MAPA.filas, PASO_ALTO = 24;   // PASO_ALTO: el escalón más alto que se sube caminando (en unidades del mapa)
// del mapa (unidades de Doom, con y hacia el norte) al mundo: centrado y con z hacia el sur
const aMundo = (x, y) => [(x - MAPA.x0 - COLS * MAPA.g / 2) * ESCALA, -(y - MAPA.y0 - FILAS * MAPA.g / 2) * ESCALA];
const centro = (c, f) => [(c - COLS / 2 + 0.5) * CELDA, -(f - FILAS / 2 + 0.5) * CELDA];
const celdaDe = (x, z) => [Math.floor(x / CELDA + COLS / 2), Math.floor(-z / CELDA + FILAS / 2)];
const casilla = (c, f) => f * COLS + c;
const BASE = (() => { const [c, f] = celdaDe(...aMundo(MAPA.inicio[0], MAPA.inicio[1])); return MAPA.alto[casilla(c, f)] * ESCALA; })();   // el piso de la largada queda en 0
const cota = h => h * ESCALA - BASE;                     // de la altura del mapa a la nuestra
const alturaEn = (x, z) => { const [c, f] = celdaDe(x, z); return cota(MAPA.alto[casilla(c, f)] ?? 0); };

// ---------- Idiomas: los mismos del portfolio ----------
const IDIOMAS = ["es", "en", "pt", "zh"];
let guardado = null, mejor = 0, sonidoOn = true;
try { guardado = localStorage.getItem("idioma"); mejor = Number(localStorage.getItem("zombisMejorRonda") ?? 0); sonidoOn = localStorage.getItem("sonido") !== "no"; } catch { /* sin almacenamiento */ }
const pedido = params.get("lang") ?? guardado ?? (navigator.language || "es").slice(0, 2);
const IDIOMA = IDIOMAS.includes(pedido) ? pedido : "es";
const T = {
  es: { titulo: "Zombis", ronda: "Ronda", fin: "Fin del juego", resumen: (r, b, p) => `Llegaste a la ronda ${r}<br>${b} zombis · ${p} puntos`, mejor: "Mejor ronda: ",
        otra: "Otra vez", volver: "Volver al portfolio", salir: "← Portfolio", cargando: "Cargando", recargando: "recargando…", comprar: "Usar", cambiar: "Arma",
        armas: { pistola: "Pistola", revolver: "Revólver", pesada: "Ametralladora", tirador: "Rifle de tirador", tommy: "Subfusil", rifle: "Rifle de asalto", laser: "Láser", escopeta: "Escopeta", franco: "Francotirador", cohete: "Lanzacohetes", rayo: "Rayo cósmico" }, ventajas: { jugo: "Jugo de calabaza", turbo: "Turbo cola" }, pisos: ["Subsuelo", "Planta baja", "Arriba"], sube: "Sube", baja: "Baja",
        caja: "Caja misteriosa", trampa: "Trampa eléctrica", portal: "Teletransportador", municion: "munición y más daño", cabeza: "¡En la cabeza!", puerta: "Abrir puerta", palanca: "Dar la corriente", mejora: "Mejorar el arma", tablas: "Tapar el agujero", mantener: "mantené E",
        sinLuz: "Falta dar la corriente", luz: "¡Hay corriente!", mejorada: "¡Arma mejorada!",
        poderes: { muerte: "Muerte instantánea", doble: "Puntos dobles", bomba: "¡Bomba!", municion: "¡Munición al máximo!" },
        ayuda: "Clic para empezar · WASD mover · Shift correr · mouse mirar y disparar · R recargar · V cuchillo · Q arma · E usar · M sonido", tactil: "Izquierda: moverte · derecha: mirar · dispara y acuchilla sola",
        sinPuntos: "No te alcanzan los puntos", creditos: "Zombi y armas: Quaternius (CC0) · Mapa: Freedoom MAP02 (BSD)" },
  en: { titulo: "Zombies", ronda: "Round", fin: "Game over", resumen: (r, b, p) => `You reached round ${r}<br>${b} zombies · ${p} points`, mejor: "Best round: ",
        otra: "Play again", volver: "Back to the portfolio", salir: "← Portfolio", cargando: "Loading", recargando: "reloading…", comprar: "Use", cambiar: "Weapon",
        armas: { pistola: "Pistol", revolver: "Revolver", pesada: "Machine gun", tirador: "Marksman rifle", tommy: "Submachine gun", rifle: "Assault rifle", laser: "Laser", escopeta: "Shotgun", franco: "Sniper rifle", cohete: "Rocket launcher", rayo: "Cosmic ray" }, ventajas: { jugo: "Pumpkin juice", turbo: "Turbo cola" }, pisos: ["Basement", "Ground floor", "Upstairs"], sube: "Up", baja: "Down",
        caja: "Mystery box", trampa: "Electric trap", portal: "Teleporter", municion: "ammo and more damage", cabeza: "Headshot!", puerta: "Open door", palanca: "Turn on the power", mejora: "Upgrade weapon", tablas: "Patch the hole", mantener: "hold E",
        sinLuz: "The power is off", luz: "Power is on!", mejorada: "Weapon upgraded!",
        poderes: { muerte: "Insta-kill", doble: "Double points", bomba: "Nuke!", municion: "Max ammo!" },
        ayuda: "Click to start · WASD move · Shift run · mouse look and shoot · R reload · V knife · Q weapon · E use · M sound", tactil: "Left: move · right: look · fires and stabs by itself",
        sinPuntos: "Not enough points", creditos: "Zombie and weapons: Quaternius (CC0) · Map: Freedoom MAP02 (BSD)" },
  pt: { titulo: "Zumbis", ronda: "Rodada", fin: "Fim de jogo", resumen: (r, b, p) => `Você chegou à rodada ${r}<br>${b} zombis · ${p} pontos`, mejor: "Melhor rodada: ",
        otra: "De novo", volver: "Voltar ao portfólio", salir: "← Portfólio", cargando: "Carregando", recargando: "recarregando…", comprar: "Usar", cambiar: "Arma",
        armas: { pistola: "Pistola", revolver: "Revólver", pesada: "Metralhadora", tirador: "Rifle de atirador", tommy: "Submetralhadora", rifle: "Rifle de assalto", laser: "Laser", escopeta: "Escopeta", franco: "Rifle de precisão", cohete: "Lança-foguetes", rayo: "Raio cósmico" }, ventajas: { jugo: "Suco de abóbora", turbo: "Turbo cola" }, pisos: ["Subsolo", "Térreo", "Em cima"], sube: "Sobe", baja: "Desce",
        caja: "Caixa misteriosa", trampa: "Armadilha elétrica", portal: "Teletransporte", municion: "munição e mais dano", cabeza: "Na cabeça!", puerta: "Abrir porta", palanca: "Ligar a energia", mejora: "Melhorar a arma", tablas: "Tapar o buraco", mantener: "segure E",
        sinLuz: "Falta ligar a energia", luz: "Energia ligada!", mejorada: "Arma melhorada!",
        poderes: { muerte: "Morte instantânea", doble: "Pontos em dobro", bomba: "Bomba!", municion: "Munição máxima!" },
        ayuda: "Clique para começar · WASD mover · Shift correr · mouse olhar e atirar · R recarregar · V faca · Q arma · E usar · M som", tactil: "Esquerda: mover · direita: olhar · atira e esfaqueia sozinha",
        sinPuntos: "Pontos insuficientes", creditos: "Zumbi e armas: Quaternius (CC0) · Mapa: Freedoom MAP02 (BSD)" },
  zh: { titulo: "僵尸", ronda: "回合", fin: "游戏结束", resumen: (r, b, p) => `你坚持到第 ${r} 回合<br>${b} 个僵尸 · ${p} 分`, mejor: "最佳回合：",
        otra: "再来一次", volver: "返回作品集", salir: "← 作品集", cargando: "加载中", recargando: "装弹中…", comprar: "使用", cambiar: "武器",
        armas: { pistola: "手枪", revolver: "左轮手枪", pesada: "机枪", tirador: "精确步枪", tommy: "冲锋枪", rifle: "突击步枪", laser: "激光", escopeta: "霰弹枪", franco: "狙击枪", cohete: "火箭筒", rayo: "宇宙射线" }, ventajas: { jugo: "南瓜汁", turbo: "涡轮可乐" }, pisos: ["地下层", "一层", "二层"], sube: "上楼", baja: "下楼",
        caja: "神秘箱", trampa: "电网陷阱", portal: "传送器", municion: "弹药和更高伤害", cabeza: "爆头！", puerta: "开门", palanca: "接通电源", mejora: "升级武器", tablas: "修补破洞", mantener: "按住 E",
        sinLuz: "还没有通电", luz: "通电了！", mejorada: "武器已升级！",
        poderes: { muerte: "一击必杀", doble: "双倍积分", bomba: "核弹！", municion: "弹药全满！" },
        ayuda: "点击开始 · WASD 移动 · Shift 奔跑 · 鼠标瞄准射击 · R 装弹 · V 刀 · Q 武器 · E 使用 · M 声音", tactil: "左侧移动 · 右侧转向 · 自动射击和刀击",
        sinPuntos: "积分不够", creditos: "僵尸和武器：Quaternius (CC0) · 地图：Freedoom MAP02 (BSD)" },
}[IDIOMA];
document.documentElement.lang = IDIOMA;
document.title = `${T.titulo} · Sebastian Rodriguez`;
const TACTIL = matchMedia("(pointer: coarse)").matches;
$("cargando").textContent = T.cargando + "…";
$("salir").textContent = T.salir;
$("ayuda").textContent = TACTIL ? T.tactil : T.ayuda;
$("otra").textContent = T.otra;
$("volver").textContent = T.volver;
$("bComprar").textContent = T.comprar;
$("bCambiar").textContent = T.cambiar;
$("creditos").textContent = T.creditos;
$("otra").onclick = () => reiniciar();
$("volver").onclick = () => { location.href = "./"; };
await document.fonts.load('64px Bangers').catch(() => {});   // la letra de los carteles, antes de dibujarlos

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ canvas: $("escena"), antialias: true, powerPreference: "high-performance" });
const RESOLUCION = Math.min(devicePixelRatio, 1.25);
renderer.setPixelRatio(RESOLUCION);
const escena = new THREE.Scene();
escena.fog = new THREE.Fog(NOCHE, 22, 210);
const camara = new THREE.PerspectiveCamera(72, 1, 0.3, 1500);
camara.rotation.order = "YXZ";
escena.add(camara);                                     // lleva colgada el arma, así que tiene que estar en la escena
function ajustarTamano() {
  renderer.setSize(innerWidth, innerHeight, false);
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
}
addEventListener("resize", ajustarTamano);
ajustarTamano();
// de noche y casi a oscuras: algo de luna, y un farol que llevás vos. Al dar la corriente se prenden las luces de la casa
const cielo = new THREE.HemisphereLight(0x8f95d8, 0x1a1420, 0.5);
const sol = new THREE.DirectionalLight(0xaab4ff, 0.45);
sol.position.set(-50, 80, 40);
const farol = new THREE.PointLight(0xffd9a0, 1.7, 90, 0);
farol.position.set(0.4, 0.6, 0);
camara.add(farol);
escena.add(cielo, sol);

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
const polvoTex = (() => {
  const [cv, g] = lienzo(64, 64), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.4, "rgba(255,255,255,.5)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
// Cel shading: la luz cae en tres escalones, y cada cosa lleva un contorno de tinta (la misma pieza un poco más grande y dada vuelta)
const ESCALONES = new THREE.DataTexture(new Uint8Array([80, 80, 80, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ESCALONES.minFilter = ESCALONES.magFilter = THREE.NearestFilter;
ESCALONES.needsUpdate = true;
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ESCALONES, ...extra });
const TINTA = new THREE.MeshBasicMaterial({ color: 0x0a0612, side: THREE.BackSide });
// contorno para modelos: en vez de agrandar la pieza, corre cada vértice hacia afuera (sirve también con huesos)
const tintaGruesa = grosor => {
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0612, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = position + normalize(normal) * ${grosor.toFixed(5)};`); };
  return m;
};
function caja(w, h, d, material, x, y, z, contorno = 0.3) {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, material));
  if (contorno) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + contorno, h + contorno, d + contorno), TINTA); g.add(b); }
  g.position.set(x, y, z);
  return g;
}
function cartel(texto, color = "#f4f1de", alto = 3) {     // siempre mira a la cámara
  const [cv, g] = lienzo(512, 128);
  g.font = '64px Bangers, Impact, "Arial Black", sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
  g.strokeStyle = "#0a0612"; g.lineWidth = 12; g.strokeText(texto, 256, 64, 490);
  g.fillStyle = color; g.fillText(texto, 256, 64, 490);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura(cv), fog: false }));
  s.scale.set(alto * 4, alto, 1);
  return s;
}
function instancias(geo, material, lista) {
  const m = new THREE.InstancedMesh(geo, material, lista.length), o = new THREE.Object3D();
  lista.forEach((p, i) => {
    o.position.set(p.x, p.y ?? 0, p.z);
    o.rotation.set(0, p.giro ?? 0, 0);
    Array.isArray(p.tam) ? o.scale.set(...p.tam) : o.scale.setScalar(p.tam ?? 1);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.frustumCulled = false;
  escena.add(m);
  return m;
}

// ---------- El mapa de Freedoom, armado con nuestros materiales ----------
const puertas = {}, ventanas = [], estaciones = [];      // estaciones: todo lo que se usa con E
let LARGADA = [0, 0], ANG_LARGADA = 0, corriente = false;
const portales = [], faroles = [];
let portalT = 0;
const trampa = { e: null, t: 0, espera: 0, pulso: 0 };     // t: segundos que le quedan prendida · espera: lo que tarda en volver a servir
// qué celdas no se pueden pisar: lo que no es piso, y las puertas sin comprar
const bloqueada = (c, f) => {
  if (c < 0 || f < 0 || c >= COLS || f >= FILAS || MAPA.pisable[casilla(c, f)] !== "1") return true;
  const p = MAPA.puerta[casilla(c, f)];
  return p > 0 && !puertas[p].abierta;
};
{
  // texturas dibujadas acá, con juntas en tinta; la luz de cada sector del mapa va en el color de los vértices
  const dibujo = (base, pinta) => {
    const [cv, g] = lienzo(256, 256);
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#0a0612"; g.lineWidth = 4;
    pinta(g);
    for (let i = 0; i < 7; i++) {                          // mugre
      const x = Math.random() * 256, y = Math.random() * 256, m = g.createRadialGradient(x, y, 0, x, y, 25 + Math.random() * 50);
      m.addColorStop(0, "rgba(0,0,0,.33)"); m.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = m; g.fillRect(0, 0, 256, 256);
    }
    const t = textura(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshToonMaterial({ map: t, gradientMap: ESCALONES, vertexColors: true, side: THREE.DoubleSide });
  };
  const raya = (g, x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const ladrillo = dibujo("#7a3b30", g => { for (let y = 0; y <= 256; y += 32) { raya(g, 0, y, 256, y); for (let x = (y / 32 % 2) * 32; x <= 256; x += 64) raya(g, x, y, x, y + 32); } });
  const hormigon = dibujo("#7d7a85", g => { for (let x = 0; x <= 256; x += 128) raya(g, x, 0, x, 256); raya(g, 0, 128, 256, 128); g.fillStyle = "#0a0612"; for (const [x, y] of [[14, 14], [114, 14], [142, 14], [242, 14], [14, 242], [114, 242], [142, 242], [242, 242]]) g.fillRect(x - 3, y - 3, 6, 6); });
  const chapa = dibujo("#4c5f73", g => { for (let y = 0; y <= 256; y += 64) raya(g, 0, y, 256, y); raya(g, 128, 0, 128, 256); g.fillStyle = "#c9a227"; g.fillRect(0, 118, 256, 20); g.fillStyle = "#0a0612"; for (let x = -20; x < 256; x += 40) { g.beginPath(); g.moveTo(x, 138); g.lineTo(x + 20, 118); g.lineTo(x + 32, 118); g.lineTo(x + 12, 138); g.fill(); } });
  const tablones = dibujo("#6f4a2b", g => { for (let x = 0; x <= 256; x += 51.2) raya(g, x, 0, x, 256); raya(g, 0, 80, 256, 80); raya(g, 0, 200, 256, 200); });
  const baldosa = dibujo("#5b5966", g => { for (let k = 0; k <= 256; k += 64) { raya(g, k, 0, k, 256); raya(g, 0, k, 256, k); } });
  const rejilla = dibujo("#3a3f4a", g => { g.lineWidth = 3; for (let k = 0; k <= 256; k += 32) { raya(g, k, 0, k, 256); raya(g, 0, k, 256, k); } });
  const pasto = dibujo("#1c5a2b", g => { for (let i = 0; i < 110; i++) { g.fillStyle = i % 2 ? "#236b34" : "#144322"; g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 16, 4 + Math.random() * 8, Math.random() * 3, 0, 6.3); g.fill(); } });
  const techo = dibujo("#4a4853", g => { for (let k = 0; k <= 256; k += 128) { raya(g, k, 0, k, 256); raya(g, 0, k, 256, k); } });
  const PAREDES = [ladrillo, hormigon, chapa, tablones], PISOS = [baldosa, rejilla, tablones];
  const clase = (nombre, n) => { let h = 7; for (const l of nombre) h = (h * 31 + l.charCodeAt(0)) >>> 0; return h % n; };   // la misma textura del mapa da siempre el mismo material
  const montones = new Map();                            // un solo objeto por material
  const monton = m => montones.get(m) ?? montones.set(m, { pos: [], uv: [], col: [] }).get(m);
  const claro = l => 0.3 + 0.7 * Math.min(1, l / 200);
  for (const [x1, y1, x2, y2, abajo, arriba, tex, luz] of MAPA.paredes) {
    const m = monton(PAREDES[clase(tex, PAREDES.length)]), [ax, az] = aMundo(x1, y1), [bx, bz] = aMundo(x2, y2), ya = cota(abajo), yb = cota(arriba), u = Math.hypot(bx - ax, bz - az) / 9, k = claro(luz);
    m.pos.push(ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az);
    m.uv.push(0, ya / 9, u, ya / 9, u, yb / 9, 0, ya / 9, u, yb / 9, 0, yb / 9);
    for (let i = 0; i < 6; i++) m.col.push(k, k, k);
  }
  for (const s of MAPA.sectores) for (const poli of s.polis) {
    const lazos = poli.map(l => l.map(([x, y]) => new THREE.Vector2(...aMundo(x, y)))), todos = lazos.flat(), k = claro(s.l);
    const planos = [[monton(s.c ? pasto : PISOS[clase(s.fp, PISOS.length)]), cota(s.p)]];
    if (!s.c) planos.push([monton(techo), cota(s.t)]);                 // con cielo no hay techo: se ve la luna
    for (const tri of THREE.ShapeUtils.triangulateShape(lazos[0], lazos.slice(1))) for (const [m, y] of planos) for (const i of tri) {
      m.pos.push(todos[i].x, y, todos[i].y); m.uv.push(todos[i].x / 9, todos[i].y / 9); m.col.push(k, k, k);
    }
  }
  for (const [material, m] of montones) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(m.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(m.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(m.col, 3));
    geo.computeVertexNormals();
    escena.add(new THREE.Mesh(geo, material));
  }
  LARGADA = aMundo(MAPA.inicio[0], MAPA.inicio[1]);
  const grados = MAPA.inicio[2] * Math.PI / 180;
  ANG_LARGADA = Math.atan2(Math.cos(grados), -Math.sin(grados));

  const madera = toon(0x8a5c34), hierro = toon(0x3a3d46);
  const puesto = (x, z, tipo, id, costo, nombre, color, forma) => {
    const g3 = new THREE.Group(), y = alturaEn(x, z);
    forma(g3);
    const titulo = cartel(nombre), precio = cartel(String(costo || ""), "#ffd23c");
    titulo.position.y = 11.2; precio.position.y = 8.8;
    g3.add(titulo, precio);
    g3.position.set(x, y, z);
    const luz = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: polvoTex, color, opacity: 0.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    luz.rotation.x = -Math.PI / 2;
    luz.position.set(x, y + 0.15, z);
    escena.add(g3, luz);
    const e = { x, z, piso: 1, tipo, id, costo, nombre, g: g3 };
    estaciones.push(e);
    return e;
  };
  // chapa pintada para lo que se compra: franjas, una pantalla con su dibujo y algo de óxido
  const pintada = (hex, icono) => {
    const [cv, g] = lienzo(128, 192);
    g.fillStyle = "#" + hex.toString(16).padStart(6, "0"); g.fillRect(0, 0, 128, 192);
    g.fillStyle = "rgba(255,255,255,.16)"; for (let y = 104; y < 192; y += 22) g.fillRect(0, y, 128, 9);
    g.fillStyle = "#0a0612"; g.fillRect(12, 16, 104, 76);
    g.fillStyle = "#f4f1de"; g.font = '54px Bangers, Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icono, 64, 56);
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * 128, y = Math.random() * 192, m = g.createRadialGradient(x, y, 0, x, y, 14 + Math.random() * 22);
      m.addColorStop(0, "rgba(40,18,0,.5)"); m.addColorStop(1, "rgba(40,18,0,0)");
      g.fillStyle = m; g.fillRect(0, 0, 128, 192);
    }
    g.strokeStyle = "#0a0612"; g.lineWidth = 6; g.strokeRect(3, 3, 122, 186);
    return toon(0xffffff, { map: textura(cv) });
  };
  const maquina = (color, icono) => g3 => g3.add(caja(5, 7.5, 3.6, pintada(color, icono), 0, 3.75, 0), caja(5.6, 0.8, 4.2, toon(0xf4f1de), 0, 7.9, 0));
  // arma de pared: se cuelga en la pared alta más cercana al lugar; el modelo se le agrega cuando termina de cargar
  const enPared = (x, z, a) => {
    let mejor = null;
    for (const [x1, y1, x2, y2, abajo, arriba] of MAPA.paredes) {
      if (arriba - abajo < 72) continue;
      const [ax, az] = aMundo(x1, y1), [bx, bz] = aMundo(x2, y2), dx = bx - ax, dz = bz - az, largo = Math.hypot(dx, dz);
      if (largo < 13) continue;
      const t = limitar(((x - ax) * dx + (z - az) * dz) / (largo * largo), 6.5 / largo, 1 - 6.5 / largo), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < 0.5 || (mejor && d >= mejor.d)) continue;
      const nx = (x - px) / d, nz = (z - pz) / d, [c, f] = celdaDe(px + nx * 4.5, pz + nz * 4.5);
      if (!bloqueada(c, f) && Math.abs(cota(MAPA.alto[casilla(c, f)]) - cota(abajo)) < 1) mejor = { d, px, pz, nx, nz, dx: dx / largo, dz: dz / largo };
    }
    if (!mejor) return puesto(x, z, "arma", a.id, a.costo, T.armas[a.id], a.color, g3 => g3.add(caja(0.7, 6, 0.7, madera, 0, 3, 0), caja(6, 2.8, 0.5, toon(a.color), 0, 5.6, 0)));
    const e = puesto(mejor.px + mejor.nx * 4.5, mejor.pz + mejor.nz * 4.5, "arma", a.id, a.costo, T.armas[a.id], a.color, g3 => {
      const tabla = caja(12, 5.4, 0.5, toon(0x16151c), -mejor.nx * 4.1, 5.4, -mejor.nz * 4.1, 0.35);
      tabla.rotation.y = Math.atan2(-mejor.dz, mejor.dx);
      g3.add(tabla);
    });
    for (const h of e.g.children) if (h.isSprite) { h.position.x -= mejor.nx * 2; h.position.z -= mejor.nz * 2; }
    e.pared = mejor;
    return e;
  };
  // los puestos, repartidos por los lugares donde el mapa tenía cosas: los primeros cerca de la largada, los últimos en la otra punta
  const lugares = MAPA.lugares.map(([x, y]) => aMundo(x, y));
  PUESTOS.forEach((id, k) => {
    const [x, z] = lugares[Math.round(k * (lugares.length - 1) / (PUESTOS.length - 1))];
    if (ARMA(id)) enPared(x, z, ARMA(id));
    else if (id === "jugo") puesto(x, z, "ventaja", "jugo", VENTAJAS.jugo.costo, T.ventajas.jugo, 0xf07a13, maquina(0xc8600f, "+"));
    else if (id === "turbo") puesto(x, z, "ventaja", "turbo", VENTAJAS.turbo.costo, T.ventajas.turbo, 0x4dff7c, maquina(0x2a9c52, ">>"));
    else if (id === "caja") puesto(x, z, "caja", "caja", COSTO_CAJA, T.caja, 0xffd23c, g3 => g3.add(caja(8, 3, 4.4, pintada(0x7a4f26, "?"), 0, 1.5, 0), caja(8.4, 0.7, 4.8, toon(0xffd23c), 0, 3.3, 0)));
    else if (id === "mejora") puesto(x, z, "mejora", "mejora", COSTO_MEJORA, T.mejora, 0xff3ad0, g3 => g3.add(caja(7, 5, 4.6, pintada(0x4a4d58, "x2"), 0, 2.5, 0), caja(4.6, 2, 3, toon(0xff3ad0), 0, 6, 0), caja(1, 3, 1, hierro, 3, 6.5, 0)));
    else if (id === "trampa") trampa.e = puesto(x, z, "trampa", "trampa", COSTO_TRAMPA, T.trampa, 0x6fd6ff, g3 => {
      for (const lado of [-1, 1]) g3.add(caja(1.2, 9, 1.2, hierro, lado * 9, 4.5, 0), caja(2.2, 1.6, 2.2, toon(0x6fd6ff), lado * 9, 9.6, 0));
    });
    else if (id === "palanca") {
      const e = puesto(x, z, "palanca", "palanca", 0, T.palanca, 0xfff2b0, g3 => g3.add(caja(4, 6, 1.6, hierro, 0, 4.2, 0)));
      e.mango = caja(0.6, 3.4, 0.6, toon(0xd92b2b), 0, 5.6, 1.2, 0.2);
      e.mango.rotation.x = 0.9;
      e.g.add(e.mango);
    }
  });
  // puertas: donde el mapa tenía una, va un portón de tablones que se compra y se hunde en el piso
  MAPA.puertas.forEach((p, k) => {
    const pts = MAPA.sectores[p.s].polis.flat(2).map(([x, y]) => aMundo(x, y)), xs = pts.map(q => q[0]), zs = pts.map(q => q[1]);
    const ancho = Math.max(...xs) - Math.min(...xs), fondo = Math.max(...zs) - Math.min(...zs), x = (Math.max(...xs) + Math.min(...xs)) / 2, z = (Math.max(...zs) + Math.min(...zs)) / 2;
    const y0 = cota(MAPA.sectores[p.s].p), alto = cota(MAPA.sectores[p.s].t) - y0, costo = COSTO_PUERTAS[Math.min(k, COSTO_PUERTAS.length - 1)];
    const hoja = caja(ancho, alto, fondo, toon(0x5a3a1e), x, y0 + alto / 2, z, 0.4);
    const precio = cartel(String(costo), "#ffd23c", 2.6);
    precio.position.y = 6 - alto / 2;
    hoja.add(precio);
    escena.add(hoja);
    puertas[k + 1] = { abierta: false, hoja, baja: 0, y0, alto };
    estaciones.push({ x, z, piso: 1, tipo: "puerta", id: k + 1, costo, nombre: T.puerta, alcance: Math.max(ancho, fondo) / 2 + 9 });
  });
  // cielo y luna
  const [cc, gc] = lienzo(4, 256), grad = gc.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#020108"); grad.addColorStop(0.55, "#07060f"); grad.addColorStop(1, "#07060f");
  gc.fillStyle = grad; gc.fillRect(0, 0, 4, 256);
  escena.background = textura(cc);
  const luna = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0xf4f1de, fog: false }));
  luna.position.set(-300, 420, -700);
  luna.lookAt(0, 0, 0);
  escena.add(luna);
}

// choque: se prueba cada eje por separado, así se desliza a lo largo. No se entra a lo que no es piso ni se sube un escalón más alto que PASO_ALTO
function mover(e, dx, dz, radio) {
  const [c0, f0] = celdaDe(e.x, e.z), desde = MAPA.alto[casilla(c0, f0)] ?? 0;
  const libre = (x, z) => {                              // el escalón se mide donde se para; las esquinas solo no pueden meterse en una pared
    const [c, f] = celdaDe(x, z);
    return MAPA.alto[casilla(c, f)] - desde <= PASO_ALTO && [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sz]) => !bloqueada(...celdaDe(x + sx * radio, z + sz * radio)));
  };
  if (libre(e.x + dx, e.z)) e.x += dx;
  if (libre(e.x, e.z + dz)) e.z += dz;
}
// camino hacia vos: cuántas celdas faltan desde cada una (los zombis van siempre a la vecina que menos tenga)
const pasos = new Int16Array(COLS * FILAS), porVer = new Int32Array(COLS * FILAS), VECINAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function trazarCamino() {
  pasos.fill(999);
  const [c0, f0] = celdaDe(yo.x, yo.z);
  if (bloqueada(c0, f0)) return;
  let leo = 0, escribo = 0;
  porVer[escribo++] = casilla(c0, f0);
  pasos[casilla(c0, f0)] = 0;
  while (leo < escribo) {
    const i = porVer[leo++], c = i % COLS, f = (i - c) / COLS, d = pasos[i];
    for (const [dc, df] of VECINAS) {
      const nc = c + dc, nf = f + df, n = casilla(nc, nf);
      if (bloqueada(nc, nf) || pasos[n] <= d + 1 || MAPA.alto[i] - MAPA.alto[n] > PASO_ALTO) continue;   // desde ahí no podrían subir hasta acá
      pasos[n] = d + 1;
      porVer[escribo++] = n;
    }
  }
}

// ---------- Sonido: todo sintetizado acá (osciladores y ruido), sin archivos ----------
let audio = null, bufRuido = null;
function prenderSonido() {
  if (audio || params.get("auto")) return;
  try {
    audio = new AudioContext();
    bufRuido = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const d = bufRuido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { audio = null; }
}
for (const gesto of ["keydown", "pointerdown"]) addEventListener(gesto, prenderSonido);
function sonar(frec, dura, tipo = "square", vol = 0.05, cae = 0.3) {
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
function ruido(dura, vol, corte = 1500, tipo = "lowpass") {
  if (!audio || !sonidoOn) return;
  const s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain(), t = audio.currentTime;
  s.buffer = bufRuido;
  f.type = tipo; f.frequency.value = corte;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  s.connect(f).connect(g).connect(audio.destination);
  s.start(t, Math.random() * 0.5, dura);
}
const SONIDOS = {
  pistola: () => { ruido(0.11, 0.3, 1800); sonar(210, 0.09, "square", 0.06, 0.35); },
  tommy: () => { ruido(0.09, 0.22, 2200); sonar(170, 0.07, "square", 0.05, 0.4); },
  revolver: () => { ruido(0.3, 0.42, 1300); sonar(150, 0.22, "sawtooth", 0.09, 0.3); },
  pesada: () => { ruido(0.1, 0.3, 1000); sonar(100, 0.09, "sawtooth", 0.08, 0.45); },
  tirador: () => { ruido(0.22, 0.36, 1700); sonar(160, 0.16, "square", 0.07, 0.3); },
  chispa: () => { sonar(2200, 0.12, "sawtooth", 0.035, 0.3); ruido(0.1, 0.12, 6000, "highpass"); },
  rifle: () => { ruido(0.12, 0.3, 1400); sonar(130, 0.1, "sawtooth", 0.07, 0.4); },
  franco: () => { ruido(0.5, 0.45, 1100); sonar(110, 0.4, "sawtooth", 0.1, 0.3); },
  cohete: () => { ruido(0.6, 0.3, 600); sonar(300, 0.5, "sawtooth", 0.06, 0.25); },
  explota: () => { ruido(0.8, 0.5, 350); sonar(60, 0.7, "sawtooth", 0.12, 0.5); },
  cuchillo: () => ruido(0.12, 0.2, 3500, "highpass"),
  cabeza: () => { sonar(1100, 0.09, "triangle", 0.07, 1.6); ruido(0.08, 0.2, 2600, "bandpass"); },
  tajo: () => { ruido(0.1, 0.3, 900); sonar(150, 0.1, "sawtooth", 0.06, 0.5); },
  escopeta: () => { ruido(0.34, 0.4, 950); sonar(95, 0.26, "sawtooth", 0.09, 0.35); },
  laser: () => { sonar(1300, 0.2, "sawtooth", 0.06, 0.18); ruido(0.05, 0.1, 5000, "highpass"); },
  rayo: () => { sonar(620, 0.32, "sine", 0.09, 3.2); ruido(0.2, 0.12, 3000, "bandpass"); },
  recarga: () => { sonar(900, 0.03, "square", 0.04, 1); setTimeout(() => sonar(500, 0.05, "square", 0.04, 1), 180); },
  seco: () => sonar(1400, 0.02, "square", 0.03, 1),
  gemido: vol => { sonar(60 + Math.random() * 50, 0.7 + Math.random() * 0.5, "sawtooth", vol, 0.75); ruido(0.5, vol * 0.6, 500, "bandpass"); },
  tabla: () => { ruido(0.12, 0.3, 700); sonar(240, 0.08, "square", 0.05, 0.4); },
  clavar: () => { sonar(520, 0.05, "square", 0.05, 0.6); ruido(0.05, 0.15, 2500); },
  golpe: () => { ruido(0.2, 0.4, 400); sonar(80, 0.25, "sawtooth", 0.1, 0.5); },
  baja: () => { ruido(0.16, 0.2, 800); sonar(130, 0.2, "sawtooth", 0.05, 0.35); },
  compra: () => [660, 880, 1320].forEach((f, k) => setTimeout(() => sonar(f, 0.14, "triangle", 0.06, 1), k * 70)),
  no: () => sonar(120, 0.22, "sawtooth", 0.05, 0.7),
  puerta: () => { ruido(0.7, 0.25, 300); sonar(70, 0.7, "sawtooth", 0.06, 0.6); },
  ronda: () => [98, 92, 73].forEach((f, k) => setTimeout(() => sonar(f, 0.9, "sawtooth", 0.07, 0.9), k * 380)),
  finRonda: () => [392, 330, 262, 196].forEach((f, k) => setTimeout(() => sonar(f, 0.5, "triangle", 0.06, 1), k * 220)),
  corriente: () => { sonar(50, 1.4, "sawtooth", 0.08, 4); ruido(1.2, 0.12, 4000, "highpass"); },
  premio: () => [784, 988, 1175, 1568].forEach((f, k) => setTimeout(() => sonar(f, 0.16, "triangle", 0.06, 1), k * 60)),
  fin: () => [196, 185, 165, 123].forEach((f, k) => setTimeout(() => sonar(f, 1.1, "sawtooth", 0.07, 0.8), k * 420)),
};

// ---------- Vos: se ve el arma adelante, con las manos del marciano ----------
const vista = (() => {
  const g = new THREE.Group();                            // en la cámara, -z es adelante
  const piel = toon(0x7fe08a), traje = toon(0xc9cfdd);
  const mano = (x, y, z) => {
    const m = new THREE.Group();
    const pieza = (geo, material, px, py, pz) => {         // cada parte con su contorno de tinta
      const g2 = new THREE.Group(), borde = new THREE.Mesh(geo, TINTA);
      borde.scale.setScalar(1.13);
      g2.add(new THREE.Mesh(geo, material), borde);
      g2.position.set(px, py, pz);
      m.add(g2);
      return g2;
    };
    pieza(new THREE.SphereGeometry(0.2, 12, 9), piel, 0, 0, 0).scale.set(1, 0.85, 1.2);                // la palma
    for (const k of [-1, 0, 1]) {                                                                     // tres dedos largos que envuelven el arma
      pieza(new THREE.CapsuleGeometry(0.055, 0.2, 3, 8), piel, k * 0.12, -0.03, -0.24).rotation.x = -1.15;
      pieza(new THREE.SphereGeometry(0.07, 8, 6), piel, k * 0.12, -0.12, -0.36);                       // la yema, redonda
    }
    pieza(new THREE.CapsuleGeometry(0.055, 0.14, 3, 8), piel, 0.2, 0.05, -0.1).rotation.set(-1.2, 0, -0.5);   // el pulgar
    pieza(new THREE.CylinderGeometry(0.12, 0.17, 0.9, 12).rotateX(-Math.PI / 2), piel, 0.03, -0.07, 0.6);    // la muñeca, fina
    pieza(new THREE.CylinderGeometry(0.2, 0.3, 3.6, 12).rotateX(-Math.PI / 2), traje, 0.07, -0.2, 2.7);    // la manga del traje
    pieza(new THREE.TorusGeometry(0.2, 0.05, 6, 14), toon(0xff8a1f), 0.04, -0.1, 0.92);                      // el puño, naranja
    m.position.set(x, y, z);
    m.scale.setScalar(0.78);
    return m;
  };
  const fogonazo = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fogonazo.visible = false;
  g.add(mano(0.02, -0.2, 0.2), mano(-0.02, -0.12, -1.9), fogonazo);
  g.children[1].rotation.z = 0.5;
  g.scale.setScalar(0.5);
  camara.add(g);
  return { g, fogonazo, trasera: g.children[0], delantera: g.children[1], cuchillo: null, armas: {}, patada: 0, paso: 0 };
})();

// ---------- Zombis, balas y premios (reservas fijas que se reutilizan) ----------
const zombis = Array.from({ length: MAX_ZOMBIS }, (_, k) => ({ g: null, mez: null, acc: {}, vivo: false, cae: 0, vida: 0, x: 0, z: 0, vel: 0, golpe: 0, fase: k * 1.3, susto: 0, ang: 0, piso: 1, y: 0, sale: 0, quieto: 0, antes: [0, 0], ventana: null, rompe: 0, anim: "", arrastra: false, sinCabeza: false, huesos: [], cabeza: null, piernas: [] }));
const MAX_BALAS = 90;
const balasMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 3.4), new THREE.MeshBasicMaterial({ fog: false }), MAX_BALAS);
balasMesh.frustumCulled = false;
escena.add(balasMesh);
const balas = Array.from({ length: MAX_BALAS }, () => ({ vive: 0, piso: 1, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, arma: null, tocados: [] }));
const PODERES = { muerte: 0xff3a3a, doble: 0xffd23c, bomba: 0xf4f1de, municion: 0x4dff7c };
const premios = Array.from({ length: 4 }, () => {
  const g = new THREE.Group(), geo = new THREE.OctahedronGeometry(1.7), borde = new THREE.Mesh(geo, TINTA);
  borde.scale.setScalar(1.18);
  g.add(new THREE.Mesh(geo, toon(0xffffff)), borde);
  g.visible = false;
  escena.add(g);
  return { g, tipo: null, t: 0, x: 0, z: 0, piso: 1 };
});
const ondas = Array.from({ length: 6 }, () => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xff3ad0, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  escena.add(m);
  return { m, t: 1, r: 1 };
});
function estallar(x, z, r, color, piso = yo.piso) {
  const o = ondas.find(o => o.t >= 1) ?? ondas[0];
  Object.assign(o, { t: 0, r });
  o.m.material.color.set(color);
  o.m.position.set(x, alturaEn(x, z) + 1.2, z);
  o.m.visible = true;
}

// ---------- Estado de la partida ----------
const yo = { x: 0, z: 0, piso: 1, y: 0, enRampa: false, vx: 0, vz: 0, ang: Math.PI, vida: 100, golpeado: -9, armas: [], enMano: 0, enfria: 0, recarga: 0, ventajas: new Set(), clava: 0, cuchillo: 0 };
let ronda = 0, porSalir = 0, proximo = 0, pausa = 0, puntos = 0, bajas = 0, terminado = false, tiempo = 0, caminoT = 0, gemidoT = 2;
const poderes = { muerte: 0, doble: 0 };
const armaNueva = id => { const a = ARMA(id); return { ...a, enCargador: a.cargador, enReserva: a.reserva, mejorada: false, nivel: 1 }; };
const OJOS = 6.2;
let ALTO_BICHO = 4, PIERNAS = 1.2, CABEZA = 2.2;         // se miden al cargar el modelo            // alturas: tus ojos, y dónde empieza y termina la cabeza de un zombi
const arma = () => yo.armas[yo.enMano];
const vidaMax = () => yo.ventajas.has("jugo") ? 250 : 100;
function reiniciar() {
  Object.assign(yo, { x: LARGADA[0], z: LARGADA[1], piso: 1, y: 0, enRampa: false, vx: 0, vz: 0, ang: ANG_LARGADA, vida: 100, golpeado: -9, armas: [armaNueva("pistola")], enMano: 0, enfria: 0, recarga: 0, clava: 0, cuchillo: 0 });
  yo.ventajas.clear();
  for (const z of zombis) { z.vivo = false; z.cae = 0; if (z.g) z.g.visible = false; }
  for (const b of balas) b.vive = 0;
  for (const p of premios) { p.tipo = null; p.g.visible = false; }
  for (const v of ventanas) v.quedan = TABLAS;
  for (const p of Object.values(puertas)) Object.assign(p, { abierta: !!params.get("abrir"), baja: 0 });
  corriente = !!params.get("abrir");
  Object.assign(trampa, { t: 0, espera: 0, pulso: 0 });
  portalT = 0;
  ronda = 0; porSalir = 0; pausa = 2.5; puntos = Number(params.get("puntos") ?? 500); bajas = 0; terminado = false; tiempo = 0;
  poderes.muerte = poderes.doble = 0;
  if (ARMA(params.get("arma"))) yo.armas = [armaNueva(params.get("arma"))];   // ?arma=franco: para probar una
  if (params.get("x")) Object.assign(yo, { x: Number(params.get("x")), z: Number(params.get("z") ?? 0), ang: Number(params.get("ang") ?? 0), piso: Number(params.get("piso") ?? 1) });
  yo.piso = 1;
  yo.y = alturaEn(yo.x, yo.z);
  $("fin").classList.remove("ver");
  $("mejor").textContent = T.mejor + mejor;
}
let avisoT = 0, cabezaT = 0;
function avisar(texto, color = "#c1121f", dura = 2.2) {
  $("aviso").textContent = texto;
  $("aviso").style.color = color;
  $("aviso").classList.add("ver");
  avisoT = dura;
}
const sumar = n => { puntos += n * (poderes.doble > 0 ? 2 : 1); };

// ---------- Controles ----------
const teclas = new Set();
let disparando = false, cabeceo = 0;                     // cabeceo: mirar hacia arriba o abajo (solo visual: se dispara siempre al frente)
const TECLAS = { w: "arriba", arrowup: "arriba", s: "abajo", arrowdown: "abajo", a: "izq", d: "der", arrowleft: "giraIzq", arrowright: "giraDer", shift: "corre", e: "usar" };
addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (TECLAS[k]) { teclas.add(TECLAS[k]); e.preventDefault(); }
  if (k === "r") recargar();
  if ((k === "v" || k === "f") && !e.repeat) acuchillar();
  if (k === "q" || k === "1" || k === "2") cambiarArma(k === "q" ? null : Number(k) - 1);
  if ((k === "e" || k === "enter") && !e.repeat) terminado && k === "enter" ? reiniciar() : comprar();
  if (k === "m") { sonidoOn = !sonidoOn; try { localStorage.setItem("sonido", sonidoOn ? "si" : "no"); } catch { /* sin almacenamiento */ } }
  if (k === " ") { disparando = true; e.preventDefault(); }
});
addEventListener("keyup", e => { teclas.delete(TECLAS[e.key.toLowerCase()]); if (e.key === " ") disparando = false; });
addEventListener("blur", () => { teclas.clear(); disparando = false; });
const mirar = (dx, dy, k) => { yo.ang -= dx * k; cabeceo = limitar(cabeceo - dy * k, -0.6, 0.5); };
// mouse: el primer clic atrapa el puntero; después, mover mira y el botón dispara (Esc lo suelta)
const palanca = { id: null, x0: 0, y0: 0, x: 0, z: 0 }, dedo = { id: null, x: 0, y: 0 };
$("escena").addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse") {
    if (document.pointerLockElement !== $("escena")) $("escena").requestPointerLock?.();
    if (e.button === 2) acuchillar(); else disparando = true;
  } else if (e.clientX < innerWidth / 2 && palanca.id === null) Object.assign(palanca, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, z: 0 });
  else if (dedo.id === null) Object.assign(dedo, { id: e.pointerId, x: e.clientX, y: e.clientY });
});
addEventListener("pointermove", e => {
  if (e.pointerType === "mouse") { if (document.pointerLockElement === $("escena")) mirar(e.movementX, e.movementY, 0.0024); }
  else if (e.pointerId === palanca.id) { palanca.x = limitar((e.clientX - palanca.x0) / 50, -1, 1); palanca.z = limitar((e.clientY - palanca.y0) / 50, -1, 1); }
  else if (e.pointerId === dedo.id) { mirar(e.clientX - dedo.x, e.clientY - dedo.y, 0.006); dedo.x = e.clientX; dedo.y = e.clientY; }
});
for (const fin of ["pointerup", "pointercancel"]) addEventListener(fin, e => {
  if (e.pointerType === "mouse") disparando = false;
  else if (e.pointerId === palanca.id) Object.assign(palanca, { id: null, x: 0, z: 0 });
  else if (e.pointerId === dedo.id) dedo.id = null;
});
let usarTactil = false;
$("bComprar").addEventListener("pointerdown", e => { e.stopPropagation(); usarTactil = true; comprar(); });
for (const fin of ["pointerup", "pointercancel"]) $("bComprar").addEventListener(fin, () => usarTactil = false);
$("bCambiar").addEventListener("pointerdown", e => { e.stopPropagation(); cambiarArma(null); });

$("escena").addEventListener("contextmenu", e => e.preventDefault());   // el botón derecho es el cuchillo

// cuchillo: al que tengas adelante y pegado. Vale más puntos que una bala
const haciaYo = z => { const d = Math.atan2(z.x - yo.x, z.z - yo.z) - yo.ang; return Math.atan2(Math.sin(d), Math.cos(d)); };
function acuchillar() {
  if (terminado || yo.cuchillo > 0) return;
  yo.cuchillo = CUCHILLO.espera;
  SONIDOS.cuchillo();
  let cual = null, dmin = CUCHILLO.alcance;
  for (const z of zombis) {
    const d = Math.hypot(z.x - yo.x, z.z - yo.z);
    if (z.vivo && z.piso === yo.piso && d < dmin && Math.abs(haciaYo(z)) < 0.75) { dmin = d; cual = z; }
  }
  if (cual) { herir(cual, CUCHILLO.dano, "cuchillo"); SONIDOS.tajo(); }
}
function recargar() {
  const a = arma();
  if (yo.recarga > 0 || a.enCargador === a.cargador || a.enReserva <= 0) return;
  yo.recarga = a.recarga * (yo.ventajas.has("turbo") ? 0.6 : 1);
  SONIDOS.recarga();
}
function cambiarArma(cual) {
  if (yo.armas.length < 2 || terminado) return;
  yo.enMano = cual === null ? (yo.enMano + 1) % yo.armas.length : Math.min(cual, yo.armas.length - 1);
  yo.recarga = 0; yo.enfria = 0.3;
  SONIDOS.seco();
}
const cerca = () => terminado ? null : estaciones.find(e => e.piso === yo.piso && !(e.tipo === "puerta" && puertas[e.id].abierta) && Math.hypot(yo.x - e.x, yo.z - e.z) < (e.alcance ?? 13)) ?? null;
const ventanaCerca = () => ventanas.find(v => v.piso === yo.piso && v.quedan < TABLAS && Math.hypot(yo.x - v.x, yo.z - v.z) < 17) ?? null;
function tomarArma(id) {                                 // llevás dos: la nueva reemplaza a la que tenés en la mano
  const nueva = armaNueva(id);
  if (yo.armas.length < 2) { yo.armas.push(nueva); yo.enMano = yo.armas.length - 1; }
  else yo.armas[yo.enMano] = nueva;
  yo.recarga = 0;
}
function comprar() {
  const e = cerca();
  if (!e) return;
  const tengo = e.tipo === "arma" && yo.armas.find(a => a.id === e.id);
  const costo = tengo ? e.costo / 2 : e.costo;           // si ya la tenés, comprás munición a mitad de precio
  if ((e.tipo === "ventaja" && yo.ventajas.has(e.id)) || (e.tipo === "palanca" && corriente) || (e.tipo === "mejora" && arma().mejorada) || (e.tipo === "trampa" && (trampa.t > 0 || trampa.espera > 0)) || (e.tipo === "portal" && portalT > 0)) return;
  if ((e.tipo === "ventaja" || e.tipo === "mejora" || e.tipo === "trampa" || e.tipo === "portal") && !corriente) { avisar(T.sinLuz, "#ffd23c", 1.4); SONIDOS.no(); return; }
  if (puntos < costo) { avisar(T.sinPuntos, "#ffd23c", 1.2); SONIDOS.no(); return; }
  puntos -= costo;
  SONIDOS.compra();
  if (tengo) {
    tengo.enCargador = tengo.cargador; tengo.enReserva = tengo.reserva;
    if (tengo.nivel < NIVEL_MAX) { tengo.nivel++; tengo.dano *= 1.15; }
  }
  else if (e.tipo === "arma") tomarArma(e.id);
  else if (e.tipo === "ventaja") { yo.ventajas.add(e.id); if (e.id === "jugo") yo.vida = vidaMax(); }
  else if (e.tipo === "puerta") { puertas[e.id].abierta = true; SONIDOS.puerta(); caminoT = 0; }
  else if (e.tipo === "trampa") { trampa.t = 22; SONIDOS.corriente(); }
  else if (e.tipo === "portal") {                        // te lleva al otro plato; tarda en volver a cargar
    const otro = portales.find(p => p !== e) ?? e;
    estallar(yo.x, yo.z, 14, 0x39ff14);
    Object.assign(yo, { x: otro.x, z: otro.z, piso: otro.piso, vx: 0, vz: 0 });
    estallar(yo.x, yo.z, 14, 0x39ff14);
    portalT = 25; caminoT = 0;
    SONIDOS.rayo();
  }
  else if (e.tipo === "palanca") { corriente = true; avisar(T.luz, "#fff2b0", 2); SONIDOS.corriente(); }
  else if (e.tipo === "mejora") {                        // el arma pega el doble y carga más
    const a = arma();
    Object.assign(a, { mejorada: true, dano: a.dano * 2, cargador: Math.round(a.cargador * 1.5), reserva: Math.round(a.reserva * 1.5), color: 0xff3ad0 });
    a.enCargador = a.cargador; a.enReserva = a.reserva;
    avisar(T.mejorada, "#ff3ad0", 1.8);
  } else {                                               // caja misteriosa: un arma al azar de las que no tenés
    const opciones = ARMAS.filter(a => a.id !== "pistola" && !yo.armas.some(m => m.id === a.id));
    const sale = opciones[Math.floor(Math.random() * opciones.length)] ?? ARMA("rayo");
    tomarArma(sale.id);
    avisar(T.armas[sale.id], "#ffd23c", 1.6);
  }
}

// ---------- Un paso de la partida ----------
function disparar() {
  const a = arma();
  yo.enfria = 1 / a.cadencia;
  a.enCargador--;
  vista.fogonazo.visible = true; vista.fogonazo.scale.setScalar(0.9 + Math.random() * 0.7); vista.fogonazo.material.color.set(a.color);
  vista.patada = 1;
  SONIDOS[a.id]();
  for (let k = 0; k < (a.perdigones ?? 1); k++) {
    const b = balas.find(b => b.vive <= 0);
    if (!b) break;
    const ang = yo.ang + (Math.random() - 0.5) * (a.abre ?? 0);
    Object.assign(b, { vive: 0.6, piso: yo.piso, x: yo.x + Math.sin(yo.ang) * 2, y: yo.y + OJOS, z: yo.z + Math.cos(yo.ang) * 2, dx: Math.sin(ang), dz: Math.cos(ang), arma: a,
                       dy: Math.tan(cabeceo) + (Math.random() - 0.5) * (a.abre ?? 0) * 0.5 });
    b.tocados.length = 0;
  }
  if (a.enCargador <= 0) recargar();
}
function animar(z, nombre, una = false) {
  if (z.anim === nombre || !z.acc[nombre]) return;
  z.acc[z.anim]?.fadeOut(0.15);
  const acc = z.acc[nombre].reset().fadeIn(0.15);
  acc.setLoop(una ? THREE.LoopOnce : THREE.LoopRepeat);
  acc.clampWhenFinished = una;
  acc.play();
  z.anim = nombre;
}
function herir(z, dano, a) {
  if (!z.vivo) return;
  z.vida -= poderes.muerte > 0 ? Infinity : dano;
  z.susto = 0.12;
  sumar(10);
  if (z.vida > 0) return;
  z.vivo = false; z.cae = 0.001;
  animar(z, "Death", true);
  bajas++;
  sumar(a === "cuchillo" ? 120 : a === "cabeza" ? 90 : a === "trampa" ? 0 : 50);   // con el golpe: 60 por bala, 100 en la cabeza, 130 a cuchillo
  SONIDOS.baja();
  if (a === "cabeza") { SONIDOS.cabeza(); cabezaT = 0.5; }
  if (Math.random() < 0.05 && a !== "bomba" && !z.ventana) {   // a veces suelta un premio
    const p = premios.find(p => !p.tipo);
    if (p) {
      const tipos = Object.keys(PODERES);
      Object.assign(p, { tipo: tipos[Math.floor(Math.random() * tipos.length)], t: 0, x: z.x, z: z.z, piso: z.piso });
      p.g.children[0].material.color.set(PODERES[p.tipo]);
      p.g.visible = true;
    }
  }
}
// dónde aparece un zombi: sale de abajo del piso, en algún lugar al que se llegue caminando, ni encima tuyo ni lejísimo
function lugarParaSalir() {
  for (let k = 0; k < 40; k++) { const i = Math.floor(Math.random() * pasos.length); if (pasos[i] >= 14 && pasos[i] <= 75) return i; }
  return -1;
}
function paso(dt) {
  if (terminado) return;
  tiempo += dt;
  if ((caminoT -= dt) <= 0) { caminoT = 0.25; trazarCamino(); }
  for (const p of Object.values(puertas)) if (p.abierta && p.baja < 1) p.baja = Math.min(1, p.baja + dt * 0.9);

  // rondas
  if (porSalir <= 0 && !zombis.some(z => z.vivo)) {
    if (pausa <= 0) { pausa = ronda ? 7 : 2.5; if (ronda) SONIDOS.finRonda(); }
    else if ((pausa -= dt) <= 0) {
      ronda++;
      porSalir = cuantosZombis(ronda);
      proximo = 0;
      avisar(`${T.ronda} ${ronda}`);
      SONIDOS.ronda();
    }
  }
  if (porSalir > 0 && (proximo -= dt) <= 0) {
    const z = zombis.find(z => !z.vivo && z.cae <= 0 && z.g);
    const donde = lugarParaSalir();
    if (z && donde >= 0) {
      const [x, zz] = centro(donde % COLS, Math.floor(donde / COLS));
      Object.assign(z, { vivo: true, vida: vidaZombi(ronda), ventana: null, entra: false, rompe: 0, golpe: 0.5, anim: "", sinCabeza: false, arrastra: false, sale: 1.3, piso: 1, quieto: 0, antes: [x, zz],
                         x, z: zz, y: alturaEn(x, zz), ang: Math.atan2(yo.x - x, yo.z - zz), vel: (8 + Math.min(ronda, 10) * 0.4) * (0.85 + Math.random() * 0.3) });
      z.g.visible = true; z.g.rotation.x = 0;
      for (const h of z.huesos) h.hueso.scale.copy(h.escala);
      z.mez.stopAllAction();
      animar(z, "Walk");
      porSalir--;
      proximo = Math.max(0.25, 1.2 - ronda * 0.1);
    }
  }

  // vos: adelante y atrás según a dónde mirás, y de costado
  let lado = teclas.has("der") - teclas.has("izq") + palanca.x, avance = teclas.has("arriba") - teclas.has("abajo") - palanca.z;
  yo.ang -= (teclas.has("giraDer") - teclas.has("giraIzq")) * 2.4 * dt;
  let objetivo = null, dmin = Infinity;
  for (const z of zombis) if (z.vivo && z.piso === yo.piso) { const d = Math.hypot(z.x - yo.x, z.z - yo.z); if (d < dmin) { dmin = d; objetivo = z; } }
  const enMira = haciaYo;
  let quiereDisparar = disparando;
  if (TACTIL) quiereDisparar = zombis.some(z => z.vivo && z.piso === yo.piso && Math.abs(enMira(z)) < 0.1 && Math.hypot(z.x - yo.x, z.z - yo.z) < 110);
  if (params.get("auto")) {                              // piloto de prueba: mira al más cercano y le dispara
    if (objetivo) yo.ang += enMira(objetivo) * acercar(dt, 10);
    quiereDisparar = !!objetivo && dmin < 90;
    if (dmin < 7) acuchillar();
    if (cerca() && puntos >= cerca().costo) comprar();
  }
  const largo = Math.hypot(lado, avance), tope = (teclas.has("corre") && avance > 0 ? 36 : 25) * (yo.ventajas.has("turbo") ? 1.25 : 1);
  if (largo > 1) { lado /= largo; avance /= largo; }
  const fx = Math.sin(yo.ang), fz = Math.cos(yo.ang);     // hacia adelante; a la derecha es (-fz, fx)
  yo.vx += ((fx * avance - fz * lado) * tope - yo.vx) * acercar(dt, 10);
  yo.vz += ((fz * avance + fx * lado) * tope - yo.vz) * acercar(dt, 10);
  mover(yo, yo.vx * dt, yo.vz * dt, 1);
  yo.y += (alturaEn(yo.x, yo.z) - yo.y) * acercar(dt, 12);   // escalones y rampas: la cámara los sube suave
  yo.enfria -= dt;
  yo.cuchillo = Math.max(0, yo.cuchillo - dt);
  if (TACTIL && objetivo && dmin < 7 && Math.abs(enMira(objetivo)) < 0.6) acuchillar();
  const a = arma();
  if (yo.recarga > 0 && (yo.recarga -= dt) <= 0) { const n = Math.min(a.cargador - a.enCargador, a.enReserva); a.enCargador += n; a.enReserva -= n; }
  if (quiereDisparar && yo.enfria <= 0 && yo.recarga <= 0 && yo.cuchillo < CUCHILLO.espera - 0.35) {
    if (a.enCargador > 0) disparar();
    else if (a.enReserva > 0) recargar();
    else { yo.enfria = 0.3; SONIDOS.seco(); }
  }
  if (tiempo - yo.golpeado > 3) yo.vida = Math.min(vidaMax(), yo.vida + 45 * dt);
  // reponer tablas: manteniendo E cerca de una ventana rota
  const rota = (teclas.has("usar") || usarTactil) && !cerca() ? ventanaCerca() : null;
  yo.clava = rota ? yo.clava + dt : 0;
  if (rota && yo.clava > 0.8) { yo.clava = 0; rota.quedan++; sumar(10); SONIDOS.clavar(); }

  // balas: se frenan en las paredes y en las puertas cerradas (por las ventanas pasan)
  for (const b of balas) {
    if (b.vive <= 0) continue;
    b.vive -= dt;
    const tramo = 240 * dt, x0 = b.x, y0 = b.y, z0 = b.z;   // se revisa todo el tramo: con pocos cuadros por segundo, si no, pasaban de largo
    b.x += b.dx * tramo; b.y += b.dy * tramo; b.z += b.dz * tramo;
    let choca = false;                                   // paredes y piso, mirando cada tanto a lo largo del tramo
    for (let k = 2; k <= tramo + 2 && !choca; k += 2) {
      const j = Math.min(k, tramo), [c, f] = celdaDe(x0 + b.dx * j, z0 + b.dz * j);
      choca = bloqueada(c, f) || y0 + b.dy * j < cota(MAPA.alto[casilla(c, f)]);
    }
    if (choca) { b.vive = 0; continue; }
    for (const z of zombis) {
      if (!z.vivo || z.piso !== b.piso) continue;
      const k = limitar((z.x - x0) * b.dx + (z.z - z0) * b.dz, 0, tramo), al = y0 + b.dy * k - z.y;   // el punto del tramo más cercano al zombi, y a qué altura pasa
      if (al > ALTO_BICHO + 1.5 || al < -1 || (x0 + b.dx * k - z.x) ** 2 + (z0 + b.dz * k - z.z) ** 2 > 9) continue;
      // en la cabeza: la bala va a esa altura y pasa por el medio del cuerpo. Lo mata de una
      const cabeza = !z.arrastra && al > CABEZA && Math.abs((z.x - x0) * b.dz - (z.z - z0) * b.dx) < 1.1;
      if (cabeza && !b.arma.onda) { if (!b.arma.atraviesa) b.vive = 0; z.sinCabeza = true; herir(z, Infinity, "cabeza"); if (b.arma.atraviesa) continue; break; }
      const enPierna = al < PIERNAS && !b.arma.onda;       // en las piernas: si no muere, las pierde y sigue arrastrándose
      if (b.arma.atraviesa) { if (b.tocados.includes(z)) continue; b.tocados.push(z); herir(z, b.arma.dano, b.arma.id); if (z.vivo && enPierna) z.arrastra = true; continue; }
      b.vive = 0;
      if (b.arma.onda) {
        if (b.arma.id === "cohete") { SONIDOS.explota(); temblor = Math.max(temblor, 0.6); }                                 // estalla y alcanza a los de alrededor
        estallar(b.x, b.z, b.arma.onda, b.arma.color, b.piso);
        for (const o of zombis) if (o.piso === b.piso && Math.hypot(o.x - b.x, o.z - b.z) < b.arma.onda) { o.sinCabeza = Math.random() < 0.5; herir(o, b.arma.dano, b.arma.id); if (o.vivo) o.sinCabeza = false; }
      } else { herir(z, b.arma.dano, b.arma.id); if (z.vivo && enPierna) z.arrastra = true; }
      break;
    }
  }

  // zombis
  for (const z of zombis) {
    z.susto = Math.max(0, z.susto - dt);
    if (z.cae > 0) {                                     // cayó: queda tirado un momento y se hunde
      z.cae += dt;
      if (z.cae > 2.6) { z.cae = 0; z.g.visible = false; }
      continue;
    }
    if (!z.vivo) continue;
    if (z.sale > 0) { z.sale -= dt; continue; }          // todavía está saliendo del piso
    z.y += (alturaEn(z.x, z.z) - z.y) * acercar(dt, 12);
    if ((z.quieto += dt) > 4) {                          // si en cuatro segundos casi no avanzó y está lejos, se trabó: vuelve a salir en otro lado
      const lejos = Math.hypot(yo.x - z.x, yo.z - z.z) > 25, donde = lejos && Math.hypot(z.x - z.antes[0], z.z - z.antes[1]) < 4 ? lugarParaSalir() : -1;
      if (donde >= 0) { [z.x, z.z] = centro(donde % COLS, Math.floor(donde / COLS)); z.y = alturaEn(z.x, z.z); z.sale = 1.3; }
      z.quieto = 0; z.antes = [z.x, z.z];
    }
    const vel = z.vel * (z.arrastra ? 0.5 : 1);
    let mx, mz;                                          // a dónde va ahora
    if (z.ventana) {                                     // todavía afuera: va a su ventana y arranca las tablas
      const v = z.ventana, d = Math.hypot(v.x - z.x, v.z - z.z);
      if (d < 9 && v.quedan > 0) {
        animar(z, "Attack");
        z.ang = Math.atan2(v.x - z.x, v.z - z.z);
        if ((z.rompe += dt) > 1.3) { z.rompe = 0; v.quedan--; SONIDOS.tabla(); }
        continue;
      }
      animar(z, "Walk");
      const [ix, iz] = centro(...v.adentro);
      if (d < 9) z.entra = true;                         // una vez que llegó a la ventana libre, sigue derecho para adentro (si no, quedaba yendo y viniendo)
      if (z.entra) { mx = ix; mz = iz; } else { mx = v.x; mz = v.z; }
      if (Math.hypot(ix - z.x, iz - z.z) < 6) z.ventana = null;      // ya entró
    } else {
      const [c, f] = celdaDe(z.x, z.z), aca = pasos[casilla(c, f)] ?? 999;
      if (aca <= 3) { mx = yo.x; mz = yo.z; }
      else {
        let mejorPaso = aca;
        [mx, mz] = centro(c, f);
        for (let dc = -1; dc <= 1; dc++) for (let df = -1; df <= 1; df++) {      // las ocho de alrededor; en diagonal solo si no corta una esquina
          if ((!dc && !df) || bloqueada(c + dc, f + df) || (dc && df && (bloqueada(c + dc, f) || bloqueada(c, f + df)))) continue;
          if (MAPA.alto[casilla(c + dc, f + df)] - MAPA.alto[casilla(c, f)] > PASO_ALTO) continue;      // ese escalón no lo sube
          const p = pasos[casilla(c + dc, f + df)];
          if (p < mejorPaso) { mejorPaso = p; [mx, mz] = centro(c + dc, f + df); }
        }
      }
    }
    const dx = mx - z.x, dz = mz - z.z, d = Math.hypot(dx, dz) || 1, alYo = Math.hypot(yo.x - z.x, yo.z - z.z);
    z.golpe -= dt;
    if (alYo < 6 && !z.ventana && Math.abs(z.y - yo.y) < 7) {                        // te alcanzó: tira el manotazo
      animar(z, "Attack");
      z.ang = Math.atan2(yo.x - z.x, yo.z - z.z);
      if (z.golpe <= 0 && tiempo - yo.golpeado > 0.75) {    // de a uno: aunque te rodeen, entre golpe y golpe hay un respiro
        z.golpe = 1.3;
        yo.vida -= GOLPE; yo.golpeado = tiempo;
        temblor = 0.45;
        SONIDOS.golpe();
        if (yo.vida <= 0) return terminar();
      }
    } else {
      animar(z, "Walk");
      const antes = { x: z.x, z: z.z };
      if (z.ventana) { z.x += dx / d * vel * dt; z.z += dz / d * vel * dt; }
      else mover(z, dx / d * vel * dt, dz / d * vel * dt, 0.7);
      z.ang = Math.atan2(z.x - antes.x || dx, z.z - antes.z || dz);
    }
    for (const o of zombis) {                            // que no se encimen
      if (o === z || !o.vivo || o.piso !== z.piso) continue;
      const ex = z.x - o.x, ez = z.z - o.z, e = Math.hypot(ex, ez);
      if (e < 3.2 && e > 0.001) z.ventana ? (z.x += ex / e * (3.2 - e) * 0.5, z.z += ez / e * (3.2 - e) * 0.5) : mover(z, ex / e * (3.2 - e) * 0.5, ez / e * (3.2 - e) * 0.5, 0.7);
    }
  }
  if ((gemidoT -= dt) <= 0) {                             // cada tanto se queja alguno; más fuerte cuanto más cerca
    gemidoT = 1.5 + Math.random() * 3;
    if (objetivo) SONIDOS.gemido(limitar(0.09 - dmin / 1800, 0.012, 0.09));
  }

  // trampa eléctrica: mientras dura, cae todo zombi que se le acerque (no da puntos por baja)
  trampa.espera = Math.max(0, trampa.espera - dt);
  portalT = Math.max(0, portalT - dt);
  if (trampa.t > 0) {
    if ((trampa.t -= dt) <= 0) trampa.espera = 35;
    if ((trampa.pulso -= dt) <= 0) { trampa.pulso = 0.45; estallar(trampa.e.x, trampa.e.z, 20, 0x6fd6ff, trampa.e.piso); SONIDOS.chispa(); }
    for (const z of zombis) if (z.vivo && !z.ventana && z.piso === trampa.e.piso && Math.hypot(z.x - trampa.e.x, z.z - trampa.e.z) < 21) herir(z, Infinity, "trampa");
  }
  // premios
  for (const p of premios) {
    if (!p.tipo) continue;
    p.t += dt;
    if (p.t > 22) { p.tipo = null; p.g.visible = false; continue; }
    if (p.piso !== yo.piso || Math.hypot(yo.x - p.x, yo.z - p.z) > 6) continue;
    avisar(T.poderes[p.tipo], "#39ff14", 1.8);
    SONIDOS.premio();
    if (p.tipo === "bomba") { estallar(yo.x, yo.z, 140, 0xffffff); for (const z of zombis) herir(z, Infinity, "bomba"); sumar(400); }
    else if (p.tipo === "municion") for (const m of yo.armas) { m.enCargador = m.cargador; m.enReserva = m.reserva; }
    else poderes[p.tipo] = 20;
    p.tipo = null; p.g.visible = false;
  }
  poderes.muerte = Math.max(0, poderes.muerte - dt);
  poderes.doble = Math.max(0, poderes.doble - dt);
}
function terminar() {
  terminado = true;
  disparando = false;
  SONIDOS.fin();
  document.exitPointerLock?.();
  if (ronda > mejor) { mejor = ronda; try { localStorage.setItem("zombisMejorRonda", String(mejor)); } catch { /* sin almacenamiento */ } }
  $("fin").querySelector("h1").textContent = T.fin;
  $("fin").querySelector("p").innerHTML = T.resumen(ronda, bajas, puntos) + "<br>" + T.mejor + mejor;
  setTimeout(() => $("fin").classList.add("ver"), 700);
}

// ---------- Radar: en primera persona no ves a los que vienen de atrás ----------
const radar = (() => {
  const cv = $("radar"), g = cv.getContext("2d"), C = cv.width / 2, ALCANCE = 110;
  return () => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "rgba(10,7,32,.6)"; g.beginPath(); g.arc(C, C, C - 2, 0, 6.3); g.fill();
    g.strokeStyle = "#4a3f96"; g.lineWidth = 2; g.stroke();
    const punto = (x, z, color, r) => {                   // arriba en el radar es hacia donde mirás
      const dx = x - yo.x, dz = z - yo.z, adelante = dx * Math.sin(yo.ang) + dz * Math.cos(yo.ang), derecha = -dx * Math.cos(yo.ang) + dz * Math.sin(yo.ang);
      const d = Math.hypot(adelante, derecha), k = Math.min(1, ALCANCE / (d || 1)) * (C - 8) / ALCANCE;
      g.fillStyle = color; g.beginPath(); g.arc(C + derecha * k, C - adelante * k, r, 0, 6.3); g.fill();
    };
    for (const v of ventanas) if (v.quedan < TABLAS) punto(v.x, v.z, "#ff8a1f", 3);
    for (const p of premios) if (p.tipo) punto(p.x, p.z, "#39ff14", 4);
    for (const z of zombis) if (z.vivo) punto(z.x, z.z, z.piso === yo.piso ? "#ff3a3a" : "#7a3030", z.piso === yo.piso ? 4 : 2.5);   // los de otra planta, apagados
    g.fillStyle = "#fff"; g.beginPath(); g.moveTo(C, C - 7); g.lineTo(C + 5, C + 5); g.lineTo(C - 5, C + 5); g.fill();
  };
})();

// ---------- Cuadro a cuadro ----------
const reloj = new THREE.Clock(), o3 = new THREE.Object3D(), color = new THREE.Color();
let temblor = 0, cuadros = 0, desdeFps = 0, nivel = 0, mediasLentas = 0;
const NIVELES = [1, 0.85, 0.7, 0.58], bordes = [];        // bordes: el contorno de los zombis, lo primero que se apaga en una máquina lenta
function cuadro() {
  const real = reloj.getDelta(), dt = Math.min(real, 0.05), t = reloj.elapsedTime;
  cuadros++;
  if ((desdeFps += real) >= 0.5) {
    const fps = cuadros / desdeFps;
    $("fps").textContent = Math.round(fps) + " FPS";
    mediasLentas = fps < 50 && t > 4 && !document.hidden ? mediasLentas + 1 : 0;   // calidad adaptable, como en el portfolio
    if (mediasLentas >= 4 && nivel < NIVELES.length - 1) { mediasLentas = 0; renderer.setPixelRatio(RESOLUCION * NIVELES[++nivel]); ajustarTamano(); if (nivel >= 2) { for (const b of bordes) b.visible = false; farol.distance = 60; } }
    cuadros = 0; desdeFps = 0;
  }
  vista.fogonazo.visible = false;
  paso(dt);

  // primera persona: la cámara va a la altura de los ojos; el arma se mueve con el paso y el retroceso
  const andar = Math.hypot(yo.vx, yo.vz) / 25;
  temblor = Math.max(0, temblor - dt * 2.5);
  vista.paso += dt * andar * 9;
  camara.position.set(yo.x + (Math.random() - .5) * temblor, yo.y + OJOS + Math.abs(Math.sin(vista.paso)) * 0.18 * Math.min(1, andar) + (Math.random() - .5) * temblor, yo.z + (Math.random() - .5) * temblor);
  camara.rotation.set(cabeceo + vista.patada * 0.012, yo.ang + Math.PI, (Math.random() - .5) * temblor * 0.06);
  vista.patada = Math.max(0, vista.patada - dt * 9);
  const a = arma(), baja = yo.recarga > 0 ? 0.5 : 0;
  vista.g.position.set(0.34 + Math.sin(vista.paso) * 0.015 * andar, -0.3 + Math.abs(Math.cos(vista.paso)) * 0.02 * andar - baja * 0.6, -0.95 + vista.patada * 0.06);
  vista.g.rotation.set(vista.patada * 0.05 - baja, 0.06, 0);
  // cuchillazo: el arma se corre y el cuchillo cruza de derecha a izquierda
  if (params.get("tajo")) yo.cuchillo = CUCHILLO.espera - 0.17;   // para verlo en las pruebas
  const tajo = yo.cuchillo > CUCHILLO.espera - 0.35 ? 1 - (CUCHILLO.espera - yo.cuchillo) / 0.35 : 0;
  if (tajo) { vista.g.position.x += 0.25; vista.g.position.y -= 0.25; }
  for (const [id, m] of Object.entries(vista.armas)) m.visible = id === a.id;
  vista.delantera.visible = a.largo >= 1.2;               // pistola y revólver van a una mano
  const largoVista = a.largo * escalaVista(a), larga = a.largo >= 1.2;
  vista.fogonazo.position.z = larga ? CULATA - largoVista - 0.15 : -0.1 - largoVista / 2 - 0.15;
  vista.trasera.position.z = larga ? CULATA - largoVista * 0.3 : 0.2;        // una mano en la empuñadura, la otra más adelante
  vista.delantera.position.z = CULATA - largoVista * 0.62;
  if (vista.cuchillo) {
    vista.cuchillo.visible = tajo > 0;
    vista.cuchillo.position.set(0.45 - tajo * 0.75, -0.24 + Math.sin(tajo * Math.PI) * 0.1, -0.8);
    vista.cuchillo.rotation.set(0, 0.9 - tajo * 1.6, 0.4);
  }
  // luces: el farol titila; con corriente la casa queda bastante más clara
  const titila = Math.sin(t * 31) * Math.sin(t * 7.3) > 0.82 ? 0.55 : 1;
  farol.intensity = 1.7 * titila;
  faroles.forEach((fa, k) => { fa.material.opacity = corriente ? 0.95 : Math.sin(t * (9 + k)) * Math.sin(t * 2.3 + k) > 0.5 ? 0.5 : 0.12; });   // sin corriente apenas parpadean
  for (const pt of portales) pt.g.children[1].material.color.set(!corriente ? 0x24402a : portalT > 0 ? 0xff8a1f : 0x39ff14);
  cielo.intensity += ((corriente ? 0.95 : 0.5) - cielo.intensity) * acercar(dt, 2);

  for (const z of zombis) {
    if (!z.g || (!z.vivo && z.cae <= 0)) continue;
    z.mez.update(dt);
    z.g.position.x = z.x; z.g.position.z = z.z;
    if (z.vivo) {
      z.g.rotation.y = z.ang;
    }
    z.g.position.y = z.y - (z.cae > 1.6 ? (z.cae - 1.6) * 5 : 0) - Math.max(0, z.sale) * 6;   // sin patas va con la panza por el piso; muerto, se hunde
    if (z.sinCabeza) z.cabeza?.scale.setScalar(0.001);                   // después de la animación, que si no los vuelve a su tamaño
    if (z.arrastra) for (const h of z.piernas) h.scale.setScalar(0.001);
    z.g.scale.setScalar(z.escala * (1 + z.susto * 1.2));                // se hincha un instante cuando le pegás
  }
  for (const v of ventanas) v.tablas.forEach((tb, k) => tb.visible = k < v.quedan);
  for (const p of Object.values(puertas)) { p.hoja.position.y = p.y0 + p.alto / 2 - p.baja * (p.alto + 1); p.hoja.visible = p.baja < 1; }   // se pliega contra el piso
  for (const e of estaciones) if (e.mango) e.mango.rotation.x = corriente ? -0.9 : 0.9;
  balas.forEach((b, i) => {
    o3.position.set(b.x, b.y - 0.9, b.z);
    o3.rotation.set(0, Math.atan2(b.dx, b.dz), 0);
    o3.scale.setScalar(b.vive > 0 && b.vive < 0.58 ? 1 : 0);
    o3.updateMatrix();
    balasMesh.setMatrixAt(i, o3.matrix);
    if (b.arma) balasMesh.setColorAt(i, color.set(b.arma.color));
  });
  balasMesh.instanceMatrix.needsUpdate = true;
  if (balasMesh.instanceColor) balasMesh.instanceColor.needsUpdate = true;
  for (const p of premios) if (p.tipo) {
    p.g.position.set(p.x, alturaEn(p.x, p.z) + 4 + Math.sin(t * 3) * 0.6, p.z);
    p.g.rotation.y = t * 2.4;
    p.g.visible = p.t < 17 || Math.sin(t * 18) > 0;                   // parpadea antes de irse
  }
  for (const o of ondas) if (o.t < 1) {
    o.t += dt * 2.6;
    o.m.scale.setScalar(1 + o.t * o.r);
    o.m.material.opacity = 1 - o.t;
    o.m.visible = o.t < 1;
  }
  radar();

  // marcador
  const e = cerca(), rota = !e && ventanaCerca();
  $("ronda").textContent = ronda || "";
  $("puntos").textContent = puntos;
  $("arma").innerHTML = `<b>${T.armas[a.id]}${"★".repeat(a.nivel - 1)}${a.mejorada ? " +" : ""}</b>${yo.recarga > 0 ? T.recargando : `${a.enCargador} / ${a.enReserva}`}`;
  $("dano").style.opacity = terminado ? 1 : limitar(1 - yo.vida / vidaMax(), 0, 1);
  $("ventajas").innerHTML = [...yo.ventajas].map(v => `<span>${VENTAJAS[v].icono}</span>`).join("") + (corriente ? "<span>💡</span>" : "");
  $("poderes").innerHTML = Object.entries(poderes).filter(([, s]) => s > 0).map(([k, s]) => `<span>${T.poderes[k]} ${Math.ceil(s)}</span>`).join("");
  let pista = "";
  if (e && !((e.tipo === "ventaja" && yo.ventajas.has(e.id)) || (e.tipo === "palanca" && corriente) || (e.tipo === "mejora" && a.mejorada) || (e.tipo === "trampa" && (trampa.t > 0 || trampa.espera > 0)) || (e.tipo === "portal" && portalT > 0))) {
    const tengo = e.tipo === "arma" && yo.armas.some(m => m.id === e.id), costo = tengo ? e.costo / 2 : e.costo;
    pista = `E ➜ ${e.nombre}${tengo ? " (" + T.municion + ")" : ""}${costo ? " · " + costo : ""}`;
  } else if (rota) pista = `${T.tablas} (${T.mantener}) · ${rota.quedan}/${TABLAS}`;
  $("pista").classList.toggle("ver", !!pista);
  if (pista) $("pista").textContent = pista;
  $("bComprar").style.display = TACTIL && pista ? "block" : "none";
  if ((avisoT -= dt) <= 0) $("aviso").classList.remove("ver");
  cabezaT -= dt;
  $("mira").classList.toggle("cabeza", cabezaT > 0);

  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}

// ---------- Carga de los modelos (Quaternius, CC0), pasados a cel shading ----------
// centra el modelo, lo lleva a un largo dado y lo deja apuntando hacia -z (su eje más largo es el caño)
const LARGAS = 1.8, CORTAS = 1.3, CULATA = 0.35;          // CULATA: hasta dónde llega hacia vos la parte de atrás de un arma larga
const escalaVista = a => a.largo < 1.2 ? CORTAS : a.vista ?? LARGAS;
const AL_REVES = new Set(["pistola", "revolver", "escopeta", "rifle", "pesada", "tirador", "laser", "franco"]);   // estos modelos traen el caño hacia el otro lado
function prepararArma(obj, largo, tinte, alReves = false, grosor = 0.014) {
  const g = new THREE.Group(), caja3 = new THREE.Box3().setFromObject(obj), tam = caja3.getSize(new THREE.Vector3()), medio = caja3.getCenter(new THREE.Vector3());
  obj.position.sub(medio);
  const eje = new THREE.Group();
  eje.add(obj);
  if (tam.x > tam.z) eje.rotation.y = alReves ? Math.PI / 2 : -Math.PI / 2;
  g.add(eje);
  g.scale.setScalar(largo / Math.max(tam.x, tam.z));
  g.updateMatrixWorld(true);
  const mallas = [];                                     // primero se juntan: no se puede agregar piezas mientras se recorre
  obj.traverse(p => { if (p.isMesh) mallas.push(p); });
  mallas.forEach(p => {
    const c = p.material.color.clone().multiplyScalar(2.6).addScalar(0.05);       // vienen casi negros: se aclaran para que se lean
    if (tinte && /Grey|Metal$|^Main$/.test(p.material.name)) c.set(tinte);
    p.material = toon(c);
    p.add(new THREE.Mesh(p.geometry, tintaGruesa(grosor / p.getWorldScale(new THREE.Vector3()).x)));   // contorno parejo, sea cual sea la escala del modelo
  });
  return g;
}
const cargador = new GLTFLoader(), cargar = n => cargador.loadAsync(`./modelos/${n}.glb`);
const MODELOS = [...new Set(ARMAS.map(a => a.modelo))];

Promise.all(["zombi", "cuchillo", ...MODELOS].map(cargar))
  .then(([zombi, cuchillo, ...armas]) => {
    // el arma en la mano: un modelo por arma (el láser y el rayo son la metralleta teñida)
    for (const a of ARMAS) {
      const m = prepararArma(armas[MODELOS.indexOf(a.modelo)].scene.clone(true), a.largo, a.tinte, AL_REVES.has(a.modelo));
      const corta = a.largo < 1.2;                         // pistola y revólver: la culata metida en la mano de atrás
      m.position.set(0, corta ? 0.04 : 0.16, corta ? -0.1 : CULATA - a.largo * escalaVista(a) / 2);
      m.scale.multiplyScalar(escalaVista(a));
      m.visible = false;
      vista.g.add(m);
      vista.armas[a.id] = m;
    }
    for (const e of estaciones) if (e.pared) {             // las de pared, colgadas en su tabla
      const a = ARMA(e.id), m = prepararArma(armas[MODELOS.indexOf(a.modelo)].scene.clone(true), Math.min(10.5, a.largo * 4.2), a.tinte, AL_REVES.has(a.modelo), 0.1);
      m.position.set(-e.pared.nx * 3.6, 5.4, -e.pared.nz * 3.6);
      m.rotation.y = Math.atan2(-e.pared.dx, -e.pared.dz);   // el caño a lo largo de la pared
      e.g.add(m);
    }
    vista.cuchillo = prepararArma(cuchillo.scene, 0.075);      // viene parado: el largo es su alto
    vista.cuchillo.children[0].rotation.x = -1.2;           // la hoja hacia adelante
    vista.cuchillo.visible = false;
    camara.add(vista.cuchillo);
    vista.fogonazo.position.set(0, 0.08, -1.7);
    const ojoTex = new THREE.SpriteMaterial({ map: polvoTex, color: 0xffb020, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    // zombis: copias del mismo modelo con su esqueleto, en cel shading y con contorno
    // el tamaño real hay que medirlo con los huesos aplicados: la malla sola viene en otra escala
    zombi.scene.updateMatrixWorld(true);
    let altoReal = 1, anchoReal = 1, porUnidad = 1;
    zombi.scene.traverse(p => {
      if (!p.isSkinnedMesh) return;
      p.computeBoundingBox();
      p.geometry.computeBoundingBox();
      const real = p.boundingBox.clone().applyMatrix4(p.matrixWorld).getSize(new THREE.Vector3()), cruda = p.geometry.boundingBox.getSize(new THREE.Vector3());
      altoReal = Math.max(altoReal === 1 ? 0 : altoReal, real.y); anchoReal = Math.max(anchoReal === 1 ? 0 : anchoReal, real.x, real.z);
      porUnidad = Math.max(real.x, real.y, real.z) / Math.max(cruda.x, cruda.y, cruda.z);
    });
    const escala = 6.6 / altoReal;
    ALTO_BICHO = altoReal * escala; PIERNAS = -9; CABEZA = ALTO_BICHO * 0.77;   // la cabeza: el cuarto de arriba
    const clip = n => zombi.animations.find(a => a.name.endsWith("|" + n) || a.name.endsWith("_" + n) || a.name === n);
    zombis.forEach((z, k) => {
      const g = clonarConEsqueleto(zombi.scene);
      g.updateMatrixWorld(true);
      const mallas = [];
      g.traverse(p => { if (p.isSkinnedMesh) mallas.push(p); });
      mallas.forEach(p => {
        p.material = toon([0xffffff, 0xd8ffd0, 0xffe4c4, 0xd0d8ff][k % 4], { map: p.material.map });   // vienen casi negras: se aclaran y cada una tira a un tono
        p.frustumCulled = false;
        const b = new THREE.SkinnedMesh(p.geometry, tintaGruesa(0.06 / (porUnidad * escala)));
        b.bind(p.skeleton, p.bindMatrix);
        b.frustumCulled = false;
        bordes.push(b);
        p.parent.add(b);
        b.position.copy(p.position); b.quaternion.copy(p.quaternion); b.scale.copy(p.scale);
      });
      const cabeza = g.getObjectByName("Head");            // ojos que brillan en la oscuridad
      if (cabeza) {
        const k = 1 / cabeza.getWorldScale(new THREE.Vector3()).x, alto = altoReal * 0.1;
        for (const lado of [-1, 1]) {
          const ojo = new THREE.Sprite(ojoTex);
          ojo.scale.setScalar(alto * 1.1 * k);
          ojo.position.set(lado * alto * 0.75 * k, alto * 1.2 * k, alto * 1.6 * k);
          cabeza.add(ojo);
        }
      }
      g.rotation.order = "YXZ";
      z.cabeza = cabeza ?? null;
      g.traverse(h => { if (/^(Front|MidFront|MidBack|Back)?Leg\.?[LR]$/.test(h.name)) z.piernas.push(h); });
      z.huesos = [z.cabeza, ...z.piernas].filter(Boolean).map(hueso => ({ hueso, escala: hueso.scale.clone() }));
      g.visible = false;
      escena.add(g);
      z.g = g; z.escala = escala;
      z.mez = new THREE.AnimationMixer(g);
      for (const n of ["Walk", "Run", "Attack", "Death"]) { const c = clip(n); if (c) z.acc[n] = z.mez.clipAction(c); }
    });
  })
  .catch(err => { console.error(err); $("cargando").textContent = "No se pudieron cargar los modelos"; throw err; })
  .then(() => {
    reiniciar();
    trazarCamino();
    for (let t = 0; t < Number(params.get("salto") ?? 0); t += 1 / 60) paso(1 / 60);   // ?auto=1&salto=40: arranca con la partida avanzada (para pruebas)
    if (params.get("prueba")) {
      const salida = Object.assign(document.createElement("pre"), { id: "prueba" });
      salida.textContent = JSON.stringify({ ronda, bajas, puntos, vida: Math.round(yo.vida), terminado, armas: yo.armas.map(a => a.id), tablas: ventanas.map(v => v.quedan),
        piso: yo.piso, vivos: zombis.filter(z => z.vivo).length, faltan: zombis.filter(z => z.vivo).map(z => pasos[casilla(...celdaDe(z.x, z.z))]), adentro: zombis.filter(z => z.vivo && !z.ventana).length });
      document.body.append(salida);
    }
    document.body.classList.add("listo");
    if (params.get("auto")) $("cargando").remove();      // en las pruebas no hay tiempo para que se desvanezca
    requestAnimationFrame(cuadro);
  });
