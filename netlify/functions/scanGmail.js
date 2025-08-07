const { google } = require('googleapis');

// Regular expression to find common tracking numbers
const TRACKING_REGEX = /\b(1Z[A-Z0-9]{16}|[0-9]{20,22}|9\d{15,21})\b/i;

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
      maxResults: 25, // Search a few more emails to find all relevant ones
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    
    // This map will store unique packages, keyed by tracking number
    const uniquePackages = new Map();

    const promises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      const snippet = msg.data.snippet;
      const headers = msg.data.payload.headers;
      
      // Try to find a tracking number in the email snippet
      const trackingMatch = snippet.match(TRACKING_REGEX);
      
      // If no tracking number is found in this email, ignore it
      if (!trackingMatch) {
        return;
      }
      const trackingNumber = trackingMatch[0];

      // Extract other data
      const fromHeader = headers.find(h => h.name === 'From');
      const dateHeader = headers.find(h => h.name === 'Date');
      const subjectHeader = headers.find(h => h.name === 'Subject');
      
      const sender = fromHeader ? fromHeader.value.split('<')[0].replace(/"/g, '').trim() : 'Unknown';
      const description = subjectHeader ? subjectHeader.value : snippet;

      let carrier = 'Unknown';
      if (trackingNumber.startsWith('1Z')) carrier = 'UPS';
      else if (trackingNumber.length > 20) carrier = 'USPS';
      else carrier = 'FedEx';

      // Add the package to our map. If we see the same tracking number again,
      // it will simply be overwritten, ensuring we only have one entry per package.
      uniquePackages.set(trackingNumber, {
          sender: sender,
          carrier: carrier,
          description: description,
          date: new Date(dateHeader.value).toLocaleDateString(),
          status: 'In Transit', // We'll update this later
          trackingNumber: trackingNumber
      });
    });
    
    await Promise.all(promises);

    // Convert the map of unique packages back to an array
    const packages = Array.from(uniquePackages.values());

    return {
      statusCode: 200,
      body: JSON.stringify(packages),
    };
  } catch (error) {
    console.error('Error scanning Gmail:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to scan Gmail.' }),
    };
  }
};