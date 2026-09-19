# Focal1/8: Dwarf exato aprovado como metadata; composição retida por sobreposição

Root revisou os dois PNGs originais de `output/playwright/2026-09-19T05-37-28-168Z-cannon-depth-composition-vfx/`, os resultados por ROI, lifecycle e amostras GPU. Cena diagnóstica sintética com assets reais, não gameplay/input nem replay de poses exato. VFX selecionado anteriormente continua em cópia.

## Dwarf OPAQUE: autorização independente de promoção

GLB autorizado, recebido uma vez pelo loader: `output/qa/arpg-root-review/dwarf-material-audit-20260919/dwarf-rifleman-opaque-candidate.glb`, SHA256 **`dc0867dacd22b04e42475a686fffe808ad8c7e66e9889b2a182eb4393eb5378e`**. Sem clone/mutação manual de material. `DwarfBody` carregou transparent:false/depthWrite:true/opacity1; rifle igualmente opaco. O readback do ROI corporal tem medianaY1.925697m, não o chão. A Lyra é o ROI0 e preservou121/121 tanto em1 quanto8campos. A auditoria anterior comprova que só `materials[1].alphaMode` mudou; demais JSON e chunkBIN idênticos, textura completamente opaca.

Animation pode promover **somente esse GLB**, após encerrar e congelar sua captura v11 para não invalidar seu manifesto. Coordenar microjanela de fontes com Combat; preservar e11eadb8 e provenance/lineage em source-history; registrar hashes, delta exato e HTTPservido. Guardar a transformação de metadata em ferramenta com guardas de hash, como no Aldric, sem editar o exportador legado nem retarget/rig/skin/takes. Não aguardar nova autorização. Esta autorização não inclui composiçãoVFX, v11 ou qualquer outro asset.

## Composição: caso1 bom, caso8 ainda sem aceite

Em1campo, conjunto candidato preserva121/121 nos três ROIs. Fogo frontal reaparece sobre parte do núcleo; roxo e parte preta continuam distinguíveis. Em8campos próximos, o brilho roxo/branco acumula e a borda circular fica grossa. O fogo continua visível, mas o gate65% falha nos monstros: ROI1=68/121(56.198%), ROI2=75/121(61.983%). Lyra continua121/121. O baseline já falha nos mesmos monstros,63/121 e75/121; gravidade isolada é idêntica antes/depois. Portanto o defeito de sobreposição não nasceu da composição e não pode ser atribuído ao novo GLB Dwarf.

Root conferiu também metadata GLB live de Zombie91c975eb/Lichf6ddd47d/Bruted1d58b1a: os materiais são OPAQUE. Isso não substitui confirmar loader/prepass dos dois monstros específicos na fixture. A proteção atual deixa4% de contribuição por camada nas superfícies altas; acúmulo de cor/alpha e bloom são hipóteses, não causa já isolada.

Próximo VFX autorizado em cópia: diagnóstico curto no mesmo caso8, separando gás, Horizon e partículas e distinguindo cor antes/depois do bloom. Conferir depth/material nos ROIs1/2. Só depois ajustar proteção agregada/overlap de forma localizada, preservando1campo e identidade roxa/núcleo, sem desligar bloom global, reduzir contagens/duração/raio autoritativo, afrouxar65% ou escurecer o jogo. Não repetir quatro pares antigos nem a matriz global. Art2 do grito segue preparado e deve receber sua rodada artística após a fila Animation→canopy, coordenada por Combat.

## Custo e lifecycle

Cada variante tem24amostras válidas após8warmups, sem disjoint. Pipeline inteiro1440×900high: medianas antes→depois3.91750→3.63656ms(1campo),6.02300→6.82654ms(8). Medianas das diferenças pareadas+.10969ms e+.52046ms; dispersão alta, com outlierbaseline24.31004ms em8. Não afirmar ganho global, FPS fixo ou custo móvel. Um prepass; sem novoRT/passe. Lifecycle observou8→pause8→offscreen0→1→reset0→1→expiry0; zero errosGL.

`technicalPassed:true` registra funcionamento/compilação; `focalSilhouetteGate.passed:false` impede chamar o conjunto de aceito. Metadado Dwarf e correção da luz sobreposta seguem decisões independentes.

## Metadata Dwarf integrada

Animation promoveu o GLB dc0867 às05:51:13 sem re-exportar animação/rig. Root conferiu hash local e bytes HTTP idênticos nesta revisão; ledger preservado. Recibo `output/arpg-animation/dwarf-opaque-promotion/receipt.json` distingue esta promoção isolada das composições VFX ainda em avaliação.
