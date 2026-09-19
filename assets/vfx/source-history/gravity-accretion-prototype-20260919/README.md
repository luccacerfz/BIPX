# Gravidade — estudo isolado de acreção

Status: **protótipo, não promovido**. Pedido root em `docs/arpg/review/v2-volume-followup.md`. Não importado por `src/`; nenhuma mudança no runtime congelado. A localização em source-history impede que o estudo não utilizado seja confundido com assets da versão jogável nos manifests habituais.

`gravity-accretion.js` exporta `createGravityAccretionPrototype(THREE, scene)` com `set({position,radius,remaining,duration,quality,reducedMotion})`, `update(dt)`, `reset`, `dispose`, `getStats`. Não aplica dano, pull, deslocamento de ator ou status. A fixture fornece campo5m/5s controlado; posições/raio/duração permanecem invariantes entre comparadores.

Composição: núcleo escuro0.92m de diâmetro, borda violeta, disco de acreção inclinado até2.96m de diâmetro,6/3 filamentos high/low,12/5 fragmentos high/low, um limite externo fino e discreto. Filamentos têm pacotes de brilho com fase radial para dentro; fragmentos seguem trajetórias3D convergentes, com respawn explícito na borda. Reduced congela dinâmica decorativa e conserva todas as formas essenciais. O núcleo escreve profundidade para ocultar a metade traseira do disco; continua sujeito à profundidade dos atores.

Referência concreta: `SingularityMaterial.js` no commit `8c377c886ac2c68b26bc65c8f3507905818b974a` de LinearAbiltyCastingExtendedThreeJS, inspecionado no clone local. Adapta separação sombra/borda, brilho assimétrico e rotação diferencial. Sem copiar pipeline de refração, sem distorcer framebuffer, sem aumentar alcance. Licença MIT integral preservada em `src/vfx/ELEMENTAL-LICENSE.txt` no projeto.

Comparação reproduzível: `node tools/gravity-vfx-prototype.mjs`. Reutiliza `quality-browser`, `quality-isolated-server` e a reserva atômica VFX existente. Copia runtime exato para diretório temporário, adiciona só nesse diretório os arquivos da fixture/protótipo e serve em porta efêmera. Cemitério, Lyra e4 zumbis são assets reais; a câmera usa o perfil base48°/17m/20m, idêntico nos dois painéis do mesmo canvas. **Fixture controlada de assets, não partida real nem prova de física/autoridade.**

Limitação para promoção:5 draws por campo neste estudo, contra batches compartilhados do runtime. Precisa adaptação ao orçamento/pool do wrapper e revisão temporal em gameplay na janela combinada com Combat. Não atribuir AAA/10 ou aprovação de horda/mobile a este estudo. Evidências e hashes estão no handoff VFX; versões anteriores/cópias das capturas permanecem preservadas.
