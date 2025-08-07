const { google } = require('googleapis');

// Regex for standard tracking numbers
const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|[0-9]{20,22}|9\d{15,21})\b/i;
// Regex for Amazon Order IDs
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
      q: '("your order has shipped" OR "your amazon.com order" OR "tracking number" OR "out for delivery") newer_than:7d',
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
        
        // Try to find a standard tracking number OR an Amazon order ID
        const trackingMatch = fullBody.match(TRACKING_REGEX);
        const amazonMatch = fullBody.match(AMAZON_ORDER_REGEX);
        
        if (!trackingMatch && !amazonMatch) return; // Skip if neither is found

        const uniqueId = trackingMatch ? trackingMatch[0] : amazonMatch[0];
        
        const headers = msg.data.payload.headers || [];
        const fromHeader = headers.find(h => h.name === 'From');
        const dateHeader = headers.find(h => h.name === 'Date');
        const subjectHeader = headers.find(h => h.name === 'Subject');
        
        const sender = fromHeader ? fromHeader.value.split('<')[0].replace(/"/g, '').trim() : 'Unknown';
        const description = subjectHeader ? subjectHeader.value : msg.data.snippet;
        let carrier = 'Unknown';

        // Set carrier based on what we found
        if (trackingMatch) {
            if (/^1Z/i.test(uniqueId)) carrier = 'UPS';
            else if (uniqueId.length > 20 || /^9/i.test(uniqueId)) carrier = 'USPS';
            else carrier = 'FedEx';
        } else if (amazonMatch) {
            carrier = 'Amazon';
        }

        uniquePackages.set(uniqueId, {
            sender, carrier, description,
            trackingNumber: uniqueId, // Use the ID we found for display
            date: dateHeader ? new Date(dateHeader.value).toLocaleDateString() : 'N/A',
            status: fullBody.includes("Delivered") ? "Delivered" : "In Transit",
        });
      } catch (e) {
        console.warn(`Could not process message ID: ${message.id}`, e);
      }
    });
    
    await Promise.all(promises);
    // Filter out delivered packages before sending
    const allPackages = Array.from(uniquePackages.values());
    const undeliveredPackages = allPackages.filter(pkg => pkg.status !== "Delivered");

    return { statusCode: 200, body: JSON.stringify(undeliveredPackages) };

  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to scan Gmail.' }) };
  }
};