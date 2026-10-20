const MY_EXT_ID = "com.mazurky.tools.simplefaca";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const btnToggle = document.getElementById("btnToggle");
const inputAjustar = document.getElementById("ajustar");
const inputAgruparCotas = document.getElementById("agruparCotas");
const inputAgruparFaca = document.getElementById("agruparFaca");
const inputCopiar = document.getElementById("copiar");

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
  return [
    inputAjustar.checked,
    inputAgruparCotas.checked,
    inputAgruparFaca.checked,
    inputCopiar.checked
  ];
}

function executar() {
  btnExecutar.disabled = true;
  setStatus("Executando...");
  const args = coletarArgs();
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

function alternarTodas() {
  const todosMarcados = inputAjustar.checked && inputAgruparCotas.checked && inputAgruparFaca.checked && inputCopiar.checked;
  inputAjustar.checked = !todosMarcados;
  inputAgruparCotas.checked = !todosMarcados;
  inputAgruparFaca.checked = !todosMarcados;
  inputCopiar.checked = !todosMarcados;
  btnToggle.textContent = todosMarcados ? "Marcar Todas" : "Desmarcar Todas";
}

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());
btnToggle.addEventListener("click", alternarTodas);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
