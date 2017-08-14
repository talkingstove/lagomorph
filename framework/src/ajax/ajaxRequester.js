define(["jquery", "underscore", "dataSourceLibrary", "connectorUtils"], function($, _, dataSourceLibrary, connectorUtils) {

  return {

    createAjaxCallPromise: function(dataSourceName, promiseId, connector) {
      //look up datasource from library and get options to create the promise
      var dataSourceDefinition = dataSourceLibrary.getDataSourceByName(dataSourceName);
      promiseId = promiseId || 'unknown'; //TODO: random
      connector = connector || null;

      if (!dataSourceDefinition) {
        console.error("Cannot make AJAX request; can't find datasource with name:", dataSourceName);
        return;
      }

      var options = dataSourceDefinition;

      var method = options.method || 'GET';
      var url = options.url;
      var dataTypeReturned = options.dataTypeReturned || 'json';
      var successHandler = options.successHandler || null;
      var afterSuccessCallback = options.afterSuccessCallback || null;
      var doneCallback = options.doneCallback || null;
      var errorHandler = options.errorHandler || $.noop //N.defaultAjaxErrorHandler;
      var requestParams = options.requestParams || {};
      var jsonToHtmlHandlers = options.jsonToHtmlHandlers || null;  //array of classes
      var dataAgreements = options.dataAgreements || null;

      var deferred = $.Deferred();

      $.ajax({
        type: method,
        url: url,
        dataType: dataTypeReturned,
        data: requestParams
      })
      .success(function(rawData) {
        //if we have one or more agreements about what data was expected from the server,
        //check to see that they have been met
        // if (dataAgreements && dataAgreements.length) { 
        //  var failedAgreements = [];

        //  _.each(dataAgreements, function(dataAgreement) {
        //    var agreementResult = N.Agreements.testAgreement(dataAgreement, data).doesAgreementPass;

        //    if (!agreementResult) {
        //      failedAgreements.push(dataAgreement.name);
        //    }
        //  });

        //  if (failedAgreements.length) {
        //    console.error('Agreements failed on JSON call!');
        //    deferred.reject();
        //    return;
        //  }
        //  else {
        //    console.log('All agreements passed!');
        //  }
        // }

        // if (afterSuccessCallback) {
        //  afterSuccessCallback(data);
        // }
        var processedData = rawData;

        if (connector) {
          processedData = connectorUtils.processData(rawData, connector);
        }

        //return the data the server gave us, along with meta-info like the name we gave the promise
        var returnObj = {
          promiseId: promiseId,
          returnedData: processedData,
          destinationPath: connector.destinationPath
        }

        deferred.resolve(returnObj);
      })
      .error(function() {
        // errorHandler();
        deferred.reject();
      });

      return deferred.promise();
      
    }

  }


});






