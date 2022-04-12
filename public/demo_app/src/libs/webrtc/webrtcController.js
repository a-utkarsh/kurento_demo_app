import WebRTC     from './webrtcTransport';

let WebrtcController = {};
let webrtc = null;

WebrtcController.openChannel = async (options) => {
	if (webrtc) return webrtc;

	webrtc = new WebRTC ({
		sendIceCandidate : options.sendIceCandidate,
		...options,
	});

	await webrtc.initPeerConnection ();
	return webrtc;
};

WebrtcController.closeChannel = () => {
	if (webrtc)
		webrtc.closePeerConnection ();
	webrtc = null;
};

WebrtcController.createOffer = () => {
	return webrtc.createOffer();
}

WebrtcController.handleIce = (data) => {
	return webrtc.onIncomingICE (data);
};

WebrtcController.handleOffer = (data) => {
	return webrtc.onIncomingSDP (data);
};

WebrtcController.toggleAudio = (data) => {
	return webrtc.toggleAudioTrack (data);
};

WebrtcController.toggleVideo = (data) => {
	return webrtc.toggleVideoTrack (data);
};

WebrtcController.getTransportRef = () => {
	return webrtc;
};

WebrtcController.getStreamRef = () => {
	return webrtc?.stream;
};

export default WebrtcController;
