import { io } from "socket.io-client";

// Single shared socket instance
const URL = import.meta.env.DEV ? "http://localhost:3001" : window.location.origin;

export const socket = io(URL, {
  autoConnect: true,
  // Keep retrying for a long time — mobile browsers can suspend
  // the tab for 30-60s before the socket gets a chance to reconnect.
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,       // start at 1s
  reconnectionDelayMax: 5000,    // cap at 5s (don't back off too far)
  timeout: 20000,
});
