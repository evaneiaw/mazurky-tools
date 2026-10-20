const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const preview = document.getElementById("preview");
const chkReorganizar = document.getElementById("chkReorganizar");
const inputColunas = document.getElementById("colunas");
const inputEspacamento = document.getElementById("espacamento");
const optsInfo = document.getElementById("optsInfo");

const OPTS_KEY = "mazurky_tamanhoartboard_opts";

let csInterface = null;
let timerPoll = null;
let ultimaAssinatura = "";

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

function lerColunas() {
  const n = parseInt(inputColunas.value, 10);
  return isNaN(n) || n < 1 ? 4 : n;
}

function lerEspacamento() {
  const n = parseFloat(inputEspacamento.value);
  return isNaN(n) || n < 0 ? 0 : n;
}

function atualizarOptsInfo() {
  if (chkReorganizar.checked) {
    optsInfo.textContent = "reorganizar: ligado · " + lerColunas() + " colunas · " + lerEspacamento() + " mm";
  } else {
    optsInfo.textContent = "reorganizar: desligado";
  }
  inputColunas.disabled = !chkReorganizar.checked;
  inputEspacamento.disabled = !chkReorganizar.checked;
}

function salvarOpts() {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify({
      reorganizar: chkReorganizar.checked,
      colunas: lerColunas(),
      espacamento: lerEspacamento()
    }));
  } catch (e) {}
}

function carregarOpts() {
  try {
    const raw = localStorage.getItem(OPTS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") {
        if (o.reorganizar !== undefined) chkReorganizar.checked = !!o.reorganizar;
        if (o.colunas !== undefined) inputColunas.value = o.colunas;
        if (o.espacamento !== undefined) inputEspacamento.value = o.espacamento;
      }
    }
  } catch (e) {}
  atualizarOptsInfo();
}

function fmt(v) {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function boxHtml(a, escala, ativa) {
  const w = Math.max(8, Math.round(a.largura * escala));
  const h = Math.max(8, Math.round(a.altura * escala));
  return (
    (ativa ? '<div class="ab-tag">ATIVA</div>' : "") +
    '<div class="ab-w">' + fmt(a.largura) + "</div>" +
    '<div class="ab-mid">' +
    '<div class="ab-h">' + fmt(a.altura) + "</div>" +
    '<div class="ab-box' + (ativa ? " ativa" : "") + '" style="width:' + w + "px;height:" + h + 'px;"></div>' +
    "</div>"
  );
}

function renderPreview(dados) {
  preview.innerHTML = "";
  const ativo = dados.ativo;
  const abs = dados.artboards || [];
  if (!abs.length) return;
  let maxDim = 0;
  abs.forEach((a) => { maxDim = Math.max(maxDim, a.largura, a.altura); });
  if (maxDim <= 0) maxDim = 1;
  const escala = 140 / maxDim;

  const a = abs.find((x) => x.index === ativo) || abs[0];
  const ativoDiv = document.createElement("div");
  ativoDiv.className = "ab-ativo";
  ativoDiv.innerHTML = boxHtml(a, escala, true);
  preview.appendChild(ativoDiv);

  const outras = abs.filter((x) => x.index !== ativo);
  if (outras.length) {
    const divisor = document.createElement("div");
    divisor.className = "ab-divisor";
    preview.appendChild(divisor);

    const row = document.createElement("div");
    row.className = "ab-outras";
    outras.forEach((o) => {
      const d = document.createElement("div");
      d.className = "ab-item";
      d.innerHTML = boxHtml(o, escala, false);
      row.appendChild(d);
    });
    preview.appendChild(row);
  }
}

function atualizarPreview(res) {
  if (typeof res !== "string" || res.indexOf("ERRO") === 0) {
    setStatus(res && res.indexOf("ERRO") === 0 ? res.substring(5) : String(res), "err");
    return;
  }
  let dados;
  try {
    dados = JSON.parse(res);
  } catch (e) {
    setStatus("Erro ao interpretar as artboards.", "err");
    return;
  }
  renderPreview(dados);
  setStatus("Artboard ativa: " + (dados.ativo + 1) + " de " + dados.artboards.length + ".", "ok");
}

function poll() {
  if (!document.getElementById("preview")) {
    pararPolling();
    return;
  }
  sendToHost("listarArtboards", [])
    .then((res) => {
      if (typeof res !== "string" || res.indexOf("ERRO") === 0) return;
      if (res === ultimaAssinatura) return;
      ultimaAssinatura = res;
      atualizarPreview(res);
    })
    .catch(() => {});
}

function iniciarPolling() {
  pararPolling();
  poll();
  timerPoll = setInterval(poll, 700);
}

function pararPolling() {
  if (timerPoll) {
    clearInterval(timerPoll);
    timerPoll = null;
  }
}

function executar() {
  btnExecutar.disabled = true;
  setStatus("Executando...");
  salvarOpts();
  const args = [chkReorganizar.checked, lerColunas(), lerEspacamento()];
  sendToHost("executar", args)
    .then((result) => {
      const ok = result && String(result).indexOf("Erro") !== 0;
      setStatus(String(result), ok ? "ok" : "err");
      if (ok) {
        ultimaAssinatura = "";
        poll();
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
  carregarOpts();
  setStatus("Carregando...");
  iniciarPolling();
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => {
  pararPolling();
  window.close();
});
window.addEventListener("beforeunload", pararPolling);

[chkReorganizar, inputColunas, inputEspacamento].forEach((el) => {
  el.addEventListener("change", () => {
    atualizarOptsInfo();
    salvarOpts();
  });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
