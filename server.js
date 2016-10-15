var express = require('express'),
    bodyParser = require('body-parser'),
    twilio = require('twilio'),
    cookieParser = require('cookie-parser'),
    firebase = require("firebase");

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

// Initialize the app with no authentication
firebase.initializeApp({
    databaseURL: "https://twilio-project-46af1.firebaseio.com"
});
// The app only has access to public data as defined in the Security Rules
var db = firebase.database();

// set the view engine to ejs
app.set('view engine', 'ejs');

// make express look in the public directory for assets (css/js/img)
app.use(express.static(__dirname + '/public'));

// set the home page route
app.get('/', function(req, res) {

    // ejs render automatically looks in the views folder
    res.render('index');
});

app.get('/twiliopart2', function(req, res) {

    // ejs render automatically looks in the views folder
    res.render('twiliopart2');
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

// testing Firebase
app.get('/test', function(req, res) {

    var ref = db.ref("Questions/Biology/Q1");

    // Attach an asynchronous callback to read the data at our posts reference
    ref.on("value", function(snapshot) {
        var txt = snapshot.val().Text;
        console.log('Got text: ' + txt);
        res.send('From firebase: ' + txt);
    }, function(errorObject) {
        console.log("The read failed: " + errorObject.code);
        res.send("The read failed: " + errorObject.code);
    });
});

// set functionality to send sms
app.get('/sendSMS', function(req, res) {

    var ref = db.ref("Questions/Biology/Q1");
    ref.once("value", function(snapshot) {

        var txt = snapshot.val();
        console.log("From firebase: " + txt);

        client.messages.create({
            to: "+12035502615",
            from: "+12039894740",
            body: "Cheat-mode activated for Biology/Q1:\n\n" +
                txt.Text +
                "\nCorrect answer: " + txt.B,
        }, function(err, message) {
            console.log(message.sid);
        });

    });

    // ejs render automatically looks in the views folder
    res.send('Message sent to Jan!');

});

var serviceName = "QuizMaster";
// Create a route to receive an SMS
app.post('/receiveSMS', function(req, res) {

    console.log('Received sms: ' + req.body.Body +
                '\nFrom number: ' + req.body.From);

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
                '\nPlease select one of the following options using a single character: ' +
                '\nA. Biology' +
                '\nB. Physics' +
                '\nC. Maths' +
                '\n\nSend \'restart\' at any time to start over.');
            counter++;
        } else {
            twiml.message('You have not started the service. Text \'Start\' to start!');
        }
    } else if (counter == 1) { // Selected subject
        var subject = smsContent;
        if (subject === 'a' || subject === 'b' || subject === 'c') {
            twiml.message(getQuizText(subject, counter));
            counter++;
        } else
            twiml.message('You have to input \'A\', \'B\', or \'C\'!');


    } else if (counter == 2) { // Answering
        var answer = smsContent;
        if (subject !== 'a' || subject !== 'b' || subject !== 'c')
            twiml.message('You have to input \'A\', \'B\', or \'C\'!');
        else {
            // TODO: Fix checking for answers
            if (answer != '1')
                twiml.message('Unfortunatelly that is wrong.. Try again!');
            else {
                twiml.message('That is correct! Well done!');
                twiml.message(getQuizText(subject, counter));
                counter++;
            }
        }
    } else {
        twiml.message('For now that is all.. Text \'restart\' to start over!');
    }

    res.cookie('counter', counter);
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(twiml.toString());

});

function getQuizText(subject, counter) {
    var text;
    var sub;

    switch (subject) {
        case 'A': // Biology
            sub = 'Biology';
            break;
        case 'B': // Physics
            sub = 'Physics'
            break;
        case 'C': // Maths
            sub = 'Maths'
            break;
        default:
            text = 'Something went wrong after selecting a subject.';
            return text;
    }

    //Gets Question and answer based on subject and counter
    var ref = db.ref("Questions/" + sub + "/Q" + counter);
    ref.once("value", function(snapshot) {
        text = "\nQ" + counter + ": " +
            "\n" + snapshot.val().Text +
            "\nA: " + snapshot.val().A +
            "\nB: " + snapshot.val().B +
            "\nC: " + snapshot.val().C;
        return text;
    }, function(errorObject) {
        return "You've completed all the tests!";
    });
}

// Create a route to respond to a call
app.post('/receiveCall', function(req, res) {

    var stringResponse = 'Hi!  Thanks for giving me a call. ' +
        'Yan has been pretty busy, and has not had time to actually set something up here. ' +
        'You could always try to text the codeword start to this number. Thanks for calling anyways.!';

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
    console.log('The app is running on http://localhost:' + port);
});
