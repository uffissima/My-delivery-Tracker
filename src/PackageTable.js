import React from 'react';

// Helper function to generate tracking URLs
const getTrackingUrl = (carrier, trackingNumber) => {
  // Don't create a link if the tracking number isn't a real one
  if (!trackingNumber || trackingNumber === 'See Email') {
    return null;
  }

  switch (carrier.toLowerCase()) {
    case 'ups':
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`;
    case 'amazon':
      // Amazon tracking numbers are usually order IDs, linking to the order history
      return `https://www.amazon.com/gp/css/order-history`;
    default:
      return null; // Return null if carrier is unknown
  }
};


function PackageTable({ packages }) {
  if (!packages || packages.length === 0) {
    return <p>No deliveries found after the scan.</p>;
  }

  return (
    <table style={{ width: '100%', maxWidth: '1000px', textAlign: 'left', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Sender</th>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Carrier</th>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Tracking #</th>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Description</th>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Arrives</th>
          <th style={{padding: '12px', borderBottom: '1px solid #ddd'}}>Status</th>
        </tr>
      </thead>
      <tbody>
        {packages.map((pkg, index) => {
          const trackingUrl = getTrackingUrl(pkg.carrier, pkg.trackingNumber);

          return (
            <tr key={index}>
              <td style={{padding: '12px', borderBottom: '1px solid #eee'}}>{pkg.sender}</td>
              <td style={{padding: '12px', borderBottom: '1px solid #eee'}}>{pkg.carrier}</td>
              <td style={{padding: '12px', borderBottom: '1px solid #eee', wordBreak: 'break-all'}}>
                {trackingUrl ? (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{color: '#007aff', textDecoration: 'none'}}>
                    {pkg.trackingNumber}
                  </a>
                ) : (
                  pkg.trackingNumber
                )}
              </td>
              <td style={{padding: '12px', borderBottom: '1px solid #eee', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{pkg.description}</td>
              <td style={{padding: '12px', borderBottom: '1px solid #eee'}}>{pkg.date}</td>
              <td style={{padding: '12px', borderBottom: '1px solid #eee'}}>{pkg.status}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default PackageTable;