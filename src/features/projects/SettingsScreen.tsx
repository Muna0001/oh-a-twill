import Constants from 'expo-constants';
import { View } from 'react-native';

import type { Side } from '@/engine';
import { useSettings, type Settings } from '@/store';
import { Checkbox, ColorField, Header, Panel, Screen, Segmented, Stepper, Text, useTheme } from '@/ui';

import { copy } from './copy';
import { Field } from './parts';

const FALLBACK_VERSION = '1.0.0';

function appVersion(): string {
  try {
    return Constants.expoConfig?.version ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

const sideOptions = [
  { value: 'left', label: copy.setup.leftEdge },
  { value: 'right', label: copy.setup.rightEdge },
] as const;

const themeOptions = [
  { value: 'system', label: copy.settings.system },
  { value: 'light', label: copy.settings.light },
  { value: 'dark', label: copy.settings.dark },
] as const;

/** The Settings tab. Every change is written to the settings store straight away. */
export function SettingsScreen() {
  const theme = useTheme();
  const s = useSettings();
  const set = s.set;

  return (
    <Screen scroll header={<Header title={copy.settings.title} />} testID="settings-screen">
      <Panel style={{ gap: theme.spacing.xl }}>
        <Text variant="heading">{copy.settings.newProjects}</Text>
        <Field label={copy.settings.defaultWarps}>
          <Stepper
            value={s.defaultWarps}
            min={4}
            max={120}
            onChange={(n) => set({ defaultWarps: n })}
            accessibilityLabel={copy.settings.defaultWarpsLabel}
            decrementLabel={copy.setup.fewerWarps}
            incrementLabel={copy.setup.moreWarps}
          />
        </Field>
        <Field label={copy.settings.defaultSide}>
          <Segmented<Side>
            accessibilityLabel={copy.settings.defaultSide}
            options={sideOptions}
            value={s.defaultSide}
            onChange={(defaultSide) => set({ defaultSide })}
          />
        </Field>
        <Field label={copy.settings.defaultColors}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xl }}>
            <ColorField label={copy.setup.colorA} value={s.defaultColors[0]} onChange={(hex) => set({ defaultColors: [hex, s.defaultColors[1]] })} />
            <ColorField label={copy.setup.colorB} value={s.defaultColors[1]} onChange={(hex) => set({ defaultColors: [s.defaultColors[0], hex] })} />
          </View>
        </Field>
      </Panel>

      <Panel>
        <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
          {copy.settings.weaving}
        </Text>
        <Checkbox checked={s.haptics} onChange={(haptics) => set({ haptics })} label={copy.settings.haptics} hint={copy.settings.hapticsHint} />
        <Checkbox checked={s.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label={copy.settings.keepAwake} />
      </Panel>

      <Panel style={{ gap: theme.spacing.md }}>
        <Text variant="heading">{copy.settings.theme}</Text>
        <Segmented<Settings['theme']>
          accessibilityLabel={copy.settings.theme}
          options={themeOptions}
          value={s.theme}
          onChange={(value) => set({ theme: value })}
        />
      </Panel>

      <Panel style={{ gap: theme.spacing.sm }}>
        <Text variant="heading">{copy.settings.about}</Text>
        <View>
          <Text weight="semibold">{copy.settings.appName}</Text>
          <Text variant="hint" tabular>
            {copy.settings.version(appVersion())}
          </Text>
        </View>
        <Text>{copy.settings.privacy}</Text>
        <Text variant="hint">{copy.settings.saved}</Text>
      </Panel>
    </Screen>
  );
}
