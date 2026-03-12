const https = require('https');

const data = JSON.stringify({
    action: 'UPDATE_ALERT',
    fixtureId: 1410166,
    alertMinute: 15,
    finalScore: "3x0",
    goalMinutes: "27', 72', 88'",
    result: "GREEN"
});

const options = {
  hostname: 'script.google.com',
  path: '/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
