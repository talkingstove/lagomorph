define(["Handlebars", "underscore", "LComponent", "viewUtils", "templateUtils"], function(Handlebars, _,  LComponent, viewUtils, templateUtils) {

  return LComponent.extend(function(base) {
      return {
        // The `init` method serves as the constructor.
        init: function(params) {
          params = params || {};
          base.init(params);

          this.template = params.template || `
            <span data-ui_string="i18n.key1">
              loading...
            </span>
            <ul data-data_binding="listItems" data-template_binding="compiledListItemTemplate">        
            </ul>
          `;

          //TODO: should also take in a list of components instead of just templates!!! CAN IT?????
          //json compoent config can be TEMPLATE PARAMS!!!!111
          this.listItemTemplate = params.listItemTemplate || `
            <li>
              {{caption}}
            </li>
          `;

          this.data = { 
            listItems: null //expect []
          };
          
          //give it its own template not that of the superclass!!
          this.compiledTemplate = templateUtils.compileTemplate(this.template); //this.Handlebars.compile(this.template);
          this.compiledListItemTemplate = templateUtils.compileTemplate(this.listItemTemplate); //this.Handlebars.compile(this.listItemTemplate);
        }

        

       
        
        
        
      }
  });
});