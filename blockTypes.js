import * as THREE from 'three';

/**
 * blockTypes.js - 블록 타입 에셋 관리
 * 각 블록의 텍스처는 HTML Canvas로 절차적으로 생성됩니다.
 * 새 블록 타입 추가 시 BLOCK_TYPES 배열에 항목 추가.
 */

const SIZE = 128; // 텍스처 해상도

/** 캔버스 기반 텍스처 생성 헬퍼 (seed를 인수로 받아서 매번 다른 패턴 생성) */
function makeTexture(drawFn, seed = Math.random() * 9999) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, seed);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; // 동등한 블록 간 경계를 자연스럽게
    return tex;
}

/** 무작위 seed 기반 pseudo-random */
function seededRand(seed) {
    return ((Math.sin(seed) * 43758.5453123) % 1 + 1) % 1;
}

/** 재질에 랜덤 UV 오프셋 + 회전 적용 (bleed 방지와 모듈 반복을 줄이는 핵심 함수) */
function varyUV(mat) {
    if (!mat.map) return mat;
    // UV 오프셋: 0~1 범위에서 랜덤 이동
    mat.map.offset.set(Math.random(), Math.random());
    // 4가지 방향 중 하나로 90도 단위 회전 (0, 90, 180, 270도)
    mat.map.rotation = Math.floor(Math.random() * 4) * (Math.PI / 2);
    mat.map.needsUpdate = true;
    return mat;
}

// ─────────────────────────────────────────────────────────
//  공통 드로우 유틸리티
// ─────────────────────────────────────────────────────────

/** 기본 배경 그라디언트 */
function fillGradient(ctx, c1, c2, angle = 0) {
    const g = angle === 0
        ? ctx.createLinearGradient(0, 0, 0, SIZE)
        : ctx.createLinearGradient(0, 0, SIZE, 0);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
}

/** 노이즈 스팟 미리기 (얼룩 표현), seed 인수 추가 */
function scatterNoise(ctx, count, colors, minR, maxR, seed = 0) {
    for (let i = 0; i < count; i++) {
        const x = seededRand(i * 3.1 + seed) * SIZE;
        const y = seededRand(i * 5.7 + seed) * SIZE;
        const r = minR + seededRand(i * 7.3 + seed) * (maxR - minR);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.5 + seededRand(i * 2.9 + seed) * 0.4;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/** 수평/수직 균열 라인, seed 인수 추가 */
function drawCracks(ctx, count, color, alpha = 0.4, seed = 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
        const x1 = seededRand(i * 11 + seed) * SIZE;
        const y1 = seededRand(i * 13 + seed) * SIZE;
        const len = 10 + seededRand(i * 17 + seed) * 30;
        const ang = seededRand(i * 19 + seed) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────────────────────
//  블록별 텍스처 팩토리
// ─────────────────────────────────────────────────────────

function makeDirtSideTexture() {
    return makeTexture((ctx, s) => {
        fillGradient(ctx, '#7d4f2e', '#5e3a1e');
        scatterNoise(ctx, 40, ['#6b3f22', '#9c6b40', '#4a2e12', '#a07048'], 2, 8, s);
        drawCracks(ctx, 12, '#3d2008', 0.35, s + 100);
        ctx.strokeStyle = '#a07048';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.25;
        ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
        ctx.globalAlpha = 1;
    });
}

function makeDirtTopTexture() {
    return makeTexture((ctx, s) => {
        fillGradient(ctx, '#6b4f30', '#533b22');
        scatterNoise(ctx, 50, ['#7d5a35', '#4a3018', '#926040', '#3a2510'], 1, 6, s);
        drawCracks(ctx, 8, '#2a190a', 0.3, s + 200);
    });
}

function makeGrassSideTexture() {
    return makeTexture(ctx => {
        // 아래는 흙
        fillGradient(ctx, '#7d4f2e', '#5e3a1e');
        scatterNoise(ctx, 25, ['#6b3f22', '#9c6b40'], 2, 6);
        // 위 1/4은 풀 색
        const grassH = SIZE * 0.28;
        const g = ctx.createLinearGradient(0, 0, 0, grassH);
        g.addColorStop(0, '#4caf50');
        g.addColorStop(1, '#388e3c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SIZE, grassH);
        // 풀잎 날
        for (let i = 0; i < 18; i++) {
            const x = seededRand(i * 3) * SIZE;
            ctx.strokeStyle = i % 3 === 0 ? '#66bb6a' : '#2e7d32';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(x, grassH);
            ctx.quadraticCurveTo(x + 3, grassH * 0.5, x + (seededRand(i) * 6 - 3), 0);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    });
}

function makeGrassTopTexture() {
    return makeTexture(ctx => {
        fillGradient(ctx, '#4caf50', '#388e3c');
        scatterNoise(ctx, 30, ['#66bb6a', '#2e7d32', '#81c784', '#1b5e20'], 1, 5);
        // 밝은 하이라이트
        ctx.fillStyle = '#a5d6a7';
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, 0, SIZE / 2, SIZE / 2);
        ctx.globalAlpha = 1;
    });
}

function makeStoneTexture() {
    return makeTexture(ctx => {
        fillGradient(ctx, '#8a8a8a', '#5f5f5f');
        scatterNoise(ctx, 20, ['#757575', '#9e9e9e', '#616161', '#bdbdbd'], 3, 10);
        drawCracks(ctx, 18, '#333', 0.5);
        // 굵은 이음새 라인
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        for (let y = SIZE / 3; y < SIZE; y += SIZE / 3) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
        }
        const offsets = [0, SIZE / 2];
        offsets.forEach((ox, row) => {
            for (let x = ox; x < SIZE; x += SIZE / 2) {
                ctx.beginPath(); ctx.moveTo(x, row * SIZE / 3); ctx.lineTo(x, (row + 1) * SIZE / 3); ctx.stroke();
            }
        });
        ctx.globalAlpha = 1;
    });
}

function makeBridgeSideTexture() {
    return makeTexture(ctx => {
        fillGradient(ctx, '#a0714f', '#7a5235');
        // 나무결 라인들 (물결치는 수평선)
        for (let i = 0; i < 10; i++) {
            const y = i * (SIZE / 10);
            const color = i % 2 === 0 ? '#8b5e3c' : '#c09060';
            ctx.strokeStyle = color;
            ctx.lineWidth = (SIZE / 10) - 1;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= SIZE; x += 4) {
                ctx.lineTo(x, y + Math.sin(x * 0.15 + i) * 1.5);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // 나뭇결 얼룩
        scatterNoise(ctx, 15, ['#6b4830', '#bf8a55'], 2, 6);
        drawCracks(ctx, 5, '#3e2510', 0.3);
        // 판자 이음새
        ctx.strokeStyle = '#4e3020';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        for (let y = SIZE / 4; y < SIZE; y += SIZE / 4) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SIZE, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
    });
}

function makeRailTopTexture() {
    return makeTexture(ctx => {
        // 침목 배경 (어두운 나무)
        fillGradient(ctx, '#3e2b1a', '#2a1a0a');
        scatterNoise(ctx, 10, ['#4a3320', '#2a1a0a'], 3, 8);
        // 침목 밝은선
        ctx.fillStyle = '#6b4830';
        ctx.globalAlpha = 0.7;
        for (let y = 0; y < SIZE; y += 12) {
            ctx.fillRect(0, y, SIZE, 6);
        }
        ctx.globalAlpha = 1;
        // 레일 (은색 두 줄)
        const railW = 7;
        const railPositions = [SIZE * 0.22, SIZE * 0.72];
        railPositions.forEach(rx => {
            const g = ctx.createLinearGradient(rx, 0, rx + railW, 0);
            g.addColorStop(0, '#9e9e9e');
            g.addColorStop(0.4, '#e0e0e0');
            g.addColorStop(1, '#757575');
            ctx.fillStyle = g;
            ctx.fillRect(rx, 0, railW, SIZE);
        });
    });
}

function makeRailSideTexture() {
    return makeTexture(ctx => {
        fillGradient(ctx, '#4a3728', '#2a1e14');
        scatterNoise(ctx, 12, ['#3a2a1a', '#5a4030'], 2, 5);
        drawCracks(ctx, 6, '#1a0e06', 0.4);
        // 철 볼트 느낌
        ctx.fillStyle = '#8a8a8a';
        for (let i = 0; i < 4; i++) {
            const x = (i + 0.5) * (SIZE / 4);
            const cy = SIZE / 2;
            ctx.beginPath();
            ctx.arc(x, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

// ─────────────────────────────────────────────────────────
//  6면 재질 생성 헬퍼
//  topFn/sideFn: () => THREE.Texture 형태의 팩토리 함수를 받아
//  각 면마다 새로운 독립 텍스처를 생성합니다.
// ─────────────────────────────────────────────────────────
function makeFacedMaterial(topFn, sideFn, botFn = null) {
    // 블록마다 미세하게 다른 밝기로 인접 블록 간 구분감을 줌
    const tint = 0.85 + Math.random() * 0.30;
    const c = new THREE.Color(tint, tint, tint);

    const makeMat = (fn, roughness = 0.85) =>
        new THREE.MeshStandardMaterial({
            map: fn(),   // 매번 새 캔버스/텍스처 생성 (독립 seed)
            color: c,
            roughness,
        });

    // [+X, -X, +Y(top), -Y(bottom), +Z, -Z]
    return [
        makeMat(sideFn),
        makeMat(sideFn),
        makeMat(topFn, 0.80),
        makeMat(botFn ?? sideFn, 0.90),
        makeMat(sideFn),
        makeMat(sideFn),
    ];
}

// ─────────────────────────────────────────────────────────
//  블록 타입 목록 (여기에 추가하세요)
// ─────────────────────────────────────────────────────────
export const BLOCK_TYPES = [
    {
        id: 'grass',
        label: '잔디',
        emoji: '🌿',
        createMaterial() {
            return makeFacedMaterial(makeGrassTopTexture, makeGrassSideTexture);
        }
    },
    {
        id: 'dirt',
        label: '흙',
        emoji: '🟫',
        createMaterial() {
            return makeFacedMaterial(makeDirtTopTexture, makeDirtSideTexture);
        }
    },
    {
        id: 'stone',
        label: '돌',
        emoji: '🪨',
        createMaterial() {
            const tint = 0.85 + Math.random() * 0.30;
            const c = new THREE.Color(tint, tint, tint);
            return [0, 1, 2, 3, 4, 5].map(() =>
                new THREE.MeshStandardMaterial({
                    map: makeStoneTexture(),
                    color: c,
                    roughness: 0.7,
                    metalness: 0.05,
                })
            );
        }
    },
    {
        id: 'bridge',
        label: '나무(다리)',
        emoji: '🌉',
        createMaterial() {
            return makeFacedMaterial(makeBridgeSideTexture, makeBridgeSideTexture);
        }
    },
    {
        id: 'rail',
        label: '철도',
        emoji: '🛤️',
        createMaterial() {
            return makeFacedMaterial(makeRailTopTexture, makeRailSideTexture);
        }
    },
];
