const MY_EXT_ID = "com.mazurky.tools.cotas";
const statusText = document.getElementById("statusText");
const btnExecutar = document.getElementById("btnExecutar");
const btnCancelar = document.getElementById("btnCancelar");
const btnFechar = document.getElementById("btnFechar");
const btnRestaurarPadrao = document.getElementById("btnRestaurarPadrao");
const btnDefinirPadrao = document.getElementById("btnDefinirPadrao");
const inputCima = document.getElementById("cima");
const inputDireita = document.getElementById("direita");
const inputBaixo = document.getElementById("baixo");
const inputEsquerda = document.getElementById("esquerda");
const inputSelecionarTudo = document.getElementById("selecionarTudo");
const inputUnidades = document.getElementById("unidades");
const inputDistancia = document.getElementById("distancia");
const inputCotaUnica = document.getElementById("cotaUnica");
const inputFonte = document.getElementById("fonte");
const inputTicket = document.getElementById("ticket");
const selectCor = document.getElementById("cor");
const inputCyan = document.getElementById("cyan");
const inputMagenta = document.getElementById("magenta");
const inputYellow = document.getElementById("yellow");
const inputBlack = document.getElementById("black");
const inputTraco = document.getElementById("traco");
const inputDistanciaCotas = document.getElementById("distanciaCotas");
const inputOffsetTexto = document.getElementById("offsetTexto");
const modalEdicao = document.getElementById("modalEdicao");
const modalTexto = document.getElementById("modalTexto");
const btnModalSim = document.getElementById("btnModalSim");
const btnModalNao = document.getElementById("btnModalNao");

const CORES = {
  "Preto": { cyan: 0, magenta: 0, yellow: 0, black: 100 },
  "Branco": { cyan: 0, magenta: 0, yellow: 0, black: 0 },
  "Verde": { cyan: 100, magenta: 0, yellow: 100, black: 0 },
  "Azul": { cyan: 100, magenta: 100, yellow: 0, black: 0 },
  "Amarelo": { cyan: 0, magenta: 0, yellow: 100, black: 0 },
  "Magenta": { cyan: 0, magenta: 100, yellow: 0, black: 0 },
  "Laranja": { cyan: 0, magenta: 35, yellow: 100, black: 0 },
  "Ciano": { cyan: 100, magenta: 0, yellow: 0, black: 0 }
};

const CONFIG_KEY = "mazurky_cotas_config";
const DEFAULT_KEY = "mazurky_cotas_padrao";

const DEFAULT_CONFIG = {
  cima: false,
  direita: true,
  baixo: true,
  esquerda: false,
  selecionarTudo: false,
  unidades: true,
  distancia: false,
  cotaUnica: false,
  fonte: "20",
  ticket: false,
  cor: "Verde",
  cyan: "100",
  magenta: "0",
  yellow: "100",
  black: "0",
  traco: "0.5",
  distanciaCotas: "5",
  offsetTexto: "0"
};

function coletarConfigAtual() {
  return {
    cima: inputCima.checked,
    direita: inputDireita.checked,
    baixo: inputBaixo.checked,
    esquerda: inputEsquerda.checked,
    selecionarTudo: inputSelecionarTudo.checked,
    unidades: inputUnidades.checked,
    distancia: inputDistancia.checked,
    cotaUnica: inputCotaUnica.checked,
    fonte: inputFonte.value,
    ticket: inputTicket.checked,
    cor: selectCor.value,
    cyan: inputCyan.value,
    magenta: inputMagenta.value,
    yellow: inputYellow.value,
    black: inputBlack.value,
    traco: inputTraco.value,
    distanciaCotas: inputDistanciaCotas.value,
    offsetTexto: inputOffsetTexto.value
  };
}

function aplicarConfig(cfg) {
  inputSelecionarTudo.checked = !!cfg.selecionarTudo;
  inputCima.checked = !!cfg.cima;
  inputDireita.checked = !!cfg.direita;
  inputBaixo.checked = !!cfg.baixo;
  inputEsquerda.checked = !!cfg.esquerda;
  inputUnidades.checked = !!cfg.unidades;
  inputDistancia.checked = !!cfg.distancia;
  inputCotaUnica.checked = !!cfg.cotaUnica;
  inputTicket.checked = !!cfg.ticket;
  if (cfg.cor && CORES[cfg.cor]) selectCor.value = cfg.cor;
  if (cfg.fonte !== undefined) inputFonte.value = cfg.fonte;
  if (cfg.cyan !== undefined) inputCyan.value = cfg.cyan;
  if (cfg.magenta !== undefined) inputMagenta.value = cfg.magenta;
  if (cfg.yellow !== undefined) inputYellow.value = cfg.yellow;
  if (cfg.black !== undefined) inputBlack.value = cfg.black;
  if (cfg.traco !== undefined) inputTraco.value = cfg.traco;
  if (cfg.distanciaCotas !== undefined) inputDistanciaCotas.value = cfg.distanciaCotas;
  if (cfg.offsetTexto !== undefined) inputOffsetTexto.value = cfg.offsetTexto;
  sincronizarSelecionarTudo();
}

function salvarConfig() {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(coletarConfigAtual()));
  } catch (e) {}
}

function carregarConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return;
    aplicarConfig(JSON.parse(raw));
  } catch (e) {}
}

function definirPadrao() {
  try {
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(coletarConfigAtual()));
    setStatus("Configuração atual definida como padrão.", "ok");
  } catch (e) {
    setStatus("Não foi possível salvar o padrão.", "err");
  }
}

function restaurarPadrao() {
  let cfg = null;
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch (e) {}
  if (!cfg) cfg = DEFAULT_CONFIG;
  aplicarConfig(cfg);
  agendarAutoPrevia();
  setStatus("Configuração padrão aplicada.", "ok");
}

let csInterface = null;
let previaEmCurso = false;
let previaPendente = false;
let timerAutoPrevia = null;
let timerPolling = null;
let temSelecao = false;
let emEdicao = false;
let ultimaAssinatura = "";
let aguardandoConfirmacao = false;
let nomeEdicaoPendente = "";
let jaVerificado = false;
let observadorFechamento = null;

function ferramentaAtiva() {
  return document.body.contains(modalEdicao);
}

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
  const fonte = parseFloat(String(inputFonte.value).replace(",", "."));
  const traco = parseFloat(String(inputTraco.value).replace(",", "."));
  const distancia = parseFloat(String(inputDistanciaCotas.value).replace(",", "."));
  const offset = parseFloat(String(inputOffsetTexto.value).replace(",", "."));
  const cyan = parseFloat(String(inputCyan.value).replace(",", "."));
  const magenta = parseFloat(String(inputMagenta.value).replace(",", "."));
  const yellow = parseFloat(String(inputYellow.value).replace(",", "."));
  const black = parseFloat(String(inputBlack.value).replace(",", "."));
  if ([fonte, traco, distancia, offset, cyan, magenta, yellow, black].some((v) => isNaN(v))) {
    throw new Error("Digite valores numéricos válidos.");
  }
  return [
    inputCima.checked,
    inputDireita.checked,
    inputBaixo.checked,
    inputEsquerda.checked,
    inputUnidades.checked,
    inputDistancia.checked,
    fonte,
    inputTicket.checked,
    cyan,
    magenta,
    yellow,
    black,
    traco,
    distancia,
    offset,
    inputCotaUnica.checked
  ];
}

function setBotoesDesabilitados(valor) {
  btnExecutar.disabled = valor;
  btnCancelar.disabled = valor;
}

function executar() {
  setBotoesDesabilitados(true);
  setStatus("Executando...");
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    setBotoesDesabilitados(false);
    return;
  }
  sendToHost("executar", args)
    .then((result) => {
      const ok = result === "Cotas aplicadas com sucesso!";
      setStatus(String(result), ok ? "ok" : "err");
      if (ok) {
        emEdicao = false;
        setTimeout(function () { window.close(); }, 2000);
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      setBotoesDesabilitados(false);
    });
}

function cancelar() {
  setBotoesDesabilitados(true);
  setStatus("Cancelando...");
  sendToHost("cancelar", [])
    .then((result) => {
      emEdicao = false;
      const ok = result === "Cancelado com sucesso!";
      setStatus(String(result), ok ? "ok" : "err");
      if (ok) {
        setTimeout(function () { window.close(); }, 300);
      }
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      setBotoesDesabilitados(false);
    });
}

function dispararAutoPrevia() {
  if (!ferramentaAtiva()) return;
  if (aguardandoConfirmacao) return;
  if (!temSelecao) return;
  if (previaEmCurso) {
    previaPendente = true;
    return;
  }
  let args;
  try {
    args = coletarArgs();
  } catch (e) {
    setStatus(e.message, "err");
    return;
  }
  previaEmCurso = true;
  setStatus("Gerando prévia...");
  sendToHost("preview", args)
    .then((result) => {
      setStatus(String(result), result === "Prévia criada com sucesso!" ? "ok" : "err");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      previaEmCurso = false;
      if (previaPendente) {
        previaPendente = false;
        dispararAutoPrevia();
      }
    });
}

function agendarAutoPrevia() {
  clearTimeout(timerAutoPrevia);
  timerAutoPrevia = setTimeout(dispararAutoPrevia, 150);
  salvarConfig();
}

function aplicarCorPreset() {
  const cor = CORES[selectCor.value];
  if (cor) {
    inputCyan.value = cor.cyan;
    inputMagenta.value = cor.magenta;
    inputYellow.value = cor.yellow;
    inputBlack.value = cor.black;
  }
  agendarAutoPrevia();
}

function sincronizarSelecionarTudo() {
  const selecionado = inputSelecionarTudo.checked;
  [inputCima, inputDireita, inputBaixo, inputEsquerda].forEach((cb) => {
    cb.disabled = selecionado;
    if (selecionado) {
      cb.checked = true;
    }
  });
}

function atualizarSelecionarTudo() {
  sincronizarSelecionarTudo();
  agendarAutoPrevia();
}

function mostrarModalEdicao(nome) {
  aguardandoConfirmacao = true;
  nomeEdicaoPendente = nome;
  modalTexto.textContent = "A cota '" + nome + "' já existe e será alterada. Confirmar?";
  modalEdicao.classList.remove("hidden");
}

function esconderModalEdicao() {
  modalEdicao.classList.add("hidden");
  aguardandoConfirmacao = false;
  nomeEdicaoPendente = "";
}

function confirmarEdicao() {
  const nome = nomeEdicaoPendente;
  esconderModalEdicao();
  emEdicao = true;
  ultimaAssinatura = "";
  temSelecao = false;
  sendToHost("setCotaEdicao", [nome])
    .then(() => sendToHost("assinaturaSelecao", []))
    .then((sig) => {
      ultimaAssinatura = sig;
      temSelecao = sig !== "";
      if (temSelecao) {
        dispararAutoPrevia();
      } else {
        setStatus("Cota '" + nome + "' marcada para edição. Selecione os objetos para desenhar a nova cota.", "ok");
      }
    })
    .catch(() => dispararAutoPrevia());
}

function recusarEdicao() {
  esconderModalEdicao();
  dispararAutoPrevia();
}

function verificarEdicaoInicial() {
  emEdicao = false;
  ultimaAssinatura = "";
  sendToHost("setCotaEdicao", [""])
    .then(() => sendToHost("cotaSelecionada", []))
    .then((nome) => {
      if (nome && nome.indexOf("Cota ") === 0) {
        mostrarModalEdicao(nome);
      } else {
        return sendToHost("assinaturaSelecao", []).then((sig) => {
          ultimaAssinatura = sig;
          temSelecao = sig !== "";
          if (temSelecao) {
            dispararAutoPrevia();
          } else {
            sendToHost("cancelar", []).catch(() => {});
          }
        });
      }
    })
    .catch(() => dispararAutoPrevia());
}

function verificarAoMostrarPainel() {
  if (jaVerificado) return;
  jaVerificado = true;
  verificarEdicaoInicial();
}

function pararAtividades() {
  clearTimeout(timerAutoPrevia);
  if (timerPolling) {
    clearInterval(timerPolling);
    timerPolling = null;
  }
  previaEmCurso = false;
  previaPendente = false;
}

function iniciarPollingEdicao() {
  if (timerPolling) return;
  timerPolling = setInterval(() => {
    if (!emEdicao) return;
    if (!ferramentaAtiva()) return;
    if (previaEmCurso || aguardandoConfirmacao) return;
    sendToHost("assinaturaSelecao", [])
      .then((sig) => {
        if (sig === ultimaAssinatura) return;
        ultimaAssinatura = sig;
        if (sig) {
          temSelecao = true;
          dispararAutoPrevia();
        } else {
          temSelecao = false;
          sendToHost("cancelar", []).catch(() => {});
        }
      })
      .catch(() => {});
  }, 700);
}

function onVisibilidadePainel(event) {
  let data = event.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      data = {};
    }
  }
  const visivel = !!(data && data.visible);
  if (visivel) {
    setStatus("Pronto.");
    iniciarPollingEdicao();
    verificarAoMostrarPainel();
  } else {
    jaVerificado = false;
    pararAtividades();
  }
}

function iniciarObservadorFechamento() {
  observadorFechamento = new MutationObserver(() => {
    if (!ferramentaAtiva()) {
      pararAtividades();
      if (observadorFechamento) {
        observadorFechamento.disconnect();
        observadorFechamento = null;
      }
    }
  });
  observadorFechamento.observe(document.body, { childList: true, subtree: true });
}

function init() {
  csInterface = new CSInterface();
  csInterface.addEventListener("com.mazurky.tools.activate", (event) => {
    if (event.data && event.data !== MY_EXT_ID) {
      window.close();
    }
  });
  csInterface.addEventListener("com.adobe.csxs.events.PanelVisibilityChanged", onVisibilidadePainel);
  setStatus("Pronto.");
  carregarConfig();
  iniciarPollingEdicao();
  verificarAoMostrarPainel();
  iniciarObservadorFechamento();
}

btnExecutar.addEventListener("click", executar);
btnCancelar.addEventListener("click", cancelar);
btnRestaurarPadrao.addEventListener("click", restaurarPadrao);
btnDefinirPadrao.addEventListener("click", definirPadrao);
btnFechar.addEventListener("click", () => {
  pararAtividades();
  window.close();
});
btnModalSim.addEventListener("click", confirmarEdicao);
btnModalNao.addEventListener("click", recusarEdicao);
selectCor.addEventListener("change", aplicarCorPreset);
inputSelecionarTudo.addEventListener("change", atualizarSelecionarTudo);

[
  inputCima,
  inputDireita,
  inputBaixo,
  inputEsquerda,
  inputUnidades,
  inputDistancia,
  inputCotaUnica,
  inputFonte,
  inputTicket,
  inputCyan,
  inputMagenta,
  inputYellow,
  inputBlack,
  inputTraco,
  inputDistanciaCotas,
  inputOffsetTexto
].forEach((el) => {
  el.addEventListener("input", agendarAutoPrevia);
  el.addEventListener("change", agendarAutoPrevia);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}