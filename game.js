// ============================================================
// SUPER RUNNER - モバイルプラットフォーマーゲーム
// ============================================================

// ===== 定数 =====
const TILE = 32;
const GRAVITY = 0.6;
const FRICTION = 0.85;
const MAX_FALL_SPEED = 12;
const PLAYER_SPEED = 4.5;
const JUMP_FORCE = -11;
const ENEMY_SPEED = 1.2;
const COIN_BOUNCE = 0.03;
const INVINCIBLE_TIME = 90; // フレーム数

// ===== グローバル変数 =====
let canvas, ctx;
let gameState = 'title'; // title, playing, gameover, clear
let score = 0;
let lives = 3;
let currentLevel = 0;
let startTime = 0;
let animFrame = 0;
let camera = { x: 0, y: 0 };
let keys = { left: false, right: false, jump: false };
let player, platforms, enemies, coins, decorations, goalFlag;
let particles = [];
let boss = null;
let moonItems = [];
let screenShake = 0;
let enemyImg = null;
let enemyImgLoaded = false;

// ===== Canvas初期化 =====
function initCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 敵キャラ画像をプリロード
    enemyImg = new Image();
    enemyImg.onload = () => { enemyImgLoaded = true; };
    enemyImg.src = 'enemy.png';
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// ============================================================
// プレイヤークラス
// ============================================================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 34;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facing = 1; // 1=右, -1=左
        this.invincible = 0;
        this.walkFrame = 0;
        this.walkTimer = 0;
        this.alive = true;
        this.jumpHeld = false;
        this.jumpCount = 0;     // 二段ジャンプ用カウンター
        this.maxJumps = 2;      // 最大ジャンプ回数
    }

    update() {
        if (!this.alive) return;

        // 水平移動（一定速度）
        if (keys.left) {
            this.vx = -PLAYER_SPEED;
            this.facing = -1;
        } else if (keys.right) {
            this.vx = PLAYER_SPEED;
            this.facing = 1;
        } else {
            this.vx = 0;
        }

        // ジャンプ（二段ジャンプ対応）
        if (keys.jump && !this.jumpHeld && this.jumpCount < this.maxJumps) {
            this.vy = this.jumpCount === 0 ? JUMP_FORCE : JUMP_FORCE * 0.85;
            this.onGround = false;
            this.jumpHeld = true;
            this.jumpCount++;
            const color = this.jumpCount === 1 ? '#fff' : '#87ceeb';
            spawnParticles(this.x + this.w / 2, this.y + this.h, 5, color);
        }
        if (!keys.jump) {
            this.jumpHeld = false;
        }

        // 重力
        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        // 摩擦（不要になったが空中の微調整用に残す）

        // 移動 & 衝突判定
        this.x += this.vx;
        this.collideX();
        this.y += this.vy;
        this.collideY();

        // アニメーション
        if (Math.abs(this.vx) > 0.5 && this.onGround) {
            this.walkTimer++;
            if (this.walkTimer > 6) {
                this.walkTimer = 0;
                this.walkFrame = (this.walkFrame + 1) % 4;
            }
        } else if (this.onGround) {
            this.walkFrame = 0;
        }

        // 無敵時間
        if (this.invincible > 0) {
            this.invincible--;
            // 月アイテム由来の長時間無敵中はキラキラエフェクト
            if (this.invincible > INVINCIBLE_TIME && animFrame % 5 === 0) {
                spawnParticles(
                    this.x + Math.random() * this.w,
                    this.y + Math.random() * this.h,
                    1, '#fffacd'
                );
            }
        }

        // 画面外に落ちたら死亡
        if (this.y > getLevelHeight() + 100) {
            this.die();
        }

        // 左端制限
        if (this.x < 0) this.x = 0;
    }

    collideX() {
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vx > 0) {
                    this.x = p.x - this.w;
                } else if (this.vx < 0) {
                    this.x = p.x + p.w;
                }
                this.vx = 0;
            }
        }
    }

    collideY() {
        this.onGround = false;
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vy > 0) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                    this.onGround = true;
                    this.jumpCount = 0; // 着地でジャンプカウントリセット
                } else if (this.vy < 0) {
                    this.y = p.y + p.h;
                    this.vy = 0;
                    // ? ブロックを叩いたとき → 月アイテム出現
                    if (p.type === 'question' && !p.hit) {
                        p.hit = true;
                        score += 100;
                        spawnParticles(p.x + p.w / 2, p.y, 8, '#ffd700');
                        // 月アイテムを生成
                        moonItems.push({
                            x: p.x + p.w / 2 - 12,
                            y: p.y - 28,
                            w: 24,
                            h: 24,
                            vy: -4,
                            rising: true,
                            baseY: p.y - 32,
                            timer: 0,
                            collected: false,
                            collectAnim: 0,
                        });
                        updateHUD();
                    }
                }
            }
        }
    }

    overlaps(rect) {
        return this.x < rect.x + rect.w &&
               this.x + this.w > rect.x &&
               this.y < rect.y + rect.h &&
               this.y + this.h > rect.y;
    }

    die() {
        if (this.invincible > 0 || !this.alive) return;
        this.alive = false;
        lives--;
        screenShake = 15;
        spawnParticles(this.x + this.w / 2, this.y + this.h / 2, 20, '#e94560');
        updateHUD();

        setTimeout(() => {
            if (lives <= 0) {
                showGameOver();
            } else {
                respawnPlayer();
            }
        }, 1000);
    }

    draw() {
        if (!this.alive) return;
        // 無敵中は点滅
        if (this.invincible > 0 && Math.floor(this.invincible / 3) % 2 === 0) return;

        const sx = this.x - camera.x;
        const sy = this.y - camera.y;

        ctx.save();
        ctx.translate(sx + this.w / 2, sy + this.h / 2);
        ctx.scale(this.facing, 1);

        // 体
        ctx.fillStyle = '#e94560';
        ctx.fillRect(-this.w / 2, -this.h / 2 + 8, this.w, this.h - 8);

        // 頭
        ctx.fillStyle = '#ffb4a2';
        ctx.beginPath();
        ctx.arc(0, -this.h / 2 + 8, 12, 0, Math.PI * 2);
        ctx.fill();

        // 帽子
        ctx.fillStyle = '#e94560';
        ctx.fillRect(-12, -this.h / 2 - 2, 24, 8);
        ctx.fillRect(-6, -this.h / 2 - 6, 18, 6);

        // 目
        ctx.fillStyle = '#333';
        ctx.fillRect(3, -this.h / 2 + 5, 4, 4);

        // 足 (歩きアニメ)
        ctx.fillStyle = '#8B4513';
        if (this.onGround && Math.abs(this.vx) > 0.5) {
            const legOffset = Math.sin(this.walkFrame * Math.PI / 2) * 5;
            ctx.fillRect(-8, this.h / 2 - 8, 8, 8 + legOffset);
            ctx.fillRect(2, this.h / 2 - 8, 8, 8 - legOffset);
        } else if (!this.onGround) {
            // ジャンプ中
            ctx.fillRect(-10, this.h / 2 - 10, 8, 10);
            ctx.fillRect(4, this.h / 2 - 6, 8, 6);
        } else {
            ctx.fillRect(-8, this.h / 2 - 8, 8, 8);
            ctx.fillRect(2, this.h / 2 - 8, 8, 8);
        }

        ctx.restore();
    }
}

// ============================================================
// 敵クラス
// ============================================================
class Enemy {
    constructor(x, y, type = 'goomba') {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 28;
        this.vx = -ENEMY_SPEED;
        this.vy = 0;
        this.type = type;
        this.alive = true;
        this.squishTimer = 0;
        this.animTimer = 0;
    }

    update() {
        if (!this.alive) {
            this.squishTimer--;
            return this.squishTimer > 0;
        }

        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        this.x += this.vx;
        // 壁に当たったら反転
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vx > 0) this.x = p.x - this.w;
                else this.x = p.x + p.w;
                this.vx *= -1;
            }
        }

        this.y += this.vy;
        let onPlatform = false;
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vy > 0) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                    onPlatform = true;
                }
            }
        }

        // 落下防止: 地面にいるとき、進行方向の先に足場がなければ方向転換
        if (onPlatform) {
            const checkX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
            const checkY = this.y + this.h + 4;
            let hasFloor = false;
            for (const p of platforms) {
                if (checkX >= p.x && checkX <= p.x + p.w &&
                    checkY >= p.y && checkY <= p.y + p.h) {
                    hasFloor = true;
                    break;
                }
            }
            if (!hasFloor) {
                this.vx *= -1;
            }
        }

        // 画面外で消滅
        if (this.y > getLevelHeight() + 200) return false;

        this.animTimer++;
        return true;
    }

    overlaps(rect) {
        return this.x < rect.x + rect.w &&
               this.x + this.w > rect.x &&
               this.y < rect.y + rect.h &&
               this.y + this.h > rect.y;
    }

    stomp() {
        this.alive = false;
        this.squishTimer = 20;
        this.h = 10;
        this.y += 18;
        score += 200;
        spawnParticles(this.x + this.w / 2, this.y, 8, '#4aa3df');
        updateHUD();
    }

    draw() {
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;

        if (sx < -50 || sx > canvas.width + 50) return;

        ctx.save();

        if (!this.alive) {
            // 潰れたアニメ
            ctx.globalAlpha = this.squishTimer / 20;
            if (this.type === 'goomba' && enemyImgLoaded) {
                ctx.save();
                ctx.translate(sx + this.w / 2, sy + this.h / 2);
                ctx.scale(1, 0.3);
                ctx.drawImage(enemyImg, -20, -20, 40, 40);
                ctx.restore();
            } else if (this.type === 'goomba') {
                ctx.save();
                ctx.translate(sx + this.w / 2, sy + this.h / 2);
                ctx.scale(1, 0.4);
                ctx.fillStyle = '#4aa3df';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(sx, sy, this.w, this.h);
            }
            ctx.restore();
            return;
        }

        if (this.type === 'goomba') {
            if (enemyImgLoaded) {
                // いらすとやの地球キャラ画像で描画
                const imgSize = 40;
                const bounce = Math.sin(this.animTimer * 0.08) * 2;
                ctx.drawImage(enemyImg, sx - 6, sy - 8 + bounce, imgSize, imgSize);
            } else {
                // 画像未ロード時のフォールバック（Canvas描画）
                const cx = sx + this.w / 2;
                const cy = sy + this.h / 2;
                const r = 14;
                const bounce = Math.sin(this.animTimer * 0.08) * 2;
                ctx.fillStyle = '#4aa3df';
                ctx.beginPath();
                ctx.arc(cx, cy + bounce, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#7bc67e';
                ctx.beginPath();
                ctx.ellipse(cx - 5, cy - 4 + bounce, 6, 5, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(cx - 4, cy - 2 + bounce, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + 4, cy - 2 + bounce, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(cx, cy + 1 + bounce, 4, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.stroke();
            }

        } else if (this.type === 'koopa') {
            // 亀タイプ
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(sx + 4, sy, this.w - 8, this.h - 4);
            // 甲羅
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(sx + this.w / 2, sy + this.h / 2 - 2, 12, 0, Math.PI * 2);
            ctx.fill();
            // 頭
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(sx + (this.vx < 0 ? 4 : this.w - 4), sy + 6, 6, 0, Math.PI * 2);
            ctx.fill();
            // 目
            ctx.fillStyle = '#000';
            ctx.fillRect(sx + (this.vx < 0 ? 2 : this.w - 6), sy + 4, 3, 3);
        }

        ctx.restore();
    }
}

// ============================================================
// ボスクラス
// ============================================================
class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 42;
        this.h = 42;
        this.vx = -ENEMY_SPEED * 1.5;
        this.vy = 0;
        this.hp = 3;
        this.maxHp = 3;
        this.alive = true;
        this.invincible = 0;
        this.animTimer = 0;
        this.stunTimer = 0;
        this.defeated = false;
        this.defeatAnim = 0;
    }

    update() {
        if (this.defeated) {
            this.defeatAnim++;
            return this.defeatAnim < 90;
        }
        if (!this.alive) return false;
        if (this.invincible > 0) this.invincible--;
        if (this.stunTimer > 0) {
            this.stunTimer--;
            return true;
        }

        this.vy += GRAVITY;
        if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

        this.x += this.vx;
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vx > 0) this.x = p.x - this.w;
                else this.x = p.x + p.w;
                this.vx *= -1;
            }
        }

        this.y += this.vy;
        for (const p of platforms) {
            if (this.overlaps(p)) {
                if (this.vy > 0) {
                    this.y = p.y - this.h;
                    this.vy = 0;
                }
            }
        }

        this.animTimer++;
        return true;
    }

    overlaps(rect) {
        return this.x < rect.x + rect.w &&
               this.x + this.w > rect.x &&
               this.y < rect.y + rect.h &&
               this.y + this.h > rect.y;
    }

    stomp() {
        if (this.invincible > 0) return false;
        this.hp--;
        this.invincible = 90;
        this.stunTimer = 40;
        screenShake = 20;
        spawnParticles(this.x + this.w / 2, this.y, 15, '#ff6b6b');

        const speedMult = 1 + (this.maxHp - this.hp) * 0.4;
        this.vx = (this.vx > 0 ? 1 : -1) * ENEMY_SPEED * 1.5 * speedMult;

        if (this.hp <= 0) {
            this.defeated = true;
            this.alive = false;
            score += 1000;
            spawnParticles(this.x + this.w / 2, this.y + this.h / 2, 30, '#ffd700');
            updateHUD();
            return true;
        }
        updateHUD();
        return false;
    }

    draw() {
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;

        if (this.defeated) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - this.defeatAnim / 90);
            ctx.translate(sx + this.w / 2, sy + this.h / 2);
            ctx.rotate(this.defeatAnim * 0.1);
            const s = 1 + this.defeatAnim * 0.02;
            ctx.scale(s, s);
            if (enemyImgLoaded) {
                ctx.drawImage(enemyImg, -30, -30, 60, 60);
            } else {
                ctx.fillStyle = '#4aa3df';
                ctx.beginPath();
                ctx.arc(0, 0, 21, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        if (!this.alive) return;
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;

        const bounce = Math.sin(this.animTimer * 0.06) * 3;
        const imgSize = 60;

        if (enemyImgLoaded) {
            ctx.drawImage(enemyImg, sx - 9, sy - 12 + bounce, imgSize, imgSize);
        } else {
            const cx = sx + this.w / 2;
            const cy = sy + this.h / 2;
            const r = 21;
            ctx.fillStyle = '#4aa3df';
            ctx.beginPath();
            ctx.arc(cx, cy + bounce, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#7bc67e';
            ctx.beginPath();
            ctx.ellipse(cx - 7, cy - 6 + bounce, 9, 7, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(cx - 6, cy - 3 + bounce, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 6, cy - 3 + bounce, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy + 2 + bounce, 6, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
        }

        // HPバー
        const barW = 60;
        const barH = 6;
        const barX = sx + this.w / 2 - barW / 2;
        const barY = sy - 20 + bounce;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = this.hp > 1 ? '#e74c3c' : '#ff0000';
        ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
}

// ============================================================
// コインクラス
// ============================================================
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.w = 20;
        this.h = 20;
        this.collected = false;
        this.timer = 0;
        this.collectAnim = 0;
    }

    update() {
        if (this.collected) {
            this.collectAnim++;
            return this.collectAnim < 30;
        }
        this.timer++;
        this.y = this.baseY + Math.sin(this.timer * COIN_BOUNCE * Math.PI * 2) * 4;
        return true;
    }

    collect() {
        if (this.collected) return;
        this.collected = true;
        score += 50;
        spawnParticles(this.x + this.w / 2, this.y + this.h / 2, 6, '#ffd700');
        updateHUD();
    }

    draw() {
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;

        if (sx < -30 || sx > canvas.width + 30) return;

        if (this.collected) {
            // 収集アニメーション
            ctx.save();
            ctx.globalAlpha = 1 - this.collectAnim / 30;
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('+50', sx, sy - this.collectAnim);
            ctx.restore();
            return;
        }

        // コイン描画（回転アニメ）
        const scaleX = Math.cos(this.timer * 0.06);
        ctx.save();
        ctx.translate(sx + this.w / 2, sy + this.h / 2);
        ctx.scale(scaleX, 1);

        // 外枠
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        // 内側
        ctx.fillStyle = '#ffed4a';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        // $ マーク
        if (Math.abs(scaleX) > 0.3) {
            ctx.fillStyle = '#e6a800';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);
        }

        ctx.restore();
    }
}

// ============================================================
// パーティクルシステム
// ============================================================
function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 1) * 5,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            size: 2 + Math.random() * 4,
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camera.x - p.size / 2, p.y - camera.y - p.size / 2, p.size, p.size);
        ctx.restore();
    }
}

// ============================================================
// ステージデータ
// ============================================================
const LEVELS = [
    // Level 1 - 入門ステージ
    {
        width: 200, height: 15,
        bgColor1: '#5c94fc', bgColor2: '#87ceeb',
        groundY: 12,
        platforms: [
            // 地面
            { x: 0, y: 12, w: 20, h: 3, type: 'ground' },
            { x: 23, y: 12, w: 35, h: 3, type: 'ground' },
            { x: 61, y: 12, w: 50, h: 3, type: 'ground' },
            { x: 115, y: 12, w: 85, h: 3, type: 'ground' },

            // 浮きブロック
            { x: 10, y: 8, w: 3, h: 1, type: 'brick' },
            { x: 14, y: 8, w: 1, h: 1, type: 'question' },
            { x: 16, y: 8, w: 3, h: 1, type: 'brick' },

            // 階段状
            { x: 30, y: 11, w: 1, h: 1, type: 'brick' },
            { x: 31, y: 10, w: 1, h: 2, type: 'brick' },
            { x: 32, y: 9, w: 1, h: 3, type: 'brick' },
            { x: 33, y: 8, w: 1, h: 4, type: 'brick' },

            // 中間平台
            { x: 40, y: 9, w: 5, h: 1, type: 'brick' },
            { x: 42, y: 6, w: 1, h: 1, type: 'question' },

            // パイプ
            { x: 50, y: 10, w: 2, h: 2, type: 'pipe' },
            { x: 70, y: 9, w: 2, h: 3, type: 'pipe' },

            // 高台
            { x: 75, y: 7, w: 6, h: 1, type: 'brick' },
            { x: 78, y: 4, w: 1, h: 1, type: 'question' },

            // 後半エリア
            { x: 90, y: 9, w: 4, h: 1, type: 'brick' },
            { x: 96, y: 7, w: 4, h: 1, type: 'brick' },
            { x: 102, y: 9, w: 4, h: 1, type: 'brick' },

            // ゴール前階段
            { x: 120, y: 11, w: 1, h: 1, type: 'brick' },
            { x: 121, y: 10, w: 1, h: 2, type: 'brick' },
            { x: 122, y: 9, w: 1, h: 3, type: 'brick' },
            { x: 123, y: 8, w: 1, h: 4, type: 'brick' },
            { x: 124, y: 7, w: 1, h: 5, type: 'brick' },
        ],
        enemies: [
            { x: 15, y: 10, type: 'goomba' },
            { x: 35, y: 10, type: 'goomba' },
            { x: 45, y: 7, type: 'goomba' },
            { x: 65, y: 10, type: 'goomba' },
            { x: 80, y: 5, type: 'koopa' },
            { x: 95, y: 7, type: 'goomba' },
            { x: 110, y: 10, type: 'goomba' },
            { x: 115, y: 10, type: 'koopa' },
        ],
        coins: [
            { x: 10, y: 6 }, { x: 11, y: 6 }, { x: 12, y: 6 },
            { x: 25, y: 10 }, { x: 26, y: 10 }, { x: 27, y: 10 },
            { x: 41, y: 7 }, { x: 42, y: 7 }, { x: 43, y: 7 },
            { x: 76, y: 5 }, { x: 77, y: 5 }, { x: 78, y: 5 }, { x: 79, y: 5 },
            { x: 91, y: 7 }, { x: 92, y: 7 },
            { x: 97, y: 5 }, { x: 98, y: 5 },
            { x: 103, y: 7 }, { x: 104, y: 7 },
        ],
        playerStart: { x: 3, y: 10 },
        goal: { x: 130, y: 4 },
    },
    // Level 2 - 地下ステージ
    {
        width: 220, height: 15,
        bgColor1: '#1a1a2e', bgColor2: '#16213e',
        groundY: 12,
        platforms: [
            // 地面
            { x: 0, y: 12, w: 25, h: 3, type: 'ground' },
            { x: 28, y: 12, w: 40, h: 3, type: 'ground' },
            { x: 72, y: 12, w: 30, h: 3, type: 'ground' },
            { x: 106, y: 12, w: 55, h: 3, type: 'ground' },

            // 天井
            { x: 0, y: 0, w: 160, h: 1, type: 'brick' },

            // 浮きプラットフォーム
            { x: 8, y: 9, w: 4, h: 1, type: 'brick' },
            { x: 15, y: 7, w: 3, h: 1, type: 'brick' },
            { x: 13, y: 9, w: 1, h: 1, type: 'question' },
            { x: 20, y: 5, w: 4, h: 1, type: 'brick' },

            // 穴の上の足場
            { x: 25, y: 10, w: 2, h: 1, type: 'brick' },

            // パイプゾーン
            { x: 35, y: 10, w: 2, h: 2, type: 'pipe' },
            { x: 45, y: 8, w: 2, h: 4, type: 'pipe' },
            { x: 55, y: 9, w: 2, h: 3, type: 'pipe' },

            // 中間エリア足場
            { x: 40, y: 7, w: 3, h: 1, type: 'question' },
            { x: 50, y: 6, w: 5, h: 1, type: 'brick' },

            // 穴渡り
            { x: 69, y: 9, w: 2, h: 1, type: 'brick' },

            // 後半 複雑地形
            { x: 80, y: 9, w: 3, h: 1, type: 'brick' },
            { x: 85, y: 7, w: 3, h: 1, type: 'brick' },
            { x: 90, y: 5, w: 3, h: 1, type: 'question' },
            { x: 95, y: 7, w: 3, h: 1, type: 'brick' },
            { x: 100, y: 9, w: 3, h: 1, type: 'brick' },

            // ゴール前
            { x: 115, y: 9, w: 6, h: 1, type: 'brick' },
            { x: 125, y: 7, w: 4, h: 1, type: 'brick' },
            { x: 133, y: 11, w: 1, h: 1, type: 'brick' },
            { x: 134, y: 10, w: 1, h: 2, type: 'brick' },
            { x: 135, y: 9, w: 1, h: 3, type: 'brick' },
            { x: 136, y: 8, w: 1, h: 4, type: 'brick' },
            { x: 137, y: 7, w: 1, h: 5, type: 'brick' },
        ],
        enemies: [
            { x: 12, y: 10, type: 'goomba' },
            { x: 18, y: 5, type: 'goomba' },
            { x: 30, y: 10, type: 'goomba' },
            { x: 38, y: 10, type: 'koopa' },
            { x: 48, y: 10, type: 'goomba' },
            { x: 52, y: 4, type: 'goomba' },
            { x: 60, y: 10, type: 'goomba' },
            { x: 75, y: 10, type: 'goomba' },
            { x: 82, y: 7, type: 'koopa' },
            { x: 92, y: 3, type: 'goomba' },
            { x: 110, y: 10, type: 'goomba' },
            { x: 118, y: 7, type: 'koopa' },
        ],
        coins: [
            { x: 9, y: 7 }, { x: 10, y: 7 },
            { x: 16, y: 5 }, { x: 17, y: 5 },
            { x: 21, y: 3 }, { x: 22, y: 3 }, { x: 23, y: 3 },
            { x: 41, y: 5 }, { x: 42, y: 5 },
            { x: 51, y: 4 }, { x: 52, y: 4 }, { x: 53, y: 4 },
            { x: 81, y: 7 }, { x: 82, y: 7 },
            { x: 86, y: 5 }, { x: 87, y: 5 },
            { x: 91, y: 3 }, { x: 92, y: 3 },
            { x: 96, y: 5 }, { x: 97, y: 5 },
            { x: 116, y: 7 }, { x: 117, y: 7 }, { x: 118, y: 7 },
            { x: 126, y: 5 }, { x: 127, y: 5 },
        ],
        playerStart: { x: 3, y: 10 },
        goal: { x: 143, y: 4 },
    },
    // Level 3 - 空中ステージ
    {
        width: 250, height: 20,
        bgColor1: '#e17055', bgColor2: '#fdcb6e',
        groundY: 17,
        platforms: [
            // スタート地点の地面
            { x: 0, y: 15, w: 10, h: 5, type: 'ground' },

            // 空中足場（穴だらけ）
            { x: 13, y: 14, w: 4, h: 1, type: 'brick' },
            { x: 19, y: 12, w: 3, h: 1, type: 'brick' },
            { x: 24, y: 10, w: 3, h: 1, type: 'question' },
            { x: 29, y: 12, w: 4, h: 1, type: 'brick' },
            { x: 35, y: 10, w: 3, h: 1, type: 'brick' },
            { x: 40, y: 8, w: 4, h: 1, type: 'brick' },
            { x: 46, y: 10, w: 3, h: 1, type: 'question' },
            { x: 51, y: 12, w: 5, h: 1, type: 'brick' },

            // 中間地面
            { x: 58, y: 15, w: 15, h: 5, type: 'ground' },
            { x: 62, y: 11, w: 3, h: 1, type: 'brick' },
            { x: 65, y: 8, w: 1, h: 1, type: 'question' },
            { x: 68, y: 13, w: 2, h: 2, type: 'pipe' },

            // 後半空中
            { x: 76, y: 13, w: 3, h: 1, type: 'brick' },
            { x: 81, y: 11, w: 3, h: 1, type: 'brick' },
            { x: 86, y: 9, w: 3, h: 1, type: 'brick' },
            { x: 91, y: 7, w: 4, h: 1, type: 'question' },
            { x: 97, y: 9, w: 3, h: 1, type: 'brick' },
            { x: 102, y: 11, w: 3, h: 1, type: 'brick' },
            { x: 107, y: 13, w: 4, h: 1, type: 'brick' },

            // ゴール
            { x: 114, y: 15, w: 20, h: 5, type: 'ground' },
            { x: 125, y: 14, w: 1, h: 1, type: 'brick' },
            { x: 126, y: 13, w: 1, h: 2, type: 'brick' },
            { x: 127, y: 12, w: 1, h: 3, type: 'brick' },
            { x: 128, y: 11, w: 1, h: 4, type: 'brick' },
        ],
        enemies: [
            { x: 14, y: 12, type: 'goomba' },
            { x: 30, y: 10, type: 'goomba' },
            { x: 36, y: 8, type: 'koopa' },
            { x: 52, y: 10, type: 'goomba' },
            { x: 60, y: 13, type: 'goomba' },
            { x: 64, y: 13, type: 'koopa' },
            { x: 77, y: 11, type: 'goomba' },
            { x: 87, y: 7, type: 'goomba' },
            { x: 98, y: 7, type: 'koopa' },
            { x: 108, y: 11, type: 'goomba' },
            { x: 120, y: 13, type: 'goomba' },
        ],
        coins: [
            { x: 14, y: 12 }, { x: 15, y: 12 }, { x: 16, y: 12 },
            { x: 20, y: 10 }, { x: 21, y: 10 },
            { x: 30, y: 10 }, { x: 31, y: 10 },
            { x: 41, y: 6 }, { x: 42, y: 6 }, { x: 43, y: 6 },
            { x: 53, y: 10 }, { x: 54, y: 10 },
            { x: 63, y: 9 }, { x: 64, y: 9 },
            { x: 82, y: 9 }, { x: 83, y: 9 },
            { x: 92, y: 5 }, { x: 93, y: 5 }, { x: 94, y: 5 },
            { x: 103, y: 9 }, { x: 104, y: 9 },
        ],
        playerStart: { x: 3, y: 13 },
        goal: { x: 133, y: 7 },
    },
    // Level 4 - ボスステージ
    {
        width: 35, height: 15,
        bgColor1: '#2c3e50', bgColor2: '#8e44ad',
        groundY: 12,
        isBoss: true,
        platforms: [
            { x: 0, y: 12, w: 35, h: 3, type: 'ground' },
            { x: 0, y: 0, w: 1, h: 12, type: 'brick' },
            { x: 34, y: 0, w: 1, h: 12, type: 'brick' },
            { x: 5, y: 9, w: 3, h: 1, type: 'brick' },
            { x: 15, y: 8, w: 4, h: 1, type: 'brick' },
            { x: 27, y: 9, w: 3, h: 1, type: 'brick' },
        ],
        enemies: [],
        boss: { x: 25, y: 10 },
        coins: [
            { x: 6, y: 7 }, { x: 7, y: 7 },
            { x: 16, y: 6 }, { x: 17, y: 6 }, { x: 18, y: 6 },
            { x: 28, y: 7 }, { x: 29, y: 7 },
        ],
        playerStart: { x: 3, y: 10 },
        goal: null,
    },
];

// ============================================================
// ステージ読み込み
// ============================================================
function loadLevel(index) {
    if (index >= LEVELS.length) index = 0;
    currentLevel = index;

    const lvl = LEVELS[currentLevel];

    // プラットフォーム
    platforms = lvl.platforms.map(p => ({
        x: p.x * TILE,
        y: p.y * TILE,
        w: p.w * TILE,
        h: p.h * TILE,
        type: p.type,
        hit: false,
    }));

    // 敵
    enemies = lvl.enemies.map(e => new Enemy(e.x * TILE, e.y * TILE, e.type));

    // コイン
    coins = lvl.coins.map(c => new Coin(c.x * TILE, c.y * TILE));

    // ゴール
    if (lvl.goal) {
        goalFlag = {
            x: lvl.goal.x * TILE,
            y: lvl.goal.y * TILE,
            w: TILE,
            h: (lvl.groundY - lvl.goal.y) * TILE,
        };
    } else {
        goalFlag = null;
    }

    // ボス
    if (lvl.boss) {
        boss = new Boss(lvl.boss.x * TILE, lvl.boss.y * TILE);
    } else {
        boss = null;
    }

    // プレイヤー
    player = new Player(lvl.playerStart.x * TILE, lvl.playerStart.y * TILE);

    // 背景装飾
    decorations = generateDecorations(lvl);

    camera = { x: 0, y: 0 };
    particles = [];
    moonItems = [];
    startTime = Date.now();
}

function getLevelHeight() {
    return LEVELS[currentLevel].height * TILE;
}

function generateDecorations(lvl) {
    const decs = [];
    const w = lvl.width * TILE;
    // 雲
    for (let i = 0; i < lvl.width / 8; i++) {
        decs.push({
            type: 'cloud',
            x: Math.random() * w,
            y: 20 + Math.random() * 80,
            size: 30 + Math.random() * 40,
        });
    }
    // 山
    for (let i = 0; i < lvl.width / 20; i++) {
        decs.push({
            type: 'mountain',
            x: i * 20 * TILE + Math.random() * 200,
            y: lvl.groundY * TILE,
            size: 80 + Math.random() * 60,
        });
    }
    return decs;
}

// ============================================================
// 描画
// ============================================================
function drawBackground() {
    const lvl = LEVELS[currentLevel];
    // グラデーション背景
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, lvl.bgColor1);
    grad.addColorStop(1, lvl.bgColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawDecorations() {
    for (const d of decorations) {
        const sx = d.x - camera.x * 0.5; // パララックス
        const sy = d.y - camera.y * 0.3;

        if (sx < -d.size * 2 || sx > canvas.width + d.size) continue;

        if (d.type === 'cloud') {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.arc(sx, sy, d.size * 0.4, 0, Math.PI * 2);
            ctx.arc(sx + d.size * 0.3, sy - d.size * 0.15, d.size * 0.35, 0, Math.PI * 2);
            ctx.arc(sx + d.size * 0.6, sy, d.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (d.type === 'mountain') {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(sx - d.size, sy);
            ctx.lineTo(sx, sy - d.size);
            ctx.lineTo(sx + d.size, sy);
            ctx.closePath();
            ctx.fill();
        }
    }
}

function drawPlatforms() {
    for (const p of platforms) {
        const sx = p.x - camera.x;
        const sy = p.y - camera.y;

        if (sx + p.w < -10 || sx > canvas.width + 10) continue;

        switch (p.type) {
            case 'ground':
                // 地面
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(sx, sy, p.w, p.h);
                // 草
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(sx, sy, p.w, 8);
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(sx, sy, p.w, 4);
                break;

            case 'brick':
                ctx.save();
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(sx, sy, p.w, p.h);
                // クリップしてはみ出し防止
                ctx.beginPath();
                ctx.rect(sx, sy, p.w, p.h);
                ctx.clip();
                // レンガ模様
                ctx.strokeStyle = '#8B0000';
                ctx.lineWidth = 1;
                for (let bx = 0; bx < p.w; bx += TILE) {
                    for (let by = 0; by < p.h; by += TILE / 2) {
                        const offset = (Math.floor(by / (TILE / 2)) % 2) * (TILE / 2);
                        ctx.strokeRect(sx + bx + offset, sy + by, TILE, TILE / 2);
                    }
                }
                ctx.restore();
                break;

            case 'question':
                ctx.fillStyle = p.hit ? '#8B7355' : '#f39c12';
                ctx.fillRect(sx, sy, p.w, p.h);
                if (!p.hit) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 18px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('?', sx + p.w / 2, sy + p.h / 2);
                }
                // 枠
                ctx.strokeStyle = '#e67e22';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx + 1, sy + 1, p.w - 2, p.h - 2);
                break;

            case 'pipe':
                // パイプ
                ctx.fillStyle = '#27ae60';
                ctx.fillRect(sx, sy, p.w, p.h);
                // パイプの口
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(sx - 4, sy, p.w + 8, 12);
                // ハイライト
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(sx + 4, sy + 12, 6, p.h - 12);
                break;
        }
    }
}

function drawGoalFlag() {
    if (!goalFlag) return;
    const sx = goalFlag.x - camera.x;
    const sy = goalFlag.y - camera.y;

    // ポール
    ctx.fillStyle = '#666';
    ctx.fillRect(sx + 12, sy, 6, goalFlag.h);

    // 玉
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(sx + 15, sy, 8, 0, Math.PI * 2);
    ctx.fill();

    // 旗
    const flagWave = Math.sin(animFrame * 0.05) * 3;
    ctx.fillStyle = '#e94560';
    ctx.beginPath();
    ctx.moveTo(sx + 18, sy + 8);
    ctx.lineTo(sx + 45 + flagWave, sy + 15);
    ctx.lineTo(sx + 18, sy + 28);
    ctx.closePath();
    ctx.fill();

    // ★
    ctx.fillStyle = '#ffd700';
    ctx.font = '14px sans-serif';
    ctx.fillText('★', sx + 25 + flagWave / 2, sy + 22);
}

// ============================================================
// 月アイテムシステム
// ============================================================
function updateMoonItems() {
    for (let i = moonItems.length - 1; i >= 0; i--) {
        const m = moonItems[i];
        if (m.collected) {
            m.collectAnim++;
            if (m.collectAnim >= 30) {
                moonItems.splice(i, 1);
            }
            continue;
        }
        if (m.rising) {
            m.y += m.vy;
            m.vy += 0.15;
            if (m.vy >= 0) {
                m.rising = false;
                m.baseY = m.y;
            }
        } else {
            m.timer++;
            m.y = m.baseY + Math.sin(m.timer * 0.04) * 4;
        }
    }
}

function checkMoonCollisions() {
    if (!player || !player.alive) return;
    for (const m of moonItems) {
        if (m.collected) continue;
        if (player.x < m.x + m.w && player.x + player.w > m.x &&
            player.y < m.y + m.h && player.y + player.h > m.y) {
            m.collected = true;
            // 5秒間(300フレーム)の無敵時間を付与
            player.invincible = 300;
            score += 200;
            spawnParticles(m.x + m.w / 2, m.y + m.h / 2, 12, '#fffacd');
            updateHUD();
        }
    }
}

function drawMoonItems() {
    for (const m of moonItems) {
        const sx = m.x - camera.x;
        const sy = m.y - camera.y;

        if (sx < -40 || sx > canvas.width + 40) continue;

        if (m.collected) {
            // 収集アニメーション
            ctx.save();
            ctx.globalAlpha = 1 - m.collectAnim / 30;
            ctx.fillStyle = '#fffacd';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★ 無敵！', sx + m.w / 2, sy - m.collectAnim);
            ctx.restore();
            continue;
        }

        ctx.save();
        const glow = Math.sin((m.timer || 0) * 0.08) * 0.3 + 0.7;
        ctx.globalAlpha = glow;

        // 月の光彩
        ctx.fillStyle = 'rgba(255, 250, 205, 0.3)';
        ctx.beginPath();
        ctx.arc(sx + m.w / 2, sy + m.h / 2, 18, 0, Math.PI * 2);
        ctx.fill();

        // 月本体（三日月風）
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(sx + m.w / 2, sy + m.h / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        // 影で三日月にする
        ctx.fillStyle = LEVELS[currentLevel].bgColor1;
        ctx.beginPath();
        ctx.arc(sx + m.w / 2 + 5, sy + m.h / 2 - 2, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ============================================================
// カメラ
// ============================================================
function updateCamera() {
    // プレイヤーを画面中心寄りに追従
    const targetX = player.x - canvas.width * 0.35;
    const targetY = player.y - canvas.height * 0.45;

    camera.x += (targetX - camera.x) * 0.1;
    camera.y += (targetY - camera.y) * 0.08;

    // 制限
    camera.x = Math.max(0, camera.x);
    const maxX = LEVELS[currentLevel].width * TILE - canvas.width;
    if (maxX > 0) camera.x = Math.min(maxX, camera.x);

    camera.y = Math.max(-50, camera.y);
    const maxY = LEVELS[currentLevel].height * TILE - canvas.height;
    camera.y = Math.min(Math.max(0, maxY), camera.y);

    // 画面シェイク
    if (screenShake > 0) {
        camera.x += (Math.random() - 0.5) * screenShake;
        camera.y += (Math.random() - 0.5) * screenShake;
        screenShake--;
    }
}

// ============================================================
// 衝突判定（プレイヤー vs 敵/コイン/ゴール）
// ============================================================
function checkCollisions() {
    if (!player.alive) return;

    // vs 敵
    for (const e of enemies) {
        if (!e.alive) continue;
        if (player.x < e.x + e.w && player.x + player.w > e.x &&
            player.y < e.y + e.h && player.y + player.h > e.y) {
            // 上から踏んだか？
            if (player.vy > 0 && player.y + player.h - e.y < 15) {
                e.stomp();
                player.vy = JUMP_FORCE * 0.6;
            } else {
                player.die();
            }
        }
    }

    // vs ボス
    if (boss && boss.alive) {
        if (player.x < boss.x + boss.w && player.x + player.w > boss.x &&
            player.y < boss.y + boss.h && player.y + player.h > boss.y) {
            if (player.vy > 0 && player.y + player.h - boss.y < 20) {
                const defeated = boss.stomp();
                player.vy = JUMP_FORCE * 0.7;
                if (defeated) {
                    setTimeout(() => showClear(), 1500);
                }
            } else {
                player.die();
            }
        }
    }

    // vs コイン
    for (const c of coins) {
        if (c.collected) continue;
        if (player.x < c.x + c.w && player.x + player.w > c.x &&
            player.y < c.y + c.h && player.y + player.h > c.y) {
            c.collect();
        }
    }

    // vs ゴール
    if (goalFlag &&
        player.x + player.w > goalFlag.x && player.x < goalFlag.x + goalFlag.w &&
        player.y + player.h > goalFlag.y) {
        showClear();
    }
}

// ============================================================
// HUD更新
// ============================================================
function updateHUD() {
    document.getElementById('score').textContent = '🪙 ' + score;
    document.getElementById('lives').textContent = '❤️ ' + lives;
    const lvl = LEVELS[currentLevel];
    document.getElementById('level').textContent = (lvl && lvl.isBoss) ? '⚔️ BOSS' : 'WORLD 1-' + (currentLevel + 1);
}

// ============================================================
// ゲームループ
// ============================================================
function gameLoop() {
    if (gameState !== 'playing') return;

    animFrame++;

    // 更新
    player.update();
    enemies = enemies.filter(e => e.update());
    coins = coins.filter(c => c.update());
    if (boss) boss.update();
    updateParticles();
    checkCollisions();
    updateCamera();

    // 月アイテム更新
    updateMoonItems();
    checkMoonCollisions();

    // 描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawDecorations();
    drawGoalFlag();   // ゴールフラグを地面ブロックの背面に描画
    drawPlatforms();

    for (const c of coins) c.draw();
    drawMoonItems();
    for (const e of enemies) e.draw();
    if (boss) boss.draw();
    player.draw();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// ============================================================
// 画面遷移
// ============================================================
function startGame() {
    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    gameState = 'playing';
    score = 0;
    lives = 3;
    currentLevel = 0;
    loadLevel(0);
    updateHUD();
    gameLoop();
}

function respawnPlayer() {
    const lvl = LEVELS[currentLevel];
    player = new Player(lvl.playerStart.x * TILE, lvl.playerStart.y * TILE);
    player.invincible = INVINCIBLE_TIME;
    particles = [];
    camera = { x: 0, y: 0 };
    updateHUD();
}

function showGameOver() {
    gameState = 'gameover';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('gameover-screen').style.display = 'flex';
    document.getElementById('final-score').textContent = 'スコア: ' + score;
}

function restartGame() {
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    gameState = 'playing';
    score = 0;
    lives = 3;
    loadLevel(0);
    updateHUD();
    gameLoop();
}

function showClear() {
    gameState = 'clear';
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    // タイムボーナス
    const timeBonus = Math.max(0, 300 - elapsed) * 10;
    score += timeBonus;

    document.getElementById('game-container').style.display = 'none';
    document.getElementById('clear-screen').style.display = 'flex';
    document.getElementById('clear-score').textContent = 'スコア: ' + score + ' (タイムボーナス: +' + timeBonus + ')';
    document.getElementById('clear-time').textContent = 'クリアタイム: ' + elapsed + '秒';

    const lvl = LEVELS[currentLevel];
    if (lvl && lvl.isBoss) {
        document.querySelector('#clear-screen h1').textContent = '🎉 全ステージクリア！';
        document.querySelector('#clear-screen button').textContent = 'タイトルへ';
    } else {
        document.querySelector('#clear-screen h1').textContent = '🎉 ステージクリア！';
        document.querySelector('#clear-screen button').textContent = '次のステージへ';
    }
}

function nextLevel() {
    document.getElementById('clear-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    currentLevel++;
    if (currentLevel >= LEVELS.length) {
        // 全ステージクリア → タイトルに戻す
        alert('🎉 全ステージクリア！おめでとう！\n最終スコア: ' + score);
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('title-screen').style.display = 'flex';
        gameState = 'title';
        return;
    }
    gameState = 'playing';
    loadLevel(currentLevel);
    updateHUD();
    gameLoop();
}

// ============================================================
// 入力制御
// ============================================================

// --- タッチ操作 ---
function setupTouchControls() {
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnJump = document.getElementById('btn-jump');

    // 左ボタン
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    btnLeft.addEventListener('touchcancel', () => keys.left = false);

    // 右ボタン
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    btnRight.addEventListener('touchcancel', () => keys.right = false);

    // ジャンプボタン
    btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); keys.jump = true; });
    btnJump.addEventListener('touchend', (e) => { e.preventDefault(); keys.jump = false; });
    btnJump.addEventListener('touchcancel', () => keys.jump = false);

    // マウスでもボタンが動くように (デスクトップテスト用)
    btnLeft.addEventListener('mousedown', () => keys.left = true);
    btnLeft.addEventListener('mouseup', () => keys.left = false);
    btnLeft.addEventListener('mouseleave', () => keys.left = false);

    btnRight.addEventListener('mousedown', () => keys.right = true);
    btnRight.addEventListener('mouseup', () => keys.right = false);
    btnRight.addEventListener('mouseleave', () => keys.right = false);

    btnJump.addEventListener('mousedown', () => keys.jump = true);
    btnJump.addEventListener('mouseup', () => keys.jump = false);
    btnJump.addEventListener('mouseleave', () => keys.jump = false);
}

// --- キーボード操作 (PCデバッグ用) ---
function setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowLeft': case 'a': keys.left = true; break;
            case 'ArrowRight': case 'd': keys.right = true; break;
            case 'ArrowUp': case 'w': case ' ': keys.jump = true; e.preventDefault(); break;
        }
    });
    window.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'ArrowLeft': case 'a': keys.left = false; break;
            case 'ArrowRight': case 'd': keys.right = false; break;
            case 'ArrowUp': case 'w': case ' ': keys.jump = false; break;
        }
    });
}

// ============================================================
// 初期化
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupTouchControls();
    setupKeyboardControls();
    initStarField();
});

// ============================================================
// タイトル画面 - 星背景アニメーション
// ============================================================
function initStarField() {
    const canvas = document.getElementById('stars-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const stars = [];
    const STAR_COUNT = 120;
    const colors = ['#fff', '#ffcc00', '#00d4ff', '#e94560', '#88ff88'];
    
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2.5 + 0.5,
            speed: Math.random() * 0.3 + 0.1,
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.03 + 0.01,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
    
    function drawStars() {
        if (document.getElementById('title-screen').style.display === 'none') {
            return; // タイトル非表示時は停止
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (const s of stars) {
            s.twinkle += s.twinkleSpeed;
            s.y += s.speed;
            if (s.y > canvas.height) {
                s.y = -2;
                s.x = Math.random() * canvas.width;
            }
            const alpha = 0.4 + Math.sin(s.twinkle) * 0.4;
            ctx.beginPath();
            ctx.fillStyle = s.color;
            ctx.globalAlpha = Math.max(0.1, alpha);
            ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.ceil(s.size), Math.ceil(s.size));
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(drawStars);
    }
    requestAnimationFrame(drawStars);
}
