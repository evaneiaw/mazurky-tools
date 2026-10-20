// facaplotter.jsx — lógica ExtendScript da ferramenta Faca para Plotter
//
// Performance (Illustrator 30.x): acessar propriedade do DOM de um documento
// que NÃO está ativo custa ~125-350 ms; no documento ativo custa ~0 ms.
// Além disso `app.activeDocument = doc` custa ~250 ms, `app.documents.add()`
// ~1 s e `doc.close()` ~0,5 s. Por isso:
//   - o documento de trabalho (wd) é criado UMA vez e reaproveitado;
//   - a fonte fica ativa enquanto lemos/duplicamos dela;
//   - só duplicamos os itens que pertencem à prancheta (sem copiar e apagar).

function trim(s) { return s.replace(/^\s+|\s+$/g, ""); }

function pathConfig() {
    var jsxFolder = Folder($.fileName).parent;
    return new File(jsxFolder.fsName + "/013- Faca para Plotter.cfg");
}

function carregarConfig() {
    var cfg = { espelho: "H", modo: 0, reabrir: true, salvarAntes: true, porArtboard: true };
    var f = pathConfig();
    if (!f.exists) return cfg;
    try {
        f.open("r");
        var txt = f.read();
        f.close();
        var linhas = txt.split("\n");
        for (var i = 0; i < linhas.length; i++) {
            var p = linhas[i].indexOf("=");
            if (p > 0) {
                var k = trim(linhas[i].substring(0, p));
                var v = trim(linhas[i].substring(p + 1));
                if (k === "espelho") cfg.espelho = v;
                else if (k === "espelharH") cfg.espelho = (v === "true" || v === "1") ? "H" : "V";
                else if (k === "modo") cfg.modo = parseInt(v, 10);
                else if (k === "reabrir") cfg.reabrir = (v === "true" || v === "1");
                else if (k === "salvarAntes") cfg.salvarAntes = (v === "true" || v === "1");
                else if (k === "porArtboard") cfg.porArtboard = (v === "true" || v === "1");
            }
        }
    } catch (e) {
        return cfg;
    }
    return cfg;
}

function salvarConfig(cfg) {
    try {
        var f = pathConfig();
        f.open("w");
        f.writeln("espelho=" + cfg.espelho);
        f.writeln("modo=" + cfg.modo);
        f.writeln("reabrir=" + cfg.reabrir);
        f.writeln("salvarAntes=" + cfg.salvarAntes);
        f.writeln("porArtboard=" + cfg.porArtboard);
        f.close();
    } catch (e) {}
}

function listarDocumentos() {
    try {
        var nomes = [];
        for (var i = 0; i < app.documents.length; i++) {
            nomes.push(app.documents[i].name);
        }
        return nomes.join("|");
    } catch (e) {
        return "";
    }
}

function listarArtboards() {
    try {
        if (app.documents.length === 0) return "";
        var doc = app.activeDocument;
        var nomes = [];
        for (var i = 0; i < doc.artboards.length; i++) {
            nomes.push((i + 1) + "-" + doc.artboards[i].name);
        }
        return nomes.join("|");
    } catch (e) {
        return "";
    }
}

function getConfig() {
    try {
        var cfg = carregarConfig();
        return "{" +
            '"espelho":"' + cfg.espelho + '",' +
            '"modo":' + cfg.modo + "," +
            '"porArtboard":' + (cfg.porArtboard ? "true" : "false") + "," +
            '"reabrir":' + (cfg.reabrir ? "true" : "false") + "," +
            '"salvarAntes":' + (cfg.salvarAntes ? "true" : "false") +
            "}";
    } catch (e) {
        return "{}";
    }
}

// ---------------------------------------------------------------------------
// Estado entre chamadas
// O dispatcher (jsx/host.jsx) re-avalia este arquivo a cada chamada, então
// variáveis locais não sobrevivem de uma chamada para outra. Guardamos apenas
// primitivos em $.global (nenhuma referência de DOM, que poderia ficar velha).
// ---------------------------------------------------------------------------
function fpEstado() {
    var e = null;
    try { e = $.global.__MAZURKY_FACAPLOTTER; } catch (e1) { e = null; }
    if (!e) {
        e = { wd: null, jobs: [], ativoNome: "", uiAnt: -1, uiSalva: false };
        try { $.global.__MAZURKY_FACAPLOTTER = e; } catch (e2) {}
    }
    return e;
}

function fpZerarEstado() {
    var e = fpEstado();
    e.wd = null;
    e.jobs = [];
    e.ativoNome = "";
    e.uiAnt = -1;
    e.uiSalva = false;
}

// ---------------------------------------------------------------------------
// Utilidades de camada / item
// ---------------------------------------------------------------------------
function localizarCamada(d, nome) {
    var camadas = d.layers;
    var n = camadas.length;
    for (var i = 0; i < n; i++) {
        if (trim(camadas[i].name).toUpperCase() === nome) {
            return camadas[i];
        }
    }
    return null;
}

function destravarLayer(layer) {
    try { layer.locked = false; } catch (e) {}
    try { layer.visible = true; } catch (e2) {}
    var subs = layer.layers;
    var n = subs.length;
    for (var s = 0; s < n; s++) {
        destravarLayer(subs[s]);
    }
}

// Move recursivamente TODOS os itens de src (incluindo subcamadas) para dest.
function juntarCamada(src, dest) {
    var subs = [];
    for (var s = 0; s < src.layers.length; s++) subs.push(src.layers[s]);
    for (var s2 = 0; s2 < subs.length; s2++) {
        if (!juntarCamada(subs[s2], dest)) return false;
    }
    var itens = src.pageItems;
    while (itens.length > 0) {
        var it = itens[0];
        try { it.locked = false; } catch (eL) {}
        try { it.hidden = false; } catch (eH) {}
        try {
            it.move(dest, ElementPlacement.PLACEATEND);
        } catch (eM) {
            return false;
        }
        itens = src.pageItems;
    }
    return true;
}

// Duplica recursivamente os itens de uma camada (e subcamadas) para `destino`.
function duplicarItens(layer, destino) {
    var itens = layer.pageItems;
    var n = itens.length;
    for (var i = 0; i < n; i++) {
        var it = itens[i];
        try { it.locked = false; } catch (eL) {}
        try { it.hidden = false; } catch (eH) {}
        try { it.duplicate(destino, ElementPlacement.PLACEATEND); } catch (eD) {}
    }
    var subs = layer.layers;
    var ns = subs.length;
    for (var s = 0; s < ns; s++) {
        duplicarItens(subs[s], destino);
    }
}

// Coleta recursivamente os itens cujo CENTRO cai dentro de `rect`
// [left, top, right, bottom] e acumula o bounds do conjunto em `b`.
function coletarDentro(container, rect, out, b) {
    var itens = container.pageItems;
    var n = itens.length;
    for (var i = 0; i < n; i++) {
        var it = itens[i];
        try {
            var ib = it.geometricBounds;
            var cx = (ib[0] + ib[2]) / 2;
            var cy = (ib[1] + ib[3]) / 2;
            if (cx >= rect[0] && cx <= rect[2] && cy <= rect[1] && cy >= rect[3]) {
                try { it.locked = false; } catch (eL) {}
                try { it.hidden = false; } catch (eH) {}
                out.push(it);
                if (ib[0] < b[0]) b[0] = ib[0];
                if (ib[1] > b[1]) b[1] = ib[1];
                if (ib[2] > b[2]) b[2] = ib[2];
                if (ib[3] < b[3]) b[3] = ib[3];
            }
        } catch (eB) {}
    }
    var subs = container.layers;
    var ns = subs.length;
    for (var s = 0; s < ns; s++) {
        coletarDentro(subs[s], rect, out, b);
    }
    return out;
}

function duplicarLista(lista, destino) {
    var n = lista.length;
    for (var i = 0; i < n; i++) {
        try {
            lista[i].duplicate(destino, ElementPlacement.PLACEATEND);
        } catch (eD) {}
    }
}

function acumularBounds(container, b) {
    var itens = container.pageItems;
    var n = itens.length;
    for (var i = 0; i < n; i++) {
        try {
            var ib = itens[i].geometricBounds;
            if (ib[0] < b[0]) b[0] = ib[0];
            if (ib[1] > b[1]) b[1] = ib[1];
            if (ib[2] > b[2]) b[2] = ib[2];
            if (ib[3] < b[3]) b[3] = ib[3];
        } catch (e) {}
    }
    var subs = container.layers;
    var ns = subs.length;
    for (var s = 0; s < ns; s++) {
        acumularBounds(subs[s], b);
    }
    return b;
}

function boundsDe(container) {
    return acumularBounds(container, [1e18, -1e18, -1e18, 1e18]);
}

function unirBounds(a, b) {
    return [Math.min(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])];
}

function espelharEixo(container, espelho, pb) {
    var e = trim(String(espelho || "").toUpperCase());
    if (e !== "H" && e !== "V") return;
    if (!pb) pb = boundsDe(container);
    var px = (pb[0] + pb[2]) / 2;
    var py = (pb[1] + pb[3]) / 2;
    var sx = e === "V" ? -100 : 100;
    var sy = e === "H" ? -100 : 100;
    var itens = [];
    var lista = container.pageItems;
    var n = lista.length;
    for (var i = 0; i < n; i++) itens.push(lista[i]);
    var subs = container.layers;
    var ns = subs.length;
    for (var s = 0; s < ns; s++) espelharEixo(subs[s], espelho, pb);
    for (var k = 0; k < itens.length; k++) {
        var it = itens[k];
        try {
            var b = it.geometricBounds;
            var ix = (b[0] + b[2]) / 2;
            var iy = (b[1] + b[3]) / 2;
            it.transform(app.getScaleMatrix(sx, sy), true, true, true, true, 1, Transformation.CENTER);
            if (e === "V") it.translate(2 * (px - ix), 0);
            else it.translate(0, 2 * (py - iy));
        } catch (err) {}
    }
}

function apagarItensFora(layer, rect) {
    var itensFora = [];
    var itens = layer.pageItems;
    var n = itens.length;
    for (var pi = 0; pi < n; pi++) {
        var item = itens[pi];
        var deletar = false;
        try {
            var b = item.geometricBounds;
            var cx = (b[0] + b[2]) / 2;
            var cy = (b[1] + b[3]) / 2;
            deletar = !(cx >= rect[0] && cx <= rect[2] && cy <= rect[1] && cy >= rect[3]);
        } catch (e) {
            deletar = true;
        }
        if (deletar) itensFora.push(item);
    }
    for (var k = 0; k < itensFora.length; k++) {
        try { itensFora[k].locked = false; itensFora[k].remove(); } catch (e2) {}
    }
    var subs = layer.layers;
    var ns = subs.length;
    for (var s = 0; s < ns; s++) {
        apagarItensFora(subs[s], rect);
    }
}

// ---------------------------------------------------------------------------
// Documento de trabalho: criado UMA vez, limpo e reaproveitado por prancheta.
// ---------------------------------------------------------------------------
function fpLimparCamadaDestino(camada) {
    try { camada.locked = false; camada.visible = true; } catch (e) {}
    var itens = camada.pageItems;
    while (itens.length > 0) {
        try { itens[0].remove(); } catch (eR) { break; }
        itens = camada.pageItems;
    }
    var subs = camada.layers;
    while (subs.length > 0) {
        try { subs[0].remove(); } catch (eS) { break; }
        subs = camada.layers;
    }
}

function fpSalvarAntes(doc) {
    try {
        var nome = doc.name;
        var ext = nome.substring(nome.lastIndexOf(".")).toLowerCase();
        if (ext === ".pdf") {
            var opt = new PDFSaveOptions();
            opt.compressArt = true;
            doc.saveAs(doc.fullName, opt);
        } else {
            doc.save();
        }
        return 0;
    } catch (e) {
        return -2;
    }
}

// Localiza o documento pelo caminho absoluto. Índices de app.documents NÃO são
// estáveis: outras abas/ferramentas podem abrir e fechar documentos no meio da
// execução, deslocando a posição dos documentos.
function fpDocPorCaminho(caminho) {
    if (!caminho || caminho === "") return null;
    var docs = app.documents;
    for (var i = 0; i < docs.length; i++) {
        var p = "";
        try { p = docs[i].fullName.fsName; } catch (e) { continue; }
        if (p === caminho) return docs[i];
    }
    return null;
}

function fpNomePdf(doc, abNome) {
    var base = doc.name.replace(/\.[^\.]+$/, "");
    return base + " - " + String(abNome).replace(/\s+/g, "_") + " Plotter.pdf";
}

// Monta a lista de documentos conforme o modo escolhido no painel.
function fpMontarLista(modo, docIndices) {
    var lista = [];
    if (modo === 0) {
        lista.push(app.activeDocument);
    } else if (modo === 1) {
        if (docIndices && docIndices.length > 0) {
            for (var i = 0; i < docIndices.length; i++) {
                lista.push(app.documents[docIndices[i]]);
            }
        }
    } else {
        for (var j = 0; j < app.documents.length; j++) {
            lista.push(app.documents[j]);
        }
    }
    return lista;
}

// ---------------------------------------------------------------------------
// Etapa "iniciar": valida, salva (se pedido) e cria o documento de trabalho.
// Devolve { erro:"", jobs:[{di,nome,nAb}] }.
// ---------------------------------------------------------------------------
function fpIniciarJobs(espelho, modo, docIndices, salvarAntes) {
    fpZerarEstado();
    var estado = fpEstado();

    if (app.documents.length === 0) {
        return { erro: "Erro: Nenhum documento aberto.", jobs: [] };
    }

    if (modo === 1 && (!docIndices || docIndices.length === 0)) {
        return { erro: "Erro: Selecione ao menos um documento para processar.", jobs: [] };
    }

    var lista = fpMontarLista(modo, docIndices);

    try { estado.ativoNome = app.activeDocument.name; } catch (eA) {}

    var jobs = [];
    for (var k = 0; k < lista.length; k++) {
        var doc = lista[k];
        app.activeDocument = doc;
        var caminho = "";
        try { caminho = doc.fullName.fsName; } catch (eC) { caminho = ""; }
        if (!caminho || caminho === "") {
            return { erro: "Erro: " + doc.name + ": documento não salvo em disco.", jobs: [] };
        }
        var pastaDoc = null;
        try { pastaDoc = doc.path; } catch (eP0) {}
        if (!pastaDoc || !pastaDoc.exists) {
            return { erro: "Erro: " + doc.name + ": a pasta do arquivo não existe mais (o arquivo foi movido/renomeado no disco?). Feche e reabra o documento e tente de novo.", jobs: [] };
        }
        if (salvarAntes && fpSalvarAntes(doc) !== 0) {
            return { erro: "Erro: " + doc.name + ": falha ao salvar antes de modificar.", jobs: [] };
        }
        if (!localizarCamada(doc, "FACA")) {
            return { erro: "Erro: " + doc.name + ": camada FACA não encontrada.", jobs: [] };
        }
        if (!localizarCamada(doc, "MIRA")) {
            return { erro: "Erro: " + doc.name + ": camada MIRA não encontrada.", jobs: [] };
        }
        jobs.push({ caminho: caminho, nome: doc.name, nAb: doc.artboards.length });
    }

    // Documento de trabalho único (reaproveitado por todas as pranchetas).
    app.activeDocument = lista[0];
    var cs = null;
    try { cs = lista[0].documentColorSpace; } catch (eCS) {}
    var wd = app.documents.add();
    if (cs !== null) {
        try { wd.documentColorSpace = cs; } catch (eCS2) {}
    }
    estado.wd = wd;
    estado.jobs = jobs;

    try { estado.uiAnt = app.userInteractionLevel; estado.uiSalva = true; } catch (eUI) {}
    if (estado.uiSalva) {
        try { app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (eUI2) {}
    }

    return { erro: "", jobs: jobs };
}

// Define a prancheta do documento de trabalho e confere se aplicou. Em alguns
// casos a primeira atribuicao nao "pega" e sobra o artboard padrao (ex.: carta).
function fpDefinirArtboard(wd, rectA) {
    for (var t = 0; t < 4; t++) {
        try { wd.artboards[0].artboardRect = rectA; } catch (e1) {}
        try {
            var cur = wd.artboards[0].artboardRect;
            if (Math.abs(cur[0] - rectA[0]) < 0.5 && Math.abs(cur[1] - rectA[1]) < 0.5 &&
                Math.abs(cur[2] - rectA[2]) < 0.5 && Math.abs(cur[3] - rectA[3]) < 0.5) {
                return true;
            }
        } catch (e2) {}
    }
    return false;
}

// ---------------------------------------------------------------------------
// Etapa "prancheta": gera o PDF de UMA prancheta reusando o doc de trabalho.
// ---------------------------------------------------------------------------
function fpPrancheta(espelho, jobIndex, ab) {
    var estado = fpEstado();
    if (!estado.wd) return "Erro: processo não iniciado.";
    var job = estado.jobs[jobIndex];
    if (!job) return "Erro: trabalho inválido.";

    var doc = fpDocPorCaminho(job.caminho);
    if (!doc) return "Erro: documento de origem não encontrado (fechado?).";
    var wd = estado.wd;

    // ---- 1) FONTE ATIVA: ler, destravar e coletar o que pertence à prancheta
    app.activeDocument = doc;

    var rectA = null;
    var abNome = "";
    try {
        rectA = doc.artboards[ab].artboardRect.slice();
        abNome = doc.artboards[ab].name;
    } catch (eR) {
        return "Erro: falha ao ler a prancheta " + (ab + 1) + ".";
    }
    if (!abNome || abNome === "") abNome = "pagina" + (ab + 1);

    var c1 = localizarCamada(doc, "FACA");
    var c2 = localizarCamada(doc, "MIRA");
    if (!c1) return "Erro: camada FACA não encontrada.";
    if (!c2) return "Erro: camada MIRA não encontrada.";
    try { destravarLayer(c1); destravarLayer(c2); } catch (eDL) {}

    // Coleta por geometria: varre a camada inteira (inclusive subcamadas) e fica
    // com os itens cujo CENTRO cai na prancheta. O nome das subcamadas da MIRA
    // pode estar defasado em relacao as pranchetas; por isso NAO usamos nome.
    var lista = [];
    var bSrc = [1e18, -1e18, -1e18, 1e18];
    coletarDentro(c1, rectA, lista, bSrc);
    coletarDentro(c2, rectA, lista, bSrc);

    var destino = null;
    try { destino = wd.layers[0]; } catch (eL) { return "Erro: falha ao acessar o documento de trabalho."; }

    duplicarLista(lista, destino);

    // ---- 2) DESTINO ATIVO: trazer para a origem, espelhar, salvar
    // As pranchetas de origem podem ter coordenadas negativas, e o Illustrator
    // recusa definir um artboard negativo num documento novo (erro 'AOoC').
    // Entao transladamos o conteudo para a origem e usamos um artboard positivo.
    app.activeDocument = wd;

    // Duplicar entre documentos desloca o conteudo; alinha de volta as
    // coordenadas da origem e, em seguida, traz para a origem (0,0). Tudo num
    // unico translate para nao perder o conteudo no recorte por prancheta.
    var bDst = boundsDe(destino);
    var tx = -((bDst[0] - bSrc[0]) + rectA[0]);
    var ty = -((bDst[1] - bSrc[1]) + rectA[3]);
    if (isFinite(tx) && isFinite(ty) && Math.abs(tx) < 1e15 && Math.abs(ty) < 1e15) {
        var dItens = destino.pageItems;
        var nd = dItens.length;
        for (var q = 0; q < nd; q++) {
            try { dItens[q].translate(tx, ty); } catch (eT) {}
        }
    }
    var rectDest = [0, rectA[1] - rectA[3], rectA[2] - rectA[0], 0];

    apagarItensFora(destino, rectDest);
    espelharEixo(destino, espelho, boundsDe(destino));

    fpDefinirArtboard(wd, rectDest);

    var caminho = "";
    var pastaDest = null;
    try { pastaDest = doc.path; caminho = pastaDest.fsName; } catch (eP) { caminho = ""; }
    if (!caminho || caminho === "") return "Erro: falha ao ler a pasta de destino.";
    if (!pastaDest || !pastaDest.exists) {
        return "Erro: a pasta do arquivo não existe mais (movido/renomeado no disco?). Feche e reabra o documento.";
    }

    var arquivoPdf = new File(caminho + "/" + fpNomePdf(doc, abNome));
    try {
        var opt = new PDFSaveOptions();
        opt.compressArt = true;
        wd.saveAs(arquivoPdf, opt);
    } catch (eS) {
        return "Erro: falha ao gerar o PDF da prancheta " + (ab + 1) + ".";
    }

    // Limpa o destino para a próxima prancheta (wd segue ativo: custo ~0).
    fpLimparCamadaDestino(destino);
    return "OK";
}

// ---------------------------------------------------------------------------
// Etapa "finalizar": fecha o documento de trabalho, restaura o ativo e salva
// a configuração.
// ---------------------------------------------------------------------------
function fpFinalizar(espelho, modo, reabrir, salvarAntes, porArtboard, salvarCfg) {
    var estado = fpEstado();
    if (estado.uiSalva) {
        try { app.userInteractionLevel = estado.uiAnt; } catch (eUI) {}
    }
    if (estado.wd) {
        try { estado.wd.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
    }
    if (estado.ativoNome) {
        var docs = app.documents;
        for (var i = 0; i < docs.length; i++) {
            var nm = "";
            try { nm = docs[i].name; } catch (e2) { continue; }
            if (nm === estado.ativoNome) {
                try { app.activeDocument = docs[i]; } catch (e3) {}
                break;
            }
        }
    }
    if (salvarCfg !== false) {
        salvarConfig({ espelho: espelho, modo: modo, reabrir: !!reabrir, salvarAntes: !!salvarAntes, porArtboard: !!porArtboard });
    }
    fpZerarEstado();
    return "OK";
}

// ---------------------------------------------------------------------------
// Modo "PDF único" (porArtboard = false): mantém o comportamento antigo, mas
// ativando o documento antes de mexer nele.
// ---------------------------------------------------------------------------
function fpPdfUnico(espelho, salvarAntes, reabrirOriginal, artboardIndex) {
    var doc = app.activeDocument;
    var N1 = "FACA", N2 = "MIRA";

    var caminhoOriginal = "";
    try { caminhoOriginal = doc.fullName.fsName; } catch (e0) { caminhoOriginal = ""; }
    var nomeOriginal = doc.name;

    if (!caminhoOriginal || caminhoOriginal === "") return -1;

    // ---- SALVAR ORIGINAL (BACKUP DE SEGURANCA) ----
    if (salvarAntes) {
        if (fpSalvarAntes(doc) !== 0) return -2;
    }

    var c1 = localizarCamada(doc, N1);
    var c2 = localizarCamada(doc, N2);
    if (!c1) return -5;
    if (!c2) return -6;

    c1.locked = false; c1.visible = true;
    c2.locked = false; c2.visible = true;
    destravarLayer(c1);
    destravarLayer(c2);

    // Remover as demais camadas (trabalha no documento em memoria)
    var camadas = doc.layers;
    for (var i = 0; i < camadas.length; i++) {
        var L = camadas[i];
        if (L !== c1 && L !== c2) {
            try { L.locked = false; L.visible = true; L.remove(); } catch (e) {}
            i--;
        }
    }

    var usouArtboardIdx = false;
    if (typeof artboardIndex === "number" && artboardIndex >= 0 && artboardIndex < doc.artboards.length) {
        usouArtboardIdx = true;
    }

    // Move a camada MIRA inteira (todas as subcamadas) para a FACA; o recorte por
    // prancheta e feito por geometria em apagarItensFora, sem depender do nome
    // defasado das subcamadas.
    if (!juntarCamada(c2, c1)) return -9;
    try { c2.remove(); } catch (e) {}

    if (usouArtboardIdx) {
        var rectSel = doc.artboards[artboardIndex].artboardRect;
        apagarItensFora(c1, rectSel);
        for (var ai = doc.artboards.length - 1; ai >= 0; ai--) {
            if (ai !== artboardIndex) {
                try { doc.artboards[ai].remove(); } catch (ep) {}
            }
        }
    }

    espelharEixo(c1, espelho, boundsDe(c1));

    var pasta = doc.path;
    if (!pasta || pasta === "" || !pasta.exists) return -1;
    var nomeBase = doc.name.replace(/\.[^\.]+$/, "");
    var nomePdf;
    if (usouArtboardIdx) {
        var abNome = doc.artboards[0].name;
        if (!abNome || abNome === "") abNome = "pagina" + (artboardIndex + 1);
        nomePdf = nomeBase + " - " + abNome.replace(/\s+/g, "_") + " Plotter.pdf";
    } else {
        nomePdf = nomeBase + " - Plotter.pdf";
    }
    var arquivoPdf = new File(pasta + "/" + nomePdf);

    try {
        var opt = new PDFSaveOptions();
        opt.compressArt = true;
        doc.saveAs(arquivoPdf, opt);
    } catch (e) {
        return -4;
    }

    doc.close(SaveOptions.DONOTSAVECHANGES);
    try { app.open(arquivoPdf); } catch (e) {}

    if (reabrirOriginal) {
        try { app.open(new File(caminhoOriginal)); } catch (e2) { return -8; }
    }

    return 1;
}

function fpMotivoErro(res) {
    if (res === -1) return "documento não salvo em disco";
    if (res === -2) return "falha ao salvar antes de modificar";
    if (res === -4) return "falha ao gerar PDF";
    if (res === -5) return "camada FACA não encontrada";
    if (res === -6) return "camada MIRA não encontrada";
    if (res === -7) return "falha ao agrupar itens";
    if (res === -8) return "falha ao reabrir original";
    if (res === -9) return "falha ao juntar as camadas FACA e MIRA";
    return "código " + res;
}

// ---------------------------------------------------------------------------
// Entrada da ferramenta
// ---------------------------------------------------------------------------
function executar(espelho, modo, docIndices, reabrir, salvarAntes, porArtboard, artboardIndex, etapa, dados) {
    try {
        if (espelho !== "H" && espelho !== "V" && espelho !== "N") espelho = "N";

        if (etapa === "iniciar") {
            var r = fpIniciarJobs(espelho, modo, docIndices, salvarAntes);
            if (r.erro) return r.erro;
            // "OK|j0:nAb0|j1:nAb1|..." (índice do trabalho + nº de pranchetas)
            var partes = [];
            for (var i = 0; i < r.jobs.length; i++) partes.push(i + ":" + r.jobs[i].nAb);
            return "OK|" + partes.join("|");
        }

        if (etapa === "prancheta") {
            if (!dados) return "Erro: dados da prancheta ausentes.";
            return fpPrancheta(espelho, dados.job, dados.ab);
        }

        if (etapa === "finalizar") {
            return fpFinalizar(espelho, modo, reabrir, salvarAntes, porArtboard, true);
        }

        if (etapa === "cancelar") {
            return fpFinalizar(espelho, modo, reabrir, salvarAntes, porArtboard, false);
        }

        // ---- chamada única (compatibilidade) ----
        if (app.documents.length === 0) {
            return "Erro: Nenhum documento aberto.";
        }

        if (!porArtboard) {
            if (modo === 1 && (!docIndices || docIndices.length === 0)) {
                return "Erro: Selecione ao menos um documento para processar.";
            }
            var listaU = fpMontarLista(modo, docIndices);
            var ativoNomeU = "";
            try { ativoNomeU = app.activeDocument.name; } catch (eAU) {}
            var resultadosU = "";
            var houveErroU = false;
            for (var u = 0; u < listaU.length; u++) {
                var docU = listaU[u];
                app.activeDocument = docU;
                var nomeU = docU.name;
                var resU = fpPdfUnico(espelho, salvarAntes, reabrir, artboardIndex);
                if (resU === 1) {
                    resultadosU += nomeU + ": OK\n";
                } else {
                    houveErroU = true;
                    resultadosU += nomeU + ": ERRO - " + fpMotivoErro(resU) + "\n";
                }
            }
            // Restaura o documento que estava ativo (quando ainda existir)
            if (ativoNomeU) {
                var docsU = app.documents;
                for (var v = 0; v < docsU.length; v++) {
                    var nmU = "";
                    try { nmU = docsU[v].name; } catch (eV) { continue; }
                    if (nmU === ativoNomeU) {
                        try { app.activeDocument = docsU[v]; } catch (eV2) {}
                        break;
                    }
                }
            }
            salvarConfig({ espelho: espelho, modo: modo, reabrir: !!reabrir, salvarAntes: !!salvarAntes, porArtboard: !!porArtboard });
            return (houveErroU ? "Erro: " : "") + resultadosU;
        }

        // por prancheta: roda tudo de uma vez (sem progresso na UI)
        var ri = fpIniciarJobs(espelho, modo, docIndices, salvarAntes);
        if (ri.erro) return ri.erro;
        var resultados = "";
        var houveErro = false;
        for (var j = 0; j < ri.jobs.length; j++) {
            var job = ri.jobs[j];
            var erros = "";
            for (var a = 0; a < job.nAb; a++) {
                var rp = fpPrancheta(espelho, j, a);
                if (rp !== "OK") {
                    houveErro = true;
                    erros += job.nome + " [prancheta " + (a + 1) + "]: " + rp + "\n";
                }
            }
            resultados += erros;
            if (erros === "") resultados += job.nome + ": OK\n";
        }
        fpFinalizar(espelho, modo, reabrir, salvarAntes, porArtboard, true);
        return (houveErro ? "Erro: " : "") + resultados;
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}
