# 1. Getting Our Tools Ready (Importing Pygame)
import pygame
import random
import os
import sys # For exiting cleanly
import math # For aspect ratio calculations

# --- Tell Pygame where to find our pictures ---
try:
    assets_folder = os.path.dirname(__file__)
    img_folder = os.path.join(assets_folder, '')
except NameError:
    assets_folder = os.path.abspath(".")
    img_folder = assets_folder
    print(f"Warning: __file__ not defined, using current directory: {img_folder}")


# 2. Setting up the Magic Drawing Paper (The Game Window)
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 400
print(f"Screen dimensions set: WIDTH={SCREEN_WIDTH}, HEIGHT={SCREEN_HEIGHT}")

# Making some colour crayons (RGB Colours)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
SKY_BLUE = (135, 206, 235)

# --- Global variable for ground level ---
GROUND_LEVEL_Y = -9999 # Initial placeholder - WILL BE OVERWRITTEN

# 3. Initialize Pygame (Turning on the Magic)
print("Initializing Pygame...")
pygame.init()
pygame.mixer.init() # For sounds later
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("My Awesome Dino Runner!")
clock = pygame.time.Clock()
print("Pygame Initialized.")

# --- Function to Exit Safely ---
def terminate():
    print("Terminating Pygame...")
    pygame.quit()
    print("Exiting Program.")
    sys.exit()

# --- Image Scaling Function ---
def scale_image_to_height(image, target_height):
    original_width, original_height = image.get_size()
    if original_height <= 0: # Check for non-positive height
        print(f"Warning: Invalid original height ({original_height}) for scaling. Returning original image.")
        return image
    aspect_ratio = original_width / original_height
    # Ensure target height is positive before calculating width
    if target_height <= 0:
        print(f"Warning: Invalid target height ({target_height}) for scaling. Returning original image.")
        return image
    new_width = int(target_height * aspect_ratio)
    new_height = int(target_height)
    if new_width > 0 and new_height > 0:
        try:
            return pygame.transform.scale(image, (new_width, new_height))
        except Exception as e:
            print(f"Error during pygame.transform.scale: {e}. Returning original image.")
            return image
    else:
        print(f"Warning: Invalid scaling dimensions calculated ({new_width}x{new_height}). Returning original image.")
        return image


# 4. Loading Our Pictures (Getting the LEGO Bricks)
try:
    print(f"Looking for images in: {img_folder}")
    # Load ORIGINAL Player images
    dino_run_img1_orig = pygame.image.load(os.path.join(img_folder, 'dino_run1.png')).convert_alpha()
    dino_run_img2_orig = pygame.image.load(os.path.join(img_folder, 'dino_run2.png')).convert_alpha()
    dino_jump_img_orig = pygame.image.load(os.path.join(img_folder, 'dino_jump.png')).convert_alpha()
    print("Original Dino images loaded.")

    # Load ORIGINAL Obstacle images
    cactus_small_img_orig = pygame.image.load(os.path.join(img_folder, 'cactus_small.png')).convert_alpha()
    cactus_big_img_orig = pygame.image.load(os.path.join(img_folder, 'cactus_big.png')).convert_alpha()
    print("Original Obstacle images loaded.")

    # Load Ground image
    print("Loading ground image...")
    ground_img = pygame.image.load(os.path.join(img_folder, 'ground.png')).convert_alpha()
    ground_rect = ground_img.get_rect()
    print(f"  Ground image loaded. Rect: {ground_rect}")
    if ground_rect.height <= 0 or ground_rect.height >= SCREEN_HEIGHT:
        print(f"\n*** WARNING: Ground image height ({ground_rect.height}) is invalid or too large for screen height ({SCREEN_HEIGHT}). ***")
        print("*** Setting ground level to a default near bottom. Please fix 'ground.png'! ***")
        GROUND_LEVEL_Y = SCREEN_HEIGHT - 40 # Default fallback ground level
    else:
        GROUND_LEVEL_Y = SCREEN_HEIGHT - ground_rect.height # Calculate normally
    ground_x1 = 0
    ground_x2 = ground_rect.width
    print(f"  Ground level determined. GROUND_LEVEL_Y = {GROUND_LEVEL_Y}")

    # Load Cloud image
    try:
        cloud_img = pygame.image.load(os.path.join(img_folder, 'cloud.png')).convert_alpha()
        print("Cloud image loaded.")
    except pygame.error:
        cloud_img = None
        print("Optional cloud image ('cloud.png') not found, skipping clouds.")

    # --- SCALING ---
    print("--- Scaling Sprites ---")
    dino_scale_factor = 3.3
    orig_dino_w, orig_dino_h = dino_run_img1_orig.get_size()
    new_dino_w = int(orig_dino_w * dino_scale_factor)
    new_dino_h = int(orig_dino_h * dino_scale_factor)

    if new_dino_w > 0 and new_dino_h > 0:
        dino_run_img1 = pygame.transform.scale(dino_run_img1_orig, (new_dino_w, new_dino_h))
        dino_run_img2 = pygame.transform.scale(dino_run_img2_orig, (new_dino_w, new_dino_h))
        dino_jump_img = pygame.transform.scale(dino_jump_img_orig, (new_dino_w, new_dino_h))
        print(f"Dino scaled to: {new_dino_w}x{new_dino_h}")
    else: # Fallback
        print("Warning: Invalid Dino scaling dimensions. Using original images.")
        dino_run_img1, dino_run_img2, dino_jump_img = dino_run_img1_orig, dino_run_img2_orig, dino_jump_img_orig
        new_dino_h = orig_dino_h

    target_obstacle_height = new_dino_h * 0.70
    print(f"Target obstacle height: {target_obstacle_height:.2f}")
    cactus_small_img = scale_image_to_height(cactus_small_img_orig, target_obstacle_height)
    cactus_big_img = scale_image_to_height(cactus_big_img_orig, target_obstacle_height)
    print(f"Small cactus scaled to: {cactus_small_img.get_size()}")
    print(f"Big cactus scaled to: {cactus_big_img.get_size()}")
    obstacle_images = [cactus_small_img, cactus_big_img]
    print("--- Scaling Complete ---")

except pygame.error as e:
    print(f"\n*** FATAL ERROR LOADING/SCALING IMAGE ***")
    print(f"Error message: {e}")
    print(f"Check images are present and valid in folder: '{img_folder}'")
    terminate()
except Exception as e:
    print(f"\n*** UNEXPECTED ERROR DURING LOADING/SCALING ***")
    print(f"Error: {e}")
    terminate()


# 5. Creating Our Main Character (The Dino!)
class Dino(pygame.sprite.Sprite):
    def __init__(self, run_img1, run_img2, jump_img, ground_level_arg):
        pygame.sprite.Sprite.__init__(self)
        if not isinstance(ground_level_arg, (int, float)) or ground_level_arg <= 0 or ground_level_arg > SCREEN_HEIGHT:
             print(f"  *** WARNING: Invalid ground_level_arg received in Dino init: {ground_level_arg}. Using default fallback. ***")
             ground_level_arg = SCREEN_HEIGHT - 40

        self.run_images = [run_img1, run_img2]
        self.jump_img = jump_img
        self.current_image_index = 0
        self.image = self.run_images[self.current_image_index]
        self.rect = self.image.get_rect()
        self.ground_level = ground_level_arg

        self.rect.bottom = self.ground_level
        self.rect.left = 50
        self.initial_left = self.rect.left

        self.is_running = True; self.is_jumping = False
        self.gravity = 0.8
        # *** ADJUSTED JUMP STRENGTH ***
        self.jump_strength = -16  # <<< MODIFIED: Reduced jump height further from -19
        self.velocity_y = 0
        self.run_anim_timer = 0; self.run_anim_speed = 8

    def jump(self):
        if self.rect.bottom >= self.ground_level - 5 and not self.is_jumping:
            self.velocity_y = self.jump_strength
            self.is_jumping = True; self.is_running = False

    def update(self):
        self.velocity_y += self.gravity
        self.rect.y += self.velocity_y
        if self.rect.bottom >= self.ground_level:
            self.rect.bottom = self.ground_level
            if self.is_jumping: self.is_jumping = False; self.is_running = True
            self.velocity_y = 0
        # Animation logic...
        display_image = None
        if self.is_jumping: display_image = self.jump_img
        elif self.is_running:
            self.run_anim_timer += 1
            if self.run_anim_timer >= self.run_anim_speed:
                self.run_anim_timer = 0
                self.current_image_index = (self.current_image_index + 1) % len(self.run_images)
            display_image = self.run_images[self.current_image_index]
        else: display_image = self.run_images[self.current_image_index]
        if self.image != display_image and display_image is not None:
            self.image = display_image
            old_bottom = self.rect.bottom
            self.rect = self.image.get_rect()
            self.rect.bottom = old_bottom
            self.rect.left = self.initial_left


# 6. Creating the Obstacles
class Obstacle(pygame.sprite.Sprite):
    def __init__(self, image, ground_level_arg):
        pygame.sprite.Sprite.__init__(self)
        if not isinstance(ground_level_arg, (int, float)) or ground_level_arg <= 0 or ground_level_arg > SCREEN_HEIGHT:
             print(f"  *** WARNING: Invalid ground_level_arg received in Obstacle init: {ground_level_arg}. Using default fallback. ***")
             ground_level_arg = SCREEN_HEIGHT - 40

        self.image = image
        self.rect = self.image.get_rect()
        self.rect.bottom = ground_level_arg
        self.rect.left = SCREEN_WIDTH

    def update(self, game_speed):
        self.rect.x -= game_speed
        if self.rect.right < 0: self.kill()


# 7. Creating Clouds (Unchanged)
class Cloud(pygame.sprite.Sprite):
    def __init__(self, image):
        pygame.sprite.Sprite.__init__(self)
        self.image = image; self.rect = self.image.get_rect()
        self.rect.x = SCREEN_WIDTH + random.randrange(0, SCREEN_WIDTH)
        self.rect.y = random.randrange(20, SCREEN_HEIGHT // 3)
        self._base_speed_divisor = random.randint(2, 4)
    def update(self, game_speed):
        cloud_speed = max(1, game_speed // self._base_speed_divisor)
        self.rect.x -= cloud_speed
        if self.rect.right < 0:
            self.rect.x = SCREEN_WIDTH + random.randrange(0, 100)
            self.rect.y = random.randrange(20, SCREEN_HEIGHT // 3)
            self._base_speed_divisor = random.randint(2, 4)

# --- Sections 8 (Variables), Font Loading, Sprite Groups, draw_text ---
# --- are all UNCHANGED                                             ---
# 8. Game Variables
score = 0; highscore = 0; game_speed = 8
game_over = False; start_screen = True
obstacle_timer = 0; obstacle_spawn_delay = 1500
cloud_timer = 0; cloud_spawn_delay = 5000
# --- Font ---
try:
    score_font = pygame.font.Font(None, 36)
    message_font = pygame.font.Font(None, 50)
    print("Fonts loaded.")
except Exception as e:
    print(f"Font loading error: {e}. Using fallback.")
    try: score_font = pygame.font.SysFont('Arial', 36); message_font = pygame.font.SysFont('Arial', 50)
    except Exception as e2:
        print(f"Fallback font error: {e2}. Text won't display.")
        class DummyFont:
            def render(self, *args, **kwargs): surf = pygame.Surface((1,1)); surf.set_alpha(0); return surf
            def get_rect(self, *args, **kwargs): return pygame.Rect(0,0,0,0)
        score_font, message_font = DummyFont(), DummyFont()
# --- Sprite Groups ---
all_sprites = pygame.sprite.Group()
obstacles = pygame.sprite.Group()
clouds = pygame.sprite.Group()
# --- Function to show text ---
def draw_text(text, font, color, surface, x, y, center=True):
    try:
        textobj = font.render(text, True, color)
        textrect = textobj.get_rect()
        if center: textrect.center = (x, y)
        else: textrect.topleft = (x, y)
        surface.blit(textobj, textrect)
    except Exception as e: print(f"Error rendering text '{text}': {e}")

# --- Function to reset the game ---
def reset_game():
    global score, game_speed, game_over, start_screen, obstacle_spawn_delay, obstacle_timer, cloud_timer, player
    print("\n--- Resetting game state ---")
    score = 0; game_speed = 8; game_over = False; start_screen = False
    obstacle_spawn_delay = 1500
    start_time = pygame.time.get_ticks()
    obstacle_timer = start_time; cloud_timer = start_time
    all_sprites.empty(); obstacles.empty(); clouds.empty()
    print("Sprite groups emptied.")
    current_ground_level = GROUND_LEVEL_Y
    print(f"CRITICAL CHECK [reset_game]: Using ground level {current_ground_level} (Type: {type(current_ground_level)})")
    # Create NEW player instance, passing the SCALED dino images
    player = Dino(dino_run_img1, dino_run_img2, dino_jump_img, current_ground_level)
    all_sprites.add(player)
    print(f"Player created via reset_game. Final Rect after init: {player.rect}")
    # Create initial clouds
    if cloud_img:
        for _ in range(3):
            cloud = Cloud(cloud_img)
            all_sprites.add(cloud); clouds.add(cloud)
        print("Initial clouds created.")
    print("--- Reset complete ---")

# --- Main Game Loop ---
running = True
player = None
print("\nStarting main game loop...")
if GROUND_LEVEL_Y <= 0 or GROUND_LEVEL_Y >= SCREEN_HEIGHT:
    print(f"\n*** WARNING: GROUND_LEVEL_Y ({GROUND_LEVEL_Y}) is outside the valid screen range (0 to {SCREEN_HEIGHT})! ***")
    print("This is likely because 'ground.png' has an incorrect height.")
    print("Attempting to run with a default fallback ground level. Sprites might be positioned incorrectly.")

while running:
    clock.tick(60)
    # --- Event Handling ---
    for event in pygame.event.get():
        if event.type == pygame.QUIT: running = False
        if event.type == pygame.KEYDOWN:
            if start_screen: reset_game()
            elif game_over: start_screen = True
            elif player:
                if event.key == pygame.K_SPACE or event.key == pygame.K_UP: player.jump()

    # --- Game State Management ---
    if start_screen:
        screen.fill(SKY_BLUE)
        draw_text("My Awesome Dino Runner!", message_font, WHITE, screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 4)
        draw_text("Press SPACE or UP Arrow to Jump", score_font, WHITE, screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2)
        draw_text("Press any key to Start", score_font, WHITE, screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT * 3 // 4)
        pygame.display.flip(); continue
    elif game_over:
        # Game Over drawing...
        draw_text("GAME OVER!", message_font, (200,0,0), screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 4)
        draw_text(f"Your Score: {score}", score_font, BLACK, screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 20)
        if score > highscore: highscore = score; draw_text("NEW HIGH SCORE!", score_font, (255,0,0), screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20)
        else: draw_text(f"High Score: {highscore}", score_font, (100,100,100), screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20)
        draw_text("Press any key to Return to Start", score_font, BLACK, screen, SCREEN_WIDTH // 2, SCREEN_HEIGHT * 3 // 4)
        pygame.display.flip(); continue

    # --- Normal Gameplay Logic ---
    if player is None: print("CRITICAL Error: Player is None!"); start_screen = True; continue

    # === UPDATE Section ===
    player.update()
    obstacles.update(game_speed)
    clouds.update(game_speed)

    # --- Scroll Ground ---
    ground_x1 -= game_speed; ground_x2 -= game_speed
    if ground_x1 <= -ground_rect.width: ground_x1 = ground_x2 + ground_rect.width
    if ground_x2 <= -ground_rect.width: ground_x2 = ground_x1 + ground_rect.width

    # --- Spawn Obstacles ---
    now = pygame.time.get_ticks()
    if now - obstacle_timer > obstacle_spawn_delay:
        obstacle_timer = now
        if random.random() > 0.4:
            img = random.choice(obstacle_images) # Choose from SCALED images
            new_obstacle = Obstacle(img, GROUND_LEVEL_Y) # Create with SCALED image
            all_sprites.add(new_obstacle)
            obstacles.add(new_obstacle)
        # Adjust spawn delay...
        min_delay = 600; max_delay = 1500; reduction = (score // 10) * 50
        obstacle_spawn_delay = max(min_delay, max_delay - reduction)

    # --- Spawn Clouds ---
    if cloud_img:
         if now - cloud_timer > cloud_spawn_delay and len(clouds) < 5:
             cloud_timer = now; new_cloud = Cloud(cloud_img)
             all_sprites.add(new_cloud); clouds.add(new_cloud)

    # --- Collision Detection ---
    hits = pygame.sprite.spritecollide(player, obstacles, False, pygame.sprite.collide_mask)
    if hits: print(f"Collision detected with: {hits[0]} at rect {hits[0].rect}"); game_over = True

    # --- Score & Difficulty ---
    score += 1; target_speed = 8 + (score // 100) * 0.5
    if game_speed < target_speed: game_speed += 0.01; game_speed = min(game_speed, 25)

    # === DRAWING Section (Order is Crucial!) ===
    # 1. Background
    screen.fill(SKY_BLUE)
    # 2. Ground
    screen.blit(ground_img, (ground_x1, GROUND_LEVEL_Y))
    screen.blit(ground_img, (ground_x2, GROUND_LEVEL_Y))
    # 3. Clouds
    clouds.draw(screen)
    # 4. Obstacles
    obstacles.draw(screen)
    # 5. Player (Manually on top)
    screen.blit(player.image, player.rect)
    # 6. UI
    draw_text(f"Score: {score}", score_font, BLACK, screen, 10, 10, center=False)
    draw_text(f"HI: {highscore}", score_font, (100,100,100), screen, SCREEN_WIDTH - 150, 10, center=False)

    # === END DRAWING Section ===
    pygame.display.flip()

# --- End of Main Loop ---
terminate()