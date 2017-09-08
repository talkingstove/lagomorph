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

          //give it its own template not that of the superclass!!
          this.compiledTemplate = L.templateUtils.compileTemplate(this.template); //use L w/o require - user's choice

        }  
      }
  })
}