import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CallTile, Facing } from '../../call/CallSession';
import VideoTile from './VideoTile';

// Kişi sayısına göre sütun × satır: 1 tam ekran, 2 alt alta, 3-4 → 2x2, 5-6 → 2x3
function gridShape(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 1, rows: 2 };
  if (count <= 4) return { cols: 2, rows: 2 };
  return { cols: 2, rows: 3 };
}

type Props = { tiles: CallTile[]; facing: Facing };

export default function CallGrid({ tiles, facing }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { cols, rows } = gridShape(tiles.length);
  const width = size.width / cols;
  const height = size.height / rows;

  return (
    <View style={styles.grid} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {size.width > 0 &&
        tiles.map((tile) => <VideoTile key={tile.key} tile={tile} width={width} height={height} facing={facing} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tek kalan kare (3 ve 5 kişide) satırda ortalanır
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start' },
});
