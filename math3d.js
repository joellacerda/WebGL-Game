/**
 * math3d.js
 * Biblioteca matemática 3D customizada implementando Álgebra Linear para WebGL.
 * Inclui operações manuais de Matriz 4x4 (Mat4) e Vetor 3D (Vec3).
 */

const Vec3 = {
    // Subtrai dois vetores: a - b
    subtract: function(a, b) {
        return new Float32Array([
            a[0] - b[0],
            a[1] - b[1],
            a[2] - b[2]
        ]);
    },

    // Calcula o produto vetorial: a x b
    cross: function(a, b) {
        return new Float32Array([
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ]);
    },

    // Normaliza o vetor (retorna vetor com comprimento = 1)
    normalize: function(v) {
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len > 0.00001) {
            return new Float32Array([
                v[0] / len,
                v[1] / len,
                v[2] / len
            ]);
        }
        return new Float32Array([0, 0, 0]);
    },

    // Calcula o produto escalar (dot product)
    dot: function(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }
};

const Mat4 = {
    // Cria uma nova matriz identidade 4x4
    identity: function() {
        const out = new Float32Array(16);
        out[0] = 1;
        out[5] = 1;
        out[10] = 1;
        out[15] = 1;
        return out;
    },

    // Multiplica duas matrizes 4x4: out = a * b (ordem column-major)
    multiply: function(a, b) {
        const out = new Float32Array(16);
        
        const b00 = b[0],  b01 = b[1],  b02 = b[2],  b03 = b[3];
        const b10 = b[4],  b11 = b[5],  b12 = b[6],  b13 = b[7];
        const b20 = b[8],  b21 = b[9],  b22 = b[10], b23 = b[11];
        const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

        let a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
        out[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
        out[1] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
        out[2] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
        out[3] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;

        a00 = a[4];  a01 = a[5];  a02 = a[6];  a03 = a[7];
        out[4] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
        out[5] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
        out[6] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
        out[7] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;

        a00 = a[8];  a01 = a[9];  a02 = a[10]; a03 = a[11];
        out[8] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
        out[9] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
        out[10] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
        out[11] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;

        a00 = a[12]; a01 = a[13]; a02 = a[14]; a03 = a[15];
        out[12] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
        out[13] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
        out[14] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
        out[15] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;

        return out;
    },

    // Cria uma matriz de translação
    translation: function(x, y, z) {
        const out = this.identity();
        out[12] = x;
        out[13] = y;
        out[14] = z;
        return out;
    },

    // Cria uma matriz de escala
    scale: function(x, y, z) {
        const out = new Float32Array(16);
        out[0] = x;
        out[5] = y;
        out[10] = z;
        out[15] = 1;
        return out;
    },

    // Cria uma matriz de rotação no eixo X (ângulo em radianos)
    rotationX: function(angle) {
        const out = this.identity();
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        out[5] = c;
        out[6] = s;
        out[9] = -s;
        out[10] = c;
        return out;
    },

    // Cria uma matriz de rotação no eixo Y (ângulo em radianos)
    rotationY: function(angle) {
        const out = this.identity();
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        out[0] = c;
        out[2] = -s;
        out[8] = s;
        out[10] = c;
        return out;
    },

    // Cria uma matriz de rotação no eixo Z (ângulo em radianos)
    rotationZ: function(angle) {
        const out = this.identity();
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        out[0] = c;
        out[1] = s;
        out[4] = -s;
        out[5] = c;
        return out;
    },

    // Implementação manual da Matriz de Projeção Perspectiva
    perspective: function(fovY, aspect, near, far) {
        const out = new Float32Array(16);
        const f = 1.0 / Math.tan(fovY / 2.0);
        const nf = 1.0 / (near - far);
        
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[14] = 2 * far * near * nf;
        out[15] = 0;
        
        return out;
    },

    // Implementação manual da Matriz de Visualização LookAt
    lookAt: function(eye, center, up) {
        const out = new Float32Array(16);
        
        // z = normalize(eye - center) -- direção oposta de onde estamos olhando
        let z = Vec3.subtract(eye, center);
        z = Vec3.normalize(z);
        
        // x = normalize(up x z) -- vetor direito
        let x = Vec3.cross(up, z);
        x = Vec3.normalize(x);
        
        // y = z x x -- vetor para cima ortogonalizado
        const y = Vec3.cross(z, x);
        
        // Translação negativa acumulada
        const tx = -Vec3.dot(x, eye);
        const ty = -Vec3.dot(y, eye);
        const tz = -Vec3.dot(z, eye);
        
        // Preenche em ordem column-major
        out[0] = x[0];
        out[1] = y[0];
        out[2] = z[0];
        out[3] = 0;
        
        out[4] = x[1];
        out[5] = y[1];
        out[6] = z[1];
        out[7] = 0;
        
        out[8] = x[2];
        out[9] = y[2];
        out[10] = z[2];
        out[11] = 0;
        
        out[12] = tx;
        out[13] = ty;
        out[14] = tz;
        out[15] = 1;
        
        return out;
    }
};

// Exportar globalmente para o navegador
window.Vec3 = Vec3;
window.Mat4 = Mat4;
