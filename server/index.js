import {Server} from 'socket.io';

const world = {};
let population = 0;
const sockets = new Map();

const IMPULSE = 15000;
const JUMP_IMPULSE = -1000;
const FRICTION = 1500;
const g = 5000;
const GROUND_LEVEL = 600
const TIME_STEP = 10;
const TIME_STEP_S = TIME_STEP * 0.001;

const server = new Server();
server.on('connection', socket => {
  world[socket.id] = {x: 400, y: -100, vx: 0, vy: 0, ax_input: 0};
  population++;
  sockets.set(socket.id, socket);
  console.log(`${socket.id} connected (total: ${population})`);

  socket.on('message', pressed => {
    if (pressed.up) {
      if (isOnGround(socket.id)) {
        world[socket.id].vy += JUMP_IMPULSE;
      }
    }
    if (pressed.down) {
      // world[socket.id].ay_input = IMPULSE;
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
    let {x, y, vx, vy, ax_input} = value;
    let ax = 0, ay = 0;

    ax += ax_input;
    if (isOnGround) {
      ax += -1 * Math.sign(vx) * FRICTION;
    }
    ay += g;

    x += vx * TIME_STEP_S;
    y += vy * TIME_STEP_S;
    if (y >= GROUND_LEVEL) {
      y = GROUND_LEVEL;
      vy = 0;
      ay = 0;
    }
    vx += ax * TIME_STEP_S;
    vy += ay * TIME_STEP_S;

    world[key] = {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      ax_input: 0,
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

function isOnGround(id) {
  if (world[id].y == GROUND_LEVEL) {
    return true;
  }
  return false;
}