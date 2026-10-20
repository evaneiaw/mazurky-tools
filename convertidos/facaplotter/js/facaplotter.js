const MY_EXT_ID = "com.mazurky.tools.facaplotter";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const radiosEspelho = document.getElementsByName("espelho");
const radiosModo = document.getElementsByName("modo");
const fieldsetDocs = document.getElementById("fieldsetDocs");
const docChecks = document.getElementById("docChecks");
const chkReabrir = document.getElementById("chkReabrir");
const chkSalvarAntes = document.getElementById("chkSalvarAntes");
const chkPorArtboard = document.getElementById("chkPorArtboard");
const fieldArtboard = document.getElementById("fieldArtboard");
const selectArtboard = document.getElementById("selectArtboard");
const progressBox = document.getElementById("progressBox");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

let csInterface = null;
let cancelado = false;

function setStatus(message, type) {
  statusText.className = "status-text" + (type ? " " + type : "");
  statusText.textContent = message;
}

function showProgress(visivel) {
  if (!progressBox) return;
  progressBox.style.display = visivel ? "" : "none";
}

function setProgress(atual, total, texto) {
  if (!progressBox) return;
  const pct = total > 0 ? Math.round((atual / total) * 100) : 0;
  if (progressFill) progressFill.style.width = pct + "%";
  if (progressLabel) {
    progressLabel.textContent = texto + " (" + atual + "/" + total + ")";
  }
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

function getRadioValue(name) {
  return Array.from(document.getElementsByName(name)).find((r) => r.checked).value;
}

function getModo() {
  return parseInt(getRadioValue("modo"), 10);
}

function atualizarModo() {
  fieldsetDocs.style.display = getModo() === 1 ? "" : "none";
  atualizarArtboard();
}

function atualizarArtboard() {
    sendToHost("listarArtboards")
        .then((result) => {
            selectArtboard.innerHTML = "";
            if (!result) return;
            var itens = String(result).split("|").filter(function (s) { return s.length > 0; });
            itens.forEach(function (nome) {
                var opt = document.createElement("option");
                var partes = nome.split("-");
                opt.value = parseInt(partes[0], 10) - 1;
                opt.textContent = nome;
                selectArtboard.appendChild(opt);
            });
            var n = itens.length;
            if (n <= 1) {
                chkPorArtboard.disabled = true;
                chkPorArtboard.checked = false;
                fieldArtboard.style.display = "none";
            } else {
                chkPorArtboard.disabled = false;
                fieldArtboard.style.display = chkPorArtboard.checked ? "none" : "";
            }
        })
        .catch(function () {});
}

function coletarArgs() {
  const espelho = getRadioValue("espelho");
  const modo = getModo();
  const docIndices = [];
  const cbs = docChecks.querySelectorAll("input[type=checkbox]");
  for (let i = 0; i < cbs.length; i++) {
    if (cbs[i].checked) docIndices.push(i);
  }
  const artboardIndex = chkPorArtboard.checked ? -1 : parseInt(selectArtboard.value, 10);
  return [
    espelho,
    modo,
    docIndices,
    chkReabrir.checked,
    chkSalvarAntes.checked,
    chkPorArtboard.checked,
    artboardIndex
  ];
}

function carregarDocumentos() {
  sendToHost("listarDocumentos")
    .then((result) => {
      if (!result) return;
      const docsAbertos = String(result).split("|").filter((s) => s.length > 0);
      docChecks.innerHTML = "";
      docsAbertos.forEach((nome) => {
        const label = document.createElement("label");
        label.className = "check";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(nome));
        docChecks.appendChild(label);
      });
    })
    .catch(() => {});
}

function carregarConfig() {
  sendToHost("getConfig")
    .then((result) => {
      try {
        const cfg = JSON.parse(result);
        if (!cfg) return;
        for (const r of radiosEspelho) r.checked = r.value === (cfg.espelho || "H");
        for (const r of radiosModo) r.checked = cfg.modo === Number(r.value);
        chkReabrir.checked = !!cfg.reabrir;
        chkSalvarAntes.checked = !!cfg.salvarAntes;
        if (chkPorArtboard) chkPorArtboard.checked = cfg.porArtboard !== false;
        atualizarModo();
        atualizarArtboard();
      } catch (e) {}
    })
    .catch(() => {});
}

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gera 1 PDF por prancheta, uma chamada do host por prancheta (permite
// atualizar a barra de progresso entre elas).
async function executarPorPrancheta(args) {
  const inicio = Date.now();
  const r = await sendToHost("executar", args.concat(["iniciar"]));
  const texto = String(r === undefined || r === null ? "" : r);

  if (texto.indexOf("OK|") !== 0) {
    await sendToHost("executar", args.concat(["cancelar"])).catch(() => {});
    return texto;
  }

  // "OK|job0:qtdPranchetas|job1:qtdPranchetas|..."
  const jobs = texto
    .slice(3)
    .split("|")
    .filter((s) => s.length > 0)
    .map((s) => {
      const p = s.split(":");
      return { job: parseInt(p[0], 10), nAb: parseInt(p[1], 10) || 0 };
    });

  let total = 0;
  for (const j of jobs) total += j.nAb;

  showProgress(true);
  setProgress(0, total, "Preparando");

  const detalhes = [];
  let houveErro = false;
  let feitos = 0;
  const multiplosDocs = jobs.length > 1;

  for (let j = 0; j < jobs.length; j++) {
    const job = jobs[j];
    for (let a = 0; a < job.nAb; a++) {
      if (cancelado) break;
      const rotulo = multiplosDocs
        ? "Prancheta " + (a + 1) + " (doc " + (j + 1) + ")"
        : "Prancheta " + (a + 1);
      setProgress(feitos, total, rotulo);
      try {
        await dormir(1);
        const res = await sendToHost("executar", args.concat(["prancheta", { job: job.job, ab: a }]));
        const t = String(res === undefined || res === null ? "" : res);
        if (t !== "OK") {
          houveErro = true;
          detalhes.push(t);
        }
      } catch (e) {
        houveErro = true;
        detalhes.push("Erro: " + e.message);
        break;
      }
      feitos++;
      setProgress(feitos, total, rotulo);
    }
    if (cancelado) break;
  }

  if (cancelado) {
    await sendToHost("executar", args.concat(["cancelar"])).catch(() => {});
    showProgress(false);
    return "Cancelado pelo usuário.";
  }

  const fim = await sendToHost("executar", args.concat(["finalizar"]));
  showProgress(false);

  const seg = Math.round((Date.now() - inicio) / 100) / 10;
  const cabecalho = houveErro ? "Concluído com erro em " : "Concluído em ";
  const corpo = houveErro ? detalhes.join("\n") : "Todos os PDFs foram gerados.";
  const fimTexto = String(fim === undefined || fim === null ? "" : fim);
  if (fimTexto && fimTexto !== "OK") {
    return cabecalho + seg + "s\n" + corpo + "\n" + fimTexto;
  }
  return cabecalho + seg + "s\n" + corpo;
}

// PDF único (prancheta escolhida) ou modo sem progresso: uma chamada só.
async function executarChamadaUnica(args) {
  const inicio = Date.now();
  showProgress(true);
  setProgress(0, 1, "Processando");
  try {
    const r = await sendToHost("executar", args);
    return { texto: String(r), seg: (Date.now() - inicio) / 1000 };
  } finally {
    showProgress(false);
  }
}

async function executar() {
  if (btnExecutar.disabled) return;
  btnExecutar.disabled = true;
  cancelado = false;
  setStatus("Executando...");

  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    btnExecutar.disabled = false;
    return;
  }

  const porPrancheta = chkPorArtboard.checked;
  let resultado = "";
  let ok = true;

  try {
    if (porPrancheta) {
      resultado = await executarPorPrancheta(args);
      ok = resultado.indexOf("Erro") === -1 && resultado.indexOf("erro") === -1 &&
           resultado.indexOf("Cancelado") === -1;
    } else {
      const r = await executarChamadaUnica(args);
      resultado = r.texto;
      ok = resultado.indexOf("Erro") === -1;
    }
  } catch (e) {
    resultado = "Erro: " + e.message;
    ok = false;
  }

  if (ok) {
    setStatus(resultado, "ok");
    setTimeout(function () { window.close(); }, 2000);
  } else {
    setStatus(resultado, "err");
  }
  btnExecutar.disabled = false;
}

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });
  if (btnFechar) {
    btnFechar.addEventListener("click", () => {
      cancelado = true;
      window.close();
    });
  }
  btnExecutar.addEventListener("click", executar);
  Array.from(radiosModo).forEach((r) => r.addEventListener("change", atualizarModo));
  chkPorArtboard.addEventListener("change", atualizarArtboard);
  showProgress(false);
  carregarDocumentos();
  carregarConfig();
  setStatus("Pronto.");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
