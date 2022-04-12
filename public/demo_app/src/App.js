import React                          from 'react';
import {Route, Routes } from 'react-router-dom';
import Grid                           from '@mui/material/Grid';

import Landing from './pages/Landing';
import Room from './pages/Room';


//import Room from './Room';

function App() {

//  const [name, setName] = useState ('');
  //const [joined, setJoined] = useState (false);

  /*
  const onJoinRoom = () => {
    setJoined (true);
  }

  if (joined) {
    return (
      <Room name  = {name}/>
    )
  }

  return (
    <div>
      <input onChange={(e) => setName (e.target.value)}/>
      <button onClick={onJoinRoom}>Join Room </button>
    </div>
  );
  */

  return (
    <Grid className = 'root-container'>
        <Routes>
          <Route exact = {true} path='/' element = {<Landing />}/>
          <Route exact = {true} path='/room' element = {<Room />}/>
        </Routes>
    </Grid>
  )
}

export default App;
