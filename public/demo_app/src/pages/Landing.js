import React from 'react';
import { useNavigate } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import LandingVideo from '../components/molecules/LandingVideo';

function Landing () {

	const navigate = useNavigate();

	const onJoin  = () => {
		navigate('/room');
	}

	return (
		<Grid container alignItems = 'center' justifyContent = 'center' style = {{height : '100%'}}>
			<Grid item md = {6} container justifyContent='center'>
				<LandingVideo />
			</Grid>
			<Grid item md = {4} container justifyContent = 'center'>
				<Button variant = 'contained' color = 'primary' onClick = {onJoin}> Join Now </Button>
			</Grid>
		</Grid>
	)
}

export default Landing;