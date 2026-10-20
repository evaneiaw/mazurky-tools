// extrator.js — Parte 1 do Gerar Layout: extrai campos de texto do PDF via pdf.js
// Estratégia (camada 1 — mesma linha):
//   getTextContent() -> agrupa itens em linhas (tolerância Y) -> ordena
//   linhas de cima p/ baixo, itens da esquerda p/ direita -> localiza os
//   rótulos conhecidos em cada linha -> valor = texto após o rótulo até o
//   próximo rótulo (ou fim da linha).
// Corte: inclui a linha de ROTULO_CORTE e ignora tudo abaixo dela (Y menor).
// Expõe: window.MazurkyExtrator = { CAMPOS, ROTULO_CORTE, extrairDoArrayBuffer }
(function () {
  "use strict";

  // Tolerância para agrupar itens na mesma linha (pontos do PDF).
  var TOL_Y = 2.0;
  // Folga em X acima da qual insere espaço entre fragmentos (pontos do PDF).
  var GAP_ESPACO = 1.5;

  // Ordem de exibição = ordem visual do PDF (cima->baixo, esquerda->direita).
  var CAMPOS = [
    { id: "cliente",     nome: "Cliente",           rotulo: "Cliente:" },
    { id: "referencia",  nome: "Referência",        rotulo: "Referência:" },
    { id: "codref",      nome: "Cód.Ref",           rotulo: "Cód.Ref:" },
    { id: "modelo",      nome: "Modelo",            rotulo: "Modelo:" },
    { id: "papelao",     nome: "Papelão",           rotulo: "Papelão:" },
    { id: "resina",      nome: "Resina",            rotulo: "Resina:" },
    { id: "area",        nome: "Área",              rotulo: "Área:" },
    { id: "medidas",     nome: "Medidas internas",  rotulo: "Medidas internas:" },
    { id: "orelha",      nome: "Orelha",            rotulo: "Orelha:" },
    { id: "medcv",       nome: "Med. intern. CV",   rotulo: "Med. intern. CV:" },
    { id: "dimensoes",   nome: "Dimensões cx (LxC)", rotulo: "Dimensões cx (LxC):" },
    { id: "chapa",       nome: "Chapa (LxC)",       rotulo: "Chapa (LxC):" },
    { id: "onda",        nome: "Onda virada",       rotulo: "Onda virada:" },
    { id: "fi",          nome: "FI",                rotulo: "FI:" },
    { id: "cliche",      nome: "Cliche",            rotulo: "Cliche:" },
    { id: "localcliche", nome: "Local cliche",      rotulo: "Local cliche:" },
    { id: "qt",          nome: "Qt pç chp/forma",   rotulo: "Qt pç chp/forma:" },
    { id: "forma",       nome: "Forma",             rotulo: "Forma:" },
    { id: "localforma",  nome: "Local forma",       rotulo: "Local forma:" },
    { id: "cores",       nome: "Cores",             rotulo: "Cores:" },
    { id: "fluxo",       nome: "Fluxo padrão máq",  rotulo: "Fluxo padrão máq:" }
  ];

  var ROTULO_CORTE = "Fluxo padrão máq:";

  function mapaRotulos() {
    var m = {};
    for (var i = 0; i < CAMPOS.length; i++) m[CAMPOS[i].rotulo] = CAMPOS[i];
    return m;
  }

  // Agrupa os itens de uma página em linhas de texto.
  // Retorna [{ y, texto }] ordenado de cima (Y maior) para baixo.
  function montarLinhas(items) {
    var validos = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.str) continue; // ignora fragmentos vazios
      var tr = it.transform;
      if (!tr) continue;
      validos.push({ x: tr[4], y: tr[5], w: it.width || 0, str: String(it.str) });
    }
    validos.sort(function (a, b) { return b.y - a.y || a.x - b.x; });

    var linhas = [];
    var atual = null;
    for (var k = 0; k < validos.length; k++) {
      var v = validos[k];
      if (!atual || Math.abs(v.y - atual.y) > TOL_Y) {
        atual = { y: v.y, partes: [] };
        linhas.push(atual);
      }
      atual.partes.push(v);
    }
    return linhas.map(function (ln) {
      ln.partes.sort(function (a, b) { return a.x - b.x; });
      var texto = "";
      var fimAnt = null;
      for (var j = 0; j < ln.partes.length; j++) {
        var p = ln.partes[j];
        if (texto !== "" && fimAnt !== null && (p.x - fimAnt) > GAP_ESPACO) texto += " ";
        texto += p.str;
        fimAnt = p.x + p.w;
      }
      return { y: ln.y, texto: texto.replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "") };
    });
  }

  // Extrai valores das linhas (já limitadas ao trecho útil).
  // Retorna { idCampo: valor }.
  function extrairValores(linhas, porRotulo) {
    var valores = {};
    for (var i = 0; i < linhas.length; i++) {
      var texto = linhas[i].texto;
      var ocorr = [];
      for (var rot in porRotulo) {
        if (!Object.prototype.hasOwnProperty.call(porRotulo, rot)) continue;
        var pos = texto.indexOf(rot);
        if (pos >= 0) ocorr.push({ pos: pos, campo: porRotulo[rot] });
      }
      if (!ocorr.length) continue;
      // Mesma posição: prefere o rótulo mais longo.
      ocorr.sort(function (a, b) {
        return a.pos - b.pos || b.campo.rotulo.length - a.campo.rotulo.length;
      });
      for (var o = 0; o < ocorr.length; o++) {
        var fimRot = ocorr[o].pos + ocorr[o].campo.rotulo.length;
        var fimVal = o + 1 < ocorr.length ? ocorr[o + 1].pos : texto.length;
        var valor = texto.substring(fimRot, fimVal).replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
        // Primeira ocorrência vence (caso o rótulo se repita em outra página).
        if (!(ocorr[o].campo.id in valores)) valores[ocorr[o].campo.id] = valor;
      }
    }
    return valores;
  }

  function extrairDoArrayBuffer(buffer) {
    if (typeof pdfjsLib === "undefined") {
      return Promise.reject(new Error("pdf.js não carregado (pdfjsLib ausente)."));
    }
    var porRotulo = mapaRotulos();
    return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise.then(function (doc) {
      var linhasTodas = [];
      var totalItens = 0;
      var seq = Promise.resolve();
      for (var p = 1; p <= doc.numPages; p++) {
        (function (numPag) {
          seq = seq.then(function () {
            return doc.getPage(numPag).then(function (page) {
              return page.getTextContent().then(function (tc) {
                totalItens += (tc.items || []).length;
                var linhas = montarLinhas(tc.items || []);
                for (var i = 0; i < linhas.length; i++) {
                  linhasTodas.push({ pagina: numPag, y: linhas[i].y, texto: linhas[i].texto });
                }
              });
            });
          });
        })(p);
      }
      return seq.then(function () {
        // Corte: mantém até a linha do ROTULO_CORTE (inclusive), na primeira
        // página onde ele aparece; ignora o restante (diagrama, rodapé etc.).
        var uteis = [];
        for (var i = 0; i < linhasTodas.length; i++) {
          uteis.push(linhasTodas[i]);
          if (linhasTodas[i].texto.indexOf(ROTULO_CORTE) >= 0) break;
        }
        var valores = extrairValores(uteis, porRotulo);
        var campos = CAMPOS.map(function (c) {
          return { id: c.id, nome: c.nome, rotulo: c.rotulo, valor: valores[c.id] || "" };
        });
        return { campos: campos, numPaginas: doc.numPages, totalItens: totalItens, totalLinhas: linhasTodas.length, linhasDebug: linhasTodas };
      });
    });
  }

  window.MazurkyExtrator = {
    CAMPOS: CAMPOS,
    ROTULO_CORTE: ROTULO_CORTE,
    extrairDoArrayBuffer: extrairDoArrayBuffer
  };
})();
