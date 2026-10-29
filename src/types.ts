export type IconName =
  | 'home' | 'user' | 'users' | 'scroll' | 'book' | 'map' | 'sword' | 'shield' | 'heart' | 'soul'
  | 'bell' | 'gear' | 'lock' | 'search' | 'eye' | 'eyeoff' | 'menu' | 'close' | 'chevron' | 'plus'
  | 'skull' | 'crown' | 'compass' | 'pack' | 'star' | 'check' | 'alert' | 'info' | 'door' | 'dice'
  | 'feather' | 'spark' | 'flag' | 'hourglass' | 'gem' | 'sheet' | 'back' | 'logout' | 'mask'
  | 'armor' | 'crosshair' | 'play' | 'forward' | 'user-plus' | 'history' | 'droplet'
  | 'edit' | 'trash' | 'layers' | 'map-pin' | 'door-open' | 'alert-triangle'
  | 'moon' | 'shopping-bag' | 'plus-circle' | 'grid' | 'file-text' | 'ruler' | 'image' | 'cloud' | 'x';

export type Role = 'visitante' | 'jogador' | 'mestre';

export type CharacterType = 'principal' | 'extra' | 'invocacao';
export type RequestStatus = 'pendente' | 'aprovado' | 'rejeitado';

/** Quem pode ver uma informação (modelo conceitual — a imposição real virá no servidor). */
export type Visibility = 'publico' | 'jogadores' | 'mestre';
