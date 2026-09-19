# Suspensão de rede e apresentação persistente

Leitura estática root: `connectMultiplayer` close limpa input/jogadores remotos, mas não snapshots/status persistentes. `animate` bloqueia simulação com `isMultiplayerSuspended`, porém samples.update continua recebendo playing:true/paused:false, e syncPersistentSkillPresentation continua consumindo remoteSkillSnapshots a cada frame/status10Hz. Os remaining podem permanecer constantes após perder a conexão.

Inferência pendente de reprodução: status antigo renova sustain e campo VFX indefinidamente se reconnect não completar. Isso também pode manter o novo depth pass requisitado. Core/servidor cancelar estado não cancela uma cópia cliente sem novo snapshot. Não foi feita escuta nem captura natural deste caso pelo root.

Astra SFX recebeu reprodução CPU isolada de chamadas/remaining ao longo de12s+ e proposta mínima de cancelamento silencioso local/remoto, preservando recursos/CD e resync a partir de snapshots novos. Combat continua dono de main. Nenhuma alteração runtime foi feita pelo root; o caso fica separado das provas anteriores de pausa/mute/reconnect autoritativo.

## Confirmação posterior e correção integrada

SFX reproduziu extensão indevida de sustain por status antigo e falso collapse por snapshot removido em fixture OfflineAudioContext01:23:35. Combat aplicou os hunks mínimos no main atual em01:29, preservando recursos/recargas/sequência. A evidência anterior acima passa a ser histórica.

`output/playwright/2026-09-19T01-32-23-124Z-audio-reconnect-gameplay/audio-reconnect-summary.json`:23/23/sourceStable:true com dois navegadores e WebAudio reais. Socket fecha, loops param, o peer remove campo, reconnect não repete cast/release/impact/collapse nem ressuscita campo. Root leu o relatório; não executou escuta. Tentativa de fornecer o MP3 real à ferramenta retornou explicitamente áudio omitido por falta de suporte a entrada de áudio. Nenhuma qualidade perceptual é inferida do PCM ou desses checks.
