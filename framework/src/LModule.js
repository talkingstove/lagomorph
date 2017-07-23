define(["LBase"], function(LBase) {

	return LBase.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        console.log('L Module with params:', params);
		    },

		    renderView: function(params) {

		    },

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    template: "<div>{{body}}</div>"
		    
		  }
	});
});