define(["jquery", "underscore", "Fiber", "LBase", "LModule", "scanner"], function($, _, Fiber, LBase, LModule, scanner ) {

	var framework = {
		scanner: scanner,
		LBase: LBase,
		LModule: LModule,
    $: $,
    _: _,

  	start: function() {
      
      this.scanner.scan();
  	},

  	createApp: function() {
  		//initiate a full single-page app with router, etc if desired
  	}
	}

	 window.L = framework; //expose global so require.js is not needed by end user
	 
	 return framework;
});