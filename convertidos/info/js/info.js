const MY_EXT_ID = "com.mazurky.tools.info";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const inputMargem = document.getElementById("margem");
const inputEscala = document.getElementById("escala");
const inputEspessura = document.getElementById("espessura");
const radiosPosicao = document.getElementsByName("posicao");
const radiosRotacao = document.getElementsByName("rotacao");
const radiosSentido = document.getElementsByName("sentido");
const cbFile = document.getElementById("cbFile");
const cbArt = document.getElementById("cbArt");
const cbSize = document.getElementById("cbSize");
const cbICC = document.getElementById("cbICC");
const cbDate = document.getElementById("cbDate");
const cbManual = document.getElementById("cbManual");
const edManual = document.getElementById("edManual");
const inputTodos = document.getElementById("todosArtboards");

let csInterface = null;

// O raster do documento é só informativo. Precisa ser relido, pois muda quando
// o usuário troca o documento ativo ou altera o rasterizador.
function atualizarRasterInfo() {
  const el = document.getElementById("rasterInfo");
  if (!el) return;
  sendToHost("lerRaster", [])
    .then((result) => {
      const txt = "Raster: " + (result || "—");
      if (el.textContent !== txt) el.textContent = txt;
    })
    .catch(() => {
      el.textContent = "Raster: —";
    });
}

let rasterTimer = null;

function ligarAtualizacaoRaster() {
  atualizarRasterInfo();
  window.addEventListener("focus", atualizarRasterInfo);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) atualizarRasterInfo();
  });
  rasterTimer = setInterval(atualizarRasterInfo, 1500);
}

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

function coletarArgs() {
  const margem = parseFloat(String(inputMargem.value).replace(",", "."));
  if (isNaN(margem)) {
    throw new Error("Digite um valor numérico válido para a margem.");
  }
  const escala = parseFloat(String(inputEscala.value).replace(",", "."));
  if (isNaN(escala) || escala <= 0) {
    throw new Error("Digite um percentual de tamanho válido.");
  }
  const espessura = parseFloat(String(inputEspessura.value).replace(",", "."));
  if (isNaN(espessura) || espessura <= 0) {
    throw new Error("Digite uma espessura de traço válida.");
  }
  const posicao = Array.from(radiosPosicao).find((r) => r.checked).value;
  const rotacao = Array.from(radiosRotacao).find((r) => r.checked).value;
  const sentido = Array.from(radiosSentido).find((r) => r.checked).value;
  return [
    margem,
    posicao,
    rotacao,
    cbFile.checked,
    cbArt.checked,
    cbSize.checked,
    cbICC.checked,
    cbDate.checked,
    cbManual.checked,
    edManual.value,
    inputTodos.checked,
    sentido,
    escala,
    espessura
  ];
}

function aplicarPrefs(dados) {
  if (!dados) return;
  if (dados.margem !== undefined) inputMargem.value = dados.margem;
  if (dados.escala !== undefined) inputEscala.value = dados.escala;
  if (dados.espessura !== undefined) inputEspessura.value = dados.espessura;
  if (dados.posicao) {
    for (const r of radiosPosicao) r.checked = r.value === dados.posicao;
  }
  if (dados.rotacao) {
    for (const r of radiosRotacao) r.checked = r.value === dados.rotacao;
  }
  if (dados.sentido) {
    for (const r of radiosSentido) r.checked = r.value === dados.sentido;
  }
  cbFile.checked = !!dados.showFile;
  cbArt.checked = !!dados.showArt;
  cbSize.checked = !!dados.showSize;
  cbICC.checked = !!dados.showICC;
  cbDate.checked = !!dados.showDate;
  cbManual.checked = !!dados.showManual;
  if (dados.manualText !== undefined) edManual.value = dados.manualText;
  if (dados.todos !== undefined) inputTodos.checked = !!dados.todos;
  atualizarManual();
}

function atualizarManual() {
  edManual.disabled = !cbManual.checked;
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

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });
  ligarAtualizacaoRaster();
  sendToHost("getInfoPrefs")
    .then((result) => {
      try {
        aplicarPrefs(JSON.parse(result));
      } catch (e) {}
    })
    .catch(() => {});
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());
window.addEventListener("unload", function () {
  if (rasterTimer) clearInterval(rasterTimer);
});
cbManual.addEventListener("change", atualizarManual);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
