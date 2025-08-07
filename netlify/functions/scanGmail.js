const { google } = require('googleapis');

// Regular expression to find common tracking numbers
const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|[0-9]{20,22}|9\d{15,21})\b/i;

// A helper function to find the plain text body of an email
function getPlainTextBody(message) {
  let body = '';
  const parts = message.data.payload.parts || [];
  
  // Find the plain text part of the email
  let plainTextPart = parts.find(part => part.mimeType === 'text/plain');

  if (plainTextPart && plainTextPart.body && plainTextPart.body.data) {
    body = Buffer.from(plainTextPart.body.data, 'base64').toString('utf8');
  }

  // Fallback if the body is not in parts (simple email)
  if (!body && message.data.payload.body && message.data.payload.body.data) {
     body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf8');
  }

  return body;
}

exports.handler = async (event) => {
  const { token } = JSON.parse(event.body);

  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };
  }

  const oAuth2Client = new google.auth.OAuth2();
  oAuth2Client.setCredentials({ access_token: token });
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  try {
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      q: '("your order has shipped" OR "tracking number" OR "out for delivery") newer_than:7d',
      maxResults: 25,
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    
    const uniquePackages = new Map();

    const promises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      // Get the full email body instead of just the snippet
      const fullBody = getPlainTextBody(msg);
      const trackingMatch = fullBody.match(TRACKING_REGEX);
      
      if (!trackingMatch) {
        return;
      }
      const trackingNumber = trackingMatch[0];

      const headers = msg.data.payload.headers;
      const fromHeader = headers.find(h => h.name === 'From');
      const dateHeader = headers.find(h => h.name === 'Date');
      const subjectHeader = headers.find(h => h.name === 'Subject');
      
      const sender = fromHeader ? fromHeader.value.split('<')[0].replace(/"/g, '').trim() : 'Unknown';
      const description = subjectHeader ? subjectHeader.value : msg.data.snippet;

      let carrier = 'Unknown';
      if (trackingNumber.startsWith('1Z')) carrier = 'UPS';
      else if (trackingNumber.length > 20) carrier = 'USPS';
      else carrier = 'FedEx';

      uniquePackages.set(trackingNumber, {
          sender: sender,
          carrier: carrier,
          description: description,
          date: new Date(dateHeader.value).toLocaleDateString(),
          status: 'In Transit',
          trackingNumber: trackingNumber
      });
    });
    
    await Promise.all(promises);
    const packages = Array.from(uniquePackages.values());

    return {
      statusCode: 200,
      body: JSON.stringify(packages),
    };
  } catch (error) {
    console.error('Error scanning Gmail:', error);