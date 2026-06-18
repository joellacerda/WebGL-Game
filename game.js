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
    // Ajustado para [20, 0.5, 20] para acompanhar o dobro da escala (antes era [10, 10] na escala 20)
    const cameraPos = Vec3.create(20.0, 0.25, 20.0);
    const cameraFront = Vec3.create(0.0, 0.0, -1.0);
    const cameraUp = Vec3.create(0.0, 1.0, 0.0);

    let yaw = -90.0;
    let pitch = 0.0;
    const keys = { W: false, A: false, S: false, D: false };
    let isLightOn = true;
    const mouseSensitivity = 0.15;
    const movementSpeed = 3.0;

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
    uniform vec3 uLightColor;
    void main() {
        vec3 lightDir = normalize(uCameraPos - vWorldPos);
        float distance = length(uCameraPos - vWorldPos);
        float attenuation = 1.0 / (1.0 + 0.02 * distance + 0.01 * distance * distance);
        
        float spotEffect = dot(normalize(uCameraFront), -lightDir);
        float spotCutoff = 0.85;
        float intensity = smoothstep(spotCutoff, spotCutoff + 0.1, spotEffect);

        float diff = max(dot(vNormal, lightDir), 0.0);
        vec3 ambient = vec3(0.02, 0.02, 0.04);
        vec3 finalColor = (ambient + diff * uLightColor * intensity * attenuation) * vec3(0.6);
        fragColor = vec4(finalColor, 1.0);
    }`;

    let shaderProgram;
    let locations = {};
    let labyrinthMeshes = [];
    let isLoaded = false;
    const mazeScale = 40.0;
    const wallHeightMultiplier = 3.0;
    let wallSegments = new Float32Array(0);

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

    async function initGame() {
        try {
            shaderProgram = createProgram(gl, vsSource, fsSource);
            locations = {
                uProjectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
                uViewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
                uModelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
                uCameraPos: gl.getUniformLocation(shaderProgram, "uCameraPos"),
                uCameraFront: gl.getUniformLocation(shaderProgram, "uCameraFront"),
                uLightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
                aPosition: gl.getAttribLocation(shaderProgram, "aPosition"),
                aNormal: gl.getAttribLocation(shaderProgram, "aNormal")
            };

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

    // Adiciona log para verificar se a posição inicial está em colisão
    function validateStartPosition() {
        if (checkCollision(cameraPos[0], cameraPos[2])) {
            console.error("ERRO: Jogador iniciou DENTRO de uma parede!", cameraPos);
        } else {
            console.log("Posição inicial válida.");
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

        document.getElementById("statPos").textContent = `[${cameraPos[0].toFixed(1)}, ${cameraPos[1].toFixed(1)}, ${cameraPos[2].toFixed(1)}]`;
    }

    const projMatrix = Mat4.create();
    const viewMatrix = Mat4.create();
    const modelMatrix = Mat4.create();
    const lookAtTarget = Vec3.create();
    const lookAtDir = Vec3.create();

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
        gl.uniform3fv(locations.uCameraPos, cameraPos);
        gl.uniform3fv(locations.uCameraFront, cameraFront);
        
        const lightColor = isLightOn ? [1.0, 0.9, 0.7] : [0.0, 0.0, 0.0];
        gl.uniform3fv(locations.uLightColor, lightColor);
        document.getElementById("statLight").textContent = isLightOn ? "Lanterna (Ligada)" : "Escuridão (Desligada)";

        for (const mesh of labyrinthMeshes) {
            gl.bindVertexArray(mesh.vao);
            if (mesh.hasIndices) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
            else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
        }
    }

    initGame();
});
