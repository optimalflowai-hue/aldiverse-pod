const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env.local manually for test script
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && !line.startsWith('#')) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      process.env[key] = value;
    }
  });
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('ERROR: ENCRYPTION_KEY is missing in .env.local');
  process.exit(1);
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
  console.error('ERROR: ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid format');
  }
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Run test
try {
  const secretKey = 'sk_test_51NxxxxStripeSecretKeyForDrPattiMills';
  console.log('Original Secret:', secretKey);
  
  const encrypted = encrypt(secretKey);
  console.log('Encrypted (stored in DB):', encrypted);
  
  const decrypted = decrypt(encrypted);
  console.log('Decrypted:', decrypted);
  
  if (decrypted === secretKey) {
    console.log('\n✅ TEST PASSED: Decrypted credentials match original text!');
  } else {
    console.error('\n❌ TEST FAILED: Decryption mismatch!');
  }
} catch (err) {
  console.error('\n❌ TEST ERROR:', err);
}
