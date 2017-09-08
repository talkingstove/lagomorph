userDefinedComponents = {
  'myComp': L.LComponent.extend(function(base) {
      return {
        // The `init` method serves as the constructor.
        init: function(params) {
          params = params || {};
          base.init(params);

          this.template = params.template || `
             <div>Mycomp demo user component</div>
          `;

        }  
      }
  })
}