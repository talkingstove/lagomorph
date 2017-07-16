({
    baseUrl: '../js-app',
  	out: '../out/L.js',
    include: ["lagomorph"],
  	shim: {
        'jQuery': {
            exports: '$'
        },
        'lagomorph': {
            exports: 'L'
        },
        'test2': {
            exports: 'test2'
        }
    }
})