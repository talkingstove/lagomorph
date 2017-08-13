var allTestFiles = []
var TEST_REGEXP = /(spec|test)\.js$/i

// Get a list of all the test files to include
Object.keys(window.__karma__.files).forEach(function (file) {
  if (TEST_REGEXP.test(file)) {
    // Normalize paths to RequireJS module names.
    // If you require sub-dependencies of test files to be loaded as-is (requiring file extension)
    // then do not normalize the paths
    var normalizedTestModule = file.replace(/^\/base\/|\.js$/g, '')
    allTestFiles.push(normalizedTestModule)
  }
})

require.config({
  // Karma serves files under /base, which is the basePath from your config file
  baseUrl: '/base',

  // dynamically load all test files
  deps: allTestFiles,

  paths: {
    'lagomorph': 'src/lagomorph',
    'LBase': 'src/LBase',
    'LModule': 'src/LModule',
    'LComponent': 'src/LComponent',
    'LPage': 'src/LPage',
    'L_List': 'src/components/L_List',
    'scanner': 'src/scanner',
    'Fiber': 'lib/fiber.min',
    'jquery': 'lib/jquery.min',
    'underscore': 'lib/underscore-min',
    'Handlebars': 'lib/handlebars.min',
    'dexie': 'lib/dexie',
    'himalaya': 'lib/himalaya',
    'viewUtils': 'src/utils/viewUtils',
    'componentInstanceLibrary': 'src/componentInstanceLibrary',
    'dataSourceLibrary': 'src/dataSourceLibrary',
    'LLibrary': 'src/library/LLibrary',
    'ajaxRequester': 'src/ajax/ajaxRequester',
    'agreementsTester': 'src/ajax/agreements/agreementsTester',
    'connectorLibrary': 'src/connectorLibrary',
    'connectorUtils': 'src/ajax/connector/connectorUtils',
    'objectUtils': 'src/utils/objectUtils',
    'uiStringsLibrary': 'src/uiStringsLibrary',
    'templateUtils': 'src/utils/templateUtils',
    'pageLibrary': 'src/pageLibrary',
    'director': 'lib/director.min',
    'LRouter': 'src/LRouter',
  },

  // we have to kickoff jasmine, as it is asynchronous
  callback: window.__karma__.start
})
