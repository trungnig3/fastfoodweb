import crypto from 'crypto';

export function formatVnPayDate(date: Date = new Date()): string {
  // Convert to GMT+7 (Vietnam timezone)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnTime = new Date(utc + 7 * 3600000);
  const yyyy = vnTime.getFullYear();
  const MM = String(vnTime.getMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getDate()).padStart(2, '0');
  const HH = String(vnTime.getHours()).padStart(2, '0');
  const mm = String(vnTime.getMinutes()).padStart(2, '0');
  const ss = String(vnTime.getSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

export class VnPayLibrary {
  private requestData: Record<string, string> = {};
  private responseData: Record<string, string> = {};

  addRequestData(key: string, value: string): void {
    if (value !== undefined && value !== null && value !== '') {
      this.requestData[key] = value;
    }
  }

  addResponseData(key: string, value: string): void {
    if (value !== undefined && value !== null && value !== '') {
      this.responseData[key] = value;
    }
  }

  getResponseDataValue(key: string): string {
    return this.responseData[key] || '';
  }

  createRequestUrl(baseUrl: string, hashSecret: string): string {
    const sortedKeys = Object.keys(this.requestData).sort();
    const queryParts: string[] = [];

    for (const key of sortedKeys) {
      const encodedKey = encodeURIComponent(key);
      const encodedVal = encodeURIComponent(this.requestData[key]).replace(/%20/g, '+');
      queryParts.push(`${encodedKey}=${encodedVal}`);
    }

    const queryString = queryParts.join('&');
    const hmac = crypto.createHmac('sha512', hashSecret);
    const secureHash = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');

    return `${baseUrl}?${queryString}&vnp_SecureHash=${secureHash}`;
  }

  validateSignature(secureHash: string, hashSecret: string): boolean {
    const sortedKeys = Object.keys(this.responseData)
      .filter(k => k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
      .sort();

    const queryParts: string[] = [];
    for (const key of sortedKeys) {
      const encodedKey = encodeURIComponent(key);
      const encodedVal = encodeURIComponent(this.responseData[key]).replace(/%20/g, '+');
      queryParts.push(`${encodedKey}=${encodedVal}`);
    }

    const queryString = queryParts.join('&');
    const hmac = crypto.createHmac('sha512', hashSecret);
    const calculatedHash = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');

    return calculatedHash.toLowerCase() === (secureHash || '').toLowerCase();
  }
}

