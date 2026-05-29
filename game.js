/**
 * game.js
 * 3D Engine Boilerplate - WebGL 2.0 Puro
 *
 * Contém o esqueleto estruturado do pipeline gráfico, manipuladores de eventos
 * de teclado/mouse (Pointer Lock), telemetria do motor e funções utilitárias.
 */

window.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // 1. SETUP DO CANVAS E CONTEXTO WEBGL 2.0
    // =========================================================================
    const canvas = document.getElementById("gameCanvas");
    const gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("Erro: Seu navegador não suporta WebGL 2.0.");
        return;
    }

    // Configurações básicas de hardware do pipeline gráfico
    gl.enable(gl.DEPTH_TEST);       // Habilita teste de profundidade (Z-Buffer)
    gl.depthFunc(gl.LEQUAL);        // Pixels mais próximos sobrepõem os distantes
    gl.enable(gl.CULL_FACE);        // Habilita descarte de faces ocultas
    gl.cullFace(gl.BACK);           // Descarta faces traseiras dos polígonos
    gl.clearColor(0.04, 0.04, 0.06, 1.0); // Cor de fundo inicial (Cinza escuro)

    // Redimensionamento inteligente do Canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Esconde o painel do loader inicial agora que o WebGL está pronto
    const loader = document.getElementById("loaderOverlay");
    if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => loader.style.display = "none", 800);
    }

    // =========================================================================
    // 2. SISTEMA DE CÂMERA EM PRIMEIRA PESSOA (FPS)
    // =========================================================================
    const cameraPos = new Float32Array([0.0, 1.8, 6.5]);     // Posição inicial da câmera [X, Y, Z]
    const cameraFront = new Float32Array([0.0, 0.0, -1.0]);   // Direção para onde a câmera aponta
    const cameraUp = new Float32Array([0.0, 1.0, 0.0]);      // Vetor 'para cima' global do mundo

    let yaw = -90.0;    // Ângulo de rotação horizontal (olhar esquerda/direita)
    let pitch = 0.0;    // Ângulo de rotação vertical (olhar cima/baixo)

    const keys = { W: false, A: false, S: false, D: false };
    const mouseSensitivity = 0.12; // Sensibilidade de rotação do olhar
    const movementSpeed = 4.0;    // Velocidade de movimento (unidades por segundo)

    // Captura de inputs do Teclado (WASD)
    window.addEventListener("keydown", (e) => {
        const k = e.key.toUpperCase();
        if (k in keys) keys[k] = true;

        // Exemplo: Tecla L para alternar alguma lógica (como luz secundária)
        if (e.key.toLowerCase() === 'l') {
            toggleActiveLight();
        }
    });

    window.addEventListener("keyup", (e) => {
        const k = e.key.toUpperCase();
        if (k in keys) keys[k] = false;
    });

    // Pointer Lock API (Trava o cursor na tela para rotação 3D de primeira pessoa)
    const pointerStatusDiv = document.getElementById("pointerStatus");
    canvas.addEventListener("click", () => {
        canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
        if (document.pointerLockElement === canvas) {
            pointerStatusDiv.textContent = "Controle de Câmera Ativo (ESC para sair)";
            pointerStatusDiv.classList.add("pointer-active");
        } else {
            pointerStatusDiv.textContent = "Clique na tela para capturar o mouse (Pointer Lock)";
            pointerStatusDiv.classList.remove("pointer-active");
        }
    });

    // Atualiza a direção de olhar com base no movimento do mouse
    document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement !== canvas) return;

        yaw += e.movementX * mouseSensitivity;
        pitch -= e.movementY * mouseSensitivity;

        // Limita o pitch vertical para evitar que a câmera dê cambalhotas
        pitch = Math.max(-89.0, Math.min(89.0, pitch));

        // Calcula a nova direção usando trigonometria esférica
        const yawRad = yaw * Math.PI / 180;
        const pitchRad = pitch * Math.PI / 180;

        const front = new Float32Array([
            Math.cos(pitchRad) * Math.cos(yawRad),
            Math.sin(pitchRad),
            Math.cos(pitchRad) * Math.sin(yawRad)
        ]);

        // Normaliza e atualiza o vetor direcionador
        const normalized = Vec3.normalize(front);
        cameraFront[0] = normalized[0];
        cameraFront[1] = normalized[1];
        cameraFront[2] = normalized[2];
    });

    // =========================================================================
    // 3. FERRAMENTAS & UTILS DO WEBGL (BOILERPLATE)
    // =========================================================================

    /**
     * Compila um Shader individual (Vertex ou Fragment).
     */
    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Erro ao compilar shader:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * Cria e linka um Shader Program completo a partir de fontes de texto.
     */
    function createProgram(gl, vsSource, fsSource) {
        const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
        const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
        if (!vs || !fs) return null;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Erro ao linkar programa de shaders:", gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    /**
     * Cria um Vertex Buffer Object (VBO) na GPU e envia os dados.
     * Tipo padrão: gl.ARRAY_BUFFER (dados) ou gl.ELEMENT_ARRAY_BUFFER (índices)
     */
    function createGPUBuffer(gl, data, targetType = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(targetType, buffer);
        gl.bufferData(targetType, data, usage);
        return buffer;
    }

    /**
     * Carrega uma imagem de forma assíncrona e cria uma textura 2D no WebGL.
     */
    function loadTexture2D(gl, url) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Preenche com 1 pixel provisório cinza enquanto carrega
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([80, 80, 80, 255]));

        const image = new Image();
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            // Se as dimensões forem potências de 2, gera Mipmap para otimizar
            const isPowerOf2 = (value) => (value & (value - 1)) === 0;
            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            console.log(`Textura carregada com sucesso: ${url}`);
        };
        image.src = url;
        return texture;
    }

    // Exemplo de alternar estado na HUD
    let lightMode = "Pêndulo";
    const statLightSpan = document.getElementById("statLight");
    function toggleActiveLight() {
        lightMode = lightMode === "Pêndulo" ? "Lanterna (Câmera)" : "Pêndulo";
        if (statLightSpan) statLightSpan.textContent = lightMode;
    }

    // =========================================================================
    // 4. MODELOS E SHADERS PARA IMPLEMENTAÇÃO (EXEMPLOS INICIAIS)
    // =========================================================================

    // Shader de Template Básico com suporte à Projeção, Visualização, Posição e Cor
    const templateVS = `#version 300 es
    in vec3 aPosition;
    in vec3 aNormal;
    in vec2 aTexCoord;

    out vec3 vWorldPos;
    out vec3 vNormal;
    out vec2 vTexCoord;

    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;

    void main() {
        vec4 worldPos = uModelMatrix * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(uModelMatrix) * aNormal);
        vTexCoord = aTexCoord;
        gl_Position = uProjectionMatrix * uViewMatrix * worldPos;
    }
    `;

    const templateFS = `#version 300 es
    precision highp float;

    in vec3 vWorldPos;
    in vec3 vNormal;
    in vec2 vTexCoord;

    out vec4 fragColor;

    uniform vec3 uCameraPos;
    uniform vec4 uSolidColor;

    void main() {
        // Exemplo básico: Renderização de cor sólida simples
        // Sinta-se à vontade para implementar Iluminação Phong completa,
        // texturas, luzes móveis dinâmicas, etc.
        fragColor = uSolidColor;
    }
    `;

    // Expondo ferramentas úteis globalmente para você programar fora do escopo inicial
    window.compileShader = compileShader;
    window.createProgram = createProgram;
    window.createGPUBuffer = createGPUBuffer;
    window.loadTexture2D = loadTexture2D;

    // =========================================================================
    // 5. LOOP DE ATUALIZAÇÃO E RENDERIZAÇÃO
    // =========================================================================
    let lastTime = 0;
    let fpsTimer = 0;
    let fpsCounter = 0;

    // Inicia a execução do loop
    requestAnimationFrame(gameLoop);

    function gameLoop(now) {
        now *= 0.001; // Converte milissegundos para segundos
        const deltaTime = now - lastTime;
        lastTime = now;

        // Medidor de FPS
        fpsCounter++;
        fpsTimer += deltaTime;
        if (fpsTimer >= 1.0) {
            document.getElementById("statFPS").textContent = fpsCounter;
            fpsCounter = 0;
            fpsTimer = 0;
        }

        update(deltaTime, now);
        render(now);

        requestAnimationFrame(gameLoop);
    }

    /**
     * Atualiza a lógica de física, câmera e posições no CPU.
     */
    function update(deltaTime, time) {
        // 1. Movimentação Física da Câmera baseada nas teclas WASD
        const moveSpeed = movementSpeed * deltaTime;

        // Projetar vetor Front apenas no plano horizontal XZ para evitar "voar" ao andar
        const frontProj = new Float32Array([cameraFront[0], 0.0, cameraFront[2]]);
        const frontProjNorm = Vec3.normalize(frontProj);

        // Calcula vetor lateral (Right = Front x Up)
        const rightVec = Vec3.cross(cameraFront, cameraUp);
        const rightVecNorm = Vec3.normalize(rightVec);

        if (keys.W) {
            cameraPos[0] += frontProjNorm[0] * moveSpeed;
            cameraPos[2] += frontProjNorm[2] * moveSpeed;
        }
        if (keys.S) {
            cameraPos[0] -= frontProjNorm[0] * moveSpeed;
            cameraPos[2] -= frontProjNorm[2] * moveSpeed;
        }
        if (keys.D) {
            cameraPos[0] += rightVecNorm[0] * moveSpeed;
            cameraPos[2] += rightVecNorm[2] * moveSpeed;
        }
        if (keys.A) {
            cameraPos[0] -= rightVecNorm[0] * moveSpeed;
            cameraPos[2] -= rightVecNorm[2] * moveSpeed;
        }

        // Restrição de limites de caminhada (Exemplo: 20x20 unidades)
        cameraPos[0] = Math.max(-20.0, Math.min(20.0, cameraPos[0]));
        cameraPos[2] = Math.max(-20.0, Math.min(20.0, cameraPos[2]));

        // 2. Atualizar Telemetria da Câmera no HUD
        const posText = `[${cameraPos[0].toFixed(2)}, ${cameraPos[1].toFixed(2)}, ${cameraPos[2].toFixed(2)}]`;
        const rotText = `${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°`;
        document.getElementById("statPos").textContent = posText;
        document.getElementById("statRot").textContent = rotText;

        // Adicione aqui transformações dinâmicas de rotação ou translação das suas variáveis do jogo...
    }

    /**
     * Executa as chamadas de desenho do pipeline WebGL.
     */
    function render(time) {
        // Limpa a tela (Cor de fundo + Buffer de Profundidade)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // -------------------------------------------------------------
        // CALCULO DE MATRIZES MANUAIS (math3d.js)
        // -------------------------------------------------------------
        // Proporção de tela ativa
        const aspect = gl.canvas.width / gl.canvas.height;

        // 1. Projeção Perspectiva Manual
        const projectionMatrix = Mat4.perspective(60.0 * Math.PI / 180.0, aspect, 0.1, 100.0);

        // 2. Visualização Câmera (LookAt) Manual
        const target = new Float32Array([
            cameraPos[0] + cameraFront[0],
            cameraPos[1] + cameraFront[1],
            cameraPos[2] + cameraFront[2]
        ]);
        const viewMatrix = Mat4.lookAt(cameraPos, target, cameraUp);

        // =============================================================
        // RENDERIZE SEUS OBJETOS ABAIXO!
        // =============================================================
        // Exemplo dos passos que você deve seguir para desenhar objetos na tela:
        //
        // 1. Habilite o Shader Program desejado:
        //    gl.useProgram(seuPrograma);
        //
        // 2. Calcule a Matriz do Modelo (Model Matrix) do seu objeto:
        //    let modelMatrix = Mat4.translation(x, y, z);
        //    modelMatrix = Mat4.multiply(modelMatrix, Mat4.rotationY(angulo));
        //
        // 3. Envie as Matrizes de Transformação para os Uniforms correspondentes:
        //    gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
        //    gl.uniformMatrix4fv(viewLocation, false, viewMatrix);
        //    gl.uniformMatrix4fv(modelLocation, false, modelMatrix);
        //
        // 4. Configure outros uniforms (Ex: uLightPos, uCameraPos, cores, etc):
        //    gl.uniform3fv(lightPosLocation, activeLightPos);
        //
        // 5. Vincule seus buffers da GPU e habilite os atributos:
        //    gl.bindBuffer(gl.ARRAY_BUFFER, seuBufferDePosição);
        //    gl.vertexAttribPointer(attribPosition, 3, gl.FLOAT, false, 0, 0);
        //    gl.enableVertexAttribArray(attribPosition);
        //
        // 6. Vincule texturas 2D (se aplicável):
        //    gl.activeTexture(gl.TEXTURE0);
        //    gl.bindTexture(gl.TEXTURE_2D, suaTextura);
        //    gl.uniform1i(samplerLocation, 0);
        //
        // 7. Efetue a renderização final:
        //    // Para arrays lineares planos (como os carregados pelo OBJParser):
        //    gl.drawArrays(gl.TRIANGLES, 0, totalDeVertices);
        //    // Ou para polígonos indexados (VBO com EBO):
        //    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, seuBufferDeIndices);
        //    gl.drawElements(gl.TRIANGLES, totalDeIndices, gl.UNSIGNED_SHORT, 0);

    }
});
