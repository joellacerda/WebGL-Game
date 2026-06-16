/**
 * glb-loader.js
 * Leitor simplificado de arquivos.glb para WebGL Puro.
 */

const GLBLoader = {
    async load(gl, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}: Não foi possível carregar o arquivo .glb. Verifique se o caminho assets/labyrinth.glb está correto.`);
            const arrayBuffer = await response.arrayBuffer();
            return this.parse(gl, arrayBuffer);
        } catch (error) {
            throw error;
        }
    },

    parse(gl, arrayBuffer) {
        const dataView = new DataView(arrayBuffer);
        
        // Header
        if (dataView.getUint32(0, true) !== 0x46546C67) throw new Error("O arquivo não é um GLB válido (Magic number incorreto).");

        let offset = 12;
        let json = null;
        let bin = null;

        while (offset < arrayBuffer.byteLength) {
            const chunkLength = dataView.getUint32(offset, true);
            const chunkType = dataView.getUint32(offset + 4, true);
            
            if (chunkType === 0x4E4F534A) { // JSON
                const jsonText = new TextDecoder().decode(new Uint8Array(arrayBuffer, offset + 8, chunkLength));
                json = JSON.parse(jsonText);
            } else if (chunkType === 0x004E4942) { // BIN
                // Importante: Usar arrayBuffer original com offset correto para evitar RangeError em TypedArrays desalinhados
                bin = arrayBuffer;
                this.binOffset = offset + 8;
            }
            offset += 8 + chunkLength;
        }

        if (!json || !bin) throw new Error("Arquivo GLB incompleto: faltam chunks JSON ou BIN.");

        const meshes = [];
        for (const mesh of json.meshes) {
            for (const primitive of mesh.primitives) {
                const attrs = primitive.attributes;
                const result = { attributes: {}, indices: null, count: 0 };

                if (attrs.POSITION !== undefined) result.attributes.POSITION = this.getAccessorData(json, bin, attrs.POSITION);
                if (attrs.NORMAL !== undefined) result.attributes.NORMAL = this.getAccessorData(json, bin, attrs.NORMAL);
                
                if (primitive.indices !== undefined) {
                    result.indices = this.getAccessorData(json, bin, primitive.indices);
                    result.count = result.indices.length;
                } else {
                    result.count = result.attributes.POSITION.length / 3;
                }
                meshes.push(result);
            }
        }
        return meshes;
    },

    getAccessorData(json, bin, index) {
        const accessor = json.accessors[index];
        const bv = json.bufferViews[accessor.bufferView];
        
        // O offset real é: Início do Chunk BIN + offset da BufferView + offset do Accessor
        const absoluteOffset = this.binOffset + (bv.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count * this.getCompCount(accessor.type);
        
        try {
            switch (accessor.componentType) {
                case 5121: return new Uint8Array(bin, absoluteOffset, count);
                case 5123: return new Uint16Array(bin, absoluteOffset, count);
                case 5125: return new Uint32Array(bin, absoluteOffset, count);
                case 5126: return new Float32Array(bin, absoluteOffset, count);
                default: return new Float32Array(bin, absoluteOffset, count);
            }
        } catch (e) {
            console.error(`Erro ao acessar dados do accessor ${index}:`, e);
            throw new Error(`Erro de alinhamento ou tamanho de buffer no accessor ${index}.`);
        }
    },

    getCompCount(type) {
        return { "SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4 }[type] || 1;
    }
};

window.GLBLoader = GLBLoader;
