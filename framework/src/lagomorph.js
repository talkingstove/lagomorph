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
					"Connector",
					"dataSourceLibrary",
					"connectorLibrary"
				], 
function($, _, Handlebars, Fiber, dexie, bluebird, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, ajaxRequester, agreementsTester, Connector, dataSourceLibrary, connectorLibrary ) {

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
  		params = params || {};

  		if (!params.componentConfig) {
  			console.log('Lagomorph started with no component config');
  		}
  		if (!params.dataSources) {
  			console.log('Lagomorph started with no dataSources config');
  		}
  		if (!params.i18nDataSource) {
  			console.log('Lagomorph started with no i18nDataSource config');
  		}

  		this.componentInstanceLibrary.initializeComponentInstanceLibrary(); //model that holds all instances of created components for lookup

  		//data source library
  		this.dataSourceLibrary.initializeDataSourceLibrary( params.dataSources );

  		//connector library
  		this.connectorLibrary.initializeConnectorLibrary( params.connectors );


  		//user template library

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