({
    baseUrl: '../src',
  	out: '../out/L.js',
    include: ["lagomorph"] //the main app file, which requires the rest
  	// shim: {
   //      'jQuery': {
   //          exports: '$'
   //      },
   //      'lagomorph': {
   //          exports: 'L'
   //      },
   //      'test2': {
   //          exports: 'test2'
   //      }
   //  }
})