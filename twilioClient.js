var twilio = require('twilio');

//Twilio stuff
var accountSid = 'ACf4e148816559544ed7ce17003dcc37e5';
var authToken = 'a54f023543553bdcac6fbada4f1b0a0c';
var client = new twilio.RestClient(accountSid, authToken);

module.exports.sendSMS = function(to, message) {
  client.messages.create({
    body: message,
    to: to,
    from: "+12039894740",
    // mediaUrl: 'http://www.yourserver.com/someimage.png'
  }, function(err, data) {
    if (err) {
      console.error('Could not send sms!');
      console.error(err);
    } else {
      console.log('Sms sent to: ' + to);
    }
  });
};
