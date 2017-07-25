define(["LModule"], function(LModule) {

	return LModule.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		        // Insert private functions here
		        console.log('L-List Module with params:', params);
		    },

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    template: `
					  <div>
					    <span>Some HTML here for a list</span>
					  </div>
					`
		    
		  }
	});
});