// --- Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d'); // The drawing context

// Match Pygame window size
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 400;
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

console.log("Canvas Setup:", canvas.width, "x", canvas.height);

// --- Game Variables ---
let score = 0;
let highscore = 0; // TODO: Implement localStorage for persistence
let gameSpeed = 8;
let isGameOver = false;
let isGameStarted = false; // Start screen state
let player = null;
let obstacles = [];
let clouds = [];
let groundX1 = 0;
let groundX2 = 0; // Will be set after ground image load
let groundDrawY = 0; // Will be set after ground image load

// --- Constants ---
const GRAVITY = 0.8;
const DINO_INITIAL_X = 50;
const SPRITE_STAND_Y = SCREEN_HEIGHT - 35; // Adjusted baseline Y for sprites ON the ground visually
const DINO_ANIM_SPEED = 8; // frames per image change
const OBSTACLE_SPAWN_DELAY_MIN = 700; // ms
const OBSTACLE_SPAWN_DELAY_MAX = 1800; // ms
let obstacleSpawnDelay = OBSTACLE_SPAWN_DELAY_MAX;
let obstacleTimer = 0;
const CLOUD_SPAWN_DELAY = 5000; // ms
let cloudTimer = 0;

// --- Image Loading ---
// Dictionary to hold loaded image objects
const images = {};
let imagesLoaded = 0;
let totalImages = 0;

// List of image paths (MAKE SURE THESE MATCH YOUR FILENAMES)
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
    return new Promise((resolve, reject) => {
        totalImages++;
        const img = new Image();
        images[key] = img; // Store image object immediately
        img.onload = () => {
            imagesLoaded++;
            console.log(`${key} loaded (${imagesLoaded}/${totalImages})`);
            resolve(img); // Resolve promise when loaded
        };
        img.onerror = (err) => {
            console.error(`Error loading image ${key}: ${src}`, err);
            reject(err);
        };
        img.src = src; // Start loading
    });
}

// --- Sprite Scaling ---
// Note: Scaling is done after loading
const DINO_SCALE_FACTOR = 1.8; // Same as Python
let scaledDinoHeight = 0; // Will be calculated after load + scale
let scaledObstacleImages = []; // Will hold scaled images


// --- Classes ---

// Player (Dino) Class
class Dino {
    constructor() {
        this.runImages = [images.dinoRun1, images.dinoRun2];
        this.jumpImage = images.dinoJump;
        this.currentImageIndex = 0;
        this.image = this.runImages[this.currentImageIndex];

        // Use image dimensions AFTER scaling
        this.width = this.image.width;
        this.height = this.image.height;

        this.x = DINO_INITIAL_X;
        this.y = SPRITE_STAND_Y - this.height; // Position based on bottom edge
        this.initialY = this.y; // Store initial Y? Maybe not needed if using SPRITE_STAND_Y

        this.velocityY = 0;
        this.jumpStrength = -17; // Match the last Python value
        this.isRunning = true;
        this.isJumping = false;

        this.runAnimTimer = 0;
    }

    jump() {
        // Allow jump only if close to the stand line
        if (!this.isJumping && this.y >= SPRITE_STAND_Y - this.height - 5) {
            this.velocityY = this.jumpStrength;
            this.isJumping = true;
            this.isRunning = false;
            console.log("Player Jumped!");
        }
    }

    update(dt) { // dt is delta time in seconds
        // Apply Gravity
        if (this.isJumping || this.y < SPRITE_STAND_Y - this.height) {
             this.velocityY += GRAVITY; // Simple constant gravity (not scaled by dt here, adjust if needed)
        }

        // Update position
        this.y += this.velocityY; // Adjust Y position

        // Check for landing
        if (this.y >= SPRITE_STAND_Y - this.height) {
            this.y = SPRITE_STAND_Y - this.height; // Snap to ground level
            if (this.isJumping) {
                this.isJumping = false;
                this.isRunning = true;
            }
            this.velocityY = 0;
        }

        // Handle Animation
        if (this.isJumping) {
            this.image = this.jumpImage;
        } else if (this.isRunning) {
            this.runAnimTimer++;
            if (this.runAnimTimer >= DINO_ANIM_SPEED) {
                this.runAnimTimer = 0;
                this.currentImageIndex = (this.currentImageIndex + 1) % this.runImages.length;
                this.image = this.runImages[this.currentImageIndex];
            }
        } else { // Not jumping, not running (e.g., initial state)
             this.image = this.runImages[this.currentImageIndex];
        }
        // Update dimensions if image changed (important if jump/run sprites have different sizes)
        this.width = this.image.width;
        this.height = this.image.height;
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        // Optional: Draw bounding box for debugging
        // ctx.strokeStyle = 'red';
        // ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    // Get bounding box for collision detection
    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
}

// Obstacle Class
class Obstacle {
    constructor(image) { // Expects a scaled image
        this.image = image;
        this.width = this.image.width;
        this.height = this.image.height;
        this.x = SCREEN_WIDTH; // Start off-screen right
        this.y = SPRITE_STAND_Y - this.height; // Position based on bottom edge
    }

    update(dt, currentSpeed) {
        this.x -= currentSpeed; // Adjust speed scaling if needed using dt
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        // Optional: Draw bounding box for debugging
        // ctx.strokeStyle = 'blue';
        // ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    getRect() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
}

// Cloud Class
class Cloud {
    constructor() {
        this.image = images.cloud; // Assumes cloud image is loaded
        this.width = this.image.width;
        this.height = this.image.height;
        this.x = SCREEN_WIDTH + Math.random() * SCREEN_WIDTH;
        this.y = Math.random() * (SCREEN_HEIGHT / 3 - 20) + 20; // Top third of screen
        this.speedFactor = Math.random() * 0.3 + 0.2; // Move slower than game speed (20-50%)
    }

    update(dt, currentSpeed) {
        this.x -= currentSpeed * this.speedFactor;
        // Respawn when off-screen left
        if (this.x + this.width < 0) {
            this.x = SCREEN_WIDTH + Math.random() * 100;
            this.y = Math.random() * (SCREEN_HEIGHT / 3 - 20) + 20;
            this.speedFactor = Math.random() * 0.3 + 0.2;
        }
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
}

// --- Game Functions ---

function resetGame() {
    console.log("Resetting game...");
    score = 0;
    gameSpeed = 8;
    isGameOver = false;
    isGameStarted = true; // We are now in the game
    obstacles = [];
    clouds = [];
    obstacleTimer = 0; // Reset timers
    cloudTimer = 0;
    obstacleSpawnDelay = OBSTACLE_SPAWN_DELAY_MAX; // Reset spawn delay

    // Create Player using scaled images
    player = new Dino();

    // Create initial clouds (if image loaded)
    if (images.cloud) {
        for (let i = 0; i < 3; i++) {
            clouds.push(new Cloud());
        }
    }
    console.log("Reset complete.");
}

function spawnObstacle() {
    // Choose random scaled obstacle image
    const imgIndex = Math.floor(Math.random() * scaledObstacleImages.length);
    const chosenImage = scaledObstacleImages[imgIndex];
    obstacles.push(new Obstacle(chosenImage));
    console.log("Spawned obstacle");

    // Adjust next spawn delay
    const reduction = Math.floor(score / 10) * 50; // Faster with score
    obstacleSpawnDelay = Math.max(OBSTACLE_SPAWN_DELAY_MIN, OBSTACLE_SPAWN_DELAY_MAX - reduction);
}

function spawnCloud() {
    if (images.cloud && clouds.length < 5) { // Only if cloud image exists & limit count
        clouds.push(new Cloud());
    }
}

// Simple AABB Collision Detection
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function drawText(text, x, y, color = 'black', size = 24, align = 'left', font = 'Arial') {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

// --- Game Loop ---
let lastTime = 0;

function gameLoop(timestamp) {
    if (!isGameStarted && !isGameOver) { // Handle start screen before loop logic if needed
         showStartScreen();
         // Wait for start input (handled by event listeners)
         requestAnimationFrame(gameLoop); // Keep checking
         return;
    }

    const deltaTime = (timestamp - lastTime) / 1000; // Delta time in seconds
    lastTime = timestamp;
    // Avoid huge deltaTime jumps if tab loses focus
    const dt = Math.min(deltaTime, 0.1); // Cap delta time

    // --- Clear Canvas ---
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // --- Game State Logic ---
    if (isGameOver) {
        showGameOverScreen();
    } else if (isGameStarted) {
        // === UPDATE ===
        // Player
        player.update(dt);

        // Obstacles
        obstacleTimer += dt * 1000; // Timer in milliseconds
        if (obstacleTimer > obstacleSpawnDelay) {
            spawnObstacle();
            obstacleTimer = 0; // Reset timer
        }
        // Iterate backwards for safe removal
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update(dt, gameSpeed);
            // Remove obstacles that go off-screen left
            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1); // Remove from array
            }
        }

        // Clouds
        cloudTimer += dt * 1000; // Timer in milliseconds
        if (cloudTimer > CLOUD_SPAWN_DELAY) {
            spawnCloud();
            cloudTimer = 0; // Reset timer
        }
        clouds.forEach(cloud => cloud.update(dt, gameSpeed));


        // Scroll Ground
        if (images.ground) { // Check if ground loaded
             groundX1 -= gameSpeed;
             groundX2 -= gameSpeed;
             if (groundX1 <= -images.ground.width) {
                 groundX1 = groundX2 + images.ground.width;
             }
             if (groundX2 <= -images.ground.width) {
                 groundX2 = groundX1 + images.ground.width;
             }
        }

        // Collision Detection
        const playerRect = player.getRect();
        for (const obstacle of obstacles) {
            if (checkCollision(playerRect, obstacle.getRect())) {
                console.log("Collision Detected!");
                isGameOver = true;
                // Update high score if needed
                if (score > highscore) {
                    highscore = score;
                    // TODO: Save highscore using localStorage
                }
                break; // Stop checking after first collision
            }
        }

        // Update Score & Difficulty
        score++;
        if (score > 0 && score % 100 === 0) {
            gameSpeed += 0.5;
            gameSpeed = Math.min(gameSpeed, 25); // Cap speed
            console.log("Speed increased to:", gameSpeed);
        }


        // === DRAW ===
        // Background (already blue via CSS or clearRect)
        ctx.fillStyle = '#87CEEB'; // Sky Blue
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);


        // Ground (use GROUND_DRAW_Y for vertical position)
        if (images.ground) {
             ctx.drawImage(images.ground, groundX1, GROUND_DRAW_Y);
             ctx.drawImage(images.ground, groundX2, GROUND_DRAW_Y);
        }

        // Clouds
        clouds.forEach(cloud => cloud.draw(ctx));

        // Obstacles
        obstacles.forEach(obstacle => obstacle.draw(ctx));

        // Player
        player.draw(ctx);

        // UI (Score)
        drawText(`Score: ${score}`, 10, 30, 'black', 24);
        drawText(`HI: ${highscore}`, SCREEN_WIDTH - 10, 30, 'grey', 24, 'right');

    }

    // --- Request Next Frame ---
    // Only request if game not over? Or always loop? Let's always loop for simplicity
    requestAnimationFrame(gameLoop);
}

// --- Screen Display Functions ---

function showStartScreen() {
    // Clear canvas first
    ctx.fillStyle = '#87CEEB'; // Sky Blue
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawText("My Awesome Dino Runner!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 4, 'white', 40, 'center');
    drawText("Press SPACE or UP Arrow to Jump", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, 'white', 24, 'center');
    drawText("Press any key to Start", SCREEN_WIDTH / 2, SCREEN_HEIGHT * 3 / 4, 'white', 24, 'center');
}

function showGameOverScreen() {
     // Optionally keep last frame visible, or clear and redraw
     // Let's draw over the last frame
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent overlay
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    drawText("GAME OVER!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 4, 'red', 50, 'center');
    drawText(`Your Score: ${score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20, 'white', 30, 'center');
    if (score === highscore && score > 0) { // Check if it's a new high score
         drawText("NEW HIGH SCORE!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20, 'yellow', 30, 'center');
    } else {
         drawText(`High Score: ${highscore}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20, 'lightgrey', 24, 'center');
    }
    drawText("Press any key to Return to Start", SCREEN_WIDTH / 2, SCREEN_HEIGHT * 3 / 4, 'white', 24, 'center');
}


// --- Event Listeners ---
window.addEventListener('keydown', (e) => {
    // Use e.code for layout-independent keys
    // console.log("Key Down:", e.code); // Debugging key presses

    if (!isGameStarted && !isGameOver) { // If on start screen
        isGameStarted = true; // Mark game as started
        resetGame(); // Start the game proper
    } else if (isGameOver) {
        isGameStarted = false; // Go back to start screen state
        isGameOver = false; // Reset game over flag
        // The loop will now show the start screen
    } else if (isGameStarted && player) { // If game is running
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            player.jump();
        }
        // Add other controls here if needed (e.g., ArrowDown for ducking)
    }
});

// --- Initialization ---

async function initializeGame() {
    console.log("Loading images...");
    const promises = [];
    for (const key in imageSources) {
        promises.push(loadImage(key, imageSources[key]));
    }

    try {
        await Promise.all(promises); // Wait for all images to load
        console.log("All images loaded successfully!");

        // Perform scaling *after* loading
        console.log("Performing post-load scaling...");
        if (images.dinoRun1) { // Check if dino images actually loaded
            const orig_dino_w = images.dinoRun1.naturalWidth || images.dinoRun1.width;
            const orig_dino_h = images.dinoRun1.naturalHeight || images.dinoRun1.height;
            const new_dino_w = Math.round(orig_dino_w * DINO_SCALE_FACTOR);
            const new_dino_h = Math.round(orig_dino_h * DINO_SCALE_FACTOR);
            scaledDinoHeight = new_dino_h; // Store scaled height

            if (new_dino_w > 0 && new_dino_h > 0) {
                 // Create temporary canvases to scale images
                 const scaleCanvas = document.createElement('canvas');
                 const scaleCtx = scaleCanvas.getContext('2d');

                 function getScaledImage(originalImage, w, h) {
                      scaleCanvas.width = w;
                      scaleCanvas.height = h;
                      scaleCtx.drawImage(originalImage, 0, 0, w, h);
                      const scaledImage = new Image();
                      scaledImage.src = scaleCanvas.toDataURL(); // Convert canvas content back to Image
                      return scaledImage;
                 }

                 // Reassign scaled images back to the images object
                 images.dinoRun1 = getScaledImage(images.dinoRun1, new_dino_w, new_dino_h);
                 images.dinoRun2 = getScaledImage(images.dinoRun2, new_dino_w, new_dino_h);
                 images.dinoJump = getScaledImage(images.dinoJump, new_dino_w, new_dino_h);
                 console.log(`Dino scaled to ${new_dino_w}x${new_dino_h}`);

                 // Scale obstacles relative to new dino height
                 const target_obstacle_height = scaledDinoHeight * 0.70;
                 console.log(`Target obstacle height: ${target_obstacle_height.toFixed(2)}`);

                 function getScaledObstacle(originalObstacle) {
                     const orig_obs_w = originalObstacle.naturalWidth || originalObstacle.width;
                     const orig_obs_h = originalObstacle.naturalHeight || originalObstacle.height;
                     if (orig_obs_h <= 0) return originalObstacle; // Skip if height is invalid
                     const aspect_ratio = orig_obs_w / orig_obs_h;
                     const new_obs_h = Math.round(target_obstacle_height);
                     const new_obs_w = Math.round(new_obs_h * aspect_ratio);

                     if(new_obs_w > 0 && new_obs_h > 0) {
                          const scaled = getScaledImage(originalObstacle, new_obs_w, new_obs_h);
                           // Wait for the new image data URL to load (important!)
                          return new Promise(resolve => {
                              scaled.onload = () => resolve(scaled);
                          });
                     }
                     return Promise.resolve(originalObstacle); // Return original if scaling fails
                 }

                 // Scale obstacles and wait for them to be ready
                 const scaledObsPromises = [
                     getScaledObstacle(images.cactusSmall),
                     getScaledObstacle(images.cactusBig)
                 ];
                 scaledObstacleImages = await Promise.all(scaledObsPromises); // Store the final scaled images
                 console.log(`Cacti scaled: S=${scaledObstacleImages[0].width}x${scaledObstacleImages[0].height}, B=${scaledObstacleImages[1].width}x${scaledObstacleImages[1].height}`);

            } else {
                console.warn("Dino scaling resulted in 0 dimensions. Using original sizes.");
                scaledDinoHeight = images.dinoRun1.naturalHeight || images.dinoRun1.height;
                 scaledObstacleImages = [images.cactusSmall, images.cactusBig]; // Use originals if scaling failed
            }
        } else {
             console.error("Dino images failed to load. Cannot proceed with scaling or game start.");
             return; // Stop initialization
        }


        // Set initial ground position values based on loaded ground image
        if (images.ground) {
            groundX2 = images.ground.width;
            // Calculate where ground image top edge should be to align bottom edge with screen bottom
            groundDrawY = SCREEN_HEIGHT - images.ground.height;
            console.log(`Initial ground setup: width=${images.ground.width}, groundDrawY=${groundDrawY}`);
             // Validate ground image height (optional but good)
             if(images.ground.height <= 0 || images.ground.height >= SCREEN_HEIGHT) {
                  console.warn(`Ground image height (${images.ground.height}) seems invalid! Check ground.png. Positioning might be off.`);
                  // Keep calculated groundDrawY but be aware it might be wrong if image is bad
             }
        } else {
             console.error("Ground image failed to load. Game will not display ground.");
             // Set fallback Y positions if ground is essential for visuals
             groundDrawY = SCREEN_HEIGHT - 40; // Arbitrary fallback
        }


        // Start the game loop
        console.log("Initialization complete. Starting game loop.");
        lastTime = performance.now(); // Use performance.now() for high-resolution time
        requestAnimationFrame(gameLoop);

    } catch (error) {
        console.error("Failed to initialize game:", error);
        // Display an error message to the user on the page?
        ctx.fillStyle = 'red';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("Error loading game assets. Check console (F12).", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    }
}

// Start the initialization process when the script loads
initializeGame();