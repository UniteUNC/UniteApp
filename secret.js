var express = require('express');
var csurf = require('csurf');
var stormpath = require('express-stormpath');

module.exports = function secret(){

  var router = express.Router();

  router.use(csurf());

  // Capture all requests, the form library will negotiate
  // between GET and POST requests

  router.all('/', stormpath.loginRequired, function(req, res) {
    	
    	
    	res.render('secret.jade');
		

  });

  return router;
};
