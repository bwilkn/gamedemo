// server.js - A simple WebSocket server for a multiplayer 2D game
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const PORT = process.env.PORT || 3000;

// Initialize express app and HTTP server
const app = express();
app.use(cors());
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected players
const players = {};
const MAX_PLAYERS = 16;

// Handle WebSocket connections
wss.on('connection', (socket) => {
  console.log('A player connected');
  let playerId = null;

  // Handle messages from clients
  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          // Check if server is full
          if (Object.keys(players).length >= MAX_PLAYERS) {
            socket.send(JSON.stringify({
              type: 'error',
              message: 'Server is full. Try again later.'
            }));
            return;
          }
          
          // Generate player ID and store player info
          playerId = data.id || Math.random().toString(36).substring(2, 9);
          players[playerId] = {
            id: playerId,
            x: data.x || Math.floor(Math.random() * 700) + 50,
            y: data.y || Math.floor(Math.random() * 500) + 50,
            color: data.color || getRandomColor(),
            name: data.name || `Player ${Object.keys(players).length + 1}`
          };
          
          // Send player ID back to client
          socket.send(JSON.stringify({
            type: 'joined',
            id: playerId,
            player: players[playerId],
            players: players
          }));
          
          // Notify all clients about the new player
          broadcast({
            type: 'player_joined',
            player: players[playerId]
          }, socket);
          
          console.log(`Player ${players[playerId].name} (${playerId}) joined`);
          break;
          
        case 'position':
          // Update player position
          if (playerId && players[playerId]) {
            players[playerId].x = data.x;
            players[playerId].y = data.y;
            
            // Broadcast position update to all other clients
            broadcast({
              type: 'position_update',
              id: playerId,
              x: data.x,
              y: data.y
            }, socket);
          }
          break;
          
        case 'message':
          // Handle chat messages
          if (playerId && players[playerId] && data.text) {
            broadcast({
              type: 'chat_message',
              id: playerId,
              name: players[playerId].name,
              text: data.text
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle disconnection
  socket.on('close', () => {
    if (playerId && players[playerId]) {
      console.log(`Player ${players[playerId].name} (${playerId}) disconnected`);
      
      // Notify all clients about the player leaving
      broadcast({
        type: 'player_left',
        id: playerId
      });
      
      // Remove player from the players list
      delete players[playerId];
    }
  });
  
  // Send current players list to the new client
  socket.send(JSON.stringify({
    type: 'players_list',
    players: players
  }));
});

// Broadcast message to all connected clients
function broadcast(data, exclude = null) {
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Generate a random color
function getRandomColor() {
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Serve a simple homepage
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>16-Bit Multiplayer Game Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .status { padding: 10px; border-radius: 4px; background-color: #f0f0f0; margin-bottom: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto; }
          .tips { background: #e8f4ff; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>16-Bit Multiplayer Game Server</h1>
        <div class="status">
          <p><strong>Server Status:</strong> Running</p>
          <p><strong>Active Players:</strong> ${Object.keys(players).length}/${MAX_PLAYERS}</p>
        </div>
        <h2>Integration Instructions</h2>
        <p>Connect your game client to this WebSocket server at:</p>
        <pre>ws://${req.headers.host}</pre>
        <div class="tips">
          <h3>Tips:</h3>
          <ul>
            <li>Use this server URL in your game's WebSocket connection</li>
            <li>Deploy to Glitch, Heroku, or Render for free hosting</li>
            <li>Check the console logs for connection details</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});