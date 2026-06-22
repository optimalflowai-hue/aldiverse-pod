export interface LuluConfig {
  clientKey: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // timestamp in ms
}

// In-memory token cache keyed by clientKey to prevent rate-limiting on token generation
const tokenCache: Record<string, CachedToken> = {};

/**
 * Retrieves a valid OAuth 2.0 access token for the given credentials.
 * Utilizes in-memory caching to avoid requesting new tokens on every call.
 */
async function getLuluToken(config: LuluConfig): Promise<string> {
  const cacheKey = config.clientKey;
  const now = Date.now();

  // If token exists and is valid for at least another 30 seconds, reuse it
  if (tokenCache[cacheKey] && tokenCache[cacheKey].expiresAt > now + 30000) {
    return tokenCache[cacheKey].accessToken;
  }

  const host = config.environment === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
  const url = `${host}/auth/realms/Customer/protocol/openid-connect/token`;

  const credentials = Buffer.from(`${config.clientKey}:${config.clientSecret}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch Lulu access token: ${response.status} ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  tokenCache[cacheKey] = {
    accessToken,
    expiresAt: now + (expiresIn * 1000),
  };

  return accessToken;
}

/**
 * Requests shipping options and cost estimations for a potential order.
 */
export async function estimateShipping(
  config: LuluConfig,
  params: {
    shipping_address: {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      state_code: string;
      country_code: string;
      postcode: string;
      phone_number?: string;
    };
    line_items: Array<{
      pod_package_id: string;
      quantity: number;
    }>;
  }
): Promise<any> {
  const host = config.environment === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
  const url = `${host}/shipping-options/`;
  const token = await getLuluToken(config);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lulu shipping estimation failed: ${response.status} ${response.statusText} - ${errText}`);
  }

  return response.json();
}

/**
 * Creates a new Print Job (order) in the Lulu system.
 * If the developer's Lulu account has a credit card on file, payment and production
 * are triggered automatically.
 */
export async function createPrintJob(
  config: LuluConfig,
  params: {
    contact_email: string;
    external_id: string; // e.g. stripe checkout session id
    shipping_address: {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      state_code: string;
      country_code: string;
      postcode: string;
      phone_number: string;
    };
    shipping_level: string; // e.g. 'MAIL'
    line_items: Array<{
      title: string;
      cover: string; // URL to PDF
      interior: string; // URL to PDF
      pod_package_id: string;
      quantity: number;
    }>;
  }
): Promise<any> {
  const host = config.environment === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
  const url = `${host}/print-jobs/`;
  const token = await getLuluToken(config);

  // Format payload according to spec
  const body = {
    contact_email: params.contact_email,
    external_id: params.external_id,
    shipping_address: params.shipping_address,
    shipping_level: params.shipping_level,
    line_items: params.line_items.map(item => ({
      title: item.title,
      cover: item.cover,
      interior: item.interior,
      pod_package_id: item.pod_package_id,
      quantity: item.quantity,
    })),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lulu print job creation failed: ${response.status} ${response.statusText} - ${errText}`);
  }

  return response.json();
}

/**
 * Retrieves the current details of a Print Job, including status and tracking numbers.
 */
export async function getPrintJob(config: LuluConfig, id: string): Promise<any> {
  const host = config.environment === 'production' ? 'https://api.lulu.com' : 'https://api.sandbox.lulu.com';
  const url = `${host}/print-jobs/${id}/`;
  const token = await getLuluToken(config);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to retrieve Lulu print job ${id}: ${response.status} ${response.statusText} - ${errText}`);
  }

  return response.json();
}
