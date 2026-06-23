/**
 * game.js
 * 3D Engine - Labirinto WebGL 2.0
 */

window.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. SETUP DO CANVAS E CONTEXTO
    // =========================================================================
    const canvas = document.getElementById("gameCanvas");
    const gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("Erro: Seu navegador não suporta WebGL 2.0.");
        return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.02, 0.02, 0.03, 1.0);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const loader = document.getElementById("loaderOverlay");
    const loaderText = document.getElementById("loaderText");

    function showErrorMessage(msg) {
        if (loaderText) {
            loaderText.style.color = "#ff4444";
            loaderText.textContent = "ERRO: " + msg;
        }
        const spinner = document.querySelector(".loader-spinner");
        if (spinner) spinner.style.display = "none";
        console.error("Game Error:", msg);
    }

    // =========================================================================
    // 2. SISTEMA DE CÂMERA E INPUTS
    // =========================================================================
    // Configurações de Escala e Dimensões do Labirinto
    const mazeScale = 60.0;              // Ajustado para 60 para reduzir o espaçamento dos corredores (paredes mais próximas)
    const wallHeightMultiplier = 1.2;    // Ajustado para manter a altura física das paredes em ~1.77 unidades

    // Câmera do Jogador
    const cameraPos = Vec3.create(20.0, 0.3, 7.0); // Posição inicial fora do labirinto
    const cameraFront = Vec3.create(-1.0, 0.0, 0.0); // Apontando para o oeste (inicialmente leste, girado 180 graus)
    const cameraUp = Vec3.create(0.0, 1.0, 0.0);
    const mazeWorldSize = mazeScale * 0.3;
    const mazeWorldCenter = mazeWorldSize * 0.5;
    const overviewCameraPos = Vec3.create(mazeWorldCenter, 20.0, mazeWorldCenter + 6.0);
    const overviewTarget = Vec3.create(mazeWorldCenter, 0.0, mazeWorldCenter);

    let yaw = 180.0;
    let pitch = 0.0;
    const keys = { W: false, A: false, S: false, D: false };
    let isLightOn = true;
    let isOverviewMode = false;
    const mouseSensitivity = 0.15;
    const movementSpeed = 1.8;           // Reduzido para movimentação mais lenta e atmosférica

    // Configurações do Olho de Jade (Luz Móvel e Ameaça)
    const eyePos = Vec3.create(mazeScale * 0.15, 8.0, mazeScale * 0.15);      // Posição fixa no topo do centro do labirinto
    const eyeDir = Vec3.create(0.0, -1.0, 0.0);                               // Direção do feixe do olho (inicialmente para baixo)
    const eyeTarget = Vec3.create(mazeScale * 0.15, 0.0, mazeScale * 0.15);   // Ponto que a luz está iluminando no chão
    const eyeTargetWaypoint = Vec3.create(mazeScale * 0.15, 0.0, mazeScale * 0.15); // Próximo waypoint aleatório do feixe
    const light2Color = Vec3.create(0.0, 1.0, 0.1);  // Luz verde de Jade
    let eyeWaypointTimer = 0.0;

    window.addEventListener("keydown", (e) => {
        const k = e.key.toUpperCase();
        if (k in keys) keys[k] = true;
        if (k === "L") {
            isLightOn = !isLightOn;
            console.log(`Lanterna: ${isLightOn ? "LIGADA" : "DESLIGADA"}`);
        }
        if (k === "O") {
            isOverviewMode = !isOverviewMode;
            if (isOverviewMode && document.pointerLockElement === canvas) {
                document.exitPointerLock();
            }
            console.log(`Modo de visão geral: ${isOverviewMode ? "ATIVADO" : "DESATIVADO"}`);
        }
    });

    window.addEventListener("keyup", (e) => {
        const k = e.key.toUpperCase();
        if (k in keys) keys[k] = false;
    });

    canvas.addEventListener("click", () => canvas.requestPointerLock());

    document.addEventListener("pointerlockchange", () => {
        const status = document.getElementById("pointerStatus");
        if (document.pointerLockElement === canvas) {
            if (status) status.style.display = "none";
        } else {
            if (status) status.style.display = "block";
        }
    });

    const tempFront = Vec3.create();
    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement !== canvas) return;

        yaw += e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;
        pitch = Math.max(-89.0, Math.min(89.0, pitch));

        const yawRad = yaw * Math.PI / 180;
        const pitchRad = pitch * Math.PI / 180;

        Vec3.set(tempFront,
            Math.cos(pitchRad) * Math.cos(yawRad),
            Math.sin(pitchRad),
            Math.cos(pitchRad) * Math.sin(yawRad)
        );

        Vec3.normalize(cameraFront, tempFront);
        
        // Atualiza UI de Rotação
        document.getElementById("statRot").textContent = `${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°`;
    });

    // =========================================================================
    // 3. SHADERS E MODELO
    // =========================================================================
    const vsSource = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    out vec3 vWorldPos;
    out vec3 vNormal;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(uModelMatrix) * aNormal);
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;

    const fsSource = `#version 300 es
    precision highp float;
    in vec3 vWorldPos;
    in vec3 vNormal;
    out vec4 fragColor;

    uniform vec3 uCameraPos;
    uniform vec3 uCameraFront;
    uniform vec3 uLight1Color;   // Cor da lanterna do Jogador (Luz 1)

    uniform vec3 uEyePos;        // Posição do Olho de Jade (Luz 2)
    uniform vec3 uEyeDir;        // Direção do feixe do Olho de Jade
    uniform vec3 uLight2Color;   // Cor do feixe do Olho de Jade (Verde)

    uniform vec3 uFlamePos;      // Posição da chama azul do Cálice (Luz 3)
    uniform vec3 uFlameColor;    // Cor da chama azul (Luz 3)

    uniform float uShininess;
    uniform vec3 uSpecularColor;

    uniform sampler2D uAlbedoMap;
    uniform sampler2D uRoughnessMap;
    uniform sampler2D uGroundAlbedoMap;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uCameraPos - vWorldPos);

        // Calcular UVs baseados na posição do mundo (World-space planar mapping)
        vec2 uv;
        if (abs(normal.y) > 0.8) {
            uv = vWorldPos.xz * 0.5; // Chão/Teto
        } else if (abs(normal.x) > abs(normal.z)) {
            uv = vec2(vWorldPos.z, vWorldPos.y) * 0.8; // Parede alinhada com X (projetada no plano ZY)
        } else {
            uv = vec2(vWorldPos.x, vWorldPos.y) * 0.8; // Parede alinhada com Z (projetada no plano XY)
        }

        // Amostrar texturas
        vec3 texColor = texture(uAlbedoMap, uv).rgb;
        float texRoughness = texture(uRoughnessMap, uv).r;

        // Diferenciar cor base e propriedades do material: Grama (chão) vs Pedra (paredes) usando a normal vertical
        vec3 baseColor;
        vec3 specColorMat;
        float shininessMat;

        if (normal.y > 0.8) {
            // Chão (Floor) — Cor sólida cinza
            baseColor = vec3(0.35, 0.35, 0.35); // Cinza sólido
            specColorMat = vec3(0.04);                         // Chão rochoso é bem áspero, reflete pouco
            shininessMat = 6.0;
        } else if (normal.y < -0.8) {
            // Teto (Ceiling) se houver
            baseColor = vec3(0.15, 0.15, 0.15);                // Cor escura sólida
            specColorMat = vec3(0.0);
            shininessMat = 1.0;
        } else {
            baseColor = texColor; // Textura de tijolos com musgo para as paredes
            specColorMat = vec3(0.12) * (1.0 - texRoughness); // Especularidade baseada no roughness
            shininessMat = mix(4.0, 40.0, 1.0 - texRoughness); // Shininess dinâmico baseado no roughness
        }

        // Iluminação Ambiente global sutil (aumentada significativamente para visualização sem lanterna)
        vec3 ambient = vec3(0.25, 0.25, 0.28) * baseColor;

        // --- LUZ 1: LANTERNA DO JOGADOR (Spotlight branco/amarelado) ---
        vec3 light1Dir = normalize(uCameraPos - vWorldPos);
        float dist1 = length(uCameraPos - vWorldPos);
        float atten1 = 1.0 / (1.0 + 0.02 * dist1 + 0.01 * dist1 * dist1);
        
        float spotEffect1 = dot(normalize(uCameraFront), -light1Dir);
        float spotCutoff1 = 0.85; // Cone concentrado
        float intensity1 = smoothstep(spotCutoff1, spotCutoff1 + 0.08, spotEffect1);

        // Difusa e Especular de Phong
        float diff1 = max(dot(normal, light1Dir), 0.0);
        vec3 reflectDir1 = reflect(-light1Dir, normal);
        float spec1 = pow(max(dot(viewDir, reflectDir1), 0.0), shininessMat);

        vec3 light1Contribution = (diff1 * baseColor + spec1 * specColorMat) * uLight1Color * intensity1 * atten1;

        // --- LUZ 2: OLHO DE JADE NO CÉU (Spotlight verde, amplo e móvel) ---
        vec3 light2Dir = normalize(uEyePos - vWorldPos);
        float dist2 = length(uEyePos - vWorldPos);
        float atten2 = 1.0 / (1.0 + 0.005 * dist2 + 0.002 * dist2 * dist2); // Atenuação menor para alcance amplo
        
        float spotEffect2 = dot(normalize(uEyeDir), -light2Dir);
        float spotCutoff2 = 0.93; // Cone mais fechado (raio no chão de 3.0 unidades com altura de 8.0)
        float intensity2 = smoothstep(spotCutoff2, spotCutoff2 + 0.04, spotEffect2);

        // Difusa e Especular de Phong
        float diff2 = max(dot(normal, light2Dir), 0.0);
        vec3 reflectDir2 = reflect(-light2Dir, normal);
        float spec2 = pow(max(dot(viewDir, reflectDir2), 0.0), shininessMat);

        vec3 light2Contribution = (diff2 * baseColor + spec2 * specColorMat) * uLight2Color * intensity2 * atten2;

        // --- LUZ 3: CHAMA AZUL DO CÁLICE (Point light local azul) ---
        vec3 light3Dir = normalize(uFlamePos - vWorldPos);
        float dist3 = length(uFlamePos - vWorldPos);
        float flameRange = 2.3;
        float flameFade = 1.0 - smoothstep(flameRange * 0.55, flameRange, dist3);
        float atten3 = flameFade / (1.0 + 0.65 * dist3 + 0.45 * dist3 * dist3);

        // Difusa e Especular de Phong com brilho azul mais contido nas paredes
        float diff3 = max(dot(normal, light3Dir), 0.0);
        vec3 reflectDir3 = reflect(-light3Dir, normal);
        float spec3 = pow(max(dot(viewDir, reflectDir3), 0.0), shininessMat);
        float flameSpecStrength = abs(normal.y) > 0.8 ? 0.14 : 0.03;

        vec3 light3Contribution = (diff3 * baseColor + spec3 * specColorMat * flameSpecStrength) * uFlameColor * atten3;

        // --- MODELO DE REFLEXÃO DE PHONG COMPLETO (Soma dos termos) ---
        vec3 finalColor = ambient + light1Contribution + light2Contribution + light3Contribution;
        fragColor = vec4(finalColor, 1.0);
    }`;

    // --- SHADERS DO CONE DE LUZ DO OLHO DE JADE (Volumétrico/Translúcido) ---
    const coneVSSource = `#version 300 es
    in vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    out float vHeightFactor;
    void main() {
        // aPosition.y vai de ~0.0 (chão) até 8.0 (olho)
        vHeightFactor = aPosition.y / 8.0;
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
    }`;

    const coneFSSource = `#version 300 es
    precision highp float;
    in float vHeightFactor;
    out vec4 fragColor;
    uniform vec3 uConeColor;
    void main() {
        // Efeito volumétrico: mais brilhante no topo (perto do olho) e mais suave embaixo
        float alpha = mix(0.03, 0.22, vHeightFactor);
        fragColor = vec4(uConeColor, alpha);
     }`;

    // --- SHADERS DO MARCADOR DO JOGADOR (Visão geral) ---
    const markerVSSource = `#version 300 es
    in vec3 aPosition;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform float uMarkerSize;
    void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
        gl_PointSize = uMarkerSize;
    }`;

    const markerFSSource = `#version 300 es
    precision highp float;
    uniform vec3 uMarkerColor;
    out vec4 fragColor;
    void main() {
        vec2 coord = gl_PointCoord * 2.0 - 1.0;
        float dist = dot(coord, coord);
        if (dist > 1.0) discard;

        float ring = smoothstep(0.95, 0.55, dist) - smoothstep(0.55, 0.22, dist);
        float core = 1.0 - smoothstep(0.0, 0.18, dist);
        float alpha = max(ring * 0.95, core * 0.8);
        vec3 color = mix(uMarkerColor, vec3(1.0, 1.0, 1.0), core * 0.65);
        fragColor = vec4(color, alpha);
    }`;

    // --- SHADERS DO CÁLICE DE FOGO (Material Dourado/Metálico) ---
    const gobletVSSource = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    out vec3 vWorldPos;
    out vec3 vNormal;
    out float vHeight;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uGobletModelMatrix;
    void main() {
        vec4 worldPos = uGobletModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(uGobletModelMatrix) * aNormal);
        vHeight = aPosition.y;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }`;

    const gobletFSSource = `#version 300 es
    precision highp float;
    in vec3 vWorldPos;
    in vec3 vNormal;
    in float vHeight;
    out vec4 fragColor;

    uniform vec3 uCameraPos;
    uniform vec3 uCameraFront;
    uniform vec3 uLight1Color;
    uniform vec3 uEyePos;
    uniform vec3 uEyeDir;
    uniform vec3 uLight2Color;
    uniform float uTime;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(uCameraPos - vWorldPos);

        // Material dourado metálico com gradiente
        vec3 goldBase = vec3(0.83, 0.69, 0.22);   // Ouro base
        vec3 goldBright = vec3(1.0, 0.84, 0.35);   // Ouro brilhante
        vec3 goldDark = vec3(0.55, 0.38, 0.08);    // Ouro escuro

        // Gradiente vertical: base mais escura, borda do copo mais clara
        float heightFactor = clamp(vHeight / 1.45, 0.0, 1.0);
        vec3 baseColor = mix(goldDark, goldBright, heightFactor);

        // Efeito Fresnel metálico (mais reflexivo nas bordas)
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        baseColor = mix(baseColor, goldBright * 1.3, fresnel * 0.5);

        // Ambiente — brilho mínimo dourado para o cálice nunca ficar totalmente escuro
        vec3 ambient = vec3(0.15, 0.12, 0.04) * baseColor;

        // --- LUZ 1: LANTERNA DO JOGADOR ---
        vec3 light1Dir = normalize(uCameraPos - vWorldPos);
        float dist1 = length(uCameraPos - vWorldPos);
        float atten1 = 1.0 / (1.0 + 0.02 * dist1 + 0.01 * dist1 * dist1);
        float spotEffect1 = dot(normalize(uCameraFront), -light1Dir);
        float intensity1 = smoothstep(0.85, 0.93, spotEffect1);
        float diff1 = max(dot(normal, light1Dir), 0.0);
        vec3 reflectDir1 = reflect(-light1Dir, normal);
        float spec1 = pow(max(dot(viewDir, reflectDir1), 0.0), 80.0);
        vec3 light1Contribution = (diff1 * baseColor + spec1 * goldBright * 1.5) * uLight1Color * intensity1 * atten1;

        // --- LUZ 2: OLHO DE JADE ---
        vec3 light2Dir = normalize(uEyePos - vWorldPos);
        float dist2 = length(uEyePos - vWorldPos);
        float atten2 = 1.0 / (1.0 + 0.005 * dist2 + 0.002 * dist2 * dist2);
        float spotEffect2 = dot(normalize(uEyeDir), -light2Dir);
        float intensity2 = smoothstep(0.93, 0.97, spotEffect2);
        float diff2 = max(dot(normal, light2Dir), 0.0);
        vec3 reflectDir2 = reflect(-light2Dir, normal);
        float spec2 = pow(max(dot(viewDir, reflectDir2), 0.0), 80.0);
        vec3 light2Contribution = (diff2 * baseColor + spec2 * goldBright) * uLight2Color * intensity2 * atten2;

        // --- REFLEXO SUTIL DA CHAMA AZUL NA BORDA INTERNA DO COPO ---
        // Apenas a borda interna do copo (vHeight > 1.1) recebe um leve brilho azulado
        // Isso mantém o aspecto metálico dourado em toda a superfície
        float flameReflect = smoothstep(1.1, 1.45, vHeight);
        float flameFlicker = 0.85 + 0.15 * sin(uTime * 8.0 + vWorldPos.x * 5.0);
        vec3 flameGlow = vec3(0.08, 0.18, 0.5) * flameReflect * flameFlicker * 0.35;

        vec3 finalColor = ambient + light1Contribution + light2Contribution + flameGlow;
        fragColor = vec4(finalColor, 1.0);
    }`;

    // --- SHADERS DO SISTEMA DE PARTÍCULAS (Chama Azul Mística) ---
    const particleVSSource = `#version 300 es
    in vec3 aPosition;
    in float aAge;
    in float aLife;
    in float aSize;
    out float vAgeFactor;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    void main() {
        vAgeFactor = clamp(aAge / aLife, 0.0, 1.0);
        vec4 viewPos = uViewMatrix * vec4(aPosition, 1.0);
        gl_Position = uProjectionMatrix * viewPos;
        // Tamanho da partícula diminui com a distância e com a idade
        float dist = length(viewPos.xyz);
        gl_PointSize = aSize * (1.0 - vAgeFactor * 0.6) * (300.0 / max(dist, 1.0));
    }`;

    const particleFSSource = `#version 300 es
    precision highp float;
    in float vAgeFactor;
    out vec4 fragColor;
    uniform int uParticleType;
    void main() {
        // Partícula circular suave (descarta cantos do quad)
        vec2 coord = gl_PointCoord * 2.0 - 1.0;
        float dist = dot(coord, coord);
        if (dist > 1.0) discard;
        float softEdge = 1.0 - smoothstep(0.3, 1.0, dist);

        vec3 coreColor;
        vec3 midColor;
        vec3 outerColor;

        if (uParticleType == 1) {
            // Fogo Vermelho/Laranja (Saída)
            coreColor = vec3(1.0, 0.9, 0.65);
            midColor = vec3(1.0, 0.35, 0.0);
            outerColor = vec3(0.8, 0.05, 0.0);
        } else {
            // Chama Azul Mística (Cálice)
            coreColor = vec3(0.7, 0.85, 1.0);
            midColor = vec3(0.1, 0.45, 1.0);
            outerColor = vec3(0.05, 0.15, 0.6);
        }

        // Mistura baseada na distância do centro da partícula
        vec3 color = mix(coreColor, midColor, smoothstep(0.0, 0.5, dist));
        color = mix(color, outerColor, smoothstep(0.5, 1.0, dist));

        // Alpha: forte no início, desaparece com a idade
        float alpha = softEdge * (1.0 - vAgeFactor) * 0.85;
        fragColor = vec4(color, alpha);
    }`;

    let shaderProgram;
    let locations = {};
    let labyrinthMeshes = [];
    let floorMesh = null;
    let isLoaded = false;
    let wallSegments = new Float32Array(0);
    let gameTime = 0.0;

    // --- Variáveis do Cálice de Fogo e Regras de Jogo ---
    let gobletProgram;
    let gobletLocations = {};
    let gobletMesh = null;
    let particleProgram;
    let particleLocations = {};
    let particleSystem = null;
    let exitFireSystem = null;
    let hasGoblet = false;
    let isGameOver = false;
    const gobletModelMatrix = Mat4.create();
    const gobletTempMatrix = Mat4.create();
    const gobletRotMatrix = Mat4.create();
    const gobletCombined = Mat4.create();
    // Posição do cálice no mundo (será ajustada após validar posição do jogador)
    const gobletWorldPos = Vec3.create(0, 0, 0);
    const gobletScale = 0.315; // Escala do cálice no mundo (~30% menor)

    let wallAlbedoTexture;
    let wallRoughnessTexture;
    let groundAlbedoTexture;

    let coneProgram;
    let coneLocations = {};
    let coneVAO, coneVBO;
    let markerProgram;
    let markerLocations = {};
    let markerVAO, markerVBO;

    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function createProgram(gl, vsSource, fsSource) {
        const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
        const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    function loadTexture(gl, url) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Preenche com uma cor cinza temporária (1x1 pixel) enquanto carrega
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([100, 100, 100, 255]));

        const image = new Image();
        image.onload = function() {
            gl.activeTexture(gl.TEXTURE0); // Garante a unidade 0 para o upload
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            console.log(`Textura carregada com sucesso: ${url}`);

            const err = gl.getError();
            if (err !== gl.NO_ERROR) {
                console.error(`Erro WebGL no onload de ${url}: ${err}`);
            }
        };
        image.onerror = function() {
            console.error(`Erro ao carregar a textura: ${url}`);
        };
        image.src = url;

        return texture;
    }

    async function initGame() {
        try {
            shaderProgram = createProgram(gl, vsSource, fsSource);
            locations = {
                uProjectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
                uModelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
                uCameraPos: gl.getUniformLocation(shaderProgram, "uCameraPos"),
                uCameraFront: gl.getUniformLocation(shaderProgram, "uCameraFront"),
                uLight1Color: gl.getUniformLocation(shaderProgram, "uLight1Color"),
                uEyePos: gl.getUniformLocation(shaderProgram, "uEyePos"),
                uEyeDir: gl.getUniformLocation(shaderProgram, "uEyeDir"),
                uLight2Color: gl.getUniformLocation(shaderProgram, "uLight2Color"),
                uShininess: gl.getUniformLocation(shaderProgram, "uShininess"),
                uSpecularColor: gl.getUniformLocation(shaderProgram, "uSpecularColor"),
                uFlamePos: gl.getUniformLocation(shaderProgram, "uFlamePos"),
                uFlameColor: gl.getUniformLocation(shaderProgram, "uFlameColor"),
                uAlbedoMap: gl.getUniformLocation(shaderProgram, "uAlbedoMap"),
                uRoughnessMap: gl.getUniformLocation(shaderProgram, "uRoughnessMap"),
                uGroundAlbedoMap: gl.getUniformLocation(shaderProgram, "uGroundAlbedoMap"),
                aPosition: gl.getAttribLocation(shaderProgram, "aPosition"),
                aNormal: gl.getAttribLocation(shaderProgram, "aNormal")
            };
            console.log("Uniform Locations:", locations);

            if (loaderText) loaderText.textContent = "Carregando texturas...";
            wallAlbedoTexture = loadTexture(gl, 'assets/plaster_brick_01_diff_1k.jpg');
            wallRoughnessTexture = loadTexture(gl, 'assets/plaster_brick_01_rough_1k.jpg');
            groundAlbedoTexture = loadTexture(gl, 'assets/rocky_terrain_diff_1k.jpg');

            if (loaderText) loaderText.textContent = "Carregando labirinto (assets/labyrinth.obj)...";
            const meshData = await OBJParser.loadAndParse('assets/labyrinth.obj');

            const mesh = {
                vao: gl.createVertexArray(),
                count: meshData.positions.length / 3,
                hasIndices: false,
                rawPositions: meshData.positions,
                rawIndices: null
            };

            gl.bindVertexArray(mesh.vao);
            if (meshData.positions) {
                const buf = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                gl.bufferData(gl.ARRAY_BUFFER, meshData.positions, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(locations.aPosition);
                gl.vertexAttribPointer(locations.aPosition, 3, gl.FLOAT, false, 0, 0);
            }
            if (meshData.normals) {
                const buf = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                gl.bufferData(gl.ARRAY_BUFFER, meshData.normals, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(locations.aNormal);
                gl.vertexAttribPointer(locations.aNormal, 3, gl.FLOAT, false, 0, 0);
            }
            gl.bindVertexArray(null);
            labyrinthMeshes.push(mesh);

            // --- CRIAR CHÃO (FLOOR) PROCEDURAL ---
            // O arquivo OBJ contém somente geometria das paredes.
            // O chão é um quad (2 triângulos) em Y=0 cobrindo toda a área do labirinto.
            // As coordenadas estão no espaço normalizado do OBJ (~0 a 0.31).
            // O model matrix (mazeScale) escalará para o espaço do mundo.
            const floorMin = -0.1;
            const floorMax = 0.41;
            const floorY = 0.0001;    // Levemente acima de Y=0 para evitar z-fighting com a base das paredes
            // prettier-ignore
            const floorPositions = new Float32Array([
                // Triângulo 1 (CCW visto de cima)
                floorMin, floorY, floorMin,
                floorMax, floorY, floorMax,
                floorMax, floorY, floorMin,
                // Triângulo 2 (CCW visto de cima)
                floorMin, floorY, floorMin,
                floorMin, floorY, floorMax,
                floorMax, floorY, floorMax
            ]);
            // prettier-ignore
            const floorNormals = new Float32Array([
                0, 1, 0,  0, 1, 0,  0, 1, 0,
                0, 1, 0,  0, 1, 0,  0, 1, 0
            ]);

            const floorVAO = gl.createVertexArray();
            gl.bindVertexArray(floorVAO);

            const floorPosBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, floorPosBuf);
            gl.bufferData(gl.ARRAY_BUFFER, floorPositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(locations.aPosition);
            gl.vertexAttribPointer(locations.aPosition, 3, gl.FLOAT, false, 0, 0);

            const floorNrmBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, floorNrmBuf);
            gl.bufferData(gl.ARRAY_BUFFER, floorNormals, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(locations.aNormal);
            gl.vertexAttribPointer(locations.aNormal, 3, gl.FLOAT, false, 0, 0);

            gl.bindVertexArray(null);

            floorMesh = {
                vao: floorVAO,
                count: 6 // 2 triângulos × 3 vértices
            };
            console.log("Chão do labirinto criado com sucesso.");

            // Inicializar Shader e VBO do Cone de Luz (Olho de Jade)
            coneProgram = createProgram(gl, coneVSSource, coneFSSource);
            coneLocations = {
                aPosition: gl.getAttribLocation(coneProgram, "aPosition"),
                uProjectionMatrix: gl.getUniformLocation(coneProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(coneProgram, "uViewMatrix"),
                uConeColor: gl.getUniformLocation(coneProgram, "uConeColor")
            };

            coneVAO = gl.createVertexArray();
            coneVBO = gl.createBuffer();
            gl.bindVertexArray(coneVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, coneVBO);
            // 16 pontos de base + 1 ápice + 1 duplicado para fechar o leque = 18 vértices de 3 floats
            gl.bufferData(gl.ARRAY_BUFFER, (16 + 2) * 3 * 4, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(coneLocations.aPosition);
            gl.vertexAttribPointer(coneLocations.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);

            markerProgram = createProgram(gl, markerVSSource, markerFSSource);
            markerLocations = {
                aPosition: gl.getAttribLocation(markerProgram, "aPosition"),
                uProjectionMatrix: gl.getUniformLocation(markerProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(markerProgram, "uViewMatrix"),
                uMarkerColor: gl.getUniformLocation(markerProgram, "uMarkerColor"),
                uMarkerSize: gl.getUniformLocation(markerProgram, "uMarkerSize")
            };

            markerVAO = gl.createVertexArray();
            markerVBO = gl.createBuffer();
            gl.bindVertexArray(markerVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, markerVBO);
            gl.bufferData(gl.ARRAY_BUFFER, 3 * 4, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(markerLocations.aPosition);
            gl.vertexAttribPointer(markerLocations.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);

            extractWallSegments();
            validateStartPosition();

            // Atualiza HUD de rotação inicial
            document.getElementById("statRot").textContent = `${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°`;

            // --- INICIALIZAR CÁLICE DE FOGO ---
            if (loaderText) loaderText.textContent = "Criando Cálice de Fogo...";

            // Compilar shaders do Cálice
            gobletProgram = createProgram(gl, gobletVSSource, gobletFSSource);
            gobletLocations = {
                aPosition: gl.getAttribLocation(gobletProgram, "aPosition"),
                aNormal: gl.getAttribLocation(gobletProgram, "aNormal"),
                uProjectionMatrix: gl.getUniformLocation(gobletProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(gobletProgram, "uViewMatrix"),
                uGobletModelMatrix: gl.getUniformLocation(gobletProgram, "uGobletModelMatrix"),
                uCameraPos: gl.getUniformLocation(gobletProgram, "uCameraPos"),
                uCameraFront: gl.getUniformLocation(gobletProgram, "uCameraFront"),
                uLight1Color: gl.getUniformLocation(gobletProgram, "uLight1Color"),
                uEyePos: gl.getUniformLocation(gobletProgram, "uEyePos"),
                uEyeDir: gl.getUniformLocation(gobletProgram, "uEyeDir"),
                uLight2Color: gl.getUniformLocation(gobletProgram, "uLight2Color"),
                uTime: gl.getUniformLocation(gobletProgram, "uTime")
            };

            // Gerar geometria procedural do Cálice
            gobletMesh = GobletGenerator.generateGobletMesh(gl);
            console.log("Cálice de Fogo criado com sucesso.", gobletMesh);

            // Posicionar o Cálice no centro do labirinto (9.0, 0.0, 9.0)
            let gobletX = 9.0;
            let gobletZ = 9.0;
            if (!isPositionClear(gobletX, gobletZ, 0.5)) {
                let found = false;
                for (let r = 0.5; r < 5.0 && !found; r += 0.5) {
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                        const testX = 9.0 + Math.cos(angle) * r;
                        const testZ = 9.0 + Math.sin(angle) * r;
                        if (isPositionClear(testX, testZ, 0.5)) {
                            gobletX = testX;
                            gobletZ = testZ;
                            found = true;
                            break;
                        }
                    }
                }
            }
            Vec3.set(gobletWorldPos, gobletX, 0.0, gobletZ);
            console.log("Cálice posicionado no labirinto:", gobletWorldPos);

            // Compilar shaders das Partículas
            particleProgram = createProgram(gl, particleVSSource, particleFSSource);
            particleLocations = {
                uProjectionMatrix: gl.getUniformLocation(particleProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(particleProgram, "uViewMatrix"),
                uParticleType: gl.getUniformLocation(particleProgram, "uParticleType")
            };

            // Criar Sistema de Partículas (Chama Azul)
            particleSystem = new ParticleSystem(120);
            particleSystem.initWebGL(gl, particleProgram);
            console.log("Sistema de Partículas (Chama Azul) inicializado.");

            // Criar Sistema de Partículas (Chama Vermelha de Bloqueio da Saída)
            exitFireSystem = new ParticleSystem(150);
            exitFireSystem.initWebGL(gl, particleProgram);
            console.log("Sistema de Partículas da Saída (Chama Vermelha) inicializado.");

            isLoaded = true;
            if (loader) {
                loader.style.opacity = "0";
                setTimeout(() => loader.style.display = "none", 800);
            }
            requestAnimationFrame(gameLoop);
        } catch (err) {
            showErrorMessage(err.message);
        }
    }

    function extractWallSegments() {
        const rawSegments = [];
        const segmentSet = new Set();

        for (const mesh of labyrinthMeshes) {
            const pos = mesh.rawPositions;
            const ind = mesh.rawIndices;
            if (!pos) continue;

            if (ind) {
                for (let i = 0; i < ind.length; i += 3) {
                    const i1 = ind[i] * 3, i2 = ind[i+1] * 3, i3 = ind[i+2] * 3;
                    processTriangle(pos[i1], pos[i1+1], pos[i1+2], pos[i2], pos[i2+1], pos[i2+2], pos[i3], pos[i3+1], pos[i3+2]);
                }
            } else {
                for (let i = 0; i < pos.length; i += 9) {
                    processTriangle(pos[i], pos[i+1], pos[i+2], pos[i+3], pos[i+4], pos[i+5], pos[i+6], pos[i+7], pos[i+8]);
                }
            }
        }

        function addUniqueSegment(p1, p2) {
            const x1 = Math.round(p1[0] * 100), z1 = Math.round(p1[1] * 100);
            const x2 = Math.round(p2[0] * 100), z2 = Math.round(p2[1] * 100);
            if (x1 === x2 && z1 === z2) return;

            const key = x1 < x2 || (x1 === x2 && z1 < z2) 
                ? `${x1},${z1}|${x2},${z2}` 
                : `${x2},${z2}|${x1},${z1}`;

            if (!segmentSet.has(key)) {
                segmentSet.add(key);
                rawSegments.push(p1[0], p1[1], p2[0], p2[1]);
            }
        }

        function processTriangle(x1, y1, z1, x2, y2, z2, x3, y3, z3) {
            const minY = Math.min(y1, y2, y3);
            const maxY = Math.max(y1, y2, y3);
            const realHeight = (maxY - minY) * mazeScale * wallHeightMultiplier;

            if (realHeight > 0.5) {
                addUniqueSegment([x1 * mazeScale, z1 * mazeScale], [x2 * mazeScale, z2 * mazeScale]);
                addUniqueSegment([x2 * mazeScale, z2 * mazeScale], [x3 * mazeScale, z3 * mazeScale]);
                addUniqueSegment([x3 * mazeScale, z3 * mazeScale], [x1 * mazeScale, z1 * mazeScale]);
            }
        }
        
        wallSegments = new Float32Array(rawSegments);
        console.log(`Sistema de Colisão: ${wallSegments.length / 4} segmentos de parede extraídos.`);
        if (wallSegments.length === 0) {
            console.warn("AVISO: Nenhuma parede detectada!");
        }
    }

    function distToSegmentSq(px, pz, x1, z1, x2, z2) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const l2 = dx * dx + dz * dz;
        // Se o segmento é um ponto, retorna distância ao ponto
        if (l2 < 0.0001) return (px - x1) ** 2 + (pz - z1) ** 2;
        
        // Projeção do ponto no segmento
        let t = ((px - x1) * dx + (pz - z1) * dz) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const closestX = x1 + t * dx;
        const closestZ = z1 + t * dz;
        
        return (px - closestX) ** 2 + (pz - closestZ) ** 2;
    }

    function checkCollision(nx, nz) {
        // Se o jogador não tem o cálice, a saída (1.0, 1.5) está bloqueada por fogo
        if (!hasGoblet) {
            const dx = nx - 1.0;
            const dz = nz - 1.5;
            if (dx * dx + dz * dz < 0.64) { // Raio de 0.8 unidades
                return true;
            }
        }
        const radius = 0.2; 
        const radiusSq = radius * radius;
        for (let i = 0; i < wallSegments.length; i += 4) {
            if (distToSegmentSq(nx, nz, wallSegments[i], wallSegments[i+1], wallSegments[i+2], wallSegments[i+3]) < radiusSq) {
                return true;
            }
        }
        return false;
    }

    function isPositionClear(x, z, radius) {
        if (checkCollision(x, z)) return false;

        const samples = [
            [radius, 0.0],
            [-radius, 0.0],
            [0.0, radius],
            [0.0, -radius],
            [radius * 0.7, radius * 0.7],
            [radius * 0.7, -radius * 0.7],
            [-radius * 0.7, radius * 0.7],
            [-radius * 0.7, -radius * 0.7]
        ];

        for (const sample of samples) {
            if (checkCollision(x + sample[0], z + sample[1])) {
                return false;
            }
        }

        return true;
    }

    function findRandomClearPosition(minDistanceFromPlayer, clearRadius) {
        const minCoord = 1.0;
        const maxCoord = mazeWorldSize - 1.0;
        const step = 0.35;
        const minDistanceSq = minDistanceFromPlayer * minDistanceFromPlayer;
        const validPoints = [];

        for (let x = minCoord; x <= maxCoord; x += step) {
            for (let z = minCoord; z <= maxCoord; z += step) {
                const dx = x - cameraPos[0];
                const dz = z - cameraPos[2];
                if (dx * dx + dz * dz < minDistanceSq) continue;
                if (!isPositionClear(x, z, clearRadius)) continue;
                validPoints.push([x, z]);
            }
        }

        if (validPoints.length === 0) {
            return null;
        }

        const choice = validPoints[Math.floor(Math.random() * validPoints.length)];
        return choice;
    }

    // Valida e reposiciona o jogador de forma segura caso ele nasça dentro de uma parede
    function validateStartPosition() {
        if (checkCollision(cameraPos[0], cameraPos[2])) {
            console.warn("Posição inicial em colisão! Procurando local seguro próximo...");
            let found = false;
            // Busca espiral em torno da posição inicial para encontrar uma área livre de colisão
            for (let r = 0.5; r < 20.0; r += 0.5) {
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                    const testX = cameraPos[0] + Math.cos(angle) * r;
                    const testZ = cameraPos[2] + Math.sin(angle) * r;
                    if (!checkCollision(testX, testZ)) {
                        cameraPos[0] = testX;
                        cameraPos[2] = testZ;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) {
                console.log("Nova posição segura atribuída com sucesso:", cameraPos);
            } else {
                console.error("ERRO: Não foi possível encontrar nenhum local sem colisão!");
            }
        } else {
            console.log("Posição inicial válida:", cameraPos);
        }
    }

    // =========================================================================
    // 4. LOOP DE JOGO
    // =========================================================================
    let lastTime = 0;
    let fpsSmoothing = 0.9;
    let averageFps = 60;

    function gameLoop(now) {
        now *= 0.001;
        const deltaTime = Math.min(now - lastTime, 0.1);
        lastTime = now;

        // Calcula FPS
        if (deltaTime > 0) {
            const currentFps = 1 / deltaTime;
            averageFps = averageFps * fpsSmoothing + currentFps * (1.0 - fpsSmoothing);
            if (Math.abs(now % 0.5) < 0.02) { // Atualiza HUD a cada 0.5s
                document.getElementById("statFPS").textContent = Math.round(averageFps);
            }
        }

        gameTime += deltaTime;
        update(deltaTime);
        render();
        requestAnimationFrame(gameLoop);
    }

    const frontProj = Vec3.create();
    const rightVec = Vec3.create();
    function update(dt) {
        if (isGameOver) return;

        // Verificar coleta do cálice
        if (!hasGoblet) {
            const dx = cameraPos[0] - gobletWorldPos[0];
            const dz = cameraPos[2] - gobletWorldPos[2];
            const dist = Math.hypot(dx, dz);
            if (dist < 0.8) {
                hasGoblet = true;
                console.log("Cálice de Fogo coletado!");
                showToast("CÁLICE DE FOGO COLETADO", "A chama da saída foi extinta. O Olho de Jade ficou furioso! Corra para a saída em [1.0, 1.5]!");
            }
        } else {
            // Se coletou o cálice, verifica se chegou à saída (1.0, 1.5) para vencer
            const dx = cameraPos[0] - 1.0;
            const dz = cameraPos[2] - 1.5;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.8) {
                triggerWin();
                return;
            }
        }

        if (!isOverviewMode) {
            const moveSpeed = movementSpeed * dt;
            Vec3.set(frontProj, cameraFront[0], 0, cameraFront[2]);
            Vec3.normalize(frontProj, frontProj);
            Vec3.cross(rightVec, cameraFront, cameraUp);
            Vec3.normalize(rightVec, rightVec);

            let dx = 0, dz = 0;
            if (keys.W) { dx += frontProj[0] * moveSpeed; dz += frontProj[2] * moveSpeed; }
            if (keys.S) { dx -= frontProj[0] * moveSpeed; dz -= frontProj[2] * moveSpeed; }
            if (keys.D) { dx += rightVec[0] * moveSpeed; dz += rightVec[2] * moveSpeed; }
            if (keys.A) { dx -= rightVec[0] * moveSpeed; dz -= rightVec[2] * moveSpeed; }

            const steps = 4;
            const subDx = dx / steps;
            const subDz = dz / steps;

            for (let i = 0; i < steps; i++) {
                if (!checkCollision(cameraPos[0] + subDx, cameraPos[2])) {
                    cameraPos[0] += subDx;
                }
                if (!checkCollision(cameraPos[0], cameraPos[2] + subDz)) {
                    cameraPos[2] += subDz;
                }
            }
        }

        // Restringir limites físicos da câmera do jogador aos limites do labirinto expandido (chão expandido de -6 a 24.6)
        cameraPos[0] = Math.max(-5.0, Math.min(23.6, cameraPos[0]));
        cameraPos[2] = Math.max(-5.0, Math.min(23.6, cameraPos[2]));

        // Lógica de Movimentação Aleatória e Suave do Feixe do Olho de Jade
        eyeWaypointTimer += dt;
        const distToWp = Math.hypot(eyeTarget[0] - eyeTargetWaypoint[0], eyeTarget[2] - eyeTargetWaypoint[2]);
        const waypointTimeout = hasGoblet ? 4.0 : 12.0;
        const waypointArrivalDist = hasGoblet ? 1.5 : 0.8;

        if (eyeWaypointTimer > waypointTimeout || distToWp < waypointArrivalDist) {
            // Sorteia um novo waypoint aleatório dentro do limite espacial do labirinto
            eyeTargetWaypoint[0] = 3.0 + Math.random() * (mazeScale * 0.3 - 6.0);
            eyeTargetWaypoint[2] = 3.0 + Math.random() * (mazeScale * 0.3 - 6.0);
            eyeWaypointTimer = 0.0;
        }
        
        // Interpola suavemente a posição do feixe (fator de interpolação aumentado se o cálice for coletado)
        const jadeEyeSpeedFactor = hasGoblet ? 1.5 : 0.4;
        eyeTarget[0] += (eyeTargetWaypoint[0] - eyeTarget[0]) * dt * jadeEyeSpeedFactor;
        eyeTarget[2] += (eyeTargetWaypoint[2] - eyeTarget[2]) * dt * jadeEyeSpeedFactor;

        // Atualiza a direção do feixe de luz do olho (olhando para o alvo no chão)
        Vec3.subtract(eyeDir, eyeTarget, eyePos);
        Vec3.normalize(eyeDir, eyeDir);

        // --- Atualizar Sistema de Partículas do Cálice ---
        if (particleSystem && !hasGoblet) {
            // A origem das partículas é a boca do cálice (topo da geometria, Y=1.45 * gobletScale)
            // + flutuação vertical sincronizada com a animação do render
            const floatY = 0.18 + Math.sin(gameTime * 2.2) * 0.06;
            const flameOriginY = floatY + 1.35 * gobletScale;
            particleSystem.update(dt, [gobletWorldPos[0], flameOriginY, gobletWorldPos[2]]);
        }

        // --- Atualizar Sistema de Partículas da Saída (Chama Vermelha de Bloqueio) ---
        if (exitFireSystem && !hasGoblet) {
            exitFireSystem.update(dt, [1.0, 0.05, 1.5]);
        }

        document.getElementById("statPos").textContent = `[${cameraPos[0].toFixed(1)}, ${cameraPos[1].toFixed(1)}, ${cameraPos[2].toFixed(1)}]`;
    }

    const projMatrix = Mat4.create();
    const viewMatrix = Mat4.create();
    const modelMatrix = Mat4.create();
    const lookAtTarget = Vec3.create();
    const lookAtDir = Vec3.create();
    const activeCameraPos = Vec3.create();
    const activeCameraTarget = Vec3.create();
    const specColor = Vec3.create(1.0, 1.0, 1.0); // Cor de brilho especular branco

    function render() {
        if (!isLoaded) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const aspect = gl.canvas.width / gl.canvas.height;
        const fov = isOverviewMode ? Math.PI / 2.6 : Math.PI / 3;

        Mat4.perspective(projMatrix, fov, aspect, 0.1, 1000.0);

        if (isOverviewMode) {
            Vec3.set(activeCameraPos, overviewCameraPos[0], overviewCameraPos[1], overviewCameraPos[2]);
            Vec3.set(activeCameraTarget, overviewTarget[0], overviewTarget[1], overviewTarget[2]);
        } else {
            Vec3.set(lookAtDir, -cameraFront[0], -cameraFront[1], -cameraFront[2]);
            Vec3.normalize(lookAtDir, lookAtDir);
            Vec3.subtract(lookAtTarget, cameraPos, lookAtDir);
            Vec3.set(activeCameraPos, cameraPos[0], cameraPos[1], cameraPos[2]);
            Vec3.set(activeCameraTarget, lookAtTarget[0], lookAtTarget[1], lookAtTarget[2]);
        }

        Mat4.lookAt(viewMatrix, activeCameraPos, activeCameraTarget, cameraUp);
        Mat4.scale(modelMatrix, mazeScale, mazeScale * wallHeightMultiplier, mazeScale);

        gl.useProgram(shaderProgram);
        gl.uniformMatrix4fv(locations.uProjectionMatrix, false, projMatrix);
        gl.uniformMatrix4fv(locations.uViewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(locations.uModelMatrix, false, modelMatrix);
        
        // Dados da Câmera
        gl.uniform3fv(locations.uCameraPos, activeCameraPos);
        gl.uniform3fv(locations.uCameraFront, cameraFront);
        
        // Luz 1: Lanterna do Jogador (Branca/Amarelada)
        const light1Color = isLightOn ? [1.0, 0.95, 0.85] : [0.0, 0.0, 0.0];
        gl.uniform3fv(locations.uLight1Color, light1Color);
        document.getElementById("statLight").textContent = isLightOn ? "Lanterna (Ligada)" : "Escuridão (Desligada)";

        // Luz 2: Olho de Jade (Posição, Direção e Cor)
        gl.uniform3fv(locations.uEyePos, eyePos);
        gl.uniform3fv(locations.uEyeDir, eyeDir);
        const currentLight2Color = hasGoblet ? [1.0, 0.05, 0.05] : [light2Color[0], light2Color[1], light2Color[2]];
        gl.uniform3fv(locations.uLight2Color, currentLight2Color);

        // Luz 3: Chama Azul do Cálice (Point Light que se projeta nas paredes e chão)
        {
            const floatY = 0.18 + Math.sin(gameTime * 2.2) * 0.06;
            const flameY = floatY + 1.35 * gobletScale;
            const flicker = 0.85 + 0.15 * Math.sin(gameTime * 18.0) + 0.08 * Math.sin(gameTime * 33.0);
            gl.uniform3fv(locations.uFlamePos, [gobletWorldPos[0], flameY, gobletWorldPos[2]]);
            gl.uniform3fv(locations.uFlameColor, [0.05 * flicker, 0.35 * flicker, 1.0 * flicker]);
        }

        // Parâmetros de Especularidade (Modelo de Phong completo)
        gl.uniform1f(locations.uShininess, 32.0);
        gl.uniform3fv(locations.uSpecularColor, specColor);

        // Bindar texturas para as paredes
        if (wallAlbedoTexture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, wallAlbedoTexture);
            gl.uniform1i(locations.uAlbedoMap, 0);
        }
        if (wallRoughnessTexture) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, wallRoughnessTexture);
            gl.uniform1i(locations.uRoughnessMap, 1);
        }
        if (groundAlbedoTexture) {
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, groundAlbedoTexture);
            gl.uniform1i(locations.uGroundAlbedoMap, 2);
        }

        for (const mesh of labyrinthMeshes) {
            gl.bindVertexArray(mesh.vao);
            if (mesh.hasIndices) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
            else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
        }

        // --- DESENHAR CHÃO DO LABIRINTO ---
        // Usa o mesmo model matrix (mazeScale) que as paredes, para manter escala consistente
        if (floorMesh) {
            gl.bindVertexArray(floorMesh.vao);
            gl.drawArrays(gl.TRIANGLES, 0, floorMesh.count);
            gl.bindVertexArray(null);
        }

        // --- DESENHAR CONE DE LUZ DO OLHO DE JADE (Translúcido / Volumétrico) ---
        const N = 16;
        const coneCoords = new Float32Array((N + 2) * 3);
        // Ápice no Olho de Jade
        coneCoords[0] = eyePos[0];
        coneCoords[1] = eyePos[1];
        coneCoords[2] = eyePos[2];
        
        // Círculo base no chão (raio do feixe)
        const coneRadius = 3.0; // Raio da cônica ajustado para 3.0 unidades para bater com spotCutoff2 = 0.93
        for (let i = 0; i <= N; i++) {
            const angle = (i % N) * 2 * Math.PI / N;
            const idx = (i + 1) * 3;
            coneCoords[idx] = eyeTarget[0] + Math.cos(angle) * coneRadius;
            coneCoords[idx+1] = 0.05; // Levemente acima do chão (Y=0) para evitar z-fighting
            coneCoords[idx+2] = eyeTarget[2] + Math.sin(angle) * coneRadius;
        }

        // Upload dinâmico dos vértices do cone
        gl.bindBuffer(gl.ARRAY_BUFFER, coneVBO);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, coneCoords);

        // Configuração de transparência (Blend aditivo) e desativação da escrita no Z-buffer
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);

        gl.useProgram(coneProgram);
        gl.uniformMatrix4fv(coneLocations.uProjectionMatrix, false, projMatrix);
        gl.uniformMatrix4fv(coneLocations.uViewMatrix, false, viewMatrix);
        const currentConeColor = hasGoblet ? [0.9, 0.05, 0.05] : [0.0, 0.8, 0.2];
        gl.uniform3fv(coneLocations.uConeColor, currentConeColor); // Verde Jade translúcido ou Vermelho do Caçador

        gl.bindVertexArray(coneVAO);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, N + 2);
        gl.bindVertexArray(null);

        // Restaurar estado do WebGL
        gl.depthMask(true);
        gl.disable(gl.BLEND);

        // --- DESENHAR CÁLICE DE FOGO ---
        if (gobletMesh && gobletProgram && !hasGoblet) {
            // Animação: flutuação vertical + rotação contínua (igual ao preview)
            const floatY = 0.18 + Math.sin(gameTime * 2.2) * 0.06;
            const rotationY = gameTime * 0.85;

            // Construir model matrix: Translate → Rotation → Scale
            Mat4.translation(gobletModelMatrix, gobletWorldPos[0], floatY, gobletWorldPos[2]);
            Mat4.rotationY(gobletRotMatrix, rotationY);
            Mat4.scale(gobletTempMatrix, gobletScale, gobletScale, gobletScale);
            Mat4.multiply(gobletCombined, gobletModelMatrix, gobletRotMatrix);
            Mat4.multiply(gobletModelMatrix, gobletCombined, gobletTempMatrix);

            gl.useProgram(gobletProgram);
            gl.uniformMatrix4fv(gobletLocations.uProjectionMatrix, false, projMatrix);
            gl.uniformMatrix4fv(gobletLocations.uViewMatrix, false, viewMatrix);
            gl.uniformMatrix4fv(gobletLocations.uGobletModelMatrix, false, gobletModelMatrix);
            gl.uniform3fv(gobletLocations.uCameraPos, activeCameraPos);
            gl.uniform3fv(gobletLocations.uCameraFront, cameraFront);

            const gobletLight1 = isLightOn ? [1.0, 0.95, 0.85] : [0.0, 0.0, 0.0];
            gl.uniform3fv(gobletLocations.uLight1Color, gobletLight1);
            gl.uniform3fv(gobletLocations.uEyePos, eyePos);
            gl.uniform3fv(gobletLocations.uEyeDir, eyeDir);
            gl.uniform3fv(gobletLocations.uLight2Color, light2Color);
            gl.uniform1f(gobletLocations.uTime, gameTime);

            // O cálice precisa renderizar frente e verso por causa do interior do copo
            gl.disable(gl.CULL_FACE);
            gl.bindVertexArray(gobletMesh.vao);
            gl.drawElements(gl.TRIANGLES, gobletMesh.count, gobletMesh.indexType, 0);
            gl.bindVertexArray(null);
            gl.enable(gl.CULL_FACE);
        }

        // --- DESENHAR PARTÍCULAS (CHAMAS) ---
        if (particleProgram) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Blend aditivo para brilho
            gl.depthMask(false); // Não escrever no Z-buffer (translúcido)

            gl.useProgram(particleProgram);
            gl.uniformMatrix4fv(particleLocations.uProjectionMatrix, false, projMatrix);
            gl.uniformMatrix4fv(particleLocations.uViewMatrix, false, viewMatrix);

            // Chama azul do cálice (tipo 0) se o cálice não foi pego
            if (particleSystem && !hasGoblet) {
                gl.uniform1i(particleLocations.uParticleType, 0);
                particleSystem.draw(gl, particleProgram);
            }

            // Chama vermelha da saída (tipo 1) se o cálice não foi pego
            if (exitFireSystem && !hasGoblet) {
                gl.uniform1i(particleLocations.uParticleType, 1);
                exitFireSystem.draw(gl, particleProgram);
            }

            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }

        if (isOverviewMode && markerProgram && markerVAO) {
            const markerPos = new Float32Array([cameraPos[0], 1.55, cameraPos[2]]);
            const markerSize = Math.min(gl.canvas.width, gl.canvas.height) * 0.045;

            gl.bindBuffer(gl.ARRAY_BUFFER, markerVBO);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, markerPos);

            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            gl.useProgram(markerProgram);
            gl.uniformMatrix4fv(markerLocations.uProjectionMatrix, false, projMatrix);
            gl.uniformMatrix4fv(markerLocations.uViewMatrix, false, viewMatrix);
            gl.uniform3fv(markerLocations.uMarkerColor, [1.0, 0.15, 0.15]);
            gl.uniform1f(markerLocations.uMarkerSize, markerSize);

            gl.bindVertexArray(markerVAO);
            gl.drawArrays(gl.POINTS, 0, 1);
            gl.bindVertexArray(null);

            gl.disable(gl.BLEND);
            gl.enable(gl.DEPTH_TEST);
        }
    }

    function showToast(title, desc) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-desc">${desc}</div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = "slideOut 0.3s ease-in forwards";
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    function triggerWin() {
        if (isGameOver) return;
        isGameOver = true;
        
        // Parar o mouse / release pointer lock
        if (document.pointerLockElement === canvas) {
            document.exitPointerLock();
        }
        
        // Exibir tela de vitória
        const winOverlay = document.getElementById("winOverlay");
        if (winOverlay) {
            winOverlay.style.display = "flex";
        }
    }

    document.getElementById("restartBtn")?.addEventListener("click", () => {
        location.reload();
    });

    initGame();
});
