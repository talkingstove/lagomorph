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

		    addItem: function(id, item, overwriteItem) {
		    	overwriteItem = overwriteItem || false;

		    	if (!overwriteItem && ComponentInstanceLibrary.getItem(id) ) {
		        console.error('attempted to register dupe component without overwriteItem=true with id:', id);
		        return;
		      }
		      else if (overwriteItem && this.storage[id] && this.storage[id].destroy) {
		      	this.storage[id].destroy();
		      }

		    	this.storage[id] = item;
		    },

		    deleteItem: function(id) {
		    	if (!this.storage[id]) {
	    			console.warn('attempted to delete non-existent item with id', id);
		        return;
		    	}

		    	if(this.storage[id].destroy) {
		    		this.storage[id].destroy();
		    	}

		    	delete this.storage[id];
		    }
		    
		  }
	});

	return LLibrary;
});