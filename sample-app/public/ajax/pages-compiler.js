var fs = require('fs');
var body = {
	"success": true,
	"data": {
		"routerInfo": {
			"homepage": "/home",
			"pages": {
				"/home": {
					"id": "homepage",
		      "template": "",
		      "useCachedData": false
		    },
		    "/testpage": {
					"id": "testpage",
					"viewParams": {
						"name": "Ryan"
					},
		      "template": "<div>oh hai {{name}}</div>",
		      "useCachedData": false
		    },
		    "/testpage2": {
					"id": "testpage2",
					"viewParams": {
						"name": "Joaquin"
					},
		      "template": "<div>oh hai {{name}}</div>",
		      "useCachedData": false
		    }
			}
		}
		
	}
}

var homepageTemplText = fs.readFile('./homepage.html', 'utf8', function(oErr, sText) {
    var oneline = sText.replace(/\n/g, '');
    body.data.routerInfo.pages['/home'].template = oneline;

    fs.writeFile("pages-output.json", JSON.stringify(body), function(err) {
		    if(err) {
		        return console.log(err);
		    }

		    console.log("The file was saved!");
		}); 
});



