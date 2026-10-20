const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const btnRemover = document.getElementById("btnRemover");
const btnFecharPreview = document.getElementById("btnFecharPreview");
const btnAtualizar = document.getElementById("btnAtualizar");
const contentEl = document.getElementById("content");
const actionsEl = document.getElementById("actions");
const previewView = document.getElementById("previewView");
const previewInfo = document.getElementById("previewInfo");
const canvas = document.getElementById("previewCanvas");

let csInterface = null;
let dadosPreview = null;

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

function mostrarPreview(dados) {
  dadosPreview = dados;
  contentEl.style.display = "none";
  actionsEl.style.display = "none";
  previewView.style.display = "flex";
  renderizarPreview();
  expandirJanela();
  const msg =
    dados.duplicadas > 0
      ? dados.duplicadas + " duplicadas de " + dados.total + " caminhos."
      : "Nenhuma duplicata encontrada (" + dados.total + " caminhos).";
  previewInfo.textContent = msg;
  setStatus(msg, "ok");
}

function expandirJanela() {
  try {
    const aw = screen.availWidth || 1920;
    const ah = screen.availHeight || 1080;
    const w = Math.round(aw * 0.97);
    const h = Math.round(ah * 0.94);
    window.resizeTo(w, h);
    window.moveTo(Math.round((aw - w) / 2), Math.round((ah - h) / 2));
  } catch (e) {}
}

function renderizarPreview() {
  const ctx = canvas.getContext("2d");
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (W === 0 || H === 0) return;
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (!dadosPreview) return;

  const L = dadosPreview.limites;
  const minX = L[0], minY = L[1], maxX = L[2], maxY = L[3];
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const pad = 40;
  const scale = Math.max(0.01, Math.min((W - 2 * pad) / dx, (H - 2 * pad) / dy));
  const offX = (W - dx * scale) / 2;
  const offY = (H - dy * scale) / 2;
  const sx = (x) => offX + (x - minX) * scale;
  const sy = (y) => offY + (maxY - y) * scale;

  function desenharCaminho(p, cor, largura) {
    const pts = p.p;
    if (!pts || pts.length === 0) return;
    ctx.beginPath();
    ctx.strokeStyle = cor;
    ctx.lineWidth = largura;
    ctx.moveTo(sx(pts[0][0]), sy(pts[0][1]));
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      if (!p.f && i === n - 1) break;
      const cur = pts[i];
      const nxt = pts[(i + 1) % n];
      ctx.bezierCurveTo(
        sx(cur[4]), sy(cur[5]),
        sx(nxt[2]), sy(nxt[3]),
        sx(nxt[0]), sy(nxt[1])
      );
    }
    if (p.f) ctx.closePath();
    ctx.stroke();
  }

  const lw = Math.max(1, Math.min(4, scale * 0.25));
  const lwDup = Math.max(2, lw * 2);
  for (let i = 0; i < dadosPreview.caminhos.length; i++) {
    const p = dadosPreview.caminhos[i];
    if (!p.d) desenharCaminho(p, "#9a9a9a", lw);
  }
  for (let i = 0; i < dadosPreview.caminhos.length; i++) {
    const p = dadosPreview.caminhos[i];
    if (p.d) desenharCaminho(p, "#ff00ff", lwDup);
  }
}

function executar() {
  btnExecutar.disabled = true;
  setStatus("Analisando duplicadas...");
  sendToHost("analisarDuplicadas", [])
    .then((result) => {
      const r = String(result);
      if (r.indexOf("ERRO:") === 0) {
        setStatus(r, "err");
        return;
      }
      mostrarPreview(JSON.parse(r));
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
    });
}

function removerDuplicadas() {
  btnRemover.disabled = true;
  setStatus("Removendo duplicadas...");
  sendToHost("executar", [])
    .then((result) => {
      const r = String(result);
      if (r.indexOf("Erro") === 0) {
        setStatus(r, "err");
        return;
      }
      setStatus(r, "ok");
      return sendToHost("analisarDuplicadas", []);
    })
    .then((res) => {
      if (!res) return;
      const r = String(res);
      if (r.indexOf("ERRO:") === 0) return;
      dadosPreview = JSON.parse(r);
      renderizarPreview();
      const msg =
        dadosPreview.duplicadas > 0
          ? dadosPreview.duplicadas + " duplicadas restantes de " + dadosPreview.total + " caminhos."
          : "Nenhuma duplicata restante (" + dadosPreview.total + " caminhos).";
      previewInfo.textContent = msg;
      setStatus(msg, "ok");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnRemover.disabled = false;
    });
}

function atualizar() {
  btnExecutar.disabled = true;
  setStatus("Atualizando...");
  sendToHost("analisarDuplicadas", [])
    .then((result) => {
      const r = String(result);
      if (r.indexOf("ERRO:") === 0) {
        setStatus(r, "err");
        return;
      }
      mostrarPreview(JSON.parse(r));
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnExecutar.disabled = false;
    });
}

function fechar() {
  try {
    window.resizeTo(640, 600);
  } catch (e) {}
  window.close();
}

function init() {
  csInterface = new CSInterface();
  window.addEventListener("resize", renderizarPreview);
  setStatus("Pronto.");
  executar();
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", fechar);
btnRemover.addEventListener("click", removerDuplicadas);
btnFecharPreview.addEventListener("click", fechar);
btnAtualizar.addEventListener("click", atualizar);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}