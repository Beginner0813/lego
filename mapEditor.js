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

        // Voxel Placement Logic
        const rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        const rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
        // 약간 크게 만들어서 겹쳐 보이지 않게 함
        this.rollOverMesh.scale.set(1.02, 1.02, 1.02);
        this.scene.add(this.rollOverMesh);

        this.cubeGeo = new THREE.BoxGeometry(1, 1, 1);
        // Townscaper風 파스텔톤 색상들
        this.colors = [0xeb6468, 0xefad50, 0x76b052, 0x47b2c5, 0xe2d6b3, 0x8a91a1];

        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
        document.addEventListener('pointerdown', this.onPointerDown.bind(this));
        document.addEventListener('pointerup', this.onPointerUp.bind(this));
        document.addEventListener('keydown', this.onDocumentKeyDown.bind(this));
        document.addEventListener('keyup', this.onDocumentKeyUp.bind(this));
    }

    onPointerMove(event) {
        this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);

        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects, false);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            // 대상이 바닥(plane)이 아닐 때만 면의 법선(normal)을 더해 바깥쪽으로 위치시킴
            const calcPos = new THREE.Vector3().copy(intersect.point);
            if (intersect.object !== this.plane) {
                calcPos.add(intersect.face.normal);
            }

            this.rollOverMesh.position.copy(calcPos);
            // Grid 스냅 (0.5 단위로 중앙 정렬)
            this.rollOverMesh.position.floor().addScalar(0.5);

            // Y 좌표가 정확히 바닥 위(0.5지점)이고, Z 좌표가 0일 때만 유효함
            let isValidPosition = (this.rollOverMesh.position.z === 0.5 && this.rollOverMesh.position.y === 0.5);

            // 삭제 모드일 때 클릭한 대상이 바닥이 아니라면, 해당 블록 위치에 표시
            if (this.isShiftDown && intersect.object !== this.plane) {
                this.rollOverMesh.position.copy(intersect.object.position);
                isValidPosition = true;
            }

            if (isValidPosition) {
                this.rollOverMesh.visible = true;
                // 지울 때는 빨간색, 설치할 때는 흰색으로 반투명 표시
                this.rollOverMesh.material.color.setHex(this.isShiftDown ? 0xff0000 : 0xffffff);
            } else {
                this.rollOverMesh.visible = false; // 격자 바닥 위나 Z=0 영역 밖이면 가이드 숨김
            }
        }
    }

    onPointerDown(event) {
        if (event.button !== 0) return; // 왼쪽 클릭만 확인
        this.pointerDownPos.set(event.clientX, event.clientY);
    }

    onPointerUp(event) {
        if (event.button !== 0) return; // 왼쪽 클릭만 확인

        // 드래그(시점 이동)와 클릭(블록 설치) 구분
        if (Math.abs(event.clientX - this.pointerDownPos.x) > 3 || Math.abs(event.clientY - this.pointerDownPos.y) > 3) {
            return;
        }

        this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.objects, false);

        if (intersects.length > 0) {
            const intersect = intersects[0];

            // Shift 키를 누른 상태면 블록 삭제
            if (this.isShiftDown) {
                if (intersect.object !== this.plane) {
                    this.scene.remove(intersect.object);
                    this.objects.splice(this.objects.indexOf(intersect.object), 1);
                }
                // 아니면 블록 설치
            } else {
                const targetPos = new THREE.Vector3().copy(intersect.point);
                if (intersect.object !== this.plane) {
                    targetPos.add(intersect.face.normal);
                }
                targetPos.floor().addScalar(0.5);

                // z=0 구역이 아니거나, 바로 바닥(y=0.5) 위가 아니면 생성 취소
                if (targetPos.z !== 0.5 || targetPos.y !== 0.5) return;

                // 동일한 위치에 이미 블록이 있는지 확인 (중복 설치 방지)
                const exists = this.objects.find(obj => obj !== this.plane && obj.position.distanceTo(targetPos) < 0.1);
                if (!exists) {
                    const randomColor = this.colors[Math.floor(Math.random() * this.colors.length)];
                    const cubeMat = new THREE.MeshStandardMaterial({
                        color: randomColor,
                        roughness: 0.6,
                        metalness: 0.1
                    });

                    const voxel = new THREE.Mesh(this.cubeGeo, cubeMat);
                    voxel.position.copy(targetPos);
                    voxel.castShadow = true;
                    voxel.receiveShadow = true;
                    this.scene.add(voxel);
                    this.objects.push(voxel);
                }
            }
        }
    }

    onDocumentKeyDown(event) {
        if (event.key === 'Shift') this.isShiftDown = true;
    }

    onDocumentKeyUp(event) {
        if (event.key === 'Shift') this.isShiftDown = false;
    }
}
