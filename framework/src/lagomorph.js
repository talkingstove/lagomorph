define(["scanner"], function(scanner) {

	var framework = {
		scanner: scanner,

  	start: function() {
  		this.scanner.scan();
  	}
	}

	 window.L = framework; //expose global so require.js is not needed by end user
	 
	 return framework;
});