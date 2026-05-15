import jwt from 'jsonwebtoken';
const token = jwt.sign({ admin: true }, 'super_secret_key_dnit_2024', { expiresIn: '1h' });
console.log('Token:', token);
