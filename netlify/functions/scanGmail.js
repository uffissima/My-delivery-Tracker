const { google } = require('googleapis');

// UPDATED: A more flexible REGEX to catch more carrier formats, including 12-digit FedEx
const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|\d{12,15}|\d{20,22}|9\d{15,21})\b/i;

function getPlainTextBody(message) {
  let body = '';
  if (message.data && message.data.payload) {
      const parts = message.data.payload.parts || [];
      const plainTextPart = parts.find(part => part.mimeType === 'text/plain');

      if (plainTextPart && plainTextPart.body && plainTextPart.body.data) {
          body = Buffer.from(plainTextPart.body.data, 'base64').toString('utf8');
      }

      if (!body && message.data.payload.body && message.data.payload.body.data) {
          body = Buffer.from(message.data.payload.body.data, 'base64').toString('utf8');
      }
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
      q: 'in:anywhere ("your order has shipped" OR "tracking number" OR "out for delivery" OR "shipment notification" OR "delivery update" OR from:ups OR from:fedex OR from:usps) newer_than:7d',
      maxResults: 25,
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    
    const uniquePackages = new Map();

    const promises = messages.map(async (message) => {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
        
        const fullBody = getPlainTextBody(msg);
        if (!fullBody) return;

        // --- DEBUGGING CODE IS STILL HERE ---
        const headers = msg.data.payload.headers || [];
        const subjectHeader = headers.find(h => h.name === 'Subject');
        console.log(`--- Checking Email Subject: ${subjectHeader ? subjectHeader.value : 'No Subject'} ---`);
        console.log(fullBody.substring(0, 500));
        // ------------------------------------
        
        const trackingMatch = fullBody.match(TRACKING_REGEX);
        if (!trackingMatch) return;
        
        const trackingNumber = trackingMatch[0];
        const fromHeader = headers.find(h => h.name === 'From');
        const dateHeader = headers.find(h => h.name === 'Date');
        
        const sender = fromHeader ? fromHeader.value.split('<')[0].replace(/"/g, '').trim() : 'Unknown';
        const description = subjectHeader ? subjectHeader.value : msg.data.snippet;

        let carrier = 'Unknown';
        if (/^1Z/i.test(trackingNumber)) carrier = 'UPS';
        else if (trackingNumber.length > 20 || /^9/i.test(trackingNumber)) carrier = 'USPS';
        else carrier = 'FedEx';

        uniquePackages.set(trackingNumber, {
            sender, carrier, description, trackingNumber,
            date: dateHeader ? new Date(dateHeader.value).toLocaleDateString() : 'N/A',
            status: 'In Transit',
        });
      } catch (e) {
        console.warn(`Could not process message ID: ${message.id}`, e);
      }
    });
    
    await Promise.all(promises);
    const packages = Array.from(uniquePackages.values());

    return { statusCode: 200, body: JSON.stringify(packages) };

  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to scan Gmail.' }) };
  }
};