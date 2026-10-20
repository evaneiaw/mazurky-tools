const MY_EXT_ID = "com.mazurky.tools.salvarpdf";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const radiosPasta = document.getElementsByName("pasta");
const inputPasta = document.getElementById("inputPasta");
const ddPreset = document.getElementById("ddPreset");
const chkView = document.getElementById("chkView");
const chkSalvarAntes = document.getElementById("chkSalvarAntes");
const chkPaginaPorArquivo = document.getElementById("chkPaginaPorArquivo");
const chkArtboardUnica = document.getElementById("chkArtboardUnica");
const fieldArtboardUnica = document.getElementById("fieldArtboardUnica");
const ddArtboard = document.getElementById("ddArtboard");
const chkOcultarFaca = document.getElementById("chkOcultarFaca");
const ddNome = document.getElementById("ddNome");
const docChecks = document.getElementById("docChecks");
const fieldsetDocs = document.getElementById("fieldsetDocs");

let csInterface = null;
let numDocs = 1;
let numArtboardsAtivo = 1;
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

function getRadioPasta() {
  return Array.from(radiosPasta).find((r) => r.checked).value;
}

function atualizarPasta() {
  const usarMesma = getRadioPasta() === "mesma";
  inputPasta.disabled = usarMesma;
  if (usarMesma) inputPasta.value = "";
}

function coletarArgs() {
  const usarMesmaPasta = getRadioPasta() === "mesma";
  const docIndices = [];
  const cbs = docChecks.querySelectorAll("input[type=checkbox]");
  for (let i = 0; i < cbs.length; i++) {
    if (cbs[i].checked) docIndices.push(parseInt(cbs[i].value, 10));
  }
  return [
    parseInt(ddPreset.value, 10),
    usarMesmaPasta,
    inputPasta.value.trim(),
    chkView.checked,
    chkSalvarAntes.checked,
    chkPaginaPorArquivo.checked,
    parseInt(ddNome.value, 10),
    docIndices,
    chkOcultarFaca.checked,
    chkArtboardUnica.checked,
    chkArtboardUnica.checked ? parseInt(ddArtboard.value, 10) : -1
  ];
}

function carregarPresets() {
  sendToHost("listarPresets")
    .then((result) => {
      if (!result) return;
      const presets = String(result).split("|").filter((s) => s.length > 0);
      presets.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = String(ddPreset.options.length);
        opt.textContent = p;
        ddPreset.appendChild(opt);
      });
    })
    .catch(() => {});
}

function carregarDocumentos() {
  sendToHost("listarDocumentos")
    .then((result) => {
      if (!result) return;
      const raw = String(result);
      const m = /^#(-?\d+)#([\s\S]*)$/.exec(raw);
      let texto = raw;
      activeDocIndex = -1;
      if (m) {
        activeDocIndex = parseInt(m[1], 10);
        if (isNaN(activeDocIndex)) activeDocIndex = -1;
        texto = m[2];
      }
      const docs = texto.split("|").filter((s) => s.length > 0);
      numDocs = docs.length;
      if (activeDocIndex < 0 && docs.length > 0) activeDocIndex = 0;
      if (numDocs <= 1) {
        fieldsetDocs.style.display = "none";
        return;
      }
      fieldsetDocs.style.display = "";
      docs.forEach((nome, i) => {
        const label = document.createElement("label");
        label.className = "check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = String(i);
        cb.checked = activeDocIndex >= 0 ? i === activeDocIndex : i === 0;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(nome));
        docChecks.appendChild(label);
      });
    })
    .catch(() => {});
}

function marcarTodos() {
  const cbs = docChecks.querySelectorAll("input[type=checkbox]");
  for (let i = 0; i < cbs.length; i++) cbs[i].checked = true;
}

function desmarcarTodos() {
  const cbs = docChecks.querySelectorAll("input[type=checkbox]");
  for (let i = 0; i < cbs.length; i++) {
    cbs[i].checked = activeDocIndex >= 0 && parseInt(cbs[i].value, 10) === activeDocIndex;
  }
}

function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function atualizarArtboardsUI() {
  const disponivel = numArtboardsAtivo > 1;
  if (!disponivel) {
    chkPaginaPorArquivo.checked = false;
    chkArtboardUnica.checked = false;
  }
  chkPaginaPorArquivo.disabled = !disponivel || chkArtboardUnica.checked;
  chkArtboardUnica.disabled = !disponivel || chkPaginaPorArquivo.checked;
  const usarArtboard = disponivel && chkArtboardUnica.checked;
  fieldArtboardUnica.style.display = usarArtboard ? "" : "none";
  ddArtboard.disabled = !usarArtboard;
  ddNome.disabled = !(chkPaginaPorArquivo.checked && !chkArtboardUnica.checked);
}

function carregarArtboards() {
  return sendToHost("listarArtboards")
    .then((result) => {
      ddArtboard.innerHTML = "";
      if (!result) {
        numArtboardsAtivo = 0;
        atualizarArtboardsUI();
        return;
      }
      const partes = String(result).split("|");
      const ativo = parseInt(partes[0], 10) || 0;
      const nomes = partes.slice(1);
      numArtboardsAtivo = nomes.length;
      nomes.forEach((nome, i) => {
        const opt = document.createElement("option");
        const nomeTrim = String(nome || "").trim();
        const rotulo = nomeTrim !== "" ? nomeTrim : "Artboard " + (i + 1);
        opt.value = String(i);
        opt.textContent = pad2(i + 1) + "-" + rotulo;
        ddArtboard.appendChild(opt);
      });
      if (ativo >= 0 && ativo < nomes.length) ddArtboard.value = String(ativo);
      atualizarArtboardsUI();
    })
    .catch(() => {});
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
  carregarPresets();
  carregarDocumentos();
  carregarArtboards();
  document.getElementById("btnMarcarTodos").addEventListener("click", marcarTodos);
  document.getElementById("btnDesmarcarTodos").addEventListener("click", desmarcarTodos);
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());
Array.from(radiosPasta).forEach((r) => r.addEventListener("change", atualizarPasta));
chkArtboardUnica.addEventListener("change", () => {
  if (chkArtboardUnica.checked) {
    chkPaginaPorArquivo.checked = false;
    atualizarArtboardsUI();
    carregarArtboards();
    return;
  }
  atualizarArtboardsUI();
});
chkPaginaPorArquivo.addEventListener("change", () => {
  if (chkPaginaPorArquivo.checked) chkArtboardUnica.checked = false;
  atualizarArtboardsUI();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
