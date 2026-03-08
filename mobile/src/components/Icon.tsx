import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { IconSpec } from '../types/launcher';

const SVG_PREFIX = 'data:image/svg+xml;utf8,';

export const Icon = ({ icon, size }: { icon: IconSpec; size: number }) => {
  if ('uri' in icon && icon.uri) {
    if (icon.uri.startsWith(SVG_PREFIX)) {
      try {
        const xml = decodeURIComponent(icon.uri.slice(SVG_PREFIX.length));
        return <SvgXml xml={xml} width={size} height={size} />;
      } catch {
        return null;
      }
    }
    return <Image source={{ uri: icon.uri }} style={[styles.image, { width: size, height: size }]} />;
  }

  switch (icon.set) {
    case 'MaterialCommunityIcons':
      return <MaterialCommunityIcons name={icon.name as any} size={size} color={icon.color} />;
    case 'FontAwesome5':
      return <FontAwesome5 name={icon.name as any} size={size} color={icon.color} />;
    case 'Ionicons':
    default:
      return <Ionicons name={icon.name as any} size={size} color={icon.color} />;
  }
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'contain'
  }
});
