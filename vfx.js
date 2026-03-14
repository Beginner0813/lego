import * as THREE from 'three';

/**
 * vfx.js - 블록 설치 이펙트 관리
 * gameCore.js에 의존하지 않고 자체 루프로 동작합니다.
 */

const _active = [];

// 자체 독립 애니메이션 루프
function loop() {
    requestAnimationFrame(loop);

    const now = performance.now();
    for (let i = _active.length - 1; i >= 0; i--) {
        const anim = _active[i];
        const t = Math.min((now - anim.startTime) / anim.duration, 1);

        if (anim.type === 'pop') {
            const s = elasticOut(t);
            anim.mesh.scale.set(s, s, s);
            if (t >= 1) {
                anim.mesh.scale.set(1, 1, 1);
                _active.splice(i, 1);
            }
        }

        if (anim.type === 'particle') {
            anim.particles.forEach(p => {
                p.mesh.position.addScaledVector(p.velocity, 0.016);
                p.velocity.y -= 0.012;
                p.mesh.material.opacity = 1 - t;
                const s = 1 - t * 0.7;
                p.mesh.scale.set(s, s, s);
            });
            if (t >= 1) {
                anim.particles.forEach(p => {
                    anim.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                });
                _active.splice(i, 1);
            }
        }
    }
}

loop(); // 모듈 로드 시 즉시 시작

/** 탄성 팝 이징 (elasticOut) */
function elasticOut(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1;
}

/**
 * 블록 설치 이펙트 실행
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} voxel - 새로 설치된 블록 mesh
 */
export function playPlaceEffect(scene, voxel) {
    // 1. 팝 스케일 애니메이션
    voxel.scale.set(0.01, 0.01, 0.01);
    _active.push({
        type: 'pop',
        mesh: voxel,
        startTime: performance.now(),
        duration: 400,
    });

    // 2. 파티클 버스트
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const particles = [];
    const particleColors = [0xffd700, 0xffffff, 0xaaddff, 0xffaa55];

    for (let i = 0; i < 10; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: particleColors[i % particleColors.length],
            transparent: true,
            opacity: 1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(voxel.position);

        const angle = (i / 10) * Math.PI * 2;
        const hSpeed = 0.03 + Math.random() * 0.05;
        const velocity = new THREE.Vector3(
            Math.cos(angle) * hSpeed,
            0.09 + Math.random() * 0.07,
            Math.sin(angle) * hSpeed
        );

        scene.add(mesh);
        particles.push({ mesh, velocity });
    }

    _active.push({
        type: 'particle',
        particles,
        scene,
        startTime: performance.now(),
        duration: 600,
    });
}
