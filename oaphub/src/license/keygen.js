#!/usr/bin/env node
/**
 * License key generator — vendor-side CLI tool.
 *
 * Usage:
 *   node src/license/keygen.js generate \
 *     --customer-id   "client-001"    \
 *     --customer-name "Acme Corp"     \
 *     --max-seats     50              \
 *     --max-tokens    -1              \
 *     --features      sso,audit_export \
 *     --expires       2027-03-01      \
 *     --private-key   /path/to/private.pem
 *
 *   node src/license/keygen.js generate-keys
 *     — generates a fresh ed25519 key pair and prints them
 *
 * The private key should NEVER be committed to the repository.
 * Only the public key (public.pem) is stored in src/license/keys/.
 */

import crypto from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { parseArgs } from 'util';

const { values: args, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    'customer-id':   { type: 'string' },
    'customer-name': { type: 'string' },
    'max-seats':     { type: 'string', default: '50' },
    'max-tokens':    { type: 'string', default: '-1' },
    'features':      { type: 'string', default: '' },
    'expires':       { type: 'string' },
    'private-key':   { type: 'string' },
    'output':        { type: 'string' },
  },
});

const command = positionals[0];

if (command === 'generate-keys') {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  });

  console.log('=== PRIVATE KEY (keep secret, never commit) ===');
  console.log(privateKey);
  console.log('=== PUBLIC KEY (safe to embed in server) ===');
  console.log(publicKey);

  writeFileSync('private.pem', privateKey, { mode: 0o600 });
  writeFileSync('public.pem',  publicKey);
  console.log('\nSaved to private.pem and public.pem');

} else if (command === 'generate') {
  const customerId   = args['customer-id'];
  const customerName = args['customer-name'];
  const maxSeats     = parseInt(args['max-seats'], 10);
  const maxTokens    = parseInt(args['max-tokens'], 10);
  const features     = args['features'] ? args['features'].split(',').map(s => s.trim()).filter(Boolean) : [];
  const expiresAt    = args['expires'] ? new Date(args['expires']).toISOString() : null;
  const privateKeyPath = args['private-key'];

  if (!customerId || !customerName || !expiresAt || !privateKeyPath) {
    console.error('Missing required arguments: --customer-id, --customer-name, --expires, --private-key');
    process.exit(1);
  }

  const issuedAt = new Date().toISOString();

  const payload = {
    customerId,
    customerName,
    maxSeats,
    maxTokens,
    features,
    issuedAt,
    expiresAt,
  };

  const privateKeyPem = readFileSync(privateKeyPath, 'utf8');
  const privateKey    = crypto.createPrivateKey(privateKeyPem);
  const signature     = crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64');

  const license = { ...payload, signature };
  const json    = JSON.stringify(license, null, 2);

  if (args['output']) {
    writeFileSync(args['output'], json);
    console.log(`License written to ${args['output']}`);
  } else {
    console.log(json);
  }

} else {
  console.log('Commands: generate | generate-keys');
  console.log('Run with --help for usage.');
  process.exit(1);
}
