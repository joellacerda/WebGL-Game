/**
 * obj-parser.js
 * Leitor e Parser customizado de arquivos .obj em JavaScript.
 * Extrai vértices, coordenadas de textura, normais e triangula as faces.
 */

const OBJParser = {
    /**
     * Carrega e analisa um arquivo .obj a partir de uma URL.
     * Retorna um objeto contendo arrays planos prontos para o WebGL:
     * - positions: Float32Array (x, y, z)
     * - texcoords: Float32Array (u, v)
     * - normals: Float32Array (nx, ny, nz)
     */
    loadAndParse: async function(url) {
        try {
            console.log(`Buscando arquivo OBJ em: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Falha ao carregar o arquivo OBJ: ${response.statusText}`);
            }
            const text = await response.text();
            return this.parse(text);
        } catch (error) {
            console.error("Erro no parser OBJ:", error);
            throw error;
        }
    },

    /**
     * Analisa o conteúdo de texto de um arquivo .obj.
     */
    parse: function(text) {
        // Listas temporárias de dados do OBJ
        const tempPositions = [];
        const tempTexcoords = [];
        const tempNormals = [];

        // Arrays finais alinhados para WebGL (cada vértice terá pos, uv, normal correspondentes)
        const positions = [];
        const texcoords = [];
        const normals = [];

        // Divide o arquivo por linhas
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#') || line === '') {
                continue; // Pula comentários e linhas vazias
            }

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vértice: v x y z
                tempPositions.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'vt') {
                // Coordenada de Textura: vt u v
                // Nota: Alguns OBJs incluem um terceiro componente 'w', nós ignoramos.
                tempTexcoords.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2])
                ]);
            } else if (type === 'vn') {
                // Normal da Superfície: vn nx ny nz
                tempNormals.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
            } else if (type === 'f') {
                // Face: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3 ...
                // Suporta faces com mais de 3 vértices através de triangulação (Fan Triangulation)
                const faceVertices = parts.slice(1);
                
                // Triangulação em leque (Fan triangulation) para polígonos convexos
                // Se a face for f A B C D, criamos triângulos (A, B, C) e (A, C, D)
                for (let j = 1; j < faceVertices.length - 1; j++) {
                    const idxs = [0, j, j + 1];
                    
                    for (const idx of idxs) {
                        const vertexStr = faceVertices[idx];
                        const vertexParts = vertexStr.split('/');
                        
                        // 1. Posição do vértice (obrigatório)
                        const pIdx = parseInt(vertexParts[0]);
                        // Ajusta índice 1-based e negativos
                        const posIndex = pIdx > 0 ? pIdx - 1 : tempPositions.length + pIdx;
                        const pos = tempPositions[posIndex] || [0, 0, 0];
                        positions.push(pos[0], pos[1], pos[2]);

                        // 2. Coordenadas de textura (opcional)
                        let tex = [0.0, 0.0];
                        if (vertexParts.length > 1 && vertexParts[1] !== '') {
                            const tIdx = parseInt(vertexParts[1]);
                            const texIndex = tIdx > 0 ? tIdx - 1 : tempTexcoords.length + tIdx;
                            tex = tempTexcoords[texIndex] || [0, 0];
                        }
                        // Opcional: Inverter o eixo V da textura caso necessário (padrão WebGL vs OpenGL)
                        texcoords.push(tex[0], tex[1]);

                        // 3. Normais de vértice (opcional)
                        let norm = [0.0, 1.0, 0.0]; // Normal default apontando para cima
                        if (vertexParts.length > 2 && vertexParts[2] !== '') {
                            const nIdx = parseInt(vertexParts[2]);
                            const normIndex = nIdx > 0 ? nIdx - 1 : tempNormals.length + nIdx;
                            norm = tempNormals[normIndex] || [0, 1, 0];
                        }
                        normals.push(norm[0], norm[1], norm[2]);
                    }
                }
            }
        }

        console.log(`OBJ parseado com sucesso:`);
        console.log(`- Vértices temporários: ${tempPositions.length}`);
        console.log(`- UVs temporários: ${tempTexcoords.length}`);
        console.log(`- Normais temporárias: ${tempNormals.length}`);
        console.log(`- Vértices finais para render (Float32Array): ${positions.length / 3}`);

        return {
            positions: new Float32Array(positions),
            texcoords: new Float32Array(texcoords),
            normals: new Float32Array(normals)
        };
    }
};

// Exportar globalmente para o navegador
window.OBJParser = OBJParser;
