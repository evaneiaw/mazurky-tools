// fecharobjetos.jsx — lógica ExtendScript da ferramenta Fechar Objetos

function caminhoConfig() {
    return Folder.appData + "/Adobe/FecharObjetos.config";
}

function salvarConfig(obj) {
    try {
        var f = new File(caminhoConfig());
        f.open("w");
        f.writeln("tolX=" + obj.tolX);
        f.writeln("tolY=" + obj.tolY);
        f.writeln("selfClose=" + (obj.selfClose ? "1" : "0"));
        f.writeln("merge=" + (obj.merge ? "1" : "0"));
        f.writeln("preservar=" + (obj.preservar ? "1" : "0"));
        f.close();
    } catch (e) {}
}

function carregarConfig() {
    try {
        var f = new File(caminhoConfig());
        if (!f.exists) return null;
        f.open("r");
        var cfg = {};
        while (!f.eof) {
            var linha = f.readln();
            var eq = linha.indexOf("=");
            if (eq > 0) {
                var chave = linha.substring(0, eq);
                var val = linha.substring(eq + 1);
                if (chave === "tolX" || chave === "tolY") cfg[chave] = parseFloat(val);
                else if (chave === "selfClose" || chave === "merge" || chave === "preservar") cfg[chave] = (val === "1");
            }
        }
        f.close();
        return cfg;
    } catch (e) { return null; }
}

function coletarPaths(items, resultado) {
    for (var i = 0; i < items.length; i++) {
        var it;
        try {
            it = items[i];
        } catch (e) {
            continue;
        }
        if (!it) continue;

        var tn;
        try { tn = it.typename; } catch (e) { continue; }

        if (tn === "PathItem") {
            resultado.push(it);
        } else if (tn === "GroupItem") {
            coletarPaths(it.pageItems, resultado);
        } else if (tn === "CompoundPathItem") {
            coletarPaths(it.pathItems, resultado);
        }
    }
}

function coletarPathsAbertos() {
    var todos = [];
    coletarPaths(app.activeDocument.selection, todos);
    var abertos = [];
    for (var i = 0; i < todos.length; i++) {
        var p = todos[i];
        try {
            if (!p.closed && p.pathPoints.length >= 2) {
                abertos.push(p);
            }
        } catch (e) {}
    }
    return abertos;
}

function dentroTolerancia(p1, p2, tolX, tolY) {
    return Math.abs(p1[0] - p2[0]) <= tolX && Math.abs(p1[1] - p2[1]) <= tolY;
}

function mediaPonto(p1, p2) {
    return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

function somaVetor(p, delta) {
    return [p[0] + delta[0], p[1] + delta[1]];
}

function deltaVetor(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}

function clonarPontos(pathItem) {
    var pts = [];
    var pp = pathItem.pathPoints;
    for (var i = 0; i < pp.length; i++) {
        pts.push({
            anchor: [pp[i].anchor[0], pp[i].anchor[1]],
            left: [pp[i].leftDirection[0], pp[i].leftDirection[1]],
            right: [pp[i].rightDirection[0], pp[i].rightDirection[1]],
            type: pp[i].pointType
        });
    }
    return pts;
}

function inverterPontos(pts) {
    var novo = [];
    for (var i = pts.length - 1; i >= 0; i--) {
        var p = pts[i];
        novo.push({
            anchor: [p.anchor[0], p.anchor[1]],
            left: [p.right[0], p.right[1]],
            right: [p.left[0], p.left[1]],
            type: p.type
        });
    }
    return novo;
}

function escreverPontos(pathItem, pts, closed) {
    while (pathItem.pathPoints.length > pts.length) {
        pathItem.pathPoints[pathItem.pathPoints.length - 1].remove();
    }
    while (pathItem.pathPoints.length < pts.length) {
        pathItem.pathPoints.add();
    }
    for (var i = 0; i < pts.length; i++) {
        var pp = pathItem.pathPoints[i];
        pp.anchor = pts[i].anchor;
        pp.leftDirection = pts[i].left;
        pp.rightDirection = pts[i].right;
        pp.pointType = pts[i].type;
    }
    pathItem.closed = closed;
}

function fecharPathUnico(pathItem, tolX, tolY) {
    var pp = pathItem.pathPoints;
    var n = pp.length;
    if (n < 2) return false;

    var pFirst = [pp[0].anchor[0], pp[0].anchor[1]];
    var pLast = [pp[n - 1].anchor[0], pp[n - 1].anchor[1]];

    if (!dentroTolerancia(pFirst, pLast, tolX, tolY)) return false;

    var pts = clonarPontos(pathItem);
    var avg = mediaPonto(pFirst, pLast);
    var deltaFirst = deltaVetor(avg, pFirst);
    var deltaLast = deltaVetor(avg, pLast);

    var mergedPoint = {
        anchor: avg,
        left: somaVetor(pts[n - 1].left, deltaLast),
        right: somaVetor(pts[0].right, deltaFirst),
        type: PointType.SMOOTH
    };

    var novosPontos = [mergedPoint];
    for (var i = 1; i < n - 1; i++) {
        novosPontos.push(pts[i]);
    }

    escreverPontos(pathItem, novosPontos, true);
    return true;
}

function unirPaths(pathA, pathB, tolX, tolY) {
    var ppA = pathA.pathPoints;
    var ppB = pathB.pathPoints;
    if (ppA.length < 2 || ppB.length < 2) return false;

    var startA = [ppA[0].anchor[0], ppA[0].anchor[1]];
    var endA = [ppA[ppA.length - 1].anchor[0], ppA[ppA.length - 1].anchor[1]];
    var startB = [ppB[0].anchor[0], ppB[0].anchor[1]];
    var endB = [ppB[ppB.length - 1].anchor[0], ppB[ppB.length - 1].anchor[1]];

    var modo = null;
    if (dentroTolerancia(endA, startB, tolX, tolY)) modo = "endA-startB";
    else if (dentroTolerancia(endA, endB, tolX, tolY)) modo = "endA-endB";
    else if (dentroTolerancia(startA, startB, tolX, tolY)) modo = "startA-startB";
    else if (dentroTolerancia(startA, endB, tolX, tolY)) modo = "startA-endB";
    else return false;

    var A = clonarPontos(pathA);
    var B = clonarPontos(pathB);

    if (modo === "endA-endB") {
        B = inverterPontos(B);
    } else if (modo === "startA-startB") {
        A = inverterPontos(A);
    } else if (modo === "startA-endB") {
        A = inverterPontos(A);
        B = inverterPontos(B);
    }

    var lastA = A[A.length - 1];
    var firstB = B[0];
    var avg = mediaPonto(lastA.anchor, firstB.anchor);
    var deltaA = deltaVetor(avg, lastA.anchor);
    var deltaB = deltaVetor(avg, firstB.anchor);

    var mergedPoint = {
        anchor: avg,
        left: somaVetor(lastA.left, deltaA),
        right: somaVetor(firstB.right, deltaB),
        type: PointType.SMOOTH
    };

    var novosPontos = [];
    for (var i = 0; i < A.length - 1; i++) novosPontos.push(A[i]);
    novosPontos.push(mergedPoint);
    for (var j = 1; j < B.length; j++) novosPontos.push(B[j]);

    escreverPontos(pathA, novosPontos, false);

    try { pathB.remove(); } catch (e) {}

    return true;
}

function fecharPathUnicoPreservando(pathItem, tolX, tolY) {
    var pp = pathItem.pathPoints;
    var n = pp.length;
    if (n < 2) return false;

    var pFirst = [pp[0].anchor[0], pp[0].anchor[1]];
    var pLast = [pp[n - 1].anchor[0], pp[n - 1].anchor[1]];

    if (!dentroTolerancia(pFirst, pLast, tolX, tolY)) return false;

    pathItem.closed = true;
    return true;
}

function unirPathsPreservando(pathA, pathB, tolX, tolY) {
    var ppA = pathA.pathPoints;
    var ppB = pathB.pathPoints;
    if (ppA.length < 2 || ppB.length < 2) return false;

    var startA = [ppA[0].anchor[0], ppA[0].anchor[1]];
    var endA = [ppA[ppA.length - 1].anchor[0], ppA[ppA.length - 1].anchor[1]];
    var startB = [ppB[0].anchor[0], ppB[0].anchor[1]];
    var endB = [ppB[ppB.length - 1].anchor[0], ppB[ppB.length - 1].anchor[1]];

    var modo = null;
    if (dentroTolerancia(endA, startB, tolX, tolY)) modo = "endA-startB";
    else if (dentroTolerancia(endA, endB, tolX, tolY)) modo = "endA-endB";
    else if (dentroTolerancia(startA, startB, tolX, tolY)) modo = "startA-startB";
    else if (dentroTolerancia(startA, endB, tolX, tolY)) modo = "startA-endB";
    else return false;

    var A = clonarPontos(pathA);
    var B = clonarPontos(pathB);

    if (modo === "endA-endB") {
        B = inverterPontos(B);
    } else if (modo === "startA-startB") {
        A = inverterPontos(A);
    } else if (modo === "startA-endB") {
        A = inverterPontos(A);
        B = inverterPontos(B);
    }

    A[A.length - 1].right = A[A.length - 1].anchor;
    B[0].left = B[0].anchor;

    var novosPontos = A.concat(B);

    escreverPontos(pathA, novosPontos, false);
    try { pathB.remove(); } catch (e) {}

    return true;
}

function contarParesProximos(abertos, tolX, tolY) {
    var count = 0;
    var n = abertos.length;
    for (var i = 0; i < n; i++) {
        var pi = abertos[i];
        if (pi.pathPoints.length < 2) continue;
        var startI = [pi.pathPoints[0].anchor[0], pi.pathPoints[0].anchor[1]];
        var endI = [pi.pathPoints[pi.pathPoints.length - 1].anchor[0], pi.pathPoints[pi.pathPoints.length - 1].anchor[1]];

        if (dentroTolerancia(startI, endI, tolX, tolY)) count++;

        for (var j = i + 1; j < n; j++) {
            var pj = abertos[j];
            if (pj.pathPoints.length < 2) continue;
            var startJ = [pj.pathPoints[0].anchor[0], pj.pathPoints[0].anchor[1]];
            var endJ = [pj.pathPoints[pj.pathPoints.length - 1].anchor[0], pj.pathPoints[pj.pathPoints.length - 1].anchor[1]];

            if (dentroTolerancia(endI, startJ, tolX, tolY) ||
                dentroTolerancia(endI, endJ, tolX, tolY) ||
                dentroTolerancia(startI, startJ, tolX, tolY) ||
                dentroTolerancia(startI, endJ, tolX, tolY)) {
                count++;
            }
        }
    }
    return count;
}

function processar(opcoes) {
    var maxIteracoes = 500;
    var iter = 0;
    var totalUnioes = 0;
    var totalFechamentos = 0;

    while (iter < maxIteracoes) {
        iter++;
        var abertos = coletarPathsAbertos();
        var fezAlgo = false;

        if (opcoes.selfClose) {
            for (var i = 0; i < abertos.length; i++) {
                try {
                    var fnSC = opcoes.preservar ? fecharPathUnicoPreservando : fecharPathUnico;
                    if (fnSC(abertos[i], opcoes.tolX, opcoes.tolY)) {
                        totalFechamentos++;
                        fezAlgo = true;
                        break;
                    }
                } catch (e) {}
            }
            if (fezAlgo) continue;
        }

        if (opcoes.merge) {
            var achouPar = false;
            var fnUnir = opcoes.preservar ? unirPathsPreservando : unirPaths;
            for (var a = 0; a < abertos.length && !achouPar; a++) {
                for (var b = a + 1; b < abertos.length; b++) {
                    try {
                        if (fnUnir(abertos[a], abertos[b], opcoes.tolX, opcoes.tolY)) {
                            totalUnioes++;
                            fezAlgo = true;
                            achouPar = true;
                            break;
                        }
                    } catch (e) {}
                }
            }
        }

        if (!fezAlgo) break;
    }

    return { iteracoes: iter, unioes: totalUnioes, fechamentos: totalFechamentos };
}

function diagnosticar(tolX, tolY) {
    try {
        if (app.documents.length === 0) return "Nenhum documento aberto.";
        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) return "Selecione o(s) objeto(s) antes de executar.";
        if (isNaN(tolX) || tolX < 0) tolX = 2;
        if (isNaN(tolY) || tolY < 0) tolY = 2;
        var abertos = coletarPathsAbertos();
        var qtdPares = contarParesProximos(abertos, tolX, tolY);
        return "Paths abertos encontrados: " + abertos.length + ". Pares próximos (X=" + tolX + ", Y=" + tolY + "): " + qtdPares;
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function executar(tolX, tolY, selfClose, merge, preservar) {
    try {
        if (app.documents.length === 0) return "Nenhum documento aberto.";
        var doc = app.activeDocument;
        if (!doc.selection || doc.selection.length === 0) return "Selecione o(s) objeto(s) antes de executar.";

        if (isNaN(tolX) || tolX < 0) {
            var cfgX = carregarConfig();
            tolX = (cfgX && !isNaN(cfgX.tolX)) ? cfgX.tolX : 2;
        }
        if (isNaN(tolY) || tolY < 0) {
            var cfgY = carregarConfig();
            tolY = (cfgY && !isNaN(cfgY.tolY)) ? cfgY.tolY : 2;
        }
        selfClose = !!selfClose;
        merge = !!merge;
        preservar = !!preservar;

        var opcoes = {
            tolX: tolX,
            tolY: tolY,
            selfClose: selfClose,
            merge: merge,
            preservar: preservar
        };
        salvarConfig(opcoes);

        var res = processar(opcoes);

        var modo = opcoes.preservar ? "Forma preservada (segmento reto)" : "Fusão (midpoint)";

        return "Concluído.\n" +
            "Modo: " + modo + "\n" +
            "Iterações: " + res.iteracoes + "\n" +
            "Fechamentos (self-close): " + res.fechamentos + "\n" +
            "Uniões de paths: " + res.unioes;
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
