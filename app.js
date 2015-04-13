var express = require('express');
var stormpath = require('express-stormpath');


//MongoDB dependencies
var dbconfig = require('./dblogin');
var https = require("https");
var mongojs = require("mongojs");
var uri = "mongodb://" + dbconfig.dbuser + ":" + dbconfig.dbpassword + "@ds035557.mongolab.com:35557/unite"
var db = mongojs(uri, ["UsersFreeBusy"])
var userdb = mongojs(uri, ["UsersList"])

//Authentication dependencies
var passport = require('passport')
var gcal = require('google-calendar');
var util = require('util');
var googleStrategy = require('passport-google-oauth2').Strategy;
var bodyParser = require('body-parser');
var session = require('express-session')
var config = require('./node_modules/google-calendar/specs/config');

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

  app.use(bodyParser());
  app.use(session({ secret: 'keyboard cat',
                   }));
  app.use(passport.initialize());
  app.use(passport.session());


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

app.use(stormpathMiddleware);

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

app.all('/googleauth',stormpath.loginRequired , function(req, res){

  if(!req.session.access_token) return res.redirect('/auth');
  //Create an instance from accessToken
  var accessToken = req.session.access_token;

  gcal(accessToken).calendarList.list(function(err, data) {
    if(err) return res.send(500,err);
    
      
      //Obtaining calendar Ids from user
      var items = data.items
      var calendarIDstring = "[";

      for(var objKey in items) {
          var calendars = items[objKey]
          for(var CalendarKey in calendars) {
              if (CalendarKey = "id")
              {
              calendarIDstring += "{\"id\": \"" + calendars[CalendarKey] + "\"},"
              break;
            }
         }
      }

      calendarIDstring = calendarIDstring.substr(0,calendarIDstring.length -1) + "]";

      var calendarIDobj = JSON.parse(calendarIDstring)

       var currentdate = new Date();   
       var currentdateString = currentdate.toISOString();

       var onehourdate = new Date();
       onehourdate.setHours(onehourdate.getHours() + 1);
       var onehourdateString = onehourdate.toISOString();

       freeBusy = {
         "timeMin": currentdateString,
         "timeMax": onehourdateString,
         "items": 
         calendarIDobj  
       }

    return res.redirect('/googleauth/getjson');
  });
});


app.all('/googleauth/getjson',stormpath.loginRequired , function (req, res){

   //var exist = userdb.UsersList.find({ username : req.user.username }).limit(1);
   //console.log(exist);

  if(!req.session.access_token) return res.redirect('/auth');

  var accessToken = req.session.access_token;

  gcal(accessToken).freebusy.query(freeBusy,function(err, data) {
        if(err) return res.send(500,err);

       
        //add stormpath userinfo to the json recieved from freebusy query
        data.username = req.user.username

        data.calendars = JSON.stringify(data.calendars)
        //remove old queries in the database
        db.UsersFreeBusy.remove({ username : req.user.username },

          function(err, doc) {
          if(err != null)
            console.log(err)
            
        }); 


        db.UsersFreeBusy.insert(
        data, function(err, doc) {

          if(err != null)
            console.log(err)
            
        });



        return res.redirect('/');
      });

});

app.all('/display',stormpath.loginRequired , function (req, res) {
 


  parseFriends(req,res)

  res.render('home', {
    title: 'Welcome'
  });
});

app.get('/', function (req, res) {
  res.render('home', {
    title: 'Welcome'
  });
});



app.use('/profile',require('./profile')());

app.listen(3000);


function parseFriends(req,res)
{
  var starttimes = [];
  var endtimes = []
  var times = [starttimes, endtimes]

  var friendsString = req.user.customData.friends
  var friendsArray = friendsString.split(",")

  var currentdate = new Date();

  //Date.parse(datestring)

  for(index in friendsArray)
  {
      //Query is asynchronous
      db.UsersFreeBusy.find({username : friendsArray[index]}).forEach(function(err, doc) 
      {

        if(err)
          console.log(err + "err")
          

        if (!doc) 
        {
        // we visited all docs in the collection
        return;
        }

          
        var jsonretrieve = doc;
        jsonretrieve.calendars = JSON.parse(jsonretrieve.calendars)   
        //Loop to iterate through the JSON object and pick out busy times from the json object
        for (var key in jsonretrieve.calendars) 
        {
          if (jsonretrieve.calendars.hasOwnProperty(key)) 
          {
            if(jsonretrieve.calendars[key])
            {
                
              var busyItems = jsonretrieve.calendars[key]
              var timeItems = busyItems.busy[0]
                
              if(timeItems)
              {

                starttimes[starttimes.length] = new Date(Date.parse(timeItems.start));
                endtimes[endtimes.length] = new Date(Date.parse(timeItems.end));
              }

                
            }
          }
            
        }  

        //console.log(times) 

        //Need to pass this information somewhere in order to create a display for availability for this friend.
      
      });

  } 

  
};