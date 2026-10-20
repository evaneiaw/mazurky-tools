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

// Orientação retrato: artboard A4 retrato (210x297mm), agrupa todo o conteúdo
// da layer "layout", reduz proporcionalmente para 200mm de largura e encaixa
// no topo (5mm) e centralizado. Paisagem (padrão) não altera nada.
var GL_MM = 2.834645669291339;

function gerarLayoutOrientacao(doc, orientacao) {
    if (String(orientacao).toLowerCase() !== "retrato") return "paisagem";
    var idx = 0;
    try { idx = doc.artboards.getActiveArtboardIndex(); } catch (eIdx) { idx = 0; }
    var ab = doc.artboards[idx].artboardRect;
    var larguraArt = 210 * GL_MM;
    var alturaArt = 297 * GL_MM;
    try {
        doc.artboards[idx].artboardRect = [ab[0], ab[1], ab[0] + larguraArt, ab[1] - alturaArt];
    } catch (eArt) {
        return "paisagem";
    }

    var lay = null;
    try { lay = doc.layers.getByName("layout"); } catch (eLay) {}
    if (!lay) return "retrato";
    try {
        lay.locked = false;
        lay.visible = true;
    } catch (eUl) {}

    var i;
    for (i = 0; i < lay.pageItems.length; i++) {
        try { lay.pageItems[i].locked = false; } catch (eLock) {}
    }

    var grupo = null;
    try { grupo = lay.groupItems.add(); } catch (eGrp) { return "retrato"; }
    for (i = lay.pageItems.length - 1; i >= 0; i--) {
        var it = lay.pageItems[i];
        if (it === grupo) continue;
        try { it.move(grupo, ElementPlacement.INSIDE); } catch (eMove) {}
    }

    var larguraG = 0;
    try { larguraG = grupo.width; } catch (eW) { larguraG = 0; }
    if (larguraG > 0) {
        var pct = (200 * GL_MM) / larguraG * 100;
        try { grupo.resize(pct, pct); } catch (eResize) {}
    }

    var ab2 = doc.artboards[idx].artboardRect;
    var larguraFinal = 0;
    try { larguraFinal = grupo.width; } catch (eW2) { larguraFinal = 0; }
    var destinoEsq = ab2[0] + (larguraArt - larguraFinal) / 2;
    var destinoTopo = ab2[1] - 5 * GL_MM;
    try { grupo.position = [destinoEsq, destinoTopo]; } catch (ePos) {}

    return "retrato";
}

function executar(dadosStr) {
    var dados = null;
    try {
        dados = eval("(" + String(dadosStr) + ")");
    } catch (e) {
        return "erro|payload inválido";
    }
    var trocas = (dados && dados.trocas) ? dados.trocas : {};
    var orientacao = (dados && dados.orientacao) ? String(dados.orientacao) : "paisagem";

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

    var arq = new File(gerarLayoutRaiz() + "/convertidos/gerarLayout-ft/modelo/Layout_Novo.ait");
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

    // Orientação: em retrato, redimensiona a artboard/agrupa antes de travar.
    var orientacaoAplicada = "paisagem";
    try {
        orientacaoAplicada = gerarLayoutOrientacao(doc, orientacao);
    } catch (eOrient) {
        orientacaoAplicada = "paisagem";
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
    return "ok|" + nTrocas + "|" + faltando.join(",") + "|" + nomeDoc + "|" + orientacaoAplicada;
}

function gerarLayoutPing() {
    return "ok";
}
