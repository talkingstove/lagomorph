
define(["Fiber", "componentInstanceLibrary"], function(Fiber, componentInstanceLibrary) {

	var LBase = Fiber.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        console.log('Lbase with params:', params);

		        //TODO: add default attrs like unique id, class name etc
		        var id = params.id;
		        var type = params.type;
		        var $parentSelector = params.$parentSelector;

		        if (!id) {
		        	console.error('attempted to created component without id!');
		        	return;
		        }
		        if (!type) {
		        	console.error('attempted to created component without type!');
		        	return;
		        }

		        this.id = id;
		        this.type = type;
		        this.$parentSelector = $parentSelector;

		        componentInstanceLibrary.registerComponent(this);
		    }
		    
		  }
	});

	return LBase;
});