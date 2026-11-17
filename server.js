const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, transports: ['websocket','polling'] });
const rooms = new Map();
app.use(express.static(__dirname));
app.get('/', (_req,res)=>res.sendFile(path.join(__dirname,'Cronicas_de_Eldoria_Multiplayer.html')));
app.get('/health', (_req,res)=>res.json({ok:true,service:'eldoria-multiplayer'}));
function roomPeers(room){return [...(rooms.get(room)||[])].map(id=>{const s=io.sockets.sockets.get(id);return s?{peer:id,kind:'viewer',presence:s.data.presence||{}}:null}).filter(Boolean)}
function broadcastPeers(room){io.to(room).emit('room:peers',roomPeers(room));}
io.on('connection', socket=>{
 socket.on('room:join',({room}={},ack=()=>{})=>{
  if(typeof room!=='string'||!/^eld-[a-z0-9]{3,12}$/i.test(room))return ack({ok:false,error:'Código de sala inválido'});
  const current=socket.data.room;if(current&&current!==room)return ack({ok:false,error:'Saia da sala atual primeiro'});
  let set=rooms.get(room);if(!set){set=new Set();rooms.set(room,set)}
  if(!set.has(socket.id)&&set.size>=4)return ack({ok:false,error:'Sala cheia (máximo de 4 jogadores)'});
  set.add(socket.id);socket.data.room=room;socket.join(room);ack({ok:true,peers:roomPeers(room)});broadcastPeers(room);
 });
 socket.on('room:presence',(data,ack=()=>{})=>{const room=socket.data.room;if(!room)return ack();socket.data.presence=data||{};socket.to(room).emit('room:presence',{peer:socket.id,data:socket.data.presence});ack()});
 socket.on('room:event',({type,data}={},ack=()=>{})=>{const room=socket.data.room;if(!room||typeof type!=='string'||type.length>32)return ack();socket.to(room).emit('room:event',{peer:socket.id,type,data});ack()});
 socket.on('room:leave',()=>leave(socket));
 socket.on('disconnect',()=>leave(socket));
});
function leave(socket){const room=socket.data.room;if(!room)return;const set=rooms.get(room);if(set){set.delete(socket.id);socket.to(room).emit('room:left',socket.id);if(!set.size)rooms.delete(room);else broadcastPeers(room)}socket.data.room=null;}
const port=process.env.PORT||3000;server.listen(port,'0.0.0.0',()=>console.log(`Eldoria multiplayer running on ${port}`));
