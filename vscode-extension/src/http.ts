/// @anchor: Node.js HTTP — https://nodejs.org/api/http.html
/// Client HTTP minimal pour les appels à l'API Gateway KontEx.
/// Utilise le module natif http/https de Node.js (pas de dépendance externe).

import * as http from 'node:http';

interface HttpResponse {
    status: number;
    data: unknown;
}

function httpRequest(method: string, url: string, body?: string): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const isHttps = parsed.protocol === 'https:';

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = isHttps ? require('node:https') as typeof http : http;

        const options: http.RequestOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (isHttps ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'KontEx-VSCode/0.1.0',
                ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}),
            },
        };

        const req = mod.request(options, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode ?? 500, data: JSON.parse(data) as unknown });
                } catch {
                    resolve({ status: res.statusCode ?? 500, data });
                }
            });
        });

        req.on('error', (err: Error) => {
            reject(new Error(`HTTP error: ${err.message}`));
        });

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

export async function httpGet(url: string): Promise<unknown> {
    const response = await httpRequest('GET', url);
    if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }
    return response.data;
}

export async function httpPost(url: string, body: unknown): Promise<unknown> {
    const response = await httpRequest('POST', url, JSON.stringify(body));
    if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.data)}`);
    }
    return response.data;
}
