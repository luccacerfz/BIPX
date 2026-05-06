# Zombie Night 3D

Jogo 3D de sobrevivencia feito com Three.js.

## Rodar localmente

```bash
npm start
```

Depois abra `http://127.0.0.1:5173`.

## Multiplayer online

O `npm start` agora tambem abre um servidor WebSocket em `/ws`, com salas de ate 4 jogadores.

```bash
npm start
```

- Abra `http://127.0.0.1:5173?room=cemiterio` em ate 4 abas ou computadores.
- Para jogar em outro computador da mesma rede, use o IP da maquina que esta rodando o servidor, por exemplo `http://192.168.0.10:5173?room=cemiterio`.
- Troque `cemiterio` por outro nome para criar outra sala.
- Cada jogador escolhe um nome no inicio; o topo mostra ranking, pontos e vida dos players.
- O servidor guarda um ranking historico com melhores pontuacoes, ondas, partidas e ultimos jogadores.
- Os monstros escolhem o jogador vivo mais proximo como alvo, incluindo players remotos.
- Para jogar com pessoas fora da sua rede, publique o servidor Node em um lugar que aceite WebSocket, como Render, Railway ou Fly.io.
- Na Vercel estatica, o jogo continua abrindo solo. Para usar Vercel + servidor separado, abra o site com `?ws=wss://SEU-SERVIDOR/ws&room=cemiterio`.

Por padrao, o historico fica em `.data/leaderboard.json`. Em hospedagem com disco efemero,
use a variavel `LEADERBOARD_FILE` apontando para um caminho persistente ou troque por banco.

## Controles

- `WASD` ou setas movem o personagem.
- Mouse mira.
- Clique ou `Espaco` atira.
- `Enter` inicia ou reinicia.
- Pegue itens brilhantes no mapa para trocar de arma por alguns segundos.
- O lanca-chamas queima em cone enquanto voce segura o tiro.
- O machado faz um giro que elimina zumbis proximos.
- A katana corta em arco na frente do cacador.
- A besta dispara virotes perfurantes.
- O selo explode monstros em area.
- A horda agora tem corredores, brutos e invocadores.
- Bosses raros podem aparecer misturados nos inimigos: Visor, Himetrica, Dinzo e GitCity.

## Verificacao

```bash
npm run verify
```

## Baixar arquivos em lote

Use o utilitario Python para baixar uma ou varias URLs para uma pasta:

```bash
python3 tools/download_files.py -o downloads https://example.com/arquivo.png
```

Tambem da para usar um arquivo `urls.txt` com uma URL por linha:

```bash
python3 tools/download_files.py -o downloads --file urls.txt
```

Linhas vazias e linhas com `#` no inicio sao ignoradas. Se um arquivo ja existir,
o script cria um novo nome automaticamente, como `arquivo_1.png`. Use
`--overwrite` para sobrescrever.
