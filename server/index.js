import {Server} from 'socket.io';

const world = {};
let population = 0;
const sockets = new Map();
const platforms = [
  [0, 550, 800, 50],
  [0, 350, 400, 50],
  [400, 150, 400, 50],
];

const HORIZONTAL_ACCELERATION = {grounded: 50000, in_air: 2000};
const JUMP_IMPULSE = -1500;
const FRICTION = 3000;
const g = 5000;
const RESPAWN_HEIGHT = 800;
const SPAWN = {x: 400, y: -100, vx: 0, vy: 0, ax_input: 0, grounded: false};
const MIN_HORIZONTAL_VELOCITY = 50;
const MAX_HORIZONTAL_VELOCITY = 500;
const TIME_STEP = 10;
const TIME_STEP_S = TIME_STEP * 0.001;

const server = new Server();
server.on('connection', socket => {
  world[socket.id] = SPAWN;
  population++;
  sockets.set(socket.id, socket);
  console.log(`${socket.id} connected (total: ${population})`);

  socket.on('message', pressed => {
    if (pressed.up) {
      if (world[socket.id].grounded) {
        world[socket.id].vy += JUMP_IMPULSE;
        world[socket.id].grounded = false;
      }
    }
    if (pressed.down) {
      // world[socket.id].ay_input = IMPULSE;
    }
    if (pressed.left) {
      world[socket.id].ax_input = -1;
    }
    if (pressed.right) {
      world[socket.id].ax_input = 1;
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
    let {x, y, vx, vy, ax_input, grounded} = value;
    let ax = 0, ay = 0;

    if (grounded) {
      ax += ax_input * HORIZONTAL_ACCELERATION.grounded + -1 * Math.sign(vx) * FRICTION;
    } else {
      ax += ax_input * HORIZONTAL_ACCELERATION.in_air;
    }

    ay += g;

    x += vx * TIME_STEP_S;
    y += vy * TIME_STEP_S;

    const platform_level = onPlatform(x, y);
    if (vy >= 0 && platform_level) {
      y = platform_level;
      grounded = true;
    }
    
    if (grounded) {
        if (!platform_level) {
          grounded = false;
        }
        vy = 0;
        ay = 0;
    }

    vx += ax * TIME_STEP_S;
    vx = Math.abs(vx) < MIN_HORIZONTAL_VELOCITY ? 0 : vx;
    vx = Math.abs(vx) > MAX_HORIZONTAL_VELOCITY ? Math.sign(vx) * MAX_HORIZONTAL_VELOCITY : vx;
    vy += ay * TIME_STEP_S;

    if (y >= RESPAWN_HEIGHT) {
      world[key] = SPAWN;
      return;
    }

    world[key] = {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      ax_input: 0,
      grounded: grounded
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

function onPlatform(x, y) {
  for (var i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    if (x >= platform[0] && x <= platform[0] + platform[2] && y >= platform[1] && y <= platform[1] + platform[3]) {
      return platform[1];
    }
  }
  return null;
}