import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapEditor } from './mapEditor.js';

// 실제 3D 환경 구동, 렌더링, 환경 세팅 등을 담당하는 코어 클래스
export class GameCore {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.plane = null;
        this.mapEditor = null;
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdcecf5); // Townscaper 느낌의 맑은 하늘색
        this.scene.fog = new THREE.FogExp2(0xdcecf5, 0.02);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(15, 15, 20);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // 2. 환경 세팅 초기화
        this.setupControls();
        this.setupLights();
        this.setupEnvironment();

        // 3. Map Editor (매핑용 로직) 연결
        this.mapEditor = new MapEditor(this.scene, this.camera, this.renderer, this.plane);

        // Window Resize Handler 설정
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // 4. 게임 루프 시작
        this.render();
    }

    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // 우클릭으로 팬, 좌클릭 드래그로 회전
        this.controls.enableZoom = true;
        this.controls.zoomSpeed = 0.01;

        // 커스텀 단계별 줌 설정
        const zoomSteps = [20, 30, 40, 50, 60];
        let currentZoomIndex = zoomSteps.length - 1;

        this.controls.minDistance = zoomSteps[currentZoomIndex];
        this.controls.maxDistance = zoomSteps[currentZoomIndex];

        window.addEventListener('wheel', (event) => {
            if (event.deltaY < 0) {
                currentZoomIndex = Math.max(0, currentZoomIndex - 1);
            } else if (event.deltaY > 0) {
                currentZoomIndex = Math.min(zoomSteps.length - 1, currentZoomIndex + 1);
            }
            this.controls.minDistance = zoomSteps[currentZoomIndex];
            this.controls.maxDistance = zoomSteps[currentZoomIndex];
        });
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

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
        this.scene.add(directionalLight);
    }

    setupEnvironment() {
        // Grid
        const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
        gridHelper.position.y = 0.01; // Z-fighting 방지
        this.scene.add(gridHelper);

        // Water (Base Ground)
        const geometry = new THREE.PlaneGeometry(200, 200);
        geometry.rotateX(-Math.PI / 2);
        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x6ca3b8, // 잔잔한 물 느낌
            roughness: 0.1,
            metalness: 0.1
        });
        
        this.plane = new THREE.Mesh(geometry, waterMaterial);
        this.plane.receiveShadow = true;
        this.plane.name = "Ground";
        this.scene.add(this.plane);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        requestAnimationFrame(this.render.bind(this));
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}
