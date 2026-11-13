// Ilustración de respaldo cuando una sede no tiene fotos: un plano de oficina
// dibujado a partir del id de la sede, así cada sede tiene uno distinto y siempre el mismo.

function seeded(seed: string) {
  let h = 2166136261;
  for (const char of seed) {
    h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function FloorPlanArt({ seed, label }: { seed: string; label: string }) {
  const rand = seeded(seed);
  const split = 110 + Math.round(rand() * 60); // dónde termina la zona de salas
  const roomCount = 2 + Math.floor(rand() * 2);
  const roomHeight = 180 / roomCount;
  const deskRows = 2 + Math.floor(rand() * 2);
  const deskCols = 3 + Math.floor(rand() * 2);
  const areaW = 300 - split - 24;
  const plant = { x: split + 20 + rand() * (areaW - 30), y: 20 + rand() * 20 };

  return (
    <svg viewBox="0 0 300 200" className="floorplan" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="200" className="fp-floor" />
      {/* salas cerradas */}
      {Array.from({ length: roomCount }, (_, i) => (
        <g key={`r${i}`}>
          <rect x="10" y={10 + i * roomHeight} width={split - 20} height={roomHeight - 8} rx="2" className="fp-room" />
          <rect x={split * 0.3} y={10 + i * roomHeight + roomHeight * 0.3} width={split * 0.35} height={roomHeight * 0.3} rx="3" className="fp-table" />
          <line x1={split - 10} y1={10 + i * roomHeight + 8} x2={split - 10} y2={10 + i * roomHeight + 24} className="fp-door" />
        </g>
      ))}
      {/* zona abierta con puestos */}
      {Array.from({ length: deskRows * deskCols }, (_, i) => {
        const col = i % deskCols;
        const row = Math.floor(i / deskCols);
        const w = areaW / deskCols - 10;
        return (
          <rect
            key={`d${i}`}
            x={split + 12 + col * (areaW / deskCols)}
            y={70 + row * (110 / deskRows)}
            width={w}
            height={110 / deskRows - 16}
            rx="2"
            className={rand() > 0.72 ? 'fp-desk fp-desk-taken' : 'fp-desk'}
          />
        );
      })}
      <circle cx={plant.x} cy={plant.y} r="9" className="fp-plant" />
      <rect x="4" y="4" width="292" height="192" className="fp-wall" />
    </svg>
  );
}
