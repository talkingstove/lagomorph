lParams = {
  // componentConfigLocation: {
  //  "url": '/ajax/component-config.json'
  // },
  pageWrapperSelector: '#page-wrapper',
  pages: { //just json, can be hardcoded or via endpoint
    dataSourceName: "lPages",
    connectorName: "pagesConnector"
  },
  initialRoute: 'home',
  // routeConfig: {
  //   'home': {
  //     'route': '',
  //     'template': '<div>homepage</div>'
  //   }
  // }
  dataSources: { //a source of data from an endpoint and a contract of expectations, but not bound to any module
    //these pass into L's data source library so the framework can look them up by name on  a component config
    "samplePhotoListInfo": {
      "url": '/ajax/test-photo-info.json',
      "method": "GET",
      "dataStructure": {} //todo
    },
    "lPages": {
      "url": '/ajax/pages.json',
      "method": "GET",
      "dataStructure": {} //todo
    }
  },
  connectors: {
    "genericPhotoListConnector": {
      "srcPath": "data.photos",
      "destinationPath": "listItems", //this name is at the preference of the existing module!! <-- KEY CONCEPT
      "objectMap": { //parent object can have children of an array or nested objects
        "dataType": "array",
        "eachChildDefinition": { //child of an array, defined relative to the object root
          "dataType": "object",
          "srcPath": null, //=root
          "destinationPath": null
        }
      }
    },
    "pagesConnector": {
      "srcPath": "data.routerInfo", //just map it to an object
      "objectMap": {
        "dataType": "object"
      }
    }
  },
  stringData: { //in a real app, delay start until this is fetched
    'i18n': {
      'key1': 'This is a test string',
      'key2': 'This is a test string 2'
    }
  }
}

//point to class definition files
//L.LModule.extend
userDefinedComponents = {

}