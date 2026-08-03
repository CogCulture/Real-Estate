import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useProgressStore } from '../store/progress';

export const useWebSocket = () => {
  const setEvent = useProgressStore(state => state.setEvent);

  useEffect(() => {
    const socket = io();
    
    socket.on('progress', (event) => {
      setEvent(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [setEvent]);
};
