const MY_EXT_ID = "com.mazurky.tools.tiler";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const inputLargura = document.getElementById("larguraTile");
const inputAltura = document.getElementById("alturaTile");
const inputEspX = document.getElementById("espacamentoX");
const inputEspY = document.getElementById("espacamentoY");
const inputColunas = document.getElementById("numColunas");
const inputLinhas = document.getElementById("numLinhas");

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
  const larguraTile = parseFloat(String(inputLargura.value).replace(",", "."));
  const alturaTile = parseFloat(String(inputAltura.value).replace(",", "."));
  const espacamentoX = parseFloat(String(inputEspX.value).replace(",", "."));
  const espacamentoY = parseFloat(String(inputEspY.value).replace(",", "."));
  const numColunas = parseInt(inputColunas.value, 10);
  const numLinhas = parseInt(inputLinhas.value, 10);
  if ([larguraTile, alturaTile, espacamentoX, espacamentoY].some((v) => isNaN(v))) {
    throw new Error("Digite valores numéricos válidos para tamanho e espaçamento.");
  }
  if (isNaN(numColunas) || numColunas < 1 || isNaN(numLinhas) || numLinhas < 1) {
    throw new Error("Colunas e linhas devem ser números inteiros maiores que zero.");
  }
  return [larguraTile, alturaTile, espacamentoX, espacamentoY, numColunas, numLinhas];
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
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
