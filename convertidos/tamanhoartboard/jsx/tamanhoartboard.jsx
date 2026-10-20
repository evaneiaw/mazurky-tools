// tamanhoartboard.jsx — lógica ExtendScript da ferramenta Igualar Tamanho Artboards

var TA_MM = 2.834645669291339;

function taEsc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function taRound1(n) {
    return Math.round(n * 10) / 10;
}

// Retorna {"ativo":idx,"artboards":[{"index","nome","largura","altura"}]} em mm.
function listarArtboards() {
    try {
        var doc = app.activeDocument;
        if (!doc) return "ERRO:Nenhum documento aberto.";
        var artboards = doc.artboards;
        var ativo = artboards.getActiveArtboardIndex();
        var partes = [];
        for (var i = 0; i < artboards.length; i++) {
            var r = artboards[i].artboardRect;
            var largura = Math.abs(r[2] - r[0]) / TA_MM;
            var altura = Math.abs(r[1] - r[3]) / TA_MM;
            partes.push('{"index":' + i +
                ',"nome":"' + taEsc(artboards[i].name) + '"' +
                ',"largura":' + taRound1(largura) +
                ',"altura":' + taRound1(altura) + '}');
        }
        return '{"ativo":' + ativo + ',"artboards":[' + partes.join(",") + ']}';
    } catch (e) {
        return "ERRO:" + (e.message || String(e));
    }
}

function executar(reorganizar, colunas, gapMM) {
    try {
        var doc = app.activeDocument;
        if (!doc) {
            return "Nenhum documento aberto.";
        }

        var artboards = doc.artboards;
        var total = artboards.length;

        if (total < 2) {
            return "O documento possui apenas uma artboard.";
        }

        var activeIdx = artboards.getActiveArtboardIndex();
        var sourceRect = artboards[activeIdx].artboardRect;
        var w = sourceRect[2] - sourceRect[0];
        var h = sourceRect[1] - sourceRect[3];

        if (w <= 0 || h <= 0) {
            return "Dimensões inválidas na artboard selecionada.";
        }

        // 1) Iguala o tamanho de todas ao da ativa, mantendo o centro.
        for (var i = 0; i < total; i++) {
            if (i === activeIdx) continue;
            var r = artboards[i].artboardRect;
            var cx = (r[0] + r[2]) / 2;
            var cy = (r[1] + r[3]) / 2;
            artboards[i].artboardRect = [
                cx - w / 2,
                cy + h / 2,
                cx + w / 2,
                cy - h / 2
            ];
        }

        // 2) Reorganiza em grade, mantendo a ativa na posicao atual (celula 0).
        if (reorganizar) {
            var cols = parseInt(colunas, 10);
            if (isNaN(cols) || cols < 1) cols = 4;
            var gap = parseFloat(gapMM);
            if (isNaN(gap) || gap < 0) gap = 20;
            var gapPt = gap * TA_MM;

            var ax0 = sourceRect[0];
            var ay0 = sourceRect[1];
            var cellW = w + gapPt;
            var cellH = h + gapPt;

            var cell = 1;
            for (var j = 0; j < total; j++) {
                if (j === activeIdx) continue;
                var col = cell % cols;
                var lin = Math.floor(cell / cols);
                var x0 = ax0 + col * cellW;
                var yTop = ay0 - lin * cellH;
                artboards[j].artboardRect = [x0, yTop, x0 + w, yTop - h];
                cell++;
            }
        }

        app.redraw();
        return reorganizar
            ? "Tamanhos igualados e artboards reorganizadas em grade (" + cols + " colunas)."
            : "Tamanho das artboards igualado com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
