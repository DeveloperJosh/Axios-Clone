// test.ts

import SimpleExpressServer from './SimpleExpressServer';
import rateLimitPlugin from './myPlugin';
import * as path from 'path';

const app = new SimpleExpressServer(3000);

app.addPlugin(rateLimitPlugin({ limit: 13000, windowMs: 500000 }));

app.static(path.join(__dirname, 'views'));

// Define a route for the homepage
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Home Page',
        message: 'Welcome to our website!',
        items: ['item1', 'item2', 'item3'],
    });
});

// Start the server
app.listen();
