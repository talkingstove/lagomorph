define(["jquery", "underscore", "Handlebars", "Fiber", "LBase", "LModule", "scanner", "L_List"], function($, _, Handlebars, Fiber, LBase, LModule, scanner, L_List ) {

	var framework = {
		scanner: scanner,
		LBase: LBase,
		LModule: LModule,
    $: $,
    _: _,
    Handlebars: Handlebars,
    components: {
    	L_List: L_List
    },

  	start: function() {
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