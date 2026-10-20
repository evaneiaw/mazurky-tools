// centerline.jsx — lógica ExtendScript da ferramenta Centerline

function mmToPt(mm) {
    return mm * 2.83465;
}

function boundsPorArtboard(layer, artboardRects) {
    var bounds = [];
    for (var b = 0; b < artboardRects.length; b++) {
        bounds.push(null);
    }

    function artboardsQueCruzam(itemBounds) {
        var idxs = [];
        for (var a = 0; a < artboardRects.length; a++) {
            var r = artboardRects[a];
            if (itemBounds[0] <= r[2] && itemBounds[2] >= r[0] &&
                itemBounds[3] <= r[1] && itemBounds[1] >= r[3]) {
                idxs.push(a);
            }
        }
        return idxs;
    }

    function artboardDoItem(itemBounds) {
        var idxs = artboardsQueCruzam(itemBounds);
        if (idxs.length === 0) {
            return -1;
        }
        if (idxs.length === 1) {
            return idxs[0];
        }
        var cx = (itemBounds[0] + itemBounds[2]) / 2;
        var cy = (itemBounds[1] + itemBounds[3]) / 2;
        for (var k = 0; k < idxs.length; k++) {
            var rc = artboardRects[idxs[k]];
            if (cx >= rc[0] && cx <= rc[2] && cy >= rc[3] && cy <= rc[1]) {
                return idxs[k];
            }
        }
        var melhor = idxs[0];
        var maiorArea = -1;
        for (var m = 0; m < idxs.length; m++) {
            var rm = artboardRects[idxs[m]];
            var largura = Math.min(itemBounds[2], rm[2]) - Math.max(itemBounds[0], rm[0]);
            var altura = Math.min(itemBounds[1], rm[1]) - Math.max(itemBounds[3], rm[3]);
            if (largura < 0) {
                largura = 0;
            }
            if (altura < 0) {
                altura = 0;
            }
            var area = largura * altura;
            if (area > maiorArea) {
                maiorArea = area;
                melhor = idxs[m];
            }
        }
        return melhor;
    }

    function acumularBounds(idx, ib) {
        var atual = bounds[idx];
        if (!atual) {
            bounds[idx] = [ib[0], ib[1], ib[2], ib[3]];
        } else {
            atual[0] = Math.min(atual[0], ib[0]);
            atual[1] = Math.max(atual[1], ib[1]);
            atual[2] = Math.max(atual[2], ib[2]);
            atual[3] = Math.min(atual[3], ib[3]);
        }
    }

    function acumular(items) {
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var ib;
            try {
                if (item.hidden) {
                    continue;
                }
                ib = item.geometricBounds;
            } catch (eB) {
                continue;
            }
            if (!ib) {
                continue;
            }
            var tipo = "";
            try {
                tipo = item.typename;
            } catch (eT) {
                continue;
            }
            if (tipo === "GroupItem") {
                var idxsGrupo = artboardsQueCruzam(ib);
                if (idxsGrupo.length === 1) {
                    acumularBounds(idxsGrupo[0], ib);
                } else if (idxsGrupo.length > 1) {
                    acumular(item.pageItems);
                }
                continue;
            }
            if (tipo === "PathItem") {
                var guia = false;
                try {
                    guia = item.guides;
                } catch (eG) {}
                if (guia) {
                    continue;
                }
            }
            var idx = artboardDoItem(ib);
            if (idx < 0) {
                continue;
            }
            acumularBounds(idx, ib);
        }
    }

    function acumularCamada(camada) {
        acumular(camada.pageItems);
        var subs = camada.layers;
        if (subs) {
            for (var s = 0; s < subs.length; s++) {
                var sub = subs[s];
                var visivel = true;
                try {
                    visivel = sub.visible;
                } catch (eV) {}
                if (!visivel) {
                    continue;
                }
                acumularCamada(sub);
            }
        }
    }

    acumularCamada(layer);
    return bounds;
}

function listarDocumentos() {
    try {
        var names = [];
        var activeName = null;
        try {
            activeName = app.activeDocument.name;
        } catch (eA) {}
        var matches = [];
        for (var i = 0; i < app.documents.length; i++) {
            var nm = app.documents[i].name;
            names.push(nm);
            if (activeName !== null && nm === activeName) {
                matches.push(i);
            }
        }
        var ativo = -1;
        if (matches.length === 1) {
            ativo = matches[0];
        } else if (matches.length > 1) {
            var activePath = null;
            try {
                activePath = app.activeDocument.fullName.fsName;
            } catch (eP) {}
            ativo = matches[0];
            if (activePath) {
                for (var m = 0; m < matches.length; m++) {
                    try {
                        if (app.documents[matches[m]].fullName.fsName === activePath) {
                            ativo = matches[m];
                            break;
                        }
                    } catch (eF) {}
                }
            }
        }
        return "#" + ativo + "#" + names.join("|");
    } catch (e) {
        return "";
    }
}

function acharCamadaFaca(doc) {
    try {
        var direta = doc.layers.getByName("Faca");
        if (direta) {
            return direta;
        }
    } catch (e) {}
    var total = doc.layers.length;
    for (var i = 0; i < total; i++) {
        var camada = doc.layers[i];
        var nome = camada.name;
        if (nome && nome.toLowerCase() === "faca") {
            return camada;
        }
    }
    return null;
}

function processarDocumento(doc, alignBase, alignTop, alignLeft, alignRight, addCenterCL, ptOffset, blackColor, grayColor, horizontalRectWidth, horizontalRectHeight, verticalRectWidth, verticalRectHeight, todosArtboards) {
    var dieCutLayer = acharCamadaFaca(doc);

    if (!dieCutLayer) {
        return { ok: false, error: "Camada 'Faca' não encontrada." };
    }

    var artboardsProcessed = 0;
    var totalRectsCreated = 0;

    try {
        var existingCL = doc.layers.getByName("CL");
        existingCL.remove();
    } catch (e) {}

    var clLayer = doc.layers.add();
    clLayer.name = "CL";

    var artboardRects = [];
    for (var ar = 0; ar < doc.artboards.length; ar++) {
        artboardRects.push(doc.artboards[ar].artboardRect);
    }
    var boundsAll = boundsPorArtboard(dieCutLayer, artboardRects);

    var artboardIndices = [];
    if (todosArtboards) {
        for (var ai = 0; ai < doc.artboards.length; ai++) {
            artboardIndices.push(ai);
        }
    } else {
        artboardIndices.push(doc.artboards.getActiveArtboardIndex());
    }

    var artErrors = [];

    for (var ab = 0; ab < artboardIndices.length; ab++) {
        var boundingBox = boundsAll[artboardIndices[ab]];

        if (!boundingBox) {
            continue;
        }

        try {
            var dieCutWidth = boundingBox[2] - boundingBox[0];
            var dieCutHeight = boundingBox[1] - boundingBox[3];
            var dieCutCenterX = boundingBox[0] + dieCutWidth / 2;
            var dieCutCenterY = boundingBox[3] + dieCutHeight / 2;

            var rect1, rect2, rect3;

            if (alignBase) {
                var yPos = boundingBox[3] + horizontalRectHeight;
                rect1 = clLayer.pathItems.rectangle(yPos, boundingBox[0] - ptOffset - horizontalRectWidth, horizontalRectWidth, horizontalRectHeight);
                rect2 = clLayer.pathItems.rectangle(yPos, boundingBox[2] + ptOffset, horizontalRectWidth, horizontalRectHeight);
                if (addCenterCL) {
                    rect3 = clLayer.pathItems.rectangle(yPos, dieCutCenterX - horizontalRectWidth / 2, horizontalRectWidth, horizontalRectHeight);
                }
            } else if (alignTop) {
                var yPos = boundingBox[1];
                rect1 = clLayer.pathItems.rectangle(yPos, boundingBox[0] - ptOffset - horizontalRectWidth, horizontalRectWidth, horizontalRectHeight);
                rect2 = clLayer.pathItems.rectangle(yPos, boundingBox[2] + ptOffset, horizontalRectWidth, horizontalRectHeight);
                if (addCenterCL) {
                    rect3 = clLayer.pathItems.rectangle(yPos, dieCutCenterX - horizontalRectWidth / 2, horizontalRectWidth, horizontalRectHeight);
                }
            } else if (alignLeft) {
                var topRectY = boundingBox[1] + ptOffset + verticalRectHeight;
                var bottomRectY = boundingBox[3] - ptOffset;

                rect1 = clLayer.pathItems.rectangle(topRectY, boundingBox[0], verticalRectWidth, verticalRectHeight);
                rect2 = clLayer.pathItems.rectangle(bottomRectY, boundingBox[0], verticalRectWidth, verticalRectHeight);

                if (addCenterCL) {
                    rect3 = clLayer.pathItems.rectangle(dieCutCenterY + verticalRectHeight / 2, boundingBox[0], verticalRectWidth, verticalRectHeight);
                }
            } else if (alignRight) {
                var topRectY = boundingBox[1] + ptOffset + verticalRectHeight;
                var bottomRectY = boundingBox[3] - ptOffset;
                var horizontalPos = boundingBox[2] - verticalRectWidth;

                rect1 = clLayer.pathItems.rectangle(topRectY, horizontalPos, verticalRectWidth, verticalRectHeight);
                rect2 = clLayer.pathItems.rectangle(bottomRectY, horizontalPos, verticalRectWidth, verticalRectHeight);

                if (addCenterCL) {
                    rect3 = clLayer.pathItems.rectangle(dieCutCenterY + verticalRectHeight / 2, horizontalPos, verticalRectWidth, verticalRectHeight);
                }
            }

            var allRects = [];
            if (rect1) allRects.push(rect1);
            if (rect2) allRects.push(rect2);
            if (rect3) allRects.push(rect3);

            for (var ir = 0; ir < allRects.length; ir++) {
                var currentRect = allRects[ir];
                currentRect.stroked = false;
                currentRect.filled = true;

                if (addCenterCL && allRects.length === 3 && ir === 2) {
                    currentRect.fillColor = grayColor;
                } else {
                    currentRect.fillColor = blackColor;
                }
            }

            totalRectsCreated += allRects.length;
            artboardsProcessed++;
        } catch (eArt) {
            artErrors.push("Artboard " + (artboardIndices[ab] + 1) + ": " + (eArt.message || String(eArt)));
        }
    }

    if (artboardsProcessed === 0) {
        clLayer.remove();
        return { ok: false, error: "Nenhuma faca encontrada nos artboards." };
    }

    return { ok: true, artboards: artboardsProcessed, rects: totalRectsCreated, artErrors: artErrors };
}

function executar(alinhamento, addCenterCL, offsetMM, selectedIndices, todosArtboards) {
    try {
        if (app.documents.length === 0) {
            return "Nenhum documento aberto. Por favor, abra um documento e tente novamente.";
        }

        var alignValue = String(alinhamento).toLowerCase();
        var alignBase = alignValue === "base";
        var alignTop = alignValue === "topo";
        var alignLeft = alignValue === "esquerda";
        var alignRight = alignValue === "direita";

        if (isNaN(offsetMM)) {
            return "Valor de deslocamento inválido. Por favor, insira um número.";
        }
        var ptOffset = mmToPt(offsetMM);

        var blackColor = new GrayColor();
        blackColor.gray = 100;
        var grayColor = new GrayColor();
        grayColor.gray = 50;

        var horizontalRectWidth = mmToPt(7);
        var horizontalRectHeight = mmToPt(4);
        var verticalRectWidth = mmToPt(4);
        var verticalRectHeight = mmToPt(7);

        var totalDocsProcessed = 0;
        var totalArtboardsProcessed = 0;
        var totalRectsCreated = 0;
        var errors = [];

        var indices = [];
        for (var si = 0; si < selectedIndices.length; si++) {
            var idx = parseInt(selectedIndices[si]);
            if (idx >= 0 && idx < app.documents.length) {
                indices.push(idx);
            }
        }

        if (indices.length === 0) {
            return "Nenhum documento válido selecionado.";
        }

        var prevInteraction = app.userInteractionLevel;
        var activeAntes = null;
        try {
            activeAntes = app.activeDocument;
        } catch (eAD) {}
        try {
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
        } catch (eUI) {}

        for (var di = 0; di < indices.length; di++) {
            var doc = app.documents[indices[di]];
            if (!doc || doc.isValid === false) {
                errors.push("Documento índice " + indices[di] + " não está mais aberto.");
                continue;
            }

            try {
                app.activeDocument = doc;
            } catch (eAtiva) {}

            var result = processarDocumento(doc, alignBase, alignTop, alignLeft, alignRight, addCenterCL, ptOffset, blackColor, grayColor, horizontalRectWidth, horizontalRectHeight, verticalRectWidth, verticalRectHeight, todosArtboards);

            if (result.ok) {
                totalDocsProcessed++;
                totalArtboardsProcessed += result.artboards;
                totalRectsCreated += result.rects;
                if (result.artErrors && result.artErrors.length > 0) {
                    for (var ae = 0; ae < result.artErrors.length; ae++) {
                        errors.push(doc.name + " - " + result.artErrors[ae]);
                    }
                }
            } else {
                errors.push(doc.name + ": " + result.error);
            }
        }

        app.redraw();

        try {
            if (activeAntes) {
                app.activeDocument = activeAntes;
            }
        } catch (eAD2) {}

        try {
            app.userInteractionLevel = prevInteraction;
        } catch (eUI2) {}

        if (totalArtboardsProcessed === 0) {
            return "Nenhuma faca encontrada nos documentos selecionados.\n" + errors.join("\n");
        } else {
            var msg = "CenterLine criado com sucesso!\n";
            msg += "Documentos processados: " + totalDocsProcessed + "\n";
            msg += "Artboards processados: " + totalArtboardsProcessed + "\n";
            msg += "Retângulos CL criados: " + totalRectsCreated;
            if (errors.length > 0) {
                msg += "\n\nAtenção:\n" + errors.join("\n");
            }
            return msg;
        }
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
