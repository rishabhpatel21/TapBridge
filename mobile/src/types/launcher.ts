export type LauncherKind = 'app' | 'website';

export type IconSet = 'Ionicons' | 'MaterialCommunityIcons' | 'FontAwesome5';

export type VectorIconSpec = {
  type?: 'vector';
  set: IconSet;
  name: string;
  color: string;
};

export type ImageIconSpec = {
  type: 'image';
  uri: string;
  backgroundColor?: string;
};

export type IconSpec = VectorIconSpec | ImageIconSpec;

export type LauncherItem = {
  id: string;
  name: string;
  kind: LauncherKind;
  target: string;
  icon: IconSpec;
};
