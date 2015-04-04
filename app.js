var express = require('express');
var stormpath = require('express-stormpath');


//MongoDB dependencies
var https = require("https");
var mongojs = require("mongojs");
var uri = "mongodb://<dbuser>:<dbpassword>@ds035557.mongolab.com:35557/unite"


//Authentication dependencies
var passport = require('passport')
var gcal = require('google-calendar');
var util = require('util');
var googleStrategy = require('passport-google-oauth2').Strategy;
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser');
var session = require('express-session')
var config = require('./node_modules/google-calendar/specs/config');

var calendarIds = [];
  var calendarCount = 0;
  var freeBusystring
  var freeBusy

var app = express();

app.set('views', './views');
app.set('view engine', 'jade');

var stormpathMiddleware = stormpath.init(app, {
      apiKeyFile: '/Users/Admin/Documents/Comp390/apiKey.properties',
      application: 'https://api.stormpath.com/v1/applications/2fZ2OU3JhLWWiHPE8WsECM',
      secretKey: 'T2NVglGDiABcKWEwGlUz',
      expandCustomData: true,
      enableForgotPassword: true
});
//Passportjs setup start

  app.use(cookieParser());
  app.use(bodyParser());
  app.use(session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());


passport.use(new googleStrategy({
    clientID: config.consumer_key,
    clientSecret: config.consumer_secret,
    callbackURL: "http://localhost:3000/auth/callback",
    scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar']
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    return done(null, profile);
  }
));

app.get('/auth',
  passport.authenticate('google', { session: false, successRedirect: '/', failureRedirect: '/' }));

app.get('/auth/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  function(req, res) {
    req.session.access_token = req.user.accessToken;
    res.redirect('/googleauth');
  });
//Passportjs setup end

//Google Calandar

app.all('/googleauth', function(req, res){

  

  if(!req.session.access_token) return res.redirect('/auth');
  //Create an instance from accessToken
  var accessToken = req.session.access_token;

  gcal(accessToken).calendarList.list(function(err, data) {
    if(err) return res.send(500,err);
    
      
      //Obtaining calendar Ids from user
      var items = data.items

      for(var objKey in items) {
          var calendars = items[objKey]
          for(var CalendarKey in calendars) {
              if (CalendarKey = "id")
              {
              calendarIds[calendarCount] = {"id": calendars[CalendarKey]};
              calendarCount++;
              break;
            }
         }
      }


      var idJson = JSON.stringify(calendarIds);

       var currentdate = new Date();   
       var currentdateString = currentdate.toISOString();

       var onehourdate = new Date();
       onehourdate.setHours(onehourdate.getHours() + 1);
       var onehourdateString = onehourdate.toISOString();

       freeBusy = {
         "timeMin": currentdateString,
         "timeMax": onehourdateString,
         "items": [
         idJson

         ]
       }

       console.log(freeBusy);
      
     freeBusystring = JSON.stringify(freeBusy);

      

      //  var headers = {
      // 'Content-Type': 'application/json',
      // 'Content-Length': freeBusystring.length
      
      //  };

      //  var options = {
      //   host: 'www.googleapis.com',
      //   path: '/calendar/v3/freeBusy',
      //   method: 'POST',
      //   headers: headers
      //   };



      //   // Setup the request.  The options parameter is
      //   // the object we defined above.
      //   var req = https.request(options, function(res) {
      //     res.setEncoding('utf-8');

      //     var responseString = '';

      //     res.on('data', function(data) {
      //       responseString += data;
      //     });

      //     res.on('end', function() {
      //       var resultObject = JSON.parse(responseString);
      //       console.log(JSON.stringify(resultObject) + "YOYO")
      //     });

          
      //    });

      //   req.on('error', function(e) {
      //     // TODO: handle error.
      //   });

      //   req.write(freeBusystring);
      //   req.end();

        // console.log(resultObject)

    return res.send(data);
  });
});


app.all('/googleauth/getjson', function (req, res){

  console.log(freeBusystring)

  if(!req.session.access_token) return res.redirect('/auth');

  var accessToken = req.session.access_token;

  gcal(accessToken).freebusy.query(freeBusy,function(err, data) {
        if(err) return res.send(500,err);

        console.log(data);
        return res.send(data);
      });

});

app.all('/googleauth/:calendarId', function(req, res){

  if(!req.session.access_token) return res.redirect('/auth');

  //Create an instance from accessToken
  var accessToken     = req.session.access_token;
  var calendarId      = req.params.calendarId;
      calendarId = calendarId.substr(1)

  gcal(accessToken).events.list(calendarId, {maxResults:1}, function(err, data) {
    if(err) return res.send(500,err);

    console.log(data)
    if(data.nextPageToken){
      gcal(accessToken).events.list(calendarId, {maxResults:1, pageToken:data.nextPageToken}, function(err, data) {
        //console.log(data.items)
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
//Google calendar end

app.use(stormpathMiddleware);

app.get('/', function (req, res) {
  res.render('home', {
    title: 'Welcome'
  });
});



app.use('/profile',require('./profile')());
app.use('/secret',require('./secret')());

app.listen(3000);
