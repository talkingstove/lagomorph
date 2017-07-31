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
					"componentInstanceLibrary" 
				], 
function($, _, Handlebars, Fiber, dexie, bluebird, himalaya, LBase, LModule, scanner, L_List, componentInstanceLibrary ) {

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

  	start: function() {
  		this.componentInstanceLibrary.initializeComponentInstanceLibrary();
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