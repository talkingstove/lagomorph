define(["LModel"], function(LModel) {

  //makes the singleton avaible to the global window.L, or via require
	return {

    DOMModel: null,

    initializeDOMModel: function() {
      if (this.DOMModel !== null) {
        console.warn('DOMModel singleton already initialized');
        return;
      }

      this.DOMModel = new LModel();
    },

    getDOMModel: function() {
      return this.DOMModel;
    }

  }
});