var express = require('express.io');
var stormpath = require('express-stormpath');
var geolocation = require('geolocation');
var geolib = require('geolib');

var app = express(); //change
app.use("/googleauth/public",express.static(__dirname + '/views'));

//MongoDB dependencies
var dbconfig = require('./dblogin');
var https = require("https");
var mongojs = require("mongojs");
var uri = "mongodb://" + dbconfig.dbuser + ":" + dbconfig.dbpassword + "@ds035557.mongolab.com:35557/unite"
var db = mongojs(uri, ["UsersFreeBusy"]);
var userdb = mongojs(uri, ["UsersList"]);
var http = require("http");

//Authentication dependencies
var passport = require('passport');
var gcal = require('google-calendar');
var util = require('util');
var googleStrategy = require('passport-google-oauth2').Strategy;
var bodyParser = require('body-parser');
var session = require('express-session');
var config = require('./node_modules/google-calendar/specs/config');




// make html, js & css files accessible
//var files = new static.Server('./public');



var static = require('node-static');
var server = require('http').Server(app);
var io = require('socket.io')(server);

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

function personData(start,end, username, available, lat, long) {
    this.start = start;
	this.end = end;
	this.username = username;
	this.available = available;
	this.lat = lat;
	this.long = long;
	//console.log(this);
};

app.get('/auth',
  passport.authenticate('google', { session: false, successRedirect: '/', failureRedirect: '/' }));

app.get('/auth/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  function(req, res) {
    req.session.access_token = req.user.accessToken;
    res.redirect('/');
  });
//Passportjs setup end

//Google Calandar

app.all('/',stormpath.loginRequired , function(req, res){
	
	
	var freeBusy;	

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
       onehourdate.setHours(onehourdate.getHours() + 6);
       var onehourdateString = onehourdate.toISOString();
	  //change to store in stormpath user custom data instead of global variable
       freeBusy = {
         "timeMin": currentdateString,
         "timeMax": onehourdateString,
         "items": 
         calendarIDobj  
       }
	   
	   req.session.freebusy = freeBusy

    return res.redirect('/googleauth/getjson');
  });
});

app.http().io()

app.io.route('ready',function(req) {
	db.UsersFreeBusy.update({username : req.data[2]}, {$set:{coordlat: req.data[0], coordlong: req.data[1]}});
	
})

app.all('/googleauth/getjson',stormpath.loginRequired , function (req, res){

   var exist = userdb.UsersList.find({ username : req.user.username }).limit(1);
//   console.log(exist);

  if(!req.session.access_token) return res.redirect('/auth');

  var accessToken = req.session.access_token;

  gcal(accessToken).freebusy.query(req.session.freebusy,function(err, data) {
        if(err) return res.send(500,err);

       
        //add stormpath userinfo to the json recieved from freebusy query
        data.username = req.user.username

        data.calendars = JSON.stringify(data.calendars)
        //remove old queries in the database
        db.UsersFreeBusy.remove({ username : req.user.username },

          function(err, doc) {
          if(err)
            console.log(err)
            
        }); 


        db.UsersFreeBusy.insert(
        data, function(err, doc) {

          if(err)
            console.log(err)
			
		//return res.send(data);	
		var info = parseFriends(req,res);
		//return res.sendfile(__dirname + '/views/index.html');
			
          
  	});  
	  
	  	
        });
	
	
	
	

});

app.all('/display',stormpath.loginRequired , function (req, res) {
 


 var info = parseFriends(req,res)
 
//display data based on the info array of persondata objects
 //calc distance
 


	//res.send(info)
	
//  res.render('home', {
//    title: 'Welcome'
//  });
});

//app.get('/',stormpath.loginRequired, function (req, res) {
	
  //res.sendfile(__dirname + '/views/index.html');
  	
	//res.render('index.html');
	
//  res.render('home', {
//    title: 'Welcome',
//	username: JSON.stringify(req.user.username)
//  });
//});



app.use('/profile',require('./profile')());

//app.listen(3000);
//Openshift deployment
var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
 
server.listen(server_port, server_ip_address, function () {
  console.log( "Listening on " + server_ip_address + ", server_port " + port )
});

io.set('origins', '*:*');

function parseFriends(req,res)
{
  
  var starttimes = [];
  var endtimes = [];
	
  
  var peopleData = [];

  var friendsString = req.user.customData.friends
  var friendsArray = friendsString.split(",")
  var friendIndex = 0;

  var currentdate = new Date();

  //Date.parse(datestring)
 
	
  asyncLoop(friendsArray.length , function(loop) {
    //Query is asynchronous
      db.UsersFreeBusy.find({username : friendsArray[friendIndex]}).forEach(function(err, doc) 
      {
		  starttimes = [];
		  endtimes = []
		  
        if(err)
          console.log(err + "err")
          

        if (!doc || doc == null) 
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
			 
			  //console.log(busyItems + "BUSYITEMS");
              var timeItems = busyItems.busy[0]
              //console.log(timeItems);
              if(timeItems)
              {

                starttimes[starttimes.length] = new Date(Date.parse(timeItems.start));
                endtimes[endtimes.length] = new Date(Date.parse(timeItems.end));
              }

                
            }
          }
            
        } 
		  
		  //determine if the user is currently busy, or when they will become available (if they are busy), otherwise, say available until _
		  
		  //if user if available for the foreseeable future (6 hours)
		  if(starttimes.length == 0)
		  {
			  peopleData[peopleData.length] = new personData(0,0,jsonretrieve.username, "true", jsonretrieve.coordlat, jsonretrieve.coordlong);
		  }
				
		  else
		  {
			  var minstart;  //= starttimes[0];
			  var minend;//= endtimes[0];
			  var busy = null;
			  for (j = 0; j < starttimes.length;j++)
			  {
				  
				  if(starttimes[j] < currentdate && endtimes[j] > currentdate)
						  busy = "true";
				  
				  if(starttimes[j] > currentdate && busy != "true")
					  busy = "false";
				  
				 
					  
				  if(typeof(minstart) === 'undefined')
				  {
					  minstart = starttimes[j];
					  
					  if(starttimes[j] < currentdate && endtimes[j] > currentdate)
						  busy = "true";
				  }
				  
				  
				  if ((starttimes[j] < minstart && endtimes[j] < minend) || (starttimes[j] < currentdate && enditmes[j] < currentdate))
					  minstart = starttimes[j];
			  }
			  
			  for (k = 0; k < endtimes.length;k++)
			  {
				  if (endtimes[k] < minend || (starttimes[j] < currentdate && enditmes[j] < currentdate))
					  minend = endtimes[k];
				  
				  if(typeof(minend) === 'undefined')
				  {
					  minend = endtimes[k]
				  }
			  }
			  
			  
			  
			 
				  peopleData[peopleData.length] = new personData(minstart,minend,jsonretrieve.username, busy, jsonretrieve.coordlat, jsonretrieve.coordlong);
			
		  }

        

        //Need to pass this information somewhere in order to create a display for availability for this friend.
		friendIndex++;
      	loop.next()
      })},
    function(){return res.render('index', {
	    username: req.session.username,
		data: JSON.stringify(peopleData)
      });}
 
);

}

			

function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}

