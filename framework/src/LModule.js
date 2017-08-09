define(["Handlebars", "LBase", "viewUtils", "componentInstanceLibrary", "ajaxRequester", "connectorLibrary", "connectorUtils", "objectUtils", "templateUtils"], function(Handlebars, LBase, viewUtils, componentInstanceLibrary, ajaxRequester, connectorLibrary, connectorUtils, objectUtils, templateUtils) {

  return LBase.extend(function(base) {
      
      var module = {

        self: this,
        Handlebars: Handlebars,
        dataContracts: [], //specifies remote data source(s) and specific ways they should be loaded into this module 

        //**** TODO: proper model with getters and setters
        //**** TODO: each one should be associated with passable render method
        data: { //after connector does its work, data is deposited here with predictible names for every instance of a given component 

        },

        // The `init` method serves as the constructor.
        init: function(params) {
            
            base.init(params);
            var compViewData = params.viewParams || {};
            var compDataContracts = params.dataContracts || [];

            //TODO: add default attrs like unique id, class name etc
            var id = compViewData.id;
            var type = compViewData.type;
            var $parentSelector = compViewData.$parentSelector;

            if (!id) {
              console.error('attempted to created component without id!');
              return;
            }
            if (!type) {
              console.error('attempted to created component without type!');
              return;
            }

            this.id = id;
            this.type = type;
            this.$parentSelector = $parentSelector;
            this.dataContracts = compDataContracts;
            this.viewData = templateUtils.replaceUIStringKeys( compViewData ); //i18n keys that were passed in as eg "[[[i18n.myKey]]]"

            componentInstanceLibrary.registerComponent(this);

            this.compiledTemplate = templateUtils.compileTemplate(this.template); //TODO: cache standard templates in a libary
        },

        

        //Handlebars template
        //overridable via the JSON config of any given instance of the component
        template: `
            <div>
              <span>DO NOT USE ME</span>
            </div>
          `,

        compiledTemplate: null,

        setData: function(targetPath, data) {
          //TODO: deep set with dot path
          this.data[targetPath] = data;
          this.announceDataChange(targetPath);
        },

        getData: function(targetPath) {
          //TODO: deep get with dot path
          return this.data[targetPath];
        },

        announceDataChange: function(targetPath) {
          //TODO: event emitter for data bindings
        },

        /*
        * entry point from scanner.js (or called directly)
        * get any necessary data and do anything else needed before rendering the view to the DOM
        */
        loadComponent: function(targetSelector) {
          var self = this;
    

          /*
          * Component instantiator gave us one or more data contracts
          * We must fulfill them before we can render the view
          * at the end, data will be added to this.processedData
          * for view data, name will map to 1-N data-data_source_name's in html template
          */
        
          var allPromises = []; //if no promises it resolves immediately

          for (var i=0; i<this.dataContracts.length; i++) {
            var thisContract = this.dataContracts[i];
            var promise =  ajaxRequester.createAjaxCallPromise( thisContract.dataSource );
            allPromises.push(promise);
            
          }
          
          $.when.all(allPromises).then(function(schemas) {
               console.log("DONE", this, schemas); // 'schemas' is now an array

               //untested assumption: when.all returns schemas in matching order
               for (var j=0; j<schemas.length; j++) {
                  var thisDataContract = self.dataContracts[j];
                  var connector = connectorLibrary.getConnectorByName( thisDataContract.connector ); //json
                  var serverData = objectUtils.getDataFromObjectByPath( schemas[j], connector.srcPath );
                  var dataTarget = connector.destinationPath;

                  var processedData = connectorUtils.processData(serverData, connector.objectMap);
                  self.setData(dataTarget, processedData);
               }

               self.renderView(targetSelector);
          }, function(e) {
               console.log("My ajax failed");
          });

          
        },

        /*
        *
        */
        renderView: function(targetSelector) {
          var html = this.compiledTemplate(this.viewData);
          viewUtils.renderDomElement(targetSelector, html);
          this.renderDataIntoBindings();
        },

        renderDataIntoBindings: function() {
          var $dataBindings = this.$parentSelector.find('[data-data_binding]');

          _.each($dataBindings, function(dataBinding) {
            var $dataBindingDOMElement = $(dataBinding);
            var dataToBeBoundName = $dataBindingDOMElement.data('data_binding');
            var data = this.getData(dataToBeBoundName);
            var templateName = $dataBindingDOMElement.data('template_binding');

            if ( !_.isFunction(this[templateName]) ) {
              console.error('Template name given is not a valid compiled template function:', templateName);
              return;
            }

            var template = this[templateName];
            var html = '';

            if ( _.isArray(data) ) {
              for (var i=0; i<data.length; i++) {
                html += template(data[i]);
              }         
            }
            else {
              html = template(data);
            }

            $dataBindingDOMElement.html(html);

          }, this);
        },

        destroy: function() {
          if (this.$parentSelector) {
            this.$parentSelector.html('');
            this.$parentSelector = null; //remove coupling to DOM
          }

          this.isDestroyed = true;
          componentInstanceLibrary.deleteItem( this.id, true );
        }       
    }

    return module;
  });
});






