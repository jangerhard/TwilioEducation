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

// Array containing all users that are registered in Firebase. Will update in realtime as server runs
var users = [];
db.ref("Users").on('child_added', function(snapshot) {
    users.push(snapshot.key);
    console.log('Added user: ' + snapshot.key + " under the name " + snapshot.val().name);

});
db.ref("Users").on("child_removed", function(snapshot) {
    var index = users.indexOf(snapshot.key);
    if (index > -1) {
        users.splice(index, 1);
        console.log('Removed user: ' + snapshot.key + " with name " + snapshot.val().name);
    }
});
// Array containing all teachers that are registered in Firebase. Will update in realtime as server runs
var teachers = [];
db.ref("Teachers").on('child_added', function(snapshot) {
    teachers.push(snapshot.key);
    console.log('Added teacher: ' + snapshot.key + " under the name " + snapshot.val().name);
});
db.ref("Teachers").on("child_removed", function(snapshot) {
    var index = teachers.indexOf(snapshot.key);
    if (index > -1) {
        teachers.splice(index, 1);
        console.log('Removed teacher: ' + snapshot.key + " with name " + snapshot.val().name);
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
    var REGISTER_TEACHER_CONSTANT = -15;
    var SELECTING_SUBJECT_CONSTANT = -20;

    var number = req.body.From;

    console.log('Received sms: ' + req.body.Body.toLowerCase().trim() +
        '\nFrom number: ' + number);

    //Check cookies
    console.log("Cookie: " + req.cookies.count);
    var counter = parseInt(req.cookies.counter) || 0;
    console.log("Counter: " + counter);

    var smsContent = req.body.Body.toLowerCase().trim();

    var introText = "";

    if (smsContent.length >= 25){
        twilioClient.sendSMS("Try to limit yourself to 25 chars");
        return;
    }

    if (smsContent == 'restart' || smsContent == 'reset') { // Restarting the service
        introText = 'Starting over.\n\n';
        counter = 0; // Starts the service again
        smsContent = "start"; // Starts the service again
    } else if (counter == REGISTER_CONSTANT) { // Registering the user with whatever the user has inputed
        registerUser(number, req.body.Body);
        introText = "Welcome to Quizmaster, " + req.body.Body + "!\n\n";
        counter = 0; // Starts the service again
        smsContent = "start"; // Starts the service again
    } else if (smsContent == 'regteacher') {
        console.log("Trying to register as teacher: " + number);
        if (teachers.indexOf(number) !== -1) { // Teacher already registered
            twilioClient.sendSMS(number, "You are already a registered teacher!");
            counter = 0;
            smsContent = "";
        } else {
            twilioClient.sendSMS(number, "Please register as a teacher by giving us your name: ");
            counter = REGISTER_TEACHER_CONSTANT;
        }
    } else if (counter == REGISTER_TEACHER_CONSTANT) { // User has requested to be registered as a teacher
        registerTeacher(number, req.body.Body);
        twilioClient.sendSMS(number, "You will now be notified whenever someone completes a test.");
        counter = 0;
        smsContent = "";
    } else if (smsContent == 'delteacher') {
        if (teachers.indexOf(number) !== -1) { // Teacher registered
            unregisterTeacher(number);
            twilioClient.sendSMS(number, "You are no longer registered as a teacher!");
        } else {
            //twilioClient.sendSMS(number, "You are not a registered teacher.");
        }
        counter = 0;
        smsContent = "";
    }

    if (counter == 0) { // Start of the service!
        if (smsContent == 'start') {

            if (users.indexOf(number) !== -1) { // User exists
                console.log("User found for this number: " + number);
                resetUser(number); // Catches any leftover scores
                twilioClient.sendSMS(number, introText + chooseCategory());
                counter = SELECTING_SUBJECT_CONSTANT;

            } else {
                console.log("No user found for this number.");
                twilioClient.sendSMS(number, 'First time using the service?' +
                    '\nPlease register by texting us your name.');
                counter = REGISTER_CONSTANT;
            }

        } else if (smsContent == "") { // If user registered as teacher
            //Do nothing here
        } else {
            twilioClient.sendSMS(number, 'You have not started the service. Text \'Start\' to start!');
        }
    } else if (counter == SELECTING_SUBJECT_CONSTANT) { // Selected starting subject

        console.log("User chose: " + smsContent);
        var subject = smsContent;
        if (subject === 'a' || subject === 'b' || subject === 'c') {
            sendQuizText("", number, subject, 1);
            updateCurrentSubject(number, subject);
            counter = 1;
        } else
            twilioClient.sendSMS(number, 'You are selecting a subject! \nYou have to input \'A\', \'B\', or \'C\'!');

    } else if (counter >= 1) { // Answering
        var answer = smsContent;

        // TODO: Let user know here that the quiz is done
        if (answer === 'a' || answer === 'b' || answer === 'c') {
            checkAnswer(number, answer, counter);
            counter++;
        } else
            twilioClient.sendSMS(number, 'You have to input \'A\', \'B\', or \'C\'!');
    }

    res.cookie('counter', counter);
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    console.log("End of interaction with updated counter: " + counter);
    res.end("SMS sent to " + number);

});

function checkAnswer(number, answer, counter) {

    console.log("Checking answer for Q" + counter);

    var userRef = db.ref("Users/" + number);

    userRef.once("value", function(snapshot) {
        var subject = snapshot.val().subject;

        var questionRef = db.ref("Questions/" + subject + "/Q" + counter);

        questionRef.once("value", function(s_shot) {

            if (s_shot.val() == null || s_shot == null) {
                twilioClient.sendSMS(number, "You completed all the question for " + subject +
                    "!\nText 'restart' to try again!");
                return;
            }

            var correctAnswer = s_shot.val().correct.toLowerCase();

            console.log("Correct answer: " + (correctAnswer === answer));

            if (correctAnswer === answer) {
                incrementTotCorrect(number);
                sendQuizText("That is correct!\n", number, subject, counter + 1);
            } else
                sendQuizText("That is wrong..\n", number, subject, counter + 1);

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
        subject: "nothing",
        totCorrect: 0
    });
}

function registerTeacher(number, username) {

    var ref = db.ref("Teachers");

    ref.child(number).set({
        name: username
    });
}

function unregisterTeacher(number) {

    var ref = db.ref("Teachers");

    ref.child(number).remove();
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
    var sub = getSubject(subject);

    var subjectRef = db.ref("Users").child(number);
    subjectRef.update({
        "subject": sub,
    });
}

function incrementTotCorrect(number) {
    var subjectRef = db.ref("Users").child(number).child("totCorrect");
    subjectRef.transaction(function(totCorrect) {
        return (totCorrect || 0) + 1;
    });
}

function resetUser(number) {

    var subjectRef = db.ref("Users").child(number);
    subjectRef.update({
        "subject": "nothing",
        "totCorrect": 0,
    });
}

function sendCompleteStats(number, totQuestions) {
    var userRef = db.ref("Users").child(number);
    userRef.once("value", function(snapshot) {
        var correct = snapshot.val().totCorrect;
        var txt;

        if (correct > 0) {

            if (correct == totQuestions)
                txt = "Congratulations, " + snapshot.val().name + "! You got every single question right!";
            else if (correct > totQuestions)
                txt = "Hm, you have more correct answers than questions.. " + correct + "/" + totQuestions + "! No one likes a cheater..";
            else
                txt = "Congratulations, " + snapshot.val().name + "! You completed the entire quiz. You got " +
                correct + "/" + totQuestions + "! Well done!";

        } else {
            txt = "Well done, " + snapshot.val().name + "!" +
                "You completed the entire quiz, but did not get a single question right.. Better luck next time!";
        }
        notifyTeachers(snapshot.val().name, correct + "/" + totQuestions, snapshot.val().subject);
        twilioClient.sendSMS(number, txt + " Try again by texting 'restart'.");
    });
}

function sendQuizText(intro, number, subjectChar, counter) {
    var text;
    var sub;

    sub = getSubject(subjectChar);

    console.log("Checking for " + sub + "/Q" + counter);

    //Gets Question and answer based on subject and counter
    var ref = db.ref("Questions/" + sub + "/Q" + counter);
    ref.once("value", function(snapshot) {

        if (snapshot.val() == null || snapshot == null) {
            sendCompleteStats(number, counter - 1);
            return;
        }

        console.log("Sending text for " + sub + "/Q" + counter);

        text = intro +
            "\nQ" + counter + ": " +
            "\n" + snapshot.val().Text +
            "\nA: " + snapshot.val().A +
            "\nB: " + snapshot.val().B +
            "\nC: " + snapshot.val().C;

        twilioClient.sendSMS(number, text);

    }, function(errorObject) {
        twilioClient.sendSMS(number, "You've completed all the tests!");
    });
}

function notifyTeachers(nameOfStudent, score, subject) {
    for (var i in teachers)
        twilioClient.sendSMS(teachers[i], "Student " + nameOfStudent + " just got " +
            score + " in " + subject);
}

function getSubject(subjectChar) {

    var sub;

    switch (subjectChar) {
        case 'Biology':
        case 'a': // Biology
            return 'Biology';

        case 'Physics':
        case 'b': // Physics
            return 'Physics';

        case 'Maths':
        case 'c': // Maths
            return 'Maths';

        case 'nothing':
            return 'nothing';

        default:
            console.error('Something went wrong after selecting a subject. Input: ' + subjectChar);
            return "nothing";
    }

}

app.get('/teachers', function(req, res){

  notifyTeachers("Jan", "testing", "Service");

  res.send("Test");

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
