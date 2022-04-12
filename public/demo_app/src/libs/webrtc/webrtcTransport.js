/*eslint no-console: "off"*/

class WebRTC {

	constructor (options) {

		if (!options.sendIceCandidate)
			throw new Error ('sendIceCandidate not defined');

		this.sendIceCandidate     = options.sendIceCandidate;
		this.onDataChannelInfo    = options.onDataChannelInfo;

		this.isReactNative        = options.isReactNative || true;

		this.connType             = options.connType || 'local';
		this.onStatus             = options.onStatus || null;

		this.iceServers           = this.connType === 'local' ? [ ] : options.iceServersInfo;
		this.rtc_configuration    = options.rtc_configuration || { iceServers : this.iceServers };
		this.default_constraints  = options.constraints || { audio: true, video :  {height : 480, width : 720, frameRate : 30}};
		this.connect_attempts     = options.connection_attempts || 0;

		/* Internal properties */
		this.statuses             = [];
		this.peer_connection      = null;
		this.local_stream_promise = null;
		this.stream               = null;

		this.mediaDevices          = navigator.mediaDevices;

		this.onError            = options.onError || null;
		this.remoteIceCandidate = [];
		this.remoteSdp = null;
	}

	/**
	 * get default audio constraints
	 * @return Object
	 */
	getAudioDefaults = () => {
	}

	/**
	 * Get the status history Array.
	 * @return {string[]} List of statuses.
	 */
	getStatuses = () => {
		return this.statuses;
	}

	/**
	 * Handle status string.
	 * @param {string} status - The status string.
	 */
	setStatus = (status) => {
		this.statuses.push (status);

		if (this.onStatus)
			this.onStatus (status);
		else
			console.log (status);
	}

	/**
	 * Handle error string.
	 * @param {string} error - The error string.
	 */
	setError = (error) => {
		if (this.onError)
			this.onError (error);
		else
			console.error (error);
	}

	closePeerConnection = () => {
		this.setStatus ('Disconnected from Peer, Closing');

		if (this.peer_connection) this.peer_connection.close ();
		if (this.stream) {
			let tracks = this.stream.getTracks();
			tracks.forEach (track => {
				track.stop();
			});
		} 

		this.stream = null;
		this.peer_connection = null;
	}

	/**
	 * SDP offer received from peer, set remote description and create an answer.
	 * @param {Object} sdp - The Session Description object.
	 */
	onIncomingSDP = async(sdp) => {

		let __this = this;

		sdp = {
			type : 'answer',
			sdp : sdp,
		}

		try {
			sdp = new RTCSessionDescription (sdp);

			__this.setStatus ("onIncomingSDP");

			await __this.peer_connection.setRemoteDescription (sdp);
			__this.remoteSdp = sdp;
			__this.setStatus ('Remote SDP set');

			while(__this.remoteIceCandidate.length) {
				let __candidate = __this.remoteIceCandidate.shift();
				__this.onIncomingICE (__candidate);
			}

			let __remoteStreams = await __this.peer_connection.getRemoteStreams()[0];

			let __localStream = __this.stream;

			return {
				local : __localStream,
				remote : __remoteStreams,
			}


			/*
			if (sdp.type !== 'offer')
				throw new Error ('invalid offer');

			__this.setStatus ('Got SDP offer');

			__this.setStatus ('Adding local stream');
			__this.peer_connection.addStream (__this.stream);

			__this.setStatus ('Got local stream, creating answer');

			let pre_answer = await __this.peer_connection.createAnswer ();

			let final_answer = await __this.onLocalDescription (pre_answer);

			return final_answer;
			*/
		}
		catch (err) {
			let error = err;

			if (typeof error === "undefined" || !error)
				error = 'Audio connection error';

			__this.setError (error);

			throw error;
		}
	}

	/**
	 * ICE candidate received from peer, add it to the peer connection.
	 * @param {Object} ice - The ICE Candidate object.
	 */
	onIncomingICE = async(ice) => {
		let __this = this;

		if (!__this.remoteSdp) {
			__this.remoteIceCandidate.push (ice);
			return;
		}

		try {
			let candidate = new RTCIceCandidate (ice);

			if (!__this.peer_connection)
				return;

			await __this.peer_connection.addIceCandidate (candidate);
			__this.setStatus ("Remote Ice Candidate added.");

		}
		catch (err) {
			let error = err;

			if (typeof error === "undefined" || !error)
				error = 'Audio connection error';

			__this.setError (error);

			throw error;
		}
	}

	/**
	 * Local description was set, send it to peer.
	 * @param {Object} desc - The Session Description Object.
	 */
	onLocalDescription  = async(desc) => {
		let __this = this;

		let modifiedSdp = this.setPacketTime (desc.sdp, 10);
		desc.sdp = modifiedSdp;

		__this.setStatus ('Got local description: ' + JSON.stringify (desc));

		await __this.peer_connection.setLocalDescription (desc);

		return {
			sdp : __this.peer_connection.localDescription.sdp
		};
	}

	setPacketTime = (sdp, ptime) => {
		if (!ptime)
			ptime = 10;

		const pLine = `a=ptime:${ptime}\r\n`;
		const maxpLine = `a=maxptime:${ptime}\r\n`;
		sdp = sdp + pLine + maxpLine;

		return sdp;
	}

	enumerateDevices = () => {
		return this.mediaDevices.enumerateDevices();
	}

	findFrontRearVideo = (sources, isFront) => {
		/* TODO this does not support phone models with multiple camera lenses in front or rear
		 * This function can return a random front camera if it has multiple front cameras
		 * same goes for rear cameras */
		return sources.find(source => {
			return source.kind === "video" && source.facing === (isFront ? "front" : "environment");
		});
	}

	toggleAudioTrack = (isEnabled) => {
		if (this.stream && this.stream.getAudioTracks ()[0]) 
			this.stream.getAudioTracks()[0].enabled = isEnabled;
	}

	toggleVideoTrack = (isEnabled) => {
		if (this.stream && this.stream.getVideoTracks ()[0])
			this.stream.getVideoTracks()[0].enabled = isEnabled;
	}

	onIceCandidate = (event) => {
		/* Send  Local ICE Candidates on getting them */
		if (event.candidate === null) {
			this.setStatus ('ICE Candidate was null, done');
			return;
		}

		this.setStatus ('Sending ICE Candidate using sendIceCandidate callback');
		this.sendIceCandidate ({ ice: event.candidate });
	}

	/**
	 * Get User Media from navigator.MediaDevices.
	 * @return {Object} The local Stream.
	 */
	getLocalStream = async() => {
		let __this = this;

		try {
			let constraints = __this.default_constraints;
			__this.stream = await __this.mediaDevices.getUserMedia (constraints);
			__this.toggleAudioTrack(false);
			__this.toggleVideoTrack(false);
			return __this.stream;
		}
		catch (err) {
			console.log (err);
			__this.setError (err);

			throw { status_code: 5001, message: 'Audio permission refused on the device.' };
		}
	}

	createOffer = async() => {
		let __this = this;
		
		try {
			let __offer = await __this.peer_connection.createOffer ();
			this.setStatus ('offer created')
			let __sdp = await this.onLocalDescription (__offer);
			return __sdp.sdp;
		}	
		catch (err) {
			console.error ('Error creating offer');
			throw err;
		}
	}

	/*
	 * Initialize Peer Connection in the beginning
	 * Peer Connection is needed to:
	 * <pre>
	 * 1. Set Remote Session Description (offer)
	 * 2. Set Remote ICE Candidates
	 * 3. Get Local Session Description (answer)
	 * 4. Get Local ICE Candidates
	 * </pre>
	 * @param {Object} msg - The message Object from ws.
	 */
	initPeerConnection = async() => {
		let __this = this;

		try {

			if (__this.peer_connection)
				return;

			/* Reset connection attempts because we connected successfully */
			__this.connect_attempts = 0;

			__this.setStatus ('Creating RTCPeerConnection with' + JSON.stringify (__this.rtc_configuration));

			__this.peer_connection = new RTCPeerConnection (__this.rtc_configuration);

			__this.setStatus ('new RTCPeerConnection created');
			//__this.peer_connection.createDataChannel('audio')

			/* Send our audio to the other peer */
			let __stream = await __this.getLocalStream ();

			__stream.getTracks().forEach(track => {
				__this.peer_connection.addTrack(track);
			});

			__this.peer_connection.onicecandidate = this.onIceCandidate;
			__this.setStatus ('Created peer connection for call, waiting for SDP');

			return __this.peer_connection;
		}
		catch (err) {
			let error = err;

			if (typeof error === "undefined" || !error)
				error = 'Audio connection error';

			__this.setError (error);

			throw error;
		}
	}

	getStream = () => {
		return this.stream;
	}
}

export default WebRTC;
