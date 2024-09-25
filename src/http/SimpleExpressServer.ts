import { createServer, Socket } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as querystring from 'querystring';
import * as ejs from 'ejs';

export interface Request {
    method: string;
    url: string;
    headers: { [key: string]: string };
    body: any;
    params: { [key: string]: string };
    query: { [key: string]: string | string[] };
    socket: Socket;
}

export interface Response {
    socket: Socket;
    statusCode: number;
    headers: { [key: string]: string };
    send: (body: string | Buffer) => void;
    json: (data: any) => void;
    render: (view: string, data?: any) => void;
    setHeader: (key: string, value: string) => void;
}

export type Middleware = (req: Request, res: Response, next: () => void) => void;
export type Plugin = (app: SimpleExpressServer) => void;

class SimpleExpressServer {
    private middlewares: Middleware[] = [];
    // Updated routes structure to include regex and keys
    private routes: {
        [method: string]: { path: string; handler: Middleware; regex: RegExp; keys: string[] }[];
    } = {};
    private port: number;

    constructor(port: number) {
        this.port = port;
    }

    addPlugin(...plugins: Plugin[]) {
        try {
            for (const plugin of plugins) {
                console.log('Loading plugin...');
                plugin(this);
                console.log('Plugin loaded successfully');
            }
        } catch (err) {
            console.error('Error loading plugin:', err);
        }
    }

    use(middleware: Middleware) {
        this.middlewares.push(middleware);
    }

    static(dir: string) {
        this.use((req, res, next) => {
            const filePath = path.join(dir, decodeURIComponent(req.url));
            fs.stat(filePath, (err, stats) => {
                if (!err && stats.isFile()) {
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            next();
                        } else {
                            const ext = path.extname(filePath);
                            res.setHeader('Content-Type', SimpleExpressServer.getMimeType(ext));
                            res.send(data);
                        }
                    });
                } else {
                    next();
                }
            });
        });
    }

    private static getMimeType(ext: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            // Add more MIME types as needed
        };
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    route(method: string, path: string, handler: Middleware) {
        this.addRoute(method.toUpperCase(), path, handler);
    }

    get(path: string, handler: Middleware) {
        this.addRoute('GET', path, handler);
    }

    post(path: string, handler: Middleware) {
        this.addRoute('POST', path, handler);
    }

    put(path: string, handler: Middleware) {
        this.addRoute('PUT', path, handler);
    }

    delete(path: string, handler: Middleware) {
        this.addRoute('DELETE', path, handler);
    }

    patch(path: string, handler: Middleware) {
        this.addRoute('PATCH', path, handler);
    }

    // Updated addRoute to compile the path into regex and store keys
    private addRoute(method: string, path: string, handler: Middleware) {
        if (!this.routes[method]) {
            this.routes[method] = [];
        }
        const { regex, keys } = this.compilePath(path);
        this.routes[method].push({ path, handler, regex, keys });
    }

    // New method to compile paths with parameters into regex patterns
    private compilePath(path: string) {
        const keys: string[] = [];
        const regexPath = path.replace(/:([^\/]+)/g, (match, key) => {
            keys.push(key);
            return '([^\/]+)';
        });
        const regex = new RegExp(`^${regexPath}$`);
        return { regex, keys };
    }

    // Updated findRoute to match routes using regex and extract params
    private findRoute(method: string, pathname: string) {
        const routes = this.routes[method] || [];
        for (const route of routes) {
            const match = route.regex.exec(pathname);
            if (match) {
                const params: { [key: string]: string } = {};
                route.keys.forEach((key, index) => {
                    params[key] = match[index + 1];
                });
                return { ...route, params };
            }
        }
        return null;
    }

    listen(callback?: () => void) {
        const server = createServer((socket) => this.handleConnection(socket));

        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${this.port} is already in use.`);
            } else if (err.code === 'EACCES') {
                console.error(`Permission denied. Cannot bind to port ${this.port}.`);
            } else {
                console.error(`Error starting server on port ${this.port}:`, err.message);
            }
            process.exit(1);
        });

        server.listen(this.port, () => {
            console.log(`Server listening on port ${this.port}`);
            if (callback) {
                callback();
            }
        });
    }

    private handleConnection(socket: Socket) {
        let requestData = '';
        socket.on('data', (data) => {
            requestData += data.toString();

            if (requestData.indexOf('\r\n\r\n') !== -1) {
                const contentLengthMatch = requestData.match(/Content-Length: (\d+)/i);
                const contentLength = contentLengthMatch ? parseInt(contentLengthMatch[1], 10) : 0;

                const bodyStartIndex = requestData.indexOf('\r\n\r\n') + 4;
                const bodyData = requestData.substring(bodyStartIndex);

                if (Buffer.byteLength(bodyData) >= contentLength) {
                    this.handleRequest(socket, requestData);
                    requestData = '';
                }
            }
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
        });
    }

    private handleRequest(socket: Socket, requestData: string) {
        const [headerPart, bodyPart = ''] = requestData.split('\r\n\r\n');
        const headerLines = headerPart.split('\r\n');
        const [requestLine, ...headerFields] = headerLines;

        const [method, fullUrl, protocol] = requestLine.split(' ');

        if (!method || !fullUrl || !protocol) {
            this.sendResponse(socket, 400, { 'Content-Type': 'text/plain' }, 'Bad Request');
            return;
        }

        const parsedUrl = url.parse(fullUrl, true);
        const pathname = decodeURIComponent(parsedUrl.pathname || '/');
        const query = parsedUrl.query;

        const headers: { [key: string]: string } = {};
        headerFields.forEach((field) => {
            const separatorIndex = field.indexOf(':');
            if (separatorIndex !== -1) {
                const key = field.substring(0, separatorIndex).trim().toLowerCase();
                const value = field.substring(separatorIndex + 1).trim();
                headers[key] = value;
            }
        });

        const req: Request = {
            method,
            url: fullUrl,
            headers,
            body: null,
            params: {},
            query: Object.fromEntries(Object.entries(query).filter(([_, v]) => v !== undefined)) as {
                [key: string]: string | string[];
            },
            socket,
        };

        const res: Response = {
            socket,
            statusCode: 200,
            headers: {},
            send: (body: string | Buffer) => {
                this.sendResponse(socket, res.statusCode, res.headers, body, req.method === 'HEAD');
            },
            json: (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(data));
            },
            render: (view: string, data?: any) => {
                const supportedExtensions = ['.ejs', '.html'];
                let found = false;
            
                for (const ext of supportedExtensions) {
                    const filePath = path.join(__dirname, 'views', view + ext);
                    if (fs.existsSync(filePath)) {
                        fs.readFile(filePath, 'utf8', (err, content) => {
                            if (err) {
                                res.statusCode = 500;
                                res.send('Internal Server Error');
                            } else {
                                let rendered = '';
                                if (ext === '.ejs') {
                                    rendered = this.renderEJS(content, data);
                                    res.setHeader('Content-Type', 'text/html');
                                } else if (ext === '.html') {
                                    rendered = content;
                                    res.setHeader('Content-Type', 'text/html');
                                } else {
                                    rendered = content;
                                    res.setHeader('Content-Type', SimpleExpressServer.getMimeType(ext));
                                }
                                res.send(rendered);
                            }
                        });
                        found = true;
                        break;
                    }
                }
            
                if (!found) {
                    res.statusCode = 404;
                    res.send('View Not Found');
                }
            },            
            setHeader: (key: string, value: string) => {
                res.headers[key] = value;
            },
        };

        req.body = this.parseRequestBody(bodyPart, headers['content-type']);

        const middlewares = [...this.middlewares];
        let route = this.findRoute(method, pathname);

        if (!route && method === 'HEAD') {
            route = this.findRoute('GET', pathname);
            if (route) {
                req.method = 'GET';
                res.send = (body: string | Buffer) => {
                    this.sendResponse(socket, res.statusCode, res.headers, body, true);
                };
            }
        }

        if (route) {
            req.params = route.params; // Assign extracted params to req.params
            middlewares.push(route.handler);
        } else {
            middlewares.push((req, res) => {
                res.statusCode = 404;
                res.send('Not Found');
            });
        }

        this.executeMiddlewares(middlewares, req, res);
    }

    private parseRequestBody(body: string, contentType: string | undefined): any {
        if (!contentType) {
            return body;
        }

        if (contentType.includes('application/json')) {
            try {
                return JSON.parse(body);
            } catch (err) {
                return null;
            }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            return querystring.parse(body);
        } else if (contentType.includes('text/plain')) {
            return body;
        } else {
            return body;
        }
    }

    private executeMiddlewares(middlewares: Middleware[], req: Request, res: Response) {
        const next = () => {
            if (middlewares.length > 0) {
                const middleware = middlewares.shift();
                if (middleware) {
                    try {
                        middleware(req, res, next);
                    } catch (err) {
                        console.error('Middleware error:', err);
                        res.statusCode = 500;
                        res.send('Internal Server Error');
                    }
                }
            }
        };
        next();
    }

    private sendResponse(
        socket: Socket,
        statusCode: number,
        headers: { [key: string]: string },
        body: string | Buffer,
        suppressBody: boolean = false
    ) {
        let response = `HTTP/1.1 ${statusCode} ${this.getStatusMessage(statusCode)}\r\n`;
        headers['Content-Length'] = Buffer.byteLength(body).toString();
        headers['Connection'] = 'close';

        for (const [key, value] of Object.entries(headers)) {
            response += `${key}: ${value}\r\n`;
        }
        response += '\r\n';

        if (!suppressBody) {
            if (Buffer.isBuffer(body)) {
                socket.write(response);
                socket.write(body);
            } else {
                response += body;
                socket.write(response);
            }
        } else {
            socket.write(response);
        }
        socket.end();
    }

    private getStatusMessage(statusCode: number) {
        const statusMessages: { [key: number]: string } = {
            200: 'OK',
            201: 'Created',
            204: 'No Content',
            400: 'Bad Request',
            404: 'Not Found',
            405: 'Method Not Allowed',
            429: 'Too Many Requests',
            500: 'Internal Server Error',
        };
        return statusMessages[statusCode] || 'Unknown Status';
    }

    private renderEJS(template: string, data: any = {}) {
        return ejs.render(template, data);
    }
}

export default SimpleExpressServer;
