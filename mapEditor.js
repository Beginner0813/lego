import * as THREE from 'three';

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

        // 블록 미리보기 Mesh
        const rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        this.rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, this.rollOverMaterial);
        this.rollOverMesh.scale.set(1.02, 1.02, 1.02);
        this.scene.add(this.rollOverMesh);

        this.cubeGeo = new THREE.BoxGeometry(1, 1, 1);
        // Townscaper風 파스텔톤 색상들
        this.colors = [0xeb6468, 0xefad50, 0x76b052, 0x47b2c5, 0xe2d6b3, 0x8a91a1];

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

        // 드래그와 클릭 구분 (3px 이상 움직이면 드래그로 판단)
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

        // 2순위: 커서가 기존 블록의 면 위에 있으면 그 면에 붙이기
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

        const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
        const cubeMat = new THREE.MeshStandardMaterial({
            color: randomColor,
            roughness: 0.6,
            metalness: 0.1
        });

        const voxel = new THREE.Mesh(this.cubeGeo, cubeMat);
        voxel.position.copy(placePos);  // ← 수정: snapped → placePos
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        this.scene.add(voxel);
        this.objects.push(voxel);
    }

    onDocumentKeyDown(event) {
        if (event.key === 'Shift') this.isShiftDown = true;
    }

    onDocumentKeyUp(event) {
        if (event.key === 'Shift') this.isShiftDown = false;
    }
}
