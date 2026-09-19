# DwarfBody OPAQUE — promovido e congelado

Somente `assets/models/dwarf-rifleman.glb` foi promovido de **e11eadb8** para **dc0867dacd22b04e42475a686fffe808ad8c7e66e9889b2a182eb4393eb5378e**, conforme [seleção Root](review/cannon-depth-focal-followup.md). [Recibo/hashes antes e depois](../../output/arpg-animation/dwarf-opaque-promotion/receipt.json).

V11 foi concluída e congelada antes da escrita; Combat concedeu microjanela `msg_2ffd5a107f19`, condicionada ao fechamento canopy. O handoff Environment e seu report05:45 confirmaram recursos encerrados/`gpuReleased`; essa evidência foi guardada no recibo. Reserva atômica própria adquirida e já liberada. Nenhuma captura nova, reexport ou restart.

Dos **270 arquivos conferidos**, apenas o GLB Dwarf mudou. HTTP200, MIME `model/gltf-binary` e SHA dc0867da exato. PID5173 **65261** e ledger7f580798 preservados. Controller07952/takes/v11/VFX/Aldric/main/server e fontes Environment intactos nesta operação. Provas históricas da locomoção continuam ligadas ao Dwarf e11; não foram reatribuídas.

## Delta e linhagem

Mudança única: `materials[1].alphaMode: BLEND→OPAQUE`. Binding conferido: DwarfBody→mesh1→material1; rifle→mesh0→material0, já opaco. Demais JSON e todos os chunks seguintes, incluindo BIN/texturas/rig/skin/clips, idênticos. A textura corporal tem alpha255 em todos os pixels conforme auditoria Root preservada.

- [GLB original](../../assets/models/source-history/dwarf-opaque-20260919/dwarf-rifleman.glb) e [proveniência original](../../assets/models/source-history/dwarf-opaque-20260919/dwarf-rifleman.provenance.json), cópias exatas.
- [Linhagem atual](../../assets/models/source-history/dwarf-opaque-20260919/lineage.json), separada da proveniência do export, que não foi reescrita.
- [Ferramenta reproduzível com guardas](../../tools/animation-dwarf-opaque-metadata.py): aceita apenas a origem e11 e exige resultado dc exato, binding correto, JSON restante e BIN iguais. Não modifica o exportador legado.

Reprodução em destino isolado:

```sh
python3 tools/animation-dwarf-opaque-metadata.py \
  assets/models/source-history/dwarf-opaque-20260919/dwarf-rifleman.glb \
  output/arpg-animation/dwarf-opaque-promotion/reproduced.glb
```

Exports futuros devem permanecer em cópia até nova auditoria. Hash desconhecido é rejeitado; não sobrescrever o runtime com export legado nem ampliar silenciosamente a lista de origens aceitas.

## Prova aplicável e limites

A seleção vem do [focal VFX05:37 com GLB exato/loader real](../../output/playwright/2026-09-19T05-37-28-168Z-cannon-depth-composition-vfx/report.json): corpo `transparent:false/depthWrite:true`, depth corporal medianaY1.9257, ROI Lyra121/121 em1e8campos. Não se repetiram provas antigas com clones/overrides. A falha dos ROIs de monstros em8campos permanece com VFX; nenhum dos sete módulos de composição foi promovido.

Esta entrega resolve a metadata selecionada e sua preservação. Não aprova arte global, no-slide ou locomotionv11. Próxima frente Animation autorizada: v12 em cópia, continuidade do pé aéreo esquerdo; runtime permanece congelado.
