define(["LLibrary"], function(LLibrary) {

  //makes the singleton avaible to the global window.L, or via require
	return {

    PageLibrary: null,

    initializePageLibrary: function(pages) {
      pages = pages || null;
      if (this.PageLibrary !== null) {
        console.warn('PageLibrary singleton already initialized');
        return;
      }

      this.PageLibrary = new LLibrary();

      if (pages) {
        this.getLibrary().addItem('pages', pages, true);
      }

    },

    getLibrary: function() {
      return this.PageLibrary;
    }


  }
});