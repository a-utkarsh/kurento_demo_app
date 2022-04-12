const websocket = require('ws');
const crypto    = require("crypto");
const kurento   = require('kurento-client');
const { pipeline } = require('stream');

let __kurentoClient = null;
let argv = {
	ws_uri: 'ws://localhost:8888/kurento'
};

const websocketServer = (expressServer) => {

	let wss = new websocket.Server ({
		server : expressServer,
		path : '/kurento_ws',
	}); 

	let presenter = null;
	let participants = [];
	let candidateQueue = {};
	let usersList = [];

	wss.on ('connection', (ws) => {

		let _sessionId = uniqueId(); 
		ws.id = _sessionId;
		console.log ('new connection established with sessionId', _sessionId);

		ws.on ('error', (error) => {
			console.error (error, 'some error for connection', _sessionId);
			stopSession (_sessionId);
		});

		ws.on ('close', () => {
			console.error ('connection closed for session', _sessionId);
			stopSession (_sessionId);
		});

		if (!presenter) {
			usersList.push ({
				type : 'presenter',
				userId: _sessionId,
			});
			ws.send (JSON.stringify({
				id : 'user_type',
				type : 'presenter',
				userId : _sessionId,
			}));
		}

		else {
			usersList.push ({
				type : 'participant',
				userId: _sessionId,
			});
			ws.send (JSON.stringify({
				id : 'user_type',
				type : 'participant',
				userId : _sessionId,
			}));
			ws.send (JSON.stringify({
				id: 'user_list',
				usersList  : usersList,
			}));

			wss.clients.forEach (client => {
				if (client.id !== _sessionId) {
					client.send (JSON.stringify({
						id: 'new_participant',
						userId : _sessionId 
					}));
				}
			});
		}

		ws.on ('message', (data, isBinary) => {
			let message = isBinary ? data : JSON.parse(data.toString());
			console.log ('New message received from connection', _sessionId, {message});

			switch (message.id) {
				case 'ping_ws_message' :
					ws.send (JSON.stringify({
						message : 'pong_ws_message'
					}));
					break;

				case 'presenter' : 
					if (presenter) {
						wss.clients.forEach (client => {
							client.send (JSON.stringify({
								id : 'presenter',
								message : 'presenter_joined'
							}));
						});
					}
					
					onPresenterJoin (_sessionId, ws, message.offer);
					break;

				case 'participant' :
					if (presenter) {
						wss.clients.forEach (client => {
							client.send (JSON.stringify({
								id : 'presenter',
								message : 'presenter_joined'
							}));
						});
					}
					onParticipantJoin (_sessionId, ws, message.offer);
					break;

				case 'onIceCandidate' : 
					onIceCandidate (_sessionId , message.candidate);
					break;
				
				case 'onAnswer':
					onAnswer (_sessionId, message.answer);
					break;

				default : 
					ws.send (JSON.stringify({
						message : 'Invalid message received',
						id : message.id,
					}));
			}
		});
	});

	const onPresenterJoin = (sessionId, ws, sdpOffer) => {

		removeCandidate (sessionId);
		
		if (presenter) {
			return ws.send (
				JSON.stringify ({
					message : "Presenter already joined"
				})
			);
		}

		presenter  = {
			id : sessionId,
			pipeLine : null, 
			webRtcEndpoint : null,
		};

		const onError = (err) => {
			return ws.send (JSON.stringify({
				id : 'presenter_response',
				message : err, 
				response : 'rejected'
			}));		
		};

		getKurentoClient ((err, __kurentoClient) => {
			console.log (__kurentoClient, 'kurento client get ok');
			if (err) {
				console.error ('error getting kurento clinet', err);
				return onError (err);
			}

			if (presenter === null) {
				return onError ('No active presenter');
			}

			/**
			 * Creating media pipeline
			 */
			__kurentoClient.create ('MediaPipeline', (err, pipeline) => {
				if (err) {
					console.error (err, 'something went wrong with creating kurento clinet');
					return onError ({err, msg : 'something went wrong with kurento clinet'});
				}

				if (presenter === null) {
					return onError ('No active presenter');
				}

				presenter.pipeLine = pipeline;

				/**
				 * Creating webrtc endpoint
				 */
				pipeline.create ('WebRtcEndpoint', (err, webRtcEndpoint) => {
					if (err) {
						console.error ('error creating pipeline', err);
						return onError({err, msg : 'something went wrong'});
					}

					if (presenter === null) {
						return onError ('No active presenter');
					}

					console.debug ('webrtrc endpoint created', webRtcEndpoint);
					presenter.webRtcEndpoint = webRtcEndpoint;

					if (candidateQueue[sessionId]) {
						while (candidateQueue[sessionId].length) {
							let __candidate = candidateQueue[sessionId].shift();
							webRtcEndpoint.addIceCandidate (__candidate);
						}
					}

					webRtcEndpoint.on ('OnIceCandidate', (event) => {
						let __candidate = kurento.getComplexType ('IceCandidate')(event.candidate);
						ws.send (JSON.stringify ({
							id : 'iceCandidate',
							candidate : __candidate
						}));
					});

					webRtcEndpoint.processOffer (sdpOffer, (err, sdpAnswer) => {
						if (err) {
							return onError (err);
						}

						if (presenter === null) {
							return onError ('No active presenter');
						}

						console.info ('SDP answer created for presenter', sdpAnswer);

						ws.send (JSON.stringify({
							answer : sdpAnswer,
							id : 'presenter_response',
							response : 'accepted'
						}));
					});

					webRtcEndpoint.gatherCandidates ((err) => {
						if (err) {
							return onError ('error creating ice candidate on server');
						}
					});
				});
			});
		});
	};

	const onParticipantJoin = (sessionId, ws, sdpOffer) => {
		removeCandidate (sessionId);

		const onError = (err) => {
			console.error (err, 'error in participant join');
			return ws.send (JSON.stringify({
				id : 'participant_response',
				message : err, 
				response : 'rejected'
			}));		
		};

		if (!presenter) {
			return onError ('no active presenter');
		}

		presenter.pipeLine.create ('WebRtcEndpoint', (err, webRtcEndpoint)=> {
			if (err) {
				return onError (err);		
			}

			participants[sessionId] = {
				id : sessionId,
				webRtcEndpoint : webRtcEndpoint,
				ws : ws,
			};

			if (!presenter) {
				return onError ('no active presenter');
			}

			if (candidateQueue[sessionId]) {
				while (candidateQueue[sessionId].length) {
					let __candidate = candidateQueue[sessionId].shift();
					webRtcEndpoint.addIceCandidate (__candidate);
				}
			}

			webRtcEndpoint.on ('OnIceCandidate', (event) => {
				let __candidate = kurento.getComplexType ('IceCandidate')(event.candidate);
				ws.send (JSON.stringify ({
					id : 'iceCandidate',
					candidate : __candidate
				}));
			});

			webRtcEndpoint.processOffer (sdpOffer, (err, sdpAnswer) => {
				if (err) {
					return onError ('error processing offer');
				}

				if (!presenter) {
					return onError ('no active participant');
				}

				presenter.webRtcEndpoint.connect (webRtcEndpoint, (err) => {
					if (err) {
						return onError ('error connecting to presenter webrtc end point');
					}

					if (!presenter) {
						return onError ('no active presenter');
					}

					console.info ('SDP answer created for participant',sessionId, sdpAnswer);

					ws.send (JSON.stringify({
						answer : sdpAnswer,
						id : 'participant_response',
						response : 'accepted'
					}));

					webRtcEndpoint.gatherCandidates ((err)=> {
						if (err) {
							return onError ('error gatering ice candidate');
						}
					});
				});
			});
		});
	};

	const removeCandidate = (sessionId) => {
		if (!candidateQueue[sessionId]) {
			return;
		}
		delete candidateQueue[sessionId];
	};

	const stopSession = (sessionId) => {
		if (presenter && presenter.sessionId === sessionId) {
			presenter = null;
			return;
		}
		participants = participants.filter(s => s !== sessionId);
	};

	const onIceCandidate = (sessionId, candidate) => {
		console.info ('New ice canidate received');
		let __candidate = kurento.getComplexType ('IceCandidate')(candidate);

		/**
		 * Add ice candidate for presenter
		 */
		if (presenter && presenter.id === sessionId && presenter.webRtcEndpoint) {
			console.info ('Adding ice candidate for presenter');
			presenter.webRtcEndpoint.addIceCandidate (__candidate);
			return;
		}

		/**
		 * Add ice candidate for participant
		 */

		if (participants[sessionId] && participants[sessionId].webRtcEndpoint) {
			console.info ('Adding ice candidate for participant');
			participants[sessionId].webRtcEndpoint.addIceCandidate(__candidate);
			return;
		}

		/**
		 * Add ice candidate to the candidate queue
		 */

		if (!candidateQueue[sessionId]) {
			candidateQueue[sessionId] = [];
		}

		candidateQueue[sessionId].push(candidate);
	};

	const onAnswer = (sessionId, answer) => {
		wss.clients.forEach(client => {
			if (client.id === sessionId) {
				return;
			}
			client.send(JSON.stringify({
				message: 'sending sdp received',
				id: 'onAnswer',
				answer : answer
			}));
		});
	};
};

const uniqueId = () => {
	return crypto.randomBytes(16).toString("hex");
};

const getKurentoClient = (callback) => {
	if (__kurentoClient) {
		console.log ('kurento client get ok,', __kurentoClient);
		callback (null, __kurentoClient);
		return;
	}
	kurento(argv.ws_uri, (error, _kurentoClient) => {
		if (error) {
			console.error ('kurento MS not found', error);
			return callback("media server not found");
		}
		__kurentoClient = _kurentoClient;
		console.log ('kurento client get ok,', __kurentoClient);
		callback(null, _kurentoClient);
	});
};

module.exports = websocketServer;