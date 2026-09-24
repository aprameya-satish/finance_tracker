import { ReactNode } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { shiftMonth } from '../money'
import { colors, spacing } from '../theme'

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top + 8 }]}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode
  onPress?: () => void
  style?: object
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.card, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[styles.card, style]}>{children}</View>
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primary, disabled && styles.disabled]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  )
}

export function GhostButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.ghost}>
      <Text style={[styles.ghostText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  )
}

export function WhoControl({ value, onChange }: { value: string; onChange: (who: string) => void }) {
  return (
    <View style={styles.whoRow}>
      {[
        ['A', 'A'],
        ['S', 'S'],
        ['shared', 'Shared'],
      ].map(([id, label]) => {
        const active = value === id
        return (
          <Pressable key={id} onPress={() => onChange(id)} style={[styles.whoChip, active && styles.whoChipOn]}>
            <Text style={[styles.whoText, active && styles.whoTextOn]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function MonthStepper({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  return (
    <View style={styles.monthRow}>
      <GhostButton label="‹" onPress={() => onChange(shiftMonth(value, -1))} />
      <Text style={styles.monthLabel}>{value}</Text>
      <GhostButton label="›" onPress={() => onChange(shiftMonth(value, 1))} />
    </View>
  )
}

export function PendingToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.pendingRow}>
      <Text style={styles.muted}>Include pending</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.green }}
        thumbColor={colors.white}
      />
    </View>
  )
}

export function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color = status === 'over' ? colors.red : status === 'watch' ? colors.amber : colors.green
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }]} />
    </View>
  )
}

export function CategoryBars({
  rows,
}: {
  rows: { category: string; total: number }[]
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.total)), 1)
  return (
    <View style={{ gap: 10 }}>
      {rows.slice(0, 7).map((row) => (
        <View key={row.category}>
          <View style={styles.barLabel}>
            <Text style={styles.barName}>{row.category}</Text>
            <Text style={styles.barAmt}>{Math.round(row.total / 100)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${(Math.abs(row.total) / max) * 100}%`, backgroundColor: colors.green },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  )
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  keyboardType?: 'default' | 'numeric' | 'url'
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  )
}

export function PickerModal<T extends { id: string | number; label: string }>({
  visible,
  title,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean
  title: string
  options: T[]
  onClose: () => void
  onSelect: (option: T) => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((option) => (
              <Pressable key={String(option.id)} style={styles.modalRow} onPress={() => onSelect(option)}>
                <Text style={styles.modalRowText}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  eyebrow: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '600', letterSpacing: -0.6, marginBottom: 16 },
  muted: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  primary: { backgroundColor: colors.white, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primaryText: { color: colors.black, fontWeight: '600' },
  ghost: { paddingVertical: 8, paddingHorizontal: 10 },
  ghostText: { color: colors.muted, fontSize: 15 },
  disabled: { opacity: 0.4 },
  disabledText: { opacity: 0.4 },
  whoRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  whoChip: { paddingVertical: 6, paddingHorizontal: 10 },
  whoChipOn: { backgroundColor: colors.white },
  whoText: { color: colors.muted, fontSize: 12 },
  whoTextOn: { color: colors.black, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthLabel: { color: colors.text, fontVariant: ['tabular-nums'], minWidth: 80, textAlign: 'center' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  track: { height: 6, backgroundColor: colors.surface2, borderRadius: 99, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 99 },
  barLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barName: { color: colors.text, fontSize: 13 },
  barAmt: { color: colors.muted, fontVariant: ['tabular-nums'], fontSize: 13 },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.text, fontSize: 16, marginBottom: 10 },
  modalRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  modalRowText: { color: colors.text, fontSize: 16 },
})
