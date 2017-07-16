// Place third party dependencies in the lib folder
//
// Configure loading modules from the lib directory,
// except 'app' ones, 
requirejs.config({
    "baseUrl": "js/lib",
    "paths": {
      "js-app": "../js-app", //relative to baseUrl
      "jquery": "//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min",
      "lagomorph": "../lib/lagomorph/L", //relative to baseUrl
    }
    // shim: {
    //     'jQuery': {
    //         exports: '$'
    //     },
    //     'lagomorph': {
    //         exports: 'L'
    //     }
    // }
});

// Load the main app module to start the app
requirejs(["js-app/main"]);