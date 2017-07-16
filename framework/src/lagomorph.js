define(["jquery", "test2"], function($, test2) {

	var framework = {
		t2: test2,

  	hello: function() {
  		alert('yo');
  	},
  	bye: function() {
  		this.t2.bye();
  	}
	}

	 window.L = framework; //expose global so require.js is not needed by end user
	 
	 return framework;
});