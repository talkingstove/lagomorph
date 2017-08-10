define([ 
          "jquery", 
          "underscore", 
          "Handlebars", 
          "Fiber", 
          "dexie", 
          "bluebird", 
          "himalaya", 
          "LBase", 
          "LModule", 
          "scanner", 
          "L_List", 
          "componentInstanceLibrary",
          "viewUtils",
          "ajaxRequester",
          "agreementsTester",
          "dataSourceLibrary",
          "connectorLibrary",
          "connectorUtils",
          "objectUtils",
          "uiStringsLibrary",
          "templateUtils"
        ], 
function($, _, Handlebars, Fiber, dexie, bluebird, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, dataSourceLibrary, connectorLibrary, connectorUtils, objectUtils, uiStringsLibrary, templateUtils ) {

  var framework = { //anything we want to expose on the window for the end user needs to be added here
    scanner: scanner,
    ajaxRequester: ajaxRequester,
    LBase: LBase,
    LModule: LModule,
    dexie: dexie, //api for indexedDB local storage DB -> http://dexie.org/docs/ 
    bluebird: bluebird, //promise library -> http://bluebirdjs.com/
    himalaya: himalaya, //html to json parser -> https://github.com/andrejewski/himalaya
    $: $,
    _: _,
    Handlebars: Handlebars,
    componentDefinitions: { //all available component classes that come standard with the framework
      L_List: L_List
    }, //todo: move to model
    componentInstanceLibrary: componentInstanceLibrary, //look up instances of components created on the current page/app
    dataSourceLibrary: dataSourceLibrary,
    connectorLibrary: connectorLibrary,
    uiStringsLibrary: uiStringsLibrary,
    connectorUtils: connectorUtils,
    objectUtils: objectUtils,

    /*
    * componentConfig = json to instantiate components, in lieu of or addition to that in the html itself
    * dataSources = json config of endpoints, including data contracts of what to expect from the server
    * these could literally be generated into json from an api doc!
    *
    * data from dataSources may be further transformed from the expected server return by a map on the individual componentConfig
    * thus, one endpoint can be used by different components with varying data structures
    *
    * userComponents = custom Lagomorph component classes created by end user (??)
    * i18nDataSource = user-passed internationalization data for use in a "noneolith"
    *
    **/
    start: function(params) {


      //***TODO: accept promises and don't start until they're resolved!! **************

      params = params || {};

      if (!params.componentConfig) {
        console.log('Lagomorph started with no component config');
      }
      if (!params.dataSources) {
        console.log('Lagomorph started with no dataSources config');
      }
      if (!params.stringData) {
        console.log('Lagomorph started with no string/i18nDataSource config');
      }

      this.componentInstanceLibrary.initializeComponentInstanceLibrary(); //model that holds all instances of created components for lookup

      //data source library (server data lookuos)
      this.dataSourceLibrary.initializeDataSourceLibrary( params.dataSources );

      //connector library
      this.connectorLibrary.initializeConnectorLibrary( params.connectors );


      //user-defined components library (classes, not instances)


      //string (i18n) library (usually i18n, but could be any lookup for arbitrary text to be displayed in UI)
      this.uiStringsLibrary.initializeUIStringsLibrary(params.stringData);

      this.scanner.scan();
    },

    createApp: function() {
      //initiate a full single-page app with router, etc if desired
    }
  }

  if ($.when.all===undefined) {
    $.when.all = function(deferreds) {
        var deferred = new $.Deferred();
        $.when.apply($, deferreds).then(
            function() {
                deferred.resolve(Array.prototype.slice.call(arguments));
            },
            function() {
                deferred.fail(Array.prototype.slice.call(arguments));
            });

        return deferred;
      }
  }

  if (window) {
    window.L = framework; //expose global so require.js is not needed by end user
  }
   
  return framework;
});