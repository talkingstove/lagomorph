var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongo = require('mongodb').MongoClient;
var db;
var index = require('./routes/index');
var users = require('./routes/users');
var JsonDAO = require('./dao/jsons').JsonDAO;
var jsonDAO = new JsonDAO();

var cors = require('cors');

var app = express();
app.use(cors());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(function(req, res, next){
    req.db = db;
    next();
});

app.use('/', index);
app.use('/users', users);
app.get('/jsons', jsonDAO.get);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

var url = 'mongodb://localhost:27017/lagomorph';

mongo.connect(url, (err, _db) => {
    if(err) throw new Error(err);
    console.log("Connected successfully to db");
    db = _db;
    var server = app.listen(4000, function() {
      var port = server.address().port;
      console.log('server listening on port %s.', port);

    });
});
module.exports = app;









