const { google } = require('googleapis');

// This is the main function that Netlify will run
exports.handler = async (event) => {
  // Get the token from the request sent by the frontend
  const { token } = JSON.parse(event.body);

  if (!token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing token' }),
    };
  }

  // Set up the Google API client with the user's token
  const oAuth2Client = new google.auth.OAuth2();
  oAuth2Client.setCredentials({ access_token: token });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  try {
    // 1. Search for emails with shipping information
    const searchResponse = await gmail.users.messages.list({
      userId: 'me',
      // A query to find relevant emails from the last 7 days
      q: '("your order has shipped" OR "tracking number" OR "out for delivery") newer_than:7d',
      maxResults: 10, // Limit to the 10 most recent
    });

    const messages = searchResponse.data.messages;
    if (!messages || messages.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify([]), // Return an empty array if no emails found
      };
    }
    
    // 2. Process each found email
    const promises = messages.map(async (message) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full'
      });
      
      const snippet = msg.data.snippet;
      const headers = msg.data.payload.headers;
      
      // Extract data from the email
      const fromHeader = headers.find(h => h.name === 'From');
      const dateHeader = headers.find(h => h.name === 'Date');
      
      const sender = fromHeader ? fromHeader.value.split('<')[0].trim() : 'Unknown Sender';
      const deliveryDate = dateHeader ? new Date(dateHeader.value).toLocaleDateString() : 'N/A';
      
      // Simple parsing logic (can be improved later)
      let carrier = 'Unknown';
      if (snippet.toLowerCase().includes('ups')) carrier = 'UPS';
      else if (snippet.toLowerCase().includes('fedex')) carrier = 'FedEx';
      else if (snippet.toLowerCase().includes('usps')) carrier = 'USPS';
      else if (sender.toLowerCase().includes('amazon')) carrier = 'Amazon';
      
      return {
          sender: sender,
          carrier: carrier,
          description: snippet,
          date: deliveryDate,
          status: 'In Transit' // A default status
      };
    });
    
    const packages = await Promise.all(promises);

    // 3. Send the formatted data back to the frontend
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