const MY_EXT_ID = "com.mazurky.tools.centerline";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const inputOffset = document.getElementById("offset");
const radiosAlinhamento = document.getElementsByName("alinhamento");
const inputAddCenterCL = document.getElementById("addCenterCL");
const inputTodosArtboards = document.getElementById("todosArtboards");
const docListContainer = document.getElementById("docList");

let csInterface = null;
let openDocs = [];
let activeDocIndex = -1;

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
        reject(new Error("Erro no ExtendScript."));
      } else {
        resolve(result);
      }
    });
  });
}

function renderDocList(docs, ativo) {
  openDocs = docs;
  activeDocIndex = typeof ativo === "number" ? ativo : -1;
  if (docs.length === 0) {
    docListContainer.innerHTML = '<span class="doc-empty">Nenhum documento aberto.</span>';
    return;
  }
  let html = '';
  for (var i = 0; i < docs.length; i++) {
    var marcado = activeDocIndex >= 0 ? (i === activeDocIndex) : true;
    html += '<label class="check doc-item"><input type="checkbox" value="' + i + '"' +
      (marcado ? " checked" : "") + ' /> ' + docs[i] + '</label>';
  }
  docListContainer.innerHTML = html;
}

const CONFIG_KEY = "mazurky_centerline_config";

function coletarConfig() {
  return {
    alinhamento: Array.from(radiosAlinhamento).find((r) => r.checked).value,
    addCenterCL: inputAddCenterCL.checked,
    offset: inputOffset.value,
    todosArtboards: inputTodosArtboards ? inputTodosArtboards.checked : true
  };
}

function aplicarConfig(cfg) {
  var al = cfg.alinhamento || "base";
  Array.from(radiosAlinhamento).forEach(function (r) { r.checked = r.value === al; });
  inputAddCenterCL.checked = !!cfg.addCenterCL;
  if (cfg.offset !== undefined) inputOffset.value = cfg.offset;
  if (inputTodosArtboards) inputTodosArtboards.checked = cfg.todosArtboards !== false;
}

function salvarConfig() {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(coletarConfig()));
  } catch (e) {}
}

function carregarConfig() {
  try {
    var raw = localStorage.getItem(CONFIG_KEY);
    if (raw) aplicarConfig(JSON.parse(raw));
  } catch (e) {}
}

function ligarPersistencia() {
  var salvar = function () { salvarConfig(); };
  Array.from(radiosAlinhamento).forEach(function (r) { r.addEventListener("change", salvar); });
  inputAddCenterCL.addEventListener("change", salvar);
  if (inputTodosArtboards) inputTodosArtboards.addEventListener("change", salvar);
  inputOffset.addEventListener("change", salvar);
}

function coletarArgs() {
  const offset = parseFloat(String(inputOffset.value).replace(",", "."));
  if (isNaN(offset)) {
    throw new Error("Digite um valor numérico válido para o deslocamento.");
  }
  const alinhamento = Array.from(radiosAlinhamento).find((r) => r.checked).value;
  const selectedInputs = docListContainer.querySelectorAll('input[type="checkbox"]:checked');
  var selectedIndices = [];
  for (var i = 0; i < selectedInputs.length; i++) {
    selectedIndices.push(parseInt(selectedInputs[i].value));
  }
  if (selectedIndices.length === 0) {
    throw new Error("Selecione pelo menos um arquivo.");
  }
  return [alinhamento, inputAddCenterCL.checked, offset, selectedIndices, inputTodosArtboards.checked];
}

function executar() {
  btnExecutar.disabled = true;
  setStatus("Executando...");
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    btnExecutar.disabled = false;
    return;
  }
  salvarConfig();
  sendToHost("executar", args)
    .then((result) => {
      setStatus(String(result), result && result.indexOf("Erro") !== 0 ? "ok" : "err");
      if (result && result.indexOf("Erro") !== 0) {
        setTimeout(function () { window.close(); }, 2000);
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
    });
}

function marcarTodos() {
  var checks = docListContainer.querySelectorAll('input[type="checkbox"]');
  for (var i = 0; i < checks.length; i++) {
    checks[i].checked = true;
  }
}

function desmarcarTodos() {
  var checks = docListContainer.querySelectorAll('input[type="checkbox"]');
  for (var i = 0; i < checks.length; i++) {
    checks[i].checked = activeDocIndex >= 0 &&
      parseInt(checks[i].value, 10) === activeDocIndex;
  }
}

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });
  carregarConfig();
  ligarPersistencia();
  sendToHost("listarDocumentos", [])
    .then(function (result) {
      var raw = String(result || "");
      var ativo = -1;
      var m = /^#(-?\d+)#([\s\S]*)$/.exec(raw);
      var texto = raw;
      if (m) {
        ativo = parseInt(m[1], 10);
        texto = m[2];
      }
      var docs = texto
        .split("|")
        .filter(function (n) { return n.length > 0; });
      renderDocList(docs, ativo);
      setStatus("Pronto. " + docs.length + " arquivo(s) aberto(s).");
    })
    .catch(function (e) {
      renderDocList([]);
      setStatus("Erro ao carregar documentos: " + e.message, "err");
    });
  btnExecutar.addEventListener("click", executar);
  btnFechar.addEventListener("click", () => window.close());
  document.getElementById("btnMarcarTodos").addEventListener("click", marcarTodos);
  document.getElementById("btnDesmarcarTodos").addEventListener("click", desmarcarTodos);
  setStatus("Carregando documentos...");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
