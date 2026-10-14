import { strokeToPath } from "@ronde/domain";
import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { RADIUS, useTheme } from "../theme";

export interface SignatureValue {
  width: number;
  height: number;
  strokes: number[][];
}

/**
 * Zone de signature au doigt. Les tracés sont gardés sous forme de coordonnées : c'est ce qui
 * est envoyé au serveur, qui reconstruit lui-même le SVG.
 */
export function SignaturePad({ onChange }: { onChange: (value: SignatureValue | null) => void }) {
  const theme = useTheme();
  const [strokes, setStrokes] = useState<number[][]>([]);
  const all = useRef<number[][]>([]);
  const size = useRef({ width: 0, height: 0 });
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const render = () => setStrokes(all.current.map((s) => [...s]));
  const emit = () => {
    const value = all.current.filter((s) => s.length >= 2);
    onChangeRef.current(
      value.length ? { width: Math.round(size.current.width), height: Math.round(size.current.height), strokes: value } : null,
    );
  };

  // Créé une seule fois. Les gestionnaires ne lisent les refs qu'au moment des gestes, jamais
  // pendant le rendu : la règle ne peut pas le déduire de PanResponder.create.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false, // le défilement ne vole pas le tracé
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        all.current.push([locationX, locationY]);
        render();
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        all.current.at(-1)?.push(locationX, locationY);
        render();
      },
      onPanResponderRelease: () => emit(),
    }),
  );

  return (
    <View>
      <View
        testID="signature-pad"
        accessible
        accessibilityLabel="Zone de signature du client"
        accessibilityHint="Faites signer le client avec le doigt dans ce cadre"
        onLayout={(e: LayoutChangeEvent) => (size.current = e.nativeEvent.layout)}
        style={[styles.pad, { borderColor: theme.border, backgroundColor: "#ffffff" }]}
        {...responder.panHandlers}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          {strokes.map((s, i) => (
            <Path key={i} d={strokeToPath(s)} stroke="#18181b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
        {strokes.length === 0 && (
          <Text pointerEvents="none" style={[styles.placeholder, { color: "#8a8a94" }]}>
            Signez ici
          </Text>
        )}
      </View>
      <Text
        accessibilityRole="button"
        onPress={() => {
          all.current = [];
          render();
          emit();
        }}
        style={[styles.clear, { color: theme.brand }]}
      >
        Effacer
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { height: 200, borderWidth: 1, borderRadius: RADIUS, overflow: "hidden" },
  placeholder: { position: "absolute", alignSelf: "center", top: 88, fontSize: 16 },
  clear: { alignSelf: "flex-end", paddingVertical: 12, paddingHorizontal: 4, fontSize: 16, fontWeight: "600" },
});
