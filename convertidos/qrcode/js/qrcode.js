const MY_EXT_ID = "com.mazurky.tools.qrcode";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnDetectar = document.getElementById("btnDetectar");
const btnFechar = document.getElementById("btnFechar");
const preview = document.getElementById("preview");
const previewImg = document.getElementById("previewImg");
const previewInfo = document.getElementById("previewInfo");
const chkDesenharGrid = document.getElementById("chkDesenharGrid");
const selectCor = document.getElementById("selectCor");

let csInterface = null;
let deteccao = null;
let imagemOriginal = null;

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

function luminancia(d, p) {
  const i = p * 4;
  return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
}

function mediana(arr) {
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

function detectarQR(img) {
  const CW = 1000;
  const scale = Math.min(1, CW / img.naturalWidth, CW / img.naturalHeight);
  const W = Math.max(1, Math.round(img.naturalWidth * scale));
  const H = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const bin = new Uint8Array(W * H);
  for (let p = 0; p < bin.length; p++) {
    bin[p] = luminancia(d, p) < 128 ? 1 : 0;
  }

  // Varre por linha procurando o padrão 1:1:3:1:1 dos finder patterns.
  const candidatos = [];
  for (let y = 0; y < H; y++) {
    const row = y * W;
    const runs = [];
    let cur = bin[row];
    let len = 1;
    let xs = 0;
    for (let x = 1; x <= W; x++) {
      if (x < W && bin[row + x] === cur) {
        len++;
      } else {
        runs.push([cur, len, xs]);
        if (x < W) {
          cur = bin[row + x];
          len = 1;
          xs = x;
        }
      }
    }
    for (let j = 0; j + 4 < runs.length; j++) {
      const ra = runs[j], rb = runs[j + 1], rc = runs[j + 2], rd = runs[j + 3], re = runs[j + 4];
      if (ra[0] !== 1 || rb[0] !== 0 || rc[0] !== 1 || rd[0] !== 0 || re[0] !== 1) continue;
      const m = rc[1] / 3;
      if (m < 1) continue;
      let ok = true;
      const laterais = [ra[1], rb[1], rd[1], re[1]];
      for (let k = 0; k < 4; k++) {
        if (Math.abs(laterais[k] - m) > m * 0.5) ok = false;
      }
      if (Math.abs(rc[1] - 3 * m) > m * 0.8) ok = false;
      if (!ok) continue;
      candidatos.push({ x: rc[2] + rc[1] / 2, y: y, m: m });
    }
  }

  if (candidatos.length < 6) {
    return { erro: "Não foi possível detectar os marcadores do QR (padrão 1:1:3:1:1 não encontrado)." };
  }

  // Agrupa candidatos próximos em clusters (cada finder = um cluster).
  const clusters = [];
  candidatos.forEach((c) => {
    for (let k = 0; k < clusters.length; k++) {
      const cl = clusters[k];
      if (Math.abs(cl.x - c.x) < cl.m * 1.5 && Math.abs(cl.y - c.y) < cl.m * 1.5) {
        cl.count++;
        cl.x = (cl.x * (cl.count - 1) + c.x) / cl.count;
        cl.y = (cl.y * (cl.count - 1) + c.y) / cl.count;
        cl.m = (cl.m * (cl.count - 1) + c.m) / cl.count;
        return;
      }
    }
    clusters.push({ x: c.x, y: c.y, m: c.m, count: 1 });
  });
  clusters.sort((a, b) => b.count - a.count);
  const top = clusters.slice(0, 3);
  if (top.length < 3) {
    return { erro: "Marcadores do QR não encontrados. A imagem está rotacionada, estilizada ou sem borda silenciosa?" };
  }

  const m0 = mediana(candidatos.map((c) => c.m));
  let tl = top[0], tr = top[0], bl = top[0];
  top.forEach((c) => {
    if (c.x + c.y < tl.x + tl.y) tl = c;
    if (c.x > tr.x) tr = c;
    if (c.y > bl.y) bl = c;
  });

  const dx = tr.x - tl.x;
  const dy = tr.y - tl.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const N = Math.round(dist / m0) + 7;
  if (N < 21 || N > 177) {
    return { erro: "Dimensão do QR inválida (" + N + "). Verifique a imagem." };
  }

  const ox = tl.x - 3.5 * m0;
  const oy = tl.y - 3.5 * m0;
  const matriz = [];
  let pretos = 0;
  for (let r = 0; r < N; r++) {
    let linha = "";
    for (let c = 0; c < N; c++) {
      const px = Math.round(ox + (c + 0.5) * m0);
      const py = Math.round(oy + (r + 0.5) * m0);
      let bit = 0;
      if (px >= 0 && px < W && py >= 0 && py < H) bit = bin[py * W + px];
      if (bit === 1) pretos++;
      linha += bit === 1 ? "1" : "0";
    }
    matriz.push(linha);
  }

  return { matriz, n: N, modPx: m0 / scale, ox: ox / scale, oy: oy / scale, pretos, ok: true };
}

function renderizarPrevia() {
  if (!imagemOriginal) return;
  const cv = document.createElement("canvas");
  const cap = 160;
  const scale = Math.min(1, cap / imagemOriginal.naturalWidth, cap / imagemOriginal.naturalHeight);
  cv.width = Math.max(1, Math.round(imagemOriginal.naturalWidth * scale));
  cv.height = Math.max(1, Math.round(imagemOriginal.naturalHeight * scale));
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imagemOriginal, 0, 0, cv.width, cv.height);
  if (deteccao && deteccao.ok && chkDesenharGrid.checked) {
    ctx.strokeStyle = "#d7373f";
    ctx.lineWidth = 1;
    const m = deteccao.modPx * scale;
    const ox = (deteccao.ox * scale);
    const oy = (deteccao.oy * scale);
    const n = deteccao.n;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * m, 0);
      ctx.lineTo(ox + i * m, cv.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, oy + i * m);
      ctx.lineTo(cv.width, oy + i * m);
      ctx.stroke();
    }
  }
  previewImg.src = cv.toDataURL();
  preview.classList.remove("hidden");
  previewInfo.textContent = deteccao && deteccao.ok
    ? deteccao.n + "x" + deteccao.n + " · " + deteccao.pretos + " módulos escuros"
    : (imagemOriginal.naturalWidth + "x" + imagemOriginal.naturalHeight + " px");
}

// Chance de cache dos arquivos carregados pelo painel.
function cacheBuster(url) {
  return url + "?_ts=" + Date.now();
}

// Pede ao host para exportar a imagem selecionada no documento e detecta o QR.
function carregarDoDocumento() {
  if (!csInterface) {
    setStatus("CSInterface não inicializado.", "err");
    return;
  }
  setStatus("Lendo imagem selecionada do documento...");
  btnDetectar.disabled = true;
  sendToHost("exportarImagemParaDetectar", [])
    .then((result) => {
      if (!result || result.indexOf("ok:") !== 0) {
        deteccao = null;
        setStatus(String(result || "Erro ao ler a imagem."), "err");
        return;
      }
      const relPath = result.substring(3);
      return fetch(cacheBuster(relPath))
        .then((r) => r.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            imagemOriginal = img;
            const det = detectarQR(img);
            if (det.ok) {
              deteccao = Object.assign({}, det, {
                w: img.naturalWidth,
                h: img.naturalHeight
              });
              setStatus("QR detectado: " + det.n + "x" + det.n, "ok");
            } else {
              deteccao = null;
              setStatus(det.erro, "err");
            }
            renderizarPrevia();
          };
          img.onerror = () => {
            deteccao = null;
            setStatus("Erro ao carregar a imagem exportada do documento.", "err");
          };
          img.src = url;
        });
    })
    .catch((e) => {
      deteccao = null;
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnDetectar.disabled = false;
    });
}

function coletarArgs() {
  return [deteccao.matriz, deteccao.ox, deteccao.oy, deteccao.modPx, deteccao.w, deteccao.h, selectCor.value];
}

function executar() {
  if (!deteccao || !deteccao.ok) {
    setStatus("Selecione a imagem no Illustrator e clique em \"Detectar QR\" antes de executar.", "err");
    return;
  }
  btnExecutar.disabled = true;
  setStatus("Gerando vetor QR Code...");
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    btnExecutar.disabled = false;
    return;
  }
  sendToHost("gerarQr", args)
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
  setStatus("Selecione a imagem no Illustrator e clique em \"Detectar QR\".");
}

btnExecutar.addEventListener("click", executar);
btnDetectar.addEventListener("click", carregarDoDocumento);
btnFechar.addEventListener("click", () => window.close());
chkDesenharGrid.addEventListener("change", renderizarPrevia);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}