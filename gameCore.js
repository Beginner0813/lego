import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { MapEditor } from './mapEditor.js';

// 실제 3D 환경 구동, 렌더링, 환경 세팅 등을 담당하는 코어 클래스
export class GameCore {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.plane = null;
        this.gridHelper = null;
        this.composer = null;
        this.mapEditor = null;
    }

    init() {
        // 1. Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xaed7e6); // Townscaper 느낌의 부드러운 하늘색
        this.scene.fog = new THREE.FogExp2(0xaed7e6, 0.015);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(15, 15, 20);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 더 부드러운 그림자
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        document.body.appendChild(this.renderer.domElement);

        // 2. 환경 세팅 초기화
        this.setupControls();
        this.setupLights();
        this.setupEnvironment();

        // 3. Post-processing 설정
        this.setupPostProcessing();

        // 4. Map Editor (매핑용 로직) 연결
        this.mapEditor = new MapEditor(this.scene, this.camera, this.renderer, this.plane);

        // Window Resize Handler 설정
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // 3. UI logic 연결
        this.setupUI();

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

    setupUI() {
        const gridToggleBtn = document.getElementById('gridToggle');
        if (gridToggleBtn) {
            gridToggleBtn.addEventListener('click', () => {
                if (this.gridHelper) {
                    this.gridHelper.visible = !this.gridHelper.visible;
                    gridToggleBtn.innerText = `GRID: ${this.gridHelper.visible ? 'ON' : 'OFF'}`;
                }
            });
        }
    }

    setupLights() {
        // Townscaper는 강한 앰비언트 광원과 헤미스피어 라이트를 사용하여 파스텔톤의 부드러운 느낌을 줌
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x4a7a8c, 0.6);
        this.scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(20, 40, 30); // 위쪽 대각선에서 빛이 오게 설정
        directionalLight.castShadow = true;

        // 부드러운 그림자를 위한 설정
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -40;
        directionalLight.shadow.camera.right = 40;
        directionalLight.shadow.camera.top = 40;
        directionalLight.shadow.camera.bottom = -40;

        this.scene.add(directionalLight);
    }

    setupEnvironment() {
        // 1. Sky Gradient (Sphere with ShaderMaterial)
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0xaed7e6) }, // 위쪽: 부드러운 파랑
                bottomColor: { value: new THREE.Color(0xdcecf5) }, // 지평선: 조금 더 색이 있는 하늘색 (눈부심 방지)
                offset: { value: 40 }, // 지평선 위치 조절
                exponent: { value: 0.5 } // 그라데이션을 더 부드럽게
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize( vWorldPosition + offset ).y;
                    gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
                }
            `,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        // 2. Fog (지평선 색상과 동기화)
        //this.scene.fog = new THREE.FogExp2(0xffffff, 0.002);

        // 3. Grid & Base Ground
        this.gridHelper = new THREE.GridHelper(50, 50, 0x93b9c6, 0xc1d8e0);
        this.gridHelper.position.y = 0.02;
        this.gridHelper.material.opacity = 0.3;
        this.gridHelper.material.transparent = true;
        this.scene.add(this.gridHelper);

        const geometry = new THREE.PlaneGeometry(1000, 1000);
        geometry.rotateX(-Math.PI / 2);

        // Townscaper 특유의 꿀렁이는 물 (커스텀 쉐이더로 왜곡 반사 구현)
        const waterGeo = new THREE.PlaneGeometry(1000, 1000);
        this.plane = new Reflector(waterGeo, {
            clipBias: 0.1, // 지평선 근처 물체가 유령처럼 보이는 현상 해결 (Clipping 강화)
            textureWidth: window.innerWidth * window.devicePixelRatio,
            textureHeight: window.innerHeight * window.devicePixelRatio,
            color: 0x6ca3b8,
            multisample: 4
        });

        // Reflector의 기본 쉐이더를 확장하여 왜곡(Distortion) 추가
        const reflectorMaterial = this.plane.material;
        reflectorMaterial.uniforms.uTime = { value: 0 };
        reflectorMaterial.uniforms.uDistortion = { value: 0.05 }; // 왜곡 강도 증가

        reflectorMaterial.vertexShader = `
            uniform mat4 textureMatrix;
            varying vec4 vUv;
            varying vec3 vWorldPosition;
            void main() {
                vUv = textureMatrix * vec4( position, 1.0 );
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `;

        reflectorMaterial.fragmentShader = `
            uniform vec3 color;
            uniform sampler2D tDiffuse;
            uniform float uTime;
            uniform float uDistortion;
            varying vec4 vUv;
            varying vec3 vWorldPosition;

            float blendOverlay( float base, float blend ) {
                return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
            }
            vec3 blendOverlay( vec3 base, vec3 blend ) {
                return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
            }

            void main() {
                // 시간과 위치에 기반한 왜곡 계산
                vec2 distortion = vec2(
                    sin(vWorldPosition.x * 0.5 + uTime * 1.2) * uDistortion,
                    cos(vWorldPosition.z * 0.5 + uTime * 1.5) * uDistortion
                );
                
                // 반사 텍스처 샘플링 (왜곡 적용)
                vec4 reflection = texture2DProj( tDiffuse, vUv + vec4(distortion, 0.0, 0.0) );
                
                // 베이스 컬러와 믹스
                gl_FragColor = vec4( blendOverlay( reflection.rgb, color ), 0.85 );
            }
        `;

        this.plane.rotateX(-Math.PI / 2);
        this.plane.position.y = 0;
        this.plane.receiveShadow = true;
        this.plane.name = "Ground";
        this.scene.add(this.plane);

        // 물 아래 바닥면 (깊이감을 위해 더 어두운 톤)
        const floorGeo = new THREE.PlaneGeometry(1000, 1000);
        floorGeo.rotateX(-Math.PI / 2);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x4a7a8c });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -5; // 깊이감 극대화
        this.scene.add(floor);
    }

    setupPostProcessing() {
        const renderScene = new RenderPass(this.scene, this.camera);

        // 1. Ambient Occlusion (SAO) - 블록 사이의 깊이감과 그림자 강화
        const saoPass = new SAOPass(this.scene, this.camera, false, true);
        saoPass.params.saoBias = 0.5;
        saoPass.params.saoIntensity = 0.1;
        saoPass.params.saoScale = 10;
        saoPass.params.saoKernelRadius = 16;
        saoPass.params.saoMinResolution = 0;

        // 2. Townscaper 특유의 뽀샤시한(Bloom) 느낌
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.35, // strength (약간 줄여서 균형 맞춤)
            0.4,  // radius
            0.85  // threshold
        );

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(saoPass);
        this.composer.addPass(bloomPass);
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        if (this.composer) this.composer.setSize(width, height);
    }

    render() {
        requestAnimationFrame(this.render.bind(this));
        
        // 시간 기반 애니메이션 업데이트
        const time = performance.now() * 0.001;
        if (this.plane && this.plane.material && this.plane.material.uniforms && this.plane.material.uniforms.uTime) {
            this.plane.material.uniforms.uTime.value = time;
        }

        if (this.controls) this.controls.update();
        if (this.composer) {
            this.composer.render();
        } else if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}