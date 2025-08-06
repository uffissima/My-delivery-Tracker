import React from 'react';

// Updated fake data to include the carrier
const dummyPackages = [
  { sender: 'Amazon', carrier: 'Amazon', description: 'New Book', date: 'Wednesday, Aug 6', status: 'Out for Delivery' },
  { sender: 'Apple', carrier: 'UPS', description: 'MacBook Charger', date: 'Thursday, Aug 7', status: 'Shipped' },
  { sender: 'Nike', carrier: 'FedEx', description: 'Running Shoes', date: 'Friday, Aug 8', status: 'Shipped' },
];

function PackageTable() {
  return (
    <table style={{ width: '100%', maxWidth: '800px', textAlign: 'left', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Sender</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Carrier</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Item</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Arrives</th>
          <th style={{padding: '12px', borderBottom: '1px solid #555'}}>Status</th>
        </tr>
      </thead>
      <tbody>
        {dummyPackages.map((pkg, index) => (
          <tr key={index}>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.sender}</td>
            <td style={{padding: '12px', borderBottom: '1px solid #444'}}>{pkg.carrier}</td>
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