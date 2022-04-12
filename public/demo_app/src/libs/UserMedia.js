class UserMedia {

	constructor (options = {}) {
		
		this.constraints = options.constraints || {audio : true, video : { width : 720, height : 480, frameRate : 30}}
		this.stream = null;
		this.mediaDevices = navigator.mediaDevices;
	}

	getLocalMedia = async () => {

		let constraints = this.constraints;

		try {
			this.stream = await this.mediaDevices.getUserMedia (constraints);
		}
		catch (err) {
			console.error ('error getting user media', err);
			return;
		}
		return this.stream;
	}

	toggleAudioTrack = (isEnabled) => {
		if (this.stream && this.stream.getAudioTracks ()[0]) 
			this.stream.getAudioTracks()[0].enabled = isEnabled;
	}

	toggleVideoTrack = (isEnabled) => {
		if (this.stream && this.stream.getVideoTracks ()[0])
			this.stream.getVideoTracks()[0].enabled = isEnabled;
	}

	getStreamRef = () => {
		return this.stream;
	}
}

export default UserMedia;