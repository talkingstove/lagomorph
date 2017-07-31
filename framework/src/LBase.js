
/*
* base module
*/
define(["Fiber", "componentInstanceLibrary"], function(Fiber, componentInstanceLibrary) {

	var LBase = Fiber.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        var compViewData = params.viewParams;
          	var compDataSources = params.dataSources || null;

		        //TODO: add default attrs like unique id, class name etc
		        var id = compViewData.id;
		        var type = compViewData.type;
		        var $parentSelector = compViewData.$parentSelector;

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
		        this.dataSources = compDataSources;
		        this.viewData = compViewData;

		        componentInstanceLibrary.registerComponent(this);
		    },

		    destroy: function() {
		    	if (this.$parentSelector) {
			    	this.$parentSelector.html('');
			    	this.$parentSelector = null; //remove coupling to DOM
			    }
		    }
		    
		  }
	});

	return LBase;
});