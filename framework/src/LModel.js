
/*
* 
*/
define(["LBase", "objectUtils"], function(LBase, objectUtils) {

  return LBase.extend(function(base) {
    return {
      // The `init` method serves as the constructor.
      init: function(params) {
        params = params || {};

        base.init(params);
        this.values = params.values || {};  
      },

      get: function(path) {
        return objectUtils.getDataFromObjectByPath(this.values, path);
      },

      set: function(path, data) {
        objectUtils.setDataToObjectByPath(this.values, path, data);
      }

    }
  });

});