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
          "templateUtils",
          "pageLibrary"
        ], 
function($, _, Handlebars, Fiber, dexie, bluebird, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, dataSourceLibrary, connectorLibrary, connectorUtils, objectUtils, uiStringsLibrary, templateUtils, pageLibrary ) {

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
    pageLibrary: pageLibrary,

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

      var self = this;
      params = params || {};

      if (!params.pageWrapperSelector) {
        console.warn('Lagomorph started with no pageWrapperSelector');
      }
      if (!params.pages) {
        console.warn('Lagomorph started with no pages');
      }


      if (!params.initialRoute) {
        console.warn('Lagomorph started with no initialRoute');
      }
      // if (!params.routeConfig) {
      //   console.warn('Lagomorph started with no routeConfig');
      // }
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


      var allPromises = []; //add anything that is needed before the initial scan/app start

      if (params.pages && params.pages.dataSourceName) {
        var connector = this.connectorLibrary.getConnectorByName( params.pages.connectorName );
        var pagesPromise = ajaxRequester.createAjaxCallPromise(params.pages.dataSourceName, "pages", connector);
        
        allPromises.push( pagesPromise );
      }

      //***** Determine which promises need to be resolved before we can actually start the app
      $.when.all(allPromises).then(function(schemas) {
          for (var i=0; i<schemas.length; i++) {
            var promiseId = schemas[i].promiseId;

            switch (promiseId) {
              case 'pages':
                var pageDefinitions = schemas[i].returnedData;
                self.pageLibrary.initializePageLibrary( pageDefinitions );
              break;
            }

          }


          //*******when processing is done, load initial page into the pageWrapperSelector
          //page then users the scanner to scan itself

              
          // self.scanner.scan($(params.pageWrapperSelector));

          }, function(e) {
               console.log("App start failed");
          });


 //       pages: { //just json, can be hardcoded or via endpoint
  //   dataSourceName: "lPages",
  //   pageDefinitions: {}
  // },

      
    }
  }

  if ($ && $.when.all===undefined) {
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