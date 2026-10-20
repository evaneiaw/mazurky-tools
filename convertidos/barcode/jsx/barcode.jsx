// barcode.jsx - gera codigo de barras vetorial no documento ativo.
// O painel calcula a geometria com bwip-js e envia tudo em pontos:
//   { simbolo, barras: [[x, larg, y, alt], ...],
//     moldura: { x, y, w, h, espX, espY } | null,
//     larguraTotal, centroBarras, fundoBarras,
//     texto, mostrarTexto, tamTexto, cor, limpar }
// Coordenadas locais: topo do conteudo em y = 0, crescendo para BAIXO.
// O grupo final e deslocado para o centro da prancheta ativa.

function bcHexParaRGB(hex) {
    var h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    if (isNaN(r)) r = 0;
    if (isNaN(g)) g = 0;
    if (isNaN(b)) b = 0;
    return { r: r, g: g, b: b };
}

function bcFmt1(v) {
    return String(Math.round(v * 10) / 10).replace(".", ",");
}

function bcNum(v, padrao) {
    var n = Number(v);
    if (isNaN(n) || n === undefined || n === null) return padrao;
    return n;
}

function bcObterFonteArial() {
    var nomes = ["ArialMT", "Arial", "ArialMT-Bold"];
    var i;
    for (i = 0; i < nomes.length; i++) {
        try { return app.textFonts.getByName(nomes[i]); } catch (e) {}
    }
    try {
        for (i = 0; i < app.textFonts.length; i++) {
            if (app.textFonts[i].familyName === "Arial") return app.textFonts[i];
        }
    } catch (e2) {}
    return null;
}

function bcAcharCamada(doc, nome) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === nome) return doc.layers[i];
    }
    return null;
}

function gerarCodigoBarras(d) {
    try {
        if (!d) return "Erro: dados do codigo ausentes.";
        var barras = d.barras;
        if (!barras || barras.length === 0) return "Erro: lista de barras vazia.";
        if (app.documents.length === 0) return "Erro: nenhum documento aberto.";

        var doc = app.activeDocument;
        var cor = bcHexParaRGB(d.cor);
        var corFill = new RGBColor();
        corFill.red = cor.r;
        corFill.green = cor.g;
        corFill.blue = cor.b;

        var camada = bcAcharCamada(doc, "BARRAS");
        if (!camada) camada = doc.layers.add();
        camada.name = "BARRAS";
        camada.locked = false;
        camada.visible = true;
        try {
            if (doc.layers.length >= 1 && doc.layers[0] !== camada) {
                camada.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
            }
        } catch (eMove) {}

        if (d.limpar) {
            for (var k = camada.pageItems.length - 1; k >= 0; k--) {
                try {
                    if (camada.pageItems[k].parent === camada) camada.pageItems[k].remove();
                } catch (eDel) {}
            }
        }

        var itens = [];
        var nBarras = 0;

        for (var b = 0; b < barras.length; b++) {
            var bar = barras[b];
            var x = bcNum(bar[0], -1);
            var larg = bcNum(bar[1], 0);
            var y = bcNum(bar[2], 0);
            var alt = bcNum(bar[3], 0);
            if (x < 0 || !(larg > 0) || !(alt > 0)) continue;
            var r = camada.pathItems.rectangle(-y, x, larg, alt);
            r.filled = true;
            r.stroked = false;
            r.fillColor = corFill;
            itens.push(r);
            nBarras++;
        }
        if (nBarras === 0) return "Erro: nenhuma barra valida para desenhar.";

        if (d.moldura) {
            var m = d.moldura;
            var mX = bcNum(m.x, 0);
            var mY = bcNum(m.y, 0);
            var mW = bcNum(m.w, 0);
            var mH = bcNum(m.h, 0);
            var espX = bcNum(m.espX, 0);
            var espY = bcNum(m.espY, 0);
            if (mW > 0 && mH > 0 && espX > 0 && espY > 0 && mH > 2 * espY) {
                var meio = mH - 2 * espY;
                var pecas = [
                    [mX, mY, mW, espY],
                    [mX, mY + mH - espY, mW, espY],
                    [mX, mY + espY, espX, meio],
                    [mX + mW - espX, mY + espY, espX, meio]
                ];
                for (var p = 0; p < 4; p++) {
                    var pc = pecas[p];
                    if (!(pc[2] > 0) || !(pc[3] > 0)) continue;
                    var mold = camada.pathItems.rectangle(-pc[1], pc[0], pc[2], pc[3]);
                    mold.filled = true;
                    mold.stroked = false;
                    mold.fillColor = corFill;
                    itens.push(mold);
                }
            }
        }

        var mostrarTexto = d.mostrarTexto && (d.texto || (d.textos && d.textos.length));
        if (mostrarTexto) {
            var tam = bcNum(d.tamTexto, 8);
            if (!(tam > 0)) tam = 8;
            var fonte = bcObterFonteArial();
            var BASELINE = 0.87;
            var itensTexto = d.textos;
            if (!itensTexto || !itensTexto.length) {
                var antigo = camada.textFrames.add();
                antigo.contents = String(d.texto);
                var at = antigo.textRange.characterAttributes;
                if (fonte) {
                    try { at.textFont = fonte; } catch (eFont0) {}
                }
                at.size = tam;
                at.fillColor = corFill;
                var gap0 = Math.max(2, tam * 0.4);
                antigo.position = [bcNum(d.centroBarras, 0) - antigo.width / 2, -(bcNum(d.fundoBarras, 0) + gap0)];
                itens.push(antigo);
            } else {
                for (var t = 0; t < itensTexto.length; t++) {
                    var gt = itensTexto[t];
                    if (!gt || gt.t === undefined || gt.t === null || !String(gt.t).length) continue;
                    var tf = camada.textFrames.add();
                    tf.contents = String(gt.t);
                    var attrs = tf.textRange.characterAttributes;
                    if (fonte) {
                        try { attrs.textFont = fonte; } catch (eFont) {}
                    }
                    attrs.size = tam;
                    attrs.fillColor = corFill;
                    var cx = bcNum(gt.x, 0);
                    var base = bcNum(gt.base, 0);
                    tf.position = [cx - tf.width / 2, -base + BASELINE * tam];
                    itens.push(tf);
                }
            }
        }

        var grupo = camada.groupItems.add();
        for (var g = 0; g < itens.length; g++) {
            itens[g].move(grupo, ElementPlacement.PLACEATEND);
        }
        grupo.name = "Codigo de Barras - " + (d.simbolo || "");

        var gb = grupo.geometricBounds; // [esq, baixo, dir, topo]
        var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
        var acx = (ab[0] + ab[2]) / 2;
        var acy = (ab[1] + ab[3]) / 2;
        var dx = acx - (gb[0] + gb[2]) / 2;
        var dy = acy - (gb[1] + gb[3]) / 2;
        if (dx !== 0 || dy !== 0) grupo.translate(dx, dy);

        gb = grupo.geometricBounds;
        doc.selection = null;
        try { grupo.selected = true; } catch (eSel) {}

        var mmL = (gb[2] - gb[0]) * 25.4 / 72;
        var mmA = (gb[1] - gb[3]) * 25.4 / 72;
        return "OK: " + (d.simbolo || "Codigo de barras") + " - " + nBarras +
            " barras - " + bcFmt1(mmL) + " x " + bcFmt1(mmA) + " mm";
    } catch (e) {
        return "Erro: " + (e.message || String(e));
    }
}
