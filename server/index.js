import {Server} from 'socket.io';

const world = {};
let population = 0;
const sockets = new Map();

const IMPULSE = 10000;
const FRICTION = 1000;
const TIME_STEP = 30;
const TIME_STEP_S = TIME_STEP * 0.001;

const server = new Server();
server.on('connection', socket => {
  world[socket.id] = {x: 100, y: 100, vx: 0, vy: 0, ax_input: 0, ay_input: 0};
  population++;
  sockets.set(socket.id, socket);
  console.log(`${socket.id} connected (total: ${population})`);

  socket.on('message', pressed => {
    if (pressed.up) {
      world[socket.id].ay_input = -IMPULSE;
    }
    if (pressed.down) {
      world[socket.id].ay_input = IMPULSE;
    }
    if (pressed.left) {
      world[socket.id].ax_input = -IMPULSE;
    }
    if (pressed.right) {
      world[socket.id].ax_input = IMPULSE;
    }
  })

  socket.on('disconnect', () => {
    population--;
    delete world[socket.id];
    sockets.delete(socket.id);
    console.log(`${socket.id} disconnected (total: ${population})`)
  });
});
// update loop
setInterval(() => {
  for (const [key, value] of Object.entries(world)) {
    const {x, y, vx, vy, ax_input, ay_input} = value;

    const ax = ax_input + -1 * Math.sign(vx) * FRICTION;
    const ay = ay_input + -1 * Math.sign(vy) * FRICTION;

    world[key] = {
      x: x + (vx * TIME_STEP_S),
      y: y + (vy * TIME_STEP_S),
      vx: vx + (ax * TIME_STEP_S),
      vy: vy + (ay * TIME_STEP_S),
      ax_input: 0,
      ay_input: 0,
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
}, 1000/60);
server.listen(3000);
