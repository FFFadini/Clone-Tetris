// --- CONFIGURAÇÃO CANVAS ---
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(40, 40);

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(40, 40);

// --- ELEMENTOS UI ---
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const shakerElement = document.getElementById('main-shaker');
const popTextElement = document.getElementById('tetris-pop-text');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreElement = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

// Cores Neon
const colors = [
    null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'
];

// Matriz do Jogo
let arena = createMatrix(12, 20);

// Estado do Jogador
const player = {
    pos: {x: 0, y: 0},
    matrix: null,
    next: null, 
    score: 0,
    level: 1,
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
// Variável para controlar o estado do jogo
let isGameOver = false;

// Arrays de Partículas
let particles = [];      
let nextParticles = [];  

// --- CLASSE DE PARTÍCULA (SUAVE) ---
class Particle {
    constructor(x, y, color, speedMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 0.25 * speedMultiplier; 
        this.vy = (Math.random() - 0.5) * 0.25 * speedMultiplier; 
        this.color = color;
        this.alpha = 1; 
        this.decay = Math.random() * 0.01 + 0.005; 
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 3; 
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, 0.15, 0.15); 
        ctx.restore();
    }
}

function spawnLineParticles(yCoord, rowData) {
    for (let x = 0; x < rowData.length; ++x) {
        const colorIndex = rowData[x];
        if (colorIndex !== 0) {
            for (let i = 0; i < 7; i++) {
                particles.push(new Particle(x + 0.5, yCoord + 0.5, colors[colorIndex]));
            }
        }
    }
}

function explodeNextPiece() {
    if (!player.next) return;
    const offsetX = (5 - player.next[0].length) / 2;
    const offsetY = (5 - player.next.length) / 2;
    player.next.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                for (let i = 0; i < 5; i++) {
                    nextParticles.push(new Particle(x + offsetX + 0.5, y + offsetY + 0.5, colors[value], 1.1));
                }
            }
        });
    });
}

// --- FUNÇÕES BÁSICAS ---

function createMatrix(w, h) {
    const matrix = [];
    while (h--) matrix.push(new Array(w).fill(0));
    return matrix;
}

function createPiece(type) {
    if (type === 'I') return [[0, 1, 0, 0],[0, 1, 0, 0],[0, 1, 0, 0],[0, 1, 0, 0],];
    else if (type === 'L') return [[0, 2, 0],[0, 2, 0],[0, 2, 2],];
    else if (type === 'J') return [[0, 3, 0],[0, 3, 0],[3, 3, 0],];
    else if (type === 'O') return [[4, 4],[4, 4],];
    else if (type === 'Z') return [[5, 5, 0],[0, 5, 5],[0, 0, 0],];
    else if (type === 'S') return [[0, 6, 6],[6, 6, 0],[0, 0, 0],];
    else if (type === 'T') return [[0, 7, 0],[7, 7, 7],[0, 0, 0],];
}

function getRandomPiece() {
    const pieces = 'ILJOTSZ';
    return createPiece(pieces[pieces.length * Math.random() | 0]);
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

// --- DESENHO ---

function drawMatrix(ctx, matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.strokeStyle = colors[value];
                ctx.lineWidth = 0.1;
                ctx.shadowBlur = 10; 
                ctx.shadowColor = colors[value];
                ctx.strokeRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);
                ctx.shadowBlur = 0; 
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(context, arena, {x: 0, y: 0});
    drawMatrix(context, player.matrix, player.pos);
    particles.forEach((p, i) => {
        p.update();
        if (p.alpha <= 0) particles.splice(i, 1);
        else p.draw(context);
    });
    drawNext();
}

function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextParticles.forEach((p, i) => {
        p.update();
        if (p.alpha <= 0) nextParticles.splice(i, 1);
        else p.draw(nextContext);
    });
    if (player.next) {
        const offset = {
            x: (5 - player.next[0].length) / 2,
            y: (5 - player.next.length) / 2
        };
        drawMatrix(nextContext, player.next, offset);
    }
}

// --- LÓGICA DO JOGO E GAME OVER ---

// Função chamada quando o jogador perde
function triggerGameOver() {
    isGameOver = true;
    // Mostra o score final na tela de game over
    finalScoreElement.innerText = player.score.toString().padStart(4, '0');
    // Mostra o overlay
    gameOverOverlay.classList.remove('hidden');
}

// Função chamada pelo botão para reiniciar tudo
function resetGame() {
    // Esconde o overlay
    gameOverOverlay.classList.add('hidden');
    
    // Reseta variáveis do jogo
    arena = createMatrix(12, 20);
    player.score = 0;
    player.level = 1;
    player.next = null; // Reseta a próxima peça para gerar novas
    particles = [];
    nextParticles = [];
    dropInterval = 1000;
    isGameOver = false;
    lastTime = 0;
    dropCounter = 0;

    updateScore();
    playerReset(); // Inicia uma nova peça
    update(); // Reinicia o loop do jogo
}

// Adiciona o evento de clique ao botão
restartBtn.addEventListener('click', resetGame);


function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y],matrix[y][x],] = [matrix[y][x],matrix[x][y],];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function arenaSweep() {
    let linesCleared = 0;
    outer: for (let y = arena.length -1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }
        const row = arena.splice(y, 1)[0];
        spawnLineParticles(y, row);
        arena.unshift(row.fill(0));
        ++y;
        linesCleared++;
    }
    if (linesCleared > 0) {
        let scoreToAdd = linesCleared * 100;
        if (linesCleared === 4) {
            scoreToAdd = 800;
            triggerTetrisEffects();
        }
        player.score += scoreToAdd;
        updateScore();
    }
}

function triggerTetrisEffects() {
    shakerElement.classList.add('shake-active');
    setTimeout(() => shakerElement.classList.remove('shake-active'), 500);
    popTextElement.classList.remove('hidden');
    popTextElement.classList.add('show');
    setTimeout(() => {
        popTextElement.classList.remove('show');
        popTextElement.classList.add('hidden');
    }, 1500);
}

function playerReset() {
    if (player.next === null) player.next = getRandomPiece();
    explodeNextPiece();
    player.matrix = player.next;
    player.next = getRandomPiece();
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    // Se colidir assim que nascer, é Game Over
    if (collide(arena, player)) {
        triggerGameOver();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset(); 
        arenaSweep();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    // Impede movimento se o jogo acabou
    if (isGameOver) return;
    player.pos.x += dir;
    if (collide(arena, player)) player.pos.x -= dir;
}

function playerRotate(dir) {
    // Impede rotação se o jogo acabou
    if (isGameOver) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function update(time = 0) {
    // SE O JOGO ACABOU, PARA O LOOP AQUI
    if (isGameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

function updateScore() {
    scoreElement.innerText = player.score.toString().padStart(4, '0');
    player.level = Math.floor(player.score / 800) + 1;
    levelElement.innerText = player.level;
    dropInterval = Math.max(100, 1000 - (player.level * 50)); 
}

document.addEventListener('keydown', event => {
    // Impede controles se o jogo acabou
    if (isGameOver) return; 

    switch (event.key) {
        case 'ArrowLeft': playerMove(-1); break;
        case 'ArrowRight': playerMove(1); break;
        case 'ArrowDown': playerDrop(); break;
        case 'ArrowUp': playerRotate(1); break;
    }
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
    }
});

// INICIALIZAÇÃO
playerReset();
updateScore();
update();