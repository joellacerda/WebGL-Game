/**
 * goblet-generator.js
 * Gerador procedural do Cálice de Fogo 3D e Sistema de Partículas em WebGL 2.0
 */

const GobletGenerator = {
    /**
     * Gera a geometria do cálice de fogo baseada em uma curva de perfil 2D.
     * @param {WebGL2RenderingContext} gl
     * @returns {Object} { vao, count, hasIndices: true, indexType: gl.UNSIGNED_SHORT }
     */
    generateGobletMesh(gl) {
        // Curva de perfil 2D (R, Y)
        // R = raio no ponto Y, Y = altura do cálice
        const profile = [
            { r: 0.0,  y: 0.0 },   // Centro da base inferior
            { r: 0.4,  y: 0.0 },   // Borda inferior da base
            { r: 0.38, y: 0.05 },  // Chanfro da base
            { r: 0.12, y: 0.15 },  // Afunilamento para a haste
            { r: 0.07, y: 0.25 },  // Início da haste (pescoço inferior)
            { r: 0.07, y: 0.55 },  // Meio da haste
            { r: 0.10, y: 0.65 },  // Anel decorativo da haste
            { r: 0.07, y: 0.75 },  // Fim da haste (pescoço superior)
            { r: 0.12, y: 0.85 },  // Início da base do copo
            { r: 0.30, y: 1.15 },  // Expansão do copo (bojo)
            { r: 0.42, y: 1.45 },  // Borda superior do copo (lábio externo)
            { r: 0.39, y: 1.45 },  // Borda superior interna (espessura do lábio)
            { r: 0.36, y: 1.20 },  // Interior do copo (parede interna superior)
            { r: 0.22, y: 0.98 },  // Interior do copo (parede interna inferior)
            { r: 0.0,  y: 0.94 }   // Centro do fundo do copo
        ];

        const radialSegments = 36; // Número de fatias ao redor do eixo Y (suavidade)
        const numPoints = profile.length;

        const positions = [];
        const normals = [];
        const indices = [];

        // 1. Gerar os Vértices e as Normais
        for (let i = 0; i < numPoints; i++) {
            const p = profile[i];
            
            // Calcular o vetor normal 2D ao perfil (dR, dY) para gerar normais 3D analíticas
            let normalR = 1.0;
            let normalY = 0.0;

            if (i < numPoints - 1) {
                const nextP = profile[i + 1];
                const dR = nextP.r - p.r;
                const dY = nextP.y - p.y;
                const len = Math.hypot(dR, dY);
                if (len > 0.0001) {
                    // O vetor tangente é (dR, dY). O vetor normal perpendicular apontando para fora é (dY, -dR)
                    normalR = dY / len;
                    normalY = -dR / len;
                }
            } else {
                // Último ponto (centro interno do fundo), copia a normal do anterior
                const prevP = profile[i - 1];
                const dR = p.r - prevP.r;
                const dY = p.y - prevP.y;
                const len = Math.hypot(dR, dY);
                if (len > 0.0001) {
                    normalR = dY / len;
                    normalY = -dR / len;
                }
            }

            // Rotacionar o perfil 360 graus ao redor do eixo Y
            for (let j = 0; j < radialSegments; j++) {
                const angle = (j * 2 * Math.PI) / radialSegments;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                // Posição 3D (X, Y, Z)
                const x = p.r * cos;
                const y = p.y;
                const z = p.r * sin;
                positions.push(x, y, z);

                // Normal 3D (NX, NY, NZ)
                // Rotacionamos o vetor normal 2D (normalR, normalY) correspondente
                const nx = normalR * cos;
                const ny = normalY;
                const nz = normalR * sin;
                
                // Normalizar normal 3D
                const nLen = Math.hypot(nx, ny, nz);
                if (nLen > 0.0001) {
                    normals.push(nx / nLen, ny / nLen, nz / nLen);
                } else {
                    normals.push(0.0, 1.0, 0.0);
                }
            }
        }

        // 2. Gerar os Índices para os Triângulos
        for (let i = 0; i < numPoints - 1; i++) {
            for (let j = 0; j < radialSegments; j++) {
                const currRingStart = i * radialSegments;
                const nextRingStart = (i + 1) * radialSegments;

                const jNext = (j + 1) % radialSegments;

                const p00 = currRingStart + j;
                const p10 = nextRingStart + j;
                const p01 = currRingStart + jNext;
                const p11 = nextRingStart + jNext;

                // Triângulo 1 (Sentido anti-horário para face culling padrão)
                indices.push(p00, p10, p01);
                // Triângulo 2
                indices.push(p10, p11, p01);
            }
        }

        // Criar VAO e buffers do WebGL
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // Buffer de Posições
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        // Atributo de Posição (local 0 no Shader principal)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // Buffer de Normais
        const normBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
        // Atributo de Normal (local 1 no Shader principal)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        // Buffer de Índices
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        return {
            vao: vao,
            count: indices.length,
            hasIndices: true,
            indexType: gl.UNSIGNED_SHORT
        };
    }
};

/**
 * Representa o Sistema de Partículas para a Chama de Fogo Azul
 */
class ParticleSystem {
    constructor(maxParticles = 100) {
        this.maxParticles = maxParticles;
        this.particles = [];
        
        // Inicializa o vetor de partículas
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push(this.resetParticle({}, [0, 0, 0]));
            // Distribui a idade inicial aleatoriamente para evitar que todas as partículas nasçam juntas
            this.particles[i].age = Math.random() * this.particles[i].life;
        }

        // Arrays estruturados para envio direto à GPU
        this.positions = new Float32Array(maxParticles * 3);
        this.ages = new Float32Array(maxParticles);
        this.lives = new Float32Array(maxParticles);
        this.sizes = new Float32Array(maxParticles);

        this.vao = null;
        this.posVBO = null;
        this.ageVBO = null;
        this.lifeVBO = null;
        this.sizeVBO = null;
    }

    /**
     * Reseta as propriedades de uma partícula na origem especificada
     */
    resetParticle(p, origin = [0, 0, 0]) {
        // Posição com leve dispersão radial na boca do cálice
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 0.14;
        p.x = origin[0] + Math.cos(angle) * radius;
        p.y = origin[1] + (Math.random() - 0.5) * 0.04;
        p.z = origin[2] + Math.sin(angle) * radius;

        // Velocidade: subida vertical rápida, dispersão lateral pequena
        p.vx = (Math.random() - 0.5) * 0.28;
        p.vy = 0.65 + Math.random() * 0.8;
        p.vz = (Math.random() - 0.5) * 0.28;

        p.age = 0.0;
        p.life = 0.5 + Math.random() * 0.6;   // Tempo de vida entre 0.5s e 1.1s
        p.size = 0.12 + Math.random() * 0.14; // Tamanho físico no shader

        return p;
    }

    /**
     * Atualiza a física de todas as partículas
     */
    update(dt, origin) {
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            p.age += dt;

            if (p.age >= p.life) {
                this.resetParticle(p, origin);
            } else {
                // Atualiza posição
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += p.vz * dt;

                // Resfriamento/atrito lateral (faz a chama subir em formato de funil/cone)
                p.vx *= 0.94;
                p.vz *= 0.94;
            }

            // Copia dados para os Float32Arrays estruturados
            const i3 = i * 3;
            this.positions[i3] = p.x;
            this.positions[i3 + 1] = p.y;
            this.positions[i3 + 2] = p.z;

            this.ages[i] = p.age;
            this.lives[i] = p.life;
            this.sizes[i] = p.size;
        }
    }

    /**
     * Inicializa os buffers e os atributos de vértices do WebGL para o sistema
     */
    initWebGL(gl, program) {
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        const locPos = gl.getAttribLocation(program, "aPosition");
        const locAge = gl.getAttribLocation(program, "aAge");
        const locLife = gl.getAttribLocation(program, "aLife");
        const locSize = gl.getAttribLocation(program, "aSize");

        // Buffer de Posições (Dinâmico)
        this.posVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posVBO);
        gl.bufferData(gl.ARRAY_BUFFER, this.positions.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locPos);
        gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);

        // Buffer de Idade (Dinâmico)
        this.ageVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ageVBO);
        gl.bufferData(gl.ARRAY_BUFFER, this.ages.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locAge);
        gl.vertexAttribPointer(locAge, 1, gl.FLOAT, false, 0, 0);

        // Buffer de Tempo de Vida (Dinâmico)
        this.lifeVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeVBO);
        gl.bufferData(gl.ARRAY_BUFFER, this.lives.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locLife);
        gl.vertexAttribPointer(locLife, 1, gl.FLOAT, false, 0, 0);

        // Buffer de Tamanhos (Dinâmico)
        this.sizeVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeVBO);
        gl.bufferData(gl.ARRAY_BUFFER, this.sizes.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locSize);
        gl.vertexAttribPointer(locSize, 1, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    /**
     * Desenha as partículas na GPU
     */
    draw(gl, program) {
        gl.useProgram(program);

        // Upload dinâmico dos dados mais recentes de física para a GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posVBO);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.ageVBO);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ages);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.lifeVBO);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lives);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeVBO);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.sizes);

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.POINTS, 0, this.maxParticles);
        gl.bindVertexArray(null);
    }
}
