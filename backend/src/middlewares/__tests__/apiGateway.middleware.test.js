const crypto = require('crypto');
const { apiGateway, ipInCidr, checkRateLimit } = require('../apiGateway.middleware');
const { validateApiKey } = require('../../services/apiKey.service');
const { redisClient } = require('../../services/cache.service');

jest.mock('../../services/apiKey.service');
jest.mock('../../services/cache.service', () => ({
  redisClient: {
    isOpen: true,
    multi: jest.fn(),
    zRangeWithScores: jest.fn(),
  },
}));

describe('ipInCidr', () => {
  it('identifies IPv4 in CIDR block correctly', () => {
    expect(ipInCidr('192.168.1.5', '192.168.1.0/24')).toBe(true);
    expect(ipInCidr('192.168.2.5', '192.168.1.0/24')).toBe(false);
    expect(ipInCidr('10.0.0.1', '10.0.0.0/8')).toBe(true);
  });

  it('handles exact matches', () => {
    expect(ipInCidr('192.168.1.1', '192.168.1.1')).toBe(true);
  });
});

describe('apiGateway middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      headers: {
        'x-paysphere-key': 'ps_key_123',
        'x-paysphere-signature': 'sig',
        'x-paysphere-timestamp': Math.floor(Date.now() / 1000).toString(),
      },
      method: 'GET',
      query: { foo: 'bar' },
      body: { hello: 'world' },
      ip: '192.168.1.5',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    next = jest.fn();

    // Default rate limit mock response
    redisClient.multi.mockReturnValue({
      zRemRangeByScore: jest.fn().mockReturnThis(),
      zCard: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([0, 50]),
      zAdd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
    });
  });

  it('skips gateway validation if X-PaySphere-Key is absent', async () => {
    delete req.headers['x-paysphere-key'];
    await apiGateway(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 if API key is invalid', async () => {
    validateApiKey.mockResolvedValue(null);
    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API Key' });
  });

  it('returns 401 if signature or timestamp header is missing', async () => {
    validateApiKey.mockResolvedValue({ _id: 'key1', secret: 'sec' });
    delete req.headers['x-paysphere-signature'];
    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects expired timestamp (older than 5 minutes)', async () => {
    validateApiKey.mockResolvedValue({ _id: 'key1', secret: 'sec' });
    req.headers['x-paysphere-timestamp'] = (Math.floor(Date.now() / 1000) - 301).toString();
    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request timestamp is expired or invalid' });
  });

  it('rejects signature mismatch', async () => {
    validateApiKey.mockResolvedValue({ _id: 'key1', secret: 'sec' });
    req.headers['x-paysphere-signature'] = 'invalid_sig';
    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid request signature' });
  });

  it('verifies valid HMAC signature and passes control to next', async () => {
    const secret = 'sec';
    validateApiKey.mockResolvedValue({ _id: 'key1', secret, tenantId: 'tenant1' });

    const timestamp = req.headers['x-paysphere-timestamp'];
    const canonicalString = `GET\n${timestamp}\nfoo=bar\n{"hello":"world"}`;
    const validSig = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
    req.headers['x-paysphere-signature'] = validSig;

    await apiGateway(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBe('tenant1');
  });

  it('enforces IP CIDR whitelisting', async () => {
    const secret = 'sec';
    validateApiKey.mockResolvedValue({
      _id: 'key1',
      secret,
      tenantId: 'tenant1',
      whitelistedCIDRs: ['10.0.0.0/8'],
    });

    const timestamp = req.headers['x-paysphere-timestamp'];
    const canonicalString = `GET\n${timestamp}\nfoo=bar\n{"hello":"world"}`;
    const validSig = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
    req.headers['x-paysphere-signature'] = validSig;

    req.ip = '192.168.1.1'; // Not in whitelist
    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: IP address not whitelisted' });

    req.ip = '10.1.2.3'; // Whitelisted
    await apiGateway(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks request with 429 when rate limit is exceeded', async () => {
    const secret = 'sec';
    validateApiKey.mockResolvedValue({ _id: 'key1', secret, tenantId: 'tenant1' });

    const timestamp = req.headers['x-paysphere-timestamp'];
    const canonicalString = `GET\n${timestamp}\nfoo=bar\n{"hello":"world"}`;
    const validSig = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
    req.headers['x-paysphere-signature'] = validSig;

    // Mock rate limit exceeded (105 > 100)
    redisClient.multi.mockReturnValue({
      zRemRangeByScore: jest.fn().mockReturnThis(),
      zCard: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([0, 105]),
    });
    redisClient.zRangeWithScores.mockResolvedValue([{ score: Date.now() - 30000 }]);

    await apiGateway(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });
});
