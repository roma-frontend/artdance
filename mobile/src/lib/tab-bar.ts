import { makeMutable } from 'react-native-reanimated';

/** 0 — навбар виден, 1 — скрыт. Общий для экранов, поэтому вне React. */
export const tabBarHidden = makeMutable(0);
