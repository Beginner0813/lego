import * as THREE from 'three';
import { BLOCK_TYPES } from './blockTypes.js';
import { playPlaceEffect } from './vfx.js';

// 맵퍼 상태 및 공통 자원 관리용 모듈
export class MapEditor {
    constructor(scene, camera, renderer, plane) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.plane = plane;

        this.objects = [plane];
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.isShiftDown = false;
        this.pointerDownPos = new THREE.Vector2();
        this._isDragging = false; // 드래그 여부 체크용

        // 블록 미리보기 Mesh
        const rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        this.rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, this.rollOverMaterial);
        this.rollOverMesh.scale.set(1.02, 1.02, 1.02);
        this.scene.add(this.rollOverMesh);

        this.cubeGeo = new THREE.BoxGeometry(1, 1, 1);

        // 선택된 블록 타입 (blockTypes.js에서 관리)
        this.currentBlockTypeIndex = 0;

        // 블록 선택 UI 동적 추가
        this.createBlockSelectorUI();

        // 클릭 판별을 위한 수평 Y=0 평면 (바닥면)
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        document.addEventListener('keydown', this.onDocumentKeyDown.bind(this));
        document.addEventListener('keyup', this.onDocumentKeyUp.bind(this));
    }

    /** 블록 선택 UI를 동적으로 생성 */
    createBlockSelectorUI() {
        const container = document.createElement('div');
        container.id = 'block-selector';
        Object.assign(container.style, {
            position: 'absolute', bottom: '20px', left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: '8px',
            background: 'rgba(0,0,0,0.45)',
            padding: '8px 14px', borderRadius: '12px',
            backdropFilter: 'blur(6px)',
        });

        BLOCK_TYPES.forEach((type, i) => {
            const btn = document.createElement('button');
            btn.dataset.index = i;
            btn.title = type.label;
            btn.innerHTML = `<span style="font-size:22px">${type.emoji}</span><br>
                             <span style="font-size:10px;color:#ccc">${type.label}</span>`;
            Object.assign(btn.style, {
                background: i === 0 ? 'rgba(255,255,255,0.3)' : 'transparent',
                border: i === 0 ? '2px solid #fff' : '2px solid transparent',
                borderRadius: '8px', cursor: 'pointer',
                padding: '6px 10px', color: '#fff', textAlign: 'center',
                transition: 'all 0.15s',
            });
            btn.addEventListener('click', () => this.selectBlock(i));
            container.appendChild(btn);
        });

        document.body.appendChild(container);
        this._selectorContainer = container;
    }

    selectBlock(index) {
        this.currentBlockTypeIndex = index;
        // 단순히 선택된 버튼 하이라이트
        [...this._selectorContainer.querySelectorAll('button')].forEach((btn, i) => {
            const active = i === index;
            btn.style.background = active ? 'rgba(255,255,255,0.3)' : 'transparent';
            btn.style.border = active ? '2px solid #fff' : '2px solid transparent';
        });
    }

    /**
     * 마우스 위치를 normalized device coordinates로 변환해 레이케스터 업데이트
     */
    updatePointer(event) {
        this.pointer.set(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(this.pointer, this.camera);
    }

    /**
     * 바닥(y=0) 위 클릭 위치를 격자에 스냅하여 반환
     * 반환값: THREE.Vector3 | null
     */
    getSnappedGroundPos() {
        const hitPoint = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint);
        if (!hit) return null;

        // X와 Z를 격자 단위(1)로 스냅 (각 셀 중심인 0.5 단위)
        hitPoint.x = Math.floor(hitPoint.x) + 0.5;
        hitPoint.y = 0.5; // 블록이 바닥 위에 딱 붙도록
        hitPoint.z = Math.floor(hitPoint.z) + 0.5;
        return hitPoint;
    }

    onPointerMove(event) {
        this.updatePointer(event);

        // 삭제 모드: 기존 블록 위에 빨간 미리보기
        if (this.isShiftDown) {
            const blockHits = this.raycaster.intersectObjects(
                this.objects.filter(o => o !== this.plane), false
            );
            if (blockHits.length > 0) {
                this.rollOverMesh.position.copy(blockHits[0].object.position);
                this.rollOverMesh.visible = true;
                this.rollOverMaterial.color.setHex(0xff0000);
                return;
            }
            this.rollOverMesh.visible = false;
            return;
        }

        // 설치 모드: 기존 블록 면에 붙이거나 바닥에 설치
        const blockHits = this.raycaster.intersectObjects(
            this.objects.filter(o => o !== this.plane), false
        );

        if (blockHits.length > 0) {
            // 맞닿은 면의 법선 방향으로 한 칸 이동하여 미리보기
            const hit = blockHits[0];
            const adjacent = hit.object.position.clone().add(
                hit.face.normal.clone().round()
            );
            const occupied = this.objects.find(
                o => o !== this.plane && o.position.distanceTo(adjacent) < 0.1
            );
            this.rollOverMesh.position.copy(adjacent);
            this.rollOverMesh.visible = !occupied;
            this.rollOverMaterial.color.setHex(0xffffff);
            return;
        }

        // 바닥 격자에 흰색 미리보기
        const snapped = this.getSnappedGroundPos();
        if (snapped) {
            const occupied = this.objects.find(
                o => o !== this.plane && o.position.distanceTo(snapped) < 0.1
            );
            this.rollOverMesh.position.copy(snapped);
            this.rollOverMesh.visible = !occupied;
            this.rollOverMaterial.color.setHex(0xffffff);
        } else {
            this.rollOverMesh.visible = false;
        }
    }

    onPointerDown(event) {
        if (event.button !== 0) return;
        this.pointerDownPos.set(event.clientX, event.clientY);
    }

    onPointerUp(event) {
        if (event.button !== 0) return;

        // 드래그(시점 회전)와 클릭(블록 설치) 구분
        if (
            Math.abs(event.clientX - this.pointerDownPos.x) > 3 ||
            Math.abs(event.clientY - this.pointerDownPos.y) > 3
        ) return;

        this.updatePointer(event);

        // --- 삭제 모드 ---
        if (this.isShiftDown) {
            const blockHits = this.raycaster.intersectObjects(
                this.objects.filter(o => o !== this.plane), false
            );
            if (blockHits.length > 0) {
                const target = blockHits[0].object;
                this.scene.remove(target);
                this.objects.splice(this.objects.indexOf(target), 1);
            }
            return;
        }

        // --- 설치 모드 ---
        // 1순위: 바닥 격자에 스냅 (기본 동작)
        let placePos = this.getSnappedGroundPos();

        // 2순위: 커서가 기존 블록의 면 위에 있으면 그 면에 연보이기
        const blockHits = this.raycaster.intersectObjects(
            this.objects.filter(o => o !== this.plane), false
        );
        if (blockHits.length > 0) {
            const hit = blockHits[0];
            placePos = hit.object.position.clone().add(
                hit.face.normal.clone().round()
            );
        }

        if (!placePos) return;

        // 중복 설치 방지
        const exists = this.objects.find(
            o => o !== this.plane && o.position.distanceTo(placePos) < 0.1
        );
        if (exists) return;

        const blockType = BLOCK_TYPES[this.currentBlockTypeIndex];
        const voxel = new THREE.Mesh(this.cubeGeo, blockType.createMaterial());
        voxel.position.copy(placePos);
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        this.scene.add(voxel);
        this.objects.push(voxel);

        // 설치 이펙트 실행
        playPlaceEffect(this.scene, voxel);
    }

    onDocumentKeyDown(event) {
        if (event.key === 'Shift') this.isShiftDown = true;
    }

    onDocumentKeyUp(event) {
        if (event.key === 'Shift') this.isShiftDown = false;
    }
}
