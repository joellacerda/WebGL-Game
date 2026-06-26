# 🟢 O Labirinto de Jade — Motor Gráfico 3D WebGL 2.0

*   🎥 **Vídeo de Demonstração:** [Assista no YouTube](https://www.youtube.com/watch?v=Yx0AAZdFzMs)
*   📊 **Apresentação do Projeto:** [Slides da Apresentação](https://docs.google.com/presentation/d/1iUTurrpr7BFoZZRj1x0SkkXYSI1sh59MqavfmHCrp2I/edit?usp=sharing)

---

Este projeto é um jogo de suspense e escape em primeira pessoa desenvolvido em **WebGL 2.0 puro** (HTML5 + vanilla JavaScript), livre de dependências externas ou bibliotecas gráficas de alto nível (como *Three.js* ou *Babylon.js*). 

O jogador explora um labirinto escuro sob a vigilância constante do **Olho de Jade**, um feixe de luz verde que varre o solo. O objetivo é recuperar o **Cálice de Fogo Azul** para extinguir a barreira de chamas da saída e escapar.

---

## 📂 Estrutura do Projeto

*   [index.html](./index.html) — HUD de telemetria, Canvas WebGL, vinhetas cinemáticas, tela de menu, fim de jogo e vitória.
*   [game.js](./game.js) — O motor do jogo: inicialização do contexto WebGL 2.0, shaders principais, física de colisão, inteligência artificial do vigia e loop de renderização.
*   [math3d.js](./math3d.js) — Biblioteca matemática própria contendo operações estruturadas de vetores ([Vec3](./math3d.js#L8)) e matrizes ([Mat4](./math3d.js#L60)).
*   [obj-parser.js](./obj-parser.js) — Parser assíncrono customizado para carregar e analisar geometrias 3D de arquivos `.obj`.
*   [goblet-generator.js](./goblet-generator.js) — Modeler procedural responsável por criar o modelo 3D do Cálice de Fogo em tempo de execução.
*   [style.css](./style.css) — Interface HUD estilizada com vinhetas dinâmicas, glassmorphism, barras de progresso neon e animações de interferência CRT.
*   **[assets/](./assets/)** — Recursos de mídia do jogo (modelo 3D do labirinto e texturas de alta resolução).

---

## 🎮 Mecânicas do Jogo

1.  **O Olho de Jade (Vigia Celestial):**
    *   Uma fonte de luz móvel verde paira sobre o centro do labirinto ($Y = 8.0$), projetando um feixe cônico volumétrico dinâmico que varre o chão em busca de intrusos.
    *   Caso o jogador entre sob a luz do feixe, sua **Sanidade** (barra de vida na parte inferior) diminui rapidamente. Se a sanidade for drenada por completo, ocorre o **Fim de Jogo**.
    *   Fora do alcance do feixe, o jogador recupera sua sanidade lentamente.
2.  **O Cálice de Fogo:**
    *   Um item sagrado que repousa em uma posição segura e aleatória do mapa.
    *   O cálice brilha com uma chama mística azul e gera iluminação point light dinâmica própria.
    *   Ao coletá-lo, o jogador extingue as labaredas de fogo que bloqueavam a saída. No entanto, o **Olho de Jade fica furioso**: o feixe de luz torna-se vermelho e passa a perseguir o jogador a uma velocidade muito maior!
3.  **Fuga e Vitória:**
    *   Com o Cálice coletado, o jogador deve se mover rapidamente até o local de fuga para vencer a partida.
4.  **Lanterna do Jogador:**
    *   Uma luz direcional portátil controlada pelo jogador para ajudá-lo a enxergar nos cantos mais escuros do labirinto.

---

## 📐 Funcionalidades Gráficas e WebGL

### 1. Sistema de Iluminação Phong Multiponto
Implementação completa do **Modelo de Reflexão de Phong** no pixel shader principal do arquivo [game.js](./game.js#L163) que integra três fontes de iluminação ativas de forma simultânea:
*   **Luz 1 (Lanterna):** Spotlight acoplada à câmera do jogador (branca/amarelada) com atenuação quadrática de distância e corte suave do cone de luz.
*   **Luz 2 (Olho de Jade):** Spotlight móvel no topo (verde ou vermelha) com projeção cônica no solo e renderização de feixe volumétrico translúcido (via `TRIANGLE_FAN` dinâmico).
*   **Luz 3 (Chama do Cálice):** Point light pontual azul e oscilante centralizada no Cálice de Fogo, iluminando paredes e chão ao redor.

### 2. Modelagem Procedural de Geometria
O script [goblet-generator.js](./goblet-generator.js) calcula matematicamente as posições e normais do Cálice de Fogo utilizando superfícies de revolução trigonométricas baseadas no eixo Y. Ele gera os buffers de vértices na CPU e os envia ao WebGL em tempo de execução. O material é sombreado por um shader metálico dourado com gradiente vertical e efeito Fresnel.

### 3. Sistema de Partículas WebGL
Dois emissores de partículas independentes controlados via shader de partículas:
*   **Partículas Azuis:** Chamas místicas que emanam do interior do Cálice de Fogo (desativadas após a coleta).
*   **Partículas Vermelhas:** Três colunas de chamas persistentes que bloqueiam a saída (extintas ao coletar o cálice).

### 4. Texturização Dinâmica por Mapeamento Planar (Planar UV Mapping)
Para evitar distorções nas coordenadas de textura de arquivos `.obj` complexos, o shader projeta as texturas de parede ([plaster_brick_01_diff_1k.jpg](./assets/plaster_brick_01_diff_1k.jpg)) e chão ([rocky_terrain_diff_1k.jpg](./assets/rocky_terrain_diff_1k.jpg)) baseando-se no vetor normal em tempo real no pixel shader. Isso garante texturas esticadas e mapeadas de forma perfeitamente perpendicular nas superfícies do mundo.

---

## ⌨️ Controles

*   **Clique no Canvas:** Trava o mouse no centro da tela e ativa a câmera em primeira pessoa (Pointer Lock API).
*   **Mouse:** Olha ao redor em 360° (Yaw e Pitch).
*   **Teclas W, A, S, D:** Movimenta o jogador na horizontal respeitando o vetor de visão da câmera.
*   **Tecla L:** LIGA / DESLIGA a lanterna.
*   **Tecla O:** Alterna para a **Visão Geral** (Overview Mode) — uma câmera de topo que mostra o labirinto completo de cima e exibe o jogador como um marcador vermelho.
*   **Tecla ESC:** Libera o cursor do mouse.

---

## 🏃 Como Executar o Projeto

Para segurança do navegador (CORS), requisições assíncronas para arquivos `.obj` locais devem ser feitas através de um servidor web local.

### Passo 1: Iniciar o Servidor Local
Abra o seu terminal (Prompt de Comando, PowerShell ou Terminal do Linux/Mac), navegue até a pasta do projeto e execute um dos comandos abaixo:

*   **Com Python (Recomendado):**
    ```bash
    python -m http.server 8000
    ```
    *(Em alguns sistemas Mac/Linux, o comando pode ser `python3 -m http.server 8000`)*

*   **Com Node.js (npx):**
    ```bash
    npx http-server
    ```

### Passo 2: Jogar!
Abra seu navegador de preferência e acesse o endereço correspondente:
*   Se usou Python: [http://localhost:8000](http://localhost:8000)
*   Se usou Node.js: Verifique no terminal, geralmente é [http://127.0.0.1:8080](http://127.0.0.1:8080) (ou [http://localhost:8080](http://localhost:8080))

---

## 🎥 Demonstração e Apresentação

*   **Demonstração de Gameplay (YouTube):** [O Labirinto de Jade - Gameplay](https://www.youtube.com/watch?v=Yx0AAZdFzMs)
*   **Apresentação do Projeto (Google Slides):** [Slides da Apresentação](https://docs.google.com/presentation/d/1iUTurrpr7BFoZZRj1x0SkkXYSI1sh59MqavfmHCrp2I/edit?usp=sharing)

---

## 📋 Requisitos do Projeto

**Requisitos Gerais**
*   ✅ **I) Movimentação de câmera com projeção perspectiva:**
    Utilizamos a função `Mat4.perspective` para a projeção 3D e uma câmera livre em primeira pessoa (tipo FPS). O mouse rotaciona a visão calculando `yaw` e `pitch`, e as teclas `WASD` movem o jogador pelo ambiente usando álgebra vetorial (`frontProj` e `rightVec`).
*   ✅ **II) Sistema de iluminação (Phong) com luz móvel:**
    Os shaders no `game.js` osam o **Modelo de Reflexão de Phong** de forma explícita (há até um comentário no código `"MODELO DE REFLEXÃO DE PHONG COMPLETO"`). Calculamos a luz ambiente, difusa (via `dot(normal, lightDir)`) e especular (via `reflect` e `pow(max(dot(viewDir, reflectDir), 0.0), shininessMat)`).
    Temos fontes de luz que se movem o tempo todo: a *Lanterna* (que acompanha a posição/rotação da sua câmera) e o *Olho de Jade* (que se desloca autonomamente varrendo o chão).
*   ✅ **III) Objeto animado por transformações geométricas:**
    O **Cálice de Fogo**. No loop de renderização (função `render()`), aplicamos `Mat4.translate` para fazê-lo flutuar usando um `Math.sin(gameTime)` e `Mat4.rotateY` para ele girar em torno do próprio eixo continuamente, multiplicando tudo em sua matriz de modelo original (`gobletModelMatrix`).
*   ✅ **IV) Objeto com textura:**
    As paredes do labirinto possuem texturas de tijolos (`wallAlbedoTexture`) usando coordenadas de mapa, e o chão possui a textura de terreno rochoso (`groundAlbedoTexture`).
*   ✅ **V) Objeto com cor sólida:**
    O próprio Cálice de Fogo não possui uma imagem de textura atrelada, mas sim uma cor sólida dourada (`vec3(0.8, 0.7, 0.1)`) calculada matematicamente dentro do shader (`gobletFSSource`), que interage perfeitamente com a iluminação especular do Phong.

---

**Requisitos Específicos do Jogo 3D**
*   ✅ **I) Tipo de câmera livre:** 
    Implementamos uma câmera em primeira pessoa utilizando a **Pointer Lock API** do HTML5.
*   ✅ **II e III) Objetos de arquivos OBJ e Leitor Próprio:**
    Carregamos o `assets/labyrinth.obj`. Mais importante ainda: **não usamos** nenhuma biblioteca pronta para isso. O script `obj-parser.js` foi criado do zero para ler o texto do OBJ, fazer o parse dos vértices e normais e passar para o buffer do WebGL.
*   ✅ **IV e V) Modelos e Autoria:**
    Utilizamos um modelo de labirinto externo.
*   ✅ **VI e VII) OpenGL/WebGL puros e Canvas HTML5:**
    O jogo é desenhado puramente com a chamada `canvas.getContext("webgl2")`. Não estamos usando *Three.js*, *Babylon.js* ou similares, apenas chamadas puras da API gráfica.
*   ✅ **VI Auxiliares) Bibliotecas de Álgebra / Eventos:**
    Temos nosso próprio script `math3d.js` para manipulação segura das Matrizes 4x4 e Vetores de 3 posições. A leitura do teclado (`keydown`, `keyup`) e mouse (`mousemove`) é feita organicamente com JavaScript (Event Listeners puros) sem nenhuma lib externa invadindo as lógicas do motor gráfico.
