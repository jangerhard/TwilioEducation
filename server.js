var express = require('express'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    firebase = require("firebase"),
    twilioClient = require('./twilioClient');

var app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
var port = process.env.PORT || 3000;

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

var users = [];
db.ref("Users").on('child_added', function(snapshot) {
    users.push(snapshot.key);
    console.log('Added user: ' + snapshot.key);
});
db.ref("Users").on("child_removed", function(snapshot) {
    var index = users.indexOf(snapshot.key);
    if (index > -1) {
        users.splice(index, 1);
        console.log('Removed user: ' + snapshot.key);
    }
});

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

// Create a route to receive an SMS
app.post('/receiveSMS', function(req, res) {

    var REGISTER_CONSTANT = -10;

    var number = req.body.From;

    console.log('Received sms: ' + req.body.Body +
        '\nFrom number: ' + number);

    //Check cookies
    console.log("Cookie: " + req.cookies.count);
    var counter = parseInt(req.cookies.counter) || 0;
    console.log("Counter: " + counter);

    var smsContent = req.body.Body.toLowerCase().trim();

    if (counter == REGISTER_CONSTANT) {
        registerUser(number, req.body.Body);
        twilioClient.sendSMS(number, "You are registered, " + req.body.Body + "!");
        counter = 0;
    }

    if (smsContent == 'restart') { // Restarting the service
        twilioClient.sendSMS(number, 'Starting over.');
        updateCurrentSubject(number, "Nothing");
        counter = 0;
    } else if (counter == 0) { // First message received by user
        if (smsContent == 'start') {

            if (users.indexOf(number) !== -1) { // User exists
                console.log("User found for this number: " + number);
                twilioClient.sendSMS(number, chooseCategory());
                updateCurrentSubject(number, "nothing");
                counter = 1;

            } else {
                console.log("No user found for this number.");
                twilioClient.sendSMS(number, 'We could not find a user associated with your number!' +
                    '\nPlease text us your name.');
                counter = REGISTER_CONSTANT;
            }

        } else {
            twilioClient.sendSMS(number, 'You have not started the service. Text \'Start\' to start!');
        }
    } else if (counter == 1) { // Selected starting subject

        console.log("User chose: " + smsContent);
        var subject = smsContent;
        if (subject === 'a' || subject === 'b' || subject === 'c') {
            sendQuizText(number, subject, counter);
            updateCurrentSubject(number, subject);
            counter++;
        } else
            twilioClient.sendSMS(number, 'You have to input \'A\', \'B\', or \'C\'!');

    } else if (counter == 2) { // Answering
        var answer = smsContent;

        // TODO: Fix checking for answers
        if (answer === 'a' || answer === 'b' || answer === 'c') {

            checkAnswer(number, answer, counter);
            counter++;
        } else
            twilioClient.sendSMS(number, 'You have to input \'A\', \'B\', or \'C\'!');

    } else {
        twilioClient.sendSMS(number, 'For now that is all.. Text \'restart\' to start over!');
    }

    res.cookie('counter', counter);
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    console.log("End of interaction with updated counter: " + counter);
    res.end("SMS sent to " + number);

});

function checkAnswer(number, answer, counter) {
    var userRef = db.ref("Users/" + number);

    userRef.once("value", function(snapshot) {
        var subject = snapshot.val().subject;

        var questionRef = db.ref("Questions/" + subject + "/Q" + counter);

        questionRef.once("value", function(snapshot) {
            if (snapshot.val().correct == answer)
                twilioClient.sendSMS(number, 'That is correct! Next question: ');
            else
                twilioClient.sendSMS(number, 'That is wrong.. Next question: ');

            sendQuizText(number, subject, counter+1);
        }, function(errorObject) {
            console.error(errorObject);
        });
    }, function(errorObject) {
        console.error(errorObject);
    });
}

function registerUser(number, username) {

    var ref = db.ref("Users");

    ref.child(number).set({
        name: username,
        subject: "nothing"
    });

}

function chooseCategory() {

    var txt = 'Please select one of the following options using a single character: ' +
        '\nA. Biology' +
        '\nB. Physics' +
        '\nC. Maths' +
        '\n\nSend \'restart\' at any time to start over.'

    return txt;
}

function updateCurrentSubject(number, subject) {
    var subjectRef = db.ref("Users").child(number);
    subjectRef.update({
        "subject": getSubject(subject),
    });
}

function sendQuizText(number, subjectChar, counter) {
    var text;
    var sub;

    sub = getSubject(subjectChar);

    //Gets Question and answer based on subject and counter
    var ref = db.ref("Questions/" + sub + "/Q" + counter);
    ref.once("value", function(snapshot) {
        text = "\nQ" + counter + ": " +
            "\n" + snapshot.val().Text +
            "\nA: " + snapshot.val().A +
            "\nB: " + snapshot.val().B +
            "\nC: " + snapshot.val().C;

        twilioClient.sendSMS(number, text);

    }, function(errorObject) {
        twilioClient.sendSMS(number, "You've completed all the tests!");
    });
}

function getSubject(subjectChar){

  var sub;

  switch (subjectChar) {
      case 'a': // Biology
          sub = 'Biology';
          break;
      case 'b': // Physics
          sub = 'Physics'
          break;
      case 'c': // Maths
          sub = 'Maths'
          break;
      default:
          console.error('Something went wrong after selecting a subject. Input: ' + subject);
          return "Error";
  }

  return sub;

}


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
app.get('/sendSMStoScharff', function(req, res) {

    twilioClient.sendSMS("+19292168151", "Hello from Jan Schoepp");
    res.send('Message sent to Dr. Scharff!')

});

// set functionality to send sms
app.get('/sendSMS', function(req, res) {

    var ref = db.ref("Questions/Biology/Q1");
    ref.once("value", function(snapshot) {

        var txt = snapshot.val();
        console.log("From firebase: " + txt);

        twilioClient.sendSMS("+12035502615",
            "Cheat-mode activated for Biology/Q1:\n\n" +
            txt.Text +
            "\nCorrect answer: " + txt.B);
    });

    // ejs render automatically looks in the views folder
    res.send('Message sent to Jan!');

});

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
