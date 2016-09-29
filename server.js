var express = require('express');
var app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 3000;

var accountSid = 'ACf4e148816559544ed7ce17003dcc37e5';
var authToken = 'a54f023543553bdcac6fbada4f1b0a0c';

var twilio = require('twilio');
var client = new twilio.RestClient(accountSid, authToken);

// set the view engine to ejs
app.set('view engine', 'ejs');

// make express look in the public directory for assets (css/js/img)
app.use(express.static(__dirname + '/public'));

// set the home page route
app.get('/', function(req, res) {

    // ejs render automatically looks in the views folder
    res.render('index');
});

// set functionality to send sms
app.get('/sendSMS', function(req, res) {

    client.messages.create({
        to: "+12035502615",
        from: "+12039894740",
        body: "Hello from Jan Schoepp",
    }, function(err, message) {
        console.log(message.sid);
    });

    // ejs render automatically looks in the views folder
    res.render('index');

});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});
