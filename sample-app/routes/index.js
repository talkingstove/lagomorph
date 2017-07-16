var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Lagomorph Sample App123456' });
  // Lagomorph.hello();


});

module.exports = router;
