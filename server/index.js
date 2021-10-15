import {Server} from 'socket.io';

const world = {};
let population = 0;
const sockets = new Map();

const IMPULSE = 1;
const FRICTION = 10;
const TIME_STEP = 10;

const server = new Server();
server.on('connection', socket => {
  world[socket.id] = {x: 100, y: 100, vx: 0, vy: 0, ax: 0, ay: 0};
  population++;
  sockets.set(socket.id, socket);
  console.log(`${socket.id} connected (total: ${population})`);

  socket.on('message', pressed => {
    if (pressed.up) {
      world[socket.id].ay = -IMPULSE;
    }
    if (pressed.down) {
      world[socket.id].ay = IMPULSE;
    }
    if (pressed.left) {
      world[socket.id].ax = -IMPULSE;
    }
    if (pressed.right) {
      world[socket.id].ax = IMPULSE;
    }
  })

  socket.on('disconnect', () => {
    population--;
    sockets.delete(socket.id);
    console.log(`${socket.id} disconnected (total: ${population})`)
  });
});
// update loop
setInterval(() => {
  for (const [key, value] of Object.entries(world)) {
    const {x, y, vx, vy, ax, ay} = value;
    world[key] = {
      x: x + vx,
      y: y + vy,
      vx: vx + ax,
      vy: vy + ay,
      ax: ax - FRICTION > 0 ? ax - FRICTION : 0,
      ay: ay - FRICTION > 0 ? ay - FRICTION : 0,
    }
  }
}, TIME_STEP);
// broadcast loop
setInterval(() => {
  if (sockets.size) {
    const data = JSON.stringify({
      tick: Date.now(),
      world,
    });
    sockets.forEach(socket => socket.send(data));
  }
}, 100);
server.listen(3000);
