document.addEventListener("dragover", function(e) { e.preventDefault(); });
document.addEventListener("drop", function(e) { e.preventDefault(); });

const statusText = document.getElementById("statusText");
const btnGerar = document.getElementById("btnGerar");
const btnFechar = document.getElementById("btnFechar");
const btnBuscarFT = document.getElementById("btnBuscarFT");
const btnRefazer = document.getElementById("btnRefazer");
const inputMeiaCaixa = document.getElementById("meiaCaixa");
const inputColuna1 = document.getElementById("coluna1");
const inputColuna2 = document.getElementById("coluna2");
const inputFT = document.getElementById("ftNumero");
const ftInfo = document.getElementById("ftInfo");

let csInterface = null;
let ctxItens = null;
let refAtual = null;
let ftAtual = "";
let itemAtual = 0;
let vincosPorItem = {};

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

function getNumber(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function getBool(id) {
  return document.getElementById(id).checked;
}

function setNumber(id, value) {
  document.getElementById(id).value = value;
}

function setBool(id, value) {
  document.getElementById(id).checked = value;
}

function atualizarUI() {
  const meia = inputMeiaCaixa.checked;
  inputColuna1.disabled = meia;
  inputColuna2.disabled = meia;
}

function coletarArgs() {
  return [
    getNumber("coluna1"),
    getNumber("coluna2"),
    getNumber("coluna3"),
    getNumber("coluna4"),
    getNumber("abaCola"),
    getNumber("linha1"),
    getNumber("linha2"),
    getNumber("linha3"),
    getNumber("offset"),
    getNumber("espessura"),
    getNumber("tamanhoTexto"),
    getNumber("distanciaTexto"),
    getNumber("extensaoTotal"),
    getBool("cotas"),
    getBool("orelhaComprimento"),
    getBool("retanguloInvisivel"),
    getBool("mostrarMm"),
    getBool("meiaCaixa"),
    getNumber("slotter"),
  ];
}

let saveTimer = null;

function salvarPreferencias(imediato) {
  if (imediato) {
    sendToHost("salvarCaixaMaletaPrefs", coletarArgs()).catch(() => {});
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    sendToHost("salvarCaixaMaletaPrefs", coletarArgs()).catch(() => {});
  }, 300);
}

function gerarCaixaMaleta() {
  btnGerar.disabled = true;
  setStatus("Gerando caixa maleta...");

  const args = coletarArgs();

  sendToHost("salvarCaixaMaletaPrefs", args)
    .then(() => sendToHost("caixaMaleta", args))
    .then((result) => {
      setStatus(String(result), "ok");
    })
    .catch((e) => {
      setStatus("Erro: " + e.message, "err");
    })
    .finally(() => {
      btnGerar.disabled = false;
    });
}

function carregarPreferencias() {
  sendToHost("getCaixaMaletaPrefs")
    .then((result) => {
      const dados = JSON.parse(result);
      const numericos = [
        "coluna1",
        "coluna2",
        "coluna3",
        "coluna4",
        "abaCola",
        "linha1",
        "linha2",
        "linha3",
        "offset",
        "espessura",
        "tamanhoTexto",
        "distanciaTexto",
        "extensaoTotal",
        "slotter",
      ];
      numericos.forEach((id) => {
        if (dados[id] !== undefined) setNumber(id, String(dados[id]));
      });
      const booleanos = [
        "cotas",
        "orelhaComprimento",
        "retanguloInvisivel",
        "mostrarMm",
        "meiaCaixa",
      ];
      booleanos.forEach((id) => {
        if (dados[id] !== undefined) setBool(id, dados[id]);
      });
      atualizarUI();
    })
    .catch(() => {
      atualizarUI();
    });
}

function fechar() {
  if (csInterface) {
    salvarPreferencias(true);
    csInterface.closeExtension();
  }
}

// =====================================================================
// Dados da FT via API do banco (sem drag and drop)
// =====================================================================

function infoLinha(rotulo, valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  return '<span class="cm-ftinfo-item"><b>' + rotulo + ":</b> " + valor + "</span>";
}

// Folgas de vinco por ONDA (tipo de onda): [c1, c2, c3, c4, l1, l2, l3]
// A tabela so define o PADRAO de reparticao: o total que vale e o do banco
// (COMP/LARG), entao as somas sao fechadas contra ele em aplicarMaleta.
const FOLGAS_ONDA = {
  1: [1, 3, 3, 2, 2, 6, 2],
  2: [2, 4, 4, 3, 3, 8, 3],
  3: [4, 7, 7, 7, 4, 12, 4],
  6: [3, 5, 5, 5, 3, 9, 3],
  14: [1, 2, 2, 1, 0, 3, 0],
  17: [3, 4, 4, 4, 2, 7, 2]
};

// Margem da conferencia quando nao da para fechar as somas contra o banco.
const TOLERANCIA_CONFERENCIA = 5;

// Faixa plausivel da folga total (banco - nominal da geometria). Fora dela a
// geometria nao e a de uma maleta padrao (ex.: CORTE VINCO PLANO, MODELO
// ESPECIAL) e nao da para fechar as somas - nesse caso, avisa em vez de
// inventar medida.
const FOLGA_MIN = 0;
const FOLGA_MAX = 60;

function numero(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// MEIACAIXA = S tambem aparece em modelos que nao sao maleta (CINTA 2 PARTES,
// CAIXA NORMAL 4 PARTES), entao so marca quando o modelo e CAIXA NORMAL meia caixa.
// Exige o flag E o nome: na duvida e melhor nao marcar (o usuario marca na mao)
// do que gerar a faca de meia caixa errada.
function detectarMeiaCaixa(it, ci) {
  it = it || {};
  ci = ci || {};
  const nome = String(primeiro(it.NOMECAIXA, ci.NOMECAIXA) || "");
  if (!/^CAIXA NORMAL/i.test(nome)) return false;
  if (/4\s*PARTES/i.test(nome)) return false;
  if (!/MEIA\s*CAIXA/i.test(nome)) return false;
  const flag = String(primeiro(it.MEIACAIXA, ci.MEIACAIXA) || "").toUpperCase();
  return flag === "S" || flag === "X" || flag === "1";
}

// Reparte `total` (>= 0) entre os pesos, proporcional ao peso, com o resto
// distribuido um a um. Sem padrao (soma dos pesos = 0) reparte uniforme.
// Com total == soma dos pesos devolve exatamente os pesos.
function distribuir(total, pesos) {
  const n = pesos.length;
  const saida = [];
  for (var i = 0; i < n; i++) saida.push(0);
  if (total <= 0) return saida;
  var soma = 0;
  for (i = 0; i < n; i++) soma += pesos[i] > 0 ? pesos[i] : 0;
  var feito = 0;
  if (soma > 0) {
    for (i = 0; i < n; i++) {
      const v = Math.floor((total * (pesos[i] > 0 ? pesos[i] : 0)) / soma);
      saida[i] = v;
      feito += v;
    }
  } else {
    const base = Math.floor(total / n);
    for (i = 0; i < n; i++) {
      saida[i] = base;
      feito += base;
    }
  }
  var resto = total - feito;
  for (i = 0; resto > 0; i = (i + 1) % n) {
    saida[i]++;
    resto--;
  }
  return saida;
}

function aplicarMaleta(it, ci) {
  ci = ci || {};
  const meia = detectarMeiaCaixa(it, ci);
  const M1 = numero(primeiro(it.M1, ci.M1));
  const M2 = numero(primeiro(it.M2, ci.M2));
  const M3 = numero(primeiro(it.M3, ci.M3));
  const orelha = numero(primeiro(it.ORELHA, ci.ORELHA));
  const onda = primeiro(it.ONDA, ci.ONDA);
  const nOnda = parseInt(onda, 10);
  const ondaNum = isNaN(nOnda) ? null : nOnda;
  const g = ondaNum !== null && FOLGAS_ONDA[ondaNum] ? FOLGAS_ONDA[ondaNum] : null;
  const f = g || [0, 0, 0, 0, 0, 0, 0];
  const comp = numero(primeiro(it.COMP, ci.COMP));
  const larg = numero(primeiro(it.LARG, ci.LARG));
  const alertas = [];

  // ---- colunas ----
  // Com ONDA na tabela a folga por painel e fixa (dado do MDMBox) e vale
  // direto: fechar contra o COMP distorceria, pois o COMP do banco as vezes
  // inclui uma sobra que nao entra no vinco (ex.: ONDA 6). A tabela manda.
  const nominalC = meia ? M1 + M2 + orelha : 2 * M1 + 2 * M2 + orelha;
  let c1 = M1 + f[0];
  let c2 = M2 + f[1];
  let c3 = M1 + f[2];
  let c4 = M2 + f[3];
  if (!g && comp) {
    // ONDA fora da tabela: reparte o gap contra o COMP (melhor esforco).
    const gapC = comp - nominalC;
    if (gapC >= FOLGA_MIN && gapC <= FOLGA_MAX) {
      const pesos = meia ? [1, 1] : [1, 1, 1, 1];
      const a = distribuir(gapC, pesos);
      if (meia) {
        c3 = M1 + a[0];
        c4 = M2 + a[1];
      } else {
        c1 = M1 + a[0];
        c2 = M2 + a[1];
        c3 = M1 + a[2];
        c4 = M2 + a[3];
      }
    } else {
      alertas.push("colunas COMP " + comp + " x nominal " + nominalC + " (folga " + gapC + ")");
    }
  }

  // ---- linhas: o corpo recebe a folga da ONDA, as abas dividem o resto do LARG ----
  // Dois desenhos possiveis e o banco decide qual e (o nome nao diferencia):
  //   A) 3 secoes  LARG ~ 2*M2 + M3 + folga  (abas do tamanho de M2)
  //   B) 2 secoes  LARG ~   M2 + M3 + folga  (abas de M2/2 - caixa normal)
  const folgaLinhas = f[4] + f[5] + f[6];
  let l1 = M2 + f[4];
  let l2 = M3 + f[5];
  let l3 = M2 + f[6];
  let modeloLinhas = null;
  if (larg) {
    const gapA = larg - (2 * M2 + M3);
    const gapB = larg - (M2 + M3);
    const okA = gapA >= FOLGA_MIN && gapA <= FOLGA_MAX;
    const okB = gapB >= FOLGA_MIN && gapB <= FOLGA_MAX;
    if (okA || okB) {
      modeloLinhas = okA && (!okB || Math.abs(gapA - folgaLinhas) <= Math.abs(gapB - folgaLinhas)) ? "A" : "B";
      l2 = M3 + f[5];
      if (l2 < 1) l2 = 1;
      if (larg - l2 < 2) l2 = Math.max(1, larg - 2);
      if (modeloLinhas === "A") {
        // 3 secoes: abas do tamanho de M2
        l1 = M2 + f[4];
        l3 = M2 + f[6];
      } else {
        // 2 secoes (caixa normal): abas = M2/2
        const aba = Math.round(M2 / 2);
        l1 = aba + f[4];
        l3 = aba + f[6];
      }
    } else {
      // geometria fora do padrao: divide o restante entre as duas abas
      const resto = larg - l2;
      l1 = Math.floor(resto / 2);
      l3 = resto - l1;
    }
  }

  setNumber("coluna1", c1);
  setNumber("coluna2", c2);
  setNumber("coluna3", c3);
  setNumber("coluna4", c4);
  setNumber("abaCola", orelha);
  setNumber("linha1", l1);
  setNumber("linha2", l2);
  setNumber("linha3", l3);
  const somaC = meia ? c3 + c4 + orelha : c1 + c2 + c3 + c4 + orelha;
  const somaL = l1 + l2 + l3;
  return {
    onda: ondaNum,
    temTabela: !!g,
    meia: meia,
    modeloLinhas: modeloLinhas,
    comp: comp,
    larg: larg,
    somaC: somaC,
    somaL: somaL,
    alertas: alertas,
    bate: alertas.length === 0
  };
}

function primeiro() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}

function rotuloItem(it, ci) {
  const num = it.ITEM !== undefined && it.ITEM !== null ? it.ITEM : ci.ITEM;
  const nome = it.REFERENCIA || ci.REFERENCIA || ci.NOMECAIXA || it.NOMECAIXA || "";
  let txt = num !== undefined && num !== null && num !== "" ? "Item " + num : "Item";
  if (nome) txt += " - " + nome;
  return txt;
}

function casarCi(listaCi, it) {
  if (it && it.CHAVE !== undefined && it.CHAVE !== null) {
    const porChave = listaCi.find((x) => x && String(x.CHAVE) === String(it.CHAVE));
    if (porChave) return porChave;
  }
  if (it && it.ITEM !== undefined && it.ITEM !== null) {
    const porItem = listaCi.find((x) => x && String(x.ITEM) === String(it.ITEM));
    if (porItem) return porItem;
  }
  return null;
}

function montarItens(dados, ciResp) {
  const listaGet = (dados && dados.item) || [];
  const listaCi = (ciResp && ciResp.itens) || [];
  const base = listaGet.length ? listaGet : listaCi;
  const itens = [];
  for (let i = 0; i < base.length; i++) {
    const it = listaGet.length ? base[i] || {} : {};
    const ci = listaGet.length ? casarCi(listaCi, it) || listaCi[i] || {} : base[i] || {};
    itens.push({
      item: it.ITEM !== undefined && it.ITEM !== null ? it.ITEM : ci.ITEM,
      chave: it.CHAVE || ci.CHAVE,
      rotulo: rotuloItem(it, ci),
      it: it,
      ci: ci,
    });
  }
  return itens;
}

function renderItemRadios() {
  const box = document.getElementById("cmItemRadios");
  const wrap = document.getElementById("cmItemBox");
  if (!box) return;
  box.innerHTML = "";
  if (!ctxItens || ctxItens.length <= 1) {
    if (wrap) wrap.classList.add("hidden");
    return;
  }
  if (wrap) wrap.classList.remove("hidden");
  ctxItens.forEach((x, i) => {
    const label = document.createElement("label");
    label.className = "cm-radio";
    const inp = document.createElement("input");
    inp.type = "radio";
    inp.name = "cmLayoutItem";
    inp.value = String(i);
    inp.addEventListener("change", () => {
      if (inp.checked) aplicarItem(i, true);
    });
    const span = document.createElement("span");
    span.textContent = x.rotulo;
    label.appendChild(inp);
    label.appendChild(span);
    box.appendChild(label);
  });
}

function aplicarItem(idx, salvar, acao) {
  if (!ctxItens || !ctxItens.length) return;
  if (idx < 0 || idx >= ctxItens.length) idx = 0;
  itemAtual = idx;
  if (btnRefazer) btnRefazer.disabled = false;
  const escolhido = ctxItens[idx];
  const it = escolhido.it || {};
  const ci = escolhido.ci || {};
  if (it.ONDA === undefined || it.ONDA === null) it.ONDA = ci.ONDA;
  const r = aplicarMaleta(it, ci);
  const nomeModelo = String(ci.NOMECAIXA || it.NOMECAIXA || "");
  const orelhaComprimento = /ORELHA\s*COMPRIMENTO/i.test(nomeModelo);
  setBool("meiaCaixa", r.meia);
  setBool("orelhaComprimento", orelhaComprimento);
  atualizarUI();

  // Medidas exatas do vinco (Vincadeira/Impressora) quando a OF da FT ja foi
  // buscada: a OF manda, a tabela FOLGAS_ONDA fica como fallback/estimativa.
  // Impressora = colunas (5 valores) e Vincadeira = linhas (3 valores).
  // Com "orelha no comprimento" a aba vem primeiro na lista de colunas.
  let origemVinco = "";
  const vv = vincosPorItem[String(escolhido.item)];
  if (vv && !r.meia && vv.cols.length === 5 && vv.lins.length === 3) {
    const vals = orelhaComprimento
      ? { aba: vv.cols[0], c1: vv.cols[1], c2: vv.cols[2], c3: vv.cols[3], c4: vv.cols[4] }
      : { c1: vv.cols[0], c2: vv.cols[1], c3: vv.cols[2], c4: vv.cols[3], aba: vv.cols[4] };
    setNumber("coluna1", vals.c1);
    setNumber("coluna2", vals.c2);
    setNumber("coluna3", vals.c3);
    setNumber("coluna4", vals.c4);
    setNumber("abaCola", vals.aba);
    setNumber("linha1", vv.lins[0]);
    setNumber("linha2", vv.lins[1]);
    setNumber("linha3", vv.lins[2]);
    r.somaC = vals.c1 + vals.c2 + vals.c3 + vals.c4 + vals.aba;
    r.somaL = vv.lins[0] + vv.lins[1] + vv.lins[2];
    origemVinco = "vinco da OF " + (window.MazurkyFTAPI && window.MazurkyFTAPI.formatarOF
      ? window.MazurkyFTAPI.formatarOF(vv.of) : vv.of);
  }
  const m1 = primeiro(it.M1, ci.M1);
  const m2 = primeiro(it.M2, ci.M2);
  const m3 = primeiro(it.M3, ci.M3);
  const orelha = primeiro(it.ORELHA, ci.ORELHA);
  ftInfo.innerHTML = [
    infoLinha("Ref", it.REFERENCIA || (refAtual && refAtual.REFERENCIA)),
    infoLinha("Modelo", nomeModelo),
    infoLinha("Medidas", [m1, m2, m3].filter((x) => x !== undefined && x !== null && x !== "").join(" x ")),
    infoLinha("Papelão", primeiro(it.PAPELAO, ci.PAPELAO)),
    infoLinha("Onda", r.onda),
    infoLinha("Orelha", orelha),
  ].filter(Boolean).join("");
  document.querySelectorAll('#cmItemRadios input[name="cmLayoutItem"]').forEach((el) => {
    el.checked = Number(el.value) === idx;
  });
  const layout = (ctxItens.length > 1 ? " (layout " + (idx + 1) + "/" + ctxItens.length + ")" : "") +
                 (r.meia ? " meia caixa" : "");
  const secoes = r.modeloLinhas === "A" ? ", 3 seções" : r.modeloLinhas === "B" ? ", 2 seções" : "";
  const conferido = "comp " + r.somaC + (r.comp ? "/" + r.comp : "") +
                    ", larg " + r.somaL + (r.larg ? "/" + r.larg : "");
  let msg, tipo;
  if (origemVinco) {
    msg = "FT " + ftAtual + layout + ": colunas/linhas do " + origemVinco +
          " (" + conferido + secoes + ").";
    tipo = "ok";
  } else if (r.alertas.length) {
    msg = "FT " + ftAtual + layout + ": não fecha com o banco — " + r.alertas.join("; ") +
          ". Ajuste as medidas à mão.";
    tipo = "err";
  } else if (!r.comp && !r.larg) {
    msg = "FT " + ftAtual + layout + " carregada — sem COMP/LARG no banco para conferir (" + conferido + ").";
    tipo = null;
  } else if (!r.temTabela) {
    msg = "FT " + ftAtual + layout + ": ONDA " + (r.onda === null ? "?" : r.onda) +
          " sem tabela — folga repartida para fechar o banco (" + conferido + secoes + ").";
    tipo = null;
  } else {
    msg = "FT " + ftAtual + layout + " conferida (" + conferido + secoes + ").";
    tipo = "ok";
  }
  if (acao === "refazer") msg = "Medidas refeitas a partir da FT. " + msg;
  setStatus(msg, tipo);
  if (salvar) {
    try { localStorage.setItem("mazurky_cmft_item_" + ftAtual, String(idx)); } catch (e) {}
  }
  salvarPreferencias(true);
}

function parseMedidas(str) {
  return String(str || "")
    .split("x")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n));
}

// Busca, em segundo plano, um OF da FT (por item) e le as medidas exatas do
// vinco (VINCOS_COMP = colunas, VINCOS_LARG = linhas) via PCP/ImpOF.
function buscarVincosFT(ft) {
  if (!window.MazurkyFTAPI || !window.MazurkyFTAPI.historicoOF || !window.MazurkyFTAPI.impOF) {
    setStatus("Módulo do banco desatualizado (sem impOF) — feche/reabra o painel para carregar o Vincadeira/Impressora exato.", null);
    return;
  }
  const hoje = Date.now();
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const ini = iso(hoje - 730 * 86400000);
  const fim = iso(hoje + 180 * 86400000);
  window.MazurkyFTAPI.historicoOF(ft, ini, fim)
    .then((h) => {
      const ofs = (h && h.ofs) || [];
      const porItem = {};
      ofs.forEach((o) => {
        const k = String(o.itemRef);
        if (!(k in porItem)) porItem[k] = o;  // lista ja vem da OF mais recente
      });
      return Promise.all(Object.keys(porItem).map((k) =>
        window.MazurkyFTAPI.impOF(porItem[k].of)
          .then((row) => ({ item: k, of: porItem[k].of, row: row }))
          .catch(() => null)
      ));
    })
    .then((res) => {
      if (!res) return;
      res.forEach((r) => {
        if (!r || !r.row) return;
        const cols = parseMedidas(r.row.VINCOS_COMP);
        const lins = parseMedidas(r.row.VINCOS_LARG);
        if (!cols.length || !lins.length) return;
        vincosPorItem[String(r.item)] = { of: r.of, cols: cols, lins: lins };
      });
      if (ctxItens && ctxItens[itemAtual]) aplicarItem(itemAtual, false, "vincos");
    })
    .catch(() => {});
}

function buscarFT() {
  const ft = inputFT.value || (window.MazurkyFT ? window.MazurkyFT.get() : "");
  if (!ft) {
    setStatus("Informe a FT no hub primeiro.", "err");
    return;
  }
  if (!window.MazurkyFTAPI) {
    setStatus("Módulo do banco não carregado.", "err");
    return;
  }
  btnBuscarFT.disabled = true;
  setStatus("Buscando FT " + ft + "...");
  Promise.all([window.MazurkyFTAPI.getRef(ft), window.MazurkyFTAPI.consultarItens(ft)])
    .then((res) => {
      const dados = res[0];
      const ciResp = res[1];
      refAtual = (dados.ref && dados.ref[0]) || {};
      ftAtual = ft;
      vincosPorItem = {};
      ctxItens = montarItens(dados, ciResp);
      if (!ctxItens.length) ctxItens = [{ item: 1, chave: "", rotulo: "Item 1", it: {}, ci: {} }];
      renderItemRadios();
      let idx = 0;
      try {
        const salvo = localStorage.getItem("mazurky_cmft_item_" + ft);
        if (salvo !== null && salvo !== "") idx = parseInt(salvo, 10) || 0;
      } catch (e) {}
      if (idx < 0 || idx >= ctxItens.length) idx = 0;
      aplicarItem(idx, false);
      buscarVincosFT(ft);
    })
    .catch((e) => {
      setStatus("Erro ao buscar FT: " + e.message, "err");
    })
    .finally(() => {
      btnBuscarFT.disabled = false;
    });
}

function refazerMedidas() {
  if (!ctxItens || !ctxItens.length) {
    setStatus("Busque a FT primeiro.", "err");
    return;
  }
  aplicarItem(itemAtual, false, "refazer");
}

btnGerar.addEventListener("click", gerarCaixaMaleta);
btnFechar.addEventListener("click", fechar);
btnBuscarFT.addEventListener("click", buscarFT);
btnRefazer.addEventListener("click", refazerMedidas);
inputMeiaCaixa.addEventListener("change", atualizarUI);

const CAMPO_IDS = [
  "coluna1",
  "coluna2",
  "coluna3",
  "coluna4",
  "abaCola",
  "linha1",
  "linha2",
  "linha3",
  "offset",
  "espessura",
  "tamanhoTexto",
  "distanciaTexto",
  "extensaoTotal",
  "slotter",
  "cotas",
  "orelhaComprimento",
  "retanguloInvisivel",
  "mostrarMm",
  "meiaCaixa",
];

CAMPO_IDS.forEach((id) => {
  document.getElementById(id).addEventListener("change", () => salvarPreferencias(false));
});

document.querySelectorAll('input[type="number"]').forEach(function (inp) {
  inp.addEventListener("click", function () {
    var el = this;
    setTimeout(function () { el.select(); }, 0);
  });
  inp.addEventListener("focus", function () {
    var el = this;
    setTimeout(function () { el.select(); }, 0);
  });
});

window.addEventListener("beforeunload", () => {
  if (csInterface) salvarPreferencias(true);
});

function init() {
  csInterface = new CSInterface();
  csInterface.setWindowTitle("Caixa Maleta FT - Mazurky v1.0");
  setStatus("Pronto.");
  inputFT.value = window.MazurkyFT ? window.MazurkyFT.get() : "";
  carregarPreferencias();
  if (inputFT.value) {
    buscarFT();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
