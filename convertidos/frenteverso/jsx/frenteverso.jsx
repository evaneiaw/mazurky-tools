// frenteverso.jsx — espelha o conteudo da prancheta ativa em uma segunda prancheta.
// A reflexao horizontal usa como eixo o centro do retangulo delimitador da camada
// escolhida (MIRAS ou FACA), conforme a selecao feita no painel.

var FV_MM_POR_PONTO = 2.83465;

var FV_NOMENCLATURAS = {
    frenteverso: ["Frente", "Verso"],
    externointerno: ["Externo", "Interno"]
};

// Aliases aceitos para o nome da camada de referencia.
var FV_CAMADAS = {
    miras: ["MIRA", "MIRAS"],
    faca: ["FACA", "FACA DE CORTE", "FACAS"]
};

var FV_ROTULOS = {
    miras: "MIRAS",
    faca: "FACA"
};

function fvTrim(s) {
    return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, "");
}

function fvNorm(s) {
    return fvTrim(s).toUpperCase();
}

function fvLower(s) {
    return fvTrim(s).toLowerCase();
}

function fvNumeroValido(n) {
    return typeof n === "number" && !isNaN(n) && isFinite(n);
}

function fvEhGuia(item) {
    try {
        if (item.typename === "PathItem") {
            return item.guides === true;
        }
    } catch (e) {}
    return false;
}

function fvAcharCamada(doc, tipo) {
    var aliases = FV_CAMADAS[tipo];
    if (!aliases) return null;
    var i, j, nome;
    for (i = 0; i < doc.layers.length; i++) {
        nome = fvNorm(doc.layers[i].name);
        for (j = 0; j < aliases.length; j++) {
            if (nome === aliases[j]) return doc.layers[i];
        }
    }
    return null;
}

function fvColetarItens(camada, destino) {
    var i;
    for (i = 0; i < camada.pageItems.length; i++) {
        destino.push(camada.pageItems[i]);
    }
    for (i = 0; i < camada.layers.length; i++) {
        fvColetarItens(camada.layers[i], destino);
    }
}

function fvBoundsValido(b) {
    if (!b || b.length < 4) return false;
    var i;
    for (i = 0; i < 4; i++) {
        if (!fvNumeroValido(b[i])) return false;
    }
    return b[2] >= b[0] && b[1] >= b[3];
}

function fvBoundsItem(item) {
    var b = null;
    try {
        b = item.visibleBounds;
    } catch (e1) {
        b = null;
    }
    if (!fvBoundsValido(b)) {
        try {
            b = item.geometricBounds;
        } catch (e2) {
            b = null;
        }
    }
    if (!fvBoundsValido(b)) return null;
    return [b[0], b[1], b[2], b[3]];
}

// Uniao de bounds no formato [left, top, right, bottom].
function fvUnir(acc, b) {
    if (!acc) return [b[0], b[1], b[2], b[3]];
    if (b[0] < acc[0]) acc[0] = b[0];
    if (b[1] > acc[1]) acc[1] = b[1];
    if (b[2] > acc[2]) acc[2] = b[2];
    if (b[3] < acc[3]) acc[3] = b[3];
    return acc;
}

function fvIntersecta(b, r) {
    return b[0] <= r[2] && b[2] >= r[0] && b[1] >= r[3] && b[3] <= r[1];
}

// Limites da referencia considerando apenas os itens que cruzam a prancheta ativa
// (a camada MIRA pode ter subcamadas com miras de varias pranchetas).
function fvBoundsReferencia(camada, area) {
    var itens = [];
    fvColetarItens(camada, itens);

    var naArea = null;
    var todos = null;
    var i, b, item;

    for (i = 0; i < itens.length; i++) {
        item = itens[i];
        try {
            if (item.hidden) continue;
        } catch (eH) {}
        b = fvBoundsItem(item);
        if (!b) continue;
        todos = fvUnir(todos, b);
        if (fvIntersecta(b, area)) naArea = fvUnir(naArea, b);
    }

    return naArea || todos;
}

function fvEspelharCopia(copia, xc, deslocamento) {
    var gb = null;
    try {
        gb = copia.geometricBounds;
    } catch (e1) {
        gb = null;
    }
    if (!fvBoundsValido(gb)) gb = fvBoundsItem(copia);
    if (!gb) throw new Error("Sem limites validos para espelhar.");

    var centroX = (gb[0] + gb[2]) / 2;

    // Espelha em torno do próprio centro e depois desloca para o centro refletido
    // em relação ao eixo da referência: X' = 2·Xc - X + deslocamento.
    copia.resize(-100, 100, true, true, true, true, 100);
    copia.translate(2 * xc - 2 * centroX + deslocamento, 0);
}

function fvDuplicarEEspelhar(original, xc, deslocamento) {
    var travaOriginal = false;
    var ocultoOriginal = false;

    try {
        travaOriginal = original.locked === true;
    } catch (e1) {}
    try {
        ocultoOriginal = original.hidden === true;
    } catch (e2) {}

    var copia = null;
    if (travaOriginal) {
        try {
            original.locked = false;
        } catch (e3) {}
    }
    try {
        copia = original.duplicate();
    } finally {
        if (travaOriginal) {
            try {
                original.locked = true;
            } catch (e4) {}
        }
    }

    if (!copia) return null;

    try {
        copia.locked = false;
    } catch (e5) {}
    if (ocultoOriginal) {
        try {
            copia.hidden = false;
        } catch (e6) {}
    }

    fvEspelharCopia(copia, xc, deslocamento);

    if (ocultoOriginal) {
        try {
            copia.hidden = true;
        } catch (e7) {}
    }
    if (travaOriginal) {
        try {
            copia.locked = true;
        } catch (e8) {}
    }

    return copia;
}

function fvCopiarDaCamada(camada, area, xc, deslocamento, copias) {
    var travaAntes = false;
    var visivelAntes = true;

    try {
        travaAntes = camada.locked === true;
    } catch (e1) {}
    try {
        visivelAntes = camada.visible === true;
    } catch (e2) {}

    try {
        if (travaAntes) {
            try {
                camada.locked = false;
            } catch (e3) {}
        }

        var originais = [];
        var i;
        for (i = 0; i < camada.pageItems.length; i++) {
            var item = camada.pageItems[i];
            if (fvEhGuia(item)) continue;
            var b = fvBoundsItem(item);
            if (!b || !fvIntersecta(b, area)) continue;
            originais.push(item);
        }

        for (i = 0; i < originais.length; i++) {
            var copia = fvDuplicarEEspelhar(originais[i], xc, deslocamento);
            if (copia) copias.push(copia);
        }

        for (i = 0; i < camada.layers.length; i++) {
            fvCopiarDaCamada(camada.layers[i], area, xc, deslocamento, copias);
        }
    } finally {
        try {
            camada.locked = travaAntes;
        } catch (e4) {}
        try {
            camada.visible = visivelAntes;
        } catch (e5) {}
    }
}

function fvNomeEmUso(doc, nome, ignorarIndice) {
    var alvo = fvNorm(nome);
    var i;
    for (i = 0; i < doc.artboards.length; i++) {
        if (i === ignorarIndice) continue;
        if (fvNorm(doc.artboards[i].name) === alvo) return true;
    }
    return false;
}

function fvDesfazer(doc, copias, novoIndice, indiceOriginal, nomeOriginal) {
    var i;
    for (i = copias.length - 1; i >= 0; i--) {
        try {
            var c = copias[i];
            try {
                c.locked = false;
            } catch (e1) {}
            try {
                c.layer.locked = false;
            } catch (e2) {}
            c.remove();
        } catch (e3) {}
    }

    if (novoIndice >= 0) {
        try {
            doc.artboards.remove(novoIndice);
        } catch (e4) {}
    }

    if (nomeOriginal) {
        try {
            doc.artboards[indiceOriginal].name = nomeOriginal;
        } catch (e5) {}
    }
}

function executar(nomenclatura, distanciaMM, referencia) {
    var doc = null;
    var indiceOriginal = -1;
    var novoIndice = -1;
    var copias = [];
    var nomeOriginal = "";
    var area = null;

    try {
        if (app.documents.length === 0) {
            return "ERRO|Nenhum documento aberto.";
        }

        doc = app.activeDocument;

        try {
            if (doc.editable === false) {
                return "ERRO|O documento está somente leitura.";
            }
        } catch (eEd) {}

        var chaveNomes = fvLower(nomenclatura);
        var nomes = FV_NOMENCLATURAS[chaveNomes];
        if (!nomes) {
            return "ERRO|Nomenclatura inválida.";
        }

        var tipo = fvLower(referencia);
        if (!FV_CAMADAS[tipo]) {
            return "ERRO|Referência inválida — escolha MIRAS ou FACA.";
        }

        var distancia = parseFloat(distanciaMM);
        if (!fvNumeroValido(distancia) || distancia < 0) {
            return "ERRO|Distância inválida — informe um número maior ou igual a 0.";
        }

        indiceOriginal = doc.artboards.getActiveArtboardIndex();
        if (indiceOriginal < 0 || indiceOriginal >= doc.artboards.length) {
            return "ERRO|Nenhuma prancheta ativa.";
        }

        area = doc.artboards[indiceOriginal].artboardRect;
        var largura = area[2] - area[0];
        var altura = area[1] - area[3];
        if (!(largura > 0) || !(altura > 0)) {
            return "ERRO|A prancheta ativa tem dimensões inválidas.";
        }

        var camada = fvAcharCamada(doc, tipo);
        if (!camada) {
            return "ERRO|Camada " + FV_ROTULOS[tipo] + " não encontrada no documento.";
        }

        var boundsRef = fvBoundsReferencia(camada, area);
        if (!boundsRef) {
            return "ERRO|A camada " + FV_ROTULOS[tipo] + " não tem elementos com limites válidos.";
        }

        var xc = (boundsRef[0] + boundsRef[2]) / 2;
        var yc = (boundsRef[1] + boundsRef[3]) / 2;
        if (!fvNumeroValido(xc) || !fvNumeroValido(yc)) {
            return "ERRO|Não foi possível calcular o centro da referência.";
        }

        if (fvNomeEmUso(doc, nomes[0], indiceOriginal)) {
            return "ERRO|Já existe uma prancheta chamada \"" + nomes[0] + "\".";
        }
        if (fvNomeEmUso(doc, nomes[1], indiceOriginal)) {
            return "ERRO|Já existe uma prancheta chamada \"" + nomes[1] + "\".";
        }

        // ----- A partir daqui o documento é alterado -----
        nomeOriginal = doc.artboards[indiceOriginal].name;
        doc.artboards[indiceOriginal].name = nomes[0];

        var gapPt = distancia * FV_MM_POR_PONTO;
        var deslocamento = largura + gapPt;
        var novoRect = [
            area[0] + deslocamento,
            area[1],
            area[2] + deslocamento,
            area[3]
        ];

        doc.artboards.add(novoRect);
        novoIndice = doc.artboards.length - 1;
        doc.artboards[novoIndice].name = nomes[1];

        // Reflexão em torno de Xc e deslocamento para a segunda prancheta:
        // X' = 2·Xc - X + deslocamento ; Y' = Y
        var i;
        for (i = 0; i < doc.layers.length; i++) {
            fvCopiarDaCamada(doc.layers[i], area, xc, deslocamento, copias);
        }

        try {
            doc.artboards.setActiveArtboardIndex(novoIndice);
        } catch (eAt) {}
        try {
            app.redraw();
        } catch (eRd) {}

        return "OK|Prancheta \"" + nomes[1] + "\" criada: " + copias.length +
            " objeto(s) espelhado(s) pelo centro da camada " + FV_ROTULOS[tipo] +
            " (eixo X = " + Math.round(xc * 100) / 100 + " pt, distância " +
            distancia + " mm).";
    } catch (e) {
        if (doc) {
            fvDesfazer(doc, copias, novoIndice, indiceOriginal, nomeOriginal);
        }
        return "ERRO|Falha ao gerar o verso: " + (e && e.message ? e.message : e);
    }
}
