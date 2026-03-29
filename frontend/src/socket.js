import { io } from "socket.io-client";

// Single shared socket instance
export const socket = io("http://localhost:3001", {
  autoConnect: true,
});
