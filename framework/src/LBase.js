define(["Fiber"], function(Fiber) {

	var LBase = Fiber.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        console.log('Lbase with params:', params);

		        //TODO: add default attrs like unique id, class name etc
		    },
		    log: function(str) {
		    	console.log(str);
		    }
		    
		  }
	});

	return LBase;
});