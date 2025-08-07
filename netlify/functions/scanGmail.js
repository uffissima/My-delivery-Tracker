const { google } = require('googleapis');

const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|\d{12,15}|\d{20,22}|9\d{15,21}|TBA\d{12})\b/i;
const AMAZON_ORDER_REGEX = /\b\d{3}-\d{7}-\d{7}\b/;
// Regex to find the original shipper from the email body
const SHIPPER_REGEX = /(?:shipment from|Sold by)\s*([A-Z\s&;]+)\b/i;
// Regex to find the delivery date from the email body
const DELIVERY_DATE_REGEX = /(?:Arriving|delivery date):?\s*(.*?)(?=\s*Track|\n|$)/i;


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
      maxResults: 50,
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    
    const uniquePackages = new Map();

    const promises = messages.map(async (message) => {
      try {
        const msg = await gmail.users.messages.get({ userId: 'me', id: message.id, format: 'full' });
        
        const headers = msg.data.payload.headers || [];
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const fromHeader = headers.find(h => h.name === 'From');
        const dateHeader = headers.find(h => h.name === 'Date');
        
        if (!subjectHeader || !fromHeader || !dateHeader) return;
        
        const subjectText = subjectHeader.value;
        const fullBody = getPlainTextBody(msg);

        let trackingMatch = subjectText.match(TRACKING_REGEX) || fullBody.match(TRACKING_REGEX);
        const amazonMatch = subjectText.match(AMAZON_ORDER_REGEX) || fullBody.match(AMAZON_ORDER_REGEX);
        
        const uniqueId = trackingMatch ? trackingMatch[0] : (amazonMatch ? amazonMatch[0] : null);
        if (!uniqueId) return;

        // Find original shipper from body, fallback to subject, then fallback to From header
        const shipperMatch = fullBody.match(SHIPPER_REGEX) || subjectText.match(SHIPPER_REGEX);
        const originalShipper = shipperMatch ? shipperMatch[1].trim() : null;
        const sender = originalShipper || fromHeader.value.split('<')[0].replace(/"/g, '').trim();

        // Find delivery date from body, fallback to email date
        const deliveryDateMatch = fullBody.match(DELIVERY_DATE_REGEX);
        const arrivalDate = deliveryDateMatch ? new Date(deliveryDateMatch[1].trim()) : new Date(dateHeader.value);

        let carrier = 'Unknown';
        if (fromHeader.value.toLowerCase().includes('fedex')) carrier = 'FedEx';
        else if (fromHeader.value.toLowerCase().includes('ups')) carrier = 'UPS';
        else if (fromHeader.value.toLowerCase().includes('usps')) carrier = 'USPS';
        else if (fromHeader.value.toLowerCase().includes('amazon')) carrier = 'Amazon';

        const packageData = {
            sender: sender,
            carrier: carrier,
            description: subjectText,
            trackingNumber: uniqueId,
            date: arrivalDate,
            status: fullBody.toLowerCase().includes("has been delivered") ? "Delivered" : "In Transit",
        };
        
        const existingPackage = uniquePackages.get(uniqueId);
        if (!existingPackage || packageData.date > existingPackage.date) {
          uniquePackages.set(uniqueId, packageData);
        }

      } catch (e) {
        console.warn(`Could not process message ID: ${message.id}`, e);
      }
    });
    
    await Promise.all(promises);

    const allPackages = Array.from(uniquePackages.values()).map(pkg => ({
        ...pkg,
        date: pkg.date.toLocaleDateString()
    }));

    const undeliveredPackages = allPackages.filter(pkg => pkg.status !== "Delivered");

    return { statusCode: 200, body: JSON.stringify(undeliveredPackages) };

  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to scan Gmail.' }) };
  }
};