define(["jquery", "test2"], function($, test2) {

	//the entire framework
	  return {
	  	t2: test2,

	  	hello: function() {
	  		alert('yo');
	  	},
	  	bye: function() {
	  		this.t2.bye();
	  	}
	  }
});