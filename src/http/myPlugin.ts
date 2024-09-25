// rateLimitPlugin.ts

import type { Middleware, Plugin, Request, Response } from './SimpleExpressServer'; 

interface RateLimitOptions {
    limit: number;
    windowMs: number;
}

const rateLimitPlugin = (options: RateLimitOptions): Plugin => {
    return (app) => {
        const { limit, windowMs } = options;
        const requests = new Map<string, { count: number; timestamp: number }>();

        // Helper function to convert milliseconds to a human-readable format
        const formatResetTime = (resetTime: number): string => {
            const remainingTime = resetTime - Date.now();
            const seconds = Math.floor(remainingTime / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);

            if (hours > 0) {
                return `${hours} hour${hours > 1 ? 's' : ''}`;
            } else if (minutes > 0) {
                return `${minutes} minute${minutes > 1 ? 's' : ''}`;
            } else {
                return `${seconds} second${seconds > 1 ? 's' : ''}`;
            }
        };

        // Rate Limiter Middleware
        const rateLimiter: Middleware = (req: Request, res: Response, next) => {
            const now = Date.now();

            // Safely retrieve the IP address from headers or socket
            const ipHeader = req.headers['x-forwarded-for'];
            const socketAddress = req.socket.remoteAddress;
            const ip = typeof ipHeader === 'string' ? ipHeader : (typeof socketAddress === 'string' ? socketAddress : '');

            // Ensure IP address is available
            if (!ip) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'text/plain');
                res.send('Unable to determine IP address');
                return;
            }

            // Retrieve the request record for the current IP
            let record = requests.get(ip);

            if (record) {
                // Check if the current request is within the time window
                if (now - record.timestamp < windowMs) {
                    if (record.count >= limit) {
                        const resetIn = formatResetTime(record.timestamp + windowMs);
                        res.statusCode = 429;
                        res.setHeader('X-RateLimit-Limit', limit.toString());
                        res.setHeader('X-RateLimit-Remaining', '0');
                        res.setHeader('X-RateLimit-Reset', resetIn); // human-readable time
                        res.setHeader('Content-Type', 'text/plain');
                        res.send('Too Many Requests');
                        return;
                    }
                    record.count += 1;
                } else {
                    // Reset the count and timestamp if the time window has passed
                    record.count = 1;
                    record.timestamp = now;
                }
            } else {
                // Create a new record for this IP
                record = { count: 1, timestamp: now };
            }

            // Update the record in the map
            requests.set(ip, record);

            // Set response headers for rate limiting
            const resetIn = formatResetTime(record.timestamp + windowMs); // human-readable reset time
            res.setHeader('X-RateLimit-Limit', limit.toString());
            res.setHeader('X-RateLimit-Remaining', (limit - record.count).toString());
            res.setHeader('X-RateLimit-Reset', resetIn); // human-readable time

            next();
        };

        // Apply the rateLimiter middleware to the app
        app.use(rateLimiter);
    };
};

export default rateLimitPlugin;
