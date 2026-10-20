// tiler.jsx — lógica ExtendScript da ferramenta Tiler

function executar(larguraTileMM, alturaTileMM, espacamentoXMM, espacamentoYMM, numColunas, numLinhas) {
    try {
        if (app.documents.length === 0) {
            return "Nenhum documento aberto.";
        }
        var doc = app.activeDocument;

        if (!doc.selection || doc.selection.length === 0) {
            return "Selecione o(s) objeto(s) antes de executar.";
        }

        var mmParaPontos = 2.83465;
        var larguraTilePts = larguraTileMM * mmParaPontos;
        var alturaTilePts = alturaTileMM * mmParaPontos;
        var espacamentoXPts = espacamentoXMM * mmParaPontos;
        var espacamentoYPts = espacamentoYMM * mmParaPontos;

        var objetoBase = doc.selection[0];

        if (!objetoBase) {
            return "Selecione um objeto para usar como base do tile.";
        }

        objetoBase.remove();

        var totalCriados = 0;
        for (var linha = 0; linha < numLinhas; linha++) {
            for (var coluna = 0; coluna < numColunas; coluna++) {
                var x = coluna * (larguraTilePts + espacamentoXPts);
                var y = linha * (alturaTilePts + espacamentoYPts);

                var novoTile = objetoBase.duplicate();

                novoTile.position = [x, -y];

                totalCriados++;
            }
        }

        app.redraw();
        return "Tiles criados com sucesso! Total: " + totalCriados;
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
