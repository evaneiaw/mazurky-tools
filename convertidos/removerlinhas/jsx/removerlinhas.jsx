// removerlinhas.jsx — v2.1.1
// Lógica ExtendScript da ferramenta Remover Linhas Sobrepostas
// Detecta duplicatas exatas (invariante à orientação) e segmentos colineares
// totalmente cobertos, marcando os que devem ser removidos.
// analisarDuplicadas() devolve o JSON usado pelo painel para o preview.
// Changelog v2.1.1: no Illustrator atual (30.x) as coleções do DOM lançam
//   "No such element" ao chamar .item(i); o acesso correto é por colchete
//   0-based (ex.: layers[i-1], pathPoints[i-1]). _collGet e lerPontos agora
//   usam colchete com fallback protegido para .item(i).
//   Performance: removido o cálculo de z-order por DOM (indiceFilho/posicaoZ),
//   que fazia milhões de acessos e travava o Illustrator. Agora:
//   - podeRemover() é calculado 1x por caminho (antes era chamado no laço O(n^2));
//   - a 2a passada usa bucket por bbox (evita O(n^2));
//   - segmentos colineares cobertos: remove o mais curto (spatialmente correto),
//     sem depender da ordem de empilhamento.

function _collGet(coll, i) {
    if (coll === null || coll === undefined) return null;
    try {
        var el = coll[i - 1];
        if (el) return el;
    } catch (e) {}
    try {
        return coll.item(i);
    } catch (e2) {}
    return null;
}

function _collLen(coll) {
    if (coll && typeof coll.length === "number") return coll.length;
    return 0;
}

function coletarCaminhos(container, arr) {
    var pi = container.pathItems;
    for (var i = 1; i <= _collLen(pi); i++) {
        arr.push({ item: _collGet(pi, i), emCompound: false, compound: null });
    }
    var cpi = container.compoundPathItems;
    for (var i = 1; i <= _collLen(cpi); i++) {
        var cp = _collGet(cpi, i);
        var cpPi = cp.pathItems;
        for (var j = 1; j <= _collLen(cpPi); j++) {
            arr.push({ item: _collGet(cpPi, j), emCompound: true, compound: cp });
        }
    }
    var gi = container.groupItems;
    for (var i = 1; i <= _collLen(gi); i++) {
        coletarCaminhos(_collGet(gi, i), arr);
    }
    try {
        var ly = container.layers;
        if (ly) {
            for (var i = 1; i <= _collLen(ly); i++) {
                var sub = _collGet(ly, i);
                if (!sub.locked && sub.visible) coletarCaminhos(sub, arr);
            }
        }
    } catch (e) {}
}

function lerPontos(path) {
    var pts = [];
    var pp = path.pathPoints;
    for (var i = 1; i <= pp.length; i++) {
        var p = pp[i - 1];
        pts.push({
            a: [p.anchor[0], p.anchor[1]],
            l: [p.leftDirection[0], p.leftDirection[1]],
            r: [p.rightDirection[0], p.rightDirection[1]]
        });
    }
    return pts;
}

function toleranciaPorUnidade(doc) {
    try {
        var u = doc.rulerUnits;
        switch (u) {
            case RulerUnits.Millimeters:
                return new UnitValue(0.02, "mm").as("pt");
            case RulerUnits.Centimeters:
                return new UnitValue(0.005, "cm").as("pt");
            case RulerUnits.Inches:
                return new UnitValue(0.0008, "in").as("pt");
            case RulerUnits.Points:
                return 0.02;
            default:
                return 0.05;
        }
    } catch (e) {
        return 0.05;
    }
}

function chaveCaminho(pontos, fechado, tol) {
    if (!pontos || pontos.length === 0) return null;
    var n = pontos.length;
    var round = function (v) { return Math.round(v / tol) * tol; };

    function norm(p) {
        var a = p.a, l = p.l, r = p.r;
        var la = Math.abs(l[0] - a[0]) <= tol && Math.abs(l[1] - a[1]) <= tol;
        var ra = Math.abs(r[0] - a[0]) <= tol && Math.abs(r[1] - a[1]) <= tol;
        return {
            a: [round(a[0]), round(a[1])],
            l: la ? [0, 0] : [round(l[0] - a[0]), round(l[1] - a[1])],
            r: ra ? [0, 0] : [round(r[0] - a[0]), round(r[1] - a[1])]
        };
    }

    var forward = [];
    for (var i = 0; i < n; i++) forward.push(norm(pontos[i]));

    var reverse = [];
    for (var i = n - 1; i >= 0; i--) {
        var p = norm(pontos[i]);
        reverse.push({ a: p.a, l: [-p.r[0], -p.r[1]], r: [-p.l[0], -p.l[1]] });
    }

    function str(points) {
        var s = (fechado ? "C" : "O") + "|" + n + "|";
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            s += "A" + p.a[0] + "," + p.a[1] + "|L" + p.l[0] + "," + p.l[1] + "|R" + p.r[0] + "," + p.r[1] + "|";
        }
        return s;
    }

    var sF = str(forward);
    var sR = str(reverse);
    return (sF <= sR) ? sF : sR;
}

function podeRemover(c) {
    var it = c.item;
    return !(it.locked || it.hidden || it.guides || it.clipping);
}

function pontosIguais(c1, c2, tol) {
    var p1 = c1.pontos, p2 = c2.pontos;
    if (c1.fechado !== c2.fechado) return false;

    if (p1.length === p2.length) {
        var n = p1.length;
        var ok = true;
        for (var i = 0; i < n; i++) {
            if (Math.abs(p1[i].a[0] - p2[i].a[0]) > tol || Math.abs(p1[i].a[1] - p2[i].a[1]) > tol) {
                ok = false; break;
            }
        }
        if (ok) return true;
        if (!c1.fechado) {
            ok = true;
            for (var i = 0; i < n; i++) {
                if (Math.abs(p1[i].a[0] - p2[n - 1 - i].a[0]) > tol || Math.abs(p1[i].a[1] - p2[n - 1 - i].a[1]) > tol) {
                    ok = false; break;
                }
            }
            if (ok) return true;
        }
    }

    if (c1.fechado || c2.fechado) return false;
    if (p1.length < 2 || p2.length < 2) return false;

    function extremos(pts) {
        return { ax: pts[0].a[0], ay: pts[0].a[1], bx: pts[pts.length - 1].a[0], by: pts[pts.length - 1].a[1] };
    }
    function bbox(pts) {
        var mnx = 1e15, mny = 1e15, mxx = -1e15, mxy = -1e15;
        for (var i = 0; i < pts.length; i++) {
            if (pts[i].a[0] < mnx) mnx = pts[i].a[0];
            if (pts[i].a[1] < mny) mny = pts[i].a[1];
            if (pts[i].a[0] > mxx) mxx = pts[i].a[0];
            if (pts[i].a[1] > mxy) mxy = pts[i].a[1];
        }
        return { mnx: mnx, mny: mny, mxx: mxx, mxy: mxy };
    }
    function extremosProx(e1, e2, t) {
        var d1 = Math.abs(e1.ax - e2.ax) + Math.abs(e1.ay - e2.ay);
        var d2 = Math.abs(e1.ax - e2.bx) + Math.abs(e1.ay - e2.by);
        if (d1 <= t * 2 && Math.abs(e1.bx - e2.bx) + Math.abs(e1.by - e2.by) <= t * 2) return true;
        if (d2 <= t * 2 && Math.abs(e1.bx - e2.ax) + Math.abs(e1.by - e2.ay) <= t * 2) return true;
        return false;
    }

    var e1 = extremos(p1), e2 = extremos(p2);
    var b1 = bbox(p1), b2 = bbox(p2);
    var bt = tol * 4;
    var bboxOk = Math.abs(b1.mnx - b2.mnx) <= bt && Math.abs(b1.mny - b2.mny) <= bt &&
                 Math.abs(b1.mxx - b2.mxx) <= bt && Math.abs(b1.mxy - b2.mxy) <= bt;

    if (bboxOk && extremosProx(e1, e2, tol)) return true;

    if (!bboxOk) return false;

    function isReta(pts) {
        var n = pts.length;
        if (n < 2) return false;
        var ax = pts[0].a[0], ay = pts[0].a[1];
        var bx = pts[n - 1].a[0], by = pts[n - 1].a[1];
        var dx = bx - ax, dy = by - ay;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1e-9) return false;
        var nx = -dy / len, ny = dx / len;
        for (var i = 1; i < n - 1; i++) {
            var d = Math.abs(nx * (pts[i].a[0] - ax) + ny * (pts[i].a[1] - ay));
            if (d > tol) return false;
        }
        return true;
    }

    if (isReta(p1) && isReta(p2)) {
        if (extremosProx(e1, e2, tol)) return true;
    }

    return false;
}

// Linha normalizada (canônica) para um caminho aberto e reto (ou quase reto).
// Aceita paths com handles de controle levemente arredondados (divergência <= tol),
// desde que os pontos âncora estejam colineares.
function retaLinha(pontos, tol) {
    var n = pontos.length;
    if (n < 2) return null;

    // Filtra apenas os pontos âncora (ignora handles de controle).
    var anc = [];
    for (var i = 0; i < n; i++) {
        anc.push(pontos[i].a);
    }

    // Pula âncoras duplicadas (tolerância).
    var p0 = anc[0];
    var i1 = 1;
    while (i1 < n && Math.abs(anc[i1][0] - p0[0]) <= tol && Math.abs(anc[i1][1] - p0[1]) <= tol) i1++;
    if (i1 >= n) return null;

    var p1 = anc[i1];
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return null;
    var ux = dx / len, uy = dy / len;
    if (ux < 0 || (Math.abs(ux) < 1e-12 && uy < 0)) { ux = -ux; uy = -uy; }
    var nx = -uy, ny = ux;
    var off = nx * p0[0] + ny * p0[1];

    var tMin = 1e15, tMax = -1e15;
    for (var i = 0; i < n; i++) {
        var a = anc[i];
        var d = Math.abs(nx * a[0] + ny * a[1] - off);
        if (d > tol) return null;
        var t = ux * a[0] + uy * a[1];
        if (t < tMin) tMin = t;
        if (t > tMax) tMax = t;
    }

    var r3 = function (v) { return Math.round(v * 1000) / 1000; };
    var chaveDir = r3(ux) + "," + r3(uy);
    return { chaveDir: chaveDir, ux: ux, uy: uy, off: off, tMin: tMin, tMax: tMax };
}

// Um segmento (menor) está coberto por outro (maior) se os extremos estiverem
// dentro da tolerância perpendicular (proporcional à espessura do traço) e a
// projeção sobre a linha do maior estiver totalmente dentro do intervalo dele.
function cobertoPor(maior, menor, tol) {
    var u = maior.ux, v = maior.uy;
    var nx = -v, ny = u;
    var off = maior.off;
    var perpTol = Math.min(1.5, Math.max(tol, (menor.item.strokeWidth || 0.5) / 2 + tol));
    var a0 = menor.pontos[0].a;
    var a1 = menor.pontos[menor.pontos.length - 1].a;
    if (Math.abs(nx * a0[0] + ny * a0[1] - off) > perpTol) return false;
    if (Math.abs(nx * a1[0] + ny * a1[1] - off) > perpTol) return false;
    var t0 = u * a0[0] + v * a0[1];
    var t1 = u * a1[0] + v * a1[1];
    var tM = Math.min(t0, t1), tX = Math.max(t0, t1);
    return tM >= maior.tMin - tol && tX <= maior.tMax + tol;
}

function marcarColineares(caminhos, tol) {
    var grupos = {};
    for (var i = 0; i < caminhos.length; i++) {
        var c = caminhos[i];
        if (c.duplicada || c.fechado || c.pontos.length < 2) continue;
        if (!c.removivel) continue;
        var linha = retaLinha(c.pontos, tol);
        if (!linha) continue;
        c.linha = linha;
        if (!grupos[linha.chaveDir]) grupos[linha.chaveDir] = [];
        grupos[linha.chaveDir].push(i);
    }

    for (var gk in grupos) {
        var g = grupos[gk];
        g.sort(function (a, b) {
            return (caminhos[b].linha.tMax - caminhos[b].linha.tMin) - (caminhos[a].linha.tMax - caminhos[a].linha.tMin);
        });
        for (var i = 1; i < g.length; i++) {
            var ci = caminhos[g[i]];
            if (ci.duplicada) continue;
            for (var j = 0; j < i; j++) {
                var cj = caminhos[g[j]];
                if (cj.duplicada) continue;
                if (cj.linha.tMin > ci.linha.tMin + tol || cj.linha.tMax < ci.linha.tMax - tol) continue;
                if (cobertoPor(cj.linha, ci, tol)) {
                    ci.duplicada = true;
                    break;
                }
            }
        }
    }
}

function detectarDuplicadas(doc, tol) {
    var coletados = [];
    var _dbg = "layers=" + _collLen(doc.layers) + " ";
    var layers = doc.layers;
    for (var l = 1; l <= _collLen(layers); l++) {
        var layer = _collGet(layers, l);
        if (layer.locked || !layer.visible) continue;
        var antes = coletados.length;
        coletarCaminhos(layer, coletados);
        _dbg += "L" + l + "=" + (coletados.length - antes) + " ";
    }

    if (coletados.length === 0) {
        _dbg += "fallback-doc ";
        coletarCaminhos(doc, coletados);
        _dbg += "doc=" + coletados.length + " ";
    }

    var seenItems = {};
    var caminhos = [];
    var _skipId = 0, _skipHidden = 0, _skipNoPt = 0;
    for (var i = 0; i < coletados.length; i++) {
        var item = coletados[i].item;
        if (item.hidden || item.guides) { _skipHidden++; continue; }
        var itemId;
        try { itemId = item.id; } catch (e) { itemId = undefined; }
        if (itemId !== undefined) {
            if (seenItems[itemId]) { _skipId++; continue; }
            seenItems[itemId] = true;
        }
        var pts;
        try { pts = lerPontos(item); } catch (e) { _skipNoPt++; continue; }
        var fechado = !!item.closed;
        caminhos.push({ item: item, fechado: fechado, pontos: pts, duplicada: false, arrInfo: coletados[i], removivel: podeRemover({ item: item }) });
    }
    _dbg += "caminhos=" + caminhos.length + " skipH=" + _skipHidden + " skipId=" + _skipId + " skipPt=" + _skipNoPt;

    var seen = {};
    for (var i = 0; i < caminhos.length; i++) {
        var c = caminhos[i];
        if (!c.removivel) continue;
        var key = chaveCaminho(c.pontos, c.fechado, tol);
        if (!key) continue;
        if (seen[key] !== undefined) {
            c.duplicada = true;
        } else {
            seen[key] = i;
        }
    }

    // Segunda passada: comparação direta de âncoras, com bucket por bbox para
    // não virar O(n^2) (e travar) em documentos grandes.
    // Detecta paths com handles diferentes mas mesmos pontos âncora
    // (chaveCaminho pode falhar por causa de handles ligeiramente diferentes).
    var _bt = tol * 4;
    var _buckets = {};
    for (var i = 0; i < caminhos.length; i++) {
        var ci = caminhos[i];
        if (ci.duplicada || !ci.removivel) continue;
        var bbx0 = 1e15, bby0 = 1e15, bbx1 = -1e15, bby1 = -1e15;
        for (var p = 0; p < ci.pontos.length; p++) {
            var ax = ci.pontos[p].a;
            if (ax[0] < bbx0) bbx0 = ax[0];
            if (ax[0] > bbx1) bbx1 = ax[0];
            if (ax[1] < bby0) bby0 = ax[1];
            if (ax[1] > bby1) bby1 = ax[1];
        }
        var _k = Math.round(bbx0 / _bt) + "," + Math.round(bby0 / _bt) + "," + Math.round(bbx1 / _bt) + "," + Math.round(bby1 / _bt);
        var _lista = _buckets[_k] || (_buckets[_k] = []);
        for (var k = 0; k < _lista.length; k++) {
            var cj = caminhos[_lista[k]];
            if (cj.duplicada || !cj.removivel) continue;
            if (pontosIguais(ci, cj, tol)) {
                ci.duplicada = true;
                break;
            }
        }
        if (!ci.duplicada) _lista.push(i);
    }

    marcarColineares(caminhos, tol);

    var minX = 1e15, minY = 1e15, maxX = -1e15, maxY = -1e15;
    for (var i = 0; i < caminhos.length; i++) {
        var c = caminhos[i];
        for (var j = 0; j < c.pontos.length; j++) {
            var a = c.pontos[j].a;
            if (a[0] < minX) minX = a[0];
            if (a[0] > maxX) maxX = a[0];
            if (a[1] < minY) minY = a[1];
            if (a[1] > maxY) maxY = a[1];
        }
    }
    if (minX > maxX) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

    var dup = 0;
    for (var i = 0; i < caminhos.length; i++) {
        if (caminhos[i].duplicada) dup++;
    }

    return { caminhos: caminhos, limites: [minX, minY, maxX, maxY], total: caminhos.length, duplicadas: dup, _dbg: _dbg };
}

function fmt(v) {
    var n = Math.round(v * 100) / 100;
    return String(n);
}

function analisarDuplicadas() {
    try {
        if (app.documents.length === 0) return "ERRO: Nenhum documento aberto.";
        var doc = app.activeDocument;
        var tol = toleranciaPorUnidade(doc);
        var res = detectarDuplicadas(doc, tol);

        var retas = 0, fechados = 0;
        for (var i = 0; i < res.caminhos.length; i++) {
            if (res.caminhos[i].fechado) fechados++;
            if (!res.caminhos[i].fechado && res.caminhos[i].pontos.length === 2) retas++;
        }

        var dbg = res._dbg || "";
        dbg += " |tol=" + fmt(tol);
        dbg += " |dups=" + res.duplicadas;
        dbg += " |total=" + res.total;
        if (res.total > 0) {
            dbg += " |first_pts=" + res.caminhos[0].pontos.length;
            var a = res.caminhos[0].pontos[0].a;
            dbg += " |first_a=(" + fmt(a[0]) + "," + fmt(a[1]) + ")";
        }

        var partes = [];
        partes.push('"limites":[' + fmt(res.limites[0]) + "," + fmt(res.limites[1]) + "," + fmt(res.limites[2]) + "," + fmt(res.limites[3]) + "]");
        partes.push('"total":' + res.total);
        partes.push('"duplicadas":' + res.duplicadas);
        partes.push('"tol":' + fmt(tol));
        partes.push('"retas":' + retas);
        partes.push('"fechados":' + fechados);
        partes.push('"dbg":"' + dbg.replace(/"/g, '\\"') + '"');

        var arr = [];
        for (var i = 0; i < res.caminhos.length; i++) {
            var c = res.caminhos[i];
            var ptsStr = [];
            for (var j = 0; j < c.pontos.length; j++) {
                var p = c.pontos[j];
                ptsStr.push("[" + fmt(p.a[0]) + "," + fmt(p.a[1]) + "," + fmt(p.l[0]) + "," + fmt(p.l[1]) + "," + fmt(p.r[0]) + "," + fmt(p.r[1]) + "]");
            }
            arr.push('{"f":' + (c.fechado ? 1 : 0) + ',"d":' + (c.duplicada ? 1 : 0) + ',"p":[' + ptsStr.join(",") + "]}");
        }
        partes.push('"caminhos":[' + arr.join(",") + "]");
        return "{" + partes.join(",") + "}";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "ERRO: " + (e.message || String(e)) + linhaErro;
    }
}

function executar() {
    try {
        if (app.documents.length === 0) return "Nenhum documento aberto.";
        var doc = app.activeDocument;
        var tol = toleranciaPorUnidade(doc);
        var res = detectarDuplicadas(doc, tol);

        var removed = 0;
        for (var i = res.caminhos.length - 1; i >= 0; i--) {
            var c = res.caminhos[i];
            if (!c.duplicada) continue;
            try {
                if (c.arrInfo.emCompound) {
                    c.item.remove();
                    if (c.arrInfo.compound && c.arrInfo.compound.pathItems.length === 0) {
                        try { c.arrInfo.compound.remove(); } catch (e2) {}
                    }
                } else {
                    c.item.remove();
                }
                removed++;
            } catch (e) {}
        }

        app.redraw();
        return removed + " caminhos duplicados foram removidos.";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}