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
app.get('/sendSMStoScharff', function(req, res) {

    client.messages.create({
        to: "+19292168151",
        from: "+12039894740",
        body: "Hello from Jan Schoepp",
    }, function(err, message) {
        console.log(message.sid);
    });

    // ejs render automatically looks in the views folder
    res.send('Message sent to Dr. Scharff!')

});

// set functionality to send sms
app.get('/sendSMS', function(req, res) {

    client.messages.create({
        to: "+12035502615",
        from: "+12039894740",
        body: "Someone is testing your webpage!",
    }, function(err, message) {
        console.log(message.sid);
    });

    // ejs render automatically looks in the views folder
    res.send('Message sent to Jan!');

});

// Create a route to respond to a call
app.post('/receiveSMS', function(req, res) {

    //Create TwiML response
    var twiml = new twilio.TwimlResponse();

    if (req.query.Body == 'Test'){
        twiml.message('Oh, are you testing?');
    } else if(req.query.Body == 'Bye') {
        twiml.message('Goodbye');
    } else {
        twiml.message('Thanks for the text. I haven\'t set up any functionality for that input yet. PS: Try \'test\'.');
    }

    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(twiml.toString());

});

// Create a route to respond to a call
app.post('/receiveCall', function(req, res) {

    var twiml = new twilio.TwimlResponse();

    twiml.say('Hi!  Thanks for giving me a call. Yan has been pretty busy, and has not had time to actually set something up here. Thanks for calling anyways.!');

    res.type('text/xml');
    res.send(twiml.toString());

});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});
