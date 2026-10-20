// gerarlayout.js — Gerar Layout (Parte 1: carregar PDF + extrair informações)
// O main.js injeta este arquivo via `new Function`, então dependências
// (pdf.js, extrator.js) são carregadas dinamicamente via <script>.
(function () {
  "use strict";

  var BASE = "convertidos/gerarLayout/";
  var ultimasLinhas = [];
  var csInterface = null;

  // Máquina citada no Fluxo -> nome curto do placeholder 11 (case-insensitive).
  // Ex: "IMP XINYU; COLAD AUTO; EXP 1" -> "XINYU".
  var MAQUINAS = [
    ["IMP AUT", "AUTOMÁTICA"],
    ["IMP XINYU", "XINYU"],
    ["GLORY 2504", "GLORY"],
    ["NOZOMI", "NOZOMI"],
    ["IMP 2245", "XINYU NOVA"]
  ];

  // Transforms por campo, aplicadas na extração (antes de exibir).
  // modelo: "201 CAIXA NORMAL" -> "CAIXA NORMAL" (remove números iniciais).
  // NÃO global: CodRef, Medidas e Chapa começam legitimamente com números.
  var TRANSFORMS = {
    modelo: function (v) { return String(v).replace(/^\d+\s*/, ""); },
    fluxo: function (v) {
      var up = String(v).toUpperCase();
      for (var i = 0; i < MAQUINAS.length; i++) {
        if (up.indexOf(MAQUINAS[i][0]) >= 0) return MAQUINAS[i][1];
      }
      return v; // sem correspondência: mantém o texto original
    }
  };

  // Ponte: chave do modelo/mapeamento.txt -> id do extrator.
  var CHAVE_PARA_ID = {
    Cliente: "cliente", Referencia: "referencia", CodRef: "codref",
    Modelo: "modelo", Papelao: "papelao", Resina: "resina", Area: "area",
    MedidasInternas: "medidas", Orelha: "orelha", MedInternCV: "medcv",
    Dimensoes: "dimensoes", Chapa: "chapa", OndaVirada: "onda", FI: "fi",
    Cliche: "cliche", LocalCliche: "localcliche", QtPecas: "qt",
    Forma: "forma", LocalForma: "localforma", Cores: "cores",
    FluxoPadraoMaq: "fluxo"
  };

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, type) {
    var el = $("statusText");
    var bar = $("status");
    if (el) el.textContent = msg;
    if (bar) bar.className = "status" + (type ? " " + type : "");
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Falha ao carregar: " + src)); };
      document.head.appendChild(s);
    });
  }

  function montarCampos() {
    var box = $("resultados");
    if (!box) return;
    box.innerHTML = "";
    window.MazurkyExtrator.CAMPOS.forEach(function (c, i) {
      var row = document.createElement("div");
      row.className = "result-row";
      var num = (i + 1 < 10 ? "0" + (i + 1) : String(i + 1));
      row.innerHTML =
        '<span class="result-num">' + num + '</span>' +
        '<span class="result-nome"></span>' +
        '<input class="input result-valor" data-campo="' + c.id + '" />';
      row.querySelector(".result-nome").textContent = c.nome;
      box.appendChild(row);
    });
  }

  function preencher(resultado, nomeArquivo) {
    var mapa = {};
    resultado.campos.forEach(function (c) { mapa[c.id] = c.valor; });
    var inputs = document.querySelectorAll("#resultados .result-valor");
    var n = 0;
    for (var i = 0; i < inputs.length; i++) {
      var idCampo = inputs[i].getAttribute("data-campo");
      var v = mapa[idCampo] || "";
      if (TRANSFORMS[idCampo]) v = TRANSFORMS[idCampo](v);
      inputs[i].value = v;
      if (v) n++;
    }
    var nome = $("arquivoNome");
    if (nome) nome.textContent = nomeArquivo + " — " + resultado.numPaginas + " pág.";
    setStatus("Extraído de " + nomeArquivo + " (" + n + " campos, " +
      (resultado.totalItens || 0) + " fragmentos em " +
      (resultado.totalLinhas || 0) + " linhas).", "ok");
  }

  function processarArquivo(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setStatus("Arquivo inválido: selecione um PDF.", "err");
      return;
    }
    setStatus("Lendo " + file.name + "...");
    var reader = new FileReader();
    reader.onload = function () {
      var buf = reader.result;
      var nbytes = buf && buf.byteLength ? buf.byteLength : 0;
      setStatus("Lido " + file.name + " (" + nbytes + " bytes). Extraindo...");
      window.MazurkyExtrator.extrairDoArrayBuffer(buf).then(function (res) {
        ultimasLinhas = res.linhasDebug || [];
        preencher(res, file.name);
      }).catch(function (e) {
        setStatus("Erro ao extrair: " + (e && e.message ? e.message : e), "err");
      });
    };
    reader.onerror = function () {
      setStatus("Erro ao ler o arquivo.", "err");
    };
    reader.readAsArrayBuffer(file);
  }

  function ligarDropzone() {
    var dz = $("dropzone");
    var fi = $("fileInput");
    if (!dz || !fi) return;
    dz.addEventListener("click", function () { fi.click(); });
    fi.addEventListener("change", function () {
      if (fi.files && fi.files[0]) processarArquivo(fi.files[0]);
      fi.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        dz.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        dz.classList.remove("dragover");
      });
    });
    dz.addEventListener("drop", function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files[0]) processarArquivo(files[0]);
    });
  }

  function sendToHost(funcName, args) {
    return new Promise(function (resolve, reject) {
      if (!csInterface) {
        reject(new Error("CSInterface não inicializado."));
        return;
      }
      var argStr = (args || []).map(function (a) { return JSON.stringify(a); }).join(", ");
      csInterface.evalScript(funcName + "(" + argStr + ")", function (result) {
        if (result === "EvalScript error.") reject(new Error("Erro no ExtendScript."));
        else resolve(result);
      });
    });
  }

  function lerValores() {
    var mapa = {};
    var inputs = document.querySelectorAll("#resultados .result-valor");
    for (var i = 0; i < inputs.length; i++) {
      mapa[inputs[i].getAttribute("data-campo")] = inputs[i].value;
    }
    return mapa;
  }

  // Mesmo fallback do main.js: fetch, senão leitura via ExtendScript.
  function carregarTexto(path) {
    return fetch(path)
      .then(function (r) { return r.text(); })
      .catch(function () {
        return sendToHost("lerArquivo", [path]).then(function (txt) {
          if (typeof txt === "string" && txt.indexOf("ERRO:") === 0) {
            throw new Error(txt.substring(5));
          }
          return txt;
        });
      });
  }

  function executarLayout() {
    var valores = lerValores();
    setStatus("Gerando layout...");
    carregarTexto(BASE + "modelo/mapeamento.txt").then(function (txt) {
      var trocas = {};
      txt.split(/\r?\n/).forEach(function (linha) {
        var l = linha.replace(/^\s+|\s+$/g, "");
        if (!l || l.charAt(0) === "#") return;
        var sep = l.indexOf(":");
        if (sep < 0) return;
        var chave = l.substring(0, sep).replace(/^\s+|\s+$/g, "");
        var token = l.substring(sep + 1).replace(/^\s+|\s+$/g, "");
        if (!token || token === "00") return; // vazio ou 00 = não usa
        var id = CHAVE_PARA_ID[chave];
        if (!id) return;
        trocas[token] = valores[id] || "";
      });
      if (!Object.keys(trocas).length) {
        setStatus("Mapeamento vazio: nada para preencher.", "err");
        return null;
      }
      return sendToHost("executar", [JSON.stringify({ trocas: trocas })]);
    }).then(function (res) {
      if (res === null || res === undefined) return;
      var partes = String(res).split("|");
      if (partes[0] === "ok") {
        var msg = "Layout gerado (" + partes[1] + " textos) em " + (partes[3] || "novo documento") + ".";
        if (partes[2]) msg += " Não encontrados no modelo: " + partes[2] + ".";
        msg += " Voltando ao menu...";
        setStatus(msg, partes[2] ? "err" : "ok");
        // Sucesso: mostra o resultado por alguns segundos e volta ao grid.
        setTimeout(function () { window.close(); }, 3000);
      } else {
        setStatus("Falha ao gerar layout: " + (partes[1] || res), "err");
      }
    }).catch(function (e) {
      setStatus("Falha ao gerar layout: " + (e && e.message ? e.message : e), "err");
    });
  }

  function ligarBotoes() {
    $("btnFechar").addEventListener("click", function () { window.close(); });
    $("btnExecutar").addEventListener("click", executarLayout);
    $("btnDebug").addEventListener("click", function () {
      var pre = $("debugOut");
      if (!pre) return;
      if (pre.classList.contains("hidden")) {
        var txt = ultimasLinhas.length
          ? ultimasLinhas.map(function (l) {
              return "p" + l.pagina + " y=" + l.y.toFixed(1) + " | " + l.texto;
            }).join("\n")
          : "Carregue um PDF primeiro.";
        pre.textContent = txt;
        pre.classList.remove("hidden");
      } else {
        pre.classList.add("hidden");
      }
    });
  }

  setStatus("Carregando leitor de PDF...");
  loadScript(BASE + "js/vendor/pdf.min.js").then(function () {
    if (typeof pdfjsLib !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = BASE + "js/vendor/pdf.worker.min.js";
    }
    // Carrega o worker também via <script>: registra window.pdfjsWorker e o
    // pdf.js extrai na thread principal, sem new Worker() (falha no CEP 12/2024).
    return loadScript(BASE + "js/vendor/pdf.worker.min.js");
  }).then(function () {
    return loadScript(BASE + "js/extrator.js");
  }).then(function () {
    try {
      csInterface = new CSInterface();
    } catch (e) {
      csInterface = null;
    }
    montarCampos();
    ligarDropzone();
    ligarBotoes();
    setStatus("Pronto. Arraste um PDF para a área acima.");
  }).catch(function (e) {
    setStatus("Falha ao carregar leitor de PDF: " + (e && e.message ? e.message : e), "err");
  });
})();
