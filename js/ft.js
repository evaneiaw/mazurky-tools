(function () {
  "use strict";

  var FT_KEY = "mazurky_ft";

  var API = {
    BASE: "http://192.168.22.252:9090",
    NOMEBD: "Mazurky",
    USUARIO: "EVANEI.AW",
    USER: "4/Oowx6Yj6eTr66PxNiqAg==",
    PASS: "a62h/nvMU7NN63w+7brUz+RdPYRJCQ/3Mx7Ly6OH12A="
  };

  function authHeader() {
    return "Basic " + btoa(API.USER + ":" + API.PASS);
  }

  function url(path) {
    return API.BASE + path + (path.indexOf("?") >= 0 ? "&" : "?") +
      "NomeBD=" + encodeURIComponent(API.NOMEBD) +
      "&usuario=" + encodeURIComponent(API.USUARIO);
  }

  function headers() {
    return {
      Accept: "application/json",
      "User-Agent": "Embarcadero RESTClient/1.0",
      Authorization: authHeader()
    };
  }

  var cs = null;
  function host() {
    if (!cs) {
      try { cs = new CSInterface(); } catch (e) { cs = null; }
    }
    return cs;
  }

  function evalHost(script, cb) {
    var c = host();
    if (!c) { if (cb) cb(""); return; }
    try {
      c.evalScript(script, function (r) { if (cb) cb(r); });
    } catch (e) {
      if (cb) cb("");
    }
  }

  var FT = {
    get: function () {
      try { return localStorage.getItem(FT_KEY) || ""; } catch (e) { return ""; }
    },
    set: function (v) {
      v = String(v == null ? "" : v).replace(/\D/g, "");
      try {
        if (v) localStorage.setItem(FT_KEY, v);
        else localStorage.removeItem(FT_KEY);
      } catch (e) {}
      evalHost("salvarFT(" + JSON.stringify(v) + ")");
      return v;
    },
    limpar: function () {
      return FT.set("");
    },
    sincronizar: function (cb) {
      evalHost("getFT()", function (r) {
        var hostVal = typeof r === "string" ? r.replace(/\D/g, "") : "";
        var local = FT.get();
        if (local) {
          if (hostVal !== local) evalHost("salvarFT(" + JSON.stringify(local) + ")");
          if (cb) cb(local);
        } else if (hostVal) {
          try { localStorage.setItem(FT_KEY, hostVal); } catch (e) {}
          if (cb) cb(hostVal);
        } else {
          if (cb) cb("");
        }
      });
    }
  };

  function getRef(codigo) {
    return fetch(url("/server/Ref/GetRef/" + encodeURIComponent(codigo)), {
      headers: headers(),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function consultarItens(codigo) {
    return fetch(url("/server/Ref/ConsultarItens/" + encodeURIComponent(codigo)), {
      headers: headers(),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // =====================================================================
  // Dataset de impressao da OF (POST /server/PCP/ImpOF). Devolve a linha
  // completa da OF, inclusive VINCOS / VINCOS_LARG / VINCOS_COMP (caixa
  // Vincadeira/Impressora = linhas/colunas da faca), que o GetRef nao tem.
  // `reemissao:true` e obrigatorio para OF ja emitida.
  // =====================================================================
  var cacheImpOF = {};
  var CACHE_IMPOF_TTL = 300000; // 5 min

  function impOF(of, forcar) {
    var chave = String(of);
    var agora = Date.now();
    if (!forcar && cacheImpOF[chave] && (agora - cacheImpOF[chave].ts) < CACHE_IMPOF_TTL) {
      return Promise.resolve(cacheImpOF[chave].row);
    }
    return fetch(url("/server/PCP/ImpOF"), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers()),
      body: JSON.stringify({ ofIni: Number(of), ofFim: Number(of), reemissao: true }),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var dados = j.dados || [];
      var row = {};
      for (var i = 0; i < dados.length; i++) {
        if (dados[i] && Number(dados[i].ITEM) === Number(of)) { row = dados[i]; break; }
      }
      cacheImpOF[chave] = { ts: Date.now(), row: row };
      return row;
    });
  }

  // =====================================================================
  // Historico de OF de uma FT. A OF e o ITEM do item de PEDIDO.
  //   FT --GetRef--> ref.CLIENTE
  //   POST /server/Pedido/Consultar {cliente,dtIni,dtFim} --> ped[].Item[]
  //     item.CODIGOREF == FT  ->  OF = item.ITEM
  // Endpoints nao documentados; descobertos por varredura (ver doc/ENDPOINT).
  // =====================================================================

  var cacheNF = {};
  var cachePed = {};
  var CACHE_NF_TTL = 300000;  // 5 min
  var CACHE_PED_TTL = 300000; // 5 min

  function consultarNFPeriodo(ini, fim, forcar) {
    var chave = ini + "|" + fim;
    var agora = Date.now();
    if (!forcar && cacheNF[chave] && (agora - cacheNF[chave].ts) < CACHE_NF_TTL) {
      return Promise.resolve(cacheNF[chave].nf);
    }
    return fetch(url("/server/NF/Consultar"), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers()),
      body: JSON.stringify({ dtIni: ini, dtFim: fim }),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var nf = j.nf || [];
      cacheNF[chave] = { ts: Date.now(), nf: nf };
      return nf;
    });
  }

  function consultarPedidos(cliente, ini, fim, forcar) {
    var chave = cliente + "|" + ini + "|" + fim;
    var agora = Date.now();
    if (!forcar && cachePed[chave] && (agora - cachePed[chave].ts) < CACHE_PED_TTL) {
      return Promise.resolve(cachePed[chave].ped);
    }
    return fetch(url("/server/Pedido/Consultar"), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers()),
      body: JSON.stringify({ cliente: Number(cliente), dtIni: ini, dtFim: fim }),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var ped = j.ped || [];
      cachePed[chave] = { ts: Date.now(), ped: ped };
      return ped;
    });
  }

  function formatarOF(n) {
    var s = String(n == null ? "" : n).replace(/\D/g, "");
    if (!s) return "";
    s = ("000000" + s).slice(-6);
    return s.slice(0, 3) + "." + s.slice(3);
  }

  function numBR(v) {
    if (v === null || v === undefined || v === "") return "";
    var n = Number(v);
    if (!isNaN(n) && Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(v).replace(".", ",");
  }

  // Medidas internas da caixa do cliente (item do pedido): LARG_CX x COMP_CX x ALT_CX.
  // E o mesmo valor que o "Medidas internas" do documento da OF imprime (NovaOF).
  function medidasClienteItem(it) {
    if (!it || it.LARG_CX === null || it.LARG_CX === undefined) return "";
    var l = numBR(it.LARG_CX), c = numBR(it.COMP_CX), a = numBR(it.ALT_CX);
    if (!l && !c && !a) return "";
    return l + " x " + c + " x " + a;
  }

  function historicoOF(ft, ini, fim, forcarCache) {
    ft = String(ft == null ? "" : ft).replace(/\D/g, "");
    if (!ft) return Promise.reject(new Error("Informe a FT na tela inicial."));
    return getRef(ft).then(function (ref) {
      var rf = (ref.ref && ref.ref[0]) || {};
      var cliente = rf.CLIENTE;
      if (cliente == null) throw new Error("FT sem cliente no cadastro.");
      return consultarPedidos(cliente, ini, fim, forcarCache).then(function (pedidos) {
        var ofs = [];
        var p, m, ped, lista, it;
        for (p = 0; p < pedidos.length; p++) {
          ped = pedidos[p];
          if (!ped) continue;
          if (String(ped.CANCELADO || "N").toUpperCase() === "S") continue;
          lista = ped.Item || ped.Itens || [];
          for (m = 0; m < lista.length; m++) {
            it = lista[m];
            if (it == null || String(it.CODIGOREF) !== ft) continue;
            if (String(it.CANCELADO || "N").toUpperCase() === "S") continue;
            ofs.push({
              of: it.ITEM,
              ofFormatada: formatarOF(it.ITEM),
              data: ped.DATA,
              entrega: it.ENTREGA,
              quantidade: Number(it.QUANTIDADE) || 0,
              pedido: ped.PEDIDO,
              itemRef: it.ITEMREF,
              largCX: it.LARG_CX,
              compCX: it.COMP_CX,
              altCX: it.ALT_CX,
              medidasCliente: medidasClienteItem(it),
              emitida: String(it.OF_EMITIDA || "N").toUpperCase() === "S",
              referencia: it.REFERENCIA || rf.REFERENCIA || "",
              cliente: cliente,
              nome: ped.NOMECLIENTE || ""
            });
          }
        }
        ofs.sort(function (a, b) {
          var d = String(b.data || "").localeCompare(String(a.data || ""));
          if (d !== 0) return d;
          return String(b.of || "").localeCompare(String(a.of || ""));
        });
        return {
          ft: Number(ft),
          referencia: rf.REFERENCIA || "",
          cliente: cliente,
          periodo: { ini: ini, fim: fim },
          ofs: ofs,
          totalRegistros: ofs.length
        };
      });
    });
  }

  // =====================================================================
  // Mapa "codigo do cliente -> nome", com cache em memoria e em disco.
  // Construido uma vez a partir de POST /server/Ref/Consultar (streaming).
  // =====================================================================

  var mapaClientes = null;

  function limparNome(s) {
    return String(s)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/^\s+|\s+$/g, "");
  }

  function processarRegistro(rec, mapa) {
    var mc = rec.match(/"CLIENTE":(\d+)/);
    if (!mc) return;
    var cod = mc[1];
    if (mapa[cod]) return;
    var mf = rec.match(/"FANTASIA":"((?:[^"\\]|\\.)*)"/);
    var mn = rec.match(/"NOME":"((?:[^"\\]|\\.)*)"/);
    var nome = (mf && mf[1]) || (mn && mn[1]) || "";
    if (!nome) return;
    mapa[cod] = limparNome(nome);
  }

  function criarParser(mapa) {
    var iniciado = false;
    var buf = "";
    function push(txt) {
      buf += txt;
      if (!iniciado) {
        var i = buf.indexOf('"ref":[');
        if (i < 0) {
          if (buf.length > 256) buf = buf.slice(-256);
          return;
        }
        buf = buf.slice(i + 7);
        iniciado = true;
      }
      var sep;
      while ((sep = buf.indexOf("},{")) >= 0) {
        processarRegistro(buf.slice(0, sep), mapa);
        buf = buf.slice(sep + 3);
      }
      if (buf.length > 200000) buf = buf.slice(-40000);
    }
    function fim() {
      if (iniciado && buf) processarRegistro(buf, mapa);
    }
    return { push: push, fim: fim };
  }

  function viaFetchMapa(parser) {
    return fetch(url("/server/Ref/Consultar"), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers()),
      body: "{}"
    }).then(function (r) {
      if (!r.ok || !r.body || typeof r.body.getReader !== "function") {
        throw new Error("HTTP " + r.status);
      }
      var reader = r.body.getReader();
      var dec = new TextDecoder("utf-8");
      function ler() {
        return reader.read().then(function (res) {
          if (res.done) return;
          parser.push(dec.decode(res.value, { stream: true }));
          return ler();
        });
      }
      return ler();
    });
  }

  function viaXHRMapa(parser) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url("/server/Ref/Consultar"), true);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", authHeader());
      var pos = 0;
      xhr.onprogress = function () {
        var t = xhr.responseText || "";
        if (t.length > pos) { parser.push(t.slice(pos)); pos = t.length; }
      };
      xhr.onload = function () {
        var t = xhr.responseText || "";
        if (t.length > pos) parser.push(t.slice(pos));
        resolve();
      };
      xhr.onerror = function () { reject(new Error("falha de rede")); };
      xhr.ontimeout = function () { reject(new Error("timeout")); };
      xhr.timeout = 120000;
      try { xhr.send("{}"); } catch (e) { reject(e); }
    });
  }

  function baixarMapaClientes() {
    var mapa = {};
    var parser = criarParser(mapa);
    return viaFetchMapa(parser).then(function () {
      parser.fim();
      return mapa;
    }).catch(function () {
      mapa = {};
      parser = criarParser(mapa);
      return viaXHRMapa(parser).then(function () {
        parser.fim();
        return mapa;
      });
    });
  }

  function carregarMapaClientes(forcar) {
    if (mapaClientes && !forcar) return Promise.resolve(mapaClientes);
    return baixarMapaClientes().then(function (mapa) {
      mapaClientes = mapa;
      return mapa;
    }).catch(function () {
      return {};
    });
  }

  function clienteNome(clienteCodigo) {
    if (!clienteCodigo) return Promise.resolve("");
    return carregarMapaClientes().then(function (mapa) {
      return mapa[String(clienteCodigo)] || "";
    });
  }

  function atualizarBaseClientes() {
    mapaClientes = null;
    return carregarMapaClientes(true).then(function (mapa) {
      return Object.keys(mapa).length;
    });
  }

  function getCacheFT(ft, cb) {
    evalHost("getCacheFT(" + JSON.stringify(String(ft)) + ")", cb);
  }

  function salvarCacheFT(ft, obj) {
    try {
      evalHost("salvarCacheFT(" + JSON.stringify(String(ft)) + "," +
        JSON.stringify(JSON.stringify(obj)) + ")");
    } catch (e) {}
  }

  function limparCacheFT(ft) {
    evalHost("limparCacheFT(" + JSON.stringify(String(ft)) + ")");
  }

  function limparTodoCacheFT() {
    evalHost("limparTodoCacheFT()");
  }

  window.MazurkyFT = FT;
  window.MazurkyFTAPI = {
    getRef: getRef,
    consultarItens: consultarItens,
    impOF: impOF,
    historicoOF: historicoOF,
    consultarPedidos: consultarPedidos,
    consultarNFPeriodo: consultarNFPeriodo,
    formatarOF: formatarOF,
    clienteNome: clienteNome,
    atualizarBaseClientes: atualizarBaseClientes,
    getCacheFT: getCacheFT,
    salvarCacheFT: salvarCacheFT,
    limparCacheFT: limparCacheFT,
    limparTodoCacheFT: limparTodoCacheFT
  };
})();
