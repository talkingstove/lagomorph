define(["LLibrary"], function(LLibrary) {

  //makes the singleton avaible to the global window.L, or via require
  return {

    ConnectorLibrary: null,

    initializeConnectorLibrary: function(connectors) {
      connectors = connectors || null;
      if (this.ConnectorLibrary !== null) {
        console.warn('ConnectorLibrary singleton already initialized');
        return;
      }

      this.ConnectorLibrary = new LLibrary();

      if (connectors) {
        this.getLibrary().addMultipleItems(connectors, true);
      }

    },

    getLibrary: function() {
      return this.ConnectorLibrary;
    },

    getConnectorByName: function(name) {
      return this.getLibrary() ? this.getLibrary().storage[name] : null;
    },


  }
});