define(["LLibrary"], function(LLibrary) {

  //makes the singleton avaible to the global window.L, or via require
  return {

    DataSourceLibrary: null,

    initializeDataSourceLibrary: function(dataSources) {
      dataSources = dataSources || null;
      if (this.DataSourceLibrary !== null) {
        console.warn('DataSourceLibrary singleton already initialized');
        return;
      }

      this.DataSourceLibrary = new LLibrary();

      if (dataSources) {
        this.getLibrary().addMultipleItems(dataSources, true);
      }

    },

    getLibrary: function() {
      return this.DataSourceLibrary;
    },

    getDataSourceByName: function(name) {
      return this.getLibrary() ? this.getLibrary().storage[name] : null;
    },


  }
});