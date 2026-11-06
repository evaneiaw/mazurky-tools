const FV_CONFIG_KEY = "mazurky_frenteverso_config";

const statusText = document.getElementById("statusText");
const btnGerar = document.getElementById("btnGerar");
const btnFechar = document.getElementById("btnFechar");
const inputDistancia = document.getElementById("distancia");

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

function getRadio(nome) {
  const els = document.getElementsByName(nome);
  for (let i = 0; i < els.length; i++) {
    if (els[i].checked) return els[i].value;
  }
  return "";
}

function marcarRadio(nome, valor) {
  const els = document.getElementsByName(nome);
  for (let i = 0; i < els.length; i++) {
    if (els[i].value === valor) els[i].checked = true;
  }
}

function coletarConfig() {
  return {
    nomenclatura: getRadio("nomenclatura"),
    distancia: inputDistancia.value,
    referencia: getRadio("referencia"),
  };
}

function salvarConfig() {
  try {
    localStorage.setItem(FV_CONFIG_KEY, JSON.stringify(coletarConfig()));
  } catch (e) {}
}

function carregarConfig() {
  let cfg = null;
  try {
    const raw = localStorage.getItem(FV_CONFIG_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch (e) {
    cfg = null;
  }
  if (!cfg) return;
  if (cfg.nomenclatura) marcarRadio("nomenclatura", cfg.nomenclatura);
  if (cfg.referencia) marcarRadio("referencia", cfg.referencia);
  if (cfg.distancia !== undefined && cfg.distancia !== "") {
    inputDistancia.value = String(cfg.distancia);
  }
}

function gerarVerso() {
  const nomenclatura = getRadio("nomenclatura");
  const referencia = getRadio("referencia");
  const distancia = parseFloat(inputDistancia.value);

  if (!nomenclatura) {
    setStatus("Escolha a nomenclatura das pranchetas.", "err");
    return;
  }
  if (!referencia) {
    setStatus("Escolha a referência do espelhamento (MIRAS ou FACA).", "err");
    return;
  }
  if (isNaN(distancia) || !isFinite(distancia) || distancia < 0) {
    setStatus("Distância inválida — informe um número maior ou igual a 0.", "err");
    return;
  }

  salvarConfig();
  btnGerar.disabled = true;
  setStatus("Gerando prancheta espelhada...");

  sendToHost("executar", [nomenclatura, distancia, referencia])
    .then((result) => {
      const texto = String(result === undefined || result === null ? "" : result);
      if (texto.indexOf("ERRO|") === 0) {
        setStatus(texto.slice(5), "err");
      } else if (texto.indexOf("OK|") === 0) {
        setStatus(texto.slice(3), "ok");
      } else {
        setStatus(texto || "Concluído.", "ok");
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnGerar.disabled = false;
    });
}

function fechar() {
  if (csInterface) {
    salvarConfig();
    csInterface.closeExtension();
  }
}

btnGerar.addEventListener("click", gerarVerso);
btnFechar.addEventListener("click", fechar);

document.querySelectorAll('input[name="nomenclatura"], input[name="referencia"]').forEach((inp) => {
  inp.addEventListener("change", salvarConfig);
});

inputDistancia.addEventListener("change", salvarConfig);
inputDistancia.addEventListener("click", function () {
  const el = this;
  setTimeout(function () { el.select(); }, 0);
});
inputDistancia.addEventListener("focus", function () {
  const el = this;
  setTimeout(function () { el.select(); }, 0);
});

function init() {
  csInterface = new CSInterface();
  carregarConfig();
  setStatus("Pronto.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
