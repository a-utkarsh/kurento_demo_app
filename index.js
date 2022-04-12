const express   = require('express');
const path      = require('path');


const websocketServer = require ('./session');

const app = express();

/**
 * Init middlewares
 */

app.use(express.json({limit : '50mb'}));
app.use(express.urlencoded({extended : false}));

app.get ('/ping', (req, res) => {
	res.status(200).send ('pong');
}); 

app.use(express.static(path.join(__dirname, "/public/demo_app", "build")));
app.use(express.static("public"));

app.use('/kurento', (req, res) => {
	res.sendFile(path.join(__dirname, "/public/demo_app", "build", "index.html"));
});

const init = async () => {

	try {
		const server = app.listen (8000);
		websocketServer (server);
	}
	catch (err) {
		console.error ({err}, 'error in starting app');
		process.exit (1);
	}
};

init();