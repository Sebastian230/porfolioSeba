import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
import { clone as clonarConEsqueleto } from './lib/utils/SkeletonUtils.js';
import { mergeGeometries } from './lib/utils/BufferGeometryUtils.js';

// ====== EDITÁ ACÁ TUS PROYECTOS ======
const PROYECTOS = [   // los mismos 9 de la web linkmaster; img es la foto del cuadro (si falta, va un número)
  { nombre: "Vetusmoon",                    desc: "Tienda online",    url: "https://vetusmoon.com", img: "img/vetusmoon.jpg" },
  { nombre: "Panel de la tienda",           desc: "Panel de gestión", url: "#", img: "img/panel.jpg" },
  { nombre: "Owners",                       desc: "Sitio web",        url: "#", img: "img/owners.jpg" },
  { nombre: "Portfolio 3D interactivo",     desc: "Portfolio",        url: "#", img: "img/portfolio.jpg" },
  { nombre: "Longbox",                      desc: "Aplicación web",   url: "#", img: "img/longbox.jpg" },
  { nombre: "Catálogo de impresión 3D",     desc: "Sistema a medida", url: "#", img: "img/catalogo3d.jpg" },
  { nombre: "Bot de WhatsApp para empresa", desc: "Bot",              url: "#", img: "img/bot.jpg" },
  { nombre: "Cubitos Network+",             desc: "Herramienta",      url: "#", img: "img/cubitos.jpg" },
  { nombre: "Servidor y red propia",        desc: "Infraestructura",  url: "#", img: "img/servidor.jpg" },
  { nombre: "Experiencia en redes",         desc: "Redes",            url: "#", img: "img/redes.jpg" },
  { nombre: "CompTIA Network+",             desc: "Redes",            url: "#", img: "img/netplus.jpg" },
  { nombre: "CompTIA Security+",            desc: "Seguridad",        url: "#", img: "img/secplus.jpg" },
];
// Experiencia laboral: letras paradas, abajo a la derecha
const EXPERIENCIA = [
  { puesto: "Puesto 1", empresa: "Empresa", periodo: "2023 – hoy" },
  { puesto: "Puesto 2", empresa: "Empresa", periodo: "2020 – 2023" },
  { puesto: "Puesto 3", empresa: "Empresa", periodo: "2017 – 2020" },
];
// Qué extras se muestran (poner true para volver a activar alguno)
const MOSTRAR = { vacas: true, calabazas: true, pozo: true, trafico: false, experiencia: false };
// El final: un autocine al fondo del maizal. Esto es lo que se proyecta en la pantalla (cada texto es un párrafo).
const PELICULA = {
  titulo: "Sebastian Rodriguez",
  bajada: "Software hecho en el campo",
  parrafos: [
    "Soy desarrollador y vivo en el campo, en Uruguay. Desde acá hago software a medida para negocios: tiendas online, paneles de gestión y sistemas de catálogo y precios.",
    "Armo agentes de IA y bots de WhatsApp que atienden clientes, toman pedidos y derivan a una persona lo que hace falta.",
    "También me gustan los fierros: armo PC a medida, imprimo piezas en 3D y tengo mi propio servidor en casa, con la red separada en VLAN, firewall y copias de seguridad.",
    "Vetusmoon es mi tienda: componentes de PC, accesorios de domótica e impresiones 3D.",
    "Lo que más disfruto es agarrar un problema enredado y dejarlo funcionando solo.",
    "Hoy estudio para certificarme en redes y seguridad. Mi meta es seguir creciendo con Vetusmoon y Linkmaster, y trabajar con gente que quiera hacer las cosas bien.",
    "¿Hablamos?  rodriguez.sebastian.gar@gmail.com",
  ],
};
// Lo que queda escrito en el maizal, en naranja
const NOMBRE = "Sebastian Rodriguez";
// =====================================

// ---------- Mapa (x: oeste-este, z: norte-sur) ----------
const VIOLETA = 0x1c1452;   // violeta del horizonte: el piso se funde con el cielo a lo lejos
const RUTA_Z = 30, RUTA_ANCHO = 13;          // ruta principal
const CRUCE_X = -80;                         // ruta que cruza, entre el granero y el maizal
const BORDE_N = RUTA_Z - RUTA_ANCHO / 2, BORDE_S = RUTA_Z + RUTA_ANCHO / 2;
const ALTO_GRANERO = 30;
const PASTO = { x: 2, z: 3, rx: 47, rz: 40 };
const POZO = { x: 44, z: 10, r: 4.8 };       // pozo de agua, ancho como para tirarle calabazas
// el maizal sigue mucho más allá de donde llega el ovni, para que no se le vea el final
const MAIZ = { x0: -540, x1: CRUCE_X + 6, z0: -430, z1: 132 };
const MARCA = { x: -182, z: -16, ancho: 150, fondo: 84, giro: -0.08 };  // el nombre escrito en el maizal, un poco inclinado
const MARCA_C = Math.cos(MARCA.giro), MARCA_S = Math.sin(MARCA.giro);
const MARCIANO = { x: 0, z: 0 };             // easter egg: es el punto de la "i" (se ubica al escribir el nombre)
// piedras de los proyectos: arriba a la derecha, desordenadas [x, z, tamaño, giro]
// El camino de tierra va en zigzag, sin simetría: [z, cuánto se corre en x]
// Río: nace en una laguna del lado del maizal, cruza el camino por el puente y se va en diagonal hacia el fondo.
// Se arma sobre su propio eje (u a lo largo, v a lo ancho) y después se gira.
const RIO = { ancho: 12, giro: 0.68, laguna: { x: -152, z: -116, r: 42 } };   // ancho: el que tiene bajo el puente
const RIO_D = { x: Math.cos(RIO.giro), z: -Math.sin(RIO.giro) };    // hacia dónde corre
const RIO_N = { x: Math.sin(RIO.giro), z: Math.cos(RIO.giro) };     // a lo ancho, hacia el frente
const rioAMundo = (u, v) => [RIO.laguna.x + RIO_D.x * u + RIO_N.x * v, RIO.laguna.z + RIO_D.z * u + RIO_N.z * v];
// El cauce, punto por punto: semicírculos desparejos. El segundo se estira con un tramo recto, que es donde lo cruza
// el camino. El ancho va cambiando: tiene partes más anchas y más finas.
const CAUCE = [];                                   // { x, z, ancho }
let PUENTE_X, PUENTE_Z;
{
  const eje = [[0, 0]];
  let u = 12, enPuente = 0;
  for (let i = 0; i < 26; i++) {
    const r = [12, 14][i] ?? 10 + (i * 7919) % 13, recto = i === 1 ? 38 : 0, s = i % 2 ? 1 : -1;
    for (let k = 1; k <= 10; k++) { const a = k / 10 * Math.PI / 2; eje.push([u + r - r * Math.cos(a), s * r * Math.sin(a)]); }
    for (let k = 1; k <= 8 && recto; k++) {
      eje.push([u + r + recto * k / 8, s * r]);
      if (k === 4) enPuente = eje.length - 1;           // la mitad del tramo recto
    }
    for (let k = 1; k <= 10; k++) { const a = Math.PI / 2 + k / 10 * Math.PI / 2; eje.push([u + r + recto - r * Math.cos(a), s * r * Math.sin(a)]); }
    u += 2 * r + recto;
  }
  const largos = [0];
  for (let i = 1; i < eje.length; i++) largos.push(largos[i - 1] + Math.hypot(eje[i][0] - eje[i - 1][0], eje[i][1] - eje[i - 1][1]));
  eje.forEach(([eu, ev], i) => {
    const l = largos[i], cerca = Math.min(1, Math.abs(l - largos[enPuente]) / 45);
    const suelto = 10.5 * (1 + 0.4 * Math.sin(l * 0.05) + 0.22 * Math.sin(l * 0.13 + 2));
    const [x, z] = rioAMundo(eu, ev);
    CAUCE.push({ x, z, ancho: RIO.ancho * (1 - cerca) + suelto * cerca });   // parejo al pasar bajo el puente
  });
  [PUENTE_X, PUENTE_Z] = rioAMundo(...eje[enPuente]);
}
RIO.z = PUENTE_Z;                                   // por dónde lo cruza el camino
// cuánto falta para llegar a la orilla (negativo: está dentro del agua)
function fueraDelRio(x, z) {
  let min = Infinity;
  for (const p of CAUCE) { const d = Math.hypot(x - p.x, z - p.z) - p.ancho / 2; if (d < min) min = d; }
  return min;
}
const PUENTE = { largo: 40, alto: 9, ancho: 15 };
const alturaPuente = z => Math.max(0, PUENTE.alto * (1 - ((z - RIO.z) / (PUENTE.largo / 2)) ** 2));
const ZIGZAG = [[300, 5], [140, -3], [70, -7], [44, 9], [36, 5], [18, -8], [2, 6], [-30, -10], [-48, 3],
                // tramo recto que cruza el río de frente, por el puente
                [PUENTE_Z + 24, PUENTE_X + 24 * RIO_N.x / RIO_N.z - CRUCE_X], [PUENTE_Z - 24, PUENTE_X - 24 * RIO_N.x / RIO_N.z - CRUCE_X],
                [-180, 9], [-240, -6], [-300, 4], [-760, 0]];
function xDelCamino(z) {
  for (let i = 1; i < ZIGZAG.length; i++) {
    const [za, da] = ZIGZAG[i - 1], [zb, db] = ZIGZAG[i];
    if (z <= za && z >= zb) return CRUCE_X + da + (db - da) * (za - z) / (za - zb);
  }
  return CRUCE_X;
}
// Cuadros de los proyectos: rectángulos apaisados, en orden, a los dos lados de un pasillo que se recorre hacia adelante
const CUADRO = { ancho: 28, alto: 15.75, patas: 1.6 };
const PIEDRAS = PROYECTOS.map((_, i) => ({ x: i % 2 ? 166 : 112, z: 24 - i * 22 }));   // se van alternando de lado, cada vez más al fondo
// Espantapájaros, plantado en el maizal
const ESPANTA = { alto: 6.6, hundido: 0.3, cada: 30 };   // del alto de una vaca; cambia de lugar cada 30 segundos
// lugares por los que va rotando: [x, z, hacia dónde mira]
const ESPANTA_LUGARES = [
  [34, -190, -Math.PI / 2 + 0.5],                     // a la altura del proyecto 7, cerca del río
  [xDelCamino(34) - 22, 34, Math.PI / 2 - 0.2],       // en el maizal, frente al granero
  [6, -96, -Math.PI / 2 + 0.2],                       // entre el granero y el río
  [xDelCamino(-72) + 26, -72, -Math.PI / 2 + 0.2],    // al costado del camino
];
// Cartel de madera de bienvenida: abajo a la izquierda de la vista inicial, con dos calabazas al lado
const CARTEL = { x: -43, z: 68 };
// Cráneo de oro, al final del pasillo de los proyectos
const ORO = { x: 139, z: -238 };
const LIMITES = { x0: -236, x1: 196, z0: -250, z1: 72 };
// El granero está girado: la parte de atrás se va hacia la izquierda y deja ver el techo
const GIRO_GRANERO = 0.65, SEN = Math.sin(GIRO_GRANERO), COS = Math.cos(GIRO_GRANERO);
const PUERTA = { x: 20.1 * SEN, z: 20.1 * COS };
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
const RESOLUCION = Math.min(devicePixelRatio, 1.25);
renderer.setPixelRatio(RESOLUCION);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;                 // las sombras se recalculan cuadro por medio (ver cuadro)

const escena = new THREE.Scene();
escena.background = new THREE.Color(VIOLETA);   // se reemplaza por el cielo degradado más abajo
escena.fog = new THREE.Fog(VIOLETA, 70, 190);

const camara = new THREE.PerspectiveCamera(45, 1, 1, 1400);
const params = new URLSearchParams(location.search);

// ---------- Idiomas: español, inglés, portugués y chino ----------
// Se elige con los botones de arriba (o ?lang=en). Como muchos textos van pintados en la escena, cambiar de idioma recarga la página.
const IDIOMAS = { es: "ES", en: "EN", pt: "PT", zh: "中文" };
let guardado = null;
try { guardado = localStorage.getItem("idioma"); } catch { /* sin almacenamiento */ }
const pedido = params.get("lang") ?? guardado ?? (navigator.language || "es").slice(0, 2);
const IDIOMA = IDIOMAS[pedido] ? pedido : "es";
const TEXTOS = {
  es: {
    sub: "software hecho en el campo", mover: "mover", tecla: "Espacio", agarrarSoltar: "agarrar / soltar", abrirProyecto: "abrir proyecto",
    creditos: "Granero y vaca: Quaternius (CC0)", logro: "Logro desbloqueado", logroNombre: "Cráneo de oro", logroSub: "Abriendo mi WhatsApp…",
    agarrar: "Agarrar", soltar: "Soltar", cosas: { calabaza: "la calabaza", rana: "la rana", craneo: "el cráneo" },
    darTroll: c => `Espacio ➜ darle ${c} al troll`, tirarPozo: "Espacio ➜ tirar al pozo", soltarP: "Espacio ➜ soltar",
    asco: "Troll: ¡Puaj! No me gustan las ranas", nam: "¡Ñam!", abrir: n => `Enter ➜ abrir ${n}`,
    vetus: "Enter ➜ entrar a Vetusmoon", link: "Enter ➜ entrar a Linkmaster", copiado: "Correo copiado: ", contacto: "Enter ➜ contactame: ",
    marciano: "👽 ¡Encontraste al marciano!", cineOn: "Rueda del mouse ➜ leer · Enter ➜ cerrar", cineBajar: "Enter ➜ bajar la pantalla",
    oro: "Espacio ➜ agarrar el cráneo de oro", agarrarP: "Espacio ➜ agarrar", error: "No se pudo cargar la escena",
    cartel: ["Mi portfolio", "animado 2026", "Versión Halloween"], escapo: "¡El espantapájaros se escapó!", cazador: "Cazador de espantapájaros", cazadorSub: "Intentaste llevártelo más de 7 veces", sobreMi: "SOBRE MÍ", fin: "F I N", asunto: "Contacto desde el portfolio",
  },
  en: {
    sub: "software made in the countryside", mover: "move", tecla: "Space", agarrarSoltar: "grab / drop", abrirProyecto: "open project",
    creditos: "Barn and cow: Quaternius (CC0)", logro: "Achievement unlocked", logroNombre: "Golden skull", logroSub: "Opening my WhatsApp…",
    agarrar: "Grab", soltar: "Drop", cosas: { calabaza: "the pumpkin", rana: "the frog", craneo: "the skull" },
    darTroll: c => `Space ➜ give ${c} to the troll`, tirarPozo: "Space ➜ throw it in the well", soltarP: "Space ➜ drop",
    asco: "Troll: Yuck! I don't like frogs", nam: "Yum!", abrir: n => `Enter ➜ open ${n}`,
    vetus: "Enter ➜ go to Vetusmoon", link: "Enter ➜ go to Linkmaster", copiado: "Email copied: ", contacto: "Enter ➜ contact me: ",
    marciano: "👽 You found the alien!", cineOn: "Mouse wheel ➜ read · Enter ➜ close", cineBajar: "Enter ➜ lower the screen",
    oro: "Space ➜ grab the golden skull", agarrarP: "Space ➜ grab", error: "The scene could not be loaded",
    cartel: ["My animated", "portfolio 2026", "Halloween edition"], escapo: "The scarecrow got away!", cazador: "Scarecrow hunter", cazadorSub: "You tried to take it more than 7 times", sobreMi: "ABOUT ME", fin: "T H E   E N D", asunto: "Contact from the portfolio",
    proyectos: [["Vetusmoon", "Online store"], ["Store dashboard", "Dashboard"], ["Owners", "Website"], ["Interactive 3D portfolio", "Portfolio"],
      ["Longbox", "Web app"], ["3D printing catalogue", "Custom system"], ["WhatsApp bot for a company", "Bot"], ["Cubitos Network+", "Tool"],
      ["Own server and network", "Infrastructure"], ["Networking experience", "Networking"], ["CompTIA Network+", "Networking"], ["CompTIA Security+", "Security"]],
    pelicula: {
      bajada: "Software made in the countryside",
      parrafos: [
        "I'm a developer and I live in the countryside, in Uruguay. From here I build custom software for businesses: online stores, dashboards, and catalogue and pricing systems.",
        "I build AI agents and WhatsApp bots that answer customers, take orders and hand over to a person whatever needs one.",
        "I also like hardware: I build custom PCs, 3D print parts and run my own server at home, with a VLAN-segmented network, firewall and backups.",
        "Vetusmoon is my store: PC components, home automation accessories and 3D prints.",
        "What I enjoy most is taking a tangled problem and leaving it running on its own.",
        "Right now I'm studying to get certified in networking and security. My goal is to keep growing with Vetusmoon and Linkmaster, and to work with people who want to do things properly.",
        "Shall we talk?  rodriguez.sebastian.gar@gmail.com",
      ],
    },
  },
  pt: {
    sub: "software feito no campo", mover: "mover", tecla: "Espaço", agarrarSoltar: "pegar / soltar", abrirProyecto: "abrir projeto",
    creditos: "Celeiro e vaca: Quaternius (CC0)", logro: "Conquista desbloqueada", logroNombre: "Caveira de ouro", logroSub: "Abrindo meu WhatsApp…",
    agarrar: "Pegar", soltar: "Soltar", cosas: { calabaza: "a abóbora", rana: "a rã", craneo: "a caveira" },
    darTroll: c => `Espaço ➜ dar ${c} ao troll`, tirarPozo: "Espaço ➜ jogar no poço", soltarP: "Espaço ➜ soltar",
    asco: "Troll: Eca! Não gosto de rãs", nam: "Nham!", abrir: n => `Enter ➜ abrir ${n}`,
    vetus: "Enter ➜ entrar na Vetusmoon", link: "Enter ➜ entrar na Linkmaster", copiado: "E-mail copiado: ", contacto: "Enter ➜ fale comigo: ",
    marciano: "👽 Você encontrou o marciano!", cineOn: "Roda do mouse ➜ ler · Enter ➜ fechar", cineBajar: "Enter ➜ baixar a tela",
    oro: "Espaço ➜ pegar a caveira de ouro", agarrarP: "Espaço ➜ pegar", error: "Não foi possível carregar a cena",
    cartel: ["Meu portfólio", "animado 2026", "Versão Halloween"], escapo: "O espantalho escapou!", cazador: "Caçador de espantalhos", cazadorSub: "Você tentou levá-lo mais de 7 vezes", sobreMi: "SOBRE MIM", fin: "F I M", asunto: "Contato pelo portfólio",
    proyectos: [["Vetusmoon", "Loja online"], ["Painel da loja", "Painel de gestão"], ["Owners", "Site"], ["Portfólio 3D interativo", "Portfólio"],
      ["Longbox", "Aplicação web"], ["Catálogo de impressão 3D", "Sistema sob medida"], ["Bot de WhatsApp para empresa", "Bot"], ["Cubitos Network+", "Ferramenta"],
      ["Servidor e rede própria", "Infraestrutura"], ["Experiência em redes", "Redes"], ["CompTIA Network+", "Redes"], ["CompTIA Security+", "Segurança"]],
    pelicula: {
      bajada: "Software feito no campo",
      parrafos: [
        "Sou desenvolvedor e moro no campo, no Uruguai. Daqui faço software sob medida para negócios: lojas online, painéis de gestão e sistemas de catálogo e preços.",
        "Crio agentes de IA e bots de WhatsApp que atendem clientes, anotam pedidos e passam para uma pessoa o que for preciso.",
        "Também gosto de hardware: monto PCs sob medida, imprimo peças em 3D e tenho meu próprio servidor em casa, com a rede separada em VLAN, firewall e backups.",
        "A Vetusmoon é a minha loja: componentes de PC, acessórios de automação residencial e impressões 3D.",
        "O que eu mais gosto é pegar um problema enrolado e deixá-lo funcionando sozinho.",
        "Hoje estudo para me certificar em redes e segurança. Minha meta é continuar crescendo com a Vetusmoon e a Linkmaster, e trabalhar com gente que queira fazer as coisas direito.",
        "Vamos conversar?  rodriguez.sebastian.gar@gmail.com",
      ],
    },
  },
  zh: {
    sub: "来自乡间的软件", mover: "移动", tecla: "空格", agarrarSoltar: "抓取 / 放下", abrirProyecto: "打开项目",
    creditos: "谷仓和奶牛：Quaternius (CC0)", logro: "成就解锁", logroNombre: "黄金头骨", logroSub: "正在打开我的 WhatsApp…",
    agarrar: "抓取", soltar: "放下", cosas: { calabaza: "南瓜", rana: "青蛙", craneo: "头骨" },
    darTroll: c => `空格 ➜ 把${c}交给巨魔`, tirarPozo: "空格 ➜ 扔进井里", soltarP: "空格 ➜ 放下",
    asco: "巨魔：呸！我不喜欢青蛙", nam: "啊呜！", abrir: n => `Enter ➜ 打开 ${n}`,
    vetus: "Enter ➜ 进入 Vetusmoon", link: "Enter ➜ 进入 Linkmaster", copiado: "邮箱已复制：", contacto: "Enter ➜ 联系我：",
    marciano: "👽 你找到了外星人！", cineOn: "鼠标滚轮 ➜ 阅读 · Enter ➜ 关闭", cineBajar: "Enter ➜ 放下银幕",
    oro: "空格 ➜ 抓取黄金头骨", agarrarP: "空格 ➜ 抓取", error: "场景加载失败",
    cartel: ["我的动画", "作品集 2026", "万圣节版"], escapo: "稻草人溜走了！", cazador: "稻草人猎手", cazadorSub: "你试图带走它超过 7 次", sobreMi: "关于我", fin: "完", asunto: "来自作品集的联系",
    proyectos: [["Vetusmoon", "网上商店"], ["商店管理面板", "管理面板"], ["Owners", "网站"], ["互动 3D 作品集", "作品集"],
      ["Longbox", "网页应用"], ["3D 打印目录", "定制系统"], ["企业 WhatsApp 机器人", "机器人"], ["Cubitos Network+", "工具"],
      ["自建服务器与网络", "基础设施"], ["网络经验", "网络"], ["CompTIA Network+", "网络"], ["CompTIA Security+", "安全"]],
    pelicula: {
      bajada: "来自乡间的软件",
      parrafos: [
        "我是一名开发者，住在乌拉圭的乡间。我在这里为企业开发定制软件：网上商店、管理面板以及目录和价格系统。",
        "我开发 AI 智能体和 WhatsApp 机器人，它们接待客户、记录订单，并在需要时转交给真人处理。",
        "我也喜欢硬件：组装定制电脑、3D 打印零件，并在家里运行自己的服务器，网络按 VLAN 划分，配有防火墙和备份。",
        "Vetusmoon 是我的商店：电脑配件、智能家居配件和 3D 打印品。",
        "我最享受的事，是把一个纠缠不清的问题理顺，让它自己运转起来。",
        "目前我正在学习，准备考取网络和安全方面的认证。我的目标是和 Vetusmoon、Linkmaster 一起继续成长，并与想把事情做好的人共事。",
        "聊聊吧？  rodriguez.sebastian.gar@gmail.com",
      ],
    },
  },
};
const T = TEXTOS[IDIOMA];
if (T.proyectos) PROYECTOS.forEach((p, i) => { if (T.proyectos[i]) [p.nombre, p.desc] = T.proyectos[i]; });
if (T.pelicula) Object.assign(PELICULA, T.pelicula);
{
  const el = id => document.getElementById(id);
  document.documentElement.lang = IDIOMA;
  el("titulo").querySelector("small").textContent = T.sub;
  el("ayuda").innerHTML = `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ${T.mover} &nbsp;·&nbsp; <kbd>${T.tecla}</kbd> ${T.agarrarSoltar} &nbsp;·&nbsp; <kbd>Enter</kbd> ${T.abrirProyecto}`;
  el("creditos").textContent = T.creditos;
  const [, chico, fuerte, linea] = el("logro").children;
  chico.textContent = T.logro; fuerte.textContent = T.logroNombre; linea.textContent = T.logroSub;
  for (const [codigo, nombre] of Object.entries(IDIOMAS)) {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: nombre });
    if (codigo === IDIOMA) b.className = "activo";
    b.addEventListener("pointerdown", e => e.stopPropagation());
    b.addEventListener("click", () => {
      try { localStorage.setItem("idioma", codigo); } catch { /* sin almacenamiento */ }
      const url = new URL(location.href);
      url.searchParams.set("lang", codigo);
      location.href = url;
    });
    el("idiomas").append(b);
  }
}
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
const luzCielo = new THREE.HemisphereLight(0xc4bcff, 0x1a1440, 0.95);
escena.add(luzCielo);
const sol = new THREE.DirectionalLight(0xfff4e0, 1.3);
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
  return Math.abs(lx) < 19.6 + margen && Math.abs(lz) < 20.5 + margen;
};
crearPasto(PASTO, 14000, (x, z) =>
  !enGranero(x, z) &&
  !enSendero(x, z, 3.4) &&                                // camino de entrada
  (!MOSTRAR.pozo || Math.hypot(x - POZO.x, z - POZO.z) > POZO.r + 0.4));
// pastos más altos pegados a las paredes del granero
{
  const N = 2400, altos = new THREE.InstancedMesh(geoBrizna, matBrizna, N);
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let n = 0; n < N;) {
    const lx = (Math.random() * 2 - 1) * 27.5, lz = (Math.random() * 2 - 1) * 28.5;   // en las coordenadas del granero
    const borde = Math.max(Math.abs(lx) - 19.6, Math.abs(lz) - 20.5);                 // qué tan lejos de la pared
    if (borde < 0.3 || Math.random() < borde / 8) continue;                           // más tupido cuanto más cerca
    const x = lx * COS + lz * SEN, z = -lx * SEN + lz * COS;
    if (enSendero(x, z, 3.6)) continue;
    o.position.set(x, 0.03, z);
    o.rotation.set((Math.random() - .5) * .45, Math.random() * 6.28, (Math.random() - .5) * .45);
    o.scale.set(1.5, 2.6 + Math.random() * 2.6 * (1 - borde / 8), 1.5);
    o.updateMatrix();
    altos.setMatrixAt(n, o.matrix);
    altos.setColorAt(n, c.setHSL(0.29 + Math.random() * 0.06, 0.5, 0.11 + Math.random() * 0.1));
    n++;
  }
  escena.add(altos);
}

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
  g.fillStyle = "#4b3520"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {          // piedritas y manchas
    g.fillStyle = ["rgba(30,18,8,.4)", "rgba(110,84,54,.3)", "rgba(60,42,24,.5)"][i % 3];
    g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 2 + Math.random() * 3);
  }
  g.fillStyle = "rgba(28,18,8,.5)";       // huellas de ruedas
  g.fillRect(0, 70, 256, 22); g.fillRect(0, 164, 256, 22);
  g.fillStyle = "#234a22";                 // bordes con pasto
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
  const tierra = new THREE.MeshLambertMaterial({ color: 0x4b3520 });
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
  const tierra = new THREE.MeshLambertMaterial({ color: 0x4b3520 });
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

function polvoTexLaguna() {                             // una mancha redonda y difusa
  const [cv, g] = lienzo(64, 64), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
// ---------- Río, puente de piedra y un troll debajo ----------
const texAgua = (() => {
  const [cv, g] = lienzo(256, 128);
  g.fillStyle = "#123a7a"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "rgba(140,190,255,.45)"; g.lineWidth = 3; g.lineCap = "round";
  for (let i = 0; i < 22; i++) {                       // olitas
    const x = Math.random() * 256, y = 8 + Math.random() * 112, l = 14 + Math.random() * 26;
    for (const dx of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + l / 2, y - 5, x + dx + l, y); g.stroke(); }
  }
  const t = textura(cv);
  t.wrapS = THREE.RepeatWrapping;
  return t;
})();
{
  // el cauce: una cinta que sigue los puntos, con el ancho de cada uno
  const cinta = (extra, y, material) => {
    const pos = [], uv = [], indices = [];
    let largo = 0;
    CAUCE.forEach(({ x, z, ancho }, i) => {
      const a = CAUCE[Math.max(i - 1, 0)], b = CAUCE[Math.min(i + 1, CAUCE.length - 1)];
      const n = Math.hypot(b.x - a.x, b.z - a.z), nx = -(b.z - a.z) / n, nz = (b.x - a.x) / n, medio = (ancho + extra) / 2;
      if (i) largo += Math.hypot(x - CAUCE[i - 1].x, z - CAUCE[i - 1].z);
      pos.push(x + nx * medio, y, z + nz * medio, x - nx * medio, y, z - nz * medio);
      uv.push(largo / 36, 0, largo / 36, 1);
      if (i) indices.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i, 2 * i - 1, 2 * i + 1);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    material.side = THREE.DoubleSide;
    const m = new THREE.Mesh(geo, material);
    m.frustumCulled = false;
    m.renderOrder = -1;
    escena.add(m);
  };
  cinta(4.5, 0.06, new THREE.MeshBasicMaterial({ color: 0x241b12 }));                    // lecho y orillas de barro
  cinta(0, 0.09, new THREE.MeshBasicMaterial({ map: texAgua }));

  // laguna de orilla irregular donde nace el río
  const L0 = RIO.laguna;
  const borde = a => 1 + 0.13 * Math.sin(2 * a + 1) + 0.08 * Math.sin(3 * a + 4) + 0.05 * Math.sin(5 * a);
  const charco = (r, y, material) => {
    const forma = new THREE.Shape();
    for (let i = 0; i <= 60; i++) {
      const a = i / 60 * Math.PI * 2, x = Math.cos(a) * r * borde(a), z = Math.sin(a) * r * borde(a);
      i ? forma.lineTo(x, -z) : forma.moveTo(x, -z);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(L0.x, y, L0.z);
    m.renderOrder = -1;
    escena.add(m);
  };
  charco(L0.r + 2.2, 0.07, new THREE.MeshBasicMaterial({ color: 0x241b12 }));
  charco(L0.r, 0.1, new THREE.MeshBasicMaterial({ color: 0x2c8048 }));                    // verde flúo, tipo radiactivo, pero suave
  const resplandorLaguna = new THREE.Mesh(new THREE.PlaneGeometry(L0.r * 3.4, L0.r * 3.4), new THREE.MeshBasicMaterial({
    map: polvoTexLaguna(), color: 0x6dff7a, opacity: 0.14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  resplandorLaguna.rotation.x = -Math.PI / 2;
  resplandorLaguna.position.set(L0.x, 0.3, L0.z);
  escena.add(resplandorLaguna);
  const hoja = (r, color, y, dx = 0, dz = 0, desde = 0.35) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28, desde, Math.PI * 2 - 0.7), new THREE.MeshBasicMaterial({ color }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(L0.x + dx, y, L0.z + dz);
    escena.add(m);
  };
  hoja(4.4, 0x1b4d24, 0.14);                                                             // hoja de loto del medio
  hoja(3.6, 0x27682f, 0.16);
  for (const [dx, dz, r] of [[-22, 13, 2.8], [19, -20, 2.2], [25, 16, 1.9], [-18, -24, 1.7], [6, 28, 2.1], [-30, -6, 1.6], [30, -4, 1.8]]) hoja(r, 0x1b4d24, 0.14, dx, dz, 1);
  // juncos y piedras en la orilla
  const junco = new THREE.ConeGeometry(0.22, 1, 4).translate(0, 0.5, 0);
  const matJunco = new THREE.MeshLambertMaterial({ color: 0x2c5a2a }), matRoca = new THREE.MeshLambertMaterial({ color: 0x5b5d6c, flatShading: true });
  for (let i = 0; i < 100; i++) {
    const a = Math.floor(Math.random() * 9) * 0.7 + Math.random() * 0.35, r = L0.r * borde(a) * (0.94 + Math.random() * 0.12);
    const m = new THREE.Mesh(junco, matJunco);
    m.position.set(L0.x + Math.cos(a) * r, 0, L0.z + Math.sin(a) * r);
    m.scale.set(1, 2.5 + Math.random() * 3, 1);
    m.rotation.z = (Math.random() - 0.5) * 0.3;
    escena.add(m);
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.4, r = L0.r * borde(a) * 1.04;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + Math.random() * 1.1), matRoca);
    m.position.set(L0.x + Math.cos(a) * r, 0.3, L0.z + Math.sin(a) * r);
    m.scale.y = 0.6;
    m.castShadow = true;
    escena.add(m);
  }

  // puente: la silueta de costado (lomo arriba, arco abajo) estirada a lo ancho del camino
  const { largo: L, alto: H, ancho: A } = PUENTE, forma = new THREE.Shape();
  forma.moveTo(-L / 2, 0);
  for (let u = -L / 2; u <= L / 2; u += 2) forma.lineTo(u, H * (1 - (u / (L / 2)) ** 2));
  forma.lineTo(RIO.ancho / 2 - 1, 0);
  for (let a = 0; a <= Math.PI + 0.01; a += Math.PI / 14) forma.lineTo(Math.cos(a) * (RIO.ancho / 2 - 1), Math.sin(a) * 6.5);
  const piedra = new THREE.MeshLambertMaterial({ color: 0x6f7286, flatShading: true });
  const puente = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: A, bevelEnabled: false }).translate(0, 0, -A / 2), piedra);
  puente.rotation.y = -Math.PI / 2 + RIO.giro;           // cruza el río de frente
  puente.position.set(PUENTE_X, 0, PUENTE_Z);
  puente.castShadow = puente.receiveShadow = true;
  escena.add(puente);
  // barandas de piedra, siguiendo el lomo
  const geoPoste = new THREE.BoxGeometry(1, 1.5, 1);
  for (const lado of [-1, 1]) for (let u = -L / 2 + 3; u <= L / 2 - 3; u += 3.4) {
    const poste = new THREE.Mesh(geoPoste, piedra);
    const k = lado * (A / 2 - 0.5);
    poste.position.set(PUENTE_X + RIO_N.x * u + RIO_D.x * k, H * (1 - (u / (L / 2)) ** 2) + 0.75, PUENTE_Z + RIO_N.z * u + RIO_D.z * k);
    poste.rotation.y = RIO.giro;
    poste.castShadow = true;
    escena.add(poste);
  }
}
// troll: agachado en cuclillas bajo el arco; solo asoma la cabeza, y un poco más cuando pasás cerca
const troll = (() => {
  const piel = new THREE.MeshLambertMaterial({ color: 0x4f6b3e, flatShading: true });
  const oscuro = new THREE.MeshLambertMaterial({ color: 0x2b2015, flatShading: true });
  const hueso = new THREE.MeshLambertMaterial({ color: 0xe9e4d0 });
  const ojo = new THREE.MeshBasicMaterial({ color: 0xffd60a, fog: false });
  const pieza = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const g = new THREE.Group();                            // mira hacia +z; el cuerpo queda atrás, bajo el puente
  g.add(pieza(4.8, 3, 4, piel, 0, 1.5, -3.2),             // cuerpo encogido
        pieza(3, 2.5, 2.7, piel, 0, 3, 0.3),              // cabeza
        pieza(0.9, 1.2, 1.2, piel, 0, 2.7, 2),            // narizota
        pieza(1.9, 0.3, 0.3, oscuro, 0, 2.05, 1.7));      // boca
  for (const lado of [-1, 1]) {
    g.add(pieza(0.6, 0.5, 0.2, ojo, lado * 0.85, 3.5, 1.7),
          pieza(0.5, 1.3, 0.3, piel, lado * 1.9, 3.6, 0.2),          // orejas
          pieza(0.3, 0.7, 0.3, hueso, lado * 0.7, 2.4, 1.75),        // colmillos
          pieza(1.3, 1.1, 1.5, piel, lado * 2.3, 0.6, 1),            // manos apoyadas adelante
          pieza(1.5, 2.8, 1.7, piel, lado * 2.9, 1.4, -1.5),         // rodillas dobladas a los costados
          pieza(1.6, 0.6, 2.4, piel, lado * 2.9, 0.3, -0.2));        // pies
  }
  // garrote: lo agarra con la mano y lo apoya en el hombro
  const garrote = new THREE.Group();
  garrote.add(pieza(0.8, 5.4, 0.8, oscuro, 0, 2.7, 0), pieza(1.5, 2, 1.5, oscuro, 0, 4.9, 0));
  garrote.position.set(2.2, 2.3, 1.1);
  garrote.rotation.x = -0.95;
  g.add(garrote,
        pieza(1.3, 1.2, 1.3, piel, 2.2, 2.5, 1),          // la mano que lo sostiene
        pieza(1.2, 1.3, 2.4, piel, 2.5, 2.9, -0.4));      // el brazo, doblado hacia el hombro
  g.traverse(p => { if (p.isMesh) p.castShadow = true; });
  escena.add(g);
  return { g, estado: "espera", carga: null, destino: null, casa: null, fuera: 0, mastica: 0, asco: 0, frente: Math.atan2(-RIO_D.x, -RIO_D.z) };     // de cara a la boca del arco que da a la laguna
})();
// ranita sobre la hoja de loto: te mira, cada tanto salta, y lleva a la web de Linkmaster
const rana = (() => {
  const verde = new THREE.MeshLambertMaterial({ color: 0x2c5527, flatShading: true });
  const claro = new THREE.MeshBasicMaterial({ color: 0xd8d27a }), negro = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const bola = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const g = new THREE.Group();
  g.add(bola(1.3, verde, 0, 0.75, -0.1, 1.15, 0.55, 1.55),             // cuerpo chato y alargado
        bola(0.9, verde, 0, 0.95, 1.3, 1.1, 0.6, 1));                  // cabeza
  for (const lado of [-1, 1]) {
    g.add(bola(0.36, verde, lado * 0.6, 1.5, 1.35),                     // ojos
          bola(0.2, claro, lado * 0.66, 1.55, 1.62),
          bola(0.1, negro, lado * 0.68, 1.56, 1.8),
          bola(0.6, verde, lado * 1.45, 0.4, -0.9, 0.9, 0.55, 1.7),     // patas de atrás, plegadas
          bola(0.3, verde, lado * 1.05, 0.25, 1.5, 1, 0.5, 1.4));       // patas de adelante
  }
  g.traverse(p => { if (p.isMesh) p.castShadow = true; });
  g.scale.setScalar(0.8);
  g.position.set(RIO.laguna.x, 0.18, RIO.laguna.z);
  escena.add(g);
  return g;
})();
const trolleable = T.cosas;
const cercaDelTroll = () => trolleable[enMano?.tipo] && troll.estado === "espera" && Math.hypot(ovni.x - troll.g.position.x, ovni.z - troll.g.position.z) < 16;
const LINKMASTER = { url: "https://linkmaster-ten.vercel.app/" };
const sobreLaguna = () => !enMano && Math.hypot(ovni.x - RIO.laguna.x, ovni.z - RIO.laguna.z) < RIO.laguna.r + 10;
// Si le das un cráneo, el troll sale de abajo del puente, lo deja en algún claro del maizal y vuelve
function mandarTroll(craneo) {
  let destino = { x: MARCA.x, z: MARCA.z };
  for (let i = 0; i < 600; i++) {
    const z = -58 + Math.random() * 100, x = -215 + Math.random() * (xDelCamino(z) - 20 + 215);
    if ((enLetra(x, z) || enCirculos(x, z)) && Math.hypot(x - MARCIANO.x, z - MARCIANO.z) > 9) { destino = { x, z }; break; }
  }
  craneo.estado = "conTroll";
  Object.assign(troll, { estado: "lleva", carga: craneo, destino, casa: { x: troll.g.position.x, z: troll.g.position.z } });
}
function caminarTroll(dt, t) {
  const g = troll.g, meta = troll.estado === "lleva" ? troll.destino : troll.casa;
  const dx = meta.x - g.position.x, dz = meta.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < 1.5) {
    if (troll.estado === "lleva") {                      // lo apoya en el piso y emprende la vuelta
      const c = troll.carga;
      c.obj.position.set(meta.x, 0, meta.z);
      c.obj.rotation.set(0, Math.random() * 6.28, 0);
      c.casa.copy(c.obj.position);
      c.estado = "libre";
      troll.carga = null;
      troll.estado = "vuelve";
    } else troll.estado = "espera";
    return;
  }
  const paso = Math.min(d, 17 * dt);
  g.position.x += dx / d * paso;
  g.position.z += dz / d * paso;
  g.position.y = 0.12 + Math.abs(Math.sin(t * 9)) * 0.5;  // camina a los saltitos, siempre agachado
  let giro = Math.atan2(dx, dz) - g.rotation.y;
  giro = Math.atan2(Math.sin(giro), Math.cos(giro));
  g.rotation.y += giro * acercar(dt, 6);
  if (troll.carga) troll.carga.obj.position.set(g.position.x, g.position.y + 4.6, g.position.z);   // lleva el cráneo en alto
}
function moverRio(dt, t) {
  troll.asco = Math.max(0, troll.asco - dt);
  if (ranaAgarrable.estado === "libre") {                // en su hoja: salta cada tanto y te mira
    const salto = Math.max(0, Math.sin(t * 2.2)) ** 6;
    rana.position.y = 0.18 + salto * 1.2;
    let giroRana = Math.atan2(ovni.x - rana.position.x, ovni.z - rana.position.z) - rana.rotation.y;
    giroRana = Math.atan2(Math.sin(giroRana), Math.cos(giroRana));
    rana.rotation.y += giroRana * acercar(dt, 3);
  }

  texAgua.offset.x -= dt * 0.12;                          // el agua corre
  if (troll.estado !== "espera") { caminarTroll(dt, t); return; }
  const cerca = Math.hypot(ovni.x - PUENTE_X, ovni.z - PUENTE_Z) < 55;
  troll.fuera += ((cerca ? 1 : 0) - troll.fuera) * acercar(dt, 1.6);
  const g = troll.g, asoma = PUENTE.ancho / 2 + 0.6 + troll.fuera * 2.2;   // cuánto sale la cabeza por la boca del arco
  troll.mastica = Math.max(0, troll.mastica - dt);
  const mordisco = troll.mastica > 0 ? Math.abs(Math.sin(t * 16)) * 0.5 : 0;   // mastica la calabaza
  g.position.set(PUENTE_X - RIO_D.x * asoma, 0.12 + Math.sin(t * 2) * 0.08 + mordisco, PUENTE_Z - RIO_D.z * asoma);   // parado sobre el agua baja, no hundido
  // gira la cabeza un poco hacia la nave, sin salir de abajo del puente
  let giro = Math.atan2(ovni.x - g.position.x, ovni.z - g.position.z) - troll.frente;
  giro = limitar(Math.atan2(Math.sin(giro), Math.cos(giro)), -0.7, 0.7);
  g.rotation.y += (troll.frente + giro * troll.fuera - g.rotation.y) * acercar(dt, 3);
}

// ---------- Cerco de madera a los dos costados del camino ----------
{
  const madera = new THREE.MeshLambertMaterial({ color: 0x7a5230, flatShading: true });
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
      const esPuente = puntos[i - 1].y > RIO.z && puntos[i].y < RIO.z;   // ahí no hay cerco
      if (!esEntrada && !esPuente) tramo(borde[i - 1].x, borde[i - 1].y, borde[i].x, borde[i].y);
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
const BANDA = { x0: -236, x1: -140, z: 49, ancho: 3.6 };   // pasillo aplastado que une todas las marcas en horizontal
{
  const c = { x: BANDA.x1, z: BANDA.z };              // círculo con anillo y satélites
  CIRCULOS.push([c.x, c.z, 0, 6], [c.x, c.z, 10.5, 15]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) CIRCULOS.push([c.x + sx * 15, c.z + sz * 15, 0, 3.6]);
  let x = BANDA.x0;                                   // hilera de círculos que crece y se achica
  [2.6, 4.2, 6.5, 4.2, 2.6].forEach((r, i) => {
    x += r;
    CIRCULOS.push([x, BANDA.z, 0, r]);
    if (i === 2) CIRCULOS.push([x, BANDA.z, 9.8, 12.3]);   // anillo alrededor del círculo del medio
    x += r + 2;
  });
}
const enCirculos = (x, z) => (x > BANDA.x0 && x < BANDA.x1 && Math.abs(z - BANDA.z) < BANDA.ancho / 2) ||
  CIRCULOS.some(([cx, cz, r0, r1]) => {
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
    // dónde cae el punto de la "i": se dibuja la letra sola aparte y se busca la mancha de arriba (el punto),
    // así no se mezcla con las letras vecinas
    const T = Math.ceil(tam * 2), ox = Math.round(tam * 0.6), oy = Math.round(tam * 1.5);
    const [sola] = lienzo(T, T), gs = sola.getContext("2d", { willReadFrequently: true });
    gs.font = g.font;
    gs.fillText("i", ox, oy);
    const px = gs.getImageData(0, 0, T, T).data, fila = y => { for (let x = 0; x < T; x++) if (px[(y * T + x) * 4 + 3] > 100) return true; return false; };
    let arriba = 0;
    while (arriba < T && !fila(arriba)) arriba++;
    let abajo = arriba;
    while (abajo < T && fila(abajo)) abajo++;            // hasta el hueco entre el punto y el palito
    let sx = 0, sy = 0, cuenta = 0;
    for (let y = arriba; y < abajo; y++) for (let x = 0; x < T; x++)
      if (px[(y * T + x) * 4 + 3] > 100) { sx += x; sy += y; cuenta++; }
    const xi = x0 + g.measureText(linea.slice(0, k)).width;
    punto = cuenta ? { x: xi + sx / cuenta - ox, y: base + sy / cuenta - oy } : { x: xi + g.measureText("i").width / 2, y: base - tam * 0.75 };
    // el punto pasa a ser un círculo más grande, donde vive el marciano
    g.fillStyle = "#39ff14";                            // verde flúo
    g.beginPath(); g.arc(punto.x, punto.y, 3.4 * PX, 0, 6.3); g.fill();
    g.fillStyle = "#ff8a1f";
  });
  if (punto) {
    const lx = (punto.x / cv.width - 0.5) * MARCA.ancho, lz = (punto.y / cv.height - 0.5) * MARCA.fondo;
    MARCIANO.x = MARCA.x + lx * MARCA_C - lz * MARCA_S;
    MARCIANO.z = MARCA.z + lx * MARCA_S + lz * MARCA_C;
  }
  mascara = { cv, datos: g.getImageData(0, 0, cv.width, cv.height).data };
}
function enLetra(x, z) {
  const dx = x - MARCA.x, dz = z - MARCA.z;              // se deshace la inclinación antes de mirar la máscara
  const u = (dx * MARCA_C + dz * MARCA_S) / MARCA.ancho + 0.5, v = (-dx * MARCA_S + dz * MARCA_C) / MARCA.fondo + 0.5;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;
  const { cv, datos } = mascara;
  return datos[(Math.floor(v * cv.height) * cv.width + Math.floor(u * cv.width)) * 4 + 3] > 100;
}
// con un margen alrededor de cada letra, así el maíz no la tapa
const enMarca = (x, z) => enLetra(x, z) || enLetra(x - 1.2, z) || enLetra(x + 1.2, z) || enLetra(x, z - 1.2) || enLetra(x, z + 1.6);

// Calaveras de vaca escondidas en el maizal: se agarran y se tiran al pozo como las calabazas
const craneos = [];
// Una calavera de vaca, con cuernos
let geoCraneos = null;
function armarCraneo(hueso, hueco) {
  geoCraneos ??= {
    craneo: new THREE.SphereGeometry(1.9, 10, 8).scale(1.15, 0.95, 1).translate(0, 3.2, 0),
    hocico: new THREE.CylinderGeometry(0.75, 1.35, 3.6, 6).rotateX(Math.PI / 2 + 0.35).translate(0, 2.2, 2.3),   // largo, hacia adelante y abajo
    cuenca: new THREE.SphereGeometry(0.62, 10, 8).scale(0.5, 1, 1),
    fosa: new THREE.SphereGeometry(0.22, 8, 6).scale(1, 1, 0.5),
    base: new THREE.CylinderGeometry(0.36, 0.46, 1.7, 7).rotateZ(Math.PI / 2),      // arranque del cuerno, hacia el costado
    punta: new THREE.ConeGeometry(0.36, 2.3, 7),                                    // y la punta, hacia arriba
    diente: new THREE.BoxGeometry(0.26, 0.4, 0.2),
  };
  const c = new THREE.Group(), en = (geo, mat, x, y, z, giroZ = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = giroZ;
    c.add(m);
  };
  en(geoCraneos.craneo, hueso, 0, 0, 0);
  en(geoCraneos.hocico, hueso, 0, 0, 0);
  for (const lado of [-1, 1]) {
    en(geoCraneos.cuenca, hueco, lado * 1.75, 3.15, 0.95);                          // cuencas a los costados
    en(geoCraneos.fosa, hueco, lado * 0.3, 1.9, 3.72);                              // fosas de la nariz
    en(geoCraneos.base, hueso, lado * 2.6, 3.9, -0.2);
    en(geoCraneos.punta, hueso, lado * 3.55, 4.95, -0.2, -lado * 0.3);
  }
  for (let d = -2; d <= 2; d++) en(geoCraneos.diente, d % 2 ? hueco : hueso, d * 0.3, 0.72, 3.6);
  return c;
}
function crearCraneos() {
  const hueso = new THREE.MeshLambertMaterial({ color: 0xe9e4d0, flatShading: true });
  const hueco = new THREE.MeshBasicMaterial({ color: 0x0b0814 });
  const libre = (x, z) => {                              // ni sobre las letras ni sobre las marcas
    for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]])
      if (enMarca(x + dx, z + dz) || enCirculos(x + dx, z + dz)) return false;
    return Math.hypot(x - MARCIANO.x, z - MARCIANO.z) > 12;
  };
  for (let i = 0; craneos.length < 4 && i < 6000; i++) {
    const z = -68 + Math.random() * 124, x = -206 + Math.random() * (xDelCamino(z) - 18 + 206);
    if (!libre(x, z) || craneos.some(c => Math.hypot(x - c.x, z - c.z) < 55)) continue;
    const interior = armarCraneo(hueso, hueco);
    interior.rotation.set(-0.25, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.3);   // mirando hacia arriba, a la cámara
    interior.scale.setScalar(0.5);
    interior.traverse(p => { if (p.isMesh) p.castShadow = true; });
    const g = new THREE.Group();
    g.add(interior);
    g.position.set(x, 0, z);
    escena.add(g);
    agarrable(g, "craneo");
    craneos.push({ x, z });
  }
}
function crearMaizal() {
  escribirNombre();
  marciano.obj.position.set(MARCIANO.x, 0, MARCIANO.z);
  marciano.casa.copy(marciano.obj.position);
  crearCraneos();

  // tierra debajo del maíz
  const ancho = CRUCE_X - 20 - MAIZ.x0, cx = (MAIZ.x0 + CRUCE_X - 20) / 2;
  const tramos = [[MAIZ.z0, MAIZ.z1]];
  for (const [za, zb] of tramos) plano(ancho, zb - za + 4, 0x3a2a1c, cx, (za + zb) / 2, 0.03);

  // el nombre, en naranja, sobre la tierra
  const letras = new THREE.Mesh(
    new THREE.PlaneGeometry(MARCA.ancho, MARCA.fondo),
    new THREE.MeshBasicMaterial({ map: textura(mascara.cv), transparent: true, depthWrite: false }));
  letras.rotation.x = -Math.PI / 2;
  letras.rotation.z = -MARCA.giro;
  letras.position.set(MARCA.x, 0.06, MARCA.z);
  escena.add(letras);

  // marcas de marcianos: maíz aplastado
  const paja = new THREE.MeshLambertMaterial({ color: 0xcdb85c });
  plano(BANDA.x1 - BANDA.x0, BANDA.ancho, 0xcdb85c, (BANDA.x0 + BANDA.x1) / 2, BANDA.z, 0.06);
  for (const [x, z, r0, r1] of CIRCULOS) {
    const m = new THREE.Mesh(r0 ? new THREE.RingGeometry(r0, r1, 56) : new THREE.CircleGeometry(r1, 36), paja);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    escena.add(m);
  }

  // dibujo de la planta
  const [cv, g] = lienzo(128, 256);
  g.lineCap = "round";
  g.strokeStyle = "#8a8f34"; g.lineWidth = 9;
  g.beginPath(); g.moveTo(64, 256); g.lineTo(64, 40); g.stroke();
  const hoja = (y, lado, largo) => {
    g.fillStyle = y % 2 ? "#a3a83a" : "#c2b94a";       // hojas amarillentas, de maíz maduro
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
  const mat = new THREE.MeshBasicMaterial({ map: textura(cv), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x8a8aa6 });

  const o = new THREE.Object3D(), c = new THREE.Color(), matrices = [], colores = [];
  const paso = 2.3;
  for (const [za, zb] of tramos)
    for (let x = MAIZ.x0; x <= MAIZ.x1; x += paso)
      for (let z = za; z <= zb; z += paso) {
        const px = x + (Math.random() - .5) * 1.1, pz = z + (Math.random() - .5) * 1.1;
        if (enMarca(px, pz) || enCirculos(px, pz) || px > xDelCamino(pz) - RUTA_ANCHO / 2 - 3.5) continue;
        if (craneos.some(c => Math.hypot(px - c.x, pz - c.z) < 3.6)) continue;   // claro alrededor de cada calavera
        if (ESPANTA_LUGARES.some(([ex, ez]) => Math.hypot(px - ex, pz - ez) < 3.2)) continue;   // y donde se para el espantapájaros
        if (pz < -40 && pz > -330 && px > -190 && fueraDelRio(px, pz) < 3) continue;   // el río
        if (Math.hypot(px - RIO.laguna.x, pz - RIO.laguna.z) < RIO.laguna.r * 1.2 + 3) continue;   // la laguna
        // lejos de donde vuela el ovni se planta más ralo: no se nota y es más liviano
        // lejos de donde vuela el ovni se planta más ralo; el borde se desvanece hacia adentro, sin sumar plantas
        const adentro = Math.min(px + 270, pz + 150, 95 - pz);
        if (Math.random() < 0.6 * Math.min(1, Math.max(0, 1 - adentro / 60))) continue;
        o.position.set(px, 0, pz);
        o.rotation.y = Math.random() * 3.14;
        o.scale.setScalar(0.8 + Math.random() * 0.45);
        o.updateMatrix();
        matrices.push(o.matrix.clone());
        colores.push(c.setHSL(0.13 + Math.random() * 0.05, 0.4, 0.75 + Math.random() * 0.25).clone());
      }
  const maizal = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((m, i) => { maizal.setMatrixAt(i, m); maizal.setColorAt(i, colores[i]); });
  maizal.frustumCulled = false;
  escena.add(maizal);
}

// ---------- Pozo de agua ----------
if (MOSTRAR.pozo) {
  const R = POZO.r, pozo = new THREE.Group();
  const piedra = new THREE.MeshLambertMaterial({ color: 0x8b8d99, flatShading: true, side: THREE.DoubleSide });
  const pared = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.25, 1.6, 10, 1, true), piedra);
  pared.position.y = 0.8;
  const brocal = new THREE.Mesh(new THREE.RingGeometry(R - 0.4, R + 0.12, 10), piedra);
  brocal.rotation.x = -Math.PI / 2;
  brocal.position.y = 1.6;
  const agua = new THREE.Mesh(new THREE.CircleGeometry(R - 0.2, 20), new THREE.MeshBasicMaterial({ color: 0x3aa85a }));   // verde brillante, como la laguna
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = 1.05;
  const brilloAgua = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.6, R * 3.6), new THREE.MeshBasicMaterial({
    map: polvoTexLaguna(), color: 0x6dff7a, opacity: 0.45, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilloAgua.rotation.x = -Math.PI / 2;
  brilloAgua.position.y = 1.75;
  pozo.add(pared, brocal, agua);
  pozo.position.set(POZO.x, 0, POZO.z);
  pozo.rotation.y = 0.4;
  pozo.traverse(p => { if (p.isMesh) p.castShadow = true; });
  pozo.add(brilloAgua);                                   // el resplandor no hace sombra
  escena.add(pozo);
}
function caja3(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ---------- Cosas que el ovni puede agarrar ----------
const agarrables = [];
let ranaAgarrable = null;                               // se registra más abajo, cuando ya existe la función
let enMano = null;
const enPozo = { calabazas: 0, craneos: 0 };
function agarrable(obj, tipo, extra = {}) {
  const a = { obj, tipo, estado: "libre", casa: obj.position.clone(), vy: 0, t: 0, ...extra };
  agarrables.push(a);
  return a;
}
ranaAgarrable = agarrable(rana, "rana");

// Calabazas: sueltas, de a pares y de a tres, de distintos tamaños
if (MOSTRAR.calabazas) {
  // cuerpo y cabito en una sola pieza, con el color en los vértices: cada calabaza es un solo dibujo
  const pintar = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colores, 3));
    return geo.toNonIndexed();
  };
  const geo = mergeGeometries([
    pintar(new THREE.SphereGeometry(1.1, 10, 7).scale(1, 0.74, 1).translate(0, 0.8, 0), 0xf07a13),
    pintar(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 5).translate(0, 1.75, 0), 0x3f7d2c),
  ]);
  geo.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const TAMANOS = [1.2, 1.8, 2.5, 3.3];
  // un grupo: una, dos o tres calabazas juntas, cada una de un tamaño distinto
  const grupo = (x, z) => {
    const cuantas = [1, 2, 2, 3, 3][Math.floor(Math.random() * 5)], tam = [...TAMANOS].sort(() => Math.random() - 0.5);
    const giro = Math.random() * 6.28, salida = [[x, z, tam[0]]];
    for (let k = 1; k < cuantas; k++) {
      const a = giro + k * 2.3, d = (tam[0] + tam[k]) * 1.25;
      salida.push([x + Math.cos(a) * d, z + Math.sin(a) * d, tam[k]]);
    }
    return salida;
  };
  const libre = (x, z) => x > xDelCamino(z) + 11 && !(z < -60 && fueraDelRio(x, z) < 7);   // del lado del pasto y fuera del agua

  // --- las que se pueden agarrar: dentro de la zona donde vuela la nave
  const lugares = [], centros = [];
  const zonas = [
    { cuantas: 26, x: [-70, 50], z: [-72, 76], separacion: 24 },             // el campo del granero
    { cuantas: 10, x: [92, 190], z: [-236, 44], separacion: 32 },            // entre los proyectos
    { cuantas: 18, x: [50, 94], z: [-200, 76], separacion: 22 },             // la franja entre el granero y los proyectos
    { cuantas: 6, x: [0, 12], z: [-76, 74], separacion: 26, borde: true },   // unas pocas cerca del camino
    { cuantas: 14, x: [-66, 48], z: [-200, -84], separacion: 24 },           // hacia el fondo
    { cuantas: 22, separacion: 17, rio: true },                              // a las dos orillas del río
  ];
  const tramoRio = CAUCE.filter(c => c.x > xDelCamino(c.z) + 14 && c.x < 70 && c.z > -265);
  for (const zona of zonas) {
    const tope = lugares.length + zona.cuantas;
    for (let i = 0; lugares.length < tope && i < 6000; i++) {
      if (zona.rio) {                                    // un punto del cauce, corrido hacia una de las orillas
        const p = tramoRio[Math.floor(Math.random() * tramoRio.length)];
        const rx = p.x + (Math.random() - 0.5) * 56, rz = p.z + (Math.random() - 0.5) * 56;
        if (fueraDelRio(rx, rz) > 20) continue;
        zona.x = [rx, rx]; zona.z = [rz, rz];
      }
      const z = zona.z[0] + Math.random() * (zona.z[1] - zona.z[0]);
      const x = (zona.borde ? xDelCamino(z) + RUTA_ANCHO / 2 + 5 : 0) + zona.x[0] + Math.random() * (zona.x[1] - zona.x[0]);
      if (ESPANTA_LUGARES.some(([ex, ez]) => Math.hypot(x - ex, z - ez) < 12) || Math.hypot(x - xDelCamino(50) - RUTA_ANCHO / 2 - 6, z - 50) < 8) continue;   // espantapájaros y farola
      if (!libre(x, z) || enGranero(x, z, 6) || enSendero(x, z, 9)) continue;
      if (MOSTRAR.pozo && Math.hypot(x - POZO.x, z - POZO.z) < POZO.r + 9) continue;
      if (PIEDRAS.some(b => Math.abs(x - b.x) < 24 && z > b.z - 9 && z < b.z + 29)) continue;   // cuadro y su texto
      if (Math.hypot(x - ORO.x, z - ORO.z) < 16 || Math.hypot(x - CARTEL.x, z - CARTEL.z) < 16 || Math.hypot(x + 1, z - 72) < 9) continue;
      if (centros.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < zona.separacion)) continue;
      centros.push([x, z]);
      lugares.push(...grupo(x, z).filter(([gx, gz]) => libre(gx, gz)));
    }
  }
  lugares.push([CARTEL.x - 9, CARTEL.z + 4, 2.4], [CARTEL.x + 10.5, CARTEL.z + 3, 1.4],       // esquina de abajo a la izquierda, junto al cartel
               [-3, 71, 2.6], [1.5, 73.5, 1.5]);                                          // y esquina de abajo a la derecha
  for (const [x, z, tam] of lugares) {
    const g = new THREE.Group(), c = new THREE.Mesh(geo, material);
    c.castShadow = true;
    c.scale.setScalar(tam);
    c.rotation.y = Math.random() * 6.28;
    g.add(c);
    g.position.set(x, 0, z);
    escena.add(g);
    agarrable(g, "calabaza");
  }

  // --- las de fondo: más allá de donde llega la nave, y siguiendo el río hasta que las tapa la niebla.
  // Son de adorno, así que van todas en un único dibujo (instancias), sin sombras.
  const lejos = [], centrosLejos = [];
  const afuera = (x, z) => x > LIMITES.x1 + 6 || z < LIMITES.z0 - 6;
  const sumar = (x, z, separacion) => {
    if (!afuera(x, z) || !libre(x, z) || centrosLejos.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < separacion)) return;
    centrosLejos.push([x, z]);
    lejos.push(...grupo(x, z).filter(([gx, gz]) => libre(gx, gz)));
  };
  const rioLejos = CAUCE.filter(c => c.x < 470);
  for (let i = 0; i < 2500 && lejos.length < 170; i++) {            // a las orillas del río, hasta el horizonte
    const p = rioLejos[Math.floor(Math.random() * rioLejos.length)];
    const x = p.x + (Math.random() - 0.5) * 60, z = p.z + (Math.random() - 0.5) * 60;
    if (fueraDelRio(x, z) < 22) sumar(x, z, 18);
  }
  for (let i = 0; i < 2500 && lejos.length < 300; i++)              // y sueltas por el campo de más allá
    sumar(-60 + Math.random() * 460, -470 + Math.random() * 560, 30);
  const fondo = new THREE.InstancedMesh(geo, material, lejos.length);
  const o = new THREE.Object3D();
  lejos.forEach(([x, z, tam], i) => {
    o.position.set(x, 0, z);
    o.rotation.y = Math.random() * 6.28;
    o.scale.setScalar(tam);
    o.updateMatrix();
    fondo.setMatrixAt(i, o.matrix);
  });
  fondo.frustumCulled = false;
  escena.add(fondo);
  window.calabazasFondo = lejos.length;
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
    m.rotation.order = "YXZ";
    m.rotation.set(-0.14, i % 2 ? -0.32 : 0.32, 0);   // recostados y girados hacia el pasillo
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
  grad.addColorStop(0, "#070419");
  grad.addColorStop(0.2, "#1c1452");
  grad.addColorStop(1, "#1c1452");
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
  const [cv, g] = lienzo(1024, 380);
  g.fillStyle = TABLA; g.fillRect(0, 0, 1024, 380);
  g.strokeStyle = LUNA; g.lineWidth = 14; g.strokeRect(16, 16, 992, 348);
  // luna creciente grande, en el mismo renglón que las letras
  g.fillStyle = LUNA;  g.beginPath(); g.arc(170, 190, 132, 0, 6.3); g.fill();
  g.fillStyle = TABLA; g.beginPath(); g.arc(236, 152, 118, 0, 6.3); g.fill();
  // las letras salen de adentro de la luna: arrancan en el hueco de la medialuna
  g.fillStyle = LUNA; g.textAlign = "left"; g.textBaseline = "middle";
  let tam = 300;
  do { g.font = `${tam}px Bangers, Impact, "Arial Black", sans-serif`; tam -= 4; } while (g.measureText("VETUSMOON.COM").width > 770 && tam > 60);
  g.fillText("VETUSMOON.COM", 200, 205);

  const cartel = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 2.78), new THREE.MeshBasicMaterial({ map: textura(cv) }));
  const alLargo = new THREE.Vector3(0, 0, 1), cuestaArriba = new THREE.Vector3(0.7886, 0.6149, 0);
  const haciaAfuera = new THREE.Vector3().crossVectors(alLargo, cuestaArriba);
  cartel.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(alLargo, cuestaArriba, haciaAfuera));
  cartel.position.set(-1.93, 4.505, 0.03).addScaledVector(haciaAfuera, 0.27);
  granero.add(cartel);

  // puertas: cada hoja cuelga de una bisagra en su borde de afuera, y atrás queda el interior a oscuras
  const interior = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), new THREE.MeshBasicMaterial({ color: 0x07050f }));
  interior.position.set(-0.04, 1.26, 3.87);
  granero.add(interior);
  for (const [prefijo, x, signo] of [["Barn_Door_", 1.84, 1], ["Barn_Door2", -1.93, -1]]) {
    let hoja = null;
    granero.traverse(o => { if (!hoja && o.name.startsWith(prefijo)) hoja = o; });
    if (!hoja) continue;
    const bisagra = new THREE.Group();
    bisagra.position.set(x, 0, 3.9);
    hoja.parent.add(bisagra);
    bisagra.add(hoja);
    hoja.position.sub(bisagra.position);
    puertas.push({ bisagra, signo });
  }
}
// las puertas se abren cuando la nave se acerca al granero
const puertas = [];
let puertasAbiertas = 0;
function moverPuertas(dt) {
  const cerca = Math.hypot(ovni.x - PUERTA.x, ovni.z - PUERTA.z) < 42;
  puertasAbiertas += ((cerca ? 1 : 0) - puertasAbiertas) * acercar(dt, 2.5);
  for (const p of puertas) p.bisagra.rotation.y = p.signo * 1.9 * puertasAbiertas;
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

// ---------- Farolas: columna de madera con un brazo de hierro en arco y la luz en la punta ----------
function crearFarola(X, Z, giro = 0) {
  const ALTO = 8.5, R = 2.8;
  const madera = new THREE.MeshLambertMaterial({ color: 0x7a5230, flatShading: true });
  const hierro = new THREE.MeshPhongMaterial({ color: 0x2a2a31, specular: 0x555555, shininess: 30 });
  const f = new THREE.Group();
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, ALTO, 7), madera);
  poste.position.y = ALTO / 2;
  poste.castShadow = true;
  const abrazadera = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 10), hierro);   // donde el hierro agarra la madera
  abrazadera.position.y = ALTO - 0.2;
  const brazo = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 8, 22, Math.PI), hierro);      // medio arco: sube, cruza y baja
  brazo.position.set(-R, ALTO, 0);
  brazo.castShadow = true;
  const pantalla = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 10), hierro);
  pantalla.position.set(-2 * R, ALTO - 0.45, 0);
  const bombita = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }));
  bombita.position.set(-2 * R, ALTO - 1.05, 0);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xffd98a, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(8, 8, 1);
  halo.position.copy(bombita.position);
  // el charco de luz en el piso es pintado, no una luz de verdad: así no le cuesta nada a la placa
  const charco = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshBasicMaterial({
    map: polvoTex, color: 0xffc960, opacity: 0.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  charco.rotation.x = -Math.PI / 2;
  charco.position.set(-2 * R, 0.2, 0);
  f.add(poste, abrazadera, brazo, pantalla, bombita, halo, charco);
  f.position.set(X, 0, Z);
  f.rotation.y = giro;                                   // el brazo apunta hacia -x; con media vuelta, hacia +x
  escena.add(f);
}
crearFarola(xDelCamino(50) + RUTA_ANCHO / 2 + 6, 50);                 // del lado del granero, pasando el cerco
crearFarola(xDelCamino(PUENTE_Z + 30) - RUTA_ANCHO / 2 - 3, PUENTE_Z + 30, Math.PI);   // antes del puente, del lado del maizal, con la luz sobre el camino

// ---------- Cráneo de oro: el premio al final de los proyectos. Agarrarlo da un logro y lleva al WhatsApp ----------
const WHATSAPP = "https://wa.me/59895821202";
const craneoOro = (() => {
  const oro = new THREE.MeshPhongMaterial({ color: 0xffc93c, emissive: 0x7a5200, specular: 0xffffff, shininess: 90, flatShading: true });
  const hueco = new THREE.MeshBasicMaterial({ color: 0x2a1a00 });
  const g = new THREE.Group();
  const craneo = armarCraneo(oro, hueco);
  craneo.scale.setScalar(0.8);
  craneo.position.y = -2.4;                              // gira sobre su centro
  craneo.traverse(p => { if (p.isMesh) p.castShadow = true; });
  const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xffd23c, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  brillo.scale.set(14, 14, 1);
  // rayitas alrededor, como en un cartel de premio
  const [cv, gr] = lienzo(256, 256);
  gr.strokeStyle = "#ffe07a"; gr.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r0 = i % 2 ? 78 : 66, r1 = i % 2 ? 104 : 124;
    gr.lineWidth = i % 2 ? 5 : 8;
    gr.beginPath(); gr.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); gr.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); gr.stroke();
  }
  const rayitas = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura(cv), blending: THREE.AdditiveBlending, depthWrite: false }));
  rayitas.scale.set(17, 17, 1);
  g.add(rayitas, brillo, craneo);
  g.position.set(ORO.x, 4, ORO.z);
  g.visible = false;                                     // aparece recién cuando llegás al final de los proyectos
  escena.add(g);
  agarrable(g, "craneoOro");
  return { g, craneo, brillo, rayitas, aparecio: 0 };
})();
function moverCraneoOro(dt, t) {
  const o = craneoOro;
  if (!o.g.visible) {
    const anteultimo = PIEDRAS[Math.max(0, PIEDRAS.length - 2)];   // aparece un poco antes de llegar al final
    if (ovni.z > anteultimo.z + 24 || ovni.x < 85) return;
    o.g.visible = true;                                  // ¡pop!
  }
  o.aparecio = Math.min(1, o.aparecio + dt * 1.8);
  const k = o.aparecio, rebote = 1 + 2.2 * Math.sin(k * Math.PI) * (1 - k);   // se infla de golpe y se acomoda
  o.g.scale.setScalar(k * rebote);
  o.g.position.y = 4 + Math.sin(t * 2) * 0.5;            // flota, por debajo de la nave
  o.craneo.rotation.y += dt * 0.9;
  o.brillo.material.opacity = 0.45 + 0.2 * Math.sin(t * 3);
  o.rayitas.material.rotation = t * 0.6;
  o.rayitas.scale.setScalar(17 * (1 + (1 - k) * 0.9 + 0.06 * Math.sin(t * 5)));   // las rayitas salen disparadas y laten
}
let logroMostrado = false;
// Muestra el cartel de logro con el nombre y la línea de abajo que se le pasen
function cartelLogro(nombre, linea) {
  const cartel = document.getElementById("logro");
  cartel.children[2].textContent = nombre;
  cartel.children[3].textContent = linea;
  cartel.classList.add("ver");
  return cartel;
}
// Logro por insistir: más de 7 intentos de llevarse al espantapájaros
let intentosEspanta = 0;
function intentoEspantapajaros() {
  if (++intentosEspanta !== 8 || logroMostrado) return;
  const cartel = cartelLogro(T.cazador, T.cazadorSub);
  setTimeout(() => { if (!logroMostrado) cartel.classList.remove("ver"); }, 4500);
}
function darLogro() {
  if (logroMostrado) return;
  logroMostrado = true;
  const cartel = cartelLogro(T.logroNombre, T.logroSub);
  // un segundo de logro y enseguida el preloader del principio, para que no parezca que se trabó mientras carga WhatsApp
  let yendo = false;
  const ir = () => {
    if (yendo) return;
    yendo = true;
    listo = false;
    cartel.classList.remove("ver");
    const cargando = document.getElementById("preloader");
    Object.assign(cargando.style, { transition: "opacity .25s", visibility: "visible", opacity: "1" });
    setTimeout(() => { location.href = WHATSAPP; }, 450);
  };
  cartel.addEventListener("click", ir);
  setTimeout(ir, 1000);
}

// ---------- El final: un autocine en un claro al fondo del maizal ----------
// Al acercarte brotan del piso unas letras 3D. Con Enter cae una pantalla gigante, se estacionan dos autos
// a tus costados y se proyecta un texto largo que corre con la rueda del mouse.
const CINE = { x: -188, z: -205, pantallaZ: -248, ancho: 168, alto: 94.5 };
const cine = { letras: new THREE.Group(), pantalla: new THREE.Group(), autos: [], asoma: 0, on: false, y: 270, vy: 0, golpe: false,
               tex: null, altoTexto: 720, scroll: 0, meta: 0, tocado: false };
const finalLetras = { f: 0 };                           // cuánto se acomodó la cámara frente a la pantalla
const enElFinal = () => Math.abs(ovni.x - CINE.x) < 56 && ovni.z < CINE.z + 58;
function crearFinal() {
  // letras 3D paradas en el piso, rectas y con aspecto de plástico: cara brillante y canto liso por detrás
  const [cv, g] = lienzo(1024, 256);
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = '900 188px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  const brillo = g.createLinearGradient(0, 40, 0, 230);
  brillo.addColorStop(0, "#ffffff"); brillo.addColorStop(0.42, "#f1ecda"); brillo.addColorStop(0.5, "#d9d3bd"); brillo.addColorStop(1, "#ece6d2");
  g.fillStyle = brillo;
  let tamSobre = 188;                                    // se achica si en otro idioma queda más largo
  do { g.font = `900 ${tamSobre}px "Arial Black", "Helvetica Neue", Arial, sans-serif`; tamSobre -= 6; } while (g.measureText(T.sobreMi).width > 980 && tamSobre > 60);
  g.fillText(T.sobreMi, 512, 138);
  const tex = textura(cv), geo = new THREE.PlaneGeometry(68, 17).translate(0, 8.5, 0);   // 17 de alto: el doble del poste de luz
  for (let capa = 12; capa >= 0; capa--) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: capa ? 0x9c9784 : 0xffffff, side: THREE.DoubleSide }));
    m.position.set(0, 0, -capa * 0.26);
    m.castShadow = !capa;
    cine.letras.add(m);
  }
  cine.letras.position.set(CINE.x, -20, CINE.z + 26);
  escena.add(cine.letras);

  // lo que se proyecta: un lienzo alto con todo el texto; la pantalla muestra una ventana de 1280 x 720
  const W = 1280, M = 90, renglones = [];
  const [medir, gm] = lienzo(4, 4);
  const cuerpo = '46px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  gm.font = cuerpo;
  for (const parrafo of PELICULA.parrafos) {
    let linea = "";
    const junta = IDIOMA === "zh" ? "" : " ";              // el chino no separa palabras: se corta letra por letra
    for (const palabra of junta ? parrafo.split(" ") : [...parrafo]) {
      if (linea && gm.measureText(linea + junta + palabra).width > W - 2 * M) { renglones.push(linea); linea = palabra; }
      else linea = linea ? linea + junta + palabra : palabra;
    }
    renglones.push(linea, "");
  }
  const H = Math.min(4096, 430 + renglones.length * 64 + 380);
  const [hoja, gh] = lienzo(W, H);
  gh.fillStyle = "#0b0920"; gh.fillRect(0, 0, W, H);
  gh.textBaseline = "top";
  gh.fillStyle = "#ffd60a"; gh.font = '150px Bangers, Impact, "Arial Black", sans-serif';
  gh.fillText(PELICULA.titulo.toUpperCase(), M, 110);
  gh.fillStyle = "#b3abe0"; gh.font = '700 34px "Trebuchet MS", sans-serif';
  gh.fillText(PELICULA.bajada.toUpperCase().split("").join(" "), M, 280);
  gh.fillStyle = "#f4f1de"; gh.font = cuerpo;
  renglones.forEach((r, i) => gh.fillText(r, M, 420 + i * 64));
  gh.fillStyle = "#6f66a8"; gh.font = '700 30px "Trebuchet MS", sans-serif';
  gh.fillText(T.fin, M, H - 190);
  cine.tex = textura(hoja);
  cine.altoTexto = H;
  cine.tex.repeat.set(1, 720 / H);

  // la pantalla: un rectángulo perfecto apoyado en el piso, con un marco negro fino
  const negro = new THREE.MeshLambertMaterial({ color: 0x0b0a10 });
  const { ancho, alto } = CINE;
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(ancho + 3, alto + 3, 1.8), negro);
  tablero.position.y = (alto + 3) / 2;
  const imagen = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: cine.tex, fog: false }));
  imagen.position.set(0, (alto + 3) / 2, 0.95);
  cine.pantalla.add(tablero, imagen);
  cine.pantalla.traverse(p => { if (p.isMesh && p !== imagen) p.castShadow = true; });
  cine.pantalla.position.set(CINE.x, cine.y, CINE.pantallaZ);
  cine.pantalla.visible = false;
  escena.add(cine.pantalla);

  // siete autos oxidados en doble fila: tres adelante, cerca de la pantalla, y cuatro en tu fila (dos a cada lado)
  for (const [dx, dz] of [[-44, -46], [0, -52], [44, -46], [-62, 6], [-30, -2], [30, -2], [62, 6]]) {
    const auto = crearAuto(true);
    auto.obj.scale.setScalar(2.6);
    auto.obj.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.16;   // de frente a la pantalla, no del todo derechos
    auto.obj.traverse(p => { if (p.isMesh) p.castShadow = true; });
    auto.obj.visible = false;
    escena.add(auto.obj);
    cine.autos.push({ ...auto, dx, dz, x: CINE.x, z: CINE.z + 130, lugar: CINE.z });
  }
}
function alternarCine() {
  cine.on = !cine.on;
  if (!cine.on) return;
  Object.assign(cine, { y: 270, vy: 0, golpe: false, scroll: 0, meta: 0, tocado: false });
  for (const a of cine.autos) {
    const lugar = Math.max(ovni.z + a.dz, CINE.pantallaZ + 26);   // sin chocar la pantalla
    Object.assign(a, { x: ovni.x + a.dx, lugar, z: lugar + 110 + Math.random() * 30 });
  }
}
function moverFinal(dt) {
  if (cine.on && !enElFinal()) cine.on = false;          // si te vas, se termina la función
  // letras: suben despacio al acercarte y se guardan cuando baja la pantalla
  const cerca = !cine.on && Math.hypot(ovni.x - CINE.x, ovni.z - (CINE.z + 26)) < 95;
  cine.asoma += ((cerca ? 1 : 0) - cine.asoma) * acercar(dt, 1.1);
  cine.letras.position.y = -20 * (1 - cine.asoma);
  cine.letras.visible = cine.asoma > 0.02;

  // pantalla: cae del cielo y rebota; al cerrar se va para arriba
  if (cine.on) {
    cine.vy -= 150 * dt;
    cine.y += cine.vy * dt;
    if (cine.y <= 0) {
      cine.y = 0;
      if (!cine.golpe) { cine.golpe = true; temblor = 0.7; }
      cine.vy = Math.abs(cine.vy) > 12 ? -cine.vy * 0.28 : 0;
    }
  } else cine.y += (275 - cine.y) * acercar(dt, 1.6);
  cine.pantalla.visible = cine.y < 270;
  cine.pantalla.position.y = cine.y;
  temblor *= Math.pow(0.02, dt);

  // texto: corre solo, despacio, hasta que usás la rueda
  const tope = cine.altoTexto - 720;
  if (cine.on && cine.golpe && !cine.tocado) cine.meta = Math.min(tope, cine.meta + 26 * dt);
  cine.scroll += (cine.meta - cine.scroll) * acercar(dt, 6);
  cine.tex.offset.y = 1 - (720 + cine.scroll) / cine.altoTexto;

  // autos: entran, se estacionan y, al terminar, se van marcha atrás
  for (const a of cine.autos) {
    const meta = cine.on ? a.lugar : a.lugar + 150, antes = a.z;
    a.z += (meta - a.z) * acercar(dt, cine.on ? 1.5 : 0.9);
    a.obj.position.set(a.x, 0, a.z);
    a.obj.visible = a.z < a.lugar + 130;
    a.animar(dt, { vel: (antes - a.z) / Math.max(dt, 0.001) });
  }
  finalLetras.f += ((cine.on ? 1 : 0) - finalLetras.f) * acercar(dt, 1.1);   // la cámara se acomoda despacio, sin saltos
}
addEventListener("wheel", e => {
  if (!cine.on) return;
  cine.tocado = true;
  cine.meta = Math.max(0, Math.min(cine.altoTexto - 720, cine.meta + e.deltaY * 0.9));
}, { passive: true });
const FIN_CAM = new THREE.Vector3(CINE.x, 21, CINE.pantallaZ + 108), FIN_MIRA = new THREE.Vector3(CINE.x, 40, CINE.pantallaZ), miradaCam = new THREE.Vector3();

const espanta = { g: null, lugar: 0, falta: ESPANTA.cada, asoma: 1, burla: 0 };
const cercaDelEspantapajaros = () => !enMano && espanta.asoma > 0.9 && Math.hypot(ovni.x - espanta.g.position.x, ovni.z - espanta.g.position.z) < 9;
// ---------- Espantapájaros: cruz de madera clavada en el piso, camisa roja, paja, cabeza de calabaza y sombrero ----------
{
  const H = ESPANTA.alto, g = new THREE.Group();
  const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const madera = mat(0x7a5230), rojo = mat(0xb3202a), paja = mat(0xd9b84a), naranja = mat(0xf07a13);
  const negro = new THREE.MeshBasicMaterial({ color: 0x1a0d02 });
  const pieza = (geo, material, x, y, z, giroZ = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.rotation.z = giroZ;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  pieza(new THREE.BoxGeometry(0.7, H * 0.9, 0.7), madera, 0, H * 0.45, 0);                    // palo clavado en el piso
  pieza(new THREE.BoxGeometry(H * 1.68, H * 0.07, H * 0.07), madera, 0, H * 0.7, 0);          // travesaño, bien largo
  pieza(new THREE.BoxGeometry(H * 0.26, H * 0.3, H * 0.2), rojo, 0, H * 0.58, 0);             // camisa
  for (const lado of [-1, 1]) {
    pieza(new THREE.BoxGeometry(H * 0.6, H * 0.18, H * 0.19), rojo, lado * H * 0.5, H * 0.7, 0, -lado * 0.06);   // mangas largas
    for (let i = 0; i < 14; i++)                                                              // paja saliendo de las mangas
      pieza(new THREE.ConeGeometry(H * 0.022, H * (0.26 + (i % 3) * 0.05), 4), paja, lado * H * 0.86, H * (0.7 + (i % 5 - 2) * 0.035), H * (i % 4 - 1.5) * 0.03,
            -lado * (Math.PI / 2 + (i % 5 - 2) * 0.2));
  }
  for (let i = 0; i < 26; i++)                                                                // y un buen manojo por debajo de la camisa
    pieza(new THREE.ConeGeometry(H * 0.022, H * (0.26 + (i % 4) * 0.05), 4), paja, H * (i % 9 - 4) * 0.03, H * (0.36 - (i % 2) * 0.03), H * (i % 3 - 1) * 0.035, Math.PI + (i % 9 - 4) * 0.08);
  const R = H * 0.45, cy = H * 0.74 + R * 0.8;                                                // cabezota de calabaza
  pieza(new THREE.SphereGeometry(R, 12, 8).scale(1, 0.82, 1), naranja, 0, cy, 0);
  pieza(new THREE.CylinderGeometry(R * 0.07, R * 0.1, R * 0.3, 5), mat(0x3f7d2c), 0, cy + R * 0.9, 0);   // el cabito
  for (const lado of [-1, 1]) pieza(new THREE.ConeGeometry(R * 0.2, R * 0.34, 3), negro, lado * R * 0.38, cy + R * 0.1, R * 0.9);   // ojos
  pieza(new THREE.BoxGeometry(R * 0.9, R * 0.14, 0.2), negro, 0, cy - R * 0.22, R * 0.92);    // boca
  g.rotation.z = 0.04;                                                                        // apenas torcido
  escena.add(g);
  espanta.g = g;
}
// Cada 30 segundos se hunde en la tierra y reaparece en otro de sus lugares
function moverEspantapajaros(dt) {
  const e = espanta, [x, z, giro] = ESPANTA_LUGARES[e.lugar];
  e.falta -= dt;
  e.burla = Math.max(0, e.burla - dt);
  if (e.falta < 0 && e.asoma <= 0.01) {                  // ya se hundió del todo: pasa al lugar siguiente
    e.lugar = (e.lugar + 1) % ESPANTA_LUGARES.length;
    e.falta = ESPANTA.cada;
    return;
  }
  e.asoma = limitar(e.asoma + (e.falta < 0 ? -1 : 1) * dt * (e.burla > 0 ? 2.5 : 0.9), 0, 1);
  e.g.position.set(x, -ESPANTA.hundido - (1 - e.asoma) * (ESPANTA.alto + 3), z);
  e.g.rotation.y = giro;
}

// ---------- Cartel de madera de bienvenida ----------
function crearCartel() {
  const [cv, g] = lienzo(1024, 512);
  for (let i = 0; i < 4; i++) {                          // cuatro tablas, cada una de un tono
    g.fillStyle = ["#8a5a32", "#7a4f2b", "#93633a", "#80532e"][i];
    g.fillRect(0, i * 128, 1024, 128);
    g.strokeStyle = "rgba(40,22,8,.35)"; g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {                        // vetas
      const y = i * 128 + 12 + Math.random() * 104;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(340, y + 10 * Math.random(), 680, y - 10 * Math.random(), 1024, y + 6); g.stroke();
    }
    g.fillStyle = "rgba(30,16,6,.75)"; g.fillRect(0, i * 128 + 124, 1024, 4);
    g.fillStyle = "#2a1a0c";                             // clavos
    for (const x of [28, 996]) { g.beginPath(); g.arc(x, i * 128 + 64, 7, 0, 6.3); g.fill(); }
  }
  const escribir = (texto, y, tamMax, color) => {
    let tam = tamMax;
    do { g.font = `${tam}px Bangers, Impact, "Arial Black", sans-serif`; tam -= 4; } while (g.measureText(texto).width > 900 && tam > 40);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(30,16,6,.8)"; g.fillText(texto, 517, y + 6);
    g.fillStyle = color; g.fillText(texto, 512, y);
  };
  escribir(T.cartel[0].toUpperCase(), 130, 150, "#f4f1de");
  escribir(T.cartel[1].toUpperCase(), 270, 170, "#f4f1de");
  escribir(T.cartel[2].toUpperCase(), 412, 120, "#ff8a1f");

  const cartel = new THREE.Group(), madera = new THREE.MeshLambertMaterial({ color: 0x6a4526, flatShading: true });
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 0.5), [madera, madera, madera, madera, new THREE.MeshLambertMaterial({ map: textura(cv) }), madera]);
  tabla.position.y = 6.2;
  tabla.castShadow = true;
  cartel.add(tabla);
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.5, 0.7), madera);
    poste.position.set(lado * 6.4, 4.75, -0.5);
    poste.rotation.z = lado * 0.03;
    poste.castShadow = true;
    cartel.add(poste);
  }
  cartel.position.set(CARTEL.x, 0, CARTEL.z);
  cartel.rotation.set(-0.08, 0.3, 0.02);                  // mirando a la cámara, un poco torcido
  escena.add(cartel);
}

// ---------- Flecha guía: si te quedás quieto más de 5 segundos, aparece sobre la nave y apunta al enlace más cercano ----------
const flecha = (() => {
  // un cilindro con un cono en la punta, rojos y sin sombreado, para que se lea como un dibujo
  const rojo = new THREE.MeshBasicMaterial({ color: 0xff2a2a, depthTest: false, fog: false });
  const oscuro = new THREE.MeshBasicMaterial({ color: 0xb01212, depthTest: false, fog: false });
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 5.5, 14).rotateX(-Math.PI / 2).translate(0, 0, 2.2), oscuro);
  const punta = new THREE.Mesh(new THREE.ConeGeometry(1.7, 5.5, 16).rotateX(-Math.PI / 2).translate(0, 0, -3.2), rojo);   // apunta hacia -z
  palo.renderOrder = punta.renderOrder = 20;
  const g3 = new THREE.Group();
  g3.add(palo, punta);
  g3.visible = false;
  escena.add(g3);
  return { g: g3, quieto: 0, f: 0 };
})();
function moverFlecha(dt, t) {
  const F = flecha, moviendo = teclas.size > 0 || objetivo || Math.hypot(ovni.vx, ovni.vz) > 2;
  F.quieto = moviendo || !listo || cine.on ? 0 : F.quieto + dt;
  // los lugares con enlace: la tienda, Linkmaster, el contacto, el autocine y los proyectos que abren algo
  const destinos = [{ x: PUERTA.x, z: PUERTA.z }, RIO.laguna, { x: (BANDA.x0 + BANDA.x1) / 2, z: BANDA.z }, { x: CINE.x, z: CINE.z + 26 },
                    ...piedras.filter(p => p.p.url !== "#")];
  let cerca = null, min = Infinity;
  for (const d of destinos) { const dist = Math.hypot(d.x - ovni.x, d.z - ovni.z); if (dist < min) { min = dist; cerca = d; } }
  const ver = F.quieto > 5 && min > 16;                  // si ya estás encima de uno, no hace falta
  F.f = limitar(F.f + (ver ? 1 : -1) * dt * 2.2, 0, 1);
  F.g.visible = F.f > 0.01;
  if (!F.g.visible) return;
  const dx = (cerca.x - ovni.x) / min, dz = (cerca.z - ovni.z) / min;
  const pop = F.f * (1 + 1.4 * Math.sin(F.f * Math.PI) * (1 - F.f)), vaiven = 6.5 + Math.abs(Math.sin(t * 4)) * 2.6;   // aparece de golpe y empuja hacia el destino
  // aparece como un dibujo animado: a saltos, estirándose y aplastándose antes de acomodarse
  const paso = Math.round(pop * 8) / 8, estira = 1 + (1 - F.f) * 0.9;
  F.g.scale.set(paso / Math.sqrt(estira), paso / Math.sqrt(estira), paso * estira);
  F.g.position.set(ovni.x + dx * (vaiven + 3), ALTURA_NAVE + 2, ovni.z + dz * (vaiven + 3));   // casi a la altura de la nave, así se ve de costado
  F.g.rotation.y = Math.atan2(-dx, -dz);
}

// ---------- Rayos en el horizonte: un par cada 3 minutos (el primero, a los 3 minutos de entrar) ----------
const CADA_RAYOS = Number(params.get("rayos") ?? 180);   // segundos
const texRayos = [1, 2, 3, 4].map(() => {
  const [cv, g] = lienzo(256, 512);
  const rama = (x, y, hasta, grosor) => {               // baja en zigzag; a veces se abre una rama
    const pts = [[x, y]];
    while (y < hasta) {
      x += (Math.random() - 0.5) * 60; y += 22 + Math.random() * 30;
      pts.push([x, y]);
      if (grosor > 3 && Math.random() < 0.22) rama(x, y, Math.min(512, y + 90 + Math.random() * 120), grosor * 0.5);
    }
    const trazo = (color, ancho, brillo) => {
      g.strokeStyle = color; g.lineWidth = ancho; g.shadowColor = "#39c8ff"; g.shadowBlur = brillo;
      g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
    };
    trazo("#5fd6ff", grosor * 2.2, 26);
    trazo("#ffffff", grosor, 0);
  };
  g.lineJoin = g.lineCap = "round";
  rama(128, 0, 512, 6);
  return textura(cv);
});
const rayos = [...Array(10).keys()].map(() => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(75, 150).translate(0, 75, 0),
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  m.visible = false;
  m.userData.vida = 0;
  escena.add(m);
  return m;
});
const resplandor = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0x9fb8ff, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
resplandor.scale.set(620, 300, 1);
escena.add(resplandor);
const NIEBLA_BASE = new THREE.Color(VIOLETA), NIEBLA_RAYO = new THREE.Color(0x5a52b8);
const rayosPendientes = [];
let tanda3 = 0, destello = 0;
function moverRayos(dt, t) {
  const tanda = Math.floor(t / CADA_RAYOS);
  if (tanda !== tanda3) {                                // un par: dos rayos seguidos, cerca uno del otro
    tanda3 = tanda;
    const x = mira.x + (Math.random() - 0.5) * 700;
    for (let i = 0; i < 2; i++) rayosPendientes.push({ en: t + i * 0.2, x: x + (i - 0.5) * 90 + (Math.random() - 0.5) * 30 });
  }
  for (let i = rayosPendientes.length - 1; i >= 0; i--) {
    const p = rayosPendientes[i];
    if (p.en > t) continue;
    rayosPendientes.splice(i, 1);
    const libre = rayos.find(r => r.userData.vida <= 0) ?? rayos[0];
    libre.material.map = texRayos[Math.floor(Math.random() * texRayos.length)];
    libre.material.needsUpdate = true;
    libre.position.set(p.x, -4, mira.z - 850);
    libre.scale.set(Math.random() < 0.5 ? 1 : -1, 0.8 + Math.random() * 0.5, 1);
    libre.userData.vida = 0.16;
    resplandor.position.set(p.x, 40, mira.z - 860);
    destello = 1;
  }
  for (const r of rayos) {
    r.userData.vida -= dt;
    r.visible = r.userData.vida > 0;
    r.material.opacity = Math.random() < 0.25 ? 0.25 : 0.6;
  }
  destello *= Math.pow(0.002, dt);
  resplandor.material.opacity = destello * 0.25;
  luzCielo.intensity = 0.95 + destello * 0.35;             // el relámpago ilumina un poco todo
  escena.fog.color.lerpColors(NIEBLA_BASE, NIEBLA_RAYO, destello * 0.15);
}

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
    modelo.scale.setScalar(0.72);
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
if (MOSTRAR.trafico) escena.add(luzFuego);            // una luz menos que calcular si no hay tráfico

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
function crearAuto(oxidado = false) {
  const g = new THREE.Group();
  const colores = oxidado ? [0x6f7f86, 0x7d6a4a, 0x5d7361, 0x8a8577, 0x6b5a66, 0x4f6a80] : [0xe63946, 0x2a9d8f, 0xf4a261, 0x4361ee, 0xf2f2f2, 0xffd60a];
  const pintura = lambert(colores[Math.floor(Math.random() * colores.length)]);
  g.add(caja(4.8, 1.1, 2.3, pintura, 0, 1.05, 0), caja(2.5, 0.95, 2, MAT.vidrio, -0.3, 2.05, 0), caja(2.6, 0.12, 2.1, pintura, -0.3, 2.56, 0));
  if (oxidado) {                                         // manchas de óxido sobre la chapa, sobre todo abajo y en el capó
    const oxido = [lambert(0x8b3a12), lambert(0x6a2c0e), lambert(0xa5521c)];
    for (let i = 0; i < 16; i++) {
      const costado = Math.random() < 0.6, m = oxido[i % 3];
      if (costado) g.add(caja(0.4 + Math.random() * 1.1, 0.25 + Math.random() * 0.5, 0.06, m, (Math.random() - 0.5) * 4.2, 0.65 + Math.random() * 0.6, (i % 2 ? 1 : -1) * 1.16));
      else g.add(caja(0.4 + Math.random() * 0.9, 0.05, 0.4 + Math.random() * 0.8, m, (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.7), 1.61, (Math.random() - 0.5) * 1.6));
    }
  }
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

// ---------- Un esqueleto pasa caminando por el camino cada 5 minutos (el primero, a los 5 minutos de entrar) ----------
const esqueletos = [];
const FLUO = new THREE.MeshBasicMaterial({ color: 0x39ff14, fog: false });
const CADA_ESQUELETO = Number(params.get("esqueleto") ?? 300);   // segundos
let faltaEsqueleto = CADA_ESQUELETO, sentidoEsqueleto = 1;
function moverEsqueletos(dt) {
  if ((faltaEsqueleto -= dt) <= 0) {
    faltaEsqueleto = CADA_ESQUELETO;
    sentidoEsqueleto *= -1;                             // una vez para cada lado
    for (const sentido of [sentidoEsqueleto]) {         // +1 camina hacia el frente, -1 hacia el fondo
      const e = crearCaminante(false);
      e.obj.scale.multiplyScalar(0.8);
      e.obj.traverse(p => { if (p.isMesh && p.material === MAT.hueso) p.material = FLUO; });   // brilla en verde flúo
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0x39ff14, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      aura.scale.set(13, 13, 1);
      aura.position.y = 3.2;
      e.obj.add(aura);
      e.obj.traverse(p => { if (p.isMesh) p.castShadow = true; });
      e.sentido = sentido;
      e.z = THREE.MathUtils.clamp(mira.z - sentido * 130, -700, 280);
      e.recorrido = 0;
      escena.add(e.obj);
      esqueletos.push(e);
    }
  }
  for (let i = esqueletos.length - 1; i >= 0; i--) {
    const e = esqueletos[i], avance = e.vel * dt;
    e.z += e.sentido * avance;
    e.recorrido += avance;
    const lado = -e.sentido * 3;                         // cada uno por su mano
    const x = xDelCamino(e.z) + lado, adelante = xDelCamino(e.z + e.sentido * 3) + lado;
    e.obj.position.set(x, alturaPuente(e.z), e.z);       // suben y bajan el puente
    e.obj.rotation.y = -Math.atan2(e.sentido * 3, adelante - x);   // sigue las curvas del zigzag
    e.animar(dt, e);
    if (e.recorrido > 330) {
      escena.remove(e.obj);
      e.obj.traverse(p => p.geometry?.dispose());
      esqueletos.splice(i, 1);
    }
  }
}

let espacioApretado = false;

// ---------- La nave, en 3D ----------
const ALTURA_NAVE = 8;
const nave = (() => {
  const g = new THREE.Group(), R = 4.7;
  // plato: una silueta que se hace girar, así tiene volumen de verdad
  const perfil = [[0, -0.85], [1.9, -0.85], [R * 0.84, -0.3], [R, 0.02], [R * 0.84, 0.42], [2.3, 0.85], [0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y));
  const plato = new THREE.Mesh(new THREE.LatheGeometry(perfil, 40),
    new THREE.MeshPhongMaterial({ color: 0xb9bfc6, specular: 0x555a60, shininess: 28 }));
  plato.castShadow = true;
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.25, 0.3, 28), new THREE.MeshPhongMaterial({ color: 0x8f969e }));
  aro.position.y = 0.95;
  // vidrio amarillo transparente: cilindro con la punta redonda
  const vidrio = new THREE.MeshLambertMaterial({ color: 0xffd23c, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.7, 24, 1, true), vidrio);
  tubo.position.y = 1.95;
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), vidrio);
  cupula.position.y = 2.8;
  // antenita con un punto rojo, sobre un resorte
  const antena = new THREE.Group();
  antena.position.set(3.55, 0.3, -2.3);   // en la punta del fuselaje, no sobre el vidrio
  const varilla = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.6, 6), new THREE.MeshPhongMaterial({ color: 0x8f969e }));
  varilla.position.y = 1.8;
  const punto = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  punto.position.y = 3.7;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xff3a3a, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(1.8, 1.8, 1);
  halo.position.y = 3.7;
  antena.add(varilla, punto, halo);
  // luz verde: la boca de abajo, el haz y la mancha en el piso
  const verde = (geo, opacidad) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x4dff7c, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const boca = verde(new THREE.CircleGeometry(1.7, 24), 0.9);
  boca.rotation.x = Math.PI / 2;
  boca.position.y = -0.88;
  const haz = verde(new THREE.CylinderGeometry(1.5, 3.9, ALTURA_NAVE - 1, 28, 1, true), 0.16);
  haz.position.y = -(ALTURA_NAVE - 1) / 2 - 0.9;
  // luz amarilla suave adentro del vidrio
  const foco = new THREE.Sprite(new THREE.SpriteMaterial({ map: polvoTex, color: 0xffd23c, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  foco.scale.set(4.2, 4.2, 1);
  foco.position.y = 2.3;
  g.add(plato, aro, tubo, cupula, foco, antena, boca, haz);
  escena.add(g);
  const mancha = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({
    map: polvoTex, color: 0x4dff7c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  mancha.rotation.x = -Math.PI / 2;
  escena.add(mancha);
  return { g, antena, halo, mancha, boca, haz, luz: 0, ang: { x: 0, z: 0 }, vel: { x: 0, z: 0 } };
})();
function moverNave(dt, t) {
  const { g, antena, halo, mancha, boca, haz, ang, vel } = nave;
  // la luz verde solo se enciende mientras apretás Espacio (o mientras llevás algo colgando)
  nave.luz += ((espacioApretado || enMano ? 1 : 0) - nave.luz) * acercar(dt, 14);
  boca.material.opacity = 0.9 * nave.luz;
  haz.material.opacity = 0.16 * nave.luz;
  mancha.material.opacity = 0.7 * nave.luz;
  luzOvni.intensity = 9 * nave.luz;
  g.position.set(ovni.x, ALTURA_NAVE + Math.sin(t * 2.6) * 0.35, ovni.z);
  g.rotation.z = -limitar(ovni.vx * 0.003, -0.3, 0.3);     // se ladea hacia donde va
  g.rotation.x = limitar(ovni.vz * 0.003, -0.3, 0.3);
  mancha.position.set(ovni.x, 0.16, ovni.z);
  // la antena es un resorte: se queda atrás cuando arrancás y se bambolea al frenar
  for (const eje of ["x", "z"]) {
    const meta = (eje === "x" ? -ovni.vx : ovni.vz) * 0.007;
    vel[eje] += ((meta - ang[eje]) * 90 - vel[eje] * 5) * dt;
    ang[eje] = limitar(ang[eje] + vel[eje] * dt, -1.1, 1.1);
  }
  antena.rotation.z = -ang.x;
  antena.rotation.x = -ang.z;
  halo.material.opacity = 0.55 + 0.45 * Math.sin(t * 6);    // el punto rojo late
}

// ---------- Ovni y controles ----------
const ovni = { x: Number(params.get("x") ?? -24), z: Number(params.get("z") ?? 58), vx: 0, vz: 0 };
window.intentoEspantapajarosPrueba = () => intentoEspantapajaros();   // para pruebas
window.flecha = flecha;
window.ovni = ovni;   // para pruebas desde la consola: ovni.x = 15; ovni.z = 12
window.trafico = { lanzar: lanzarViajero, viajeros, esqueletos, craneos, agarrables, troll };   // para pruebas: trafico.lanzar()
const mira = new THREE.Vector3(ovni.x, 0, ovni.z);
const $ = id => document.getElementById(id);
const pista = $("pista");
const teclas = new Set();
const MAPA = { w: "w", a: "a", s: "s", d: "d", arrowup: "w", arrowleft: "a", arrowdown: "s", arrowright: "d" };
let cercana = null, objetivo = null, listo = false;

const sobrePozo = () => MOSTRAR.pozo && Math.hypot(ovni.x - POZO.x, ovni.z - POZO.z) < POZO.r + 2.6;
const distancia = a => Math.hypot(a.obj.position.x - ovni.x, a.obj.position.z - ovni.z);
const seAgarra = a => a.estado === "libre" && a.obj.visible && (a.tipo !== "marciano" || a.asomado > 0.9);
function masCercano() {
  let mejor = null, min = 5;
  for (const a of agarrables) {
    const d = distancia(a) - (a.tipo === "craneoOro" ? 5 : 0);   // el de oro se alcanza desde más lejos
    if (seAgarra(a) && d < min) { min = d; mejor = a; }
  }
  return mejor;
}
// Espacio: agarra lo que haya bajo la luz, o suelta lo que lleva
function accion() {
  if (!listo) return;
  if (enMano) {
    if (enMano.tipo === "rana") {                        // la rana siempre vuelve saltando a su hoja
      if (cercaDelTroll()) troll.asco = 3.5;             // y el troll no la quiere
      enMano.estado = "vuelve";
    } else if (enMano.tipo === "craneo" && cercaDelTroll()) mandarTroll(enMano);   // se lo lleva a esconder al maizal
    else enMano.estado = cercaDelTroll() ? "troll" : sobrePozo() ? "pozo" : "cayendo";
    enMano.vy = 0;
    enMano = null;
    return;
  }
  if (cercaDelEspantapajaros()) { espanta.falta = -1; espanta.burla = 3.5; intentoEspantapajaros(); return; }   // no se deja agarrar: se va a otro lado
  const a = masCercano();
  if (a?.tipo === "craneoOro") darLogro();              // no se lo lleva: es el premio
  else if (a) { a.estado = "agarrado"; enMano = a; }
}
const TIENDA = { url: "https://vetusmoon.com" };
const sobreGranero = () => !enMano && enGranero(ovni.x, ovni.z, 2);
// las marcas de los marcianos son el contacto: Enter abre un correo nuevo
const CORREO = "rodriguez.sebastian.gar@gmail.com";
const sobreMarcas = () => !enMano && ovni.x > BANDA.x0 - 8 && ovni.x < BANDA.x1 + 22 && Math.abs(ovni.z - BANDA.z) < 22;
let avisoCorreo = 0;
function escribirme() {
  // mailto con un enlace de verdad: es lo que el navegador le pasa al programa de correo
  const enlace = Object.assign(document.createElement("a"), { href: `mailto:${CORREO}?subject=${encodeURIComponent(T.asunto)}` });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // si la máquina no tiene programa de correo, mailto no hace nada: por las dudas queda copiado
  navigator.clipboard?.writeText(CORREO).catch(() => {});
  avisoCorreo = 6;
}
const abrir = p => { if (p.url !== "#") window.open(p.url, "_blank", "noopener"); };

addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (MAPA[k]) { teclas.add(MAPA[k]); e.preventDefault(); }
  if (k === " ") { e.preventDefault(); espacioApretado = true; if (!e.repeat) accion(); }
  if (k === "enter" || k === "e") {
    if (cercana) abrir(cercana.p);
    else if (sobreGranero()) abrir(TIENDA);
    else if (sobreLaguna()) abrir(LINKMASTER);
    else if (sobreMarcas()) escribirme();
    else if (enElFinal()) alternarCine();
  }
});
addEventListener("keyup", e => { teclas.delete(MAPA[e.key.toLowerCase()]); if (e.key === " ") espacioApretado = false; });
addEventListener("blur", () => { teclas.clear(); espacioApretado = false; });
$("agarrar").addEventListener("pointerdown", e => { e.stopPropagation(); espacioApretado = true; accion(); });
addEventListener("pointerup", () => espacioApretado = false);

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
      p.y += (ALTURA_NAVE - 4.6 - p.y) * acercar(dt, 4);
      if (a.tipo !== "marciano") a.obj.rotation.y += dt * 1.6;
    } else if (a.estado === "cayendo") {
      a.vy -= 45 * dt;
      p.y += a.vy * dt;
      if (p.y <= 0) { p.y = 0; a.estado = "libre"; }
    } else if (a.estado === "vuelve") {                  // vuelve a su lugar a los saltos
      const dx = a.casa.x - p.x, dz = a.casa.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1) { p.copy(a.casa); a.estado = "libre"; }
      else {
        const paso = Math.min(d, 34 * dt);
        p.x += dx / d * paso;
        p.z += dz / d * paso;
        p.y = a.casa.y + Math.abs(Math.sin(d * 0.22)) * 3.2;
        a.obj.rotation.y = Math.atan2(dx, dz);
      }
    } else if (a.estado === "troll") {                   // vuela a la boca del troll y se la come
      const boca = troll.g.position;
      p.x += (boca.x - p.x) * acercar(dt, 6);
      p.z += (boca.z - p.z) * acercar(dt, 6);
      p.y += (2.2 - p.y) * acercar(dt, 6);
      a.obj.scale.multiplyScalar(Math.max(0, 1 - dt * 1.8));
      if (a.obj.scale.x < 0.12) {
        a.obj.visible = false;
        a.estado = "fuera";
        a.t = 6;
        troll.mastica = 1.6;
      }
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
        enPozo[a.tipo === "craneo" ? "craneos" : "calabazas"]++;
        $("pozo").textContent = `🎃 ${enPozo.calabazas} · 💀 ${enPozo.craneos}`;
      }
    } else if (a.estado === "fuera" && (a.t -= dt) <= 0) {   // reaparece en su lugar
      p.copy(a.casa);
      a.obj.scale.setScalar(1);
      a.obj.visible = true;
      a.estado = "libre";
    }
  }
}

const reloj = new THREE.Clock();
let cuadros = 0, desdeFps = 0;

// Calidad adaptable: apunta a 60 FPS bajando de a poco la resolución; si ni así llega, se queda en 30 FPS fijos.
const NIVELES = [1, 0.85, 0.7, 0.58];
let nivel = 0, tope30 = false, mediasLentas = 0, ultimoCuadro = 0, numeroCuadro = 0;
function ajustarCalidad(fps) {
  if (tope30 || reloj.elapsedTime < 5 || document.hidden) return;
  mediasLentas = fps < 52 ? mediasLentas + 1 : 0;
  if (mediasLentas < 4) return;                          // dos segundos seguidos por debajo
  mediasLentas = 0;
  if (nivel < NIVELES.length - 1) nivel++;
  else { tope30 = true; nivel = 2; }                     // a 30 FPS sobra algo de margen
  sol.castShadow = nivel < 2;                            // en los niveles bajos se apagan las sombras, que es lo más caro
  renderer.setPixelRatio(RESOLUCION * NIVELES[nivel]);
  ajustarTamano();
}
function cuadro() {
  if (tope30) {                                          // deja pasar un cuadro de cada dos
    const ahora = performance.now();
    if (ahora - ultimoCuadro < 31) { requestAnimationFrame(cuadro); return; }
    ultimoCuadro = ahora;
  }
  renderer.shadowMap.needsUpdate = ++numeroCuadro % 2 === 0;
  const real = reloj.getDelta(), dt = Math.min(real, 0.05), t = reloj.elapsedTime;

  // contador de FPS
  cuadros++;
  if ((desdeFps += real) >= 0.5) {
    const fps = cuadros / desdeFps;
    $("fps").textContent = Math.round(fps) + " FPS";
    ajustarCalidad(fps);
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
  ovni.vx = (ovni.vx + ax / largo * 672 * dt) * freno;
  ovni.vz = (ovni.vz + az / largo * 672 * dt) * freno;
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
  escena.fog.near = 75 * zoom;     // algo de niebla, pero se llega a ver el horizonte
  escena.fog.far = 300 * zoom;
  miradaCam.set(mira.x + MIRA.x * zoom, MIRA.y * zoom, mira.z + MIRA.z * zoom);
  if (finalLetras.f > 0.001) {                           // en el final la cámara se aleja y se pone de frente a las letras
    const k = THREE.MathUtils.smoothstep(finalLetras.f, 0, 1);
    FIN_CAM.set(CINE.x, 56, ovni.z + 130);             // lejos, detrás y por encima de la nave: entra la pantalla y se ven los autos
    camara.position.lerp(FIN_CAM, k);
    miradaCam.lerp(FIN_MIRA, k);
  }
  camara.lookAt(miradaCam);
  sol.position.set(mira.x - 40, 80, mira.z + 45);
  sol.target.position.copy(mira);
  luzOvni.position.set(ovni.x, 15, ovni.z);
  luzOvni.target.position.set(ovni.x, 0, ovni.z);

  moverNave(dt, t);
  moverFlecha(dt, t);

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
  moverRayos(dt, t);
  moverRio(dt, t);
  moverFinal(dt);
  moverEspantapajaros(dt);
  moverCraneoOro(dt, t);
  moverPuertas(dt);
  if (listo) moverEsqueletos(dt);

  // cartelito de ayuda
  avisoCorreo = Math.max(0, avisoCorreo - dt);
  let texto = "";
  if (enMano) texto = cercaDelTroll() ? T.darTroll(trolleable[enMano.tipo]) : sobrePozo() && enMano.tipo !== "rana" ? T.tirarPozo : T.soltarP;
  else if (troll.asco > 0) texto = T.asco;
  else if (troll.mastica > 0) texto = T.nam;
  else if (cercana) texto = cercana.p.url === "#" ? cercana.p.nombre : T.abrir(cercana.p.nombre);
  else if (sobreGranero()) texto = T.vetus;
  else if (sobreLaguna()) texto = T.link;
  else if (avisoCorreo > 0) texto = T.copiado + CORREO;
  else if (sobreMarcas()) texto = T.contacto + CORREO;
  else if (marciano.estado === "libre" && marciano.asomado > 0.5) texto = T.marciano;
  else if (cine.on) texto = T.cineOn;
  else if (enElFinal() && !masCercano()) texto = T.cineBajar;
  else if (espanta.burla > 0) texto = T.escapo;
  else if (cercaDelEspantapajaros()) texto = T.agarrarP;
  else if (masCercano()) texto = masCercano().tipo === "craneoOro" ? T.oro : T.agarrarP;
  pista.classList.toggle("ver", !!texto);
  if (texto) pista.textContent = texto;
  $("agarrar").textContent = enMano ? T.soltar : T.agarrar;

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
    crearFinal();
    crearCartel();

    $("progreso").style.width = "100%";
    requestAnimationFrame(cuadro);
    document.body.classList.add("listo");
    listo = true;
  })
  .catch(err => {
    console.error(err);
    $("estado").textContent = T.error;
  });
