define(["LLibrary"], function(LLibrary) {

  //makes the singleton avaible to the global window.L, or via require
  return {

    PageClassLibrary: null,

    initializePageClassLibrary: function() {
      if (this.PageClassLibrary !== null) {
        console.warn('PageClassLibrary singleton already initialized');
        return;
      }

      this.PageClassLibrary = new LLibrary();
    },

    getLibrary: function() {
      return this.PageClassLibrary;
    },

    getPageByRoute: function(route) {
      return this.getLibrary() ? this.getLibrary().getItem(route) : null;
    }


  }
});