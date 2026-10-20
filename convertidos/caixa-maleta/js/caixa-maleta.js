document.addEventListener("dragover", function(e) { e.preventDefault(); });
document.addEventListener("drop", function(e) { e.preventDefault(); });

const statusText = document.getElementById("statusText");
const btnGerar = document.getElementById("btnGerar");
const btnFechar = document.getElementById("btnFechar");
const inputMeiaCaixa = document.getElementById("meiaCaixa");
const inputColuna1 = document.getElementById("coluna1");
const inputColuna2 = document.getElementById("coluna2");

let csInterface = null;

function setStatus(message, type) {
  statusText.className = "status-text" + (type ? " " + type : "");
  statusText.textContent = message;
}

function sendToHost(funcName, args) {
  return new Promise((resolve, reject) => {
    if (!csInterface) {
      reject(new Error("CSInterface não inicializado."));
      return;
    }
    const argStr = (args || []).map((a) => JSON.stringify(a)).join(", ");
    const script = funcName + "(" + argStr + ")";
    csInterface.evalScript(script, (result) => {
      if (result === "EvalScript error.") {
        reject(new Error("Erro no ExtendScript (host.jsx)."));
      } else {
        resolve(result);
      }
    });
  });
}

function getNumber(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function getBool(id) {
  return document.getElementById(id).checked;
}

function setNumber(id, value) {
  document.getElementById(id).value = value;
}

function setBool(id, value) {
  document.getElementById(id).checked = value;
}

function atualizarUI() {
  const meia = inputMeiaCaixa.checked;
  inputColuna1.disabled = meia;
  inputColuna2.disabled = meia;
}

function coletarArgs() {
  return [
    getNumber("coluna1"),
    getNumber("coluna2"),
    getNumber("coluna3"),
    getNumber("coluna4"),
    getNumber("abaCola"),
    getNumber("linha1"),
    getNumber("linha2"),
    getNumber("linha3"),
    getNumber("offset"),
    getNumber("espessura"),
    getNumber("tamanhoTexto"),
    getNumber("distanciaTexto"),
    getNumber("extensaoTotal"),
    getBool("cotas"),
    getBool("orelhaComprimento"),
    getBool("retanguloInvisivel"),
    getBool("mostrarMm"),
    getBool("meiaCaixa"),
    getNumber("slotter"),
  ];
}

let saveTimer = null;

function salvarPreferencias(imediato) {
  if (imediato) {
    sendToHost("salvarCaixaMaletaPrefs", coletarArgs()).catch(() => {});
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    sendToHost("salvarCaixaMaletaPrefs", coletarArgs()).catch(() => {});
  }, 300);
}

function gerarCaixaMaleta() {
  btnGerar.disabled = true;
  setStatus("Gerando caixa maleta...");

  const args = coletarArgs();

  sendToHost("salvarCaixaMaletaPrefs", args)
    .then(() => sendToHost("caixaMaleta", args))
    .then((result) => {
      setStatus(String(result), "ok");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnGerar.disabled = false;
    });
}

function carregarPreferencias() {
  sendToHost("getCaixaMaletaPrefs")
    .then((result) => {
      const dados = JSON.parse(result);
      const numericos = [
        "coluna1",
        "coluna2",
        "coluna3",
        "coluna4",
        "abaCola",
        "linha1",
        "linha2",
        "linha3",
        "offset",
        "espessura",
        "tamanhoTexto",
        "distanciaTexto",
        "extensaoTotal",
        "slotter",
      ];
      numericos.forEach((id) => {
        if (dados[id] !== undefined) setNumber(id, String(dados[id]));
      });
      const booleanos = [
        "cotas",
        "orelhaComprimento",
        "retanguloInvisivel",
        "mostrarMm",
        "meiaCaixa",
      ];
      booleanos.forEach((id) => {
        if (dados[id] !== undefined) setBool(id, dados[id]);
      });
      atualizarUI();
    })
    .catch(() => {
      atualizarUI();
    });
}

function fechar() {
  if (csInterface) {
    salvarPreferencias(true);
    csInterface.closeExtension();
  }
}

// =====================================================================
// Extracao de PDF via pdf.js (carregamento dinamico)
// =====================================================================

var pdfJsLoaded = false;
var PDF_BASE = "convertidos/caixa-maleta/js/pdfjs/";

function carregarPdfJs(callback) {
  if (pdfJsLoaded && window.pdfjsLib) {
    callback();
    return;
  }
  var script1 = document.createElement("script");
  script1.src = PDF_BASE + "pdf.min.js";
  script1.onload = function () {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_BASE + "pdf.worker.min.js";
    pdfJsLoaded = true;
    callback();
  };
  script1.onerror = function () {
    setStatus("Erro ao carregar pdf.js", "err");
  };
  document.head.appendChild(script1);
}

function onPdfFile(file) {
  if (!file) return;
  setStatus("Extraindo medidas do PDF...");
  try {
    carregarPdfJs(function () {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var typedArray = new Uint8Array(e.target.result);
          extrairMaletaDePdf(typedArray);
        } catch (err) {
          setStatus("Erro ao processar PDF: " + err.message, "err");
        }
      };
      reader.onerror = function () {
        setStatus("Erro ao ler o arquivo.", "err");
      };
      reader.readAsArrayBuffer(file);
    });
  } catch (err) {
    setStatus("Erro ao carregar pdf.js: " + err.message, "err");
  }
}

function extrairMaletaDePdf(data) {
  pdfjsLib.getDocument(data).promise.then(function (pdf) {
    var promises = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      promises.push(pdf.getPage(i).then(function (page) {
        return page.getTextContent();
      }));
    }
    return Promise.all(promises);
  }).then(function (paginas) {
    var dados = null;
    for (var p = 0; p < paginas.length && !dados; p++) {
      dados = parsearMaleta(paginas[p].items);
    }
    if (!dados) {
      setStatus("Não foi possível extrair medidas do PDF.", "err");
      return;
    }
    preencherCamposMaleta(dados);
    setStatus("Medidas extraídas do PDF com sucesso!", "ok");
  }).catch(function (e) {
    setStatus("Erro ao ler PDF: " + e.message, "err");
  });
}

function parsearMaleta(items) {
  if (!items || !items.length) return null;

  var texto = items.map(function (item) { return item.str; }).join(" ");

  var rows = [];
  items.forEach(function (item) {
    var s = (item.str || "").trim();
    if (!s || !item.transform) return;
    var x = item.transform[4];
    var y = item.transform[5];
    var row = null;
    for (var r = 0; r < rows.length; r++) {
      if (Math.abs(rows[r].y - y) <= 3) { row = rows[r]; break; }
    }
    if (!row) { row = { y: y, items: [] }; rows.push(row); }
    row.items.push({ str: s, x: x });
  });

  var candidatos = [];
  rows.forEach(function (row) {
    if (row.items.length < 4) return;
    var todosNumericos = row.items.every(function (it) {
      return /^[\d\s]+$/.test(it.str);
    });
    if (!todosNumericos) return;
    var ordenados = row.items.slice().sort(function (a, b) { return a.x - b.x; });
    var vals = [];
    ordenados.forEach(function (it) {
      var m = it.str.match(/\d+/g);
      if (m) m.forEach(function (num) { vals.push(parseInt(num, 10)); });
    });
    if (vals.length < 4) return;
    var temPequeno = false;
    for (var k = 0; k < vals.length; k++) {
      if (vals[k] <= 50) { temPequeno = true; break; }
    }
    candidatos.push({ vals: vals, temPequeno: temPequeno });
  });

  if (!candidatos.length) return null;

  var comPequeno = [];
  for (var c = 0; c < candidatos.length; c++) {
    if (candidatos[c].temPequeno) comPequeno.push(candidatos[c]);
  }
  var pool = comPequeno.length ? comPequeno : candidatos;
  pool.sort(function (a, b) { return b.vals.length - a.vals.length; });
  var vals = pool[0].vals;

  var coluna1, coluna2, coluna3, coluna4, abaCola, orelhaComprimento;

  if (vals[0] <= 50) {
    orelhaComprimento = true;
    abaCola = vals[0];
    coluna1 = vals[1];
    coluna2 = vals[2];
    coluna3 = vals[3];
    coluna4 = vals[4];
  } else if (vals[vals.length - 1] <= 50) {
    orelhaComprimento = false;
    abaCola = vals[vals.length - 1];
    coluna1 = vals[0];
    coluna2 = vals[1];
    coluna3 = vals[2];
    coluna4 = vals[3];
  } else {
    orelhaComprimento = false;
    abaCola = 0;
    coluna1 = vals[0];
    coluna2 = vals[1];
    coluna3 = vals[2];
    coluna4 = vals[3];
  }

  var linha1 = 0, linha2 = 0, linha3 = 0;
  var linhasEncontradas = [];
  var partes = texto.split("|");
  for (var j = 0; j < partes.length; j++) {
    var m = partes[j].trim().match(/^(\d{3,4})$/);
    if (m) linhasEncontradas.push(parseInt(m[1], 10));
  }
  if (linhasEncontradas.length >= 3) {
    linha1 = linhasEncontradas[0];
    linha2 = linhasEncontradas[1];
    linha3 = linhasEncontradas[2];
  }

  if (!coluna1 && !linha1) return null;

  return {
    coluna1: coluna1,
    coluna2: coluna2,
    coluna3: coluna3,
    coluna4: coluna4,
    abaCola: abaCola,
    linha1: linha1,
    linha2: linha2,
    linha3: linha3,
    orelhaComprimento: orelhaComprimento
  };
}

function preencherCamposMaleta(dados) {
  setNumber("coluna1", dados.coluna1);
  setNumber("coluna2", dados.coluna2);
  setNumber("coluna3", dados.coluna3);
  setNumber("coluna4", dados.coluna4);
  setNumber("abaCola", dados.abaCola);
  setNumber("linha1", dados.linha1);
  setNumber("linha2", dados.linha2);
  setNumber("linha3", dados.linha3);
  atualizarUI();
  setBool("orelhaComprimento", dados.orelhaComprimento);
}

btnGerar.addEventListener("click", gerarCaixaMaleta);
btnFechar.addEventListener("click", fechar);
inputMeiaCaixa.addEventListener("change", atualizarUI);

// =====================================================================
// Drag & Drop PDF
// =====================================================================

var dropZone = document.getElementById("dropZone");
var pdfFileInput = document.getElementById("pdfFileInput");

dropZone.addEventListener("click", function () {
  pdfFileInput.click();
});

pdfFileInput.addEventListener("change", function () {
  if (pdfFileInput.files && pdfFileInput.files.length > 0) {
    onPdfFile(pdfFileInput.files[0]);
  }
});

dropZone.addEventListener("dragover", function (e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", function (e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", function (e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("dragover");
  var files = e.dataTransfer.files;
  if (files && files.length > 0) {
    var file = files[0];
    if (file.name.toLowerCase().endsWith(".pdf")) {
      onPdfFile(file);
    } else {
      setStatus("Por favor, selecione um arquivo PDF.", "err");
    }
  }
});

const CAMPO_IDS = [
  "coluna1",
  "coluna2",
  "coluna3",
  "coluna4",
  "abaCola",
  "linha1",
  "linha2",
  "linha3",
  "offset",
  "espessura",
  "tamanhoTexto",
  "distanciaTexto",
  "extensaoTotal",
  "slotter",
  "cotas",
  "orelhaComprimento",
  "retanguloInvisivel",
  "mostrarMm",
  "meiaCaixa",
];

CAMPO_IDS.forEach((id) => {
  document.getElementById(id).addEventListener("change", () => salvarPreferencias(false));
});

inputColuna1.addEventListener("change", function () {
  setBool("orelhaComprimento", getNumber("coluna1") <= 50);
});

document.querySelectorAll('input[type="number"]').forEach(function (inp) {
  inp.addEventListener("click", function () {
    var el = this;
    setTimeout(function () { el.select(); }, 0);
  });
  inp.addEventListener("focus", function () {
    var el = this;
    setTimeout(function () { el.select(); }, 0);
  });
});

window.addEventListener("beforeunload", () => {
  if (csInterface) salvarPreferencias(true);
});

function init() {
  csInterface = new CSInterface();
  csInterface.setWindowTitle("Caixa Maleta - Mazurky v2.0");
  try {
    const evt = new CSEvent("com.mazurky.tools.caixamaleta.opened", "APPLICATION");
    evt.data = "";
    csInterface.dispatchEvent(evt);
  } catch (e) {}
  try {
    csInterface.addEventListener("com.mazurky.tools.caixamaleta.hide", () => {
      csInterface.closeExtension();
    });
  } catch (e) {}
  setStatus("Pronto.");
  carregarPreferencias();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
