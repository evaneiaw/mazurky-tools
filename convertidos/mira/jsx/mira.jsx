// mira.jsx — lógica ExtendScript da ferramenta Mira

if (!$.mazurkyMira) $.mazurkyMira = {};

function salvarEstadoArtboards(doc) {
    $.mazurkyMira.originalRects = [];
    for (var i = 0; i < doc.artboards.length; i++) {
        $.mazurkyMira.originalRects.push(doc.artboards[i].artboardRect.slice());
    }
}

function restaurarEstadoArtboards(doc) {
    if ($.mazurkyMira.originalRects) {
        for (var i = 0; i < doc.artboards.length && i < $.mazurkyMira.originalRects.length; i++) {
            doc.artboards[i].artboardRect = $.mazurkyMira.originalRects[i];
        }
    }
}

function restaurarEstadoArtboard(doc, artboardIdx) {
    if ($.mazurkyMira.originalRects && $.mazurkyMira.originalRects[artboardIdx]) {
        doc.artboards[artboardIdx].artboardRect = $.mazurkyMira.originalRects[artboardIdx];
    }
}

function criarMiraEmArtboard(artboard, margem, espelharVertical, espelharHorizontal, layer, diametro, losangoLado, espessuraTraco, deslocamentoLosango) {
    var rect = artboard.artboardRect;
    var left = Number(rect[0]);
    var top = Number(rect[1]);
    var right = Number(rect[2]);
    var bottom = Number(rect[3]);

    if (margem < 0) {
        var extensao = Math.abs(margem);
        left -= extensao;
        top += extensao;
        right += extensao;
        bottom -= extensao;
        artboard.artboardRect = [left, top, right, bottom];
        margem = 0;
    }

    var regColor = new CMYKColor();
    regColor.cyan = 100;
    regColor.magenta = 100;
    regColor.yellow = 100;
    regColor.black = 100;

    var grupo = layer.groupItems.add();

    var cSupEsq = grupo.pathItems.ellipse(top - margem, left + margem, diametro, diametro);
    cSupEsq.filled = true;
    cSupEsq.fillColor = regColor;
    cSupEsq.stroked = false;

    var cSupDir = grupo.pathItems.ellipse(top - margem, right - diametro - margem, diametro, diametro);
    cSupDir.filled = true;
    cSupDir.fillColor = regColor;
    cSupDir.stroked = false;

    var cInfDir = grupo.pathItems.ellipse(bottom + diametro + margem, right - diametro - margem, diametro, diametro);
    cInfDir.filled = true;
    cInfDir.fillColor = regColor;
    cInfDir.stroked = false;

    var cInfEsq = grupo.pathItems.ellipse(bottom + diametro + margem, left + margem, diametro, diametro);
    cInfEsq.filled = true;
    cInfEsq.fillColor = regColor;
    cInfEsq.stroked = false;

    var circuloBase;
    var moverParaDireita;
    if (espelharHorizontal) {
        circuloBase = cSupEsq;
        moverParaDireita = true;
    } else if (espelharVertical) {
        circuloBase = cInfDir;
        moverParaDireita = false;
    } else {
        circuloBase = cInfEsq;
        moverParaDireita = true;
    }

    var centroX = circuloBase.left + (diametro / 2);
    var centroY = circuloBase.top - (diametro / 2);
    var lx = centroX + (moverParaDireita ? deslocamentoLosango : -deslocamentoLosango);
    var ly = centroY;

    var losango = grupo.pathItems.add();
    losango.setEntirePath([
        [lx, ly + (losangoLado / 2)],
        [lx + (losangoLado / 2), ly],
        [lx, ly - (losangoLado / 2)],
        [lx - (losangoLado / 2), ly],
        [lx, ly + (losangoLado / 2)]
    ]);
    losango.closed = true;
    losango.filled = false;
    losango.stroked = true;
    losango.strokeWidth = espessuraTraco;
    losango.strokeColor = regColor;
}

// 1 mm = 2,8346 unidades do documento (72/25.4) num documento normal. O
// Illustrator (Large Canvas) reduz 10x os documentos acima de ~5779,5 mm e
// expoe isso em doc.scaleFactor (=10 nesses casos, 1 nos normais). Dividir por
// esse fator devolve a medida real, igual em qualquer documento.
var MM_TO_PTS = 72 / 25.4;

function escalaDoc() {
    try {
        var sf = parseFloat(app.activeDocument.scaleFactor);
        if (isNaN(sf) || sf < 1) sf = 1;
        return sf;
    } catch (e) {
        return 1;
    }
}

function mmFactorDoc() {
    return MM_TO_PTS / escalaDoc();
}

// Rasterizador do documento — apenas informativo para o painel. O valor fica
// guardado x scaleFactor (ex.: 360 num doc 1:10 = 36 ppi efetivo). Em alguns
// estados a leitura lanca ("value less/greater than allowed").
function lerRaster() {
    try {
        if (app.documents.length == 0) return "sem documento";
        var d = app.activeDocument;
        var sf = parseFloat(d.scaleFactor);
        if (isNaN(sf) || sf < 1) sf = 1;
        try {
            var res = Math.round(d.rasterEffectSettings.resolution / sf);
            return res + " ppi" + (sf !== 1 ? " (doc 1:" + sf + ")" : "");
        } catch (eRes) {
            return (sf !== 1) ? "36 ppi (doc 1:" + sf + ")" : "indisponível";
        }
    } catch (e) {
        return "indisponível";
    }
}

// Tamanhos das marcas: 5 mm circulo, 4 mm losango, 0,35 mm traco, 10 mm desloc.
function desenharMiras(doc, margemPt, espelharVertical, espelharHorizontal, todosArtboards, mmFactor) {
    var diametro = 5 * mmFactor;
    var losangoLado = 4 * mmFactor;
    var espessuraTraco = 0.35 * mmFactor;
    var deslocamentoLosango = 10 * mmFactor;

    var layerMira;
    try {
        layerMira = doc.layers.getByName("MIRA");
    } catch (e) {
        layerMira = doc.layers.add();
        layerMira.name = "MIRA";
    }
    layerMira.visible = true;
    layerMira.locked = false;

    try {
        var facaLayer = doc.layers.getByName("FACA");
        var facaLocked = facaLayer.locked;
        facaLayer.locked = false;
        try {
            layerMira.move(facaLayer, ElementPlacement.PLACEAFTER);
        } catch (e) {}
        facaLayer.locked = facaLocked;
    } catch (e) {
        layerMira.move(doc, ElementPlacement.PLACEATBEGINNING);
    }

    var artboardsToProcess = [];
    if (todosArtboards) {
        for (var i = 0; i < doc.artboards.length; i++) {
            artboardsToProcess.push(i);
        }
    } else {
        artboardsToProcess.push(doc.artboards.getActiveArtboardIndex());
    }

    for (var ab = 0; ab < artboardsToProcess.length; ab++) {
        var artboardIdx = artboardsToProcess[ab];
        var artboardName = doc.artboards[artboardIdx].name;
        var subLayerName = (artboardIdx + 1) + " - " + artboardName;

        try {
            var oldSub = layerMira.layers.getByName(subLayerName);
            oldSub.remove();
        } catch (e) {}

        var subLayer = layerMira.layers.add();
        subLayer.name = subLayerName;

        criarMiraEmArtboard(doc.artboards[artboardIdx], margemPt, espelharVertical, espelharHorizontal, subLayer, diametro, losangoLado, espessuraTraco, deslocamentoLosango);
    }
}

function preview(margemMM, espelharVertical, espelharHorizontal, todosArtboards) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;
        var mmFactor = mmFactorDoc();
        var margemPt = margemMM * mmFactor;

        if (!$.mazurkyMira.originalRects) {
            salvarEstadoArtboards(doc);
        } else {
            restaurarEstadoArtboards(doc);
        }

        desenharMiras(doc, margemPt, espelharVertical, espelharHorizontal, todosArtboards, mmFactor);

        app.redraw();
        return "Prévia criada com sucesso! (margem " + margemMM + " mm = " +
            margemPt.toFixed(3) + " un)";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function executar(margemMM, espelharVertical, espelharHorizontal, todosArtboards) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;
        var mmFactor = mmFactorDoc();
        var margemPt = margemMM * mmFactor;

        if ($.mazurkyMira.originalRects) {
            restaurarEstadoArtboards(doc);
            $.mazurkyMira.originalRects = null;
        }

        desenharMiras(doc, margemPt, espelharVertical, espelharHorizontal, todosArtboards, mmFactor);

        app.redraw();
        return "Mira criada com sucesso! (margem " + margemMM + " mm = " +
            margemPt.toFixed(3) + " un)";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function cancelar() {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;
        var artboardIdx = doc.artboards.getActiveArtboardIndex();
        var artboardName = doc.artboards[artboardIdx].name;
        var subLayerName = (artboardIdx + 1) + " - " + artboardName;

        try {
            var layerMira = doc.layers.getByName("MIRA");
            var subLayer = layerMira.layers.getByName(subLayerName);
            subLayer.remove();
        } catch (e) {}

        if ($.mazurkyMira.originalRects) {
            restaurarEstadoArtboard(doc, artboardIdx);
        }

        app.redraw();
        return "Cancelado com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao cancelar: " + (e.message || String(e)) + linhaErro;
    }
}
