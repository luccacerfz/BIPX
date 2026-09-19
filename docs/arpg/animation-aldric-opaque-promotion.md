# Aldric — correção de metadados promovida

**Promovido e congelado:** `assets/models/aldric-hero.glb` agora **5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996**. [Recibo completo](../../output/arpg-animation/aldric-opaque-promotion/receipt.json) · [linhagem](../../assets/models/source-history/aldric-opaque-20260919/lineage.json). Autorização Root em [seleção](review/aldric-opaque-material-selection.json), janela Combat `msg_da7c5e8347e6` e VFX sem freeze GLB live. CPU/captura v8/v9 concluídas antes da promoção; reserva atômica curta somente para troca, encerrada em finally, sem render.

Única mudança: material0 `tripo_mat_5c5194c8.001`, alphaMode BLEND→OPAQUE. BIN e chunks seguintes byte-idênticos; o JSON também é byte-idêntico retirando apenas o token alterado e padding. Rig, textura, clips, meshes, loader, controlador e outros assets permanecem exatos. A textura possui1.048.576pixels alpha255 conforme auditoria Root. Não houve reexport Blender.

A prova nativa VFX04:34 e seleção Root já confirmaram corpo no shareddepth0→1draw, um único passe, matrizes de ossos iguais, torso121/121. Não repetimos matriz nativa. É correção de participação na profundidade, sem novo aceite AAA/locomoção/desempenho global.

Validação após promoção:225arquivos conferidos (manifesto runtime222 + provenance/exporter/auditor); somente o GLB mudou. HTTP200, MIME model/gltf-binary e SHA5c1903a0 exato. Servidor5173 PID75665 e ledger idênticos; nenhum restart. Arquivos source v8/v9 e suas cópias continuam originais0e5da9d8; reports antigos não foram reatribuídos ao GLB novo.

Confirmação VFX incorporada: [report original04:34](../../output/vfx-warcry-art-v1/art2/diagnosis-2026-09-19T04-34-38-848Z/report.json) e [revisão dos cinco originais](../../output/vfx-warcry-art-v1/art2/diagnosis-2026-09-19T04-34-38-848Z/visual-review.json). Pares Aldric .22/.48, via HTTP/loader real: transparent/depthWrite true/false→false/true, corpo shareddepth0→1, total54→55, mesmo passe e matrizes dos ossos. Torso121/121 em ambos; diferença visual discreta. Isso não resolve nem aprova a arte do grito. Art2 mantém seu original BLEND nos dois lados como controle histórico; a promoção posterior de metadata não reatribui essa prova nem pede nova captura. Hash live5c1903a0 e backup0e5da9d8 reconferidos após o aviso, sem nova promoção/edição de GLB.

## Export original e passo reproduzível

- [Original GLB0e5da9d8](../../assets/models/source-history/aldric-opaque-20260919/aldric-hero.glb).
- [Proveniência original copiada](../../assets/models/source-history/aldric-opaque-20260919/aldric-hero.provenance.json); `assets/models/aldric-hero.provenance.json` histórico também ficou byte-idêntico, descrevendo o export original, não esta revisão posterior.
- [Ferramenta de metadados](../../tools/animation-aldric-opaque-metadata.py), com hashes de entrada/saída fixados à prova aprovada.

```sh
python3 tools/animation-aldric-opaque-metadata.py \
  assets/models/source-history/aldric-opaque-20260919/aldric-hero.glb \
  output/arpg-animation/aldric-opaque-reproduced.glb
```

O resultado reproduz exatamente5c1903a0. **Regra para qualquer exporter futuro:** exportar primeiro em cópia isolada; preservar o raw/provenance; executar o passo de metadados e comparar material/alpha, rig/clips/BIN antes de coordenar a promoção. Não executar o exporter legado diretamente sobre o runtime promovido: ele não conhece a revisão de metadados. A ferramenta recusa hash de origem novo; um novo export exige auditoria de alpha/identidade e atualização explícita da linhagem, nunca apagar silenciosamente a correção. O exporter legado não foi alterado/executado neste lote.

Dwarf/material do rifle fica fora deste escopo. Runtime heróis07952 e cortee37398db permanecem congelados; acceptedNoSliding:false.
