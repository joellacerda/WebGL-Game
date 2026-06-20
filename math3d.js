/**
 * math3d.js
 * Biblioteca matemática 3D customizada implementando Álgebra Linear para WebGL.
 * Inclui operações manuais de Matriz 4x4 (Mat4) e Vetor 3D (Vec3).
 * Otimizada para evitar alocações excessivas de memória (GC).
 */

const Vec3 = {
    create: function(x = 0, y = 0, z = 0) {
        return new Float32Array([x, y, z]);
    },

    set: function(out, x, y, z) {
        out[0] = x; out[1] = y; out[2] = z;
        return out;
    },

    copy: function(out, a) {
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
        return out;
    },

    subtract: function(out, a, b) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        return out;
    },

    cross: function(out, a, b) {
        const ax = a[0], ay = a[1], az = a[2];
        const bx = b[0], by = b[1], bz = b[2];
        out[0] = ay * bz - az * by;
        out[1] = az * bx - ax * bz;
        out[2] = ax * by - ay * bx;
        return out;
    },

    normalize: function(out, v) {
        const len = Math.hypot(v[0], v[1], v[2]);
        if (len > 0.00001) {
            out[0] = v[0] / len;
            out[1] = v[1] / len;
            out[2] = v[2] / len;
        } else {
            out[0] = 0; out[1] = 0; out[2] = 0;
        }
        return out;
    },

    dot: function(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    },

    length: function(v) {
        return Math.hypot(v[0], v[1], v[2]);
    }
};

const Mat4 = {
    create: function() {
        return new Float32Array(16);
    },

    identity: function(out) {
        out.fill(0);
        out[0] = 1;
        out[5] = 1;
        out[10] = 1;
        out[15] = 1;
        return out;
    },

    multiply: function(out, a, b) {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

        let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

        return out;
    },

    translation: function(out, x, y, z) {
        this.identity(out);
        out[12] = x;
        out[13] = y;
        out[14] = z;
        return out;
    },

    scale: function(out, x, y, z) {
        out.fill(0);
        out[0] = x;
        out[5] = y;
        out[10] = z;
        out[15] = 1;
        return out;
    },

    rotationX: function(out, rad) {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        out.fill(0);
        out[0] = 1;
        out[5] = c;
        out[6] = s;
        out[9] = -s;
        out[10] = c;
        out[15] = 1;
        return out;
    },

    rotationY: function(out, rad) {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        out.fill(0);
        out[0] = c;
        out[2] = -s;
        out[5] = 1;
        out[8] = s;
        out[10] = c;
        out[15] = 1;
        return out;
    },

    rotationZ: function(out, rad) {
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        out.fill(0);
        out[0] = c;
        out[1] = s;
        out[4] = -s;
        out[5] = c;
        out[10] = 1;
        out[15] = 1;
        return out;
    },

    perspective: function(out, fovY, aspect, near, far) {
        const f = 1.0 / Math.tan(fovY / 2.0);
        const nf = 1.0 / (near - far);
        out.fill(0);
        out[0] = f / aspect;
        out[5] = f;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[14] = (2 * far * near) * nf;
        out[15] = 0;
        return out;
    },

    lookAt: function(out, eye, center, up) {
        const x = Vec3.create();
        const y = Vec3.create();
        const z = Vec3.create();

        Vec3.subtract(z, eye, center);
        Vec3.normalize(z, z);
        Vec3.cross(x, up, z);
        Vec3.normalize(x, x);
        Vec3.cross(y, z, x);

        out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
        out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
        out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
        out[12] = -Vec3.dot(x, eye);
        out[13] = -Vec3.dot(y, eye);
        out[14] = -Vec3.dot(z, eye);
        out[15] = 1;
        return out;
    }
};

window.Vec3 = Vec3;
window.Mat4 = Mat4;
