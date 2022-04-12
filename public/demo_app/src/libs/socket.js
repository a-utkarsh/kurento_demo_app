let socket = null;

export const connect = (onInfoMessage) => {
    socket = new WebSocket ('ws://localhost:8000/kurento_ws');
    
	socket.onopen = () => {
		console.log('connection established')
	}

	socket.onmessage = (event) => {
		console.log('Message received from server', event.data);
		onInfoMessage (JSON.parse(event.data));
	}

	socket.onclose = (event) => {
		console.log('connection closed', event.code, event.reason);
	}

	socket.onerror = (err) => {
		console.error('something went wrong', err.message);
	}
}

export const sendMessage  = (message) => {
	let _message = JSON.stringify(message)
	socket.send (_message);
}