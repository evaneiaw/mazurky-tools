// qrcode.jsx — lógica ExtendScript da ferramenta QR Code Vetor
// Recebe a matriz de módulos detectada pelo painel e desenha os retângulos
// ao lado da imagem selecionada no documento ativo, mantendo a imagem.

function hexParaRGB(hex) {
    var h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) {
        h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var r = parseInt(h.substring(0, 2), 16);
    var g = parseInt(h.substring(2, 4), 16);
    var b = parseInt(h.substring(4, 6), 16);
    return { r: r, g: g, b: b };
}

function getRaizExtensao() {
    try {
        if (__mazurkyRaiz) return normalizarRaiz(__mazurkyRaiz);
    } catch (e) {}
    try {
        return new File($.fileName).parent.parent.fsName;
    } catch (e) {}
    return "";
}

function getImagemSelecionada(doc) {
    if (!doc.selection || doc.selection.length === 0) return null;
    var item = doc.selection[0];
    if (item.typename !== "RasterItem" && item.typename !== "PlacedItem") return null;
    return item;
}

// Exporta a imagem selecionada (placa/raster) do documento ativo como PNG
// dentro da pasta da ferramenta, para o painel detectar o QR.
// Retorna: "ok:<relPath>" ou "Erro: ..."
function exportarImagemParaDetectar() {
    var tmpDoc = null;
    var uiAnt = UserInteractionLevel.DISPLAYALERTS;
    try {
        uiAnt = app.userInteractionLevel;
    } catch (e) {}
    try {
        if (app.documents.length === 0) {
            return "Erro: nenhum documento aberto. Abra um documento com a imagem selecionada.";
        }
        var doc = app.activeDocument;
        var imagem = getImagemSelecionada(doc);
        if (!imagem) {
            return "Erro: selecione uma imagem (placa/raster) dentro do documento antes de detectar.";
        }

        var bounds = imagem.geometricBounds; // [left, top, right, bottom]

        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        var dir = new Folder(getRaizExtensao() + "/convertidos/qrcode");
        if (!dir.exists) dir.create();

        tmpDoc = app.documents.add(DocumentColorSpace.RGB);
        var copia = imagem.duplicate(tmpDoc.activeLayer, ElementPlacement.PLACEATEND);
        var b = copia.geometricBounds;
        tmpDoc.artboards[0].artboardRect = b;

        var wP = Math.max(1, b[2] - b[0]);
        var hP = Math.max(1, b[3] - b[1]);
        var maxDim = Math.max(wP, hP);
        // Escala para ~2000px no maior lado, limitada entre 100% e 400%.
        var escala = Math.min(400, Math.max(100, 2000 / maxDim * 100));

        var opt = new ExportOptionsPNG24();
        opt.antiAliasing = false;
        opt.transparency = false;
        opt.artBoardClipping = true;
        opt.saveAsHTML = false;
        opt.horizontalScale = escala;
        opt.verticalScale = escala;

        var png = new File(dir.fsName + "/_qr_tmp");
        tmpDoc.exportFile(png, ExportType.PNG24, opt);
        tmpDoc.close(SaveOptions.DONOTSAVECHANGES);
        tmpDoc = null;

        var nomeFinal = "";
        if (new File(dir.fsName + "/_qr_tmp.png").exists) {
            nomeFinal = "_qr_tmp.png";
        } else if (new File(dir.fsName + "/_qr_tmp").exists) {
            nomeFinal = "_qr_tmp";
        }
        if (nomeFinal === "") {
            return "Erro: não foi possível exportar a imagem selecionada para PNG.";
        }

        return "ok:convertidos/qrcode/" + nomeFinal;
    } catch (e) {
        try {
            if (tmpDoc) tmpDoc.close(SaveOptions.DONOTSAVECHANGES);
        } catch (e2) {}
        return "Erro: " + (e.message || String(e));
    } finally {
        try {
            app.userInteractionLevel = uiAnt;
        } catch (e) {}
    }
}

// Desenha o vetor do QR por cima da imagem selecionada no documento ativo,
// usando exatamente a posição e o tamanho de módulo detectados no painel,
// para que o vetor fique idêntico ao QR da imagem. A imagem não é removida.
function gerarQr(matriz, oxPx, oyPx, modPx, natW, natH, corHex) {
    try {
        if (!matriz || matriz.length === 0) {
            return "Erro: matriz do QR vazia.";
        }

        var linhas = matriz.length;
        var colunas = String(matriz[0]).length;
        if (colunas === 0) return "Erro: matriz inválida.";

        if (app.documents.length === 0) {
            return "Erro: nenhum documento aberto.";
        }
        var doc = app.activeDocument;
        var imagem = getImagemSelecionada(doc);
        if (!imagem) {
            return "Erro: a imagem selecionada não foi encontrada. Selecione-a novamente.";
        }

        var bounds = imagem.geometricBounds; // [left, top, right, bottom] em pontos
        var natWid = Number(natW) > 0 ? Number(natW) : (bounds[2] - bounds[0]);
        var natHei = Number(natH) > 0 ? Number(natH) : (bounds[1] - bounds[3]);

        // Fator de conversão pixel -> pontos. No Illustrator o Y cresce para
        // cima (top > bottom), então use alturas positivas:
        // fatorX > 0 (colunas vão para a direita), fatorY > 0 (linhas descem).
        var fatorX = (bounds[2] - bounds[0]) / natWid;
        var fatorY = (bounds[1] - bounds[3]) / natHei;
        if (!(fatorX > 0)) fatorX = 1;
        if (!(fatorY > 0)) fatorY = 1;

        var ox = Number(oxPx) || 0;
        var oy = Number(oyPx) || 0;
        var mod = Number(modPx);
        if (!(mod > 0)) mod = 1;

        var moduloX = mod * fatorX;
        var moduloY = mod * fatorY;
        var baseLeft = bounds[0] + ox * fatorX;
        var baseTop = bounds[1] - oy * fatorY;

        var cor = hexParaRGB(corHex);

        // Camada QRCODE
        var camada = null;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === "QRCODE") {
                camada = doc.layers[i];
            }
        }
        if (!camada) camada = doc.layers.add();
        camada.name = "QRCODE";
        camada.locked = false;
        camada.visible = true;
        // Garante que o vetor fique POR CIMA da imagem (camada no topo).
        try {
            if (doc.layers.length >= 1 && doc.layers[0] !== camada) {
                camada.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
            }
        } catch (e) {}

        // Limpa módulos antigos na camada (sem tocar na imagem)
        for (var k = camada.pathItems.length - 1; k >= 0; k--) {
            try { camada.pathItems[k].remove(); } catch (e) {}
        }

        var corFill = new RGBColor();
        corFill.red = cor.r;
        corFill.green = cor.g;
        corFill.blue = cor.b;

        var totalEscuros = 0;
        for (var l = 0; l < linhas; l++) {
            var linha = String(matriz[l]);
            for (var c = 0; c < colunas; c++) {
                if (linha.charAt(c) !== "1") continue;
                var left = baseLeft + c * moduloX;
                var top = baseTop - l * moduloY;
                var r = camada.pathItems.rectangle(top, left, moduloX, moduloY);
                r.filled = true;
                r.stroked = false;
                r.fillColor = corFill;
                totalEscuros++;
            }
        }

        return "OK: QR " + colunas + "x" + linhas + " gerado por cima da imagem (" + totalEscuros + " módulos). A imagem foi mantida.";
    } catch (e) {
        return "Erro: " + (e.message || String(e));
    }
}