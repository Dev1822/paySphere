'use strict';

const crypto = require('crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const logger = require('../utils/logger');

const DEFAULT_SIGNED_URL_TTL = 15 * 60;
const MAX_SIGNED_URL_TTL = 7 * 24 * 60 * 60;
const MAX_DATA_URL_IMAGE_BYTES = 2 * 1024 * 1024;

let client;

function getBucket() {
  return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';
}

function getClient() {
  if (!client) {
    const region = process.env.AWS_REGION || 'us-east-1';
    client = new S3Client({ region });
  }
  return client;
}

function assertBucket(bucket = getBucket()) {
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is required for object storage.');
  }
  return bucket;
}

function normalizeKey(key) {
  return String(key || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function createObjectKey({ tenantId, area, filename, extension }) {
  const safeTenant = normalizeKey(tenantId || 'unknown-tenant');
  const safeArea = normalizeKey(area || 'files') || 'files';
  const safeExtension = extension
    ? `.${String(extension).replace(/^\./, '').replace(/[^a-z0-9]/gi, '')}`
    : '';
  return `tenants/${safeTenant}/${safeArea}/${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

function storageUri(bucket, key) {
  return `s3://${bucket}/${normalizeKey(key)}`;
}

function parseStorageUri(value) {
  if (typeof value !== 'string' || !value.startsWith('s3://')) return null;
  const withoutScheme = value.slice(5);
  const slash = withoutScheme.indexOf('/');
  if (slash <= 0) return null;
  return {
    bucket: withoutScheme.slice(0, slash),
    key: normalizeKey(withoutScheme.slice(slash + 1)),
  };
}

async function putObject({ key, body, contentType, bucket = getBucket(), metadata }) {
  const targetBucket = assertBucket(bucket);
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) throw new Error('An S3 object key is required.');
  if (body === undefined || body === null) throw new Error('An S3 object body is required.');

  const command = new PutObjectCommand({
    Bucket: targetBucket,
    Key: normalizedKey,
    Body: body,
    ...(contentType ? { ContentType: contentType } : {}),
    ...(metadata ? { Metadata: metadata } : {}),
  });

  await getClient().send(command);
  logger.info('Object uploaded to S3', { bucket: targetBucket, key: normalizedKey });
  return { bucket: targetBucket, key: normalizedKey, uri: storageUri(targetBucket, normalizedKey) };
}

function awsEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getSigningCredentials() {
  const explicit = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      }
    : null;
  return explicit || defaultProvider()();
}

async function getDownloadUrl(value, { expiresIn = DEFAULT_SIGNED_URL_TTL } = {}) {
  const parsed = parseStorageUri(value);
  if (!parsed) return value || '';

  const ttl = Math.max(1, Math.min(Number(expiresIn) || DEFAULT_SIGNED_URL_TTL, MAX_SIGNED_URL_TTL));
  const region = process.env.AWS_REGION || 'us-east-1';
  const credentials = await getSigningCredentials();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const host = `${parsed.bucket}.s3.${region}.amazonaws.com`;
  const canonicalUri = '/' + parsed.key.split('/').map(awsEncode).join('/');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(ttl),
    'X-Amz-SignedHeaders': 'host',
  };
  if (credentials.sessionToken) query['X-Amz-Security-Token'] = credentials.sessionToken;

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${awsEncode(key)}=${awsEncode(query[key])}`)
    .join('&');
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');
  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function deleteObject(value) {
  const parsed = parseStorageUri(value);
  if (!parsed) return false;
  await getClient().send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  return true;
}

function isStorageUri(value) {
  return Boolean(parseStorageUri(value));
}

function dataUrlToBuffer(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function uploadDataUrl({ dataUrl, tenantId, area, filename }) {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) return null;

  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(parsed.mimeType)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported for S3 uploads.');
  }

  if (parsed.buffer.length > MAX_DATA_URL_IMAGE_BYTES) {
    throw new Error('Profile images must be smaller than 2 MB after processing.');
  }

  const extension = parsed.mimeType === 'image/jpeg' ? 'jpg' : parsed.mimeType.split('/')[1];
  const key = createObjectKey({ tenantId, area, filename, extension });
  return putObject({ key, body: parsed.buffer, contentType: parsed.mimeType });
}

module.exports = {
  DEFAULT_SIGNED_URL_TTL,
  createObjectKey,
  dataUrlToBuffer,
  deleteObject,
  getDownloadUrl,
  isStorageUri,
  normalizeKey,
  parseStorageUri,
  putObject,
  storageUri,
  uploadDataUrl,
};
