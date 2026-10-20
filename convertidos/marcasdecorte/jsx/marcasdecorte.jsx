// marcasdecorte.jsx — lógica ExtendScript da ferramenta Marcas de Corte

var the_title = "MakeCropMarksAI";
var the_version = "1.4.16";
var AD;
var AA;
var N_AB = 1;
var AL;
var SL;
var AD_LL;
var the_sel;
var N_sel = 0;
var N_dir = 4;
var N_c = 2;
var N_b = 2;
var N_dir_b = N_dir * N_b;
var SEL_SIZE;
var OBJ_SIZE;
var CLIP = false;
var CLIP_CB_VAL = false;
var exit_if_bad_sel = false;
var exit_if_bad_input = false;
var exit_if_guide = false;
var TF_guides = false;
var COLOR_VAL = 0;
var SWATCHES = new Array();
var M_COLOR;
var WHITE;
var BOUNDS_LIST =
[
	"Geométrico",
	"Visível (considerar traços e efeitos)"
];
var BOUNDS_INI;
var ALL_MARKS = new Array();
var ALL_MARKS_BOUNDS = new Array();
var N_dir_dial = 12;
var DIR_INI = new Array( N_dir_dial );
var W_CONT_INI;
var G_M_INI;
var G_M_LIST =
[
	"Nada",
	"Apenas marcas"
];
var G_AUTO = false;
var LENGTH_VER;
var LENGTH_VER_INI;
var LENGTH_HOR;
var LENGTH_HOR_INI;
var OFFSET_VER;
var OFFSET_VER_INI;
var OFFSET_HOR;
var OFFSET_HOR_INI;
var BLEED_VER;
var BLEED_VER_INI;
var BLEED_HOR;
var BLEED_HOR_INI;
var SW_NUM;
var SW_NUM_INI;
var SW_UN_INI;
var WFS = ( File.fs == "Windows" );
var CC = ( parseInt( app.version ) >= 17 );
var SEL_OBJ_OPTION = "Objeto selecionado";
var EACH_OBJ_OPTION = "Cada objeto na seleção";
var ENTIRE_SEL_OPTION = "Seleção inteira";
var AA_OPTION = "Prancha";
var EACH_AB_OPTION = "Cada prancha no documento";
var OBJECTS_TO_MAKE;
var BAD_VAL_TEXT = "Valor inválido!\n\n";
var CAN_NOT_BE = " não pode ser <= 0 !";
var UNITS_LIST =
[
	"mm",
	"cm",
	"pt",
	"in"
];
var UNITS_INDEX = 0;
var UNITS_TEXT = UNITS_LIST[ UNITS_INDEX ];
var REM_DIR = false;
var CONS_OVER = true;
var OBJ_i = 0;
var PREC_MARKS_OBJ = 0.002;
var PREC_MARKS = PREC_MARKS_OBJ * 2.5;
var ZERO_TEXT = "0";

function listarCores() {
    try {
        if (app.documents.length < 1) return "";
        var d = app.activeDocument;
        var nomes = [ "Registro (Auto)" ];
        for (var i = 0; i < d.swatches.length; i++) {
            nomes.push( d.swatches[i].name );
        }
        return nomes.join("|");
    } catch (e) {
        return "Registro (Auto)";
    }
}

function listarCamadas() {
    try {
        if (app.documents.length < 1) return "NOVA CAMADA";
        var d = app.activeDocument;
        var nomes = [ "NOVA CAMADA" ];
        for (var i = 0; i < d.layers.length; i++) {
            nomes.push( d.layers[i].name );
        }
        return nomes.join("|");
    } catch (e) {
        return "NOVA CAMADA";
    }
}

function listarOpcoesObjetos() {
    var err = CHECK_SELECTION();
    if (err) return "ERRO:" + err;
    var OBJECTS_ARR = new Array();
    if (N_AB > 1) OBJECTS_ARR.push( EACH_AB_OPTION );
    OBJECTS_ARR.push( AA_OPTION );
    if (N_sel == 1) OBJECTS_ARR.push( SEL_OBJ_OPTION );
    if (N_sel > 1)
    {
        OBJECTS_ARR.push( ENTIRE_SEL_OPTION );
        OBJECTS_ARR.push( EACH_OBJ_OPTION );
    }
    OBJECTS_ARR.reverse();
    return OBJECTS_ARR.join("|");
}

function getMarcasPrefs() {
    var err = CHECK_SELECTION();
    if (err) return '{"erro":"' + err.replace(/"/g, '\\"') + '"}';
    INI_FILE_IO( false );
    var dirs = [];
    for (var i = 0; i < N_dir_dial; i++) dirs.push( DIR_INI[i] ? true : false );
    var obj = [];
    obj.push( '"nSel":' + N_sel );
    obj.push( '"nAB":' + N_AB );
    obj.push( '"hasClip":' + ( CLIP ? "true" : "false" ) );
    obj.push( '"unidadesIndex":' + UNITS_INDEX );
    obj.push( '"compVer":"' + (LENGTH_VER_INI !== undefined ? LENGTH_VER_INI : "5") + '"' );
    obj.push( '"compHor":"' + (LENGTH_HOR_INI !== undefined ? LENGTH_HOR_INI : "5") + '"' );
    obj.push( '"distVer":"' + (OFFSET_VER_INI !== undefined ? OFFSET_VER_INI : "2") + '"' );
    obj.push( '"distHor":"' + (OFFSET_HOR_INI !== undefined ? OFFSET_HOR_INI : "2") + '"' );
    obj.push( '"sangVer":"' + (BLEED_VER_INI !== undefined ? BLEED_VER_INI : "0") + '"' );
    obj.push( '"sangHor":"' + (BLEED_HOR_INI !== undefined ? BLEED_HOR_INI : "0") + '"' );
    obj.push( '"espessura":"' + (SW_NUM_INI !== undefined ? SW_NUM_INI : "0.25") + '"' );
    obj.push( '"espessuraUnidadesIndex":' + (SW_UN_INI !== undefined ? SW_UN_INI : 2) );
    obj.push( '"contornoBranco":' + ( W_CONT_INI ? "true" : "false" ) );
    obj.push( '"agruparIndex":' + (G_M_INI !== undefined ? G_M_INI : 0) );
    obj.push( '"limitesIndex":' + (BOUNDS_INI !== undefined ? BOUNDS_INI : 0) );
    obj.push( '"remDir":' + ( REM_DIR ? "true" : "false" ) );
    obj.push( '"dirs":[' + dirs.join(",") + ']' );
    obj.push( '"objetos":["' + listarOpcoesObjetos().split("|").join('","') + '"]' );
    return "{" + obj.join(",") + "}";
}

function executar(dirs, remDir, consOver, compVer, compHor, distVer, distHor, sangVer, sangHor, unidadesIndex, clipMascara, espessura, espessuraUnidadesIndex, agruparIndex, corIndex, contornoBranco, objetosText, limitesIndex, camadaIndex) {
    try {
        var err = CHECK_SELECTION();
        if (err) return "Erro: " + err;

        INI_FILE_IO( false );

        BAD_VAL_TEXT = "Valor inválido!\n\n";
        G_AUTO = false;
        ALL_MARKS = new Array();
        ALL_MARKS_BOUNDS = new Array();

        UNITS_INDEX = (unidadesIndex === undefined) ? UNITS_INDEX : unidadesIndex;
        if (UNITS_INDEX < 0 || UNITS_INDEX > 3) UNITS_INDEX = 0;
        UNITS_TEXT = UNITS_LIST[ UNITS_INDEX ];

        for (var i = 0; i < N_dir_dial; i++)
        {
            DIR_INI[i] = ( dirs && dirs[i] ) ? true : false;
        }
        REM_DIR = remDir ? true : false;
        CONS_OVER = consOver ? true : false;

        LENGTH_VER_INI = String( compVer );
        LENGTH_VER = TEXT_AS_POINTS( LENGTH_VER_INI, UNITS_TEXT );
        LENGTH_HOR_INI = String( compHor );
        LENGTH_HOR = TEXT_AS_POINTS( LENGTH_HOR_INI, UNITS_TEXT );
        OFFSET_VER_INI = String( distVer );
        OFFSET_VER = TEXT_AS_POINTS( OFFSET_VER_INI, UNITS_TEXT );
        OFFSET_HOR_INI = String( distHor );
        OFFSET_HOR = TEXT_AS_POINTS( OFFSET_HOR_INI, UNITS_TEXT );
        BLEED_VER_INI = String( sangVer );
        BLEED_VER = TEXT_AS_POINTS( BLEED_VER_INI, UNITS_TEXT );
        BLEED_HOR_INI = String( sangHor );
        BLEED_HOR = TEXT_AS_POINTS( BLEED_HOR_INI, UNITS_TEXT );

        SW_UN_INI = (espessuraUnidadesIndex === undefined) ? 2 : espessuraUnidadesIndex;
        if (SW_UN_INI < 0 || SW_UN_INI > 3) SW_UN_INI = 2;
        SW_NUM_INI = String( espessura );
        SW_NUM = TEXT_AS_POINTS( SW_NUM_INI, UNITS_LIST[ SW_UN_INI ] );

        var BAD_VAL_L = ( LE_ZERO( LENGTH_VER ) || LE_ZERO( LENGTH_HOR ) );
        if ( BAD_VAL_L )
        {
            BAD_VAL_TEXT = BAD_VAL_TEXT + "Comprimento da marca" + CAN_NOT_BE + "\n";
        }
        var BAD_SW = LE_ZERO( SW_NUM );
        if ( BAD_SW )
        {
            BAD_VAL_TEXT = BAD_VAL_TEXT + "Espessura do traço" + CAN_NOT_BE + "\n";
        }
        if ( BAD_VAL_L || BAD_SW )
        {
            return BAD_VAL_TEXT;
        }

        COLOR_VAL = (corIndex === undefined) ? 0 : corIndex;
        W_CONT_INI = contornoBranco ? true : false;
        G_M_INI = (agruparIndex === undefined) ? 0 : agruparIndex;
        if (G_M_INI < 0 || G_M_INI > 2) G_M_INI = 0;
        BOUNDS_INI = ( N_sel > 0 ) ? ((limitesIndex === undefined) ? 0 : limitesIndex) : BOUNDS_INI;
        if (BOUNDS_INI < 0 || BOUNDS_INI > 1) BOUNDS_INI = 0;
        OBJECTS_TO_MAKE = (objetosText === undefined) ? AA_OPTION : String( objetosText );

        if (G_M_INI == 2 && N_sel == 0)
        {
            G_M_INI = 1;
            G_AUTO = true;
        }

        var LAYER_INDEX = (camadaIndex === undefined) ? 0 : camadaIndex;
        if ( LAYER_INDEX == 0 )
        {
            SL = AD.layers.add();
            SL.name = "Marcas de Corte";
            SL.locked = false;
            SL.visible = true;
            SL.zOrder( ZOrderMethod.BRINGTOFRONT );
        }
        else
        {
            SL = AD.layers[ LAYER_INDEX - 1 ];
        }

        if ( CLIP ) CLIP_CB_VAL = clipMascara ? true : false;
        REM_DIR = remDir ? true : false;
        CONS_OVER = consOver ? true : false;

        var opMsg = OPERATION();
        INI_FILE_IO( true );
        if ( opMsg ) return opMsg;
        return "Marcas de corte criadas com sucesso!";
    } catch (e) {
        var linhaErro = e.line ? " na linha " + e.line : "";
        return "Erro ao executar o script: " + (e.message || String(e)) + linhaErro;
    }
}

function CHECK_SELECTION()
{
    SEL_OBJ_OPTION = "Objeto selecionado";
    EACH_OBJ_OPTION = "Cada objeto na seleção";
    ENTIRE_SEL_OPTION = "Seleção inteira";
    AA_OPTION = "Prancha";
    EACH_AB_OPTION = "Cada prancha no documento";
    SWATCHES = new Array();
    exit_if_bad_sel = false;
    exit_if_guide = false;
    TF_guides = false;

    if( app.documents.length < 1 )
    {
        return "Não há documentos abertos!";
    }
    AD = app.activeDocument;
    the_sel = AD.selection;
    N_sel = the_sel.length;
    AL = AD.activeLayer;
    SL = AL;
    AD_LL = AD.layers.length;
    SELECTION_DIM();
    if( exit_if_guide )
    {
        var TF_guides_STR = TF_guides ? "\ne/ou molduras de texto com caminho de texto convertido em guia" : "";
        return "Há guias selecionadas" + TF_guides_STR + "!\nNão é possível processar!";
    }
    if( exit_if_bad_sel )
    {
        return "Não é possível processar a seleção!";
    }
    UNITS_INDEX = GET_DOC_UNITS_INDEX();
    UNITS_TEXT = UNITS_LIST[ UNITS_INDEX ];
    EACH_OBJ_OPTION = EACH_OBJ_OPTION + " ("+N_sel+" objetos)";
    try
    {
        if( AD.hasOwnProperty("artboards") )
        {
            N_AB = AD.artboards.length;
            if( N_AB > 1 )
            {
                var AA_INDEX = AD.artboards.getActiveArtboardIndex();
                AA = AD.artboards[ AA_INDEX ];
                AA_OPTION = "Prancha ativa";
                if( AA.hasOwnProperty("name") )
                {
                    AA_OPTION = AA_OPTION + " ("+ unescape( AA.name ) + ")";
                }
                else
                {
                    AA_OPTION = AA_OPTION + " (Prancha "+ ( AA_INDEX +1 ).toString() + ")";
                }
                EACH_AB_OPTION = EACH_AB_OPTION + " ("+N_AB+" itens)";
            }
        }
    } catch ( error ) {}
    SWATCHES.push( "Registro (Auto)" );
    for( var i = 0; i < AD.swatches.length; i++)
    {
        SWATCHES.push( AD.swatches[i].name );
    }
    return "";
}

function COMPARE_BOUNDS( dir, i, m, b_i )
{
    var s = b_i;
    if( i != 0 )
    {
        s = ( (dir == 0) || (dir == 3) ) ? Math.min( m, b_i ) : Math.max( m, b_i );
    }
    return s;
}

function CLIP_BOUNDS( the_obj )
{
    if( exit_if_bad_sel ) return;
    var B = new Array( N_dir_b );
    var N_CLIP = 0;

    function GET_SIZE_BY_CLIP( OBJ )
    {
        for( var dir = 0; dir < N_dir; dir++ )
        {
            B[dir] = COMPARE_BOUNDS( dir, N_CLIP, B[dir], OBJ.geometricBounds[dir] );
            B[dir+N_dir] = COMPARE_BOUNDS( dir, N_CLIP, B[dir+N_dir], OBJ.visibleBounds[dir] );
        }
        if( N_CLIP == 0 ) N_CLIP++;
        return;
    }

    function GET_CLIP_OBJECTS( the_obj )
    {
        if( IS_GUIDE( the_obj ) ) return;
        if( the_obj.constructor.name == "GroupItem" )
        {
            if( the_obj.clipped )
            {
                try
                {
                    GET_SIZE_BY_CLIP( the_obj.pageItems[0] );
                    if( GUIDES_IN_OBJ( the_obj ) ) return;
                } catch ( error ) {};
                return;
            }
            try
            {
                for( var i = 0; i < the_obj.pageItems.length; i++ )
                {
                    GET_CLIP_OBJECTS( the_obj.pageItems[i] );
                }
            } catch (error) {};
            return;
        }
        GET_SIZE_BY_CLIP( the_obj );
        return;
    }

    GET_CLIP_OBJECTS( the_obj );
    return [ [ B[0], B[1], B[2], B[3] ], [ B[4], B[5], B[6], B[7] ] ];
}

function IS_GUIDE( the_obj )
{
    if( exit_if_guide === false )
    {
        try
        {
            if( the_obj.hasOwnProperty("guides") )
            {
                if( the_obj.guides ) return ( exit_if_guide = true );
            }
            if( (the_obj.constructor.name == "CompoundPathItem") && (the_obj.pathItems[0].guides) )
            {
                return ( exit_if_guide = true );
            }
            if( TF_HAS_GUIDE( the_obj ) )
            {
                TF_guides = true;
                return ( exit_if_guide = true );
            }
        } catch( error ) {};
    }
    return exit_if_guide;
}

function GUIDES_IN_OBJ( the_obj )
{
    if( IS_GUIDE( the_obj ) ) return true;
    try
    {
        if( the_obj.hasOwnProperty( "pageItems" ) )
        {
            for( var i = 0; i < the_obj.pageItems.length; i++ )
            {
                if( GUIDES_IN_OBJ( the_obj.pageItems[i] ) ) return true;
            }
        }
    } catch( error ) {};
    return false;
}

function TF_HAS_GUIDE( TF )
{
    if( TF.constructor.name != "TextFrame" ) return false;
    if( TF.kind != TextType.POINTTEXT )
    {
        try
        {
            if( TF.textPath.guides ) return true;
        } catch( error ) {};
    }
    return false;
}

function SELECTION_DIM()
{
    SEL_SIZE = new Array( N_b );
    OBJ_SIZE = new Array( N_b );
    for( var b = 0; b < N_b; b++ )
    {
        SEL_SIZE[b] = new Array( N_c );
        OBJ_SIZE[b] = new Array( N_c );
        for( var c = 0; c < N_c; c++ )
        {
            SEL_SIZE[b][c] = new Array( N_sel );
            OBJ_SIZE[b][c] = new Array( N_sel );
        }
    }
    for( var i = 0; i < N_sel; i++ )
    {
        var the_obj = the_sel[i];
        var BOUNDS_i = [ OBJ_BOUNDS( the_obj ), CLIP_BOUNDS( the_obj ) ];
        if( exit_if_bad_sel || exit_if_guide ) return;
        for( var b = 0; b < N_b; b++ )
        {
            for( var c = 0; c < N_c; c++ )
            {
                OBJ_SIZE[b][c][i] = BOUNDS_i[c][b];
                for( var dir = 0; dir < N_dir; dir++ )
                {
                    SEL_SIZE[b][c][dir] = COMPARE_BOUNDS( dir, i, SEL_SIZE[b][c][dir], OBJ_SIZE[b][c][i][dir] );
                    if( (c == 1) && !CLIP )
                    {
                        CLIP = ( OBJ_SIZE[b][c-1][i][dir] != OBJ_SIZE[b][c][i][dir] );
                    }
                }
            }
        }
    }
    return;
}

function OBJ_BOUNDS( the_obj )
{
    var B = new Array( N_dir_b );
    try
    {
        for( var dir = 0; dir < N_dir; dir++ )
        {
            B[dir] = the_obj.geometricBounds[dir];
            B[dir+N_dir] = the_obj.visibleBounds[dir];
        }
    }
    catch ( error )
    {
        exit_if_bad_sel = true;
        return false;
    }
    return [ [ B[0], B[1], B[2], B[3] ], [ B[4], B[5], B[6], B[7] ] ];
}

function INI_FILE_IO( WRITE )
{
    var INI_FILE;
    var INI_EXISTS = false;
    var INI_ERR = false;
    var STR_TYPE = "string";
    var BOOL_TYPE = "boolean";
    var INT_TYPE = "integer";

    function INI_OPEN()
    {
        INI_EXISTS = false;
        INI_ERR = false;
        try
        {
            INI_FILE = File( app.path + "/"+ the_title +".ini" );
            INI_EXISTS = INI_FILE.exists;
        }
        catch( error )
        {
            INI_ERR = true;
        }
        if( !INI_ERR )
        {
            try
            {
                if( WRITE )
                {
                    INI_FILE.open( "w" );
                }
                else
                {
                    if( INI_EXISTS )
                    {
                        INI_FILE.open( "r" );
                    }
                }
            }
            catch( error )
            {
                INI_ERR = true;
            }
            if( WRITE )
            {
                try
                {
                    INI_EXISTS = INI_FILE.exists;
                }
                catch( error )
                {
                    INI_ERR = true;
                }
            }
        }
        return;
    }

    function INI_CLOSE()
    {
        if( INI_EXISTS )
        {
            try
            {
                INI_FILE.close();
            }
            catch( error )
            {
                INI_ERR = true;
            }
        }
        return;
    }

    function VAR_RW( VAR_NAME, VAL, TYPE, DEF )
    {
        var ENV_NAME = the_title + "_" + VAR_NAME;
        var VAR_ERR = false;

        function VAL_CONV( V  )
        {
            function TYPE_CONV()
            {
                var CONV_VAL = undefined;
                if( TYPE == STR_TYPE ) CONV_VAL = V;
                if( TYPE == INT_TYPE ) CONV_VAL = ( WRITE ) ? ( V.toString() ) : ( parseInt( V ) );
                if( TYPE == BOOL_TYPE ) CONV_VAL = ( WRITE ) ? ( Number( V ).toString() ) : ( Boolean( parseInt( V ) ) );
                if( !WRITE )
                {
                    var READ_VAR = STR_FOR_NUM( V );
                    if( (READ_VAR === false) || (READ_VAR === "") || isNaN( READ_VAR ) ) VAR_ERR = true;
                }
                return CONV_VAL;
            }
            try
            {
                V = TYPE_CONV();
            }
            catch( error )
            {
                VAR_ERR = true;
            }
            return V;
        }

        function SET_ENV()
        {
            try
            {
                $.setenv( ENV_NAME, VAL_CONV( VAL ) );
            }
            catch( error )
            {
                VAR_ERR = true;
            }
            return;
        }

        if( WRITE )
        {
            if( !INI_EXISTS )
            {
                SET_ENV();
            }
            else
            {
                try
                {
                    INI_FILE.writeln( VAL_CONV( VAL ) );
                }
                catch( error )
                {
                    SET_ENV();
                }
            }
        }
        else
        {
            if( !INI_EXISTS )
            {
                try
                {
                    VAL = ( $.getenv( ENV_NAME ) !== null ) ? VAL_CONV( $.getenv( ENV_NAME ) ) : DEF;
                }
                catch( error )
                {
                    VAR_ERR = true;
                }
            }
            else
            {
                try
                {
                    VAL = VAL_CONV( INI_FILE.readln() );
                }
                catch( error )
                {
                    VAR_ERR = true;
                }
            }
            if( VAR_ERR )
            {
                VAL = DEF;
            }
        }
        return VAL;
    }

    function INI_RW()
    {
        LENGTH_VER_INI = VAR_RW( "LENGTH_VER_INI", LENGTH_VER_INI, STR_TYPE, "5" );
        LENGTH_HOR_INI = VAR_RW( "LENGTH_HOR_INI", LENGTH_HOR_INI, STR_TYPE, "5" );
        OFFSET_VER_INI = VAR_RW( "OFFSET_VER_INI", OFFSET_VER_INI, STR_TYPE, "2" );
        OFFSET_HOR_INI = VAR_RW( "OFFSET_HOR_INI", OFFSET_HOR_INI, STR_TYPE, "2" );
        BLEED_VER_INI = VAR_RW( "BLEED_VER_INI",  BLEED_VER_INI, STR_TYPE, "0" );
        BLEED_HOR_INI = VAR_RW( "BLEED_HOR_INI", BLEED_HOR_INI, STR_TYPE, "0" );
        SW_NUM_INI = VAR_RW( "SW_NUM_INI", SW_NUM_INI, STR_TYPE, "0.25" );
        SW_UN_INI = VAR_RW( "SW_UN_INI", SW_UN_INI, INT_TYPE, 2 );
        W_CONT_INI = VAR_RW( "W_CONT_INI", W_CONT_INI, BOOL_TYPE, false );
        BOUNDS_INI = VAR_RW( "BOUNDS_INI", BOUNDS_INI, INT_TYPE, 0 );
        G_M_INI = VAR_RW( "G_M_INI", G_M_INI, INT_TYPE, 0 );
        REM_DIR = VAR_RW( "REM_DIR", REM_DIR, BOOL_TYPE, false );
        for( var i = 0; i < N_dir_dial; i++ )
        {
            DIR_INI[i] = VAR_RW( "DIR_INI["+i.toString()+"]", DIR_INI[i], BOOL_TYPE, false );
        }
        if( !WRITE )
        {
            function DROP_INI( ini, max, def )
            {
                if( ( ini < 0 ) || ( ini > max ) ) return def;
                return ini;
            }
            BOUNDS_INI = DROP_INI( BOUNDS_INI, 1, 0 );
            SW_UN_INI = DROP_INI( SW_UN_INI, 3, 2 );
            G_M_INI = DROP_INI( G_M_INI, 2, 0 );
        }
        return;
    }

    INI_OPEN();
    INI_RW();
    INI_CLOSE();
    return;
}

function TEXT_TO_DIGIT( txt )
{
    var str = STR_FOR_NUM( txt );
    if( ( str === false ) || ( str === "" ) ) str = ZERO_TEXT;
    return parseFloat( STR_FOR_NUM( str ) );
}

function CHECK_ZERO_TEXT( the_text )
{
    var VAL = parseFloat( TEXT_TO_DIGIT( the_text ) );
    return ( (VAL == 0.) || isNaN( VAL ) ) ? ZERO_TEXT : the_text;
}

function STR_FOR_NUM( S )
{
    var S_OUT = "";
    var N_C = 0;
    var N_P = 0;
    var N_M = 0;
    for( var i = 0; i < S.length; i++ )
    {
        var S_i = S[i];
        if( S_i == "," ) S_i = ".";
        if( ("-+.0123456789").indexOf( S_i ) == -1 ) return false;
        if( ( S_i == "." ) && ( ++N_C > 1 ) ) return false;
        if( ( S_i == "-" ) && ( ( ++N_M > 1 ) || ( i != 0 ) ) ) return false;
        if( ( S_i == "+" ) && ( ( ++N_P > 1 ) || ( i != 0 ) ) ) return false;
        S_OUT = S_OUT + S_i;
    }
    return S_OUT;
}

function MARKS( BOUNDS_ARR )
{
    var M = new Array( N_dir_dial );

    function M_SET( hor )
    {
        var N = ( hor ) ? ( 0 ) : ( 6 );
        var BLEED = ( hor ) ? ( -BLEED_VER ) : ( BLEED_HOR );
        var OFFS = ( hor ) ? ( OFFSET_HOR ) : ( OFFSET_VER );
        var LEN = ( hor ) ? ( LENGTH_HOR ) : ( LENGTH_VER );
        var D = ( hor ) ? [ 1, 3, 1, 3 ] : [ 0, 0, 2, 2 ];
        var SAME_POS =
        [
            ( BOUNDS_ARR[ D[0] ] + BLEED ),
            GET_CENTER( BOUNDS_ARR[ D[1] ], BOUNDS_ARR[ D[2] ] ),
            ( BOUNDS_ARR[ D[3] ] - BLEED )
        ];
        D = ( hor ) ? [ 1, 3, 0, 2 ] : [ 0, 2, 3, 1 ];
        var N_cb = 3;
        for( var i = N; i < ( N + N_cb ); i++ )
        {
            var i_N_cb = i + N_cb;
            M[ i ] = new Array( N_dir );
            M[ i_N_cb ] = new Array( N_dir );
            M[ i ][ D[ 0 ] ] = M[ i ][ D[ 1 ] ] =
            M[ i_N_cb ][ D[ 0 ] ] = M[ i_N_cb ][ D[ 1 ] ] =
            SAME_POS[ i - N ];
            M[ i ][ D[ 3 ] ] = BOUNDS_ARR[ D[ 2 ] ] - OFFS;
            M[ i ][ D[ 2 ] ] = M[ i ][ D[ 3 ] ] - LEN;
            M[ i_N_cb ][ D[ 2 ] ] = BOUNDS_ARR[ D[ 3 ] ] + OFFS;
            M[ i_N_cb ][ D[ 3 ] ] = M[ i_N_cb ][ D[ 2 ] ] + LEN;
        }
        return;
    }

    M_SET( true );
    M_SET( false );

    for( var m = 0; m < N_dir_dial; m++ )
    {
        if( DIR_INI[ m ] )
        {
            var OVER_OBJ = false;
            if( CONS_OVER )
            {
                for( var i = 0; i < N_sel; i++ )
                {
                    if( i == OBJ_i ) continue;
                    var S =
                    [
                        ( OBJ_SIZE[i][0] - OFFSET_HOR + PREC_MARKS_OBJ ),
                        ( OBJ_SIZE[i][1] + OFFSET_VER - PREC_MARKS_OBJ ),
                        ( OBJ_SIZE[i][2] + OFFSET_HOR - PREC_MARKS_OBJ ),
                        ( OBJ_SIZE[i][3] - OFFSET_VER + PREC_MARKS_OBJ )
                    ];
                    var M_m =
                    [
                        ( M[m][0] + PREC_MARKS_OBJ ),
                        ( M[m][1] - PREC_MARKS_OBJ ),
                        ( M[m][2] - PREC_MARKS_OBJ ),
                        ( M[m][3] + PREC_MARKS_OBJ )
                    ];
                    if( ( OVER_OBJ = OVERLAP( S, M_m ) ) === true ) break;
                }
            }
            if( !OVER_OBJ ) MAKE_MARK( M[m] );
        }
    }
    return;
}

function OVERLAP( A, B )
{
    function OVER( hor )
    {
        var D = ( hor ) ? [ 0, 2 ] : [ 3, 1 ];
        if( ( (A[ D[ 0 ] ] >= B[ D[ 0 ] ]) && (A[ D[ 0 ] ] <= B[ D[ 1 ] ]) ) ) return true;
        if( ( (B[ D[ 0 ] ] >= A[ D[ 0 ] ]) && (B[ D[ 0 ] ] <= A[ D[ 1 ] ]) ) ) return true;
        if( ( (A[ D[ 1 ] ] >= B[ D[ 0 ] ]) && (A[ D[ 1 ] ] <= B[ D[ 1 ] ]) ) ) return true;
        if( ( (B[ D[ 1 ] ] >= A[ D[ 0 ] ]) && (B[ D[ 1 ] ] <= A[ D[ 1 ] ]) ) ) return true;
        return false;
    }
    if( OVER( true ) && OVER( false ) ) return true;
    return false;
}

function MAKE_MARK( BOUNDS_ARR )
{
    if( ALREADY_MADE( BOUNDS_ARR ) ) return;
    var W_L, R_L, the_mark;
    if( W_CONT_INI )
    {
        W_L = MAKE_LINE( BOUNDS_ARR, false, (SW_NUM + 1.) );
    }
    R_L = MAKE_LINE( BOUNDS_ARR, true, SW_NUM );
    the_mark = ( W_CONT_INI ) ? GROUP_OBJ( [ W_L, R_L ] ) : R_L;
    if( G_M_INI != 0 )
    {
        ALL_MARKS.push( the_mark );
    }
    ALL_MARKS_BOUNDS.push( BOUNDS_ARR );
    return;
}

function MAKE_LINE( BOUNDS_ARR, the_color, the_weight )
{
    try
    {
        var the_line = SL.pathItems.add();
        the_line.setEntirePath( [ [BOUNDS_ARR[0], BOUNDS_ARR[3] ], [BOUNDS_ARR[2], BOUNDS_ARR[1] ] ] );
        the_line.stroked = true;
        the_line.filled = false;
        the_line.strokeOverprint = false;
        the_line.strokeCap = StrokeCap.BUTTENDCAP;
        the_line.opacity = 100;
        the_line.wrapped = false;
        the_line.strokeDashes = new Array();
        the_line.strokeWidth = the_weight;
        the_line.strokeColor = ( the_color ) ? M_COLOR : WHITE;
        return the_line;
    } catch( error ) {};
}

function OPERATION()
{
    if( COLOR_VAL != 0 )
    {
        M_COLOR = AD.swatches[ COLOR_VAL - 1 ].color;
        var COLOR_NAME = SWATCHES[ COLOR_VAL ];
        var COLOR_TYPE = M_COLOR.typename;
        if( (COLOR_TYPE == "GradientColor") || (COLOR_TYPE == "PatternColor") || (COLOR_TYPE == "NoColor") )
        {
            if( COLOR_TYPE == "GradientColor" ) var STR_COLOR_TYPE = "Cor Degradê";
            if( COLOR_TYPE == "PatternColor" ) var STR_COLOR_TYPE = "Cor Padrão";
            if( COLOR_TYPE == "NoColor" ) var STR_COLOR_TYPE = "Sem Cor";
            return "Amostra escolhida " + unescape( COLOR_NAME ) + "\né " + STR_COLOR_TYPE + "!\n\nSelecione outra cor para as marcas.";
        }
        if( W_CONT_INI )
        {
            switch( COLOR_TYPE )
            {
                case( "SpotColor" ):
                    WHITE = new SpotColor();
                    WHITE.spot = AD.spots.getByName( COLOR_NAME );
                    WHITE.tint = 0;
                break;
                case( "CMYKColor" ):
                    WHITE_CMYK();
                break;
                case( "RGBColor" ):
                    WHITE_RGB();
                break;
                case( "LabColor" ):
                    WHITE = new LabColor();
                    WHITE.l = 100;
                    WHITE.a = 0;
                    WHITE.b = 0;
                break;
                case( "GrayColor" ):
                    WHITE = new GrayColor();
                    WHITE.gray = 0;
                break;
                default:
                    if( AD.documentColorSpace == DocumentColorSpace.CMYK )
                    {
                        WHITE_CMYK();
                    }
                    else
                    {
                        WHITE_RGB();
                    }
                break;
            }

            function WHITE_CMYK()
            {
                WHITE = new CMYKColor();
                WHITE.black = 0;
                WHITE.cyan = 0;
                WHITE.magenta = 0;
                WHITE.yellow = 0;
                return;
            }

            function WHITE_RGB()
            {
                WHITE = new RGBColor();
                WHITE.red = 255;
                WHITE.green = 255;
                WHITE.blue = 255;
                return;
            }
        }
    }
    else
    {
        function GET_REG_BY_NAME( the_name )
        {
            M_COLOR = AD.swatches.getByName(the_name).color;
            WHITE = AD.swatches.getByName(the_name).color;
            return;
        }

        var REG_NAME_ENGLISH = "[Registration]";
        try
        {
            GET_REG_BY_NAME( REG_NAME_ENGLISH );
        }
        catch( error )
        {
            var REG_FOUND = false;
            try
            {
                for( var i = 0; i < AD.spots.length; i++ )
                {
                    var the_spot = AD.spots[i];
                    var the_spot_name = the_spot.name;
                    var the_type = the_spot.colorType;
                    if( the_type == ColorModel.REGISTRATION )
                    {
                        if( the_spot_name[0] == "[" && the_spot_name[the_spot_name.length-1] == "]")
                        {
                            GET_REG_BY_NAME( the_spot_name );
                            REG_FOUND = true;
                        }
                    }
                }
            } catch( error ) {};
            if( !REG_FOUND )
            {
                var NEW_REG = AD.spots.add();
                NEW_REG.colorType = ColorModel.REGISTRATION;
                NEW_REG.name = REG_NAME_ENGLISH;
                var NEW_REG_NAME = NEW_REG.name;
                GET_REG_BY_NAME( NEW_REG_NAME );
            }
        }
        M_COLOR.tint = 100;
        WHITE.tint = 0;
    }

    if( !SL.visible ) SL.visible = true;
    if( SL.locked ) SL.locked = false;

    if( (OBJECTS_TO_MAKE == AA_OPTION) || (OBJECTS_TO_MAKE == EACH_AB_OPTION) )
    {
        if( OBJECTS_TO_MAKE == AA_OPTION )
        {
            var PAGE_DX = AD.rulerOrigin[0];
            var PAGE_DY = AD.rulerOrigin[1];
            MARKS( [ -PAGE_DX, AD.height - PAGE_DY, AD.width - PAGE_DX, -PAGE_DY ] );
        }
        else
        {
            if( CONS_OVER )
            {
                OBJ_SIZE = new Array( N_AB );
                N_sel = N_AB;
                for( var i = 0; i < N_AB; i++ )
                {
                    OBJ_SIZE[ i ] = AD.artboards[ i ].artboardRect;
                }
            }
            for( OBJ_i = 0; OBJ_i < N_AB; OBJ_i++ )
            {
                var AB_SIZE = ( CONS_OVER ) ? OBJ_SIZE[ OBJ_i ] : AD.artboards[ OBJ_i ].artboardRect;
                MARKS( AB_SIZE );
            }
        }
    }
    else
    {
        var CLIP_INDEX = Number( CLIP_CB_VAL );
        if( (OBJECTS_TO_MAKE == ENTIRE_SEL_OPTION) || (OBJECTS_TO_MAKE == SEL_OBJ_OPTION) )
        {
            MARKS( SEL_SIZE[ BOUNDS_INI ][ CLIP_INDEX ] );
        }
        if( OBJECTS_TO_MAKE == EACH_OBJ_OPTION )
        {
            OBJ_SIZE = OBJ_SIZE[ BOUNDS_INI ][ CLIP_INDEX ];
            for( OBJ_i = 0; OBJ_i < N_sel; OBJ_i++ )
            {
                MARKS( OBJ_SIZE[ OBJ_i ] );
            }
        }
    }

    if( G_M_INI != 0 )
    {
        var G_M = GROUP_OBJ( ALL_MARKS );
        var g_err = ( G_M === false );
        if( G_M_INI == 2 )
        {
            AD.selection = null;
            var G_S = GROUP_OBJ( the_sel );
            var G = GROUP_OBJ( [ G_S, G_M ] );
            g_err = ( g_err || ( G_S === false ) || ( G === false ) );
            try
            {
                AD.selection = G;
            } catch( error ) { g_err = true }
        }
        if( g_err )
        {
            try
            {
                AD.selection = the_sel;
            } catch( error ) {}
            return "Não foi possível agrupar!";
        }
        if( G_AUTO && ( G_M_INI == 1 ) )
        {
            G_M_INI = 2;
        }
    }
    return "";
}

function GROUP_OBJ( obj_arr )
{
    try
    {
        var N = obj_arr.length;
        if( N == 1 ) return obj_arr[0];
        var G = SL.groupItems.add();
        for( var i=0; i < obj_arr.length; i++ )
        {
            obj_arr[i].move( G, ElementPlacement.INSIDE );
        }
    }
    catch( error )
    {
        G = false;
    }
    return G;
}

function DIR_STATUS( the_arr, act, set )
{
    var arr_cb = the_arr[0].hasOwnProperty( "value" );
    for( var i = 0; i < the_arr.length; i++ )
    {
        if( set )
        {
            if( arr_cb )
            {
                the_arr[i].value = act;
            }
            else
            {
                the_arr[i] = act;
            }
        }
        else
        {
            if( the_arr[i].value ) return true;
        }
    }
    return false;
}

function TEXT_AS_POINTS( txt, u )
{
    var d = parseFloat( UnitValue( TEXT_TO_DIGIT( txt ), u ).as('pt') );
    if( isNaN( d ) )
    {
        exit_if_bad_input = true;
        d = 0.;
        return;
    }
    return d;
}

function GET_DOC_UNITS_INDEX()
{
    var AD_units = AD.rulerUnits;
    if( AD_units == RulerUnits.Millimeters ) return 0;
    if( AD_units == RulerUnits.Centimeters ) return 1;
    if( AD_units == RulerUnits.Points ) return 2;
    if( AD_units == RulerUnits.Inches ) return 3;
    return 0;
}

function LE_ZERO( x )
{
    try
    {
        if( x <= 0. ) return true;
    } catch( error ) {};
    return false;
}

function ALREADY_MADE( BOUNDS_ARR )
{
    for( var i = 0; i < ALL_MARKS_BOUNDS.length; i++ )
    {
        try
        {
            var M = ALL_MARKS_BOUNDS[i];
            var MADE = true;
            for( var dir = 0; dir < N_dir; dir++ )
            {
                MADE = ( MADE && ( Math.abs( M[dir] - BOUNDS_ARR[dir] ) <= PREC_MARKS ) );
                if( !MADE ) break;
            }
            if( MADE ) return true;
        } catch( error ){};
    }
    return false;
}

function GET_CENTER( MIN, MAX )
{
    return ( MIN + ( MAX - MIN ) / 2. );
}

function WM( W, M )
{
    return ( WFS ? W : M );
}

function CSCC( CS_VAL, CC_VAL )
{
    return ( CC ? CC_VAL : CS_VAL );
}
