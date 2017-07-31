define(["Fiber"], function(Fiber) {

	var LLibrary = Fiber.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        
		    },

		    storage: {}, //all items here

		    getItem: function(id) {
		    	return this.storage[id] || null;
		    },

		    addItem: function(id, item) {
		    	this.storage[id] = item;
		    }
		    
		  }
	});

	return LLibrary;
});