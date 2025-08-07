import React from 'react';

function PackageTable({ packages }) {
  if (!packages || packages.length === 0) {
    return <p>No deliveries found after the scan.</p>;
  }

  return (
    <table style={{ width: '100%', maxWidth: '900px', textAlign: 'left', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Sender</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Carrier</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Tracking #</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Description</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Arrives</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Status</th>
        </tr>
      </thead>
      <tbody>
        {packages.map((pkg, index) => (
          <tr key={index}>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.sender}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.carrier}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444', wordBreak: 'break-all'}}>{pkg.trackingNumber}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.description}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.date}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default PackageTable;