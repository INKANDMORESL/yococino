// Vídeo original de una receta guardada de redes, con el reproductor oficial de TikTok, YouTube o Instagram.
// Se carga solo al tocarlo (así no se conecta con esas redes ni gasta datos sin que la persona quiera).
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius, space, type } from '../../theme';
import { alturaVideo, redDe } from './videoComun';

export function VideoOriginal({ embed, origen, autor }: { embed: string; origen: string | null; autor: string | null }) {
  const [cargar, setCargar] = useState(false);
  const red = redDe(embed);
  return (
    <View style={{ gap: space.sm }}>
      {cargar ? (
        <View style={[s.marco, { height: alturaVideo(red) }]}>
          <WebView source={{ uri: embed }} allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} style={{ flex: 1 }} />
        </View>
      ) : (
        <Pressable onPress={() => setCargar(true)} accessibilityRole="button" accessibilityLabel="Ver el vídeo original" style={s.portada}>
          <Text style={{ fontSize: 44 }}>▶️</Text>
          <Text style={s.titulo}>Ver el vídeo original</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>Se carga desde {red}.</Text>
        </Pressable>
      )}
      <Text style={type.small}>
        Vídeo de {autor || 'su creador'} en {red}.{' '}
        {origen ? (
          <Text style={s.enlace} onPress={() => Linking.openURL(origen).catch(() => {})}>
            Abrir en {red}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  marco: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  portada: { height: 180, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  titulo: { color: '#fff', fontSize: 17, fontWeight: '700' },
  enlace: { color: colors.olive, fontWeight: '700' },
});
