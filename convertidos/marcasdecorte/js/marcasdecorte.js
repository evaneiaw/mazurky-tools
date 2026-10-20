const MY_EXT_ID = "com.mazurky.tools.marcasdecorte";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnFechar = document.getElementById("btnFechar");
const btnDesmarcar = document.getElementById("btnDesmarcar");
const btnPadrao = document.getElementById("btnPadrao");
const btnMarcarTudo = document.getElementById("btnMarcarTudo");
const remDir = document.getElementById("remDir");
const consOver = document.getElementById("consOver");
const compVer = document.getElementById("compVer");
const compHor = document.getElementById("compHor");
const distVer = document.getElementById("distVer");
const distHor = document.getElementById("distHor");
const sangVer = document.getElementById("sangVer");
const sangHor = document.getElementById("sangHor");
const unidades = document.getElementById("unidades");
const clipMascara = document.getElementById("clipMascara");
const espessura = document.getElementById("espessura");
const espessuraUnidades = document.getElementById("espessuraUnidades");
const agrupar = document.getElementById("agrupar");
const cor = document.getElementById("cor");
const contornoBranco = document.getElementById("contornoBranco");
const objetos = document.getElementById("objetos");
const limites = document.getElementById("limites");
const camada = document.getElementById("camada");

let csInterface = null;
let nSel = 0;
let hasClip = false;

const DIR_PADRAO = [0, 2, 3, 5, 6, 8, 9, 11];

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

function setDirecoes(indices) {
  for (let i = 0; i < 12; i++) {
    document.getElementById("dir" + i).checked = indices.indexOf(i) !== -1;
  }
}

function getNum(id) {
  return String(document.getElementById(id).value).replace(",", ".");
}

function coletarArgs() {
  const dirs = [];
  for (let i = 0; i < 12; i++) {
    dirs.push(document.getElementById("dir" + i).checked);
  }
  return [
    dirs,
    remDir.checked,
    consOver.checked,
    getNum("compVer"),
    getNum("compHor"),
    getNum("distVer"),
    getNum("distHor"),
    getNum("sangVer"),
    getNum("sangHor"),
    parseInt(unidades.value, 10),
    clipMascara.checked,
    getNum("espessura"),
    parseInt(espessuraUnidades.value, 10),
    parseInt(agrupar.value, 10),
    parseInt(cor.value, 10),
    contornoBranco.checked,
    objetos.value,
    parseInt(limites.value, 10),
    parseInt(camada.value, 10)
  ];
}

function atualizarDependencias() {
  limites.disabled = nSel === 0;
  clipMascara.disabled = !hasClip;
  const optMarcasSelecao = agrupar.querySelector('option[value="2"]');
  if (optMarcasSelecao) optMarcasSelecao.disabled = nSel === 0;
}

function carregarCores() {
  sendToHost("listarCores")
    .then((result) => {
      if (!result) return;
      const cores = String(result).split("|").filter((s) => s.length > 0);
      for (let i = 1; i < cores.length; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = cores[i];
        cor.appendChild(opt);
      }
    })
    .catch(() => {});
}

function carregarCamadas() {
  sendToHost("listarCamadas")
    .then((result) => {
      if (!result) return;
      const camadasLista = String(result).split("|").filter((s) => s.length > 0);
      for (let i = 1; i < camadasLista.length; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = camadasLista[i];
        camada.appendChild(opt);
      }
    })
    .catch(() => {});
}

function aplicarPrefs(dados) {
  if (!dados) return;
  nSel = dados.nSel || 0;
  hasClip = !!dados.hasClip;

  if (dados.objetos) {
    objetos.innerHTML = "";
    dados.objetos.forEach((o, i) => {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      objetos.appendChild(opt);
    });
  }

  if (dados.unidadesIndex !== undefined) unidades.value = String(dados.unidadesIndex);
  if (dados.compVer !== undefined) compVer.value = dados.compVer;
  if (dados.compHor !== undefined) compHor.value = dados.compHor;
  if (dados.distVer !== undefined) distVer.value = dados.distVer;
  if (dados.distHor !== undefined) distHor.value = dados.distHor;
  if (dados.sangVer !== undefined) sangVer.value = dados.sangVer;
  if (dados.sangHor !== undefined) sangHor.value = dados.sangHor;
  if (dados.espessura !== undefined) espessura.value = dados.espessura;
  if (dados.espessuraUnidadesIndex !== undefined) espessuraUnidades.value = String(dados.espessuraUnidadesIndex);
  if (dados.contornoBranco !== undefined) contornoBranco.checked = !!dados.contornoBranco;
  if (dados.agruparIndex !== undefined) agrupar.value = String(dados.agruparIndex);
  if (dados.limitesIndex !== undefined) limites.value = String(dados.limitesIndex);
  if (dados.remDir !== undefined) remDir.checked = !!dados.remDir;

  if (dados.remDir && dados.dirs && dados.dirs.length === 12) {
    const marcadas = [];
    dados.dirs.forEach((v, i) => {
      if (v) marcadas.push(i);
    });
    setDirecoes(marcadas);
  }

  atualizarDependencias();
}

function carregarPrefs() {
  sendToHost("getMarcasPrefs")
    .then((result) => {
      try {
        const dados = JSON.parse(result);
        if (dados.erro) {
          setStatus(dados.erro, "err");
          btnExecutar.disabled = true;
          return;
        }
        aplicarPrefs(dados);
      } catch (e) {}
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
  carregarCores();
  carregarCamadas();
  carregarPrefs();
  setStatus("Pronto.");
}

btnExecutar.addEventListener("click", executar);
btnFechar.addEventListener("click", () => window.close());
btnDesmarcar.addEventListener("click", () => setDirecoes([]));
btnPadrao.addEventListener("click", () => setDirecoes(DIR_PADRAO));
btnMarcarTudo.addEventListener("click", () => {
  for (let i = 0; i < 12; i++) document.getElementById("dir" + i).checked = true;
});
objetos.addEventListener("change", atualizarDependencias);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
