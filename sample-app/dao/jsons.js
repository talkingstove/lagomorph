'use strict';

function JsonDAO() {

    this.get = function get(req, res) {
        if (!req.db) {
            console.warn('no db connection!!');
            res.send(500);
            return;
        }
        var query = {fileName: "weirdFile.json"};
        var project = {fileName: 1}; //project (verb) means which fields to include. this is optional, use if you only want certain fields returned. _id will always return unless you pass _id: -1
        var sort = {fileName: 1};// use -1 to sort descending, 1 ascending.
        req.db.collection('json')
            .find(query, project)
            .sort(sort)  //you can also use .skip and .limit for pagination
            .toArray(function (error, results) {
                if (error) throw new Error(error);
                res.status(200).send(results);
            })

    }

}

module.exports.JsonDAO = JsonDAO;