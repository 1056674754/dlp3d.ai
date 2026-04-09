import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import {
  type DebugLogEntry,
  getDebugLogs,
  subscribeDebugLogs,
  clearDebugLogs,
} from '@/store/debugLogStore';

const TAG_COLORS: Record<string, string> = {
  bridge: '#6ec6ff',
  web: '#81c784',
  rn: '#ffb74d',
  api: '#ce93d8',
  error: '#ef5350',
  perf: '#ffd54f',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export default function DebugOverlay() {
  const debugMode = useSelector((state: RootState) => state.app.debugMode);
  const [logs, setLogs] = useState<DebugLogEntry[]>(getDebugLogs);
  const [minimized, setMinimized] = useState(false);
  const listRef = useRef<FlatList>(null);
  const theme = useTheme();

  useEffect(() => subscribeDebugLogs(setLogs), []);

  useEffect(() => {
    if (!minimized && logs.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [logs.length, minimized]);

  const renderItem = useCallback(
    ({ item }: { item: DebugLogEntry }) => (
      <View style={styles.row}>
        <Text style={[styles.ts, { color: '#999' }]}>{fmtTime(item.ts)}</Text>
        <Text
          style={[
            styles.tag,
            { color: TAG_COLORS[item.tag] || '#aaa' },
          ]}
        >
          [{item.tag}]
        </Text>
        <Text style={styles.msg} numberOfLines={3}>
          {item.msg}
        </Text>
      </View>
    ),
    [],
  );

  if (!debugMode) return null;

  if (minimized) {
    return (
      <TouchableOpacity
        style={[styles.miniBubble, { backgroundColor: theme.colors.primary }]}
        onPress={() => setMinimized(false)}
        activeOpacity={0.7}
      >
        <Text style={styles.miniText}>DBG</Text>
      </TouchableOpacity>
    );
  }

  const screenH = Dimensions.get('window').height;

  return (
    <View style={[styles.container, { maxHeight: screenH * 0.4 }]}>
      <View style={[styles.header, { backgroundColor: '#1a1a2e' }]}>
        <Text style={styles.title}>Debug Log ({logs.length})</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="delete-outline"
            iconColor="#ccc"
            size={18}
            onPress={clearDebugLogs}
          />
          <IconButton
            icon="minus"
            iconColor="#ccc"
            size={18}
            onPress={() => setMinimized(true)}
          />
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={logs}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        initialNumToRender={30}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  title: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 2,
    alignItems: 'flex-start',
  },
  ts: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginRight: 4,
    width: 80,
  },
  tag: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginRight: 4,
    width: 54,
  },
  msg: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#e0e0e0',
  },
  miniBubble: {
    position: 'absolute',
    bottom: 64,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    opacity: 0.85,
  },
  miniText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
