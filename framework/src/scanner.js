define([], function() {

	return {
  	scan: function() {
  		console.log('SCANNING...');

  		//find Lagomorph blocks that may contain components
  		var $blocks = $('.lagomorph-block');

  		_.each($blocks, function(block) {
  			var $block = $(block);
  			var $components = $block.find('[data-lagomorph-component], [data-lc]');

  		}, this);
  	}



  }
});