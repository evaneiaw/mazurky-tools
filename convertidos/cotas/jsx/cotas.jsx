// cotas.jsx — lógica ExtendScript da ferramenta Cotas

if (!$.mazurkyCotas) $.mazurkyCotas = { previewMode: false, editingCota: null };

var gap = 4;
var size = 6;
var gapTexto = 0;
var specsLayer;
var drawLayer;
var setFontSize = 20;
var incluirUnidades = true;
var usarTicket = false;
var corCyan = 100;
var corMagenta = 0;
var corYellow = 100;
var corBlack = 0;
var strokeWidthMm = 0.15;
var spotCor;
var docRef;

function specSingle(bound, where) {
    drawLayer.locked = false;

    var a = bound[0];
    var b = bound[2];
    var c = bound[1];
    var xy = "x";
    var dir = 1;

    switch (where) {
        case "Top":
            a = bound[0]; b = bound[2]; c = bound[1];
            xy = "x"; dir = 1;
            break;
        case "Right":
            a = bound[1]; b = bound[3]; c = bound[2];
            xy = "y"; dir = 1;
            break;
        case "Bottom":
            a = bound[0]; b = bound[2]; c = bound[3];
            xy = "x"; dir = -1;
            break;
        case "Left":
            a = bound[1]; b = bound[3]; c = bound[0];
            xy = "y"; dir = -1;
            break;
    }

    var lines = [];

    if (xy == "x") {
        lines[0] = [new Array(a, c + (gap) * dir), new Array(a, c + (gap + size) * dir)];
        lines[1] = [new Array(b, c + (gap) * dir), new Array(b, c + (gap + size) * dir)];
        lines[2] = [new Array(a, c + (gap + size / 2) * dir), new Array(b, c + (gap + size / 2) * dir)];

        if (where == "Top") {
            var t = specLabel(b - a, (a + b) / 2, lines[0][1][1]);
            t.top += t.height + gapTexto;
        } else {
            var t = specLabel(b - a, (a + b) / 2, lines[0][0][1]);
            t.top -= size + gapTexto;
        }
        t.left -= t.width / 2;
    } else {
        lines[0] = [new Array(c + (gap) * dir, a), new Array(c + (gap + size) * dir, a)];
        lines[1] = [new Array(c + (gap) * dir, b), new Array(c + (gap + size) * dir, b)];
        lines[2] = [new Array(c + (gap + size / 2) * dir, a), new Array(c + (gap + size / 2) * dir, b)];

        if (where == "Left") {
            var t = specLabel(a - b, lines[0][1][0], (a + b) / 2);
            t.left -= t.width + gapTexto;
            t.rotate(90, true, false, false, false, Transformation.BOTTOMRIGHT);
            t.top += t.width;
            t.top += t.height / 2;
        } else {
            var t = specLabel(a - b, lines[0][1][0], (a + b) / 2);
            t.rotate(-90, true, false, false, false, Transformation.BOTTOMLEFT);
            t.top += t.width;
            t.top += t.height / 2;
            t.left += gapTexto;
        }
    }

    var specgroup = [t];
    for (var i = 0; i < lines.length; i++) {
        var p = docRef.pathItems.add();
        p.setEntirePath(lines[i]);
        p.strokeDashes = [];
        setLineStyle(p);
        specgroup.push(p);
    }

    group(drawLayer, specgroup);
}

function specDouble(item1, item2, where) {
    var bound = [0, 0, 0, 0];
    var a = item1.geometricBounds;
    var b = item2.geometricBounds;

    if (where == "Top" || where == "Bottom") {
        if (b[0] > a[0]) {
            if (b[0] > a[2]) { bound[0] = a[2]; bound[2] = b[0]; }
            else { bound[0] = b[0]; bound[2] = a[2]; }
        } else if (a[0] >= b[0]) {
            if (a[0] > b[2]) { bound[0] = b[2]; bound[2] = a[0]; }
            else { bound[0] = a[0]; bound[2] = b[2]; }
        }
        bound[1] = Math.max(a[1], b[1]);
        bound[3] = Math.min(a[3], b[3]);
    } else {
        if (b[3] > a[3]) {
            if (b[3] > a[1]) { bound[3] = a[1]; bound[1] = b[3]; }
            else { bound[3] = b[3]; bound[1] = a[1]; }
        } else if (a[3] >= b[3]) {
            if (a[3] > b[1]) { bound[3] = b[1]; bound[1] = a[3]; }
            else { bound[3] = a[3]; bound[1] = b[1]; }
        }
        bound[0] = Math.min(a[0], b[0]);
        bound[2] = Math.max(a[2], b[2]);
    }

    specSingle(bound, where);
}

function specLabel(val, x, y) {
    var t = docRef.textFrames.add();

    var decimals = usarTicket ? 2 : 0;

    t.textRange.characterAttributes.size = setFontSize;
    t.textRange.characterAttributes.alignment = StyleRunAlignmentType.center;
    t.textRange.characterAttributes.fillColor = spotCor;
    t.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");

    var displayUnitsLabel = incluirUnidades;
    var v = val;
    var unitsLabel = "";

    switch (docRef.rulerUnits) {
        case RulerUnits.Picas:
            v = new UnitValue(v, "pt").as("pc");
            var vd = v - Math.floor(v);
            vd = 12 * vd;
            v = Math.floor(v) + "p" + vd.toFixed(decimals);
            break;
        case RulerUnits.Inches:
            v = new UnitValue(v, "pt").as("in");
            v = v.toFixed(decimals);
            unitsLabel = " in";
            break;
        case RulerUnits.Millimeters:
            v = new UnitValue(v, "pt").as("mm");
            v = v.toFixed(decimals);
            unitsLabel = " mm";
            break;
        case RulerUnits.Centimeters:
            v = new UnitValue(v, "pt").as("cm");
            v = v.toFixed(decimals);
            unitsLabel = " cm";
            break;
        case RulerUnits.Pixels:
            v = new UnitValue(v, "pt").as("px");
            v = v.toFixed(decimals);
            unitsLabel = " px";
            break;
        default:
            v = new UnitValue(v, "pt").as("pt");
            v = v.toFixed(decimals);
            unitsLabel = " pt";
    }

    if (displayUnitsLabel) {
        t.contents = v + unitsLabel;
    } else {
        t.contents = v;
    }

    t.top = y;
    t.left = x;

    return t;
}

function setLineStyle(path) {
    path.filled = false;
    path.stroked = true;
    var color = new CMYKColor();
    color.cyan = corCyan;
    color.magenta = corMagenta;
    color.yellow = corYellow;
    color.black = corBlack;
    path.strokeColor = color;
    var strokeWidthInPoints = strokeWidthMm * 2.8346456692913385;
    path.strokeWidth = strokeWidthInPoints > 0 ? strokeWidthInPoints : 0.15 * 2.8346456692913385;
    return path;
}

function group(layer, items, isDuplicate) {
    var gg = layer.groupItems.add();
    for (var i = items.length - 1; i >= 0; i--) {
        if (items[i] != gg) {
            if (isDuplicate) {
                items[i].duplicate(gg, ElementPlacement.PLACEATBEGINNING);
            } else {
                items[i].move(gg, ElementPlacement.PLACEATBEGINNING);
            }
        }
    }
    return gg;
}

function convertToBoolean(string) {
    return string.toLowerCase() === "true";
}

function obterCamadaTecnica(doc) {
    var layer;
    try {
        layer = doc.layers["tecnica"];
    } catch (e) {
        layer = doc.layers.add();
        layer.name = "tecnica";
    }
    layer.locked = false;
    layer.visible = true;
    return layer;
}

function obterSublayer(parentLayer, name) {
    for (var i = 0; i < parentLayer.layers.length; i++) {
        if (parentLayer.layers[i].name == name) {
            return parentLayer.layers[i];
        }
    }
    return null;
}

function removerSublayer(parentLayer, name) {
    var sub = obterSublayer(parentLayer, name);
    if (sub) {
        try {
            sub.locked = false;
            sub.remove();
        } catch (e) {}
    }
}

function removerPrevia() {
    try {
        var specsLayer = app.activeDocument.layers["tecnica"];
        removerSublayer(specsLayer, "previa");
    } catch (e) {}
}

function itemEmCamadaTecnica(item) {
    var layer = item.layer;
    while (layer) {
        if (layer.name == "tecnica") return true;
        var parent = layer.parent;
        if (!parent || parent.typename == "Document") break;
        layer = parent;
    }
    return false;
}

function objetosNaoCota(doc) {
    var objetos = [];
    var sel = doc.selection;
    if (!sel) return objetos;
    for (var i = 0; i < sel.length; i++) {
        if (!itemEmCamadaTecnica(sel[i])) {
            objetos.push(sel[i]);
        }
    }
    return objetos;
}

function uniaoBounds(objs) {
    var minL = Infinity;
    var topY = -Infinity;
    var maxR = -Infinity;
    var bottomY = Infinity;
    for (var i = 0; i < objs.length; i++) {
        var gb = objs[i].geometricBounds;
        if (gb[0] < minL) minL = gb[0];
        if (gb[1] > topY) topY = gb[1];
        if (gb[2] > maxR) maxR = gb[2];
        if (gb[3] < bottomY) bottomY = gb[3];
    }
    return [minL, topY, maxR, bottomY];
}

function montarSides(top, left, right, bottom) {
    var sides = [];
    if (top) sides.push("Top");
    if (left) sides.push("Left");
    if (right) sides.push("Right");
    if (bottom) sides.push("Bottom");
    return sides;
}

function montarUnidades(objs, top, right, bottom, left, distEntre, cotaUnica) {
    var units = [];
    if (objs.length == 0) return units;

    var sides = montarSides(top, left, right, bottom);

    if (distEntre && objs.length == 2) {
        units.push({ type: "double", items: [objs[0], objs[1]], jobs: sides });
        return units;
    }

    if (cotaUnica) {
        units.push({ type: "bounds", bounds: uniaoBounds(objs), jobs: sides });
        return units;
    }

    for (var i = 0; i < objs.length; i++) {
        units.push({ type: "bounds", bounds: objs[i].geometricBounds, jobs: sides });
    }
    return units;
}

function renderizarUnidade(unit) {
    for (var i = 0; i < unit.jobs.length; i++) {
        if (unit.type == "double") {
            specDouble(unit.items[0], unit.items[1], unit.jobs[i]);
        } else {
            specSingle(unit.bounds, unit.jobs[i]);
        }
    }
}

function proximoIndiceCota(specsLayer) {
    var max = 0;
    for (var i = 0; i < specsLayer.layers.length; i++) {
        var name = specsLayer.layers[i].name;
        if (name.indexOf("Cota ") === 0) {
            var num = parseInt(name.substring(5));
            if (!isNaN(num) && num > max) {
                max = num;
            }
        }
    }
    return max;
}

function proximosNomes(specsLayer, editing, count) {
    var idx = proximoIndiceCota(specsLayer);
    var names = [];
    if (editing) {
        names.push(editing);
        var edNum = parseInt(editing.substring(5));
        if (!isNaN(edNum) && edNum > idx) idx = edNum;
    }
    var n = 1;
    while (names.length < count) {
        names.push("Cota " + (idx + n));
        n++;
    }
    return names;
}

function prepararSpot(doc, cyan, magenta, yellow, black) {
    var spotExists = false;
    var existingSpot;
    for (var i = 0; i < doc.spots.length; i++) {
        if (doc.spots[i].name == "Tecnica" || doc.spots[i].name == "tecnica") {
            spotExists = true;
            existingSpot = doc.spots[i];
            break;
        }
    }

    var color = new CMYKColor();
    color.cyan = cyan;
    color.magenta = magenta;
    color.yellow = yellow;
    color.black = black;

    var newSpot;
    if (spotExists) {
        newSpot = existingSpot;
    } else {
        newSpot = doc.spots.add();
        newSpot.name = "Tecnica";
        newSpot.colorType = ColorModel.SPOT;
        newSpot.color = color;
    }

    newSpot.color = color;

    var newSpotColor = new SpotColor();
    newSpotColor.spot = newSpot;
    newSpotColor.tint = 100;
    return newSpotColor;
}

function assinaturaSelecao() {
    try {
        if (app.documents.length == 0) return "";
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || sel.length == 0) return "";
        var partes = [];
        for (var i = 0; i < sel.length; i++) {
            if (itemEmCamadaTecnica(sel[i])) continue;
            var gb = sel[i].geometricBounds;
            partes.push([gb[0].toFixed(1), gb[1].toFixed(1), gb[2].toFixed(1), gb[3].toFixed(1)].join(","));
        }
        partes.sort();
        return partes.join("|");
    } catch (e) {
        return "";
    }
}

function cotaSelecionada() {
    try {
        if (app.documents.length == 0) return "";
        var doc = app.activeDocument;
        var sel = doc.selection;
        if (!sel || sel.length == 0) return "";
        var nomes = {};
        for (var i = 0; i < sel.length; i++) {
            var item = sel[i];
            if (!itemEmCamadaTecnica(item)) continue;
            var layerName = item.layer.name;
            if (layerName.indexOf("Cota ") === 0) {
                nomes[layerName] = true;
            }
        }
        var keys = [];
        for (var k in nomes) keys.push(k);
        if (keys.length == 1) return keys[0];
        return "";
    } catch (e) {
        return "";
    }
}

function setCotaEdicao(nome) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";
        var doc = app.activeDocument;
        var specsLayer;
        try {
            specsLayer = doc.layers["tecnica"];
        } catch (e) {
            specsLayer = null;
        }
        if (!nome) {
            $.mazurkyCotas.editingCota = null;
            return "ok";
        }
        var bounds = null;
        if (specsLayer) {
            var sub = obterSublayer(specsLayer, nome);
            if (sub) {
                sub.locked = false;
                sub.remove();
            }
        }
        $.mazurkyCotas.editingCota = { nome: nome, bounds: bounds };
        app.redraw();
        return "ok";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao preparar edição: " + (e.message || String(e)) + linhaErro;
    }
}

function executar(top, right, bottom, left, unidades, distEntre, fontSize, ticket, cyan, magenta, yellow, black, strokeWeight, distancia, offsetTexto, cotaUnica) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;

        top = !!top;
        right = !!right;
        bottom = !!bottom;
        left = !!left;
        unidades = !!unidades;
        distEntre = !!distEntre;
        ticket = !!ticket;
        cotaUnica = !!cotaUnica;

        if (isNaN(fontSize) || fontSize <= 0) {
            fontSize = parseInt($.getenv("Specify_defaultFontSize")) || 20;
        }
        if (isNaN(strokeWeight) || strokeWeight <= 0) {
            strokeWeight = parseFloat($.getenv("Specify_defaultStrokeWeight")) || 0.5;
        }
        if (isNaN(distancia) || distancia < 0) {
            distancia = parseFloat($.getenv("Specify_defaultGap")) || 5;
        }
        if (isNaN(offsetTexto) || offsetTexto < 0) {
            offsetTexto = 0;
        }

        cyan = parseInt(cyan);
        magenta = parseInt(magenta);
        yellow = parseInt(yellow);
        black = parseInt(black);

        if (isNaN(cyan) || isNaN(magenta) || isNaN(yellow) || isNaN(black) ||
            cyan < 0 || cyan > 999 || magenta < 0 || magenta > 999 || yellow < 0 || yellow > 999 || black < 0 || black > 999) {
            return "Por favor insira uma cor CMYK válida.";
        }

        if (!top && !left && !right && !bottom) {
            return "Por favor selecione ao menos 1 dimensão para desenhar.";
        }

        var objectsToSpec = objetosNaoCota(doc);
        var editing = $.mazurkyCotas.editingCota;
        var units;
        if (objectsToSpec.length == 0) {
            return "Selecione o(s) objeto(s) antes de executar.";
        }
        units = montarUnidades(objectsToSpec, top, right, bottom, left, distEntre, cotaUnica);

        $.setenv("Specify_defaultUnits", unidades);
        $.setenv("Specify_defaultFontSize", fontSize);
        $.setenv("Specify_defaultColorCyan", cyan);
        $.setenv("Specify_defaultColorMagenta", magenta);
        $.setenv("Specify_defaultColorYellow", yellow);
        $.setenv("Specify_defaultColorBlack", black);
        $.setenv("Specify_defaultTicket", ticket);
        $.setenv("Specify_defaultStrokeWeight", String(strokeWeight));
        $.setenv("Specify_defaultGap", String(distancia));
        $.setenv("Specify_defaultTop", top);
        $.setenv("Specify_defaultRight", right);
        $.setenv("Specify_defaultBottom", bottom);
        $.setenv("Specify_defaultLeft", left);

        docRef = doc;
        setFontSize = fontSize;
        incluirUnidades = unidades;
        usarTicket = ticket;
        corCyan = cyan;
        corMagenta = magenta;
        corYellow = yellow;
        corBlack = black;
        strokeWidthMm = strokeWeight;
        gap = distancia * 2.8346456692913385;
        gapTexto = offsetTexto * 2.8346456692913385;

        specsLayer = obterCamadaTecnica(doc);
        spotCor = prepararSpot(doc, cyan, magenta, yellow, black);

        if ($.mazurkyCotas.previewMode) {
            removerSublayer(specsLayer, "previa");
            drawLayer = specsLayer.layers.add();
            drawLayer.name = "previa";
            drawLayer.locked = false;
            for (var p = 0; p < units.length; p++) {
                renderizarUnidade(units[p]);
            }
        } else {
            removerSublayer(specsLayer, "previa");
            var nomes = proximosNomes(specsLayer, editing ? editing.nome : null, units.length);
            for (var u = 0; u < units.length; u++) {
                drawLayer = specsLayer.layers.add();
                drawLayer.name = nomes[u];
                drawLayer.locked = false;
                renderizarUnidade(units[u]);
            }
            $.mazurkyCotas.editingCota = null;
        }

        app.redraw();
        return $.mazurkyCotas.previewMode ? "Prévia criada com sucesso!" : "Cotas aplicadas com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function preview(top, right, bottom, left, unidades, distEntre, fontSize, ticket, cyan, magenta, yellow, black, strokeWeight, distancia, offsetTexto, cotaUnica) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        removerPrevia();
        $.mazurkyCotas.previewMode = true;
        try {
            var result = executar(top, right, bottom, left, unidades, distEntre, fontSize, ticket, cyan, magenta, yellow, black, strokeWeight, distancia, offsetTexto, cotaUnica);
        } finally {
            $.mazurkyCotas.previewMode = false;
        }

        if (result !== "Prévia criada com sucesso!") {
            removerPrevia();
            return result;
        }

        app.redraw();
        return "Prévia criada com sucesso!";
    } catch (e) {
        $.mazurkyCotas.previewMode = false;
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function cancelar() {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        removerPrevia();
        $.mazurkyCotas.editingCota = null;
        app.redraw();
        return "Cancelado com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao cancelar: " + (e.message || String(e)) + linhaErro;
    }
}
