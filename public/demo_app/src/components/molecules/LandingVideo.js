import React, { useEffect, useRef } from 'react';
import Grid  from '@mui/material/Grid';

import UserMedia from '../../libs/UserMedia'; 

import '../../styles/components/molecules/landingVideo.css';

function LandingVideo () {

	const videoElRef = useRef (null);

	useEffect (() => {
		showJoiningVideo ();
	}, [])

	const showJoiningVideo = async() => {
		let __userMedia = new UserMedia();
		let __stream = await __userMedia.getLocalMedia ();

		if (videoElRef.current) {
			videoElRef.current.srcObject = __stream;
		}
	}

	return (
		<Grid className ='landingVideoContainer' container alignItems = 'center'>
			<video height = 'auto' width = '100%' ref = {videoElRef} autoPlay muted></video>
		</Grid>
	)
}

export default LandingVideo;