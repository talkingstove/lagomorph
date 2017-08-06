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
					"agreementsTester"
				], 
function($, _, Handlebars, Fiber, dexie, bluebird, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary, viewUtils, agreementsTester ) {

	var framework = { //anything we want to expose on the window for the end user needs to be added here
		scanner: scanner,
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

    /*
    * componentConfig = json to instantiate components, in lieu of or addition to that in the html itself
    * dataSources = json config of endpoints, including data contracts of what to expect from the server
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

      this.scanner.scan();
  	},

  	createApp: function() {
  		//initiate a full single-page app with router, etc if desired
  	}
	}

	if (window) {
		window.L = framework; //expose global so require.js is not needed by end user
	}
	 
	return framework;
});