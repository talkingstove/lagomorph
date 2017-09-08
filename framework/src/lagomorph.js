define([ 
          "jquery", 
          "Handlebars", 
          "Fiber", 
          "dexie", 
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
          "pageClassLibrary",
          "director",
          "LRouter",
          "LModel",
          "DOMModel",
          "LComponent",
          "userDefinedComponentDefinitionLibrary"
        ], 
function($, Handlebars, Fiber, dexie, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, dataSourceLibrary, connectorLibrary, connectorUtils, objectUtils, uiStringsLibrary, templateUtils, pageClassLibrary, director, LRouter, LModel, DOMModel, LComponent, userDefinedComponentDefinitionLibrary ) {

  var framework = { //anything we want to expose on the window for the end user needs to be added here
    scanner: scanner,
    ajaxRequester: ajaxRequester,
    LBase: LBase,
    LModule: LModule,
    dexie: dexie, //api for indexedDB local storage DB -> http://dexie.org/docs/ 
    himalaya: himalaya, //html to json parser -> https://github.com/andrejewski/himalaya
    $: $,
    Handlebars: Handlebars,
    componentDefinitions: { //all available component classes that come standard with the framework + user defined
      L_List: L_List
    }, //todo: move to model
    componentInstanceLibrary: componentInstanceLibrary, //look up instances of components created on the current page/app
    dataSourceLibrary: dataSourceLibrary,
    connectorLibrary: connectorLibrary,
    uiStringsLibrary: uiStringsLibrary,
    connectorUtils: connectorUtils,
    objectUtils: objectUtils,
    pageClassLibrary: pageClassLibrary,
    LRouter: LRouter,
    LModel: LModel,
    LComponent: LComponent,
    DOMModel: DOMModel,
    userDefinedComponentDefinitionLibrary: userDefinedComponentDefinitionLibrary,
    templateUtils: templateUtils,

    initialize: function(params) {
      var self = this;
      params = params || {};
      var userDefinedComponents = params.userDefinedComponents || null;

      if (userDefinedComponents) {
        this.componentDefinitions = _.extend(this.componentDefinitions, userDefinedComponents);
      }

      if (!params.service) {
        console.error('L.initialize needs a service to set up the app!');
        return;
      }

      var initPromise = ajaxRequester.createAjaxCallPromise(null, "init", null, params.service);

      $.when(initPromise).done(function(result) {
        console.log('initializing app with params', result.returnedData);
        self.start(result.returnedData, userDefinedComponents);
      });
    },

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
    start: function(params, userDefinedComponents) {

      var self = this;
      params = params || {};
      var userDefinedComponents = params.userDefinedComponents || null;

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

      this.DOMModel.initializeDOMModel();

      this.componentInstanceLibrary.initializeComponentInstanceLibrary(); //model that holds all instances of created components for lookup

      //data source library (server data lookups)
      this.dataSourceLibrary.initializeDataSourceLibrary( params.dataSources );

      //connector library
      this.connectorLibrary.initializeConnectorLibrary( params.connectors );

      this.pageClassLibrary.initializePageClassLibrary();


      //user-defined components library (class definitions, not instances)
      //purpose: reference of what components were imported, what they do, and make sure they're valid
      //make sure they get added to L.componentDefinitions for usage
      this.userDefinedComponentDefinitionLibrary.initializeUserDefinedComponentDefinitionLibrary( userDefinedComponents );


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
                var routerInfo = schemas[i].returnedData;
                // self.pageLibrary.initializePageLibrary( pageDefinitions );
                self.LRouter.startRouter(routerInfo.pages, routerInfo.homepage, params.pageWrapperSelector);
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