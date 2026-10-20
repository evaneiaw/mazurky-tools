// diagnostico.jsx — Lista todas as coordenadas de paths no documento ativo
// Execute no Illustrator: File > Scripts > Other Script > diagnostico.jsx
// O resultado é salvo em C:\Users\user\Desktop\diagnostico_log.txt

(function () {
    if (app.documents.length === 0) { alert("Nenhum documento aberto."); return; }
    var doc = app.activeDocument;
    var log = [];
    log.push("=== DIAGNÓSTICO DE PATHS ===");
    log.push("Documento: " + doc.name);
    log.push("Layers: " + doc.layers.length);
    log.push("");

    function lerPontos(item) {
        var pts = [];
        for (var i = 0; i < item.pathPoints.length; i++) {
            var p = item.pathPoints[i];
            pts.push({
                a: [Math.round(p.anchor[0] * 100) / 100, Math.round(p.anchor[1] * 100) / 100],
                l: [Math.round(p.leftDirection[0] * 100) / 100, Math.round(p.leftDirection[1] * 100) / 100],
                r: [Math.round(p.rightDirection[0] * 100) / 100, Math.round(p.rightDirection[1] * 100) / 100]
            });
        }
        return pts;
    }

    function coletar(container, arr, depth) {
        for (var i = 0; i < container.pathItems.length; i++) {
            var item = container.pathItems[i];
            if (item.hidden || item.guides) continue;
            var pts = lerPontos(item);
            var minX = 1e15, minY = 1e15, maxX = -1e15, maxY = -1e15;
            for (var j = 0; j < pts.length; j++) {
                if (pts[j].a[0] < minX) minX = pts[j].a[0];
                if (pts[j].a[1] < minY) minY = pts[j].a[1];
                if (pts[j].a[0] > maxX) maxX = pts[j].a[0];
                if (pts[j].a[1] > maxY) maxY = pts[j].a[1];
            }
            arr.push({
                item: item,
                depth: depth,
                pts: pts,
                closed: item.closed,
                stroke: item.stroked ? (item.strokeWidth + "pt " + item.strokeColor.typename) : "none",
                bounds: [minX, minY, maxX, maxY]
            });
        }
        for (var i = 0; i < container.compoundPathItems.length; i++) {
            var cp = container.compoundPathItems[i];
            for (var j = 0; j < cp.pathItems.length; j++) {
                var item = cp.pathItems[j];
                if (item.hidden || item.guides) continue;
                var pts = lerPontos(item);
                arr.push({ item: item, depth: depth + 1, pts: pts, closed: item.closed, stroke: item.stroked ? item.strokeWidth + "pt" : "none", bounds: [0, 0, 0, 0] });
            }
        }
        for (var i = 0; i < container.groupItems.length; i++) {
            coletar(container.groupItems[i], arr, depth + 1);
        }
    }

    var allPaths = [];
    for (var l = 0; l < doc.layers.length; l++) {
        var layer = doc.layers[l];
        log.push("Layer " + l + ": '" + layer.name + "' (locked=" + layer.locked + ", visible=" + layer.visible + ")");
        if (layer.locked || !layer.visible) continue;
        var antes = allPaths.length;
        coletar(layer, allPaths, 0);
        log.push("  -> " + (allPaths.length - antes) + " paths encontrados");
    }

    if (allPaths.length === 0) {
        log.push("NENHUM PATH ENCONTRADO NAS LAYERS. Tentando doc.pathItems...");
        coletar(doc, allPaths, 0);
        log.push("  -> " + allPaths.length + " paths encontrados via doc");
    }

    log.push("");
    log.push("=== TOTAL: " + allPaths.length + " paths ===");
    log.push("");

    for (var i = 0; i < allPaths.length; i++) {
        var p = allPaths[i];
        var tipo = p.closed ? "FECHADO" : (p.pts.length === 2 ? "RETA" : "CURVA");
        log.push("[" + i + "] " + tipo + " pts=" + p.pts.length + " stroke=" + p.stroke + " bounds=" + p.bounds.join(","));
        for (var j = 0; j < p.pts.length; j++) {
            log.push("  p" + j + ": anchor=" + p.pts[j].a.join(",") + " L=" + p.pts[j].l.join(",") + " R=" + p.pts[j].r.join(","));
        }
    }

    // Procura pares com bounding boxes próximos
    log.push("");
    log.push("=== PARES COM BBOX PRÓXIMO (potenciais duplicatas) ===");
    for (var i = 0; i < allPaths.length; i++) {
        for (var j = i + 1; j < allPaths.length; j++) {
            var a = allPaths[i], b = allPaths[j];
            if (a.closed !== b.closed) continue;
            var bt = 5;
            if (Math.abs(a.bounds[0] - b.bounds[0]) < bt && Math.abs(a.bounds[1] - b.bounds[1]) < bt &&
                Math.abs(a.bounds[2] - b.bounds[2]) < bt && Math.abs(a.bounds[3] - b.bounds[3]) < bt) {
                log.push("  MATCH [" + i + "] vs [" + j + "] bounds_diff=" +
                    [Math.abs(a.bounds[0] - b.bounds[0]).toFixed(2),
                     Math.abs(a.bounds[1] - b.bounds[1]).toFixed(2),
                     Math.abs(a.bounds[2] - b.bounds[2]).toFixed(2),
                     Math.abs(a.bounds[3] - b.bounds[3]).toFixed(2)].join(","));
            }
        }
    }

    var logStr = log.join("\n");
    try {
        var f = new File("C:/Users/user/Desktop/diagnostico_log.txt");
        f.open("w");
        f.write(logStr);
        f.close();
        alert("Diagnóstico salvo em Desktop/diagnostico_log.txt\nTotal de paths: " + allPaths.length);
    } catch (e) {
        alert("Erro ao salvar log: " + e.message + "\n\n" + logStr);
    }
})();
