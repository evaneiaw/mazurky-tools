// main.js — hub do painel Mazurky Tools
// Carrega cada ferramenta dinamicamente dentro do MESMO painel (extensão única),
// evitando múltiplas entradas no menu Window > Extensions.

var MAZURKY_TOOLS = {
  caixamaletaft: { dir: "caixa-maleta-ft", nome: "Caixa Maleta", version: "1.1.4" },
  gerarLayoutft: { dir: "gerarLayout-ft", nome: "Gerar Layout", version: "1.0.4" },
  centerline: { dir: "centerline", nome: "Centerline", version: "1.0.0" },
  mira: { dir: "mira", nome: "Mira", version: "1.0.0" },
  info: { dir: "info", nome: "Info", version: "1.0.0" },
  lote: { dir: "lote", nome: "Lote Mazurky", version: "1.1.1" },
  simplefaca: { dir: "simplefaca", nome: "FACA ARD (→) VETOR", version: "1.0.1" },
  frenteverso: { dir: "frenteverso", nome: "Frente e Verso", version: "1.0.0" },
  salvarpdf: { dir: "salvarpdf", nome: "Salvar PDF", version: "1.1.1" },
  cotas: { dir: "cotas", nome: "Cotas", version: "1.0.0" },
  resolucao: { dir: "resolucao", nome: "Diminuir Resolução", version: "1.0.0" },
  marcasdecorte: { dir: "marcasdecorte", nome: "Marcas de Corte", version: "1.0.0" },
  removerlinhas: { dir: "removerlinhas", nome: "Remover Linhas", version: "2.1.1" },
  facaplotter: { dir: "facaplotter", nome: "Faca para Plotter", version: "1.0.0" },
  tamanhoartboard: { dir: "tamanhoartboard", nome: "Igualar Tamanho Artboards", version: "1.0.0" },
  tracejarpicote: { dir: "tracejarpicote", nome: "Tracejar (Picote)", version: "1.0.0" },
  qrcode: { dir: "qrcode", nome: "QR Code Vetor", version: "1.0.0" },
  barcode: { dir: "barcode", nome: "Código de Barras", version: "1.0.0" },
  caixamaleta: { dir: "caixa-maleta", nome: "Caixa Maleta (antigo)", version: "1.0.0", semNumero: true, divisor: true },
  gerarLayout: { dir: "gerarLayout", nome: "Gerar Layout (antigo)", version: "1.0.0", semNumero: true }
};

var csInterface = null;
var currentTool = null;
var toolStyleEl = null;
var abrindo = false;
var extRoot = "";

var PALETA = ["#1473e6", "#d7373f", "#12805c", "#ca8800", "#7d4fc9", "#0d858c"];

function gridHTML() {
  var contador = 0;
  var buttons = Object.keys(MAZURKY_TOOLS)
    .map(function (key) {
      var meta = MAZURKY_TOOLS[key];
      var prefixo = meta.divisor ? '<div class="tool-divider"></div>' : "";
      if (meta.semNumero) {
        return (
          prefixo +
          '<button class="tool-btn" data-tool="' +
          key +
          '" style="background:#6b6b6b;">' +
          meta.nome +
          "</button>"
        );
      }
      var cor = PALETA[contador % PALETA.length];
      contador++;
      var num = contador < 10 ? "0" + contador : String(contador);
      return (
        prefixo +
        '<button class="tool-btn" data-tool="' +
        key +
        '" style="background:' +
        cor +
        ';">' +
        num +
        " \u00b7 " +
        meta.nome +
        "</button>"
      );
    })
    .join("");
  return (
    '<div id="app">' +
    '<header class="header">' +
    '<h1 class="title">Mazurky Tools</h1>' +
    '<button id="btnAbrirLog" class="log-btn" title="Abrir o log de erros">Log</button>' +
    '<span class="badge">v0.5.1</span>' +
    "</header>" +
    '<main id="content" class="content">' +
    '<section class="card">' +
    '<h2 class="card-title">Ferramentas</h2>' +
    '<p class="card-text">Clique em uma ferramenta para abrir o painel dela.</p>' +
    '<div class="ft-row">' +
    '<span class="ft-label">FT</span>' +
    '<input id="ftNumber" class="ft-input" type="text" inputmode="numeric" placeholder="Numero da FT" />' +
    '<button id="btnLimparFT" class="button">Limpar</button>' +
    "</div>" +
    '<div id="toolGrid" class="tool-grid">' +
    buttons +
    "</div>" +
    "</section>" +
    "</main>" +
    '<footer id="status" class="status"><span id="statusText">Pronto.</span></footer>' +
    "</div>"
  );
}

function ligarFT() {
  var input = document.getElementById("ftNumber");
  if (!input || !window.MazurkyFT) return;
  window.MazurkyFT.sincronizar(function (v) {
    input.value = v || "";
  });
  input.addEventListener("input", function () {
    input.value = input.value.replace(/\D/g, "");
    window.MazurkyFT.set(input.value);
  });
  var btn = document.getElementById("btnLimparFT");
  if (btn) {
    btn.addEventListener("click", function () {
      input.value = "";
      window.MazurkyFT.limpar();
      setStatus("FT limpa.");
    });
  }
}

function setStatus(message, type) {
  var statusText = document.getElementById("statusText");
  var status = document.getElementById("status");
  if (!statusText) return;
  status.className = "status" + (type ? " " + type : "");
  statusText.textContent = message;
}

function sendToHost(funcName, args) {
  return new Promise(function (resolve, reject) {
    if (!csInterface) {
      reject(new Error("CSInterface não inicializado."));
      return;
    }
    var argStr = (args || []).map(function (a) { return JSON.stringify(a); }).join(", ");
    var script = funcName + "(" + argStr + ")";
    csInterface.evalScript(script, function (result) {
      if (result === "EvalScript error.") {
        reject(new Error("Erro no ExtendScript."));
      } else {
        resolve(result);
      }
    });
  });
}

function registrarLog(origem, mensagem) {
  try {
    if (!csInterface) return;
    var args =
      JSON.stringify(String(origem || "hub")) + ", " +
      JSON.stringify(String(mensagem || ""));
    csInterface.evalScript("mazurkyLog(" + args + ")", function () {});
  } catch (e) {}
}

var observadorStatus = null;
var ultimoErroLog = "";

function ligarLogStatus() {
  if (observadorStatus) {
    try { observadorStatus.disconnect(); } catch (e) {}
  }
  var status = document.getElementById("status");
  if (!status) return;
  ultimoErroLog = "";
  observadorStatus = new MutationObserver(function () {
    var statusText = document.getElementById("statusText");
    var texto = statusText ? String(statusText.textContent || "") : "";
    var classe = String(status.className || "") + " " +
      (statusText ? String(statusText.className || "") : "");
    var ehErro = classe.indexOf("err") >= 0 || /^Erro\b/.test(texto);
    if (!ehErro) {
      ultimoErroLog = "";
      return;
    }
    if (texto && texto !== ultimoErroLog) {
      ultimoErroLog = texto;
      registrarLog(currentTool || "hub", "Painel: " + texto);
    }
  });
  observadorStatus.observe(status, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

function ligarLogGlobal() {
  window.addEventListener("error", function (e) {
    registrarLog(currentTool || "hub", "JS: " + (e.message || "erro") +
      (e.filename ? " (" + e.filename + ":" + e.lineno + ")" : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    registrarLog(currentTool || "hub", "JS (promise): " + (r && r.message ? r.message : r));
  });
}

function removeToolStyle() {
  if (toolStyleEl && toolStyleEl.parentNode) {
    toolStyleEl.parentNode.removeChild(toolStyleEl);
  }
  toolStyleEl = null;
}

function voltar() {
  if (abrindo) return;
  currentTool = null;
  document.body.innerHTML = gridHTML();
  removeToolStyle();
  setStatus("Pronto.");
  ligarFT();
  ligarLogStatus();
  try {
    window.resizeTo(640, 600);
  } catch (e) {}
}

// Ferramentas usam window.close()/closeExtension() para "fechar".
// Aqui interceptamos para voltar ao grid em vez de fechar o painel.
window.close = voltar;

(function patchCloseExtension() {
  if (!window.CSInterface) return;
  var orig = CSInterface.prototype.closeExtension;
  CSInterface.prototype.closeExtension = function () {
    if (currentTool) {
      voltar();
      return;
    }
    return orig.apply(this, arguments);
  };
})();

function abrirFerramenta(key) {
  var meta = MAZURKY_TOOLS[key];
  if (!meta) {
    setStatus("Ferramenta desconhecida: " + key, "err");
    return;
  }
  if (abrindo) return;
  abrindo = true;
  var base = "convertidos/" + meta.dir + "/";

  var semCache = { cache: "no-store" };
  Promise.all([
    fetch(base + meta.dir + ".html?v=" + Date.now(), semCache).then(function (r) { return r.text(); }),
    fetch(base + "css/" + meta.dir + ".css?v=" + Date.now(), semCache).then(function (r) { return r.text(); }),
    fetch(base + "js/" + meta.dir + ".js?v=" + Date.now(), semCache).then(function (r) { return r.text(); }),
    sendToHost("carregarFerramenta", [key, extRoot])
  ])
    .then(function (resultados) {
      var html = resultados[0];
      var css = resultados[1];
      var js = resultados[2];
      var carregamento = resultados[3];
      if (carregamento && carregamento !== "ok") {
        setStatus(String(carregamento), "err");
        return;
      }
      var parsed = new DOMParser().parseFromString(html, "text/html");
      var bodyHtml = parsed.body ? parsed.body.innerHTML : "";
      bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
      document.body.innerHTML = bodyHtml;
      ligarLogStatus();

      var titleEl = document.querySelector(".title");
      if (titleEl && meta.version) {
        var versionBadge = document.createElement("span");
        versionBadge.className = "tool-version";
        versionBadge.textContent = "v" + meta.version;
        titleEl.parentNode.insertBefore(versionBadge, titleEl.nextSibling);
      }

      toolStyleEl = document.createElement("style");
      toolStyleEl.id = "mazurkyToolStyle";
      toolStyleEl.textContent = css;
      document.head.appendChild(toolStyleEl);

      currentTool = key;
      registrarLog(key, "Ferramenta aberta");
      new Function(js)();
    })
    .catch(function (e) {
      setStatus("Erro ao abrir ferramenta: " + (e && e.message ? e.message : e), "err");
    })
    .finally(function () {
      abrindo = false;
    });
}

document.addEventListener("click", function (event) {
  if (event.target && event.target.id === "btnAbrirLog") {
    sendToHost("abrirLog", []).catch(function () {});
    return;
  }
  var btn = event.target.closest ? event.target.closest(".tool-btn") : null;
  if (btn) {
    abrirFerramenta(btn.dataset.tool);
    return;
  }
});

function init() {
  csInterface = new CSInterface();
  try {
    extRoot = csInterface.getSystemPath(SystemPath.EXTENSION) || "";
  } catch (e) {
    extRoot = "";
  }
  document.body.innerHTML = gridHTML();
  setStatus("Pronto.");
  ligarFT();
  ligarLogStatus();
  ligarLogGlobal();
  if (window.MazurkyFTAPI && window.MazurkyFTAPI.limparTodoCacheFT) {
    window.MazurkyFTAPI.limparTodoCacheFT();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
