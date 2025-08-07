const { google } = require('googleapis');

// A flexible regex that includes common carrier and Amazon formats
const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|\d{12,15}|\d{20,22}|9\d{15,21}|TBA\d{12})\b/i;
const AMAZON_ORDER_REGEX = /\b\d{3}-\d{7}-\d{7}\b/;

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
      q: 'in:anywhere {subject:"your order has shipped" subject:"out for delivery" subject:shipment subject:delivery subject:tracking} newer_than:7d',
      maxResults: 50, // Increase results to ensure we get all related emails
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    
    // Re-introduce the Map to handle duplicates
    const uniquePackages = new Map();

    const promises = messages.map(async (message) => {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
        
        const headers = msg.data.payload.headers || [];
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const fromHeader = headers.find(h => h.name === 'From');
        const dateHeader = headers.find(h => h.name === 'Date');
        
        if (!subjectHeader || !fromHeader || !dateHeader) return;

        const fullBody = getPlainTextBody(msg);
        const trackingMatch = fullBody.match(TRACKING_REGEX);
        const amazonMatch = fullBody.match(AMAZON_ORDER_REGEX);
        
        // Use the first available unique ID. If none, we can't de-duplicate this email.
        const uniqueId = trackingMatch ? trackingMatch[0] : (amazonMatch ? amazonMatch[0] : null);
        
        if (!uniqueId) return; // If we have no way to uniquely identify it, skip it.

        let carrier = 'Unknown';
        if (fromHeader.value.toLowerCase().includes('fedex')) carrier = 'FedEx';
        else if (fromHeader.value.toLowerCase().includes('ups')) carrier = 'UPS';
        else if (fromHeader.value.toLowerCase().includes('usps')) carrier = 'USPS';
        else if (fromHeader.value.toLowerCase().includes('amazon')) carrier = 'Amazon';

        // Set the package in the map. Duplicates with the same ID will be overwritten.
        uniquePackages.set(uniqueId, {
            sender: fromHeader.value.split('<')[0].replace(/"/g, '').trim(),
            carrier: carrier,
            description: subjectHeader.value,
            trackingNumber: uniqueId,
            date: new Date(dateHeader.value).toLocaleDateString(),
            status: fullBody.includes("has been delivered") ? "Delivered" : "In Transit",
        });
      } catch (e) {
        console.warn(`Could not process message ID: ${message.id}`, e);
      }
    });
    
    await Promise.all(promises);

    const allPackages = Array.from(uniquePackages.values());
    const undeliveredPackages = allPackages.filter(pkg => pkg.status !== "Delivered");

    return { statusCode: 200, body: JSON.stringify(undeliveredPackages) };

  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to scan Gmail.' }) };
  }
};