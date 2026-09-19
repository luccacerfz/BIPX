# Combat — glifos atuais verificados em pixels

**07:23UTC: bloqueio histórico não reproduzido.** Live5173 **PID22588** entrega `assets/ui/arpg/icons.svg` com **HTTP200 / image/svg+xml / nosniff**, bytes exatos ao disco. O achado23:35/23:44 do `review/visual-review.md` pertence a18setembro/PID2591/pré-v2 e fica intacto. Server atual já estava atualizado; **nenhum novo restart ou edição de runtime** foi necessário.

[Verificação consolidada](../../output/qa/arpg-current-glyphs-20260919/verification.json), [native4casos](../../output/qa/arpg-current-glyphs-20260919/native/2026-09-19T07-20-52-636Z/report.json), [16regiões de pixelsPASS](../../output/qa/arpg-current-glyphs-20260919/native/2026-09-19T07-20-52-636Z/pixels.json). Navegador próprio serviu5173 real, iniciou partidasoffline porUI, sem snapshotHUD simulado/interceptação de main; Aldric/Lyra em1280×800 e393×852 comtouchviewportemulado.239fontes estáveis, nenhum erro, ledger7f580798 preservado.

O HUD atual usa SVG para espada/rifle e seis pinturasWebP para skills. Cada caso foi capturado normal→somente desenhos ocultos→restaurado, sem alterar fontes/estado de jogo. Crop exclui3px de borda; pixelprova requer diferença≥24 entre normal/oculto e≤10 entre normal/restaurado. Espada155/116 e rifle193/135pixels estáveis; pinturas700–2517pixels porregião. Logo não é contagemDOM/getBBox nem mero fundo de slot.

Quatro originaisHUD vistos: espada/rifle dourados e os três desenhos de cada classe estão presentes nos dois tamanhos, com teclas/custos legíveis. Isso não aprova arteAAA, Safari/aparelho físico/acessibilidade inteira ou gameplaynatural. Browser/contextos/token próprios encerrados; abas do usuário intocadas. GUI e Environment avisados; GPU liberada. JEF07:12 continua imutável, com esta prova em adendo separado.
