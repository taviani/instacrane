import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Hauteur du clavier iOS à réserver en bas. Android redimensionne déjà la fenêtre. */
export function useKeyboardLift(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
