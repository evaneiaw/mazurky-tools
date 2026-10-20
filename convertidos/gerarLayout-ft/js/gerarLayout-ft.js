// gerarLayout-ft.js — Gerar Layout via FT do banco (sem PDF)
(function () {
  "use strict";

  var BASE = "convertidos/gerarLayout-ft/";
  var csInterface = null;
  var ctx = null;
  var MED_FONTE_KEY = "mazurky_gl_medidas";
  var confirmaMedidaVazia = false;

  var CAMPOS = [
    { id: "cliente",     nome: "Cliente",            rotulo: "Cliente:" },
    { id: "referencia",  nome: "Referência",         rotulo: "Referência:" },
    { id: "codref",      nome: "Cód.Ref",            rotulo: "Cód.Ref:" },
    { id: "modelo",      nome: "Modelo",             rotulo: "Modelo:" },
    { id: "papelao",     nome: "Papelão",            rotulo: "Papelão:" },
    { id: "resina",      nome: "Resina",             rotulo: "Resina:" },
    { id: "area",        nome: "Área",               rotulo: "Área:" },
    { id: "medidas",     nome: "Medidas internas",   rotulo: "Medidas internas:" },
    { id: "medcv",       nome: "Med. intern. CV",    rotulo: "Med. intern. CV:" },
    { id: "medidascli",  nome: "Med. intern. cliente", rotulo: "Med. intern. cliente:" },
    { id: "orelha",      nome: "Orelha",             rotulo: "Orelha:" },
    { id: "dimensoes",   nome: "Dimensões cx (LxC)", rotulo: "Dimensões cx (LxC):" },
    { id: "chapa",       nome: "Chapa (LxC)",        rotulo: "Chapa (LxC):" },
    { id: "onda",        nome: "Onda virada",        rotulo: "Onda virada:" },
    { id: "fi",          nome: "FI",                 rotulo: "FI:" },
    { id: "cliche",      nome: "Cliche",             rotulo: "Cliche:" },
    { id: "localcliche", nome: "Local cliche",       rotulo: "Local cliche:" },
    { id: "qt",          nome: "Qt pç chp/forma",    rotulo: "Qt pç chp/forma:" },
    { id: "forma",       nome: "Forma",              rotulo: "Forma:" },
    { id: "localforma",  nome: "Local forma",        rotulo: "Local forma:" },
    { id: "cores",       nome: "Cores",              rotulo: "Cores:" },
    { id: "fluxo",       nome: "Fluxo padrão máq",   rotulo: "Fluxo padrão máq:" }
  ];

  var MAQUINAS = [
    ["IMP AUT", "AUTOMÁTICA"],
    ["IMP XINYU", "XINYU"],
    ["GLORY 2504", "GLORY"],
    ["NOZOMI", "NOZOMI"],
    ["IMP 2245", "XINYU NOVA"]
  ];

  var TRANSFORMS = {
    modelo: function (v) { return String(v).replace(/^\d+\s*/, ""); },
    fluxo: function (v) {
      var up = String(v).toUpperCase();
      for (var i = 0; i < MAQUINAS.length; i++) {
        if (up.indexOf(MAQUINAS[i][0]) >= 0) return MAQUINAS[i][1];
      }
      return v;
    }
  };

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

  function montarCampos() {
    var box = $("resultados");
    if (!box) return;
    box.innerHTML = "";
    CAMPOS.forEach(function (c, i) {
      var row = document.createElement("div");
      row.className = "result-row";
      var num = (i + 1 < 10 ? "0" + (i + 1) : String(i + 1));
      var isFonte = (c.id === "medidas" || c.id === "medcv" || c.id === "medidascli");
      row.innerHTML =
        '<span class="result-radio"></span>' +
        '<span class="result-num">' + num + '</span>' +
        '<span class="result-nome"></span>' +
        '<input class="input result-valor" data-campo="' + c.id + '" />';
      row.querySelector(".result-nome").textContent = c.nome;
      if (isFonte) {
        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "medidas_fonte";
        radio.value = c.id;
        if (c.id === "medidas") radio.checked = true;
        row.querySelector(".result-radio").appendChild(radio);
      }
      box.appendChild(row);
    });
  }

  function preencher(mapa) {
    var inputs = document.querySelectorAll("#resultados .result-valor");
    var n = 0;
    for (var i = 0; i < inputs.length; i++) {
      var idCampo = inputs[i].getAttribute("data-campo");
      var v = mapa[idCampo] || "";
      if (TRANSFORMS[idCampo]) v = TRANSFORMS[idCampo](v);
      inputs[i].value = v;
      if (v) n++;
    }
    return n;
  }

  function primeiro() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "";
  }

  function par(a, b, sep) {
    var va = (a === undefined || a === null || a === "") ? "" : String(a);
    var vb = (b === undefined || b === null || b === "") ? "" : String(b);
    if (!va && !vb) return "";
    return va + (sep || " x ") + vb;
  }

  function trio(a, b, c) {
    return [a, b, c].filter(function (x) {
      return x !== undefined && x !== null && x !== "";
    }).join(" x ");
  }

  function mapear(ref, it, ci, cliente) {
    var medidas = trio(it.M1, it.M2, it.M3) || trio(ci.M1, ci.M2, ci.M3);
    var medcv = trio(ref.M1, ref.M2, ref.M3) || trio(it.M1, it.M2, it.M3);
    var corBruta = String(primeiro(it.CORES, ci.CORES) || "").trim();
    var posAst = corBruta.indexOf("*");
    var coresTxt = (posAst >= 0 ? corBruta.substring(posAst + 1) : corBruta).replace(/\s+/g, " ").trim();
    return {
      cliente: cliente || "",
      referencia: primeiro(it.REFERENCIA, ref.REFERENCIA),
      codref: primeiro(ref.CODIGO, it.CODIGOREF),
      modelo: (String(primeiro(it.CAIXA, ci.CAIXA, "")) + " " + String(primeiro(ci.NOMECAIXA, it.NOMECAIXA, ""))).replace(/\s+/g, " ").trim(),
      papelao: primeiro(it.PAPELAO, ci.PAPELAO),
      resina: primeiro(it.RESINA, ci.RESINA),
      area: primeiro(it.AREA, ref.AREACONJUNTO),
      medidas: medidas,
      orelha: primeiro(it.ORELHA, ci.ORELHA, ref.M4),
      medcv: medcv,
      dimensoes: par(primeiro(it.LARG_UN, it.LARG), primeiro(it.COMP_UN, it.COMP)),
      chapa: par(primeiro(it.LARGCHAPA, ci.LARGCHAPA), primeiro(it.COMPCHAPA, ci.COMPCHAPA)),
      onda: primeiro(it.ONDA_VIRADA, it.ONDA, ci.ONDA),
      fi: primeiro(it.FI),
      cliche: String(primeiro(it.CLICHE, ci.CLICHE)).replace(/^\s+|\s+$/g, ""),
      localcliche: primeiro(it.LOCAL_CLICHE),
      qt: primeiro(it.QUANTPECAS, it.QUANT_PCS_FORMATO, ci.QUANTPECAS),
      forma: primeiro(it.FORMA),
      localforma: primeiro(it.LOCAL_FORMA),
      cores: coresTxt,
      fluxo: primeiro(ci.FLUXOMAQ, it.FLUXOMAQ)
    };
  }

  function mostrarLoading(msg) {
    var l = $("telaLoading");
    if (l) l.classList.remove("hidden");
    var c = $("telaCampos");
    if (c) c.classList.add("hidden");
    var a = $("acoes");
    if (a) a.classList.add("hidden");
    var t = $("loadingTexto");
    if (t && msg) t.textContent = msg;
    setStatus(msg || "Carregando...");
  }

  function esconderLoading() {
    var l = $("telaLoading");
    if (l) l.classList.add("hidden");
    var c = $("telaCampos");
    if (c) c.classList.remove("hidden");
    var a = $("acoes");
    if (a) a.classList.remove("hidden");
  }

  function getCacheFT(ft) {
    return new Promise(function (resolve) {
      if (!window.MazurkyFTAPI || !window.MazurkyFTAPI.getCacheFT) {
        resolve(null);
        return;
      }
      window.MazurkyFTAPI.getCacheFT(ft, function (txt) {
        if (typeof txt === "string" && txt.length > 2) {
          try {
            var obj = JSON.parse(txt);
            if (obj && typeof obj === "object" && Object.keys(obj).length) {
              resolve(obj);
              return;
            }
          } catch (e) {}
        }
        resolve(null);
      });
    });
  }

  function buscarCliente(ref) {
    var cod = ref.CLIENTE;
    if (!cod) return Promise.resolve("");
    return window.MazurkyFTAPI.clienteNome(cod);
  }

  function isoMeses(delta) {
    var d = new Date();
    d.setMonth(d.getMonth() + delta);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // Medidas internas da caixa do cliente (item do pedido): LARG_CX x COMP_CX x ALT_CX
  // (as mesmas que o "Medidas internas" do documento da OF no NovaOF). Devolve um
  // mapa itemRef -> texto.
  function medidasClienteDosPedidos(pedidos, ft) {
    var mapa = {};
    var p, m, ped, lista, it;
    for (p = 0; p < pedidos.length; p++) {
      ped = pedidos[p];
      if (!ped) continue;
      lista = ped.Item || ped.Itens || [];
      for (m = 0; m < lista.length; m++) {
        it = lista[m];
        if (!it) continue;
        if (String(it.CODIGOREF) !== String(ft)) continue;
        if (String(it.CANCELADO || "N").toUpperCase() === "S") continue;
        var txt = medidasClienteItem(it);
        if (!txt) continue;
        var key = String(it.ITEMREF == null ? "" : it.ITEMREF);
        if (key && !mapa[key]) mapa[key] = txt;
      }
    }
    return mapa;
  }

  function medidasClienteItem(it) {
    if (!it || it.LARG_CX === null || it.LARG_CX === undefined) return "";
    function num(v) {
      if (v === null || v === undefined || v === "") return "";
      var n = Number(v);
      if (!isNaN(n) && Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
      return String(v).replace(".", ",");
    }
    return num(it.LARG_CX) + " x " + num(it.COMP_CX) + " x " + num(it.ALT_CX);
  }

  function buscarMedidasCliente() {
    var api = window.MazurkyFTAPI;
    if (!api || !api.getRef || !api.consultarPedidos) {
      return Promise.reject(new Error("Módulo do banco incompleto."));
    }
    return api.getRef(ctx.ft).then(function (d) {
      var ref = (d && d.ref && d.ref[0]) || {};
      var cliente = ref.CLIENTE;
      if (cliente == null) return {};
      return api.consultarPedidos(
        cliente, isoMeses(-36), isoMeses(6), true
      ).then(function (pedidos) {
        return medidasClienteDosPedidos(pedidos || [], ctx.ft);
      });
    });
  }

  function aplicarMedidasCliente(mapa) {
    if (!ctx || !mapa) return 0;
    var aplicados = 0;
    for (var i = 0; i < ctx.itens.length; i++) {
      var it = ctx.itens[i];
      var chaves = [it.itemRef, it.item];
      var v = "";
      for (var k = 0; k < chaves.length; k++) {
        var key = String(chaves[k] == null ? "" : chaves[k]);
        if (key && mapa[key]) { v = mapa[key]; break; }
      }
      if (v) { it.campos.medidascli = v; aplicados++; }
    }
    return aplicados;
  }

  function precisaMedidasCliente() {
    if (!ctx || !ctx.itens.length) return true;
    for (var i = 0; i < ctx.itens.length; i++) {
      var c = ctx.itens[i].campos || {};
      if (!String(c.medidascli || "").replace(/^\s+|\s+$/g, "")) return true;
    }
    return false;
  }

  function casarCi(listaCi, it) {
    var i;
    if (it && it.CHAVE !== undefined && it.CHAVE !== null) {
      for (i = 0; i < listaCi.length; i++) {
        if (listaCi[i] && String(listaCi[i].CHAVE) === String(it.CHAVE)) return listaCi[i];
      }
    }
    if (it && it.ITEM !== undefined && it.ITEM !== null) {
      for (i = 0; i < listaCi.length; i++) {
        if (listaCi[i] && String(listaCi[i].ITEM) === String(it.ITEM)) return listaCi[i];
      }
    }
    return null;
  }

  function rotuloItem(it, ci) {
    var num = primeiro(it.ITEM, ci.ITEM);
    var nome = primeiro(it.REFERENCIA, ci.REFERENCIA, ci.NOMECAIXA, it.NOMECAIXA);
    var txt = num !== "" ? "Item " + num : "Item";
    if (nome) txt += " - " + nome;
    return txt;
  }

  function montarItens(dados, ciResp) {
    var listaGet = (dados && dados.item) || [];
    var listaCi = (ciResp && ciResp.itens) || [];
    var base = listaGet.length ? listaGet : listaCi;
    var itens = [];
    for (var i = 0; i < base.length; i++) {
      var it = listaGet.length ? (base[i] || {}) : {};
      var ci = listaGet.length
        ? (casarCi(listaCi, it) || listaCi[i] || {})
        : (base[i] || {});
      itens.push({
        chave: primeiro(it.CHAVE, ci.CHAVE),
        item: primeiro(it.ITEM, ci.ITEM, i + 1),
        itemRef: primeiro(it.ITEM, ci.ITEM),
        rotulo: rotuloItem(it, ci),
        it: it,
        ci: ci,
        campos: {}
      });
    }
    return itens;
  }

  function renderItens() {
    var box = $("itemRadios");
    var fs = $("itemFieldset");
    if (!box) return;
    box.innerHTML = "";
    var itens = ctx ? ctx.itens : [];
    if (itens.length <= 1) {
      if (fs) fs.classList.add("hidden");
      return;
    }
    if (fs) fs.classList.remove("hidden");
    for (var i = 0; i < itens.length; i++) {
      var label = document.createElement("label");
      label.className = "radio";
      var inp = document.createElement("input");
      inp.type = "radio";
      inp.name = "layoutItem";
      inp.value = String(i);
      inp.addEventListener("change", (function (idx) {
        return function () { selecionarItem(idx, true); };
      })(i));
      var span = document.createElement("span");
      span.textContent = itens[i].rotulo;
      label.appendChild(inp);
      label.appendChild(span);
      box.appendChild(label);
    }
  }

  function selecionarItem(idx, salvar) {
    if (!ctx || !ctx.itens.length) return 0;
    if (idx < 0 || idx >= ctx.itens.length) idx = 0;
    ctx.escolhido = idx;
    confirmaMedidaVazia = false;
    var n = preencher(ctx.itens[idx].campos || {});
    tratarMedidasVazias(true);
    var radios = document.querySelectorAll('#itemRadios input[name="layoutItem"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = (Number(radios[i].value) === idx);
    }
    if (salvar) salvarCache();
    return n;
  }

  function salvarCache() {
    if (!ctx || !window.MazurkyFTAPI) return;
    var itens = ctx.itens.map(function (x) {
      return { item: x.item, chave: x.chave, rotulo: x.rotulo, campos: x.campos || {} };
    });
    window.MazurkyFTAPI.salvarCacheFT(ctx.ft, {
      escolhido: ctx.escolhido || 0,
      itens: itens
    });
  }

  function aplicarCache(ft, cache) {
    var itens = [];
    if (cache && cache.itens && cache.itens.length) {
      for (var i = 0; i < cache.itens.length; i++) {
        var c = cache.itens[i] || {};
        itens.push({
          item: c.item,
          chave: c.chave,
          rotulo: c.rotulo,
          it: null,
          ci: null,
          campos: c.campos || {}
        });
      }
    } else {
      itens.push({ item: 1, chave: "", rotulo: "Item 1", it: null, ci: null, campos: cache || {} });
    }
    ctx = { ft: ft, ref: {}, itens: itens, escolhido: 0 };
    var nome = $("arquivoNome");
    if (nome) nome.textContent = "FT " + ft;
    renderItens();
    var idx = (cache && cache.escolhido !== undefined && cache.escolhido !== null) ? Number(cache.escolhido) : 0;
    if (isNaN(idx) || idx < 0 || idx >= itens.length) idx = 0;
    return selecionarItem(idx, false);
  }

  function carregarTudo(ft) {
    var usouCache = false;
    var ref = {};
    return getCacheFT(ft).then(function (cache) {
      if (cache) {
        usouCache = true;
        aplicarCache(ft, cache);
        return null;
      }
      return Promise.all([
        window.MazurkyFTAPI.getRef(ft),
        window.MazurkyFTAPI.consultarItens(ft)
      ]).then(function (res) {
        var dados = res[0];
        var ciResp = res[1];
        ref = (dados.ref && dados.ref[0]) || {};
        var itens = montarItens(dados, ciResp);
        ctx = { ft: ft, ref: ref, itens: itens, escolhido: 0 };
        for (var i = 0; i < itens.length; i++) {
          itens[i].campos = mapear(ref, itens[i].it, itens[i].ci, "");
        }
        var nome = $("arquivoNome");
        if (nome) nome.textContent = "FT " + ft;
        renderItens();
        selecionarItem(0, false);
        return null;
      });
    }).then(function () {
      setStatus("Buscando cliente e medidas do cliente...");
      var pCliente = (!usouCache && ref.CLIENTE)
        ? buscarCliente(ref).catch(function () { return ""; })
        : Promise.resolve(null);
      var pMedidas = precisaMedidasCliente()
        ? buscarMedidasCliente().catch(function () { return null; })
        : Promise.resolve(null);
      return Promise.all([pCliente, pMedidas]);
    }).then(function (rs) {
      var nomeCli = rs[0];
      var mapaMedidas = rs[1];
      var aplicados = 0;
      if (mapaMedidas) aplicados = aplicarMedidasCliente(mapaMedidas);
      else if (usouCache) aplicados = -1; // cache ja tinha (ou nao precisava)
      if (nomeCli) {
        for (var j = 0; j < ctx.itens.length; j++) {
          ctx.itens[j].campos.cliente = nomeCli;
        }
      }
      var n = selecionarItem(ctx.escolhido, false);
      salvarCache();
      var sel = ctx.itens[ctx.escolhido] || ctx.itens[0];
      var medTxt = (sel && sel.campos) ? String(sel.campos.medidascli || "") : "";
      if (aplicados === 0 && !medTxt) {
        setStatus("Medidas internas do cliente não encontradas no pedido desta FT.", "err");
      }
      return { n: n, cache: usouCache, itens: ctx.itens.length, medida: medTxt };
    });
  }

  function atualizarBase() {
    var btn = $("btnBuscarFT");
    if (btn) btn.disabled = true;
    mostrarLoading("Atualizando base de clientes...");
    var ft = ($("ftNumero") && $("ftNumero").value) || (window.MazurkyFT ? window.MazurkyFT.get() : "");
    window.MazurkyFTAPI.atualizarBaseClientes().then(function (qtd) {
      if (ft) window.MazurkyFTAPI.limparCacheFT(ft);
      if (btn) btn.disabled = false;
      setStatus("Base atualizada (" + qtd + " clientes).", "ok");
      buscarFT();
    }).catch(function (e) {
      if (btn) btn.disabled = false;
      esconderLoading();
      setStatus("Erro ao atualizar base: " + (e && e.message ? e.message : e), "err");
    });
  }

  function buscarFT() {
    var input = $("ftNumero");
    var ft = (input && input.value) || (window.MazurkyFT ? window.MazurkyFT.get() : "");
    if (!ft) {
      esconderLoading();
      setStatus("Informe a FT no hub primeiro.", "err");
      return;
    }
    if (!window.MazurkyFTAPI) {
      esconderLoading();
      setStatus("Módulo do banco não carregado.", "err");
      return;
    }
    var btn = $("btnBuscarFT");
    if (btn) btn.disabled = true;
    mostrarLoading("Carregando dados da FT " + ft + "...");
    carregarTudo(ft).then(function (r) {
      esconderLoading();
      var extra = (r.itens && r.itens > 1) ? (", " + r.itens + " layouts") : "";
      var msg = "FT " + ft + " carregada (" + r.n + " campos" + extra + (r.cache ? ", cache" : "") + ").";
      if (r.medida) msg += " Med. interna cliente: " + r.medida + ".";
      setStatus(msg, "ok");
    }).catch(function (e) {
      esconderLoading();
      setStatus("Erro ao buscar FT: " + (e && e.message ? e.message : e), "err");
    }).finally(function () {
      if (btn) btn.disabled = false;
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

  function lerOrientacao() {
    var el = document.querySelector('input[name="orientacao"]:checked');
    return el ? el.value : "paisagem";
  }

  function ligarOrientacao() {
    var radios = document.querySelectorAll('input[name="orientacao"]');
    if (!radios.length) return;
    var salva = "";
    try { salva = localStorage.getItem("mazurky_gl_orientacao") || ""; } catch (e) {}
    if (salva) {
      for (var i = 0; i < radios.length; i++) {
        radios[i].checked = radios[i].value === salva;
      }
    }
    for (var j = 0; j < radios.length; j++) {
      radios[j].addEventListener("change", function () {
        try { localStorage.setItem("mazurky_gl_orientacao", lerOrientacao()); } catch (e) {}
      });
    }
  }

  function nomeFonteMedidas(id) {
    if (id === "medcv") return "Med. internas CV";
    if (id === "medidascli") return "Med. internas cliente";
    return "Med. internas";
  }

  function lerFonteMedidas() {
    var el = document.querySelector('input[name="medidas_fonte"]:checked');
    return el ? el.value : "medidas";
  }

  function valorDaFonte(id) {
    var el = document.querySelector('#resultados .result-valor[data-campo="' + id + '"]');
    if (!el) return "";
    return String(el.value || "").replace(/^\s+|\s+$/g, "");
  }

  function marcarFonteMedidas(id) {
    var radios = document.querySelectorAll('input[name="medidas_fonte"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = (radios[i].value === id);
    }
    try { localStorage.setItem(MED_FONTE_KEY, id); } catch (e) {}
  }

  function resolverFonteMedidas() {
    var fonte = lerFonteMedidas();
    if (valorDaFonte(fonte)) return { fonte: fonte, vazia: false, fallbackDe: null };
    var ordem = ["medidas", "medcv", "medidascli"];
    for (var i = 0; i < ordem.length; i++) {
      if (ordem[i] !== fonte && valorDaFonte(ordem[i])) {
        return { fonte: ordem[i], vazia: false, fallbackDe: fonte };
      }
    }
    return { fonte: fonte, vazia: true, fallbackDe: null };
  }

  function tratarMedidasVazias(silencioso) {
    var r = resolverFonteMedidas();
    if (r.fallbackDe) {
      marcarFonteMedidas(r.fonte);
      if (!silencioso) {
        setStatus("A medida escolhida estava vazia; usando \"" + nomeFonteMedidas(r.fonte) + "\".", "err");
      }
    }
    return r;
  }

  function ligarMedidas() {
    var radios = document.querySelectorAll('input[name="medidas_fonte"]');
    if (radios.length) {
      var salva = "";
      try { salva = localStorage.getItem(MED_FONTE_KEY) || ""; } catch (e) {}
      if (salva) {
        for (var i = 0; i < radios.length; i++) {
          radios[i].checked = (radios[i].value === salva);
        }
      }
      for (var j = 0; j < radios.length; j++) {
        radios[j].addEventListener("change", function () {
          confirmaMedidaVazia = false;
          var id = lerFonteMedidas();
          try { localStorage.setItem(MED_FONTE_KEY, id); } catch (e) {}
          if (!valorDaFonte(id)) {
            setStatus("A opção \"" + nomeFonteMedidas(id) + "\" está vazia. Escolha outra ou clique Executar para continuar mesmo assim.", "err");
          }
        });
      }
    }
    var elCli = document.querySelector('#resultados .result-valor[data-campo="medidascli"]');
    if (elCli) {
      elCli.addEventListener("input", function () {
        confirmaMedidaVazia = false;
        if (String(elCli.value || "").replace(/^\s+|\s+$/g, "")) {
          marcarFonteMedidas("medidascli");
        }
      });
    }
  }

  function carregarTexto(path) {
    return fetch(path, { cache: "no-store" })
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
    var r = resolverFonteMedidas();
    if (r.vazia) {
      if (!confirmaMedidaVazia) {
        confirmaMedidaVazia = true;
        setStatus("Nenhuma das 3 medidas internas está preenchida. Clique Executar de novo para gerar o layout sem ela.", "err");
        return;
      }
    } else if (r.fallbackDe) {
      marcarFonteMedidas(r.fonte);
      setStatus("A medida escolhida estava vazia; usando \"" + nomeFonteMedidas(r.fonte) + "\".", "err");
    }
    confirmaMedidaVazia = false;
    valores["medidas"] = valorDaFonte(r.fonte);
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
        if (!token || token === "00") return;
        var id = CHAVE_PARA_ID[chave];
        if (!id) return;
        trocas[token] = valores[id] || "";
      });
      if (!Object.keys(trocas).length) {
        setStatus("Mapeamento vazio: nada para preencher.", "err");
        return null;
      }
      return sendToHost("executar", [JSON.stringify({ trocas: trocas, orientacao: lerOrientacao() })]);
    }).then(function (res) {
      if (res === null || res === undefined) return;
      var partes = String(res).split("|");
      if (partes[0] === "ok") {
        var orient = partes[4] === "retrato" ? " (retrato)" : "";
        var msg = "Layout gerado (" + partes[1] + " textos) em " + (partes[3] || "novo documento") + orient + ".";
        if (partes[2]) msg += " Não encontrados no modelo: " + partes[2] + ".";
        msg += " Voltando ao menu...";
        setStatus(msg, partes[2] ? "err" : "ok");
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
    $("btnBuscarFT").addEventListener("click", atualizarBase);
  }

  function init() {
    try {
      csInterface = new CSInterface();
    } catch (e) {
      csInterface = null;
    }
    montarCampos();
    ligarBotoes();
    ligarOrientacao();
    ligarMedidas();
    var ft = window.MazurkyFT ? window.MazurkyFT.get() : "";
    var input = $("ftNumero");
    if (input) input.value = ft;
    if (ft) {
      buscarFT();
    } else {
      esconderLoading();
      setStatus("Informe a FT no hub para preencher automaticamente.", "err");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
