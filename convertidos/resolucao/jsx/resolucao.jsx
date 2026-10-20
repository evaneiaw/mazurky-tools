// resolucao.jsx — lógica ExtendScript da ferramenta Diminuir Resolução Imagens

function executar(dpi) {
    try {
        if (app.documents.length == 0) return "Nenhum documento aberto.";

        var doc = app.activeDocument;
        var rasterItems = doc.rasterItems;

        if (rasterItems.length == 0) return "Nenhum item raster encontrado no documento.";

        var targetDPI = parseFloat(dpi);
        if (isNaN(targetDPI) || targetDPI <= 0) return "Por favor, insira um valor válido para DPI.";

        var erros = [];

        for (var i = 0; i < rasterItems.length; i++) {
            var raster = rasterItems[i];

            if (!raster.clipped) {
                try {
                    var originalWidth = raster.width;
                    var originalHeight = raster.height;

                    var rasterOptions = new RasterizeOptions();
                    rasterOptions.resolution = targetDPI;
                    rasterOptions.transparency = true;
                    rasterOptions.antiAliasing = AntiAliasingMethod.ARTOPTIMIZED;
                    rasterOptions.clippingMask = false;
                    rasterOptions.convertSpotColors = false;

                    var rasterizedItem = doc.rasterize(raster, raster.geometricBounds, rasterOptions);

                    rasterizedItem.width = originalWidth;
                    rasterizedItem.height = originalHeight;

                } catch (e) {
                    erros.push("imagem " + i + ": " + (e.message || String(e)));
                }
            }
        }

        app.redraw();

        if (erros.length > 0) {
            return "Resolução das imagens ajustada para " + targetDPI + " DPI. Avisos: " + erros.join("; ");
        }
        return "Resolução das imagens ajustada para " + targetDPI + " DPI com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
