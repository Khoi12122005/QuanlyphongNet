const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 1, name: 'Trần Minh Khoa', phone: '0901234567', role: 'customer' },
  'cyberhub_super_secret_key_2024',
  { expiresIn: '24h' }
);

async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/customer-auth/redeem', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ points_to_spend: 20, reward_type: 'Nước ngọt' })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Data:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
