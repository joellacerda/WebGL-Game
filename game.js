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
    const cameraPos = Vec3.create(mazeScale * 0.15, 0.25, mazeScale * 0.15); // Inicializa no centro do labirinto (ajustado no validate)
    const cameraFront = Vec3.create(0.0, 0.0, -1.0);
    const cameraUp = Vec3.create(0.0, 1.0, 0.0);

    let yaw = -90.0;
    let pitch = 0.0;
    const keys = { W: false, A: false, S: false, D: false };
    let isLightOn = true;
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
            // Chão (Floor)
            baseColor = texture(uGroundAlbedoMap, uv).rgb;
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

        // --- MODELO DE REFLEXÃO DE PHONG COMPLETO (Soma dos termos) ---
        vec3 finalColor = ambient + light1Contribution + light2Contribution;
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

    let shaderProgram;
    let locations = {};
    let labyrinthMeshes = [];
    let isLoaded = false;
    let wallSegments = new Float32Array(0);

    let wallAlbedoTexture;
    let wallRoughnessTexture;
    let groundAlbedoTexture;

    let coneProgram;
    let coneLocations = {};
    let coneVAO, coneVBO;

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

            extractWallSegments();
            validateStartPosition();

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
        const radius = 0.2; 
        const radiusSq = radius * radius;
        for (let i = 0; i < wallSegments.length; i += 4) {
            if (distToSegmentSq(nx, nz, wallSegments[i], wallSegments[i+1], wallSegments[i+2], wallSegments[i+3]) < radiusSq) {
                return true;
            }
        }
        return false;
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

        update(deltaTime);
        render();
        requestAnimationFrame(gameLoop);
    }

    const frontProj = Vec3.create();
    const rightVec = Vec3.create();
    function update(dt) {
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

        // Restringir limites físicos da câmera do jogador aos limites do labirinto
        cameraPos[0] = Math.max(1.0, Math.min(mazeScale * 0.3 - 1.0, cameraPos[0]));
        cameraPos[2] = Math.max(1.0, Math.min(mazeScale * 0.3 - 1.0, cameraPos[2]));

        // Lógica de Movimentação Aleatória e Suave do Feixe do Olho de Jade
        eyeWaypointTimer += dt;
        const distToWp = Math.hypot(eyeTarget[0] - eyeTargetWaypoint[0], eyeTarget[2] - eyeTargetWaypoint[2]);
        if (eyeWaypointTimer > 12.0 || distToWp < 0.8) {
            // Sorteia um novo waypoint aleatório dentro do limite espacial do labirinto
            eyeTargetWaypoint[0] = 3.0 + Math.random() * (mazeScale * 0.3 - 6.0);
            eyeTargetWaypoint[2] = 3.0 + Math.random() * (mazeScale * 0.3 - 6.0);
            eyeWaypointTimer = 0.0;
        }
        
        // Interpola suavemente a posição do feixe (fator de interpolação reduzido de 1.2 para 0.4 para movimento suave e lento)
        eyeTarget[0] += (eyeTargetWaypoint[0] - eyeTarget[0]) * dt * 0.4;
        eyeTarget[2] += (eyeTargetWaypoint[2] - eyeTarget[2]) * dt * 0.4;

        // Atualiza a direção do feixe de luz do olho (olhando para o alvo no chão)
        Vec3.subtract(eyeDir, eyeTarget, eyePos);
        Vec3.normalize(eyeDir, eyeDir);

        document.getElementById("statPos").textContent = `[${cameraPos[0].toFixed(1)}, ${cameraPos[1].toFixed(1)}, ${cameraPos[2].toFixed(1)}]`;
    }

    const projMatrix = Mat4.create();
    const viewMatrix = Mat4.create();
    const modelMatrix = Mat4.create();
    const lookAtTarget = Vec3.create();
    const lookAtDir = Vec3.create();
    const specColor = Vec3.create(1.0, 1.0, 1.0); // Cor de brilho especular branco

    function render() {
        if (!isLoaded) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const aspect = gl.canvas.width / gl.canvas.height;
        
        Mat4.perspective(projMatrix, Math.PI / 3, aspect, 0.1, 1000.0);
        
        Vec3.set(lookAtDir, -cameraFront[0], -cameraFront[1], -cameraFront[2]);
        Vec3.normalize(lookAtDir, lookAtDir);
        Vec3.subtract(lookAtTarget, cameraPos, lookAtDir);
        
        Mat4.lookAt(viewMatrix, cameraPos, lookAtTarget, cameraUp);
        Mat4.scale(modelMatrix, mazeScale, mazeScale * wallHeightMultiplier, mazeScale);

        gl.useProgram(shaderProgram);
        gl.uniformMatrix4fv(locations.uProjectionMatrix, false, projMatrix);
        gl.uniformMatrix4fv(locations.uViewMatrix, false, viewMatrix);
        gl.uniformMatrix4fv(locations.uModelMatrix, false, modelMatrix);
        
        // Dados da Câmera
        gl.uniform3fv(locations.uCameraPos, cameraPos);
        gl.uniform3fv(locations.uCameraFront, cameraFront);
        
        // Luz 1: Lanterna do Jogador (Branca/Amarelada)
        const light1Color = isLightOn ? [1.0, 0.95, 0.85] : [0.0, 0.0, 0.0];
        gl.uniform3fv(locations.uLight1Color, light1Color);
        document.getElementById("statLight").textContent = isLightOn ? "Lanterna (Ligada)" : "Escuridão (Desligada)";

        // Luz 2: Olho de Jade (Posição, Direção e Cor)
        gl.uniform3fv(locations.uEyePos, eyePos);
        gl.uniform3fv(locations.uEyeDir, eyeDir);
        gl.uniform3fv(locations.uLight2Color, light2Color);

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
        gl.uniform3fv(coneLocations.uConeColor, [0.0, 0.8, 0.2]); // Verde Jade translúcido

        gl.bindVertexArray(coneVAO);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, N + 2);
        gl.bindVertexArray(null);

        // Restaurar estado do WebGL
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }

    initGame();
});
