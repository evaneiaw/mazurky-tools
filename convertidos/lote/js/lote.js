const MY_EXT_ID = "com.mazurky.tools.lote";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const btnBuscar = document.getElementById("btnBuscar");
const inputLote = document.getElementById("lote");
const dataIni = document.getElementById("dataIni");
const dataFim = document.getElementById("dataFim");
const listaOF = document.getElementById("listaOF");
const ftInfo = document.getElementById("ftInfo");
const refInfo = document.getElementById("refInfo");

const splash = document.getElementById("splash");
const splashMsg = document.getElementById("splashMsg");
const splashBtn = document.getElementById("splashBtn");

let csInterface = null;
let extRoot = "";
let ofSelecionada = null;

function setStatus(message, type) {
  if (type === "err") {
    mostrarSplash(message);
    return;
  }
  statusText.className = "status-text" + (type ? " " + type : "");
  statusText.textContent = message;
}

function mostrarSplash(message) {
  splashMsg.textContent = message;
  splash.classList.remove("hidden");
}

function fecharSplash() {
  splash.classList.add("hidden");
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
      if (result === "Eval script error.") {
        reject(new Error("Erro no ExtendScript."));
      } else {
        resolve(result);
      }
    });
  });
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function toISO(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function addMonths(d, n) {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + n);
  return r;
}

function isoToBR(iso) {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
}

function formatarOF(n) {
  let s = String(n == null ? "" : n).replace(/\D/g, "");
  if (!s) return "";
  s = ("000000" + s).slice(-6);
  return s.slice(0, 3) + "." + s.slice(3);
}

function atualizarExecutar() {
  btnExecutar.disabled = inputLote.value.replace(/\D/g, "") === "";
}

function limparSelecao() {
  ofSelecionada = null;
  listaOF.querySelectorAll(".of-row.sel").forEach((el) => el.classList.remove("sel"));
}

function renderVazio(msg) {
  listaOF.innerHTML = "";
  const p = document.createElement("p");
  p.className = "lista-vazia";
  p.textContent = msg;
  listaOF.appendChild(p);
}

function selecionarOF(o, row) {
  ofSelecionada = o;
  listaOF.querySelectorAll(".of-row.sel").forEach((el) => el.classList.remove("sel"));
  if (row) row.classList.add("sel");
  inputLote.value = o.ofFormatada || formatarOF(o.of);
  atualizarExecutar();
  setStatus("OF " + (o.ofFormatada || o.of) + " selecionada.", "ok");
}

function renderLista(ofs) {
  listaOF.innerHTML = "";
  if (!ofs || !ofs.length) {
    renderVazio("Nenhuma OF (pedido) no período para esta referência.");
    return;
  }

  const head = document.createElement("div");
  head.className = "of-row of-head";
  head.innerHTML =
    '<span class="c-of">OF</span>' +
    '<span class="c-ref">Ref</span>' +
    '<span class="c-data">Data</span>' +
    '<span class="c-entrega">Entrega</span>' +
    '<span class="c-qt">Qt</span>' +
    '<span class="c-sit">Situação</span>';
  listaOF.appendChild(head);

  ofs.forEach((o) => {
    const row = document.createElement("div");
    row.className = "of-row" + (o.emitida ? "" : " pendente");
    row.dataset.of = o.of;

    const cOf = document.createElement("span");
    cOf.className = "c-of";
    cOf.textContent = o.ofFormatada || formatarOF(o.of);

    const cRef = document.createElement("span");
    cRef.className = "c-ref";
    cRef.textContent = o.referencia || "";
    if (o.referencia) cRef.title = o.referencia;

    const cData = document.createElement("span");
    cData.className = "c-data";
    cData.textContent = isoToBR(o.data);

    const cEntrega = document.createElement("span");
    cEntrega.className = "c-entrega";
    cEntrega.textContent = isoToBR(o.entrega);

    const cQt = document.createElement("span");
    cQt.className = "c-qt";
    cQt.textContent = o.quantidade ? String(o.quantidade) : "";

    const cSit = document.createElement("span");
    cSit.className = "c-sit";
    cSit.textContent = o.emitida ? "Emitida" : "Pendente";

    row.appendChild(cOf);
    row.appendChild(cRef);
    row.appendChild(cData);
    row.appendChild(cEntrega);
    row.appendChild(cQt);
    row.appendChild(cSit);
    row.addEventListener("click", () => selecionarOF(o, row));
    listaOF.appendChild(row);
  });
}

function getFT() {
  try {
    return window.MazurkyFT ? window.MazurkyFT.get() : "";
  } catch (e) {
    return "";
  }
}

function buscarOFs(forcar) {
  const ft = getFT();
  ftInfo.textContent = ft || "—";

  if (!ft) {
    renderVazio("Informe a FT na tela inicial (Home) e reabra a ferramenta.");
    setStatus("FT não informada na Home.", "err");
    return;
  }
  const ini = dataIni.value;
  const fim = dataFim.value;
  if (!ini || !fim) {
    setStatus("Período inválido.", "err");
    return;
  }
  if (ini > fim) {
    setStatus("Data inicial maior que a data final.", "err");
    return;
  }
  if (!window.MazurkyFTAPI || !window.MazurkyFTAPI.historicoOF) {
    setStatus("API da FT indisponível.", "err");
    return;
  }

  btnBuscar.disabled = true;
  renderVazio("Buscando OFs de " + isoToBR(ini) + " a " + isoToBR(fim) + "...");
  setStatus("Consultando NF do período...");

  window.MazurkyFTAPI.historicoOF(ft, ini, fim, !!forcar)
    .then((res) => {
      refInfo.textContent = res.referencia || "";
      renderLista(res.ofs || []);
      const n = res.ofs ? res.ofs.length : 0;
      setStatus(n + " OF(s) encontrada(s).", "ok");
    })
    .catch((e) => {
      renderVazio("Falha ao buscar OFs.");
      setStatus("Erro: " + (e && e.message ? e.message : e), "err");
    })
    .finally(() => {
      btnBuscar.disabled = false;
    });
}

function executar() {
  const lote = inputLote.value.replace(/\D/g, "");
  if (!lote) {
    setStatus("Selecione uma OF ou digite o lote.", "err");
    return;
  }
  btnExecutar.disabled = true;
  setStatus("Executando...");
  const caminhoSelo = extRoot
    ? extRoot.replace(/[\\/]+$/, "") + "/convertidos/lote/selo.ai"
    : "";
  sendToHost("executar", [lote, caminhoSelo])
    .then((result) => {
      const texto = String(result);
      setStatus(texto, texto.indexOf("Erro") !== 0 ? "ok" : "err");
      if (texto.indexOf("Erro") !== 0) {
        setTimeout(function () { window.close(); }, 2000);
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      atualizarExecutar();
    });
}

function init() {
  csInterface = new CSInterface();
  try {
    extRoot = csInterface.getSystemPath(SystemPath.EXTENSION) || "";
  } catch (e) {
    extRoot = "";
  }
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });

  const hoje = new Date();
  dataIni.value = toISO(addMonths(hoje, -3));
  dataFim.value = toISO(addMonths(hoje, 6));

  inputLote.addEventListener("input", () => {
    limparSelecao();
    atualizarExecutar();
  });
  atualizarExecutar();

  buscarOFs(false);
}

btnBuscar.addEventListener("click", () => buscarOFs(true));
btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());
splashBtn.addEventListener("click", fecharSplash);
splash.addEventListener("click", (e) => {
  if (e.target === splash) fecharSplash();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
