({
    baseUrl: '../src',
  	out: '../out/L.js',
    include: ["lagomorph"], //the main app file, which requires the rest
    name: '../lib/almond', //Almond is lightweight AMD substitute so we don't have to bundle require.js source
    wrap: {
        startFile: 'start.frag.js',
        endFile: 'end.frag.js'
    }
})