// lote.jsx — lógica ExtendScript da ferramenta Lote Mazurky

function formatLote(input) {
    var s = String(input == null ? "" : input).replace(/\D/g, "");
    if (!s) return "";
    while (s.length < 6) s = "0" + s;
    s = s.substring(s.length - 6);
    return s.substring(0, 3) + "." + s.substring(3);
}

function substituirTexto(doc, placeholder, novoTexto) {
    for (var i = 0; i < doc.textFrames.length; i++) {
        var tf = doc.textFrames[i];
        try {
            var lower = tf.contents.toLowerCase();
            if (lower.indexOf(placeholder.toLowerCase()) !== -1) {
                tf.contents = tf.contents.split(placeholder).join(novoTexto);
                tf.contents = tf.contents.split(placeholder.toLowerCase()).join(novoTexto);
                tf.contents = tf.contents.split(placeholder.toUpperCase()).join(novoTexto);
            }
        } catch (e) {}
    }
}

function obterOuCriarCamadaLote(doc) {
    var layerLote = null;
    var layerMira = null;
    var layerArte = null;
    for (var i = 0; i < doc.layers.length; i++) {
        var L = doc.layers[i];
        var nome = String(L.name).toUpperCase();
        if (nome === "LOTE") layerLote = L;
        else if (nome === "MIRA") layerMira = L;
        else if (nome === "ARTE" || nome === "ARTES") layerArte = L;
    }
    if (layerLote === null) {
        layerLote = doc.layers.add();
        layerLote.name = "LOTE";
    }
    layerLote.visible = true;
    layerLote.locked = false;

    // LOTE fica logo abaixo da MIRA; se não houver MIRA, logo acima da ARTE.
    if (layerMira !== null) {
        var miraLocked = layerMira.locked;
        layerMira.locked = false;
        try { layerLote.move(layerMira, ElementPlacement.PLACEAFTER); } catch (eMira) {}
        layerMira.locked = miraLocked;
    } else if (layerArte !== null) {
        var arteLocked = layerArte.locked;
        layerArte.locked = false;
        try { layerLote.move(layerArte, ElementPlacement.PLACEBEFORE); } catch (eArte) {}
        layerArte.locked = arteLocked;
    }
    return layerLote;
}

function localizarSelo() {
    var candidatos = [];
    try {
        var scriptFile = new File($.fileName);
        var jsxPasta = scriptFile.parent;
        var raiz = jsxPasta.parent;
        candidatos.push(raiz.fsName + "/selo.ai");
        candidatos.push(jsxPasta.fsName + "/selo.ai");
    } catch (e) {}
    try {
        var jsxFolder = Folder($.fileName).parent;
        candidatos.push(jsxFolder.fsName + "/../selo.ai");
        candidatos.push(jsxFolder.fsName + "/selo.ai");
    } catch (e2) {}
    for (var i = 0; i < candidatos.length; i++) {
        var arq = new File(candidatos[i]);
        if (arq.exists) return arq;
    }
    return null;
}

function executar(lote, caminhoSelo) {
    // Desativa "Colar mantendo camadas": se ativa, o paste quebra as camadas.
    var prefCamadasAntes = null;
    try {
        prefCamadasAntes = app.preferences.getBooleanPreference("pasteRemembersLayers");
        app.preferences.setBooleanPreference("pasteRemembersLayers", false);
    } catch (ePref) {}

    try {
        if (app.documents.length === 0) {
            return "Abra um documento antes de executar.";
        }

        var loteFmt = formatLote(lote);
        if (!loteFmt) {
            return "Erro: informe o número do lote.";
        }

        app.preferences.setStringPreference("MazurkyLote/UltimoLote", loteFmt);

        var docPrincipal = app.activeDocument;

        var arquivoPath = null;
        if (caminhoSelo) {
            var cp = new File(caminhoSelo);
            if (cp.exists) arquivoPath = cp;
        }
        if (!arquivoPath) arquivoPath = localizarSelo();
        if (!arquivoPath) {
            return "Arquivo selo.ai não encontrado na pasta do script.";
        }

        var docTemp = app.open(arquivoPath);
        app.redraw();

        substituirTexto(docTemp, "lote_aqui", loteFmt);
        substituirTexto(docTemp, "data_aqui", "");
        app.redraw();

        // Seleciona somente os elementos totalmente dentro do artboard do selo
        try { docTemp.selection = null; } catch (eLimpar) {}
        var artboardSelo = docTemp.artboards[0];
        var ab = artboardSelo.artboardRect; // [left, top, right, bottom]
        var itensTemp = docTemp.pageItems;
        var TOL = 0.01;
        for (var i = 0; i < itensTemp.length; i++) {
            var itemAtual = itensTemp[i];
            try {
                var gb = itemAtual.geometricBounds;
                if (gb && gb.length === 4 &&
                    gb[0] >= ab[0] - TOL && gb[1] <= ab[1] + TOL &&
                    gb[2] <= ab[2] + TOL && gb[3] >= ab[3] - TOL) {
                    itemAtual.selected = true;
                }
            } catch (eSel) {}
        }
        if (!docTemp.selection || docTemp.selection.length === 0) {
            docTemp.close(SaveOptions.DONOTSAVECHANGES);
            return "Nenhum elemento dentro do artboard do selo.ai.";
        }
        app.copy();

        docTemp.close(SaveOptions.DONOTSAVECHANGES);

        app.activeDocument = docPrincipal;

        var layerLote = obterOuCriarCamadaLote(docPrincipal);
        docPrincipal.activeLayer = layerLote;

        app.paste();
        app.redraw();

        var sel = docPrincipal.selection;
        if (!sel || sel.length === 0) {
            return "Nada foi colado do arquivo selo.ai.";
        }

        // Garante que os itens colados estão na camada LOTE
        for (var k = 0; k < sel.length; k++) {
            sel[k].move(layerLote, ElementPlacement.PLACEATEND);
        }
        app.redraw();

        return "Lote " + loteFmt + " colado na camada LOTE.";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    } finally {
        try {
            if (prefCamadasAntes !== null) {
                app.preferences.setBooleanPreference("pasteRemembersLayers", prefCamadasAntes);
            }
        } catch (ePref2) {}
    }
}
