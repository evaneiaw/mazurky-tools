// caixa-maleta.jsx - lógica ExtendScript da ferramenta Caixa Maleta
// Carregado pelo painel convertidos/caixa-maleta/caixa-maleta.html via evalScript.
// =====================================================================
// Preferências e JSON da Caixa Maleta
// =====================================================================

function salvarCaixaMaletaPrefs(coluna1, coluna2, coluna3, coluna4, abaCola,
                                linha1, linha2, linha3,
                                offset, espessura, tamanhoTexto, distanciaTexto, extensaoTotal,
                                cotas, orelhaComprimento, retanguloInvisivel, mostrarMm, meiaCaixa,
                                slotter) {
    try {
        app.preferences.setStringPreference("CaixaMaleta/coluna1", String(coluna1));
        app.preferences.setStringPreference("CaixaMaleta/coluna2", String(coluna2));
        app.preferences.setStringPreference("CaixaMaleta/coluna3", String(coluna3));
        app.preferences.setStringPreference("CaixaMaleta/coluna4", String(coluna4));
        app.preferences.setStringPreference("CaixaMaleta/abaCola", String(abaCola));
        app.preferences.setStringPreference("CaixaMaleta/linha1", String(linha1));
        app.preferences.setStringPreference("CaixaMaleta/linha2", String(linha2));
        app.preferences.setStringPreference("CaixaMaleta/linha3", String(linha3));
        app.preferences.setStringPreference("CaixaMaleta/offset", String(offset));
        app.preferences.setStringPreference("CaixaMaleta/espessura", String(espessura));
        app.preferences.setStringPreference("CaixaMaleta/tamanhoTexto", String(tamanhoTexto));
        app.preferences.setStringPreference("CaixaMaleta/distanciaTexto", String(distanciaTexto));
        app.preferences.setStringPreference("CaixaMaleta/extensaoTotal", String(extensaoTotal));
        app.preferences.setBooleanPreference("CaixaMaleta/cotas", cotas);
        app.preferences.setBooleanPreference("CaixaMaleta/orelhaComprimento", orelhaComprimento);
        app.preferences.setBooleanPreference("CaixaMaleta/retanguloInvisivel", retanguloInvisivel);
        app.preferences.setBooleanPreference("CaixaMaleta/mostrarMm", mostrarMm);
        app.preferences.setBooleanPreference("CaixaMaleta/meiaCaixa", meiaCaixa);
        app.preferences.setStringPreference("CaixaMaleta/slotter", String(slotter));
    } catch (e) {}
}

function getCaixaMaletaPrefs() {
    try {
        function nPref(k, d) {
            var v = app.preferences.getStringPreference("CaixaMaleta/" + k);
            if (!v) return d;
            var n = parseFloat(v);
            return isNaN(n) ? d : n;
        }
        function bPref(k, d) {
            var v = app.preferences.getBooleanPreference("CaixaMaleta/" + k);
            return (v === undefined) ? d : v;
        }
        var p = [];
        p.push('"coluna1":' + nPref("coluna1", 50));
        p.push('"coluna2":' + nPref("coluna2", 30));
        p.push('"coluna3":' + nPref("coluna3", 30));
        p.push('"coluna4":' + nPref("coluna4", 50));
        p.push('"abaCola":' + nPref("abaCola", 20));
        p.push('"linha1":' + nPref("linha1", 30));
        p.push('"linha2":' + nPref("linha2", 40));
        p.push('"linha3":' + nPref("linha3", 30));
        p.push('"offset":' + nPref("offset", 3));
        p.push('"espessura":' + nPref("espessura", 0.5));
        p.push('"tamanhoTexto":' + nPref("tamanhoTexto", 7));
        p.push('"distanciaTexto":' + nPref("distanciaTexto", 0));
        p.push('"extensaoTotal":' + nPref("extensaoTotal", 3));
        p.push('"cotas":' + bPref("cotas", true));
        p.push('"orelhaComprimento":' + bPref("orelhaComprimento", false));
        p.push('"retanguloInvisivel":' + bPref("retanguloInvisivel", true));
        p.push('"mostrarMm":' + bPref("mostrarMm", true));
        p.push('"meiaCaixa":' + bPref("meiaCaixa", false));
        p.push('"slotter":' + nPref("slotter", 0));
        return "{" + p.join(",") + "}";
    } catch (e) {
        return "{}";
    }
}

function lerJsonCaixaMaleta() {
    try {
        var arquivo = File.openDialog("Selecione o arquivo JSON", "*.json", false);
        if (!arquivo) return "CANCELADO";
        arquivo.open("r");
        var conteudo = arquivo.read();
        arquivo.close();

        var dados = parseJSON(conteudo);
        if (!dados) return "ERRO: arquivo JSON inválido ou mal-formado.";
        if (dados.caixa_maleta) dados = dados.caixa_maleta;

        var campos = ["coluna1", "coluna2", "coluna3", "coluna4", "abaCola", "linha1", "linha2", "linha3"];
        var partes = [];
        for (var i = 0; i < campos.length; i++) {
            var v = dados[campos[i]];
            if (v === undefined || v === null) continue;
            var n = Number(v);
            if (isNaN(n)) continue;
            partes.push('"' + campos[i] + '":' + n);
        }
        if (partes.length === 0) return "ERRO: nenhum campo válido encontrado no JSON.";
        return "{" + partes.join(",") + "}";
    } catch (e) {
        return "ERRO: " + (e.message || String(e));
    }
}

// Parser manual de JSON para ExtendScript (ES3), portado do script original.
function parseJSON(str) {
    try {
        str = str.replace(/^\s+|\s+$/g, "");
        return parseValue(str);
    } catch (e) {
        return null;
    }
}

function parseValue(str) {
    str = str.replace(/^\s+|\s+$/g, "");
    if (str.charAt(0) === "{") return parseObject(str);
    if (str.charAt(0) === "[") return parseArray(str);
    if (str.charAt(0) === '"') return str.replace(/^"|"$/g, "");
    if (str === "true") return true;
    if (str === "false") return false;
    if (str === "null") return null;
    if (!isNaN(str)) return parseFloat(str);
    return null;
}

function parseObject(str) {
    str = str.replace(/^\{/, "").replace(/\}$/, "").replace(/^\s+|\s+$/g, "");
    if (!str) return {};
    var result = {};
    var pairs = splitTopLevel(str, ",");
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].replace(/^\s+|\s+$/g, "");
        var colonIdx = pair.indexOf(":");
        if (colonIdx === -1) continue;
        var key = pair.substring(0, colonIdx).replace(/^\s*"|"\s*$/g, "").replace(/^\s+|\s+$/g, "");
        var val = pair.substring(colonIdx + 1).replace(/^\s+|\s+$/g, "");
        result[key] = parseValue(val);
    }
    return result;
}

function parseArray(str) {
    str = str.replace(/^\[/, "").replace(/\]$/, "").replace(/^\s+|\s+$/g, "");
    if (!str) return [];
    var items = splitTopLevel(str, ",");
    var result = [];
    for (var i = 0; i < items.length; i++) {
        result.push(parseValue(items[i]));
    }
    return result;
}

function splitTopLevel(str, delimiter) {
    var result = [];
    var depth = 0;
    var inString = false;
    var current = "";
    for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        if (ch === '"' && (i === 0 || str.charAt(i - 1) !== "\\")) {
            inString = !inString;
        }
        if (!inString) {
            if (ch === "{" || ch === "[") depth++;
            if (ch === "}" || ch === "]") depth--;
        }
        if (!inString && depth === 0 && ch === delimiter) {
            result.push(current);
            current = "";
        } else {
            current += ch;
        }
    }
    if (current) result.push(current);
    return result;
}

// =====================================================================
// 001 - CAIXA MALETA (convertido de ScriptUI para CEP)
// Recebe todos os valores como argumentos (números/booleans).
// Retorna string de status.
// =====================================================================
function caixaMaleta(coluna1, coluna2, coluna3, coluna4, abaCola,
                     linha1, linha2, linha3,
                     offset, espessura, tamanhoTexto, distanciaTexto, extensaoTotal,
                     cotas, orelhaComprimento, retanguloInvisivel, mostrarMm, meiaCaixa,
                     slotter) {
    var MM_PARA_PT = 2.83464567;
    var ANGULO_INCLINACAO = 15 * Math.PI / 180;

    try {
        var larguras = {
            coluna1: coluna1 * MM_PARA_PT,
            coluna2: coluna2 * MM_PARA_PT,
            coluna3: coluna3 * MM_PARA_PT,
            coluna4: coluna4 * MM_PARA_PT,
            abaCola: abaCola * MM_PARA_PT
        };
        var alturas = {
            linha1: linha1 * MM_PARA_PT,
            linha2: linha2 * MM_PARA_PT,
            linha3: linha3 * MM_PARA_PT
        };
        var configsCotas = {
            offset: offset * MM_PARA_PT,
            espessura: espessura * MM_PARA_PT,
            tamanhoTexto: tamanhoTexto,
            distanciaTexto: distanciaTexto,
            extensaoTotal: extensaoTotal * MM_PARA_PT
        };
        var slotterEsquerda = slotter * MM_PARA_PT;
        var slotterDireita = slotter * MM_PARA_PT;
        var valores = {
            larguras: larguras,
            alturas: alturas,
            configsCotas: configsCotas,
            cotas: cotas,
            orelhaComprimento: orelhaComprimento,
            retanguloInvisivel: retanguloInvisivel,
            mostrarMm: mostrarMm,
            meiaCaixa: meiaCaixa,
            slotterEsquerda: slotterEsquerda,
            slotterDireita: slotterDireita
        };

        // Validações (substituem os alerts do ScriptUI)
        for (var col in larguras) {
            if (isNaN(larguras[col]) || larguras[col] < 0 || larguras[col] > 10000 * MM_PARA_PT) {
                return "Erro: largura invalida em " + col + " (0-10000 mm).";
            }
        }
        for (var lin in alturas) {
            if (isNaN(alturas[lin]) || alturas[lin] <= 0 || alturas[lin] > 10000 * MM_PARA_PT) {
                return "Erro: altura invalida em " + lin + " (0-10000 mm).";
            }
        }
        if (cotas) {
            if (isNaN(configsCotas.offset) || configsCotas.offset < 0 || configsCotas.offset > 1000 * MM_PARA_PT) return "Erro: Offset invalido (0-1000 mm).";
            if (isNaN(configsCotas.espessura) || configsCotas.espessura <= 0 || configsCotas.espessura > 100 * MM_PARA_PT) return "Erro: Espessura invalida (0-100 mm).";
            if (isNaN(configsCotas.tamanhoTexto) || configsCotas.tamanhoTexto <= 0 || configsCotas.tamanhoTexto > 1000) return "Erro: Tamanho Texto invalido (0-1000 pt).";
            if (isNaN(configsCotas.distanciaTexto) || configsCotas.distanciaTexto < 0 || configsCotas.distanciaTexto > 1000) return "Erro: Distancia Texto invalida (0-1000 pt).";
            if (isNaN(configsCotas.extensaoTotal) || configsCotas.extensaoTotal <= 0 || configsCotas.extensaoTotal > 1000 * MM_PARA_PT) return "Erro: Tamanho Extensoes invalido (0-1000 mm).";
        }
        if (isNaN(slotter) || slotter < 0 || slotter > 1000) {
            return "Erro: Slotter invalido (0-1000 mm).";
        }

        var doc;
        try {
            doc = app.activeDocument;
            if (!doc || !doc.artboards || doc.artboards.length === 0) {
                throw new Error("sem artboard");
            }
        } catch (e) {
            var preset = new DocumentPreset();
            preset.width  = 595.28;
            preset.height = 841.89;
            preset.units  = RulerUnits.Millimeters;
            doc = app.documents.addDocument(DocumentColorSpace.CMYK, preset);
        }

        function obterOuCriarCamada(d, nome) {
            try {
                return d.layers.getByName(nome);
            } catch (e2) {
                var camada = d.layers.add();
                camada.name = nome;
                return camada;
            }
        }

        var camadaFaca = obterOuCriarCamada(doc, "faca");
        var camadaCotas = obterOuCriarCamada(doc, "cotas");

        function inicializarCores(d) {
            var cores = {};
            try { cores.cut = d.spots.getByName("Cut").color; } catch (eC) {
                var spotCut = d.spots.add();
                spotCut.name = "Cut";
                var spotColorCut = new SpotColor();
                spotColorCut.spot = spotCut;
                var cmykCut = new CMYKColor();
                cmykCut.cyan = 0; cmykCut.magenta = 0; cmykCut.yellow = 0; cmykCut.black = 100;
                spotCut.color = cmykCut;
                spotCut.colorType = ColorModel.SPOT;
                cores.cut = spotColorCut;
                try { var swatchCut = d.swatches.add(spotColorCut); swatchCut.name = spotCut.name; } catch (eX) {}
            }
            try { cores.cotas = d.spots.getByName("Cotas").color; } catch (eC) {
                var spotCotas = d.spots.add();
                spotCotas.name = "Cotas";
                var spotColorCotas = new SpotColor();
                spotColorCotas.spot = spotCotas;
                var cmykCotas = new CMYKColor();
                cmykCotas.cyan = 100; cmykCotas.magenta = 0; cmykCotas.yellow = 100; cmykCotas.black = 0;
                spotCotas.color = cmykCotas;
                spotCotas.colorType = ColorModel.SPOT;
                cores.cotas = spotColorCotas;
                try { var swatchCotas = d.swatches.add(spotColorCotas); swatchCotas.name = spotCotas.name; } catch (eX) {}
            }
            try { cores.crease = d.spots.getByName("Crease").color; } catch (eC) {
                var spotCrease = d.spots.add();
                spotCrease.name = "Crease";
                var spotColorCrease = new SpotColor();
                spotColorCrease.spot = spotCrease;
                var cmykCrease = new CMYKColor();
                cmykCrease.cyan = 0; cmykCrease.magenta = 100; cmykCrease.yellow = 0; cmykCrease.black = 0;
                spotCrease.color = cmykCrease;
                spotCrease.colorType = ColorModel.SPOT;
                cores.crease = spotColorCrease;
                try { var swatchCrease = d.swatches.add(spotColorCrease); swatchCrease.name = spotCrease.name; } catch (eX) {}
            }
            return cores;
        }

        var cores = inicializarCores(doc);
        var corCut = cores.cut;
        var corCotas = cores.cotas;
        var corCrease = cores.crease;

        try {
            var grupoCoresFaca = doc.swatchGroups.getByName("cores da faca");
            if (grupoCoresFaca) grupoCoresFaca.remove();
        } catch (eG) {}
        var grupoCoresFaca = doc.swatchGroups.add();
        grupoCoresFaca.name = "cores da faca";
        try { grupoCoresFaca.addSwatch(doc.swatches.getByName("Cut")); } catch (eS) {}
        try { grupoCoresFaca.addSwatch(doc.swatches.getByName("Cotas")); } catch (eS) {}
        try { grupoCoresFaca.addSwatch(doc.swatches.getByName("Crease")); } catch (eS) {}

        camadaFaca.locked = false;
        camadaCotas.locked = false;
        while (camadaFaca.pathItems.length > 0) camadaFaca.pathItems[0].remove();
        while (camadaCotas.pathItems.length > 0) camadaCotas.pathItems[0].remove();
        while (camadaCotas.textFrames.length > 0) camadaCotas.textFrames[0].remove();

        function criarLinha(pontos, camada, cor, espessura) {
            if (!camada || !cor || !pontos || pontos.length !== 2) return null;
            var linha = camada.pathItems.add();
            linha.setEntirePath(pontos);
            linha.stroked = true;
            linha.filled = false;
            linha.strokeWidth = espessura || 0.5 * MM_PARA_PT;
            linha.strokeColor = cor;
            linha.overprintStroke = true;
            return linha;
        }

        function criarCotaHorizontal(x, y, largura, valorMm, cfg, retInv, alinhamentoTexto, deslocamentoTexto, mMm) {
            if (!cfg || !camadaCotas || !corCotas) return;
            var offset = cfg.offset;
            var extensaoTotal = cfg.extensaoTotal;
            var distanciaTexto = cfg.distanciaTexto;
            var espessura = cfg.espessura;
            var extensao = extensaoTotal / 2;
            var vaoExtra = 6;
            alinhamentoTexto = alinhamentoTexto || Justification.CENTER;
            deslocamentoTexto = deslocamentoTexto || 0;
            var xCota = x;
            var yCota = y + offset;
            criarLinha([[x, yCota - extensao], [x, yCota + extensao]], camadaCotas, corCotas, espessura);
            criarLinha([[x + largura, yCota - extensao], [x + largura, yCota + extensao]], camadaCotas, corCotas, espessura);
            var textoCota = camadaCotas.textFrames.add();
            textoCota.contents = Math.round(valorMm) + (mMm ? " mm" : "");
            textoCota.textRange.characterAttributes.size = cfg.tamanhoTexto;
            try {
                textoCota.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
            } catch (eFonte) {
                try { textoCota.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular"); } catch (e2) {}
            }
            textoCota.textRange.characterAttributes.fillColor = corCotas;
            var larguraTexto = textoCota.width;
            var alturaTexto = textoCota.height;
            var xTexto;
            if (alinhamentoTexto === Justification.LEFT) {
                xTexto = xCota + deslocamentoTexto;
            } else if (alinhamentoTexto === Justification.RIGHT) {
                xTexto = xCota + largura - deslocamentoTexto - larguraTexto;
            } else {
                xTexto = x + largura / 2 - larguraTexto / 2;
            }
            var yTexto = yCota + distanciaTexto + alturaTexto / 2;
            textoCota.position = [xTexto, yTexto];
            if (retInv) {
                var larguraVao = larguraTexto + (2 * vaoExtra);
                var x1 = xCota;
                var x2 = xCota + largura / 2 - larguraVao / 2;
                var x3 = xCota + largura / 2 + larguraVao / 2;
                var x4 = xCota + largura;
                if (x2 > x1) criarLinha([[x1, yCota], [x2, yCota]], camadaCotas, corCotas, espessura);
                if (x4 > x3) criarLinha([[x3, yCota], [x4, yCota]], camadaCotas, corCotas, espessura);
            } else {
                criarLinha([[xCota, yCota], [xCota + largura, yCota]], camadaCotas, corCotas, espessura);
            }
        }

        function criarCotaVertical(x, y, altura, valorMm, cfg, lado, retInv, mMm) {
            if (!cfg || !camadaCotas || !corCotas) return;
            var offset = cfg.offset;
            var extensaoTotal = cfg.extensaoTotal;
            var distanciaTexto = cfg.distanciaTexto;
            var espessura = cfg.espessura;
            var extensao = extensaoTotal / 2;
            var vaoExtra = 6;
            lado = lado || "esquerda";
            var xCota = (lado === "direita") ? x + offset : x - offset;
            var yCota = y;
            criarLinha([[xCota - extensao, yCota], [xCota + extensao, yCota]], camadaCotas, corCotas, espessura);
            criarLinha([[xCota - extensao, yCota - altura], [xCota + extensao, yCota - altura]], camadaCotas, corCotas, espessura);
            var textoCota = camadaCotas.textFrames.add();
            textoCota.contents = Math.round(valorMm) + (mMm ? " mm" : "");
            textoCota.textRange.characterAttributes.size = cfg.tamanhoTexto;
            try {
                textoCota.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
            } catch (eFonte) {
                try { textoCota.textRange.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular"); } catch (e2) {}
            }
            textoCota.textRange.characterAttributes.fillColor = corCotas;
            var larguraOriginalTexto = textoCota.width;
            textoCota.rotate(90);
            var larguraRotacionada = textoCota.width;
            var alturaRotacionada = textoCota.height;
            var centroLinhaX = xCota;
            var centroLinhaY = yCota - altura / 2;
            var centroTextoX = (lado === "direita") ? centroLinhaX + distanciaTexto : centroLinhaX - distanciaTexto;
            var xTexto = centroTextoX - larguraRotacionada / 2;
            var yTexto = centroLinhaY + alturaRotacionada / 2;
            textoCota.position = [xTexto, yTexto];
            if (retInv) {
                var alturaVao = larguraOriginalTexto + (2 * vaoExtra);
                var y1 = yCota;
                var y2 = yCota - altura / 2 + alturaVao / 2;
                var y3 = yCota - altura / 2 - alturaVao / 2;
                var y4 = yCota - altura;
                if (y2 < y1) criarLinha([[xCota, y1], [xCota, y2]], camadaCotas, corCotas, espessura);
                if (y3 > y4) criarLinha([[xCota, y3], [xCota, y4]], camadaCotas, corCotas, espessura);
            } else {
                criarLinha([[xCota, yCota], [xCota, yCota - altura]], camadaCotas, corCotas, espessura);
            }
        }

        function criarRetanguloDesconectado(x, y, largura, altura, sE, sD, isLinha2, isLinha1, isLinha3, criarLinhasHorizontais, orelhaComprimento, col, drawLeft, drawRight, lin, valores) {
            var linhas = {};
            var offsetX = 0;
            var larguraAjustada = largura;
            var xAjustado = x + offsetX;
            var lastCol = valores.meiaCaixa ? 1 : 3;
            if ((isLinha1 || isLinha3) && (sE > 0 || sD > 0)) {
                var metadeSlotter = sE / 2;
                if (col === 0) {
                    larguraAjustada = largura - metadeSlotter;
                    xAjustado = x;
                } else if (col < lastCol) {
                    larguraAjustada = largura - sE;
                    xAjustado = x + metadeSlotter;
                } else {
                    larguraAjustada = largura - metadeSlotter;
                    xAjustado = x + metadeSlotter;
                }
            }
            if (isLinha1) {
                linhas.linhaSuperior = criarLinha([[xAjustado, y], [xAjustado + larguraAjustada, y]], camadaFaca, corCut);
            }
            if (isLinha3) {
                linhas.linhaInferior = criarLinha([[xAjustado, y - altura], [xAjustado + larguraAjustada, y - altura]], camadaFaca, corCut);
            }
            var usarCreaseEsquerda, usarCreaseDireita;
            if (orelhaComprimento) {
                usarCreaseEsquerda = isLinha2;
                usarCreaseDireita = isLinha2 && !(col === lastCol);
            } else {
                usarCreaseEsquerda = isLinha2 && !(lin === 1 && col === 0);
                usarCreaseDireita = isLinha2;
            }
            if (drawLeft) {
                linhas.linhaEsquerda = criarLinha([[xAjustado, y], [xAjustado, y - altura]], camadaFaca, usarCreaseEsquerda ? corCrease : corCut);
            }
            if (drawRight) {
                linhas.linhaDireita = criarLinha([[xAjustado + larguraAjustada, y], [xAjustado + larguraAjustada, y - altura]], camadaFaca, usarCreaseDireita ? corCrease : corCut);
            }
            return linhas;
        }

        function criarSlotterEntreColunas(x, y, altura, slotter, isLinha1, isLinha3) {
            if (!isLinha1 && !isLinha3) return;
            if (slotter <= 0) return;
            var metadeSlotter = slotter / 2;
            criarLinha([[x - metadeSlotter, y], [x - metadeSlotter, y - altura]], camadaFaca, corCut);
            criarLinha([[x + metadeSlotter, y], [x + metadeSlotter, y - altura]], camadaFaca, corCut);
            if (isLinha1) {
                criarLinha([[x - metadeSlotter, y - altura], [x, y - altura]], camadaFaca, corCut);
                criarLinha([[x, y - altura], [x + metadeSlotter, y - altura]], camadaFaca, corCut);
            }
            if (isLinha3) {
                criarLinha([[x - metadeSlotter, y], [x, y]], camadaFaca, corCut);
                criarLinha([[x, y], [x + metadeSlotter, y]], camadaFaca, corCut);
            }
        }

        function criarLinhasHorizontais(x, y, largura, sE, sD) {
            var xStart = x + ((sE > 0) ? sE / 2 : 0);
            var xEnd   = (x + largura) - ((sD > 0) ? sD / 2 : 0);
            if (xEnd > xStart) {
                criarLinha([[xStart, y], [xEnd, y]], camadaFaca, corCrease);
            }
        }

        function criarAbaColaEsquerda(x, y, largura, altura) {
            var offsetY = Math.tan(ANGULO_INCLINACAO) * largura;
            criarLinha([[x + largura, y], [x, y - offsetY]], camadaFaca, corCut);
            criarLinha([[x + largura, y - altura], [x, y - altura + offsetY]], camadaFaca, corCut);
            criarLinha([[x, y - offsetY], [x, y - altura + offsetY]], camadaFaca, corCut);
            criarLinha([[x + largura, y], [x + largura, y - altura]], camadaFaca, corCrease);
        }

        function criarAbaColaDireita(x, y, largura, altura) {
            var offsetY = Math.tan(ANGULO_INCLINACAO) * largura;
            criarLinha([[x, y], [x + largura, y - offsetY]], camadaFaca, corCut);
            criarLinha([[x, y - altura], [x + largura, y - altura + offsetY]], camadaFaca, corCut);
            criarLinha([[x + largura, y - offsetY], [x + largura, y - altura + offsetY]], camadaFaca, corCut);
            criarLinha([[x, y], [x, y - altura]], camadaFaca, corCrease);
        }

        function criarOuAjustarArtboard(valores, orelhaComprimento, mostrarMm, meiaCaixa) {
            var larguraConteudo;
            if (meiaCaixa) {
                larguraConteudo = valores.larguras.coluna3 + valores.larguras.coluna4 + valores.larguras.abaCola;
            } else {
                larguraConteudo = valores.larguras.coluna1 + valores.larguras.coluna2 + valores.larguras.coluna3 + valores.larguras.coluna4 + valores.larguras.abaCola;
            }
            var alturaConteudo = valores.alturas.linha1 + valores.alturas.linha2 + valores.alturas.linha3;
            var BORDA_CONTORNO = 10 * MM_PARA_PT;
            var BORDA_ABA = 24 * MM_PARA_PT;
            var saltoTopo = 0, saltoBase = 0, saltoEsquerda = 0, saltoDireita = 0;
            if (valores.cotas) {
                var cfg = valores.configsCotas;
                var extensao = cfg.extensaoTotal / 2;
                var saltoLado = cfg.offset + Math.max(extensao, cfg.distanciaTexto + cfg.tamanhoTexto);
                saltoTopo = saltoLado;
                saltoBase = extensao;
                if (orelhaComprimento) {
                    saltoEsquerda = BORDA_ABA;
                    saltoDireita = saltoLado;
                } else {
                    saltoEsquerda = saltoLado;
                    saltoDireita = BORDA_ABA;
                }
            }
            var margemEsquerda = saltoEsquerda + BORDA_CONTORNO;
            var margemDireita  = saltoDireita  + BORDA_CONTORNO;
            var margemTopo     = saltoTopo     + BORDA_CONTORNO;
            var margemBase     = saltoBase     + BORDA_CONTORNO;
            var larguraArtboard = larguraConteudo + margemEsquerda + margemDireita;
            var alturaArtboard = alturaConteudo + margemTopo + margemBase;
            var activeArtboardIndex = doc.artboards.getActiveArtboardIndex();
            var artboardAtiva = doc.artboards[activeArtboardIndex];
            var rect = artboardAtiva.artboardRect;
            var centerX = rect[0] + (rect[2] - rect[0]) / 2;
            var centerY = rect[1] - (rect[1] - rect[3]) / 2;
            var novaLeft = centerX - larguraArtboard / 2;
            var novaTop = centerY + alturaArtboard / 2;
            var novaRight = novaLeft + larguraArtboard;
            var novaBottom = novaTop - alturaArtboard;
            try {
                artboardAtiva.artboardRect = [novaLeft, novaTop, novaRight, novaBottom];
            } catch (e) {
                var finalRect = rect;
                return { xStartConteudo: finalRect[0] + margemEsquerda, yStartConteudo: finalRect[1] - margemTopo };
            }
            return { xStartConteudo: novaLeft + margemEsquerda, yStartConteudo: novaTop - margemTopo };
        }

        var conteudoPos = criarOuAjustarArtboard(valores, orelhaComprimento, mostrarMm, meiaCaixa);
        var xStartConteudo = conteudoPos.xStartConteudo;
        var yStartConteudo = conteudoPos.yStartConteudo;
        var posX = [];
        var posY = [yStartConteudo, yStartConteudo - alturas.linha1, yStartConteudo - alturas.linha1 - alturas.linha2, yStartConteudo - alturas.linha1 - alturas.linha2 - alturas.linha3];

        if (!orelhaComprimento) {
            if (meiaCaixa) {
                posX = [ xStartConteudo, xStartConteudo + larguras.coluna3, xStartConteudo + larguras.coluna3 + larguras.coluna4 ];
            } else {
                posX = [ xStartConteudo,
                         xStartConteudo + larguras.coluna1,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3 + larguras.coluna4,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3 + larguras.coluna4 + larguras.abaCola ];
            }
            if (cotas) {
                var xCotaHorizontalAbaCola;
                if (meiaCaixa) { xCotaHorizontalAbaCola = posX[2]; } else { xCotaHorizontalAbaCola = posX[4]; }
                var yCotaHorizontalAbaCola = posY[1];
                if (larguras.abaCola > 0) {
                    var alinhamentoAbaCola = Justification.LEFT;
                    var configsCotasAba = {};
                    for (var key in configsCotas) { configsCotasAba[key] = configsCotas[key]; }
                    criarCotaHorizontal(xCotaHorizontalAbaCola, yCotaHorizontalAbaCola, larguras.abaCola, larguras.abaCola / MM_PARA_PT, configsCotasAba, false, alinhamentoAbaCola, 5, mostrarMm);
                }
                if (meiaCaixa) {
                    for (var col = 0; col < 2; col++) {
                        var colIndex = col + 3;
                        criarCotaHorizontal(posX[col], posY[0], larguras["coluna" + colIndex], larguras["coluna" + colIndex] / MM_PARA_PT, configsCotas, retanguloInvisivel, undefined, undefined, mostrarMm);
                    }
                } else {
                    for (var col = 0; col < 4; col++) {
                        criarCotaHorizontal(posX[col], posY[0], larguras["coluna" + (col + 1)], larguras["coluna" + (col + 1)] / MM_PARA_PT, configsCotas, retanguloInvisivel, undefined, undefined, mostrarMm);
                    }
                }
                var xCotaVertical = posX[0];
                var ladoCotaVertical = "esquerda";
                for (var i = 0; i < 3; i++) {
                    criarCotaVertical(xCotaVertical, posY[i], alturas["linha" + (i + 1)], alturas["linha" + (i + 1)] / MM_PARA_PT, configsCotas, ladoCotaVertical, retanguloInvisivel, mostrarMm);
                }
            }
            if (meiaCaixa) {
                for (var col = 0; col < 2; col++) {
                    var colIndex = col + 3;
                    for (var lin = 0; lin < 3; lin++) {
                        var x = posX[col];
                        var largura = larguras["coluna" + colIndex];
                        var altura = alturas["linha" + (lin + 1)];
                        var isLinha1Ou3 = (lin === 0 || lin === 2);
                        var hasSlotter = slotterEsquerda > 0;
                        var drawLeft = col === 0;
                        var drawRight = (isLinha1Ou3 || (lin === 1 ? col === 0 : !(col === 1 && larguras.abaCola > 0))) && !(isLinha1Ou3 && hasSlotter && col < 1) || (isLinha1Ou3 && !hasSlotter && col === 1);
                        criarRetanguloDesconectado(x, posY[lin], largura, altura, slotterEsquerda, slotterDireita, lin === 1, lin === 0, lin === 2, false, orelhaComprimento, col, drawLeft, drawRight, lin, valores);
                        if ((lin === 0 || lin === 2) && slotterEsquerda > 0 && col < 1) {
                            criarSlotterEntreColunas(posX[col + 1], posY[lin], altura, slotterEsquerda, lin === 0, lin === 2);
                        }
                    }
                }
            } else {
                for (var col = 0; col < 4; col++) {
                    for (var lin = 0; lin < 3; lin++) {
                        var x = posX[col];
                        var largura = larguras["coluna" + (col + 1)];
                        var altura = alturas["linha" + (lin + 1)];
                        var lastCol = meiaCaixa ? 1 : 3;
                        var isLinha1Ou3 = (lin === 0 || lin === 2);
                        var hasSlotter = slotterEsquerda > 0;
                        var drawLeft = col === 0 || (isLinha1Ou3 && !hasSlotter && col === 0);
                        var drawRight = (!(col === lastCol && lin === 1) && !(isLinha1Ou3 && hasSlotter && col < lastCol)) || (isLinha1Ou3 && !hasSlotter && col === lastCol);
                        criarRetanguloDesconectado(x, posY[lin], largura, altura, slotterEsquerda, slotterDireita, lin === 1, lin === 0, lin === 2, false, orelhaComprimento, col, drawLeft, drawRight, lin, valores);
                        if ((lin === 0 || lin === 2) && slotterEsquerda > 0 && col < 3) {
                            criarSlotterEntreColunas(posX[col + 1], posY[lin], altura, slotterEsquerda, lin === 0, lin === 2);
                        }
                    }
                }
            }
            if (meiaCaixa) {
                for (var col = 0; col < 2; col++) {
                    var colIndex = col + 3;
                    var x = posX[col];
                    var largura = larguras["coluna" + colIndex];
                    var sE = (col > 0 && slotterEsquerda > 0) ? slotterEsquerda : 0;
                    var sD = (col < 1 && slotterDireita  > 0) ? slotterDireita  : 0;
                    criarLinhasHorizontais(x, posY[1], largura, sE, sD);
                    criarLinhasHorizontais(x, posY[2], largura, sE, sD);
                }
            } else {
                for (var col = 0; col < 4; col++) {
                    var x = posX[col];
                    var largura = larguras["coluna" + (col + 1)];
                    var sE = (col > 0 && slotterEsquerda > 0) ? slotterEsquerda : 0;
                    var sD = (col < 3 && slotterDireita  > 0) ? slotterDireita  : 0;
                    criarLinhasHorizontais(x, posY[1], largura, sE, sD);
                    criarLinhasHorizontais(x, posY[2], largura, sE, sD);
                }
            }
            if (larguras.abaCola > 0) {
                var xAbaCola;
                if (meiaCaixa) { xAbaCola = posX[2]; } else { xAbaCola = posX[4]; }
                var yAbaCola = posY[1];
                criarAbaColaDireita(xAbaCola, yAbaCola, larguras.abaCola, alturas.linha2);
            }
        } else {
            if (meiaCaixa) {
                posX = [ xStartConteudo, xStartConteudo + larguras.coluna3, xStartConteudo + larguras.coluna3 + larguras.coluna4 ];
            } else {
                posX = [ xStartConteudo,
                         xStartConteudo + larguras.coluna1,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3 + larguras.coluna4,
                         xStartConteudo + larguras.coluna1 + larguras.coluna2 + larguras.coluna3 + larguras.coluna4 + larguras.abaCola ];
            }
            if (cotas) {
                var xCotaHorizontalAbaCola = posX[0] - larguras.abaCola;
                var yCotaHorizontalAbaCola = posY[1];
                if (larguras.abaCola > 0) {
                    var alinhamentoAbaCola = Justification.RIGHT;
                    var configsCotasAba = {};
                    for (var key in configsCotas) { configsCotasAba[key] = configsCotas[key]; }
                    criarCotaHorizontal(xCotaHorizontalAbaCola, yCotaHorizontalAbaCola, larguras.abaCola, larguras.abaCola / MM_PARA_PT, configsCotasAba, false, alinhamentoAbaCola, 5, mostrarMm);
                }
                if (meiaCaixa) {
                    for (var col = 0; col < 2; col++) {
                        var colIndex = col + 3;
                        criarCotaHorizontal(posX[col], posY[0], larguras["coluna" + colIndex], larguras["coluna" + colIndex] / MM_PARA_PT, configsCotas, retanguloInvisivel, undefined, undefined, mostrarMm);
                    }
                } else {
                    for (var col = 0; col < 4; col++) {
                        criarCotaHorizontal(posX[col], posY[0], larguras["coluna" + (col + 1)], larguras["coluna" + (col + 1)] / MM_PARA_PT, configsCotas, retanguloInvisivel, undefined, undefined, mostrarMm);
                    }
                }
                var xCotaVertical = posX[posX.length - 1];
                var ladoCotaVertical = "direita";
                for (var i = 0; i < 3; i++) {
                    criarCotaVertical(xCotaVertical, posY[i], alturas["linha" + (i + 1)], alturas["linha" + (i + 1)] / MM_PARA_PT, configsCotas, ladoCotaVertical, retanguloInvisivel, mostrarMm);
                }
            }
            if (meiaCaixa) {
                for (var col = 0; col < 2; col++) {
                    var colIndex = col + 3;
                    for (var lin = 0; lin < 3; lin++) {
                        var x = posX[col];
                        var largura = larguras["coluna" + colIndex];
                        var altura = alturas["linha" + (lin + 1)];
                        var isLinha1Ou3 = (lin === 0 || lin === 2);
                        var hasSlotter = slotterEsquerda > 0;
                        var drawLeft = (lin === 1) ? false : (col === 0);
                        var drawRight = lin === 1 || !(isLinha1Ou3 && hasSlotter && col < 1) || (isLinha1Ou3 && !hasSlotter && col === 1);
                        criarRetanguloDesconectado(x, posY[lin], largura, altura, slotterEsquerda, slotterDireita, lin === 1, lin === 0, lin === 2, false, orelhaComprimento, col, drawLeft, drawRight, lin, valores);
                        if ((lin === 0 || lin === 2) && slotterEsquerda > 0 && col < 1) {
                            criarSlotterEntreColunas(posX[col + 1], posY[lin], altura, slotterEsquerda, lin === 0, lin === 2);
                        }
                    }
                }
            } else {
                for (var col = 0; col < 4; col++) {
                    for (var lin = 0; lin < 3; lin++) {
                        var x = posX[col];
                        var largura = larguras["coluna" + (col + 1)];
                        var altura = alturas["linha" + (lin + 1)];
                        var lastCol = meiaCaixa ? 1 : 3;
                        var isLinha1Ou3 = (lin === 0 || lin === 2);
                        var hasSlotter = slotterEsquerda > 0;
                        var drawLeft = (lin === 1) ? false : (col === 0);
                        var drawRight = !(isLinha1Ou3 && hasSlotter && col < lastCol) || (isLinha1Ou3 && !hasSlotter && col === lastCol);
                        criarRetanguloDesconectado(x, posY[lin], largura, altura, slotterEsquerda, slotterDireita, lin === 1, lin === 0, lin === 2, false, orelhaComprimento, col, drawLeft, drawRight, lin, valores);
                        if ((lin === 0 || lin === 2) && slotterEsquerda > 0 && col < 3) {
                            criarSlotterEntreColunas(posX[col + 1], posY[lin], altura, slotterEsquerda, lin === 0, lin === 2);
                        }
                    }
                }
            }
            if (meiaCaixa) {
                for (var col = 0; col < 2; col++) {
                    var colIndex = col + 3;
                    var x = posX[col];
                    var largura = larguras["coluna" + colIndex];
                    var sE = (col > 0 && slotterEsquerda > 0) ? slotterEsquerda : 0;
                    var sD = (col < 1 && slotterDireita  > 0) ? slotterDireita  : 0;
                    criarLinhasHorizontais(x, posY[1], largura, sE, sD);
                    criarLinhasHorizontais(x, posY[2], largura, sE, sD);
                }
            } else {
                for (var col = 0; col < 4; col++) {
                    var x = posX[col];
                    var largura = larguras["coluna" + (col + 1)];
                    var sE = (col > 0 && slotterEsquerda > 0) ? slotterEsquerda : 0;
                    var sD = (col < 3 && slotterDireita  > 0) ? slotterDireita  : 0;
                    criarLinhasHorizontais(x, posY[1], largura, sE, sD);
                    criarLinhasHorizontais(x, posY[2], largura, sE, sD);
                }
            }
            if (larguras.abaCola > 0) {
                var xAbaCola = posX[0] - larguras.abaCola;
                var yAbaCola = posY[1];
                criarAbaColaEsquerda(xAbaCola, yAbaCola, larguras.abaCola, alturas.linha2);
            }
        }

        // Salva preferências (comportamento original do script)
        salvarCaixaMaletaPrefs(coluna1, coluna2, coluna3, coluna4, abaCola,
                               linha1, linha2, linha3,
                               offset, espessura, tamanhoTexto, distanciaTexto, extensaoTotal,
                               cotas, orelhaComprimento, retanguloInvisivel, mostrarMm, meiaCaixa,
                               slotter);

        app.redraw();
        return "Caixa Maleta gerada com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
