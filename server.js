const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Servir los archivos estáticos (HTML, CSS, JS del cliente) desde la carpeta 'public'
app.use(express.static('public'));

let hostSocketId = null;
let guestSocketId = null;

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    // Un cliente se identifica como Host
    socket.on('host-ready', () => {
        console.log(`Host registrado: ${socket.id}`);
        hostSocketId = socket.id;
        // Si ya hay un guest esperando, le avisamos al host que inicie la llamada
        if (guestSocketId) {
            io.to(hostSocketId).emit('start-call', guestSocketId);
        }
    });

    // Un cliente se identifica como Guest
    socket.on('guest-ready', () => {
        console.log(`Guest registrado: ${socket.id}`);
        guestSocketId = socket.id;
        // Si ya hay un host esperando, le avisamos para que inicie la llamada
        if (hostSocketId) {
            io.to(hostSocketId).emit('start-call', guestSocketId);
        }
    });

    // --- Lógica de Señalización WebRTC ---
    // El servidor solo actúa como un intermediario (relay)

    // Recibe la oferta del host y la reenvía al guest
    socket.on('offer', (data) => {
        const targetSocket = data.target;
        console.log(`Reenviando oferta de ${socket.id} a ${targetSocket}`);
        if (io.sockets.sockets.get(targetSocket)) {
            io.to(targetSocket).emit('offer', { from: socket.id, offer: data.offer });
        }
    });

    // Recibe la respuesta del guest y la reenvía al host
    socket.on('answer', (data) => {
        const targetSocket = data.target;
        console.log(`Reenviando respuesta de ${socket.id} a ${targetSocket}`);
        if (io.sockets.sockets.get(targetSocket)) {
            io.to(targetSocket).emit('answer', { from: socket.id, answer: data.answer });
        }
    });

    // Recibe un candidato ICE y lo reenvía al otro par
    socket.on('ice-candidate', (data) => {
        const targetSocket = data.target;
        // console.log(`Reenviando candidato ICE de ${socket.id} a ${targetSocket}`); // Muy verboso, comentar si no es necesario
        if (io.sockets.sockets.get(targetSocket)) {
            io.to(targetSocket).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
        }
    });

    // Manejo de desconexiones
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        if (socket.id === hostSocketId) {
            console.log('El Host se ha desconectado.');
            hostSocketId = null;
            if (guestSocketId) {
                io.to(guestSocketId).emit('peer-disconnected');
            }
        } else if (socket.id === guestSocketId) {
            console.log('El Guest se ha desconectado.');
            guestSocketId = null;
            if (hostSocketId) {
                io.to(hostSocketId).emit('peer-disconnected');
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});