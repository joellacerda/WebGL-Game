# WebGL 3D Game - O Labirinto de Jade

## Descrição do Jogo

Este é um jogo de exploração 3D em primeira pessoa (estilo FPS) desenvolvido inteiramente com WebGL 2.0 puro (HTML5 + Javascript). O objetivo do jogador é navegar por um labirinto escuro utilizando uma lanterna até encontrar o Cálice de Fogo iluminado. Além do ambiente envolvente, o jogo apresenta um "Olho de Jade" que varre o cenário com uma luz móvel autônoma. 

O projeto foi construído do zero, sem o uso de bibliotecas gráficas de alto nível (como Three.js ou Babylon.js), implementando toda a matemática vetorial e de matrizes manualmente para máxima performance e entendimento do pipeline gráfico clássico.

## Tutorial de Compilação e Execução

Para rodar este jogo localmente, você precisa de um navegador moderno com suporte a WebGL 2.0 e um servidor HTTP local simples (para evitar problemas de CORS ao carregar as texturas e modelos 3D).

### Passo 1: Obter os Arquivos
Clone ou baixe a versão mais recente deste repositório para o seu computador.

### Passo 2: Iniciar o Servidor Local
Abra o seu terminal (Prompt de Comando, PowerShell ou Terminal do Linux/Mac), navegue até a pasta do projeto e execute um dos comandos abaixo:

**Com Python (Recomendado):**
```bash
python -m http.server 8000
```
*(Em alguns sistemas Mac/Linux, o comando pode ser `python3 -m http.server 8000`)*

**Com Node.js (npx):**
```bash
npx http-server
```

### Passo 3: Jogar!
Abra seu navegador de preferência e acesse o endereço gerado:
* Se usou Python: [http://localhost:8000](http://localhost:8000)
* Se usou Node.js: Verifique no terminal, geralmente é [http://127.0.0.1:8080](http://127.0.0.1:8080)

Para jogar, **clique em qualquer lugar da tela** para travar o cursor do mouse e use o mouse para olhar ao redor. Use as teclas **W, A, S, D** para caminhar pelo labirinto! Para soltar o mouse, aperte a tecla **ESC**.

---

## Demonstração em Vídeo

[Link para o vídeo demonstrando a execução do programa será adicionado aqui em breve]

---

## Detalhamento das Especificações

### Requisitos Gerais

✅ **I) Movimentação de câmera com projeção perspectiva:**
Utilizamos a função `Mat4.perspective` para a projeção 3D e uma câmera livre em primeira pessoa (tipo FPS). O mouse rotaciona a visão calculando *yaw* e *pitch*, e as teclas WASD movem o jogador pelo ambiente usando álgebra vetorial (`frontProj` e `rightVec`).

✅ **II) Sistema de iluminação (Phong) com luz móvel:**
Os shaders no `game.js` usam o **Modelo de Reflexão de Phong** de forma explícita (há até um comentário no código "MODELO DE REFLEXÃO DE PHONG COMPLETO"). Calculamos a luz ambiente, difusa (via `dot(normal, lightDir)`) e especular (via `reflect` e `pow(max(dot(viewDir, reflectDir), 0.0), shininessMat)`).
Temos fontes de luz que se movem o tempo todo: a Lanterna (que acompanha a posição/rotação da sua câmera) e o Olho de Jade (que se desloca autonomamente varrendo o chão).

✅ **III) Objeto animado por transformações geométricas:**
O **Cálice de Fogo**. No loop de renderização (função `render()`), aplicamos `Mat4.translate` para fazê-lo flutuar usando um `Math.sin(gameTime)` e `Mat4.rotateY` para ele girar em torno do próprio eixo continuamente, multiplicando tudo em sua matriz de modelo original (`gobletModelMatrix`).

✅ **IV) Objeto com textura:**
As paredes do labirinto possuem texturas de tijolos (`wallAlbedoTexture`) usando coordenadas de mapa, e o chão possui a textura de terreno rochoso (`groundAlbedoTexture`).

✅ **V) Objeto com cor sólida:**
O próprio Cálice de Fogo não possui uma imagem de textura atrelada, mas sim uma cor sólida dourada (`vec3(0.8, 0.7, 0.1)`) calculada matematicamente dentro do shader (`gobletFSSource`), que interage perfeitamente com a iluminação especular do Phong.

### Requisitos Específicos do Jogo 3D

✅ **I) Tipo de câmera livre:** 
Implementamos uma câmera em primeira pessoa utilizando a **Pointer Lock API** do HTML5.

✅ **II e III) Objetos de arquivos OBJ e Leitor Próprio:**
Carregamos o `assets/labyrinth.obj`. Mais importante ainda: **não usamos** nenhuma biblioteca pronta para isso. O script `obj-parser.js` foi criado do zero para ler o texto do OBJ, fazer o parse dos vértices e normais e passar para o buffer do WebGL.

✅ **IV e V) Modelos e Autoria:**
Utilizamos um modelo de labirinto externo.

✅ **VI e VII) OpenGL/WebGL puros e Canvas HTML5:**
O jogo é desenhado puramente com a chamada `canvas.getContext("webgl2")`. Não estamos usando Three.js, Babylon.js ou similares, apenas chamadas puras da API gráfica.

✅ **VI Auxiliares) Bibliotecas de Álgebra / Eventos:**
Temos nosso próprio script `math3d.js` para manipulação segura das Matrizes 4x4 e Vetores de 3 posições. A leitura do teclado (`keydown`, `keyup`) e mouse (`mousemove`) é feita organicamente com JavaScript (Event Listeners puros) sem nenhuma lib externa invadindo as lógicas do motor gráfico.
