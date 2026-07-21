import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDisplay } from '../engine/dates.js'
import { stayDuration, LIMIT_DAYS } from '../engine/schengen.js'

const s = StyleSheet.create({
  page: { backgroundColor: '#0F1216', color: '#EEF1F6', padding: 32, fontSize: 10 },
  h1: { fontSize: 18, marginBottom: 2 },
  sub: { fontSize: 9, color: '#8B94A5', marginBottom: 16 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tile: { flex: 1, borderWidth: 1, borderColor: '#232A36', borderRadius: 8, padding: 10 },
  tileLabel: { fontSize: 7, color: '#5B6474', letterSpacing: 1, marginBottom: 4 },
  tileValue: { fontSize: 16 },
  chart: { width: '100%', height: 200, marginBottom: 18 },
  sectionTitle: { fontSize: 8, color: '#5B6474', letterSpacing: 1, marginBottom: 6 },
  row: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A1F29',
    paddingVertical: 6, alignItems: 'center',
  },
  head: { borderBottomColor: '#2E3644', color: '#8B94A5', fontSize: 8 },
  cName: { flex: 3 }, cCountry: { flex: 2, color: '#8B94A5' },
  cDate: { flex: 3 }, cDays: { flex: 1, textAlign: 'right' },
  foot: { position: 'absolute', bottom: 24, left: 32, right: 32, fontSize: 7, color: '#5B6474' },
})

const STATUS_TEXT = {
  compliant: 'Compliant',
  warning: 'Getting close to the limit',
  over: 'Over the limit',
}
const STATUS_COLOR = { compliant: '#3DD68C', warning: '#F5B84B', over: '#FF6B6B' }

/** One component drives BOTH the in-app preview and the downloaded file. */
export default function ReportDocument({
  stays, chartPng, used, remaining, status, generatedOn, referenceDate,
}) {
  return (
    <Document title="Schengen 90/180 report">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Schengen 90/180 report</Text>
        <Text style={s.sub}>
          Rolling window ending {formatDisplay(referenceDate)} · both entry and exit days count
        </Text>

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>DAYS USED</Text>
            <Text style={s.tileValue}>{used} / {LIMIT_DAYS}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>DAYS LEFT</Text>
            <Text style={s.tileValue}>{remaining}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>STATUS</Text>
            <Text style={[s.tileValue, { color: STATUS_COLOR[status], fontSize: 11 }]}>
              {STATUS_TEXT[status]}
            </Text>
          </View>
        </View>

        {chartPng ? <Image src={chartPng} style={s.chart} /> : null}

        <Text style={s.sectionTitle}>STAYS</Text>
        <View style={[s.row, s.head]}>
          <Text style={s.cName}>Name</Text>
          <Text style={s.cCountry}>Country</Text>
          <Text style={s.cDate}>Dates</Text>
          <Text style={s.cDays}>Days</Text>
        </View>
        {stays.map((stay) => (
          <View key={stay.id} style={s.row}>
            <Text style={s.cName}>{stay.name}</Text>
            <Text style={s.cCountry}>{stay.country || '—'}</Text>
            <Text style={s.cDate}>
              {formatDisplay(stay.startDate)} → {formatDisplay(stay.endDate)}
            </Text>
            <Text style={s.cDays}>{stayDuration(stay)}</Text>
          </View>
        ))}

        <Text style={s.foot} fixed>
          Generated {generatedOn} · Schengen Tracker · This report is an aid, not legal advice.
        </Text>
      </Page>
    </Document>
  )
}
