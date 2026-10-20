// simplefaca.jsx — lógica ExtendScript da ferramenta Simple Faca

var MM_PARA_PT = 2.83464567;
var STROKE_WIDTH = 0.75 * MM_PARA_PT;
var SPOT_NAMES = ["cut", "crease", "partial cut"];

function trim(s) {
    return s.replace(/^\s+|\s+$/g, "");
}

function encontrarCamadaARD(doc) {
    var len = doc.layers.length;
    for (var i = 0; i < len; i++) {
        var layer = doc.layers[i];
        var name = layer.name.toLowerCase();
        if (name.indexOf(".ard") === name.length - 4 || name.indexOf(".zae") === name.length - 4) {
            return layer;
        }
    }
    return null;
}

function desbloquearRecursivo(layer) {
    try { layer.locked = false; } catch (e) {}
    try { layer.visible = true; } catch (e) {}

    var subs = layer.layers;
    var len = subs.length;
    for (var i = 0; i < len; i++) {
        desbloquearRecursivo(subs[i]);
    }
}

function travarTodasMenos(doc, excecao) {
    var len = doc.layers.length;
    for (var i = 0; i < len; i++) {
        var layer = doc.layers[i];
        if (layer !== excecao) {
            layer.locked = true;
        }
    }
}

function destravarTodas(doc) {
    var len = doc.layers.length;
    for (var i = 0; i < len; i++) {
        doc.layers[i].locked = false;
    }
}

function hasSpecialColor(item) {
    function checkColor(cor) {
        if (cor && cor.typename === "SpotColor" && cor.spot) {
            var name = trim(cor.spot.name).toLowerCase();
            var slen = SPOT_NAMES.length;
            for (var i = 0; i < slen; i++) {
                if (name === SPOT_NAMES[i]) return true;
            }
        }
        return false;
    }
    return (item.filled && checkColor(item.fillColor)) ||
           (item.stroked && checkColor(item.strokeColor));
}

function getLayerBounds(layer) {
    var allItems = [];

    function collect(items) {
        var len = items.length;
        for (var i = 0; i < len; i++) {
            var item = items[i];
            if (item.hidden || item.locked) continue;
            if (item.typename === "GroupItem") {
                collect(item.pageItems);
            } else {
                allItems.push(item);
            }
        }
    }
    collect(layer.pageItems);

    var n = allItems.length;
    if (n === 0) return null;

    var b = allItems[0].geometricBounds;
    var minX = b[0], maxY = b[1], maxX = b[2], minY = b[3];

    for (var i = 1; i < n; i++) {
        var ib = allItems[i].geometricBounds;
        if (ib[0] < minX) minX = ib[0];
        if (ib[1] > maxY) maxY = ib[1];
        if (ib[2] > maxX) maxX = ib[2];
        if (ib[3] < minY) minY = ib[3];
    }

    return [minX, maxY, maxX, minY];
}

function extrairFaca(cotas, faca) {
    var items = cotas.pageItems;
    var i = items.length - 1;
    while (i >= 0) {
        var item = items[i];
        if (item.typename === "GroupItem") {
            extrairGrupo(item, faca);
        } else if (hasSpecialColor(item)) {
            item.locked = false;
            item.move(faca, ElementPlacement.PLACEATBEGINNING);
            item.strokeWidth = STROKE_WIDTH;
        }
        i--;
    }
}

function extrairGrupo(group, faca) {
    var items = group.pageItems;
    var i = items.length - 1;
    while (i >= 0) {
        var item = items[i];
        if (item.typename === "GroupItem") {
            extrairGrupo(item, faca);
        } else if (hasSpecialColor(item)) {
            item.locked = false;
            item.move(faca, ElementPlacement.PLACEATBEGINNING);
            item.strokeWidth = STROKE_WIDTH;
        }
        i--;
    }
    if (group.pageItems.length === 0) {
        try { group.remove(); } catch (e) {}
    }
}

function obterOuCriarCamada(doc, nome) {
    try {
        return doc.layers.getByName(nome);
    } catch (e) {
        var camada = doc.layers.add();
        camada.name = nome;
        return camada;
    }
}

function agruparLayer(layer) {
    var items = [];
    var len = layer.pageItems.length;
    for (var i = 0; i < len; i++) {
        items.push(layer.pageItems[i]);
    }
    if (items.length < 2) return;
    var group = layer.groupItems.add();
    for (var i = 0; i < items.length; i++) {
        items[i].moveToEnd(group);
    }
}

function executar(ajustarArtboard, agruparCotas, agruparFaca, copiarClipboard) {
    var originalInteraction = app.userInteractionLevel;
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

    // Desativa "Colar mantendo camadas" para o paste cair na camada Cotas.
    var prefCamadasAntes = null;
    try {
        prefCamadasAntes = app.preferences.getBooleanPreference("pasteRemembersLayers");
        app.preferences.setBooleanPreference("pasteRemembersLayers", false);
    } catch (ePP) {}

    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;

        var ardLayer = encontrarCamadaARD(doc);
        if (!ardLayer) {
            return "Nenhuma camada .ARD ou .ZAE encontrada. Renomeie a camada para remover .ard ou .zae.";
        }

        desbloquearRecursivo(ardLayer);

        travarTodasMenos(doc, ardLayer);

        app.executeMenuCommand("selectall");

        var selection = doc.selection;
        if (!selection || selection.length === 0) {
            destravarTodas(doc);
            return "Nada selecionado na camada " + ardLayer.name;
        }

        app.executeMenuCommand("copy");

        var cotas = doc.layers.add();
        cotas.name = "Cotas";
        doc.activeLayer = cotas;
        app.executeMenuCommand("paste");

        ardLayer.remove();
        destravarTodas(doc);

        var faca = doc.layers.add();
        faca.name = "Faca";

        var arte = obterOuCriarCamada(doc, "Arte");

        extrairFaca(cotas, faca);

        cotas.move(faca, ElementPlacement.PLACEBEFORE);
        if (arte !== faca) {
            arte.move(faca, ElementPlacement.PLACEAFTER);
        }

        if (ajustarArtboard) {
            var bounds = getLayerBounds(faca);
            if (bounds) {
                try {
                    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
                    ab.artboardRect = [bounds[0], bounds[1], bounds[2], bounds[3]];
                } catch (e) {}
            }
        }

        if (agruparCotas) agruparLayer(cotas);
        if (agruparFaca) agruparLayer(faca);

        if (copiarClipboard) {
            var len = doc.layers.length;
            for (var i = 0; i < len; i++) {
                var l = doc.layers[i];
                if (l !== cotas && l !== faca) l.locked = true;
            }
            app.executeMenuCommand("selectall");
            app.executeMenuCommand("copy");
            destravarTodas(doc);
        }

        doc.selection = null;
        app.redraw();

        return "Simple Faca concluída com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    } finally {
        try {
            if (prefCamadasAntes !== null) {
                app.preferences.setBooleanPreference("pasteRemembersLayers", prefCamadasAntes);
            }
        } catch (ePP2) {}
        app.userInteractionLevel = originalInteraction;
    }
}
