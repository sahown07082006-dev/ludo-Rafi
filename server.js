const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();

// একই ফোল্ডারের index.html, script.js, style.css সরাসরি সার্ভ হবে
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];
let hostSocket = null;

wss.on('connection', (ws) => {
  clients.push(ws);

  if (!hostSocket) {
    hostSocket = ws;
    ws.send(JSON.stringify({ type: 'role', role: 'host' }));
    console.log('Host কানেক্ট করলো');
  } else {
    ws.send(JSON.stringify({ type: 'role', role: 'client' }));
    if (hostSocket.readyState === WebSocket.OPEN) {
      hostSocket.send(JSON.stringify({ type: 'player_joined' }));
    }
    console.log('দ্বিতীয় প্লেয়ার কানেক্ট করলো');
  }

  ws.on('message', (msg) => {
    // যা পাঠানো হয়েছে, বাকি সবাইকে ফরওয়ার্ড করে দাও
    clients.forEach((c) => {
      if (c !== ws && c.readyState === WebSocket.OPEN) {
        c.send(msg);
      }
    });
  });

  ws.on('close', () => {
    clients = clients.filter((c) => c !== ws);
    if (ws === hostSocket) {
      hostSocket = clients[0] || null;
    }
    console.log('একজন সংযোগ বিচ্ছিন্ন হলো');
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`সার্ভার চলছে — ব্রাউজারে খোলো: http://<তোমার-IP>:${PORT}`);
});