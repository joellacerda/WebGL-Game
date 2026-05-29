# WebGL 3D Engine - Boilerplate & CSS UI Toolbox

Este é um **Boilerplate e Motor de Renderização 3D de alta performance desenvolvido em WebGL 2.0 puro** (HTML5 + Javascript), livre de dependências externas ou bibliotecas gráficas de alto nível (como Three.js ou Babylon.js). 

O projeto foi projetado com foco em **Visual Excellence** e fornece toda a infraestrutura de hardware, álgebra de matrizes manuais, câmera 3D em primeira pessoa com trava física de cursor (**Pointer Lock API**) e uma **Caixa de Ferramentas CSS Temática** rica e modular voltada para a criação de jogos de suspense, labirintos e *Escape Rooms*.

---

## 📂 Estrutura do Projeto

```
WebGL Game/
├── README.md               # Este arquivo com instruções de execução
├── index.html              # HUD de telemetria, Canvas WebGL e filtros visuais
├── style.css               # Caixa de ferramentas CSS (Painéis, Inventário, Teclados, Animações)
├── math3d.js               # Biblioteca matemática de Álgebra Linear manual
├── obj-parser.js           # Leitor e Parser assíncrono de arquivos .obj 3D
├── game.js                 # Motor gráfico: WebGL 2.0 setup, controles e loop principal
└── assets/                 # Pasta de recursos (Coloque seus modelos OBJ e texturas PNG aqui)
```

---

## 🛠️ Pré-requisitos

Para rodar este boilerplate localmente, você precisa apenas de:
1.  **Navegador Web Moderno** (Chrome, Firefox, Edge, Safari ou Brave) com suporte a WebGL 2.0.
2.  **Um utilitário de Servidor HTTP local básico** (como Python 3 ou Node.js). 
    > [!IMPORTANT]
    > **Por que é necessário um servidor local?** O navegador restringe requisições de arquivos locais (como carregar modelos `.obj` de forma assíncrona) via protocolo `file://` direto por motivos de segurança (CORS). Rodar um servidor local resolve essa restrição.

---

## 🏃 Como Baixar e Executar o Projeto

### Passo 1: Obter os Arquivos
Certifique-se de que a pasta contendo a estrutura acima esteja salva no seu computador (por exemplo, no diretório `/Users/joellacerda/Desktop/WebGL Game/`).

### Passo 2: Iniciar o Servidor Local
Abra o seu terminal, navegue até a pasta do projeto e execute um dos comandos abaixo:

#### Opção A: Servidor Nativo do Python 3 (Recomendado)
Se você tem o Python 3 instalado no computador (padrão em sistemas macOS e Linux):
```bash
python3 -m http.server 8000
```

#### Opção B: Servidor Node.js / npm
Se você possui o Node.js instalado em sua máquina:
```bash
npx serve .
# ou
npx http-server .
```

### Passo 3: Abrir no Navegador
Uma vez iniciado o servidor, abra seu navegador de preferência e acesse o endereço correspondente:
*   Para o servidor Python: [http://localhost:8000](http://localhost:8000)
*   Para o servidor Node (serve): [http://localhost:3000](http://localhost:3000)

---

## 🎮 Controles Padrão (Câmera FPS)

*   **Clique Esquerdo no Canvas:** Trava o cursor do mouse na tela para controle livre em 3D.
*   **Movimento do Mouse:** Rotaciona a cabeça da câmera livremente em 360° (olhar horizontal e vertical).
*   **Teclas W, A, S, D:** Anda pelo cenário no plano horizontal (bloqueado para não flutuar).
*   **Tecla L ou Botão Verde "L" no HUD:** Alterna o estado lógico da iluminação (registrado em tempo real no console do desenvolvedor).
*   **Tecla ESC:** Libera o cursor do mouse da tela.

---

## 📐 Ferramentas e Recursos Prontos para Uso

### 1. Biblioteca Gráfica e Matemática (`math3d.js`)
Implementada de forma puramente manual no CPU, contendo:
*   `Mat4.perspective(fov, aspect, near, far)`: Matriz de projeção perspectiva manual.
*   `Mat4.lookAt(eye, center, up)`: Matriz de visualização em primeira pessoa.
*   `Mat4.translation(x, y, z)`, `Mat4.scale(x, y, z)`, `Mat4.rotation[X/Y/Z](angulo)`: Transformações de modelo tridimensionais.
*   `Vec3.cross(a, b)`, `Vec3.normalize(v)`, `Vec3.dot(a, b)`: Operações estruturadas de vetores 3D.

### 2. Custom OBJ Parser (`obj-parser.js`)
Lê e analisa dados brutos de strings `.obj` extraindo vértices (`v`), coordenadas UV (`vt`) e normais (`vn`). Triangula automaticamente faces poligonais complexas usando **Fan Triangulation** e monta Float32Arrays paralelos ideais para envio aos buffers do WebGL.

### 3. Telemetria em Tempo Real (HUD)
O painel no canto superior esquerdo exibe dados de hardware e física calculados em tempo real:
*   **Posição da Câmera:** Exibe `[X, Y, Z]` com precisão de duas casas decimais.
*   **Ângulos de Olhar:** Mostra a rotação em graus para os eixos `Yaw` e `Pitch`.
*   **Frames por Segundo (FPS):** Medidor dinâmico de performance da GPU/CPU.

### 4. Caixa de Ferramentas de Estilização CSS (`style.css`)
Contém classes modulares prontas para interfaces de labirintos e jogos de escape room:
*   **Vinhetas Cinemáticas:** Vinheta de suspense escura (`.vignette-suspense`) e vinheta de pânico pulsante vermelha (`.vignette-alert`).
*   **Inventário Visual:** Grade de slots de itens (`.inventory-grid` e `.item-slot`) para chaves e itens coletados, com suporte para slots selecionados (`.active`) ou vazios (`.empty`).
*   **Teclado Numérico (`.keypad-grid`):** Interface para telas de inputs de código de cadeado ou cofre.
*   **Barras de Progresso HUD (`.hud-progress-bar`):** Barras estilizadas neon de Sanidade/Vida (`.progress-green`), Alerta (`.progress-red`) e Lanterna/Estamina (`.progress-cyan`).
*   **Animações Dinâmicas:** Efeito piscante de lâmpada falhando (`.flicker`) e tremor digital crt (`.crt-glitch`).

---

## 🎨 Como Desenhar Seus Próprios Objetos

Para renderizar seus modelos no loop, edite o final da função `render(time)` no arquivo `game.js`:

```javascript
gl.useProgram(seuProgramaDeShader);

// 1. Defina a posição e a transformação
let modelMatrix = Mat4.translation(0.0, 1.0, 0.0);
modelMatrix = Mat4.multiply(modelMatrix, Mat4.rotationY(time)); // rotaciona a malha

// 2. Envie as matrizes
gl.uniformMatrix4fv(locationProj, false, projectionMatrix);
gl.uniformMatrix4fv(locationView, false, viewMatrix);
gl.uniformMatrix4fv(locationModel, false, modelMatrix);

// 3. Vincule os buffers do seu objeto 3D
gl.bindBuffer(gl.ARRAY_BUFFER, seuBufferDePosicoes);
gl.vertexAttribPointer(attribPos, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(attribPos);

// 4. Desenhe!
gl.drawArrays(gl.TRIANGLES, 0, totalDeVertices);
```
