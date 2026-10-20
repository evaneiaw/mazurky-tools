const MY_EXT_ID = "com.mazurky.tools.mira";
const statusText = document.getElementById("statusText");

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
const btnExecutar = document.getElementById("btnExecutar");
const btnPrevia = document.getElementById("btnPrevia");
const btnCancelar = document.getElementById("btnCancelar");
const btnFechar = document.getElementById("btnFechar");
const inputMargem = document.getElementById("margem");
const radiosEspelho = document.getElementsByName("espelho");
const inputTodos = document.getElementById("todosArtboards");

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
  const espelho = Array.from(radiosEspelho).find((r) => r.checked).value;
  return [
    margem, // mm puro — a conversão (2,8346 un/mm) é feita no .jsx
    espelho === "vertical",
    espelho === "horizontal",
    inputTodos.checked
  ];
}

function executar() {
  btnExecutar.disabled = true;
  btnPrevia.disabled = true;
  btnCancelar.disabled = true;
  setStatus("Executando...");
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    btnExecutar.disabled = false;
    btnPrevia.disabled = false;
    btnCancelar.disabled = false;
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
      btnPrevia.disabled = false;
      btnCancelar.disabled = false;
    });
}

function previa() {
  btnExecutar.disabled = true;
  btnPrevia.disabled = true;
  btnCancelar.disabled = true;
  setStatus("Gerando prévia...");
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    btnExecutar.disabled = false;
    btnPrevia.disabled = false;
    btnCancelar.disabled = false;
    return;
  }
  sendToHost("preview", args)
    .then((result) => {
      setStatus(String(result), result && result.indexOf("Erro") !== 0 ? "ok" : "err");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
      btnPrevia.disabled = false;
      btnCancelar.disabled = false;
    });
}

function cancelar() {
  btnExecutar.disabled = true;
  btnPrevia.disabled = true;
  btnCancelar.disabled = true;
  setStatus("Cancelando...");
  sendToHost("cancelar", [])
    .then((result) => {
      setStatus(String(result), result && result.indexOf("Erro") !== 0 ? "ok" : "err");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
      btnPrevia.disabled = false;
      btnCancelar.disabled = false;
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
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnPrevia.addEventListener("click", previa);
btnCancelar.addEventListener("click", cancelar);
btnFechar.addEventListener("click", () => window.close());
window.addEventListener("unload", function () {
  if (rasterTimer) clearInterval(rasterTimer);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
