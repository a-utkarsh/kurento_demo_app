import React, { useEffect, useState } from 'react';
import { connect, sendMessage } from '../libs/socket';
import webrtc   from '../libs/webrtc/webrtcController';
import Grid from '@mui/material/Grid';

function Room({ name }) {

	const [userType, setUserType] = useState ('');
	const [usersList, setUsersList] = useState ();
	const [videoEnabled, setVideoEnabled] = useState (false);
	const [audioEnabled, setAudioEnabled] = useState (false);
	const [remoteStream, setRemoteStream] =  useState (null);

	useEffect(() => {
		init ();
	}, [])

	const init = async() => {
		await connect (onInfo);
	}

	useEffect (() => {
		if (!userType) {
			return;
		}
		connectMediaServer (userType);
	}, [userType])

	const onInfo = (data) => {
		switch (data.id) {
			case 'user_type' :
				setUserType (data.type);
				break;
			case 'iceCandidate' :
				onIncomingIce(data);
				break;
			case 'presenter_response' :
				onPresenterResponse (data);
				break;
			case 'participant_response' :
				onParticipantResponse(data);
				break;
			default :
				return;
		}
	}

	const onPresenterResponse = async(data) => {
		if (data.response === 'rejected') {
			console.error ('Not able to start connection: ' + data.message)
			return;
		}
		let __streams = await webrtc.handleOffer (data.answer);
		playLocalVideoStream (__streams.local);
	}

	const onParticipantResponse = async(data) => {
		if (data.response === 'rejected') {
			console.error ('Not able to start connection: ' + data.message)
			return;
		}
		let __streams = await webrtc.handleOffer (data.answer);
		playLocalVideoStream (__streams.local);
		playRemoteVideoStream(__streams.remote);
	}

	const onIncomingIce = (data) => {
		webrtc.handleIce (data.candidate);
	}

	
	const connectMediaServer = async(user) => {
		try {
			await webrtc.openChannel({
				sendIceCandidate : (candidate) => {
					sendMessage({ id: 'onIceCandidate', candidate: candidate.ice })
				}
			})
			let _offer = await webrtc.createOffer ();
			sendMessage ({id: user, offer: _offer});
		}
		catch (err) {
			console.error (err);
			return;
		}
	}

	const playLocalVideoStream = (stream) => {
		if (!stream) {
			return;
		}
		let video = document.getElementById('local_video');
		if (!video) {
			return;
		}
		video.srcObject = stream;
	};

	const playRemoteVideoStream = (stream) => {

		if (!stream) {
			return;
		}
		let video = document.getElementById('remote_video');
		if (!video) {
			return;
		}
		video.height = 480;
		video.width = 720;
		video.srcObject = stream;
	}


	/*
	const initConnection  = async() => {
		_localConnection = new RTCPeerConnection ();
		_dataChannel     = _localConnection.createDataChannel('msg_channel');
	
		_dataChannel.onopen = (e) => {
			console.log ('connection opened!', e);
		}

		_dataChannel.onmessage = (e) => {
			setNewMsg (e.data)
		}
		
		_localConnection.onicecandidate = (e) => {
			console.log ('New ice candidate', e.candidate);
			sendMessage ({id : 'onIceCandidate', candidate : e.candidate})
		}

		let _offer =  await	 _localConnection.createOffer ();
		console.log (_offer, 'offer for local')
		_localConnection.setLocalDescription(_offer).then(a => console.log ('set local description successfully', a));
	}

	const connectToPeer = (candidate) => {
		_remoteConnection = new RTCPeerConnection ();

		_remoteConnection.onicecandidate = (e) => {
			console.log ('New ice candidate', JSON.stringify(_remoteConnection.localDescription));
			sendMessage ({id : 'onAnswer', answer : _remoteConnection.localDescription})
		}

		_remoteConnection.ondatachannel = (e) => {
			_remoteConnection.dataChannel = e.channel;
			_remoteConnection.dataChannel.onmessage = (e) => console.log ('New message from client', e.data);
			_remoteConnection.dataChannel.onopen = (e) => console.log ('connection opened remote!!');
		}

		_remoteConnection.setRemoteDescription (candidate).then(a => console.log ("offer set"));

		_remoteConnection.createAnswer ().then (ans => _remoteConnection.setLocalDescription(ans)).then(a => console.log ('answer created'))
	}

	const handleInputChange = (event) => {
		setMessage (event.target.value);
	}

	const onSendMsg = () => {
		_dataChannel.send (message)
	}
	*/

	const toggleAudio = () => {
		webrtc.toggleAudio (!audioEnabled);	
		setAudioEnabled (!audioEnabled);
	}

	const toggleVideo = () => {
		webrtc.toggleVideo(!videoEnabled);
		setVideoEnabled (!videoEnabled);		 
	}

	return (
		<Grid className = 'room-video-container'>
			<Grid style = {{maxWidth : 720, borderRadius : 8}}>
				<video id= 'local_video' height={480} width={720} autoPlay muted = {true}></video>
			</Grid>
			<Grid style = {{maxWidth : 720, borderRadius : 8}}>
				<video id= 'remote_video'  autoPlay muted = {false}></video>
			</Grid>
			<Grid style={{ position: 'fixed', bottom: 60, display: 'inline-flex', left: '50%' }}>
				<button onClick={toggleAudio}>
					{audioEnabled ? 'Mute' : 'Unmute'}
				</button>
				<button onClick={toggleVideo}>
					{videoEnabled ? 'Video off' : 'Video on'}
				</button>
			</Grid>
		</Grid>
	)
}

export default Room;