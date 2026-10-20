const MY_EXT_ID = "com.mazurky.tools.fecharobjetos";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const btnRecalcular = document.getElementById("btnRecalcular");
const inputResultado = document.getElementById("resultado");
const inputTolX = document.getElementById("tolX");
const inputTolY = document.getElementById("tolY");
const inputSelfClose = document.getElementById("selfClose");
const inputMerge = document.getElementById("merge");
const inputPreservar = document.getElementById("preservar");

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

function lerTolerancias() {
  const tolX = parseFloat(String(inputTolX.value).replace(",", "."));
  const tolY = parseFloat(String(inputTolY.value).replace(",", "."));
  if (isNaN(tolX) || tolX < 0 || isNaN(tolY) || tolY < 0) {
    throw new Error("Digite valores numéricos válidos para a tolerância.");
  }
  return [tolX, tolY];
}

function coletarArgs() {
  const tol = lerTolerancias();
  return [tol[0], tol[1], inputSelfClose.checked, inputMerge.checked, inputPreservar.checked];
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

function diagnosticar() {
  btnRecalcular.disabled = true;
  setStatus("Calculando diagnóstico...");
  let args;
  try {
    args = lerTolerancias();
  } catch (e) {
    setStatus(e.message, "err");
    btnRecalcular.disabled = false;
    return;
  }
  sendToHost("diagnosticar", args)
    .then((result) => {
      inputResultado.value = String(result);
      setStatus("Diagnóstico atualizado.", "ok");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnRecalcular.disabled = false;
    });
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
btnRecalcular.addEventListener("click", diagnosticar);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
