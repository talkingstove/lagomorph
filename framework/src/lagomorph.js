define(["scanner"], function(scanner) {

	var framework = {
		scanner: scanner,

  	start: function() {
  		if (!window.$) {
  			console.error("Lagomorph needs jQuery defined as $");
  			return;
  		}
  		if (!window._) {
  			console.error("Lagomorph needs underscore.js defined as _");
  			return;
  		}
  		if (!window.Fiber) {
  			console.error("Lagomorph needs fiber.js defined as Fiber");
  			return;
  		}

  		this.scanner.scan();
  	}
	}

	 window.L = framework; //expose global so require.js is not needed by end user
	 
	 return framework;
});