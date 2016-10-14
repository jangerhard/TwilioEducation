var express = require('express'),
    bodyParser = require('body-parser'),
    twilio = require('twilio'),
    cookieParser = require('cookie-parser');

var app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 3000;

//Twilio stuff
var accountSid = 'ACf4e148816559544ed7ce17003dcc37e5';
var authToken = 'a54f023543553bdcac6fbada4f1b0a0c';
var client = new twilio.RestClient(accountSid, authToken);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());

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

var serviceName = "QuizMaster";

// Create a route to receive an SMS
app.post('/receiveSMS', function(req, res) {

    console.log('Received sms: ' + req.body.Body);

    //Create TwiML response
    var twiml = new twilio.TwimlResponse();

    //Check cookies
    console.log(req.cookies.count);
    var counter = parseInt(req.cookies.counter) || 0;

    var smsContent = req.body.Body.toLowerCase().trim();

    if (smsContent == 'restart') { // Restarting the service
        twiml.message('Starting over.');
        counter = 0;
    } else if (counter == 0) { // First message received by user
        if (smsContent == 'start') {
            twiml.message('Hi and welcome to ' + serviceName + '!' +
                '\nPlease select one of the following options using a single number: ' +
                '\n1. Biology' +
                '\n2. Physics' +
                '\n3. Maths' +
                '\n\nSend \'restart\' at any time to start over.');
            counter++;
        } else {
            twiml.message('You have not started the service. Text \'Start\' to start!');
        }
    }

    if (counter == 1) { // Selected subject
        var subject = parseInt(smsContent);
        if (isNaN(subject) || (subject < 1 && subject > 3))
            twiml.message('You have to input a number from 1 to 3!');
        else {
            twiml.message(getQuizText(subject, counter));
            counter++;
        }

    } else {

    }

    res.cookie('counter', counter);
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(twiml.toString());

});

function getQuizText(subject, counter) {
    var text;

    switch (subject) {
        case 1: // Biology
            text = 'You selected Biology!';
            break;
        case 2: // Physics
            text = 'You selected Physics!';
            break;
        case 3: // Maths
            text = 'You selected Maths!';
            break;
        default:
            text = 'Something went wrong after selecting a subject.';

    }

    return text;
}

// Create a route to respond to a call
app.post('/receiveCall', function(req, res) {

    var stringResponse = 'Hi!  Thanks for giving me a call. ' +
        'Yan has been pretty busy, and has not had time to actually set something up here. Thanks for calling anyways.!';

    var twiml = new twilio.TwimlResponse();

    twiml.say(stringResponse, {
        voice: 'woman',
        language: 'en-gb'
    });

    res.type('text/xml');
    res.send(twiml.toString());

    console.log(resp.toString());
});

app.listen(port, function() {
    console.log('Our app is running on http://localhost:' + port);
});
