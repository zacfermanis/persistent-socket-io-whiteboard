const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;
const mongo = require('mongodb').MongoClient;

mongo.connect('mongodb://localhost:27017/pen', (error, db) => {
	if (error) throw error;
	console.log('Connected to DB');
	app.use(express.static(__dirname + '/public'));

	function onConnection(socket) {
		console.log('client connected');
		db.collection('pen').find().sort({timestamp:1}).forEach((data, error) => {
			socket.emit('pen', data);
			if (error) console.log(error);
		});

		socket.on('pen', (data) => {
			data.timestamp = new Date();
			db.collection('pen').save(data, (error, result) => {
				if (error) console.log(error);
			});
			socket.broadcast.emit('pen', data);
		});


        db.collection('story').find().sort({timestamp:1}).forEach((data, error) => {
            socket.emit('story', data);
        if (error) console.log(error);
    	});

        socket.on('story', (data) => {
            data.timestamp = new Date();
        db.collection('story').save(data, (error, result) => {
            if (error) console.log(error);
    	});
        socket.broadcast.emit('story', data);
    	});


	}

	io.on('connection', onConnection);

	http.listen(port, () => console.log('running on port ' + port));
});
