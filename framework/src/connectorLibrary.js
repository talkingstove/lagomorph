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

      ConnectorLibrary = new LLibrary();

      if (connectors) {
        ConnectorLibrary.addMultipleItems(connectors, true);
      }

    },

    getLibrary: function() {
      return ConnectorLibrary;
    },

    getConnectorByName: function(name) {
      return this.getLibrary() ? this.getLibrary().storage[name] : null;
    },


  }
});