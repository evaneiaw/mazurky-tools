// gerarlayout.jsx — Parte 2 do Gerar Layout: abre o modelo .ait e preenche.
// Recebe do painel: '{"trocas":{"1":"valor",...}}' (tokens vindos do
// modelo/mapeamento.txt; "00" = ignorado e nem chega aqui).
// Regras fixas do template (sempre aplicadas):
//   OBS       -> "" (limpa)
//   _revisao  -> "00"
//   _data     -> data de hoje (dd/mm/aaaa, momento da criação)
// Retorna: "ok|<nTrocas>|<tokensNãoEncontrados>|<nomeDoc>" ou "erro|<motivo>"

function gerarLayoutRaiz() {
    var base = "";
    try {
        if (__mazurkyRaiz) base = normalizarRaiz(__mazurkyRaiz);
    } catch (e) {}
    if (!base) {
        try {
            base = normalizarRaiz(new File($.fileName).parent.parent.parent.fsName);
        } catch (e2) {}
    }
    return base;
}

function gerarLayoutDataHoje() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
}

function gerarLayoutColetar(item, lista) {
    if (!item) return;
    try {
        if (item.typename === "TextFrame") {
            lista.push(item);
            return;
        }
        if (item.typename === "GroupItem") {
            for (var i = 0; i < item.pageItems.length; i++) {
                gerarLayoutColetar(item.pageItems[i], lista);
            }
        }
    } catch (e) {}
}

function gerarLayoutEscapeReg(s) {
    return String(s).replace(/([\\^$.*+?()[\]{}|])/g, "\\$1");
}

// Achata todas as layers em uma só chamada "layout".
// Chamar SOMENTE depois das substituições.
function gerarLayoutAchatar(doc) {
    var alvo = null;
    try {
        alvo = doc.layers.getByName("layout");
    } catch (e) {}
    if (!alvo) {
        alvo = doc.layers.add();
        alvo.name = "layout";
    }
    var i;
    try {
        alvo.locked = false;
        alvo.visible = true;
    } catch (eAlvo) {}
    for (i = doc.layers.length - 1; i >= 0; i--) {
        var ly = doc.layers[i];
        if (ly === alvo) continue;
        try {
            ly.locked = false;
            ly.visible = true;
            while (ly.pageItems.length > 0) {
                ly.pageItems[0].move(alvo, ElementPlacement.PLACEATEND);
            }
        } catch (eMove) {}
        try {
            if (ly.pageItems.length === 0) ly.remove();
        } catch (eDel) {}
    }
    return alvo.name;
}

function executar(dadosStr) {
    var dados = null;
    try {
        dados = eval("(" + String(dadosStr) + ")");
    } catch (e) {
        return "erro|payload inválido";
    }
    var trocas = (dados && dados.trocas) ? dados.trocas : {};

    // Regras fixas do template.
    trocas["_data"] = gerarLayoutDataHoje();
    trocas["_revisao"] = "00";
    trocas["OBS"] = "";

    var tokens = [];
    for (var t in trocas) {
        if (Object.prototype.hasOwnProperty.call(trocas, t)) tokens.push(t);
    }
    if (!tokens.length) return "erro|sem trocas";
    // Mais longos primeiro: evita "1" casar dentro de "11".
    tokens.sort(function (a, b) { return b.length - a.length; });
    var padrao = [];
    for (var k = 0; k < tokens.length; k++) padrao.push(gerarLayoutEscapeReg(tokens[k]));
    var rx = new RegExp(padrao.join("|"), "g");

    var arq = new File(gerarLayoutRaiz() + "/convertidos/gerarLayout/modelo/Layout_Novo.ait");
    if (!arq.exists) return "erro|modelo não encontrado";
    var doc = null;
    try {
        doc = app.open(arq);
    } catch (eOpen) {
        return "erro|falha ao abrir modelo";
    }

    var frames = [];
    var li, pi;
    try {
        for (li = 0; li < doc.layers.length; li++) {
            var ly = doc.layers[li];
            if (!ly.visible || ly.locked) continue;
            for (pi = 0; pi < ly.pageItems.length; pi++) {
                gerarLayoutColetar(ly.pageItems[pi], frames);
            }
        }
    } catch (eWalk) {
        return "erro|falha ao varrer documento";
    }

    var vistos = {};
    var nTrocas = 0;
    for (var fi = 0; fi < frames.length; fi++) {
        var fr = frames[fi];
        var antes = null;
        try {
            if (fr.locked || fr.hidden) continue;
            antes = fr.contents;
        } catch (eGet) {
            continue;
        }
        if (antes === undefined || antes === null) continue;
        var achados = String(antes).match(rx);
        if (!achados) continue;
        var depois = String(antes).replace(rx, function (m) { return trocas[m]; });
        try {
            fr.contents = depois;
        } catch (eSet) {
            continue;
        }
        nTrocas++;
        for (var mi = 0; mi < achados.length; mi++) vistos[achados[mi]] = true;
    }

    var faltando = [];
    for (var ti = 0; ti < tokens.length; ti++) {
        if (!vistos[tokens[ti]]) faltando.push(tokens[ti]);
    }

    // Só achata depois de fazer as substituições.
    try {
        gerarLayoutAchatar(doc);
    } catch (eFlat) {
        return "erro|falha ao achatar layers";
    }

    // Trava a layer layout e cria a layer arte (ativa).
    try {
        var layLayout = null;
        try {
            layLayout = doc.layers.getByName("layout");
        } catch (eLayGet) {}
        if (layLayout) layLayout.locked = true;
        var layArte = null;
        try {
            layArte = doc.layers.getByName("arte");
        } catch (eArteGet) {}
        if (!layArte) {
            layArte = doc.layers.add();
            layArte.name = "arte";
        }
        layArte.locked = false;
        layArte.visible = true;
        doc.activeLayer = layArte;
    } catch (eArte) {
        return "erro|falha ao criar layer arte";
    }

    // Por fim: zoom igual ao Ctrl+0 (ajustar prancheta na janela).
    try {
        app.executeMenuCommand("fitin");
    } catch (eZoom) {}

    var nomeDoc = "";
    try {
        nomeDoc = doc.name;
    } catch (eName) {}
    return "ok|" + nTrocas + "|" + faltando.join(",") + "|" + nomeDoc;
}

function gerarLayoutPing() {
    return "ok";
}
