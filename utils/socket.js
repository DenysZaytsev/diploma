// utils/socket.js
const { Server } = require('socket.io');

let io;
const userSockets = new Map();

const init = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust in production
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        socket.on('register', (userId) => {
            if (userId) {
                userSockets.set(userId.toString(), socket.id);
                console.log(`User connected: ${userId} (Socket: ${socket.id})`);
            }
        });

        socket.on('disconnect', () => {
            for (const [userId, socketId] of userSockets.entries()) {
                if (socketId === socket.id) {
                    userSockets.delete(userId);
                    console.log(`User disconnected: ${userId}`);
                    break;
                }
            }
        });
    });

    return io;
};

const close = () => {
    if (io) {
        io.close();
        io = null;
        userSockets.clear();
    }
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

const sendToUser = (userId, event, data) => {
    const socketId = userSockets.get(userId.toString());
    if (io && socketId) {
        io.to(socketId).emit(event, data);
        return true;
    }
    return false;
};

module.exports = { init, getIO, sendToUser, close };
