({
    baseUrl: '../src',
    out: '../out/L.js',
    include: ["lagomorph"], //the main app file, which requires the rest
    name: '../lib/almond', //Almond is lightweight AMD substitute so we don't have to bundle require.js source
    wrap: {
        startFile: 'start.frag.js',
        endFile: 'end.frag.js'
    },
    optimize: 'none',
    paths: {
        'Fiber': '../lib/fiber.min',
        'jquery': '../lib/jquery.min',
        'underscore': '../lib/underscore-min',
        'Handlebars': '../lib/handlebars.min',
        'director': '../lib/director.min',
        'dexie': '../lib/dexie',
        'himalaya': '../lib/himalaya',
        'L_List': '../src/components/L_List',
        'LLibrary': '../src/library/LLibrary',
        'LBase': '../src/LBase',
        'LModule': '../src/LModule',
        'LRouter': '../src/LRouter',
        'LComponent': '../src/LComponent',
        'LPage': '../src/LPage',
        'viewUtils': '../src/utils/viewUtils',
        'ajaxRequester': '../src/ajax/ajaxRequester',
        'agreementsTester': '../src/ajax/agreements/agreementsTester',
        'dataSourceLibrary': '../src/dataSourceLibrary',
        'connectorLibrary': '../src/connectorLibrary',
        'pageLibrary': '../src/pageLibrary',
        'uiStringsLibrary': '../src/uiStringsLibrary',
        'connectorUtils': '../src/ajax/connector/connectorUtils',
        'objectUtils': '../src/utils/objectUtils',
        'templateUtils': '../src/utils/templateUtils'
    }
})