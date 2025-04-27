// --- Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 400;
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;
console.log("Canvas Setup:", canvas.width, "x", canvas.height);

// --- Game Variables ---
let score = 0, highscore = 0, gameSpeed = 8;
let isGameOver = false, isGameStarted = false;
let player = null;
let obstacles = [], clouds = [];
let groundX1 = 0, groundX2 = 0, groundDrawY = 0;

// --- Constants ---
const GRAVITY = 0.8;
const DINO_INITIAL_X = 50;
const SPRITE_STAND_Y = SCREEN_HEIGHT - 35; // Visual ground line for sprites
const DINO_ANIM_SPEED = 8;
const OBSTACLE_SPAWN_DELAY_MIN = 700, OBSTACLE_SPAWN_DELAY_MAX = 1800;
let obstacleSpawnDelay = OBSTACLE_SPAWN_DELAY_MAX;
let obstacleTimer = 0;
const CLOUD_SPAWN_DELAY = 5000;
let cloudTimer = 0;
const DINO_SCALE_FACTOR = 1.8; // Keep scaling factor
const OBSTACLE_DINO_HEIGHT_RATIO = 0.70;

// --- Image Loading ---
const images = {}; // Holds ORIGINAL Image objects
let imagesLoaded = 0, totalImages = 0;
let imageLoadPromises = []; // Store promises
const imageSources = {
    dinoRun1: 'dino_run1.png',
    dinoRun2: 'dino_run2.png',
    dinoJump: 'dino_jump.png',
    cactusSmall: 'cactus_small.png',
    cactusBig: 'cactus_big.png',
    ground: 'ground.png',
    cloud: 'cloud.png' // Optional
};

function loadImage(key, src) {
    const promise = new Promise((resolve, reject) => {
        totalImages++;
        const img = new Image();
        // Store immediately for reference, even before loading
        images[key] = img;
        img.onload = () => {
            imagesLoaded++;
            // Extra check for valid dimensions after load
            if (img.naturalHeight === 0 || img.naturalWidth === 0) {
                 console.error(`!!! Image '${key}' loaded but has zero dimensions. File corrupted? Path: ${src}`);
                 reject(new Error(`Image ${key} loaded with zero dimensions.`));
            } else {
                console.log(`${key} loaded (${imagesLoaded}/${totalImages}) from ${src} [${img.naturalWidth}x${img.naturalHeight}]`);
                resolve(img);
            }
        };
        img.onerror = (err) => {
             console.error(`!!! Error loading image: Key='${key}', Source='${src}' !!!`);
             console.error("   Check: 1) File in same folder as index.html? 2) Filename EXACTLY correct (case-sensitive)? 3) Valid image file?");
             reject(new Error(`Failed to load image: ${src}`));
        };
        img.src = src;
    });
    imageLoadPromises.push(promise); // Add promise to the list
    return promise; // Return promise for individual await if needed
}


// --- Global variables for scaled dimensions (calculated after load) ---
let dinoScaledWidth = 0;
let dinoScaledHeight = 0;
let obstacleTargetHeight = 0; // Calculated based on scaled dino

// --- Classes (Using Draw-Time Scaling) ---

class Dino {
    constructor() {
        // Assign ORIGINAL images
        this.runImages = [images.dinoRun1, images.dinoRun2];
        this.jumpImage = images.dinoJump;
        this.currentImageIndex = 0;
        this.currentImage = this.runImages[this.currentImageIndex]; // Current ORIGINAL image

        // Use PRE-CALCULATED scaled dimensions
        this.scaledWidth = dinoScaledWidth;
        this.scaledHeight = dinoScaledHeight;

        if (this.scaledWidth <= 0 || this.scaledHeight <= 0) {
            console.error("Dino created with invalid scaled dimensions!", this.scaledWidth, this.scaledHeight);
            // Fallback to original size? Or handle error
            this.scaledWidth = this.currentImage.naturalWidth || 50; // Fallback size
            this.scaledHeight = this.currentImage.naturalHeight || 50;
        }

        this.x = DINO_INITIAL_X;
        this.y = SPRITE_STAND_Y - this.scaledHeight; // Position using scaled height

        this.velocityY = 0;
        this.jumpStrength = -17; // Keep adjusted jump strength
        this.isRunning = true; this.isJumping = false; this.runAnimTimer = 0;
        console.log(`  [Dino __init__] Scaled size: ${this.scaledWidth}x${this.scaledHeight}. Pos: (${this.x}, ${this.y})`);
    }

    jump() {
        if (!this.isJumping && this.y >= SPRITE_STAND_Y - this.scaledHeight - 5) {
            this.velocityY = this.jumpStrength; this.isJumping = true; this.isRunning = false;
        }
    }

    update(dt) {
        if (this.isJumping || this.y < SPRITE_STAND_Y - this.scaledHeight) { this.velocityY += GRAVITY; }
        this.y += this.velocityY;
        if (this.y >= SPRITE_STAND_Y - this.scaledHeight) {
            this.y = SPRITE_STAND_Y - this.scaledHeight;
            if (this.isJumping) { this.isJumping = false; this.isRunning = true; }
            this.velocityY = 0;
        }
        // Animation - select the correct *original* image
        if (this.isJumping) { this.currentImage = this.jumpImage; }
        else if (this.isRunning) {
            this.runAnimTimer++;
            if (this.runAnimTimer >= DINO_ANIM_SPEED) {
                this.runAnimTimer = 0;
                this.currentImageIndex = (this.currentImageIndex + 1) % this.runImages.length;
                this.currentImage = this.runImages[this.currentImageIndex];
            }
        } else { this.currentImage = this.runImages[this.currentImageIndex]; }
    }

    draw(ctx) {
        // Draw the current *original* image, but specify the *scaled* dimensions
        if (this.currentImage && this.currentImage.complete && this.currentImage.naturalHeight > 0) {
             ctx.drawImage(this.currentImage, this.x, this.y, this.scaledWidth, this.scaledHeight);
        } else {
            // Draw fallback rectangle if image is invalid
            ctx.fillStyle = 'magenta'; // Indicate error
            ctx.fillRect(this.x, this.y, 50, 50); // Draw a placeholder
            // console.warn("Attempted to draw invalid Dino image");
        }
    }

    getRect() { return { x: this.x, y: this.y, width: this.scaledWidth, height: this.scaledHeight }; }
}

class Obstacle {
    // Expects ORIGINAL image and TARGET height for scaling
    constructor(originalImage, targetHeight) {
        this.image = originalImage; // Store ORIGINAL image

        // Calculate scaled dimensions based on target height
        const origW = this.image.naturalWidth || this.image.width;
        const origH = this.image.naturalHeight || this.image.height;
        this.scaledHeight = Math.round(targetHeight);
        this.scaledWidth = 0; // Default

        if (origH > 0 && this.scaledHeight > 0) {
             const aspectRatio = origW / origH;
             this.scaledWidth = Math.round(this.scaledHeight * aspectRatio);
        } else {
             console.warn("Could not calculate obstacle scaled width due to zero height.");
             // Use default fallback size?
             this.scaledWidth = Math.round(targetHeight); // Guess square if aspect fails
             this.scaledHeight = Math.round(targetHeight);
        }
         if (this.scaledWidth <= 0 ) this.scaledWidth = 30; // Absolute minimum fallback width
         if (this.scaledHeight <= 0 ) this.scaledHeight = 30; // Absolute minimum fallback height


        this.x = SCREEN_WIDTH;
        this.y = SPRITE_STAND_Y - this.scaledHeight; // Position based on scaled height
        // console.log(`  [Obstacle __init__] TargetH: ${targetHeight.toFixed(1)}, Scaled: ${this.scaledWidth}x${this.scaledHeight}, Pos: (${this.x}, ${this.y})`);
    }

    update(dt, currentSpeed) { this.x -= currentSpeed; }

    draw(ctx) {
         // Draw the *original* image, but at the *scaled* size
         if (this.image && this.image.complete && this.image.naturalHeight > 0) {
            ctx.drawImage(this.image, this.x, this.y, this.scaledWidth, this.scaledHeight);
         } else {
             ctx.fillStyle = 'cyan'; // Indicate error
             ctx.fillRect(this.x, this.y, 30, 30); // Placeholder
            //  console.warn("Attempted to draw invalid Obstacle image");
         }
    }
    getRect() { return { x: this.x, y: this.y, width: this.scaledWidth, height: this.scaledHeight }; }
}

class Cloud { /* ... (keep Cloud class as before) ... */
    constructor() {
        if (!images.cloud || !images.cloud.complete || images.cloud.naturalHeight === 0) { this.valid = false; this.image = null; return; }
        this.image=images.cloud; this.width=this.image.width; this.height=this.image.height; this.valid=true;
        this.x=SCREEN_WIDTH+Math.random()*SCREEN_WIDTH; this.y=Math.random()*(SCREEN_HEIGHT/3-20)+20; this.speedFactor=Math.random()*0.3+0.2;
    }
    update(dt, currentSpeed) { if (!this.valid) return; this.x -= currentSpeed * this.speedFactor; if (this.x + this.width < 0) { this.x = SCREEN_WIDTH + Math.random() * 100; this.y = Math.random() * (SCREEN_HEIGHT / 3 - 20) + 20; this.speedFactor = Math.random() * 0.3 + 0.2; } }
    draw(ctx) { if (this.valid && this.image) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); } }
}

// --- Game Functions ---
function resetGame() {
    console.log("Resetting game..."); score = 0; gameSpeed = 8; isGameOver = false; isGameStarted = true;
    obstacles = []; clouds = []; obstacleTimer = 0; cloudTimer = 0; obstacleSpawnDelay = OBSTACLE_SPAWN_DELAY_MAX;

    // *** Ensure scaled dimensions are calculated before creating player ***
    if (dinoScaledHeight <= 0 || dinoScaledWidth <= 0) {
         console.error("Cannot reset game, dino scaled dimensions not calculated correctly!");
         // Maybe try recalculating here as a fallback?
         if (images.dinoRun1 && images.dinoRun1.complete && images.dinoRun1.naturalHeight > 0) {
             const origH = images.dinoRun1.naturalHeight; const origW = images.dinoRun1.naturalWidth;
             dinoScaledWidth = Math.round(origW * DINO_SCALE_FACTOR); dinoScaledHeight = Math.round(origH * DINO_SCALE_FACTOR);
             obstacleTargetHeight = dinoScaledHeight * OBSTACLE_DINO_HEIGHT_RATIO;
             console.log("Fallback calculation in resetGame:", dinoScaledWidth, dinoScaledHeight, obstacleTargetHeight);
             if (dinoScaledHeight <= 0 || dinoScaledWidth <= 0) { // Still failed? Abort.
                  showFatalError("Failed to calculate dino dimensions."); return;
             }
         } else { showFatalError("Cannot create player, base dino image invalid."); return; } // Abort if base image is bad
    }
    player = new Dino(); // Uses pre-calculated global scaled dimensions

    if (images.cloud && images.cloud.complete && images.cloud.naturalHeight > 0) { for (let i = 0; i < 3; i++) { clouds.push(new Cloud()); } }
    console.log("Reset complete.");
}

function spawnObstacle() {
    const imgKey = Math.random() < 0.5 ? 'cactusSmall' : 'cactusBig';
    const chosenOrigImage = images[imgKey];

    if (chosenOrigImage && chosenOrigImage.complete && chosenOrigImage.naturalHeight > 0 && obstacleTargetHeight > 0) {
         // Pass ORIGINAL image and TARGET HEIGHT
         obstacles.push(new Obstacle(chosenOrigImage, obstacleTargetHeight));
         const reduction = Math.floor(score / 10) * 50; obstacleSpawnDelay = Math.max(OBSTACLE_SPAWN_DELAY_MIN, OBSTACLE_SPAWN_DELAY_MAX - reduction);
    } else {
        console.warn(`Cannot spawn obstacle - image '${imgKey}' invalid or target height (${obstacleTargetHeight}) not calculated.`);
    }
}

function spawnCloud() { if (images.cloud && images.cloud.complete && images.cloud.naturalHeight > 0 && clouds.length < 5) { clouds.push(new Cloud()); } }
function checkCollision(rect1, rect2) { return (rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y); }
function drawText(text, x, y, color = 'black', size = 24, align = 'left', font = 'Arial') { ctx.fillStyle = color; ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.fillText(text, x, y); }

// --- Game Loop ---
let lastTime = 0;
function gameLoop(timestamp) {
    if (!isGameStarted && !isGameOver) { /* Show start screen */ requestAnimationFrame(gameLoop); return; }
    const deltaTime = (timestamp - lastTime) / 1000; lastTime = timestamp; const dt = Math.min(deltaTime, 0.1); // Cap dt
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    if (isGameOver) { showGameOverScreen(); }
    else if (isGameStarted && player) { // Check player exists
        // === UPDATE ===
        player.update(dt);
        obstacles.forEach(o => o.update(dt, gameSpeed)); // Use forEach for update too
        clouds.forEach(c => c.update(dt, gameSpeed));

        // Remove off-screen obstacles
        obstacles = obstacles.filter(o => o.x + o.scaledWidth >= 0); // Keep if still visible

        // Spawn timers
        obstacleTimer += dt * 1000; if (obstacleTimer > obstacleSpawnDelay) { spawnObstacle(); obstacleTimer = 0; }
        cloudTimer += dt * 1000; if (cloudTimer > CLOUD_SPAWN_DELAY) { spawnCloud(); cloudTimer = 0; }

        // Scroll Ground
        if (images.ground && images.ground.complete && images.ground.naturalHeight > 0) { groundX1 -= gameSpeed; groundX2 -= gameSpeed; if (groundX1 <= -images.ground.width) { groundX1 = groundX2 + images.ground.width; } if (groundX2 <= -images.ground.width) { groundX2 = groundX1 + images.ground.width; } }

        // Collision
        const playerRect = player.getRect();
        for (const obstacle of obstacles) { if (checkCollision(playerRect, obstacle.getRect())) { console.log("Collision!"); isGameOver = true; if (score > highscore) { highscore = score; } break; } }

        // Score & Difficulty
        score++; if (score > 0 && score % 100 === 0) { gameSpeed = Math.min(gameSpeed + 0.5, 25); }

        // === DRAWING ===
        ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); // Background
        if (images.ground && images.ground.complete && images.ground.naturalHeight > 0) { ctx.drawImage(images.ground, groundX1, groundDrawY); ctx.drawImage(images.ground, groundX2, groundDrawY); } // Ground
        clouds.forEach(cloud => cloud.draw(ctx));       // Clouds
        obstacles.forEach(obstacle => obstacle.draw(ctx)); // Obstacles (will use internal scaling)
        player.draw(ctx);                               // Player (will use internal scaling)
        drawText(`Score: ${score}`, 10, 30, 'black', 24); drawText(`HI: ${highscore}`, SCREEN_WIDTH - 10, 30, 'grey', 24, 'right'); // UI

    } else if (!player && isGameStarted) { console.error("Loop running but player is null!"); isGameStarted = false; } // Safety break

    requestAnimationFrame(gameLoop); // Continue loop
}


// --- Screen Display Functions --- (Unchanged)
function showStartScreen() { ctx.fillStyle='#87CEEB'; ctx.fillRect(0,0,SCREEN_WIDTH,SCREEN_HEIGHT); drawText("My Awesome Dino Runner!",SCREEN_WIDTH/2,SCREEN_HEIGHT/4,'white',40,'center'); drawText("Press SPACE or UP Arrow to Jump",SCREEN_WIDTH/2,SCREEN_HEIGHT/2,'white',24,'center'); drawText("Press any key to Start",SCREEN_WIDTH/2,SCREEN_HEIGHT*3/4,'white',24,'center'); }
function showGameOverScreen() { ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,SCREEN_WIDTH,SCREEN_HEIGHT); drawText("GAME OVER!",SCREEN_WIDTH/2,SCREEN_HEIGHT/4,'red',50,'center'); drawText(`Your Score: ${score}`,SCREEN_WIDTH/2,SCREEN_HEIGHT/2-20,'white',30,'center'); if(score===highscore&&score>0){ drawText("NEW HIGH SCORE!",SCREEN_WIDTH/2,SCREEN_HEIGHT/2+20,'yellow',30,'center'); }else{ drawText(`High Score: ${highscore}`,SCREEN_WIDTH/2,SCREEN_HEIGHT/2+20,'lightgrey',24,'center'); } drawText("Press any key to Return to Start",SCREEN_WIDTH/2,SCREEN_HEIGHT*3/4,'white',24,'center'); }
function showFatalError(message) { ctx.fillStyle = '#87CEEB'; ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); ctx.fillStyle = 'red'; ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.fillText("FATAL ERROR:", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20); ctx.font = '16px Arial'; ctx.fillText(message, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10); }

// --- Event Listeners --- (Unchanged)
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameStarted && !isGameOver) { e.preventDefault(); }
    if (!isGameStarted && !isGameOver) { isGameStarted = true; resetGame(); } // Start game on first keypress
    else if (isGameOver) { isGameStarted = false; isGameOver = false; /* Loop shows start */ }
    else if (isGameStarted && player) { if (e.code === 'Space' || e.code === 'ArrowUp') { player.jump(); } }
});

// --- Initialization ---
async function initializeGame() {
    console.log("Loading images...");
    // Clear previous promises if re-initializing (though typically not needed)
    imageLoadPromises = [];
    // Trigger loading
    Object.keys(imageSources).forEach(key => loadImage(key, imageSources[key]));

    try {
        await Promise.all(imageLoadPromises); // Wait for all loading attempts
        console.log("All image loading promises resolved.");

        // Verify base dino image needed for scaling
        if (!images.dinoRun1 || !images.dinoRun1.complete || images.dinoRun1.naturalHeight === 0) {
             throw new Error("Base image 'dinoRun1.png' failed to load or is invalid.");
        }

        // Calculate scaled dimensions GLOBALLY once after loading
        const origH = images.dinoRun1.naturalHeight;
        const origW = images.dinoRun1.naturalWidth;
        dinoScaledWidth = Math.round(origW * DINO_SCALE_FACTOR);
        dinoScaledHeight = Math.round(origH * DINO_SCALE_FACTOR);
        obstacleTargetHeight = dinoScaledHeight * OBSTACLE_DINO_HEIGHT_RATIO;
        console.log(`Global Scaled Dims Calculated: Dino=${dinoScaledWidth}x${dinoScaledHeight}, ObstacleTargetH=${obstacleTargetHeight.toFixed(1)}`);

        // Verify ground image for drawing position
        if (images.ground && images.ground.complete && images.ground.naturalHeight > 0) {
            groundX2 = images.ground.width;
            groundDrawY = SCREEN_HEIGHT - images.ground.height;
             if(images.ground.height <= 0 || images.ground.height >= SCREEN_HEIGHT) { console.warn(`Ground height (${images.ground.height}) invalid!`); }
             console.log(`Ground Draw Y set to: ${groundDrawY}`);
        } else { console.error("Ground image missing/invalid. No ground displayed."); groundDrawY = SCREEN_HEIGHT - 40; } // Fallback

        console.log("Initialization complete. Starting game loop.");
        lastTime = performance.now();
        showStartScreen(); // Show start screen initially
        requestAnimationFrame(gameLoop); // Start loop

    } catch (error) {
        console.error("Failed to initialize game:", error);
        showFatalError(error.message || "Check console (F12) for details.");
    }
}

// Start initialization
initializeGame();
