import * as THREE from "three";

const TYPING_SPEED = 80;
const DELETING_SPEED = 40;
const PAUSE_AFTER_TYPING = 1800;
const PAUSE_AFTER_DELETING = 450;
const CONTACT_EMAIL = "bball8.bc@gmail.com";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* LAPTOP */
/* Don't ask me how I made this work, I have no clue either (just need to change my broken monitor and keyboard ^^). But hey, it does work so I won't ever touch ig again ;D */
(function initThreeLaptopHero() {
    const container = document.getElementById("laptopScene");
    const copy = document.getElementById("screenCopy");
    const fallback = document.querySelector(".hero-fallback-copy");

    if (!container || !copy) return;

    if (!isWebGLAvailable()) {
        container.style.display = "none";
        if (fallback) fallback.style.display = "block";
        return;
    }

    const screenData = getScreenData(copy);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
    camera.position.set(0, 1.65, 7.45);

    const CAMERA_TARGET = new THREE.Vector3(0, 1.05, 0.05);
    const OPEN_DELAY = 0.85;
    const OPEN_DURATION = 2.65;

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 1600;
    screenCanvas.height = 900;
    const screenCtx = screenCanvas.getContext("2d");
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const screenState = {
        phraseIndex: 0,
        charIndex: 0,
        deleting: false,
        lastTypeAt: 0,
        typedRole: "",
        hoverAction: null,
        buttonHitAreas: [],
    };

    const laptop = new THREE.Group();
    laptop.rotation.x = -0.045;
    scene.add(laptop);
    laptop.scale.set(1.1, 1.1, 1.1);
    laptop.position.set(0, 0, 0);

    const materials = createMaterials();
    const { lidGroup, screenMesh } = buildLaptop(laptop, materials, screenTexture);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(8.5, 5.6),
        new THREE.ShadowMaterial({ opacity: 0.24 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.17, 0.55);
    shadow.receiveShadow = true;
    scene.add(shadow);

    addLights(scene);

    const CLOSED_ANGLE = 1.36;
    const OPEN_ANGLE = -0.28;
    lidGroup.rotation.x = prefersReducedMotion ? OPEN_ANGLE : CLOSED_ANGLE;

    const target = {
        rotX: laptop.rotation.x,
        rotY: 0,
        rotZ: 0,
    };

    container.addEventListener("pointermove", (event) => {
        if (prefersReducedMotion) return;

        const rect = container.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;

        target.rotY = x * 0.28;
        target.rotX = -0.045 + y * 0.12;
        target.rotZ = -x * 0.035;

        const action = getScreenActionFromPointer(event, rect, renderer, camera, raycaster, pointer, screenMesh, screenState);
        screenState.hoverAction = action;
        renderer.domElement.style.cursor = action ? "pointer" : "grab";
    });

    container.addEventListener("pointerleave", () => {
        screenState.hoverAction = null;
        renderer.domElement.style.cursor = "default";
        target.rotX = -0.045;
        target.rotY = 0;
        target.rotZ = 0;
    });

    container.addEventListener("click", (event) => {
        const rect = container.getBoundingClientRect();
        const action = getScreenActionFromPointer(event, rect, renderer, camera, raycaster, pointer, screenMesh, screenState);

        if (action === "projects") {
            document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
        }

        if (action === "contact") {
            document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
        }
    });

    function resize() {
        const width = Math.max(1, container.clientWidth);
        const height = Math.max(1, container.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    window.addEventListener("resize", resize);
    resize();

    function animate() {
        const elapsed = clock.getElapsedTime();
        const now = performance.now();

        updateTypingState(screenData.roles, screenState, now);
        drawLaptopScreen(screenCtx, screenCanvas, screenData, screenState, now);
        screenTexture.needsUpdate = true;

        if (!prefersReducedMotion) {
            const openT = THREE.MathUtils.clamp((elapsed - OPEN_DELAY) / OPEN_DURATION, 0, 1);
            lidGroup.rotation.x = THREE.MathUtils.lerp(CLOSED_ANGLE, OPEN_ANGLE, easeOutCubic(openT));
            
            laptop.position.y = Math.sin(elapsed * 1.15) * 0.045;
            laptop.rotation.x += (target.rotX - laptop.rotation.x) * 0.075;
            laptop.rotation.y += (target.rotY - laptop.rotation.y) * 0.075;
            laptop.rotation.z += (target.rotZ - laptop.rotation.z) * 0.075;
        }

        camera.lookAt(CAMERA_TARGET);
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    if (document.fonts?.ready) {
        document.fonts.ready.then(() => animate());
    } else {
        animate();
    }
})();

function buildLaptop(root, materials, screenTexture) {
    const SCREEN_W = 5.25;
    const SCREEN_H = 2.95;
    const LID_THICKNESS = 0.12;

    const base = new THREE.Mesh(
        new THREE.BoxGeometry(5.95, 0.16, 3.65),
        materials.base
    );
    base.position.set(0, 0, 0.15);
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);
    root.add(edgeLines(base, 0xbbb5cf, 0.18));

    const baseLip = new THREE.Mesh(
        new THREE.BoxGeometry(6.12, 0.055, 3.82),
        materials.baseLip
    );
    baseLip.position.set(0, 0.105, 0.15);
    baseLip.castShadow = true;
    baseLip.receiveShadow = true;
    root.add(baseLip);

    const keyboardWell = new THREE.Mesh(
        new THREE.BoxGeometry(4.9, 0.018, 1.72),
        materials.keyboardWell
    );
    keyboardWell.position.set(0, 0.205, -0.18);
    keyboardWell.receiveShadow = true;
    root.add(keyboardWell);

    addKeyboard(root, materials);

    const trackpad = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 0.024, 0.72),
        materials.trackpad
    );
    trackpad.position.set(0, 0.218, 1.34);
    trackpad.receiveShadow = true;
    root.add(trackpad);

    const notch = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.027, 0.04),
        materials.notch
    );
    notch.position.set(0, 0.225, 1.985);
    root.add(notch);

    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.16, -1.72);
    root.add(lidGroup);

    const lid = new THREE.Mesh(
        new THREE.BoxGeometry(5.78, SCREEN_H + 0.48, LID_THICKNESS),
        materials.lid
    );
    lid.position.set(0, (SCREEN_H + 0.48) / 2, 0);
    lid.castShadow = true;
    lid.receiveShadow = true;
    lidGroup.add(lid);
    lidGroup.add(edgeLines(lid, 0x6e5aa8, 0.32));

    const screenGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN_W + 0.18, SCREEN_H + 0.18),
        materials.screenGlow
    );
    screenGlow.position.set(0, (SCREEN_H + 0.48) / 2 + 0.02, LID_THICKNESS / 2 + 0.006);
    lidGroup.add(screenGlow);

    const screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
        new THREE.MeshBasicMaterial({
            map: screenTexture,
            toneMapped: false,
        })
    );
    screenMesh.position.set(0, (SCREEN_H + 0.48) / 2 + 0.02, LID_THICKNESS / 2 + 0.012);
    lidGroup.add(screenMesh);

    const cameraDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.026, 24),
        new THREE.MeshBasicMaterial({ color: 0x0b0c14 })
    );
    cameraDot.position.set(0, SCREEN_H + 0.37, LID_THICKNESS / 2 + 0.018);
    lidGroup.add(cameraDot);

    const hingeMat = materials.hinge;
    const hingeGeometry = new THREE.CylinderGeometry(0.075, 0.075, 1.1, 32);
    for (const x of [-2.03, 0, 2.03]) {
        const hinge = new THREE.Mesh(hingeGeometry, hingeMat);
        hinge.rotation.z = Math.PI / 2;
        hinge.position.set(x, 0.15, -1.74);
        hinge.castShadow = true;
        hinge.receiveShadow = true;
        root.add(hinge);
    }

    const underGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(5.35, 2.5),
        materials.underGlow
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.set(0, -0.075, 0.24);
    root.add(underGlow);

    return { lidGroup, screenMesh };
}

function createMaterials() {
    return {
        base: new THREE.MeshPhysicalMaterial({
            color: 0x858296,
            metalness: 0.8,
            roughness: 0.34,
            clearcoat: 0.45,
            clearcoatRoughness: 0.32,
        }),
        baseLip: new THREE.MeshPhysicalMaterial({
            color: 0xa5a0b5,
            metalness: 0.86,
            roughness: 0.28,
            clearcoat: 0.55,
        }),
        lid: new THREE.MeshPhysicalMaterial({
            color: 0x14111f,
            metalness: 0.52,
            roughness: 0.28,
            clearcoat: 0.7,
            clearcoatRoughness: 0.22,
        }),
        hinge: new THREE.MeshPhysicalMaterial({
            color: 0xa49caf,
            metalness: 0.92,
            roughness: 0.24,
        }),
        keyboardWell: new THREE.MeshStandardMaterial({
            color: 0x191527,
            roughness: 0.65,
            metalness: 0.25,
        }),
        key: new THREE.MeshStandardMaterial({
            color: 0x1f1b2d,
            roughness: 0.6,
            metalness: 0.12,
        }),
        trackpad: new THREE.MeshPhysicalMaterial({
            color: 0x6f6a7a,
            metalness: 0.55,
            roughness: 0.38,
            clearcoat: 0.3,
        }),
        notch: new THREE.MeshStandardMaterial({
            color: 0x5f5a68,
            roughness: 0.5,
            metalness: 0.6,
        }),
        screenGlow: new THREE.MeshBasicMaterial({
            color: 0x7c3aed,
            transparent: true,
            opacity: 0.16,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
        underGlow: new THREE.MeshBasicMaterial({
            color: 0x8b5cf6,
            transparent: true,
            opacity: 0.095,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        }),
    };
}

function addKeyboard(root, materials) {
    const KEY_UNIT = 0.28;
    const GAP = 0.042;
    const KEY_HEIGHT = 0.038;
    const KEY_DEPTH = 0.15;
    const KEY_Y = 0.252;

    const labelMaterials = new Map();
    const specialKeyMaterial = materials.key.clone();
    specialKeyMaterial.color = new THREE.Color(0x282338);
    specialKeyMaterial.roughness = 0.58;
    specialKeyMaterial.metalness = 0.14;

    const darkKeyMaterial = materials.key.clone();
    darkKeyMaterial.color = new THREE.Color(0x171425);
    darkKeyMaterial.roughness = 0.68;
    darkKeyMaterial.metalness = 0.1;

    const rows = [
        {
            z: -0.98,
            depth: 0.118,
            material: specialKeyMaterial,
            keys: [
                { label: "esc", w: 0.8 },
                { label: "F1", w: 0.72 }, { label: "F2", w: 0.72 }, { label: "F3", w: 0.72 }, { label: "F4", w: 0.72 },
                { label: "F5", w: 0.72 }, { label: "F6", w: 0.72 }, { label: "F7", w: 0.72 }, { label: "F8", w: 0.72 },
                { label: "F9", w: 0.72 }, { label: "F10", w: 0.72 }, { label: "F11", w: 0.72 }, { label: "F12", w: 0.72 },
                { label: "⏻", w: 0.82 }
            ]
        },
        {
            z: -0.75,
            keys: [
                { label: "`", w: 1 }, { label: "1", w: 1 }, { label: "2", w: 1 }, { label: "3", w: 1 },
                { label: "4", w: 1 }, { label: "5", w: 1 }, { label: "6", w: 1 }, { label: "7", w: 1 },
                { label: "8", w: 1 }, { label: "9", w: 1 }, { label: "0", w: 1 }, { label: "-", w: 1 },
                { label: "=", w: 1 }, { label: "delete", w: 1.65, material: specialKeyMaterial }
            ]
        },
        {
            z: -0.50,
            keys: [
                { label: "tab", w: 1.35, material: specialKeyMaterial },
                ..."QWERTYUIOP".split("").map(label => ({ label, w: 1 })),
                { label: "[", w: 1 }, { label: "]", w: 1 },
                { label: "\\", w: 1.35, material: specialKeyMaterial }
            ]
        },
        {
            z: -0.25,
            keys: [
                { label: "caps", w: 1.65, material: specialKeyMaterial },
                ..."ASDFGHJKL".split("").map(label => ({ label, w: 1 })),
                { label: ";", w: 1 }, { label: "'", w: 1 },
                { label: "return", w: 1.75, material: specialKeyMaterial }
            ]
        },
        {
            z: 0.01,
            keys: [
                { label: "shift", w: 2.05, material: specialKeyMaterial },
                ..."ZXCVBNM".split("").map(label => ({ label, w: 1 })),
                { label: ",", w: 1 }, { label: ".", w: 1 }, { label: "/", w: 1 },
                { label: "shift", w: 2.2, material: specialKeyMaterial }
            ]
        },
        {
            z: 0.32,
            xStart: -2.26,
            keys: [
                { label: "fn", w: 0.8, material: specialKeyMaterial },
                { label: "ctrl", w: 0.9, material: specialKeyMaterial },
                { label: "opt", w: 0.9, material: specialKeyMaterial },
                { label: "cmd", w: 1.0, material: specialKeyMaterial },
                { label: "", w: 4.25, material: darkKeyMaterial },
                { label: "cmd", w: 1.0, material: specialKeyMaterial },
                { label: "opt", w: 0.9, material: specialKeyMaterial }
            ]
        }
    ];

    rows.forEach(row => addRow(row));

    const arrowMaterial = specialKeyMaterial;
    addKey({ label: "▲", w: 0.68, d: 0.52, material: arrowMaterial }, 1.82, 0.235);
    addKey({ label: "◀", w: 0.68, d: 0.52, material: arrowMaterial }, 1.62, 0.405);
    addKey({ label: "▼", w: 0.68, d: 0.52, material: arrowMaterial }, 1.82, 0.405);
    addKey({ label: "▶", w: 0.68, d: 0.52, material: arrowMaterial }, 2.02, 0.405);

    //addSpeakerGrille(-2.58);
    //addSpeakerGrille(2.58);

    function addRow(row) {
        const depth = row.depth || KEY_DEPTH;
        const totalWidth = row.keys.reduce((sum, key) => sum + key.w * KEY_UNIT, 0) + (row.keys.length - 1) * GAP;
        let cursorX = typeof row.xStart === "number" ? row.xStart : -totalWidth / 2;

        row.keys.forEach(key => {
            const width = key.w * KEY_UNIT;
            addKey({ ...key, material: key.material || row.material, depth }, cursorX + width / 2, row.z);
            cursorX += width + GAP;
        });
    }

    function addKey(def, x, z) {
        const width = def.w * KEY_UNIT;
        const depth = def.depth || (def.d ? KEY_DEPTH * def.d : KEY_DEPTH);
        const geometry = new THREE.BoxGeometry(width, KEY_HEIGHT, depth);
        const key = new THREE.Mesh(geometry, def.material || materials.key);
        key.position.set(x, KEY_Y, z);
        key.castShadow = true;
        key.receiveShadow = true;
        root.add(key);

        const shine = new THREE.Mesh(
            new THREE.PlaneGeometry(width * 0.78, depth * 0.52),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.028,
                depthWrite: false,
            })
        );
        shine.rotation.x = -Math.PI / 2;
        shine.position.set(x, KEY_Y + KEY_HEIGHT / 2 + 0.0015, z - depth * 0.08);
        root.add(shine);

        if (def.label) addKeyLabel(def.label, x, z, width, depth);
    }

    function addKeyLabel(label, x, z, width, depth) {
        const material = getLabelMaterial(label);
        const labelPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(width * 0.88, 0.34), Math.min(depth * 0.6, 0.075)),
            material
        );
        labelPlane.rotation.x = -Math.PI / 2;
        labelPlane.position.set(x, KEY_Y + KEY_HEIGHT / 2 + 0.003, z + depth * 0.02);
        root.add(labelPlane);
    }

    function getLabelMaterial(label) {
        if (labelMaterials.has(label)) return labelMaterials.get(label);

        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(226, 219, 244, 0.78)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const isLong = label.length > 3;
        const isArrow = ["▲", "◀", "▼", "▶", "⏻"].includes(label);
        ctx.font = `${isLong ? "500 34px" : isArrow ? "600 46px" : "600 42px"} 'JetBrains Mono', monospace`;
        ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
        });
        labelMaterials.set(label, material);
        return material;
    }

    function addSpeakerGrille(x) {
        const dotGeometry = new THREE.CircleGeometry(0.012, 12);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0x0d0b17,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
        });

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 2; col++) {
                const dot = new THREE.Mesh(dotGeometry, dotMaterial);
                dot.rotation.x = -Math.PI / 2;
                dot.position.set(x + col * 0.055, KEY_Y + 0.028, -0.88 + row * 0.19);
                root.add(dot);
            }
        }
    }
}
function addLights(scene) {
    const ambient = new THREE.AmbientLight(0xbbaaff, 1.25);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-3.5, 5.2, 5.5);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 14;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);

    const cyan = new THREE.PointLight(0x06b6d4, 4.4, 9.5);
    cyan.position.set(3.4, 2.2, 2.3);
    scene.add(cyan);

    const violet = new THREE.PointLight(0x8b5cf6, 4.8, 9.5);
    violet.position.set(-3.6, 1.4, 1.8);
    scene.add(violet);

    const rim = new THREE.DirectionalLight(0x7dd3fc, 1.1);
    rim.position.set(2, 2.4, -4);
    scene.add(rim);
}

function edgeLines(mesh, color, opacity) {
    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 25),
        new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
        })
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    edges.scale.copy(mesh.scale);
    return edges;
}

function drawLaptopScreen(ctx, canvas, data, state, now) {
    const w = canvas.width;
    const h = canvas.height;
    const pulse = (Math.sin(now / 750) + 1) / 2;

    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#070817");
    bg.addColorStop(0.42, "#0b0720");
    bg.addColorStop(1, "#020617");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawRadial(ctx, w * 0.18, h * 0.18, 520, `rgba(139, 92, 246, ${0.26 + pulse * 0.05})`);
    drawRadial(ctx, w * 0.82, h * 0.24, 420, "rgba(6, 182, 212, 0.18)");
    drawRadial(ctx, w * 0.58, h * 0.95, 580, "rgba(168, 85, 247, 0.16)");

    drawScreenGrid(ctx, w, h);
    drawTerminalChrome(ctx, w, data.logo);
    drawCodeRail(ctx, w, h, now);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "500 28px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#8b5cf6";
    ctx.fillText(data.greeting, w / 2, 245);

    ctx.font = "700 212px 'Space Grotesk', 'Inter', sans-serif";
    const nameGradient = ctx.createLinearGradient(w / 2 - 320, 0, w / 2 + 320, 0);
    nameGradient.addColorStop(0, "#f4ecff");
    nameGradient.addColorStop(0.52, "#a78bfa");
    nameGradient.addColorStop(1, "#06b6d4");
    ctx.fillStyle = nameGradient;
    ctx.shadowColor = "rgba(139, 92, 246, 0.28)";
    ctx.shadowBlur = 24;
    ctx.fillText(data.name, w / 2, 380);
    ctx.shadowBlur = 0;

    ctx.font = "500 34px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#06b6d4";
    const cursor = Math.floor(now / 520) % 2 === 0 ? " |" : "  ";
    ctx.fillText(state.typedRole + cursor, w / 2, 512);

    ctx.font = "400 30px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(240, 230, 255, 0.72)";
    wrapText(ctx, data.description, w / 2, 568, 900, 43);

    state.buttonHitAreas = [];
    const primary = drawScreenButton(ctx, w / 2 - 240, 690, 220, 66, "View Projects", true, state.hoverAction === "projects");
    const secondary = drawScreenButton(ctx, w / 2 + 20, 690, 220, 66, "Contact Me", false, state.hoverAction === "contact");
    state.buttonHitAreas.push({ ...primary, action: "projects" });
    state.buttonHitAreas.push({ ...secondary, action: "contact" });

    //ctx.font = "400 20px 'JetBrains Mono', monospace";
    //ctx.textAlign = "center";
    //ctx.fillStyle = "rgba(180, 160, 214, 0.5)";
    //ctx.fillText("move cursor to tilt • click screen buttons", w / 2, 820);

    const vignette = ctx.createRadialGradient(w / 2, h / 2, 280, w / 2, h / 2, 880);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}

function drawTerminalChrome(ctx, w, logo) {
    ctx.save();
    ctx.globalAlpha = 0.92;
    roundRect(ctx, 72, 58, w - 144, 62, 22);
    ctx.fillStyle = "rgba(255, 255, 255, 0.055)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const colors = ["#ef4444", "#f59e0b", "#22c55e"];
    colors.forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(108 + i * 34, 89, 10, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });

    ctx.font = "500 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(240, 230, 255, 0.65)";
    ctx.textAlign = "left";
    ctx.fillText("portfolio.hero.tsx", 220, 90);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(6, 182, 212, 0.82)";
    ctx.fillText(logo, w - 112, 90);
    ctx.restore();
}

function drawScreenGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(139, 92, 246, 0.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y <= h; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCodeRail(ctx, w, h, now) {
    ctx.save();
    ctx.globalAlpha = 0.48;
    const leftX = 112;
    const rightX = w - 360;
    const rows = 10;

    for (let i = 0; i < rows; i++) {
        const y = 190 + i * 43;
        const alpha = 0.12 + Math.sin(now / 680 + i) * 0.035;
        ctx.fillStyle = `rgba(167, 139, 250, ${alpha})`;
        roundRect(ctx, leftX, y, 190 + (i % 3) * 50, 8, 4);
        ctx.fill();
    }

    for (let i = 0; i < 7; i++) {
        const y = 230 + i * 58;
        ctx.fillStyle = `rgba(6, 182, 212, ${0.08 + (i % 2) * 0.06})`;
        roundRect(ctx, rightX, y, 210 - (i % 3) * 38, 8, 4);
        ctx.fill();
    }
    ctx.restore();
}

function drawScreenButton(ctx, x, y, width, height, label, primary, isHover) {
    ctx.save();
    ctx.shadowColor = primary ? "rgba(139, 92, 246, 0.55)" : "rgba(6, 182, 212, 0.2)";
    ctx.shadowBlur = isHover ? 26 : primary ? 18 : 0;
    roundRect(ctx, x, y, width, height, 18);

    if (primary) {
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, isHover ? "#9f74ff" : "#8b5cf6");
        gradient.addColorStop(1, isHover ? "#0cc9e9" : "#6d4edb");
        ctx.fillStyle = gradient;
        ctx.fill();
    } else {
        ctx.fillStyle = isHover ? "rgba(255, 255, 255, 0.075)" : "rgba(255, 255, 255, 0.035)";
        ctx.fill();
        ctx.strokeStyle = isHover ? "rgba(6, 182, 212, 0.5)" : "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.font = "700 24px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + width / 2, y + height / 2 + 1);
    ctx.restore();

    return { x, y, width, height };
}

function updateTypingState(phrases, state, now) {
    if (!phrases.length) return;

    if (!state.lastTypeAt) {
        state.lastTypeAt = now;
        return;
    }

    const phrase = phrases[state.phraseIndex];
    const atEnd = !state.deleting && state.charIndex === phrase.length;
    const atStart = state.deleting && state.charIndex === 0;
    const delay = atEnd ? PAUSE_AFTER_TYPING : atStart ? PAUSE_AFTER_DELETING : state.deleting ? DELETING_SPEED : TYPING_SPEED;

    if (now - state.lastTypeAt < delay) return;

    state.lastTypeAt = now;

    if (state.deleting) {
        state.charIndex = Math.max(0, state.charIndex - 1);
    } else {
        state.charIndex = Math.min(phrase.length, state.charIndex + 1);
    }

    state.typedRole = phrase.substring(0, state.charIndex);

    if (!state.deleting && state.charIndex === phrase.length) {
        state.deleting = true;
    } else if (state.deleting && state.charIndex === 0) {
        state.deleting = false;
        state.phraseIndex = (state.phraseIndex + 1) % phrases.length;
    }
}

function getScreenActionFromPointer(event, rect, renderer, camera, raycaster, pointer, screenMesh, state) {
    const canvasRect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    pointer.y = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(screenMesh, false);
    if (!hits.length || !hits[0].uv) return null;

    const uv = hits[0].uv;
    const x = uv.x * 1600;
    const y = (1 - uv.y) * 900;

    const area = state.buttonHitAreas.find((button) =>
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
    );

    return area?.action || null;
}

function getScreenData(copy) {
    let roles;
    try {
        roles = JSON.parse(copy.dataset.roles || "[]");
    } catch {
        roles = [];
    }

    return {
        logo: copy.dataset.logo || "JD.dev",
        greeting: copy.dataset.greeting || "Hello, I'm",
        name: copy.dataset.name || "John Doe",
        description: copy.dataset.description || "Building smart, scalable and beautiful digital experiences.",
        roles: roles.length ? roles : ["Fullstack Developer"],
    };
}

function isWebGLAvailable() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(
            window.WebGLRenderingContext &&
            (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
        );
    } catch {
        return false;
    }
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function drawRadial(ctx, x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    const lines = [];

    words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = testLine;
        }
    });

    if (line) lines.push(line);

    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((lineText, index) => {
        ctx.fillText(lineText, x, startY + index * lineHeight);
    });
}

function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

























/* REVEAL */
(function initReveal() {
    const targets = document.querySelectorAll(".reveal, .reveal-left, .reveal-right");
    if (!targets.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                }
            });
        },
        { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    targets.forEach((target) => observer.observe(target));
})();




/* NAV */
(function initNavbar() {
    const nav = document.getElementById("navbar");
    if (!nav) return;

    const update = () => {
        nav.classList.toggle("scrolled", window.scrollY > 50);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
})();




/* MOBILE MENU */
(function initMobileMenu() {
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", () => {
        const open = toggle.classList.toggle("open");
        menu.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
    });

    menu.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            toggle.classList.remove("open");
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        });
    });
})();




/* BACKGROUND */
(function initHeroParticles() {
    const canvas = document.getElementById("heroCanvas");
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    let particles = [];
    let w = 0;
    let h = 0;

    const colors = [
        [139, 92, 246],
        [6, 182, 212],
        [167, 139, 250],
        [99, 102, 241],
    ];

    const connectionDist = 140;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.offsetWidth;
        h = canvas.offsetHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        createParticles();
    }

    function createParticles() {
        const count = w < 768 ? 30 : 65;
        particles = [];

        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                r: Math.random() * 1.5 + 0.8,
                color,
                alpha: Math.random() * 0.45 + 0.15,
            });
        }
    }

    let lastFrameTime = performance.now();

    function frame(timestamp = performance.now()) {
        const delta = Math.min((timestamp - lastFrameTime) / 16.67, 2);
        lastFrameTime = timestamp;

        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = dx * dx + dy * dy;
                const max = connectionDist * connectionDist;

                if (dist < max) {
                    const opacity = (1 - dist / max) * 0.14;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }

        for (const particle of particles) {
            particle.x += particle.vx * delta;
            particle.y += particle.vy * delta;

            if (particle.x < 0 || particle.x > w) particle.vx *= -1;
            if (particle.y < 0 || particle.y > h) particle.vy *= -1;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${particle.color[0]}, ${particle.color[1]}, ${particle.color[2]}, ${particle.alpha})`;
            ctx.fill();
        }

        requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
})();

/* CONTACT */
(function initContactForm() {
    const button = document.getElementById("contactBtn");
    const note = document.getElementById("formNote");
    const name = document.getElementById("contactName");
    const email = document.getElementById("contactEmail");
    const message = document.getElementById("contactMessage");

    if (!button || !name || !email || !message) return;

    button.addEventListener("click", () => {
        const senderName = name.value.trim();
        const senderEmail = email.value.trim();
        const body = message.value.trim();

        if (!senderName || !senderEmail || !body) {
            if (note) note.textContent = "Please fill out all fields first.";
            return;
        }

        const subject = encodeURIComponent(`Portfolio message from ${senderName}`);
        const mailBody = encodeURIComponent(`${body}\n\nFrom: ${senderName}\nEmail: ${senderEmail}`);
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${mailBody}`;
    });
})();
