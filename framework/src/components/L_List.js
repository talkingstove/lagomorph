define(["Handlebars", "LModule"], function(Handlebars, LModule) {

	return LModule.extend(function(base) {
		  return {
		    // The `init` method serves as the constructor.
		    init: function(params) {
		    		base.init(params);
		        // Insert private functions here
		        console.log('L-List Module with params:', params);

		        //give it its own template not that of the superclass!!
		        this.compiledTemplate = this.Handlebars.compile(this.template);
		    },

		    //Handlebars template
		    //overridable via the JSON config of any given instance of the component
		    //usage: this.renderView('h1', {contents: 'yo'});
		    template: `
					  <ul>
					    {{contents}}
					  </ul>
					`
		    
		  }
	});
});