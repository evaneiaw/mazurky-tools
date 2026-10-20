// info.jsx — lógica ExtendScript da ferramenta INFO

var INFO_LAYER_NAME = "INFO";

var ALIGN_TL = 'TL';
var ALIGN_TR = 'TR';
var ALIGN_BL = 'BL';
var ALIGN_BR = 'BR';

var ROTATE_NONE = 0;
var ROTATE_RIGHT = -90;
var ROTATE_LEFT = 90;

var MM_TO_PTS = 72 / 25.4;
var docMmFactor = MM_TO_PTS;
var ICON_MM = 10;
var GAP_ICON_MM = 4;
var DEFAULT_STROKE_MM = 0.3;
var DEFAULT_MARGIN_MM = 7.0;
var PREF_KEY_MARGIN = "MazurkyWave/MarginMM";
var PREF_KEY_ALIGN = "MazurkyWave/Alignment";
var PREF_KEY_ROTATE = "MazurkyWave/Rotate";
var PREF_KEY_FILE = "MazurkyWave/ShowFile";
var PREF_KEY_ART = "MazurkyWave/ShowArt";
var PREF_KEY_SIZE = "MazurkyWave/ShowSize";
var PREF_KEY_ICC = "MazurkyWave/ShowICC";
var PREF_KEY_DATE = "MazurkyWave/ShowDate";
var PREF_KEY_MANUAL = "MazurkyWave/ManualText";
var PREF_KEY_SHOW_MANUAL = "MazurkyWave/ShowManual";
var PREF_KEY_SENTIDO = "MazurkyWave/Sentido";
var PREF_KEY_TODOS = "MazurkyWave/Todos";
var PREF_KEY_SCALE = "MazurkyWave/Scale";
var PREF_KEY_SCALE_FACTOR = "MazurkyWave/ScaleFactor";
var PREF_KEY_STROKE = "MazurkyWave/IconStrokeMM";

var SCALE_1X = 100;
var SCALE_1_1X = 110;
var SCALE_1_2X = 120;
var SCALE_1_3X = 130;

var TEXT_FILE_NAME = "file";
var TEXT_ARTBOARD_NAME = "artboard";
var TEXT_ARTBOARD_SIZE = "artboard_size";
var TEXT_ICC_PROFILE = "icc";
var TEXT_DATE_TIME = "datetime";
var TEXT_MANUAL = "manual";

var selectedTextOptions = [];
var manualTextContent = "";
var sentidoOnda = "H";

function getCleanDocumentName(doc) {
    var name = doc.name;
    if (doc.fullName && doc.fullName.exists) {
        var i = name.lastIndexOf(".");
        if (i > 0) return name.substring(0, i);
    }
    return name;
}

function getActiveArtboardName(doc, artboardIndex) {
    if (artboardIndex === undefined) artboardIndex = doc.artboards.getActiveArtboardIndex();
    return doc.artboards[artboardIndex].name;
}

function getICCProfile(doc) {
    try { return doc.colorProfileName || "Não definido"; }
    catch (e) { return "Não definido"; }
}

function getDateTime() {
    var d = new Date();
    var dateStr = ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
    var timeStr = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + "h";
    return dateStr + " (" + timeStr + ")";
}

function getArtboardSize(doc, artboardIndex) {
    try {
        if (artboardIndex === undefined) artboardIndex = doc.artboards.getActiveArtboardIndex();
        var ab = doc.artboards[artboardIndex];
        var r = ab.artboardRect;
        var widthMM = Math.round((r[2] - r[0]) / docMmFactor);
        var heightMM = Math.round((r[1] - r[3]) / docMmFactor);
        // A 1ª medida segue o sentido da onda: vertical → altura, horizontal → largura.
        var primeiro = (sentidoOnda === "V") ? heightMM : widthMM;
        var segundo = (sentidoOnda === "V") ? widthMM : heightMM;
        return primeiro + " x " + segundo + " mm";
    } catch (e) {
        return "Não definido";
    }
}

// O Illustrator (Large Canvas) reduz 10x os documentos acima de ~5779,5 mm e
// expoe isso em doc.scaleFactor (=10 nesses casos, 1 nos normais). Dividir por
// esse fator devolve a medida real, igual em qualquer documento.
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

function findLayerCaseInsensitive(doc, name) {
    var lowerName = name.toLowerCase();
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name.toLowerCase() === lowerName) {
            return doc.layers[i];
        }
    }
    return null;
}

function getFont(name) {
    try {
        return app.textFonts.getByName(name);
    } catch (e) {
        try {
            return app.textFonts.getByName("MyriadPro-Regular");
        } catch (e2) {
            try {
                return app.textFonts[0];
            } catch (e3) {
                return null;
            }
        }
    }
}

function opcaoAtiva(options, tipo) {
    for (var i = 0; i < options.length; i++) {
        if (options[i] === tipo) return true;
    }
    return false;
}

function generateTextContent(doc, options, artboardIndex) {
    var linhas = [];

    if (opcaoAtiva(options, TEXT_FILE_NAME)) {
        linhas.push(getCleanDocumentName(doc));
    }

    var linha1 = [];
    if (opcaoAtiva(options, TEXT_ARTBOARD_NAME)) linha1.push(getActiveArtboardName(doc, artboardIndex));
    if (opcaoAtiva(options, TEXT_ARTBOARD_SIZE)) linha1.push("Tam: " + getArtboardSize(doc, artboardIndex));
    if (opcaoAtiva(options, TEXT_DATE_TIME)) linha1.push(getDateTime());
    if (linha1.length > 0) linhas.push(linha1.join(" / "));

    var linha2 = [];
    if (opcaoAtiva(options, TEXT_ICC_PROFILE)) linha2.push(getICCProfile(doc));
    if (opcaoAtiva(options, TEXT_MANUAL) && manualTextContent) linha2.push(manualTextContent);
    if (linha2.length > 0) linhas.push(linha2.join(" / "));

    return linhas.join("\n");
}

// Espessura dos traços do ícone (a onda que vai junto do texto). Aplicada
// DEPOIS de escalar o grupo e em mm, para ficar fixa em qualquer escala.
function aplicarEspessuraTraco(item, largura) {
    if (item.typename === "PathItem") {
        try { item.strokeWidth = largura; } catch (e0) {}
        return;
    }
    var filhos = null;
    try { filhos = item.pageItems; } catch (e1) { filhos = null; }
    if (filhos) {
        for (var i = 0; i < filhos.length; i++) aplicarEspessuraTraco(filhos[i], largura);
    }
    try {
        var paths = item.pathItems;
        for (var j = 0; j < paths.length; j++) aplicarEspessuraTraco(paths[j], largura);
    } catch (e2) {}
}

function positionAndAlignText(textFrame, waveGroup, alignment, sf) {
    if (sf === undefined || sf < 1) sf = 1;
    var padding = GAP_ICON_MM * MM_TO_PTS / sf;

    if (alignment === ALIGN_TL || alignment === ALIGN_BL) {
        textFrame.textRange.paragraphAttributes.justification = Justification.LEFT;
        textFrame.left = waveGroup.left + waveGroup.width + padding;
    } else {
        textFrame.textRange.paragraphAttributes.justification = Justification.RIGHT;
        var w = textFrame.width;
        if (w === 0) {
            textFrame.textRange.select();
            w = textFrame.width;
            app.activeDocument.selection = null;
        }
        textFrame.left = waveGroup.left - padding - w;
    }

    textFrame.top = waveGroup.top - (waveGroup.height / 2) + (textFrame.height / 2);
}

function importarSvgECentralizar(svgName, doc, alignment, marginPts, rotateAngle, artboardIndex, escalaBloco, strokePt) {

    if (rotateAngle === undefined) rotateAngle = 0;
    if (artboardIndex === undefined) artboardIndex = doc.artboards.getActiveArtboardIndex();

    escalaBloco = parseFloat(escalaBloco);
    if (isNaN(escalaBloco) || escalaBloco <= 0) escalaBloco = 100;

    strokePt = parseFloat(strokePt);
    if (isNaN(strokePt) || strokePt <= 0) strokePt = DEFAULT_STROKE_MM * MM_TO_PTS / escalaDoc();

    var sf = escalaDoc();
    docMmFactor = MM_TO_PTS / sf;
    var fonte = 10 / sf;
    var tituloFonte = 13 / sf;
    var spaceAfter = 1 / sf;
    var spaceAfterFirst = 4 / sf;

    var activeIdx = artboardIndex;
    var currentArtboardName = doc.artboards[activeIdx].name;
    var currentSubLayerName = (activeIdx + 1) + " - " + currentArtboardName;

    var SCRIPT_FOLDER_GLOBAL = new File($.fileName).parent.parent;
    if (!SCRIPT_FOLDER_GLOBAL || !SCRIPT_FOLDER_GLOBAL.exists) {
        throw new Error("Pasta do script não encontrada.");
    }

    var svgFile = new File(SCRIPT_FOLDER_GLOBAL.fsName + "/" + svgName);
    if (!svgFile.exists) {
        throw new Error("SVG não encontrado: " + svgName);
    }

    var mainLayer;
    try {
        mainLayer = doc.layers.getByName(INFO_LAYER_NAME);
    } catch (e) {
        mainLayer = doc.layers.add();
        mainLayer.name = INFO_LAYER_NAME;
    }

    mainLayer.visible = true;
    mainLayer.locked = false;

    var miraLayer;
    try {
        miraLayer = doc.layers.getByName("MIRA");
    } catch (e) {}

    if (miraLayer) {
        var miraLocked = miraLayer.locked;
        miraLayer.locked = false;
        try {
            mainLayer.move(miraLayer, ElementPlacement.PLACEAFTER);
        } catch (e) {}
        miraLayer.locked = miraLocked;
    } else {
        var arteLayer;
        try {
            arteLayer = doc.layers.getByName("ARTE");
        } catch (e) {
            try {
                arteLayer = doc.layers.getByName("ARTES");
            } catch (e2) {}
        }
        if (arteLayer) {
            var arteLocked = arteLayer.locked;
            arteLayer.locked = false;
            try {
                mainLayer.move(arteLayer, ElementPlacement.PLACEBEFORE);
            } catch (e) {}
            arteLayer.locked = arteLocked;
        } else {
            mainLayer.move(doc, ElementPlacement.PLACEATBEGINNING);
        }
    }

    try {
        var oldSub = mainLayer.layers.getByName(currentSubLayerName);
        if (oldSub) oldSub.remove();
    } catch (e) {}

    var subLayer = mainLayer.layers.add();
    subLayer.name = currentSubLayerName;

    try {
        var wave = subLayer.groupItems.createFromFile(svgFile);

        try {
            if (wave.width > 0) {
                var alvoIco = ICON_MM * docMmFactor;
                var sIco = alvoIco / wave.width;
                wave.resize(sIco * 100, sIco * 100, true, true, true, true, false);
            }
        } catch (eIco) {}

        var infoGroup = subLayer.groupItems.add();
        wave.moveToBeginning(infoGroup);

        if (selectedTextOptions.length > 0) {
            var tf = subLayer.textFrames.add();
            tf.contents = generateTextContent(doc, selectedTextOptions, activeIdx);
            tf.textRange.characterAttributes.size = fonte;
            tf.textRange.characterAttributes.textFont = getFont("ArialMT");
            tf.textRange.paragraphAttributes.spaceAfter = spaceAfter;
            var black = new RGBColor(); black.red = black.green = black.blue = 0;
            tf.textRange.characterAttributes.fillColor = black;

            if (opcaoAtiva(selectedTextOptions, TEXT_FILE_NAME)) {
                try {
                    var linhaTitulo = tf.textRange.lines[0];
                    linhaTitulo.characterAttributes.textFont = getFont("Arial-BoldMT");
                    linhaTitulo.characterAttributes.size = tituloFonte;
                    linhaTitulo.paragraphAttributes.spaceAfter = spaceAfterFirst;
                } catch (eTitulo) {}
            }

            positionAndAlignText(tf, wave, alignment, sf);

            tf.moveToBeginning(infoGroup);
        }

        if (escalaBloco !== 100) {
            infoGroup.resize(escalaBloco, escalaBloco, true, true, true, true, false);
        }

        if (rotateAngle !== 0) {
            infoGroup.rotate(rotateAngle, true, true, true, true, Transformation.CENTER);
        }

        if (rotateAngle !== 0) {
            wave.rotate(-rotateAngle, true, true, true, true, Transformation.CENTER);
        }

        if (strokePt > 0) {
            aplicarEspessuraTraco(wave, strokePt);
        }

        var ab = doc.artboards[activeIdx];
        var r = ab.artboardRect;
        var minX = r[0], maxY = r[1], maxX = r[2], minY = r[3];

        var x, y;

        if (alignment === ALIGN_TL) {
            x = minX + marginPts;
            y = maxY - marginPts;
        } else if (alignment === ALIGN_TR) {
            x = maxX - infoGroup.width - marginPts;
            y = maxY - marginPts;
        } else if (alignment === ALIGN_BL) {
            x = minX + marginPts;
            y = minY + infoGroup.height + marginPts;
        } else {
            x = maxX - infoGroup.width - marginPts;
            y = minY + infoGroup.height + marginPts;
        }

        infoGroup.left = x;
        infoGroup.top = y;

        doc.selection = null;

        return infoGroup;

    } catch (e) {
        throw new Error("Erro ao importar SVG: " + (e.message || String(e)));
    }
}

function executarInfo(svgName, doc, alignment, marginPts, rotateAngle, todosArtboards, escalaBloco, strokePt) {
    if (todosArtboards) {
        for (var ab = 0; ab < doc.artboards.length; ab++) {
            importarSvgECentralizar(svgName, doc, alignment, marginPts, rotateAngle, ab, escalaBloco, strokePt);
        }
    } else {
        importarSvgECentralizar(svgName, doc, alignment, marginPts, rotateAngle, undefined, escalaBloco, strokePt);
    }
}

function jsonEscape(s) {
    return String(s)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}

function getInfoPrefs() {
    try {
        var m = app.preferences.getStringPreference(PREF_KEY_MARGIN);
        var margem = parseFloat(m);
        if (isNaN(margem)) margem = DEFAULT_MARGIN_MM;

        var align = app.preferences.getStringPreference(PREF_KEY_ALIGN);
        if (!align) align = ALIGN_BL;

        var rot = parseInt(app.preferences.getStringPreference(PREF_KEY_ROTATE), 10);
        if (isNaN(rot)) rot = ROTATE_NONE;
        var rotacao = "normal";
        if (rot === ROTATE_RIGHT) rotacao = "direita";
        if (rot === ROTATE_LEFT) rotacao = "esquerda";

        var showFile = app.preferences.getBooleanPreference(PREF_KEY_FILE);
        if (showFile === undefined) showFile = true;
        var showArt = app.preferences.getBooleanPreference(PREF_KEY_ART);
        if (showArt === undefined) showArt = false;
        var showSize = app.preferences.getBooleanPreference(PREF_KEY_SIZE);
        if (showSize === undefined) showSize = false;
        var showICC = app.preferences.getBooleanPreference(PREF_KEY_ICC);
        if (showICC === undefined) showICC = false;
        var showDate = app.preferences.getBooleanPreference(PREF_KEY_DATE);
        if (showDate === undefined) showDate = false;
        var showManual = app.preferences.getBooleanPreference(PREF_KEY_SHOW_MANUAL);
        if (showManual === undefined) showManual = false;
        var manualText = app.preferences.getStringPreference(PREF_KEY_MANUAL);
        if (!manualText) manualText = "";

        var sentido = app.preferences.getStringPreference(PREF_KEY_SENTIDO);
        if (sentido !== "H" && sentido !== "V") sentido = "H";

        var todos = app.preferences.getBooleanPreference(PREF_KEY_TODOS);
        if (todos === undefined) todos = false;

        var escala = parseFloat(app.preferences.getStringPreference(PREF_KEY_SCALE_FACTOR));
        if (isNaN(escala) || escala <= 0) escala = 100;

        var espessura = parseFloat(app.preferences.getStringPreference(PREF_KEY_STROKE));
        if (isNaN(espessura) || espessura <= 0) espessura = DEFAULT_STROKE_MM;

        return "{" +
            '"margem":' + margem + "," +
            '"posicao":"' + align + '",' +
            '"rotacao":"' + rotacao + '",' +
            '"showFile":' + (showFile ? "true" : "false") + "," +
            '"showArt":' + (showArt ? "true" : "false") + "," +
            '"showSize":' + (showSize ? "true" : "false") + "," +
            '"showICC":' + (showICC ? "true" : "false") + "," +
            '"showDate":' + (showDate ? "true" : "false") + "," +
            '"showManual":' + (showManual ? "true" : "false") + "," +
            '"manualText":"' + jsonEscape(manualText) + '",' +
            '"sentido":"' + sentido + '",' +
            '"escala":' + escala + "," +
            '"espessura":' + espessura + "," +
            '"todos":' + (todos ? "true" : "false") +
            "}";
    } catch (e) {
        return "{}";
    }
}

function executar(margemMM, posicao, rotacao, showFile, showArt, showSize, showICC, showDate, showManual, manualText, todosArtboards, sentido, escalaBloco, espessuraMM) {
    try {
        if (app.documents.length === 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;

        var currentAlignment = ALIGN_BL;
        if (posicao === ALIGN_TL || posicao === ALIGN_TR || posicao === ALIGN_BL || posicao === ALIGN_BR) {
            currentAlignment = posicao;
        }

        var currentRotate = ROTATE_NONE;
        if (rotacao === "direita") currentRotate = ROTATE_RIGHT;
        else if (rotacao === "esquerda") currentRotate = ROTATE_LEFT;

        var marginMm = parseFloat(String(margemMM).replace(",", "."));
        if (isNaN(marginMm) || marginMm < 0) marginMm = DEFAULT_MARGIN_MM;

        var marginPts = marginMm * mmFactorDoc();

        var escala = parseFloat(String(escalaBloco).replace(",", "."));
        if (isNaN(escala) || escala <= 0) escala = 100;

        var espessuraMm = parseFloat(String(espessuraMM).replace(",", "."));
        if (isNaN(espessuraMm) || espessuraMm <= 0) espessuraMm = DEFAULT_STROKE_MM;
        var strokePt = espessuraMm * mmFactorDoc();

        selectedTextOptions = [];
        manualTextContent = manualText || "";
        if (showFile) selectedTextOptions.push(TEXT_FILE_NAME);
        if (showArt) selectedTextOptions.push(TEXT_ARTBOARD_NAME);
        if (showSize) selectedTextOptions.push(TEXT_ARTBOARD_SIZE);
        if (showICC) selectedTextOptions.push(TEXT_ICC_PROFILE);
        if (showDate) selectedTextOptions.push(TEXT_DATE_TIME);
        if (showManual && manualTextContent.length > 0) selectedTextOptions.push(TEXT_MANUAL);

        app.preferences.setStringPreference(PREF_KEY_MARGIN, marginMm.toString());
        app.preferences.setStringPreference(PREF_KEY_ALIGN, currentAlignment);
        app.preferences.setStringPreference(PREF_KEY_ROTATE, currentRotate.toString());
        app.preferences.setBooleanPreference(PREF_KEY_FILE, showFile);
        app.preferences.setBooleanPreference(PREF_KEY_ART, showArt);
        app.preferences.setBooleanPreference(PREF_KEY_SIZE, showSize);
        app.preferences.setBooleanPreference(PREF_KEY_ICC, showICC);
        app.preferences.setBooleanPreference(PREF_KEY_DATE, showDate);
        app.preferences.setBooleanPreference(PREF_KEY_SHOW_MANUAL, !!showManual);
        app.preferences.setStringPreference(PREF_KEY_MANUAL, manualTextContent);
        app.preferences.setStringPreference(PREF_KEY_SENTIDO, (sentido === "V") ? "V" : "H");
        app.preferences.setBooleanPreference(PREF_KEY_TODOS, !!todosArtboards);
        app.preferences.setStringPreference(PREF_KEY_SCALE_FACTOR, escala.toString());
        app.preferences.setStringPreference(PREF_KEY_STROKE, espessuraMm.toString());

        var svgName = (sentido === "V") ? "onda_v.svg" : "onda_h.svg";
        sentidoOnda = (sentido === "V") ? "V" : "H";

        executarInfo(svgName, doc, currentAlignment, marginPts, currentRotate, todosArtboards, escala, strokePt);

        app.redraw();
        return "INFO aplicada com sucesso! (ícone " + ICON_MM + " mm, espaço " + GAP_ICON_MM +
            " mm, traço " + espessuraMm + " mm, texto 10 pt / título 13 pt" + (escala !== 100 ? ", escala " + escala + "%" : "") +
            " — margem " + marginMm + " mm)";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
