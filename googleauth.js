var express = require('express');
var stormpath = require('express-stormpath');

//Authentication dependencies
var passport = require('passport')
var gcal = require('google-calendar');
var util = require('util');
var googleStrategy = require('passport-google-oauth2').Strategy;
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser');
var session = require('express-session')
var config = require('./node_modules/google-calendar/specs/config');

var app = express();

module.exports = function googleauth(){

var router = express.Router();

  router.all('/', stormpath.loginRequired, function(req, res) {
    //Passportjs setup start
    res.render('secret.jade');
    console.log("TEST");
      app.use(cookieParser());
      app.use(bodyParser());
      app.use(session({ secret: 'keyboard cat' }));
      app.use(passport.initialize());


    passport.use(new googleStrategy({
        clientID: config.consumer_key,
        clientSecret: config.consumer_secret,
        callbackURL: "http://localhost:3000/profile",
        scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar']
      },
      function(accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        return done(null, profile);
      }
    ));

    app.get('/auth',
      passport.authenticate('google', { session: false }));

    app.get('/auth/callback',
      passport.authenticate('google', { session: false, failureRedirect: '/login' }),
      function(req, res) {
        req.session.access_token = req.user.accessToken;
        res.redirect('/');
      });
    //Passportjs setup end

    //Google Calandar

    app.all('/', function(req, res){

      if(!req.session.access_token) return res.redirect('/auth');

      //Create an instance from accessToken
      var accessToken = req.session.access_token;

      gcal(accessToken).calendarList.list(function(err, data) {
        if(err) return res.send(500,err);
        return res.send(data);
      });
    });

    app.all('/:calendarId', function(req, res){

      if(!req.session.access_token) return res.redirect('/auth');

      //Create an instance from accessToken
      var accessToken     = req.session.access_token;
      var calendarId      = req.params.calendarId;

      gcal(accessToken).events.list(calendarId, {maxResults:1}, function(err, data) {
        if(err) return res.send(500,err);

        console.log(data)
        if(data.nextPageToken){
          gcal(accessToken).events.list(calendarId, {maxResults:1, pageToken:data.nextPageToken}, function(err, data) {
            console.log(data.items)
          })
        }


        return res.send(data);
      });
    });


    app.all('/:calendarId/:eventId', function(req, res){

      if(!req.session.access_token) return res.redirect('/auth');

      //Create an instance from accessToken
      var accessToken     = req.session.access_token;
      var calendarId      = req.params.calendarId;
      var eventId         = req.params.eventId;

      gcal(accessToken).events.get(calendarId, eventId, function(err, data) {
        if(err) return res.send(500,err);
        return res.send(data);
      });
    });
  });
    //Google calendar end
  return router;
};