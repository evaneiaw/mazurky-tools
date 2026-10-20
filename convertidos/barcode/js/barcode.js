const MY_EXT_ID = "com.mazurky.tools.barcode";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const selectSimbolo = document.getElementById("selectSimbolo");
const grupoDigitos = document.getElementById("grupoDigitos");
const grupoTexto = document.getElementById("grupoTexto");
const grupoGS1 = document.getElementById("grupoGS1");
const inputNumero = document.getElementById("inputNumero");
const inputTexto = document.getElementById("inputTexto");
const inputGtin = document.getElementById("inputGtin");
const inputLote = document.getElementById("inputLote");
const inputValidade = document.getElementById("inputValidade");
const inputMagnificacao = document.getElementById("inputMagnificacao");
const inputModulo = document.getElementById("inputModulo");
const inputAltura = document.getElementById("inputAltura");
const inputTamTexto = document.getElementById("inputTamTexto");
const campoMagnificacao = document.getElementById("campoMagnificacao");
const campoModulo = document.getElementById("campoModulo");
const campoGuardas = document.getElementById("campoGuardas");
const selectGuardas = document.getElementById("selectGuardas");
const chkTexto = document.getElementById("chkTexto");
const chkLimpar = document.getElementById("chkLimpar");
const selectCor = document.getElementById("selectCor");
const dicaNumero = document.getElementById("dicaNumero");
const dicaTexto = document.getElementById("dicaTexto");
const dicaGS1 = document.getElementById("dicaGS1");
const dicaTamanho = document.getElementById("dicaTamanho");
const previewCanvas = document.getElementById("previewCanvas");
const previewInfo = document.getElementById("previewInfo");

const PT = 72 / 25.4;
const CFG_KEY = "mazurky_barcode_config";
const BWIP_SRC = "convertidos/barcode/js/vendor/bwip-js-min.js";

// Deslocamento (em "em") entre o centro da tinta e o centro da caixa de avanco
// de cada digito na Arial. Medido no Illustrator; centra a tinta na coluna.
const OPTICO_DIGITO = {
  "0": -0.005, "1": -0.0375, "2": -0.015, "3": -0.005, "4": -0.02,
  "5": -0.0025, "6": -0.0075, "7": -0.0025, "8": -0.0025, "9": -0.005
};

const SIMBOLOS = {
  ean13: {
    nome: "EAN-13", bcid: "ean13", tipo: "digitos", compr: 13, min: 12,
    quiet: [11, 7], mag: true, moduloPadrao: 0.33, guardas: true,
    placeholder: "590123412345",
    dica: "12 dígitos (o dígito verificador é calculado) ou os 13 completos."
  },
  ean8: {
    nome: "EAN-8", bcid: "ean8", tipo: "digitos", compr: 8, min: 7,
    quiet: [9, 7], mag: true, moduloPadrao: 0.33, guardas: true,
    placeholder: "9638507",
    dica: "7 dígitos (dígito verificador calculado) ou os 8 completos."
  },
  upca: {
    nome: "UPC-A", bcid: "upca", tipo: "digitos", compr: 12, min: 11,
    quiet: [9, 9], mag: true, moduloPadrao: 0.33, guardas: true,
    placeholder: "03600029145",
    dica: "11 dígitos (dígito verificador calculado) ou os 12 completos."
  },
  code128: {
    nome: "Code 128", bcid: "code128", tipo: "texto",
    quiet: [10, 10], mag: false, moduloPadrao: 0.33,
    placeholder: "MAZURKY123",
    dica: "Texto livre; o conjunto de código é escolhido automaticamente."
  },
  gs1128: {
    nome: "GS1-128", bcid: "gs1-128", tipo: "gs1",
    quiet: [10, 10], mag: false, moduloPadrao: 0.33,
    placeholder: "",
    dica: ""
  },
  itf14: {
    nome: "ITF-14", bcid: "itf14", tipo: "digitos", compr: 14, min: 13,
    quiet: null, mag: false, moduloPadrao: 1.016,
    placeholder: "1234567890123",
    dica: "13 dígitos (dígito verificador calculado) ou os 14 completos. A moldura (bearer bar) já inclui a zona de silêncio."
  },
  code39: {
    nome: "Code 39", bcid: "code39", tipo: "texto",
    quiet: [10, 10], mag: false, moduloPadrao: 0.33,
    placeholder: "MAZURKY-2026",
    dica: "A-Z, 0-9, espaço e - . $ / + % (convertido para maiúsculas)."
  }
};

let csInterface = null;
let bwipPronto = false;
let geo = null;
let atualizando = false;

const cfg = {
  simbolo: "ean13",
  campos: { numero: "", texto: "", gtin: "", lote: "", validade: "" },
  modulos: {},
  mag: 100,
  altura: 22.85,
  tamTexto: 8,
  mostrarTexto: true,
  cor: "#000000",
  limpar: false,
  guardas: "longas"
};

function setStatus(message, type) {
  statusText.className = "status" + (type ? " " + type : "");
  statusText.textContent = message;
}

// JSON.stringify() deixa caracteres não-ASCII soltos; no ExtendScript isso
// depende da codificação do evalScript. Escapamos tudo como \uXXXX.
function jsonParaScript(v) {
  return JSON.stringify(v).replace(/[\u007f-\uffff]/g, function (c) {
    return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

function sendToHost(funcName, args) {
  return new Promise((resolve, reject) => {
    if (!csInterface) {
      reject(new Error("CSInterface não inicializado."));
      return;
    }
    const argStr = (args || []).map((a) => jsonParaScript(a)).join(", ");
    csInterface.evalScript(funcName + "(" + argStr + ")", (result) => {
      if (result === "EvalScript error.") {
        reject(new Error("Erro no ExtendScript."));
      } else {
        resolve(result);
      }
    });
  });
}

function numero(v, padrao) {
  const n = parseFloat(v);
  return isFinite(n) ? n : padrao;
}

function fmtMM(v) {
  return (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
}

function fmtX(v) {
  return (Math.round(v * 1000) / 1000).toFixed(3).replace(".", ",").replace(/,?0+$/, "");
}

// Dígito verificador: peso 3 quando a posição (da esquerda) tem paridade
// diferente do comprimento do prefixo (regra EAN/UPC/GTIN).
function calcCheck(prefixo) {
  let soma = 0;
  for (let i = 0; i < prefixo.length; i++) {
    const d = prefixo.charCodeAt(i) - 48;
    soma += d * ((prefixo.length - i) % 2 === 1 ? 3 : 1);
  }
  return String((10 - (soma % 10)) % 10);
}

function dataValida(dd, mm, aaaa) {
  const d = new Date(Number(aaaa), Number(mm) - 1, Number(dd));
  return d.getFullYear() === Number(aaaa) && d.getMonth() === Number(mm) - 1 && d.getDate() === Number(dd);
}

function traduzirErro(msg) {
  let m = String(msg || "Erro desconhecido.").replace(/^bwipp\.[A-Za-z0-9]+#\d+:\s*/, "");
  if (/bar code text not specified/i.test(m)) return "Digite o conteúdo do código de barras.";
  if (/check digit|checksum/i.test(m)) return "Dígito verificador incorreto.";
  if (/must contain only digits, capital letters/i.test(m)) return "Code 39 aceita apenas A-Z, 0-9, espaço e - . $ / + %";
  if (/must contain only digits/i.test(m)) return "Este símbolo aceita apenas números.";
  if (/AIs must start/i.test(m)) return "Formato GS1 inválido: use (01)..., (10)... e (17)...";
  if (/bad character/i.test(m)) return "Caractere inválido para o símbolo escolhido.";
  if (/bad length/i.test(m)) return "Quantidade de caracteres inválida para o símbolo escolhido.";
  return m;
}

function lerEntradas() {
  return {
    numero: inputNumero.value,
    texto: inputTexto.value,
    gtin: inputGtin.value,
    lote: inputLote.value,
    validade: inputValidade.value
  };
}

// Monta o texto a ser codificado e o texto legível (HRI) exibido embaixo.
function montarTexto(def, ent) {
  if (def.tipo === "digitos") {
    const dig = String(ent.numero || "").replace(/\D/g, "");
    if (!dig) throw new Error("Digite o número do código de barras.");
    let cod;
    if (dig.length === def.compr) cod = dig;
    else if (dig.length === def.min) cod = dig + calcCheck(dig);
    else throw new Error(def.nome + " precisa de " + def.min + " ou " + def.compr + " dígitos (recebidos: " + dig.length + ").");
    return { texto: cod, hri: cod };
  }

  if (def.tipo === "texto") {
    let t = String(ent.texto || "");
    if (def.bcid === "code39") t = t.toUpperCase();
    if (!t) throw new Error("Digite o texto do código de barras.");
    if (def.bcid === "code39" && !/^[0-9A-Z \-\.\$\/\+%]+$/.test(t)) {
      throw new Error("Code 39 aceita apenas A-Z, 0-9, espaço e - . $ / + %");
    }
    return { texto: t, hri: t };
  }

  if (def.tipo === "gs1") {
    const gtin = String(ent.gtin || "").replace(/\D/g, "");
    if (!gtin) throw new Error("Digite o GTIN-14.");
    let cod;
    if (gtin.length === 14) cod = gtin;
    else if (gtin.length === 13) cod = gtin + calcCheck(gtin);
    else throw new Error("GTIN-14 precisa de 13 ou 14 dígitos (recebidos: " + gtin.length + ").");

    const lote = String(ent.lote || "").trim();
    if (lote && !/^[A-Za-z0-9]{1,20}$/.test(lote)) {
      throw new Error("Lote: até 20 caracteres alfanuméricos (A-Z, 0-9).");
    }

    const val = String(ent.validade || "").replace(/\D/g, "");
    let aammdd = "";
    if (val.length === 8) {
      const dd = val.substr(0, 2), mm = val.substr(2, 2), aaaa = val.substr(4, 4);
      if (!dataValida(dd, mm, aaaa)) throw new Error("Validade inválida (use DD/MM/AAAA).");
      aammdd = aaaa.substr(2, 2) + mm + dd;
    } else if (val.length === 6) {
      const dd = val.substr(0, 2), mm = val.substr(2, 2), aa = val.substr(4, 2);
      if (!dataValida(dd, mm, "20" + aa)) throw new Error("Validade inválida (use DD/MM/AAAA).");
      aammdd = aa + mm + dd;
    } else if (val.length !== 0) {
      throw new Error("Validade: use DD/MM/AAAA (ou deixe em branco).");
    }

    let str = "(01)" + cod;
    if (lote) str += "(10)" + lote;
    if (aammdd) str += "(17)" + aammdd;
    return { texto: str, hri: str.replace(/\(/g, " (").replace(/^ /, "") };
  }

  throw new Error("Símbolo desconhecido.");
}

function carregarBwip(callback) {
  if (bwipPronto && window.bwipjs) {
    callback();
    return;
  }
  const s = document.createElement("script");
  s.src = BWIP_SRC;
  s.onload = function () {
    bwipPronto = !!window.bwipjs;
    if (bwipPronto) callback();
    else setStatus("Erro ao carregar bwip-js.", "err");
  };
  s.onerror = function () {
    setStatus("Erro ao carregar bwip-js (" + BWIP_SRC + ").", "err");
  };
  document.head.appendChild(s);
}

// Converte a saída do bwip-js (unidades de módulo) para pontos.
// - eixo X: 1 unidade = 1 módulo (largura do módulo definida pelo usuário)
// - eixo Y: a altura das barras é reescalada para o valor pedido em mm
function calcularGeometria(def, texto) {
  const linhas = [];
  const poligonos = [];
  const textosMod = [];
  const drawing = {
    setopts: function () {},
    scale: function () {},
    measure: function () { return { width: 0, ascent: 0, descent: 0 }; },
    init: function () {},
    line: function (x0, y0, x1, y1, lw) { linhas.push([x0, y0, x1, y1, lw]); },
    polygon: function (pts) { poligonos.push(pts); },
    fill: function () {},
    text: function (x, y, str) { textosMod.push([x, y, str]); },
    end: function () { return true; }
  };

  const guardasLongas = !!(def.guardas && selectGuardas.value !== "curtas");
  window.bwipjs.render({ bcid: def.bcid, text: texto, scale: 1, height: 20, includetext: guardasLongas }, drawing);

  const barrasMod = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (l[0] !== l[2]) continue;
    const esq = Math.floor(l[0] - l[4] / 2);
    barrasMod.push({ esq: esq, dir: esq + l[4], sup: Math.min(l[1], l[3]), inf: Math.max(l[1], l[3]) });
  }
  if (!barrasMod.length) throw new Error("Nenhuma barra foi gerada para este conteúdo.");

  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (let i = 0; i < barrasMod.length; i++) {
    const b = barrasMod[i];
    if (b.esq < bx0) bx0 = b.esq;
    if (b.dir > bx1) bx1 = b.dir;
    if (b.sup < by0) by0 = b.sup;
    if (b.inf > by1) by1 = b.inf;
  }
  by1 += 1;

  let x0 = bx0, x1 = bx1, y0 = by0, y1 = by1;
  let molduraMod = null;

  if (poligonos.length) {
    let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
    const rects = [];
    for (let i = 0; i < poligonos.length; i++) {
      const pts = poligonos[i];
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (let j = 0; j < pts.length; j++) {
        const p = pts[j];
        if (p[0] < rx0) rx0 = p[0];
        if (p[0] > rx1) rx1 = p[0];
        if (p[1] < ry0) ry0 = p[1];
        if (p[1] > ry1) ry1 = p[1];
      }
      rects.push({ x0: rx0, y0: ry0, x1: rx1, y1: ry1 });
      if (rx0 < px0) px0 = rx0;
      if (ry0 < py0) py0 = ry0;
      if (rx1 > px1) px1 = rx1;
      if (ry1 > py1) py1 = ry1;
    }
    let espMod = 0;
    if (rects.length >= 2) {
      rects.sort(function (a, b) {
        return ((b.x1 - b.x0) * (b.y1 - b.y0)) - ((a.x1 - a.x0) * (a.y1 - a.y0));
      });
      espMod = Math.max(0, rects[1].x0 - rects[0].x0);
    }
    if (!(espMod > 0)) espMod = 4;
    molduraMod = { x: px0, y: py0, w: px1 - px0, h: py1 - py0, esp: espMod };
    if (px0 < x0) x0 = px0;
    if (py0 < y0) y0 = py0;
    if (px1 > x1) x1 = px1;
    if (py1 > y1) y1 = py1;
  }

  const desloc = def.quiet ? def.quiet[0] : 0;
  const largSimboloMod = x1 - x0;
  const largTotalMod = def.quiet ? def.quiet[0] + largSimboloMod + def.quiet[1] : largSimboloMod;
  const altContagem = {};
  for (let i = 0; i < barrasMod.length; i++) {
    const b = barrasMod[i];
    const chave = b.inf - b.sup;
    altContagem[chave] = (altContagem[chave] || 0) + 1;
  }
  let altPadrao = 0, altPadraoN = -1;
  for (const chave in altContagem) {
    if (altContagem[chave] > altPadraoN) { altPadraoN = altContagem[chave]; altPadrao = Number(chave); }
  }
  const altBarMod = altPadrao + 1;
  if (!(altBarMod > 0)) throw new Error("Altura das barras inválida.");

  const moduloMM = def.mag ? 0.33 * numero(inputMagnificacao.value, 100) / 100 : numero(inputModulo.value, def.moduloPadrao);
  if (!(moduloMM > 0)) throw new Error("Largura do módulo inválida.");
  const alturaMM = numero(inputAltura.value, 22.85);
  if (!(alturaMM > 0)) throw new Error("Altura das barras inválida.");

  const escalaX = moduloMM * PT;
  const escalaY = (alturaMM * PT) / altBarMod;

  const q4 = function (v) { return Math.round(v * 10000) / 10000; };

  const tamPt = numero(inputTamTexto.value, 8);
  const baseBarras = (by0 + altBarMod - y0) * escalaY;
  const extensaoPadrao = baseBarras * (25.93 / 22.85 - 1);
  const extensaoGuarda = Math.max(extensaoPadrao, 0.716 * tamPt * 1.08);
  const baseTexto = baseBarras + extensaoGuarda;

  const barras = [];
  for (let i = 0; i < barrasMod.length; i++) {
    const b = barrasMod[i];
    const span = b.inf - b.sup;
    const yTopo = (b.sup - y0) * escalaY;
    let alt = (span + 1) * escalaY;
    if (span > altPadrao + 0.01) alt = baseTexto - yTopo;
    barras.push([
      q4((b.esq - x0 + desloc) * escalaX),
      q4((b.dir - b.esq) * escalaX),
      q4(yTopo),
      q4(alt)
    ]);
  }

  const larguraTotal = largTotalMod * escalaX;
  const alturaConteudo = (y1 - y0) * escalaY;

  const textos = [];
  if (guardasLongas && textosMod.length > 1) {
    const xs = textosMod.map(function (t) { return t[0]; });
    const difs = [];
    for (let i = 1; i < xs.length; i++) difs.push(xs[i] - xs[i - 1]);
    const ord = difs.slice().sort(function (a, b) { return a - b; });
    const passo = ord.length ? ord[0] : 0;

    const grupos = [];
    let gAtual = [0];
    for (let i = 1; i < xs.length; i++) {
      if (passo > 0 && xs[i] - xs[i - 1] > passo * 1.35) {
        grupos.push(gAtual);
        gAtual = [i];
      } else {
        gAtual.push(i);
      }
    }
    grupos.push(gAtual);

    const largSecao = (largSimboloMod - 11) / 2;
    const secoes = [
      { ini: 3, larg: largSecao },
      { ini: 3 + largSecao + 5, larg: largSecao }
    ];

    let pontas = [];
    if (grupos.length === 3) pontas = [0];
    else if (grupos.length === 4) pontas = [0, 3];

    const xMod = [];
    for (let i = 0; i < xs.length; i++) xMod[i] = xs[i] + passo / 2 + desloc - x0;

    const internos = [];
    for (let i = 0; i < grupos.length; i++) {
      if (pontas.indexOf(i) < 0) internos.push(i);
    }
    for (let s = 0; s < internos.length && s < secoes.length; s++) {
      const g = grupos[internos[s]];
      const sec = secoes[s];
      const xPrimeiroCod = xs[g[0]] - x0;
      let colOff = Math.round((xPrimeiroCod - sec.ini - 3.5) / 7);
      if (!(colOff >= 0)) colOff = 0;
      for (let k = 0; k < g.length; k++) {
        xMod[g[k]] = sec.ini + 7 * (colOff + k) + 3.5 + desloc;
      }
    }

    const meiaTinta = (0.556 * tamPt / 2) / escalaX;
    if (grupos.length === 3 && grupos[0].length === 1) {
      xMod[grupos[0][0]] = -(meiaTinta + 1) + desloc;
    } else if (grupos.length === 4) {
      if (grupos[0].length === 1) xMod[grupos[0][0]] = -(meiaTinta + 1) + desloc;
      if (grupos[3].length === 1) xMod[grupos[3][0]] = largSimboloMod + meiaTinta + 1 + desloc;
    }

    for (let i = 0; i < textosMod.length; i++) {
      const ch = String(textosMod[i][2]);
      const correcao = -(OPTICO_DIGITO[ch] || 0) * tamPt;
      textos.push({
        t: ch,
        x: q4(xMod[i] * escalaX + correcao),
        base: q4(baseTexto)
      });
    }
  }

  let fundoTexto = textos.length ? q4(baseTexto + 0.1 * tamPt) : 0;

  let moldura = null;
  if (molduraMod) {
    const espX = Math.min(molduraMod.esp * escalaX, larguraTotal * 0.45);
    const espY = Math.min(molduraMod.esp * escalaY, alturaConteudo * 0.45);
    moldura = {
      x: q4((molduraMod.x - x0 + desloc) * escalaX),
      y: q4((molduraMod.y - y0) * escalaY),
      w: q4(molduraMod.w * escalaX),
      h: q4(molduraMod.h * escalaY),
      espX: q4(espX),
      espY: q4(espY)
    };
  }

  let fundoBarras = 0;
  for (let i = 0; i < barras.length; i++) {
    const fim = barras[i][2] + barras[i][3];
    if (fim > fundoBarras) fundoBarras = fim;
  }
  if (moldura && moldura.y + moldura.h > fundoBarras) fundoBarras = moldura.y + moldura.h;
  if (fundoTexto === 0) fundoTexto = fundoBarras;

  return {
    barras: barras,
    moldura: moldura,
    textos: textos,
    larguraTotal: q4(larguraTotal),
    alturaConteudo: q4(alturaConteudo),
    fundoBarras: q4(fundoBarras),
    fundoTexto: fundoTexto,
    centroBarras: q4(((bx0 - x0 + desloc) + (bx1 - x0 + desloc)) / 2 * escalaX),
    moduloMM: moduloMM,
    alturaMM: alturaMM,
    largSimboloMM: largSimboloMod * escalaX,
    nBarras: barras.length
  };
}

function limparPreview() {
  const ctx = previewCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = previewCanvas.clientWidth || 560;
  const h = previewCanvas.clientHeight || 130;
  if (previewCanvas.width !== Math.round(w * dpr) || previewCanvas.height !== Math.round(h * dpr)) {
    previewCanvas.width = Math.round(w * dpr);
    previewCanvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
}

function desenharPreview(g) {
  const ctx = previewCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = previewCanvas.clientWidth || 560;
  const cssH = previewCanvas.clientHeight || 130;
  if (previewCanvas.width !== Math.round(cssW * dpr) || previewCanvas.height !== Math.round(cssH * dpr)) {
    previewCanvas.width = Math.round(cssW * dpr);
    previewCanvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const mostrarTexto = chkTexto.checked;
  const tam = numero(inputTamTexto.value, 8);
  const gap = Math.max(2, tam * 0.4);
  const comGrupos = mostrarTexto && g.textos && g.textos.length > 0;
  const altTotal = comGrupos
    ? Math.max(g.alturaConteudo, g.fundoTexto)
    : g.alturaConteudo + (mostrarTexto ? gap + tam * 1.16 : 0);

  const pad = 10;
  const esc = Math.min((cssW - 2 * pad) / g.larguraTotal, (cssH - 2 * pad) / altTotal);
  if (!(esc > 0)) return;

  const cor = selectCor.value;
  ctx.fillStyle = cor;
  ctx.strokeStyle = cor;

  for (let i = 0; i < g.barras.length; i++) {
    const b = g.barras[i];
    ctx.fillRect(pad + b[0] * esc, pad + b[2] * esc, b[1] * esc, b[3] * esc);
  }

  if (g.moldura) {
    const m = g.moldura;
    const mx = pad + m.x * esc;
    const my = pad + m.y * esc;
    const mw = m.w * esc;
    const mh = m.h * esc;
    const ex = m.espX * esc;
    const ey = m.espY * esc;
    if (ex > 0 && ey > 0 && mh > 2 * ey) {
      ctx.fillRect(mx, my, mw, ey);
      ctx.fillRect(mx, my + mh - ey, mw, ey);
      ctx.fillRect(mx, my + ey, ex, mh - 2 * ey);
      ctx.fillRect(mx + mw - ex, my + ey, ex, mh - 2 * ey);
    } else {
      ctx.fillRect(mx, my, mw, mh);
    }
  }

  if (comGrupos) {
    ctx.font = Math.max(5, tam * esc) + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < g.textos.length; i++) {
      const t = g.textos[i];
      ctx.fillText(t.t, pad + t.x * esc, pad + t.base * esc);
    }
  } else if (mostrarTexto && g.hri) {
    ctx.font = Math.max(5, tam * esc) + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(g.hri, pad + g.centroBarras * esc, pad + (g.fundoBarras + gap + tam * 0.9) * esc, g.larguraTotal * esc);
  }

  previewInfo.textContent =
    fmtMM(g.larguraTotal * 25.4 / 72) + " × " + fmtMM(altTotal * 25.4 / 72) + " mm · X = " +
    fmtX(g.moduloMM) + " mm · " + g.nBarras + " barras · altura " + fmtX(g.alturaMM) + " mm";
}

function aplicarSimbolo() {
  const chave = selectSimbolo.value;
  const def = SIMBOLOS[chave];
  if (!def) return;

  grupoDigitos.classList.toggle("hidden", def.tipo !== "digitos");
  grupoTexto.classList.toggle("hidden", def.tipo !== "texto");
  grupoGS1.classList.toggle("hidden", def.tipo !== "gs1");
  campoMagnificacao.classList.toggle("hidden", !def.mag);
  campoModulo.classList.toggle("hidden", def.mag);
  campoGuardas.classList.toggle("hidden", !def.guardas);

  inputNumero.placeholder = def.placeholder || "";
  inputTexto.placeholder = def.placeholder || "";
  dicaNumero.textContent = def.tipo === "digitos" ? def.dica : "";
  dicaTexto.textContent = def.tipo === "texto" ? def.dica : "";

  if (def.mag) {
    inputMagnificacao.value = cfg.mag;
    dicaTamanho.textContent = "Padrão EAN 100%: X = 0,33 mm e barras de 22,85 mm (guardas 25,93 mm).";
  } else {
    inputModulo.value = cfg.modulos[chave] != null ? cfg.modulos[chave] : def.moduloPadrao;
    dicaTamanho.textContent = "X = largura do módulo em mm (mínimo recomendado: 0,25 mm).";
  }
}

function salvarCfg() {
  cfg.simbolo = selectSimbolo.value;
  cfg.campos = lerEntradas();
  if (SIMBOLOS[cfg.simbolo] && !SIMBOLOS[cfg.simbolo].mag) {
    cfg.modulos[cfg.simbolo] = inputModulo.value;
  }
  cfg.mag = inputMagnificacao.value;
  cfg.altura = inputAltura.value;
  cfg.tamTexto = inputTamTexto.value;
  cfg.mostrarTexto = chkTexto.checked;
  cfg.cor = selectCor.value;
  cfg.limpar = chkLimpar.checked;
  cfg.guardas = selectGuardas.value;
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

function restaurarCfg() {
  try {
    const bruto = localStorage.getItem(CFG_KEY);
    if (!bruto) return;
    const salvo = JSON.parse(bruto);
    if (!salvo || typeof salvo !== "object") return;
    if (salvo.simbolo && SIMBOLOS[salvo.simbolo]) cfg.simbolo = salvo.simbolo;
    if (salvo.campos && typeof salvo.campos === "object") {
      cfg.campos.numero = salvo.campos.numero || "";
      cfg.campos.texto = salvo.campos.texto || "";
      cfg.campos.gtin = salvo.campos.gtin || "";
      cfg.campos.lote = salvo.campos.lote || "";
      cfg.campos.validade = salvo.campos.validade || "";
    }
    if (salvo.modulos && typeof salvo.modulos === "object") cfg.modulos = salvo.modulos;
    if (salvo.mag != null) cfg.mag = salvo.mag;
    if (salvo.altura != null) cfg.altura = salvo.altura;
    if (salvo.tamTexto != null) cfg.tamTexto = salvo.tamTexto;
    if (typeof salvo.mostrarTexto === "boolean") cfg.mostrarTexto = salvo.mostrarTexto;
    if (salvo.cor) cfg.cor = salvo.cor;
    if (typeof salvo.limpar === "boolean") cfg.limpar = salvo.limpar;
    if (salvo.guardas === "curtas" || salvo.guardas === "longas") cfg.guardas = salvo.guardas;
  } catch (e) {}
}

function aplicarCfgNaUI() {
  selectSimbolo.value = cfg.simbolo;
  inputNumero.value = cfg.campos.numero;
  inputTexto.value = cfg.campos.texto;
  inputGtin.value = cfg.campos.gtin;
  inputLote.value = cfg.campos.lote;
  inputValidade.value = cfg.campos.validade;
  inputAltura.value = cfg.altura;
  inputTamTexto.value = cfg.tamTexto;
  chkTexto.checked = cfg.mostrarTexto;
  chkLimpar.checked = cfg.limpar;
  selectGuardas.value = cfg.guardas;
  if (selectCor.querySelector('option[value="' + cfg.cor + '"]')) selectCor.value = cfg.cor;
}

function atualizar() {
  if (atualizando) return;
  atualizando = true;
  try {
    const def = SIMBOLOS[selectSimbolo.value];
    if (!def) return;
    aplicarSimbolo();

    if (!bwipPronto || !window.bwipjs) {
      geo = null;
      limparPreview();
      previewInfo.textContent = "Carregando bwip-js…";
      carregarBwip(function () { atualizando = false; atualizar(); });
      return;
    }

    const ent = lerEntradas();
    if (def.tipo === "gs1") {
      try {
        const m = montarTexto(def, ent);
        dicaGS1.textContent = m.hri;
      } catch (e) {
        dicaGS1.textContent = "AI (01) GTIN, AI (10) lote e AI (17) validade. Os dois últimos são opcionais.";
      }
    }

    const m = montarTexto(def, ent);
    const g = calcularGeometria(def, m.texto);
    g.hri = m.hri;
    geo = g;
    desenharPreview(g);
    setStatus(
      def.nome + " válido: " + fmtMM(g.larguraTotal * 25.4 / 72) + " × " +
      fmtMM(g.fundoTexto * 25.4 / 72) + " mm",
      "ok"
    );
    salvarCfg();
  } catch (e) {
    geo = null;
    limparPreview();
    previewInfo.textContent = "—";
    setStatus(traduzirErro(e && e.message ? e.message : e), "err");
  } finally {
    atualizando = false;
  }
}

function executar() {
  if (!geo) {
    setStatus("Corrija os dados antes de gerar.", "err");
    return;
  }
  const def = SIMBOLOS[selectSimbolo.value];
  const mostrarTexto = chkTexto.checked;
  const payload = {
    simbolo: def.nome,
    barras: geo.barras,
    moldura: geo.moldura,
    textos: geo.textos,
    larguraTotal: geo.larguraTotal,
    centroBarras: geo.centroBarras,
    fundoBarras: geo.fundoBarras,
    texto: mostrarTexto ? geo.hri : "",
    mostrarTexto: mostrarTexto,
    tamTexto: numero(inputTamTexto.value, 8),
    cor: selectCor.value,
    limpar: chkLimpar.checked
  };

  btnExecutar.disabled = true;
  setStatus("Gerando código de barras no Illustrator…");
  sendToHost("gerarCodigoBarras", [payload])
    .then((result) => {
      const ok = result && String(result).indexOf("Erro") !== 0;
      setStatus(String(result || "Sem resposta do Illustrator."), ok ? "ok" : "err");
      if (ok && cfg.limpar) {
        // nada extra
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
    });
}

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });

  restaurarCfg();
  aplicarCfgNaUI();
  aplicarSimbolo();

  [
    selectSimbolo, inputNumero, inputTexto, inputGtin, inputLote, inputValidade,
    inputMagnificacao, inputModulo, inputAltura, inputTamTexto,
    chkTexto, chkLimpar, selectCor, selectGuardas
  ].forEach((el) => {
    el.addEventListener("input", atualizar);
    el.addEventListener("change", atualizar);
  });

  setStatus("Carregando bwip-js…");
  carregarBwip(function () {
    atualizar();
  });
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
