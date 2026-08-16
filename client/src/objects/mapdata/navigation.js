import { getColliderConfig } from './maps/colliders';

const DEFAULT_CELL_SIZE = 4;
const MAP_MARGIN = 2;
const ENEMY_CLEARANCE = 1.5;

const getBoundsFromWalls = (walls = []) => {
  let minX = -50;
  let maxX = 50;
  let minZ = -50;
  let maxZ = 50;

  walls.forEach((wall) => {
    const [wallX, , wallZ] = wall.position;
    const [width, , depth] = wall.args;

    if (Math.abs(wallX) > Math.abs(wallZ) && width <= depth) {
      if (wallX < 0) minX = wallX + width / 2 + MAP_MARGIN;
      if (wallX > 0) maxX = wallX - width / 2 - MAP_MARGIN;
    }

    if (Math.abs(wallZ) > Math.abs(wallX) && depth <= width) {
      if (wallZ < 0) minZ = wallZ + depth / 2 + MAP_MARGIN;
      if (wallZ > 0) maxZ = wallZ - depth / 2 - MAP_MARGIN;
    }
  });

  return { minX, maxX, minZ, maxZ };
};

const getColliderRadius = (collider) => {
  if (collider.type === 'ball') return collider.args[0];
  if (collider.type === 'cuboid') return Math.hypot(collider.args[0], collider.args[2]);
  if (collider.type === 'capsule' || collider.type === 'cylinder') return collider.args[1];
  if (collider.type === 'trimesh') return 3;
  return 0;
};

const getInstanceRadius = (instance) => {
  const colliders = getColliderConfig(instance.type);
  if (colliders.length === 0) return 0;

  const usesTrimesh = colliders.some((collider) => collider.type === 'trimesh');
  const horizontalScale = usesTrimesh
    ? Math.max(Math.abs(instance.scale[0]), Math.abs(instance.scale[2]))
    : 1;
  const radius = colliders.reduce((largestRadius, collider) => Math.max(largestRadius, getColliderRadius(collider)), 0);
  return radius * horizontalScale + ENEMY_CLEARANCE;
};

const toIndex = (grid, column, row) => row * grid.columns + column;

const isWithinGrid = (grid, column, row) => (
  column >= 0 && column < grid.columns && row >= 0 && row < grid.rows
);

const getOpenCellNear = (grid, cell) => {
  if (!cell) return null;
  if (!grid.blocked[toIndex(grid, cell.column, cell.row)]) return cell;

  const maxSearchRadius = Math.max(grid.columns, grid.rows);
  for (let radius = 1; radius < maxSearchRadius; radius += 1) {
    for (let row = cell.row - radius; row <= cell.row + radius; row += 1) {
      for (let column = cell.column - radius; column <= cell.column + radius; column += 1) {
        if (!isWithinGrid(grid, column, row)) continue;
        if (Math.max(Math.abs(column - cell.column), Math.abs(row - cell.row)) !== radius) continue;
        if (!grid.blocked[toIndex(grid, column, row)]) return { column, row };
      }
    }
  }

  return null;
};

export const createNavigationGrid = (mapData, cellSize = DEFAULT_CELL_SIZE) => {
  const bounds = getBoundsFromWalls(mapData.walls);
  const columns = Math.floor((bounds.maxX - bounds.minX) / cellSize);
  const rows = Math.floor((bounds.maxZ - bounds.minZ) / cellSize);
  const grid = {
    ...bounds,
    cellSize,
    columns,
    rows,
    blocked: new Uint8Array(columns * rows),
  };

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = bounds.minX + (column + 0.5) * cellSize;
      const z = bounds.minZ + (row + 0.5) * cellSize;
      const blocked = mapData.instances.some((instance) => {
        const radius = getInstanceRadius(instance);
        if (radius === 0) return false;
        return Math.hypot(x - instance.position[0], z - instance.position[2]) <= radius;
      });
      grid.blocked[toIndex(grid, column, row)] = blocked ? 1 : 0;
    }
  }

  return grid;
};

export const getCellForPosition = (grid, position) => {
  const column = Math.min(grid.columns - 1, Math.max(0, Math.floor((position.x - grid.minX) / grid.cellSize)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((position.z - grid.minZ) / grid.cellSize)));
  return { column, row };
};

const getWorldPositionForCell = (grid, cell) => ({
  x: grid.minX + (cell.column + 0.5) * grid.cellSize,
  z: grid.minZ + (cell.row + 0.5) * grid.cellSize,
});

export const createRandomSpawnPositions = (grid, count, height, minimumDistance = 6) => {
  const positions = [];
  const openCells = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      if (!grid.blocked[toIndex(grid, column, row)]) openCells.push({ column, row });
    }
  }

  for (let index = 0; index < count; index += 1) {
    let spawnPosition;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const cell = openCells[Math.floor(Math.random() * openCells.length)];
      const center = getWorldPositionForCell(grid, cell);
      const candidate = [
        center.x + (Math.random() - 0.5) * grid.cellSize * 0.5,
        height,
        center.z + (Math.random() - 0.5) * grid.cellSize * 0.5,
      ];
      const hasSpace = positions.every(([x, , z]) => Math.hypot(candidate[0] - x, candidate[2] - z) >= minimumDistance);

      if (hasSpace) {
        spawnPosition = candidate;
        break;
      }
    }

    if (spawnPosition) positions.push(spawnPosition);
  }

  return positions;
};

const hasLineOfSight = (grid, startPosition, endPosition) => {
  let { column: startColumn, row: startRow } = getCellForPosition(grid, startPosition);
  const { column: endColumn, row: endRow } = getCellForPosition(grid, endPosition);
  const columnStep = startColumn < endColumn ? 1 : -1;
  const rowStep = startRow < endRow ? 1 : -1;
  const columnDistance = Math.abs(endColumn - startColumn);
  const rowDistance = -Math.abs(endRow - startRow);
  let error = columnDistance + rowDistance;

  while (true) {
    if (grid.blocked[toIndex(grid, startColumn, startRow)]) return false;
    if (startColumn === endColumn && startRow === endRow) return true;

    const doubleError = 2 * error;
    if (doubleError >= rowDistance) {
      error += rowDistance;
      startColumn += columnStep;
    }
    if (doubleError <= columnDistance) {
      error += columnDistance;
      startRow += rowStep;
    }
  }
};

export const simplifyPath = (grid, path) => {
  if (path.length <= 2) return path;

  const simplified = [path[0]];
  let startIndex = 0;

  while (startIndex < path.length - 1) {
    let endIndex = path.length - 1;

    while (endIndex > startIndex + 1 && !hasLineOfSight(grid, path[startIndex], path[endIndex])) {
      endIndex -= 1;
    }

    simplified.push(path[endIndex]);
    startIndex = endIndex;
  }

  return simplified;
};

export const findPath = (grid, startPosition, endPosition) => {
  const start = getOpenCellNear(grid, getCellForPosition(grid, startPosition));
  const goal = getOpenCellNear(grid, getCellForPosition(grid, endPosition));
  if (!start || !goal) return [];

  const startIndex = toIndex(grid, start.column, start.row);
  const goalIndex = toIndex(grid, goal.column, goal.row);
  const totalCells = grid.columns * grid.rows;
  const costs = new Float32Array(totalCells).fill(Infinity);
  const previous = new Int32Array(totalCells).fill(-1);
  const open = [startIndex];
  costs[startIndex] = 0;

  while (open.length > 0) {
    let lowestCostIndex = 0;
    let lowestEstimate = Infinity;

    open.forEach((cellIndex, index) => {
      const column = cellIndex % grid.columns;
      const row = Math.floor(cellIndex / grid.columns);
      const estimate = costs[cellIndex] + Math.hypot(goal.column - column, goal.row - row);
      if (estimate < lowestEstimate) {
        lowestEstimate = estimate;
        lowestCostIndex = index;
      }
    });

    const currentIndex = open.splice(lowestCostIndex, 1)[0];
    if (currentIndex === goalIndex) break;

    const column = currentIndex % grid.columns;
    const row = Math.floor(currentIndex / grid.columns);
    const neighbors = [
      { column: column + 1, row },
      { column: column - 1, row },
      { column, row: row + 1 },
      { column, row: row - 1 },
    ];

    neighbors.forEach((neighbor) => {
      if (!isWithinGrid(grid, neighbor.column, neighbor.row)) return;
      const neighborIndex = toIndex(grid, neighbor.column, neighbor.row);
      if (grid.blocked[neighborIndex]) return;

      const tentativeCost = costs[currentIndex] + 1;
      if (tentativeCost >= costs[neighborIndex]) return;

      costs[neighborIndex] = tentativeCost;
      previous[neighborIndex] = currentIndex;
      if (!open.includes(neighborIndex)) open.push(neighborIndex);
    });
  }

  if (startIndex !== goalIndex && previous[goalIndex] === -1) return [];

  const path = [];
  for (let currentIndex = goalIndex; currentIndex !== -1; currentIndex = previous[currentIndex]) {
    const column = currentIndex % grid.columns;
    const row = Math.floor(currentIndex / grid.columns);
    path.unshift(getWorldPositionForCell(grid, { column, row }));
  }

  return path;
};