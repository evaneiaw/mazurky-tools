// salvarpdf.jsx — lógica ExtendScript da ferramenta Salvar PDF Várias Páginas

function trimTexto(s) {
    return String(s || "").replace(/^\s+|\s+$/g, "");
}

function listarPresets() {
    try {
        return app.PDFPresetsList.join("|");
    } catch (e) {
        return "";
    }
}

function listarDocumentos() {
    try {
        var nomes = [];
        var activeName = null;
        try {
            activeName = app.activeDocument.name;
        } catch (eA) {}
        var matches = [];
        for (var i = 0; i < app.documents.length; i++) {
            var nm = app.documents[i].name;
            nomes.push(nm);
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
        return "#" + ativo + "#" + nomes.join("|");
    } catch (e) {
        return "";
    }
}

function listarArtboards() {
    try {
        if (app.documents.length === 0) return "";
        var doc = app.activeDocument;
        var ativo = 0;
        try { ativo = doc.artboards.getActiveArtboardIndex(); } catch (e) {}
        var nomes = [];
        for (var i = 0; i < doc.artboards.length; i++) {
            var n = "";
            try { n = doc.artboards[i].name; } catch (e2) {}
            nomes.push(n === null || n === undefined ? "" : String(n));
        }
        return ativo + "|" + nomes.join("|");
    } catch (e) {
        return "";
    }
}

function getOptions(presetIndex, viewAfterSaving) {
    var options = new PDFSaveOptions();
    options.viewAfterSaving = viewAfterSaving;

    if (presetIndex > 0) {
        try {
            var presetsList = app.PDFPresetsList;
            if (presetsList.length > 0 && presetIndex <= presetsList.length) {
                options.pDFPreset = presetsList[presetIndex - 1];
            }
        } catch (e) {}
    }

    return options;
}

function getTargetFile(docName, ext, destFolder, paginaNumero, nomeArtboard, formatoNome) {
    var newName = "";

    if (docName.indexOf('.') < 0) {
        newName = docName + ext;
    } else {
        var dot = docName.lastIndexOf('.');
        newName += docName.substring(0, dot);
        newName += ext;
    }

    if (paginaNumero > 0) {
        var nomeBase = newName.replace(ext, '');
        if (formatoNome === 0) {
            newName = nomeBase + '_pg' + paginaNumero + ext;
        } else {
            var nomeArt = nomeArtboard ? nomeArtboard.replace(/\s+/g, '_') : 'pagina' + paginaNumero;
            newName = nomeBase + '_' + nomeArt + ext;
        }
    }

    var myFile = new File(destFolder.fsName + '/' + newName);

    if (myFile.open("w")) {
        myFile.close();
    } else {
        throw new Error('Acesso negado ao diretório');
    }
    return myFile;
}

function getDocumentFolder(doc) {
    try {
        var caminho = doc.path;
        if (caminho && caminho !== "") {
            return new Folder(caminho);
        }
    } catch (e) {}
    return null;
}

function salvarDocumento(doc) {
    if (getDocumentFolder(doc)) {
        try {
            doc.save();
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

function getLayersFaca(doc) {
    var encontradas = [];
    for (var i = 0; i < doc.layers.length; i++) {
        var L = doc.layers[i];
        if (String(L.name).toLowerCase() === "faca") {
            encontradas.push({ layer: L, visivel: L.visible });
        }
    }
    return encontradas;
}

function executar(presetIndex, usarMesmaPasta, pastaEscolhida, viewAfterSaving, salvarAntes, paginaPorArquivo, nomeFormato, docIndices, ocultarFaca, artboardUnica, artboardIndex) {
    try {
        if (app.documents.length === 0) {
            return "Erro: Não há documentos abertos!";
        }

        if (!usarMesmaPasta) {
            var pastaEscolhidaClean = trimTexto(pastaEscolhida);
            if (pastaEscolhidaClean === "") {
                return "Erro: Informe uma pasta de destino.";
            }
            var pastaTeste = new Folder(pastaEscolhidaClean);
            if (!pastaTeste.exists) {
                return "Erro: A pasta de destino não existe.";
            }
        }

        var docsToProcess = [];
        if (artboardUnica) {
            docsToProcess.push(app.activeDocument);
        } else if (docIndices && docIndices.length > 0) {
            for (var i = 0; i < docIndices.length; i++) {
                docsToProcess.push(app.documents[docIndices[i]]);
            }
        } else if (app.documents.length === 1) {
            docsToProcess.push(app.activeDocument);
        } else {
            return "Erro: Selecione ao menos um documento para processar.";
        }

        var usarMesmaPastaBool = !!usarMesmaPasta;
        var pastaEscolhidaFolder = usarMesmaPastaBool ? null : new Folder(trimTexto(pastaEscolhida));
        var ocultarFacaBool = !!ocultarFaca;
        var artboardUnicaBool = !!artboardUnica;
        var artboardIdx = (artboardIndex === null || artboardIndex === undefined) ? -1 : parseInt(artboardIndex, 10);
        if (isNaN(artboardIdx)) artboardIdx = -1;
        var sucessoTotal = 0;
        var erros = [];

        for (var d = 0; d < docsToProcess.length; d++) {
            var sourceDoc = docsToProcess[d];
            var camadasFaca = null;

            try {
                var destFolder;

                if (usarMesmaPastaBool) {
                    var pastaDoc = getDocumentFolder(sourceDoc);
                    if (!pastaDoc) {
                        erros.push(sourceDoc.name + ": documento não salvo, pulando.");
                        continue;
                    }
                    destFolder = pastaDoc;
                } else {
                    destFolder = pastaEscolhidaFolder;
                }

                sourceDoc.activate();

                if (salvarAntes && !salvarDocumento(sourceDoc)) {
                    erros.push(sourceDoc.name + ": não foi possível salvar antes do PDF, pulando.");
                    continue;
                }

                if (ocultarFacaBool) {
                    camadasFaca = getLayersFaca(sourceDoc);
                    for (var f = 0; f < camadasFaca.length; f++) camadasFaca[f].layer.visible = false;
                }

                var options = getOptions(presetIndex, viewAfterSaving);
                options.artboardRange = "";

                var numArtboards = sourceDoc.artboards.length;

                if (artboardUnicaBool) {
                    var idx = artboardIdx;
                    if (idx < 0 || idx >= numArtboards) {
                        try { idx = sourceDoc.artboards.getActiveArtboardIndex(); } catch (e3) { idx = 0; }
                    }
                    if (idx < 0 || idx >= numArtboards) idx = 0;
                    sourceDoc.artboards.setActiveArtboardIndex(idx);
                    options.artboardRange = (idx + 1).toString();
                    var nomeArtboardUnica = "";
                    try { nomeArtboardUnica = sourceDoc.artboards[idx].name; } catch (e4) {}
                    if (!nomeArtboardUnica || nomeArtboardUnica === "") {
                        nomeArtboardUnica = "pg" + (idx + 1);
                    }
                    var targetFileUnica = getTargetFile(sourceDoc.name, '.pdf', destFolder, idx + 1, nomeArtboardUnica, 1);
                    sourceDoc.saveAs(targetFileUnica, options);
                    sucessoTotal++;
                } else if (paginaPorArquivo && numArtboards > 1) {
                    for (var a = 0; a < numArtboards; a++) {
                        sourceDoc.artboards.setActiveArtboardIndex(a);
                        options.artboardRange = (a + 1).toString();
                        var artboard = sourceDoc.artboards[a];
                        var nomeArtboard = artboard.name;
                        if (!nomeArtboard || nomeArtboard === "") {
                            nomeArtboard = "pg" + (a + 1);
                        }
                        var targetFile = getTargetFile(sourceDoc.name, '.pdf', destFolder, a + 1, nomeArtboard, nomeFormato);
                        sourceDoc.saveAs(targetFile, options);
                        sucessoTotal++;
                    }
                } else {
                    options.artboardRange = "";
                    var targetFileUnico = getTargetFile(sourceDoc.name, '.pdf', destFolder, 0, "", 0);
                    sourceDoc.saveAs(targetFileUnico, options);
                    sucessoTotal++;
                }

                if (salvarAntes) {
                    try { sourceDoc.saved = true; } catch (e) {}
                }
            } catch (e) {
                erros.push(sourceDoc.name + ": " + (e.message || String(e)));
            } finally {
                if (camadasFaca) {
                    for (var f = 0; f < camadasFaca.length; f++) camadasFaca[f].layer.visible = camadasFaca[f].visivel;
                }
            }
        }

        var msg = sucessoTotal + " arquivo(s) PDF salvo(s) com sucesso!";
        if (erros.length > 0) {
            msg += "\n\nErros:\n" + erros.join("\n");
        }
        return msg;
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
