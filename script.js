(() => {
  const GRID_SIZE = 12;
  const DISPLAY_WORDS = [
    "HONESTIDAD",
    "HUMILDAD",
    "PACIENCIA",
    "LEALTAD",
    "RESPETO",
    "SINCERIDAD",
    "COMPROMISO",
    "OBEDIENCIA",
    "EMPATIA",
    "FIDELIDAD"
  ];
  const SECRET_MESSAGE = "ROWZWFNS";

  // === CUADRÍCULA PREDEFINIDA 12x12 (pon aquí tus 12 filas exactas) ===
  // MAYÚSCULAS, sin tildes, 12 letras por fila, 12 filas.
  // Reemplaza las X por tus letras si quieres usar una cuadrícula fija.
 let GRID_PRESET = [    
    "HRESPETOERCO",
    "UAQPUEMOUUSB",
    "MIHQASBPGIEE",
    "ISDOHCAOMNVD",
    "LOLFNIIOROSI",
    "DDWETEREXVGE",
    "AEKAAPSVNARN",
    "DEPBMLITOCKC",
    "SMROYATYIEII",
    "EPCPAPEAADEA",
    "FIDELIDADVAK", 
    "ASINCERIDADD"     
   ];


  // ==== Utilidades ====
  const normalize = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  const WORDS = DISPLAY_WORDS.map(w => ({ display: w, plain: normalize(w) }));
  const TOTAL = WORDS.length;

  // ==== Estado ====
  let grid = [];            // matriz 12x12 de letras
  let cells = [];           // nodos DOM de celdas
  let found = new Set();    // palabras encontradas (sin tildes)
  let selected = new Set(); // índices lineales de celdas seleccionadas (y*12+x)

  // ==== DOM ====
  const gridEl = document.getElementById('grid');
  const listEl = document.getElementById('wordlist');   // ahora muestra solo correctas
  const progressEl = document.getElementById('progress');
  const modal = document.getElementById('winModal');
  const closeModal = document.getElementById('closeModal');
  const toastEl = document.getElementById('toast');
  const loadPresetBtn = document.getElementById('loadPresetBtn');
  const regenBtn = document.getElementById('regenBtn');
  const validateBtn = document.getElementById('validateBtn');
  const clearBtn = document.getElementById('clearBtn');

  // ==== Eventos ====
  if (loadPresetBtn) loadPresetBtn.addEventListener('click', onLoadPresetClick);
  if (regenBtn) regenBtn.addEventListener('click', buildFromPreset);
  if (validateBtn) validateBtn.addEventListener('click', validateSelection);
  if (clearBtn) clearBtn.addEventListener('click', clearSelection);
  if (closeModal) closeModal.addEventListener('click', ()=> modal.classList.remove('show'));
  if (modal) modal.addEventListener('click', e=>{ if (e.target===modal) modal.classList.remove('show'); });

  // ==== Toast ====
  function showToast(msg, ms=1400){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), ms);
  }

  // ==== Lista lateral (revelada dinámicamente) ====
  function clearList(){
    if (listEl) listEl.innerHTML = ""; // inicia vacía
  }
  function revealWord(display, plain){
    if ([...listEl.children].some(el => el.dataset.word === plain)) return;
    const item = document.createElement('div');
    item.className = 'word found';   // ya entra como encontrada
    item.dataset.word = plain;
    item.textContent = display;
    listEl.appendChild(item);
  }
  function updateProgress(){
    if (progressEl) progressEl.textContent = `${found.size} / ${TOTAL} encontradas`;
  }

  // ==== Construcción desde preset ====
  function buildFromPreset(){
    // Validación del preset 12x12
    if (!Array.isArray(GRID_PRESET) || GRID_PRESET.length !== GRID_SIZE ||
        GRID_PRESET.some(r => typeof r !== 'string' || r.length !== GRID_SIZE || /[^A-Z]/.test(r))) {
      showToast('Preset inválido: 12 líneas, 12 letras A–Z por línea.');
      return;
    }
    // Reset estado
    found.clear();
    selected.clear();
    clearList();
    updateProgress();

    // Cargar en grid
    grid = GRID_PRESET.map(row => row.split(''));
    renderGrid();
    showToast('Cuadrícula cargada.');
  }

  // Cargar preset pegándolo en un prompt
  function onLoadPresetClick(){
    const example = GRID_PRESET.join("\n");
    const txt = prompt(
      "Pega tus 12 filas (12 letras por línea, solo A–Z, sin tildes):",
      example
    );
    if (!txt) return;
    const rows = txt.split(/\r?\n/).map(r => normalize(r.trim()));
    if (rows.length !== GRID_SIZE || rows.some(r => r.length !== GRID_SIZE || /[^A-Z]/.test(r))) {
      showToast("Debe haber 12 líneas, 12 letras A–Z cada una (sin tildes).");
      return;
    }
    GRID_PRESET = rows;
    buildFromPreset();
  }

  // ==== Render del tablero ====
  function renderGrid(){
    gridEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    gridEl.innerHTML = '';
    cells = [];
    for (let y=0;y<GRID_SIZE;y++){
      for (let x=0;x<GRID_SIZE;x++){
        const d = document.createElement('div');
        d.className = 'cell';
        d.textContent = grid[y][x];
        const idx = y*GRID_SIZE + x;
        d.dataset.idx = idx;
        d.addEventListener('click', () => toggleSelect(idx, d));
        gridEl.appendChild(d);
        cells.push(d);
      }
    }
  }

  // ==== Selección manual (toggle) ====
  function toggleSelect(idx, el){
    if (selected.has(idx)) {
      selected.delete(idx);
      el.classList.remove('selected');
    } else {
      selected.add(idx);
      el.classList.add('selected');
    }
  }

  function clearSelection(){
    selected.forEach(i => cells[i].classList.remove('selected'));
    selected.clear();
  }

  // ==== Validación robusta (H, V, diagonales 45°) ====
  function validateSelection(){
    if (selected.size < 2) {
      showToast('Selecciona al menos 2 letras contiguas');
      clearSelection();
      return;
    }

    const pts = [...selected].map(idx => ({
      idx,
      x: idx % GRID_SIZE,
      y: Math.floor(idx / GRID_SIZE)
    }));

    // 1) Línea válida + dirección
    const lineInfo = getLineInfo(pts);
    if (!lineInfo) {
      showToast('La selección no es una línea recta');
      clearSelection();
      return;
    }
    const { dx, dy, start, end } = lineInfo;

    // 2) Camino completo entre extremos
    const path = buildPath(start, end, dx, dy);

    // 3) ¿Todas las celdas intermedias están seleccionadas o ya eran found?
    const setSel = new Set(selected);
    const allIncluded = path.every(p => setSel.has(p.idx) || cells[p.idx].classList.contains('found'));
    if (!allIncluded) {
      showToast('Faltan letras intermedias o no son contiguas');
      clearSelection();
      return;
    }

    // 4) Texto en orden (start → end)
    const letters = path.map(p => grid[p.y][p.x]).join('');
    const reversed = [...letters].reverse().join('');
    const hit = WORDS.find(w => w.plain === letters || w.plain === reversed);
    if (!hit) {
      showToast('La selección no coincide con una palabra objetivo');
      clearSelection();
      return;
    }
    if (found.has(hit.plain)) {
      showToast('Esa palabra ya fue encontrada');
      clearSelection();
      return;
    }

    // 5) Marcar encontrada (tablero + revelar en lista)
    found.add(hit.plain);
    path.forEach(p => cells[p.idx].classList.add('found'));
    revealWord(hit.display, hit.plain);
    clearSelection();
    updateProgress();

    if (found.size === TOTAL) {
      document.getElementById('secret').textContent = SECRET_MESSAGE;
      modal.classList.add('show');
    } else {
      showToast(`¡Bien! Encontraste: ${hit.display}`);
    }
  }

  // Devuelve {dx,dy,start,end} si todos los puntos están en una misma línea
  // horizontal (y constante), vertical (x constante) o diagonal 45° (x−y o x+y constante)
  function getLineInfo(points){
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    for (const p of points){
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Horizontal
    const sameY = points.every(p => p.y === points[0].y);
    if (sameY){
      const y = points[0].y;
      const start = { x: minX, y, idx: y*GRID_SIZE + minX };
      const end   = { x: maxX, y, idx: y*GRID_SIZE + maxX };
      const dx = Math.sign(maxX - minX), dy = 0;
      return { dx, dy, start, end };
    }

    // Vertical
    const sameX = points.every(p => p.x === points[0].x);
    if (sameX){
      const x = points[0].x;
      const start = { x, y: minY, idx: minY*GRID_SIZE + x };
      const end   = { x, y: maxY, idx: maxY*GRID_SIZE + x };
      const dx = 0, dy = Math.sign(maxY - minY);
      return { dx, dy, start, end };
    }

    // Diagonales 45°
    const d1 = points.map(p => p.x - p.y); // pendiente +1 (x - y constante)
    const d2 = points.map(p => p.x + p.y); // pendiente -1 (x + y constante)
    const allSameD1 = d1.every(v => v === d1[0]);
    const allSameD2 = d2.every(v => v === d2[0]);

    if (!allSameD1 && !allSameD2) return null;

    if (allSameD1){
      const k = d1[0];
      const start = { x: minX, y: minX - k, idx: (minX - k) * GRID_SIZE + minX };
      const end   = { x: maxX, y: maxX - k, idx: (maxX - k) * GRID_SIZE + maxX };
      if (Math.abs(end.x - start.x) !== Math.abs(end.y - start.y)) return null;
      const dx = Math.sign(end.x - start.x);
      const dy = Math.sign(end.y - start.y);
      return { dx, dy, start, end };
    }

    if (allSameD2){
      const k = d2[0];
      const start = { x: minX, y: k - minX, idx: (k - minX) * GRID_SIZE + minX };
      const end   = { x: maxX, y: k - maxX, idx: (k - maxX) * GRID_SIZE + maxX };
      if (Math.abs(end.x - start.x) !== Math.abs(end.y - start.y)) return null;
      const dx = Math.sign(end.x - start.x);
      const dy = Math.sign(end.y - start.y);
      return { dx, dy, start, end };
    }

    return null;
  }

  // Devuelve todas las celdas (idx,x,y) desde start a end moviendo (dx,dy)
  function buildPath(start, end, dx, dy){
    const path = [];
    let x = start.x, y = start.y;
    while (true){
      path.push({ x, y, idx: y*GRID_SIZE + x });
      if (x === end.x && y === end.y) break;
      x += dx; y += dy;
    }
    return path;
  }

  // ==== Arranque ====
  buildFromPreset();
})();
