// tracejarpicote.jsx — lógica ExtendScript da ferramenta Tracejar Linha (Picote)

function mmToPt(mm) {
    return mm * 2.834645;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function interpolate(p1, p2, t) {
    return [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
}

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
}

function bezierPoint(t, p0, p1, p2, p3) {
    var mt = 1 - t, mt2 = mt * mt, t2 = t * t;
    var x = mt2 * mt * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t2 * t * p3[0];
    var y = mt2 * mt * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t2 * t * p3[1];
    return [x, y];
}

function bezierSplit(p0, p1, p2, p3, t) {
    var p01 = interpolate(p0, p1, t);
    var p12 = interpolate(p1, p2, t);
    var p23 = interpolate(p2, p3, t);
    var p012 = interpolate(p01, p12, t);
    var p123 = interpolate(p12, p23, t);
    var p0123 = interpolate(p012, p123, t);
    return [[p0, p01, p012, p0123], [p0123, p123, p23, p3]];
}

function getTotalPathSegments(path) {
    var segments = [];
    for (var i = 0; i < path.pathPoints.length - 1; i++) {
        segments.push({
            p0: path.pathPoints[i].anchor,
            p1: path.pathPoints[i].rightDirection,
            p2: path.pathPoints[i + 1].leftDirection,
            p3: path.pathPoints[i + 1].anchor
        });
    }
    return segments;
}

function bezierLength(p0, p1, p2, p3, steps) {
    steps = steps || 20;
    var length = 0, prev = p0;
    for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var pt = bezierPoint(t, p0, p1, p2, p3);
        length += distance(prev, pt);
        prev = pt;
    }
    return length;
}

function buildLengthTable(segments, stepsPerSegment) {
    var table = [], total = 0;
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var len = bezierLength(seg.p0, seg.p1, seg.p2, seg.p3, stepsPerSegment);
        table.push({ length: len, total: total });
        total += len;
    }
    return { table: table, totalLength: total };
}

function getSegmentAndTAtDistance(segments, table, distanceAlongPath) {
    for (var i = 0; i < table.length; i++) {
        var segStart = table[i].total;
        var segEnd = segStart + table[i].length;
        if (distanceAlongPath <= segEnd) {
            var t = (distanceAlongPath - segStart) / table[i].length;
            return { index: i, t: t };
        }
    }
    return null;
}

function getSpotColor(name, r, g, b) {
    var spot;
    for (var i = 0; i < app.activeDocument.spots.length; i++) {
        if (app.activeDocument.spots[i].name === name) {
            spot = app.activeDocument.spots[i];
            break;
        }
    }
    if (!spot) {
        spot = app.activeDocument.spots.add();
        spot.colorType = ColorModel.SPOT;
        var color = new RGBColor();
        color.red = r; color.green = g; color.blue = b;
        spot.color = color;
        spot.name = name;
    }
    var spotColor = new SpotColor();
    spotColor.spot = spot;
    spotColor.tint = 100;
    return spotColor;
}

function addPath(group, seg, originalPath, color) {
    var newPath = group.pathItems.add();
    newPath.setEntirePath([seg[0], seg[3]]);
    var pt0 = newPath.pathPoints[0];
    pt0.anchor = seg[0];
    pt0.rightDirection = seg[1];
    pt0.leftDirection = seg[0];
    pt0.pointType = PointType.SMOOTH;

    var pt1 = newPath.pathPoints[1];
    pt1.anchor = seg[3];
    pt1.leftDirection = seg[2];
    pt1.rightDirection = seg[3];
    pt1.pointType = PointType.SMOOTH;

    newPath.stroked = true;
    newPath.strokeWidth = originalPath.strokeWidth;
    newPath.strokeColor = color;
    newPath.strokeOverprint = true;
    newPath.filled = false;
}

function processWholePath(path, dashPt, gapPt, duplicarOriginal) {
    var doc = app.activeDocument;
    var group = doc.activeLayer.groupItems.add();
    var segments = getTotalPathSegments(path);
    var data = buildLengthTable(segments, 50);
    var total = data.totalLength;

    var cutColor = getSpotColor("Cut", 0, 0, 0);
    var creaseColor = getSpotColor("Crease", 255, 0, 0);

    if (duplicarOriginal) {
        path.strokeColor = creaseColor;
        path.strokeOverprint = true;
    } else {
        path.remove();
    }

    var pos = 0;
    while (pos < total) {
        var startInfo = getSegmentAndTAtDistance(segments, data.table, pos);
        var endInfo = getSegmentAndTAtDistance(segments, data.table, pos + dashPt);
        if (!startInfo || !endInfo) break;
        var segStart = segments[startInfo.index];
        var segEnd = segments[endInfo.index];

        var seg1 = bezierSplit(segStart.p0, segStart.p1, segStart.p2, segStart.p3, startInfo.t)[1];
        var endSplit = bezierSplit(segEnd.p0, segEnd.p1, segEnd.p2, segEnd.p3, endInfo.t);
        var seg2 = endSplit[0];

        if (startInfo.index === endInfo.index) {
            var partial = bezierSplit(segStart.p0, segStart.p1, segStart.p2, segStart.p3, startInfo.t);
            var piece = bezierSplit(partial[1][0], partial[1][1], partial[1][2], partial[1][3], (endInfo.t - startInfo.t) / (1 - startInfo.t));
            addPath(group, piece[0], path, cutColor);
        } else {
            addPath(group, seg1, path, cutColor);
            for (var k = startInfo.index + 1; k < endInfo.index; k++) {
                addPath(group, [segments[k].p0, segments[k].p1, segments[k].p2, segments[k].p3], path, cutColor);
            }
            addPath(group, seg2, path, cutColor);
        }

        pos += dashPt + gapPt;
    }
}

function executar(dash, gap, corte) {
    try {
        if (app.documents.length === 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) return "Selecione o(s) objeto(s) antes de executar.";

        if (isNaN(dash) || dash <= 0 || isNaN(gap) || gap < 0) return "Digite valores numéricos válidos para o traço.";

        var dashPt = mmToPt(dash);
        var gapPt = mmToPt(gap);

        for (var i = 0; i < doc.selection.length; i++) {
            var item = doc.selection[i];
            if (item.typename !== "PathItem") continue;
            processWholePath(item, dashPt, gapPt, corte);
        }

        app.redraw();
        return "Linhas convertidas com sucesso.";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
