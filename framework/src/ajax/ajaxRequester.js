define(["jquery", "underscore", "dataSourceLibrary"], function($, _, dataSourceLibrary) {

	return {

		// makeAjaxBatchCalls: function(callOptionsArray) {
		// 	var allRequests = [];

		// 	for (var i=0; i<callOptionsArray.length; i++) {
		// 		allRequests.push( this.makeAjaxCall( callOptionsArray[i] )  );
		// 	}

		// 	// var firstRequest = $.ajax({...});
		// 	// var secondRequest = $.ajax({...});

		// 	Promise.all(allRequests).then(function(result) {
		// 	    debugger;
		// 	});

		// },

		// var  x = L.ajaxRequester.createAjaxCallPromise({url: 'https://httpbin.org/get'});
		//   $.when(x).done(function(value) {
		// 	    alert(value);
		// 	});

    createAjaxCallPromise: function(dataSourceName) {
    	//look up datasource from library and get options to create the promise
    	var dataSourceDefinition = dataSourceLibrary.getDataSourceByName(dataSourceName);

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
			.success(function(data) {
				//if we have one or more agreements about what data was expected from the server,
				//check to see that they have been met
				// if (dataAgreements && dataAgreements.length) { 
				// 	var failedAgreements = [];

				// 	_.each(dataAgreements, function(dataAgreement) {
				// 		var agreementResult = N.Agreements.testAgreement(dataAgreement, data).doesAgreementPass;

				// 		if (!agreementResult) {
				// 			failedAgreements.push(dataAgreement.name);
				// 		}
				// 	});

				// 	if (failedAgreements.length) {
				// 		console.error('Agreements failed on JSON call!');
				// 		deferred.reject();
				// 		return;
				// 	}
				// 	else {
				// 		console.log('All agreements passed!');
				// 	}
				// }

				// if (successHandler) {
				// 	successHandler(data);
				// }

				// if (jsonToHtmlHandlers) {
				// 	for (var i=0; i<jsonToHtmlHandlers.length; i++) {
				// 		jsonToHtmlHandlers[i].execute(data);
				// 	}
				// }

				// if (afterSuccessCallback) {
				// 	afterSuccessCallback(data);
				// }

				deferred.resolve(data);
			})
			.error(function() {
				// errorHandler();
				deferred.reject();
			});

			return deferred.promise();
			
		}

		// $.when( $.ajax( "/page1.php" ), $.ajax( "/page2.php" ) )
  // .then( myFunc, myFailure );

//   $.when(getData()).done(function(value) {
//     alert(value);
// });

// getData().then(function(value) {
// 	alert(value);
// });

		/*****************
		** SAMPLE:
		* N.Ajax.makeAjaxCall({
		*	type: 'GET',
		* 	url: '/data/test-data.php?page=1',
		* successHandler: function(data) { console.log(data) }	
		* });
		*******/


	}


});






