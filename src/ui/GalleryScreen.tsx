import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { ColorField } from './ColorField';
import { Checkbox, Chip, SearchField, Segmented, Stepper, Swatch, TextField, Tip, type ChipTone } from './controls';
import { Icon, iconNames } from './Icon';
import { BottomBar, Collapsible, EmptyState, Header, Panel, Screen, Sheet } from './layout';
import { Text } from './Text';
import { useTheme, useThemePreference, type ColorToken, type ShadowName, type ThemePreference } from './theme';

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const tokens: ColorToken[] = [
  'bg', 'surface', 'surfaceAlt', 'ink', 'muted', 'graphite', 'stone', 'line', 'cloud',
  'mint', 'marigold', 'periwinkle', 'pastelInk', 'papaya',
  'weft', 'weftInk', 'warp', 'warpShade', 'mark', 'overChip', 'underChip', 'warn', 'warnBg', 'btn', 'btnInk',
];
const chipTones: ChipTone[] = ['neutral', 'outline', 'over', 'weft', 'mint', 'marigold', 'periwinkle'];
const shadowNames: ShadowName[] = ['float', 'lift', 'bar', 'segment'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <Panel>
      <Text variant="heading" style={{ marginBottom: theme.spacing.md }}>
        {title}
      </Text>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </Panel>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>{children}</View>;
}

/** Dev page: every primitive and icon. Route: /gallery. */
export function GalleryScreen() {
  const theme = useTheme();
  const [preference, setPreference] = useThemePreference();
  const [warps, setWarps] = useState(24);
  const [edge, setEdge] = useState<'left' | 'right'>('left');
  const [mirror, setMirror] = useState(true);
  const [fav, setFav] = useState(false);
  const [weft, setWeft] = useState('#2e4c8f');
  const [warp, setWarp] = useState('#e4dcc8');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sheet, setSheet] = useState(false);
  const [row, setRow] = useState(37);
  const [name, setName] = useState('Blue scarf');

  return (
    <Screen
      scroll
      header={<Header title="Gallery" subtitle="Every primitive, in the current theme." back right={<Button icon="ellipsis-horizontal" accessibilityLabel="More" />} />}
      footer={
        <BottomBar
          left={<Button size="lg" icon="chevron-left" label="Back" accessibilityLabel="Previous row" disabled={row <= 1} onPress={() => setRow(row - 1)} />}
          center={`Row ${row}`}
          right={<Button size="lg" variant="primary" label="Row done" trailingIcon="chevron-right" onPress={() => setRow(row + 1)} />}
        />
      }>
      <Section title="Theme">
        <Segmented accessibilityLabel="Theme" options={themeOptions} value={preference} onChange={(v: ThemePreference) => setPreference(v)} />
        <Row>
          {tokens.map((token) => (
            <View key={token} style={{ alignItems: 'center', width: 74, gap: 2 }}>
              <Swatch color={theme.colors[token]} size={36} />
              <Text variant="hint" style={{ fontSize: 12 }}>
                {token}
              </Text>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Text">
        <Text variant="display">Display 46</Text>
        <Text variant="title">Title 34 serif</Text>
        <Text variant="subtitle">Subtitle 24 serif</Text>
        <Text variant="heading">Heading 18 semibold</Text>
        <Text>Body 16. Set your warp, pick a pattern or a picture, then weave one row at a time.</Text>
        <Text variant="label">Label 14 medium</Text>
        <Text variant="hint">Hint 14 muted. Fits a loom at least 12 cm wide.</Text>
        <Text variant="caption">Caption 12. Warps 1–24</Text>
        <Text color="graphite">Graphite: emphasised secondary text.</Text>
        <Row>
          <Text variant="rowNumber">37</Text>
          <Text color="muted" weight="medium">
            of 120
          </Text>
        </Row>
        <Row>
          <Text weight="regular">Regular</Text>
          <Text weight="medium">Medium</Text>
          <Text weight="semibold">Semibold</Text>
          <Text weight="bold">Bold</Text>
        </Row>
      </Section>

      <Section title="Buttons">
        <Row>
          <Button label="Default" />
          <Button label="Primary" variant="primary" />
          <Button label="Link" variant="link" />
        </Row>
        <Row>
          <Button label="Restart" icon="arrow-path" />
          <Button label="Row done" variant="primary" trailingIcon="chevron-right" />
          <Button label="Selected" selected />
        </Row>
        <Row>
          <Button label="Disabled" disabled />
          <Button label="Disabled" variant="primary" disabled />
          <Button icon="trash" accessibilityLabel="Delete" />
          <Button icon="heart" accessibilityLabel="Favorite" selected={fav} onPress={() => setFav(!fav)} />
        </Row>
        <Row>
          <Button label="Large" size="lg" icon="chevron-left" />
          <Button label="Large primary" size="lg" variant="primary" trailingIcon="chevron-right" />
        </Row>
        <Button label="Full width" variant="primary" fullWidth icon="photo" />
      </Section>

      <Section title="Shadows">
        <Row>
          {shadowNames.map((s) => (
            <View key={s} style={[{ width: 96, height: 64, borderRadius: theme.radii.field, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', margin: 8 }, theme.shadows[s]]}>
              <Text variant="caption">{s}</Text>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Segmented, stepper, checkbox">
        <Text variant="label">Start edge</Text>
        <Segmented
          accessibilityLabel="Start edge"
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
          value={edge}
          onChange={setEdge}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading">Warp threads</Text>
            <Text variant="hint">Between 4 and 120. Hold to repeat.</Text>
          </View>
          <Stepper value={warps} min={4} max={120} onChange={setWarps} accessibilityLabel="Number of warp threads" decrementLabel="Fewer warps" incrementLabel="More warps" />
        </View>
        <Checkbox checked={mirror} onChange={setMirror} label="Mirror every other repeat" hint="Makes a zigzag." />
        <Checkbox checked={false} onChange={() => {}} label="Disabled" disabled />
      </Section>

      <Section title="Chips">
        <Row>
          <Chip label="Left to right" tone="over" icon="arrow-long-right" size="md" />
          <Chip label="Over 2" tone="weft" />
          <Chip label="Under 2" />
          <Chip label="Row 3 of 4" selected />
          <Chip label="Finished" tone="mint" icon="check" size="md" />
        </Row>
        <Row>
          {chipTones.map((tone) => (
            <Chip key={tone} label={tone} tone={tone} />
          ))}
        </Row>
        <Row>
          {['All', 'Twill', 'Plain', 'Texture'].map((c) => (
            <Chip key={c} label={c} tone="outline" selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </Row>
      </Section>

      <Section title="Tip, swatch, color field">
        <Tip>This row starts with an under. Catch the edge warp so the weft does not pull out.</Tip>
        <Row>
          <Swatch color="#2e4c8f" />
          <Swatch color="#e4dcc8" />
          <Swatch color="#c0392b" size={24} />
          <Swatch color="#d9a521" size={24} radius={12} />
        </Row>
        <Row>
          <ColorField label="Weft" value={weft} onChange={setWeft} />
          <ColorField label="Warp" value={warp} onChange={setWarp} />
        </Row>
      </Section>

      <Section title="Search, text field, sheet">
        <SearchField value={query} onChangeText={setQuery} placeholder="Search stitches" />
        <Text variant="label">Project name</Text>
        <TextField value={name} onChangeText={setName} accessibilityLabel="Project name" placeholder="Name" />
        <TextField value="#12XZ" onChangeText={() => {}} accessibilityLabel="Invalid example" invalid tabular />
        <Button label="Open sheet" onPress={() => setSheet(true)} />
        <Sheet visible={sheet} onClose={() => setSheet(false)} title="A sheet">
          <Text>Anything can go here.</Text>
          <Button label="Done" variant="primary" fullWidth onPress={() => setSheet(false)} style={{ marginTop: 16 }} />
        </Sheet>
      </Section>

      <Panel variant="hero">
        <Text variant="label">Hero panel: radius 24, float shadow</Text>
        <Row>
          <Text variant="rowNumber">{row}</Text>
          <Chip label="Left to right" tone="over" icon="arrow-long-right" size="md" />
        </Row>
      </Panel>

      <Panel>
        <Collapsible title="The math">
          <Text variant="hint">Collapsible content. 24 warps ÷ 4 = 6 repeats.</Text>
        </Collapsible>
      </Panel>

      <Panel>
        <EmptyState icon="queue-list" title="No projects yet" message="Pick a stitch or start from a picture." action={<Button label="New from picture" icon="photo" variant="primary" />} />
      </Panel>

      <Section title="Icons">
        <Row>
          {iconNames.map((name) => (
            <View key={name} style={{ width: 98, alignItems: 'center', gap: 4, paddingVertical: 8 }}>
              <Icon name={name} size={24} />
              <Text variant="hint" align="center" style={{ fontSize: 11, lineHeight: 14 }}>
                {name}
              </Text>
            </View>
          ))}
          <View style={{ width: 98, alignItems: 'center', gap: 4, paddingVertical: 8 }}>
            <Icon name="heart" size={24} filled color="weft" />
            <Text variant="hint" align="center" style={{ fontSize: 11, lineHeight: 14 }}>
              heart filled
            </Text>
          </View>
        </Row>
      </Section>
    </Screen>
  );
}
