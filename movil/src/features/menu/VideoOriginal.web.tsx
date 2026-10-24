// Versión web: el reproductor oficial va en un iframe. Se carga solo al tocarlo.
import { createElement, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../../theme';
import { alturaVideo, redDe } from './videoComun';

export function VideoOriginal({ embed, origen, autor }: { embed: string; origen: string | null; autor: string | null }) {
  const [cargar, setCargar] = useState(false);
  const red = redDe(embed);
  return (
    <View style={{ gap: space.sm }}>
      {cargar ? (
        <View style={[s.marco, { height: alturaVideo(red) }]}>
          {createElement('iframe', {
            src: embed,
            title: 'Vídeo original de la receta',
            allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
            allowFullScreen: true,
            style: { border: 0, width: '100%', height: '100%' },
          })}
        </View>
      ) : (
        <Pressable onPress={() => setCargar(true)} accessibilityRole="button" accessibilityLabel="Ver el vídeo original" style={s.portada}>
          <Text style={{ fontSize: 44 }}>▶️</Text>
          <Text style={s.titulo}>Ver el vídeo original</Text>
          <Text style={[type.small, { textAlign: 'center', color: 'rgba(255,255,255,0.75)' }]}>Se carga desde {red}.</Text>
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
  marco: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', maxWidth: 480, width: '100%', alignSelf: 'center' },
  portada: { height: 180, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  titulo: { color: '#fff', fontSize: 17, fontWeight: '700' },
  enlace: { color: colors.olive, fontWeight: '700' },
});
