import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcecf5); // Townscaper 느낌의 맑은 하늘색
scene.fog = new THREE.FogExp2(0xdcecf5, 0.02);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(15, 15, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 우클릭으로 팬, 좌클릭 드래그로 회전
controls.enableZoom = true;
controls.zoomSpeed = 0.01; // 마우스 휠 미세 줌 방지

// 커스텀 단계별 줌 설정
const zoomSteps = [20, 30, 40, 50, 60];
let currentZoomIndex = zoomSteps.length - 1; // 시작 시 가장 멀리(60)

// 처음 시작 시 카메라 거리를 줌 단계와 일치시킴
controls.minDistance = zoomSteps[currentZoomIndex];
controls.maxDistance = zoomSteps[currentZoomIndex];

window.addEventListener('wheel', (event) => {
    // 휠 올림 (줌 인)
    if (event.deltaY < 0) {
        currentZoomIndex = Math.max(0, currentZoomIndex - 1);
    }
    // 휠 내림 (줌 아웃)
    else if (event.deltaY > 0) {
        currentZoomIndex = Math.min(zoomSteps.length - 1, currentZoomIndex + 1);
    }
    // OrbitControls의 거리를 제한하여 부드럽게(damping) 줌인/아웃되도록 유도
    controls.minDistance = zoomSteps[currentZoomIndex];
    controls.maxDistance = zoomSteps[currentZoomIndex];
});

// 2. Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffee, 1.2);
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
scene.add(directionalLight);

// 3. Grid & Base Ground (Water-like)
const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
gridHelper.position.y = 0.01; // Z-fighting 방지
scene.add(gridHelper);

const geometry = new THREE.PlaneGeometry(200, 200);
geometry.rotateX(-Math.PI / 2);
const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x6ca3b8, // 잔잔한 물 느낌
    roughness: 0.1,
    metalness: 0.1
});
const plane = new THREE.Mesh(geometry, waterMaterial);
plane.receiveShadow = true;
plane.name = "Ground";
scene.add(plane);

const objects = [plane];

// 4. Voxel Placement Logic
const rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
const rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true });
const rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
// 약간 크게 만들어서 겹쳐 보이지 않게 함
rollOverMesh.scale.set(1.02, 1.02, 1.02);
scene.add(rollOverMesh);

const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
// Townscaper風 파스텔톤 색상들
const colors = [0xeb6468, 0xefad50, 0x76b052, 0x47b2c5, 0xe2d6b3, 0x8a91a1];

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let isShiftDown = false;
let pointerDownPos = new THREE.Vector2();

document.addEventListener('pointermove', onPointerMove);
document.addEventListener('pointerdown', onPointerDown);
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('keydown', onDocumentKeyDown);
document.addEventListener('keyup', onDocumentKeyUp);
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event) {
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];

        // 대상이 바닥(plane)이 아닐 때만 면의 법선(normal)을 더해 바깥쪽으로 위치시킴
        const calcPos = new THREE.Vector3().copy(intersect.point);
        if (intersect.object !== plane) {
            calcPos.add(intersect.face.normal);
        }

        rollOverMesh.position.copy(calcPos);
        // Grid 스냅 (0.5 단위로 중앙 정렬)
        rollOverMesh.position.floor().addScalar(0.5);

        // Y 좌표가 정확히 바닥 위(0.5지점)이고, Z 좌표가 0일 때만 유효함
        let isValidPosition = (rollOverMesh.position.z === 0.5 && rollOverMesh.position.y === 0.5);

        // 삭제 모드일 때 클릭한 대상이 바닥이 아니라면, 해당 블록 위치에 표시
        if (isShiftDown && intersect.object !== plane) {
            rollOverMesh.position.copy(intersect.object.position);
            isValidPosition = true;
        }

        if (isValidPosition) {
            rollOverMesh.visible = true;
            // 지울 때는 빨간색, 설치할 때는 흰색으로 반투명 표시
            rollOverMaterial.color.setHex(isShiftDown ? 0xff0000 : 0xffffff);
        } else {
            rollOverMesh.visible = false; // 격자 바닥 위나 Z=0 영역 밖이면 가이드 숨김
        }
    }
}

function onPointerDown(event) {
    if (event.button !== 0) return; // 왼쪽 클릭만 확인
    pointerDownPos.set(event.clientX, event.clientY);
}

function onPointerUp(event) {
    if (event.button !== 0) return; // 왼쪽 클릭만 확인

    // 드래그(시점 이동)와 클릭(블록 설치) 구분
    if (Math.abs(event.clientX - pointerDownPos.x) > 3 || Math.abs(event.clientY - pointerDownPos.y) > 3) {
        return;
    }

    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];

        // Shift 키를 누른 상태면 블록 삭제
        if (isShiftDown) {
            if (intersect.object !== plane) {
                scene.remove(intersect.object);
                objects.splice(objects.indexOf(intersect.object), 1);
            }
            // 아니면 블록 설치
        } else {
            const targetPos = new THREE.Vector3().copy(intersect.point);
            if (intersect.object !== plane) {
                targetPos.add(intersect.face.normal);
            }
            targetPos.floor().addScalar(0.5);

            // z=0 구역이 아니거나, 바로 바닥(y=0.5) 위가 아니면 생성 취소
            if (targetPos.z !== 0.5 || targetPos.y !== 0.5) return;

            // 동일한 위치에 이미 블록이 있는지 확인 (중복 설치 방지)
            const exists = objects.find(obj => obj !== plane && obj.position.distanceTo(targetPos) < 0.1);
            if (!exists) {
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const cubeMat = new THREE.MeshStandardMaterial({
                    color: randomColor,
                    roughness: 0.6,
                    metalness: 0.1
                });

                const voxel = new THREE.Mesh(cubeGeo, cubeMat);
                voxel.position.copy(targetPos);
                voxel.castShadow = true;
                voxel.receiveShadow = true;
                scene.add(voxel);
                objects.push(voxel);
            }
        }
    }
}

function onDocumentKeyDown(event) {
    if (event.key === 'Shift') isShiftDown = true;
}

function onDocumentKeyUp(event) {
    if (event.key === 'Shift') isShiftDown = false;
}

// 5. Game Loop
function render() {
    requestAnimationFrame(render);
    controls.update(); // Damping을 위해 필요
    renderer.render(scene, camera);
}

render();
