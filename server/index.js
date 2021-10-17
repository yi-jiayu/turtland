import {Server} from 'socket.io';
import fs from 'fs';
import bmp from 'bmp-js';

const world = {};
let population = 0;
const sockets = new Map();

const {terrain, background_width, background_height} = loadMapFromFile('map.bmp');
generateTerrainLog(terrain);

const HORIZONTAL_ACCELERATION = {grounded: 50000, in_air: 2000};
const JUMP_IMPULSE = -1500;
const FRICTION = 5000;
const g = 5000;
const RESPAWN_HEIGHT = 800;
const SPAWN = {direction: 1, x: 400, y: -100, vx: 0, vy: 0, ax_input: 0, grounded: false};
const MIN_HORIZONTAL_VELOCITY = 50;
const MAX_HORIZONTAL_VELOCITY = 500;
const TERIMAL_VELOCITY = 1500;
const TIME_STEP_MS = 10;
const TIME_STEP_S = TIME_STEP_MS * 0.001;

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
    /*
    1) Calculate accelerations from sum of accelerations (forces assuming unit mass).
      a) If the object is in contact with the ground, it experiences a normal force which counteracts gravity, i.e. vertical
      acceleration is 0. In addition, the normal force causes friction to be felt only when grounded.
      If object is not in contact with ground, it does not experience friction and has a different value of horizontal
      acceleration. 
    2) Calculate new position by integrating velocity wrt. time.
      a) Check if position has fallen out of the map. If so, set everything back to spawn and return from function.
      b) Check if position collides with terrain. If so, snap to outside of terrain and reset velocity and acceleration
      to prevent it from entering the terrain in the next loop.
    3) Calculate new velocites from acceleration.
      a) Set horizontal velocity to zero if below the minimum value to prevent drifting.
      b) Set horizontal velocity to limit if above the maximum value to prevent runaway acceleration.
      c) Set vertical velocity to terminal velocity if above the maximum value to prevent runaway acceleration.
    4) Update object properties and reset input to none.
    */

    let {direction, x, y, vx, vy, ax_input, grounded} = value;
    let ax = 0, ay = 0;

    direction = Math.sign(ax_input) == 0 ? direction : Math.sign(ax_input);

    if (grounded) {
      ax += ax_input * HORIZONTAL_ACCELERATION.grounded + -1 * Math.sign(vx) * FRICTION;
      ay += 0;
    } else {
      ax += ax_input * HORIZONTAL_ACCELERATION.in_air;
      ay += g;
    }


    x += vx * TIME_STEP_S;
    y += vy * TIME_STEP_S;

    if (y >= RESPAWN_HEIGHT) {
      world[key] = SPAWN;
      return;
    }

    const [isInPlatform, platform_level] = terrainCheck(x, y);
    if (vy >= 0 && isInPlatform) {
      y = platform_level;
      grounded = true;
    }
    
    if (grounded) {
        if (!isInPlatform) {
          grounded = false;
        }
        vy = 0;
    }

    vx += ax * TIME_STEP_S;
    vx = Math.abs(vx) < MIN_HORIZONTAL_VELOCITY ? 0 : vx;
    vx = Math.abs(vx) > MAX_HORIZONTAL_VELOCITY ? Math.sign(vx) * MAX_HORIZONTAL_VELOCITY : vx;
    vy += ay * TIME_STEP_S;
    vy = vy > TERIMAL_VELOCITY ? TERIMAL_VELOCITY : vy;

    world[key] = {
      direction: direction,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      ax_input: 0,
      grounded: grounded
    }
  }
}, TIME_STEP_MS);
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

function pixelIsTerrain(a, r, g, b) {
  if (a < 50) {
    return false;
  } else {
    if (Math.max(r, g, b) < 50) {
      return true;
    } else {
      return false;
    }
  }
}

function loadMapFromFile(filepath) {
  const bmpBuffer = fs.readFileSync(filepath);
  const bmpData = bmp.decode(bmpBuffer);

  const background_width = bmpData['width'], background_height = bmpData['height'];

  const terrain = Array(background_height).fill().map(()=>Array(background_width).fill());
  for (var i = 0; i < background_width*background_height; i++) {
    if (pixelIsTerrain(bmpData['data'][(i*4)], bmpData['data'][(i*4)+1], bmpData['data'][(i*4)+2], bmpData['data'][(i*4)+3])) {
      terrain[Math.floor(i/background_width)][i%background_width] = true;
    } else {
      terrain[Math.floor(i/background_width)][i%background_width] = false;
    }
  }

  return {
    terrain: terrain,
    background_width: background_width,
    background_height: background_height,
  };
}

function generateTerrainLog(terrain) {
  let terrain_log = "";
  for (var i = 0; i < terrain.length; i++) {
    const row = terrain[i];
    for (var j = 0; j < row.length; j++) {
      if (terrain[i][j]) {
        terrain_log += 'x';
      } else {
        terrain_log += ' ';
      }
    }
    if (i == terrain.length -1) {
      break
    }
    terrain_log += '\n';
  }
  fs.writeFile('log.txt', terrain_log, function (err) {
    if (err) return console.log(err);
  });
}

function terrainCheck(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (y < 0 || y >= background_height || x < 0 || x >= background_width) {
    return [false, 0];
  }
  
  if (terrain[y][x]) {
    let ground_level = y - 1;
    while (terrain[ground_level][x]) {
      ground_level -= 1;
      if (ground_level == 0) {
        return [true, -1];
      }
    }
    return [true, ground_level + 1];
  }
  return [false, 0];
}